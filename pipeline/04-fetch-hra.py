"""Step 04: download pinned Human Reference Atlas (HRA) data into data/raw/hra/.

Usage: python3 -I pipeline/04-fetch-hra.py

- ASCT+B Blood Vasculature table v1.10 (VCCF vessel branching; used by step 06).
- HRA release v2.5 3D reference objects (CC BY 4.0): the united female body, the per-organ
  GLBs used as organ interiors, and each object's crosswalk.csv (node name -> ontology id),
  plus the ASCT+B-to-3D crosswalk. Object versions come from the release's
  digital-objects.yaml and are written to pipeline/maps/hra-release.json; every asset URL
  must carry its pinned version or the step fails.

Checksums are pinned in pipeline/checksums/hra.sha256 (data/ is gitignored); a changed
upstream file fails loudly. Downloads stream to disk and resume after dropped transfers.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _http import get_file, get_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/hra'
PIN = ROOT / 'pipeline/checksums/hra.sha256'
RELEASE_FILE = ROOT / 'pipeline/maps/hra-release.json'
RELEASE = 'v2.5'
CDN = 'https://cdn.humanatlas.io/digital-objects'
# Body-wide layers, the vessel trees (already in both bodies), the male body (BodyParts3D is
# the male body) and pregnancy anatomy are not organs you zoom into.
SKIP = re.compile(r'^(united-male|skin-|adipose-|blood-vasculature-|placenta-)')

files = {
    'asct-b-vh-blood-vasculature-v1.10.csv':
        f'{CDN}/asct-b/blood-vasculature/v1.10/assets/asct-b-vh-blood-vasculature.csv',
}

objects_yaml = get_file(f'{CDN}/collection/hra/{RELEASE}/assets/digital-objects.yaml', RAW / RELEASE / 'digital-objects.yaml')
pinned = dict(re.findall(r'ref-organ/([a-z0-9-]+)/(v[0-9.]+)', objects_yaml.read_text()))
release = {'release': RELEASE, 'source': f'{CDN}/collection/hra/{RELEASE}/assets/digital-objects.yaml', 'objects': {}}
for name, version in sorted(pinned.items()):
    if SKIP.match(name):
        continue
    record_json = get_json(f'https://lod.humanatlas.io/ref-organ/{name}/latest')
    record = json.dumps(record_json)
    assets = sorted(set(re.findall(rf'{re.escape(CDN)}/ref-organ/{re.escape(name)}/[^"\s]+/assets/[^"\s]+\.(?:glb|csv)', record)))
    if not assets:
        sys.exit(f'04-fetch-hra: no assets listed for {name}')
    wrong = [a for a in assets if f'/{name}/{version}/' not in a]
    if wrong:
        sys.exit(f'04-fetch-hra: {name} is pinned to {version} in HRA {RELEASE} but the catalog now lists {wrong[0]}')
    meta = {}
    def collect(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ('citation', 'doi') and isinstance(v, str) and k not in meta:
                    meta[k] = v
                collect(v)
        elif isinstance(x, list):
            for y in x:
                collect(y)
    collect(record_json)
    # The organ the model represents, from the object's own graph (authoritative; used to attach interiors).
    graph = json.dumps(get_json(f'{CDN}/ref-organ/{name}/{version}/graph.json'))
    represents = sorted(set(re.findall(r'"representation_of":\s*"((?:UBERON|FMA):\d+)"', graph)))
    release['objects'][name] = {'version': version, 'files': [a.rsplit('/', 1)[1] for a in assets], 'doi': meta.get('doi'),
                                'citation': meta.get('citation'), 'representationOf': represents[0] if len(represents) == 1 else None}
    for a in assets:
        files[f'{RELEASE}/{name}/{a.rsplit("/", 1)[1]}'] = a

RELEASE_FILE.write_text(json.dumps(release, indent=1) + '\n')
lines = []
for i, (rel, url) in enumerate(sorted(files.items()), 1):
    path = get_file(url, RAW / rel)
    digest = hashlib.sha256()
    with open(path, 'rb') as fh:
        while block := fh.read(1 << 22):
            digest.update(block)
    lines.append(f'{digest.hexdigest()}  {rel}')
    print(f'[{i}/{len(files)}] {rel}', flush=True)
current = '\n'.join(lines) + '\n'
(RAW / 'CHECKSUMS.txt').write_text(current)
old = PIN.read_text() if PIN.exists() else ''
if old:
    previous = {l.split('  ', 1)[1]: l for l in old.splitlines() if l}
    changed = [l for l in lines if l.split('  ', 1)[1] in previous and previous[l.split('  ', 1)[1]] != l]
    if changed:
        sys.exit('04-fetch-hra: checksums differ from the pin:\n' + '\n'.join(changed))
PIN.write_text(current)
print(f'{len(lines)} files; checksums pinned in {PIN.relative_to(ROOT)}; HRA {RELEASE} objects: {len(release["objects"])}')
