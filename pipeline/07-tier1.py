"""Step 07: tier-1 auto text for every atlas concept, with no Wikipedia text anywhere.

Usage: python3 -I pipeline/07-tier1.py

Source priority (first available wins):
  1. NCIt definition (through the concept's Uberon xref)
  2. Uberon definition, unless its provenance cites Wikipedia
  3. FMA definition
A concept with none of these gets no tier-1 text: its fact card (step 11) says what the hierarchy says. The sentences this
step used to generate from the hierarchy ("X is a kind of Y and part of the Z", "X is a cell type found in the Y") repeated
the card's "Kind of", "Part of" and "Found in" rows, so they were dropped (docs/EXPLANATIONS-PLAN.md).

Writes content/<FMA_n>/tier1.auto.md (status "auto") with the source name, a link to the
source term, its license and attribution. A curated content/<FMA_n>/tier1.md is never
touched, and no auto file is written beside it. Stale auto files for concepts no longer in
the atlas are removed.
"""
import json
import re
import urllib.parse
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content'
SOURCES = json.loads((ROOT / 'graph/sources.json').read_text())


def ols_link(ontology, iri):
    return f'https://www.ebi.ac.uk/ols4/ontologies/{ontology}/classes/{urllib.parse.quote(urllib.parse.quote(iri, safe=""), safe="")}'


def sentence(text):
    text = re.sub(r'\s+([.,;:])', r'\1', re.sub(r'\s+', ' ', text)).strip()
    return text if text.endswith(('.', '!', '?')) else text + '.'


def version(o):
    """'5.1.0' for FMA, '26.02d' for NCIt; Uberon has no version string, so use its release date."""
    s = SOURCES[o]
    if s.get('version'):
        return s['version']
    m = re.search(r'/releases/([^/]+)/', s.get('versionIri') or '')
    return f'release {m.group(1)}' if m else 'current release'


records = [json.loads(line) for line in (ROOT / 'graph/defs.jsonl').read_text().splitlines() if line]
# Phase 3: HRA concepts with no male equivalent get their own text (equivalents reuse the male node's).
atlas_ids = {r['id'] for r in records}
hra_defs = ROOT / 'graph/defs.hra.jsonl'
if hra_defs.exists():
    records += [r for r in (json.loads(l) for l in hra_defs.read_text().splitlines() if l) if not r['equivalent'] and r['id'] not in atlas_ids]
counts, written = Counter(), set()
for rec in records:
    gid, cid = rec['id'], rec['conceptId']
    folder = CONTENT / gid.replace(':', '_')
    if (folder / 'tier1.md').exists():
        counts['curated tier1.md (left untouched)'] += 1
        continue
    fma, ub, nc = rec['fma'], rec['uberon'], rec['ncit']
    fma_iri = 'http://purl.org/sig/ont/fma/fma' + cid[3:] if cid.startswith('FMA') else None
    if nc and nc.get('definition'):
        text, kind = sentence(nc['definition']), 'ncit'
        source = {'kind': 'ncit', 'name': 'NCI Thesaurus', 'term': nc['id'], 'url': ols_link('ncit', nc['iri']), 'license': 'CC BY 4.0'}
        attribution = f'Definition from the NCI Thesaurus (NCIt {version("ncit")}), concept {nc["id"][5:]}, National Cancer Institute. CC BY 4.0.'
    elif ub and ub.get('definition') and not ub.get('definitionCitesWikipedia'):
        text, kind = sentence(ub['definition']), 'uberon'
        source = {'kind': 'uberon', 'name': 'Uberon', 'term': ub['id'], 'url': ols_link('uberon', ub['iri']), 'license': 'CC BY 3.0'}
        attribution = f'Definition from Uberon ({version("uberon")}), {ub["id"]}. CC BY 3.0.'
    elif fma and fma.get('definition'):
        text, kind = sentence(fma['definition']), 'fma'
        source = {'kind': 'fma', 'name': 'Foundational Model of Anatomy', 'term': gid, 'url': ols_link('fma', fma_iri), 'license': 'CC BY 3.0'}
        attribution = f'Definition from the Foundational Model of Anatomy (FMA {version("fma")}), {gid}, University of Washington Structural Informatics Group. CC BY 3.0.'
    else:  # no definition: the fact card stands alone
        counts['no definition (fact card only)'] += 1
        continue
    front = {
        'id': gid, 'tier': 1, 'status': 'auto', 'source': source,
        'sources': [{'title': source['name'] + (f' {source["term"]}' if source['term'] else ''), 'url': source['url'], 'license': source['license']}],
        'license': source['license'], 'attribution': attribution, 'generated_by': 'pipeline/07-tier1.py',
        'reviewer': None, 'reviewed_on': None,
    }
    folder.mkdir(parents=True, exist_ok=True)
    body = '---\n' + ''.join(f'{k}: {json.dumps(v, ensure_ascii=False)}\n' for k, v in front.items()) + '---\n' + text + '\n'
    path = folder / 'tier1.auto.md'
    if not path.exists() or path.read_text() != body:
        path.write_text(body)
    written.add(folder.name)
    counts[kind] += 1

