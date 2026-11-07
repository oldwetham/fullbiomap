export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac';
export const SYSTEMS: {id:SystemId;name:string;color:string;description:string}[] = [
 {id:'skeletal',name:'Skeleton',color:'#e2d9ba',description:'Bones form the supporting framework of the body, protect organs, and provide attachment points for muscles. Their internal tissue also stores minerals and produces blood cells.'},
 {id:'muscular',name:'Muscles',color:'#a85b50',description:'Skeletal muscles generate movement by pulling on their attachments. Together with tendons, they move joints, stabilize posture, and produce heat.'},
 {id:'cardiac',name:'Heart',color:'#b96760',description:'The heart is a muscular pump with four chambers. Its valves direct blood forward through the pulmonary and systemic circuits.'},
 {id:'sensory',name:'Sensory organs',color:'#b0c8ce',description:'These structures contribute to special senses, including sight, hearing, and balance. Their specialized tissues detect stimuli and work with the nervous system to convey information.'},
 {id:'arterial',name:'Arteries',color:'#c05245',description:'The heart drives blood through the circulation. Arteries carry blood away from the heart to supply tissues or, in the pulmonary circuit, to the lungs.'},
 {id:'venous',name:'Veins',color:'#527c9f',description:'Veins return blood toward the heart. Superficial and deep networks collect blood from the tissues; the pulmonary veins bring oxygenated blood back from the lungs.'},
 {id:'nervous',name:'Nervous system',color:'#d8b565',description:'The brain, spinal cord, and peripheral nerves carry and process signals. They support sensation, movement, coordination, and automatic regulation of body functions.'},
 {id:'respiratory',name:'Respiratory',color:'#b98991',description:'The airways conduct air to the lungs, where oxygen and carbon dioxide move between air and blood. Breathing depends on pressure changes produced by respiratory muscles.'},
 {id:'digestive',name:'Digestive',color:'#b8916b',description:'The digestive tract breaks down food, absorbs nutrients and water, and moves waste onward. Accessory organs contribute bile and digestive enzymes.'},
 {id:'urinary',name:'Urinary',color:'#b47961',description:'The kidneys filter blood and regulate fluid, electrolyte, and acid–base balance. Urine travels through the ureters to the bladder and exits through the urethra.'},
 {id:'lymphatic',name:'Lymphatic',color:'#879f7c',description:'Lymphatic vessels return excess tissue fluid to the circulation. Lymph nodes and other lymphoid organs support immune surveillance and responses.'},
 {id:'endocrine',name:'Endocrine',color:'#c5a09a',description:'Endocrine organs release hormones into the blood to coordinate processes such as metabolism, growth, stress responses, and reproduction.'},
 {id:'reproductive',name:'Reproductive',color:'#bda098',description:'The male reproductive structures represented here contribute to sperm production, maturation, transport, and the production of sex hormones.'},
 {id:'integumentary',name:'Body surface',color:'#ba9b7d',description:'The body surface provides an outer anatomical reference. The integumentary system forms a protective barrier and contributes to sensation and temperature regulation.'},
 {id:'connective',name:'Connective tissue',color:'#aec3bb',description:'Cartilage, ligaments, and other connective tissues support, connect, and separate structures. Their roles include stabilizing joints and distributing mechanical loads.'},
];
export interface Part {id:string;name:string;conceptId:string;system:SystemId;chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]]}
export interface Concept {id:string;name:string;elements:string[]}
export interface Atlas {version:string;sex?:'male';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number}[];triangles:number}
export type View = 'three-quarter'|'front'|'back'|'side';
export interface SceneState {inspectorOpen?:boolean;explode:number;visible:SystemId[];selected:string[];isolate:boolean;view:View;rotate:boolean;reset:number}
export const DEFAULT_VISIBLE:SystemId[] = ['cardiac','sensory','skeletal','muscular','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','connective'];
export type ContentStatus = 'missing'|'auto'|'drafted'|'reviewed'|'verified';
export type Level = 1|2|3;
export const LEVELS:{level:Level;name:string}[] = [{level:1,name:'Plain'},{level:2,name:'Core'},{level:3,name:'Deep'}];
export interface ContentSource {title:string;url:string;license:string}
export interface TierSource {kind?:string;name:string;term?:string|null;url:string;license:string}
export interface ContentTier {status:ContentStatus;file?:string;text?:string;source?:TierSource|null;sources?:ContentSource[];license?:string;attribution?:string}
/** Per-node record served from public/content/<conceptId>.json (built by pipeline/11-build-graph.mjs); ids with a file are listed in public/content/index.json. */
export interface NodeContent {id:string;conceptId:string;label:string;scale:string;system:string;synonyms:string[];xrefs:Record<string,string|string[]>;content:Record<'tier1'|'tier2'|'tier3',ContentTier>;sources:ContentSource[]}
export interface Explanation {text:string;level:Level|null;tier?:ContentTier;available:Level[]}
export const isUnreviewed=(t?:ContentTier)=>t?.status==='auto'||t?.status==='drafted';
let contentIndex:Promise<Set<string>>|null=null;
const contentCache=new Map<string,Promise<NodeContent|null>>();
const getJson=async<T>(url:string):Promise<T|null>=>{try{const r=await fetch(url);if(!r.ok||!r.headers.get('content-type')?.includes('json'))return null;return await r.json() as T;}catch{return null;}};
export function loadContent(conceptId:string):Promise<NodeContent|null>{
 contentIndex??=getJson<{ids:string[]}>('/content/index.json').then(x=>new Set(x?.ids??[]));
 let entry=contentCache.get(conceptId);
 if(!entry){entry=contentIndex.then(ids=>ids.has(conceptId)?getJson<NodeContent>(`/content/${conceptId}.json`):null);contentCache.set(conceptId,entry);}
 return entry;
}
/** Text for an atlas concept id (e.g. FMA7088) at the preferred level, falling back to tier 1, then to the system description when no content file exists or it fails to load. */
export async function explanationFor(conceptId:string,system:SystemId,preferred:Level=1):Promise<Explanation>{
 const node=await loadContent(conceptId);
 const tierOf=(l:Level)=>node?.content?.[`tier${l}`];
 const available=LEVELS.map(x=>x.level).filter(l=>{const t=tierOf(l);return !!t&&t.status!=='missing'&&!!t.text;});
 const level=available.includes(preferred)?preferred:available[0]??null;
 if(level)return {text:tierOf(level)!.text!,level,tier:tierOf(level),available};
 return {text:SYSTEMS.find(s=>s.id===system)?.description??'',level:null,available};
}
