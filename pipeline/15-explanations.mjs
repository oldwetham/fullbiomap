// Step 15: which structures, cell types and organelles get written explanations, with the source files a drafting agent
// should read first, and reports/explanations.md, the review report of every explanation written so far
// (docs/EXPLANATIONS-PLAN.md §3 and §6).
// Usage: node pipeline/15-explanations.mjs        (after steps 09 and 11; reads data/build/sources)
//
// Organs: pipeline/maps/explanations.json. Bones, muscles, vessels, nerves and brain regions: a structure in the body whose
// name, name without left/right, or numbered class ("left fourth rib" -> rib) is a key term of the pinned OpenStax A&P 2e,
// minus the map's generic terms. Left, right and numbered structures share their class's text (applies_to). Cell types:
// the 70 with morphology profiles. Organelles: every organelle a cell model draws.
// Outputs: graph/explanation-subjects.json, reports/explanations.md
import fs from 'node:fs';
import path from 'node:path';
import {MAP, explanationFiles, folderOf, readFront, root, TIER_NAMES} from './_explanations.mjs';
import {grade} from './_readability.mjs';

const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const jsonl = p => read(p).split('\n').filter(Boolean).map(l => JSON.parse(l));
const SRC = path.join(root, 'data/build/sources');
if (!fs.existsSync(path.join(SRC, 'index.json'))) throw new Error('data/build/sources is missing: run step 09 first');
const upperFirst = s => s.charAt(0).toUpperCase() + s.slice(1);

const nodes = jsonl('graph/nodes.jsonl'), byId = new Map(nodes.map(n => [n.id, n]));
const atlas = new Set(JSON.parse(read('public/models/atlas.json')).concepts.map(c => c.id));
const defs = new Map(jsonl('graph/defs.jsonl').map(d => [d.id, d]));
const fmaLabel = new Map();
for (const d of defs.values()) { const f = d.fma ?? {}; if (f.label) fmaLabel.set(d.id, f.label); for (const p of [...(f.isA ?? []), ...(f.partOf ?? [])]) if (p.label && !fmaLabel.has(p.id)) fmaLabel.set(p.id, p.label); }
for (const e of jsonl('graph/edges.fma.jsonl')) for (const [k, v] of Object.entries(e.labels ?? {})) if (v && !fmaLabel.has(k)) fmaLabel.set(k, v);
const index = JSON.parse(fs.readFileSync(path.join(SRC, 'index.json'), 'utf8')), indexed = new Set(index.map(e => e.file));

// The A&P key terms (step 09: one file per chapter, "term: meaning" per line).
const keyTerms = new Map();
for (const e of index.filter(e => e.source === 'openstax-ap2e' && e.keyTerms)) {
  const lines = fs.readFileSync(path.join(SRC, e.file), 'utf8').split('\n\n').slice(1).join('\n\n').split('\n');
  for (const line of lines) { const i = line.indexOf(': '); if (i > 0) { const t = line.slice(0, i).trim().toLowerCase(); if (!keyTerms.has(t)) keyTerms.set(t, e.file); } }
}
const termSection = JSON.parse(fs.readFileSync(path.join(SRC, 'key-terms.json'), 'utf8'))['openstax-ap2e'];
const ORD = /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) /;
const variants = s => [s, s.endsWith('s') ? s.slice(0, -1) : `${s}s`, s.endsWith('ae') ? s.slice(0, -1) : null, s.endsWith('us') ? `${s.slice(0, -2)}i` : null, s.endsWith('a') ? `${s}e` : null].filter(Boolean);
const keyTermOf = label => { const l = label.toLowerCase(), side = l.replace(/\b(left|right)\b ?/g, '').trim();
  for (const b of [l, side, side.replace(ORD, '')]) for (const v of variants(b)) if (keyTerms.has(v)) return v; return null; };
const exclude = new Set(MAP.exclude);

