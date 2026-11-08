// Step 11: merge atlas geometry, ontology facts (graph/defs.jsonl) and content/ text into
//   graph/nodes.jsonl      one node per atlas concept (spec schema; tier text by file path only)
//   graph/edges.jsonl      is_a / part_of edges whose endpoints are both nodes
//   public/content/<conceptId>.json   the per-node file the app reads (node + tier text)
//   public/content/index.json         ids that have a file
// Usage: node pipeline/11-build-graph.mjs
// Tier text: content/<FMA_n>/tier<k>.md (curated) wins over tier<k>.auto.md (pipeline drafts).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROFILES, shapeOf} from './_cell-families.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const jsonl = p => read(p).split('\n').filter(Boolean).map(l => JSON.parse(l));

// FMA classes used to set a node's scale from its is_a ancestors (first match wins).
const SCALE_ROOTS = [
  ['body', ['FMA:305853']],         // Human body (FMA:20394 Adult human body is_a it)
  ['system', ['FMA:7149']],         // Organ system
  ['organ', ['FMA:67498']],         // Organ
  ['tissue', ['FMA:9637']],         // Portion of tissue
];
// Everything else (organ parts, sets, spaces, body regions) is gross anatomy shown at organ scale.

// Front matter is `key: <JSON value>` per line (valid YAML), between --- fences.
export function readTier(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(': ');
    if (i < 0) throw new Error(`${file}: bad front matter line ${JSON.stringify(line)}`);
    meta[line.slice(0, i)] = JSON.parse(line.slice(i + 2));
  }
  return {meta, body: m[2].trim()};
}

function tierEntry(dir, n) {
  for (const name of [`tier${n}.md`, `tier${n}.auto.md`]) {
    const file = path.join(root, 'content', dir, name);
    if (!fs.existsSync(file)) continue;
    const {meta, body} = readTier(file);
    return {
      status: meta.status, file: `content/${dir}/${name}`, text: body,
      source: meta.source ?? null, sources: meta.sources ?? [], license: meta.license, attribution: meta.attribution,
      reviewer: meta.reviewer ?? null, reviewedOn: meta.reviewed_on ?? null,
    };
  }
  return {status: 'missing'};
}

