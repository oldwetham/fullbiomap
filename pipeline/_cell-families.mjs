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
/** Real size in words: 600 µm, 1.6 mm. */
export const sizeWords = um => um >= 1000 ? `${(um / 1000).toFixed(1).replace(/\.0$/, '')} mm` : `${Math.round(um / 10) * 10} µm`;
const reconstructionExtent = g => Math.max(...['width', 'height', 'depth'].map(k => g.size?.[k] ?? 0));
/** The caption under a reconstruction: its own type, or a representative of the class (never this subtype). */
export function reconstructionCaption(g, level) {
  const what = level === 'type' ? `Reconstructed ${g.species} ${g.class}` : `A representative ${g.species} ${g.class}, not this subtype specifically`;
  return [what, `NeuroMorpho.Org ${g.nmoId}`, `about ${sizeWords(reconstructionExtent(g))} across`, g.drawnSoma ? 'cell body drawn, not traced' : null, 'nucleus illustrative'].filter(Boolean).join(' · ');
}
const APICAL_LABEL = {cilia: 'cilia', microvilli: 'microvilli'};

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