// Organs (by hand), and the words that name them (so the rule groups do not repeat them).
const organWords = new Set(MAP.organs.flatMap(o => [o.label.toLowerCase(), ...o.hints.map(h => h.toLowerCase())]));
const isAlias = n => !!n?.equivalent;
const sides = label => nodes.filter(n => !isAlias(n) && new RegExp(`^(left|right) ${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(n.label)).map(n => n.id);
const subjects = {organs: [], cellTypes: [], organelles: [], bones: [], muscles: [], vessels: [], nerves: [], brainRegions: []};
for (const o of MAP.organs) {
  const appliesTo = [...new Set([...(o.appliesTo ?? []), ...sides(o.label)])].filter(id => id !== o.id);
  subjects.organs.push({id: o.id, label: o.label, group: 'organs', tiers: o.tiers, appliesTo, words: [o.label.toLowerCase(), ...o.hints]});
}

// Bones, muscles, vessels, nerves and brain regions, by the key-term rule.
const GROUP = {skeletal: 'bones', muscular: 'muscles', arterial: 'vessels', venous: 'vessels', nervous: 'brainRegions'};
const classes = new Map(), skipped = new Map();
for (const n of nodes) {
  if (!atlas.has(n.conceptId) || !GROUP[n.system]) continue;
  const term = keyTermOf(n.label);
  if (!term) continue;
  if (exclude.has(term) || organWords.has(term) || variants(term).some(v => organWords.has(v))) { skipped.set(term, (skipped.get(term) ?? 0) + 1); continue; }
  const group = n.system === 'nervous' && /\b(nerve|ganglion)\b/.test(term) ? 'nerves' : GROUP[n.system];
  const key = `${group}|${term}`;
  if (!classes.has(key)) classes.set(key, {group, term, members: []});
  classes.get(key).members.push(n);
}
const byLabel = new Map();
for (const n of nodes) if (!isAlias(n) && !byLabel.has(n.label.toLowerCase())) byLabel.set(n.label.toLowerCase(), n);
const noId = [];
for (const c of [...classes.values()].sort((a, b) => a.term.localeCompare(b.term))) {
  // The class: a node with the class's name, else an FMA ancestor of its members with that name (never an invented id).
  const names = variants(c.term), node = names.map(v => byLabel.get(v)).find(Boolean);
  let id = node?.id, label = node?.label;
  if (!id) for (const m of c.members) for (const a of defs.get(m.id)?.fma?.ancestors ?? []) if (names.includes((fmaLabel.get(a) ?? '').toLowerCase())) { id = a; label = upperFirst(fmaLabel.get(a)); }
  if (!id) { noId.push(c.term); continue; }
  const appliesTo = c.members.map(m => m.id).filter(x => x !== id);
  subjects[c.group].push({id, label, group: c.group, tiers: [1], appliesTo, keyTerm: c.term, words: [...new Set([label.toLowerCase(), c.term])]});
}

// Cell types with morphology profiles, and organelles.
for (const d of fs.readdirSync(path.join(root, 'content')).filter(d => d.startsWith('CL_') && fs.existsSync(path.join(root, 'content', d, 'morphology.md'))).sort()) {
  const {meta} = readFront(path.join(root, 'content', d, 'morphology.md'));
  const n = byId.get(meta.id);
  subjects.cellTypes.push({id: meta.id, label: n?.label ?? meta.label, group: 'cellTypes', tiers: [1, 2], appliesTo: [], words: [...new Set([(n?.label ?? meta.label).toLowerCase(), ...(n?.synonyms ?? []).map(s => s.toLowerCase())])].slice(0, 4),
    profileFiles: [...new Set(meta.claims.map(c => c.source.file))]});
}
for (const o of JSON.parse(read('public/content/cells.json')).organelles) {
  const id = o.id.replace(/^GO/, 'GO:'), n = byId.get(id);
  subjects.organelles.push({id, label: o.label, group: 'organelles', tiers: [1], appliesTo: [], words: [...new Set([o.label.toLowerCase(), ...o.names.map(x => x.toLowerCase())])].slice(0, 4)});
}

// The files a drafting agent should read first: the sections and SEER pages that name the subject most, the chapter's key
// terms, and the subject's own ontology definitions.
const texts = index.filter(e => ['openstax-ap2e', 'openstax-bio2e', 'seer'].includes(e.source) && !e.keyTerms).map(e => ({...e, text: fs.readFileSync(path.join(SRC, e.file), 'utf8').toLowerCase()}));
const count = (text, w) => { let k = 0, i = 0; const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'); while (re.exec(text)) k++; return k; };
const defFiles = id => { const n = byId.get(id), out = [];
  const add = f => { if (indexed.has(f)) out.push(f); };
  if (id.startsWith('FMA:')) add(`fma/${folderOf(id)}.txt`);
  if (id.startsWith('UBERON:')) add(`uberon/${folderOf(id)}.txt`);
  if (id.startsWith('CL:')) add(`cell-ontology/${folderOf(id)}.txt`);
  if (id.startsWith('GO:')) add(`go/${folderOf(id)}.txt`);
  if (n?.xrefs?.UBERON) add(`uberon/UBERON_${n.xrefs.UBERON}.txt`);
  if (n?.xrefs?.NCIT) add(`ncit/NCIT_${n.xrefs.NCIT}.txt`);
  return out; };
for (const s of Object.values(subjects).flat()) {
  const words = [...new Set(s.words.flatMap(w => variants(w.toLowerCase())))];
  const scored = texts.map(t => ({file: t.file, source: t.source, n: words.reduce((k, w) => k + count(t.text, w), 0)})).filter(x => x.n > 0).sort((a, b) => b.n - a.n || a.file.localeCompare(b.file));
  const top = (source, k) => scored.filter(x => x.source === source).slice(0, k).map(x => x.file);
  const ap = top('openstax-ap2e', s.group === 'organelles' || s.group === 'cellTypes' ? 2 : 3), bio = top('openstax-bio2e', s.group === 'organelles' || s.group === 'cellTypes' ? 2 : 1);
  const kt = s.keyTerm ? keyTerms.get(s.keyTerm) : words.map(w => keyTerms.get(w)).find(Boolean);
  // Home: the section whose glossary defines the key term, else the section that names the subject most.
  const defining = s.keyTerm ? termSection[s.keyTerm] : words.map(w => termSection[w]).find(Boolean);
  s.home = defining ?? ap[0] ?? bio[0] ?? null;
  if (defining && !ap.includes(defining)) ap.unshift(defining);
  s.files = [...new Set([...(s.profileFiles ?? []), ...ap, ...bio, ...top('seer', 2), ...(kt ? [kt] : []), ...defFiles(s.id), ...s.appliesTo.slice(0, 2).flatMap(defFiles)])];
  delete s.profileFiles;
}

// Batches for the groups drafted several at a time: subjects that share a home section, then the rest of their chapter, up to
// 5 (organelles 4); a group no bigger than one batch is one batch.
const batches = {};
for (const g of ['bones', 'muscles', 'vessels', 'nerves', 'brainRegions', 'organelles']) {
  const size = g === 'organelles' ? 4 : 5, list = [...subjects[g]].sort((a, b) => (a.home ?? '~').localeCompare(b.home ?? '~') || a.label.localeCompare(b.label));
  const chapter = s => (s.home ?? '').split('/').pop().slice(0, 2), out = [];
  for (const s of list) { const last = out.at(-1); if (last && last.length < size && (chapter(last[0]) === chapter(s) || list.length <= size)) last.push(s); else out.push([s]); }
  batches[g] = out.map(b => b.map(s => s.id));
}
const all = Object.values(subjects).flat();
fs.writeFileSync(path.join(root, 'graph/explanation-subjects.json'), JSON.stringify({subjects, batches, excludedTerms: [...skipped.keys()].sort(), noId: noId.sort()}, null, 1) + '\n');

// reports/explanations.md: the subjects, then every text written so far, grouped by system, with its quotes.
const written = explanationFiles(), writtenAt = new Map(written.map(w => [`${w.id}|${w.tier}`, w]));
const GROUP_NAMES = {organs: 'Organs', cellTypes: 'Cell types', organelles: 'Organelles', bones: 'Bones and cartilages', muscles: 'Muscles', vessels: 'Vessels', nerves: 'Nerves', brainRegions: 'Brain regions'};
const labelOf = id => byId.get(id)?.label ?? id;
const state = s => s.tiers.map(t => { const w = writtenAt.get(`${s.id}|${t}`); return `${TIER_NAMES[t]}: ${w ? `${w.meta.status}${t === 1 ? `, grade ${w.meta.grade}` : ''}` : 'not written'}`; }).join('; ');
const lines = ['# Explanations', '', 'Generated by `pipeline/15-explanations.mjs` from `graph/explanation-subjects.json` and the explanation files in `content/` (docs/EXPLANATIONS-PLAN.md). Every sentence quotes an allowed source; an independent AI agent checked each one and step 09 found each quote word for word. Nothing here has been reviewed by a person yet unless it says "reviewed".', '',
  `Limits: Plain ${MAP.plainSentences.join('–')} sentences at Flesch–Kincaid grade ${MAP.gradeLimit} or below; Core ${MAP.coreSentences.join('–')} sentences. The nine Human Atlas texts keep their Plain text unchanged.`, '',
  '## Subjects', '', '| Group | Subjects | Plain written | Core written | Structures covered |', '| --- | --- | --- | --- | --- |',
  ...Object.entries(subjects).map(([g, list]) => `| ${GROUP_NAMES[g]} | ${list.length} | ${list.filter(s => s.tiers.includes(1) && writtenAt.has(`${s.id}|1`)).length} of ${list.filter(s => s.tiers.includes(1)).length} | ${list.filter(s => s.tiers.includes(2) && writtenAt.has(`${s.id}|2`)).length} of ${list.filter(s => s.tiers.includes(2)).length} | ${list.reduce((k, s) => k + 1 + s.appliesTo.length, 0)} |`),
  `| All | ${all.length} | | | ${all.reduce((k, s) => k + 1 + s.appliesTo.length, 0)} |`, '',
  `Key-term matches left out as generic or as organs listed above: ${[...skipped.keys()].sort().join(', ')}.` + (noId.length ? ` Classes with no public id (not written): ${noId.join(', ')}.` : ''), ''];
for (const [g, list] of Object.entries(subjects)) {
  lines.push(`### ${GROUP_NAMES[g]} (${list.length})`, '');
  for (const s of [...list].sort((a, b) => a.label.localeCompare(b.label))) lines.push(`- ${s.label} (${s.id}${s.appliesTo.length ? `; also ${s.appliesTo.map(labelOf).join(', ')}` : ''}): ${state(s)}`);
  lines.push('');
}
const systemOf = id => { const n = byId.get(id); if (n?.scale === 'cell') return 'Cell types'; if (n?.scale === 'organelle') return 'Organelles'; return n?.ladder?.system ?? n?.system ?? null; };
const textSystem = w => systemOf(w.id) ?? (w.meta.applies_to ?? []).map(systemOf).find(Boolean) ?? 'Other';
lines.push('## Texts', '');
const bySystem = new Map();
for (const w of written) { const k = textSystem(w); bySystem.set(k, [...(bySystem.get(k) ?? []), w]); }
for (const [sys, list] of [...bySystem].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`### ${upperFirst(sys)}`, '');
  for (const w of list.sort((a, b) => a.meta.label.localeCompare(b.meta.label) || a.tier - b.tier)) {
    const m = w.meta;
    lines.push(`#### ${m.label}: ${TIER_NAMES[w.tier]} (${m.status}; grade ${m.grade}; \`${w.file}\`${m.applies_to?.length ? `; also ${m.applies_to.map(labelOf).join(', ')}` : ''})`, '');
    m.sentences.forEach((s, i) => { lines.push(`${i + 1}. ${s.text}${s.defines ? ` *(defines “${s.defines}”)*` : ''}`);
      for (const q of s.quotes) lines.push(`   > “${q.quote}” ([${q.section}](${q.url}), ${q.license})`); });
    if (m.dropped?.length) { lines.push('', 'Dropped:'); for (const d of m.dropped) lines.push(`- “${d.text}” (${d.reason})`); }
    lines.push('');
  }
}
fs.writeFileSync(path.join(root, 'reports/explanations.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({subjects: Object.fromEntries(Object.entries(subjects).map(([g, l]) => [g, l.length])), batches: Object.fromEntries(Object.entries(batches).map(([g, b]) => [g, b.length])),
  structures: all.reduce((k, s) => k + 1 + s.appliesTo.length, 0), written: written.length, noId}));
