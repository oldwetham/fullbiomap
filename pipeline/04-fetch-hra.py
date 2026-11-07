"""Step 04: download pinned Human Reference Atlas (HRA) tables into data/raw/hra/.

Usage: python3 -I pipeline/04-fetch-hra.py

Currently: the ASCT+B Blood Vasculature table v1.10, the vessel-branching data behind the
HRA vasculature common coordinate framework (VCCF). CC BY 4.0. Citation: Weber G, Lee S,
Malhotra R (2025), HuBMAP ASCT+B Tables. Blood Vasculature v1.10,
https://doi.org/10.48539/HBM497.DSBZ.627. Step 06 maps its vessels onto atlas concepts.

Checksums are pinned in pipeline/checksums/hra.sha256 (data/ is gitignored); a changed
upstream file fails loudly. Later phases add the HRA female body and per-organ GLBs here.
"""
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _http import get_file  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/hra'
PIN = ROOT / 'pipeline/checksums/hra.sha256'
FILES = {
    'asct-b-vh-blood-vasculature-v1.10.csv':
        'https://cdn.humanatlas.io/digital-objects/asct-b/blood-vasculature/v1.10/assets/asct-b-vh-blood-vasculature.csv',
}

lines = []
for name, url in FILES.items():
    path = get_file(url, RAW / name)
    lines.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {name}')
current = '\n'.join(lines) + '\n'
(RAW / 'CHECKSUMS.txt').write_text(current)
if PIN.exists():
    if PIN.read_text() != current:
        sys.exit(f'04-fetch-hra: checksums differ from {PIN}:\n{current}')
    print(f'checksums match {PIN.relative_to(ROOT)}')
else:
    PIN.write_text(current)
    print(f'pinned checksums to {PIN.relative_to(ROOT)}')
