// Cell shape families (pipeline/maps/cell-families.json): the simplified 3D cell each cell type is drawn as.
// Shared by step 13 (builds the models that are needed) and step 11 (points each cell type at its model), so the
// two cannot disagree. Ancestors come from step 06 (graph/defs.cells.jsonl, every CL class above a cell type).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CELL_FAMILIES = JSON.parse(fs.readFileSync(path.join(root, 'pipeline/maps/cell-families.json'), 'utf8'));
// Neuron and glia reconstructions picked by step 14 (graph/neuromorpho.json) take precedence over the family shapes.
const reconstructionsFile = path.join(root, 'graph/neuromorpho.json');
export const RECONSTRUCTIONS = fs.existsSync(reconstructionsFile) ? JSON.parse(fs.readFileSync(reconstructionsFile, 'utf8')) : {groups: {}, cells: {}};
/** Real size in words: 600 µm, 1.6 mm, 30 cm. */
export const sizeWords = um => um >= 10000 ? `${(um / 10000).toFixed(1).replace(/\.0$/, '')} cm` : um >= 1000 ? `${(um / 1000).toFixed(1).replace(/\.0$/, '')} mm` : `${Math.round(um / 10) * 10} µm`;
const reconstructionExtent = g => Math.max(...['width', 'height', 'depth'].map(k => g.size?.[k] ?? 0));
/** The caption under a reconstruction: its own type, or a representative of the class (never this subtype). */
export function reconstructionCaption(g, level) {
  const what = level === 'type' ? `Reconstructed ${g.species} ${g.class}` : `A representative ${g.species} ${g.class}, not this subtype specifically`;
  return [what, `NeuroMorpho.Org ${g.nmoId}`, `about ${sizeWords(reconstructionExtent(g))} across`, g.drawnSoma ? 'cell body drawn, not traced' : null, 'nucleus illustrative'].filter(Boolean).join(' · ');
}
const APICAL_LABEL = {cilia: 'cilia', microvilli: 'microvilli'};

