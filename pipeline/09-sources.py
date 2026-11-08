"""Step 09: the text sources morphology profiles may cite, as local plain text the drafting and checking agents read.

Usage: python3 -I pipeline/09-sources.py

- OpenStax Anatomy and Physiology 2e and Biology 2e, from their GitHub copies (openstax/osbooks-anatomy-physiology,
  openstax/osbooks-biology-bundle) pinned to the last commit published under CC BY 4.0. OpenStax relicensed both books
  to CC BY-NC-SA 4.0 on 2026-04-23 ("updating md license"); the copies released under CC BY stay CC BY, so Bio Map
  uses those and checks each collection's own license declaration at the pinned commit. Each section becomes one text
  file with its openstax.org page and the "Access for free at" line.
- Cell Ontology definitions (step 06), one file per cell type, so a profile can cite them the same way.

Outputs: data/build/sources/<source>/<file>.txt, data/build/sources/index.json, and the figure captions and credit
lines of both books (data/build/sources/<source>-figures.json), for the figures plan.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _http import get_file  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/build/sources'
BOOKS = [
    {'id': 'openstax-ap2e', 'repo': 'osbooks-anatomy-physiology', 'sha': '7d142c477b7324d24c05ca65d850fafef561e55d', 'collection': 'anatomy-and-physiology-2e',
     'title': 'Anatomy and Physiology 2e', 'citation': 'Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax.'},
    {'id': 'openstax-bio2e', 'repo': 'osbooks-biology-bundle', 'sha': 'ce66bceda29ef1ce4d4a178e072af4b735e70b84', 'collection': 'biology-2e',
     'title': 'Biology 2e', 'citation': 'Clark MA, Douglas M, Choi J (2018). Biology 2e. OpenStax.'},
]
NS = {'col': 'http://cnx.rice.edu/collxml', 'md': 'http://cnx.rice.edu/mdml', 'c': 'http://cnx.rice.edu/cnxml'}
slug = lambda s: re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')
squash = lambda s: re.sub(r'\s+', ' ', s or '').strip()


def text_of(el):
    return squash(''.join(el.itertext()))


def module_text(root):
    """Paragraphs, list items, notes and figure captions in reading order, with section titles as headings."""
    out, figures = [], []
    content = root.find('c:content', NS)
    for el in content.iter():
        tag = el.tag.split('}')[-1]
        if tag == 'section':
            t = el.find('c:title', NS)
            if t is not None and text_of(t):
                out.append(f'\n## {text_of(t)}')
        elif tag == 'table':
            t = el.find('c:title', NS)
            out.append(f'\n### Table: {text_of(t)}' if t is not None and text_of(t) else '\n### Table')
        elif tag == 'row':
            cells = [text_of(e) for e in el if e.tag.split('}')[-1] == 'entry']
            if any(cells):
                out.append(' | '.join(cells))
        elif tag in ('para', 'item') and el.find('c:para', NS) is None and el.find('c:list', NS) is None and not any(a.tag.endswith('entry') for a in [el]):
            t = text_of(el)
            if t:
                out.append(t)
        elif tag == 'figure':
            cap = el.find('.//c:caption', NS)
            if cap is not None:
                caption = text_of(cap)
                credit = re.search(r'\((?:[^()]*?)?(?:credit|Credit)[^)]*\)', caption)
                figures.append({'id': el.get('id'), 'caption': caption, 'credit': credit.group(0).strip('()') if credit else None,
                                'images': [m.get('src') for m in el.iter() if m.tag.endswith('image') and m.get('src')]})
    return '\n'.join(out), figures


index, figures_by_book = [], {}
for book in BOOKS:
    base = f"https://raw.githubusercontent.com/openstax/{book['repo']}/{book['sha']}"
    coll = get_file(f"{base}/collections/{book['collection']}.collection.xml", ROOT / f"data/raw/openstax/{book['repo']}/{book['sha']}/collections/{book['collection']}.collection.xml")
    croot = ET.parse(coll).getroot()
    lic = croot.find('.//md:license', NS)
    if lic is None or 'licenses/by/4.0' not in lic.get('url', ''):
        raise SystemExit(f"{book['id']}: the pinned copy is not declared CC BY 4.0 ({lic.get('url') if lic is not None else 'no license'}); not using it")
    web = f"https://openstax.org/books/{book['collection']}/pages"
    chapters = [s for s in croot.iter(f"{{{NS['col']}}}subcollection") if s.find('col:content/col:module', NS) is not None]
    figures_by_book[book['id']] = []
    for ci, chapter in enumerate(chapters, start=1):
        for si, mod in enumerate(chapter.findall('col:content/col:module', NS)):
            mid = mod.get('document')
            cnxml = get_file(f'{base}/modules/{mid}/index.cnxml', ROOT / f"data/raw/openstax/{book['repo']}/{book['sha']}/modules/{mid}/index.cnxml")
            mroot = ET.parse(cnxml).getroot()
            title = text_of(mroot.find('c:title', NS))
            page = f'{ci}-introduction' if si == 0 else f'{ci}-{si}-{slug(title)}'
            body, figs = module_text(mroot)
            name = f"{ci:02d}-{si:02d}-{slug(title)[:60]}.txt"
            path = OUT / book['id'] / name
            path.parent.mkdir(parents=True, exist_ok=True)
            label = f'{ci}.{si} {title}' if si else f'Chapter {ci} introduction: {title}'
            path.write_text(f"# {label}\nSource: {book['citation']} CC BY 4.0 version (GitHub openstax/{book['repo']} at {book['sha'][:12]}).\n"
                            f"Web: {web}/{page}\nAccess for free at {web}/1-introduction\n\n{body}\n")
            index.append({'source': book['id'], 'file': f"{book['id']}/{name}", 'section': label, 'url': f'{web}/{page}', 'license': 'CC BY 4.0',
                          'citation': book['citation'], 'access': f'Access for free at {web}/1-introduction'})
            for f in figs:
                figures_by_book[book['id']].append({**f, 'module': mid, 'section': label, 'url': f'{web}/{page}'})
# Cell Ontology definitions (step 06), one file each.
co = OUT / 'cell-ontology'
co.mkdir(parents=True, exist_ok=True)
for line in (ROOT / 'graph/defs.cells.jsonl').read_text().splitlines():
    d = json.loads(line)
    if not d.get('definition') or d.get('definitionCitesWikipedia'):
        continue
    name = d['id'].replace(':', '_') + '.txt'
    (co / name).write_text(f"# {d['id']} {d['label']}\nSource: Cell Ontology (CC BY 4.0), {d['iri']}\n\n{d['definition']}\n")
    index.append({'source': 'cell-ontology', 'file': f'cell-ontology/{name}', 'section': f"{d['id']} {d['label']}", 'url': d['iri'], 'license': 'CC BY 4.0',
                  'citation': 'Cell Ontology (CL), https://obofoundry.org/ontology/cl.html'})
(OUT / 'index.json').write_text(json.dumps(index, indent=1, ensure_ascii=False) + '\n')
for b, figs in figures_by_book.items():
    (OUT / f'{b}-figures.json').write_text(json.dumps(figs, indent=1, ensure_ascii=False) + '\n')
print(json.dumps({b: sum(1 for i in index if i['source'] == b) for b in ['openstax-ap2e', 'openstax-bio2e', 'cell-ontology']} | {f'{b} figures': len(f) for b, f in figures_by_book.items()}))
