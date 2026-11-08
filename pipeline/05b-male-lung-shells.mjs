// Step 05b: male lung surfaces. BodyParts3D models each lung only as bronchial trees and vessels, so
// the five lobe surfaces of HRA v2.5 lung-male are fitted into the BodyParts3D chest and appended to the
// male manifest as a translucent "shell" layer of the respiratory system (docs/PHASE3-FIXES-PLAN.md).
// Usage: node pipeline/05b-male-lung-shells.mjs     (after step 05; idempotent: replaces earlier shells)
//
// Fit (decided 2026-11-07): one uniform scale that keeps HRA's exact lobe shape, as large as fits inside
// the rib cage (FMA7574 rib, 1.2 cm inside the ribs' outer bounds in width and depth), positioned so HRA's
// bronchial tree is centered on ours. If our segmental airways then stick out of the shells by more than
// 1 cm, fall back to a per-axis fit with the largest/smallest scale ratio capped at 1.15. Both fits and
// the measurements are written to the manifest (layers.shell) and reports/lung-shells.md.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MeshoptSimplifier} from 'meshoptimizer';
import {readCrosswalk, readGlb} from './_glb.mjs';

await MeshoptSimplifier.ready;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.join(root, p);
const release = JSON.parse(fs.readFileSync(rel('pipeline/maps/hra-release.json'), 'utf8'));
const OBJECT = 'lung-male', info = release.objects[OBJECT];
const RIB_INSET = 0.012, MAX_PROTRUSION = 0.01, MAX_STRETCH = 1.15;
const LUNGS = {VH_M_lungs_R: 'FMA7309', VH_M_lungs_L: 'FMA7310'};
const LOBES = {  // HRA lobe node -> BodyParts3D lobe concept (crosswalk Uberon ids checked below)
  VH_M_lungs_R_upper_lobe: 'FMA7333', VH_M_lungs_R_middle_lobe: 'FMA7383', VH_M_lungs_R_lower_lobe: 'FMA7337',
  VH_M_lungs_L_upper_lobe: 'FMA7370', VH_M_lungs_L_lower_lobe: 'FMA7371',
};

// Male manifest without any earlier shell layer.
const manifestFile = rel('public/models/atlas.json');
const atlas = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const oldShellChunks = new Set(atlas.chunks.map((c, i) => c.layer === 'shell' ? i : -1).filter(i => i >= 0));
for (const c of atlas.chunks.filter(c => c.layer === 'shell')) for (const f of [c.url, c.gzip]) if (f && fs.existsSync(rel(`public${f}`))) fs.unlinkSync(rel(`public${f}`));
const oldShellParts = new Set(atlas.parts.filter(p => p.layer === 'shell').map(p => p.id));
atlas.parts = atlas.parts.filter(p => p.layer !== 'shell');
atlas.chunks = atlas.chunks.filter(c => c.layer !== 'shell');
if ([...oldShellChunks].some(i => i < atlas.chunks.length)) throw new Error('shell chunk is not last; rebuild the male manifest first');
for (const c of atlas.concepts) c.elements = c.elements.filter(e => !oldShellParts.has(e));
atlas.triangles = atlas.parts.reduce((t, p) => t + p.indexCount / 3, 0);
const concepts = new Map(atlas.concepts.map(c => [c.id, c]));
for (const id of [...Object.values(LUNGS), ...Object.values(LOBES), 'FMA7574']) if (!concepts.has(id)) throw new Error(`male atlas has no concept ${id}`);

