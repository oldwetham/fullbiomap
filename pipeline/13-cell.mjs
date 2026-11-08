// Step 13: the 3D cells, built procedurally with three.js geometry classes (no extra software).
// Usage: node pipeline/13-cell.mjs
// Writes public/models/cell/<model>.json + one gzip-only chunk per model: the generic cell (the fallback for any
// cell type no family rule matches) and each cell family variant some cell type is drawn as
// (pipeline/maps/cell-families.json, chosen by pipeline/_cell-families.mjs; step 11 points cell types at them).
// Each is an ordinary manifest the stage loads like an organ interior, seeded so every run writes the same bytes.
// Parts and colors come from pipeline/maps/organelles.json (GO ids); a model's palette lists only what it draws.
// Membranes are "envelopes" (taps go to what is inside them first); nuclei are "shells" (the first tap selects the
// nucleus, the next reaches the nucleolus). Shapes, sizes and counts are simplified and illustrative. A model for
// cell types without a nucleus draws none (step 12 checks).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CELL_FAMILIES, RECONSTRUCTIONS, captionOf, clAncestors, reconstructionCaption, shapeOf, variantOf} from './_cell-families.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.join(root, p);
const {cell, organelles} = JSON.parse(fs.readFileSync(rel('pipeline/maps/organelles.json'), 'utf8'));
const byKey = Object.fromEntries(organelles.map(o => [o.key, o]));
let seed = 0;
const reseed = s => { seed = typeof s === 'number' ? s : [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261); };
const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const between = (a, b) => a + (b - a) * rand();
const unit = () => { const v = new THREE.Vector3(between(-1, 1), between(-1, 1), between(-1, 1)); return v.lengthSq() > 1e-4 ? v.normalize() : new THREE.Vector3(0, 1, 0); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const displace = (g, f) => { const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
const strip = g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
const merged = list => mergeGeometries(list.map(strip), false);  // the generic cell, exactly as first published
// The family models keep shared vertices (indexed), about a quarter of the size.
const indexed = g => {
  if (!g.index) { const n = g.attributes.position.count, idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
};
const join = list => mergeGeometries(list.filter(Boolean).map(indexed), false);
const UP = V(0, 1, 0);
const along = (g, dir) => g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
const at = (g, p) => g.translate(p.x, p.y, p.z);
const sphere = (p, r, ws = 16, hs = 12) => at(new THREE.SphereGeometry(r, ws, hs), p);
/** A capsule (mitochondrion) with a slight wobble, along `dir` at `p`. */
const capsule = (p, dir, r, len) => at(along(displace(new THREE.CapsuleGeometry(r, len, 6, 12), v => { v.x += r * 0.35 * Math.sin(v.y * 40 / Math.max(len, 0.05)); }), dir), p);
/** A thin curved filament from a to b. */
const filament = (a, b, r = 0.0035, bend = 0.03) => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(unit().multiplyScalar(bend)), b), 20, r, 5, false);
/** A tube through `points` whose radius goes from r0 to r1, closed by a ball at each end (dendrites, axon branches). */
function taperedTube(points, r0, r1, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points), segments = Math.max(8, Math.round(curve.getLength() / 0.02));
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, false), pos = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const r = r0 + (r1 - r0) * (i / segments);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return join([g, sphere(points[0], r0, 12, 8), sphere(points.at(-1), r1, 12, 8)]);
}
/** Points from `start` heading along `dir`, `steps` steps of `step`, bending a little each time. */
function wander(start, dir, steps, step, bend = 0.35) {
  const pts = [start.clone()], d = dir.clone().normalize();
  for (let i = 0; i < steps; i++) { d.add(unit().multiplyScalar(bend)).normalize(); pts.push(pts.at(-1).clone().addScaledVector(d, step)); }
  return pts;
}
/** Superellipsoid at the origin: e1 shapes top and bottom (small = flat), e2 the cross-section (small = square). */
function superellipsoid(a, b, c, e1, e2, ws = 72, hs = 48) {
  const s = (x, e) => Math.sign(x) * Math.abs(x) ** e;
  return displace(new THREE.SphereGeometry(1, ws, hs), v => {
    const eta = Math.asin(Math.max(-1, Math.min(1, v.y))), om = Math.atan2(v.z, v.x), ce = Math.cos(eta);
    v.set(a * s(ce, e1) * s(Math.cos(om), e2), b * s(Math.sin(eta), e1), c * s(ce, e1) * s(Math.sin(om), e2));
  });
}
const superInside = (p, a, b, c, e1, e2) => (Math.abs(p.x / a) ** (2 / e2) + Math.abs(p.z / c) ** (2 / e2)) ** (e2 / e1) + Math.abs(p.y / b) ** (2 / e1) < 1;
/** Height of a superellipsoid's top surface above (x, z), or null outside its footprint. */
const superTop = (x, z, a, b, c, e1, e2) => { const h = Math.abs(x / a) ** (2 / e2) + Math.abs(z / c) ** (2 / e2); return h >= 1 ? null : b * (1 - h ** (e2 / e1)) ** (e1 / 2); };
/** A myofibril: a rod whose radius swells and narrows every `period`, suggesting the bands of its sarcomeres. */
function bandedRod(from, to, r, period, radial = 10) {
  const len = from.distanceTo(to), seg = Math.max(8, Math.round(len / period * 6));
  const g = displace(new THREE.CylinderGeometry(1, 1, len, radial, seg, false), v => { const k = r * (1 + 0.14 * Math.tanh(3 * Math.cos(2 * Math.PI * (v.y + len / 2) / period))); v.x *= k; v.z *= k; });
  return at(along(g, to.clone().sub(from)), from.clone().lerp(to, 0.5));
}
/** A Golgi stack: curved flattened cisternae facing `axis`, with budding vesicles. */
function golgiStack(p, axis, size, count = 5) {
  const turn = new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().normalize()), list = [];
  for (let k = 0; k < count; k++) {
    const w = size * (1 - Math.abs(k - (count - 1) / 2) * 0.12);
    list.push(new THREE.SphereGeometry(w, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.35).scale(1, 0.25, 0.55).translate(0, -w * 0.8 + k * size * 0.18, 0).applyQuaternion(turn).translate(p.x, p.y, p.z));
  }
  for (let k = 0; k < 8; k++) list.push(sphere(p.clone().add(unit().multiplyScalar(between(size * 0.7, size * 1.15))), size * 0.1, 10, 8));
  return join(list);
}
/** Rough ER: curved sheets on spheres around a nucleus centre, plus the ribosome spots they carry. The sheets wrap the
 * back of the nucleus (away from the default camera), so the nucleus itself stays in view. */
