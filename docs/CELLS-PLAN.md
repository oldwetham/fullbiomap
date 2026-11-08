# Cells plan: real neurons, and a morphology profile for each commonly taught cell type

Nov 8, 2026 · branch `cells` (from main at v0.4.0) · for approval before any code. Four decisions are marked **Decision**.

Today 591 cell types share 18 models, so most cells look alike: 172 neurons share one drawing, 98 immune cells share one round shape, and 153 cell types fall back to the generic cell. This plan gives neurons and glia real reconstructions where they exist, and gives about 60 commonly taught cell types a model built from a sourced morphology profile. Everything else keeps its family shape.

## 1. What changes in the viewer

| Cell types | 3D model | Caption (example) | Panel |
| --- | --- | --- | --- |
| Neurons and glia with a NeuroMorpho.Org reconstruction | That reconstruction, as traced | "Reconstructed human pyramidal neuron, temporal cortex · NeuroMorpho NMO_12345 · about 0.6 mm across" | Credit: original paper, NeuroMorpho ID, species, region, CC BY 4.0 |
| About 60 commonly taught cell types | Built from the cell type's morphology profile | "Neutrophil, from its morphology profile (unreviewed) · about 12–15 µm across" | A short "Morphology" block (shape, size, nucleus, surface, granules), marked unreviewed, with its sources |
| Everything else | Its family shape, as now | Unchanged | Unchanged |

Captions always name the species when it is not human. Because sizes now come from data, captions show the real size and the magnification, as organ interiors already do.

## 2. Neurons and glia from NeuroMorpho.Org

### License (checked on its Terms of Use page, Nov 8 2026)

- **License:** "NeuroMorpho.Org is licensed under a Creative Commons Attribution 4.0 International License" (release 8.7, Oct 29 2026, 300,495 cells). That fits the project.
- **Citations:** any use must cite all three of:
  1. the original paper(s) describing the reconstruction (the PubMed link on its metadata page);
  2. "NeuroMorpho.Org (RRID:SCR_002145)";
  3. Tecuatl C, Ljungquist B, Ascoli GA (2024), Accelerating the continuous community sharing of digital neuromorphology data, FASEB Bioadv 6(7):207-221, doi:10.1096/fba.2024-00048.
  
  The NeuroMorpho ID is optional there; we will always show it.
- **Access rules:** scripts may use only the API and direct `.swc` file URLs, with a named User-Agent. Scripted calls to `.jsp` pages are forbidden. `pipeline/_http.py` already identifies and throttles. Every response is cached under `data/cache/neuromorpho.org/`, and the chosen reconstructions are pinned to release 8.7.

### What exists (API counts, release 8.7)

| Class | Human | Any species |
| --- | --- | --- |
| Pyramidal | 3,942 | |
| Interneuron | 234 | |
| Basket | 43 | |
| Granule | 82 | |
| Motoneuron | 60 | 3,346 |
| Retinal ganglion | 54 | 5,973 |
| Retinal bipolar | 41 | 1,275 |
| Amacrine | 10 | 526 |
| Cone | 3 | 340 |
| Rod | 0 | 154 |
| Horizontal | | 390 |
| Purkinje | 1 | 1,768 |
| Sympathetic | 0 | 158 |
| Dorsal root ganglion (by brain region) | | 5,097 |
| Spiral ganglion | | 511 |
| Astrocyte | 608 | 11,521 |
| Microglia | 1,353 | 81,129 |
| Oligodendrocyte | | 429 |

No Schwann cells, satellite glia, ependymal cells or enteric neurons.

### Our types against that

| Our cell types | Count | Likely match |
| --- | --- | --- |
| Brain: cortical glutamatergic types, interneuron subclasses, medium spiny, pallidal, thalamic, hippocampal, dentate, dopaminergic | ~45 | Mostly by type: human for cortex, hippocampus and dentate gyrus; mouse or rat for striatum, pallidum, thalamus and midbrain |
| Retina: ganglion (midget, parasol), bipolar (ON, OFF), amacrine, horizontal, rods, cones | ~13 | By type: human for ganglion, bipolar and amacrine cells; other species for horizontal cells and rods |
| Motor neuron | 1 | Human |
| Peripheral ganglia: dorsal root, sympathetic chain, prevertebral, parasympathetic and cranial sensory ganglia, by molecular marker (e.g. "Lumbar dorsal root ganglion TRPV1 neuron") | ~110 | No exact matches expected. Class stand-ins exist (mouse/rat dorsal root ganglion and sympathetic neurons) |
| General classes ("Neuron", "Interneuron", "Sensory neuron", "GABAergic neuron", …) | ~12 | A representative of the class |
| Glia: astrocytes (4 types), microglia, oligodendrocyte, oligodendrocyte precursor, Bergmann glia, Müller cell | ~9 | Astrocytes and microglia human; the rest other species. Microglia lose today's branched shape for a real reconstruction |
| Glia with no reconstructions: Schwann cells (2), satellite glia, ependymal cell | 4 | Morphology profiles (section 3) |

