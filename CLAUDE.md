# Bio Map

A free, browser-based 3D human body you can click at every scale (body → system → organ → tissue → cell → organelle → molecule), with every structure explained at three depths (Plain / Core / Deep). Forked from the MIT-licensed [ashemag/human-atlas](https://github.com/ashemag/human-atlas); a knowledge graph is being added on top. The full spec is [docs/SPEC.md](docs/SPEC.md); read it before any non-trivial change.

## Stack

- React 19, Three.js `^0.159` (see Hard rules before upgrading), Tailwind 4, shadcn UI, meshoptimizer.
- Vite 8: root `web/`, public dir `public/`, alias `@` → repo root, output `dist/`.
- Node ≥ 22.13 (`nvm use 22`).
- Static hosting only (Vercel; Cloudflare Pages also works). `vercel.json`: `npm ci` → `npm run build` → `dist/`. No backend.

Commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3016 |
| `npm run check` | `tsc --noEmit` |
| `npm run build` | Production build to `dist/`; `prebuild` runs `pipeline/12-validate.mjs` first and fails on any content, graph or missing-file error |
| `npm run validate` | Graph, content and file validation (every file the app can request, including each model manifest's chunks, must exist under `public/`); rewrites `reports/coverage.md` |
| `npm run pipeline` | Every pipeline step from raw downloads to validated `public/` (network on first run; cached in `data/cache/` after) |
| `node scripts/validate-atlas.mjs` | Checks `public/models/atlas.json` and chunk buffers |
| `node scripts/validate-interactions.mjs` | Checks tap-vs-drag and layout contracts |

Run `npm run check && node scripts/validate-atlas.mjs && node scripts/validate-interactions.mjs && npm run build` before calling a change done.

Restart `npm run dev` (stop the running one first: with `strictPort` a second one exits with "Port 3016 is already in use" rather than starting on another port) after switching branches or re-running pipeline steps that rewrite `public/`. The dev server lists the files in `public/` at startup and keeps that list current from file-watcher events, which can miss a file that is deleted and recreated while it runs. It then answers that file with `index.html` (status 200), and the app reports "the server sent a web page instead of data" for it (JSON.parse's "Unexpected token '<'").

## Layout

- `app/` — the whole app (~55 KB of TypeScript). `components/`, `hooks/`, `lib/` are shadcn support.
- `scripts/` — existing Human Atlas geometry pipeline (convert, optimize, compress, validate).
- `public/models/` — male `atlas.json` + `body-0..14.bin(.gz)`; `organs/<hra-object>.json` + chunks (organ interiors, gzip-only, normalized onto the stage); `bodies.json` (per-system counts for the coverage note).
- `pipeline/` — numbered build steps, run in this order: 00 fetch BodyParts3D, 01 maps, geometry scripts, 04 fetch HRA v2.5, 06 ontology, 05 HRA → manifests, 07 tier-1 text, 08 histology and tissue units, 09 text sources (OpenStax CC BY copies with each chapter's key terms; Cell Ontology, FMA, Uberon, NCIt and GO definitions, one file per term, none that cites or mentions Wikipedia; NCI SEER Training Modules text, no graphics, under NCI's reuse policy, recorded in `maps/seer.json`, and the step stops if the policy page no longer says it; checks every morphology quote word for word), 10 figures (up to three 2D figures per structure, cell type and organelle from the sources in `maps/figure-sources.json`, matched only by the source's own id or exact title; checks each licence; a cell type's HPA image prefers a protein the ASCT+B tables list as its biomarker (the one most tables list first), joined by HGNC id through HGNC's REST records where the row's id and gene name agree; `sharp` makes the WebP files; Gray's Anatomy 1918 plates only for bones, muscles, vessels and nerves where no other source matches, with their fixed caption), 14 NeuroMorpho.Org reconstructions, 13 cells, 11 graph, 12 validate; `_http.py` is the cached, throttled fetcher every networked step must use. A download that fails after its retries raises `DownloadError` and stops the step with one clear line: never catch it to try another candidate, so a rerun never silently changes content. A 404 is remembered and raised as `NotFound`; catch that only where "not there" is the expected answer. `_cell-families.mjs` (shared by 13, 11 and 12) picks each cell type's 3D shape from `maps/cell-families.json`.
- `archive/` — converted assets kept but not deployed: the disabled female body (`archive/public/models/female/`); see `archive/README.md`.
- `data/` (gitignored) — raw downloads, `data/build/`, and `data/cache/<host>/` (every API response, gzip).
- `graph/` — `defs.jsonl` (ontology facts per concept), `edges.fma.jsonl` (all FMA is_a/part_of), `nodes.jsonl` + `edges.jsonl` (the graph: atlas concepts only), `sources.json` (ontology versions/licenses).
- `content/FMA_<n>/tier<k>.md` — curated text (never overwritten by the pipeline); `tier<k>.auto.md` — pipeline drafts. Front matter is one `key: <JSON value>` per line between `---` fences.
- `content/CL_<n>/morphology.md` — a cell type's morphology profile: claims (shape, size, nucleus, surface, granules, organelles, special structures, structure-and-job sentences), each quoting one sentence from OpenStax A&P 2e or Biology 2e (the CC BY copies step 09 pins) or the cell type's own Cell Ontology definition. Drafted by one AI agent and kept only if an independent AI agent passed it and the quote is in the source word for word; status `drafted` until a person reviews it. Failed claims are listed in `reports/morphology-check.md`.
- `public/content/<conceptId>.json` + `index.json` — generated by step 11; never edit by hand. `public/content/cells.json` (step 11) lists every cell type and organelle for search: Cell Ontology or GO label and exact synonyms, the model a cell type opens, the cell an organelle opens in (`pipeline/maps/organelles.json` names it for parts of a shared family model). `app/search.ts` matches and ranks search results (spelling variants, plurals, exact names first).
- `public/tissue/<organ>.json` — tissue boards (cell types by structure, the organ's figures and its other tissue unit illustrations; step 11); `public/ftu/` — HRA FTU SVGs (step 08); `public/figures/` — figures as WebP (at most 1400 px) plus 240 px thumbnails (step 10; at most 60 MB in all), recorded in `graph/figures.json` and attached by step 11 to content files (`figures`) and boards. `pipeline/maps/figures.json` is for a person to pin or block a figure (nothing writes to it automatically); `pipeline/maps/look-alike.json` lists cell types that look alike under a microscope, with the cited proteins that tell them apart, which every figure caption of theirs must carry (step 12); `public/models/cell/` — the 3D cells (step 13): neuron and glia reconstructions from NeuroMorpho.Org (`nmo-<id>`, picked and pinned in `pipeline/maps/neuromorpho.json` by step 14), the generic cell (the fallback), one model per cell family variant some cell type uses, chosen from its Cell Ontology ancestors by `pipeline/maps/cell-families.json`, and `profile-<cl>` models drawn from a morphology profile when it states something the family shape does not show. Precedence: reconstruction, then profile, then family (`pipeline/_cell-families.mjs`). A cell type without a nucleus must get a model without one, and a profile model must draw the surface features and special structures its profile states (step 12).
- `reports/` — `build-maps.md`, `ontology.md`, `coverage.md` (the quality gates read these), `morphology-check.md` (every morphology claim that failed its check, and why), `figures.md` (figure coverage, and every candidate not used, and why).

Bodies and interiors: one `AnatomyScene` per manifest. The female whole-body view is disabled (files and step 05 kept; `BIOMAP_FEMALE_BODY=1` rebuilds it); female organs open on their own stage from `public/models/organs/standalone.json` (`#organ/<hra-object>`), and so do the lymph node and palatine tonsils (the male HRA models; BodyParts3D has no mesh for them), in the group "Lymphatic organs". Step 11 builds that file from `pipeline/maps/standalone-organs.json`, and step 12 fails if any tissue board opens from nowhere. Every cell type also opens on its own stage, in the group "Cells" (`#organ/cell-<cl id>`, built from `cells.json` unless standalone.json lists it); an organelle opens selected in its cell (`#organ/cell-<cl id>/<GO id>`). A cell type's "Found in" connections carry `board`: the tissue board that lists it there and how to open it (`id`: a body concept, `organ`: an organ on its own stage). Zoom in mounts a second scene for the organ interior while the body scene stays mounted with `visibility: hidden`. Content files carry `ladder` (system, organ, interiors) and connections carry `alternates` so the UI can find a structure in whichever manifest is on screen. Plan: [docs/PHASE3-PLAN.md](docs/PHASE3-PLAN.md).

Boundary: the knowledge module (`graph/`, `content/`, `pipeline/`) must never import from the renderer (`app/scene.tsx`). The React UI owns `SceneState`; the engine renders it and reports taps.

## Hook points

| File | What it does | Bio Map hook |
| --- | --- | --- |
| `app/anatomy.ts` | Types (`Part`, `Concept`, `Atlas`, `SceneState`), 15 `SYSTEMS`, and `explanationFor(conceptId, system)`, which loads `public/content/<conceptId>.json` (cached; only ids listed in `public/content/index.json`) and falls back to the system description | Add `highlighted: string[]` and `level` to `SceneState`; read tiers 2–3 from the same content file |
| `app/page.tsx` | `Home`: loads atlas, system toggles/presets, search, `choose(concept)` / `choosePart(id)`, detail `Sheet`, About sheet | Detail sheet gets tiers, connection chips, media, Zoom in/out; `choose()` gets URL hash sync and breadcrumbs |
| `app/scene.tsx` | Three.js engine: one merged mesh per system; per-part state in `partTexture` (explode xyz + visible) and `selectionTexture` (r = selected) indexed by `partIndex`; shader injection via `onBeforeCompile`; picking; explode; isolate framing | `selectionTexture.g` = related-structure tint (amber), driven by `SceneState.highlighted` from the Connections panel. Still to do: per-part opacity (dithered, not alpha-blended); reuse isolate framing for Zoom-in; clipping plane via `renderer.clippingPlanes` |
| `app/agent-tools.ts` | WebMCP tools `find_anatomy`, `inspect_anatomical_structure` | Add `explain_structure(id, tier)` and `related(id, relation)` |
| `app/explosion-layout.ts`, `pointer-tap.ts`, `model-download.ts` | Explode packing, tap detection, gzip chunk decoding | Leave alone |
| `scripts/convert-anatomy.py` | BodyParts3D OBJ → chunks + `atlas.json`; needs `concepts.json` and `systems.json` (not in repo) | `pipeline/01-build-maps.py` produces those inputs |
| `scripts/optimize-anatomy.mjs` | meshoptimizer simplification; has a `female` weld branch for HRA | Reuse for HRA; only the GLB → manifest converter is missing |
| `scripts/validate-atlas.mjs` | Validates buffers, unique ids and concept → part links; counts come from `atlas.json` (`optimized.preservedMeshes`) | Safe to add HRA parts without edits |

`atlas.json`: `parts[]` = `{id: "FJ1252", name, conceptId: "FMA59763", system, chunk, positions, normals, indices, vertexCount, indexCount, bounds}`; `concepts[]` = `{id: "FMA3710", name, elements: [...]}`; `chunks[]` = `{url, bytes, gzip, gzipBytes}`. Part ids (`FJ…`) are BodyParts3D representation ids; concept ids are FMA ids and are the join key for the knowledge graph.

## ID conventions

Every graph node is keyed by a public ontology id; never invent an id when a public one exists.

| Prefix | Scale(s) | Source | Example |
| --- | --- | --- | --- |
| `FMA:` | body, system, organ, gross tissue | FMA / BodyParts3D `conceptId` | `FMA:7088` heart |
| `UBERON:` | organ, tissue | HRA 3D organs, ASCT+B | `UBERON:0000948` heart |
| `CL:` | cell | Cell Ontology | `CL:0000746` cardiac muscle cell |
| `GO:` | organelle | GO cellular component | `GO:0005739` mitochondrion |
| `HGNC:` | gene | ASCT+B biomarkers | `HGNC:TNNT2` |
| `UniProt:` | protein | UniProt ID mapping | `UniProt:P45379` |
| `CHEBI:` | small molecule | ChEBI | `CHEBI:16236` ethanol |
| `BIOMAP:` | anything with no public id | this repo | `BIOMAP:cell-generic-v1` |

- In the graph the id has a colon (`FMA:7088`); in `atlas.json` `conceptId` it has none (`FMA7088`); in URLs it is the hash `/#FMA7088`; source content folders use an underscore (`content/FMA_7088/`); served per-node JSON uses the atlas form (`public/content/FMA7088.json`, listed in `public/content/index.json`).
- Enums: `scale` ∈ body, system, organ, tissue, cell, organelle, molecule. Content `status` ∈ missing, auto, drafted, reviewed, verified (UI shows "unreviewed" for auto and drafted). `tier` ∈ 1, 2, 3.

## Licensing rule

- Every content file and every media record carries `license` and `attribution` fields. The About page and each detail panel render credits from those fields, never from hand-written text. The validator fails the build if either is missing.
- No Wikipedia text anywhere, including ontology definitions whose provenance cites Wikipedia. Original text is CC BY 4.0; reused definitions keep their source license (NCIt CC BY 4.0; Uberon, FMA CC BY 3.0). Human Protein Atlas 25.1 images are CC BY 4.0 (each credited with a link to the exact image). Geometry (BodyParts3D, HRA) is CC BY 4.0.
- Use OpenStax A&P 2e only from a CC BY copy (2022 PDF or GitHub `osbooks-anatomy-physiology`), keeping its "Access for free at…" line.
- Dataset credits live in [public/ATTRIBUTION.md](public/ATTRIBUTION.md). Whenever a new dataset is added (pipeline download, geometry, images, text source), add its credit there in the same change: name, license and link, citation, and what was adapted.
- Do not add Z-Anatomy or any BY-SA geometry without an explicit decision.
- Keep the MIT `LICENSE` from Human Atlas.

## Hard rules

- Always install with `npm ci`, never `npm install`, so `package-lock.json` stays pinned. Change dependencies only on purpose and commit the lockfile with that change.
- Don't upgrade three.js past 0.159 without testing: `app/scene.tsx` patches Three's built-in shader strings via `onBeforeCompile`, and a version bump can silently break part hiding, explode offsets or selection tint. After any bump, check select, isolate, explode and system toggles in the running app.
- Never fetch external APIs at runtime. All data is fetched and cached by `pipeline/` scripts at build time; the browser only loads files from `public/`.
- No API keys in the client bundle; no accounts; no analytics beyond a privacy-respecting page counter.
- `data/` is gitignored (raw downloads and intermediate builds). Pipeline steps must be reproducible from a clean clone.
- Downloaded archives are untrusted: extract into their own directory and run Python that reads them with `-I`.
- Browser tests use only a headless browser with its own temporary profile (for example Chrome started with `--headless=new --user-data-dir=<a new temporary directory>` and driven over the DevTools protocol), deleted afterwards. Never open the user's normal Chrome profile, never modify or install anything in /Applications, and stop and ask if a test needs either.