function erSheets(center, radius, count, spread = 0.03) {
  const sheets = [], spots = [];
  for (let k = 0; k < count; k++) {
    const r = radius + k * spread, wrap = Math.PI * between(0.7, 1.0), start = Math.PI * 1.5 - wrap / 2 + between(-0.3, 0.3);
    const sheet = displace(new THREE.SphereGeometry(r, 40, 20, start, wrap, Math.PI * between(0.2, 0.3), Math.PI * between(0.4, 0.5)), v => { v.multiplyScalar(1 + 0.04 * Math.sin(9 * Math.atan2(v.z, v.x) + k)).add(center); });
    sheets.push(sheet);
    const pos = sheet.attributes.position;
    for (let i = 0; i < 30; i++) spots.push(new THREE.Vector3().fromBufferAttribute(pos, Math.floor(rand() * pos.count)));
  }
  return {sheets: join(sheets), spots};
}
const ribosomes = spots => join(spots.map(p => at(new THREE.IcosahedronGeometry(0.008, 0), p)));
/** A random point accepted by `ok`, sampled in the box centre ± half. */
const pick = (center, half, ok) => { for (let i = 0; i < 20000; i++) { const p = V(between(-half.x, half.x), between(-half.y, half.y), between(-half.z, half.z)).add(center); if (ok(p)) return p; } throw new Error('no room for an organelle'); };

// ---------------------------------------------------------------------------------------------------------------
// The generic cell, unchanged since it was first published (same seed, same order of random draws).
function genericCell(add) {
  const CENTER = new THREE.Vector3(0, 0.62, 0), RADII = new THREE.Vector3(0.7, 0.58, 0.63);
  const NUCLEUS = CENTER.clone().add(new THREE.Vector3(-0.1, 0.04, 0.02)), NUCLEUS_R = 0.22;
  const insideCell = (p, margin = 0.05) => ((p.x - CENTER.x) / (RADII.x - margin)) ** 2 + ((p.y - CENTER.y) / (RADII.y - margin)) ** 2 + ((p.z - CENTER.z) / (RADII.z - margin)) ** 2 < 1;
  const clearOfNucleus = (p, gap) => p.distanceTo(NUCLEUS) > NUCLEUS_R + gap;
  const spot = (gap = 0.06, margin = 0.08) => { for (;;) { const p = new THREE.Vector3(between(-1, 1) * RADII.x, between(-1, 1) * RADII.y, between(-1, 1) * RADII.z).add(CENTER); if (insideCell(p, margin) && clearOfNucleus(p, gap)) return p; } };
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
}

// The generic shape without a nucleus (lens fibers): membrane and cytoskeleton only; their organelles are gone.
function genericNoNucleus(add) {
  const C = V(0, 0.62, 0), R = V(0.7, 0.58, 0.63);
  add('membrane', 'Cell membrane', displace(new THREE.SphereGeometry(1, 96, 64), v => {
    const w = 1 + 0.035 * Math.sin(3 * v.x + 1.3) * Math.cos(2 * v.y) + 0.025 * Math.sin(4 * v.z + 2 * v.x);
    v.set(v.x * R.x * w, v.y * R.y * w, v.z * R.z * w).add(C);
  }), {layer: 'envelope'});
  const inside = p => ((p.x - C.x) / (R.x - 0.06)) ** 2 + ((p.y - C.y) / (R.y - 0.06)) ** 2 + ((p.z - C.z) / (R.z - 0.06)) ** 2 < 1;
  add('cytoskeleton', 'Cytoskeleton', join(Array.from({length: 60}, () => { const a = pick(C, R, inside), d = unit(), b = a.clone(); while (inside(b.clone().addScaledVector(d, 0.02))) b.addScaledVector(d, 0.02); return a.distanceTo(b) > 0.1 ? filament(a, b, 0.004, 0.05) : null; })));
}

// Round immune cell (lymphocyte-like): a large round nucleus with a notch, a thin rim of cytoplasm.
function immuneCell(add) {
  const C = V(0, 0.62, 0), R = 0.55, N = C.clone().add(V(-0.06, 0.03, 0.05)), NR = 0.35, notch = V(0.75, 0.15, 0.6).normalize();
  add('membrane', 'Cell membrane', displace(new THREE.SphereGeometry(1, 96, 64), v => {
    const w = 1 + 0.02 * Math.sin(11 * v.x + 1) * Math.sin(9 * v.y + 2) * Math.sin(10 * v.z + 3) + 0.012 * Math.sin(23 * v.x) * Math.cos(21 * v.z);
    v.multiplyScalar(R * w).add(C);
  }), {layer: 'envelope'});
  add('nucleus', 'Nucleus', displace(new THREE.SphereGeometry(NR, 72, 48), v => { const d = v.clone().normalize(); v.multiplyScalar(1 - 0.22 * Math.max(0, d.dot(notch)) ** 4).add(N); }), {layer: 'shell'});
  add('nucleolus', 'Nucleolus', displace(new THREE.IcosahedronGeometry(0.06, 3), v => { v.multiplyScalar(1 + 0.08 * Math.sin(7 * v.x)).add(N).add(V(-0.08, 0.06, 0.03)); }));
  const rim = (gap = 0.035, margin = 0.05) => pick(C, V(R, R, R), p => p.distanceTo(C) < R - margin && p.distanceTo(N) > NR + gap);
  const er = erSheets(N, NR + 0.04, 2, 0.03);
  add('rough-er', 'Rough endoplasmic reticulum', er.sheets);
  add('ribosome', 'Ribosomes', ribosomes([...er.spots, ...Array.from({length: 80}, () => rim(0.03, 0.04))]));
  const G = N.clone().addScaledVector(notch, NR * 0.78 + 0.07);
  add('golgi', 'Golgi apparatus', golgiStack(G, notch, 0.08, 3));
  add('mitochondrion', 'Mitochondria', join(Array.from({length: 6}, () => capsule(rim(0.05, 0.07), unit(), 0.024, 0.07))));
  add('lysosome', 'Lysosomes', join(Array.from({length: 9}, () => sphere(rim(0.04, 0.06), between(0.018, 0.03)))));
  const centre = G.clone().addScaledVector(notch, 0.04), inside = p => p.distanceTo(C) < R - 0.03;
  add('cytoskeleton', 'Cytoskeleton', join(Array.from({length: 22}, () => { const d = unit(), end = centre.clone(); while (inside(end.clone().addScaledVector(d, 0.02))) end.addScaledVector(d, 0.02); return end.distanceTo(centre) > 0.08 ? filament(centre, end) : null; })));
}