// Morphology profiles (content/CL_<n>/morphology.md): claims drafted from cited sources, each checked by an independent
// agent before it was kept; unreviewed until a reviewer marks the file reviewed. They take precedence over family shapes.
const frontMatter = text => { const m = text.match(/^---\n([\s\S]*?)\n---/); const o = {}; for (const line of m ? m[1].split('\n') : []) { const i = line.indexOf(':'); if (i > 0) o[line.slice(0, i).trim()] = JSON.parse(line.slice(i + 1).trim()); } return o; };
export const PROFILES = (() => {
  const dir = path.join(root, 'content'), out = {};
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const f = path.join(dir, d, 'morphology.md');
    if (fs.existsSync(f)) { const fm = frontMatter(fs.readFileSync(f, 'utf8')); if (fm.id && fm.claims?.length) out[fm.id] = {...fm, file: path.relative(root, f)}; }
  }
  return out;
})();
const nums = v => (v.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
/** Model parameters from a profile's claims; anything a profile does not state is left null (the family shape decides). */
export function profileParams(claims) {
  const all = f => claims.filter(c => c.field === f).map(c => c.value.trim()), one = f => all(f)[0] ?? null;
  // Sizes: the first number (or range) and its unit; "up to" kept; the dimension (diameter, width, length) after it.
  const UNIT = {'µm': 1, 'μm': 1, mm: 1000, cm: 10000, nm: 0.001};
  const sizes = all('size').map(v => { const m = v.match(/(about |up to |at least )?(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*(µm|μm|mm|cm|nm)\b\s*(diameter|width|length|long|wide|across|thick\w*|height|tall)?/i);
    if (!m) return null; const k = UNIT[m[4].toLowerCase()] ?? 1; return {min: Number(m[2]) * k, max: Number(m[3] ?? m[2]) * k, upTo: /up to/i.test(m[1] ?? ''), dim: /length|long|height|tall/i.test(m[5] ?? '') ? 'long' : /thick/i.test(m[5] ?? '') ? 'thick' : 'across'}; }).filter(Boolean);
  const across = sizes.filter(x => x.dim === 'across');
  // A count that holds only at some stage ("0 (once dead: …)") describes the cell's fate, not the cell drawn.
  const nc = all('nucleus_count').find(v => !/\b(once|when|after|until|as the cell|in mature|in some|if)\b/i.test(v)) ?? null;
  const many = nc && /many/i.test(nc) ? (nums(nc).length ? Math.round((Math.min(...nums(nc)) + Math.max(...nums(nc))) / 2) : 8) : null;
  const lobeNums = nums(one('nucleus_shape') ?? ''), lobes = /multilobed/i.test(one('nucleus_shape') ?? '') ? (lobeNums.length ? Math.round((Math.min(...lobeNums) + Math.max(...lobeNums)) / 2) : 4) : null;
  const organelles = {};
  for (const v of all('organelle')) { const m = v.match(/^(.*?):\s*(\d)/); if (m) organelles[m[1].trim().toLowerCase()] = Number(m[2]); }
  const granules = all('granules').map(v => { const [kind, ...rest] = v.split(';').map(x => x.trim()); const g = {kind}; for (const r of rest) { const i = r.indexOf(':'); if (i > 0) g[r.slice(0, i).trim()] = r.slice(i + 1).trim(); } return g; });
  return {shape: (one('shape') ?? '').toLowerCase() || null, sizes, sizeUm: (across.length ? across : sizes).reduce((m, x) => Math.max(m, x.max), 0) || null,
    nucleusCount: nc == null ? null : /^0/.test(nc) ? 0 : /^1/.test(nc) ? 1 : /^2/.test(nc) ? 2 : many,
    nucleusShape: (one('nucleus_shape') ?? '').toLowerCase() || null, lobes, nucleusPosition: (one('nucleus_position') ?? '').toLowerCase() || null,
    nucleusSize: (one('nucleus_size') ?? '').toLowerCase() || null, surface: all('surface').map(v => v.toLowerCase()), granules, organelles,
    special: all('special').map(v => v.toLowerCase())};
}
/** "7–8 µm across", "up to 100 µm across, up to 30 cm long": every distinct size its profile states. */
export function sizePhrase(sizes) {
  const um = x => x >= 1000 ? sizeWords(x) : `${+x.toFixed(1)} µm`, out = [];
  for (const dim of ['across', 'long', 'thick']) {
    const s = sizes.filter(x => x.dim === dim); if (!s.length) continue;
    const lo = Math.min(...s.map(x => x.min)), hi = Math.max(...s.map(x => x.max)), upTo = s.every(x => x.upTo);
    const span = upTo ? `up to ${um(hi)}` : lo === hi ? `about ${um(hi)}` : hi >= 1000 ? `${um(lo)} to ${um(hi)}` : `${+lo.toFixed(1)}–${um(hi)}`;
    out.push(`${span} ${dim}`);
  }
  return out.join(', ');
}
/** The caption under a profile model: what it is drawn from, where its shape comes from, and its real size. */
// Family shapes a profile model falls back on for its outline when the profile states no shape (step 13 draws these).
const FAMILY_OUTLINES = new Set(['flat-epithelial', 'cube-epithelial', 'column-epithelial', 'immune', 'branched-immune', 'red-blood-cell', 'platelet', 'skeletal-muscle-fiber', 'cardiomyocyte', 'fat-cell']);
/** Where a profile model's outline comes from: its profile, its family's shape, or neither (illustrative). */
export const profileOutline = (P, fam) => P.shape ? 'profile' : fam && FAMILY_OUTLINES.has(fam.family) ? 'family' : 'illustrative';
export function profileCaption(label, P, fam) {
  const outline = profileOutline(P, fam), shapeFrom = outline === 'profile' ? null : outline === 'family' ? `shape from the ${fam.label.toLowerCase()} family` : 'shape illustrative';
  return ['Drawn from its morphology profile (unreviewed)', shapeFrom, P.sizes.length ? sizePhrase(P.sizes) : 'size not stated'].filter(Boolean).join(' · ');
}

/** CL id -> its Cell Ontology ancestors (step 06). */
export function clAncestors() {
  const file = path.join(root, 'graph/defs.cells.jsonl');
  return new Map(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(d => [d.id, d.ancestors ?? []]));
}

/** A model variant: family file name, then -cilia / -microvilli, then -no-nucleus when the family normally has one. */
export function variantOf(family, apical, noNucleus) {
  const f = CELL_FAMILIES.families[family];
  return [f.file, apical, noNucleus && f.nucleus !== false ? 'no-nucleus' : null].filter(Boolean).join('-');
}
export const modelUrl = variant => `/models/cell/${variant}.json`;

/** The caption under the 3D cell (the page shows it in capitals). */
export function captionOf(family, apical, noNucleus) {
  const f = CELL_FAMILIES.families[family];
  if (family === 'generic') return noNucleus ? 'A generic cell without a nucleus · its organelles are gone · sizes illustrative' : 'A generic cell · organelles typical of most cells · sizes illustrative';
  return [`A simplified shape for the ${f.label.toLowerCase()} family`, apical && `with ${APICAL_LABEL[apical]}`, noNucleus && 'no nucleus', 'sizes illustrative'].filter(Boolean).join(' · ');
}

/** How one cell type is drawn: the first rule whose class is the cell type or an ancestor wins; no rule = generic cell. */
export function shapeOf(id, ancestors = []) {
  const rec = RECONSTRUCTIONS.cells[id], g = rec && RECONSTRUCTIONS.groups[rec.group];
  if (g) {
    const variant = `nmo-${g.neuronId}`;
    return {family: 'reconstruction', label: g.class, variant, model: modelUrl(variant), caption: reconstructionCaption(g, rec.level), nucleus: true,
      from: {id: rec.group, label: g.class}, apical: null, noNucleus: null,
      reconstruction: {group: rec.group, level: rec.level, nmoId: g.nmoId, neuronName: g.neuronName, species: g.species, region: g.region, drawnSoma: g.drawnSoma,
        page: g.page, paper: g.paper, license: g.license, licenseUrl: g.licenseUrl, attribution: g.attribution}};
  }
  const fam = familyShapeOf(id, ancestors), prof = PROFILES[id];
  if (prof) {
    const P = profileParams(prof.claims), variant = `profile-${id.replace(':', '').toLowerCase()}`, label = prof.label ?? id;
    const summary = {status: prof.status, file: prof.file, claims: prof.claims.length, sizeUm: P.sizeUm, fields: [...new Set(prof.claims.map(c => c.field))]};
    // Nothing the model would draw differently: keep the family's model, with the profile's size in the caption.
    if (!drawsFromProfile(id, P)) return {...fam, caption: P.sizes.length ? `${fam.caption.replace(/ · sizes illustrative$/, '')} · ${sizePhrase(P.sizes)} (from its profile)` : fam.caption, profile: {...summary, drawn: false}};
    return {...fam, family: 'profile', label, variant, model: modelUrl(variant), caption: profileCaption(label, P, fam), nucleus: P.nucleusCount === 0 ? false : P.nucleusCount > 0 ? true : fam.nucleus,
      noNucleus: P.nucleusCount === 0 ? {id, label: 'morphology profile', why: 'Its morphology profile, from its cited sources, says it has no nucleus.'} : fam.noNucleus,
      from: {id, label: 'morphology profile'}, base: fam.family, baseLabel: fam.label, outline: profileOutline(P, fam),
      profile: {...summary, drawn: true}};
  }
  return fam;
}

// Cell types step 13 draws with a shape of their own once they have a profile (sperm, rods, cones, Schwann cells,
// olfactory receptor neurons), and the special structures it can draw.
const DEDICATED = new Set(['CL:0000019', 'CL:0000604', 'CL:0000573', 'CL:0002573', 'CL:0002376', 'CL:0000207']);
const DRAWN_SPECIAL = /zona|egg coat|keratin|tonofil|intermediate filament|intracellular canalicul|secretory canalicul|granule|bod(y|ies)|melanosome|t[- ]?tubul/i;
/** Whether a profile states anything the model would draw differently from the family shape. */
export function drawsFromProfile(id, P) {
  return DEDICATED.has(id) || !!P.shape || (P.nucleusCount != null && P.nucleusCount !== 1) || !!(P.nucleusShape && !/^round/.test(P.nucleusShape)) || !!P.nucleusPosition || !!P.nucleusSize
    || P.surface.some(v => v !== 'none') || P.granules.length > 0 || Object.keys(P.organelles).length > 0 || P.special.some(v => DRAWN_SPECIAL.test(v));
}

/** The family shape alone (the rules in cell-families.json), which a profile falls back on for anything it does not state. */
export function familyShapeOf(id, ancestors = []) {
  const has = cl => cl === id || ancestors.includes(cl);
  const rule = CELL_FAMILIES.rules.find(r => has(r.cl)) ?? null;
  const family = rule?.family ?? 'generic', f = CELL_FAMILIES.families[family];
  const apicalRule = f.apical ? Object.entries(CELL_FAMILIES.apical).map(([kind, rules]) => [kind, rules.find(r => has(r.cl))]).find(([, r]) => r) : null;
  const noNucleusRule = f.nucleus === false ? {cl: rule.cl, label: rule.label, why: f.noNucleus} : CELL_FAMILIES.noNucleus.find(r => has(r.cl)) ?? null;
  const apical = apicalRule?.[0] ?? null, noNucleus = !!noNucleusRule, variant = variantOf(family, apical, noNucleus);
  return {family, label: f.label, variant, model: modelUrl(variant), caption: captionOf(family, apical, noNucleus), nucleus: !noNucleus,
    from: rule ? {id: rule.cl, label: rule.label, ...(rule.note ? {note: rule.note} : {})} : null,
    apical: apicalRule ? {kind: apical, id: apicalRule[1].cl, label: apicalRule[1].label} : null,
    noNucleus: noNucleusRule ? {id: noNucleusRule.cl, label: noNucleusRule.label, why: noNucleusRule.why} : null};
}
