"""Step 01: build the two inputs scripts/convert-anatomy.py expects from the raw
BodyParts3D 4.0 tables and OBJ headers.

Usage: python3 -I pipeline/01-build-maps.py

Inputs (from pipeline/00-fetch-bodyparts3d.sh):
  data/raw/bp3d/{isa,partof}_{parts_list_e,element_parts,inclusion_relation_list}.txt
  data/raw/bp3d/obj/FJ*.obj (headers only)
  pipeline/maps/system-rules.json, pipeline/maps/overrides.json
Outputs:
  data/build/concepts.json  {elements: [{id, name, conceptId}], concepts: [{id, name, elements}]}
  data/build/systems.json   {systems: {partId: system}}
  reports/build-maps.md     counts, rule coverage, and differences from the shipped atlas.json

Rules, matching the shipped Human Atlas manifest:
  - Concepts are the union of the IS-A and PART-OF tables, IS-A order first.
    Names prefer the IS-A English name. Element lists are the sorted union of both tables.
  - Meshes are every FJ*.obj, sorted by id. A mesh's concept and name come from its OBJ
    header; if the header is blank, from the smallest IS-A concept containing it (ties must
    be resolved in overrides.json).
  - Systems come from the first matching rule in system-rules.json, then overrides.json.
"""
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/bp3d'
BUILD = ROOT / 'data/build'
MAPS = ROOT / 'pipeline/maps'
SHIPPED = ROOT / 'public/models/atlas.json'
REPORT = ROOT / 'reports/build-maps.md'
SYSTEMS = ['skeletal', 'muscular', 'nervous', 'cardiac', 'arterial', 'venous', 'respiratory', 'digestive',
           'urinary', 'reproductive', 'endocrine', 'lymphatic', 'integumentary', 'sensory', 'connective']
HEADER = re.compile(r'# ([^:]+?) : ?(.*)')


