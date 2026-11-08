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
import {CELL_FAMILIES, PROFILES, RECONSTRUCTIONS, captionOf, clAncestors, profileParams, reconstructionCaption, shapeOf, variantOf} from './_cell-families.mjs';

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
const join = list => { const l = list.filter(Boolean); return l.length ? mergeGeometries(l.map(indexed), false) : null; };  // null when there is nothing to draw
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

// ---------------------------------------------------------------------------------------------------------------
// Profile models: a cell type's own model, built from the checked claims in its morphology profile
// (content/CL_<n>/morphology.md). What a profile does not state comes from its family shape, or is left out.
const AMOUNT = {mitochondria: [0, 4, 10, 24], 'rough er': [0, 1, 3, 6], 'smooth er': [0, 2, 4, 9], 'golgi apparatus': [0, 3, 4, 6], lysosomes: [0, 3, 7, 16],
  peroxisomes: [0, 4, 9, 18], 'lipid droplets': [0, 2, 4, 8], glycogen: [0, 25, 60, 140], ribosomes: [0, 30, 70, 150]};
// Granule colours as a source describes how they stain or look (first match wins).
const LOOK = [[/\b(eosin\w*|orange|red|reddish|acidophil\w*)\b/, '#e0603a'], [/\b(brown|black|melanin)\b/, '#6b4a2b'], [/\b(basophil\w*|purple|dark|blue|bluish|violet)\b/, '#4b2f7d'],
  [/\b(pale|pink|lilac|neutral|faint|neutrophil\w*)\b/, '#d9b6d3'], [/\byellow\w*\b/, '#e8d27a']];
// Granule kinds: the part they are drawn as, its label in this cell, and their radius.
const GRANULE = [[/zymogen/, 'zymogen-granule', 'Zymogen granules', 0.045], [/specific granule|neutrophil/, 'specific-granule', 'Specific granules', 0.016], [/azurophil/, 'lysosome', 'Azurophil granules (lysosomes)', 0.022],
  [/melan/, 'melanosome', 'Melanosomes', 0.02], [/lamellar bod/, 'secretory-granule', 'Lamellar bodies', 0.04], [/weibel|palade/, 'weibel-palade-body', 'Weibel–Palade bodies', 0.014],
  [/glycogen/, 'glycogen-granule', 'Glycogen', 0.007], [/mucin|mucus|mucous/, 'secretory-granule', 'Mucin granules', 0.04], [/lysosom/, 'lysosome', 'Lysosomes', 0.025]];
const amount = (P, name, fallback) => { const k = Object.keys(P.organelles).find(o => o.startsWith(name)); return k != null ? P.organelles[k] : fallback; };
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
/** A granule's label as its claim names it, without the parenthetical asides. */
const granuleLabel = kind => capital(kind.replace(/\s*\([^)]*\)/g, '').trim());

/** The cell body for a profile shape, in local coordinates (centre at the origin): its geometry, an inside test with a
 * margin, its half extents, how it is placed on the stage, its top (apical) surface and a point on its surface. */
