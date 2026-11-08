// Shared GLB helpers for the HRA pipeline steps (05, 05b): a small GLB reader (JSON + BIN chunks,
// accessors, normalized attributes), node transform math, and the HRA crosswalk.csv reader.
import fs from 'node:fs';

// GLB reader: JSON + BIN chunks, accessors, node world transforms. No compression extensions are used by HRA.
export function readGlb(file) {
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
export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
export function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}

export function readCrosswalk(file) {
  const map = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
    const [node, id, label] = cells;
    if (node && /^(UBERON|FMA):\d+$/.test(id ?? '')) map.set(node, {id, label: label?.trim() || node});
  }
  return map;
}

