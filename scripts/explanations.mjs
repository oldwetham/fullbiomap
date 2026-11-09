// Written explanations (docs/EXPLANATIONS-PLAN.md §5–6): turn the drafting and checking agents' output into content files,
// and mark texts reviewed.
//
//   node scripts/explanations.mjs assemble <journal.jsonl>... [--repairs <out.json>] [--final]
//     Reads each workflow journal (later journals replace earlier drafts of the same subject and tier). A sentence is kept
//     only if the independent checker passed it, every quote is in the cited file word for word, the file is in an allowed
//     folder, and every number it states is in a quote. A text that is too short, lost its lead sentence, reads badly, leaves
//     a term undefined or is over the Plain grade limit is not written: it goes to --repairs (one more draft and check), or
//     with --final into graph/explanation-runs.json as not published, with the reasons. A repair for the grade limit must
//     keep every term the text defined. Never writes a Human Atlas text or a reviewed one.
//   node scripts/explanations.mjs review --reviewer "<name>" [--tier 1|2|facts] <id>... | --group <group>
//     Sets status "reviewed", reviewer and reviewed_on (today) in each explanation file; --tier facts records fact cards in
//     content/facts-reviewed.json. Then run steps 11, 15 and 12.
import fs from 'node:fs';
import path from 'node:path';
import {MAP, TIER_NAMES, folderOf, frontText, readFront, root, unquotedNumbers} from '../pipeline/_explanations.mjs';
import {grade} from '../pipeline/_readability.mjs';

const SRC = path.join(root, 'data/build/sources');
const args = process.argv.slice(2), cmd = args.shift();
const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const today = new Date().toLocaleDateString('en-CA');  // local date, YYYY-MM-DD
const norm = s => s.normalize('NFC').replace(/\s+/g, ' ').trim();
const subjectsFile = JSON.parse(fs.readFileSync(path.join(root, 'graph/explanation-subjects.json'), 'utf8'));
const subjects = new Map(Object.values(subjectsFile.subjects).flat().map(s => [s.id, s]));
const SOURCE_NAMES = {'openstax-ap2e': 'OpenStax Anatomy and Physiology 2e', 'openstax-bio2e': 'OpenStax Biology 2e', seer: 'SEER Training Modules', 'cell-ontology': 'Cell Ontology',
  fma: 'Foundational Model of Anatomy', uberon: 'Uberon', ncit: 'NCI Thesaurus', go: 'Gene Ontology'};
const METHOD = 'How this was made: an AI agent drafted each sentence from a quoted sentence in an allowed source (OpenStax, the NCI SEER Training Modules or an ontology definition); a second, independent AI agent checked each sentence against its quote; a script found every quote word for word and measured the reading level. No person has reviewed it yet.';

