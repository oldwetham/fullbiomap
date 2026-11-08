"""Step 06: ontology facts for every FMA concept in public/models/atlas.json, from EBI OLS4.

Usage: python3 -I pipeline/06-ontology.py          (BIOMAP_LIMIT=n for a trial on n concepts)

Per FMA concept (OLS4 v2 entity): label, synonyms, FMA definition, TA98 id, is_a parents,
part_of parents (FMA regional_part_of / constitutional_part_of / systemic_part_of), and
is_a ancestors. Uberon xref: OLS4 does not index xrefs for search, so all Uberon terms are
scanned once (OLS4 v1 pages) and inverted on their FMA xrefs. NCIt: through the Uberon
term's NCIT xref, the NCIt definition (IAO_0000115) is fetched. Definitions whose provenance
cites Wikipedia are recorded but flagged, so step 07 never uses them.
Supply, drainage and innervation relations are Phase 2.

Outputs: graph/defs.jsonl, graph/edges.fma.jsonl, graph/sources.json, reports/ontology.md.
All responses are cached under data/cache/ (see pipeline/_http.py).
"""
import json
import os
import re
import sys
import urllib.parse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _http import NotFound, get_json, stats  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OLS = 'https://www.ebi.ac.uk/ols4/api'
FMA_IRI = 'http://purl.org/sig/ont/fma/fma'
UBERON_IRI = 'http://purl.obolibrary.org/obo/UBERON_'
NCIT_IRI = 'http://purl.obolibrary.org/obo/NCIT_'
FMA_NS = 'http://purl.org/sig/ont/fma/'
PART_OF = ['regional_part_of', 'systemic_part_of', 'constitutional_part_of']  # preference order
# Phase 2 connection relations. FMA states many only from the other end, so inverse properties
# are folded onto the forward relation: X <inverse> Y means Y <forward> X.
CONNECTIONS = ['arterial_supply', 'venous_drainage', 'nerve_supply', 'lymphatic_drainage', 'branch_of',
               'tributary_of', 'attaches_to', 'articulates_with', 'continuous_with']
INVERSE = {'arterial_supply_of': 'arterial_supply', 'venous_drainage_of': 'venous_drainage',
           'nerve_supply_of': 'nerve_supply', 'lymphatic_drainage_of': 'lymphatic_drainage', 'branch': 'branch_of',
           'tributary': 'tributary_of', 'receives_attachment_from': 'attaches_to'}
SYMMETRIC = {'articulates_with', 'continuous_with'}
RESTRICTION_PROP = 'http://www.w3.org/2002/07/owl#onProperty'
RESTRICTION_VALUE = 'http://www.w3.org/2002/07/owl#someValuesFrom'
SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf'
DEF = 'http://purl.obolibrary.org/obo/IAO_0000115'
NCIT_DEF_SOURCE = 'http://purl.obolibrary.org/obo/NCIT_P378'
DBXREF = 'http://www.geneontology.org/formats/oboInOwl#hasDbXref'


def entity_url(ontology, iri):
    return f'{OLS}/v2/ontologies/{ontology}/entities/{urllib.parse.quote(urllib.parse.quote(iri, safe=""), safe="")}'


def values(v):
    """OLS4 v2 property values: a scalar, a list, or reifications {value, axioms}."""
    out = []
    for x in v if isinstance(v, list) else [] if v is None else [v]:
        if isinstance(x, dict) and 'value' in x:
            out.append((x['value'], x.get('axioms') or []))
        elif isinstance(x, (str, int, float)):
            out.append((x, []))
    return out


def clean(text):
    return re.sub(r'\s+', ' ', str(text)).strip()


def fma_id(iri):
    return 'FMA:' + iri[len(FMA_IRI):] if iri.startswith(FMA_IRI) else None


def cites_wikipedia(xrefs):
    return any('wikipedia' in json.dumps(x).lower() for x in xrefs)


# Ontology metadata (versions and licenses) -------------------------------------------
sources = {}
for o in ('fma', 'uberon', 'ncit'):
    d = get_json(f'{OLS}/v2/ontologies/{o}')
    sources[o] = {'title': d.get('title'),
                  'version': d.get('http://www.w3.org/2002/07/owl#versionInfo') or d.get('version'),
                  'versionIri': d.get('http://www.w3.org/2002/07/owl#versionIRI') or d.get('versionIri'),
                  'olsLicense': d.get('license'), 'olsLoaded': d.get('loaded')}
