"""Step 10: figures. Up to three 2D figures per structure, cell type and organelle, matched only by the source's own id
or exact title (docs/FIGURES-PLAN.md). Every figure is marked unreviewed unless a person pins it in
pipeline/maps/figures.json; where a match is doubtful there is no figure.

Usage: python3 -I pipeline/10-figures.py

Sources (pipeline/maps/figure-sources.json); each image's licence comes from the source's own record or page:
- Human Protein Atlas 25.1 (CC BY 4.0): each organ's histology micrograph, as step 08 chose it; for a cell type HPA names
  in a tissue, HPA's image of a protein it scores high there, preferring a biomarker that HRA's ASCT+B tables list for
  that cell type (their HGNC ids joined to HPA's Ensembl genes through HGNC's own records); for an organelle, HPA's
  immunofluorescence image of a protein it locates only there.
- HRA v2.5 2D functional tissue units (CC BY 4.0 in each illustration's own HRA record): labeled diagrams for their organ
  (the crosswalk's Uberon id) and for every cell type they draw (the crosswalk's Cell Ontology id). They open as their
  interactive SVG, with that cell type highlighted.
- OpenStax Anatomy and Physiology 2e and Biology 2e, from the CC BY copies step 09 pins: figures whose own title is one of
  our names. Each caption is read whole: a figure with a copyright notice (the University of Michigan micrographs) or a
  credit to anyone but a US government agency is not used.
- Servier Medical Art (CC BY 4.0, stated on each image's own page), read from its category listings: illustrations whose
  title is one of our names.
- NIH BioArt Source: pinned entries whose own title is one of our names and whose licence field is Public Domain or CC BY.

Names: a structure's label, its ontology label and exact synonyms (FMA, Cell Ontology, GO), and for an organ the name
pipeline/maps/tissue-media.json gives it. Titles match ignoring case, typographic dashes and quotes, and a final plural
"s". Up to three figures each: a micrograph, then a labeled diagram, then an illustration, then any other match; a match
by id beats a match by title. Cell types that look alike under a microscope (pipeline/maps/look-alike.json) get a sentence
naming the proteins that tell them apart, once every piece of its evidence is found in its source.

Outputs: public/figures/<id>.webp (at most 1400 px on the long side) and <id>-thumb.webp (240 px), graph/figures.json,
reports/figures.md, and the figures section of public/ATTRIBUTION.md. Fails if public/figures/ would pass 60 MB.
"""
import csv
import html
import io
import json
import re
import subprocess
import sys
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _http import DownloadError, NotFound, get_file, get_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / 'pipeline/maps'
OUT = ROOT / 'public/figures'
RAW = ROOT / 'data/raw/figures'
load = lambda name: json.loads((MAPS / name).read_text())
SRC, REVIEW, LOOK, TISSUE = load('figure-sources.json'), load('figures.json'), load('look-alike.json'), load('tissue-media.json')
RELEASE, BOOKS, ORGANELLES = load('hra-release.json'), load('openstax.json')['books'], load('organelles.json')
LIMIT = 60 * 1024 * 1024
FULL, THUMB = 1400, 240
CC_BY = 'https://creativecommons.org/licenses/by/4.0/'
KINDS = ['micrograph', 'diagram', 'illustration']
SOURCE_ORDER = ['hpa', 'hra', 'openstax', 'servier', 'bioart', 'grays']
HRA_CDN = 'https://cdn.humanatlas.io/digital-objects'
OLS = 'https://www.ebi.ac.uk/ols4/api'
slug = lambda s: re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', (s or '').lower())).strip('-')
squash = lambda s: re.sub(r'\s+', ' ', s or '').strip()
upper_first = lambda s: s[:1].upper() + s[1:]
gid = lambda cid: re.sub(r'^(FMA|UBERON|CL|GO)(\d)', r'\1:\2', cid)
norm = lambda s: re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s or '')).strip()
TYPOGRAPHIC = {0x2010: '-', 0x2011: '-', 0x2012: '-', 0x2013: '-', 0x2014: '-', 0x2018: "'", 0x2019: "'", 0x201c: '"', 0x201d: '"'}


def key(name):
    """Title-matching key: ignores case, typographic dashes and quotes, and a final plural "s"."""
    s = squash(unicodedata.normalize('NFKC', name or '').translate(TYPOGRAPHIC)).lower()
    return s[:-1] if s.endswith('s') else s


def jsonl(rel):
    p = ROOT / rel
    return [json.loads(line) for line in p.read_text().splitlines() if line.strip()] if p.exists() else []


# What gets figures: organs (pipeline/maps/tissue-media.json; left and right share), the cell types with a morphology
# profile, and the organelles the cell models may draw. A unit is matched once and its figures go to all its nodes.
fma = {d['conceptId']: d for d in jsonl('graph/defs.jsonl')}
hra_defs = {d['conceptId']: d for d in jsonl('graph/defs.hra.jsonl')}
cell_defs = {d['id']: d for d in jsonl('graph/defs.cells.jsonl')}
go_defs = {d['id']: d for d in jsonl('graph/defs.go.jsonl')}
units, index = {}, defaultdict(set)


def add_unit(uid, scope, label, names, nodes):
    u = {'id': uid, 'scope': scope, 'label': label, 'names': {}, 'nodes': nodes}
    for n in names:
        if n and key(n) not in u['names']:
            u['names'][key(n)] = n
            index[key(n)].add(uid)
    units[uid] = u


def node_names(cid):
    d = fma.get(cid) or hra_defs.get(cid) or {}
    f = d.get('fma') or {}
    names = [f.get('label'), *(f.get('synonyms') or [])]
    if not f and d.get('uberon'):
        names.append(d['uberon'].get('label'))
    return {n for n in names if n}


for organ, cfg in TISSUE['organs'].items():
    if not cfg['nodes']:
        continue
    per_node = [node_names(c) for c in cfg['nodes']]
    shared = set.intersection(*per_node) if per_node else set()  # "Right lung" is no name for the left lung
    add_unit(f'organ:{organ}', 'organ', upper_first(organ), [organ, *sorted(shared)], [gid(c) for c in cfg['nodes']])
profiled = sorted(p.parent.name.replace('_', ':') for p in (ROOT / 'content').glob('CL_*/morphology.md'))
for cl in profiled:
    d = cell_defs.get(cl) or {}
    add_unit(cl, 'cell', upper_first(d.get('label') or cl), [d.get('label'), *(d.get('synonyms') or [])], [cl])
for o in ORGANELLES['organelles']:
    d = go_defs.get(o['id']) or {}
    add_unit(o['id'], 'organelle', o['label'], [o['label'], d.get('label'), *(d.get('synonyms') or [])], [o['id']])
# Bones, muscles, vessels and nerves of the body model (FMA classes in figure-sources.json `grays`): any source may match
# them, and Gray's 1918 plates are allowed only for them, only where nothing else matches.
GRAYS = SRC['grays']
taken = {n for u in units.values() for n in u['nodes']}
for cid, d in sorted(fma.items()):
    f, node = d.get('fma') or {}, gid(cid)
    if f and node not in taken and set(GRAYS['classes']) & ({node} | set(f.get('ancestors') or [])):
        add_unit(node, 'gross', f['label'], [f['label'], *(f.get('synonyms') or [])], [node])

figures, offers, rejected = {}, defaultdict(list), []


def offer(uid, fid, how, by, rank=(), focus=None):
    offers[uid].append({'figure': fid, 'match': how, 'by': by, 'rank': rank, **({'focus': focus} if focus else {})})


def reject(source, title, reason, url=''):
    rejected.append({'source': source, 'title': title, 'reason': reason, 'url': url})


def matches(title):
    return sorted(index.get(key(title), ()))


# Human Protein Atlas 25.1 (versioned host, so a later release cannot change what a clean clone downloads).
HPA = SRC['hpa']
HPA_RAW = ROOT / f"data/raw/hpa/{HPA['release']}"
same_tissue = lambda name, tissue: re.sub(r'\s+\d+$', '', (name or '').strip().lower()) == re.sub(r'\s+\d+$', '', (tissue or '').strip().lower())


def hpa_table(name):
    path = get_file(f"{HPA['site']}/download/tsv/{name}.tsv.zip", HPA_RAW / f'{name}.tsv.zip')
    with zipfile.ZipFile(path) as z, z.open(f'{name}.tsv') as fh:
        return list(csv.DictReader(io.TextIOWrapper(fh, encoding='utf-8'), delimiter='\t'))


def hpa_entry(ensg):
    """A gene's HPA record (the file step 08 also caches). One that will not download stops the step
    (pipeline/_http.py), so no other gene ever takes its place."""
    return ET.parse(get_file(f'https://www.proteinatlas.org/{ensg}.xml', HPA_RAW / f'{ensg}.xml')).getroot().find('entry')


