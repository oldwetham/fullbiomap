# Bio Map — Build Spec v0.1

Nov 7, 2026 · @matt

## Decisions & scope

Bio Map is a free, browser-based 3D human body you can click at every scale, from the whole body down to the proteins inside a cell type, with every structure explained at three depths. It is built by forking the MIT-licensed [Human Atlas](https://github.com/ashemag/human-atlas) (React + Three.js over BodyParts3D geometry, [live demo](https://human-atlas-seven.vercel.app)) and adding a knowledge graph on top. The first public version ships when it passes the quality gates in this spec, not on a date.

| Decision | Choice | Why |
| --- | --- | --- |
| Base app | Fork ashemag/human-atlas (MIT) | 2,234 selectable meshes, batched rendering, search, exploded view and mobile layout already work |
| Scope of v1 | Body → system → organ → tissue → cell → organelle → molecule | Decided 2026-11-07; molecules rendered with an embedded Mol\* viewer |
| Audience | Layered: plain-language, AP Bio/undergrad, pre-med | Three text tiers per structure behind one level toggle |
| Explanations | Hybrid: auto-draft every node, hand-curate the top \~200 | Full coverage immediately, depth where learners actually click |
| Timeline | Quality-gated, no fixed date | Each phase has an exit gate (see Quality standards) |
| Hosting | Static site on Vercel or Cloudflare Pages; oversized assets on Cloudflare R2 | No backend to run or pay for |
| Licensing posture | Geometry CC BY 4.0; no Wikipedia text anywhere (decided 2026-11-07); auto text reuses NCIt (CC BY 4.0) or Uberon/FMA (CC BY 3.0) definitions | Attribution is generated per structure, never hand-maintained |

## Product definition

One page: the 3D body, a detail panel, and a scale ladder (Body › System › Organ › Tissue › Cell › Organelle › Molecule) that always shows where you are. Click anything to select it; the panel explains it at the chosen depth, lists what it connects to, and offers Zoom in / Zoom out to step one scale down or up. Every structure has a shareable link (`/#FMA7088`).

| Scale | What the user sees | Representation and source | Example path |
| --- | --- | --- | --- |
| Body | Whole figure, systems color-coded, male or female | Human Atlas scene (BodyParts3D male); HRA united GLB (female) | Start |
| System | One system shown, others hidden or faded | Same scene, visibility toggles (already built) | Cardiovascular |
| Organ | Organ selected, neighbors faded; interior parts selectable | Same scene; HRA per-organ GLB for chambers, lobes, cortex/medulla | Heart → left ventricle |
| Tissue | Histology photo + functional-tissue-unit diagram | Human Protein Atlas images; HRA 2D FTU illustrations | Left ventricle → cardiac muscle |
| Cell | Cell type inside a stylized 3D cell | Authored Blender cell model (no open atlas exists); Cell Ontology definition | Cardiac muscle → cardiomyocyte |
| Organelle | Selectable part of the cell model | Same authored model | Cardiomyocyte → mitochondrion |
| Molecule | Rotatable protein or small molecule | Mol\* embed loading AlphaFold DB or PDB; biomarkers from HRA ASCT+B | Cardiomyocyte → troponin T (TNNT2 → UniProt P45379) |

Core interactions, in priority order:

1. Select by click or tap; name on hover; detail panel opens (exists today).
2. Level toggle: Plain / Core / Deep rewrites the panel text; choice persists.
3. Connections: chips such as "Supplied by: left coronary artery" tint those structures in the scene and jump on click.
4. Zoom in / Zoom out along the scale ladder; breadcrumb shows the path.
5. Isolate, explode, system presets, search, camera views (exist today).
6. Peel: opacity slider per system; cross-section clipping plane (later phase).
7. Deep links, browser back/forward, keyboard navigation of the structure list.

| Tier | Reader | Voice and length | Must contain |
| --- | --- | --- | --- |
| 1 Plain | General public, middle and high school | 2–4 sentences, no jargon beyond the structure's name | What it is, what it does, one everyday comparison |
| 2 Core | AP Biology, undergrad A&P | 1–3 short paragraphs | Structure, function, the key mechanism with named molecules or enzymes, main connections |
| 3 Deep | Pre-med, advanced | Up to \~500 words | Mechanism detail, histology or development, clinical correlates, at least two cited sources |

## Architecture

&#91;embedded content: Bio Map architecture · build pipeline, static artifacts, browser\]

The knowledge module (`graph/`, `content/`, `pipeline/`) never imports from the renderer, so the Three.js engine can be swapped later without touching a word of content. The React UI owns `SceneState`; the engine renders it and reports taps; the Mol\* panel and per-organ GLBs load only when the user zooms to that scale.

## Human Atlas codebase map

The whole app is about 55 KB of dense TypeScript in seven files, plus shadcn UI components and five pipeline scripts; everything the knowledge layer needs to touch is in `app/`. Inspected from a clone of [ashemag/human-atlas](https://github.com/ashemag/human-atlas) on 2026-11-07 (8 commits, MIT). Stack: React 19, Three.js ^0.159, Vite 8 (root `web/`, public dir `public/`, alias `@` → repo root), Tailwind 4, meshoptimizer; `vercel.json` builds with `npm ci` → `npm run build` → `dist/`; `wrangler` and the Cloudflare Vite plugin are already dev dependencies, so Cloudflare Pages works too.

| File | Bytes | What it does | Bio Map hook |
| --- | --- | --- | --- |
| `app/anatomy.ts` | 6,074 | Types (`Part`, `Concept`, `Atlas`, `SceneState`), the 15 `SYSTEMS` with colors and one-line descriptions, and `EXPLANATIONS`: a 9-entry map keyed by lowercased name (heart, liver, brain, stomach, spleen, pancreas, urinary bladder, trachea, diaphragm) | Replace `explanation(name, system)` with a lookup by `conceptId` (FMA id) into the knowledge graph; add `highlighted: string[]` and `level` to `SceneState` |
| `app/page.tsx` | 14,559 | `Home` component: loads `/models/atlas.json`, system toggles and presets, search combobox over `atlas.concepts`, `choose(concept)` / `choosePart(id)` selection, the detail `Sheet` (title, description, "Included structures", source link, Isolate / Clear), About sheet | The detail sheet is where tiers, connection chips, media and Zoom in/out go; `choose()` is where URL hash sync and breadcrumbs attach |
| `app/scene.tsx` | 18,527 | Three.js engine: one merged mesh per system (15 draw calls); per-part state in two 1-D data textures (`partTexture` RGBA float = explode offset xyz + visible flag; `selectionTexture` r = selected) indexed by a per-vertex `partIndex` attribute; shader injection via `onBeforeCompile` discards invisible parts and tints selected ones; picking raycasts per-part picker meshes after a bounding-box prefilter; explode layout, isolate framing, hover tooltip, auto-rotate | Add a second channel (`selectionTexture.g`) for "related" tint and a per-part opacity for peel/fade; reuse the isolate framing code for Zoom-in camera moves; a clipping plane is a `renderer.clippingPlanes` addition |
| `app/agent-tools.ts` | 2,241 | Registers `find_anatomy` and `inspect_anatomical_structure` as WebMCP tools on `document.modelContext` when the browser supports it | Extend with `explain_structure(id, tier)` and `related(id, relation)` so an agent can drive the tutor |
| `app/explosion-layout.ts`, `pointer-tap.ts`, `model-download.ts` | \~2.7 KB total | Exploded-grid packing, tap-vs-drag detection, gzip chunk decoding | Leave alone |
| `scripts/convert-anatomy.py` | 3,490 | BodyParts3D OBJ → binary chunks + `atlas.json`; converts mm/Z-up to m/Y-up; needs two JSON inputs that are not in the repo: a concept map (`elements[]`, `concepts[]`) and a system map (part id → system) | Phase 0 writes the script that builds those two inputs from the BodyParts3D IS-A / PART-OF tables |
| `scripts/optimize-anatomy.mjs` | 3,600 | meshoptimizer quadric simplification at 0.2% relative error; has a `female` branch that welds duplicate vertices from HRA exports | The HRA path already exists here; only the GLB → manifest converter is missing |
| `scripts/compress-models.mjs`, `validate-atlas.mjs`, `validate-interactions.mjs` | \~4.2 KB | gzip chunks; assert exactly 2,234 parts / 3,432 concepts and valid buffers; check tap and layout contracts | Validation hard-codes the counts; parameterize it before adding HRA structures |
| `public/models/` | 90 MB on disk | `atlas.json` (1.3 MB) + 15 chunks `body-0..14.bin` (\~4 MB each, \~2.2 MB gzipped) | Chunks are grouped by load order, not by system; a per-system split is a later optimization |

`atlas.json` schema: `parts[]` = `{id: "FJ1252", name, conceptId: "FMA59763", system, chunk, positions, normals, indices, vertexCount, indexCount, bounds}` (byte offsets into the chunk; positions float32, normals int16, indices uint32); `concepts[]` = `{id: "FMA3710", name, elements: ["FJ2925", …]}`; `chunks[]` = `{url, bytes, gzip, gzipBytes}`; plus `triangles` (2,288,268), `sourceTriangles` (6,681,030), `sex`, `source`. Part ids are BodyParts3D representation ids; concept ids are FMA ids, which is the join key for everything in the knowledge graph.

Coverage caveat from the manifest: the male model is vascular-heavy (639 arterial and 404 venous meshes) and thin where learners expect depth: 3 lymphatic, 4 endocrine, 6 urinary and 5 integumentary meshes. Those systems get their interiors from HRA organs.

## Knowledge graph schema

The graph is two newline-delimited JSON files built at compile time (`graph/nodes.jsonl`, `graph/edges.jsonl`) plus one static JSON per node served from `public/content/<id>.json`; the renderer only ever reads the per-node file for the thing on screen. Every node is keyed by a public ontology ID so that geometry, text, cell types and proteins join on identifiers nobody at Bio Map invents.

| ID prefix | Scale(s) | Source of truth | Example |
| --- | --- | --- | --- |
| `FMA:` | body, system, organ, tissue (gross) | Foundational Model of Anatomy; BodyParts3D `conceptId` | `FMA:7088` heart |
| `UBERON:` | organ, tissue | HRA 3D organs and ASCT+B tables | `UBERON:0000948` heart |
| `CL:` | cell | Cell Ontology via ASCT+B | `CL:0000746` cardiac muscle cell |
| `GO:` | organelle | Gene Ontology cellular component | `GO:0005739` mitochondrion |
| `HGNC:` | molecule (gene) | ASCT+B biomarker column | `HGNC:TNNT2` |
| `UniProt:` | molecule (protein) | UniProt ID mapping from HGNC | `UniProt:P45379` |
| `CHEBI:` | molecule (small) | ChEBI | `CHEBI:16236` ethanol |
| `BIOMAP:` | anything with no public ID (authored cell parts, pathways you draw) | This repo | `BIOMAP:cell-generic-v1` |

Node record:

```json
{
  "id": "FMA:7088",
  "label": "Heart",
  "scale": "organ",
  "system": "cardiac",
  "synonyms": ["cor"],
  "xrefs": {"UBERON": "0000948", "NCIT": "C12727", "TA98": "A12.1.00.001", "MeSH": "D006321"},
  "geometry": {"male": ["FJ2951", "FJ2952"], "female": ["VH_F_Heart"], "interior": "hra/organ/heart-female.glb"},
  "content": {
    "tier1": {"status": "reviewed", "file": "content/FMA_7088/tier1.md"},
    "tier2": {"status": "auto", "file": "content/FMA_7088/tier2.md"},
    "tier3": {"status": "missing"}
  },
  "media": [{"kind": "histology", "url": "…", "license": "CC BY 4.0", "attribution": "Human Protein Atlas 25.1", "gene": {"symbol": "UMOD", "uniprot": ["P07911"]}}],
  "sources": [{"title": "OpenStax A&P 2e §19.1", "url": "…", "license": "CC BY 4.0"}],
  "zoom": {"in": ["UBERON:0002084"], "out": ["BIOMAP:system-cardiovascular"]}
}
```

Edge record: `{"from": "FMA:7088", "to": "FMA:50039", "rel": "arterial_supply", "source": "FMA", "license": "CC BY 3.0", "evidence": "…"}`.

Each `public/content/<id>.json` also carries `connections`: `{rel, dir: "out" | "in", id, conceptId, label, modeled, sources: [{name, license, url}]}`. When FMA names a related structure that has no 3D mesh (most nerve plexuses and lymphatic chains), it is kept as a non-selectable label (`modeled: false`, `conceptId: null`) in the per-node file only and never becomes a graph edge, so `graph/edges.jsonl` has no dangling endpoints (decided 2026-11-07).

| Relation | Reads as | Source dataset | Scales it joins |
| --- | --- | --- | --- |
| `part_of` / `has_part` | X is part of Y | BodyParts3D PART-OF table, FMA, ASCT+B partonomy | all |
| `is_a` | X is a kind of Y | BodyParts3D IS-A, FMA, Uberon, CL | all |
| `branch_of`, `tributary_of` | vessel tree links | FMA, HRA vasculature (VCCF) | organ |
| `arterial_supply`, `venous_drainage`, `nerve_supply`, `lymphatic_drainage` | what feeds, drains, innervates X | FMA | organ, tissue |
| `attaches_to`, `articulates_with`, `continuous_with` | musculoskeletal and tubular continuity | FMA | organ |
| `located_in` | cell type lives in structure | ASCT+B | tissue → cell |
| `characterized_by` | biomarker marks cell type | ASCT+B | cell → molecule |
| `encodes` | gene → protein | UniProt ID mapping | molecule |
| `has_structure` | protein → AlphaFold/PDB entry | AlphaFold DB, RCSB | molecule |
| `component_of` | organelle → cell | GO / authored model | organelle → cell |
| `participates_in` | molecule → pathway (optional later) | Reactome or WikiPathways (license to confirm) | molecule |

Enums: `scale` ∈ body, system, organ, tissue, cell, organelle, molecule; content `status` ∈ missing, auto, drafted, reviewed, verified (UI shows an "unreviewed" badge for `auto` and `drafted`); `tier` ∈ 1, 2, 3. A validator refuses a build if any edge endpoint is missing, any content file lacks `license` and `sources`, or any organ-scale node lacks tier-1 text.

## Data sources & licensing matrix

Everything in v1 is free to use on a public educational site; no Wikipedia text is used anywhere (decided 2026-11-07), and Human Protein Atlas 25.1 is CC BY 4.0 (pinned 2026-11-07; v24 was CC BY-SA 4.0), so no ShareAlike obligation remains; the only license to re-check at build time is OpenStax. Licenses verified 2026-11-07 against the linked pages.

| Dataset | Contributes | License | Obligation in Bio Map |
| --- | --- | --- | --- |
| [BodyParts3D 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) (DBCLS) | Male geometry, FMA ids, IS-A / PART-OF tables | CC BY 4.0 (relicensed 2025-02-27; old OBJ headers still say CC BY-SA 2.1 JP) | Credit line in About and per structure; cite Mitsuhashi et al. 2009 |
| [HRA 3D Reference Objects](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html) (HuBMAP) | Female body, 73 organs with interiors, GLB | CC BY 4.0 | Cite HRA release + Browne et al.; keep crosswalk file |
| HRA ASCT+B tables and [vasculature (VCCF)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10356915) | Organ → structure → cell type → biomarker; vessel branching | CC BY 4.0 (HRA digital objects) | Cite HRA version per table used |
| [FMA](https://bioregistry.io/fma) via [EBI OLS4](https://www.ebi.ac.uk/ols4) | Labels, synonyms, definitions, is_a / part_of (Phase 1); supply, drainage, innervation (Phase 2) | CC BY 3.0 (OLS4 metadata labels it "custom", linking to a 2006 draft license page) | Credit UW Structural Informatics Group |
| [Uberon](http://purl.obolibrary.org/obo/uberon/merged.owl), Cell Ontology, GO | Cross-species anatomy ids, cell type and organelle definitions | CC BY (OBO Foundry) | Credit each ontology |
| [NCI Thesaurus](https://evsexplore.semantics.cancer.gov) (NCIt) via EBI OLS4 | Preferred tier-1 definition, reached through each Uberon term's NCIT xref | CC BY 4.0 | Cite NCIt version and concept code per structure |
| [OpenStax Anatomy & Physiology 2e](https://openstax.org/books/anatomy-and-physiology-2e/pages/preface) | Tier-2 source text and figures | CC BY 4.0 on copies dated through Jan 2026; openstax.org pages dated Jun 2026 show CC BY-NC-SA | Use a CC BY copy (2022 PDF or GitHub `osbooks-anatomy-physiology`) and keep the required "Access for free at…" line; NC-SA is still fine for a free site |
| [Human Protein Atlas](https://www.proteinatlas.org/about/licence) 25.1 | Histology images (one immunohistochemistry image per organ, of a tissue-enriched protein), tissue and cell-type expression per gene | CC BY 4.0 (25.1; v24 was CC BY-SA 4.0) | Image credit + link to the exact image and the gene's tissue page; caption names the stained protein; gene recorded for Phase 5 |
| UniProt, AlphaFold DB | Protein records; predicted structures for every human protein | CC BY 4.0 | Cite accession |
| RCSB / wwPDB | Experimental structures | Open; cite entry per wwPDB policy | Cite PDB id and primary citation |
| [Mol\*](https://molstar.org) | Molecule viewer | MIT | Keep license notice |
| [Human Atlas](https://github.com/ashemag/human-atlas) | App code and geometry pipeline | MIT | Keep LICENSE and ATTRIBUTION.md |
| Z-Anatomy (optional) | Cleaner meshes, TA labels | CC BY-SA 4.0 | Only if we accept BY-SA on geometry; otherwise skip |
| TotalSegmentator (optional) | Meshes from real CT/MRI | Apache 2.0 | Only for a "real scan" layer |
| Pulse Physiology Engine (later) | Whole-body physiology simulation | Apache 2.0 | Keep NOTICE |

Rule: every content file and media record carries `license` and `attribution` fields; the About page and each detail panel render credits from those fields, never from hand-written text.

## Data pipeline

Twelve scripts run in order from raw downloads to a validated `public/` folder; everything is reproducible with `npm run pipeline`, nothing is fetched at runtime, and every step writes a coverage report so gaps are numbers, not surprises. Existing Human Atlas scripts are reused unchanged where noted.

1. `pipeline/00-fetch-bodyparts3d.sh` — downloads `isa_BP3D_4.0_obj_99.zip` and the English name, IS-A and PART-OF TSV tables from the [BodyParts3D download page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) into `data/raw/bp3d/`.
2. `pipeline/01-build-maps.py` (new) — joins those tables into the two inputs `convert-anatomy.py` expects but does not ship: `data/build/concepts.json` (`elements[]` with id, name, conceptId; `concepts[]` with FMA id, name, element ids) and `data/build/systems.json` (part id → one of the 15 systems, with a hand-edited override file for the \~100 ambiguous parts).
3. `scripts/convert-anatomy.py data/raw/bp3d/obj data/build/concepts.json data/build/systems.json` (existing) → `public/models/anatomy-*.bin` + `atlas.json`; then `node scripts/optimize-anatomy.mjs` and `node scripts/compress-models.mjs` (existing) → `body-*.bin(.gz)`.
4. `pipeline/04-fetch-hra.py` (new) — pulls the HRA united female GLB, per-organ GLBs, `asct-b-3d-models-crosswalk.csv` and the ASCT+B tables from the [ccf-releases repo](https://github.com/hubmapconsortium/ccf-releases) / HRA API into `data/raw/hra/`, pinned to one HRA version.
5. `pipeline/05-hra-to-manifest.mjs` (new) — GLB scene nodes → the same part/chunk manifest format, prefixed `female-` and `organ-<uberon>-`, Uberon id in `conceptId`; then the existing optimizer's `female` weld branch.
6. `pipeline/06-ontology.py` (new) — for every FMA concept in `atlas.json`, fetches from EBI OLS4 its label, synonyms, definition, is_a and part_of parents and is_a ancestors; its Uberon xref (from a one-time scan of Uberon terms, whose xrefs OLS4 does not index for search); and, through Uberon, the NCIt xref and NCIt definition. Every response is cached under `data/cache/ols/`, requests are throttled and carry a descriptive User-Agent → `graph/defs.jsonl`, `graph/edges.fma.jsonl`. Phase 2 adds arterial supply, venous drainage, nerve and lymphatic drainage, branch_of, tributary_of, attaches_to, articulates_with and continuous_with (inverse FMA properties folded onto these) → `graph/edges.fma.jsonl`, and maps the HRA Blood Vasculature ASCT+B table (VCCF) onto modeled vessels → `graph/edges.vccf.jsonl`.
7. `pipeline/07-tier1.py` (new) — writes `content/<id>/tier1.auto.md` for every concept from the first available of: NCIt definition, Uberon definition, FMA definition, then a sentence generated from the FMA hierarchy ("X is a kind of Y and part of Z"). A definition whose provenance cites Wikipedia is skipped. Each file has `status: auto`, the source name, a link to the source term and its license; curated `tier1.md` files are never touched.
8. *(Removed 2026-11-07: no Wikipedia text. The number stays free so later steps keep their numbers.)*
9. `pipeline/09-cells-and-molecules.py` (new) — ASCT+B rows → `located_in` and `characterized_by` edges; HGNC symbols → UniProt accessions via the UniProt ID-mapping API → AlphaFold ids (`AF-<acc>-F1`) and PDB ids via the RCSB search API → `graph/edges.cells.jsonl`, `graph/edges.molecules.jsonl`.
10. `pipeline/10-llm-draft.py` (new) — for nodes with no tier text, or tiers 2–3 of curated nodes, asks Claude for a draft from the node's definition, parents, relations and sources only; output is marked `status: auto` and a prompt log is kept per node.
11. `pipeline/11-build-graph.mjs` (new) — merges nodes, edges, xrefs and content status → `graph/nodes.jsonl`, `graph/edges.jsonl`, `public/content/<id>.json`, `public/search-index.json`, `public/attribution.json`.
12. `pipeline/12-validate.mjs` (new, replaces the hard-coded counts in `validate-atlas.mjs`) — schema checks, no dangling edges, license fields present, tier coverage by scale, and a one-page `reports/coverage.md` that the quality gates read.

Runtime loading: `atlas.json` + chunks as today; `content/<id>.json` fetched on selection; per-organ GLBs and Mol\* loaded lazily only when zooming into that scale.

## Content workflow

Every one of the \~3,400 nodes gets an automatic tier-1 draft so nothing on screen is ever blank; about 200 nodes get all three tiers written and reviewed by hand, and the UI labels everything else "unreviewed" until it is. Curated text is Markdown with front matter in `content/<id>/tier<n>.md`, so Claude Code can draft it and git tracks every change.

The curated 200 (the list lives in `content/CURATED.md` and is the first thing to write):

- All 15 systems and every organ in the body (≈ 60 nodes).
- The structures an AP Biology / OpenStax A&P reader meets by name: major bones and joints, the big muscle groups, the great vessels, cranial and major peripheral nerves, brain regions, endocrine glands, sense organs (≈ 100).
- One complete vertical slice per system down to a protein, so the zoom ladder is demonstrably real end to end (≈ 40: for example heart → left ventricle → cardiac muscle → cardiomyocyte → mitochondrion → troponin T).

| Tier | Allowed sources for a draft | Review bar to reach `reviewed` | Bar to reach `verified` |
| --- | --- | --- | --- |
| 1 Plain | NCIt, Uberon or FMA definition (never Wikipedia, nor a definition that cites it), FMA hierarchy sentence, Claude draft from those | Matt reads it, fixes errors, confirms the analogy is not misleading | A second reader with biology background signs off |
| 2 Core | OpenStax A&P 2e (CC BY copy), Gray's 1918 (public domain), Claude draft citing those | Every mechanism sentence traceable to a cited section; named molecules checked against UniProt/HPA | Second reader + spot-check of 3 random claims |
| 3 Deep | Tier-2 sources plus at least one review article or primary paper (PubMed) | Two cited sources minimum; clinical claims from a textbook or guideline, not a blog | A teacher, mentor or clinician reviews the clinical paragraph |

Front matter per file: `id`, `tier`, `status`, `sources` (title, url, license), `reviewer`, `reviewed_on`, `license` (CC BY 4.0 for original text; otherwise the license of the reused definition: CC BY 4.0 for NCIt, CC BY 3.0 for Uberon and FMA). Style rules: lead with what the structure does; name the actual molecules, enzymes and cell types rather than "various proteins"; define a term the first time it appears at tier 1 and 2; no number without a source; never state a disease association at tier 1.

Review loop: `npm run review -- <id>` opens the node in the viewer with its three tiers side by side and the cited sources; a checklist (accurate, sourced, level-appropriate, attribution present) must be ticked before `status` can move. A monthly 5% random sample of `auto` nodes is read; if more than one in twenty is wrong, the drafting prompt is revised and the batch is regenerated.

## Quality standards

The site goes public when every row below passes at once; until then it stays on a private preview URL. Each gate is measured by a command, not a feeling, and the pipeline's `reports/coverage.md` plus a Lighthouse run are the two artifacts a release is judged on.

| Area | Gate for public v1 | How it is measured |
| --- | --- | --- |
| Accuracy | 100% of the curated 200 at `reviewed` or better; 0 open "factual error" issues; monthly 5% sample of `auto` nodes under 5% error | `12-validate.mjs` status counts; GitHub issue label; sample log in `reports/` |
| Coverage | Every organ-scale node has tier-1 text and at least one connection edge; at least 10 complete vertical slices organ → molecule | Coverage report |
| Attribution | Every content file and media record has `license` + `attribution`; About page lists every dataset in the licensing matrix | Validator fails the build otherwise |
| Performance | Desktop: first body on screen under 3 s on a 50 Mbps connection, orbit at 60 fps; mid-range phone (2022-class): under 8 s and 30 fps; no chunk over 25 MiB | Lighthouse + manual device run on two phones; `du` on `public/models` |
| Interaction | Tap-vs-drag, selection, search, isolate and explode pass `validate-interactions.mjs` on 390×844, 320×568, 844×390 | Existing script plus Playwright smoke test |
| Accessibility | Keyboard reaches every control and the structure list; panel text contrast ≥ 4.5:1; images have alt text | axe DevTools, zero serious violations |
| Resilience | Site works with WebGL disabled (text panel still browses the graph) and with content JSON missing (fallback to system description) | Manual test in both states |
| Reproducibility | `npm run pipeline && npm run build` from a clean clone reproduces `public/` byte-for-byte except timestamps | CI job on GitHub Actions |
| Privacy | No accounts, no analytics beyond a privacy-respecting page counter, no API key in the client bundle | `grep` of `dist/` for `sk-`; bundle review |

Each later phase adds rows (for example, a Mol\* panel must load an AlphaFold structure in under 2 s and fall back to a PDB id when the prediction is absent). A gate can be relaxed only by editing this section, with the reason noted.

## Phased plan

&#91;embedded content: Bio Map roadmap: 8 phases, 6 exit gates\]

Phases run in order and each ends at a measurable gate; the Phase 0 checklist below spells out the first one in full. Phases 1 and 2 are where the project becomes yours (text and connections), 3 to 5 add scales, and 6 is the only phase whose gate is every Quality-standards row at once.

## Phase 0 checklist — first Claude Code session

Goal of the session: your own deployed copy of Human Atlas, rebuilt from the raw BodyParts3D archive, with the explanation lookup already keyed by FMA id. Expect one to two evenings; nothing below needs an API key.

- [ ] Fork `ashemag/human-atlas` on GitHub into your account (keep it public; the MIT notice stays).
- [ ] `git clone` your fork; in it run `nvm use 22` (Node ≥ 22.13), `npm ci`, `npm run dev`, open `http://localhost:3016`, click a few structures.
- [ ] `npm run check && node scripts/validate-atlas.mjs && node scripts/validate-interactions.mjs && npm run build` — all green before you change anything.
- [ ] Import the fork into Vercel as a Vite project (the repo's `vercel.json` already sets `npm ci`, `npm run build`, `dist`), or into Cloudflare Pages with the same settings. Confirm the preview URL loads on your phone.
- [ ] Add `CLAUDE.md` at the repo root summarizing this spec: stack, the hook points table, the ID conventions, the licensing rule, and "never fetch external APIs at runtime".
- [ ] Create the folders `pipeline/`, `data/raw/`, `data/build/`, `graph/`, `content/`, `reports/`; add `data/` to `.gitignore`.
- [ ] Download `isa_BP3D_4.0_obj_99.zip` and the English metadata TSVs from the BodyParts3D download page into `data/raw/bp3d/`; record the archive checksums in `data/raw/bp3d/CHECKSUMS.txt`.
- [ ] Write `pipeline/01-build-maps.py` to produce `concepts.json` and `systems.json` (see Data pipeline step 2); diff its concept count against 3,432 and its part count against 2,234.
- [ ] Run `scripts/convert-anatomy.py`, `optimize-anatomy.mjs`, `compress-models.mjs`, then `validate-atlas.mjs`; the rebuilt `atlas.json` should match the shipped one in part and concept counts.
- [ ] Replace `explanation(name, system)` in `app/anatomy.ts` with `explanationFor(conceptId)` that reads `/content/<id>.json` and falls back to the system description; generate stub content files for the nine existing `EXPLANATIONS` entries so behavior is unchanged.
- [ ] Add URL hash sync in `app/page.tsx` (`choose()` writes `#FMA7088`; load reads it) so every structure has a shareable link.
- [ ] Parameterize the counts in `scripts/validate-atlas.mjs` (read them from `atlas.json`) so adding HRA parts later does not break validation.
- [ ] Commit, push, confirm the Vercel preview redeploys; tag `v0.0.1`.

Done when: your preview URL shows the rebuilt body, `#FMA7088` opens the heart, and `npm run check` is clean.

First time setting any of this up? The step-by-step version with exact clicks and commands is in Setup guide.

## Risks, gaps and open questions

The two risks most likely to decide whether v1 ships are content review throughput (200 curated nodes × 3 tiers is \~600 reviewed pieces) and the cell/organelle scale, which has no open 3D source and must be authored. Everything else is engineering with a known answer.

| Risk or gap | Why it matters | Mitigation |
| --- | --- | --- |
| Review throughput | 600 curated pieces at an honest pace is months of reading | Ship the 10 vertical slices first; mark the rest `auto`; recruit one second reader |
| No open 3D cell with organelles | The cell and organelle scales have nothing to click | Author one generic cell + 5 specialized variants in Blender (CC BY 4.0, our own); start with 2D diagrams if needed |
| Mesh quality | Some BodyParts3D phase-1 shapes are crude; Z-Anatomy's fixes are BY-SA | Accept for v1; swap individual meshes later with license tracked per part |
| Thin systems | Only 3 lymphatic, 4 endocrine, 6 urinary meshes in the male model | HRA organs supply interiors; add HRA lymph nodes and glands as extra parts |
| Female body | HRA female has partial skeleton and muscles | Offer female at organ scale first; label coverage honestly in the UI |
| Fade / peel in a merged-mesh renderer | Per-part transparency needs depth sorting the current shader lacks | Use dithered (screen-door) transparency in the fragment shader instead of alpha blending |
| Picking cost on phones | 2,234 raycasts behind a box prefilter; untested on real hardware | Measure in Phase 0; add `three-mesh-bvh` only if a tap takes over 100 ms |
| Definition coverage | Many FMA ids (sided, segmental and set concepts) have no NCIt or Uberon definition | Step 12 counts concepts by text source; hierarchy sentences and later LLM drafts fill the rest, flagged `auto` |
| OpenStax license drift | Current site pages say CC BY-NC-SA; older copies are CC BY | Pin the CC BY copy's commit/URL in the licensing matrix; NC-SA is acceptable anyway |
| Pinned Three.js ^0.159 | Upgrading can break the `onBeforeCompile` shader strings | Stay on 0.159 until Phase 3; test the shader after any bump |
| HRA GLB → manifest converter | Not in the repo; the female path was removed | Write `05-hra-to-manifest.mjs`; the optimizer's weld branch already exists |
| Bleeding-edge deps (Vite 8, React 19, `vinext`, RSC plugin) | A lockfile drift can break the build | Commit `package-lock.json`; CI builds on every push |
| "Comprehensive" has no edge | Scope creep | The curriculum spine (below) defines done; everything else is backlog |

Open questions:

- [ ] Curriculum spine: AP Biology units, OpenStax A&P 2e chapters, or both? This decides the curated-200 list.
- [ ] Male and female toggle in v1, or female added in Phase 3?
- [ ] Who is the second reader for tier 2 and tier 3 (a teacher, mentor or clinician)?
- [ ] AI tutor in v1 (needs a serverless function and a paid API key) or after public launch?
- [ ] Domain name and project name on the site ("Bio Map"?).
