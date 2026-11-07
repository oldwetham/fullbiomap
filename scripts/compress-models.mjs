import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
// Reuse an existing .gz when it already decompresses to the current chunk, so output does not
// depend on the local zlib build (Node versions compress the same bytes slightly differently).
const reuse=(bin,gz)=>{try{const old=fs.readFileSync(gz);return gunzipSync(old).equals(bin)?old:null;}catch{return null;}};
const base=new URL('../public/models/',import.meta.url);
for(const name of fs.readdirSync(base).filter(n=>n==='atlas.json')){
 const path=new URL(name,base),atlas=JSON.parse(fs.readFileSync(path));
 let bytes=0;
 for(const c of atlas.chunks){const bin=fs.readFileSync(new URL(c.url.split('/').pop(),base)),gzPath=new URL(c.url.split('/').pop()+'.gz',base);const compressed=reuse(bin,gzPath)??gzipSync(bin,{level:9});c.gzip=c.url+'.gz';c.gzipBytes=compressed.length;fs.writeFileSync(new URL(c.gzip.split('/').pop(),base),compressed);bytes+=compressed.length;}
 fs.writeFileSync(path,JSON.stringify(atlas));console.log(`${name}: ${(bytes/1e6).toFixed(1)} MB compressed download`);
}
