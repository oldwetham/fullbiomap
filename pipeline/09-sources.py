"""Step 09: the text sources morphology profiles and explanations may cite, as local plain text the drafting and
checking agents read.

Usage: python3 -I pipeline/09-sources.py

- OpenStax Anatomy and Physiology 2e and Biology 2e, from their GitHub copies (openstax/osbooks-anatomy-physiology,
  openstax/osbooks-biology-bundle) pinned to the last commit published under CC BY 4.0. OpenStax relicensed both books
  to CC BY-NC-SA 4.0 in two steps: the repository LICENSE on 2026-03-19 ("updating license to CC BY NC-SA") and the
  books' own metadata on 2026-04-23 ("updating md license"). Copies released under CC BY stay CC BY, so Bio Map pins
  the last commit before the first change and checks both declarations there: the repository LICENSE and each
  collection's md:license. Each section becomes one text file with its openstax.org page and the "Access for free at" line,
  and each chapter's key terms (the glossary entries of its sections, the book's "Key Terms" page) one more file,
  "term: meaning" per line.
- Ontology definitions (step 06), one file per term: Cell Ontology, FMA, Uberon, NCIt and GO. A definition whose
  provenance cites Wikipedia, or that mentions it, is not written.
- NCI SEER Training Modules, Anatomy & Physiology (pipeline/maps/seer.json), text only, one file per page. NCI's reuse
  policy covers the text; the step fetches the policy page and stops if its sentences recorded in the map are gone.

Outputs: data/build/sources/<source>/<file>.txt, data/build/sources/index.json, key-terms.json (each key term's defining
section), and the figure captions and credit lines of both books (data/build/sources/<source>-figures.json), for the
figures plan.

It then checks every morphology profile (content/CL_<n>/morphology.md): each claim's quote must appear word for word
(whitespace aside) in the source file it cites, and writes the books' credit to public/ATTRIBUTION.md.
"""
import html
import json
import re
import shutil
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _http import get_file  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/build/sources'
# The books and their pinned CC BY commits (shared with step 10, which takes figures from the same copies).
BOOKS = json.loads((ROOT / 'pipeline/maps/openstax.json').read_text())['books']
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
term_section = {b['id']: {} for b in BOOKS}  # key term -> the section whose glossary defines it (step 15 batches by it)
for book in BOOKS:
    base = f"https://raw.githubusercontent.com/openstax/{book['repo']}/{book['sha']}"
    coll = get_file(f"{base}/collections/{book['collection']}.collection.xml", ROOT / f"data/raw/openstax/{book['repo']}/{book['sha']}/collections/{book['collection']}.collection.xml")
    croot = ET.parse(coll).getroot()
    lic = croot.find('.//md:license', NS)
    if lic is None or 'licenses/by/4.0' not in lic.get('url', ''):
        raise SystemExit(f"{book['id']}: the pinned copy is not declared CC BY 4.0 ({lic.get('url') if lic is not None else 'no license'}); not using it")
    repo_license = Path(get_file(f"{base}/LICENSE", ROOT / f"data/raw/openstax/{book['repo']}/{book['sha']}/LICENSE")).read_text()
    if not repo_license.lstrip().startswith('Attribution 4.0 International') or 'NonCommercial' in repo_license or 'ShareAlike' in repo_license:
        raise SystemExit(f"{book['id']}: the repository LICENSE at the pinned commit is not CC BY 4.0; not using it")
    web = f"https://openstax.org/books/{book['collection']}/pages"
    shutil.rmtree(OUT / book['id'], ignore_errors=True)  # no stale sections from another pin
    chapters = [s for s in croot.iter(f"{{{NS['col']}}}subcollection") if s.find('col:content/col:module', NS) is not None]
    figures_by_book[book['id']] = []
    for ci, chapter in enumerate(chapters, start=1):
        key_terms = []
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
            for d in mroot.findall('c:glossary/c:definition', NS):
                term, meanings = d.find('c:term', NS), [text_of(m) for m in d.findall('c:meaning', NS) if text_of(m)]
                if term is not None and text_of(term) and meanings:
                    key_terms.append(f"{text_of(term)}: {'; '.join(meanings)}")
                    term_section[book['id']].setdefault(text_of(term).lower(), f"{book['id']}/{name}")
        # The chapter's key terms, alphabetical as on the book's "Key Terms" page.
        if key_terms:
            ctitle = text_of(chapter.find('md:title', NS)) if chapter.find('md:title', NS) is not None else f'chapter {ci}'
            name = f'{ci:02d}-key-terms.txt'
            label = f'Chapter {ci} Key Terms ({ctitle})'
            (OUT / book['id'] / name).write_text(f"# {label}\nSource: {book['citation']} CC BY 4.0 version (GitHub openstax/{book['repo']} at {book['sha'][:12]}).\n"
                                                 f"Web: {web}/{ci}-key-terms\nAccess for free at {web}/1-introduction\n\n"
                                                 + '\n'.join(sorted(dict.fromkeys(key_terms), key=lambda x: (x.lower(), x))) + '\n')
            index.append({'source': book['id'], 'file': f"{book['id']}/{name}", 'section': label, 'url': f'{web}/{ci}-key-terms', 'license': 'CC BY 4.0',
                          'citation': book['citation'], 'access': f'Access for free at {web}/1-introduction', 'keyTerms': len(set(key_terms))})
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
# FMA, Uberon, NCIt and GO definitions (step 06), one file each, like the Cell Ontology ones.
SOURCES = json.loads((ROOT / 'graph/sources.json').read_text())
ONTOLOGY = {
    'fma': ('Foundational Model of Anatomy', 'Foundational Model of Anatomy (FMA), University of Washington Structural Informatics Group, http://si.washington.edu/projects/fma'),
    'uberon': ('Uberon', 'Uberon multi-species anatomy ontology, https://obofoundry.org/ontology/uberon.html'),
    'ncit': ('NCI Thesaurus', 'NCI Thesaurus (NCIt), National Cancer Institute, https://ncithesaurus.nci.nih.gov'),
    'go': ('Gene Ontology', 'Gene Ontology (GO), https://geneontology.org'),
}
written_defs = set()


