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
/** layer 'shell': see-through surface that takes taps (lung surfaces, nucleus); a tap selects its whole concept. 'envelope': see-through, taps go to what is inside first (cell membrane). system may also be a palette id (the cell's organelles). */
export interface Part {id:string;name:string;conceptId:string;system:SystemId;layer?:'shell'|'envelope';chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]]}
export interface Concept {id:string;name:string;elements:string[]}
export type Body = 'male'|'female';
/** stage: an organ interior normalized onto the stage (HRA); gzipOnly: chunks ship only as .gz and need DecompressionStream. */
export interface PaletteEntry {id:string;color:string;label:string}
/** palette: extra colored groups used like systems (the cell's organelles); wholeConcepts: a tap selects the tapped part's whole concept. */
export interface Atlas {version:string;sex?:Body;source?:string;scope?:string;gzipOnly?:boolean;stage?:{magnification:number|null;rootConceptId:string|null};
 /** 3D cells (step 13): the cell family this model draws, and the caption under it. */
 cell?:{family:string;label:string;variant:string;apical:string|null;nucleus:boolean;caption:string};palette?:PaletteEntry[];wholeConcepts?:boolean;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number}[];triangles:number}
export type View = 'three-quarter'|'front'|'back'|'side';
export interface SceneState {inspectorOpen?:boolean;/** Part ids tinted as related to the selection (second highlight color). */highlighted?:string[];explode:number;visible:SystemId[];selected:string[];isolate:boolean;view:View;rotate:boolean;reset:number}
export const DEFAULT_VISIBLE:SystemId[] = ['cardiac','sensory','skeletal','muscular','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','connective'];
export type ContentStatus = 'missing'|'auto'|'drafted'|'reviewed'|'verified';
export type Level = 1|2|3;
export const LEVELS:{level:Level;name:string}[] = [{level:1,name:'Plain'},{level:2,name:'Core'},{level:3,name:'Deep'}];
export interface ContentSource {title:string;url:string;license:string}
export interface TierSource {kind?:string;name:string;term?:string|null;url:string;license:string}
export interface ContentTier {status:ContentStatus;file?:string;text?:string;source?:TierSource|null;sources?:ContentSource[];license?:string;attribution?:string}
/** Per-node record served from public/content/<conceptId>.json (built by pipeline/11-build-graph.mjs); ids with a file are listed in public/content/index.json. */
export interface ConnectionSource {name:string;license:string;url:string}
/** One related structure: dir 'out' reads "this <rel> other", 'in' reads "other <rel> this". modeled=false means FMA names it but there is no 3D mesh. */
export interface Connection {rel:string;dir:'in'|'out';id:string;conceptId:string|null;label:string;modeled:boolean;sources:ConnectionSource[];/** The same structure's id in other bodies or models (e.g. its Uberon id). */alternates?:string[];
 /** A cell type's "Found in": the tissue board that lists it there, opened from the organ in the body (id) or the organ on its own stage (organ). */
 board?:{conceptId:string;label:string;id?:string;organ?:string}}
/** Every cell type and organelle, for search (public/content/cells.json, step 11). names: ontology label and exact synonyms;
 * terms: related words, ranked after names; model: the cell type's 3D model; cell: the cell type an organelle opens in. */
export interface CellIndex {cells:{id:string;label:string;names:string[];terms?:string[];model:string}[];organelles:{id:string;label:string;names:string[];cell:string}[]}
/** The organ a structure belongs to on the scale ladder, with the interior models that exist for it per body. */
export interface LadderOrgan {id:string;conceptId:string;label:string;alternates?:string[];interior?:Partial<Record<Body,string[]>>;/** Tissue boards: the organ's own and its is_a ancestors' (public/tissue/*.json). */tissue?:string[]}
/** board: a structure whose own tissue board the ladder organ does not reach (the tongue, the brain); tissue opens from it. */
export interface Ladder {system:SystemId;isOrgan:boolean;organ:LadderOrgan|null;board?:LadderOrgan}
/** Breadcrumb names per display system: the display system for the heart is itself called "Heart". */
export const LADDER_SYSTEM_NAMES:Partial<Record<SystemId,string>> = {cardiac:'Cardiovascular',arterial:'Arteries',venous:'Veins'};
export const ladderSystemName=(id:SystemId)=>LADDER_SYSTEM_NAMES[id]??SYSTEMS.find(s=>s.id===id)?.name??id;
/** A figure (step 10, docs/FIGURES-PLAN.md): a micrograph, labeled diagram or illustration with its source, licence, credit and link.
 * A tissue unit illustration (ftu) opens as its SVG with clickable cells; focus is the cell type it is shown for. */
export interface Figure {id:string;source:string;sourceName:string;kind:'micrograph'|'diagram'|'illustration';title:string;caption:string;alt:string;url:string;thumb:string;width?:number;height?:number;thumbWidth?:number;thumbHeight?:number;
 license:string;licenseUrl:string;credit:string;pageUrl:string;imageUrl?:string;sourceUrl?:string;terms?:string;status:'auto'|'reviewed';match:string;
 ftu?:{name:string;label:string;tissue?:string;hits:{cl:string;label:string;ids:string[]}[]};focus?:string;
 /** For cell types that look alike under a microscope: the sentence (also at the end of the caption) naming the proteins that tell them apart. */
 lookAlike?:string}
