import type {Morphology,MorphologyClaim} from './anatomy';

/** The panel's Morphology section for a cell type: what its profile says it looks like, each claim opening to the
 * sentence it quotes and where that sentence is, then the sources' credits (from the profile's fields). */
const FIELDS:[string,string][]=[['shape','Shape'],['size','Size'],['nucleus_count','Nuclei'],['nucleus_shape','Nucleus shape'],['nucleus_position','Nucleus position'],['nucleus_size','Nucleus size'],['surface','Surface'],['granules','Granules'],['organelle','Organelles'],['special','Special structures']];
const COUNT:Record<string,string>={'0':'None','1':'One','2':'Two'};
const upper=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
/** A claim's value in words (granule and organelle values are stored as "kind; look: …; abundance: …" and "name: 0–3 word"). */
export function claimText(c:MorphologyClaim):string{
 const v=c.value.trim();
 if(c.field==='granules'){
  const [kind,...rest]=v.split(';').map(x=>x.trim()),o:Record<string,string>={};
  for(const r of rest){const i=r.indexOf(':');if(i>0)o[r.slice(0,i).trim()]=r.slice(i+1).trim();}
  const known=(x?:string)=>x&&!/^(unknown|throughout)$/i.test(x)?x:'';
  return [upper(kind),known(o.look),known(o.abundance),known(o.position)].filter(Boolean).join(' · ');
 }
 if(c.field==='organelle'){const m=v.match(/^(.+?):\s*\d\s*(.*)$/);return m?`${upper(m[1].trim())}: ${m[2].trim()||'stated'}`:upper(v);}
 if(c.field==='nucleus_count'){const m=v.match(/^(\d)\b(.*)$/);return m?`${COUNT[m[1]]??m[1]}${m[2]}`:upper(v);}
 return upper(v);
}
/** Text with its URLs as links (credits name their pages in full, as OpenStax asks). */
export function linkify(text:string){
 return text.split(/(https?:\/\/[^\s;,)]+[^\s;,).])/).map((part,i)=>i%2?<a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>:part);
}
function Quote({claim}:{claim:MorphologyClaim}){
 return <blockquote className="morphology-quote"><p>“{claim.quote}”</p><cite><a href={claim.source.url} target="_blank" rel="noreferrer">{claim.source.section}</a> · {claim.source.license}</cite></blockquote>;
}
export default function MorphologySection({morphology}:{morphology:Morphology}){
 const rows=FIELDS.map(([field,label])=>{const claims=morphology.claims.filter(c=>c.field===field);return {field,label,claims,values:[...new Map(claims.map(c=>[claimText(c).toLowerCase(),claimText(c)])).values()]};}).filter(r=>r.claims.length);
 const jobs=morphology.claims.filter(c=>c.field==='function'),unreviewed=morphology.status==='auto'||morphology.status==='drafted';
 return <section className="morphology" aria-label="Morphology">
  <h3>Morphology{unreviewed&&<span className="badge-unreviewed" title="Not yet checked by a reviewer">Unreviewed</span>}</h3>
  <div className="morphology-list">{rows.map(r=><details key={r.field} className="morphology-row"><summary><span className="morphology-field">{r.label}</span><span className="morphology-value">{r.values.join('; ')}</span></summary>{r.claims.map((c,i)=><Quote key={i} claim={c}/>)}</details>)}</div>
  {jobs.length>0&&<><h4>How its structure fits its job</h4><div className="morphology-list">{jobs.map((c,i)=><details key={i} className="morphology-row"><summary><span className="morphology-value">{c.value}</span></summary><Quote claim={c}/></details>)}</div></>}
  <p className="morphology-credit">Quoted from {morphology.sources.map((s,i)=><span key={s.name}>{i>0?'; ':''}{linkify(s.citation)} ({s.license}){s.access?<>. {linkify(s.access)}</>:null}</span>)}. {morphology.method}</p>
 </section>;
}
