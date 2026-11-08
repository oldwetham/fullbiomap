"""Step 07: tier-1 auto text for every atlas concept, with no Wikipedia text anywhere.

Usage: python3 -I pipeline/07-tier1.py

Source priority (first available wins):
  1. NCIt definition (through the concept's Uberon xref)
  2. Uberon definition, unless its provenance cites Wikipedia
  3. FMA definition
  4. A sentence generated from the FMA hierarchy: "X is a kind of Y and part of the Z."
     (falls back to the BodyParts3D IS-A/PART-OF tables for ids missing from OLS4 FMA)

Writes content/<FMA_n>/tier1.auto.md (status "auto") with the source name, a link to the
source term, its license and attribution. A curated content/<FMA_n>/tier1.md is never
touched, and no auto file is written beside it. Stale auto files for concepts no longer in
the atlas are removed.
"""
import csv
import json
import re
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content'
SOURCES = json.loads((ROOT / 'graph/sources.json').read_text())
RAW = ROOT / 'data/raw/bp3d'


def ols_link(ontology, iri):
    return f'https://www.ebi.ac.uk/ols4/ontologies/{ontology}/classes/{urllib.parse.quote(urllib.parse.quote(iri, safe=""), safe="")}'


def sentence(text):
    text = re.sub(r'\s+([.,;:])', r'\1', re.sub(r'\s+', ' ', text)).strip()
    return text if text.endswith(('.', '!', '?')) else text + '.'


def lower_first(label):
    """'Organ with cavitated organ parts' -> 'organ with ...'; keeps eponyms ('Bowman's') and acronyms."""
    if len(label) > 1 and label[0].isupper() and label[1].islower() and not re.match(r"^[A-Z][a-z]+'s\b", label):
        return label[0].lower() + label[1:]
    return label


def upper_first(label):
    return label[:1].upper() + label[1:]


def version(o):
    """'5.1.0' for FMA, '26.02d' for NCIt; Uberon has no version string, so use its release date."""
    s = SOURCES[o]
    if s.get('version'):
        return s['version']
    m = re.search(r'/releases/([^/]+)/', s.get('versionIri') or '')
    return f'release {m.group(1)}' if m else 'current release'


# BodyParts3D hierarchy, only for FMA ids that OLS4 no longer has.
bp3d_names, bp3d_isa, bp3d_part = {}, defaultdict(list), defaultdict(list)
if RAW.exists():
    for kind, target in (('isa', bp3d_isa), ('partof', bp3d_part)):
        with open(RAW / f'{kind}_parts_list_e.txt', encoding='utf-8', newline='') as f:
            for r in csv.DictReader(f, delimiter='\t'):
                bp3d_names.setdefault(r['concept id'], r['en'])
        with open(RAW / f'{kind}_inclusion_relation_list.txt', encoding='utf-8', newline='') as f:
            for r in csv.DictReader(f, delimiter='\t'):
                target[r['child id']].append(r['parent id'])

records = [json.loads(line) for line in (ROOT / 'graph/defs.jsonl').read_text().splitlines() if line]
# Phase 3: HRA concepts with no male equivalent get their own text (equivalents reuse the male node's).
atlas_ids = {r['id'] for r in records}
hra_defs = ROOT / 'graph/defs.hra.jsonl'
if hra_defs.exists():
    records += [r for r in (json.loads(l) for l in hra_defs.read_text().splitlines() if l) if not r['equivalent'] and r['id'] not in atlas_ids]