const atlas = JSON.parse(read('public/models/atlas.json'));
const defs = new Map(jsonl('graph/defs.jsonl').map(d => [d.id, d]));
const partSystem = new Map(atlas.parts.map(p => [p.id, p.system]));
const upperFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
// The ladder's System crumb ignores vessels that run through a structure: the heart's 83 meshes include its
// coronary vessels, but it belongs under Cardiovascular, not Arteries. Vessels themselves keep their system.
const ladderSystemOf = counts => {
  const own = Object.entries(counts).filter(([k]) => k !== 'arterial' && k !== 'venous');
  return (own.length ? own : Object.entries(counts)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
};

const nodes = [];
for (const c of atlas.concepts) {
  const id = `FMA:${c.id.slice(3)}`, d = defs.get(id) ?? {}, fma = d.fma ?? null;
  const counts = {};
  for (const e of c.elements) counts[partSystem.get(e)] = (counts[partSystem.get(e)] ?? 0) + 1;
  const system = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const ancestors = fma?.ancestors ?? [];
  const ladderSystem = ladderSystemOf(counts);
  const scale = SCALE_ROOTS.find(([, roots]) => roots.some(r => r === id || ancestors.includes(r)))?.[0] ?? 'organ';
  const xrefs = {};
  if (d.uberon) xrefs.UBERON = d.uberon.id.slice(7);
  if (d.ncit) xrefs.NCIT = d.ncit.id.slice(5);
  if (fma?.ta98?.length) xrefs.TA98 = fma.ta98.length === 1 ? fma.ta98[0] : fma.ta98;
  const dir = id.replace(':', '_');
  const tiers = {tier1: tierEntry(dir, 1), tier2: tierEntry(dir, 2), tier3: tierEntry(dir, 3)};
  const sources = [];
  for (const t of Object.values(tiers)) for (const s of t.sources ?? []) if (!sources.some(x => x.url === s.url)) sources.push(s);
  nodes.push({
    id, conceptId: c.id, label: fma?.label ?? upperFirst(c.name), scale, system,
    synonyms: fma?.synonyms ?? [], xrefs,
    geometry: {male: c.elements},
    content: tiers, media: [], sources,
    zoom: {in: [], out: []},
    connections: [],
    ancestors,
    ladderSystem,
  });
}

// Phase 3: HRA structures (female body, organ interiors) ---------------------------------
// A concept that is a male FMA concept joins that node; a Uberon concept with exactly one male
// equivalent becomes an alias node that reuses its text and connections; anything else is a new node.
const exists = p => fs.existsSync(path.join(root, p));
const hraDefs = new Map(exists('graph/defs.hra.jsonl') ? jsonl('graph/defs.hra.jsonl').map(d => [d.id, d]) : []);
const hraModels = exists('graph/hra-models.json') ? JSON.parse(read('graph/hra-models.json')).models : {};
const hraTree = exists('graph/hra-tree.jsonl') ? jsonl('graph/hra-tree.jsonl') : [];
const graphId = cid => cid.startsWith('UBERON') ? `UBERON:${cid.slice(6)}` : `FMA:${cid.slice(3)}`;
const majority = counts => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
const maleByConcept = new Map(nodes.map(n => [n.conceptId, n]));
const hraConcepts = new Map();
for (const [object, m] of Object.entries(hraModels)) {
  const data = JSON.parse(read(`${m.archived ? 'archive/public' : 'public'}${m.manifest}`)), sys = new Map(data.parts.map(p => [p.id, p.system]));
  for (const c of data.concepts) {
    const e = hraConcepts.get(c.id) ?? {name: c.name, female: [], objects: [], systems: {}};
    if (m.kind === 'body') e.female.push(...c.elements);
    if (!e.objects.includes(object)) e.objects.push(object);
    for (const el of c.elements) e.systems[sys.get(el)] = (e.systems[sys.get(el)] ?? 0) + 1;
    hraConcepts.set(c.id, e);
  }
}
const aliases = [];
for (const [cid, e] of [...hraConcepts].sort((a, b) => a[0].localeCompare(b[0]))) {
  const same = maleByConcept.get(cid);
  if (same) {
    if (e.female.length) same.geometry.female = e.female;
    same.geometry.models = e.objects.sort();
    continue;
  }
  const id = graphId(cid), d = hraDefs.get(id) ?? {}, fma = d.fma ?? null, eq = d.equivalent ? maleByConcept.get(d.equivalent) : null;
  const ancestors = fma?.ancestors ?? eq?.ancestors ?? [];
  const xrefs = {};
  if (d.uberon) xrefs.UBERON = d.uberon.id.slice(7);
  if (d.ncit) xrefs.NCIT = d.ncit.id.slice(5);
  if (eq) xrefs.FMA = eq.id.slice(4);
  const content = eq ? eq.content : {tier1: tierEntry(id.replace(':', '_'), 1), tier2: tierEntry(id.replace(':', '_'), 2), tier3: tierEntry(id.replace(':', '_'), 3)};
  const sources = [];
  for (const t of Object.values(content)) for (const s of t.sources ?? []) if (!sources.some(x => x.url === s.url)) sources.push(s);
  const node = {
    id, conceptId: cid, label: upperFirst(d.uberon?.label ?? fma?.label ?? e.name),
    scale: SCALE_ROOTS.find(([, r]) => r.some(x => x === id || ancestors.includes(x)))?.[0] ?? 'organ',
    system: eq?.system ?? majority(e.systems), synonyms: fma?.synonyms ?? [], xrefs,
    geometry: {male: [], female: e.female, models: e.objects.sort()},
    content, media: [], sources, zoom: {in: [], out: []}, connections: [], ancestors,
    ladderSystem: eq?.ladderSystem ?? ladderSystemOf(e.systems),
    ...(eq ? {equivalent: eq.id} : {}),
  };
  nodes.push(node);
  if (eq) aliases.push([node, eq]);
}

const byId = new Map(nodes.map(n => [n.id, n]));
const edges = [];
for (const n of nodes) {
  const fma = defs.get(n.id)?.fma;
  if (!fma) continue;
  for (const p of fma.isA) if (byId.has(p.id)) edges.push({from: n.id, to: p.id, rel: 'is_a', source: 'FMA', evidence: 'rdfs:subClassOf'});
  for (const p of fma.partOf) if (byId.has(p.id)) edges.push({from: n.id, to: p.id, rel: 'part_of', source: 'FMA', evidence: p.rel});
}
const nodeOfHra = id => byId.get(id) ?? byId.get(maleByConcept.get(id.replace(':', ''))?.id);
for (const e of hraTree) {
  const a = nodeOfHra(e.from), b = nodeOfHra(e.to);
  if (a && b && a !== b) edges.push({from: a.id, to: b.id, rel: 'part_of', source: 'HRA', license: 'CC BY 4.0', evidence: `HRA ${e.object} node hierarchy`});
}
const seen = new Set();
const uniqueEdges = edges.filter(e => { const k = `${e.from}|${e.rel}|${e.to}`; if (seen.has(k)) return false; seen.add(k); return true; })
  .sort((a, b) => a.from.localeCompare(b.from) || a.rel.localeCompare(b.rel) || a.to.localeCompare(b.to));
for (const e of uniqueEdges) if (e.rel === 'part_of') { byId.get(e.from).zoom.out.push(e.to); byId.get(e.to).zoom.in.push(e.from); }

// Connections (Phase 2): FMA relations plus HRA VCCF vessel branching, merged per (from, rel, to).
export const CONNECTIONS = ['arterial_supply', 'venous_drainage', 'nerve_supply', 'lymphatic_drainage', 'branch_of',
  'tributary_of', 'attaches_to', 'articulates_with', 'continuous_with', 'located_in', 'component_of'];
const SYMMETRIC = new Set(['articulates_with', 'continuous_with']);
const SOURCE_INFO = {
  'FMA': {name: 'Foundational Model of Anatomy 5.1', license: 'CC BY 3.0'},
  'HRA VCCF': {name: 'HRA ASCT+B Blood Vasculature v1.10 (VCCF)', license: 'CC BY 4.0', url: 'https://doi.org/10.48539/HBM497.DSBZ.627'},
};
// When one end of a relation is not modeled in 3D, keep it as 'text': a non-selectable label
// (modeled: false) in the per-node file only, never a graph edge. Decided 2026-11-07 (Phase 2).
const UNMODELED = process.env.BIOMAP_UNMODELED ?? 'text';
const atlasName = new Map(atlas.concepts.map(c => [`FMA:${c.id.slice(3)}`, upperFirst(c.name)]));
const labelOf = new Map();
for (const d of defs.values()) for (const r of d.fma?.relations ?? []) if (r.label) labelOf.set(r.id, r.label);
const olsLink = id => `https://www.ebi.ac.uk/ols4/ontologies/fma/classes/${encodeURIComponent(encodeURIComponent(`http://purl.org/sig/ont/fma/fma${id.slice(4)}`))}`;
const merged = new Map();
// An FMA id with no node of its own may be an HRA node's single FMA cross-reference (FMA:18483 right
// uterine tube -> UBERON:0001302); use that node so the connection resolves.
const viaXref = new Map();
for (const [id, d] of hraDefs) if (d.fmaXrefs?.length === 1 && byId.has(id)) viaXref.set(`FMA:${d.fmaXrefs[0].slice(3)}`, id);
const nodeIdOf = id => byId.has(id) ? id : viaXref.get(id) ?? id;
for (const file of ['graph/edges.fma.jsonl', 'graph/edges.vccf.jsonl', 'graph/edges.hra-fma.jsonl']) {
  if (!fs.existsSync(path.join(root, file))) continue;
  for (const raw of jsonl(file)) {
    if (!CONNECTIONS.includes(raw.rel)) continue;
    for (const [id, label] of Object.entries(raw.labels ?? {})) if (label) labelOf.set(id, label);
    let [from, to] = [nodeIdOf(raw.from), nodeIdOf(raw.to)];
    if (from === to) continue;
    if (SYMMETRIC.has(raw.rel)) [from, to] = [from, to].sort();
    const e = {...raw, from, to};
    const key = `${e.from}|${e.rel}|${e.to}`, m = merged.get(key) ?? {from: e.from, rel: e.rel, to: e.to, sources: []};
    if (!m.sources.some(x => x.source === e.source)) m.sources.push({source: e.source, evidence: e.evidence});
    merged.set(key, m);
  }
}
const entrySources = (m, other) => m.sources.map(x => ({name: SOURCE_INFO[x.source].name, license: SOURCE_INFO[x.source].license, url: SOURCE_INFO[x.source].url ?? olsLink(other)}));
const connectionEdges = [];
for (const m of [...merged.values()].sort((a, b) => a.from.localeCompare(b.from) || a.rel.localeCompare(b.rel) || a.to.localeCompare(b.to))) {
  const fromNode = byId.get(m.from), toNode = byId.get(m.to);
  if (fromNode && toNode) {
    const sources = m.sources.map(x => x.source);
    connectionEdges.push({from: m.from, to: m.to, rel: m.rel, source: sources.join('; '),
      license: [...new Set(sources.map(x => SOURCE_INFO[x].license))].join('; '), evidence: m.sources.map(x => x.evidence).join(' | ')});
    fromNode.connections.push({rel: m.rel, dir: 'out', id: m.to, conceptId: toNode.conceptId, label: atlasName.get(m.to) ?? toNode.label, modeled: true, sources: entrySources(m, m.to)});
    toNode.connections.push({rel: m.rel, dir: SYMMETRIC.has(m.rel) ? 'out' : 'in', id: m.from, conceptId: fromNode.conceptId, label: atlasName.get(m.from) ?? fromNode.label, modeled: true, sources: entrySources(m, m.from)});
  } else if ((fromNode || toNode) && UNMODELED === 'text') {
    const [node, other, dir] = fromNode ? [fromNode, m.to, 'out'] : [toNode, m.from, SYMMETRIC.has(m.rel) ? 'out' : 'in'];
    node.connections.push({rel: m.rel, dir, id: other, conceptId: null, label: labelOf.get(other) ?? other, modeled: false, sources: entrySources(m, other)});
  }
}
const relOrder = r => CONNECTIONS.indexOf(r);
for (const n of nodes) n.connections.sort((a, b) => relOrder(a.rel) - relOrder(b.rel) || a.dir.localeCompare(b.dir) || Number(b.modeled) - Number(a.modeled) || a.label.localeCompare(b.label));

// Phase 3: the same structure in another body or model. The panel selects whichever of
// conceptId / alternates exists in the manifest on screen, and shows a label otherwise.
const uberonOf = id => { const u = defs.get(id)?.uberon?.id; return u ? u.replace(':', '') : null; };
for (const n of nodes) for (const c of n.connections) { const u = c.modeled && uberonOf(c.id); if (u) c.alternates = [u]; }
for (const [alias, eq] of aliases) alias.connections = eq.connections;

// Interiors: organ models attach to the structure they show (male: the BodyParts3D concept; female: the HRA concept).
const interiorReport = [];
for (const [object, m] of Object.entries(hraModels)) {
  if (m.kind !== 'organ') continue;
  let target = m.attachTo && (m.sex === 'male' ? maleByConcept.get(m.attachTo) : byId.get(graphId(m.attachTo)) ?? maleByConcept.get(m.attachTo));
  // The female body sometimes names the same organ by its FMA id (ovary model UBERON:0002119, body FMA:7214).
  if (m.sex === 'female' && !target?.geometry.female?.length) target = (hraDefs.get(graphId(m.attachTo ?? ''))?.fmaXrefs ?? []).map(x => byId.get(graphId(x))).find(t => t?.geometry.female?.length) ?? target;
  const ok = target && (m.sex === 'male' || target.geometry.female?.length);
  interiorReport.push({object, sex: m.sex, attachTo: ok ? target.id : null, label: ok ? target.label : null});
  if (ok) (target.geometry.interior ??= {})[m.sex] = (target.geometry.interior[m.sex] ?? []).concat(m.manifest);
}

// Scale ladder: Body > System > Organ > Part. A male structure's organ comes from step 06 (itself if
// an FMA Organ, else the nearest modeled organ up its part_of chain). An HRA structure's organ is the
// nearest structure up the HRA hierarchy that is an FMA Organ or carries an interior; an alias uses
// its male equivalent's. alternates lets the panel find the organ in whichever body is on screen.
const hraParent = new Map();
for (const e of hraTree) { const a = nodeOfHra(e.from), b = nodeOfHra(e.to); if (a && b && a !== b && !hraParent.has(a.id)) hraParent.set(a.id, b); }
const isOrganNode = n => n.ancestors.includes('FMA:67498') || n.id === 'FMA:67498' || !!n.geometry.interior;
const aliasOf = new Map(aliases.map(([alias, eq]) => [eq.id, alias]));
// An organ's interiors include its alias's (the male heart FMA:7088 and the female heart UBERON:0000948
// are one organ on the ladder, each with its own body's model).
const organRef = n => {
  if (!n) return null;
  const alt = aliasOf.get(n.id), interior = {...(n.geometry.interior ?? {}), ...(alt?.geometry.interior ?? {})};
  const alternates = [...new Set([uberonOf(n.id), alt?.conceptId].filter(Boolean))];
  return {id: n.id, conceptId: n.conceptId, label: n.label, ...(alternates.length ? {alternates} : {}), ...(Object.keys(interior).length ? {interior} : {})};
};
for (const n of nodes) {
  let organ = null;
  if (n.id.startsWith('FMA:') && defs.has(n.id)) organ = byId.get(defs.get(n.id).organ?.id);
  else if (n.equivalent) organ = byId.get(defs.get(n.equivalent)?.organ?.id);
  if (!organ) for (let k = n, hops = 0; k && hops < 12; k = hraParent.get(k.id), hops++) if (isOrganNode(k)) { organ = k; break; }
  n.ladder = {system: n.ladderSystem, isOrgan: !!organ && (organ.id === n.id || organ.id === n.equivalent), organ: organRef(organ)};
}

// Phase 4: tissue and cell ---------------------------------------------------------------------
// Cell types (ASCT+B rows) are placed in the deepest structure of each row that is one of our nodes
// (same id, or the male concept with that Uberon id); rows with none fall back to the organs listed for
// their table in pipeline/maps/tissue-media.json. Each placement adds the cell type to the tissue board
// of that structure's ladder organ. Media (step 08) attach to the board of the node they are mapped to;
// an organ's tissue boards are its own plus those of its is_a ancestors (left kidney -> kidney).
const readJsonl = p => exists(p) ? jsonl(p) : [];
const gid = cid => cid.replace(/^(FMA|UBERON|CL|GO)(\d)/, '$1:$2');
const asctb = readJsonl('graph/asctb.jsonl');
const cellDefs = new Map(readJsonl('graph/defs.cells.jsonl').map(d => [d.id, d]));
const goDefs = new Map(readJsonl('graph/defs.go.jsonl').map(d => [d.id, d]));
const media = exists('graph/media.json') ? JSON.parse(read('graph/media.json')) : {};
const tissueMap = JSON.parse(read('pipeline/maps/tissue-media.json'));
const organelleMap = JSON.parse(read('pipeline/maps/organelles.json'));
const hraRelease = JSON.parse(read('pipeline/maps/hra-release.json'));
const CELL_MODEL = '/models/cell/generic-cell.json';
// Each cell type's 3D shape: a cell family chosen from its Cell Ontology ancestors (pipeline/maps/cell-families.json);
// step 13 built one model per family variant. `shape` is the summary the panel shows (and step 12 checks).
const cellShape = cl => { const s = shapeOf(cl, cellDefs.get(cl)?.ancestors ?? []); return {model: s.model, shape: {family: s.family, label: s.label, variant: s.variant, apical: s.apical?.kind ?? null, nucleus: s.nucleus,
  from: s.from ? {id: s.from.id, label: s.from.label} : null, ...(s.from?.note ? {note: s.from.note} : {}), ...(s.noNucleus ? {noNucleus: s.noNucleus.why} : {}),
  caption: s.caption, ...(s.reconstruction ? {reconstruction: s.reconstruction} : {}),
  ...(s.family === 'profile' ? {base: s.base, baseLabel: s.baseLabel, outline: s.outline} : {}), ...(s.profile ? {profile: {status: s.profile.status, claims: s.profile.claims, fields: s.profile.fields, drawn: s.profile.drawn}} : {})}}; };
// A cell type's morphology profile (content/CL_<n>/morphology.md): its checked claims, each with the sentence it quotes and
// where that sentence is, for the panel's Morphology section. The checker's notes stay in the content file.
const morphologyFor = cl => { const p = PROFILES[cl]; if (!p) return null;
  return {status: p.status, file: p.file, license: p.license, attribution: p.attribution, method: p.method, draftedOn: p.drafted_on, sources: p.sources,
    claims: p.claims.map(c => ({field: c.field, value: c.value, quote: c.quote, source: {section: c.source.section, url: c.source.url, license: c.source.license, citation: c.source.citation, ...(c.source.access ? {access: c.source.access} : {})}}))}; };
const cellModels = fs.readdirSync(path.join(root, 'public/models/cell')).filter(f => f.endsWith('.json')).sort().map(f => [`/models/cell/${f}`, JSON.parse(read(`public/models/cell/${f}`))]);
/** An organelle's model: the generic cell if it draws it, else the first family model that does. */
const organelleModel = key => [[CELL_MODEL], ...cellModels.filter(([u]) => u !== CELL_MODEL)].map(([u]) => [u, cellModels.find(([x]) => x === u)?.[1]]).find(([, m]) => m?.palette?.some(x => x.id === key))?.[0] ?? CELL_MODEL;
const maleByUberon = new Map();
for (const d of defs.values()) if (d.uberon) maleByUberon.set(d.uberon.id, [...(maleByUberon.get(d.uberon.id) ?? []), d.id]);
// Female aliases resolve to their male equivalent (one board per organ, not one per body).
const canonical = n => (n?.equivalent && byId.get(n.equivalent)) || n;
const nodeForStructure = id => canonical(byId.get(id) ?? (maleByUberon.get(id)?.length === 1 ? byId.get(maleByUberon.get(id)[0]) : null));
const organOf = n => canonical(byId.get(n.ladder?.organ?.id) ?? n);
const tableOrgans = new Map();
for (const o of Object.values(tissueMap.organs)) for (const t of o.tables ?? []) tableOrgans.set(t, o.nodes.map(c => byId.get(gid(c))).filter(Boolean));
const boards = new Map();
const boardFor = organ => { if (!boards.has(organ.id)) boards.set(organ.id, {organ: {id: organ.id, conceptId: organ.conceptId, label: organ.label}, tables: new Map(), groups: new Map(), media: []}); return boards.get(organ.id); };
const cellPlaces = new Map(), cellLabel = new Map();
// Rows whose structures are not in the body model (pipeline/maps/asctb-fixes.json): 'onto' names where a table's rows go;
// 'withCell' puts the listed cells wherever another table placed that cell (handled after the other rows).
const placementFixes = JSON.parse(read('pipeline/maps/asctb-fixes.json')).placements;
const ontoFix = new Map(placementFixes.filter(f => f.onto).map(f => [f.table, f.onto.map(id => byId.get(id)).filter(Boolean)]));
const withCellFix = placementFixes.filter(f => f.withCell), laterRows = [];
let rowsUnplaced = 0;
for (const row of asctb) {
  let deepest = null;
  for (let k = row.chain.length - 1; k >= 0 && !deepest; k--) deepest = nodeForStructure(row.chain[k][0]);
  const organs = tableOrgans.get(row.table) ?? (deepest ? null : ontoFix.get(row.table));
  if (!organs && !deepest && withCellFix.some(f => f.table === row.table && row.cellTypes.some(([cl]) => f.cells.includes(cl)))) { laterRows.push(row); continue; }
  let placed, onBoards;
  if (organs?.length) {  // an organ table: its organ's board; the deepest structure if it lies inside that organ
    const o = deepest && organOf(deepest), inside = o && organs.some(m => o.id === m.id || o.ancestors.includes(m.id));
    placed = inside ? [deepest] : organs;
    onBoards = organs;
  } else if (deepest) {  // other tables (nerves, muscles, bones, ...): the board of the structure's organ
    placed = [deepest];
    onBoards = [organOf(deepest)];
  } else { rowsUnplaced++; continue; }
  const info = hraRelease.tables[row.table], structure = row.chain.at(-1)[1];
  for (const organ of onBoards) {
    const b = boardFor(organ);
    b.tables.set(row.table, {name: row.table, version: info.version, doi: info.doi, citation: info.citation});
    if (!b.groups.has(structure)) b.groups.set(structure, new Map());
    for (const [cl] of row.cellTypes) b.groups.get(structure).set(cl, true);
  }
  for (const [cl, label] of row.cellTypes) {
    cellLabel.set(cl, cellLabel.get(cl) ?? label);
    if (!cellPlaces.has(cl)) cellPlaces.set(cl, new Map());
    for (const a of placed) {
      if (!cellPlaces.get(cl).has(a.id)) cellPlaces.get(cl).set(a.id, new Set());
      cellPlaces.get(cl).get(a.id).add(row.table);
    }
  }
}
for (const [cid, list] of Object.entries(media)) { const n = byId.get(gid(cid)); if (n) boardFor(n).media.push(...list); }

const olsTerm = (ontology, id) => `https://www.ebi.ac.uk/ols4/ontologies/${ontology}/classes/${encodeURIComponent(encodeURIComponent(`http://purl.obolibrary.org/obo/${id.replace(':', '_')}`))}`;
const tiersFor = id => { const dir = id.replace(':', '_'); return {tier1: tierEntry(dir, 1), tier2: tierEntry(dir, 2), tier3: tierEntry(dir, 3)}; };
const sourcesOf = content => { const out = []; for (const t of Object.values(content)) for (const x of t.sources ?? []) if (!out.some(y => y.url === x.url)) out.push(x); return out; };
const cellEdges = [];
// Cell types.
// 'withCell' placements: e.g. osteoblasts, osteoclasts and chondrocytes from the bone marrow table go wherever bone cells are.
for (const row of laterRows) for (const fix of withCellFix.filter(f => f.table === row.table)) {
  const cells = row.cellTypes.filter(([cl]) => fix.cells.includes(cl)), where = [...(cellPlaces.get(fix.withCell)?.keys() ?? [])].map(id => byId.get(id)).filter(Boolean);
  if (!cells.length || !where.length) { rowsUnplaced++; continue; }
  const info = hraRelease.tables[row.table], structure = row.chain.at(-1)[1];
  for (const organ of new Set(where.map(organOf))) {
    const b = boardFor(organ);
    b.tables.set(row.table, {name: row.table, version: info.version, doi: info.doi, citation: info.citation});
    if (!b.groups.has(structure)) b.groups.set(structure, new Map());
    for (const [cl] of cells) b.groups.get(structure).set(cl, true);
  }
  for (const [cl, label] of cells) {
    cellLabel.set(cl, cellLabel.get(cl) ?? label);
    if (!cellPlaces.has(cl)) cellPlaces.set(cl, new Map());
    for (const a of where) { if (!cellPlaces.get(cl).has(a.id)) cellPlaces.get(cl).set(a.id, new Set()); cellPlaces.get(cl).get(a.id).add(row.table); }
  }
}
// Commonly taught cell types no ASCT+B table lists, added from Cell Ontology (pipeline/maps/extra-cell-types.json): on
// their organ's board with the source of that placement, or, with no organ in the body model, opened on their own.
const extraCells = JSON.parse(read('pipeline/maps/extra-cell-types.json')).cells, extraSource = new Map(extraCells.map(c => [`extra:${c.cl}`, c.source]));
for (const x of extraCells) {
  const key = `extra:${x.cl}`;
  if (!cellPlaces.has(x.cl)) cellPlaces.set(x.cl, new Map());
  if (x.standalone) continue;
  const where = (x.withCell ? [...(cellPlaces.get(x.withCell)?.keys() ?? [])] : x.organs).map(id => byId.get(id)).filter(Boolean);
  for (const organ of new Set(where.map(organOf))) {
    const b = boardFor(organ);
    (b.sources ??= new Map()).set(key, x.source);
    if (!b.groups.has(x.structure)) b.groups.set(x.structure, new Map());
    b.groups.get(x.structure).set(x.cl, true);
  }
  for (const a of where) { if (!cellPlaces.get(x.cl).has(a.id)) cellPlaces.get(x.cl).set(a.id, new Set()); cellPlaces.get(x.cl).get(a.id).add(key); }
}
for (const [cl, places] of [...cellPlaces].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (cl === 'CL:0000000') continue;
  const content = tiersFor(cl), d = cellDefs.get(cl), first = byId.get([...places.keys()][0]);
  const connections = [...places].map(([nid, tables]) => {
    const n = byId.get(nid), keys = [...tables].sort();
    const srcs = keys.map(t => extraSource.get(t) ?? {name: `HRA ASCT+B table: ${t.replace(/-/g, ' ')} ${hraRelease.tables[t].version}`, license: 'CC BY 4.0', url: hraRelease.tables[t].doi});
    cellEdges.push({from: cl, to: nid, rel: 'located_in', source: keys.some(t => !extraSource.has(t)) ? 'HRA ASCT+B' : srcs[0].name, license: 'CC BY 4.0', evidence: keys.map((t, i) => extraSource.has(t) ? srcs[i].url : `${t} ${hraRelease.tables[t].version}`).join('; ')});
    return {rel: 'located_in', dir: 'out', id: nid, conceptId: n.conceptId, label: n.label, modeled: true, sources: srcs,
      ...(uberonOf(nid) ? {alternates: [uberonOf(nid)]} : {})};
  }).sort((a, b) => a.label.localeCompare(b.label));
  const alone = extraCells.find(x => x.cl === cl && x.standalone);
  if (alone) connections.push({rel: 'located_in', dir: 'out', id: null, conceptId: null, label: `${alone.foundIn}, not in the body model`, modeled: false, sources: [alone.source]});
  nodes.push({id: cl, conceptId: cl.replace(':', ''), label: upperFirst(d?.label ?? cellLabel.get(cl)), scale: 'cell', system: null, synonyms: d?.synonyms ?? [],
    xrefs: {CL: cl.slice(3)}, geometry: cellShape(cl), ...(morphologyFor(cl) ? {morphology: morphologyFor(cl)} : {}), content, media: [], sources: sourcesOf(content), zoom: {in: [], out: []}, connections, ancestors: [],
    ladder: {system: first?.ladder?.system ?? null, isOrgan: false, organ: first?.ladder?.organ ?? null}});
}
// The generic cell (CL:0000000) and its organelles (GO), from the cell model.
const cellContent = tiersFor(organelleMap.cell.id);
// Only parts some cell model draws become nodes (pipeline/maps/organelles.json lists every part a model may use).
const drawnOrganelles = organelleMap.organelles.filter(o => cellModels.some(([, m]) => m.palette?.some(x => x.id === o.key)));
const organelleNodes = drawnOrganelles.map(o => {
  const content = tiersFor(o.id), d = goDefs.get(o.id);
  cellEdges.push({from: o.id, to: organelleMap.cell.id, rel: 'component_of', source: 'Bio Map cell model', license: 'CC BY 4.0', evidence: 'pipeline/13-cell.mjs; GO cellular component'});
  return {id: o.id, conceptId: o.id.replace(':', ''), label: o.label, scale: 'organelle', system: null, synonyms: d?.synonyms ?? [], xrefs: {GO: o.id.slice(3)},
    geometry: {model: organelleModel(o.key)}, content, media: [], sources: sourcesOf(content), zoom: {in: [], out: [organelleMap.cell.id]},
    connections: [{rel: 'component_of', dir: 'out', id: organelleMap.cell.id, conceptId: organelleMap.cell.id.replace(':', ''), label: 'Cell', modeled: true, sources: [{name: 'Gene Ontology', license: 'CC BY 4.0', url: olsTerm('go', o.id)}]}],
    ancestors: [], ladder: {system: null, isOrgan: false, organ: null}};
});
nodes.push({id: organelleMap.cell.id, conceptId: organelleMap.cell.id.replace(':', ''), label: 'Cell', scale: 'cell', system: null, synonyms: [], xrefs: {CL: organelleMap.cell.id.slice(3)},
  geometry: {model: CELL_MODEL}, content: cellContent, media: [], sources: sourcesOf(cellContent), zoom: {in: drawnOrganelles.map(o => o.id), out: []},
  connections: drawnOrganelles.map(o => ({rel: 'component_of', dir: 'in', id: o.id, conceptId: o.id.replace(':', ''), label: o.label, modeled: true, sources: [{name: 'Gene Ontology', license: 'CC BY 4.0', url: olsTerm('go', o.id)}]})),
  ancestors: [], ladder: {system: null, isOrgan: false, organ: null}}, ...organelleNodes);
for (const n of nodes.slice(-1 - organelleNodes.length).concat(nodes.filter(n => n.scale === 'cell'))) byId.set(n.id, n);

// Tissue boards -> public/tissue/<organ conceptId>.json; organs on the ladder link to theirs and their ancestors'.
const tissueDir = path.join(root, 'public/tissue');
fs.mkdirSync(tissueDir, {recursive: true});
const boardUrl = id => `/tissue/${byId.get(id).conceptId}.json`;
const keepBoards = new Set();
const cellRows = [];
for (const [id, b] of boards) {
  const groups = [...b.groups].map(([structure, cells]) => ({structure: upperFirst(structure), cells: [...cells.keys()].filter(c => byId.has(c)).map(c => ({id: c, conceptId: c.replace(':', ''), label: byId.get(c).label, model: byId.get(c).geometry?.model ?? CELL_MODEL, shape: byId.get(c).geometry?.shape})).sort((x, y) => x.label.localeCompare(y.label))}))
    .filter(g => g.cells.length).sort((x, y) => y.cells.length - x.cells.length || x.structure.localeCompare(y.structure));
  const cellCount = new Set(groups.flatMap(g => g.cells.map(c => c.id))).size;
  const body = JSON.stringify({organ: b.organ, tables: [...b.tables.values()].sort((x, y) => x.name.localeCompare(y.name)), cellCount, groups, media: b.media, ...(b.sources ? {sources: [...b.sources.values()].filter((v, k, a) => a.findIndex(o => o.url === v.url) === k)} : {})}, null, 1) + '\n';
  const file = `${byId.get(id).conceptId}.json`;
  keepBoards.add(file);
  if (!fs.existsSync(path.join(tissueDir, file)) || fs.readFileSync(path.join(tissueDir, file), 'utf8') !== body) fs.writeFileSync(path.join(tissueDir, file), body);
  cellRows.push({label: b.organ.label, id: b.organ.id, cells: cellCount, tables: [...b.tables.keys()].sort(), media: b.media.map(m => m.kind)});
}
for (const f of fs.readdirSync(tissueDir)) if (f.endsWith('.json') && !keepBoards.has(f)) fs.unlinkSync(path.join(tissueDir, f));
const tissueOf = organ => organ ? [organ.id, ...organ.ancestors].filter(x => boards.has(x)).map(boardUrl) : [];
for (const n of nodes) if (n.ladder?.organ) { const t = tissueOf(byId.get(n.ladder.organ.id)); if (t.length) n.ladder.organ.tissue = t; }
// A structure whose own tissue board its ladder organ does not reach (the tongue has no ladder organ; the brain's is the
// neuraxis) opens it from itself, and its parts open it too when their ladder organ opens no tissue: ladder.board is the
// structure itself or its nearest part_of ancestor with a board (is_a classes do not count: a board placed on a class
// such as "segment of vascular tree organ" is not every vessel's tissue).
const partChain = n => { const out = [], seen = new Set([n.id]); let frontier = [n];
  while (frontier.length && out.length < 200) { const next = []; for (const x of frontier) for (const id of x.zoom?.out ?? []) if (!seen.has(id)) { seen.add(id); const y = byId.get(id); if (y) { out.push(y); next.push(y); } } frontier = next; }
  return out; };
const boardRef = h => ({id: h.id, conceptId: h.conceptId, label: h.label, tissue: [...new Set([boardUrl(h.id), ...tissueOf(h)])]});
for (const n of nodes) {
  if (!n.ladder || n.scale === 'cell' || n.scale === 'organelle') continue;
  const have = new Set(n.ladder.organ?.tissue ?? []);
  if (boards.has(n.id) && !have.has(boardUrl(n.id))) { n.ladder = {...n.ladder, board: boardRef(n)}; continue; }
  if (have.size) continue;
  const holder = partChain(n).find(x => boards.has(x.id));
  if (holder) n.ladder = {...n.ladder, board: boardRef(holder)};
}
const cellReport = ['# Cell types and tissue boards', '', 'Generated by `pipeline/11-build-graph.mjs` from the HRA v2.5 ASCT+B tables (step 06) and tissue media (step 08).', '',
  `- Cell types (Cell Ontology): ${cellPlaces.size - (cellPlaces.has('CL:0000000') ? 1 : 0)}; located_in edges: ${cellEdges.filter(e => e.rel === 'located_in').length}`,
  `- ASCT+B rows with no structure or organ of ours (skipped): ${rowsUnplaced}`,
  `- 3D shapes (pipeline/maps/cell-families.json): ${Object.entries(nodes.filter(n => n.scale === 'cell' && n.geometry?.shape).reduce((m, n) => ({...m, [n.geometry.shape.variant]: (m[n.geometry.shape.variant] ?? 0) + 1}), {})).sort((a, b) => b[1] - a[1]).map(([v, k]) => `${v} ${k}`).join(', ')}`, '',
  '| Organ (tissue board) | Cell types | ASCT+B tables | Media |', '| --- | --- | --- | --- |',
  ...cellRows.sort((a, b) => b.cells - a.cells || a.label.localeCompare(b.label)).map(r => `| ${r.label} | ${r.cells} | ${r.tables.join(', ') || '-'} | ${r.media.join(', ') || '-'} |`)];
fs.writeFileSync(path.join(root, 'reports/cells.md'), cellReport.join('\n') + '\n');

// graph/: node records without tier text (text lives in content/ files).
const stripText = content => Object.fromEntries(Object.entries(content).map(([k, t]) => [k, Object.fromEntries(Object.entries(t).filter(([f]) => f !== 'text'))]));
fs.writeFileSync(path.join(root, 'graph/nodes.jsonl'), nodes.map(n => JSON.stringify({...n, content: stripText(n.content), ...(n.morphology ? {morphology: {status: n.morphology.status, file: n.morphology.file, claims: n.morphology.claims.length}} : {})})).join('\n') + '\n');
fs.writeFileSync(path.join(root, 'graph/edges.jsonl'), [...uniqueEdges, ...connectionEdges, ...cellEdges].map(e => JSON.stringify(e)).join('\n') + '\n');

// public/content/: what the app reads; ancestors are graph-internal.
const out = path.join(root, 'public/content');
fs.mkdirSync(out, {recursive: true});
const keep = new Set(['index.json', 'interiors.json']);
for (const n of nodes) {
  const {ancestors, ladderSystem, ...served} = n;
  const file = `${n.conceptId}.json`;
  keep.add(file);
  const body = JSON.stringify(served, null, 1) + '\n';
  const target = path.join(out, file);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== body) fs.writeFileSync(target, body);
}
for (const f of fs.readdirSync(out)) if (f.endsWith('.json') && !keep.has(f)) fs.unlinkSync(path.join(out, f));
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ids: nodes.map(n => n.conceptId).sort()}) + '\n');
// Organs opened on their own stage, outside any body (pipeline/maps/standalone-organs.json).
const standalone = JSON.parse(read('pipeline/maps/standalone-organs.json'));
const standaloneCellEntries = extraCells.filter(x => x.standalone).map(x => { const n = byId.get(x.cl);
  return {object: `cell-${n.conceptId.toLowerCase()}`, kind: 'cell', group: 'cells', groupLabel: 'Cells', label: n.label, terms: x.terms ?? [], manifest: n.geometry.model, conceptId: n.conceptId, tissue: []}; });