function bodyFor(shape, base) {
  const at = (y, tilt) => g => { if (tilt) g.rotateX(tilt[0]).rotateY(tilt[1]); return g.translate(0, y, 0); };
  const onEllipsoid = (a, b, c) => d => d.clone().divideScalar(Math.sqrt((d.x / a) ** 2 + (d.y / b) ** 2 + (d.z / c) ** 2));
  const ellipsoid = (a, b, c, shrink = 1) => ({geometry: superellipsoid(a, b, c, 1, 1), inside: (p, m) => (p.x / (a * shrink - m)) ** 2 + (p.y / (b * shrink - m)) ** 2 + (p.z / (c * shrink - m)) ** 2 < 1,
    half: V(a, b, c), place: at(0.66), top: (x, z) => { const h = 1 - (x / a) ** 2 - (z / c) ** 2; return h <= 0 ? null : b * Math.sqrt(h); }, surface: onEllipsoid(a, b, c), polar: false, long: a > b * 1.6 ? 'x' : 'y'});
  const box = (a, b, c, e1, e2, y = 0.62, tilt = null) => ({geometry: superellipsoid(a, b, c, e1, e2), inside: (p, m) => superInside(p, a - m, b - m * (b < 0.1 ? 0.4 : 1), c - m, e1, e2),
    half: V(a, b, c), place: at(y, tilt), top: (x, z) => superTop(x, z, a, b, c, e1, e2), surface: onEllipsoid(a, b, c), polar: true, long: 'y'});
  // A box whose cross-section is scaled by k(y): pyramids, goblets, flasks.
  const tapered = (a, b, e1, e2, k, y = 0.62) => { const B = box(a, b, a, e1, e2, y); displace(B.geometry, v => { const f = k(v.y); v.x *= f; v.z *= f; });
    B.inside = (p, m) => superInside(V(p.x / k(p.y), p.y, p.z / k(p.y)), a - m, b - m, a - m, e1, e2);
    B.top = (x, z) => { const f = k(b * 0.95); return superTop(x / f, z / f, a, b, a, e1, e2); };
    let w = 0; for (let t = -b; t <= b; t += b / 20) w = Math.max(w, k(t)); B.half = V(a * w, b, a * w); return B; };
  const s = (shape ?? '').replace(/\bnot (\w|-)+/g, '');  // "not squamous" says what it is not
  if (/very large sphere/.test(s)) return ellipsoid(0.64, 0.64, 0.64);
  if (/\bdisc\b/.test(s)) return ellipsoid(0.62, 0.2, 0.62);
  if (/sphere|spheric|round/.test(s) || (!s && base === 'immune')) return ellipsoid(0.55, 0.55, 0.55);
  if (/oval|ovoid/.test(s)) return ellipsoid(0.62, 0.46, 0.5);
  if (/irregular|pseudopod|amoeb/.test(s)) { const b = ellipsoid(0.5, 0.47, 0.5, 0.82); displace(b.geometry, v => { const d = v.clone().normalize(); v.multiplyScalar(1 + 0.12 * Math.sin(5 * d.x + 1) * Math.cos(4 * d.y) + 0.08 * Math.sin(7 * d.z)); }); return b; }
  // Flat before cube ("flat polygonal plate"), cube before squamous ("squamous when inactive, cuboidal or columnar when active").
  if (/flat|plate/.test(s) || (!s && base === 'flat-epithelial')) return box(0.8, 0.075, 0.66, 0.55, 0.75, 0.62, [0.62, -0.25]);
  if (/cube|cuboid/.test(s) || (!s && base === 'cube-epithelial')) return box(0.42, 0.38, 0.42, 0.3, 0.35);
  if (/squam|thin/.test(s)) return box(0.8, 0.075, 0.66, 0.55, 0.75, 0.62, [0.62, -0.25]);
  if (/pyramid/.test(s)) return tapered(0.4, 0.46, 0.3, 0.4, y => 1 - 0.25 * (y / 0.46 + 1));
  if (/goblet|chalice/.test(s)) return tapered(0.26, 0.56, 0.22, 0.45, y => 0.55 + 0.75 * Math.exp(-(((y - 0.25) / 0.22) ** 2)), 0.61);
  if (/flask|bulb/.test(s)) return tapered(0.26, 0.56, 0.22, 0.45, y => 0.5 + 0.8 * Math.exp(-(((y + 0.2) / 0.28) ** 2)), 0.61);
  if (/dome|umbrella/.test(s)) { const B = box(0.6, 0.34, 0.6, 0.6, 0.5, 0.5); displace(B.geometry, v => { if (v.y < 0) v.y *= 0.45; });
    B.inside = (p, m) => superInside(V(p.x, p.y < 0 ? p.y / 0.45 : p.y, p.z), 0.6 - m, 0.34 - m, 0.6 - m, 0.6, 0.5); return B; }
  if (/polygon|polyhedr/.test(s)) return box(0.42, 0.38, 0.42, 0.3, 0.35);
  if (/spindle|fusiform/.test(s)) {
    const L = 0.82, R = 0.17, rad = x => R * Math.max(0, 1 - (x / L) ** 2) ** 1.05;
    const g = displace(new THREE.SphereGeometry(1, 96, 32), v => { const k = Math.max(0, 1 - v.x * v.x) ** 0.55; v.set(v.x * L, v.y * R * k, v.z * R * k); });
    return {geometry: g, inside: (p, m) => Math.abs(p.x) < L - m && Math.hypot(p.y, p.z) < rad(p.x) - m * 0.6, half: V(L, R, R), place: at(0.66),
      top: (x, z) => { const r = rad(x); return Math.abs(z) < r ? Math.sqrt(r * r - z * z) : null; }, surface: onEllipsoid(L, R, R), polar: false, long: 'x'};
  }
  if (/star|stellate|branched|dendritic|process|\barms?\b|finger-like/.test(s) || (!s && base === 'branched-immune')) return {...ellipsoid(0.26, 0.24, 0.26), processes: true};
  if (/column|columnar|tall|cylindr/.test(s) || (!s && base === 'column-epithelial')) return box(0.26, 0.56, 0.26, 0.22, 0.45, 0.61);
  if (/elongat/.test(s)) return box(0.2, 0.58, 0.2, 0.6, 0.7, 0.61);  // upright, with an apical end
  return ellipsoid(0.62, 0.48, 0.52);
}

/** One nucleus geometry (local, at the origin) for a profile's nucleus shape. */
function nucleusGeometry(kind, r, lobes, long) {
  const k = kind ?? 'round';
  if (/multilob/.test(k)) { const n = Math.min(Math.max(lobes ?? 4, 3), 5), parts = [], pts = [];
    for (let i = 0; i < n; i++) { const a = -1.9 + (3.8 * i) / (n - 1), p = V(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.55, Math.sin(a * 1.7) * r * 0.25); pts.push(p); parts.push(sphere(p, r * 0.42, 24, 16)); }
    for (let i = 0; i < n - 1; i++) parts.push(taperedTube([pts[i], pts[i].clone().lerp(pts[i + 1], 0.5).add(V(0, r * 0.05, 0)), pts[i + 1]], r * 0.1, r * 0.1, 8));
    return join(parts); }
  if (/bilob/.test(k)) return join([sphere(V(-r * 0.62, 0, 0), r * 0.62, 32, 20), sphere(V(r * 0.62, 0, 0), r * 0.62, 32, 20), taperedTube([V(-r * 0.3, 0, 0), V(0, r * 0.08, 0), V(r * 0.3, 0, 0)], r * 0.16, r * 0.16, 8)]);
  if (/horseshoe/.test(k)) return new THREE.TorusGeometry(r * 0.85, r * 0.34, 16, 48, Math.PI * 1.45).rotateZ(Math.PI * 0.27);
  if (/kidney|indent|bean/.test(k)) { const notch = V(1, 0.2, 0.3).normalize(); return displace(new THREE.SphereGeometry(r, 48, 32), v => { const d = v.clone().normalize(); v.multiplyScalar(1 - 0.3 * Math.max(0, d.dot(notch)) ** 3); }); }
  if (/elongat|cigar|rod/.test(k)) return long === 'x' ? new THREE.SphereGeometry(1, 40, 24).scale(r * 2.2, r * 0.55, r * 0.55) : new THREE.SphereGeometry(1, 40, 24).scale(r * 0.6, r * 1.8, r * 0.6);
  if (/flatten/.test(k)) return new THREE.SphereGeometry(1, 40, 24).scale(r * 1.3, r * 0.42, r * 1.1);
  if (/oval/.test(k)) return new THREE.SphereGeometry(1, 40, 24).scale(r * 1.2, r * 0.88, r);
  if (/irregular/.test(k)) return displace(new THREE.SphereGeometry(r, 40, 28), v => { const d = v.clone().normalize(); v.multiplyScalar(1 + 0.12 * Math.sin(4 * d.x + 2) * Math.cos(5 * d.y)); });
  return new THREE.SphereGeometry(r, 48, 32);
}