# HRA node hierarchy (step 05): labels, and the organ (model root) each concept sits in.
hra_label, hra_objects, hra_models = {}, defaultdict(set), {}
if (ROOT / 'graph/hra-models.json').exists():
    hra_models = json.loads((ROOT / 'graph/hra-models.json').read_text())['models']
    for line in (ROOT / 'graph/hra-tree.jsonl').read_text().splitlines():
        if line:
            e = json.loads(line)
            hra_label.setdefault(e['from'], e['fromLabel'])
            hra_label.setdefault(e['to'], e['toLabel'])
            hra_objects[e['from']].add(e['object'])
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
    elif not fma and gid.startswith('UBERON:'):
        name = upper_first((ub or {}).get('label') or hra_label.get(gid, gid))
        objects = sorted(hra_objects.get(gid, []), key=lambda o: (hra_models[o]['kind'] != 'organ', o))
        obj = objects[0] if objects else None
        root = hra_models[obj]['rootConceptId'] if obj else None
        root_id = root and (root[:6] + ':' + root[6:] if root.startswith('UBERON') else 'FMA:' + root[3:])
        whole = hra_label.get(root_id)
        if obj and whole and root_id != gid:
            text = f'{name} is part of the {lower_first(whole)}.'
        else:
            text = f'{name} is a structure modeled in the Human Reference Atlas 3D reference library.'
        kind, ref = 'hierarchy-hra', f'https://lod.humanatlas.io/ref-organ/{obj}' if obj else 'https://humanatlas.io/3d-reference-library'
        source = {'kind': kind, 'name': 'Generated from the HRA 3D reference organ hierarchy', 'term': gid, 'url': ref, 'license': 'CC BY 4.0'}
        attribution = (f'Sentence generated by Bio Map from the node hierarchy of the Human Reference Atlas 3D reference object '
                       f'{obj or "library"}, CC BY 4.0. Sentence CC BY 4.0.')
    else:
        if fma:
            name = fma['label'] or bp3d_names.get(cid, cid)
            kinds = [p['label'] for p in fma['isA'] if p['label']]
            wholes = [p['label'] for p in fma['partOf'] if p['label']]
            basis, kind = f'FMA {version("fma")}', 'hierarchy'
        else:
            name = bp3d_names.get(cid, cid)
            kinds = [bp3d_names[p] for p in bp3d_isa.get(cid, []) if p in bp3d_names]
            wholes = [bp3d_names[p] for p in bp3d_part.get(cid, []) if p in bp3d_names]
            basis, kind = 'BodyParts3D 4.0 (FMA 3.0)', 'hierarchy-bp3d'
        if not kinds and not wholes:
            counts['no text possible'] += 1
            continue
        if kinds and wholes:
            predicate = f'is a kind of {lower_first(kinds[0])} and part of the {lower_first(wholes[0])}'
        elif kinds:
            predicate = f'is a kind of {lower_first(kinds[0])}'
        else:
            predicate = f'is part of the {lower_first(wholes[0])}'
        text = f'{upper_first(name)} {predicate}.'
        source = {'kind': kind, 'name': f'Generated from the {basis} hierarchy', 'term': gid, 'url': ols_link('fma', fma_iri), 'license': 'CC BY 4.0'}
        attribution = (f'Sentence generated by Bio Map from is_a and part_of relations in {basis}, {gid}. '
                       'FMA © University of Washington Structural Informatics Group, CC BY 3.0. Sentence CC BY 4.0.')
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

# Phase 4: cell types (Cell Ontology) and organelles (Gene Ontology). Definition first (skipped if it
# cites Wikipedia); a cell type without one gets a sentence from its ASCT+B rows.
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
release = json.loads((ROOT / 'pipeline/maps/hra-release.json').read_text())
where, table_of, label_of = defaultdict(Counter), defaultdict(Counter), {}
for row in asctb:
    for cid, label in row['cellTypes']:
        label_of.setdefault(cid, label)
        where[cid][(row['chain'][-1][1], row['chain'][0][1])] += 1
        table_of[cid][row['table']] += 1
for cid in sorted(set(where) | ({'CL:0000000'} & set(cell_defs))):
    d = cell_defs.get(cid)
    name = upper_first((d or {}).get('label') or label_of.get(cid, cid))
    if d and d.get('definition') and not d.get('definitionCitesWikipedia'):
        write_auto(cid, sentence(d['definition']), 'cl',
                   {'kind': 'cl', 'name': 'Cell Ontology', 'term': cid, 'url': ols_link('cl', d['iri']), 'license': 'CC BY 4.0'},
                   f'Definition from the Cell Ontology (CL {version("cl")}), {cid}. CC BY 4.0.')
    else:
        (structure, organ), _ = where[cid].most_common(1)[0]
        table = table_of[cid].most_common(1)[0][0]
        place = lower_first(structure) if structure.lower() == organ.lower() else f'{lower_first(structure)} of the {lower_first(organ)}'
        info = release['tables'][table]
        write_auto(cid, f'{name} is a cell type found in the {place}.', 'hierarchy-asctb',
                   {'kind': 'hierarchy-asctb', 'name': f'Generated from the HRA ASCT+B table for {table.replace("-", " ")}', 'term': cid, 'url': info['doi'], 'license': 'CC BY 4.0'},
                   f'Sentence generated by Bio Map from the HRA ASCT+B table "{table}" {info["version"]} ({info["doi"]}), CC BY 4.0. Sentence CC BY 4.0.')
# Cell types added from Cell Ontology (pipeline/maps/extra-cell-types.json): their definition, or, when it cannot be used,
# a sentence from their sourced placement.
for x in json.loads((ROOT / 'pipeline/maps/extra-cell-types.json').read_text())['cells']:
    cid, d = x['cl'], cell_defs.get(x['cl'])
    name = upper_first((d or {}).get('label') or cid)
    if d and d.get('definition') and not d.get('definitionCitesWikipedia'):
        write_auto(cid, sentence(d['definition']), 'cl', {'kind': 'cl', 'name': 'Cell Ontology', 'term': cid, 'url': ols_link('cl', d['iri']), 'license': 'CC BY 4.0'},
                   f'Definition from the Cell Ontology (CL {version("cl")}), {cid}. CC BY 4.0.')
    else:
        src = x['source']
        write_auto(cid, f"{name} is a cell type found in the {x['place']}.", 'placement', {'kind': 'placement', 'name': src['name'], 'term': cid, 'url': src['url'], 'license': src['license']},
                   f"Sentence generated by Bio Map from {src['name']} ({src['url']}). Sentence CC BY 4.0.")
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
