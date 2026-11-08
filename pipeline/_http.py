"""Cached, throttled HTTP GET for pipeline scripts (build time only; the app never fetches).

Every response body is stored gzip-compressed under data/cache/<host>/<sha256 of URL>.json.gz,
so reruns never refetch. Requests carry a descriptive User-Agent and are rate-limited
across threads. Set BIOMAP_OFFLINE=1 to fail instead of fetching anything not cached.

A download that still fails after its retries raises DownloadError, and steps never catch it:
the step stops with one clear line rather than let another candidate take the failed one's
place, so a rerun never silently changes content. A 404 is an answer, not a failure: it is
remembered (in the JSON cache, or a <file>.404 marker next to a file download) and raised as
NotFound, which a step may catch only where "not there" is the expected answer (an ontology
term or optional file that may not exist). Uncaught, it stops the step the same way.

Transfers use curl, not Python's urllib: the Human Protein Atlas server cuts HTTP/1.1 transfers
of its larger records short (urllib: IncompleteRead, on every attempt), and curl negotiates HTTP/2.
"""
import gzip
import hashlib
import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data/cache'
USER_AGENT = 'BioMap-pipeline/0.1 (+https://github.com/oldwetham/fullbiomap; educational anatomy atlas build)'


class NotFound(Exception):
    """The server answered 404 Not Found; remembered at `memo`, so reruns get the same answer."""

    def __init__(self, url, memo=None):
        super().__init__(url)
        self.url, self.memo = url, memo

    def __str__(self):
        return f'{self.url} answered 404 Not Found' + (f' (remembered in {self.memo}; delete that file to ask again)' if self.memo else '')


class DownloadError(Exception):
    """A download that failed after its retries. Steps do not catch it (see the module docstring)."""


def _report(kind, exc, tb):
    """One clear line instead of a traceback when a download stops a step."""
    if isinstance(exc, (DownloadError, NotFound)):
        print(f'{Path(sys.argv[0]).stem}: stopped: {exc}. A failed download stops the step rather than let another candidate take its place; '
              'downloads that finished are cached, so running the step again resumes.', file=sys.stderr)
    else:
        _default_hook(kind, exc, tb)


_default_hook, sys.excepthook = sys.excepthook, _report


class _Limiter:
    def __init__(self, per_second):
        self.interval, self.lock, self.next = 1 / per_second, threading.Lock(), 0.0

    def wait(self):
        with self.lock:
            now = time.monotonic()
            delay = self.next - now
            self.next = max(now, self.next) + self.interval
        if delay > 0:
            time.sleep(delay)


_limiter = _Limiter(float(os.environ.get('BIOMAP_RPS', '5')))
stats = {'cached': 0, 'fetched': 0, 'notFound': 0}
_stats_lock = threading.Lock()


def _count(key):
    with _stats_lock:
        stats[key] += 1


def cache_path(url):
    host = urllib.parse.urlparse(url).hostname or 'unknown'
    return CACHE / host / f'{hashlib.sha256(url.encode()).hexdigest()}.json.gz'


def _rel(p):
    p = Path(p)
    return p.relative_to(ROOT) if p.is_relative_to(ROOT) else p


def _curl(url, out, *, accept=None, resume=False, stall=300):
    """One GET; the body goes to `out` (appended to it when resuming). Returns (curl's exit code, the HTTP
    status or 0, curl's message). With --fail an HTTP error writes no body and fails with exit code 22, or 56
    over HTTP/2, so callers go by the status."""
    cmd = ['curl', '--silent', '--show-error', '--fail', '--location', '--max-redirs', '10',
           '--proto', '=http,https', '--proto-redir', '=http,https', '--connect-timeout', '60',
           '--speed-limit', '1', '--speed-time', str(stall),  # a transfer that stalls this long fails (and is retried)
           '--user-agent', USER_AGENT, '--output', str(out), '--write-out', '%{http_code}']
    if accept:
        cmd += ['--header', f'Accept: {accept}']
    if resume:
        cmd += ['--continue-at', '-']
    if os.environ.get('SSL_CERT_FILE'):
        cmd += ['--cacert', os.environ['SSL_CERT_FILE']]
    p = subprocess.run([*cmd, url], capture_output=True, text=True)
    status = p.stdout.strip()
    return p.returncode, int(status) if status.isdigit() else 0, p.stderr.strip()