function generalProfileCell(add, P, base, noNucleus, familyApical) {
  const B = bodyFor(P.shape, base), H = B.half, thin = H.y < 0.1, slim = B.long === 'x' && H.y < 0.25, sz = thin ? 0.6 : 1, place = g => g ? B.place(g) : null;
  // Organelles lie flat in a flat cell and along the length of a slim one.
  const dir = () => { const d = unit(); if (thin) { d.y *= 0.05; d.normalize(); } else if (slim) { d.x *= 4; d.normalize(); } return d; };
  const find = ok => { for (let i = 0; i < 12000; i++) { const p = V(between(-H.x, H.x), between(-H.y, H.y), between(-H.z, H.z)); if (ok(p)) return p; } return null; };
  add('membrane', 'Cell membrane', place(B.geometry.clone()), {layer: 'envelope'});
  // Nuclei: none, one, two or many, with the shape, size and position the profile states.
  const count = P.nucleusCount ?? (noNucleus ? 0 : 1), kind = P.nucleusShape ?? (thin ? 'flattened' : slim ? 'elongated' : 'round');
  const minHalf = thin ? Math.min(H.x, H.z) * 0.3 : Math.min(H.x, H.y, H.z);
  const r = count > 0 ? (count > 2 ? 0.2 : count === 2 ? 0.32 : /large/.test(P.nucleusSize ?? '') ? 0.62 : /small/.test(P.nucleusSize ?? '') ? 0.3 : 0.44) * minHalf : 0;
  const reach = r * (/elongat|cigar|rod/.test(kind) ? 2.3 : /lob|horseshoe/.test(kind) ? 1.5 : 1.3), nuclei = [];
  if (count > 0) {
    const pos = P.nucleusPosition ?? '';
    const anchor = thin ? V(0, 0, 0) : /basal/.test(pos) ? V(0, -H.y + reach + 0.03, 0) : /apical/.test(pos) ? V(0, H.y - reach - 0.05, 0)
      : /off|eccentric|periph/.test(pos) ? V(H.x - reach - 0.05, -H.y * 0.1, 0) : V(0, 0, 0);
    if (count === 1) nuclei.push(anchor);
    else if (count === 2) nuclei.push(anchor.clone().add(V(-reach * 1.05, 0, 0)), anchor.clone().add(V(reach * 1.05, 0, 0)));
    else for (let i = 0; i < Math.min(count, 14); i++) { const p = find(q => B.inside(q, reach + 0.02) && nuclei.every(n => n.distanceTo(q) > reach * 2.05)); if (p) nuclei.push(p); }
    const nucleus = n => { const g = nucleusGeometry(kind, r, P.lobes, B.long); if (thin && !/flatten/.test(kind)) g.scale(1, 0.45, 1); return at(g, n); };
    add('nucleus', nuclei.length > 1 ? 'Nuclei' : 'Nucleus', place(join(nuclei.map(nucleus))), {layer: 'shell'});
    if (!/lob|horseshoe/.test(kind)) add('nucleolus', nuclei.length > 1 ? 'Nucleoli' : 'Nucleolus', place(join(nuclei.map(n => sphere(n.clone().add(V(r * 0.2, thin ? 0 : r * 0.15, r * 0.1)), r * (thin ? 0.16 : 0.24), 16, 12)))));
  }
  const clear = (p, gap) => nuclei.every(n => n.distanceTo(p) > reach + gap);
  const spot = (m, where = null) => { for (const k of [1, 0.5, 0.25]) { const p = find(q => B.inside(q, m * k) && clear(q, 0.03 * k) && (!where || where(q))); if (p) return p; } return null; };
  const scatter = (n, m, make, where = null) => join(Array.from({length: n}, () => { const p = spot(m, where); return p ? make(p) : null; }));
  const fits = (g, m) => { const pos = g.attributes.position, v = V(0, 0, 0); for (let i = 0; i < pos.count; i += 5) if (!B.inside(v.fromBufferAttribute(pos, i), m)) return false; return true; };
  // Organelles in the amounts the profile states; unstated ones at a modest default (none in a cell with no nucleus).
  const has = count > 0, qty = (name, fallback) => Math.round(AMOUNT[name][amount(P, name, fallback)] * (thin ? 0.6 : 1));
  const mito = qty('mitochondria', has ? 2 : 0);
  if (mito) add('mitochondrion', 'Mitochondria', place(scatter(mito, 0.06, p => capsule(p, dir(), 0.022 * sz, 0.08 * sz))));
  const rer = AMOUNT['rough er'][amount(P, 'rough er', has ? 1 : 0)];
  if (rer && nuclei.length) {
    // Sheets wrapped round the back of the nucleus where they fit, then stacks of flat cisternae in the cytoplasm.
    const sheets = [], dots = [], N0 = nuclei[0];
    for (let k = 0, tries = 0; sheets.length < Math.min(rer, 5) && tries < 24; tries++) {
      const rad = reach + 0.035 + k * 0.028, wrap = Math.PI * between(0.35, 0.9), start = Math.PI * 1.5 - wrap / 2 + between(-0.3, 0.3);
      const g = displace(new THREE.SphereGeometry(rad, 40, 20, start, wrap, Math.PI * between(0.2, 0.3), Math.PI * between(0.4, 0.5)), v => { v.multiplyScalar(1 + 0.04 * Math.sin(9 * Math.atan2(v.z, v.x) + k)); if (thin) v.y *= 0.4; v.add(N0); });
      if (!fits(g, 0.015)) continue;
      sheets.push(g); k++;
      const pos = g.attributes.position; for (let i = 0; i < 30; i++) dots.push(V(0, 0, 0).fromBufferAttribute(pos, Math.floor(rand() * pos.count)));
    }
    for (let tries = 0; sheets.length < rer && tries < rer * 6; tries++) {
      const c = spot(0.1); if (!c) break;
      const toward = N0.clone().sub(c).normalize(), stack = [];
      for (let i = 0; i < 3; i++) { const g = displace(new THREE.PlaneGeometry(0.14 * sz, 0.1 * sz, 8, 6), v => { v.z -= 2.2 * v.x * v.x; }); along(g.rotateX(-Math.PI / 2), thin ? UP : toward); at(g, c.clone().addScaledVector(thin ? UP : toward, (i - 1) * 0.024 * sz)); stack.push(g); }
      const g = join(stack); if (!fits(g, 0.01)) continue;
      sheets.push(g); const pos = g.attributes.position; for (let i = 0; i < 24; i++) dots.push(V(0, 0, 0).fromBufferAttribute(pos, Math.floor(rand() * pos.count)));
    }
    if (sheets.length) {
      add('rough-er', 'Rough endoplasmic reticulum', place(join(sheets)));
      add('ribosome', 'Ribosomes', place(ribosomes([...dots, ...Array.from({length: qty('ribosomes', 1)}, () => spot(0.03)).filter(Boolean)])));
    }
  }
  const ser = AMOUNT['smooth er'][amount(P, 'smooth er', has ? 1 : 0)];
  if (ser) add('smooth-er', 'Smooth endoplasmic reticulum', place(join(Array.from({length: ser}, () => { const a = spot(0.08); if (!a) return null; const pts = [a];
    for (const q of wander(a, dir(), 3, 0.05 * sz, 0.4).slice(1)) { if (!B.inside(q, 0.03) || !clear(q, 0.01)) break; pts.push(q); }
    return pts.length > 1 ? taperedTube(pts, 0.01, 0.01, 6) : null; }))));
  const golgi = AMOUNT['golgi apparatus'][amount(P, 'golgi', has ? 2 : 0)];
  if (golgi && nuclei.length) { const size = 0.07 * sz;
    for (const side of [V(0, 1, 0), V(1, 0.4, 0), V(-1, 0.4, 0), V(0, 0.3, 1), V(0, -1, 0)]) { const d = side.normalize(), g = nuclei[0].clone().addScaledVector(d, reach + size * 0.9); if (thin) g.y = 0;
      if (B.inside(g, size * 1.1) && clear(g, size * 0.5)) { add('golgi', 'Golgi apparatus', place(golgiStack(g, thin ? V(0.2, 1, 0) : d, size, golgi))); break; } } }
  const lyso = qty('lysosomes', has ? 1 : 0);
  if (lyso) add('lysosome', 'Lysosomes', place(scatter(lyso, 0.05, p => sphere(p, between(0.018, 0.03) * sz, 14, 10))));
  const pero = qty('peroxisomes', 0);
  if (pero) add('peroxisome', 'Peroxisomes', place(scatter(pero, 0.05, p => sphere(p, 0.02 * sz, 12, 8))));
  const lip = qty('lipid droplets', 0);
  if (lip) add('lipid-droplet', 'Lipid droplets', place(scatter(lip, 0.08, p => sphere(p, between(0.035, 0.06) * sz, 20, 14))));
  const gly = qty('glycogen', 0);
  if (gly) add('glycogen-granule', 'Glycogen', place(scatter(gly, 0.03, p => at(new THREE.IcosahedronGeometry(0.008, 0), p))));
  // Granules: how many, how big, where and what colour they look, as the profile states (one kind per part).
  const granules = new Map();
  for (const g of P.granules) { const [, key, , size] = GRANULE.find(([rx]) => rx.test(g.kind.toLowerCase())) ?? [null, 'secretory-granule', null, 0.028]; if (!granules.has(key)) granules.set(key, {...g, key, label: granuleLabel(g.kind), size}); }
  // Granules a profile names only as special structures (Weibel–Palade bodies, lamellar bodies, melanosomes).
  for (const s of P.special.filter(v => /granule|bod(y|ies)|melanosome/.test(v))) for (const [rx, key, label, size] of GRANULE) if (rx.test(s) && !granules.has(key) && !['lysosome', 'glycogen-granule'].includes(key)) granules.set(key, {kind: s, key, label, size});
  for (const g of granules.values()) {
    const n = /packed/.test(g.abundance ?? '') ? 60 : /many/.test(g.abundance ?? '') ? 30 : /few/.test(g.abundance ?? '') ? 8 : 16;
    const where = /apical/.test(g.position ?? '') ? p => p.y > H.y * 0.15 : /basal/.test(g.position ?? '') ? p => p.y < -H.y * 0.15 : null;
    const color = LOOK.find(([rx]) => rx.test((g.look ?? '').toLowerCase()))?.[1], size = g.size * sz;
    const make = g.key === 'weibel-palade-body' ? p => capsule(p, dir(), size, size * 5) : p => sphere(p, size * between(0.8, 1.2), 12, 9);
    add(g.key, g.label, place(scatter(n, Math.max(0.03, size * 1.5), make, where)), {...(color ? {color} : {}), label: g.label});
  }
  // Surface features.
  const surfaces = P.surface.length ? P.surface : familyApical === 'microvilli' ? ['microvilli'] : familyApical === 'cilia' ? ['motile cilia'] : [];
  const surface = kind => surfaces.some(v => kind.test(v));
  const topPoints = (n, rim) => { const out = []; for (let i = 0; i < n * 40 && out.length < n; i++) { const x = between(-H.x, H.x), z = between(-H.z, H.z), y = B.top(x, z); if (y != null && y > H.y * rim) out.push(V(x, y, z)); } return out; };
  const normalAt = p => V(p.x / H.x ** 2, p.y / H.y ** 2, p.z / H.z ** 2).normalize();
  if (surface(/microvill|brush/)) {
    const brush = surface(/brush/), pts = B.polar ? topPoints(brush ? 160 : 90, 0.9) : Array.from({length: 80}, () => B.surface(unit()));
    add('microvillus', brush ? 'Microvilli (brush border)' : 'Microvilli', place(join(pts.map(p => { const d = B.polar ? UP : normalAt(p); return at(along(new THREE.CapsuleGeometry(0.011, brush ? 0.09 : 0.06, 3, 7), d), p.clone().addScaledVector(d, brush ? 0.045 : 0.03)); }))));
  }
  if (surface(/stereocilia/)) { const hairs = [], y0 = B.top(0, 0) ?? H.y;
    [0.1, 0.17, 0.26].forEach((h, i) => { for (let j = -6; j <= 6; j++) { const x = j * 0.026, z = -0.06 + i * 0.05, y = (B.top(x, z) ?? y0) - 0.01; hairs.push(new THREE.CylinderGeometry(0.01, 0.006, h, 7).translate(x, y + h / 2, z)); } });
    add('stereocilium', 'Stereocilia (in rows of rising height)', place(join(hairs))); }
  if (surface(/motile cilia|^cilia$/)) add('cilium', 'Cilia', place(join(topPoints(36, B.polar ? 0.85 : 0.6).map(b => { const d = B.polar ? UP : normalAt(b);
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([b, b.clone().addScaledVector(d, 0.11).add(V(0.015, 0, 0)), b.clone().addScaledVector(d, 0.22).add(V(0.06, 0, 0.01)), b.clone().addScaledVector(d, 0.31).add(V(0.13, 0, 0.02))]), 16, 0.0095, 6, false); }))));
  else if (surface(/primary cilium/)) { const b = V(0, (B.top(0, 0) ?? H.y) - 0.005, 0); add('cilium', 'Primary cilium', place(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([b, b.clone().add(V(0.02, 0.12, 0)), b.clone().add(V(0.05, 0.24, 0))]), 16, 0.012, 6, false)), {label: 'Primary cilium'}); }
  if (surface(/pseudopod/) || /pseudopod/.test(P.shape ?? '')) add('pseudopodium', 'Pseudopodia', place(join(Array.from({length: 5}, () => { const p = B.surface(unit()), d = normalAt(p); return at(along(new THREE.CapsuleGeometry(0.07, 0.2, 6, 12), d), p.clone().addScaledVector(d, 0.06)); }))), {layer: 'envelope'});
  if (surface(/ruffled/)) add('ruffle', 'Ruffled border', place(join(topPoints(140, 0.55).map(p => at(along(new THREE.CapsuleGeometry(0.012, 0.045, 3, 7), V(between(-0.3, 0.3), -1, between(-0.3, 0.3))), V(p.x, -p.y - 0.012, p.z))))));
  if (B.processes || surface(/long processes|foot processes/)) { const foot = surface(/foot processes/), procs = [];
    for (let k = 0; k < (B.processes ? 9 : 6); k++) { const d = unit(); if (d.y < -0.6) { d.y = -0.6; d.normalize(); } const main = wander(B.surface(d).multiplyScalar(0.92), d, 5, 0.09, 0.3);
      procs.push(taperedTube(main, 0.03, 0.008), taperedTube(wander(main[2], d.clone().add(unit()).normalize(), 3, 0.07, 0.35), 0.015, 0.005));
      if (foot) for (let i = 2; i < main.length; i++) for (let j = 0; j < 5; j++) procs.push(at(along(new THREE.CapsuleGeometry(0.006, 0.035, 2, 5), unit()), main[i].clone().add(unit().multiplyScalar(0.022)))); }
    add('cell-projection', foot ? 'Primary processes and foot processes' : 'Cell processes', place(join(procs)), foot ? {label: 'Processes and foot processes'} : {}); }
  // Special structures.
  const special = kind => P.special.some(v => kind.test(v));
  if (special(/zona|egg coat/)) add('egg-coat', 'Zona pellucida', place(superellipsoid(H.x * 1.14, H.y * 1.14, H.z * 1.14, 1, 1)), {layer: 'envelope'});
  const keratin = special(/keratin|tonofil/), intermediate = keratin || special(/intermediate filament/);
  if (intermediate) add('intermediate-filament', keratin ? 'Keratin filaments' : 'Intermediate filaments', place(join(Array.from({length: thin ? 70 : 40}, () => { const a = spot(0.03); if (!a) return null; const d = dir(), b = a.clone();
    while (B.inside(b.clone().addScaledVector(d, 0.02), 0.03)) b.addScaledVector(d, 0.02); return a.distanceTo(b) > 0.1 ? filament(a, b, 0.005, 0.01) : null; }))), keratin ? {} : {label: 'Intermediate filaments'});
  if (special(/intracellular canalicul|secretory canalicul/)) add('intracellular-canaliculus', 'Intracellular canaliculi', place(join(Array.from({length: 6}, () => { const top = V(between(-0.08, 0.08), (B.top(0, 0) ?? H.y) - 0.03, between(-0.08, 0.08)), pts = [top];
    for (const q of wander(top, V(between(-0.5, 0.5), -1, between(-0.5, 0.5)), 6, 0.06, 0.35).slice(1)) { if (!B.inside(q, 0.03) || !clear(q, 0.01)) break; pts.push(q); }
    return pts.length > 2 ? taperedTube(pts, 0.016, 0.01, 8) : null; }))));
  const strands = [0, 10, 20, 40][amount(P, 'cytoskeleton', 2)] * (thin ? 0.6 : 1) | 0;
  if (!keratin && has && strands) { const c = nuclei[0] ?? V(0, 0, 0); add('cytoskeleton', 'Cytoskeleton', place(join(Array.from({length: strands}, () => { const d = dir(), s = c.clone().addScaledVector(d, reach + 0.01), e = s.clone();
    while (B.inside(e.clone().addScaledVector(d, 0.02), 0.03)) e.addScaledVector(d, 0.02); return e.distanceTo(s) > 0.08 ? filament(s, e, 0.0035, 0.02) : null; })))); }
}

