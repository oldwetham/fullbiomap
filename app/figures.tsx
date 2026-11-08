import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ChevronLeft,ChevronRight,X} from 'lucide-react';
import type {Figure,TissueCell} from './anatomy';
import FtuExplorer from './ftu-viewer';

/** Figures (step 10, docs/FIGURES-PLAN.md): a strip of up to three thumbnails, and a full-size viewer with each
 * figure's source, licence, credit line and a link to the original. */
const KIND:Record<Figure['kind'],string>={micrograph:'Micrograph',diagram:'Diagram',illustration:'Illustration'};
const unreviewed=(f:Figure)=>f.status!=='reviewed';

export function FigureStrip({figures,onOpen,label='Figures',compact=false}:{figures:Figure[];onOpen:(index:number)=>void;label?:string;compact?:boolean}){
 if(!figures.length)return null;
 return <section className={`figure-strip${compact?' compact':''}`} aria-label={label}>
  <h3>{label}</h3>
  <ul>{figures.map((f,i)=><li key={f.id}><button type="button" className={`figure-thumb ${f.kind}${f.ftu?' ftu':''}`} onClick={()=>onOpen(i)} aria-label={`Open ${KIND[f.kind].toLowerCase()}: ${f.title}`} title={f.title}>
   <img src={f.thumb} alt="" loading="lazy" width={f.thumbWidth} height={f.thumbHeight}/>
   <span className="figure-kind">{KIND[f.kind]}</span>
   {unreviewed(f)&&<span className="figure-unreviewed" title="Matched automatically; not yet checked by a reviewer">Unreviewed</span>}
  </button></li>)}</ul>
 </section>;
}

/** The full-size viewer: Esc or the close button dismisses it, focus stays inside it, arrow keys step through the strip.
 * A tissue unit illustration opens as its SVG with clickable cells (cells and onOpenCell come from the tissue board). */
export function FigureViewer({figures,index,onIndex,onClose,cells,onOpenCell}:{figures:Figure[];index:number;onIndex:(i:number)=>void;onClose:()=>void;cells?:Map<string,TissueCell>;onOpenCell?:(c:TissueCell)=>void}){
 const dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const live=useRef({onClose,onIndex,index,count:figures.length});live.current={onClose,onIndex,index,count:figures.length};
 useEffect(()=>{
  const opener=document.activeElement as HTMLElement|null;closeButton.current?.focus();
  // Capture phase: the viewer handles these keys before the detail panel or the 3D view underneath does.
  const key=(e:KeyboardEvent)=>{const v=live.current;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();v.onClose();return;}
   if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&v.count>1){e.preventDefault();e.stopPropagation();v.onIndex((v.index+(e.key==='ArrowRight'?1:v.count-1))%v.count);return;}
   if(e.key==='Tab'){const box=dialog.current;if(!box)return;
    const items=[...box.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.getClientRects().length>0);
    if(!items.length)return;const first=items[0],last=items[items.length-1],at=document.activeElement;
    if(!box.contains(at)){e.preventDefault();first.focus();}else if(e.shiftKey&&at===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&at===last){e.preventDefault();first.focus();}}
   if(e.key==='+'||e.key==='='||e.key==='-'||e.key==='_')e.stopPropagation();  // the page's zoom keys stay off while the viewer is open
  };
  window.addEventListener('keydown',key,true);
  return()=>{window.removeEventListener('keydown',key,true);opener?.focus?.();};
 },[]);
 const f=figures[Math.min(index,figures.length-1)];
 if(!f)return null;
 const note=f.lookAlike&&f.caption.endsWith(f.lookAlike)?f.lookAlike:'',caption=note?f.caption.slice(0,-note.length).trim():f.caption;
 const step=(d:number)=>onIndex((index+d+figures.length)%figures.length);
 // On document.body, above the detail panel (itself a portal).
 return createPortal(<div className="figure-viewer" role="dialog" aria-modal="true" aria-labelledby="figure-viewer-title" ref={dialog}>
  <div className="figure-viewer-backdrop" onClick={onClose}/>
  <div className="figure-viewer-panel">
   <header className="figure-viewer-head">
    <div><div className="eyebrow">{KIND[f.kind].toUpperCase()}{figures.length>1?` · ${index+1} OF ${figures.length}`:''}</div><h3 id="figure-viewer-title">{f.title}</h3></div>
    <button type="button" ref={closeButton} className="figure-viewer-close" onClick={onClose} aria-label="Close the figure" title="Close (Esc)"><X size={18}/></button>
   </header>
   <div className={`figure-viewer-stage ${f.kind}${f.ftu?' ftu':''}`}>
    {f.ftu?<FtuExplorer key={f.id} url={f.url} alt={f.alt} hits={f.ftu.hits} cells={cells} focus={f.focus} onOpen={onOpenCell}/>
     :<img key={f.id} src={f.url} alt={f.alt} width={f.width} height={f.height}/>}
    {figures.length>1&&<><button type="button" className="figure-nav prev" onClick={()=>step(-1)} aria-label="Previous figure" title="Previous (←)"><ChevronLeft size={20}/></button>
     <button type="button" className="figure-nav next" onClick={()=>step(1)} aria-label="Next figure" title="Next (→)"><ChevronRight size={20}/></button></>}
   </div>
   <footer className="figure-viewer-foot">
    <p className="figure-caption">{caption}</p>
    {note&&<p className="figure-lookalike"><strong>Look-alikes.</strong> {note}</p>}
    <p className="figure-source"><strong>{f.sourceName}</strong> · <a href={f.licenseUrl} target="_blank" rel="noreferrer">{f.license}</a>{unreviewed(f)&&<span className="badge-unreviewed" title="Matched automatically; not yet checked by a reviewer">Unreviewed</span>}</p>
    <p className="figure-credit">{f.credit}</p>
    <p className="figure-match">How it was matched: {f.match}.</p>
    <a className="figure-original" href={f.pageUrl} target="_blank" rel="noreferrer">View the original <ArrowUpRight size={13}/></a>
   </footer>
  </div>
 </div>,document.body);
}
