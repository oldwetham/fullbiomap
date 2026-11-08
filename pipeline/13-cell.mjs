// Step 13: a stylized generic cell, built procedurally with three.js geometry classes (no extra software).
// Usage: node pipeline/13-cell.mjs
// Writes public/models/cell/generic-cell.json + one gzip-only chunk: an ordinary manifest the organ stage
// loads like an organ interior. Seeded, so every run produces the same bytes. Organelles and colors come
// from pipeline/maps/organelles.json (GO ids); the manifest's palette gives each organelle its own color
// and layer toggle. The membrane is an "envelope" (taps go to what is inside it first); the nucleus is a
// "shell" (first tap selects it, the next reaches the nucleolus). Sizes and counts are illustrative.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.join(root, p);
const {cell, organelles} = JSON.parse(fs.readFileSync(rel('pipeline/maps/organelles.json'), 'utf8'));
const byKey = Object.fromEntries(organelles.map(o => [o.key, o]));
let seed = 20261107;
const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const between = (a, b) => a + (b - a) * rand();
const unit = () => { const v = new THREE.Vector3(between(-1, 1), between(-1, 1), between(-1, 1)); return v.lengthSq() > 1e-4 ? v.normalize() : new THREE.Vector3(0, 1, 0); };

const CENTER = new THREE.Vector3(0, 0.62, 0), RADII = new THREE.Vector3(0.7, 0.58, 0.63);
const NUCLEUS = CENTER.clone().add(new THREE.Vector3(-0.1, 0.04, 0.02)), NUCLEUS_R = 0.22;
const insideCell = (p, margin = 0.05) => ((p.x - CENTER.x) / (RADII.x - margin)) ** 2 + ((p.y - CENTER.y) / (RADII.y - margin)) ** 2 + ((p.z - CENTER.z) / (RADII.z - margin)) ** 2 < 1;
const clearOfNucleus = (p, gap) => p.distanceTo(NUCLEUS) > NUCLEUS_R + gap;
const spot = (gap = 0.06, margin = 0.08) => { for (;;) { const p = new THREE.Vector3(between(-1, 1) * RADII.x, between(-1, 1) * RADII.y, between(-1, 1) * RADII.z).add(CENTER); if (insideCell(p, margin) && clearOfNucleus(p, gap)) return p; } };
const displace = (g, f) => { const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
const strip = g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
const merged = list => mergeGeometries(list.map(strip), false);

const parts = [];
const add = (key, name, geometry, extra = {}) => parts.push({key, name, geometry, ...extra});

// Cell membrane: an irregular ellipsoid (envelope).
add('membrane', 'Cell membrane', displace(new THREE.SphereGeometry(1, 96, 64), v => {
  const w = 1 + 0.035 * Math.sin(3 * v.x + 1.3) * Math.cos(2 * v.y) + 0.025 * Math.sin(4 * v.z + 2 * v.x);
  v.set(v.x * RADII.x * w, v.y * RADII.y * w, v.z * RADII.z * w).add(CENTER);
}), {layer: 'envelope'});
// Nucleus with pore dimples (shell), and a dense nucleolus inside it.
const pores = Array.from({length: 60}, unit);
add('nucleus', 'Nucleus', displace(new THREE.SphereGeometry(NUCLEUS_R, 72, 48), v => {
  const d = v.clone().normalize(), dent = pores.reduce((m, p) => Math.max(m, Math.max(0, 1 - d.distanceTo(p) / 0.09)), 0);
  v.multiplyScalar(1 - 0.05 * dent ** 2).add(NUCLEUS);
}), {layer: 'shell'});
add('nucleolus', 'Nucleolus', displace(new THREE.IcosahedronGeometry(0.065, 3), v => { v.multiplyScalar(1 + 0.08 * Math.sin(7 * v.x) * Math.cos(5 * v.y)).add(NUCLEUS).add(new THREE.Vector3(0.05, 0.03, 0.04)); }));
// Rough ER: four wavy sheets wrapped partly around the nucleus, studded with ribosomes.
const ribosomeSpots = [];
for (let k = 0; k < 4; k++) {
  const r = NUCLEUS_R + 0.06 + k * 0.035;
  const sheet = displace(new THREE.SphereGeometry(r, 64, 32, 0.2 + k * 0.1, Math.PI * 1.1, Math.PI * 0.25, Math.PI * 0.55), v => {
    v.multiplyScalar(1 + 0.04 * Math.sin(9 * Math.atan2(v.z, v.x) + k)).add(NUCLEUS);
  });
  add('rough-er', 'Rough endoplasmic reticulum', sheet);
  const pos = sheet.attributes.position;
  for (let i = 0; i < 90; i++) ribosomeSpots.push(new THREE.Vector3().fromBufferAttribute(pos, Math.floor(rand() * pos.count)));
}
for (let i = 0; i < 90; i++) ribosomeSpots.push(spot(0.08, 0.1));
add('ribosome', 'Ribosomes', merged(ribosomeSpots.map(p => new THREE.IcosahedronGeometry(0.009, 0).translate(p.x, p.y, p.z))));
// Smooth ER: branching tubes beyond the rough ER.
for (let k = 0; k < 7; k++) {
  const start = NUCLEUS.clone().add(unit().multiplyScalar(NUCLEUS_R + 0.22)), pts = [start];
  for (let j = 0; j < 5; j++) { const next = pts.at(-1).clone().add(unit().multiplyScalar(0.07)); if (!insideCell(next, 0.1) || !clearOfNucleus(next, 0.15)) break; pts.push(next); }
  if (pts.length > 2) add('smooth-er', 'Smooth endoplasmic reticulum', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.013, 8, false));
}
// Golgi apparatus: six curved flattened cisternae stacked beside the nucleus, with budding vesicles.
const golgiAt = NUCLEUS.clone().add(new THREE.Vector3(0.33, -0.02, 0.06)), golgiAxis = new THREE.Vector3(1, 0.15, 0.1).normalize();
const golgiTurn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), golgiAxis);
for (let k = 0; k < 6; k++) {
  const width = 0.17 - Math.abs(k - 2.5) * 0.018;
  const disc = new THREE.SphereGeometry(width, 40, 12, 0, Math.PI * 2, 0, Math.PI * 0.35).scale(1, 0.25, 0.55);
  disc.translate(0, -width * 0.8 + k * 0.03, 0).applyQuaternion(golgiTurn).translate(golgiAt.x, golgiAt.y, golgiAt.z);
  add('golgi', 'Golgi apparatus', disc);
}
add('golgi', 'Golgi apparatus', merged(Array.from({length: 12}, () => { const p = golgiAt.clone().add(unit().multiplyScalar(between(0.12, 0.2))); return new THREE.SphereGeometry(0.018, 10, 8).translate(p.x, p.y, p.z); })));
// Mitochondria: twelve capsules, each slightly bent.
for (let k = 0; k < 12; k++) {
  const p = spot(0.12, 0.12), dir = unit(), cap = new THREE.CapsuleGeometry(between(0.03, 0.04), between(0.09, 0.15), 8, 16);
  displace(cap, v => { v.x += 0.012 * Math.sin(v.y * 18); });
  cap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)).translate(p.x, p.y, p.z);
  add('mitochondrion', 'Mitochondrion', cap);
}
// Lysosomes: eight small spheres.
for (let k = 0; k < 8; k++) { const p = spot(0.1, 0.12), r = between(0.028, 0.045); add('lysosome', 'Lysosome', new THREE.SphereGeometry(r, 20, 14).translate(p.x, p.y, p.z)); }
// Cytoskeleton: filaments radiating from near the nucleus (the centrosome) to the membrane.
const centrosome = NUCLEUS.clone().add(new THREE.Vector3(0.24, 0.1, -0.12));
add('cytoskeleton', 'Cytoskeleton', merged(Array.from({length: 46}, () => {
  const d = unit(), end = centrosome.clone(); while (insideCell(end.clone().addScaledVector(d, 0.02), 0.03)) end.addScaledVector(d, 0.02);
  const mid = centrosome.clone().lerp(end, 0.5).add(unit().multiplyScalar(0.03));
  return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(centrosome, mid, end), 24, 0.0035, 5, false);
})));