// T tubules for the muscle shapes when a profile states them: tubes running in from the cell membrane between myofibrils.
const rodBetween = (a, b, r) => at(along(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6, 1, true), b.clone().sub(a)), a.clone().lerp(b, 0.5));
function tTubules(add, kind) {
  const tubes = [];
  if (kind === 'skeletal') { const Y = 0.62, R = 0.29; for (let x = -0.75; x < 0.76; x += 0.1) for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + x * 7; tubes.push(rodBetween(V(x, Y + R * Math.cos(a), R * Math.sin(a)), V(x, Y + 0.06 * Math.cos(a), 0.06 * Math.sin(a)), 0.006)); } }
  else { const Y = 0.62; for (let x = -0.7; x < 0.12; x += 0.1) { if (Math.abs(x + 0.24) < 0.14) continue; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + x * 5; tubes.push(rodBetween(V(x, Y + 0.2 * Math.cos(a), 0.2 * Math.sin(a)), V(x, Y + 0.07 * Math.cos(a), 0.07 * Math.sin(a)), 0.01)); } } }
  add('t-tubule', 'T tubules', join(tubes));
}

// Sperm: a flattened head with an acrosome cap over its condensed nucleus, a midpiece wrapped in mitochondria, a long flagellum.
function spermCell(add) {
  const head = V(-0.66, 0.7, 0);
  add('membrane', 'Cell membrane', join([new THREE.SphereGeometry(1, 48, 32).scale(0.15, 0.1, 0.06).translate(head.x, head.y, head.z), taperedTube([V(-0.52, 0.7, 0), V(-0.4, 0.7, 0), V(-0.3, 0.7, 0)], 0.035, 0.03, 12)]), {layer: 'envelope'});
  add('nucleus', 'Nucleus (condensed)', new THREE.SphereGeometry(1, 40, 24).scale(0.13, 0.085, 0.05).translate(head.x + 0.01, head.y, head.z), {layer: 'shell'});
  add('acrosome', 'Acrosome', new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateZ(Math.PI / 2).scale(0.145, 0.095, 0.058).translate(head.x - 0.025, head.y, head.z));
  const helix = []; for (let t = 0; t <= 1; t += 0.01) helix.push(V(-0.51 + t * 0.2, 0.7 + 0.028 * Math.cos(t * 40), 0.028 * Math.sin(t * 40)));
  add('mitochondrion', 'Mitochondria (midpiece)', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 400, 0.009, 6, false));
  const tail = []; for (let t = 0; t <= 1; t += 0.02) tail.push(V(-0.31 + t * 1.15, 0.7 + 0.06 * Math.sin(t * 9) * t, 0.02 * Math.cos(t * 7) * t));
  add('sperm-flagellum', 'Flagellum', taperedTube([V(-0.52, 0.7, 0), ...tail], 0.013, 0.005, 8));
}