// Branched immune cell (microglia, dendritic and Langerhans cells): a small round body with several long, branching
// processes reaching out in every direction; no axon.
function branchedImmuneCell(add) {
  const C = V(0, 0.68, 0), R = 0.27, N = C.clone().add(V(-0.03, 0.02, 0.04)), NR = 0.15, notch = V(0.6, 0.3, 0.7).normalize();
  const dirs = [];  // spread over the sphere (a golden-angle spiral), jittered; none points steeply into the floor
  for (let k = 0; k < 8; k++) { const y = 0.9 - (k / 7) * 1.4, r = Math.sqrt(1 - y * y), t = k * 2.39996 + 0.6; dirs.push(V(r * Math.cos(t), y, r * Math.sin(t)).add(unit().multiplyScalar(0.25)).normalize()); }
  add('membrane', 'Cell membrane', displace(new THREE.SphereGeometry(1, 96, 64), v => {
    const d = v.clone().normalize(); let w = 1;
    for (const p of dirs) w += 0.35 * Math.max(0, d.dot(p)) ** 10;
    v.multiplyScalar(R * w).add(C);
  }), {layer: 'envelope'});
  // Points heading along dir with small bends, turning up before they reach the floor.
  const reach = (start, dir, steps, step, bend) => wander(start, dir, steps, step, bend).map(p => { if (p.y < 0.1) p.y = 0.1 + (0.1 - p.y) * 0.3; return p; });
  const processes = [];
  for (const d of dirs) {
    const main = reach(C.clone().addScaledVector(d, R * 1.05), d, 5 + Math.floor(rand() * 3), 0.085, 0.28);
    processes.push(taperedTube(main, 0.038, 0.009));
    for (const i of [2, 4]) {
      if (i >= main.length - 1) continue;
      const branch = reach(main[i], d.clone().add(unit().multiplyScalar(0.9)).normalize(), 3, 0.07, 0.35);
      processes.push(taperedTube(branch, 0.018, 0.005));
      if (rand() < 0.6) processes.push(taperedTube(reach(branch[2], unit().add(d).normalize(), 2, 0.05, 0.4), 0.009, 0.004));
    }
  }
  add('cell-projection', 'Cell processes', join(processes));
  add('nucleus', 'Nucleus', displace(new THREE.SphereGeometry(NR, 64, 40), v => { const d = v.clone().normalize(); v.multiplyScalar(1 - 0.25 * Math.max(0, d.dot(notch)) ** 4).add(N); }), {layer: 'shell'});
  add('nucleolus', 'Nucleolus', sphere(N.clone().add(V(-0.04, 0.03, 0.02)), 0.032, 18, 12));
  const inBody = (gap, margin) => pick(C, V(R, R, R), p => p.distanceTo(C) < R - margin && p.distanceTo(N) > NR + gap);
  const er = erSheets(N, NR + 0.03, 1, 0.02);
  add('rough-er', 'Rough endoplasmic reticulum', er.sheets);
  add('ribosome', 'Ribosomes', ribosomes([...er.spots, ...Array.from({length: 30}, () => inBody(0.02, 0.03))]));
  const G = N.clone().addScaledVector(notch, NR * 0.75 + 0.05);
  add('golgi', 'Golgi apparatus', golgiStack(G, notch, 0.045, 3));
  add('mitochondrion', 'Mitochondria', join(Array.from({length: 5}, () => capsule(inBody(0.03, 0.05), unit(), 0.015, 0.04))));
  add('lysosome', 'Lysosomes', join(Array.from({length: 9}, () => sphere(inBody(0.025, 0.04), between(0.014, 0.022), 12, 8))));
  add('cytoskeleton', 'Cytoskeleton', join(dirs.flatMap(d => [0, 1].map(() => filament(G.clone().add(unit().multiplyScalar(0.02)), C.clone().addScaledVector(d, R * 1.3), 0.003, 0.02)))));
}

// Red blood cell: a biconcave disc (Evans & Fung 1972 shape) of hemoglobin-filled cytoplasm. No nucleus, no organelles.
function redBloodCell(add) {
  const R = 0.66, C = V(0, 0.74, 0);
  const half = rho => 0.5 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (0.207 + 2.003 * rho * rho - 1.123 * rho ** 4);
  const lathe = (scale, extra) => {
    const top = [], n = 60;
    for (let i = 0; i <= n; i++) { const rho = Math.sin((i / n) * Math.PI / 2); top.push(new THREE.Vector2(rho * R * scale, half(rho) * R + extra * Math.sqrt(1 - rho * rho * 0.99))); }
    const pts = [...top, ...top.slice(0, -1).reverse().map(p => new THREE.Vector2(p.x, -p.y))];
    return new THREE.LatheGeometry(pts, 96).rotateX(Math.PI / 2 - 0.62).rotateY(0.38).translate(C.x, C.y, C.z);
  };
  add('cytoplasm', 'Cytoplasm (hemoglobin)', lathe(1, 0));
  add('membrane', 'Cell membrane', lathe(1.012, 0.01), {layer: 'envelope'});
}

// Platelet: a small lens-shaped disc with granules, a few mitochondria and a ring of microtubules. No nucleus.
function platelet(add) {
  const A = 0.64, B = 0.2, C = V(0, 0.72, 0);
  const tilt = g => g.rotateX(Math.PI / 2 - 0.6).rotateY(0.3).translate(C.x, C.y, C.z);
  add('membrane', 'Cell membrane', tilt(displace(new THREE.SphereGeometry(1, 96, 48), v => { const w = 1 + 0.03 * Math.sin(5 * Math.atan2(v.z, v.x)) + 0.015 * Math.sin(11 * Math.atan2(v.z, v.x) + 1); v.set(v.x * A * w, v.y * B, v.z * A * w); })), {layer: 'envelope'});
  const ring = [];
  for (let i = 0; i <= 240; i++) { const t = (i / 240) * Math.PI * 6, r = A * (0.84 + 0.03 * Math.sin(t * 0.5)); ring.push(V(r * Math.cos(t), 0.02 * Math.sin(t * 1.5), r * Math.sin(t))); }
  add('cytoskeleton', 'Microtubule ring (cytoskeleton)', tilt(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring), 480, 0.011, 6, false)));
  const spot = (margin = 0.12) => pick(V(0, 0, 0), V(A, B, A), p => { const r = Math.hypot(p.x, p.z); return r < A * 0.72 && Math.abs(p.y) < (B - 0.06) * Math.sqrt(Math.max(0, 1 - (r / A) ** 2)) && r > margin * 0.2; });
  add('alpha-granule', 'Alpha granules', tilt(join(Array.from({length: 14}, () => sphere(spot(), between(0.045, 0.065), 18, 12)))));
  add('dense-granule', 'Dense granules', tilt(join(Array.from({length: 5}, () => sphere(spot(), 0.03, 14, 10)))));
  add('mitochondrion', 'Mitochondria', tilt(join(Array.from({length: 3}, () => { const d = unit(); d.y *= 0.15; return capsule(spot(), d, 0.024, 0.07); }))));
  add('lysosome', 'Lysosomes', tilt(join(Array.from({length: 3}, () => sphere(spot(), 0.026, 14, 10)))));
}

