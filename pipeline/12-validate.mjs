// Step 12: validate the knowledge graph and served content, and write reports/coverage.md.
// Usage: node pipeline/12-validate.mjs   (exit 1 on any error; runs before `npm run build`)
// Reads only committed files (graph/, content/, public/), never data/ or the network.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const jsonl = p => read(p).split('\n').filter(Boolean).map(l => JSON.parse(l));
const ORGAN = 'FMA:67498';
const SCALES = ['body', 'system', 'organ', 'tissue', 'cell', 'organelle', 'molecule'];
const STATUSES = ['missing', 'auto', 'drafted', 'reviewed', 'verified'];
const RELS = ['is_a', 'part_of'];
const SOURCE_LABEL = {curated: 'Curated text (tier1.md)', ncit: 'NCIt definition', uberon: 'Uberon definition', fma: 'FMA definition',
  hierarchy: 'Generated from FMA hierarchy', 'hierarchy-bp3d': 'Generated from BodyParts3D hierarchy', none: 'No tier-1 text'};

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const atlas = JSON.parse(read('public/models/atlas.json'));
const systems = new Set(atlas.parts.map(p => p.system));
const nodes = jsonl('graph/nodes.jsonl'), edges = jsonl('graph/edges.jsonl');
const byId = new Map(nodes.map(n => [n.id, n]));
const index = new Set(JSON.parse(read('public/content/index.json')).ids);

if (byId.size !== nodes.length) fail('graph', 'duplicate node ids');
const conceptIds = new Set(atlas.concepts.map(c => c.id));
for (const c of conceptIds) if (!byId.has(`FMA:${c.slice(3)}`)) fail(c, 'atlas concept has no graph node');
for (const n of nodes) if (!conceptIds.has(n.conceptId)) fail(n.id, 'node is not an atlas concept');

const isOrgan = n => n.id === ORGAN || n.ancestors.includes(ORGAN);
const mentionsWikipedia = v => /wikipedia/i.test(JSON.stringify(v));

function checkTier(id, name, t, served) {
  if (!STATUSES.includes(t.status)) return fail(id, `${name}: bad status ${t.status}`);
  if (t.status === 'missing') return;
  if (!t.file || !fs.existsSync(path.join(root, t.file))) fail(id, `${name}: file ${t.file} missing`);
  if (served && !served.text?.trim()) fail(id, `${name}: no text`);
  if (!t.license) fail(id, `${name}: no license`);
  if (!t.attribution) fail(id, `${name}: no attribution`);
  if (!t.source?.name || !t.source?.url || !t.source?.license) fail(id, `${name}: incomplete source`);
  if (!Array.isArray(t.sources) || !t.sources.length || t.sources.some(s => !s.title || !s.url || !s.license)) fail(id, `${name}: sources need title, url, license`);
  if (mentionsWikipedia([served?.text, t.source, t.sources, t.attribution])) fail(id, `${name}: Wikipedia text or source is not allowed`);
}

const bySource = {}, organBySource = {}, byStatus = {}, byScale = {};
for (const n of nodes) {
  if (!/^FMA:\d+$/.test(n.id) || n.conceptId !== `FMA${n.id.slice(4)}`) fail(n.id, 'bad id or conceptId');
  if (!SCALES.includes(n.scale)) fail(n.id, `bad scale ${n.scale}`);
  if (!systems.has(n.system)) fail(n.id, `bad system ${n.system}`);
  if (!n.label?.trim()) fail(n.id, 'no label');
  if (!Array.isArray(n.geometry?.male) || !n.geometry.male.length) fail(n.id, 'no geometry');
  if (!index.has(n.conceptId)) fail(n.id, 'missing from public/content/index.json');
  let served = null;
  try { served = JSON.parse(read(`public/content/${n.conceptId}.json`)); } catch { fail(n.id, 'served content file missing or invalid'); }
  if (served && (served.id !== n.id || 'ancestors' in served)) fail(n.id, 'served file does not match node');
  for (const name of ['tier1', 'tier2', 'tier3']) checkTier(n.id, name, n.content?.[name] ?? {status: undefined}, served?.content?.[name]);
  const t1 = n.content.tier1, kind = t1.status === 'missing' ? 'none' : t1.source?.kind ?? 'curated';
  if (isOrgan(n) && (t1.status === 'missing' || !served?.content?.tier1?.text || !t1.source?.url)) fail(n.id, `organ "${n.label}" lacks tier-1 text and a source`);
  bySource[kind] = (bySource[kind] ?? 0) + 1;
  if (isOrgan(n)) organBySource[kind] = (organBySource[kind] ?? 0) + 1;
  byStatus[t1.status] = (byStatus[t1.status] ?? 0) + 1;
  const s = (byScale[n.scale] ??= {nodes: 0, tier1: 0, tier2: 0, tier3: 0});
  s.nodes++;
  for (const k of ['tier1', 'tier2', 'tier3']) if (n.content[k].status !== 'missing') s[k]++;
}
for (const id of index) if (!conceptIds.has(id)) fail(id, 'index lists an id that is not an atlas concept');
const relCount = {};
for (const e of edges) {
  if (!byId.has(e.from) || !byId.has(e.to)) fail(`${e.from}→${e.to}`, 'dangling edge');
  if (!RELS.includes(e.rel)) fail(`${e.from}→${e.to}`, `bad relation ${e.rel}`);
  relCount[e.rel] = (relCount[e.rel] ?? 0) + 1;
}

const organs = nodes.filter(isOrgan).length;
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)];
const order = Object.keys(SOURCE_LABEL);
const lines = ['# Coverage report', '', 'Generated by `pipeline/12-validate.mjs`. No Wikipedia text is used anywhere.', '',
  `- Nodes: ${nodes.length} (atlas concepts: ${conceptIds.size})`,
  `- Organs (${ORGAN} Organ and its is_a descendants): ${organs}`,
  `- Edges: ${edges.length} (${RELS.map(r => `${r} ${relCount[r] ?? 0}`).join(', ')})`,
  `- Validation errors: ${errors.length}`, '',
  '## Tier-1 text by source', '',
  ...table(['Source', 'All concepts', 'Organs'], order.filter(k => bySource[k] || organBySource[k]).map(k => [SOURCE_LABEL[k], bySource[k] ?? 0, organBySource[k] ?? 0])), '',
  '## Tier-1 status', '',
  ...table(['Status', 'Concepts'], STATUSES.filter(s => byStatus[s]).map(s => [s, byStatus[s]])), '',
  '## Tiers by scale', '',
  ...table(['Scale', 'Nodes', 'Tier 1', 'Tier 2', 'Tier 3'], SCALES.filter(s => byScale[s]).map(s => [s, byScale[s].nodes, byScale[s].tier1, byScale[s].tier2, byScale[s].tier3])),
];
if (errors.length) lines.push('', '## Errors', '', ...errors.slice(0, 200).map(e => `- ${e}`));
fs.mkdirSync(path.join(root, 'reports'), {recursive: true});
fs.writeFileSync(path.join(root, 'reports/coverage.md'), lines.join('\n') + '\n');
if (errors.length) {
  console.error(`12-validate: ${errors.length} error(s)\n` + errors.slice(0, 30).join('\n'));
  process.exit(1);
}
console.log(`12-validate: ${nodes.length} nodes, ${organs} organs, ${edges.length} edges OK. Tier-1 sources: ${order.filter(k => bySource[k]).map(k => `${k} ${bySource[k]}`).join(', ')}`);