MISSING_IMAGES = {u for u in TISSUE['hpa'].get('missingImages', {}) if not u.startswith('_')}


def hpa_full(url):
    """HPA's full-resolution file for a representative ("selected") image: the same path without the suffix. None when
    the URL has no such suffix (HPA's additional-tissue images have none) or the file is listed as missing by hand in
    pipeline/maps/tissue-media.json (`hpa.missingImages`). Any failed download, a 404 included, stops the step."""
    full = re.sub(r'_(rna_)?selected(\.jpg)$', r'\2', url)
    if full == url or full in MISSING_IMAGES:
        return None, None
    return full, get_file(full, HPA_RAW / 'images/full' / urllib.parse.urlparse(full).path.strip('/').replace('/', '-'))


def hpa_figure(fid, kind, title, caption, alt, image_url, src, page):
    return {'id': fid, 'source': 'hpa', 'sourceName': f"Human Protein Atlas {HPA['release']}", 'kind': kind, 'title': title, 'caption': caption, 'alt': alt,
            'license': HPA['license'], 'licenseUrl': HPA['licenseUrl'], 'terms': HPA['terms'],
            'credit': f"Image from the Human Protein Atlas {HPA['release']} (proteinatlas.org): {title}, {image_url}. {HPA['license']}.",
            'pageUrl': page, 'imageUrl': image_url, 'src': str(src)}


# Organs: each organ's histology image, as step 08 chose it (graph/media.json), at HPA's full resolution.
media = json.loads((ROOT / 'graph/media.json').read_text())
for organ, cfg in TISSUE['organs'].items():
    rec = next((m for c in cfg['nodes'] for m in media.get(c, []) if m['kind'] == 'histology'), None)
    if not rec:
        continue
    image_url, image = hpa_full(rec['imageUrl'])
    if not image:  # no larger file: step 08's copy of the representative image
        image_url, image = rec['imageUrl'], ROOT / rec['file']
    if not Path(image).exists():
        raise SystemExit(f'10-figures: {image} is missing; run step 08 first')
    g, tissue = rec['gene'], rec['tissue']
    fid = f"hpa-{slug(g['symbol'])}-{slug(tissue)}"
    figures[fid] = hpa_figure(fid, 'micrograph', f"{upper_first(tissue)}: {g['symbol']} immunohistochemistry", rec['caption'], rec['alt'], image_url, image,
                              f"{HPA['site']}/{g['ensembl']}-{g['symbol']}/tissue/{urllib.parse.quote(tissue)}")
    offer(f'organ:{organ}', fid, f"HPA tissue “{tissue}” is this organ's tissue in pipeline/maps/tissue-media.json", 'title')

# HRA ASCT+B tables (cached by step 04): the header row (the one starting AS/1) and the rows below it.
asctb_cache = {}


def asctb_table(table):
    if table not in asctb_cache:
        with open(ROOT / 'data/raw/hra' / RELEASE['release'] / 'asct-b' / table / RELEASE['tables'][table]['files'][0], encoding='utf-8', newline='') as fh:
            rows = list(csv.reader(fh))
        head = next((i for i, r in enumerate(rows) if r and r[0].startswith('AS/1')), None)
        asctb_cache[table] = (rows[head], rows[head + 1:]) if head is not None else (None, [])
    return asctb_cache[table]


# ASCT+B biomarkers of each cell type. A row's gene and protein biomarkers (BGene and BProtein columns with an HGNC id)
# belong to its last cell type: CT/1 is the broadest, so in a "glial cell, Schwann cell" row they are the Schwann cell's.
# A last cell type without a Cell Ontology id (a subtype the table names but cannot identify) keeps them: they count for
# none of ours. A row whose last cell type is, in Cell Ontology, an ancestor of another of its cell types lists them out
# of order; it is skipped. Each biomarker keeps the names the row gives it (its BGene/n and BGene/n/LABEL cells).
cell_ancestors = {cl: set(d.get('ancestors') or []) for cl, d in cell_defs.items()}
biomarkers = defaultdict(lambda: defaultdict(list))  # cell type -> HGNC id -> [(table, the row's names for it)]
for table in RELEASE['tables']:
    header, rows = asctb_table(table)
    if header is None:
        continue
    col = {}
    for i, c in enumerate(header):
        col.setdefault(c.strip(), i)
    groups = sorted({int(m.group(1)) for c in col if (m := re.fullmatch(r'CT/(\d+)(?:/LABEL|/ID)?', c))})
    marker_cols = [c[:-3] for c in col if re.fullmatch(r'B(?:Gene|Protein)/\d+/ID', c)]
    for r in rows:
        at = lambda c: r[col[c]].strip() if c in col and col[c] < len(r) else ''
        named = [n for n in groups if any(at(f'CT/{n}{part}') for part in ('', '/LABEL', '/ID'))]
        ids = [at(f'CT/{n}/ID') for n in named]
        if not ids or not re.fullmatch(r'CL:\d+', ids[-1]) or any(ids[-1] in cell_ancestors.get(x, ()) for x in ids[:-1]):
            continue
        for base in marker_cols:
            if re.fullmatch(r'HGNC:\d+', at(base + '/ID')):
                biomarkers[ids[-1]][at(base + '/ID')].append((table, {at(base), at(base + '/LABEL')} - {''}))

# The tables name biomarkers by HGNC id and HPA names genes by Ensembl id: HGNC's own record of an approved HGNC id gives
# its Ensembl gene (pipeline/maps/figure-sources.json `hgnc`). Some rows give a biomarker another gene's id (the
# bone-marrow table gives LIPE the id of LHFPL1), so a row counts only where the id and the name agree: one of the row's
# names for it is the record's symbol, approved name, a previous symbol or an alias, ignoring case, spaces and
# punctuation ("melanA" is MLANA's "melan-A").
HGNC = SRC['hgnc']
hgnc_genes = {}
gene_key = lambda s: re.sub(r'[^0-9a-z]', '', s.lower())


def hgnc_record(hgnc_id):
    """(Ensembl gene, symbol, the keys of every name it goes by) from HGNC's record; None unless approved with an Ensembl gene."""
    if hgnc_id not in hgnc_genes:
        try:
            docs = get_json(HGNC['fetch'] + hgnc_id.removeprefix('HGNC:'))['response']['docs']
        except NotFound:
            docs = []
        d = docs[0] if len(docs) == 1 else {}
        names = [d.get('symbol'), d.get('name'), *(d.get('prev_symbol') or []), *(d.get('alias_symbol') or [])]
        hgnc_genes[hgnc_id] = ((d['ensembl_gene_id'], d['symbol'], {gene_key(n) for n in names if n and gene_key(n)})
                               if d.get('status') == 'Approved' and d.get('hgnc_id') == hgnc_id and d.get('ensembl_gene_id') else None)
    return hgnc_genes[hgnc_id]


# Cell types: a cell type HPA annotates in a tissue whose name is one of ours. The image is HPA's representative one of
# that tissue for a protein HPA scores high in that cell type (reliability enhanced, else supported). A protein that the
# ASCT+B tables list as a biomarker of that cell type comes first, the one most tables list first. Without a usable image
# of one, the rule without biomarkers picks from the first twelve proteins: those that stain nothing else in that tissue
# first, then enhanced reliability, then tissues of our organs, then tissue and gene name (also the order among biomarkers
# that the same number of tables list). reports/figures.md lists both picks.
ihc = hpa_table('normal_ihc_data')
levels = defaultdict(dict)
for r in ihc:
    levels[(r['Gene'], r['IHC tissue name'])][r['Cell type']] = r['Level']
our_tissues = {cfg['hpa'] for cfg in TISSUE['organs'].values() if cfg.get('hpa')}
tissue_images = {}


def hpa_tissue_image(rows):
    """The first row whose protein has HPA's representative image of the row's tissue at full resolution, as
    (row, image URL, local file); None if no row has one."""
    for r in rows:
        if (r['Gene'], r['IHC tissue name']) not in tissue_images:
            entry = hpa_entry(r['Gene'])
            block = entry.find("tissueExpression[@technology='IHC'][@assayType='tissue']") if entry is not None else None
            image = next((i for i in block.findall("image[@imageType='selected']") if same_tissue(i.findtext('tissue'), r['IHC tissue name'])), None) if block is not None else None
            tissue_images[(r['Gene'], r['IHC tissue name'])] = hpa_full(image.findtext('imageUrl')) if image is not None else (None, None)
        image_url, path = tissue_images[(r['Gene'], r['IHC tissue name'])]
        if path:
            return r, image_url, path
    return None


