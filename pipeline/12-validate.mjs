// Step 12: validate the knowledge graph and served content, and write reports/coverage.md.
// Usage: node pipeline/12-validate.mjs   (exit 1 on any error; runs before `npm run build`)
// Reads only committed files (graph/, content/, public/), never data/ or the network.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROFILES, shapeOf} from './_cell-families.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const jsonl = p => read(p).split('\n').filter(Boolean).map(l => JSON.parse(l));
const ORGAN = 'FMA:67498';
const SCALES = ['body', 'system', 'organ', 'tissue', 'cell', 'organelle', 'molecule'];
const STATUSES = ['missing', 'auto', 'drafted', 'reviewed', 'verified'];
const CONNECTIONS = ['arterial_supply', 'venous_drainage', 'nerve_supply', 'lymphatic_drainage', 'branch_of',
  'tributary_of', 'attaches_to', 'articulates_with', 'continuous_with', 'located_in', 'component_of'];
const CELL_SCALES = new Set(['cell', 'organelle']);
const RELS = ['is_a', 'part_of', ...CONNECTIONS];
const SOURCE_LABEL = {curated: 'Curated text (tier1.md)', ncit: 'NCIt definition', uberon: 'Uberon definition', fma: 'FMA definition',
  hierarchy: 'Generated from FMA hierarchy', 'hierarchy-bp3d': 'Generated from BodyParts3D hierarchy', 'hierarchy-hra': 'Generated from HRA 3D hierarchy', cl: 'Cell Ontology definition', go: 'Gene Ontology definition',
  'hierarchy-asctb': 'Generated from HRA ASCT+B table', placement: 'Generated from a sourced placement (Cell Ontology or OpenStax)', none: 'No tier-1 text'};

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
// Every file the app can request must exist under public/. A missing one is not a 404 in development: Vite's
// dev server answers with index.html and status 200, and the app fails with "Unexpected token '<'". Each
// missing file is reported once, with what points to it (see "Files the app can request" below).
const publicPath = url => path.join(root, 'public', url.replace(/^\//, ''));
const requested = new Set(), missing = new Map(), manifests = new Set();
function requirePath(url, from, what = 'file') {
  if (typeof url !== 'string' || !url.startsWith('/')) { fail(from, `bad ${what} path ${JSON.stringify(url)}`); return false; }
  requested.add(url);
  if (fs.existsSync(publicPath(url))) return true;
  if (!missing.has(url)) missing.set(url, {what, from: new Set()});
  missing.get(url).from.add(from);
  return false;
}
/** A model manifest and every chunk it lists (the app fetches `gzip` where the browser can inflate, else `url`). */
function requireManifest(url, from) {
  if (!requirePath(url, from, 'model manifest') || manifests.has(url)) return;
  manifests.add(url);
  let m = null;
  try { m = JSON.parse(fs.readFileSync(publicPath(url), 'utf8')); } catch { return fail(url, 'model manifest is not valid JSON'); }
  if (!Array.isArray(m.chunks) || !m.chunks.length) return fail(url, 'model manifest lists no chunks');
  for (const c of m.chunks) { requirePath(c.url, url, 'model chunk'); if (c.gzip) requirePath(c.gzip, url, 'model chunk'); }
}
const atlas = JSON.parse(read('public/models/atlas.json'));
const systems = new Set(atlas.parts.map(p => p.system));
const nodes = jsonl('graph/nodes.jsonl'), edges = jsonl('graph/edges.jsonl');
const byId = new Map(nodes.map(n => [n.id, n]));
const index = new Set(JSON.parse(read('public/content/index.json')).ids);

if (byId.size !== nodes.length) fail('graph', 'duplicate node ids');
const conceptIds = new Set(atlas.concepts.map(c => c.id));
for (const c of conceptIds) if (!byId.has(`FMA:${c.slice(3)}`)) fail(c, 'atlas concept has no graph node');
// Phase 3: every concept in every HRA manifest (female body, organ interiors) needs a node and a content file.
const hraModels = fs.existsSync(path.join(root, 'graph/hra-models.json')) ? JSON.parse(read('graph/hra-models.json')).models : {};
const hraConceptIds = new Set();
for (const [object, m] of Object.entries(hraModels)) {
  const where = m.archived ? 'archive/public' : 'public';  // archived: converted but not deployed (female body)
  if (!fs.existsSync(path.join(root, where, m.manifest))) { fail(object, `manifest ${where}${m.manifest} missing`); continue; }
  for (const c of JSON.parse(read(`${where}${m.manifest}`)).concepts) { hraConceptIds.add(c.id); if (!index.has(c.id)) fail(`${object} ${c.id}`, 'HRA concept has no content file'); }
}
// Phase 4: the generic cell model's concepts need nodes too.
// Phase 4: the 3D cells (step 13): every part they draw needs a node, and a cell type's model must follow the
// family rules (pipeline/maps/cell-families.json) and never draw a nucleus where the cell type has none.
const cellDir = path.join(root, 'public/models/cell');
const cellModels = new Map(fs.existsSync(cellDir) ? fs.readdirSync(cellDir).filter(f => f.endsWith('.json')).map(f => [`/models/cell/${f}`, JSON.parse(read(`public/models/cell/${f}`))]) : []);
const cellConceptIds = new Set([...cellModels.values()].flatMap(m => m.concepts.map(c => c.id)));
for (const [url, m] of cellModels) for (const c of m.concepts) if (!index.has(c.id)) fail(`${url} ${c.id}`, 'concept has no content file');
const NUCLEAR = new Set(['GO0005634', 'GO0005730']);  // nucleus, nucleolus
const drawsNucleus = m => m.concepts.some(c => NUCLEAR.has(c.id) && c.elements.length) || m.parts.some(p => NUCLEAR.has(p.conceptId));
for (const [url, m] of cellModels) if (m.cell && m.cell.nucleus !== drawsNucleus(m)) fail(url, `says nucleus: ${m.cell.nucleus} but ${drawsNucleus(m) ? 'draws' : 'does not draw'} one`);
const cellTerms = new Map(fs.readFileSync(path.join(root, 'graph/defs.cells.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(d => [d.id, d]));
// Independent of the family map: Cell Ontology's own word that a cell type has no nucleus.
const ontologySaysNoNucleus = id => { const d = cellTerms.get(id); return !!d && ((d.ancestors ?? []).includes('CL:0000225') || /\b(lacks? a nucleus|non-nucleated|anucleate|enucleated?)\b/i.test(d.definition ?? '')); };
let cellShapesChecked = 0;
// Morphology profiles (content/CL_<n>/morphology.md): every claim quotes one sentence from an allowed CC BY source, with
// its section, link, licence and citation (OpenStax with its "Access for free at" line). Step 09 checks each quote is
// word for word in its source; this step reads only committed files.
const PROFILE_FIELDS = ['shape', 'size', 'nucleus_count', 'nucleus_shape', 'nucleus_position', 'nucleus_size', 'surface', 'granules', 'organelle', 'special', 'function'];
const PROFILE_PARTS = [['surface', /microvill|brush border/i, 'microvillus'], ['surface', /stereocilia/i, 'stereocilium'], ['surface', /^(motile cilia|cilia|primary cilium)$/i, 'cilium'], ['surface', /flagellum/i, 'sperm-flagellum'],
  ['surface', /pseudopod/i, 'pseudopodium'], ['surface', /ruffled border/i, 'ruffle'], ['surface', /foot processes|long processes/i, 'cell-projection'], ['special', /zona pellucida/i, 'egg-coat'],
  ['special', /acrosom/i, 'acrosome'], ['special', /outer segment/i, 'outer-segment'], ['special', /intercalated dis/i, 'intercalated-disc'], ['special', /\bt[- ]?tubul/i, 't-tubule'],
  ['special', /keratin/i, 'intermediate-filament'], ['special', /intracellular canalicul/i, 'intracellular-canaliculus']];
const PROFILE_SOURCES = /^(openstax-ap2e|openstax-bio2e)\/[\w.-]+\.txt$/;
let profileClaims = 0;
for (const [id, p] of Object.entries(PROFILES)) {
  const where = p.file;
  if (where !== `content/${id.replace(':', '_')}/morphology.md`) fail(where, `profile id ${id} does not match its folder`);
  if (!cellTerms.has(id)) fail(where, `${id} is not a Cell Ontology term from step 06`);
  if (!['drafted', 'reviewed', 'verified'].includes(p.status)) fail(where, `bad status ${p.status}`);
  if (p.license !== 'CC BY 4.0' || !p.attribution?.trim() || !p.method?.trim()) fail(where, 'needs license CC BY 4.0, attribution and method');
  if (!p.sources?.length || p.sources.some(s => !s.name || !s.citation || s.license !== 'CC BY 4.0' || !s.url || (/openstax/i.test(s.name) && !/^Access for free at https:\/\/openstax\.org\//.test(s.access ?? '')))) fail(where, 'each source needs name, citation, CC BY 4.0, url, and OpenStax its "Access for free at" line');
  if (/wikipedia/i.test(JSON.stringify(p))) fail(where, 'Wikipedia text or source is not allowed');
  for (const [i, c] of p.claims.entries()) {
    profileClaims++;
    const s = c.source ?? {}, own = s.file === `cell-ontology/${id.replace(':', '_')}.txt`;
    if (!PROFILE_FIELDS.includes(c.field) || !c.value?.trim() || !c.quote?.trim() || c.quote.length > 300) fail(where, `claim ${i}: needs a known field, a value and a quote of at most 300 characters`);
    if (!PROFILE_SOURCES.test(s.file ?? '') && !own) fail(where, `claim ${i}: ${s.file} is not an allowed source (OpenStax A&P 2e or Biology 2e, or this cell type's Cell Ontology definition)`);
    if (!s.section || !s.url || s.license !== 'CC BY 4.0' || !s.citation || (!own && !/^Access for free at /.test(s.access ?? ''))) fail(where, `claim ${i}: source needs section, url, CC BY 4.0, citation and (OpenStax) its access line`);
  }
}
const attributionText = fs.readFileSync(path.join(root, 'public/ATTRIBUTION.md'), 'utf8');
for (const n of nodes) if (!conceptIds.has(n.conceptId) && !hraConceptIds.has(n.conceptId) && !CELL_SCALES.has(n.scale)) fail(n.id, 'node is neither an atlas nor an HRA concept');
// Organs opened on their own (female organs, lymphatic organs the body has no mesh for): model present, organ has a node
// with tier-1 text.
const standaloneFile = path.join(root, 'public/models/organs/standalone.json');
const standaloneList = fs.existsSync(standaloneFile) ? JSON.parse(fs.readFileSync(standaloneFile, 'utf8')) : [];
for (const o of standaloneList) {
  requireManifest(o.manifest, `standalone organ ${o.object}`);
  for (const t of o.tissue ?? []) requirePath(t, `standalone organ ${o.object}`, 'tissue board');
  const node = byId.get(o.conceptId.replace(/^(FMA|UBERON|CL|GO)(\d)/, '$1:$2'));
  if (!node || node.content?.tier1?.status === 'missing') fail(o.object, `standalone organ ${o.conceptId} has no node with tier-1 text`);
}

const isOrgan = n => n.id === ORGAN || n.ancestors.includes(ORGAN);
const mentionsWikipedia = v => /wikipedia/i.test(JSON.stringify(v));

// Figures (step 10): each one the app can show is a file under public/, carries its licence, credit, title, caption,
// alt text and a link to the original, is CC BY 4.0 or public domain, and cites no Wikipedia or Wikimedia. An OpenStax
// caption carries no third-party rights; a tissue unit illustration highlights only cells it draws; a cell type that
// looks like others under a microscope (pipeline/maps/look-alike.json) has the sentence that tells them apart.
const FIGURE_LICENCES = new Set(['CC BY 4.0', 'Public Domain', 'Public Domain (US)']), FIGURE_KINDS = new Set(['micrograph', 'diagram', 'illustration']);
const figureSources = JSON.parse(read('pipeline/maps/figure-sources.json')), lookAlike = JSON.parse(read('pipeline/maps/look-alike.json'));
const OPENSTAX_RIGHTS = /©|\bcopyright\b|all rights reserved|Regents of (?:the )?University of Michigan|\bprovided by\b/i, OPENSTAX_PD = new RegExp(figureSources.openstax.publicDomainCredits);
const lookAlikeOf = new Map(lookAlike.groups.flatMap(g => g.members.map(m => [m, g.sentence])));
const ASCTB_TABLES = new Set(Object.keys(JSON.parse(read('pipeline/maps/hra-release.json')).tables));
for (const g of lookAlike.groups) {  // every protein the sentence names has a cited source (step 10 checks each one in it)
  for (const e of g.evidence) if (!['openstax', 'cl-definition', 'cl-axiom', 'asctb'].includes(e.kind) || !(e.quote || e.term || e.text) || !(e.file || e.term || e.table)) fail(`look-alike ${g.id}`, `evidence ${JSON.stringify(e).slice(0, 80)} names no source`);
  for (const [cd] of g.sentence.matchAll(/\bCD\d+\b|\bAQP\d\b/g)) if (!g.evidence.some(e => e.protein?.toLowerCase() === cd.toLowerCase())) fail(`look-alike ${g.id}`, `${cd} has no source`);
  for (const m of g.members) if (!byId.has(m)) fail(`look-alike ${g.id}`, `${m} is not a node`);
}
let figuresChecked = 0;
const figureFiles = new Set();
const svgCache = new Map(), svgText = url => { if (!svgCache.has(url)) svgCache.set(url, fs.readFileSync(publicPath(url), 'utf8')); return svgCache.get(url); };
function checkFigures(list, where, nodeId, max = 3) {
  if (list === undefined) return;
  if (!Array.isArray(list)) return fail(where, 'figures must be a list');
  if (list.length > max) fail(where, `${list.length} figures; at most ${max}`);
  for (const f of list) {
    figuresChecked++;
    const what = `${where} figure ${f.id}`;
    if (!FIGURE_KINDS.has(f.kind)) fail(what, `bad kind ${f.kind}`);
    if (!FIGURE_LICENCES.has(f.license) || !f.licenseUrl) fail(what, `licence ${f.license} is not CC BY 4.0 or public domain`);
    if (!f.credit?.trim() || !f.pageUrl || !f.title || !f.caption || !f.alt || !f.sourceName || !f.match) fail(what, 'needs credit, page link, title, caption, alt text, source name and how it matched');
    if (!['auto', 'reviewed'].includes(f.status)) fail(what, `bad status ${f.status}`);
    if (requirePath(f.thumb, what, 'figure thumbnail')) figureFiles.add(f.thumb);
    if (requirePath(f.url, what, f.ftu ? 'tissue unit illustration' : 'figure image') && !f.ftu) figureFiles.add(f.url);
    if (/wiki(pedia|media)/i.test(JSON.stringify(f))) fail(what, 'Wikipedia or Wikimedia source or text is not allowed');
    if (f.source === 'openstax') {
      if (OPENSTAX_RIGHTS.test(f.caption)) fail(what, 'OpenStax caption carries third-party rights');
      for (const [, c] of f.caption.matchAll(/\(([^()]*\bcredit\b[^()]*)\)/gi)) if (!OPENSTAX_PD.test(c)) fail(what, `OpenStax caption credits a third party (${c})`);
    }
    if (f.ftu && f.url && fs.existsSync(publicPath(f.url))) {  // clickable cells: a Cell Ontology id and elements the SVG has
      const svg = svgText(f.url);
      for (const h of f.ftu.hits ?? []) {
        if (!/^CL:\d+$/.test(h.cl) || !h.label || !h.ids?.length) fail(what, 'clickable cell needs a CL id, label and element ids');
        for (const id of h.ids ?? []) if (!svg.includes(`id="${id}"`)) fail(what, `no element id "${id}" for ${h.cl}`);
      }
    }
    if (f.focus && !(f.ftu?.hits ?? []).some(h => h.cl === f.focus)) fail(what, `highlights ${f.focus}, which the illustration does not draw`);
    if (nodeId && lookAlikeOf.has(nodeId) && !f.caption.includes(lookAlikeOf.get(nodeId))) fail(what, 'caption lacks the sentence naming the proteins that tell this cell type from its look-alikes');
    // An HPA image of a protein the ASCT+B tables list as a biomarker of the cell type (step 10 checks the tables): shown
    // only for that cell type, its page is that gene's, and its caption says so.
    if (f.marker) {
      const m = f.marker;
      if (f.source !== 'hpa' || !/^HGNC:\d+$/.test(m.hgnc ?? '') || !/^ENSG\d+$/.test(m.ensembl ?? '') || !m.symbol || !m.tables?.length) fail(what, 'biomarker record needs an HPA source, HGNC id, Ensembl id, gene symbol and ASCT+B tables');
      for (const t of m.tables ?? []) if (!ASCTB_TABLES.has(t)) fail(what, `biomarker table "${t}" is not an ASCT+B table in pipeline/maps/hra-release.json`);
      if (nodeId && m.cell !== nodeId) fail(what, `shows a biomarker of ${m.cell}, not of ${nodeId}`);
      if (!f.pageUrl.includes(`/${m.ensembl}-`)) fail(what, `page link is not the HPA page of ${m.ensembl}`);
      if (!f.caption.includes(`lists ${m.symbol} as a biomarker`)) fail(what, 'caption does not say the protein is an ASCT+B biomarker');
    }
    // Gray's Anatomy (1918): a last resort, only for bones, muscles, vessels and nerves, never beside another source's
    // figure, and always with its fixed caption (pipeline/maps/figure-sources.json `grays`).
    if (f.source === 'grays') {
      const g = figureSources.grays, node = nodeId ? byId.get(nodeId) : null;
      if (f.caption !== g.caption) fail(what, `Gray's plate caption must be exactly "${g.caption}"`);
      if (!node || ![node.id, ...(node.ancestors ?? [])].some(a => g.classes.includes(a))) fail(what, "Gray's plates are only for bones, muscles, vessels and nerves");
      if (list.some(x => x.source !== 'grays')) fail(what, "Gray's plates are shown only where no other source has a figure");
    }
  }
}

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

const entryCount = {}, bySource = {}, organBySource = {}, byStatus = {}, byScale = {};
for (const n of nodes) {
  if (!/^(FMA|UBERON|CL|GO):\d+$/.test(n.id) || n.conceptId !== n.id.replace(':', '')) fail(n.id, 'bad id or conceptId');
  if (!SCALES.includes(n.scale)) fail(n.id, `bad scale ${n.scale}`);
  if (CELL_SCALES.has(n.scale) ? n.system !== null && !systems.has(n.system) : !systems.has(n.system)) fail(n.id, `bad system ${n.system}`);
  if (n.scale === 'cell' && n.id !== 'CL:0000000' && !(n.connections ?? []).some(c => c.rel === 'located_in')) fail(n.id, 'cell type has no located_in');
  if (n.scale === 'organelle' && !(n.connections ?? []).some(c => c.rel === 'component_of')) fail(n.id, 'organelle has no component_of');
  if (!n.label?.trim()) fail(n.id, 'no label');
  if (!n.geometry?.male?.length && !n.geometry?.female?.length && !n.geometry?.models?.length && !n.geometry?.model) fail(n.id, 'no geometry in any body or model');
  if (CELL_SCALES.has(n.scale)) {
    const m = cellModels.get(n.geometry?.model);
    if (!m) fail(n.id, `cell model ${n.geometry?.model} is not one step 13 built`);
    else if (!m.concepts.some(c => c.id === n.conceptId) && n.scale === 'organelle') fail(n.id, `organelle is not drawn in ${n.geometry.model}`);
    if (n.scale === 'cell' && n.id !== 'CL:0000000' && m) {
      cellShapesChecked++;
      const want = shapeOf(n.id, cellTerms.get(n.id)?.ancestors ?? []);
      if (n.geometry.model !== want.model || n.geometry.shape?.variant !== want.variant) fail(n.id, `3D model ${n.geometry.model} is not the one the family rules give (${want.model}); rerun step 11`);
      if (n.geometry.shape?.nucleus !== drawsNucleus(m)) fail(n.id, `shape says nucleus: ${n.geometry.shape?.nucleus} but ${n.geometry.model} ${drawsNucleus(m) ? 'draws' : 'does not draw'} one`);
      if (ontologySaysNoNucleus(n.id) && drawsNucleus(m)) fail(n.id, `Cell Ontology says this cell type has no nucleus, but ${n.geometry.model} draws one`);
      // A NeuroMorpho.Org reconstruction carries its full credit (the three citations its terms require) and is listed in ATTRIBUTION.md.
      const rec = n.geometry.shape?.reconstruction;
      if (n.geometry.shape?.family === 'reconstruction' && (!rec?.nmoId || rec.license !== 'CC BY 4.0' || !rec.paper?.citation || !rec.page || !/NeuroMorpho\.Org \(RRID:SCR_002145; Tecuatl C/.test(rec.attribution ?? '')))
        fail(n.id, 'reconstruction needs its NeuroMorpho ID, page, original paper, CC BY 4.0 and the NeuroMorpho.Org citations');
      if (rec?.nmoId && !attributionText.includes(rec.nmoId)) fail(n.id, `${rec.nmoId} is not credited in public/ATTRIBUTION.md`);
      // A model drawn from a morphology profile draws what the profile states it has.
      if (PROFILES[n.id] && n.morphology?.claims !== PROFILES[n.id].claims.length) fail(n.id, 'cell type with a morphology profile does not carry it; rerun step 11');
      if (n.geometry.shape?.family === 'profile') {
        const prof = PROFILES[n.id], drawn = new Set(m.palette.map(x => x.id));
        for (const c of prof?.claims ?? []) for (const [field, rx, part] of PROFILE_PARTS) if (c.field === field && rx.test(c.value) && !drawn.has(part)) fail(n.id, `profile states ${field} "${c.value}" but ${n.geometry.model} draws no ${part}`);
      }
    }
  }
  if (!n.ladder || !(systems.has(n.ladder.system) || (CELL_SCALES.has(n.scale) && n.ladder.system === null))) fail(n.id, 'no ladder');
  if (n.ladder?.organ && !byId.has(n.ladder.organ.id)) fail(n.id, `ladder organ ${n.ladder.organ.id} is not a node`);
  if (n.content?.tier1?.status === 'missing') fail(n.id, 'no tier-1 text');
  if (!index.has(n.conceptId)) fail(n.id, 'missing from public/content/index.json');
  let served = null;
  if (requirePath(`/content/${n.conceptId}.json`, `graph node ${n.id}`, 'content file'))
    try { served = JSON.parse(read(`public/content/${n.conceptId}.json`)); } catch { fail(n.id, 'served content file is not valid JSON'); }
  if (served && (served.id !== n.id || 'ancestors' in served)) fail(n.id, 'served file does not match node');
  if (served && PROFILES[n.id] && served.morphology?.claims?.length !== PROFILES[n.id].claims.length) fail(n.id, 'served file lacks its morphology profile; rerun step 11');
  checkFigures(served?.figures, `${n.conceptId}.json`, n.id);
  // What the app opens from this file: organ interiors (this body's and the ladder organ's), the cell model, tissue boards.
  for (const [where, urls] of [...Object.entries(served?.geometry?.interior ?? {}), ...Object.entries(served?.ladder?.organ?.interior ?? {}).map(([k, v]) => [`ladder ${k}`, v])])
    for (const u of urls) requireManifest(u, `${n.conceptId}.json ${where} interior`);
  if (served?.geometry?.model) requireManifest(served.geometry.model, `${n.conceptId}.json model`);
  for (const t of [...(served?.ladder?.organ?.tissue ?? []), ...(served?.ladder?.board?.tissue ?? [])]) requirePath(t, `${n.conceptId}.json tissue board`, 'tissue board');
  for (const c of served?.connections ?? []) {
    const where = `connection ${c.rel} ${c.id}`;
    if (!CONNECTIONS.includes(c.rel) || !['in', 'out'].includes(c.dir)) fail(n.id, `${where}: bad relation or direction`);
    if (!c.label?.trim()) fail(n.id, `${where}: no label`);
    if (c.modeled && (!byId.has(c.id) || byId.get(c.id).conceptId !== c.conceptId)) fail(n.id, `${where}: selectable connection points at no node`);
    if (!c.sources?.length || c.sources.some(x => !x.name || !x.license || !x.url)) fail(n.id, `${where}: sources need name, license, url`);
    if (mentionsWikipedia(c)) fail(n.id, `${where}: Wikipedia source is not allowed`);
    if (!c.modeled && c.conceptId) fail(n.id, `${where}: label-only connection must not be selectable`);
    const e = (entryCount[c.rel] ??= {modeled: 0, label: 0});
    e[c.modeled ? 'modeled' : 'label']++;
  }
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
for (const id of index) if (!byId.has(id.replace(/^(FMA|UBERON|CL|GO)(\d)/, '$1:$2'))) fail(id, 'index lists an id with no node');
// Tissue unit illustrations are shown inline (so their cells can be clicked): nothing executable may ship.
const ftuDir = path.join(root, 'public/ftu');
for (const f of fs.existsSync(ftuDir) ? fs.readdirSync(ftuDir).filter(f => f.endsWith('.svg')) : [])
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:/i.test(svgText(`/ftu/${f}`))) fail(`ftu/${f}`, 'has a script, event handler, foreign object or javascript: link');
// Tissue boards and their media.
const tissueDir = path.join(root, 'public/tissue');
for (const f of fs.existsSync(tissueDir) ? fs.readdirSync(tissueDir) : []) {
  const b = JSON.parse(fs.readFileSync(path.join(tissueDir, f), 'utf8')), where = `tissue/${f}`;
  if (!byId.has(b.organ?.id)) fail(where, 'board organ is not a node');
  for (const g of b.groups ?? []) for (const c of g.cells) { if (!byId.has(c.id)) fail(where, `cell type ${c.id} is not a node`); else if (c.model !== byId.get(c.id).geometry?.model) fail(where, `cell type ${c.id} opens ${c.model}, its node says ${byId.get(c.id).geometry?.model}`); }
  for (const t of b.tables ?? []) if (!t.doi || !t.version) fail(where, `table ${t.name} needs version and DOI`);
  checkFigures(b.figures, where, b.organ?.id);
  checkFigures(b.units, `${where} units`, null, Infinity);
  if ('media' in b) fail(where, 'boards list figures and units, not media; rerun step 11');
}
// Every tissue board opens from somewhere: a structure in the body whose tissue reaches it (its ladder board, else its
// organ's; or its organ's from inside that organ's interior), or an organ on its own stage (pipeline/maps/standalone-organs.json).
const opensBoard = new Set(standaloneList.flatMap(o => o.tissue ?? []));
for (const n of nodes) if (conceptIds.has(n.conceptId)) {
  const l = n.ladder ?? {};
  for (const t of [...((l.board ?? l.organ)?.tissue ?? []), ...(l.organ?.interior?.male?.length ? l.organ.tissue ?? [] : [])]) opensBoard.add(t);
}
for (const f of fs.existsSync(tissueDir) ? fs.readdirSync(tissueDir) : []) if (!opensBoard.has(`/tissue/${f}`)) fail(`tissue/${f}`, 'nothing opens this board: no structure in the body reaches it and no organ on its own stage shows it (pipeline/maps/standalone-organs.json)');
// Search and cell stages (public/content/cells.json, step 11): every cell type and organelle is searchable, each cell type
// opens its node's model, an organelle opens in a cell whose model draws it, and each "Found in" link opens a board that
// lists the cell type, from a body concept whose tissue reaches that board or an organ on its own stage that shows it.
const gidOf = cid => cid.replace(/^(FMA|UBERON|CL|GO)(\d)/, '$1:$2');
if (!fs.existsSync(path.join(root, 'public/content/cells.json'))) fail('public/content/cells.json', 'missing; run step 11');
else {
  const ci = JSON.parse(read('public/content/cells.json')), where = 'content/cells.json';
  const cells = new Map(ci.cells.map(c => [c.id, c])), organelles = new Map(ci.organelles.map(o => [o.id, o]));
  if (cells.size !== ci.cells.length || organelles.size !== ci.organelles.length) fail(where, 'duplicate ids');
  for (const n of nodes) {
    if (n.scale === 'cell' && !cells.has(n.conceptId)) fail(where, `cell type ${n.id} (${n.label}) is not searchable`);
    if (n.scale === 'organelle' && !organelles.has(n.conceptId)) fail(where, `organelle ${n.id} (${n.label}) is not searchable`);
  }
  for (const c of ci.cells) {
    const n = byId.get(gidOf(c.id));
    if (n?.scale !== 'cell') { fail(where, `${c.id} is not a cell type node`); continue; }
    if (c.label !== n.label || c.model !== n.geometry?.model) fail(where, `${c.id}: label or model differs from its node`);
    if (![c.names, c.terms ?? []].every(list => Array.isArray(list) && list.every(x => typeof x === 'string' && x.trim()))) fail(where, `${c.id}: bad names or terms`);
    requireManifest(c.model, where);
  }
  const drawnBy = new Map(), drawn = url => { if (!drawnBy.has(url)) { let m = null; try { m = JSON.parse(fs.readFileSync(publicPath(url), 'utf8')); } catch { m = null; } drawnBy.set(url, new Set((m?.concepts ?? []).map(x => x.id))); } return drawnBy.get(url); };
  for (const o of ci.organelles) {
    const n = byId.get(gidOf(o.id)), c = cells.get(o.cell);
    if (n?.scale !== 'organelle') { fail(where, `${o.id} is not an organelle node`); continue; }
    if (!c) { fail(where, `${o.id} opens in ${o.cell}, which is not a searchable cell type`); continue; }
    if (!drawn(c.model).has(o.id)) fail(where, `${o.id} (${o.label}) opens in ${c.label}, whose model ${c.model} does not draw it`);
  }
  if (/wiki(pedia|media)/i.test(JSON.stringify(ci))) fail(where, 'Wikipedia text');
  const aloneOrgans = new Map(JSON.parse(read('public/models/organs/standalone.json')).map(s => [s.object, s]));
  for (const n of nodes) for (const c of n.scale === 'cell' ? n.connections ?? [] : []) {
    if (!c.board) continue;
    const what = `${n.id} Found in ${c.label}`, url = `/tissue/${c.board.conceptId}.json`;
    if (!requirePath(url, what, 'tissue board')) continue;
    const b = JSON.parse(fs.readFileSync(publicPath(url), 'utf8'));
    if (!(b.groups ?? []).some(g => g.cells.some(x => x.id === n.id))) fail(what, `board ${url} does not list ${n.label}`);
    const ladder = c.board.id ? byId.get(gidOf(c.board.id))?.ladder : null;
    const opens = c.board.id ? conceptIds.has(c.board.id) && ((ladder?.board ?? ladder?.organ)?.tissue ?? []).includes(url) : (aloneOrgans.get(c.board.organ)?.tissue ?? []).includes(url);
    if (!opens) fail(what, `board ${url} does not open from ${c.board.id ? `body concept ${c.board.id}` : `organ ${c.board.organ}`}`);
  }
}
// Files the app can request, continued (standalone organs, content files and board images are checked above).
// Paths written in the app's code: the body manifest, the cell model, standalone.json, content/index.json.
for (const f of fs.readdirSync(path.join(root, 'app')).filter(f => /\.tsx?$/.test(f))) {
  for (const [, url] of fs.readFileSync(path.join(root, 'app', f), 'utf8').matchAll(/['"`](\/(?:models|content|tissue|figures|ftu)\/[^'"`$\s]+)['"`]/g)) {
    if (/^\/models\/.+\.json$/.test(url) && !url.endsWith('/standalone.json')) requireManifest(url, `app/${f}`); else requirePath(url, `app/${f}`);
  }
}
// Every model manifest deployed under public/models (so an orphaned one cannot ship with missing chunks), and the HRA models.
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
for (const f of walk(path.join(root, 'public/models')).filter(f => f.endsWith('.json'))) {
  const url = '/' + path.relative(path.join(root, 'public'), f).split(path.sep).join('/');
  let m = null;
  try { m = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { fail(url, 'not valid JSON'); continue; }
  if (!Array.isArray(m) && 'chunks' in m) requireManifest(url, url);
}
for (const [object, m] of Object.entries(hraModels)) {
  if (!m.archived) requireManifest(m.manifest, `graph/hra-models.json ${object}`);
  else if (fs.existsSync(publicPath(m.manifest))) fail(object, `archived model ${m.manifest} is still under public/, so it would be deployed`);
}
// public/figures/: at most 60 MB (docs/FIGURES-PLAN.md decision 4), every file under 50 MB, and nothing there the app never shows.
const figuresDir = path.join(root, 'public/figures');
if (fs.existsSync(figuresDir)) {
  let bytes = 0;
  for (const f of fs.readdirSync(figuresDir)) {
    const size = fs.statSync(path.join(figuresDir, f)).size;
    bytes += size;
    if (size >= 50 * 2 ** 20) fail(`figures/${f}`, 'file is 50 MB or more');
    if (!figureFiles.has(`/figures/${f}`)) fail(`figures/${f}`, 'no content file or board shows it; rerun step 10');
  }
  if (bytes > 60 * 2 ** 20) fail('public/figures', `${(bytes / 2 ** 20).toFixed(1)} MB, over the 60 MB limit`);
}
for (const [url, {what, from}] of missing) {
  const [first, ...rest] = from;
  fail(url, `${what} is not under public/ (referenced by ${first}${rest.length ? ` and ${rest.length} more` : ''})`);
}

// Every relation a panel can show needs a heading in app/anatomy.ts; without one the panel prints the raw id ("located_in").
const relationLabels = fs.readFileSync(path.join(root, 'app/anatomy.ts'), 'utf8').match(/RELATION_LABELS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '';
for (const rel of CONNECTIONS) if (!new RegExp(`^\\s*${rel}:\\{out:'[^']+',in:'[^']+'\\}`, 'm').test(relationLabels)) fail(rel, 'relation has no panel heading in RELATION_LABELS (app/anatomy.ts)');

const relCount = {}, relSources = {};
for (const e of edges) {
  if (!byId.has(e.from) || !byId.has(e.to)) fail(`${e.from}→${e.to}`, 'dangling edge');
  if (!RELS.includes(e.rel)) fail(`${e.from}→${e.to}`, `bad relation ${e.rel}`);
  relCount[e.rel] = (relCount[e.rel] ?? 0) + 1;
  if (CONNECTIONS.includes(e.rel)) {
    if (!e.source || !e.license) fail(`${e.from}→${e.to}`, 'connection edge needs source and license');
    const s = (relSources[e.rel] ??= {});
    s[e.source] = (s[e.source] ?? 0) + 1;
  }
}

const organs = nodes.filter(isOrgan).length;
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)];
const order = Object.keys(SOURCE_LABEL);
const lines = ['# Coverage report', '', 'Generated by `pipeline/12-validate.mjs`. No Wikipedia text is used anywhere.', '',
  `- Nodes: ${nodes.length} (male atlas concepts: ${conceptIds.size}; HRA concepts: ${hraConceptIds.size})`,
  `- Organs (${ORGAN} Organ and its is_a descendants): ${organs}`,
  `- Edges: ${edges.length} (${RELS.map(r => `${r} ${relCount[r] ?? 0}`).join(', ')})`,
  `- 3D cells: ${cellModels.size} models; ${cellShapesChecked} cell types checked against the shape rules, none drawing a nucleus where its family or Cell Ontology says it has none`,
  `- Morphology profiles: ${Object.keys(PROFILES).length} cell types, ${profileClaims} claims, each quoting a CC BY source (${Object.values(PROFILES).filter(p => p.status === 'drafted').length} unreviewed); failed claims are listed in reports/morphology-check.md`,
  `- Figures: ${figuresChecked} shown in content files and on boards (${figureFiles.size} image files under public/figures/), each CC BY 4.0 or public domain with its credit and link`,
  `- Files the app can request: ${requested.size} checked, ${missing.size} missing under public/ (${manifests.size} model manifests and their chunks, content files listed in the index, tissue boards and their images)`,
  `- Validation errors: ${errors.length}`, '',
  '## Edges by relation', '',
  ...table(['Relation', 'Edges', 'FMA only', 'HRA VCCF only', 'Both'], RELS.filter(r => relCount[r]).map(r => [r, relCount[r],
    ...(CONNECTIONS.includes(r) ? ['FMA', 'HRA VCCF', 'FMA; HRA VCCF'].map(k => relSources[r]?.[k] ?? 0) : ['', '', ''])])), '',
  '## Panel connection entries by relation', '',
  'Each edge appears on both structures it joins. Label-only entries name a structure FMA lists but BodyParts3D does not model in 3D; they are not graph edges.', '',
  ...table(['Relation', 'Selectable', 'Label only'], CONNECTIONS.filter(r => entryCount[r]).map(r => [r, entryCount[r].modeled, entryCount[r].label])), '',
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