// Neuron: a cell body with its nucleus and organelles, branching dendrites, and an axon ending in terminals.
function neuron(add) {
  const S = V(-0.3, 0.72, 0), SR = 0.23, axonDir = V(1, -0.05, 0.05).normalize();
  const dendriteDirs = [V(-0.9, 0.45, 0.1), V(-0.7, -0.6, 0.25), V(-0.2, 0.95, -0.25), V(-0.15, -0.95, -0.2), V(-0.85, 0.05, -0.5), V(0.3, 0.85, 0.4)].map(v => v.normalize());
  add('membrane', 'Cell membrane (cell body)', displace(new THREE.SphereGeometry(1, 96, 64), v => {
    const d = v.clone().normalize(); let w = 1;
    for (const p of [axonDir, ...dendriteDirs]) w += 0.3 * Math.max(0, d.dot(p)) ** 8;
    v.multiplyScalar(SR * w).add(S);
  }), {layer: 'envelope'});
  const dendrites = [];
  for (const d of dendriteDirs) {
    const main = wander(S.clone().addScaledVector(d, SR * 1.05), d, 5, 0.085, 0.3);
    dendrites.push(taperedTube(main, 0.042, 0.012));
    for (const i of [2, 3]) { const side = d.clone().add(unit().multiplyScalar(0.9)).normalize(); dendrites.push(taperedTube(wander(main[i], side, 3, 0.07, 0.35), 0.02, 0.007)); }
  }
  add('dendrite', 'Dendrites', join(dendrites));
  const hillock = S.clone().addScaledVector(axonDir, SR * 1.05), start = hillock.clone().addScaledVector(axonDir, 0.12);
  const path = [start, V(0.05, 0.69, 0.04), V(0.3, 0.73, 0.0), V(0.52, 0.67, -0.04), V(0.68, 0.7, 0.0)];
  const axon = [taperedTube([hillock, hillock.clone().lerp(start, 0.5), start], 0.06, 0.025), taperedTube(path, 0.025, 0.02)];
  for (const d of [V(1, 0.6, 0.1), V(1, -0.5, 0.2), V(1, 0.1, -0.6), V(0.8, -0.1, 0.7)]) {
    const tip = wander(path.at(-1), d, 3, 0.06, 0.25);
    axon.push(taperedTube(tip, 0.013, 0.007), sphere(tip.at(-1), 0.026));
  }
  add('axon', 'Axon', join(axon));
  const N = S.clone().add(V(-0.02, 0.02, 0.03)), NR = 0.11;
  add('nucleus', 'Nucleus', new THREE.SphereGeometry(NR, 64, 40).translate(N.x, N.y, N.z), {layer: 'shell'});
  add('nucleolus', 'Nucleolus', sphere(N.clone().add(V(0.02, 0.02, 0.02)), 0.036, 20, 14));
  const inBody = (gap, margin) => pick(S, V(SR, SR, SR), p => p.distanceTo(S) < SR - margin && p.distanceTo(N) > NR + gap);
  const er = erSheets(N, NR + 0.03, 3, 0.022);
  add('rough-er', 'Rough endoplasmic reticulum (Nissl bodies)', er.sheets);
  add('ribosome', 'Ribosomes', ribosomes([...er.spots, ...Array.from({length: 40}, () => inBody(0.02, 0.03))]));
  add('golgi', 'Golgi apparatus', golgiStack(N.clone().add(V(0.1, 0.07, -0.03)), V(1, 0.6, -0.2), 0.05, 4));
  add('mitochondrion', 'Mitochondria', join(Array.from({length: 7}, () => capsule(inBody(0.03, 0.05), unit(), 0.015, 0.04))));
  add('lysosome', 'Lysosomes', join(Array.from({length: 4}, () => sphere(inBody(0.03, 0.04), 0.016, 12, 8))));
  add('cytoskeleton', 'Cytoskeleton (neurofilaments)', join([axonDir, ...dendriteDirs].flatMap(d => [0, 1].map(() => filament(N.clone().addScaledVector(d, NR + 0.01).add(unit().multiplyScalar(0.02)), S.clone().addScaledVector(d, SR * 1.25), 0.003, 0.02)))));
}

// Skeletal muscle fiber: a long cylinder packed with banded myofibrils, many nuclei pressed against its membrane.
function skeletalFiber(add) {
  const Y = 0.62, R = 0.29, X0 = -0.8, X1 = 0.8, period = 0.1;
  add('membrane', 'Cell membrane (sarcolemma)', displace(new THREE.CylinderGeometry(R, R, X1 - X0, 64, 24, false).rotateZ(-Math.PI / 2), v => { const r = Math.hypot(v.y, v.z); if (r > 1e-6) { const k = 1 + 0.015 * Math.sin(v.x * 9 + Math.atan2(v.z, v.y) * 2); v.y *= k; v.z *= k; } v.y += Y; }), {layer: 'envelope'});
  const centres = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const y = j * 0.092 * 0.866, z = i * 0.092 + (j % 2 ? 0.046 : 0); if (Math.hypot(y, z) < 0.175) centres.push([y, z]); }
  add('myofibril', 'Myofibrils', join(centres.map(([y, z]) => bandedRod(V(X0 + 0.03, Y + y, z), V(X1 - 0.03, Y + y, z), 0.04, period))));
  const nuclei = [], nucleoli = [];
  for (let k = 0; k < 7; k++) {
    const angle = k * 2.2 + 0.4, x = X0 + 0.16 + k * 0.205, n = V(x, Y + 0.25 * Math.cos(angle), 0.25 * Math.sin(angle));
    const g = new THREE.SphereGeometry(1, 40, 24).scale(0.11, 0.03, 0.05).rotateX(angle).translate(n.x, n.y, n.z);
    nuclei.push(g); nucleoli.push(sphere(n, 0.014, 10, 8));
  }
  add('nucleus', 'Nuclei', join(nuclei), {layer: 'shell'});
  add('nucleolus', 'Nucleoli', join(nucleoli));
  const clear = (y, z) => centres.every(([cy, cz]) => Math.hypot(y - cy, z - cz) > 0.05);
  const mitos = [];
  for (let k = 0; k < 40; k++) { const p = pick(V(0, Y, 0), V(X1 - 0.1, R, R), q => { const r = Math.hypot(q.y - Y, q.z); return r < 0.22 && clear(q.y - Y, q.z); }); mitos.push(capsule(p, V(1, between(-0.1, 0.1), between(-0.1, 0.1)), 0.014, 0.05)); }
  add('mitochondrion', 'Mitochondria', join(mitos));
  const rings = [];
  for (const [y, z] of centres.filter(([y, z]) => Math.hypot(y, z) > 0.1)) for (let x = X0 + 0.1; x < X1 - 0.08; x += period * 2) rings.push(new THREE.TorusGeometry(0.05, 0.005, 6, 22).rotateY(Math.PI / 2).translate(x, Y + y, z));
  add('sarcoplasmic-reticulum', 'Sarcoplasmic reticulum', join(rings));
}

