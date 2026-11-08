# Phase 4 plan: tissue and cell

Nov 7, 2026 · for approval before any code. Four decisions are marked **Decision**.

## 1. Where tissue and cell sit on the ladder

Body › System › Organ › **Tissue** › **Cell type** › **Organelle** (female organs: Female organs › Uterus › Tissue › …)

| Level | What you see | Zoom in | Zoom out |
| --- | --- | --- | --- |
| Organ (in the body, or on its interior stage) | As today | Interior stage if the organ has one, then **Tissue** (organs without an interior go straight to Tissue) | As today |
| **Tissue** | A tissue board in place of the 3D view: the organ's histology image with its credit line, HRA's 2D functional tissue unit illustration(s) where they exist, and the organ's cell types as chips grouped by structure (e.g. "Renal corpuscle: podocyte, mesangial cell, …"). The organ's panel stays open. | Pick a cell type → **Cell type** | The organ, exactly where you came from |
| **Cell type** | The 3D cell on the organ stage; the panel shows the cell type's text (Cell Ontology), its sources and "Found in" connections | Click an organelle | Tissue board |
| **Organelle** | That organelle selected and tinted; panel shows its GO text | — | The cell type |

- **Breadcrumb**, e.g.: Body › Urinary › Left kidney › Tissue › Podocyte › Mitochondrion.
- **Panel:** a cell type has no mesh of its own, so the panel will also open for a structure without geometry (a page change, not an engine change).
- **Links:** `#FMA7205/tissue`, `#FMA7205/tissue/CL0000653`, `#FMA7205/tissue/CL0000653/GO0005739`, and `#organ/uterus-female/tissue/…`. All existing links keep working.

## 2. The 3D cell