if (cmd === 'assemble') {
  const repairsOut = flag('--repairs'), final = args.includes('--final');
  const journals = args.filter(a => !a.startsWith('--'));
  const index = new Map(JSON.parse(fs.readFileSync(path.join(SRC, 'index.json'), 'utf8')).map(e => [e.file, e]));
  const texts = new Map();
  const fileText = f => { if (!texts.has(f)) { const p = path.resolve(SRC, f); texts.set(f, p.startsWith(SRC + path.sep) && fs.existsSync(p) ? norm(fs.readFileSync(p, 'utf8')) : null); } return texts.get(f); };
  // Each journal: drafts and checks by job key ("draft <key>", "check <key>"); a later journal wins per subject and tier.
  const latest = new Map();  // `${id}|${tier}` -> {sentences, verdicts, text, round, notes}
  journals.forEach((j, round) => {
    const labels = new Map(), results = new Map();
    for (const line of fs.readFileSync(j, 'utf8').split('\n').filter(Boolean)) {
      const e = JSON.parse(line);
      if (e.type === 'started') labels.set(e.agentId, e.label);
      else if (e.type === 'result') results.set(e.agentId, e.result);
    }
    const drafts = new Map(), checks = new Map();
    for (const [aid, label] of labels) { const r = results.get(aid); if (!r) continue; const [kind, ...key] = label.split(' '); (kind === 'draft' ? drafts : checks).set(key.join(' '), r); }
    for (const [key, d] of drafts) {
      const c = checks.get(key);
      for (const s of d.subjects ?? []) for (const [tierName, tier] of [['plain', 1], ['core', 2]]) {
        if (!s[tierName]?.length) continue;
        latest.set(`${s.id}|${tier}`, {id: s.id, tier, round, notes: s.notes, sentences: s[tierName],
          verdicts: (c?.verdicts ?? []).filter(v => v.id === s.id && v.tier === tierName), text: (c?.texts ?? []).find(t => t.id === s.id && t.tier === tierName) ?? null, checked: !!c});
      }
    }
  });
  const runsFile = path.join(root, 'graph/explanation-runs.json');
  const runs = fs.existsSync(runsFile) ? JSON.parse(fs.readFileSync(runsFile, 'utf8')) : {unpublished: {}};
  const repairs = [], written = [], summary = {written: 0, repair: 0, unpublished: 0, sentences: 0, kept: 0};
  for (const [key, d] of [...latest].sort()) {
    const s = subjects.get(d.id);
    if (!s || !s.tiers.includes(d.tier)) { console.warn(`skipped ${key}: not a subject or tier`); continue; }
    const target = `content/${folderOf(s.id)}/tier${d.tier}.md`, abs = path.join(root, target);
    if (MAP.humanAtlas[target]) throw new Error(`${target} is a Human Atlas text; it is never written`);
    if (fs.existsSync(abs) && readFront(abs).meta.status !== 'drafted') { console.warn(`kept ${target}: already ${readFront(abs).meta.status}`); continue; }
    // Sentence by sentence: the checker's verdict, then the code checks.
    const kept = [], dropped = [];
    // Paths relative to data/build/sources (an agent may give the full path).
    for (const x of d.sentences) for (const q of x.quotes ?? []) q.file = String(q.file ?? '').replace(/^.*data\/build\/sources\//, '').replace(/^\.\//, '');
    d.sentences.forEach((x, i) => {
      const v = d.verdicts.find(y => y.index === i);
      const why = !d.checked ? 'not checked' : !v ? 'no verdict from the checker' : v.verdict !== 'pass' ? `checker: ${v.reason}`
        : !Array.isArray(x.quotes) || !x.quotes.length || x.quotes.length > 2 ? 'needs one or two quotes'
        : x.quotes.find(q => !MAP.sourceFolders.includes((q.file ?? '').split('/')[0])) ? `not an allowed source: ${x.quotes.find(q => !MAP.sourceFolders.includes((q.file ?? '').split('/')[0])).file}`
        : x.quotes.find(q => !index.has(q.file) || !fileText(q.file)?.includes(norm(q.quote))) ? `quote not found word for word in ${x.quotes.find(q => !index.has(q.file) || !fileText(q.file)?.includes(norm(q.quote))).file}`
        : unquotedNumbers(x).length ? `states ${unquotedNumbers(x).join(', ')}, which no quote has`
        : /wikipedia/i.test(JSON.stringify(x)) ? 'mentions Wikipedia' : null;
      summary.sentences++;
      if (why) dropped.push({text: x.text, reason: why}); else { kept.push(x); summary.kept++; }
    });
    const [lo, hi] = d.tier === 1 ? MAP.plainSentences : MAP.coreSentences, g = grade(kept.map(x => x.text));
    const issues = [];
    if (kept.length < lo) issues.push(`${kept.length} sentences kept; ${TIER_NAMES[d.tier]} needs at least ${lo}`);
    if (kept.length > hi) issues.push(`${kept.length} sentences; ${TIER_NAMES[d.tier]} allows at most ${hi}`);
    if (d.sentences.length && kept[0] !== d.sentences[0]) issues.push('the lead sentence was dropped');
    else if (d.text && !d.text.leadSaysFunction) issues.push('the first sentence does not say what it does');
    if (d.text && !d.text.readsWell) issues.push(`does not read well: ${d.text.note}`);
    if (d.text?.undefinedTerms?.length) issues.push(`terms left undefined: ${d.text.undefinedTerms.join(', ')}`);
    if (d.tier === 1 && g > MAP.gradeLimit) issues.push(`grade ${g} is over ${MAP.gradeLimit}`);
    // A repair for the grade limit keeps every term the first draft defined (never drop a needed term to hit the number).
    const prior = runs.defined?.[key] ?? [];
    const lost = prior.filter(t => !kept.some(x => x.text.toLowerCase().includes(t.toLowerCase())));
    if (lost.length) issues.push(`dropped defined terms: ${lost.join(', ')}`);
    if (issues.length) {
      if (!final && d.round === 0) {
        repairs.push({id: s.id, label: s.label, tier: d.tier, issues, kept, dropped, keepTerms: kept.filter(x => x.defines).map(x => x.defines)});
        if (issues.some(i => i.startsWith('grade'))) (runs.defined ??= {})[key] = kept.filter(x => x.defines).map(x => x.defines);
        summary.repair++;
      } else { runs.unpublished[key] = {id: s.id, label: s.label, tier: d.tier, issues, dropped, kept: kept.map(x => x.text)}; summary.unpublished++; }
      continue;
    }
    delete runs.unpublished[key];
    const sentences = kept.map(x => ({text: x.text.trim(), ...(x.defines ? {defines: x.defines} : {}), quotes: x.quotes.map(q => { const e = index.get(q.file);
      return {quote: q.quote.trim(), file: q.file, section: e.section, url: e.url, license: e.license, citation: e.citation, ...(e.access ? {access: e.access} : {})}; })}));
    const quotes = sentences.flatMap(x => x.quotes), cites = [...new Map(quotes.map(q => [q.citation, q])).values()];
    const meta = {id: s.id, label: s.label, tier: d.tier, kind: 'explanation', status: 'drafted', applies_to: s.appliesTo, grade: g, sentences, dropped,
      source: {kind: 'explanation', name: 'Bio Map, written from quoted sources', term: null, url: null, license: 'CC BY 4.0'},
      sources: [...new Map(quotes.map(q => [q.url, {title: `${SOURCE_NAMES[q.file.split('/')[0]]}, ${q.section}`, url: q.url, license: q.license}])).values()],
      license: 'CC BY 4.0', attribution: `Text by Bio Map (CC BY 4.0), written from quoted sentences in: ${cites.map(q => q.citation.replace(/\.$/, '') + (q.access ? ` (${q.access})` : '')).join('; ')}. Quotes keep their sources' licences.`,
      method: METHOD, drafted_on: today, reviewer: null, reviewed_on: null};
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, frontText(meta, sentences.map(x => x.text).join(' ')));
    written.push(target); summary.written++;
  }
  fs.writeFileSync(runsFile, JSON.stringify(runs, null, 1) + '\n');
  if (repairsOut) fs.writeFileSync(repairsOut, JSON.stringify(repairs, null, 1) + '\n');
  console.log(JSON.stringify({...summary, files: written.length}));
} else if (cmd === 'review') {
  const reviewer = flag('--reviewer'), tier = flag('--tier'), group = flag('--group');
  if (!reviewer) throw new Error('--reviewer "<name>" is required');
  const ids = group ? (subjectsFile.subjects[group] ?? []).map(s => s.id) : args;
  if (!ids.length) throw new Error('name the ids or a --group to mark reviewed');
  if (tier === 'facts') {
    const f = path.join(root, 'content/facts-reviewed.json'), data = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {reviewed: {}};
    for (const id of ids) data.reviewed[id] = {reviewer, reviewed_on: today};
    fs.writeFileSync(f, JSON.stringify(data, null, 1) + '\n');
    console.log(`fact cards marked reviewed: ${ids.length}`);
  } else {
    let n = 0;
    for (const id of ids) for (const t of tier ? [Number(tier)] : [1, 2]) {
      const f = path.join(root, 'content', folderOf(id), `tier${t}.md`);
      if (!fs.existsSync(f)) continue;
      const {meta, body} = readFront(f);
      if (meta.kind !== 'explanation') continue;
      fs.writeFileSync(f, frontText({...meta, status: 'reviewed', reviewer, reviewed_on: today}, body));
      n++;
    }
    console.log(`explanations marked reviewed: ${n}`);
  }
} else {
  console.error('usage: node scripts/explanations.mjs assemble <journal.jsonl>... [--repairs out.json] [--final] | review --reviewer "<name>" [--tier 1|2|facts] <id>... | --group <group>');
  process.exit(2);
}