// Cardiac muscle cell: a branched cell with one central nucleus, myofibrils, many mitochondria, and intercalated
// discs where it meets its neighbours.
function cardiomyocyte(add) {
  const Y = 0.62, fork = V(0.18, Y, 0), period = 0.1;
  const trunk = [V(-0.78, Y - 0.02, 0), V(-0.3, Y + 0.01, 0), fork], up = [fork, V(0.48, Y + 0.17, 0.03), V(0.78, Y + 0.31, 0.05)], down = [fork, V(0.48, Y - 0.17, -0.03), V(0.78, Y - 0.31, -0.05)];
  const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 48, false);
  add('membrane', 'Cell membrane (sarcolemma)', join([tube(trunk, 0.2), tube(up, 0.15), tube(down, 0.15), sphere(fork, 0.2, 48, 32)]), {layer: 'envelope'});
  const disc = (end, before, r) => { const g = displace(new THREE.CylinderGeometry(r, r, 0.03, 64, 1, false), v => { if (Math.abs(v.y) > 0.001) v.y += 0.012 * Math.sign(Math.sin(8 * Math.atan2(v.z, v.x))); }); return at(along(g, end.clone().sub(before)), end); };
  add('intercalated-disc', 'Intercalated discs', join([disc(trunk[0], trunk[1], 0.205), disc(up[2], up[1], 0.155), disc(down[2], down[1], 0.155)]));
  const N = V(-0.24, Y, 0);
  add('nucleus', 'Nucleus', new THREE.SphereGeometry(1, 48, 32).scale(0.13, 0.065, 0.075).translate(N.x, N.y, N.z), {layer: 'shell'});
  add('nucleolus', 'Nucleolus', sphere(N.clone().add(V(0.02, 0.01, 0.01)), 0.022, 14, 10));
  const rods = [], branchRods = [];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, o = V(0, 0.125 * Math.cos(a), 0.125 * Math.sin(a)); rods.push([trunk[0].clone().add(o).add(V(0.03, 0, 0)), fork.clone().add(o)]); }
  for (const [b0, b1] of [[fork, up[2]], [fork, down[2]]]) {
    const axis = b1.clone().sub(b0).normalize(), side = new THREE.Vector3().crossVectors(axis, V(0, 0, 1)).normalize(), side2 = new THREE.Vector3().crossVectors(axis, side);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4, o = side.clone().multiplyScalar(0.08 * Math.cos(a)).addScaledVector(side2, 0.08 * Math.sin(a)); branchRods.push([b0.clone().add(o).addScaledVector(axis, 0.05), b1.clone().add(o).addScaledVector(axis, -0.03)]); }
  }
  add('myofibril', 'Myofibrils', join([...rods.map(([a, b]) => bandedRod(a, b, 0.034, period)), ...branchRods.map(([a, b]) => bandedRod(a, b, 0.028, period))]));
  const mitos = [];
  for (let k = 0; k < 55; k++) {
    const x = between(-0.74, 0.14), a = between(0, Math.PI * 2), r = rand() < 0.5 ? between(0.05, 0.075) : between(0.165, 0.18);
    const p = V(x, Y + r * Math.cos(a), r * Math.sin(a));
    if (Math.abs(x - N.x) < 0.16 && r < 0.09) continue;
    mitos.push(capsule(p, V(1, 0, 0), 0.016, 0.06));
  }
  for (const [b0, b1] of [[fork, up[2]], [fork, down[2]]]) for (let k = 0; k < 10; k++) { const p = b0.clone().lerp(b1, between(0.15, 0.85)).add(unit().multiplyScalar(0.04)); mitos.push(capsule(p, b1.clone().sub(b0), 0.014, 0.05)); }
  add('mitochondrion', 'Mitochondria', join(mitos));
  const rings = [];
  for (const [a, b] of rods) { const dir = b.clone().sub(a), len = dir.length(); for (let t = 0.1; t < len - 0.05; t += period * 2) rings.push(at(along(new THREE.TorusGeometry(0.044, 0.005, 6, 20).rotateX(Math.PI / 2), dir), a.clone().addScaledVector(dir.clone().normalize(), t))); }
  add('sarcoplasmic-reticulum', 'Sarcoplasmic reticulum', join(rings));
}

// Fat cell (white adipocyte): one large lipid droplet fills it; the nucleus is pressed flat against the membrane.
function fatCell(add) {
  const C = V(0, 0.64, 0), R = 0.6, D = C.clone().add(V(0.04, -0.01, -0.04)), DR = 0.53, d = V(-0.5, 0.3, 0.8).normalize();
  add('membrane', 'Cell membrane', displace(new THREE.SphereGeometry(1, 96, 64), v => { v.multiplyScalar(R * (1 + 0.012 * Math.sin(6 * v.x + 1) * Math.cos(5 * v.y))).add(C); }), {layer: 'envelope'});
  add('lipid-droplet', 'Lipid droplet', new THREE.SphereGeometry(DR, 96, 64).translate(D.x, D.y, D.z));
  // A flat nucleus wrapped onto the sphere between the droplet and the membrane, centred on direction d.
  const u = new THREE.Vector3().crossVectors(d, UP).normalize(), w = new THREE.Vector3().crossVectors(u, d), rho = 0.545;
  const wrap = q => { const dir = d.clone().addScaledVector(u, q.x / rho).addScaledVector(w, q.y / rho).normalize(); return C.clone().addScaledVector(dir, rho + q.z); };
  add('nucleus', 'Nucleus', displace(new THREE.SphereGeometry(1, 48, 32).scale(0.21, 0.15, 0.045), v => v.copy(wrap(v))), {layer: 'shell'});
  add('nucleolus', 'Nucleolus', sphere(wrap(V(0.02, 0.01, 0)), 0.022, 14, 10));
  const gap = (margin = 0.012) => pick(C, V(R, R, R), p => { const r = p.distanceTo(C); return r < R - margin && p.distanceTo(D) > DR + margin && p.clone().sub(C).normalize().dot(d) > 0.55 && p.distanceTo(wrap(V(0, 0, 0))) > 0.23; });
  add('mitochondrion', 'Mitochondria', join(Array.from({length: 6}, () => capsule(gap(0.02), unit(), 0.014, 0.04))));
  add('smooth-er', 'Smooth endoplasmic reticulum', join(Array.from({length: 4}, () => { const a = gap(0.025); return taperedTube([a, a.clone().add(unit().multiplyScalar(0.03)), a.clone().add(unit().multiplyScalar(0.05))], 0.008, 0.008, 6); })));
  add('golgi', 'Golgi apparatus', golgiStack(wrap(V(-0.27, 0.04, 0.005)), d, 0.035, 3));
}