def _retryable(code, status, message):
    """(worth another attempt?, what went wrong) for a failed attempt; an HTTP error status decides it."""
    if status >= 400:
        return status in (408, 425, 429, 500, 502, 503, 504), f'HTTP {status}'
    if code in (1, 2, 3):  # unsupported protocol, curl could not start, malformed URL: no retry helps
        return False, message or f'curl exit code {code}'
    return True, message or f'curl exit code {code}'


def get_json(url, retries=5):
    """Return parsed JSON for url, from cache if present. 404s are cached too (raise NotFound);
    any other failure raises DownloadError once the retries are spent."""
    path = cache_path(url)
    if path.exists():
        _count('cached')
        record = json.loads(gzip.decompress(path.read_bytes()))
        if record['status'] == 404:
            _count('notFound')
            raise NotFound(url, _rel(path))
        return record['body']
    if os.environ.get('BIOMAP_OFFLINE'):
        raise DownloadError(f'{url} is not cached and BIOMAP_OFFLINE is set')
    path.parent.mkdir(parents=True, exist_ok=True)
    body = path.with_name(path.name + '.body')
    try:
        for attempt in range(retries):
            _limiter.wait()
            code, status, message = _curl(url, body, accept='application/json', stall=120)
            if status == 404:
                record = {'url': url, 'status': 404, 'body': None}
                break
            if code == 0:
                try:
                    record = {'url': url, 'status': status, 'body': json.loads(body.read_bytes())}
                    break
                except ValueError as e:  # JSONDecodeError, or bytes that are not text
                    message = f'the response is not JSON ({e})'
            retry, why = _retryable(code, status, message)
            if retry and attempt < retries - 1:
                time.sleep(2 ** attempt * 2)
                continue
            raise DownloadError(f'could not download {url} ({why}, attempt {attempt + 1} of {retries})')
    finally:
        body.unlink(missing_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_bytes(gzip.compress(json.dumps(record, separators=(',', ':')).encode(), mtime=0))
    tmp.replace(path)
    _count('fetched')
    if record['status'] == 404:
        _count('notFound')
        raise NotFound(url, _rel(path))
    return record['body']


def get_file(url, dest, retries=12):
    """Download url to dest once (skipped if dest exists), resuming an interrupted transfer from its
    .part file where the server allows it. Same User-Agent and throttle as get_json. A 404 leaves a
    <dest>.404 marker and raises NotFound (then and on every later call); any other failure raises
    DownloadError once the retries are spent."""
    dest = Path(dest)
    if dest.exists():
        _count('cached')
        return dest
    gone = dest.with_name(dest.name + '.404')
    if gone.exists():
        _count('cached')
        _count('notFound')
        raise NotFound(url, _rel(gone))
    if os.environ.get('BIOMAP_OFFLINE'):
        raise DownloadError(f'{url} is not downloaded and BIOMAP_OFFLINE is set')
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + '.part')
    for attempt in range(retries):
        _limiter.wait()
        resume = part.exists() and part.stat().st_size > 0
        code, status, message = _curl(url, part, resume=resume)
        if code == 0 or (status == 416 and resume):  # 416: the part already holds the whole file
            break
        if status == 404:
            part.unlink(missing_ok=True)
            gone.write_text(url + '\n')
            _count('notFound')
            raise NotFound(url, _rel(gone))
        if resume and status == 200:  # the server sent the whole file again (no byte ranges), so curl would not append: start over
            part.unlink(missing_ok=True)
            continue
        retry, why = _retryable(code, status, message)
        if retry and attempt < retries - 1:
            time.sleep(min(60, 2 ** attempt))
            continue
        raise DownloadError(f'could not download {url} ({why}, attempt {attempt + 1} of {retries})')
    part.replace(dest)
    _count('fetched')
    return dest