// Rod and cone photoreceptors, bottom to top as they sit in the retina (light arrives from below): synaptic terminal and
// axon, the cell body with its nucleus, the inner segment full of mitochondria, a connecting cilium, and the outer
// segment's stack of membrane discs (a rod's discs float inside it; a cone's are folds of its membrane, tapering).
function photoreceptorCell(add, cone) {
  const os0 = 0.86, os1 = cone ? 1.26 : 1.4, rOS = cone ? 0.1 : 0.075;
  add('membrane', 'Cell membrane', join([
    sphere(V(0, 0.12, 0), 0.06, 24, 16), taperedTube([V(0, 0.17, 0), V(0, 0.26, 0), V(0, 0.34, 0)], 0.018, 0.022, 8), new THREE.SphereGeometry(1, 40, 28).scale(0.1, 0.13, 0.1).translate(0, 0.44, 0),
    taperedTube([V(0, 0.55, 0), V(0, 0.57, 0)], 0.04, 0.05, 12),
    new THREE.CylinderGeometry(cone ? 0.012 : rOS + 0.012, rOS + 0.012, os1 - os0, 32, 1, true).translate(0, (os0 + os1) / 2, 0)]), {layer: 'envelope'});
  add('nucleus', 'Nucleus', new THREE.SphereGeometry(1, 36, 24).scale(0.075, 0.1, 0.075).translate(0, 0.44, 0), {layer: 'shell'});
  add('axon', 'Axon and synaptic terminal', join([taperedTube([V(0, 0.33, 0), V(0, 0.24, 0), V(0, 0.16, 0)], 0.016, 0.014, 8), sphere(V(0, 0.11, 0), 0.05, 20, 14)]));
  add('inner-segment', 'Inner segment', new THREE.SphereGeometry(1, 40, 28).scale(0.085, 0.16, 0.085).translate(0, 0.7, 0), {layer: 'shell'});
  add('mitochondrion', 'Mitochondria (inner segment)', join(Array.from({length: 18}, () => capsule(V(between(-0.045, 0.045), between(0.62, 0.8), between(-0.045, 0.045)), V(0, 1, 0), 0.011, 0.045))));
  add('cilium', 'Connecting cilium', taperedTube([V(0, 0.84, 0), V(0, 0.85, 0), V(0, os0 + 0.01, 0)], 0.01, 0.01, 6), {label: 'Connecting cilium'});
  const discs = [], n = cone ? 34 : 46;
  for (let i = 0; i < n; i++) { const t = i / (n - 1), y = os0 + 0.01 + t * (os1 - os0 - 0.02), r = cone ? 0.012 + (rOS - 0.012) * (1 - t) : rOS; discs.push(new THREE.CylinderGeometry(r, r, 0.004, 28, 1).translate(0, y, 0)); }
  add('outer-segment', cone ? 'Outer segment (stacked membrane folds)' : 'Outer segment (stacked discs)', join(discs));
}

