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
    part_of = []
    for r in d.get(SUBCLASS) or []:
        if isinstance(r, dict):
            prop = str(r.get(RESTRICTION_PROP, '')).rsplit('/', 1)[-1]
            target = r.get(RESTRICTION_VALUE)
            if prop in PART_OF and isinstance(target, str) and fma_id(target):
                part_of.append({'id': fma_id(target), 'label': label_of(target), 'rel': prop})
    # Prefer the generic whole over FMA 5's sex-specific copies ('... of male human body').
    part_of.sort(key=lambda x: (PART_OF.index(x['rel']), bool(re.search(r'of (male|female) human body', x['label'] or '', re.I)), x['id']))
    ancestors = sorted({fma_id(a) for a in d.get('hierarchicalAncestor') or [] if fma_id(a)})
    return cid, {'iri': iri, 'label': label, 'synonyms': synonyms, 'definition': definition, 'ta98': ta98,
                 'obsolete': bool(d.get('isObsolete')), 'isA': is_a, 'partOf': part_of, 'ancestors': ancestors}


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

# NCIt definitions through Uberon -----------------------------------------------------
ncit_wanted = sorted({n for u in chosen_uberon.values() if u for n in uberon[u]['ncit']})


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

# Write -------------------------------------------------------------------------------
graph = ROOT / 'graph'
graph.mkdir(exist_ok=True)
defs_lines, edge_lines, counts = [], [], Counter()
for cid in concepts:
    f = fma[cid]
    u = chosen_uberon[cid]
    urec = dict(uberon[u], candidates=sorted(set(uberon_by_fma[cid]))) if u else None
    n_code = pick(urec['ncit'], f and f['label'], {k: v for k, v in ncit.items()}) if urec and urec['ncit'] else None
    n = ncit.get(n_code) if n_code else None
    gid = 'FMA:' + cid[3:]
    defs_lines.append(json.dumps({
        'id': gid, 'conceptId': cid, 'fma': f, 'uberon': urec, 'ncit': n,
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
(graph / 'defs.jsonl').write_text('\n'.join(defs_lines) + '\n')
(graph / 'edges.fma.jsonl').write_text('\n'.join(sorted(set(edge_lines))) + '\n')
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