hpa_cells = []  # per cell type: the image shown and the one the rule without biomarkers picks (reports/figures.md)
for name in sorted({r['Cell type'] for r in ihc}):
    hits = [u for u in matches(name) if units[u]['scope'] == 'cell']
    if not hits:
        continue
    specific = lambda r: all(level == 'Not detected' for cell, level in levels[(r['Gene'], r['IHC tissue name'])].items() if cell != name)
    rows = sorted((r for r in ihc if r['Cell type'] == name and r['Level'] == 'High' and r['Reliability'] in ('Enhanced', 'Supported')),
                  key=lambda r: (not specific(r), r['Reliability'] != 'Enhanced', r['Tissue'].lower() not in our_tissues, r['IHC tissue name'], r['Gene name']))
    plain = hpa_tissue_image(rows[:12])
    for uid in hits:
        listed, disagree = {}, set()  # Ensembl gene -> (HGNC id, the tables whose rows give it that id and one of its names)
        for hgnc_id, entries in sorted(biomarkers.get(uid, {}).items()):
            rec = hgnc_record(hgnc_id)
            if not rec:
                continue
            agree = lambda names: bool({gene_key(n) for n in names} & rec[2])
            if tables := {t for t, names in entries if agree(names)}:
                first, before = listed.get(rec[0], (hgnc_id, []))
                listed[rec[0]] = (first, sorted(tables | set(before)))
            disagree |= {f"{t}: {' / '.join(sorted(names)) or 'no name'} has {hgnc_id}, which is {rec[1]}" for t, names in entries if not agree(names)}
        # The biomarker listed by the most ASCT+B tables first; ties keep the order above. sorted() is stable.
        ranked = sorted((r for r in rows if r['Gene'] in listed), key=lambda r: -len(listed[r['Gene']][1]))
        high = sorted({(r['Gene name'], len(listed[r['Gene']][1])) for r in ranked}, key=lambda g: (-g[1], g[0]))
        found = hpa_tissue_image(ranked)
        marker = listed[found[0]['Gene']] if found else None
        found = found or plain
        pick = lambda f: f and (f[0]['Gene name'], f[0]['Tissue'])
        hpa_cells.append({'unit': uid, 'name': name, 'listed': len(biomarkers.get(uid, {})), 'joined': len(listed), 'high': high,
                          'disagree': sorted(disagree), 'marker': marker, 'shown': pick(found), 'plain': pick(plain)})
        if not found:
            reject('hpa', f'cell type “{name}”', f'none of the {len(high)} ASCT+B biomarkers of {uid} that HPA scores high in it, nor the first {min(12, len(rows))} '
                   f'of the {len(rows)} proteins HPA scores high in it, has a representative image of that tissue')
            continue
        r, image_url, path = found
        gene, tissue = r['Gene name'], r['Tissue']
        fid = f"hpa-{slug(gene)}-{slug(name)}-{slug(r['IHC tissue name'])}"
        listing = (f" The Human Reference Atlas lists {gene} as a biomarker of {name} (ASCT+B {'table' if len(marker[1]) == 1 else 'tables'}: "
                   f"{', '.join(t.replace('-', ' ') for t in marker[1])})." if marker else '')
        rec = hpa_figure(fid, 'micrograph', f"{upper_first(name)} in {tissue.lower()}: {gene} immunohistochemistry",
                         f"{tissue} stained for the {gene} protein, which HPA scores high in {name} here (reliability {r['Reliability'].lower()})"
                         + (', and not detected in the tissue\'s other cell types' if specific(r) else '') + f".{listing} Brown: {gene} protein. Blue: cell nuclei (hematoxylin counterstain).",
                         f"Microscope image of {tissue.lower()} with {gene} protein stained brown in {name} and cell nuclei stained blue.", image_url, path,
                         f"{HPA['site']}/{r['Gene']}-{gene}/tissue/{urllib.parse.quote(tissue.lower())}")
        if marker:
            rec['marker'] = {'hgnc': marker[0], 'ensembl': r['Gene'], 'symbol': gene, 'cell': uid, 'tables': marker[1]}
        if figures.get(fid, rec) != rec:
            raise SystemExit(f'10-figures: {fid} would need two captions: HPA cell type “{name}” names more than one of our cell types, with different biomarkers')
        figures[fid] = rec
        offer(uid, fid, f"HPA cell type “{name}” in {tissue.lower()} = “{units[uid]['names'][key(name)]}”"
              + (f"; {gene} is {marker[0]}, an ASCT+B biomarker of {uid}" if marker else ''), 'title')

# Organelles: an HPA subcellular location whose GO id is the organelle's own, shown by a protein HPA locates only there
# (no other location; reliability enhanced, else supported), in HPA's representative immunofluorescence field.
subcell = hpa_table('subcellular_location')
for uid, u in sorted(units.items()):
    if u['scope'] != 'organelle':
        continue
    rows = sorted((r for r in subcell if set(re.findall(r'GO:\d+', r['GO id'])) == {uid} and not r['Extracellular location'] and r['Reliability'] in ('Enhanced', 'Supported')),
                  key=lambda r: (r['Reliability'] != 'Enhanced', r['Gene name']))
    found = None
    for r in rows[:8]:
        entry = hpa_entry(r['Gene'])
        block = entry.find("cellExpression[@technology='ICC/IF']") if entry is not None else None
        selected = block.findtext("image[@imageType='selected']/imageUrl") if block is not None else None
        if not selected:
            continue
        stem = selected.rsplit('_selected', 1)[0]
        for d in (entry.iter('data') if entry is not None else []):
            for im in d.iter('image'):
                if any((x.text or '').startswith(stem + '_') for x in im.findall('imageUrl')):
                    found = found or (r, d.findtext('cellLine'), {c.get('color'): c.text for c in im.findall('channel')}, stem)
        if found:
            break
    if not found:
        continue
    r, line, channels, stem = found
    image_url = f'{stem}_blue_red_green.jpg'
    path = get_file(image_url, HPA_RAW / 'images/full' / urllib.parse.urlparse(image_url).path.strip('/').replace('/', '-'))
    location = re.match(r'\s*([^;(]+?)\s*\(', r['GO id']).group(1)
    place = location if location.startswith('Golgi') else location.lower()  # Golgi is a name
    gene = r['Gene name']
    others = '; '.join(f'{c}: {(channels.get(c) or "").lower()}' for c in ('blue', 'red') if channels.get(c))
    fid = f'hpa-if-{slug(gene)}-{slug(location)}'
    figures[fid] = hpa_figure(fid, 'micrograph', f'{location}: {gene} immunofluorescence',
                              f"{'Human sperm' if (line or '').lower() == 'sperm' else f'Cultured human cells ({line})'} stained by immunofluorescence for the {gene} protein (green), which HPA locates only in the {place} (reliability {r['Reliability'].lower()}). Other colours are reference stains ({others}).",
                              f"Fluorescence microscope image of {'sperm' if (line or '').lower() == 'sperm' else 'cells'} with {gene} protein in green, marking the {place}.", image_url, path,
                              f"{HPA['site']}/{r['Gene']}-{gene}/subcellular")
    offer(uid, fid, f"HPA location “{location}” has GO id {uid}, this organelle's own", 'id')

# HRA 2D functional tissue units: licence from each illustration's own HRA record (cached by step 04).
def hra_licences(name):
    found = []
    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k == 'license' and isinstance(v, str):
                    found.append(v)
                walk(v)
        elif isinstance(x, list):
            for y in x:
                walk(y)
    walk(get_json(f'https://lod.humanatlas.io/2d-ftu/{name}/latest'))
    return found


organ_of_node = {gid(c): f'organ:{organ}' for organ, cfg in TISSUE['organs'].items() for c in cfg['nodes']}
# Which tissue unit to show first: HRA's own ASCT+B rows name a functional tissue unit (FTU/n/ID columns). An organ's
# illustrations rank by how many rows of its tables name the illustration's tissue; a cell type's by how many rows name
# that cell type with that tissue, then by how many shapes draw it.
asctb_ftu = defaultdict(int)  # (table, tissue id) and (cell type, tissue id) -> rows
for table in RELEASE['tables']:
    header, rows = asctb_table(table)
    if header is None:
        continue
    ftu_cols = [i for i, c in enumerate(header) if re.fullmatch(r'FTU/\d+/ID', c)]
    ct_cols = [i for i, c in enumerate(header) if re.fullmatch(r'CT/\d+/ID', c)]
    for r in rows:
        tissues = {r[i].strip() for i in ftu_cols if i < len(r) and r[i].strip()}
        for tissue in tissues:
            asctb_ftu[(table, tissue)] += 1
            for i in ct_cols:
                if i < len(r) and r[i].strip():
                    asctb_ftu[(r[i].strip(), tissue)] += 1