def write_definition(o, oid, label, text, iri):
    if not text or 'wikipedia' in text.lower() or oid in written_defs:
        return
    written_defs.add(oid)
    name, licence = oid.replace(':', '_') + '.txt', SOURCES[o]['license']['name']
    version = SOURCES[o].get('version') or (re.search(r'/releases/([^/]+)/', SOURCES[o].get('versionIri') or '') or [None, 'current release'])[1]
    (OUT / o).mkdir(parents=True, exist_ok=True)
    (OUT / o / name).write_text(f"# {oid} {label}\nSource: {ONTOLOGY[o][0]} ({version}, {licence}), {iri}\n\n{squash(text)}\n")
    index.append({'source': o, 'file': f'{o}/{name}', 'section': f'{oid} {label}', 'url': iri, 'license': licence, 'citation': ONTOLOGY[o][1]})


for o in ONTOLOGY:
    shutil.rmtree(OUT / o, ignore_errors=True)
for defs in ('graph/defs.jsonl', 'graph/defs.hra.jsonl'):
    for line in (ROOT / defs).read_text().splitlines():
        r = json.loads(line)
        f, u, n = r.get('fma'), r.get('uberon'), r.get('ncit')
        if f and f.get('definition'):
            write_definition('fma', 'FMA:' + f['iri'].rsplit('/fma', 1)[1], f['label'], f['definition'], f['iri'])
        if u and u.get('definition') and not u.get('definitionCitesWikipedia'):
            write_definition('uberon', u['id'], u.get('label') or u['id'], re.sub(r'\s*\[Automatically generated definition\]\.?', '', u['definition']), u['iri'])
        if n and n.get('definition'):
            write_definition('ncit', n['id'], n.get('label') or n['id'], n['definition'], n['iri'])
for line in (ROOT / 'graph/defs.go.jsonl').read_text().splitlines():
    d = json.loads(line)
    if not d.get('definitionCitesWikipedia'):
        write_definition('go', d['id'], d['label'], d.get('definition'), d['iri'])

# NCI SEER Training Modules, Anatomy & Physiology: text only (no graphics), one file per page.
SEER = json.loads((ROOT / 'pipeline/maps/seer.json').read_text())
strip = lambda t: squash(html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'(?is)<(script|style)\b.*?</\1>', ' ', t))))
policy = strip(Path(get_file(SEER['policy']['url'], ROOT / 'data/raw/seer/nci-copyright-reuse.html')).read_text(encoding='utf-8'))
for k in ('text', 'credit', 'graphics'):
    if SEER['policy'][k] not in policy:
        raise SystemExit(f"SEER: NCI's reuse policy ({SEER['policy']['url']}) no longer says: {SEER['policy'][k]!r}. Check the policy before using SEER text.")
if f"Reviewed: {SEER['policy']['reviewed']}" not in policy:
    raise SystemExit(f"SEER: NCI's reuse policy page is no longer the version reviewed {SEER['policy']['reviewed']}. Check the policy before using SEER text.")