# FMA's OLS4 record says "CUSTOM" (a 2006 draft license page); docs/SPEC.md records CC BY 3.0.
LICENSES = {'fma': {'name': 'CC BY 3.0', 'url': 'https://creativecommons.org/licenses/by/3.0/'},
            'uberon': {'name': 'CC BY 3.0', 'url': 'https://creativecommons.org/licenses/by/3.0/'},
            'ncit': {'name': 'CC BY 4.0', 'url': 'https://creativecommons.org/licenses/by/4.0/'}}
for o in sources:
    sources[o]['license'] = LICENSES[o]

# Atlas concepts ------------------------------------------------------------------------
atlas = json.loads((ROOT / 'public/models/atlas.json').read_text())
concepts = [c['id'] for c in atlas['concepts']]
if os.environ.get('BIOMAP_LIMIT'):
    keep = {'FMA7088', 'FMA7205', 'FMA7148', 'FMA59763', 'FMA67498'}
    concepts = [c for c in concepts if c in keep] + [c for c in concepts if c not in keep][:int(os.environ['BIOMAP_LIMIT'])]


def fetch_fma(cid):
    iri = FMA_IRI + cid[3:]
    try:
        d = get_json(entity_url('fma', iri))
    except NotFound:
        return cid, None
    linked = d.get('linkedEntities') or {}

    def label_of(i):
        lab = (linked.get(i) or {}).get('label') or []
        return lab[0] if lab else None

    label = next((clean(v) for v, _ in values(d.get('http://www.w3.org/2000/01/rdf-schema#label'))), None) \
        or (d.get('label') or [None])[0]
    synonyms = sorted({clean(v) for k in d if k.startswith(FMA_NS) and k.rsplit('/', 1)[-1] == 'synonym'
                       for v, _ in values(d[k])})
    definition = next((clean(v) for v, _ in values(d.get(FMA_NS + 'definition'))), None)
    ta98 = sorted({str(a.get(FMA_NS + 'TA_ID')) for _, axioms in values(d.get(FMA_NS + 'preferred_name'))
                   for a in axioms if a.get(FMA_NS + 'TA_ID')})
    is_a = [{'id': fma_id(p), 'label': label_of(p)} for p in d.get('directParent') or [] if fma_id(p)]
    part_of, relations = [], []
    for r in d.get(SUBCLASS) or []:
        if isinstance(r, dict):
            prop = str(r.get(RESTRICTION_PROP, '')).rsplit('/', 1)[-1]
            target = r.get(RESTRICTION_VALUE)
            if prop in PART_OF and isinstance(target, str) and fma_id(target):
                part_of.append({'id': fma_id(target), 'label': label_of(target), 'rel': prop})
            if (prop in CONNECTIONS or prop in INVERSE) and isinstance(target, str) and fma_id(target):
                relations.append({'property': prop, 'id': fma_id(target), 'label': label_of(target)})
    # Prefer the generic whole over FMA 5's sex-specific copies ('... of male human body').
    part_of.sort(key=lambda x: (PART_OF.index(x['rel']), bool(re.search(r'of (male|female) human body', x['label'] or '', re.I)), x['id']))
    ancestors = sorted({fma_id(a) for a in d.get('hierarchicalAncestor') or [] if fma_id(a)})
    return cid, {'iri': iri, 'label': label, 'synonyms': synonyms, 'definition': definition, 'ta98': ta98,
                 'obsolete': bool(d.get('isObsolete')), 'isA': is_a, 'partOf': part_of, 'ancestors': ancestors,
                 'relations': sorted(relations, key=lambda x: (x['property'], x['id']))}


with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
    fma = dict(pool.map(fetch_fma, concepts))
print(f'FMA terms: {sum(v is not None for v in fma.values())}/{len(fma)} found', flush=True)

# Uberon scan: invert FMA xrefs -------------------------------------------------------
uberon_by_fma = defaultdict(list)
uberon = {}
page, pages = 0, 1
while page < pages:
    d = get_json(f'{OLS}/ontologies/uberon/terms?size=100&page={page}')
    pages = d['page']['totalPages']
    for t in d.get('_embedded', {}).get('terms', []):
        oid = t.get('obo_id') or ''
        if not oid.startswith('UBERON:') or t.get('is_obsolete'):
            continue
        xrefs = [f'{x.get("database")}:{x.get("id")}' for x in t.get('obo_xref') or [] if x.get('database')]
        cites = t.get('obo_definition_citation') or []
        if cites:
            definition, def_xrefs = clean(cites[0]['definition']), cites[0].get('oboXrefs') or []
        else:
            definition, def_xrefs = (clean(t['description'][0]) if t.get('description') else None), []
        if definition:
            definition = clean(definition.replace('[Automatically generated definition]', '')) or None
        uberon[oid] = {'id': oid, 'iri': t['iri'], 'label': t.get('label'), 'definition': definition,
                       'definitionCitesWikipedia': cites_wikipedia(def_xrefs) or bool(definition and 'wikipedia' in definition.lower()),
                       'ncit': sorted(x for x in xrefs if x.startswith('NCIT:'))}
        for x in xrefs:
            if x.startswith('FMA:'):
                uberon_by_fma['FMA' + x[4:]].append(oid)
    page += 1
