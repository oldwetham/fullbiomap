import type {Concept} from './anatomy';

/** Search over body structures, organs opened on their own, cell types and organelles (public/content/cells.json).
 * Names and synonyms match ignoring case, hyphens and punctuation ("T-cell" is "T cell"), British spellings
 * ("haematopoietic", "leucocyte", "fibre") and plurals ("T cells", "mitochondria", "nuclei"). Ranking: an exact name
 * first, then a name that starts with the query, then a name with a word that starts with it, then a name that
 * contains it, then a name with every query word; within each, a structure's own label before a synonym, then
 * shorter labels. Related terms (curated words such as "cochlea" for a hair cell) rank after every name. */

/** British to American spellings, applied to names and queries alike. */
const SPELLINGS:[RegExp,string][]=[[/leuc/g,'leuk'],[/haem/g,'hem'],[/aemia/g,'emia'],[/ischaem/g,'ischem'],[/oesoph/g,'esoph'],[/oestr/g,'estr'],[/oedem/g,'edem'],
 [/foet/g,'fet'],[/paed/g,'ped'],[/gynaec/g,'gynec'],[/caec/g,'cec'],[/faec/g,'fec'],[/fibre/g,'fiber'],[/centre/g,'center'],[/tumour/g,'tumor'],[/colour/g,'color'],[/sulph/g,'sulf']];
/** Plurals that do not end in a plain "s". */
const LATIN:Record<string,string>={mitochondria:'mitochondrion',nuclei:'nucleus',nucleoli:'nucleolus',cilia:'cilium',stereocilia:'stereocilium',kinocilia:'kinocilium',
 flagella:'flagellum',microvilli:'microvillus',villi:'villus',alveoli:'alveolus',bronchi:'bronchus',bronchioli:'bronchiolus',glomeruli:'glomerulus',
 ganglia:'ganglion',septa:'septum',atria:'atrium',lumina:'lumen',foramina:'foramen',corpora:'corpus',vertebrae:'vertebra',phalanges:'phalanx',testes:'testis',
 ova:'ovum',teeth:'tooth',feet:'foot'};
const singular=(w:string)=>LATIN[w]??(w.length<=3||/(ss|us|is)$/.test(w)?w:/ies$/.test(w)?`${w.slice(0,-3)}y`:/(sses|xes|ches|shes)$/.test(w)?w.slice(0,-2):w.endsWith('s')?w.slice(0,-1):w);
/** A name's search key: lower case, accents and punctuation gone ("CD4+" reads "cd4 positive"), American spelling, singular words. */
export function searchKey(s:string):string{
 let t=s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/['’`]/g,'').replace(/\+/g,' positive ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 for(const [re,to] of SPELLINGS)t=t.replace(re,to);
 return t?t.split(' ').map(singular).join(' '):'';
}

export type SearchKind='structure'|'organ'|'cell'|'organelle';
/** One searchable thing. names[0] is its label; terms rank after every name. ref: what picking it opens. */
export interface SearchEntry {kind:SearchKind;id:string;ref:string;label:string;tag?:string;elements:string[];names:{key:string;text:string}[];terms:{key:string;text:string}[]}
/** A result, shaped like a Concept for the combobox: a structure keeps its concept id (it is chosen as itself), anything
 * else gets "<kind>:<id>". alias: the synonym or term that matched, when it is not the label. */
export type SearchHit=Concept&{kind:SearchKind;ref:string;tag?:string;alias?:string};

export function searchEntry(kind:SearchKind,id:string,ref:string,label:string,names:string[]=[],terms:string[]=[],extra:{tag?:string;elements?:string[]}={}):SearchEntry{
 const keyed=(list:string[])=>{const seen=new Set<string>();return list.map(text=>({key:searchKey(text),text})).filter(x=>x.key&&!seen.has(x.key)&&!!seen.add(x.key));};
 return {kind,id,ref,label,tag:extra.tag,elements:extra.elements??[],names:keyed([label,...names]),terms:keyed(terms)};
}

/** How well a key matches the query key (lower is better), or null. */
function tier(key:string,q:string,words:string[]):number|null{
 if(key===q)return 0;
 if(key.startsWith(q))return 1;
 if(key.includes(` ${q}`))return 2;
 if(key.includes(q))return 3;
 if(words.length>1){const kw=key.split(' ');if(words.every(w=>kw.some(k=>k.startsWith(w))))return 4;}
 return null;
}
const ID=/^(fma|cl|go|uberon)[\s:_]?\d+$/i;

/** The best matches for a query, best first. An id-shaped query (CL:0000084, FMA7088) matches ids. */
export function searchEntries(entries:SearchEntry[],query:string,limit=80):SearchHit[]{
 const q=searchKey(query);if(!q)return [];
 const words=q.split(' '),idq=ID.test(query.trim())?query.trim().replace(/[\s:_]/g,'').toUpperCase():'';
 const scored:{e:SearchEntry;rank:number;own:number;alias?:string}[]=[];
 for(const e of entries){
  let best:{rank:number;own:number;alias?:string}|null=null;
  if(idq){const id=e.ref.toUpperCase();if(id===idq)best={rank:0,own:0};else if(id.startsWith(idq))best={rank:1,own:0};}
  e.names.forEach((n,i)=>{const t=tier(n.key,q,words);if(t===null)return;const c={rank:t,own:i===0?0:1,alias:i===0?undefined:n.text};if(!best||c.rank<best.rank||(c.rank===best.rank&&c.own<best.own))best=c;});
  if(!best)for(const n of e.terms){const t=tier(n.key,q,words);if(t!==null&&(!best||5+t<best.rank))best={rank:5+t,own:1,alias:n.text};}
  if(best)scored.push({e,...best});
 }
 scored.sort((a,b)=>a.rank-b.rank||a.own-b.own||a.e.label.length-b.e.label.length||a.e.label.localeCompare(b.e.label));
 return scored.slice(0,limit).map(({e,alias})=>({id:e.kind==='structure'?e.id:`${e.kind}:${e.id}`,name:e.label,elements:e.elements,kind:e.kind,ref:e.ref,tag:e.tag,alias}));
}
