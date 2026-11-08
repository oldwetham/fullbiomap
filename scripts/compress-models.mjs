import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
// Usage: node scripts/compress-models.mjs [manifest paths under public/models; default: every manifest]
// Writes <chunk>.bin.gz for every chunk and records gzip/gzipBytes. Manifests with gzipOnly
// (HRA assets, which need DecompressionStream) keep only the .gz: the .bin is removed and the
// chunk url points at the .gz.
// Reuse an existing .gz when it already decompresses to the current chunk, so output does not
// depend on the local zlib build (Node versions compress the same bytes slightly differently).
const reuse=(bin,gz)=>{try{const old=fs.readFileSync(gz);return gunzipSync(old).equals(bin)?old:null;}catch{return null;}};
const base=new URL('../public/models/',import.meta.url);
const all=()=>['atlas.json',...['female'].filter(d=>fs.existsSync(new URL(`${d}/atlas.json`,base))).map(d=>`${d}/atlas.json`),...(fs.existsSync(new URL('organs/',base))?fs.readdirSync(new URL('organs/',base)).filter(f=>f.endsWith('.json')).map(f=>`organs/${f}`):[])];
for(const name of process.argv.length>2?process.argv.slice(2):all()){
 const path=new URL(name,base),atlas=JSON.parse(fs.readFileSync(path));
 let bytes=0;
 for(const c of atlas.chunks){
  const binName=(c.gzip&&atlas.gzipOnly?c.gzip.replace(/\.gz$/,''):c.url).replace(/^\/models\//,''),binPath=new URL(binName,base),gzPath=new URL(binName+'.gz',base);
  const bin=fs.existsSync(binPath)?fs.readFileSync(binPath):gunzipSync(fs.readFileSync(gzPath));
  const compressed=reuse(bin,gzPath)??gzipSync(bin,{level:9});
  c.gzip='/models/'+binName+'.gz';c.gzipBytes=compressed.length;fs.writeFileSync(gzPath,compressed);bytes+=compressed.length;
  if(atlas.gzipOnly){c.url=c.gzip;if(fs.existsSync(binPath))fs.unlinkSync(binPath);}
 }
 fs.writeFileSync(path,JSON.stringify(atlas));console.log(`${name}: ${(bytes/1e6).toFixed(1)} MB compressed download`);
}