// BodyParts3D geometry: segmental airways of both lungs (vertices), and the ribs' bounds.
const chunkData = atlas.chunks.map(c => fs.readFileSync(rel(`public${c.url}`)));
const parts = new Map(atlas.parts.map(p => [p.id, p]));
const verts = id => { const p = parts.get(id), b = chunkData[p.chunk]; return new Float32Array(b.buffer, b.byteOffset + p.positions, p.vertexCount * 3); };
const airwayIds = lung => concepts.get(lung).elements.filter(e => parts.get(e).system === 'respiratory');
const boundsOf = arrays => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const a of arrays) for (let v = 0; v < a.length; v += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a[v + k]); hi[k] = Math.max(hi[k], a[v + k]); } return [lo, hi]; };
const ourAirways = {R: airwayIds('FMA7309').map(verts), L: airwayIds('FMA7310').map(verts)};
const ribs = boundsOf(concepts.get('FMA7574').elements.map(verts));
const inner = [[ribs[0][0] + RIB_INSET, ribs[0][1], ribs[0][2] + RIB_INSET], [ribs[1][0] - RIB_INSET, ribs[1][1], ribs[1][2] - RIB_INSET]];

// HRA lung-male: lobe meshes (welded) and bronchial trees.
const {json, read} = readGlb(rel(`data/raw/hra/${release.release}/${OBJECT}/${info.files.find(f => f.endsWith('.glb'))}`));
const crosswalk = readCrosswalk(rel(`data/raw/hra/${release.release}/${OBJECT}/crosswalk.csv`));
const byName = new Map(json.nodes.map((n, i) => [n.name, i]));
if (json.nodes.some(n => n.matrix || n.translation || n.rotation || n.scale)) throw new Error('lung-male has node transforms; apply them before fitting');
const meshesUnder = name => { const out = [], walk = i => { const n = json.nodes[i]; if (n.mesh !== undefined) out.push(i); for (const c of n.children ?? []) walk(c); }; walk(byName.get(name)); return out; };
function meshGeometry(nodeIndex) {
  const pos = [], idx = [];
  for (const p of json.meshes[json.nodes[nodeIndex].mesh].primitives) {
    const P = read(p.attributes.POSITION), I = read(p.indices), base = pos.length / 3;
    for (const x of P) pos.push(x);
    for (const k of I) idx.push(k + base);
  }
  // Weld coincident vertices (HRA duplicates them at triangle boundaries), as the optimizer does.
  const map = new Map(), remap = new Uint32Array(pos.length / 3), wp = [];
  for (let i = 0; i < pos.length / 3; i++) { const k = `${pos[i * 3]},${pos[i * 3 + 1]},${pos[i * 3 + 2]}`; let j = map.get(k); if (j === undefined) { j = wp.length / 3; map.set(k, j); wp.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); } remap[i] = j; }
  return {name: json.nodes[nodeIndex].name, pos: Float64Array.from(wp), idx: Uint32Array.from(idx, i => remap[i])};
}
const lobes = Object.keys(LOBES).flatMap(lobe => meshesUnder(lobe).map(i => ({...meshGeometry(i), lobe, lung: LUNGS[lobe.replace(/_(upper|middle|lower)_lobe$/, '')]})));
for (const lobe of Object.keys(LOBES)) if (!crosswalk.get(lobe)) throw new Error(`crosswalk has no id for ${lobe}`);
const hraBronchi = {R: meshesUnder('VH_M_bronchi_R').map(i => meshGeometry(i).pos), L: meshesUnder('VH_M_bronchi_L').map(i => meshGeometry(i).pos)};
const shellBounds = boundsOf(lobes.map(l => l.pos)), hraBronchiBounds = boundsOf([...hraBronchi.R, ...hraBronchi.L]), ourAirwayBounds = boundsOf([...ourAirways.R, ...ourAirways.L]);
const size = b => [0, 1, 2].map(k => b[1][k] - b[0][k]), center = b => [0, 1, 2].map(k => (b[0][k] + b[1][k]) / 2);

