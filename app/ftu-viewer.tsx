import {useEffect,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import type {TissueCell,TissueMedia} from './anatomy';

/** Parses an SVG and drops anything executable. Step 12 already refuses such files; this keeps the inline copy safe regardless. */
function safeSvg(text:string):Element|null{
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),svg=doc.documentElement;
 if(doc.getElementsByTagName('parsererror').length||svg.localName!=='svg')return null;
 for(const e of [...svg.querySelectorAll('script,foreignObject')])e.remove();
 for(const e of [svg,...svg.querySelectorAll('*')])for(const a of [...e.attributes]){
  const v=a.value.trim().toLowerCase();
  if(a.name.toLowerCase().startsWith('on')||(a.localName==='href'&&!v.startsWith('#')&&!v.startsWith('data:image/')))e.removeAttribute(a.name);
 }
 return svg;
}
// Inside the shadow root, so the drawing's own <style> rules and these stay apart from the page's.
// Only drawn cells take the pointer: label and background layers drawn over them let clicks through.
const SHADOW_CSS=':host{display:block;width:100%;height:100%}svg{display:block;width:100%;height:100%}svg,svg *{pointer-events:none}'
 +'[data-cell],[data-cell] *{pointer-events:visiblePainted}[data-cell]{cursor:pointer}[data-cell].off{cursor:default}'
 // HRA draws each cell's crosswalk shapes under the illustration, so the pointed-at cell type is redrawn on top
 // (.ftu-hot: copies of its shapes in amber) while the rest of the drawing fades back.
 +'svg.has-hot>:not(.ftu-hot){opacity:.45}'
 +'.ftu-hot,.ftu-hot *{pointer-events:none!important;fill:#e08a1e!important;fill-opacity:.42!important;stroke:#a85a0a!important;stroke-opacity:1!important;stroke-width:1.4px!important;vector-effect:non-scaling-stroke;opacity:1!important}';
const SVG_NS='http://www.w3.org/2000/svg';
const upperFirst=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);

/** An HRA tissue unit illustration with clickable cells. Each drawn cell maps to its Cell Ontology id through HRA's
 * crosswalk (step 08 `hits`): hovering names the cell type and outlines every cell of that type, clicking opens it. */