print(f'Uberon terms scanned: {len(uberon)} ({pages} pages)', flush=True)


def pick(candidates, label, table):
    """Prefer the candidate whose label matches the FMA label; otherwise the lowest id."""
    if not candidates:
        return None
    lab = (label or '').lower()
    return sorted(candidates, key=lambda c: ((table[c].get('label') or '').lower() != lab, c))[0]


chosen_uberon = {cid: pick(sorted(set(uberon_by_fma.get(cid, []))), (fma.get(cid) or {}).get('label'), uberon)
                 for cid in concepts}

# HRA 3D concepts (Phase 3) ------------------------------------------------------------
# Every ontology id in the pinned HRA crosswalks (step 04). Uberon ids use the Uberon scan
# above; FMA ids that are not atlas concepts are fetched from OLS4 like the atlas ones.
import csv
hra_ids = set()
release_file = ROOT / 'pipeline/maps/hra-release.json'
if release_file.exists():
    hra_release = json.loads(release_file.read_text())
    for obj in hra_release['objects']:
        cw = ROOT / 'data/raw/hra' / hra_release['release'] / obj / 'crosswalk.csv'
        if cw.exists():
            with open(cw, encoding='utf-8', newline='') as fh:
                for row in csv.DictReader(fh):
                    oid = (row.get('OntologyID') or '').strip()
                    if re.fullmatch(r'(UBERON|FMA):\d+', oid):
                        hra_ids.add(oid)
atlas_set = set(concepts)
hra_fma = sorted({'FMA' + i[4:] for i in hra_ids if i.startswith('FMA:')} - atlas_set)
with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
    fma.update(dict(pool.map(fetch_fma, hra_fma)))
hra_uberon = {}
for oid in sorted(hra_ids):
    if oid.startswith('UBERON:'):
        hra_uberon[oid] = oid if oid in uberon else None
    else:
        cid = 'FMA' + oid[4:]
        hra_uberon[oid] = chosen_uberon.get(cid) if cid in atlas_set else pick(sorted(set(uberon_by_fma.get(cid, []))), (fma.get(cid) or {}).get('label'), uberon)
print(f'HRA concept ids: {len(hra_ids)} ({len(hra_fma)} FMA ids outside the atlas fetched)', flush=True)

# NCIt definitions through Uberon -----------------------------------------------------
ncit_wanted = sorted({n for u in [*chosen_uberon.values(), *hra_uberon.values()] if u for n in uberon[u]['ncit']})


def fetch_ncit(code):
    try:
        d = get_json(entity_url('ncit', NCIT_IRI + code[5:]))
    except NotFound:
        return code, None
    defs = []
    for v, axioms in values(d.get(DEF)):
        source = ', '.join(sorted({str(a.get(NCIT_DEF_SOURCE)) for a in axioms if a.get(NCIT_DEF_SOURCE)}))
        defs.append({'text': clean(v), 'source': source or None})
    usable = [x for x in defs if 'wiki' not in (x['source'] or '').lower() and 'wikipedia' not in x['text'].lower()]
    best = next((x for x in usable if x['source'] == 'NCI'), usable[0] if usable else None)
    return code, {'id': code, 'iri': NCIT_IRI + code[5:], 'label': (d.get('label') or [None])[0],
                  'definition': best['text'] if best else None, 'definitionSource': best['source'] if best else None,
                  'skippedWikipediaDefinitions': len(defs) - len(usable)}


with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
    ncit = {k: v for k, v in pool.map(fetch_ncit, ncit_wanted) if v}
print(f'NCIt terms: {len(ncit)}/{len(ncit_wanted)} found', flush=True)

# Organ for the scale ladder (Phase 3) -------------------------------------------------
# A concept's organ is itself if it is an FMA Organ (FMA:67498 or an is_a descendant), else the
# nearest atlas concept up its part_of chain that is one. Terms outside the atlas on the way are
# fetched from OLS4 (cached).
ORGAN = 'FMA:67498'
extra_terms = {}
def term_of(fid):
    cid = 'FMA' + fid[4:]
    return fma.get(cid) if cid in fma else extra_terms.get(cid)