organ_tables = {f'organ:{organ}': cfg.get('tables', []) for organ, cfg in TISSUE['organs'].items()}
ftus = {}
for cid, recs in media.items():
    for m in recs:
        if m['kind'] == 'ftu':
            ftus.setdefault(m['name'], {'rec': m, 'units': set()})['units'].add(organ_of_node.get(gid(cid)))
for name, info in sorted(ftus.items()):
    m, fid = info['rec'], f"hra-{info['rec']['name']}"
    licences = hra_licences(name)
    if not licences or any('creativecommons.org/licenses/by/4.0' not in x for x in licences):
        reject('hra', m['label'], f'licence fields in its HRA record are not all CC BY 4.0: {licences}')
        continue
    svg = next(f for f in RELEASE['ftus'][name]['files'] if f.endswith('.svg'))
    figures[fid] = {'id': fid, 'source': 'hra', 'sourceName': f"Human Reference Atlas {RELEASE['release']}", 'kind': 'diagram',
                    'title': f"{m['label']} (functional tissue unit)", 'caption': m['caption'], 'alt': m['alt'],
                    'license': 'CC BY 4.0', 'licenseUrl': CC_BY, 'credit': m['attribution'], 'pageUrl': m['doi'],
                    'imageUrl': f"{HRA_CDN}/2d-ftu/{name}/{RELEASE['ftus'][name]['version']}/assets/{svg}", 'url': m['url'],
                    'src': str(ROOT / 'public' / m['url'].lstrip('/')), 'ftu': {'name': name, 'label': m['label'], 'hits': m['hits']}}
    drawn = {h['cl']: len(h['ids']) for h in m['hits']}
    with open(ROOT / 'data/raw/hra' / RELEASE['release'] / '2d-ftu' / name / 'crosswalk.csv', encoding='utf-8', newline='') as fh:
        tissue = next((r['tissue_mapped_to'] for r in csv.DictReader(fh) if r.get('tissue_mapped_to')), '')
    figures[fid]['ftu']['tissue'] = tissue
    for uid in sorted(u for u in info['units'] if u):
        rows = sum(asctb_ftu[(table, tissue)] for table in organ_tables.get(uid, []))
        offer(uid, fid, f"HRA crosswalk: this illustration's organ is this organ's Uberon id", 'id', rank=(-rows, -len(drawn), name))
    for cl, n in sorted(drawn.items()):
        if cl in units:
            offer(cl, fid, f'HRA crosswalk: this illustration draws {cl}', 'id', rank=(-asctb_ftu[(cl, tissue)], -n, len(drawn), name), focus=cl)

# OpenStax: figures whose own title is one of our names, from the pinned CC BY copies (step 09 checks the same pins).
NS = {'col': 'http://cnx.rice.edu/collxml', 'md': 'http://cnx.rice.edu/mdml', 'c': 'http://cnx.rice.edu/cnxml'}
text_of = lambda el: squash(''.join(el.itertext())) if el is not None else ''
PUBLIC_DOMAIN = re.compile(SRC['openstax']['publicDomainCredits'])
THIRD_PARTY = re.compile(r'©|\bcopyright\b|all rights reserved|Regents of (?:the )?University of Michigan|\bprovided by\b', re.I)
CREDIT = re.compile(r'\(([^()]*\bcredit\b[^()]*)\)', re.I)
MICROGRAPH = re.compile(r'micrograph|\b(?:LM|EM|SEM|TEM) ×', re.I)
DRAWN = re.compile(r'diagram|illustration|drawing|artist', re.I)
openstax_checked = 0
for book in BOOKS:
    base = f"https://raw.githubusercontent.com/openstax/{book['repo']}/{book['sha']}"
    rawdir = ROOT / f"data/raw/openstax/{book['repo']}/{book['sha']}"
    croot = ET.parse(get_file(f"{base}/collections/{book['collection']}.collection.xml", rawdir / f"collections/{book['collection']}.collection.xml")).getroot()
    lic = croot.find('.//md:license', NS)
    if lic is None or 'licenses/by/4.0' not in lic.get('url', ''):
        raise SystemExit(f"10-figures: {book['id']} at the pinned commit is not declared CC BY 4.0")
    repo_license = Path(get_file(f'{base}/LICENSE', rawdir / 'LICENSE')).read_text()
    if not repo_license.lstrip().startswith('Attribution 4.0 International') or 'NonCommercial' in repo_license or 'ShareAlike' in repo_license:
        raise SystemExit(f"10-figures: the repository LICENSE of {book['id']} at the pinned commit is not CC BY 4.0")
    web = f"https://openstax.org/books/{book['collection']}/pages"
    chapters = [s for s in croot.iter(f"{{{NS['col']}}}subcollection") if s.find('col:content/col:module', NS) is not None]
    for ci, chapter in enumerate(chapters, start=1):
        for si, mod in enumerate(chapter.findall('col:content/col:module', NS)):
            mid = mod.get('document')
            mroot = ET.parse(get_file(f'{base}/modules/{mid}/index.cnxml', rawdir / f'modules/{mid}/index.cnxml')).getroot()
            mtitle = text_of(mroot.find('c:title', NS))
            page = f'{ci}-introduction' if si == 0 else f'{ci}-{si}-{slug(mtitle)}'
            section = f'{ci}.{si} {mtitle}' if si else f'Chapter {ci} introduction: {mtitle}'
            for fig in mroot.iter(f"{{{NS['c']}}}figure"):
                title = text_of(fig.find('c:title', NS))
                hits = matches(title)
                if not title or not hits:
                    continue
                openstax_checked += 1
                caption, mediael = text_of(fig.find('c:caption', NS)), fig.find('.//c:media', NS)
                alt = squash(mediael.get('alt')) if mediael is not None else ''
                where = f"{web}/{page}#{fig.get('id')}"
                label = f"{book['title']} {section}: “{title}”"
                third = THIRD_PARTY.search(caption)
                if third:
                    reject('openstax', label, f'third-party rights in its caption (“{third.group(0)}”)', where)
                    continue
                credits = CREDIT.findall(caption)
                if credits and not all(PUBLIC_DOMAIN.search(c) for c in credits):
                    reject('openstax', label, f'credits a third party ({"; ".join(credits)}); that work\'s licence is not confirmed', where)
                    continue
                images = sorted({e.get('src') for e in fig.iter() if e.tag.endswith('}image') and e.get('src')})
                if len(images) != 1:
                    reject('openstax', label, f'{len(images)} image files; only single-image figures are used', where)
                    continue
                file = images[0].split('media/', 1)[-1]
                dest = get_file(f'{base}/media/{urllib.parse.quote(file)}', rawdir / 'media' / file)
                fid = f"openstax-{book['short']}-{slug(fig.get('id'))}"
                blob = f'{caption} {alt}'
                kind = 'micrograph' if MICROGRAPH.search(blob) and not DRAWN.search(blob) else 'diagram'
                figures[fid] = {'id': fid, 'source': 'openstax', 'sourceName': f"OpenStax {book['title']}", 'kind': kind, 'title': title,
                                'caption': caption or title, 'alt': alt or title, 'license': 'CC BY 4.0', 'licenseUrl': CC_BY,
                                'credit': f"{book['citation']} Figure “{title}”, section {section}. CC BY 4.0. Access for free at {web}/1-introduction"
                                          + (f" Includes public-domain work ({'; '.join(credits)})." if credits else ''),
                                'pageUrl': where, 'imageUrl': f'{base}/media/{urllib.parse.quote(file)}',
                                'sourceUrl': f"https://github.com/openstax/{book['repo']}/blob/{book['sha']}/media/{urllib.parse.quote(file)}", 'src': str(dest)}
                for uid in hits:
                    offer(uid, fid, f"OpenStax figure title “{title}” = “{units[uid]['names'][key(title)]}”", 'title', rank=(book['short'], fig.get('id')))

# Servier Medical Art: its category listings, page by page (its search is disallowed by robots.txt and not used).
SERVIER = SRC['servier']
listed = {}
for cat in SERVIER['categories']:
    first = Path(get_file(f"{SERVIER['site']}/category/{cat}/", RAW / 'servier/listing' / f'{slug(cat)}-1.html')).read_text()
    last = max([1] + [int(n) for n in re.findall(rf'/category/{re.escape(cat)}/page/(\d+)/', first)])
    pages = [first] + [Path(get_file(f"{SERVIER['site']}/category/{cat}/page/{n}/", RAW / 'servier/listing' / f'{slug(cat)}-{n}.html')).read_text() for n in range(2, last + 1)]
    for text in pages:
        for art in re.findall(r'<article class="result-thumbnail[^"]*"[^>]*>(.*?)</article>', text, re.S):
            h = re.search(r'<h3>\s*<a href="([^"]+)">(.*?)</a>\s*</h3>', art, re.S)
            dl = re.search(r'<a download href="([^"]+)"[^>]*class="btn-dl "', art)
            if h and dl and h.group(1) not in listed:
                listed[h.group(1)] = {'page': h.group(1), 'title': squash(html.unescape(re.sub(r'<[^>]+>', '', h.group(2)))), 'image': dl.group(1), 'category': cat, 'order': len(listed)}