def seer_text(page, url):
    """The page's own text, from its title to the Previous/Next links: headings, paragraphs, list items and table rows."""
    i, j = page.find('<h1'), page.find('<div id="prevNext"')
    if i < 0 or j < i:
        raise SystemExit(f'SEER: {url} has no title or no Previous/Next links; the page layout changed')
    s = re.sub(r'(?is)<(script|style|svg|figure|noscript)\b.*?</\1>', '', page[i:j])
    s = re.sub(r'(?i)<img\b[^>]*>', '', s)
    s = re.sub(r'(?i)<h1\b[^>]*>', '\n# ', s)
    s = re.sub(r'(?i)<h2\b[^>]*>', '\n## ', s)
    s = re.sub(r'(?i)<h[3-6]\b[^>]*>', '\n### ', s)
    s = re.sub(r'(?i)</t[dh]>', ' | ', s)
    s = re.sub(r'(?i)<(br|/p|/li|/h[1-6]|/tr|/dt|/dd|/caption|/div|/ul|/ol|/table)\b[^>]*>', '\n', s)
    s = html.unescape(re.sub(r'<[^>]+>', '', s))
    lines = [re.sub(r'(\s*\|\s*)+$', '', squash(x)) for x in s.split('\n')]
    title = next(x[2:] for x in lines if x.startswith('# '))
    return title, '\n'.join(x for x in lines if x and not x.startswith('# '))


shutil.rmtree(OUT / 'seer', ignore_errors=True)
(OUT / 'seer').mkdir(parents=True)
queue, seen, seer_pages = [SEER['start']], {SEER['start']}, 0
while queue:
    path = queue.pop(0)
    url = SEER['base'] + path
    page = Path(get_file(url, ROOT / 'data/raw/seer' / (path.strip('/') + ('/index.html' if path.endswith('/') else '')))).read_text(encoding='utf-8')
    for link in sorted(set(re.findall(r'href=["\'](/anatomy/[^"\'#?]*)["\']', page))):
        if link not in seen and (link.endswith('/') or link.endswith('.html')):
            seen.add(link)
            queue.append(link)
    if len(seen) > 400:
        raise SystemExit('SEER: more than 400 pages under /anatomy/; the site changed, check the crawl')
    title, body = seer_text(page, url)
    cite = re.search(r'(?s)<div class="citation-wrap">.*?<p>(.*?)</p>', page)
    citation = (strip(cite.group(1)).split(' Cited ')[0] if cite else f"SEER Training Modules: {title}. {SEER['publisher']}.").rstrip('.') + '.'
    name = (slug(path[len(SEER['start']):].removesuffix('.html')) or 'index') + '.txt'
    (OUT / 'seer' / name).write_text(f"# {title}\nSource: {citation} Text free of copyright under NCI's reuse policy ({SEER['policy']['url']}); "
                                     f"originally published by the National Cancer Institute. Graphics not used.\nWeb: {url}\n\n{body}\n")
    # The section names the product as NCI asks ("link to the original NCI product using the original product's title").
    index.append({'source': 'seer', 'file': f'seer/{name}', 'section': f"{SEER['name']}: {title}", 'url': url, 'license': SEER['license'], 'citation': citation})
    seer_pages += 1
(OUT / 'index.json').write_text(json.dumps(index, indent=1, ensure_ascii=False) + '\n')
(OUT / 'key-terms.json').write_text(json.dumps(term_section, indent=1, ensure_ascii=False, sort_keys=True) + '\n')
for b, figs in figures_by_book.items():
    (OUT / f'{b}-figures.json').write_text(json.dumps(figs, indent=1, ensure_ascii=False) + '\n')

# Morphology profiles: every quote is in the file it cites, word for word.
norm = lambda s: re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s)).strip()
texts, bad, quotes = {}, [], 0
for f in sorted((ROOT / 'content').glob('CL_*/morphology.md')):
    front = f.read_text().split('\n---\n')[0].split('\n')[1:]
    meta = {line.split(': ', 1)[0]: json.loads(line.split(': ', 1)[1]) for line in front if ': ' in line}
    for i, c in enumerate(meta.get('claims', [])):
        quotes += 1
        src = c['source']['file']
        if src not in texts:
            path = (OUT / src).resolve()
            texts[src] = norm(path.read_text()) if path.is_file() and OUT.resolve() in path.parents else None
        if texts[src] is None or norm(c['quote']) not in texts[src]:
            bad.append(f"{f.relative_to(ROOT)} claim {i}: quote not found in {src}")
if bad:
    raise SystemExit('Morphology quotes not found word for word in their sources:\n' + '\n'.join(bad))

