import fs from 'node:fs';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
// Usage: node scripts/optimize-anatomy.mjs [path under public/models, default atlas.json]
// Chunk prefix: 'body' for atlas.json, the folder for <folder>/atlas.json, else the file name
// (female/atlas.json -> female/female-0.bin, organs/heart-male.json -> organs/heart-male-0.bin).
const name=process.argv[2]??'atlas.json',sub=name.includes('/')?name.slice(0,name.lastIndexOf('/')+1):'',base=name.slice(sub.length).replace(/\.json$/,'');
const prefix=name==='atlas.json'?'body':base==='atlas'?sub.replace(/\/$/,'').split('/').pop():base;
const dir=new URL(`../public/models/${sub}`,import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL(name,new URL('../public/models/',import.meta.url)),'utf8'));
// HRA exports (female body, organ interiors) duplicate vertices at triangle boundaries and need welding.
const weld=manifest.source==='HRA'||prefix==='female';
const originals=manifest.chunks.map(c=>c.url.split('/').pop());
if(manifest.optimized)throw new Error('Already optimized. Re-run the source converter first.');
const source=manifest.chunks.map(c=>fs.readFileSync(new URL(c.url.split('/').pop(),dir)));
let chunks=[],segments=[],bytes=0,triangles=0,maxError=0;
const flush=()=>{if(!bytes)return;const url=`/models/${sub}${prefix}-${chunks.length}.bin`;fs.writeFileSync(new URL(url.split('/').pop(),dir),Buffer.concat(segments));chunks.push({url,bytes});segments=[];bytes=0;};
const append=a=>{const padding=(4-bytes%4)%4;if(padding){segments.push(Buffer.alloc(padding));bytes+=padding;}const offset=bytes;const b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);segments.push(b);bytes+=b.length;return offset;};
for(const p of manifest.parts){
 const b=source[p.chunk];let pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),normal=new Int16Array(b.buffer,b.byteOffset+p.normals,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);
 if(weld){
  // HRA exports often duplicate vertices at triangle boundaries. Weld coincident positions
  // before simplification, averaging their source normals for smooth anatomical surfaces.
  const map=new Map(),remap=new Uint32Array(p.vertexCount),wp=[],wn=[];
  for(let i=0;i<p.vertexCount;i++){
   const k=`${pos[i*3]},${pos[i*3+1]},${pos[i*3+2]}`;let index=map.get(k);
   if(index===undefined){index=wp.length/3;map.set(k,index);wp.push(pos[i*3],pos[i*3+1],pos[i*3+2]);wn.push(0,0,0);}
   remap[i]=index;for(let a=0;a<3;a++)wn[index*3+a]+=normal[i*3+a];
  }
  for(let i=0;i<wn.length;i+=3){const length=Math.hypot(wn[i],wn[i+1],wn[i+2])||1;for(let a=0;a<3;a++)wn[i+a]=Math.round(wn[i+a]/length*32767);}
  pos=new Float32Array(wp);normal=new Int16Array(wn);indices=Uint32Array.from(indices,i=>remap[i]);
 }
 // Preserve each named mesh, narrow vessels, and small organs. Bound geometric error to 0.2% of each part's extent.
 const target=Math.max(96,Math.floor(p.indexCount*.22/3)*3);
 const [simplified,error]=MeshoptSimplifier.simplify(indices,pos,3,Math.min(indices.length,target),.002);
 maxError=Math.max(maxError,error);const [remap,count]=MeshoptSimplifier.compactMesh(simplified);
 const positions=new Float32Array(count*3),normals=new Int16Array(count*3);
 for(let old=0;old<remap.length;old++){const n=remap[old];if(n===0xffffffff)continue;positions.set(pos.subarray(old*3,old*3+3),n*3);normals.set(normal.subarray(old*3,old*3+3),n*3);}
 if(bytes>4_000_000)flush();
 p.chunk=chunks.length;p.positions=append(positions);p.normals=append(normals);p.indices=append(simplified);p.vertexCount=count;p.indexCount=simplified.length;triangles+=simplified.length/3;
}
flush();manifest.sourceTriangles=manifest.triangles;manifest.triangles=triangles;manifest.chunks=chunks;manifest.optimized={method:'meshoptimizer quadric simplification',maximumRelativeError:.002,preservedMeshes:manifest.parts.length};
fs.writeFileSync(new URL(base+'.json',dir),JSON.stringify(manifest));
// Remove only converter outputs superseded by the optimized chunks.
for(const name of originals)fs.unlinkSync(new URL(name,dir));
console.log(JSON.stringify({parts:manifest.parts.length,triangles,bytes:chunks.reduce((n,c)=>n+c.bytes,0),chunks:chunks.length,maxError}));