// Epithelial cells: a flat plate, a cube or a column, with apical microvilli or cilia where the cell type has them.
const SHAPES = {
  'flat-epithelial': {a: 0.8, b: 0.075, c: 0.66, e1: 0.55, e2: 0.75, center: V(0, 0.62, 0), tilt: [0.62, -0.25]},
  'cube-epithelial': {a: 0.42, b: 0.38, c: 0.42, e1: 0.3, e2: 0.35, center: V(0, 0.62, 0)},
  'column-epithelial': {a: 0.26, b: 0.56, c: 0.26, e1: 0.22, e2: 0.45, center: V(0, 0.61, 0)},
};
function epithelialCell(add, family, apical, noNucleus) {
  const s = SHAPES[family], {a, b, c, e1, e2} = s, flat = family === 'flat-epithelial', column = family === 'column-epithelial';
  const place = g => { if (s.tilt) g.rotateX(s.tilt[0]).rotateY(s.tilt[1]); return at(g, s.center); };
  const bulge = (x, z) => flat && !noNucleus ? Math.exp(-((x / 0.32) ** 2 + (z / 0.27) ** 2)) : 0;
  add('membrane', 'Cell membrane', place(displace(superellipsoid(a, b, c, e1, e2), v => { v.y += v.y > 0 ? 0.1 * bulge(v.x, v.z) : -0.035 * bulge(v.x, v.z); })), {layer: 'envelope'});
  const inside = (p, m) => superInside(p, a - m, b - m * (flat ? 0.4 : 1), c - m, e1, e2);
  if (noNucleus) {  // corneocytes and onychocytes: dead, keratin-filled plates; nothing left but keratin filaments
    add('cytoskeleton', 'Keratin filaments (cytoskeleton)', place(join(Array.from({length: 80}, () => { const p = pick(V(0, 0, 0), V(a, b, c), q => inside(q, 0.03)), d = unit(); d.y *= 0.05; d.normalize(); const q = p.clone(); while (inside(q.clone().addScaledVector(d, 0.02), 0.03)) q.addScaledVector(d, 0.02); return p.distanceTo(q) > 0.12 ? filament(p, q, 0.005, 0.01) : null; }))));
    return;
  }
  // Nucleus: basal and tall in a column, central in a cube, flat in a plate.
  const N = column ? V(0, -b + 0.32, 0) : flat ? V(0, 0.03, 0) : V(0, -0.02, 0), NS = column ? V(0.12, 0.19, 0.12) : flat ? V(0.24, 0.07, 0.19) : V(0.17, 0.17, 0.17);
  const inNucleus = (p, gap) => ((p.x - N.x) / (NS.x + gap)) ** 2 + ((p.y - N.y) / (NS.y + gap)) ** 2 + ((p.z - N.z) / (NS.z + gap)) ** 2 < 1;
  add('nucleus', 'Nucleus', place(new THREE.SphereGeometry(1, 64, 40).scale(NS.x, NS.y, NS.z).translate(N.x, N.y, N.z)), {layer: 'shell'});
  add('nucleolus', 'Nucleolus', place(sphere(N.clone().add(V(0.03, flat ? 0.01 : 0.03, 0.02)), flat ? 0.03 : 0.045, 18, 12)));
  const spot = (gap, m, test = () => true) => pick(V(0, 0, 0), V(a, b, c), p => inside(p, m) && !inNucleus(p, gap) && test(p));
  const er = erSheets(N, Math.max(NS.x, NS.z) + 0.035, flat ? 2 : 3, 0.03);
  if (flat) er.sheets.scale(1, 0.4, 1).translate(0, N.y * 0.6, 0);
  add('rough-er', 'Rough endoplasmic reticulum', place(er.sheets));
  const freeRibosomes = Array.from({length: flat ? 40 : 70}, () => spot(0.03, 0.04));
  add('ribosome', 'Ribosomes', place(ribosomes([...(flat ? er.spots.map(p => p.clone().multiply(V(1, 0.4, 1)).add(V(0, N.y * 0.6, 0))) : er.spots), ...freeRibosomes])));
  const golgiAt = column ? V(0, N.y + NS.y + 0.12, 0) : flat ? V(0.34, 0.01, 0.05) : V(0.06, N.y + NS.y + 0.08, 0.05);
  add('golgi', 'Golgi apparatus', place(golgiStack(golgiAt, column ? UP : flat ? V(0.2, 1, 0) : V(0.3, 1, 0.2), flat ? 0.06 : 0.09, flat ? 3 : 4)));
  const mitoDir = () => column ? V(between(-0.15, 0.15), 1, between(-0.15, 0.15)) : flat ? V(between(-1, 1), between(-0.08, 0.08), between(-1, 1)) : unit();
  add('mitochondrion', 'Mitochondria', place(join(Array.from({length: flat ? 6 : 10}, () => capsule(spot(0.06, flat ? 0.05 : 0.09, p => !flat || Math.abs(p.y) < 0.03), mitoDir(), flat ? 0.018 : 0.024, column ? 0.13 : flat ? 0.07 : 0.1)))));
  add('smooth-er', 'Smooth endoplasmic reticulum', place(join(Array.from({length: flat ? 2 : 4}, () => { const p = spot(0.12, flat ? 0.05 : 0.1, q => !column || q.y > N.y + NS.y); return taperedTube(wander(p, unit(), 3, flat ? 0.05 : 0.06, 0.4).map(q => flat ? q.setY(q.y * 0.2) : q), 0.011, 0.011, 6); }))));
  add('lysosome', 'Lysosomes', place(join(Array.from({length: flat ? 3 : 5}, () => sphere(spot(0.06, flat ? 0.05 : 0.08, p => !flat || Math.abs(p.y) < 0.03), between(0.022, 0.032))))));
  const fibres = [];
  if (column) {  // terminal web under the apical surface, and bundles running the length of the cell
    for (let k = 0; k < 18; k++) { const y = b - 0.07 + between(-0.02, 0.02), d = between(0, Math.PI); const p = V(Math.cos(d) * 0.22, y, Math.sin(d) * 0.22); fibres.push(filament(p, V(-p.x, y + between(-0.01, 0.01), -p.z), 0.0035, 0.01)); }
    for (let k = 0; k < 10; k++) { const t = between(0, Math.PI * 2), r = between(0.12, 0.19), x = Math.cos(t) * r, z = Math.sin(t) * r; fibres.push(filament(V(x, -b + 0.06, z), V(x, b - 0.08, z), 0.0035, 0.015)); }
  } else {
    const centre = golgiAt.clone().add(V(-0.05, flat ? 0 : -0.04, 0));
    for (let k = 0; k < (flat ? 14 : 26); k++) { const d = unit(); if (flat) { d.y *= 0.05; d.normalize(); } const end = centre.clone(); while (inside(end.clone().addScaledVector(d, 0.02), 0.03) && !inNucleus(end.clone().addScaledVector(d, 0.02), 0)) end.addScaledVector(d, 0.02); if (end.distanceTo(centre) > 0.08) fibres.push(filament(centre, end, 0.0035, flat ? 0.01 : 0.03)); }
  }
  add('cytoskeleton', 'Cytoskeleton', place(join(fibres)));
  // Apical surface: a brush border of microvilli, or a tuft of cilia.
  const topAt = (x, z) => superTop(x, z, a, b, c, e1, e2);
  if (apical === 'microvilli') {
    const villi = [], step = column ? 0.04 : 0.05;
    for (let x = -a; x <= a; x += step) for (let z = -c; z <= c; z += step) {
      const y = topAt(x, z);
      if (y === null || y < b * 0.92) continue;
      villi.push(new THREE.CapsuleGeometry(0.011, 0.075, 3, 7).translate(x + between(-0.006, 0.006), y + 0.045, z + between(-0.006, 0.006)));
    }
    add('microvillus', 'Microvilli', place(join(villi)));
  } else if (apical === 'cilia') {
    const cilia = [];
    for (let k = 0; k < (column ? 34 : 44); k++) {
      const p = pick(V(0, 0, 0), V(a, 0, c), q => { const y = topAt(q.x, q.z); return y !== null && y > b * 0.9; });
      const base = V(p.x, topAt(p.x, p.z) - 0.005, p.z), lean = between(0.9, 1.1);
      cilia.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, base.clone().add(V(0.015 * lean, 0.11, 0)), base.clone().add(V(0.06 * lean, 0.22, 0.01)), base.clone().add(V(0.13 * lean, 0.31, 0.02))]), 16, 0.0095, 6, false));
    }
    add('cilium', 'Cilia', place(join(cilia)));
  }
}