# Written explanations (content/<ID>/tier1.md, tier2.md, kind "explanation"): the same check, and every quoted file must be
# in one of the allowed source folders (pipeline/maps/explanations.json).
ALLOWED = json.loads((ROOT / 'pipeline/maps/explanations.json').read_text())['sourceFolders']
equotes = 0
for f in sorted((ROOT / 'content').glob('*/tier[12].md')):
    front = f.read_text().split('\n---\n')[0].split('\n')[1:]
    meta = {line.split(': ', 1)[0]: json.loads(line.split(': ', 1)[1]) for line in front if ': ' in line}
    if meta.get('kind') != 'explanation':
        continue
    for i, sentence in enumerate(meta.get('sentences', [])):
        for q in sentence['quotes']:
            equotes += 1
            src = q['file']
            if src.split('/')[0] not in ALLOWED:
                bad.append(f"{f.relative_to(ROOT)} sentence {i + 1}: {src} is not in an allowed source folder")
                continue
            if src not in texts:
                path = (OUT / src).resolve()
                texts[src] = norm(path.read_text()) if path.is_file() and OUT.resolve() in path.parents else None
            if texts[src] is None or norm(q['quote']) not in texts[src]:
                bad.append(f"{f.relative_to(ROOT)} sentence {i + 1}: quote not found in {src}")
if bad:
    raise SystemExit('Explanation quotes not found word for word in their sources:\n' + '\n'.join(bad))

# The text sources' credit in public/ATTRIBUTION.md (this section is rewritten each run; the rest of the file is left alone).
OLD_HEADINGS = ['## Cell morphology profiles (OpenStax, Cell Ontology)']
HEADING = '## Text sources quoted by morphology profiles and explanations (OpenStax, ontology definitions, SEER)'
section = [HEADING, '',
           '- What: each morphology profile (content/CL_<n>/morphology.md) and each written explanation (content/<id>/tier1.md, tier2.md) quotes single sentences from these sources, unchanged except for whitespace; the panel shows every quote with its section, link and licence. Bio Map chose the sentences, set each profile claim\'s value, wrote the structure-and-job sentences and the explanation sentences, and drew the 3D models from the claims (CC BY 4.0).',
           '- OpenStax changed the licence of these books to CC BY-NC-SA 4.0 in 2026 (the repositories\' LICENSE on 2026-03-19, the books\' own metadata on 2026-04-23). Bio Map uses only copies OpenStax published under CC BY 4.0 before that change, pinned to the commits below, where both the repository LICENSE and the book\'s own licence declaration say CC BY 4.0. Quotes come from the sections and from each chapter\'s key terms.']
for book in BOOKS:
    section.append(f"- {book['citation']} Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Copy used: github.com/openstax/{book['repo']} at commit {book['sha']}. "
                   f"Access for free at https://openstax.org/books/{book['collection']}/pages/1-introduction")
section += ['- Ontology definitions, quoted from step 06\'s records (credited in full above): Cell Ontology (CL), CC BY 4.0, https://obofoundry.org/ontology/cl.html; Foundational Model of Anatomy (FMA), CC BY 3.0; Uberon, CC BY 3.0; NCI Thesaurus (NCIt), CC BY 4.0; Gene Ontology (GO), CC BY 4.0. Definitions that cite or mention Wikipedia are not used.',
            f"- {SEER['name']}, Anatomy & Physiology, {SEER['publisher']}, {SEER['base']}{SEER['start']}. Text only, originally published by the National Cancer Institute; each quote links to its page and gives the page's suggested citation (e.g. \"SEER Training Modules: Kidneys. U.S. National Institutes of Health, National Cancer Institute.\"). "
            f"Used under NCI's reuse policy ({SEER['policy']['url']}, reviewed {SEER['policy']['reviewed']}): \"{SEER['policy']['text']}\" \"{SEER['policy']['credit']}\" "
            "SEER's own pages carry no licence line. No SEER graphics are used, since NCI's graphics mix copyrighted and copyright-free material."]
att = ROOT / 'public/ATTRIBUTION.md'
text = att.read_text()
block = '\n'.join(section) + '\n'
for old in OLD_HEADINGS:
    if old in text and HEADING not in text:
        text = text.replace(old, HEADING)
if HEADING in text:
    start = text.index(HEADING)
    nxt = text.find('\n## ', start + len(HEADING))
    text = text[:start] + block + ('\n' + text[nxt + 1:] if nxt >= 0 else '')
else:
    anchor = '## Neuron and glia reconstructions (NeuroMorpho.Org)'
    text = text.replace(anchor, block + '\n' + anchor) if anchor in text else text.rstrip('\n') + '\n\n' + block
att.write_text(text)
print(json.dumps({b: sum(1 for i in index if i['source'] == b) for b in ['openstax-ap2e', 'openstax-bio2e', 'cell-ontology', *ONTOLOGY, 'seer']}
                 | {f'{b} key terms': sum(i.get('keyTerms', 0) for i in index if i['source'] == b) for b in ['openstax-ap2e', 'openstax-bio2e']}
                 | {f'{b} figures': len(f) for b, f in figures_by_book.items()} | {'profile quotes checked': quotes, 'explanation quotes checked': equotes}))
