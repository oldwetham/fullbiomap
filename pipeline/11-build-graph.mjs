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

const nodes = [];
for (const c of atlas.concepts) {
  const id = `FMA:${c.id.slice(3)}`, d = defs.get(id) ?? {}, fma = d.fma ?? null;
  const counts = {};
  for (const e of c.elements) counts[partSystem.get(e)] = (counts[partSystem.get(e)] ?? 0) + 1;
  const system = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const ancestors = fma?.ancestors ?? [];
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
    ancestors,
  });
}

const byId = new Map(nodes.map(n => [n.id, n]));
const edges = [];
for (const n of nodes) {
  const fma = defs.get(n.id)?.fma;
  if (!fma) continue;
  for (const p of fma.isA) if (byId.has(p.id)) edges.push({from: n.id, to: p.id, rel: 'is_a', source: 'FMA', evidence: 'rdfs:subClassOf'});
  for (const p of fma.partOf) if (byId.has(p.id)) edges.push({from: n.id, to: p.id, rel: 'part_of', source: 'FMA', evidence: p.rel});
}
const seen = new Set();
const uniqueEdges = edges.filter(e => { const k = `${e.from}|${e.rel}|${e.to}`; if (seen.has(k)) return false; seen.add(k); return true; })
  .sort((a, b) => a.from.localeCompare(b.from) || a.rel.localeCompare(b.rel) || a.to.localeCompare(b.to));
for (const e of uniqueEdges) if (e.rel === 'part_of') { byId.get(e.from).zoom.out.push(e.to); byId.get(e.to).zoom.in.push(e.from); }

// graph/: node records without tier text (text lives in content/ files).
const stripText = content => Object.fromEntries(Object.entries(content).map(([k, t]) => [k, Object.fromEntries(Object.entries(t).filter(([f]) => f !== 'text'))]));
fs.writeFileSync(path.join(root, 'graph/nodes.jsonl'), nodes.map(n => JSON.stringify({...n, content: stripText(n.content)})).join('\n') + '\n');
fs.writeFileSync(path.join(root, 'graph/edges.jsonl'), uniqueEdges.map(e => JSON.stringify(e)).join('\n') + '\n');

// public/content/: what the app reads; ancestors are graph-internal.
const out = path.join(root, 'public/content');
fs.mkdirSync(out, {recursive: true});
const keep = new Set(['index.json']);
for (const n of nodes) {
  const {ancestors, ...served} = n;
  const file = `${n.conceptId}.json`;
  keep.add(file);
  const body = JSON.stringify(served, null, 1) + '\n';
  const target = path.join(out, file);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== body) fs.writeFileSync(target, body);
}
for (const f of fs.readdirSync(out)) if (f.endsWith('.json') && !keep.has(f)) fs.unlinkSync(path.join(out, f));
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ids: nodes.map(n => n.conceptId).sort()}) + '\n');
console.log(JSON.stringify({nodes: nodes.length, edges: uniqueEdges.length, isA: uniqueEdges.filter(e => e.rel === 'is_a').length, partOf: uniqueEdges.filter(e => e.rel === 'part_of').length}));