// A tube through points with a radius at each point (reconstructions): rings on parallel-transport frames.
function tubeThrough(points, radii, radial) {
  const pts = [], rs = [];
  points.forEach((p, i) => { if (!pts.length || p.distanceToSquared(pts.at(-1)) > 1e-12) { pts.push(p); rs.push(radii[i]); } });
  if (pts.length < 2) return null;
  const pos = [], idx = [], n = pts.length;
  let normal = null;
  for (let i = 0; i < n; i++) {
    const t = (i === 0 ? pts[1].clone().sub(pts[0]) : i === n - 1 ? pts[n - 1].clone().sub(pts[n - 2]) : pts[i + 1].clone().sub(pts[i - 1])).normalize();
    if (normal) normal.sub(t.clone().multiplyScalar(normal.dot(t)));
    if (!normal || normal.lengthSq() < 1e-10) normal = new THREE.Vector3().crossVectors(t, Math.abs(t.y) < 0.9 ? UP : V(1, 0, 0));
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(t, normal);
    for (let j = 0; j < radial; j++) { const a = (j / radial) * Math.PI * 2, v = normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a)).multiplyScalar(rs[i]).add(pts[i]); pos.push(v.x, v.y, v.z); }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A NeuroMorpho.Org reconstruction (.swc, CNG version): tubes along every traced run with its recorded radii, the soma