organ_of, frontier = {}, {}
for cid in concepts:
    f = fma[cid]
    if f and (ORGAN in f['ancestors'] or cid == 'FMA67498'):
        organ_of[cid] = {'id': 'FMA:' + cid[3:], 'label': f['label']}
    elif f:
        frontier[cid] = [p['id'] for p in f['partOf']]
for depth in range(8):
    need = sorted({'FMA' + i[4:] for ids in frontier.values() for i in ids} - set(fma) - set(extra_terms))
    with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
        extra_terms.update(dict(pool.map(fetch_fma, need)))
    nxt = {}
    for cid, ids in frontier.items():
        hit = next((i for i in ids if 'FMA' + i[4:] in atlas_set and term_of(i) and (ORGAN in term_of(i)['ancestors'])), None)
        if hit:
            organ_of[cid] = {'id': hit, 'label': term_of(hit)['label']}
            continue
        up = list(dict.fromkeys(p['id'] for i in ids if term_of(i) for p in term_of(i)['partOf']))[:24]
        if up:
            nxt[cid] = up
    frontier = nxt
    if not frontier:
        break
print(f'Organ for the ladder: {len(organ_of)}/{len(concepts)} concepts ({len(extra_terms)} extra FMA terms)', flush=True)

# Write -------------------------------------------------------------------------------
graph = ROOT / 'graph'
graph.mkdir(exist_ok=True)
defs_lines, edge_lines, counts = [], [], Counter()
connection_edges = defaultdict(set)
for cid in concepts:
    f = fma[cid]
    u = chosen_uberon[cid]
    urec = dict(uberon[u], candidates=sorted(set(uberon_by_fma[cid]))) if u else None
    n_code = pick(urec['ncit'], f and f['label'], {k: v for k, v in ncit.items()}) if urec and urec['ncit'] else None
    n = ncit.get(n_code) if n_code else None
    gid = 'FMA:' + cid[3:]
    defs_lines.append(json.dumps({
        'id': gid, 'conceptId': cid, 'fma': f, 'uberon': urec, 'ncit': n, 'organ': organ_of.get(cid),
    }, ensure_ascii=False, sort_keys=True))
    counts['concepts'] += 1
    counts['fma found'] += f is not None
    counts['fma definition'] += bool(f and f['definition'])
    counts['uberon xref'] += u is not None
    counts['uberon xref ambiguous'] += bool(urec and len(urec['candidates']) > 1)
    counts['uberon definition (usable)'] += bool(urec and urec['definition'] and not urec['definitionCitesWikipedia'])
    counts['uberon definition cites Wikipedia (skipped)'] += bool(urec and urec['definition'] and urec['definitionCitesWikipedia'])
    counts['ncit xref'] += n_code is not None
    counts['ncit definition'] += bool(n and n['definition'])
    counts['organ (is_a descendant of FMA:67498)'] += bool(f and 'FMA:67498' in f['ancestors'])
    if f:
        for p in f['isA']:
            edge_lines.append(json.dumps({'from': gid, 'to': p['id'], 'rel': 'is_a', 'source': 'FMA', 'evidence': 'rdfs:subClassOf'}))
        for p in f['partOf']:
            edge_lines.append(json.dumps({'from': gid, 'to': p['id'], 'rel': 'part_of', 'source': 'FMA', 'evidence': p['rel']}))
        for r in f['relations']:
            if r['property'] in CONNECTIONS:
                a, b, rel = gid, r['id'], r['property']
            else:
                a, b, rel = r['id'], gid, INVERSE[r['property']]
            if rel in SYMMETRIC:
                a, b = sorted([a, b])
            connection_edges[(a, rel, b)].add(r['property'])
for (a, rel, b), evidence in connection_edges.items():
    counts[f'connection {rel}'] += 1
    edge_lines.append(json.dumps({'from': a, 'to': b, 'rel': rel, 'source': 'FMA', 'evidence': ', '.join(sorted(evidence))}))
(graph / 'defs.jsonl').write_text('\n'.join(defs_lines) + '\n')

# HRA concepts: same record shape, plus the male (atlas) concept it is equivalent to, if any.
male_by_uberon = defaultdict(list)
for cid in concepts:
    if chosen_uberon[cid]:
        male_by_uberon[chosen_uberon[cid]].append(cid)