**One generic cell, built procedurally with three.js at build time** (a new pipeline step, `pipeline/13-cell.mjs`, using three's geometry classes in Node). It writes an ordinary manifest (`public/models/cell/generic-cell.json` plus one gzip chunk, about 1 MB), so the organ stage loads it exactly like an organ interior. It's seeded, so the output is identical on every run.

| Organelle (GO id) | Look |
| --- | --- |
| Cell membrane (GO:0005886) | Slightly irregular translucent ellipsoid, about 1.4 m across on the stage |
| Nucleus (GO:0005634) | Large translucent sphere, off-center, with pores suggested by small dimples |
| Nucleolus (GO:0005730) | Dense dark sphere inside the nucleus |
| Rough ER (GO:0005791) | Stacked curved sheets wrapped around the nucleus |
| Ribosomes (GO:0005840) | Small beads studding the rough ER, plus some free in the cytoplasm (one part) |
| Smooth ER (GO:0005790) | Branching tubes beyond the rough ER |
| Golgi apparatus (GO:0005794) | Five or six curved flattened discs near the nucleus, with budding vesicles |
| Mitochondria (GO:0005739) | About 12 capsules with folded inner ridges |
| Lysosomes (GO:0005764) | About 8 small spheres |
| Cytoskeleton (GO:0005856) | Thin filaments radiating from near the nucleus to the membrane |

- **Update, Nov 8 2026: cell families.** Cell types now open one of eleven simplified cell families (round immune cell, branched immune cell for microglia, dendritic and Langerhans cells, red blood cell, platelet, neuron, skeletal muscle fiber, cardiac muscle cell, flat, cube-shaped and column-shaped epithelial cells with microvilli or cilia where the cell type has them, fat cell), chosen from each cell type's Cell Ontology ancestors by `pipeline/maps/cell-families.json`; the generic cell below is the fallback, and the caption names the family. Cell types without a nucleus are drawn without one (step 12 checks against both the family rules and Cell Ontology).
- **Same cell for every type** (the first version). Every cell type opens the same generic cell, and the stage caption says so ("A generic cell: organelles typical of most cells; sizes and numbers are illustrative"). The spec's specialized variants (muscle, neuron and so on) are left for later.
- **Organelle nodes:** each organelle is a graph node (`GO:` id, scale organelle) with tier-1 text from its GO definition (all ten are available, none cites Wikipedia; GO is CC BY 4.0). It also gets a `component_of` edge to the generic cell node (`BIOMAP:cell-generic-v1`).
- **Clicking:** clicking an organelle selects all instances of that organelle (all mitochondria), the same way a shell selects its whole lung.

**Decision 1: `app/scene.tsx` changes (about 15 lines).** The engine colors parts only by the 15 body systems and has no layer that steps aside for what's inside it. Two changes:

1. **Palette:** a manifest may declare its own colors (`palette: [{id: 'mitochondrion', color, label}]`), used like systems. Each organelle gets its own color and its own toggle in the layers panel.
2. **Envelope layer:** a translucent layer that takes a tap only when nothing inside it is hit, used for the cell membrane. The nucleus reuses the existing `shell` behavior: the first tap selects the nucleus, the next passes through to the nucleolus.

Nothing else in the engine changes.

## 3. Data

**Cell types (ASCT+B, HRA v2.5).**
- **Tables:** step 04 also fetches the 33 organ ASCT+B tables pinned in v2.5 (kidney v1.8, heart v1.7, …; CC BY 4.0, cited per table).
- **Mapping:** step 06 maps each row's anatomical structures to our nodes: FMA ids directly, Uberon ids through our Uberon ↔ FMA cross-references, then the 3D crosswalk. Each cell type is placed in the deepest structure we have, walking up the row if needed.
- **Nodes:** each Cell Ontology id becomes a node (`CL:…`, scale cell) with `located_in` edges (source ASCT+B table and version).
- **Text:** tier-1 is the CL definition (CC BY 4.0, skipped if it cites Wikipedia), else NCIt through CL's cross-reference, else "X is a cell type found in the Y (HRA ASCT+B)".
- **Validation:** step 12 requires every cell type to have a `located_in` edge, text and a source.
- **Report:** counts per organ go in `reports/cells.md`.

**Histology (Human Protein Atlas).**
- **What the dictionary offers:** HPA's normal-tissue dictionary has whole-section histology for 44 tissues, but each image is a deep-zoom tile pyramid (OpenSeadragon), not a single file. Downloading one means fetching and stitching hundreds of tiles.
- **What's practical:** HPA's immunohistochemistry images are single JPEGs with a stable address on `images.proteinatlas.org`, listed in each gene's downloadable data.
- **Decision 2: which image (recommended IHC).** For each organ, use one IHC image of a protein that HPA classes as enriched in that tissue. The stained protein marks the tissue's characteristic cells, and the hematoxylin counterstain shows the architecture. The credit names the protein and links the exact image. The alternative is stitched H&E-like dictionary images: closer to a classic histology photo, but a heavier, more fragile download. Images are capped at about 1,200 px. If HPA has no smaller rendition, I'll keep the originals (each under 3 MB) and report the total.
- **Decision 3: HPA release and license.** Your message and the spec say CC BY-SA 3.0, but that's out of date:
  - The live release is **25.1 (2026-05-25), CC BY 4.0**.
  - The **v24** archive says **CC BY-SA 4.0**.

  I recommend pinning 25.1 (CC BY 4.0), which removes the only ShareAlike obligation in the project. The spec's licensing matrix is updated either way.
- **Organs:** a hand-edited map, `pipeline/maps/hpa-tissues.json`, links HPA tissue names to our organs (kidney → left and right kidney, …).

**2D tissue units (HRA v2.5).**
- **What:** 28 illustrations (SVG, CC BY 4.0) for the kidney (7), pancreas (4), mouth (3), skin (3), lung (2), spleen (2), and the large intestine, liver, small intestine, prostate and thymus (one each).
- **Linking:** shown on that organ's tissue board. Their crosswalks link illustration regions to cell types, so a cell type chip can say which illustration shows it.

**Graph.** New nodes for cell types, organelles and the generic cell. A `media` entry on each organ node holds the image or illustration, its license, attribution and exact link; step 12 requires all of them. Every new dataset is credited in ATTRIBUTION.md and the About panel.

## 4. Order of work after approval (check, commit, continue)

1. Step 04: ASCT+B tables and FTU illustrations. Commit.
2. Steps 06 and 07: cell-type nodes, `located_in`, CL text. Commit.
3. HPA images: new step `pipeline/08-histology.py` (the free step 8 number), plus `media` on organ nodes. Commit.
4. Step 13: the procedural cell, plus organelle nodes. Commit.
5. `app/scene.tsx` (Decision 1). Commit.
6. Page: the tissue board, cell and organelle levels, breadcrumb, Zoom out and links. Commit.
7. Credits. Commit.

Every committed file stays under 50 MB. I'll report total image and model size growth, and stop if it's over 200 MB.

## 5. Decision 4: scope check

Phase 4 does not include protein (molecule) nodes, biomarker (`characterized_by`) edges, or specialized cells. Those are Phase 5 and later, per the spec's ladder.