// Closed-surface tests for the protrusion measure: inside = inside any lobe (ray parity),
// distance outside = to the nearest shell triangle. Triangles are binned on a 1 cm grid.
function measure(scale, shift) {
  const tris = [];
  // Each lobe's segment patches together form one closed surface (checked: every edge used twice, except
  // 4 of about 5,200 in the left lower lobe), so the inside test is per lobe, not per segment patch.
  for (const l of lobes) for (let t = 0; t < l.idx.length; t += 3) tris.push([0, 1, 2].map(c => [0, 1, 2].map(k => l.pos[l.idx[t + c] * 3 + k] * scale[k] + shift[k])).concat([l.lobe]));
  const G = 0.01, key = (a, b, c) => `${a},${b},${c}`, grid = new Map(), yz = new Map();
  tris.forEach((t, n) => {
    const lo = [0, 1, 2].map(k => Math.floor(Math.min(t[0][k], t[1][k], t[2][k]) / G)), hi = [0, 1, 2].map(k => Math.floor(Math.max(t[0][k], t[1][k], t[2][k]) / G));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(n); }
    for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = `${y},${z}`; if (!yz.has(k)) yz.set(k, []); yz.get(k).push(n); }
  });
  const inside = p => {  // count crossings of the +x ray per mesh; odd = inside that mesh
    const crossings = new Map();
    for (const n of yz.get(`${Math.floor(p[1] / G)},${Math.floor(p[2] / G)}`) ?? []) {
      const [a, b, c, mesh] = tris[n];
      const d = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      if (Math.abs(d) < 1e-15) continue;
      const u = ((p[1] - a[1]) * (c[2] - a[2]) - (p[2] - a[2]) * (c[1] - a[1])) / d, v = ((b[1] - a[1]) * (p[2] - a[2]) - (b[2] - a[2]) * (p[1] - a[1])) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      if (a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]) > p[0]) crossings.set(mesh, (crossings.get(mesh) ?? 0) + 1);
    }
    return [...crossings.values()].some(n => n % 2 === 1);
  };
  const closest = (p, [a, b, c]) => {  // point-triangle distance (Ericson, Real-Time Collision Detection 5.1.5)
    const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
    const at = (s, t) => [a[0] + ab[0] * s + ac[0] * t, a[1] + ab[1] * s + ac[1] * t, a[2] + ab[2] * s + ac[2] * t];
    let q;
    if (d1 <= 0 && d2 <= 0) q = a; else {
      const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp), cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
      const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
      if (d3 >= 0 && d4 <= d3) q = b; else if (d6 >= 0 && d5 <= d6) q = c;
      else if (vc <= 0 && d1 >= 0 && d3 <= 0) q = at(d1 / (d1 - d3), 0);
      else if (vb <= 0 && d2 >= 0 && d6 <= 0) q = at(0, d2 / (d2 - d6));
      else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
      else { const den = 1 / (va + vb + vc); q = at(vb * den, vc * den); }
    }
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  };
  const distance = p => {
    const c = p.map(v => Math.floor(v / G));
    let best = Infinity;
    for (let r = 0; r <= 8; r++) {
      for (let x = c[0] - r; x <= c[0] + r; x++) for (let y = c[1] - r; y <= c[1] + r; y++) for (let z = c[2] - r; z <= c[2] + r; z++) {
        if (Math.max(Math.abs(x - c[0]), Math.abs(y - c[1]), Math.abs(z - c[2])) !== r) continue;
        for (const n of grid.get(key(x, y, z)) ?? []) best = Math.min(best, closest(p, tris[n]));
      }
      if (best <= r * G) break;
    }
    return best;
  };
  const out = [];
  let total = 0;
  for (const arrays of [ourAirways.R, ourAirways.L]) for (const a of arrays) for (let v = 0; v < a.length; v += 3) {
    total++;
    const p = [a[v], a[v + 1], a[v + 2]];
    if (!inside(p)) out.push(distance(p));
  }
  out.sort((x, y) => x - y);
  const q = f => out.length ? out[Math.min(out.length - 1, Math.floor(f * out.length))] : 0;
  const offsets = Object.fromEntries(['R', 'L'].map(s => { const ours = center(boundsOf(ourAirways[s])), theirs = center(boundsOf(hraBronchi[s])).map((v, k) => v * scale[k] + shift[k]); return [s, theirs.map((v, k) => +(v - ours[k]).toFixed(4))]; }));
  return {verticesChecked: total, outside: out.length, outsideShare: +(out.length / total).toFixed(4), maxProtrusion: +(out.at(-1) ?? 0).toFixed(4), p95Protrusion: +q(0.95).toFixed(4), airwayCenterOffset: offsets};
}