// Schwann cells. Myelinating: layers of its own membrane wrapped round one axon segment, its nucleus on the outside.
// Non-myelinating: one cell enveloping several small axons, none of them wrapped in myelin.
function schwannCell(add, myelinating) {
  const Y = 0.66;
  if (myelinating) {
    add('axon', 'Axon (of the neuron it wraps)', new THREE.CylinderGeometry(0.045, 0.045, 1.6, 24, 1).rotateZ(Math.PI / 2).translate(0, Y, 0));
    add('membrane', 'Myelin: layers of the cell membrane wrapped round the axon', join(Array.from({length: 7}, (_, i) => new THREE.CylinderGeometry(0.065 + i * 0.022, 0.065 + i * 0.022, 1.2, 40, 1, true).rotateZ(Math.PI / 2).translate(0, Y, 0))), {layer: 'envelope', label: 'Cell membrane (myelin)'});
    add('nucleus', 'Nucleus', new THREE.SphereGeometry(1, 36, 24).scale(0.16, 0.05, 0.09).translate(0, Y + 0.24, 0), {layer: 'shell'});
    add('mitochondrion', 'Mitochondria', join(Array.from({length: 4}, (_, i) => capsule(V(-0.3 + i * 0.2, Y + 0.23, between(-0.06, 0.06)), V(1, 0, 0), 0.012, 0.04))));
  } else {
    add('membrane', 'Cell membrane', new THREE.SphereGeometry(1, 64, 40).scale(0.75, 0.22, 0.22).translate(0, Y, 0), {layer: 'envelope'});
    add('axon', 'Axons (of the neurons it envelops)', join(Array.from({length: 6}, (_, i) => { const a = (i / 6) * Math.PI * 2; return new THREE.CylinderGeometry(0.02, 0.02, 1.7, 12, 1).rotateZ(Math.PI / 2).translate(0, Y + 0.11 * Math.cos(a), 0.11 * Math.sin(a)); })));
    add('nucleus', 'Nucleus', new THREE.SphereGeometry(1, 36, 24).scale(0.2, 0.06, 0.07).translate(0.1, Y, 0), {layer: 'shell'});
  }
}

