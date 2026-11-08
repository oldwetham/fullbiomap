# Phase 3 plan: female body and organ interiors

Nov 7, 2026 · for approval before any code is written

Phase 3 adds the HRA female reference body beside the BodyParts3D male, per-organ interior models that load only when you zoom into an organ, and the scale ladder (Zoom in / Zoom out and a Body › System › Organ › Part breadcrumb). The recommended design needs **no changes to `app/scene.tsx`**: the existing engine renders the male body, the female body, or one organ's interior, depending on which manifest it is given. Four decisions are marked **Decision** below.

## 1. Data: what we download, pinned to HRA v2.5

Everything comes from Human Reference Atlas release **v2.5** (latest; its `digital-objects.yaml` pins each object's version), CC BY 4.0, via `cdn.humanatlas.io`.

| Object | Version in v2.5 | Size | Use |
| --- | --- | --- | --- |
| `united-female` (`3d-vh-f-united.glb` + `crosswalk.csv`, 874 named nodes) | v1.10 | 375 MB | The female body |
| 74 per-organ GLBs (33 male, 41 female) + one `crosswalk.csv` each | v1.0–v1.5 | 492 MB | Organ interiors |
| `asct-b-3d-models-crosswalk.csv` | v1.10 | 0.3 MB | Organ-level ontology ids across all 3D objects |

Left out: `united-male` (the male body stays BodyParts3D), `skin-*` and `adipose-*` (body-wide layers, not organs you zoom into), `blood-vasculature-*` (the vessel tree is already in both bodies), and `placenta-full-term-female` (pregnancy reference).

`pipeline/04-fetch-hra.py` downloads these into `data/raw/hra/v2.5/` through the existing cached, throttled fetcher (each file once; reruns fetch nothing) and records SHA-256 checksums in `pipeline/checksums/hra.sha256`, next to the pinned Blood Vasculature table from Phase 2. The release number and each object's version come from the v2.5 `digital-objects.yaml`, saved with the checksums so the pin is visible in git.

What the files look like (checked on the heart and left kidney): plain GLB with no Draco/meshopt compression and no node transforms; attributes `POSITION`, `NORMAL` (sometimes `COLOR_0`) and 16-bit indices; meters, Y-up. Groups nest meshes, e.g. `VH_M_heart › VH_M_cardiac_chamber › VH_M_heart_left_ventricle`. HRA and our converted BodyParts3D use the **same axes** (+x = body left, +z = anterior, Y-up) and organs of nearly the same size; only the origin differs (the HRA heart sits 0.83 m lower). In-place placement is therefore possible later without any rotation.

## 2. Conversion: `pipeline/05-hra-to-manifest.mjs`

A small GLB reader (JSON chunk + binary buffer + accessors, applying node matrices if any appear) turns each GLB into the existing part/chunk manifest, then hands it to the existing optimizer's weld path.

- **Parts** are mesh nodes. Ids: `female-<node_name>` for the body, `organ-<object>-<node_name>` for interiors (spec step 5).
- **Concepts** come from the object's crosswalk: each ontology id becomes a concept whose `elements` are every mesh under the nodes mapped to it, so a group like `VH_F_heart` selects the whole heart. **Decision 1:** `conceptId` is the Uberon id when HRA gives one (546 of the 874 female nodes) and HRA's own FMA id otherwise (328 nodes, e.g. `FMA:57991` left mammary gland). Forcing every id to Uberon would drop the 328 that have no Uberon term. Format matches today's: `UBERON0002113`, `FMA57991`.
- **Systems** (the 15 display systems): if the concept maps to one of our male concepts (same FMA id, or a unique Uberon → FMA xref from Phase 1), it takes that concept's system. Otherwise it takes its organ's system from a small hand-edited table, `pipeline/maps/hra-organ-systems.json` (heart → cardiac, kidney → urinary, ...), with a reason per entry. No keyword matching, so none of the old "ventricle" → cardiac bugs.
- **Coordinates.** The female body is translated so its feet rest on the stage, like the male. Each interior is normalized onto the same stage: centered, base on the platform, and scaled so its largest dimension is about 1.4 m. The engine's existing body framing then frames an organ exactly as it frames a body, and the UI labels the scale ("about ×13 life size").
- **Optimizer and compressor.** `scripts/optimize-anatomy.mjs` currently picks its weld path and chunk prefix from whether the file name contains "female", and would write organ chunks as `body-*.bin` over the male chunks. It will take the prefix from the manifest's own path, weld whenever `source` is HRA, and keep its 0.2% error bound. `compress-models.mjs` will compress every manifest, not only `atlas.json`. `validate-atlas.mjs` already takes a file name and reads counts from the manifest.
- **Output layout:** `public/models/female/atlas.json` + chunks, and `public/models/organs/<object>.json` + chunks. The male files do not move.
- **Size. Decision 2:** the HRA geometry ships as `.gz` chunks only, with no raw `.bin` beside them. That roughly halves the repo growth; I'll measure it during conversion and report it. The cost is that the female body and interiors need `DecompressionStream` (Chrome 80+, Safari 16.4+, Firefox 113+). Older browsers keep the male body and see "Not supported in this browser" on the toggle and Zoom in. The male body keeps its raw-chunk fallback. The 25 MiB per-chunk limit holds, since chunks stay at about 4 MB.

## 3. Male and female in one viewer

- `page.tsx` gets `body: 'male' | 'female'` and loads `/models/atlas.json` or `/models/female/atlas.json`. `AnatomyScene` is keyed by the manifest, so switching unmounts one body and mounts the other: one WebGL context, nothing kept twice in GPU memory. Switching back re-reads chunks from the browser's HTTP cache.
- The toggle sits in the top bar ("Male | Female"). The choice persists per viewer (`localStorage`, guarded like the depth toggle) and appears in the URL (section 6).
- **Honest coverage.** The layers panel shows each body's own per-system part counts, already computed from the loaded manifest. When Female is on, a note under the title reads: "HRA female reference: organs, vessels and nerves in detail; skeleton and muscles partial (N bones and M muscles, vs X and Y in the male)", with the numbers filled from the two manifests at build time. Systems with no female parts are hidden from the list rather than shown empty. The About panel says the same.
- **Content for female structures.** Step 11 writes a node and a `public/content/<conceptId>.json` for every female concept and interior concept:
  - If the id maps to one of our male concepts (same FMA id, or a unique Uberon xref), the node is an alias. It reuses that concept's tier text, sources and connections, records `equivalent: "FMA:7088"`, and a Connections chip whose structure also exists in the current body selects it there; otherwise the chip becomes a label.
  - Otherwise it is a new `UBERON:` (or `FMA:`) node with tier-1 text by the Phase 1 rules: NCIt definition (via the Uberon term's NCIT xref, fetched and cached), then a Uberon definition that doesn't cite Wikipedia (already in the Phase 1 Uberon scan), then a generated sentence from the HRA node tree ("Renal papilla is part of the renal medulla."; source HRA, CC BY 4.0).
  - `part_of` edges from the HRA trees join these nodes (source HRA, CC BY 4.0).
  - The validator requires tier-1 text and a source on every one of them, and no dangling edges.

## 4. Organ interiors that load only when you zoom in

**Decision 3 (recommended): an organ stage.** Zoom in on an organ that has an interior model, and the viewer swaps to that organ's manifest (a few hundred KB to a few MB of `.gz`). The body scene stays mounted underneath with `visibility: hidden` (rendering only when dirty, so it costs almost nothing), so Zoom out back to the body is instant. On the stage, everything already built works unchanged: click a part to select it, hover names, explode, isolate, search within the organ, the Connections tint and depth toggle. Nothing about interiors is fetched until you zoom in, and each stage is cached for the rest of the visit.

*Alternative: in place.* Draw the interior where the organ sits in the body, neighbors faded. This needs `scene.tsx` to accept extra geometry after load, resize its per-part textures and fade neighbors (dithered transparency, the spec's later "peel" work). Since the axes already match, it can replace the stage later without touching the data. I'd hold it until peel/opacity is built.

**Which organs get interiors:** an organ GLB is attached to a structure when its root node's ontology id maps to a concept in that body. In male, that means via Uberon → FMA to our BodyParts3D concept, e.g. `heart-male` → FMA:7088. In female, to the female concept with the same id. The resulting node gets `geometry.interior: {male: "/models/organs/heart-male.json", female: "/models/organs/heart-female.json"}`, as in the spec's node record. Expected: about 30 male and 35 female organs (heart, kidneys, liver, lungs, brain, eyes, spleen, pancreas, intestines, bladder, ureters, trachea, bronchi, larynx, thymus, spinal cord, tonsils, prostate; uterus, ovaries, fallopian tubes, mammary glands in female). The final list goes in `reports/hra.md` and in my end-of-phase summary.

## 5. Scale ladder: Zoom in / Zoom out and the breadcrumb

Step 11 adds `ladder: {system, organ: {id, conceptId, label} | null, isOrgan, interior}` to every node. "Organ" means FMA's Organ class, which includes each bone, muscle and named vessel. A part's organ is the nearest organ found by walking up `part_of` (fetching any missing FMA terms through the cache); HRA interior parts use the GLB they came from.

| Where you are | Breadcrumb | Zoom in | Zoom out |
| --- | --- | --- | --- |
| Body, nothing selected | **Body** | disabled ("Select a structure") | disabled |
| One system shown | Body › **Muscles** | disabled until something is selected | Body: default systems back |
| Organ selected in the body | Body › Cardiovascular › **Heart** | organ stage if it has an interior, otherwise isolate the organ (today's Isolate) | System: only the organ's system shown, selection kept |
| Part selected in the body (e.g. wall of left ventricle) | Body › … › Heart › **Wall of left ventricle** | its organ's stage, if any | its organ selected |
| Organ stage, nothing selected | Body › … › **Heart (inside)** | disabled | Body, with the heart selected |
| Organ stage, part selected | Body › … › Heart › **Left ventricle** | disabled (tissue scale is Phase 4) | the whole organ in the stage |

- The System crumb uses a ladder name per display system, because the display system for the heart is itself called "Heart": cardiac → Cardiovascular, arterial → Arteries, venous → Veins, the rest unchanged. So it reads Body › Cardiovascular › Heart, not Body › Heart › Heart.
- Breadcrumb items are buttons: each jumps to that level. The trail sits above the panel title, and also above the scene when the panel is closed.
- Zoom in / Zoom out are buttons in the detail panel's action area, next to Isolate. `+` / `-` on the keyboard work when focus isn't in a text field.
- Every disabled state says why in its tooltip.

## 6. Deep links

| URL | Opens |
| --- | --- |
| `#FMA7088` | Male body, heart (unchanged) |
| `#female/UBERON0000948` | Female body, heart |
| `#FMA7088/inside` | Male heart stage |
| `#female/UBERON0000948/inside/UBERON0002084` | Female heart stage, left ventricle selected |

Every Phase 0–2 link keeps working, and browser back/forward walks the ladder, since each step pushes history.

## 7. What changes, file by file

| File | Change |
| --- | --- |
| `pipeline/04-fetch-hra.py` | v2.5 objects above, pinned, checksummed |
| `pipeline/05-hra-to-manifest.mjs` (new) | GLB → manifests; concepts from crosswalks; systems; stage normalization; runs optimizer and compressor |
| `pipeline/maps/hra-organ-systems.json` (new) | Organ → display system, with reasons |
| `pipeline/06-ontology.py` | NCIt for new Uberon ids; FMA terms on `part_of` chains, for the ladder (cached) |
| `pipeline/07-tier1.py` | Tier-1 text for new HRA nodes (rules above) |
| `pipeline/11-build-graph.mjs`, `12-validate.mjs` | HRA nodes and aliases, `ladder`, `geometry.female` / `interior`, HRA `part_of` edges; validation of all of it, plus every interior manifest |
| `scripts/optimize-anatomy.mjs`, `compress-models.mjs` | Prefix from path, HRA weld, all manifests (section 2) |
| `app/anatomy.ts` | `Body`, `Ladder` types; hash parsing helpers |
| `app/page.tsx`, `app/globals.css` | Body toggle and coverage note, organ stage (second `AnatomyScene`), breadcrumb, Zoom buttons, new hash format, About credits |
| `app/scene.tsx` | **No change** under Decision 3 |
| `public/ATTRIBUTION.md` | HRA v2.5 3D reference objects (citation, DOI, license, adaptations), replacing the "historical assets" note |
| `package.json` | `npm run pipeline` gains step 05 |

## 8. Order of work after approval (check, commit, continue)

1. Step 04: fetch and pin v2.5. Commit.
2. Optimizer/compressor generalization, checked by re-running the male rebuild and confirming its chunks stay byte-identical. Commit.
3. Step 05: female body and organ manifests, with `validate-atlas` on each and the size report. Commit.
4. Graph and content for HRA nodes, ladder, interiors. Validate. Commit.
5. UI: body toggle and coverage note. Commit.
6. UI: organ stage, breadcrumb, Zoom buttons, deep links. Commit.
7. Credits in ATTRIBUTION.md and About. Commit.

I stop if a check keeps failing or a decision falls outside this plan and the spec.

## 9. Risks and open questions

- **Decision 4: repo and deploy size.** Under Decision 2, I expect about 100–180 MB of new `.gz` in git (measured in step 3), on top of today's 93 MB of models. I'll check it against Vercel's deployment limits before committing the assets. If it's too large, the spec's fallback is Cloudflare R2 for the HRA assets, which needs your account, so I'd stop and ask then.
- **Female load time on phones.** The female body is roughly 1.5–3× the male's triangle count before simplification. If its compressed download breaks the spec's phone gate (8 s), I'll report the number and offer a coarser simplification for it rather than change the gate.
- **Female skeleton and muscles are partial** (roughly 117 bone-like and 30 muscle-like nodes, judging by node names, against 296 and 402 male meshes; exact counts after conversion). Section 3 labels this; it's a property of the HRA data.
- **Alias quality.** A Uberon → FMA alias reuses male text, which fits sex-neutral structures. Sex-specific organs (uterus, ovaries, mammary glands) have no male concept, so they get their own nodes and text.
- **Stage scale.** A magnified organ on the body's platform is a clear metaphor, but it isn't anatomical scale. The "about ×N life size" label covers that until the in-place view exists.