by_title, same_title = defaultdict(list), []
for item in listed.values():
    if matches(item['title']):
        by_title[key(item['title'])].append(item)
for k, items in sorted(by_title.items()):
    page_slug = lambda i: i['page'].rstrip('/').rsplit('/', 1)[-1]
    items.sort(key=lambda i: (page_slug(i) != slug(i['title']), i['order']))  # the image whose page is named after the title
    for item in items:
        page = Path(get_file(item['page'], RAW / 'servier/pages' / f'{page_slug(item)}.html')).read_text()
        h1 = re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S)
        plain = squash(html.unescape(re.sub(r'<[^>]+>', ' ', page)))
        if SERVIER['statement'] not in plain or 'creativecommons.org/licenses/by/4.0' not in page:
            reject('servier', item['title'], 'its page does not state the CC BY 4.0 licence', item['page'])
            continue
        if not h1 or key(squash(html.unescape(re.sub(r'<[^>]+>', '', h1.group(1))))) != k:
            reject('servier', item['title'], 'its page title differs from the listing', item['page'])
            continue
        if not re.search(r'\.(png|jpe?g)$', item['image'], re.I):
            reject('servier', item['title'], f'download is not a PNG or JPEG ({item["image"].rsplit("/", 1)[-1]})', item['page'])
            continue
        dest = get_file(item['image'], RAW / 'servier/images' / urllib.parse.unquote(item['image'].rsplit('/', 1)[-1]))
        fid = f'servier-{page_slug(item)}'
        figures[fid] = {'id': fid, 'source': 'servier', 'sourceName': SERVIER['name'], 'kind': 'illustration', 'title': item['title'],
                        'caption': f"{item['title']}. Illustration from Servier Medical Art.", 'alt': f"Illustration: {item['title']}",
                        'license': SERVIER['license'], 'licenseUrl': SERVIER['licenseUrl'], 'credit': SERVIER['credit'],
                        'pageUrl': item['page'], 'imageUrl': item['image'], 'src': str(dest)}
        for uid in matches(item['title']):
            offer(uid, fid, f"Servier title “{item['title']}” = “{units[uid]['names'][k]}”", 'title', rank=(item['order'],))
        if items[items.index(item) + 1:]:
            same_title.append((item, items[items.index(item) + 1:]))
        break

# NIH BioArt Source: pinned entries (pipeline/maps/figure-sources.json), each read from its own page.
BIOART = SRC['bioart']
for entry in BIOART['entries']:
    eid = int(entry['id'])
    url = f"{BIOART['site']}/bioart/{eid}"
    page = Path(get_file(url, RAW / 'bioart' / f'{eid}.html')).read_text()
    body = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', page, flags=re.S)
    lines = [squash(html.unescape(x)) for x in re.sub(r'<[^>]+>', '\n', body).split('\n')]
    lines = [x for x in lines if x]
    field = lambda name: next((lines[i + 1] for i, x in enumerate(lines[:-1]) if x.rstrip(':') == name), '')
    crumb = next((lines[i + 1] for i, x in enumerate(lines[:-1]) if re.fullmatch(r'BIOART-\d+', x) and i > 0 and lines[i - 1] == '/'), '')
    title, licence, credit = crumb, field('Licensing'), field('Credit')
    images = re.findall(r'https://nih3d-v2-data-cln-media-prod\.s3\.amazonaws\.com/[^"\s\\]+\.(?:png|jpe?g)', page)
    if licence not in BIOART['allowedLicenses']:
        reject('bioart', title or url, f'licence field is “{licence or "missing"}”, not Public Domain or CC BY', url)
        continue
    if not title or not images:
        reject('bioart', title or url, 'title or image not found on its page', url)
        continue
    hits = matches(title)
    if not hits:
        reject('bioart', title, 'its title is not one of our names', url)
        continue
    image = images[0]
    try:
        dest = get_file(image, RAW / 'bioart' / f"{eid}-{urllib.parse.unquote(image.rsplit('/', 1)[-1])}")
    except (DownloadError, NotFound) as e:  # stops the step, with what to do about it
        raise DownloadError(f"BioArt entry {eid} ({title}): {e}. If it is HTTP 403: BioArt serves its image files only to its own pages, "
                            "which Bio Map does not work around, so remove the entry from pipeline/maps/figure-sources.json") from e
    fid = f'bioart-{eid}'
    figures[fid] = {'id': fid, 'source': 'bioart', 'sourceName': BIOART['name'], 'kind': 'illustration', 'title': title,
                    'caption': f"{title}. Illustration from NIH BioArt Source.", 'alt': f'Illustration: {title}',
                    'license': 'Public Domain' if licence == 'Public Domain' else 'CC BY 4.0',
                    'licenseUrl': 'https://creativecommons.org/publicdomain/mark/1.0/' if licence == 'Public Domain' else CC_BY,
                    'terms': BIOART['terms'], 'credit': f"Illustration from NIAID NIH BioArt Source (bioart.niaid.nih.gov/bioart/{eid}). {credit}. Licence: {licence}.",
                    'pageUrl': url, 'imageUrl': image, 'src': str(dest)}
    for uid in hits:
        offer(uid, fid, f"BioArt title “{title}” = “{units[uid]['names'][key(title)]}”", 'title', rank=(eid,))

# Gray's Anatomy (1918), the Internet Archive scan: a plate whose own legend title (the text before the legend's first
# period, from the scan's OCR) is a bone's, muscle's, vessel's or nerve's name, cropped from its page image between the
# nearest line of text above it and its legend. Only a last resort: see the selection below.
LEGEND = re.compile(r'^F[iI1l][gG]\.?\s*(\d{1,4})\s*[.,:]?\s*[—–-]+\s*(.+)$')
ANY_LEGEND = re.compile(r'^F[iI1l][gG]\.?\s*\d{1,4}\b')  # also a bare "FIG. 102." under or over a drawing
grays_xml = get_file(f"{GRAYS['download']}/{GRAYS['item']}_djvu.xml", RAW / 'grays' / f"{GRAYS['item']}_djvu.xml")
grays_pages = []
for _, el in ET.iterparse(grays_xml, events=('end',)):
    if el.tag != 'OBJECT':
        continue
    lines = []
    for line in el.iter('LINE'):
        words = [([int(v) for v in w.get('coords').split(',')[:4]], (w.text or '').strip()) for w in line.iter('WORD')]
        words = [(c, s) for c, s in words if s]
        if words:  # word coords are left, bottom, right, top
            lines.append({'x0': min(c[0] for c, _ in words), 'y0': min(c[3] for c, _ in words), 'x1': max(c[2] for c, _ in words), 'y1': max(c[1] for c, _ in words),
                          'text': squash(' '.join(s for _, s in words)), 'words': len(words)})
    # `n`: the page's place in the book as the Internet Archive shows it (its page images and links use it).
    grays_pages.append({'n': len(grays_pages), 'leaf': int(re.search(r'_(\d+)\.djvu$', el.get('usemap')).group(1)), 'width': int(el.get('width')), 'height': int(el.get('height')), 'lines': lines})
    el.clear()