# Phase 4: cell types (Cell Ontology) and organelles (Gene Ontology): their definition, unless it cites Wikipedia.
def write_auto(gid, text, kind, source, attribution):
    folder = CONTENT / gid.replace(':', '_')
    if (folder / 'tier1.md').exists():
        counts['curated tier1.md (left untouched)'] += 1
        return
    front = {'id': gid, 'tier': 1, 'status': 'auto', 'source': source,
             'sources': [{'title': source['name'] + (f' {source["term"]}' if source['term'] else ''), 'url': source['url'], 'license': source['license']}],
             'license': source['license'], 'attribution': attribution, 'generated_by': 'pipeline/07-tier1.py', 'reviewer': None, 'reviewed_on': None}
    folder.mkdir(parents=True, exist_ok=True)
    body = '---\n' + ''.join(f'{k}: {json.dumps(v, ensure_ascii=False)}\n' for k, v in front.items()) + '---\n' + text + '\n'
    path = folder / 'tier1.auto.md'
    if not path.exists() or path.read_text() != body:
        path.write_text(body)
    written.add(folder.name)
    counts[kind] += 1

asctb = [json.loads(l) for l in (ROOT / 'graph/asctb.jsonl').read_text().splitlines() if l] if (ROOT / 'graph/asctb.jsonl').exists() else []
cell_defs = {json.loads(l)['id']: json.loads(l) for l in (ROOT / 'graph/defs.cells.jsonl').read_text().splitlines() if l} if (ROOT / 'graph/defs.cells.jsonl').exists() else {}
placed = {cid for row in asctb for cid, _ in row['cellTypes']}
for cid in sorted(placed | ({'CL:0000000'} & set(cell_defs))):
    d = cell_defs.get(cid)
    if d and d.get('definition') and not d.get('definitionCitesWikipedia'):
        write_auto(cid, sentence(d['definition']), 'cl',
                   {'kind': 'cl', 'name': 'Cell Ontology', 'term': cid, 'url': ols_link('cl', d['iri']), 'license': 'CC BY 4.0'},
                   f'Definition from the Cell Ontology (CL {version("cl")}), {cid}. CC BY 4.0.')
    else:  # no usable definition: the fact card's "Found in" row says where it is
        counts['no definition (fact card only)'] += 1
# Cell types added from Cell Ontology (pipeline/maps/extra-cell-types.json): their definition, when it can be used.
for x in json.loads((ROOT / 'pipeline/maps/extra-cell-types.json').read_text())['cells']:
    cid, d = x['cl'], cell_defs.get(x['cl'])
    if d and d.get('definition') and not d.get('definitionCitesWikipedia'):
        write_auto(cid, sentence(d['definition']), 'cl', {'kind': 'cl', 'name': 'Cell Ontology', 'term': cid, 'url': ols_link('cl', d['iri']), 'license': 'CC BY 4.0'},
                   f'Definition from the Cell Ontology (CL {version("cl")}), {cid}. CC BY 4.0.')
    else:
        counts['no definition (fact card only)'] += 1
go_file = ROOT / 'graph/defs.go.jsonl'
for line in go_file.read_text().splitlines() if go_file.exists() else []:
    d = json.loads(line)
    if d.get('definition') and not d.get('definitionCitesWikipedia'):
        write_auto(d['id'], sentence(d['definition']), 'go',
                   {'kind': 'go', 'name': 'Gene Ontology', 'term': d['id'], 'url': ols_link('go', d['iri']), 'license': 'CC BY 4.0'},
                   f'Definition from the Gene Ontology (GO {version("go")}), {d["id"]}. CC BY 4.0.')

for stale in CONTENT.glob('*/tier1.auto.md'):
    if stale.parent.name not in written:
        stale.unlink()
        counts['stale auto removed'] += 1
print(json.dumps(dict(counts), indent=1))
