import type {ContentTier} from './anatomy';
import {linkify} from './morphology';

/** "Where each sentence comes from" for a written explanation (docs/EXPLANATIONS-PLAN.md): closed until opened, then each
 * sentence with the quote(s) it rests on, the source section (linked) and its licence, then the sources' credits. */
export default function ExplanationSources({tier}:{tier:ContentTier}){
 const sentences=tier.sentences??[];
 const credits=[...new Map(sentences.flatMap(s=>s.quotes).map(q=>[q.citation,q])).values()];
 return <details className="sentence-sources">
  <summary>Where each sentence comes from<span className="connection-count">{sentences.length} sentence{sentences.length===1?'':'s'} · {credits.length} source{credits.length===1?'':'s'}</span></summary>
  <ol className="sentence-list">{sentences.map((s,i)=><li key={i}><p className="sentence-text">{s.text}</p>{s.quotes.map((q,j)=><blockquote key={j} className="morphology-quote"><p>“{q.quote}”</p><cite><a href={q.url} target="_blank" rel="noreferrer">{q.section}</a> · {q.license}</cite></blockquote>)}</li>)}</ol>
  <p className="morphology-credit">Quoted from {credits.map((q,i)=><span key={q.citation}>{i>0?'; ':''}{linkify(q.citation.replace(/\.$/,''))}{q.access?<>. {linkify(q.access)}</>:null}</span>)}. {tier.method}</p>
 </details>;
}