// Place: HRA bronchi centered on ours, then shifted to keep the shell inside the ribs (width, depth).
function place(scale) {
  const shift = [0, 1, 2].map(k => center(ourAirwayBounds)[k] - scale[k] * center(hraBronchiBounds)[k]);
  for (const k of [0, 2]) {
    const lo = scale[k] * shellBounds[0][k] + shift[k], hi = scale[k] * shellBounds[1][k] + shift[k];
    if (lo < inner[0][k]) shift[k] += inner[0][k] - lo;
    if (hi > inner[1][k]) shift[k] -= hi - inner[1][k];
  }
  return shift;
}
const ribLimit = [0, 1, 2].map(k => k === 1 ? Infinity : size(inner)[k] / size(shellBounds)[k]);
const uniformScale = Math.min(...ribLimit);
const uniform = {method: 'uniform', scale: [uniformScale, uniformScale, uniformScale]};
uniform.translation = place(uniform.scale);
uniform.measure = measure(uniform.scale, uniform.translation);
let chosen = uniform, fallback = null;
if (uniform.measure.maxProtrusion > MAX_PROTRUSION) {
  // Per-axis: match the airway trees' extents, clamp width/depth to the ribs, cap largest/smallest at 1.15.
  const want = [0, 1, 2].map(k => Math.min(size(ourAirwayBounds)[k] / size(hraBronchiBounds)[k], ribLimit[k]));
  const floor = Math.min(...want), scale = want.map(s => Math.min(s, floor * MAX_STRETCH));
  fallback = {method: 'per-axis, stretch capped at 15%', scale};
  fallback.translation = place(scale);
  fallback.measure = measure(fallback.scale, fallback.translation);
  chosen = fallback;
}