/** A fact card (step 11, docs/EXPLANATIONS-PLAN.md §2): what FMA, the HRA tables, Cell Ontology and GO say about a structure,
 * in their own wording. An item with a conceptId is a node (a chip that selects it where the model on screen has it). */
export interface FactItem {label:string;id?:string;conceptId?:string;alternates?:string[]}
export interface FactRow {key:string;label:string;title?:string;items:FactItem[]}
export interface Facts {status:ContentStatus;rows:FactRow[];board?:{label:string;count:number};sources:ConnectionSource[];reviewer?:string;reviewedOn?:string}
/** Connection groups the fact card shows (supply, drainage, nerves, where a cell type is found); the rest stay under Connections. */
export const CARD_RELATIONS=['arterial_supply','venous_drainage','lymphatic_drainage','nerve_supply','located_in'];
export interface NodeContent {id:string;conceptId:string;label:string;scale:string;system:string;synonyms:string[];xrefs:Record<string,string|string[]>;content:Record<'tier1'|'tier2'|'tier3',ContentTier>;sources:ContentSource[];connections?:Connection[];ladder?:Ladder;equivalent?:string;morphology?:Morphology;figures?:Figure[];facts?:Facts}
export const RELATION_LABELS:Record<string,{out:string;in:string}> = {
 arterial_supply:{out:'Supplied by',in:'Supplies'},
 venous_drainage:{out:'Drains to',in:'Drains'},
 nerve_supply:{out:'Innervated by',in:'Innervates'},
 lymphatic_drainage:{out:'Lymph drains to',in:'Receives lymph from'},
 branch_of:{out:'Branch of',in:'Branches'},
 tributary_of:{out:'Tributary of',in:'Tributaries'},
 attaches_to:{out:'Attaches to',in:'Attached to by'},
 articulates_with:{out:'Articulates with',in:'Articulates with'},
 continuous_with:{out:'Continuous with',in:'Continuous with'},
 located_in:{out:'Found in',in:'Cell types'},
 component_of:{out:'Part of',in:'Components'},
};
export interface ConnectionGroup {key:string;label:string;items:Connection[]}
/** Groups connections by relation and direction, keeping the order step 11 wrote them in. */
export function connectionGroups(list:Connection[]):ConnectionGroup[]{
 const groups=new Map<string,ConnectionGroup>();
 for(const c of list){const key=`${c.rel}:${c.dir}`;const g=groups.get(key)??{key,label:RELATION_LABELS[c.rel]?.[c.dir]??c.rel,items:[]};g.items.push(c);groups.set(key,g);}
 return [...groups.values()];
}
/** known: the structure has a content file (then its text is never replaced by the system's description). */
export interface Explanation {text:string;level:Level|null;tier?:ContentTier;available:Level[];connections:Connection[];ladder:Ladder|null;figures:Figure[];facts:Facts|null;known:boolean}
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
/** Text for an atlas concept id (e.g. FMA7088) at the preferred level, falling back to tier 1; with no text, the fact card alone; the system description only when no content file exists or it fails to load. */
export async function explanationFor(conceptId:string,system:SystemId,preferred:Level=1):Promise<Explanation>{
 const node=await loadContent(conceptId);
 const tierOf=(l:Level)=>node?.content?.[`tier${l}`];
 const available=LEVELS.map(x=>x.level).filter(l=>{const t=tierOf(l);return !!t&&t.status!=='missing'&&!!t.text;});
 const level=available.includes(preferred)?preferred:available[0]??null;
 const connections=node?.connections??[],ladder=node?.ladder??null,figures=node?.figures??[],facts=node?.facts??null,known=!!node;
 if(level)return {text:tierOf(level)!.text!,level,tier:tierOf(level),available,connections,ladder,figures,facts,known};
 // A structure with a content file but no text has its fact card; only one without a file gets its system's description.
 return {text:node?'':SYSTEMS.find(s=>s.id===system)?.description??'',level:null,available,connections,ladder,figures,facts,known};
}

/** Deep links: [female/]<id>[/inside[/<part>]], or organ/<hra-object>[/<part>] for an organ opened on its own
 * (e.g. #organ/uterus-female), or organ/cell-<cl id>[/<GO id>] for a cell type on its own stage, with an organelle
 * selected (e.g. #organ/cell-cl0000000/GO0005739). <id> is a concept or mesh id (FMA7088, UBERON0000948, FJ1252); FMA:7088 and
 * FMA_7088 spellings are accepted. Every Phase 0-2 link (#FMA7088) still parses; #female links are mapped
 * to the main body by the page (the female whole-body view is disabled). */
