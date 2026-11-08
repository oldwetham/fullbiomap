"""Step 14: neuron and glia reconstructions from NeuroMorpho.Org (CC BY 4.0).

Usage: python3 -I pipeline/14-neuromorpho.py

pipeline/maps/neuromorpho.json lists match groups (a NeuroMorpho query, the species to try in order, and the class
shown in captions) and which Bio Map cell types use each group: as their own type ("type") or as a representative of
their class ("class": "a representative ... neuron, not this subtype specifically"). For each group this step picks one
reconstruction, or uses the one the map pins: the first species in order with a match; among its first 200 matches
by NeuroMorpho ID, full 3D tracings with a soma (and an axon where the group needs one), complete before moderate,
of moderate size; then the lowest ID. Picks are written to reports/neuromorpho.md for review and pinned in the map.

NeuroMorpho.Org's terms (https://neuromorpho.org/useterm.jsp): CC BY 4.0; cite the original paper(s), "NeuroMorpho.Org
(RRID:SCR_002145)" and Tecuatl, Ljungquist & Ascoli (2024); scripts may use only the API and direct .swc file URLs,
with a named User-Agent. pipeline/_http.py names, throttles and caches every request. The paper's authors and title
come from PubMed (NCBI E-utilities).

Outputs: data/raw/neuromorpho/<release>/<archive>/<name>.CNG.swc, graph/neuromorpho.json, reports/neuromorpho.md.
"""
import json
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _http import NotFound, get_file, get_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
MAP = json.loads((ROOT / 'pipeline/maps/neuromorpho.json').read_text())
API = 'https://neuromorpho.org/api'
RELEASE = MAP['release']
SPECIES = ['human', 'monkey', 'mouse', 'rat']
CITATION = 'Tecuatl C, Ljungquist B, Ascoli GA (2024). Accelerating the continuous community sharing of digital neuromorphology data. FASEB BioAdvances 6(7):207-221. doi:10.1096/fba.2024-00048'


def select(filters, species, size=200):
    """NeuroMorpho matches for field:value filters (all must hold) in one species, lowest IDs first. The API takes a
    quoted phrase only in q; filter queries (fq) need their spaces and brackets escaped instead."""
    esc = lambda v: ''.join('\\' + ch if ch in ' ()/:-' else ch for ch in v)
    (k0, v0), rest = filters[0], filters[1:]
    params = [('q', f'{k0}:"{v0}"' if ' ' in v0 else f'{k0}:{v0}')] + [('fq', f'{k}:{esc(v)}') for k, v in rest] + [('fq', f'species:{species}')]
    url = f'{API}/neuron/select?' + urllib.parse.urlencode(params + [('size', str(size)), ('sort', 'neuron_id,asc')])
    try:
        d = get_json(url)
    except NotFound:
        return [], 0
    return (d.get('_embedded') or {}).get('neuronResources') or [], (d.get('page') or {}).get('totalElements', 0)


def parts(n):
    """The traced parts, from NeuroMorpho's domain field ("Dendrites, Soma, No Axon" has Dendrites and Soma)."""
    return {t.strip() for t in (n.get('domain') or '').split(',') if t.strip() and not t.strip().startswith('No ')}


def tier(n, need):
    """0: every needed part, 3D; 1: every needed part, 2D; 2: every part but the soma (the model draws one); None: unusable.
    Untyped "Neurites" count as dendrites or axon; glial "Processes" may be traced as dendrites or neurites."""
    have, three_d = parts(n), '3D' in (n.get('attributes') or '')
    if 'Neurites' in have:
        have |= {'Dendrites', 'Axon', 'Processes'}
    if 'Dendrites' in have:
        have |= {'Processes'}
    if set(need) <= have:
        return 0 if three_d else 1
    if set(need) - {'Soma'} <= have and three_d:
        return 2
    return None


def integrity(n):
    p = (n.get('physical_Integrity') or '').lower()
    return 0 if 'complete' in p and 'incomplete' not in p.split('complete')[0] else 1 if 'moderate' in p else 2


def morphometry(n):
    return get_json(f"{API}/morphometry/id/{n['neuron_id']}")


def pick(group):
    if group.get('pin'):
        n = get_json(f"{API}/neuron/name/{urllib.parse.quote(group['pin'])}")
        return n, morphometry(n), None
    filters = [tuple(f) for f in group['query']]
    need = group.get('parts') or (['Soma', 'Processes'] if group.get('glia') else ['Soma', 'Dendrites'])
    found_by_species, tried = {}, []
    for sp in group.get('species', SPECIES):
        found, total = select(filters, sp)
        tried.append(f'{sp} {total}')
        found_by_species[sp] = found
    # Species order wins (human first) among tracings with every needed part (3D, then 2D); only if no species has
    # one does a tracing without a soma qualify. Then complete before moderate, moderate size, lowest ID.
    for allowed in ({0, 1}, {2}):
        for sp, found in found_by_species.items():
            ok = sorted((n for n in found if tier(n, need) in allowed), key=lambda n: (tier(n, need), integrity(n), n['neuron_id']))
            for n in ok[:12]:
                m = morphometry(n)
                if 100 <= (m.get('length') or 0) <= 150000 and (m.get('n_bifs') or 0) <= 2500:  # step 13 resamples big ones
                    return n, m, tried
    return None, None, tried