# Vessels without a male equivalent: artery or vein from the Uberon is_a ancestors (OLS4, cached).
ARTERY, VEIN = 'http://purl.obolibrary.org/obo/UBERON_0001637', 'http://purl.obolibrary.org/obo/UBERON_0001638'
def vessel_kind(oid):
    try:
        d = get_json(entity_url('uberon', UBERON_IRI + oid[7:]))
    except NotFound:
        return oid, None
    anc = set(d.get('hierarchicalAncestor') or []) | set(d.get('directAncestor') or [])
    return oid, 'artery' if ARTERY in anc else 'vein' if VEIN in anc else None
lone_uberon = [oid for oid in sorted(hra_ids) if oid.startswith('UBERON:') and len(male_by_uberon.get(oid, [])) != 1]
with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
    vessel = dict(pool.map(vessel_kind, lone_uberon))
fma_by_uberon = defaultdict(list)
for f_id, u_ids in uberon_by_fma.items():
    for u_id in set(u_ids):
        fma_by_uberon[u_id].append(f_id)
hra_lines = []
for oid in sorted(hra_ids):
    cid = oid.replace(':', '')
    f = fma.get(cid) if oid.startswith('FMA:') else None
    u = hra_uberon[oid]
    urec = dict(uberon[u], candidates=[u]) if u else None
    found = [x for x in (urec or {}).get('ncit', []) if x in ncit]
    n_code = pick(found, (f or {}).get('label') or urec.get('label'), ncit) if found else None
    if oid.startswith('FMA:'):
        equivalent = cid if cid in atlas_set else None
    else:
        equivalent = male_by_uberon[oid][0] if len(male_by_uberon.get(oid, [])) == 1 else None
    counts['hra concepts'] += 1
    counts['hra concepts with a male equivalent'] += equivalent is not None
    hra_lines.append(json.dumps({'id': oid, 'conceptId': cid, 'fma': f, 'uberon': urec, 'ncit': ncit.get(n_code) if n_code else None,
                                 'equivalent': equivalent, 'vessel': vessel.get(oid), 'fmaXrefs': sorted(fma_by_uberon.get(oid, []))}, ensure_ascii=False, sort_keys=True))
(graph / 'defs.hra.jsonl').write_text('\n'.join(hra_lines) + '\n' if hra_lines else '')

# Connections for HRA structures with no male equivalent (e.g. the uterus, ovaries, breast tissue):
# FMA relations from their own FMA term, or from their single FMA cross-reference (uterus
# UBERON:0000995 -> FMA:17558). Folded like the atlas relations above. -> graph/edges.hra-fma.jsonl
hra_rel_lines, via = [], {}
for oid in sorted(hra_ids):
    cid = oid.replace(':', '')
    if (oid.startswith('FMA:') and cid in atlas_set) or (oid.startswith('UBERON:') and len(male_by_uberon.get(oid, [])) == 1):
        continue
    if oid.startswith('FMA:'):
        via[oid] = cid
    elif len(fma_by_uberon.get(oid, [])) == 1:
        via[oid] = fma_by_uberon[oid][0]
missing = sorted(set(via.values()) - set(fma))
with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
    fma.update(dict(pool.map(fetch_fma, missing)))
hra_edges = {}
for oid, src in sorted(via.items()):
    f = fma.get(src)
    if not f:
        continue
    for r in f['relations']:
        if r['property'] in CONNECTIONS:
            a, b, rel = oid, r['id'], r['property']
        else:
            a, b, rel = r['id'], oid, INVERSE[r['property']]
        if rel in SYMMETRIC:
            a, b = sorted([a, b])
        e = hra_edges.setdefault((a, rel, b), {'from': a, 'to': b, 'rel': rel, 'source': 'FMA', 'evidence': set(), 'labels': {}})
        e['evidence'].add(r['property'] + ('' if src == oid.replace(':', '') else f' (via FMA:{src[3:]})'))
        e['labels'][r['id']] = r['label']
for e in hra_edges.values():
    counts[f'hra connection {e["rel"]}'] += 1
    hra_rel_lines.append(json.dumps({**e, 'evidence': ', '.join(sorted(e['evidence']))}, ensure_ascii=False, sort_keys=True))
(graph / 'edges.hra-fma.jsonl').write_text('\n'.join(sorted(hra_rel_lines)) + '\n' if hra_rel_lines else '')