def plate_box(page, legend):
    """The figure above a legend: from the nearest body text, other legend or running head above it down to the legend,
    across the text column (or the legend's half of it when two legends sit side by side). Returns (box, None) or
    (None, why): a region that holds another figure's legend or a block of running text, is low, or is not centred on its
    legend is refused, because a crowded page cannot be cropped reliably."""
    lines, w, h = page['lines'], page['width'], page['height']
    order = sorted(lines, key=lambda ln: ln['y0'])
    height = lambda ln: ln['y1'] - ln['y0']
    body = [ln for ln in order if ln['words'] >= 6 and ln['x1'] - ln['x0'] > 0.45 * w]
    for a, b in zip(order, order[1:]):  # a paragraph's short last line is text too
        if a in body and b not in body and -0.5 * height(a) <= b['y0'] - a['y1'] < 0.8 * height(a) and abs(b['x0'] - a['x0']) < 0.06 * w:
            body.append(b)
    x0, x1 = (min(ln['x0'] for ln in body), max(ln['x1'] for ln in body)) if body else (int(0.08 * w), int(0.92 * w))
    legends = [ln for ln in lines if ANY_LEGEND.match(ln['text'])]
    beside = [ln for ln in legends if ln is not legend and not (ln['y1'] < legend['y0'] or ln['y0'] > legend['y1'])]
    split, split_side = None, None
    if beside:
        mine, other = (legend['x0'] + legend['x1']) / 2, (beside[0]['x0'] + beside[0]['x1']) / 2
        split = int((mine + other) / 2)
        x0, x1 = (x0, split) if mine < other else (split, x1)
        split_side = 'right' if mine < other else 'left'
    def continues(ln):  # a line of an earlier legend: just below a legend line, starting near it
        return any(0 <= ln['y0'] - lg['y1'] <= 1.6 * height(lg) and abs(ln['x0'] - lg['x0']) < 0.12 * w for lg in legends)
    def region(x0, x1):
        # lines above the legend that lie mostly within [x0, x1] and are text, a legend or a legend's next line
        within = lambda ln: min(ln['x1'], x1) - max(ln['x0'], x0) > 0.5 * (ln['x1'] - ln['x0'])
        stops = [ln for ln in lines if ln['y1'] < legend['y0'] - 4 and within(ln) and (ln in body or ln in legends or continues(ln))]
        head = [ln for ln in lines if ln['y1'] < 0.07 * h]
        top = max([ln['y1'] for ln in stops + head], default=int(0.05 * h))
        left, right, upper, lower = max(0, x0 - 20), min(w, x1 + 20), top + 12, legend['y0'] - 10
        return left, right, upper, lower, [ln for ln in lines if ln is not legend and ln['y0'] > upper and ln['y1'] < lower and ln['x1'] > left and ln['x0'] < right]
    def text_blocks(inside):  # three or more wordy lines in a row, left edges aligned: running text, not labels
        wordy, blocks = sorted((ln for ln in inside if ln['words'] >= 5), key=lambda ln: ln['y0']), []
        for a, b, d in zip(wordy, wordy[1:], wordy[2:]):
            if all(abs(c['x0'] - a['x0']) < 30 for c in (b, d)) and b['y0'] - a['y1'] < 1.2 * height(a) and d['y0'] - b['y1'] < 1.2 * height(b):
                blocks.append([a, b, d])
        return blocks
    left, right, upper, lower, inside = region(x0, x1)
    centre = (legend['x0'] + legend['x1']) / 2
    blocks = text_blocks(inside)
    if blocks:  # a column of text beside the figure: keep the legend's side of it
        bx0, bx1 = min(ln['x0'] for blk in blocks for ln in blk), max(ln['x1'] for blk in blocks for ln in blk)
        if bx0 > centre:
            x1 = bx0 - 30
        elif bx1 < centre:
            x0 = bx1 + 30
        else:
            return None, 'running text crosses the figure'
        left, right, upper, lower, inside = region(x0, x1)
        if text_blocks(inside):
            return None, 'running text sits beside the figure'
    if any(ln in legends for ln in inside):
        return None, 'its region on the page holds another figure'
    near = [ln for ln in lines if ln['y1'] > upper and ln['y0'] < lower and ln is not legend]
    if split is not None and any(ln['x0'] < split < ln['x1'] for ln in near):
        return None, 'the figure beside it reaches into its region'
    for ln in near:  # a label crossing an outer edge belongs to the figure: widen to take it in
        if ln['x0'] < left < ln['x1'] and split_side != 'left' and ln['words'] <= 4:
            left = max(0, ln['x0'] - 20)
        if ln['x0'] < right < ln['x1'] and split_side != 'right' and ln['words'] <= 4:
            right = min(w, ln['x1'] + 20)
    if lower - upper < 0.12 * h or right - left < 0.2 * w:
        return None, 'its region on the page is too small to be the whole figure'
    if abs((legend['x0'] + legend['x1']) / 2 - (left + right) / 2) > 0.15 * (right - left):
        return None, 'its legend is not centred under the region'
    return [left, upper, right - left, lower - upper], None