// Write the manifest (same format as every other model) and one chunk.
const buffers = [];
let bytes = 0;
const append = typed => { const pad = (4 - bytes % 4) % 4; if (pad) { buffers.push(Buffer.alloc(pad)); bytes += pad; } const at = bytes, b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); buffers.push(b); bytes += b.length; return at; };
const counter = {}, out = [];
let triangles = 0;
for (const p of parts) {
  const g = p.geometry.index ? p.geometry : mergeGeometries([p.geometry], false);
  const indexed = g.index ? g : (() => { const n = g.attributes.position.count, idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); return g; })();
  if (!indexed.attributes.normal) indexed.computeVertexNormals();
  const positions = Float32Array.from(indexed.attributes.position.array), n = indexed.attributes.normal.array, normals = new Int16Array(n.length);
  for (let i = 0; i < n.length; i++) normals[i] = Math.round(Math.max(-1, Math.min(1, n[i])) * 32767);
  const indices = Uint32Array.from(indexed.index.array);
  const b0 = [Infinity, Infinity, Infinity], b1 = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < positions.length; v += 3) for (let k = 0; k < 3; k++) { b0[k] = Math.min(b0[k], positions[v + k]); b1[k] = Math.max(b1[k], positions[v + k]); }
  counter[p.key] = (counter[p.key] ?? 0) + 1;
  const o = byKey[p.key];
  out.push({id: `cell-${p.key}-${counter[p.key]}`, name: p.name, conceptId: o.id.replace(':', ''), system: p.key, ...(p.layer ? {layer: p.layer} : {}), chunk: 0,
    positions: append(positions), normals: append(normals), indices: append(indices), vertexCount: positions.length / 3, indexCount: indices.length, bounds: [b0, b1]});
  triangles += indices.length / 3;
}
const dir = rel('public/models/cell');
fs.mkdirSync(dir, {recursive: true});
for (const f of fs.readdirSync(dir)) if (/^generic-cell-.*\.bin(\.gz)?$/.test(f)) fs.unlinkSync(path.join(dir, f));
fs.writeFileSync(path.join(dir, 'generic-cell-0.bin'), Buffer.concat(buffers));
const concepts = organelles.map(o => ({id: o.id.replace(':', ''), name: o.label, elements: out.filter(p => p.system === o.key).map(p => p.id)}));
concepts.unshift({id: cell.id.replace(':', ''), name: 'Cell', elements: out.map(p => p.id)});
fs.writeFileSync(path.join(dir, 'generic-cell.json'), JSON.stringify({
  version: 'Bio Map generic cell v1', source: 'Bio Map (procedural, pipeline/13-cell.mjs)', scope: 'A generic cell: organelles typical of most cells; sizes and numbers are illustrative',
  gzipOnly: true, wholeConcepts: true, stage: {magnification: null, rootConceptId: cell.id.replace(':', '')},
  palette: organelles.map(o => ({id: o.key, color: o.color, label: o.label})),
  parts: out, chunks: [{url: '/models/cell/generic-cell-0.bin', bytes}], triangles, concepts,
}));
execFileSync('node', [rel('scripts/compress-models.mjs'), 'cell/generic-cell.json'], {stdio: 'inherit'});
execFileSync('node', [rel('scripts/validate-atlas.mjs'), 'cell/generic-cell.json'], {stdio: 'inherit'});
console.log(JSON.stringify({parts: out.length, triangles, organelles: Object.fromEntries(Object.entries(counter))}));