# Cell types (Phase 4): ASCT+B tables from step 04 -> graph/asctb.jsonl (one line per distinct row:
# table, anatomical structure chain, cell types). Only Cell Ontology ids are kept; provisional PCL ids
# and other prefixes are counted and skipped. Then Cell Ontology facts -> graph/defs.cells.jsonl.
CL_IRI = 'http://purl.obolibrary.org/obo/CL_'
TABLE_SKIP = {'placenta'}  # pregnancy anatomy is not shown, as with the placenta models
asctb_rows, skipped_ct = set(), Counter()
# Known errors in the tables (pipeline/maps/asctb-fixes.json): corrected here, listed in reports/asctb-issues.md.
asctb_fixes = {(c['table'], c['from']): c for c in json.loads((ROOT / 'pipeline/maps/asctb-fixes.json').read_text())['corrections']}
asctb_issues = set()
for name, info in sorted(hra_release.get('tables', {}).items()):
    if name in TABLE_SKIP:
        continue
    with open(ROOT / 'data/raw/hra' / hra_release['release'] / 'asct-b' / name / info['files'][0], encoding='utf-8', newline='') as fh:
        rows = list(csv.reader(fh))
    head = next(i for i, r in enumerate(rows) if r and r[0].startswith('AS/1'))
    H = rows[head]
    col = {c: i for i, c in enumerate(H)}
    levels = lambda prefix: sorted({int(m.group(1)) for c in H for m in [re.fullmatch(rf'{prefix}/(\d+)/ID', c)] if m})
    for r in rows[head + 1:]:
        cell = lambda c: (r[col[c]].strip() if c in col and col[c] < len(r) else '')
        chain = []
        for k in levels('AS'):
            i = re.sub(r'^(UBERON|FMA)_', r'\1:', cell(f'AS/{k}/ID'))
            if re.fullmatch(r'(UBERON|FMA):\d+', i):
                chain.append([i, cell(f'AS/{k}/LABEL') or cell(f'AS/{k}')])
        cts = []
        for k in levels('CT'):
            i = re.sub(r'^CL_', 'CL:', cell(f'CT/{k}/ID'))
            if re.fullmatch(r'CL:\d+', i):
                label = cell(f'CT/{k}/LABEL') or cell(f'CT/{k}')
                fix = asctb_fixes.get((name, i))
                if fix:  # a wrong id in the table (pipeline/maps/asctb-fixes.json); reported to HRA below
                    asctb_issues.add((name, info['version'], info.get('doi', ''), chain[-1][1] if chain else '', label, i, fix['to'], fix['why']))
                    i = fix['to']
                cts.append([i, label])
            elif i:
                skipped_ct[i.split(':')[0]] += 1
        if chain and cts:
            asctb_rows.add(json.dumps({'table': name, 'version': info['version'], 'chain': chain, 'cellTypes': cts}, ensure_ascii=False, sort_keys=True))
(graph / 'asctb.jsonl').write_text('\n'.join(sorted(asctb_rows)) + '\n')
counts['asct-b rows with cell types'] = len(asctb_rows)
for k, v in skipped_ct.items():
    counts[f'asct-b cell type ids skipped ({k})'] = v
cl_ids = sorted({c[0] for line in asctb_rows for c in json.loads(line)['cellTypes']} | {'CL:0000000'} | {c['from'] for c in asctb_fixes.values()})

def fetch_term(ontology, iri, oid):
    try:
        d = get_json(entity_url(ontology, iri))
    except NotFound:
        return oid, None
    defs = [(clean(v), axioms) for v, axioms in values(d.get(DEF))]
    cites = defs and cites_wikipedia([x for a in defs[0][1] for x in (a.get(DBXREF) if isinstance(a.get(DBXREF), list) else [a.get(DBXREF)] if a.get(DBXREF) else [])])
    term = {'id': oid, 'iri': iri, 'label': (d.get('label') or [None])[0], 'definition': defs[0][0] if defs else None,
            'definitionCitesWikipedia': bool(cites) or bool(defs and 'wikipedia' in defs[0][0].lower()),
            'synonyms': sorted({clean(v) for v, _ in values(d.get('http://www.geneontology.org/formats/oboInOwl#hasExactSynonym'))})}
    if d.get('isObsolete'):
        term['obsolete'] = True
        repl = [v for v, _ in values(d.get('http://purl.obolibrary.org/obo/IAO_0100001'))]
        if repl:
            term['replacedBy'] = re.sub(r'^.*/CL_', 'CL:', repl[0])
    if ontology == 'cl':  # every Cell Ontology class above it: pipeline/maps/cell-families.json picks a 3D shape from these
        found = set(d.get('hierarchicalAncestor') or []) | set(d.get('directAncestor') or [])
        term['ancestors'] = sorted({'CL:' + a.rsplit('_', 1)[1] for a in found if '/obo/CL_' in a and a.rsplit('_', 1)[1] != oid[3:]})
    return oid, term

