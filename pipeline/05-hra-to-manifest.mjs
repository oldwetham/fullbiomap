// Step 05: HRA v2.5 GLBs -> part/chunk manifests (female body and organ interiors).
// Usage: node pipeline/05-hra-to-manifest.mjs [object ...]   (default: every object in pipeline/maps/hra-release.json)
//
// Inputs: data/raw/hra/v2.5/<object>/<file>.glb + crosswalk.csv (step 04), graph/defs.jsonl
// (Uberon <-> FMA xrefs), public/models/atlas.json (male systems), pipeline/maps/hra-organ-systems.json.
// Outputs, then optimized (weld + simplify) and gzip-only compressed by the existing scripts:
//   public/models/female/atlas.json   the united female body; feet on the stage like the male
//   public/models/organs/<object>.json one interior per organ GLB, normalized onto the stage
//                                      (centered, base on the platform, largest side 1.4 m)
//   graph/hra-models.json             what each manifest is and which structure it attaches to
//   reports/hra.md                    counts, systems, interiors, sizes
// Concept ids are the crosswalk's ontology id: Uberon where HRA gives one, else HRA's FMA id.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.join(root, p);
const release = JSON.parse(fs.readFileSync(rel('pipeline/maps/hra-release.json'), 'utf8'));
const systemTable = JSON.parse(fs.readFileSync(rel('pipeline/maps/hra-organ-systems.json'), 'utf8')), organSystems = systemTable.organs, meshSystems = systemTable.meshes ?? {};
const atlas = JSON.parse(fs.readFileSync(rel('public/models/atlas.json'), 'utf8'));
const defs = fs.readFileSync(rel('graph/defs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const STAGE_SIZE = 1.4;

// Male concept systems and Uberon -> FMA aliases (only when exactly one male concept has that Uberon id).
const partSystem = new Map(atlas.parts.map(p => [p.id, p.system]));
const maleSystem = new Map(atlas.concepts.map(c => {
  const n = {};
  for (const e of c.elements) n[partSystem.get(e)] = (n[partSystem.get(e)] ?? 0) + 1;
  return [c.id, Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]];
}));
const byUberon = new Map();
for (const d of defs) if (d.uberon) byUberon.set(d.uberon.id, [...(byUberon.get(d.uberon.id) ?? []), d.conceptId]);
const compact = id => id.replace(':', '');
const hraDefsFile = rel('graph/defs.hra.jsonl');
// Vessels with no male equivalent: artery or vein from Uberon (step 06) or FMA is_a ancestors (Artery FMA:50720, Vein FMA:50723).
const vesselKind = new Map();
for (const d of fs.existsSync(hraDefsFile) ? fs.readFileSync(hraDefsFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []) {
  const fmaAnc = d.fma?.ancestors ?? [];
  const kind = d.vessel ?? (fmaAnc.includes('FMA:50720') ? 'artery' : fmaAnc.includes('FMA:50723') ? 'vein' : null);
  if (kind) vesselKind.set(d.id, kind);
}
export const maleEquivalent = id => {
  if (id.startsWith('FMA:')) return maleSystem.has(compact(id)) ? compact(id) : null;
  const hits = byUberon.get(id) ?? [];
  return hits.length === 1 ? hits[0] : null;
};

// GLB reader: JSON + BIN chunks, accessors, node world transforms. No compression extensions are used by HRA.
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file}: not a GLB`);
  let offset = 12, json = null, bin = null;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset), type = buf.toString('ascii', offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'JSON') json = JSON.parse(body.toString('utf8'));
    else if (type === 'BIN\0') bin = body;
    offset += 8 + length;
  }
  if (json.extensionsRequired?.length) throw new Error(`${file}: unsupported extensions ${json.extensionsRequired}`);
  const SIZE = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4}, TYPED = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
  const read = index => {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView], T = TYPED[a.componentType], n = SIZE[a.type];
    const start = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? 0, out = new Float64Array(a.count * n);
    if (!stride || stride === n * T.BYTES_PER_ELEMENT) {
      const src = new T(bin.buffer.slice(start, start + a.count * n * T.BYTES_PER_ELEMENT));
      for (let i = 0; i < out.length; i++) out[i] = src[i];
    } else {
      const view = new DataView(bin.buffer);
      const get = {5126: (o) => view.getFloat32(o, true), 5123: (o) => view.getUint16(o, true), 5125: (o) => view.getUint32(o, true), 5121: (o) => view.getUint8(o), 5122: (o) => view.getInt16(o, true), 5120: (o) => view.getInt8(o)}[a.componentType];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = get(start + i * stride + k * T.BYTES_PER_ELEMENT);
    }
    if (a.normalized) { const max = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[a.componentType]; for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i] / max, -1); }
    return out;
  };
  return {json, read};
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}

function readCrosswalk(file) {
  const map = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
    const [node, id, label] = cells;
    if (node && /^(UBERON|FMA):\d+$/.test(id ?? '')) map.set(node, {id, label: label?.trim() || node});
  }
  return map;
}

const humanize = name => name.replace(/^VH_[FM]_/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());

function convert(object, {kind}) {
  const info = release.objects[object];
  const glbFile = info.files.find(f => f.endsWith('.glb')), dir = rel(`data/raw/hra/${release.release}/${object}`);
  const {json, read} = readGlb(path.join(dir, glbFile));
  const crosswalk = readCrosswalk(path.join(dir, 'crosswalk.csv'));
  const organ = object.replace(/-(female|male)(-(left|right))?$/, '');
  const meshes = [], parentOf = new Map(), nodeName = i => json.nodes[i].name ?? `node_${i}`;
  let excluded = 0;
  const walk = (i, parent, matrix) => {
    const n = json.nodes[i], world = mul(matrix, local(n));
    if (EXCLUDE.test(n.name ?? '')) { excluded += 1; return; }
    parentOf.set(i, parent);
    if (n.mesh !== undefined) meshes.push({node: i, world});
    for (const c of n.children ?? []) walk(c, i, world);
  };
  // The united female body includes pregnancy anatomy (placenta and umbilical structures); like the
  // placenta-full-term model, it is left out: Bio Map shows a non-pregnant reference.
  const EXCLUDE = /^VH_F_placenta$/;
  for (const r of json.scenes[json.scene ?? 0].nodes) walk(r, -1, IDENTITY);
  const mapped = i => { for (let k = i; k >= 0; k = parentOf.get(k)) { const m = crosswalk.get(nodeName(k)); if (m) return {...m, node: k}; } return null; };
  // The model's organ: its root, unless the root is an unmapped wrapper (VH_M_eyes) or a whole-system
  // group (crosswalk label "... system", e.g. male reproductive system > prostate); then the one child
  // holding at least two thirds of the meshes, repeatedly. Two even halves (left and right bronchi) mean no single organ.
  // When the object's own HRA graph names exactly one represented organ (pipeline/maps/hra-release.json), that wins.
  const meshCount = new Map(), countMeshes = i => { const n = json.nodes[i]; const c = (n.mesh !== undefined ? 1 : 0) + (n.children ?? []).reduce((t, k) => t + countMeshes(k), 0); meshCount.set(i, c); return c; };
  json.scenes[json.scene ?? 0].nodes.forEach(countMeshes);
  let organNode = null;
  for (const r of json.scenes[json.scene ?? 0].nodes) {
    for (let i = r; i !== undefined;) {
      const m = crosswalk.get(nodeName(i));
      if (m && !/\bsystem\b/i.test(m.label)) { organNode = i; break; }
      const kids = (json.nodes[i].children ?? []).filter(k => !EXCLUDE.test(json.nodes[k].name ?? ''));
      i = kids.find(k => meshCount.get(k) >= (2 / 3) * meshCount.get(i));
    }
    if (organNode !== null) break;
  }
  const represents = release.objects[object].representationOf;
  const rootIds = [represents ? {id: represents, label: [...crosswalk.values()].find(m => m.id === represents)?.label ?? represents} : null, organNode !== null ? crosswalk.get(nodeName(organNode)) : null, ...json.scenes[json.scene ?? 0].nodes.map(r => crosswalk.get(nodeName(r)))].filter(Boolean);
  // Geometry: one part per mesh node; all triangle primitives merged.
  const raw = [];
  let unmapped = 0;
  for (const {node, world} of meshes) {
    const mesh = json.meshes[json.nodes[node].mesh], pos = [], nor = [], idx = [];
    for (const p of mesh.primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const P = read(p.attributes.POSITION), N = p.attributes.NORMAL !== undefined ? read(p.attributes.NORMAL) : null, base = pos.length / 3;
      const I = p.indices !== undefined ? read(p.indices) : Array.from({length: P.length / 3}, (_, k) => k);
      for (let v = 0; v < P.length; v += 3) {
        const [x, y, z] = [P[v], P[v + 1], P[v + 2]];
        pos.push(world[0] * x + world[4] * y + world[8] * z + world[12], world[1] * x + world[5] * y + world[9] * z + world[13], world[2] * x + world[6] * y + world[10] * z + world[14]);
        const [a, b, c] = N ? [N[v], N[v + 1], N[v + 2]] : [0, 1, 0];
        const nx = world[0] * a + world[4] * b + world[8] * c, ny = world[1] * a + world[5] * b + world[9] * c, nz = world[2] * a + world[6] * b + world[10] * c, len = Math.hypot(nx, ny, nz) || 1;
        nor.push(nx / len, ny / len, nz / len);
      }
      for (const k of I) idx.push(k + base);
    }
    if (!idx.length) continue;
    const m = mapped(node);
    if (!m) unmapped++;
    raw.push({node, name: crosswalk.get(nodeName(node))?.label ?? humanize(nodeName(node)), concept: m ?? rootIds[0] ?? null, pos, nor, idx});
  }
  if (raw.some(r => !r.concept)) throw new Error(`${object}: meshes with no ontology id and no mapped root`);
  // Placement: the female body stands on the stage like the male; interiors are centered and scaled.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const r of raw) for (let v = 0; v < r.pos.length; v += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], r.pos[v + k]); hi[k] = Math.max(hi[k], r.pos[v + k]); }
  const scale = kind === 'organ' ? STAGE_SIZE / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) : 1;
  const shift = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2];
  // Systems: the matching male concept's system, else the organ table; no default.
  const systemFor = id => { const eq = maleEquivalent(id); if (eq) return maleSystem.get(eq); const v = vesselKind.get(id); return v === 'artery' ? 'arterial' : v === 'vein' ? 'venous' : null; };
  const organSystem = organSystems[organ]?.system;
  const prefix = kind === 'body' ? 'female' : object;
  const used = new Set(), parts = [], blob = [], chunks = [], missingSystems = [];
  let bytes = 0, chunk = 0, triangles = 0, buffers = [];
  const flush = () => { const name = `${prefix}-src-${chunk}.bin`; blob.push([name, Buffer.concat(buffers)]); chunks.push({url: `/models/${kind === 'body' ? 'female' : 'organs'}/${name}`, bytes}); buffers = []; bytes = 0; chunk++; };
  const append = typed => { const pad = (4 - bytes % 4) % 4; if (pad) { buffers.push(Buffer.alloc(pad)); bytes += pad; } const at = bytes, b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); buffers.push(b); bytes += b.length; return at; };
  for (const r of raw) {
    let id = `${prefix}-${nodeName(r.node)}`;
    for (let k = 2; used.has(id); k++) id = `${prefix}-${nodeName(r.node)}-${k}`;
    used.add(id);
    const system = meshSystems[nodeName(r.node)]?.system ?? systemFor(r.concept.id) ?? organSystem ?? organSystems[organSystemOf(r.node)]?.system;
    if (!system) { missingSystems.push(`${nodeName(r.node)} (${r.concept.id})`); continue; }
    const positions = new Float32Array(r.pos.length), normals = new Int16Array(r.nor.length);
    for (let v = 0; v < r.pos.length; v += 3) for (let k = 0; k < 3; k++) { positions[v + k] = (r.pos[v + k] + shift[k]) * scale; normals[v + k] = Math.round(r.nor[v + k] * 32767); }
    const indices = Uint32Array.from(r.idx);
    if (bytes > 7_000_000) flush();
    const b0 = [Infinity, Infinity, Infinity], b1 = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < positions.length; v += 3) for (let k = 0; k < 3; k++) { b0[k] = Math.min(b0[k], positions[v + k]); b1[k] = Math.max(b1[k], positions[v + k]); }
    parts.push({id, name: r.name, conceptId: compact(r.concept.id), system, chunk, positions: append(positions), normals: append(normals), indices: append(indices), vertexCount: positions.length / 3, indexCount: indices.length, bounds: [b0, b1]});
    triangles += indices.length / 3;
  }
  flush();
  if (missingSystems.length) throw new Error(`${object}: no system for ${missingSystems.length} meshes; add their organ to pipeline/maps/hra-organ-systems.json:\n  ${missingSystems.join('\n  ')}`);
  // Concepts: every mapped node, with all meshes beneath it.
  const partsByNode = new Map(raw.map((r, k) => [r.node, parts[k].id]));
  const concepts = new Map();
  const under = i => [...(partsByNode.has(i) ? [partsByNode.get(i)] : []), ...(json.nodes[i].children ?? []).flatMap(under)];
  json.nodes.forEach((n, i) => {
    const m = crosswalk.get(nodeName(i));
    if (!m) return;
    const els = under(i);
    if (!els.length) return;
    const c = concepts.get(compact(m.id)) ?? {id: compact(m.id), name: m.label, elements: []};
    for (const e of els) if (!c.elements.includes(e)) c.elements.push(e);
    concepts.set(c.id, c);
  });
  for (const p of parts) if (!concepts.has(p.conceptId)) concepts.set(p.conceptId, {id: p.conceptId, name: p.name, elements: [p.id]});
  // HRA hierarchy: each mapped node -> its nearest mapped ancestor with a different id.
  const tree = new Set();
  json.nodes.forEach((n, i) => {
    const m = crosswalk.get(nodeName(i));
    if (!m) return;
    for (let k = parentOf.get(i); k !== undefined && k >= 0; k = parentOf.get(k)) {
      const up = crosswalk.get(nodeName(k));
      if (up && up.id !== m.id) { tree.add(JSON.stringify({from: m.id, to: up.id, fromLabel: m.label, toLabel: up.label})); break; }
    }
  });
  return {parts, concepts: [...concepts.values()], chunks, blob, triangles, unmapped, scale, rootId: rootIds[0]?.id ?? null, organ, tree: [...tree].map(t => JSON.parse(t))};

  // For the united body: the organ a mesh belongs to, from its top-level group's name.
  function organSystemOf(i) {
    for (let k = i; k >= 0; k = parentOf.get(k)) {
      const name = nodeName(k).toLowerCase();
      const hit = Object.keys(organSystems).find(o => (organSystems[o].nodes ?? []).some(p => name.includes(p)));
      if (hit) return hit;
    }
    return null;
  }
}

function write(kind, object, result) {
  const sub = kind === 'body' ? 'female' : 'organs', dir = rel(`public/models/${sub}`);
  fs.mkdirSync(dir, {recursive: true});
  const base = kind === 'body' ? 'atlas' : object;
  for (const f of fs.readdirSync(dir)) if (f.startsWith(kind === 'body' ? 'female-' : `${object}-`) && /\.bin(\.gz)?$/.test(f)) fs.unlinkSync(path.join(dir, f));
  for (const [name, data] of result.blob) fs.writeFileSync(path.join(dir, name), data);
  const info = release.objects[object];
  const manifest = {
    version: `HRA ${release.release} ${object} ${info.version}`, parts: result.parts, chunks: result.chunks, triangles: result.triangles,
    concepts: result.concepts, sex: object.includes('female') ? 'female' : 'male', source: 'HRA', gzipOnly: true,
    scope: kind === 'body' ? `HRA female reference body · ${result.parts.length.toLocaleString('en-US')} meshes` : `HRA ${info.version} ${object} interior`,
    ...(kind === 'organ' ? {stage: {magnification: Number(result.scale.toFixed(2)), rootConceptId: result.rootId && compact(result.rootId)}} : {}),
  };
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(manifest));
  const manifestPath = `${sub}/${base}.json`;
  execFileSync('node', [rel('scripts/optimize-anatomy.mjs'), manifestPath], {stdio: 'inherit'});
  execFileSync('node', [rel('scripts/compress-models.mjs'), manifestPath], {stdio: 'inherit'});
  execFileSync('node', [rel('scripts/validate-atlas.mjs'), manifestPath], {stdio: 'inherit'});
  return manifestPath;
}

const only = process.argv.slice(2);
const objects = Object.keys(release.objects).filter(o => !o.startsWith('asct-b') && (!only.length || only.includes(o)));
const treeFile = rel('graph/hra-tree.jsonl');
const treeEdges = new Map(fs.existsSync(treeFile) ? fs.readFileSync(treeFile, 'utf8').split('\n').filter(Boolean).map(l => { const e = JSON.parse(l); return [`${e.object}|${e.from}|${e.to}`, e]; }) : []);
const models = fs.existsSync(rel('graph/hra-models.json')) ? JSON.parse(fs.readFileSync(rel('graph/hra-models.json'), 'utf8')) : {release: release.release, models: {}};
for (const object of objects) {
  const kind = object === 'united-female' ? 'body' : 'organ';
  const result = convert(object, {kind});
  const manifest = write(kind, object, result);
  const sex = object.includes('female') ? 'female' : 'male';
  const attachTo = kind === 'organ' && result.rootId ? (sex === 'male' ? maleEquivalent(result.rootId) : compact(result.rootId)) : null;
  models.models[object] = {kind, sex, version: release.objects[object].version, manifest: `/models/${manifest}`, parts: result.parts.length,
    concepts: result.concepts.length, unmappedMeshes: result.unmapped, rootConceptId: result.rootId && compact(result.rootId), attachTo, organ: result.organ};
  for (const k of [...treeEdges.keys()]) if (k.startsWith(`${object}|`)) treeEdges.delete(k);
  for (const e of result.tree) treeEdges.set(`${object}|${e.from}|${e.to}`, {object, ...e});
  console.log(`${object}: ${result.parts.length} parts, ${result.concepts.length} concepts, ${result.unmapped} unmapped meshes, attach ${attachTo ?? '-'}`);
}
fs.writeFileSync(rel('graph/hra-models.json'), JSON.stringify(models, null, 1) + '\n');
// Per-system part counts for both bodies: the UI's honest coverage note reads these.
const bySystem = file => { const m = JSON.parse(fs.readFileSync(rel(file), 'utf8')), n = {}; for (const p of m.parts) n[p.system] = (n[p.system] ?? 0) + 1; return {parts: m.parts.length, bySystem: n}; };
if (fs.existsSync(rel('public/models/female/atlas.json'))) {
  fs.writeFileSync(rel('public/models/bodies.json'), JSON.stringify({
    male: {label: 'Male', source: 'BodyParts3D 4.0', manifest: '/models/atlas.json', ...bySystem('public/models/atlas.json')},
    female: {label: 'Female', source: `HRA ${release.release} united female ${release.objects['united-female'].version}`, manifest: '/models/female/atlas.json', gzipOnly: true, ...bySystem('public/models/female/atlas.json')},
  }, null, 1) + '\n');
}
fs.writeFileSync(treeFile, [...treeEdges.values()].sort((a, b) => a.object.localeCompare(b.object) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).map(e => JSON.stringify(e)).join('\n') + '\n');