// Simplify like the optimizer (0.2% relative error) and append as one chunk at the end of the male manifest.
const shellParts = [], buffers = [];
let bytes = 0;
const append = typed => { const pad = (4 - bytes % 4) % 4; if (pad) { buffers.push(Buffer.alloc(pad)); bytes += pad; } const at = bytes, b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); buffers.push(b); bytes += b.length; return at; };
const chunkIndex = atlas.chunks.length;
const lobeLabel = id => concepts.get(id).name.replace(/^./, c => c.toUpperCase());
let triangles = 0;
for (const l of lobes) {
  const pos = new Float32Array(l.pos.length);
  for (let v = 0; v < pos.length; v += 3) for (let k = 0; k < 3; k++) pos[v + k] = l.pos[v + k] * chosen.scale[k] + chosen.translation[k];
  const target = Math.max(96, Math.floor(l.idx.length * 0.22 / 3) * 3);
  const [simplified] = MeshoptSimplifier.simplify(l.idx, pos, 3, Math.min(l.idx.length, target), 0.002);
  const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
  const positions = new Float32Array(count * 3);
  for (let old = 0; old < remap.length; old++) if (remap[old] !== 0xffffffff) positions.set(pos.subarray(old * 3, old * 3 + 3), remap[old] * 3);
  // Smooth normals from the welded faces (the source normals were split by duplicate vertices).
  const acc = new Float64Array(count * 3);
  for (let t = 0; t < simplified.length; t += 3) {
    const [a, b, c] = [simplified[t], simplified[t + 1], simplified[t + 2]].map(i => positions.subarray(i * 3, i * 3 + 3));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const i of [simplified[t], simplified[t + 1], simplified[t + 2]]) for (let k = 0; k < 3; k++) acc[i * 3 + k] += n[k];
  }
  const normals = new Int16Array(count * 3);
  for (let i = 0; i < count; i++) { const len = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]) || 1; for (let k = 0; k < 3; k++) normals[i * 3 + k] = Math.round(acc[i * 3 + k] / len * 32767); }
  const b0 = [Infinity, Infinity, Infinity], b1 = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < positions.length; v += 3) for (let k = 0; k < 3; k++) { b0[k] = Math.min(b0[k], positions[v + k]); b1[k] = Math.max(b1[k], positions[v + k]); }
  const id = `shell-${l.name}`;
  shellParts.push({id, name: `${lobeLabel(LOBES[l.lobe])} (surface)`, conceptId: l.lung, system: 'respiratory', layer: 'shell', chunk: chunkIndex,
    positions: append(positions), normals: append(normals), indices: append(simplified), vertexCount: count, indexCount: simplified.length, bounds: [b0, b1]});
  triangles += simplified.length / 3;
  for (const c of [l.lung, LOBES[l.lobe]]) concepts.get(c).elements.push(id);
}
fs.writeFileSync(rel('public/models/body-shell-0.bin'), Buffer.concat(buffers));
atlas.chunks.push({url: '/models/body-shell-0.bin', bytes, layer: 'shell'});
atlas.parts.push(...shellParts);
atlas.triangles += triangles;
const fmt = r => ({method: r.method, scale: r.scale.map(v => +v.toFixed(4)), translation: r.translation.map(v => +v.toFixed(4)), ...r.measure});
atlas.layers = {shell: {source: `HRA ${release.release} ${OBJECT} ${info.version}`, doi: info.doi, parts: shellParts.length, fit: fmt(chosen), ...(fallback ? {uniformTried: fmt(uniform)} : {})}};
fs.writeFileSync(manifestFile, JSON.stringify(atlas));
execFileSync('node', [rel('scripts/compress-models.mjs'), 'atlas.json'], {stdio: 'inherit'});
execFileSync('node', [rel('scripts/validate-atlas.mjs')], {stdio: 'inherit'});

const cm = v => `${(v * 100).toFixed(1)} cm`;
const describe = r => [
  `- Scale (x, y, z): ${r.scale.map(v => v.toFixed(3)).join(', ')}; translation (m): ${r.translation.map(v => v.toFixed(3)).join(', ')}`,
  `- HRA bronchial tree center vs ours: right ${r.measure.airwayCenterOffset.R.map(cm).join(', ')}; left ${r.measure.airwayCenterOffset.L.map(cm).join(', ')} (x, y, z)`,
  `- Our segmental airway vertices outside the shells: ${r.measure.outside} of ${r.measure.verticesChecked} (${(r.measure.outsideShare * 100).toFixed(1)}%); furthest ${cm(r.measure.maxProtrusion)}, 95th percentile of those outside ${cm(r.measure.p95Protrusion)}`];
const report = ['# Male lung surfaces', '', `Generated by \`pipeline/05b-male-lung-shells.mjs\`. Source: HRA ${release.release} ${OBJECT} ${info.version} (${info.doi}), five lobe surfaces, ${shellParts.length} meshes, ${triangles.toLocaleString('en-US')} triangles after simplification.`, '',
  `Rib cage (FMA7574) outer bounds: x ${ribs[0][0].toFixed(3)} to ${ribs[1][0].toFixed(3)}, z ${ribs[0][2].toFixed(3)} to ${ribs[1][2].toFixed(3)}; shells kept ${cm(RIB_INSET)} inside in width and depth.`, '',
  '## Uniform fit (keeps HRA\'s lobe shape)', '', ...describe(uniform), '',
  ...(fallback ? [`Our airways stick out by more than ${cm(MAX_PROTRUSION)}, so the per-axis fit is used.`, '', '## Per-axis fit, stretch capped at 15% (used)', '', ...describe(fallback)] : ['Within the 1 cm limit: the uniform fit is used.'])];
fs.writeFileSync(rel('reports/lung-shells.md'), report.join('\n') + '\n');
console.log(report.slice(4).join('\n'));