with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
    cells = dict(pool.map(lambda c: fetch_term('cl', CL_IRI + c[3:], c), cl_ids))
(graph / 'defs.cells.jsonl').write_text('\n'.join(json.dumps(cells[c], ensure_ascii=False, sort_keys=True) for c in cl_ids if cells[c]) + '\n')
counts['cell ontology terms'] = sum(1 for c in cl_ids if cells[c])
# Any other row id that Cell Ontology marks obsolete is listed for HRA too. Where Cell Ontology records its replacement
# ('term replaced by'), the rows use that instead; otherwise the id stays until a correction is recorded.
replaced = {}
for line in asctb_rows:
    r = json.loads(line)
    for cid, label in r['cellTypes']:
        t = cells.get(cid)
        if t and (t.get('obsolete') or (t.get('label') or '').lower().startswith('obsolete')):
            to = t.get('replacedBy') or ''
            if to:
                replaced[cid] = to
            asctb_issues.add((r['table'], r['version'], hra_release['tables'][r['table']].get('doi', ''), r['chain'][-1][1], label, cid, to,
                              f'Cell Ontology marks this id obsolete and records {to} as its replacement.' if to else 'Cell Ontology marks this id obsolete; no correction recorded yet.'))
if replaced:
    asctb_rows = {json.dumps({**r, 'cellTypes': [[replaced.get(c, c), lab] for c, lab in r['cellTypes']]}, ensure_ascii=False, sort_keys=True) for r in map(json.loads, asctb_rows)}
    (graph / 'asctb.jsonl').write_text('\n'.join(sorted(asctb_rows)) + '\n')
    new_ids = sorted(set(replaced.values()) - set(cl_ids))
    with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
        cells.update(dict(pool.map(lambda c: fetch_term('cl', CL_IRI + c[3:], c), new_ids)))
    cl_ids = sorted(set(cl_ids) | set(new_ids))
    (graph / 'defs.cells.jsonl').write_text('\n'.join(json.dumps(cells[c], ensure_ascii=False, sort_keys=True) for c in cl_ids if cells[c]) + '\n')
issue_rows = sorted(asctb_issues)
(ROOT / 'reports/asctb-issues.md').write_text('\n'.join([
    '# ASCT+B issues to report to HRA', '',
    f'Generated by `pipeline/06-ontology.py` from the HRA {hra_release["release"]} ASCT+B tables. Each row uses a Cell Ontology id that does not match its label;',
    'Bio Map uses the corrected id where one is recorded in `pipeline/maps/asctb-fixes.json`.', '',
    '| Table (version) | Structure | Row label | Id in the table | Cell Ontology says | Bio Map uses | Why |', '| --- | --- | --- | --- | --- | --- | --- |',
    *[f'| {t} {v} ({doi}) | {st} | {lab} | {bad} | {(cells.get(bad) or {}).get("label") or "not found"} | {good or "-"} {(" (" + (cells.get(good) or {}).get("label", "?") + ")") if good else ""} | {why} |' for t, v, doi, st, lab, bad, good, why in issue_rows],
]) + '\n')
counts['asct-b ids reported (reports/asctb-issues.md)'] = len(issue_rows)
counts['cell ontology definitions citing Wikipedia (skipped)'] = sum(1 for c in cl_ids if cells[c] and cells[c]['definitionCitesWikipedia'])
organelles = json.loads((ROOT / 'pipeline/maps/organelles.json').read_text())['organelles']
with ThreadPoolExecutor(max_workers=int(os.environ.get('BIOMAP_WORKERS', '6'))) as pool:
    go = dict(pool.map(lambda o: fetch_term('go', 'http://purl.obolibrary.org/obo/GO_' + o['id'][3:], o['id']), organelles))
(graph / 'defs.go.jsonl').write_text('\n'.join(json.dumps(go[o['id']], ensure_ascii=False, sort_keys=True) for o in organelles) + '\n')
for o in ('cl', 'go'):
    d = get_json(f'{OLS}/v2/ontologies/{o}')
    sources[o] = {'title': d.get('title'), 'version': d.get('http://www.w3.org/2002/07/owl#versionInfo') or d.get('version'),
                  'versionIri': d.get('http://www.w3.org/2002/07/owl#versionIRI'), 'olsLicense': d.get('license'), 'olsLoaded': d.get('loaded'),
                  'license': {'name': 'CC BY 4.0', 'url': 'https://creativecommons.org/licenses/by/4.0/'}}