### How matches are chosen

- **The map:** a hand-checked map, `pipeline/maps/neuromorpho.json`. For each cell type it records the match level (type or class stand-in), the query, the chosen NeuroMorpho ID, the species, the brain region, and one line on why.
- **Selection order:** human first, then other primates, mouse, rat. Among those, prefer full 3D tracings with a soma and complete dendrites (and a traced axon for projection neurons, per NeuroMorpho's "physical integrity" field), of moderate size.
- **Stability:** ties break by the lowest ID, so rebuilds never drift.
- **Re-use:** one reconstruction can serve several of our types, e.g. a human layer 2/3 pyramidal neuron for the intratelencephalic types. The model file is shared.

**Decision 1: class stand-ins.** About 110 peripheral ganglion subtypes and 12 general classes have no exact match.
- **(A) Stand-ins:** use one representative reconstruction per class. Examples: a mouse dorsal root ganglion neuron for all 36 dorsal root ganglion subtypes; a rat sympathetic neuron for the sympathetic chain; a human pyramidal neuron for "Neuron". The caption says "An example mouse dorsal root ganglion neuron; not this subtype specifically".
- **(B) Keep the procedural neuron** for those types.

I recommend A. It is still real data, and the caption is explicit about what it stands for.

**Decision 2: photoreceptors.** Rod and cone tracings (154 and 340, only 3 human cones) follow the cell body and synaptic ending. They leave out the outer segment's stack of discs, which is what defines these cells.
- **(A) Reconstructions:** use them, following the neuron rule.
- **(B) Profiles:** give rods and cones a morphology profile (outer segment, inner segment with mitochondria, nucleus, synaptic terminal), with the reconstructions as one of its sources.

I recommend B.

### Turning reconstructions into models

- **Fetching:** a new step, `pipeline/14-neuromorpho.py`, fetches metadata and the standardized `.swc` files (the "CNG version") through the API and direct file URLs. It writes `graph/neuromorpho.json` with every credit. The paper's authors, year and title come from PubMed (NCBI E-utilities, cached).
- **Building:** step 13 turns each `.swc` file into tapered tubes from the recorded radii, with a minimum radius so fine branches stay visible. Somata come from their contour or sphere.
- **Parts and clicks:**
  - The parts are cell body (GO:0043025 for neurons, GO:0044297 for glia), dendrites (GO:0030425; apical dendrite GO:0097440 where the file distinguishes it), axon (GO:0030424), and glial processes (GO:0042995).
  - A nucleus is drawn inside the cell body and labeled illustrative, because tracings do not record it.
- **Scale:** each model is scaled onto the stage, and magnification comes from the micrometre coordinates.
- **Size:** long paths are resampled to keep each model under about 150,000 triangles.
- **Credits:** every model carries its credit (NeuroMorpho ID, neuron name, archive, species, region, paper with DOI/PMID, license). The panel, ATTRIBUTION.md and the About panel show it.

## 3. Morphology profiles for about 60 cell types

### What a profile holds

One file per cell type, `content/CL_<n>/morphology.md`. Its front matter uses the same `key: <JSON>` format as the tier files.

- **Shape and size:** body shape (disc, biconcave disc, sphere, polygonal plate, cube, column, pyramid, flask, dome, spindle, stellate, branched, tadpole, …), typical size and range in µm, and proportions.
- **Nucleus:**
  - **number:** 0, 1, 2, or "many" with a range;
  - **shape:** round, oval, kidney-shaped, bilobed, multilobed (3–5 lobes), flattened, cigar-shaped, cartwheel;
  - **position:** central, off-center, basal, apical, peripheral;
  - **size:** relative to the cell.
- **Surface:** microvilli (brush border or sparse), stereocilia (in a staircase), motile cilia, primary cilium, flagellum, foot processes, ruffled border, pseudopodia, long processes.
- **Granules:** kind, abundance, size, look (e.g. orange-red in eosinophils), and where they sit (apical, basal, throughout).
- **Organelles:** relative amounts on a 0–3 scale, each with a note tying it to the cell's job. Examples: rough ER 3 and Golgi 3 in a plasma cell; mitochondria 3 in a parietal cell or proximal tubule cell; smooth ER and glycogen in a hepatocyte; lysosomes in a macrophage or osteoclast.
- **Special structures:** acrosome, zona pellucida, myelin, basal infoldings, lamellar bodies, melanosomes, Weibel-Palade bodies, keratin filaments.
- **Provenance:** `status: "drafted"` (shown as unreviewed), `license: "CC BY 4.0"`, `attribution`, and `sources`. Each source says which fields it supports, so a reviewer can check them one by one.

### Sources

- **CC BY first:**
  - OpenStax Anatomy & Physiology 2e (CC BY 4.0), from the GitHub `osbooks-anatomy-physiology` copy, keeping its "Access for free at openstax.org" line;
  - OpenStax Biology 2e (CC BY 4.0);
  - Cell Ontology definitions (CC BY 4.0).
- **Other facts:** facts those do not cover (stereocilia rows, podocyte foot processes, osteoclast nuclei counts) come from primary literature, cited by DOI. Only facts are taken, never text. No Wikipedia.
- **Drafting:** I draft the profiles; all stay unreviewed until you or a reviewer marks them reviewed.

### The cell types (66; ✓ = already in the graph)

| Group | Cell types |
| --- | --- |
| Blood and immune (16) | Erythrocyte ✓, platelet ✓, neutrophil ✓ (3–5-lobed nucleus, fine granules), eosinophil ✓ (bilobed, large orange-red granules), basophil ✓ (granules hide the nucleus), monocyte ✓ (kidney-shaped nucleus), macrophage ✓ (pseudopodia, many lysosomes), B cell ✓, CD4 T cell ✓, CD8 T cell ✓ (cytotoxic granules), NK cell ✓, plasma cell ✓ (off-center cartwheel nucleus, rough ER, Golgi), mast cell ✓, dendritic cell ✓, megakaryocyte ✓ (lung megakaryocyte; giant, one multilobed nucleus), hematopoietic stem cell ✓ |
| Glia without reconstructions (4) | Schwann cell ✓ (myelin spiral around one axon), non-myelinating Schwann cell ✓ (wraps several small axons), satellite glial cell ✓ (thin wrap around a ganglion neuron), ependymal cell ✓ (cilia and microvilli) |
| Muscle (6) | Skeletal muscle fiber ✓ (many peripheral nuclei), cardiac muscle cell ✓ (branched, central nucleus, intercalated discs), Purkinje fiber ✓ (large, pale, glycogen, few myofibrils), sinoatrial pacemaker cell ✓ (small, few myofibrils), smooth muscle cell ✓ (spindle, cigar-shaped nucleus), pericyte ✓ (processes wrapped around a capillary) |
| Epithelia and glands (24) | Enterocyte ✓, intestinal goblet cell ✓ (apical mucin granules), Paneth cell ✓ (apical granules), enteroendocrine cell ✓ (basal granules), tuft cell ✓ (apical tuft), hepatocyte ✓ (often 2 nuclei, smooth ER, glycogen), pancreatic acinar cell ✓ (apical zymogen granules, basal rough ER), beta cell ✓, alpha cell ✓, alveolar type 1 ✓ (very thin sheet), alveolar type 2 ✓ (lamellar bodies), airway multiciliated cell ✓, club cell ✓, airway basal cell ✓, keratinocyte ✓, corneocyte ✓, melanocyte ✓ (melanosomes in its processes), podocyte ✓ (foot processes), proximal tubule cell ✓ (brush border, basal infoldings, mitochondria), principal cell ✓, intercalated cell ✓, urothelial umbrella cell ✓ (dome, often 2 nuclei), endothelial cell ✓, mesothelial cell ✓ |
| Bone, cartilage, connective (6) | Osteoblast, osteoclast (giant, 5–20 nuclei, ruffled border), chondrocyte: all three in ASCT+B tables but never placed (section 4). Osteocyte: new (section 4). Fibroblast ✓, fat cell ✓ |
| Gametes (3) | Sperm: new (section 4). Primary oocyte ✓ (large, off-center nucleus, zona pellucida). Cumulus granulosa cell ✓ |
| Sensory (7) | Rod ✓, cone ✓ (Decision 2), Merkel cell ✓, taste receptor cell: new. Inner and outer hair cells, olfactory receptor neuron: new, with no organ in the body model (section 4) |

### Models from profiles

- **Builder:** step 13 gets a profile-driven builder. It combines the body shapes, nucleus types (including several nuclei and none), surface features, granule clouds and organelle amounts above, reusing the existing geometry helpers. There is one model per profiled cell type.
- **New GO parts:** fetched by step 06, each with GO text, e.g.:
  - secretory granule and specific/azurophil granules;
  - zymogen granule, lamellar body, melanosome, Weibel-Palade body, peroxisome, glycogen granule;
  - stereocilium, sperm flagellum, acrosome, myelin sheath, intermediate (keratin) filaments.

  Each id is checked against its GO label when fetched.
- **Granule colors:** granules take the cell's own colors in its model, e.g. orange-red in eosinophils and dark purple in basophils.
- **Step 12 checks** for every profile:
  - status, license, attribution and complete sources are present, with no Wikipedia;
  - its model matches it: no nucleus when the profile says 0, at least two nuclei for "many", and every listed surface feature drawn;
  - the existing no-nucleus checks keep working.

## 4. Cell types not in the graph yet

- **Ovary fix:** the ovaries' tissue boards (with the primary oocyte) exist, but the female organs' entries never link to them, so Zoom in on an ovary finds nothing. This is a Phase 4 bug, fixed first.
- **Rows never placed:** some ASCT+B rows name these cells but were never placed:
  - **Bone marrow table:** osteoblasts ("osteolineage cells"), osteoclasts and chondrocytes. "Bone marrow" is not a structure in the body model, so these go on the bones' boards.
  - **Knee table:** four kinds of articular chondrocyte go on the femur and tibia boards.
  - **Wrong id:** the bone marrow table gives osteoclasts CL:0000090, an obsolete female germ-line stem cell term. We correct it to CL:0000092 in the map, with a note, and can report it to HRA.
- **Decision 3: new cell types from Cell Ontology.** These are in no HRA v2.5 table:
  - **Organ in the body model:** sperm, Sertoli and Leydig cells (testis); osteocyte (bones); taste receptor cell (tongue); parietal and chief cells (stomach).
  - **No organ in the body model:** inner and outer hair cells (no inner ear), olfactory receptor neuron (no nasal cavity), thyroid follicular cell (no thyroid gland).

  Options: (A) add the first group as nodes with Cell Ontology text and a `located_in` sourced to Cell Ontology's own "part of" axioms. They would appear on their organ's board in a group labeled with that source. (B) Wait for HRA tables. I recommend A, and leaving the second group out until their organs exist; they would have no board to open from.

## 5. NIH 3D (checked; nothing added)

NIH 3D's catalog search runs in the browser, so I found these through web searches of the site and read each entry page.

| Entry | What it is | License | Usable? |
| --- | --- | --- | --- |
| [3DPX-000299](https://3d.nih.gov/entries/3dpx-000299) Mitochondria and endoplasmic reticulum | Electron microscopy data (NCI Laboratory of Cell Biology); cell type and species not stated | CC BY 4.0 | License yes. An organelle-level model, so a candidate for later organelle detail, not a whole cell |
| [3DPX-011792](https://3d.nih.gov/entries/3dpx-011792) "Redo Neuron ABY512" | Volumetric surface of one neuron; source data, species and cell type not documented | CC BY 4.0 | License yes, but undocumented. NeuroMorpho is better for neurons |
| [3DPX-018269](https://3d.nih.gov/entries/3dpx-018269) Innervation of Purkinje cells | Artist's model after a Cajal drawing (Purkinje and basket cells) | CC0 | License yes, but an illustration, not data. NeuroMorpho has 1,768 Purkinje reconstructions |
| [3DPX-015797](https://3d.nih.gov/entries/3DPX-015797) Animal cell, [3DPX-015796](https://3d.nih.gov/entries/3dpx-015796) Neuron | Generic artist's models | CC BY-NC-SA 4.0 | No (non-commercial, share-alike) |

I found no NIH 3D models of blood or immune cells, epithelial or muscle cells, gametes or hair cells. None of these will be added without your go-ahead. Outside NIH 3D, Janelia's OpenOrganelle whole-cell electron microscopy segmentations may be worth a separate check later (license not yet verified).

## 6. Engine and budget

- **Engine:** no `app/scene.tsx` change is expected. Every new model is an ordinary manifest with the palette and envelope/shell layers it already supports. If fine reconstructed branches need a minimum on-screen width that build-time radii cannot give, that would be an engine change, and I will stop and ask.
- **Model files:**
  - about 60 distinct reconstructions at about 0.5–1 MB each;
  - about 60 profile models at about 0.4 MB each.

  That is roughly 60–90 MB of new model files, each under 2 MB. I will report the measured total and stop before committing if it passes 200 MB.

## 7. Order of work after approval (check, commit, continue)

1. Ovary board fix; ASCT+B placement fixes (bone marrow, knee, osteoclast id). Commit.
2. NeuroMorpho step: metadata and `.swc` fetch, the hand-checked match map, credits. Commit.
3. Reconstruction models; neuron and glia types use them; caption, panel and About credits. Commit.
4. Profile format and its step 12 checks; the 66 drafted profiles (unreviewed). Commit.
5. New GO parts (step 06) and profile-driven models (step 13). Commit.
6. If Decision 3 is A: the new cell types and their board groups. Commit.
7. Page: real-size captions, the Morphology block, credits. Docs and ATTRIBUTION.md. Commit.

**Decision 4: scope check.** The rest of the 591 cell types keep their family shapes. Proteins and molecules stay in Phase 5. I will report how many cell types end up with a reconstruction, a profile, or a family shape.