def paper(n):
    pmids = [p for p in (n.get('reference_pmid') or []) if str(p).isdigit()]
    if not pmids:
        doi = (n.get('reference_doi') or [None])[0]
        return {'citation': f'Original publication: doi:{doi}' if doi else 'Original publication: see the NeuroMorpho.Org record', 'doi': doi, 'pmid': None}
    d = get_json(f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={pmids[0]}')
    r = d['result'][pmids[0]]
    authors = [a['name'] for a in r.get('authors', []) if a.get('authtype') == 'Author']
    who = authors[0] + (' et al.' if len(authors) > 2 else f' and {authors[1]}' if len(authors) == 2 else '') if authors else ''
    doi = next((i['value'] for i in r.get('articleids', []) if i.get('idtype') == 'doi'), (n.get('reference_doi') or [None])[0])
    year = (r.get('pubdate') or '')[:4]
    return {'citation': f"{who} ({year}). {r.get('title', '').rstrip('.')}. {r.get('source', '')}." + (f' doi:{doi}' if doi else ''), 'doi': doi, 'pmid': pmids[0]}


groups, report = {}, ['# NeuroMorpho.Org reconstructions', '', f'Generated by `pipeline/14-neuromorpho.py` (NeuroMorpho.Org release {RELEASE}, CC BY 4.0).', '',
                       '| Group | Class shown | Species tried (matches) | NeuroMorpho ID | Neuron | Species | Region | Traced | Size (µm) | Paper |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
for gid, g in MAP['groups'].items():
    n, m, tried = pick(g)
    if not n:
        report.append(f"| {gid} | {g['class']} | {', '.join(tried or [])} | none | | | | | | |")
        continue
    archive = n['archive']
    swc = get_file(f"https://neuromorpho.org/dableFiles/{urllib.parse.quote(archive.lower())}/CNG%20version/{urllib.parse.quote(n['neuron_name'])}.CNG.swc",
                   ROOT / 'data/raw/neuromorpho' / RELEASE / archive.lower() / f"{n['neuron_name']}.CNG.swc")
    ref = paper(n)
    groups[gid] = {
        'class': g['class'], 'glia': g.get('glia', False), 'nmoId': f"NMO_{n['neuron_id']:05d}", 'neuronId': n['neuron_id'], 'neuronName': n['neuron_name'],
        'archive': archive, 'species': n.get('species'), 'drawnSoma': 'Soma' not in parts(n), 'region': n.get('brain_region') or [], 'cellType': n.get('cell_type') or [],
        'domain': n.get('domain'), 'integrity': n.get('physical_Integrity'), 'swc': str(swc.relative_to(ROOT)),
        'size': {'width': m.get('width'), 'height': m.get('height'), 'depth': m.get('depth'), 'length': m.get('length')},
        'page': f"https://neuromorpho.org/neuron_info.jsp?neuron_name={urllib.parse.quote(n['neuron_name'])}",
        'paper': ref, 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'attribution': f"Reconstruction {n['neuron_name']} (NeuroMorpho.Org ID NMO_{n['neuron_id']:05d}, {archive} archive) from {ref['citation']} "
                       f"Via NeuroMorpho.Org (RRID:SCR_002145; {CITATION}). CC BY 4.0.",
    }
    w = max(m.get('width') or 0, m.get('height') or 0, m.get('depth') or 0)
    report.append(f"| {gid} | {g['class']} | {', '.join(tried) if tried else 'pinned'} | NMO_{n['neuron_id']:05d} | {n['neuron_name']} | {n.get('species')} | {', '.join(n.get('brain_region') or [])} | {n.get('domain')}; {n.get('physical_Integrity')} | {round(w)} | {ref['citation'][:90]} |")
cells = {}
for cl, c in MAP['cells'].items():
    if c['group'] in groups:
        cells[cl] = {'group': c['group'], 'level': c['level']}
(ROOT / 'graph/neuromorpho.json').write_text(json.dumps({'release': RELEASE, 'citation': CITATION, 'rrid': 'RRID:SCR_002145', 'groups': groups, 'cells': cells}, indent=1, ensure_ascii=False) + '\n')
unmatched = [cl for cl, c in MAP['cells'].items() if c['group'] not in groups]
report += ['', f'- Cell types with a reconstruction: {len(cells)} ({sum(c["level"] == "type" for c in cells.values())} by type, {sum(c["level"] == "class" for c in cells.values())} as class representatives)',
           f'- Distinct reconstructions: {len(groups)}', f'- Cell types whose group found none (they keep their family shape): {len(unmatched)} {", ".join(unmatched)}']
(ROOT / 'reports/neuromorpho.md').write_text('\n'.join(report) + '\n')
print('\n'.join(report[-3:]))