# Figure numbers come from the OCR too: a matched plate's number must sit between its neighbours' (the median of the three
# legends before it and of the three after it), so a misread number is not shown as the plate's.
sequence = [int(LEGEND.match(ln['text']).group(1)) for page in grays_pages for ln in page['lines'] if LEGEND.match(ln['text'])]
def number_fits(position, n):
    before, after = sorted(sequence[max(0, position - 3):position]), sorted(sequence[position + 1:position + 4])
    return (not before or before[len(before) // 2] < n) and (not after or n < after[len(after) // 2])
position = -1
for page in grays_pages:
    for ln in page['lines']:
        m = LEGEND.match(ln['text'])
        if not m:
            continue
        position += 1
        n, title = int(m.group(1)), re.split(r'\.(?:\s|$)', m.group(2), maxsplit=1)[0].strip(' ,;:')
        hits = [u for u in matches(title) if units[u]['scope'] == 'gross']
        if not hits:
            continue
        where = f"{GRAYS['details']}/page/n{page['n']}/mode/1up"
        if not number_fits(position, n) or f'grays-fig-{n}' in figures:
            reject('grays', f'Fig. {n} “{title}”', 'its figure number in the OCR does not fit the numbers around it', where)
            continue
        box, why = plate_box(page, ln)
        if not box:
            reject('grays', f'Fig. {n} “{title}”', why, where)
            continue
        image = f"{GRAYS['download']}/page/n{page['n']}.jpg"
        dest = get_file(image, RAW / 'grays/pages' / f"n{page['n']}.jpg")
        fid = f'grays-fig-{n}'
        figures[fid] = {'id': fid, 'source': 'grays', 'sourceName': GRAYS['name'], 'kind': 'diagram', 'title': f'Fig. {n}: {title}', 'caption': GRAYS['caption'],
                        'alt': f"Historical anatomical drawing from Gray's Anatomy (1918), Fig. {n}: {title}.", 'license': GRAYS['license'], 'licenseUrl': GRAYS['licenseUrl'],
                        'credit': f"{GRAYS['citation']} Fig. {n}. {GRAYS['rights']}", 'pageUrl': where, 'imageUrl': image, 'src': str(dest),
                        'plate': {'page': page['n'], 'leaf': page['leaf'], 'box': box, 'pageSize': [page['width'], page['height']]}}
        for uid in hits:
            offer(uid, fid, f"Gray's 1918 legend title “{title}” (Fig. {n}) = “{units[uid]['names'][key(title)]}”", 'title', rank=(n,))

# Cell types that look alike: check every piece of evidence, then the sentence goes into each member's captions.
PROPERTY = {'has plasma membrane part': 'http://purl.obolibrary.org/obo/RO_0002104', 'lacks plasma membrane part': 'http://purl.obolibrary.org/obo/CL_4030046',
            'capable of': 'http://purl.obolibrary.org/obo/RO_0002215'}
SOURCES = ROOT / 'data/build/sources'


def ols_record(cl):
    iri = 'http://purl.obolibrary.org/obo/' + cl.replace(':', '_')
    return get_json(f'{OLS}/v2/ontologies/cl/entities/{urllib.parse.quote(urllib.parse.quote(iri, safe=""), safe="")}')


def axioms(record):
    """(property IRI, term IRI) pairs from a class's logical definition and subclass axioms."""
    out = set()
    def walk(x):
        if isinstance(x, dict):
            p, v = x.get('http://www.w3.org/2002/07/owl#onProperty'), x.get('http://www.w3.org/2002/07/owl#someValuesFrom')
            if isinstance(p, str) and isinstance(v, str):
                out.add((p, v))
            for y in x.values():
                walk(y)
        elif isinstance(x, list):
            for y in x:
                walk(y)
    for k in ('http://www.w3.org/2002/07/owl#equivalentClass', 'http://www.w3.org/2000/01/rdf-schema#subClassOf'):
        walk(record.get(k))
    return out


def asctb_cells(table, cl, column):
    header, rows = asctb_table(table)
    if header is None:
        return []
    ct = [i for i, c in enumerate(header) if re.fullmatch(r'CT/\d+/ID', c)]
    col = [i for i, c in enumerate(header) if c == column]
    return [r[i] for r in rows if any(i < len(r) and r[i].strip() == cl for i in ct) for i in col if i < len(r)]


notes, look_problems = {}, []
for g in LOOK['groups']:
    sentence = g['sentence']
    for e in g['evidence']:
        what = f"{g['id']}: {e['kind']} {e.get('cell', '')} {e.get('protein', '')}".strip()
        if e.get('protein') and e['protein'].lower() not in sentence.lower():
            look_problems.append(f'{what}: the sentence does not name {e["protein"]}')
        if e['kind'] in ('openstax', 'cl-definition'):
            p = (SOURCES / e['file']).resolve()
            if not (p.is_file() and SOURCES.resolve() in p.parents and norm(e['quote']) in norm(p.read_text())):
                look_problems.append(f"{what}: quote not found in {e['file']}")
            elif e.get('protein') and e['protein'].lower() not in e['quote'].lower():
                look_problems.append(f"{what}: the quote does not name {e['protein']}")
        elif e['kind'] == 'cl-axiom':
            record = ols_record(e['cell'])
            term = 'http://purl.obolibrary.org/obo/' + e['term'].replace(':', '_')
            label = ' '.join((record.get('linkedEntities', {}).get(term, {}).get('label') or ['']))
            if (PROPERTY[e['property']], term) not in axioms(record):
                look_problems.append(f"{what}: Cell Ontology has no “{e['property']} {e['term']}” axiom for {e['cell']}")
            elif e.get('protein') and e['protein'].lower() not in label.lower():
                look_problems.append(f"{what}: {e['term']} is “{label}”, not {e['protein']}")
        elif e['kind'] == 'asctb':
            texts = asctb_cells(e['table'], e['cell'], e['column'])
            if e['text'] not in [t.strip() for t in texts]:
                look_problems.append(f"{what}: no {e['table']} row for {e['cell']} has “{e['text']}” in column “{e['column']}”")
            elif e.get('protein') and e['protein'].lower() not in e['text'].lower():
                look_problems.append(f"{what}: “{e['text']}” does not name {e['protein']}")
        else:
            look_problems.append(f"{what}: unknown evidence kind")
    named = {x.lower() for x in re.findall(r'\bCD\d+\b|\bAQP\d\b', sentence)}
    for cd in sorted(named):
        if not any(e.get('protein', '').lower() == cd for e in g['evidence']):
            look_problems.append(f"{g['id']}: the sentence names {cd.upper()} without evidence")
    for m in g['members']:
        notes[m] = sentence
if look_problems:
    raise SystemExit('10-figures: look-alike evidence not found:\n' + '\n'.join(look_problems))

# Up to three per unit: a micrograph, a labeled diagram, an illustration, then any other match. Pins come first.
pins, blocks = REVIEW.get('pin', {}), REVIEW.get('block', {})
targets, unit_figures, not_chosen = {}, {}, []
order = lambda o: (0 if o['by'] == 'id' else 1, SOURCE_ORDER.index(figures[o['figure']]['source']), o['rank'], o['figure'])
for uid, u in sorted(units.items()):
    blocked = {f for n in u['nodes'] for f in blocks.get(n, [])}
    pinned = [f for n in u['nodes'] for f in pins.get(n, [])]
    seen, cands = set(), []
    for o in sorted(offers.get(uid, []), key=order):
        if o['figure'] in blocked or o['figure'] in seen:
            continue
        seen.add(o['figure'])
        cands.append(o)
    if any(figures[o['figure']]['source'] != 'grays' for o in cands):  # Gray's is the last resort
        for o in [o for o in cands if figures[o['figure']]['source'] == 'grays']:
            reject('grays', f"{u['label']}: {figures[o['figure']]['title']}", 'another source has a figure for this structure')
            cands.remove(o)
            seen.discard(o['figure'])
    missing = [f for f in pinned if f not in seen]
    if missing:
        raise SystemExit(f'10-figures: pinned figures {missing} are not matched for {uid}; pin only figures this structure matches')
    chosen = [o for f in pinned for o in cands if o['figure'] == f]
    for kind in KINDS:
        if len(chosen) < 3 and not any(figures[c['figure']]['kind'] == kind for c in chosen):
            best = next((o for o in cands if figures[o['figure']]['kind'] == kind and o not in chosen), None)
            if best:
                chosen.append(best)
    # A second figure of a kind only from another source (no strip of three salivary gland drawings).
    for o in sorted(cands, key=lambda o: (KINDS.index(figures[o['figure']]['kind']), *order(o))):
        same_kind = {figures[c['figure']]['source'] for c in chosen if figures[c['figure']]['kind'] == figures[o['figure']]['kind']}
        if len(chosen) < 3 and o not in chosen and (figures[o['figure']]['source'] not in same_kind or figures[o['figure']]['source'] == 'grays'):
            chosen.append(o)
    chosen.sort(key=lambda o: (o['figure'] not in pinned, KINDS.index(figures[o['figure']]['kind']), order(o)))
    for o in cands:
        if o not in chosen:
            not_chosen.append((u, o))
    entries = [{'figure': o['figure'], 'match': o['match'], 'status': 'reviewed' if o['figure'] in pinned else 'auto',
                **({'focus': o['focus']} if o.get('focus') else {}), **({'note': notes[uid]} if uid in notes else {})} for o in chosen]
    unit_figures[uid] = entries
    if u['scope'] == 'organ':  # the organ's other tissue unit illustrations stay on its tissue board
        u['units'] = [{'figure': o['figure'], 'match': o['match'], 'status': 'auto'} for o in cands if figures[o['figure']]['source'] == 'hra' and o not in chosen]
    for n in u['nodes']:
        targets[n] = entries
used = sorted({e['figure'] for es in unit_figures.values() for e in es} | {e['figure'] for u in units.values() for e in u.get('units', [])})

# Images: webp for the viewer and a thumbnail for the strip (sharp, via pipeline/_images.mjs).
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)
jobs = []
for fid in used:
    f = figures[fid]
    job = {'id': fid, 'src': f['src'], 'thumb': str(OUT / f'{fid}-thumb.webp'), 'thumbMax': THUMB}
    if f['source'] == 'hra':
        job.update(density=36, flatten='#ffffff')  # opens as its own SVG; only the thumbnail is rendered
    else:
        job.update(out=str(OUT / f'{fid}.webp'), max=FULL)
    if f.get('plate'):  # a Gray's plate: cropped from its page (box in the OCR's page pixels)
        x, y, bw, bh = f['plate']['box']
        job.update(crop={'left': x, 'top': y, 'width': bw, 'height': bh}, cropFrom={'width': f['plate']['pageSize'][0], 'height': f['plate']['pageSize'][1]})
    jobs.append(job)
(RAW / 'jobs.json').write_text(json.dumps(jobs, indent=1))
done = subprocess.run(['node', str(ROOT / 'pipeline/_images.mjs'), str(RAW / 'jobs.json')], check=True, capture_output=True, text=True)
for r in json.loads(done.stdout):
    f = figures[r['id']]
    f['thumb'] = f"/figures/{r['id']}-thumb.webp"
    if f['source'] != 'hra':
        f['url'] = f"/figures/{r['id']}.webp"
        f['width'], f['height'] = r['width'], r['height']
    f['thumbWidth'], f['thumbHeight'] = r['thumbWidth'], r['thumbHeight']
keep = {f'{fid}-thumb.webp' for fid in used} | {f'{fid}.webp' for fid in used if figures[fid]['source'] != 'hra'}
for stale in OUT.iterdir():
    if stale.name not in keep:
        stale.unlink()
total = sum(p.stat().st_size for p in OUT.iterdir())
if total > LIMIT:
    raise SystemExit(f'10-figures: public/figures/ is {total / 2**20:.1f} MB, over the 60 MB limit; stopping (ask before raising it)')

# graph/figures.json: one record per figure, and per structure id (graph form) its figures in strip order.
records = {fid: {k: v for k, v in figures[fid].items() if k != 'src'} | {'status': 'auto'} for fid in used}
board_units = {n: u['units'] for u in units.values() if u.get('units') for n in u['nodes']}
(ROOT / 'graph/figures.json').write_text(json.dumps({'figures': records, 'targets': dict(sorted(targets.items())), 'units': dict(sorted(board_units.items()))}, indent=1, ensure_ascii=False) + '\n')

# reports/figures.md: coverage, what each structure shows, every candidate not used and why.
by_source = defaultdict(int)
for fid in used:
    by_source[figures[fid]['source']] += 1
lines = ['# Figures', '', 'Generated by `pipeline/10-figures.py` (docs/FIGURES-PLAN.md). Matched automatically by the source\'s own id or exact title; '
         'every figure is unreviewed unless pinned in `pipeline/maps/figures.json`.', '',
         f"- Figures used: {len(used)} ({', '.join(f'{s} {by_source[s]}' for s in SOURCE_ORDER if by_source[s])}); public/figures/ is {total / 2**20:.1f} MB of the 60 MB limit.",
         f'- OpenStax figures whose title matched one of our names: {openstax_checked}; Servier images listed: {len(listed)}; BioArt entries checked: {len(BIOART["entries"])}.', '']
for scope, title in (('organ', 'Organs'), ('cell', 'Cell types with a morphology profile'), ('organelle', 'Organelles'), ('gross', 'Bones, muscles, vessels and nerves (only those with a figure are listed)')):
    us = [u for u in units.values() if u['scope'] == scope]
    counts = [sum(1 for u in us if len(unit_figures[u['id']]) == n) for n in range(4)]
    lines += [f'## {title}', '', f'{len(us)} structures: {counts[0]} with no figure, {counts[1]} with one, {counts[2]} with two, {counts[3]} with three.', '',
              '| Structure | Figures (kind, source: title) | How each matched |', '| --- | --- | --- |']
    for u in sorted(us, key=lambda u: u['label'].lower()):
        es = unit_figures[u['id']]
        if scope == 'gross' and not es:
            continue
        shown = '<br>'.join('{kind}, {source}: {title}'.format(**figures[e['figure']]) for e in es) or '-'
        how = '<br>'.join(e['match'] for e in es) or '-'
        lines.append(f"| {u['label']} ({u['id'].removeprefix('organ:')}) | {shown} | {how} |")
    lines.append('')
# HPA images of cell types: what each shows, what the rule without biomarkers picks, and which the biomarker rule changed.
at_cell = lambda p: f'{p[0]} in {p[1].lower()}' if p else 'no image'
label_of = lambda c: units[c['unit']]['label']
changed = [c for c in hpa_cells if c['shown'] != c['plain']]
same = [c for c in hpa_cells if c['marker'] and c['shown'] == c['plain']]
lines += ['## HPA images of cell types', '',
          "A cell type HPA names in a tissue shows HPA's image of a protein HPA scores high there (reliability enhanced, else supported). "
          "A protein that HRA's ASCT+B tables list as a biomarker of that cell type comes first: a row's gene and protein biomarkers belong to its last cell type, "
          "and HGNC's record of each biomarker's HGNC id gives the Ensembl gene HPA uses; a row counts only where that record also carries one of the row's names "
          "for the biomarker. Among biomarkers, the one listed by the most ASCT+B tables comes first, then the order below. Without a usable image of one, "
          "the rule without biomarkers picks from the first twelve proteins: those not detected in the tissue's other cell types first, then enhanced "
          "reliability, our organs' tissues, tissue name and gene name.", '',
          '- Changed by the biomarker rule (rule without biomarkers → now): ' + ('; '.join(f'{label_of(c)}: {at_cell(c["plain"])} → {at_cell(c["shown"])}' for c in changed) or 'none') + '.',
          '- Same image, its protein itself a listed biomarker (the caption now says so): ' + ('; '.join(f'{label_of(c)}: {at_cell(c["shown"])}' for c in same) or 'none') + '.',
          '- No listed biomarker with a usable HPA image (the rule without biomarkers picks): ' + ('; '.join(label_of(c) for c in hpa_cells if not c['marker']) or 'none') + '.', '',
          '| Cell type | HPA cell type | Shown | Biomarker (ASCT+B tables) | ASCT+B biomarkers: listed / id and name agree / scored high by HPA (tables listing each) | Rule without biomarkers |',
          '| --- | --- | --- | --- | --- | --- |']
for c in sorted(hpa_cells, key=lambda c: label_of(c).lower()):
    m = c['marker']
    marker_cell = '{} ({})'.format(m[0], ', '.join(m[1])) if m else '-'
    counts = '{} / {} / {}'.format(c['listed'], c['joined'], len(c['high'])) + (': ' + ', '.join('{} ({})'.format(*g) for g in c['high']) if c['high'] else '')
    lines.append(f"| {label_of(c)} ({c['unit']}) | {c['name']} | {at_cell(c['shown'])} | {marker_cell} | {counts} | {at_cell(c['plain'])} |")
lines += ['', "ASCT+B rows whose biomarker id and name disagree for these cell types (HGNC's record of the id does not carry the name the row gives it; "
          "mostly another gene's id), not used:", '']
lines += [f'- {label_of(c)}: {d}' for c in sorted(hpa_cells, key=lambda c: label_of(c).lower()) for d in c['disagree']] or ['- None.']
lines.append('')
lines += ['## Matched but not shown', '', 'Candidates that matched a structure but lost to a better-ranked figure (up to three per structure).', '']
lines += [f"- {u['label']}: {figures[o['figure']]['sourceName']} “{figures[o['figure']]['title']}” ({o['match']})"
          + ('; listed with the tissue board\'s other tissue units' if any(e['figure'] == o['figure'] for e in u.get('units', [])) else '') for u, o in not_chosen] or ['- None.']
# Structures with no figure: source titles that contain one of their names but are not equal to it (not used; a
# reviewer can judge them). Servier titles often add a context ("Epidermis – Keratinocyte").
near = []
for u in sorted(units.values(), key=lambda u: u['label'].lower()):
    if unit_figures[u['id']] or u['scope'] == 'gross':
        continue
    words = [k for k in u['names'] if len(k) > 3]
    found = sorted({i['title'] for i in listed.values() if any(re.search(rf'(?<![a-z]){re.escape(k)}s?(?![a-z])', key(i['title'])) for k in words)})
    if found:
        near.append(f"- {u['label']}: Servier {'; '.join(f'“{x}”' for x in found[:6])}{' and more' if len(found) > 6 else ''}")
lines += ['', '## Near misses', '', 'For structures with no figure: Servier titles that contain one of their names but are not equal to it. Not used (only exact titles are); listed for review.', '']
lines += near or ['- None.']
lines += ['', '## Same title', '', 'Servier lists several images under some titles; the one whose page is named after the title (else the first listed) is used.', '']
lines += [f"- “{item['title']}”: used {item['page']}; {len(others)} more not used" for item, others in same_title] or ['- None.']
lines += ['', '## Rejected', '', 'Candidates whose title or id matched but which were not used, and why.', '']
lines += [f"- {r['source']}: {r['title']}: {r['reason']}" + (f" ({r['url']})" if r['url'] else '') for r in rejected] or ['- None.']
(ROOT / 'reports/figures.md').write_text('\n'.join(lines) + '\n')

# public/ATTRIBUTION.md: this section is rewritten each run; the rest of the file is left alone.
HEADING = '## Figures (2D images in the Figures strip)'
section = [HEADING, '',
           '- What: up to three 2D figures per structure, cell type and organelle, shown in the detail panel and on tissue boards; each opens full size with its source, licence, credit line and a link to the original. '
           'Figures are matched automatically by the source\'s own id or exact title and are unreviewed. Images are converted to WebP (at most 1400 px) with a 240 px thumbnail; tissue unit illustrations open as their original SVG.']
for source, heading in (('hpa', f"Human Protein Atlas {HPA['release']} (CC BY 4.0, {HPA['terms']})"), ('hra', f"Human Reference Atlas {RELEASE['release']} 2D functional tissue units (CC BY 4.0)"),
                        ('openstax', 'OpenStax, from the CC BY 4.0 copies pinned in pipeline/maps/openstax.json'), ('servier', f"Servier Medical Art (CC BY 4.0, {SERVIER['site']})"),
                        ('bioart', f"NIH BioArt Source ({BIOART['site']})"), ('grays', f"Gray's Anatomy (1918), {GRAYS['details']} (public domain in the United States)")):
    fs = [figures[f] for f in used if figures[f]['source'] == source]
    if fs:
        section += ['', f'- {heading}:', '']
        section += [f"  - {f['title']}: {f['credit']} {f['pageUrl']}" for f in sorted(fs, key=lambda f: f['title'].lower())]
if hgnc_genes:
    section += ['', f"- Gene ids: {HGNC['credit']}. Its records join the HGNC ids of the HRA ASCT+B tables' biomarkers to the Ensembl genes the Human Protein Atlas uses, "
                f"to choose which protein a cell type's HPA image shows; nothing from HGNC is shown. HGNC data are freely available to all ({HGNC['terms']})."]
att = ROOT / 'public/ATTRIBUTION.md'
text = att.read_text()
block = '\n'.join(section) + '\n'
if HEADING in text:
    start = text.index(HEADING)
    nxt = text.find('\n## ', start + len(HEADING))
    text = text[:start] + block + ('\n' + text[nxt + 1:] if nxt >= 0 else '')
else:
    anchor = '## Neuron and glia reconstructions (NeuroMorpho.Org)'
    text = text.replace(anchor, block + '\n' + anchor) if anchor in text else text.rstrip('\n') + '\n\n' + block
att.write_text(text)
print(json.dumps({'figures': len(used), **{s: by_source[s] for s in SOURCE_ORDER if by_source[s]}, 'MB': round(total / 2**20, 1),
                  'with figures': sum(1 for es in unit_figures.values() if es), 'units': len(units), 'rejected': len(rejected),
                  'cell types showing a biomarker': sum(1 for c in hpa_cells if c['marker']), 'changed by the biomarker rule': len(changed)}))
