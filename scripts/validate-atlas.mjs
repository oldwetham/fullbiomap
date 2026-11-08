import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
const filename=process.argv[2]??'atlas.json';
const base=new URL('../public/models/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL(filename,base)));
// Counts come from the manifest itself so new parts (e.g. HRA organs) do not need edits here.
assert.ok(atlas.parts.length>0,'no parts');assert.ok(atlas.concepts.length>0,'no concepts');
if(atlas.optimized?.preservedMeshes!==undefined)assert.equal(atlas.parts.length,atlas.optimized.preservedMeshes,'optimizer dropped meshes');
const ids=new Set(atlas.parts.map(p=>p.id));assert.equal(ids.size,atlas.parts.length,'duplicate part ids');
assert.equal(new Set(atlas.concepts.map(c=>c.id)).size,atlas.concepts.length,'duplicate concept ids');
// Chunks may live in subfolders (female/, organs/); gzip-only manifests (HRA) ship just the .gz.
const files=atlas.chunks.map(c=>{const file=new URL(c.url.replace(/^\/models\//,''),base);const b=atlas.gzipOnly?gunzipSync(fs.readFileSync(file)):fs.readFileSync(file);assert.equal(b.length,c.bytes,`${c.url}: size`);if(c.gzip)assert.ok(fs.existsSync(new URL(c.gzip.replace(/^\/models\//,''),base)),`${c.gzip} missing`);return b;});
let tris=0;
for(const p of atlas.parts){assert.ok(p.name.trim()&&p.name!=='-'&&!p.name.includes('Bounds('));assert.ok(p.conceptId!=='-');assert.ok(p.system);const b=files[p.chunk];assert.ok(p.indices+p.indexCount*4<=b.length);const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);assert.ok(indices.length>=3);for(const i of indices)assert.ok(i<p.vertexCount,`${p.id}: invalid vertex`);for(const value of pos)assert.ok(Number.isFinite(value));tris+=p.indexCount/3;}
for(const c of atlas.concepts){assert.ok(c.elements.length);for(const id of c.elements)assert.ok(ids.has(id),`${c.id}: missing ${id}`);}
assert.equal(tris,atlas.triangles);
console.log(`Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every binary buffer.`);