// as a see-through cell body with an illustrative nucleus. A tracing without a soma gets one drawn at its root.
function reconstructionCell(add, g) {
  const nodes = new Map();
  for (const line of fs.readFileSync(rel(g.swc), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [id, type, x, y, z, r, parent] = t.split(/\s+/).map(Number);
    if (Number.isFinite(id)) nodes.set(id, {id, type, p: V(x, y, z), r: Math.abs(r) || 0.25, parent, kids: []});
  }
  for (const n of nodes.values()) nodes.get(n.parent)?.kids.push(n);
  const box = new THREE.Box3();
  for (const n of nodes.values()) box.expandByPoint(n.p);
  const size = box.getSize(V(0, 0, 0)), extent = Math.max(size.x, size.y, size.z), S = 1.5 / extent, mid = box.getCenter(V(0, 0, 0));
  const stage = v => v.clone().sub(mid).multiplyScalar(S).add(V(0, 0.8, 0));
  const soma = [...nodes.values()].filter(n => n.type === 1), root = [...nodes.values()].find(n => !nodes.has(n.parent));
  const somaAt = soma.length ? soma.reduce((a, n) => a.add(n.p), V(0, 0, 0)).multiplyScalar(1 / soma.length) : root.p.clone();
  const R = Math.max((soma.length ? Math.max(...soma.map(n => n.r)) : Math.max(root.r * 3, 4)) * S, 0.03), C = stage(somaAt);
  add(g.glia ? 'cell-body' : 'neuronal-cell-body', g.glia ? 'Cell body' : 'Cell body (soma)', new THREE.SphereGeometry(R, 48, 32).translate(C.x, C.y, C.z), {layer: 'envelope'});
  add('nucleus', 'Nucleus (illustrative)', new THREE.SphereGeometry(R * 0.5, 40, 28).translate(C.x, C.y, C.z), {layer: 'shell'});
  add('nucleolus', 'Nucleolus (illustrative)', sphere(C.clone().add(V(R * 0.12, R * 0.1, R * 0.08)), R * 0.14, 16, 12));
  // Unbranched runs between branch points; each starts with its parent point so the tree stays joined.
  const runs = [];
  for (const n of nodes.values()) {
    if (n.type === 1) continue;
    const parent = nodes.get(n.parent);
    if (parent && parent.type !== 1 && parent.kids.length === 1) continue;
    const pts = parent ? [parent] : [];
    for (let c = n; ; c = c.kids[0]) { pts.push(c); if (c.kids.length !== 1) break; }
    runs.push({type: n.type, pts});
  }
  // About 7,000 points: long runs are thinned evenly, always keeping their ends; branches stay at least 4 mm thick.
  const every = Math.max(1, Math.ceil(runs.reduce((a, r) => a + r.pts.length, 0) / 7000));
  const keyOf = t => g.glia ? 'cell-projection' : t === 2 ? 'axon' : t === 3 ? 'dendrite' : t === 4 ? 'apical-dendrite' : 'neurite';
  const byKey = new Map();
  for (const run of runs) {
    const pts = run.pts.filter((_, i, a) => i === 0 || i === a.length - 1 || i % every === 0);
    const tube = tubeThrough(pts.map(n => stage(n.p)), pts.map(n => Math.max(n.r * S, 0.004)), pts.some(n => n.r * S > 0.012) ? 8 : 6);
    if (tube) { const k = keyOf(run.type); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(tube); }
  }
  const names = {axon: 'Axon', dendrite: 'Dendrites', 'apical-dendrite': 'Apical dendrite', neurite: 'Neurites', 'cell-projection': 'Processes'};
  for (const [k, list] of byKey) add(k, names[k], join(list));
  return {extentUm: extent, scale: S};
}

const BUILDERS = {
  'generic': (add, apical, noNucleus) => noNucleus ? genericNoNucleus(add) : genericCell(add),
  'immune': immuneCell, 'branched-immune': branchedImmuneCell, 'red-blood-cell': redBloodCell, 'platelet': platelet, 'neuron': neuron,
  'cardiomyocyte': cardiomyocyte, 'skeletal-muscle-fiber': skeletalFiber, 'fat-cell': fatCell,
  'flat-epithelial': (add, apical, noNucleus) => epithelialCell(add, 'flat-epithelial', apical, noNucleus),
  'cube-epithelial': (add, apical, noNucleus) => epithelialCell(add, 'cube-epithelial', apical, noNucleus),
  'column-epithelial': (add, apical, noNucleus) => epithelialCell(add, 'column-epithelial', apical, noNucleus),
  'reconstruction': (add, apical, noNucleus, shape) => reconstructionCell(add, RECONSTRUCTIONS.groups[shape.reconstruction.group]),
};

// The models cell types need (step 06 lists every cell type with its CL ancestors), always including the generic cell.
const needed = new Map([['generic-cell', {family: 'generic', apical: null, noNucleus: false}]]);
for (const [id, ancestors] of clAncestors()) { const s = shapeOf(id, ancestors); needed.set(s.variant, {family: s.family, apical: s.apical?.kind ?? null, noNucleus: !s.nucleus, shape: s}); }

const dir = rel('public/models/cell');
fs.mkdirSync(dir, {recursive: true});
const summary = {};
for (const [variant, {family, apical, noNucleus, shape}] of [...needed].sort((x, y) => x[0].localeCompare(y[0]))) {
  if (family !== 'reconstruction' && variantOf(family, apical, noNucleus) !== variant) throw new Error(`variant name mismatch for ${variant}`);
  const parts = [];
  reseed(variant === 'generic-cell' ? 20261107 : variant);
  const built = BUILDERS[family]((key, name, geometry, extra = {}) => { if (!byKey[key]) throw new Error(`${variant}: ${key} is not in organelles.json`); parts.push({key, name, geometry, ...extra}); }, apical, noNucleus, shape) ?? {};
  // Write the manifest (same format as every other model) and one chunk.
  const buffers = [];
  let bytes = 0;
  const append = typed => { const pad = (4 - bytes % 4) % 4; if (pad) { buffers.push(Buffer.alloc(pad)); bytes += pad; } const at = bytes, b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); buffers.push(b); bytes += b.length; return at; };
  const counter = {}, out = [];
  let triangles = 0;
  for (const p of parts) {
    const g = p.geometry.index ? p.geometry : mergeGeometries([p.geometry], false);
    const idx = g.index ? g : (() => { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); return g; })();
    if (!idx.attributes.normal) idx.computeVertexNormals();
    const positions = Float32Array.from(idx.attributes.position.array), n = idx.attributes.normal.array, normals = new Int16Array(n.length);
    for (let i = 0; i < n.length; i++) normals[i] = Math.round(Math.max(-1, Math.min(1, n[i])) * 32767);
    const indices = Uint32Array.from(idx.index.array);
    const b0 = [Infinity, Infinity, Infinity], b1 = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < positions.length; v += 3) for (let k = 0; k < 3; k++) { b0[k] = Math.min(b0[k], positions[v + k]); b1[k] = Math.max(b1[k], positions[v + k]); }
    counter[p.key] = (counter[p.key] ?? 0) + 1;
    out.push({id: `cell-${p.key}-${counter[p.key]}`, name: p.name, conceptId: byKey[p.key].id.replace(':', ''), system: p.key, ...(p.layer ? {layer: p.layer} : {}), chunk: 0,
      positions: append(positions), normals: append(normals), indices: append(indices), vertexCount: positions.length / 3, indexCount: indices.length, bounds: [b0, b1]});
    triangles += indices.length / 3;
  }
  fs.writeFileSync(path.join(dir, `${variant}-0.bin`), Buffer.concat(buffers));
  const drawn = organelles.filter(o => counter[o.key]);
  const concepts = [{id: cell.id.replace(':', ''), name: 'Cell', elements: out.map(p => p.id)}, ...drawn.map(o => ({id: o.id.replace(':', ''), name: o.label, elements: out.filter(p => p.system === o.key).map(p => p.id)}))];
  const rec = family === 'reconstruction' ? RECONSTRUCTIONS.groups[shape.reconstruction.group] : null;
  const f = rec ? {label: rec.class} : CELL_FAMILIES.families[family], caption = rec ? reconstructionCaption(rec, 'type') : captionOf(family, apical, noNucleus);
  fs.writeFileSync(path.join(dir, `${variant}.json`), JSON.stringify({
    version: variant === 'generic-cell' ? 'Bio Map generic cell v1' : `Bio Map ${variant.replace(/-/g, ' ')} v1`,
    source: rec ? `NeuroMorpho.Org ${rec.nmoId} (${rec.license}), drawn by Bio Map (pipeline/13-cell.mjs)` : 'Bio Map (procedural, pipeline/13-cell.mjs)',
    scope: variant === 'generic-cell' ? 'A generic cell: organelles typical of most cells; sizes and numbers are illustrative' : `${caption[0].toUpperCase()}${caption.slice(1)}`,
    gzipOnly: true, wholeConcepts: true, stage: {magnification: built.scale ? Math.round(built.scale * 1e6) : null, rootConceptId: cell.id.replace(':', '')},
    cell: {family, label: f.label, variant, apical, nucleus: !noNucleus, caption, ...(rec ? {reconstruction: {nmoId: rec.nmoId, species: rec.species, extentUm: Math.round(built.extentUm), drawnSoma: rec.drawnSoma, attribution: rec.attribution}} : {})},
    palette: drawn.map(o => ({id: o.key, color: o.color, label: o.label})),
    parts: out, chunks: [{url: `/models/cell/${variant}-0.bin`, bytes}], triangles, concepts,
  }));
  execFileSync('node', [rel('scripts/compress-models.mjs'), `cell/${variant}.json`], {stdio: 'ignore'});
  execFileSync('node', [rel('scripts/validate-atlas.mjs'), `cell/${variant}.json`], {stdio: 'ignore'});
  const gz = JSON.parse(fs.readFileSync(path.join(dir, `${variant}.json`), 'utf8')).chunks[0].gzipBytes;
  summary[variant] = {parts: out.length, triangles, gzipKB: Math.round(gz / 1024), drawn: drawn.map(o => o.key).join(' ')};
}
// Remove models no cell type uses any more.
for (const f of fs.readdirSync(dir)) { const v = f.replace(/(-0\.bin(\.gz)?|\.json)$/, ''); if (!needed.has(v)) fs.unlinkSync(path.join(dir, f)); }
console.table(summary);
