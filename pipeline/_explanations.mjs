// Written explanations (docs/EXPLANATIONS-PLAN.md): the file format and rules shared by steps 11, 12 and 15 and the
// assembly script (scripts/explanations.mjs).
//
// content/<ID>/tier1.md (Plain) and tier2.md (Core), kind "explanation". Front matter, one `key: <JSON>` per line:
//   id, label, tier, kind, status ("drafted" until a person reviews it), applies_to (structures that share the text),
//   grade (Flesch–Kincaid, pipeline/_readability.mjs), sentences [{text, defines?, quotes: [{quote, file, section, url,
//   license, citation, access?}]}], dropped [{text, reason}], source, sources, license, attribution, method, drafted_on,
//   reviewer, reviewed_on. The body is the sentences joined by spaces. `file` is the quoted file under
//   data/build/sources/ (step 09 checks each quote there word for word); the app gets everything but `file`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAP = JSON.parse(fs.readFileSync(path.join(root, 'pipeline/maps/explanations.json'), 'utf8'));
export const folderOf = id => id.replace(':', '_');
export const TIER_NAMES = {1: 'Plain', 2: 'Core'};

/** Front matter (`key: <JSON value>` per line between --- fences) and body. */
export function readFront(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(': ');
    if (i < 0) throw new Error(`${file}: bad front matter line ${JSON.stringify(line)}`);
    meta[line.slice(0, i)] = JSON.parse(line.slice(i + 2));
  }
  return {meta, body: m[2].trim()};
}

export const frontText = (meta, body) => '---\n' + Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}\n`).join('') + '---\n' + body.trim() + '\n';

/** Every written explanation file, Plain and Core. */
export function explanationFiles() {
  const out = [], dir = path.join(root, 'content');
  for (const d of fs.readdirSync(dir).sort()) for (const tier of [1, 2]) {
    const file = path.join(dir, d, `tier${tier}.md`);
    if (!fs.existsSync(file)) continue;
    const {meta, body} = readFront(file);
    if (meta.kind === 'explanation') out.push({file: `content/${d}/tier${tier}.md`, dir: d, id: meta.id, tier, meta, body});
  }
  return out;
}

/** What the app gets for one sentence: its text, the term it defines, and each quote with where it is (not the local file). */
export const servedSentence = s => ({text: s.text, ...(s.defines ? {defines: s.defines} : {}),
  quotes: s.quotes.map(q => ({quote: q.quote, section: q.section, url: q.url, license: q.license, citation: q.citation, ...(q.access ? {access: q.access} : {})}))});

/** Numbers a sentence states that none of its quotes contains (the drafting rule: no numbers unless the quote has them). */
export const unquotedNumbers = s => (s.text.match(/\d+(?:[.,]\d+)?/g) ?? []).filter(n => !s.quotes.some(q => q.quote.includes(n)));