(graph / 'sources.json').write_text(json.dumps(sources, indent=1, sort_keys=True) + '\n')
(graph / 'edges.fma.jsonl').write_text('\n'.join(sorted(set(edge_lines))) + '\n')

# HRA vasculature (VCCF) branching -----------------------------------------------------
# ASCT+B Blood Vasculature rows run from the heart outward (AS/1 ... AS/n). Each consecutive
# pair whose two vessels are both atlas concepts of the same kind becomes branch_of (arteries)
# or tributary_of (veins), child -> parent. Uberon ids map through the Uberon xrefs above
# (only when one atlas concept carries that Uberon id).
vccf_csv = ROOT / 'data/raw/hra/asct-b-vh-blood-vasculature-v1.10.csv'
if vccf_csv.exists():
    import csv
    atlas_ids = {'FMA:' + c[3:] for c in concepts}
    by_uberon = defaultdict(set)
    for cid in concepts:
        if chosen_uberon[cid]:
            by_uberon[chosen_uberon[cid]].add('FMA:' + cid[3:])
    part_system = {p['id']: p['system'] for p in atlas['parts']}
    concept_system = {}
    for c in atlas['concepts']:
        if 'FMA:' + c['id'][3:] in atlas_ids:
            concept_system['FMA:' + c['id'][3:]] = Counter(part_system[e] for e in c['elements']).most_common(1)[0][0]

    def to_atlas(hra_id):
        if hra_id.startswith('FMA:'):
            return hra_id if hra_id in atlas_ids else None
        hits = by_uberon.get(hra_id, set())
        return next(iter(hits)) if len(hits) == 1 else None

    with open(vccf_csv, encoding='utf-8', newline='') as fh:
        rows = list(csv.reader(fh))
    head = next(i for i, r in enumerate(rows) if r and r[0] == 'AS/1')
    header = rows[head]
    cols = [(header.index(f'AS/{k}/ID'), header.index(f'AS/{k}/LABEL')) for k in range(1, 100) if f'AS/{k}/ID' in header]
    pairs = {}
    for r in rows[head + 1:]:
        chain = [(r[i].strip(), r[j].strip()) for i, j in cols if i < len(r) and r[i].strip()]
        for (pid, plabel), (cid_, clabel) in zip(chain, chain[1:]):
            pairs[(pid, cid_)] = (plabel, clabel)
    vccf_lines, vccf_skipped = [], Counter()
    for (pid, cid_), (plabel, clabel) in sorted(pairs.items()):
        parent, child = to_atlas(pid), to_atlas(cid_)
        if not parent or not child:
            vccf_skipped['an end is not a modeled structure'] += 1
            continue
        if parent == child:
            vccf_skipped['both ends map to the same structure'] += 1
            continue
        kinds = (concept_system[child], concept_system[parent])
        rel = {('arterial', 'arterial'): 'branch_of', ('venous', 'venous'): 'tributary_of'}.get(kinds)
        if not rel:
            vccf_skipped[f'{kinds[0]} -> {kinds[1]} (no matching relation)'] += 1
            continue
        counts[f'vccf {rel}'] += 1
        vccf_lines.append(json.dumps({'from': child, 'to': parent, 'rel': rel, 'source': 'HRA VCCF',
                                      'evidence': f'ASCT+B Blood Vasculature v1.10: {pid} {plabel} -> {cid_} {clabel}'}, ensure_ascii=False))
    (graph / 'edges.vccf.jsonl').write_text('\n'.join(sorted(set(vccf_lines))) + '\n')
    counts['vccf vessel pairs'] = len(pairs)
    for k, v in sorted(vccf_skipped.items()):
        counts[f'vccf skipped: {k}'] = v
(graph / 'sources.json').write_text(json.dumps(sources, indent=1, sort_keys=True) + '\n')

lines = ['# Ontology report', '', 'Generated by `pipeline/06-ontology.py` from EBI OLS4.', '',
         '| Ontology | Version | License |', '| --- | --- | --- |']
lines += [f'| {s["title"]} | {s["version"] or s["versionIri"]} | {s["license"]["name"]} |' for s in sources.values()]
lines += ['', '| Measure | Concepts |', '| --- | --- |'] + [f'| {k} | {v} |' for k, v in counts.items()]
missing = [c for c in concepts if fma[c] is None]
if missing:
    lines += ['', f'FMA ids not found in OLS4 FMA {sources["fma"]["version"]}: ' + ', '.join(missing)]
(ROOT / 'reports').mkdir(exist_ok=True)
(ROOT / 'reports/ontology.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({**counts, 'http': stats}, indent=1))