export interface HashState {body:Body;id:string;inside:boolean;part:string;organ?:string;tissue?:boolean;cell?:string;organelle?:string}
const cleanId=(s:string)=>s.replace(/[:_]/g,'');
export function parseHash(hash:string):HashState{
 let raw='';try{raw=decodeURIComponent(hash.replace(/^#/,''));}catch{raw='';}
 let bits=raw.split('/').filter(Boolean);let body:Body='male';
 // Tissue and cell levels: .../tissue[/<cell type>[/<organelle>]] after an organ (#FMA7205/tissue/CL0000653/GO0005739).
 const t=bits.indexOf('tissue'),tissue=t>=0?{tissue:true,cell:bits[t+1]?cleanId(bits[t+1]):'',organelle:bits[t+2]?cleanId(bits[t+2]):''}:{};
 if(t>=0)bits=bits.slice(0,t);
 if(bits[0]==='organ'&&bits[1])return {body,id:'',inside:false,part:bits[2]?cleanId(bits[2]):'',organ:bits[1],...tissue};
 if(bits[0]==='female'||bits[0]==='male')body=bits.shift() as Body;
 const id=bits[0]?cleanId(bits[0]):'',inside=bits[1]==='inside',part=inside&&bits[2]?cleanId(bits[2]):'';
 return {body,id,inside,part,...tissue};
}
export function formatHash(h:HashState):string{
 if(h.tissue){const base=formatHash({...h,tissue:false,inside:false,part:''});return `${base||'#'}/tissue${h.cell?`/${h.cell}${h.organelle?`/${h.organelle}`:''}`:''}`;}
 if(h.organ)return `#organ/${h.organ}${h.part?`/${h.part}`:''}`;
 if(!h.id)return h.body==='female'?'#female':'';
 return `#${h.body==='female'?'female/':''}${h.id}${h.inside?`/inside${h.part?`/${h.part}`:''}`:''}`;
}

/** A tissue board (public/tissue/<organ>.json, step 11): cell types by structure, the organ's figures, and its other tissue unit illustrations. */
/** How a cell type is drawn in 3D (step 11, from pipeline/maps/cell-families.json): its family, the Cell Ontology class that chose it, and why it has no nucleus if it has none. */
export interface Reconstruction {group:string;level:'type'|'class';nmoId:string;neuronName:string;species:string;region:string[];drawnSoma:boolean;page:string;paper:{citation:string;doi:string|null;pmid:string|null};license:string;licenseUrl:string;attribution:string}
export interface CellShape {family:string;label:string;variant:string;apical:string|null;nucleus:boolean;from:{id:string;label:string}|null;note?:string;noNucleus?:string;caption?:string;reconstruction?:Reconstruction;
 /** A model drawn from the cell type's morphology profile: the family shape it falls back on, and which fields the profile states. */
 base?:string;baseLabel?:string;outline?:'profile'|'family'|'illustrative';profile?:{status:string;claims:number;fields:string[];drawn:boolean}}
/** A cell type's morphology profile (content/CL_<n>/morphology.md, step 11): checked claims, each with the sentence it quotes. */
export interface MorphologySource {name:string;citation:string;license:string;url:string;access?:string}
export interface MorphologyClaim {field:string;value:string;quote:string;source:{section:string;url:string;license:string;citation:string;access?:string}}
export interface Morphology {status:string;file:string;license:string;attribution:string;method:string;draftedOn?:string;sources:MorphologySource[];claims:MorphologyClaim[]}
export interface TissueCell {id:string;conceptId:string;label:string;model?:string;shape?:CellShape}
export interface TissueBoard {organ:{id:string;conceptId:string;label:string};tables:{name:string;version:string;doi:string;citation:string}[];cellCount:number;groups:{structure:string;cells:TissueCell[]}[];figures:Figure[];units:Figure[]}
/** Merges an organ's own board with its is_a ancestors' (the left kidney shows the kidney's). The strip keeps the first
 * board's figures first and holds at most three; every other tissue unit illustration is listed under it. */
export function mergeBoards(boards:TissueBoard[]):TissueBoard|null{
 if(!boards.length)return null;
 const groups=new Map<string,Map<string,TissueCell>>(),figures=new Map<string,Figure>(),units=new Map<string,Figure>(),tables=new Map<string,TissueBoard['tables'][number]>();
 for(const b of boards){for(const g of b.groups){const m=groups.get(g.structure)??new Map();for(const c of g.cells)m.set(c.id,c);groups.set(g.structure,m);}for(const f of b.figures??[])if(!figures.has(f.id))figures.set(f.id,f);for(const f of b.units??[])if(!units.has(f.id))units.set(f.id,f);for(const t of b.tables)tables.set(t.name,t);}
 const merged=[...groups].map(([structure,cells])=>({structure,cells:[...cells.values()]})).sort((a,b)=>b.cells.length-a.cells.length||a.structure.localeCompare(b.structure));
 const all=[...figures.values()],strip=all.slice(0,3),shown=new Set(strip.map(f=>f.id));
 return {organ:boards[0].organ,tables:[...tables.values()],cellCount:new Set(merged.flatMap(g=>g.cells.map(c=>c.id))).size,groups:merged,figures:strip,units:[...all.slice(3).filter(f=>!!f.ftu),...units.values()].filter(f=>!shown.has(f.id))};
}