def table(name):
    with open(RAW / name, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def obj_header(path):
    out = {}
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            if not line.startswith('#'):
                break
            m = HEADER.match(line.rstrip('\r\n'))
            if m:
                out[m.group(1).strip()] = m.group(2).strip()
    return out


def fail(msg):
    sys.exit(f'01-build-maps: {msg}')


# Concepts --------------------------------------------------------------------
names, order, elements = {}, [], defaultdict(set)
for kind in ('isa', 'partof'):
    for r in table(f'{kind}_parts_list_e.txt'):
        cid = r['concept id']
        if cid not in names:
            names[cid] = r['en']
            order.append(cid)
    for r in table(f'{kind}_element_parts.txt'):
        elements[r['concept id']].add(r['element file id'])
missing = [c for c in order if not elements[c]]
if missing:
    fail(f'{len(missing)} concepts have no elements, e.g. {missing[:3]}')
concepts = [{'id': c, 'name': names[c], 'elements': sorted(elements[c])} for c in order]

isa_elements = defaultdict(set)
for r in table('isa_element_parts.txt'):
    isa_elements[r['concept id']].add(r['element file id'])
isa_by_element = defaultdict(set)
for c, els in isa_elements.items():
    for e in els:
        isa_by_element[e].add(c)

# Parts -----------------------------------------------------------------------
overrides = json.loads((MAPS / 'overrides.json').read_text())
meshes = sorted(p.stem for p in (RAW / 'obj').glob('FJ*.obj'))
if not meshes:
    fail(f'no OBJ meshes in {RAW / "obj"}; run pipeline/00-fetch-bodyparts3d.sh')
parts, from_fallback = [], []
for pid in meshes:
    h = obj_header(RAW / 'obj' / f'{pid}.obj')
    cid, name = h.get('Concept ID', ''), h.get('English name', '')
    if pid in overrides['parts']:
        cid = overrides['parts'][pid]['conceptId']
        name = name or names[cid]
    elif not cid:
        cands = isa_by_element.get(pid)
        if not cands:
            fail(f'{pid}: blank header and no IS-A concept')
        smallest = min(len(isa_elements[c]) for c in cands)
        best = sorted(c for c in cands if len(isa_elements[c]) == smallest)
        if len(best) > 1:
            fail(f'{pid}: blank header and IS-A tie {best}; add it to overrides.json "parts"')
        cid = best[0]
        name = name or names[cid]
        from_fallback.append(pid)
    if cid not in names:
        fail(f'{pid}: concept {cid} is not in the concept tables')
    parts.append({'id': pid, 'name': name or names[cid], 'conceptId': cid})

# Systems ---------------------------------------------------------------------
parents = defaultdict(set)
for kind in ('isa', 'partof'):
    for r in table(f'{kind}_inclusion_relation_list.txt'):
        parents[r['child id']].add(r['parent id'])
ancestor_cache = {}


def ancestors(c):
    if c not in ancestor_cache:
        seen, stack = set(), [c]
        while stack:
            for q in parents[stack.pop()]:
                if q not in seen:
                    seen.add(q)
                    stack.append(q)
        ancestor_cache[c] = seen
    return ancestor_cache[c]


containing = defaultdict(set)
for c in concepts:
    for e in c['elements']:
        containing[e].add(c['id'])

by_name = defaultdict(list)
for c, n in names.items():
    by_name[n].append(c)
rules = []
for rule in json.loads((MAPS / 'system-rules.json').read_text())['rules']:
    if rule['system'] not in SYSTEMS:
        fail(f'unknown system {rule["system"]!r} in system-rules.json')
    roots = set()
    for r in rule['roots']:
        if r.startswith('FMA'):
            if r not in names:
                fail(f'rule root {r} is not a known concept')
            roots.add(r)
        elif r in by_name:
            roots.update(by_name[r])
        else:
            fail(f'rule root {r!r} matches no concept name')
    rules.append((rule['system'], roots))

systems, how, unreached = {}, Counter(), []
for p in parts:
    pid = p['id']
    lineage = {p['conceptId']} | ancestors(p['conceptId']) | containing[pid]
    for c in list(lineage):
        lineage |= ancestors(c)
    rule_system = next((s for s, roots in rules if lineage & roots), None)
    if pid in overrides['systems']:
        s = overrides['systems'][pid]['system']
        if s not in SYSTEMS:
            fail(f'{pid}: unknown system {s!r} in overrides.json')
        systems[pid] = s
        how['override' if rule_system is None else 'override (replaces rule)'] += 1
    elif rule_system:
        systems[pid] = rule_system
        how['rule'] += 1
    else:
        unreached.append(pid)
if unreached:
    fail(f'{len(unreached)} meshes match no system rule; add them to overrides.json "systems": {unreached[:10]}')
stale = sorted(set(overrides['systems']) - set(systems))
if stale:
    fail(f'overrides.json lists unknown meshes {stale}')

# Write -----------------------------------------------------------------------
BUILD.mkdir(parents=True, exist_ok=True)
(BUILD / 'concepts.json').write_text(json.dumps({'elements': parts, 'concepts': concepts}, indent=1) + '\n')
(BUILD / 'systems.json').write_text(json.dumps({'systems': systems}, indent=1) + '\n')

# Report ----------------------------------------------------------------------
lines = ['# Build maps report', '', 'Generated by `pipeline/01-build-maps.py`.', '',
         f'- Parts (meshes): {len(parts)}', f'- Concepts: {len(concepts)}',
         f'- Concept from blank-header fallback: {len(from_fallback)}; from overrides: {len(overrides["parts"])}',
         f'- Systems by rule: {how["rule"]}; by override: {how["override"]}; override replacing a rule: {how["override (replaces rule)"]}',
         '', '| System | Parts |', '| --- | --- |']
lines += [f'| {s} | {n} |' for s, n in sorted(Counter(systems.values()).items(), key=lambda x: -x[1])]
summary = {'parts': len(parts), 'concepts': len(concepts)}
if SHIPPED.exists():
    shipped = json.loads(SHIPPED.read_text())
    sp = {p['id']: p for p in shipped['parts']}
    sc = {c['id']: c for c in shipped['concepts']}
    same_concepts = [c['id'] for c in concepts] == list(sc) and all(sc[c['id']]['name'] == c['name'] and sc[c['id']]['elements'] == c['elements'] for c in concepts)
    same_parts = [p['id'] for p in parts] == list(sp) and all(sp[p['id']]['conceptId'] == p['conceptId'] and sp[p['id']]['name'] == p['name'] for p in parts)
    diffs = [p for p in parts if sp.get(p['id'], {}).get('system') != systems[p['id']]]
    summary.update({'shippedParts': len(sp), 'shippedConcepts': len(sc), 'conceptsIdentical': same_concepts,
                    'partNamesAndConceptsIdentical': same_parts, 'systemDifferences': len(diffs)})
    lines += ['', '## Compared with shipped public/models/atlas.json', '',
              f'- Parts: {len(parts)} built vs {len(sp)} shipped',
              f'- Concepts: {len(concepts)} built vs {len(sc)} shipped',
              f'- Concept ids, names and element lists identical: {"yes" if same_concepts else "no"}',
              f'- Part ids, names and concept ids identical: {"yes" if same_parts else "no"}',
              f'- System assignments that differ: {len(diffs)}', '']
    if diffs:
        lines += ['The shipped map was keyword-based (for example "ventricle" → cardiac, "retina" → sensory, "venous" → venous). '
                  'These parts now follow the FMA hierarchy rules in `pipeline/maps/system-rules.json`.', '',
                  '| Part | Name | Shipped | Built |', '| --- | --- | --- | --- |']
        lines += [f'| {p["id"]} | {p["name"]} | {sp[p["id"]]["system"]} | {systems[p["id"]]} |'
                  for p in sorted(diffs, key=lambda p: (sp[p['id']]['system'], systems[p['id']], p['name']))]
REPORT.parent.mkdir(exist_ok=True)
REPORT.write_text('\n'.join(lines) + '\n')
print(json.dumps(summary, indent=2))