export default function FtuViewer({media,cells,onOpen,onClose}:{media:TissueMedia;cells:Map<string,TissueCell>;onOpen:(c:TissueCell)=>void;onClose:()=>void}){
 const host=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),marked=useRef(new Map<string,Element[]>()),drawing=useRef<Element|null>(null),overlay=useRef<SVGGElement|null>(null);
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[hot,setHot]=useState<string|null>(null),[tip,setTip]=useState<{x:number;y:number}|null>(null);
 const hits=useMemo(()=>(media.hits??[]).map(h=>({...h,cell:cells.get(h.cl)??null})),[media,cells]);
 const labelOf=(cl:string)=>{const h=hits.find(x=>x.cl===cl);return h?.cell?.label??upperFirst(h?.label??cl);};
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;closeButton.current?.focus();// Capture phase: Esc closes the illustration first, not the detail panel beside it.
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeRef.current();}};window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('keydown',key,true);opener?.focus?.();};},[]);
 useEffect(()=>{
  const abort=new AbortController();setStatus('loading');
  fetch(media.url,{signal:abort.signal}).then(r=>{if(!r.ok||!(r.headers.get('content-type')??'').includes('svg'))throw new Error(`Could not load ${media.url}`);return r.text();}).then(text=>{
   const el=host.current,svg=safeSvg(text);if(!el||!svg)throw new Error(`Could not read ${media.url}`);
   const root=el.shadowRoot??el.attachShadow({mode:'open'}),style=document.createElement('style'),node=document.importNode(svg,true);
   style.textContent=SHADOW_CSS;node.removeAttribute('width');node.removeAttribute('height');node.setAttribute('preserveAspectRatio','xMidYMid meet');
   const top=document.createElementNS(SVG_NS,'g');top.setAttribute('class','ftu-hot');node.appendChild(top);
   root.replaceChildren(style,node);drawing.current=node;overlay.current=top;
   const next=new Map<string,Element[]>();
   for(const h of hits){const list:Element[]=[];for(const id of h.ids){const e=root.getElementById(id);if(!e)continue;e.setAttribute('data-cell',h.cl);e.classList.toggle('off',!h.cell);list.push(e);}next.set(h.cl,list);}
   marked.current=next;setStatus('ready');
  }).catch(e=>{if((e as Error).name!=='AbortError'){console.warn((e as Error).message);setStatus('error');}});
  return()=>abort.abort();
 },[media.url,hits]);
 // Redraw the pointed-at cell type on top: each copy gets its original's position relative to the overlay.
 useEffect(()=>{const top=overlay.current;if(!top)return;top.replaceChildren();drawing.current?.classList.toggle('has-hot',!!hot);if(!hot)return;
  const base=top.getCTM()?.inverse();if(!base)return;
  for(const e of marked.current.get(hot)??[]){const ctm=(e as SVGGraphicsElement).getCTM?.();if(!ctm)continue;const copy=e.cloneNode(true) as Element,m=base.multiply(ctm);
   for(const x of [copy,...copy.querySelectorAll('[id]')])x.removeAttribute('id');copy.removeAttribute('data-cell');copy.setAttribute('transform',`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);top.appendChild(copy);}
 },[hot,status]);
 /** The cell type under the pointer: the nearest marked element on the event's path through the shadow root. */
 const cellAt=(ev:React.MouseEvent)=>{for(const t of ev.nativeEvent.composedPath()){if(t===host.current)break;if(t instanceof Element&&t.hasAttribute('data-cell'))return t.getAttribute('data-cell');}return null;};
 const clickable=hits.filter(h=>h.cell).length;
 return <div className="ftu-viewer" role="dialog" aria-label={`${media.label} illustration`}>
  <header className="ftu-viewer-head"><div><div className="eyebrow">TISSUE UNIT</div><h3>{media.label}</h3><p>{clickable?'Point at a cell to see its type; click it to open the cell in 3D.':'None of the cells drawn here are on this organ’s cell list.'}</p></div>
   <button type="button" ref={closeButton} className="ftu-viewer-close" onClick={onClose} aria-label="Close the illustration" title="Close (Esc)"><X size={18}/></button></header>
  <div className="ftu-viewer-stage" ref={stage}
   onPointerMove={ev=>{const cl=cellAt(ev),box=stage.current!.getBoundingClientRect();setHot(cl);setTip(cl?{x:ev.clientX-box.left,y:ev.clientY-box.top}:null);}}
   onPointerLeave={()=>{setHot(null);setTip(null);}}
   onClick={ev=>{const cl=cellAt(ev),c=cl?cells.get(cl):undefined;if(c)onOpen(c);}}>
   <div ref={host} className="ftu-viewer-svg" role="img" aria-label={media.alt}/>
   {status!=='ready'&&<p className="ftu-viewer-status">{status==='loading'?'Loading the illustration…':'The illustration could not be shown.'}</p>}
   {hot&&tip&&<div className="ftu-tip" style={{left:tip.x,top:tip.y}}><strong>{labelOf(hot)}</strong><span>{cells.has(hot)?'Click to open in 3D':'Not on this organ’s cell list'}</span></div>}
  </div>
  <footer className="ftu-viewer-foot">
   <div className="cell-chips">{hits.map(h=>h.cell
    ?<button type="button" key={h.cl} className={`cell-chip${hot===h.cl?' is-hot':''}`} title={`Open the ${h.cell.label.toLowerCase()} in 3D`} onPointerEnter={()=>setHot(h.cl)} onPointerLeave={()=>setHot(null)} onFocus={()=>setHot(h.cl)} onBlur={()=>setHot(null)} onClick={()=>onOpen(h.cell!)}>{h.cell.label}</button>
    :<span key={h.cl} className={`cell-chip is-off${hot===h.cl?' is-hot':''}`} title="Not on this organ’s cell list" onPointerEnter={()=>setHot(h.cl)} onPointerLeave={()=>setHot(null)}>{labelOf(h.cl)}</span>)}</div>
   <p className="ftu-viewer-credit">{media.caption} <a href={media.doi} target="_blank" rel="noreferrer">HRA 2D tissue unit</a> · {media.license}. Cells are linked to Cell Ontology through HRA’s crosswalk for this illustration.</p>
  </footer>
 </div>;
}
