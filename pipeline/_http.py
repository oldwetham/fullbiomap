"""Cached, throttled HTTP GET for pipeline scripts (build time only; the app never fetches).

Every response body is stored gzip-compressed under data/cache/<host>/<sha256 of URL>.json.gz,
so reruns never refetch. Requests carry a descriptive User-Agent and are rate-limited
across threads. Set BIOMAP_OFFLINE=1 to fail instead of fetching anything not cached.
"""
import gzip
import hashlib
import http.client
import json
import os
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data/cache'
USER_AGENT = 'BioMap-pipeline/0.1 (+https://github.com/oldwetham/fullbiomap; educational anatomy atlas build)'
# python.org builds of Python on macOS ship without CA certificates; use the system bundle.
_CAFILE = os.environ.get('SSL_CERT_FILE') or ('/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
_CONTEXT = ssl.create_default_context(cafile=_CAFILE)


class NotFound(Exception):
    pass


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


def get_json(url, retries=5):
    """Return parsed JSON for url, from cache if present. 404s are cached too (raise NotFound)."""
    path = cache_path(url)
    if path.exists():
        _count('cached')
        record = json.loads(gzip.decompress(path.read_bytes()))
        if record['status'] == 404:
            _count('notFound')
            raise NotFound(url)
        return record['body']
    if os.environ.get('BIOMAP_OFFLINE'):
        raise RuntimeError(f'not cached and BIOMAP_OFFLINE is set: {url}')
    for attempt in range(retries):
        _limiter.wait()
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120, context=_CONTEXT) as r:
                record = {'url': url, 'status': r.status, 'body': json.loads(r.read())}
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                record = {'url': url, 'status': 404, 'body': None}
                break
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(2 ** attempt * 2)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead, json.JSONDecodeError):
            if attempt < retries - 1:
                time.sleep(2 ** attempt * 2)
                continue
            raise
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_bytes(gzip.compress(json.dumps(record, separators=(',', ':')).encode(), mtime=0))
    tmp.replace(path)
    _count('fetched')
    if record['status'] == 404:
        _count('notFound')
        raise NotFound(url)
    return record['body']


def get_file(url, dest, retries=5):
    """Download url to dest once (skipped if dest exists). Same User-Agent, throttle and retries as get_json."""
    dest = Path(dest)
    if dest.exists():
        _count('cached')
        return dest
    if os.environ.get('BIOMAP_OFFLINE'):
        raise RuntimeError(f'not downloaded and BIOMAP_OFFLINE is set: {url}')
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(retries):
        _limiter.wait()
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=300, context=_CONTEXT) as r:
                body = r.read()
            break
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead):
            if attempt < retries - 1:
                time.sleep(2 ** attempt * 2)
                continue
            raise
    tmp = dest.with_suffix(dest.suffix + '.part')
    tmp.write_bytes(body)
    tmp.replace(dest)
    _count('fetched')
    return dest