// Olfactory receptor neuron: a bipolar neuron; its dendrite ends in a knob bearing cilia, its axon runs the other way.
function olfactoryNeuron(add) {
  const C = V(0, 0.55, 0);
  add('membrane', 'Cell body', new THREE.SphereGeometry(1, 40, 28).scale(0.09, 0.13, 0.09).translate(C.x, C.y, C.z), {layer: 'envelope'});
  add('nucleus', 'Nucleus', new THREE.SphereGeometry(1, 32, 24).scale(0.06, 0.08, 0.06).translate(C.x, C.y, C.z), {layer: 'shell'});
  add('dendrite', 'Dendrite and knob', join([taperedTube([V(0, 0.68, 0), V(0.01, 0.9, 0), V(0, 1.12, 0)], 0.022, 0.016, 8), sphere(V(0, 1.15, 0), 0.035, 20, 14)]));
  add('cilium', 'Cilia', join(Array.from({length: 12}, (_, i) => { const a = (i / 12) * Math.PI * 2, b = V(0, 1.17, 0); return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([b, b.clone().add(V(0.05 * Math.cos(a), 0.06, 0.05 * Math.sin(a))), b.clone().add(V(0.16 * Math.cos(a), 0.1, 0.16 * Math.sin(a)))]), 12, 0.006, 5, false); })));
  add('axon', 'Axon', taperedTube([V(0, 0.42, 0), V(0.01, 0.25, 0), V(0, 0.06, 0)], 0.012, 0.01, 8));
}

/** A profiled cell type's model: a dedicated shape where the cell's form is its own (sperm, photoreceptors, Schwann
 * cells, olfactory neurons) or a family shape fits it (red cells, platelets, muscle, fat), else the general builder. */