fs.writeFileSync(path.join(root, 'public/models/organs/standalone.json'), JSON.stringify([...standalone.organs.map(o => {
  const m = hraModels[o.object];
  if (!m?.rootConceptId) throw new Error(`standalone organ ${o.object} has no model or root concept`);
  const node = byId.get(m.rootConceptId.replace(/^(FMA|UBERON|CL|GO)(\d)/, '$1:$2'));
  return {object: o.object, group: o.group, groupLabel: standalone.groups[o.group].label, label: o.label, terms: o.terms, manifest: m.manifest, conceptId: m.rootConceptId,
    tissue: node?.ladder?.organ?.tissue?.length ? node.ladder.organ.tissue : tissueOf(node)};  // its tissue boards (Zoom in from the organ on its own stage)
}), ...standaloneCellEntries], null, 1) + '\n');
fs.writeFileSync(path.join(root, 'graph/interiors.json'), JSON.stringify(interiorReport.sort((a, b) => a.object.localeCompare(b.object)), null, 1) + '\n');
// reports/hra.md: bodies, and which organs have interiors in each.
if (Object.keys(hraModels).length) {
  const rows = interiorReport.map(r => ({...hraModels[r.object], ...r}));
  const female = Object.values(hraModels).find(m => m.kind === 'body');
  const lines = ['# HRA report', '', 'Generated by `pipeline/11-build-graph.mjs` from the HRA v2.5 manifests built by step 05.', '',
    '| Body | Parts | Concepts | Source |', '| --- | --- | --- | --- |',
    `| Male | ${atlas.parts.length} | ${atlas.concepts.length} | BodyParts3D 4.0 |`,
    ...(female ? [`| Female | ${female.parts} | ${female.concepts} | HRA v2.5 united female ${female.version} |`] : []), '',
    '## Organs with interiors', '', '| Body | Organ | Model | Parts |', '| --- | --- | --- | --- |',
    ...rows.filter(r => r.attachTo).sort((a, b) => a.sex.localeCompare(b.sex) || a.label.localeCompare(b.label)).map(r => `| ${r.sex} | ${r.label} | ${r.object} ${r.version} | ${r.parts} |`), '',
    '## Models not attached', '', 'No structure in that body to zoom into (BodyParts3D has no larynx, lymph node, palatine tonsil or renal pelvis mesh; the female body has no separate renal pelvis per side).', '',
    ...rows.filter(r => !r.attachTo).map(r => `- ${r.object} (${r.parts} parts)`)];
  fs.writeFileSync(path.join(root, 'reports/hra.md'), lines.join('\n') + '\n');
}
const byRel = {};
for (const e of [...uniqueEdges, ...connectionEdges]) byRel[e.rel] = (byRel[e.rel] ?? 0) + 1;
console.log(JSON.stringify({nodes: nodes.length, edges: uniqueEdges.length + connectionEdges.length, unmodeled: UNMODELED, byRel}));