function profileCell(add, prof, shape, noNucleus) {
  const P = profileParams(prof.claims), base = shape.base, s = P.shape ?? '', id = shape.from.id;
  const said = rx => P.special.some(v => rx.test(v)) || P.surface.some(v => rx.test(v)) || rx.test(s);
  if (/biconcave/.test(s) || base === 'red-blood-cell') redBloodCell(add);
  else if (base === 'platelet') platelet(add);
  else if (/tadpole/.test(s) || id === 'CL:0000019') spermCell(add);
  else if (/photoreceptor/.test(s) || ['CL:0000604', 'CL:0000573'].includes(id)) photoreceptorCell(add, /cone/.test(s) || id === 'CL:0000573');
  else if (['CL:0002573', 'CL:0002376'].includes(id)) schwannCell(add, id === 'CL:0002573');
  else if (id === 'CL:0000207') olfactoryNeuron(add);
  else if (/long cylinder/.test(s) || base === 'skeletal-muscle-fiber') { skeletalFiber(add); if (said(/t[- ]?tubul/i)) tTubules(add, 'skeletal'); }
  else if (/branched cylinder/.test(s) || base === 'cardiomyocyte') { cardiomyocyte(add); if (said(/t[- ]?tubul/i)) tTubules(add, 'cardiac'); }
  else if (base === 'fat-cell' || amount(P, 'lipid droplets', 0) === 3) fatCell(add);
  else generalProfileCell(add, P, base, noNucleus, shape.apical?.kind ?? null);
  return {extentUm: P.sizeUm, scale: P.sizeUm ? 1.4 / P.sizeUm : null};
}

const BUILDERS = {
  'generic': (add, apical, noNucleus) => noNucleus ? genericNoNucleus(add) : genericCell(add),
  'immune': immuneCell, 'branched-immune': branchedImmuneCell, 'red-blood-cell': redBloodCell, 'platelet': platelet, 'neuron': neuron,
  'cardiomyocyte': cardiomyocyte, 'skeletal-muscle-fiber': skeletalFiber, 'fat-cell': fatCell,
  'flat-epithelial': (add, apical, noNucleus) => epithelialCell(add, 'flat-epithelial', apical, noNucleus),
  'cube-epithelial': (add, apical, noNucleus) => epithelialCell(add, 'cube-epithelial', apical, noNucleus),
  'column-epithelial': (add, apical, noNucleus) => epithelialCell(add, 'column-epithelial', apical, noNucleus),
  'reconstruction': (add, apical, noNucleus, shape) => reconstructionCell(add, RECONSTRUCTIONS.groups[shape.reconstruction.group]),
  'profile': (add, apical, noNucleus, shape) => profileCell(add, PROFILES[shape.from.id], shape, noNucleus),
};

// The models cell types need (step 06 lists every cell type with its CL ancestors), always including the generic cell.
const needed = new Map([['generic-cell', {family: 'generic', apical: null, noNucleus: false}]]);
for (const [id, ancestors] of clAncestors()) { const s = shapeOf(id, ancestors); needed.set(s.variant, {family: s.family, apical: s.apical?.kind ?? null, noNucleus: !s.nucleus, shape: s}); }

const dir = rel('public/models/cell');
fs.mkdirSync(dir, {recursive: true});
const summary = {};
for (const [variant, {family, apical, noNucleus, shape}] of [...needed].sort((x, y) => x[0].localeCompare(y[0]))) {
  if (family !== 'reconstruction' && family !== 'profile' && variantOf(family, apical, noNucleus) !== variant) throw new Error(`variant name mismatch for ${variant}`);
  const parts = [];
  reseed(variant === 'generic-cell' ? 20261107 : variant);
  const look = {};  // a model may give a part its own colour and label (granules as they look in this cell)
  const built = BUILDERS[family]((key, name, geometry, extra = {}) => { if (!geometry) return; if (!byKey[key]) throw new Error(`${variant}: ${key} is not in organelles.json`); const {color, label, ...rest} = extra; if (color || label) look[key] = {...look[key], ...(color ? {color} : {}), ...(label ? {label} : {})}; parts.push({key, name, geometry, ...rest}); }, apical, noNucleus, shape) ?? {};
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
  const rootId = family === 'profile' ? shape.from.id.replace(':', '') : cell.id.replace(':', ''), rootName = family === 'profile' ? PROFILES[shape.from.id].label : 'Cell';
  const concepts = [{id: rootId, name: rootName, elements: out.map(p => p.id)}, ...drawn.map(o => ({id: o.id.replace(':', ''), name: look[o.key]?.label ?? o.label, elements: out.filter(p => p.system === o.key).map(p => p.id)}))];
  const rec = family === 'reconstruction' ? RECONSTRUCTIONS.groups[shape.reconstruction.group] : null;
  const prof = family === 'profile' ? PROFILES[shape.from.id] : null;
  const f = rec ? {label: rec.class} : prof ? {label: prof.label} : CELL_FAMILIES.families[family], caption = rec ? reconstructionCaption(rec, 'type') : prof ? shape.caption : captionOf(family, apical, noNucleus);
  fs.writeFileSync(path.join(dir, `${variant}.json`), JSON.stringify({
    version: variant === 'generic-cell' ? 'Bio Map generic cell v1' : `Bio Map ${variant.replace(/-/g, ' ')} v1`,
    source: rec ? `NeuroMorpho.Org ${rec.nmoId} (${rec.license}), drawn by Bio Map (pipeline/13-cell.mjs)` : 'Bio Map (procedural, pipeline/13-cell.mjs)',
    scope: variant === 'generic-cell' ? 'A generic cell: organelles typical of most cells; sizes and numbers are illustrative' : `${caption[0].toUpperCase()}${caption.slice(1)}`,
    gzipOnly: true, wholeConcepts: true, stage: {magnification: built.scale ? Math.round(built.scale * 1e6) : null, rootConceptId: rootId},
    cell: {family, label: f.label, variant, apical, nucleus: !noNucleus, caption, ...(rec ? {reconstruction: {nmoId: rec.nmoId, species: rec.species, extentUm: Math.round(built.extentUm), drawnSoma: rec.drawnSoma, attribution: rec.attribution}} : {})},
    palette: drawn.map(o => ({id: o.key, color: look[o.key]?.color ?? o.color, label: look[o.key]?.label ?? o.label})),
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
