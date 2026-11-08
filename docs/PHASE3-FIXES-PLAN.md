# Phase 3 fixes plan: male lung surfaces and the female body outline

Nov 7, 2026 · for approval before any change to `app/scene.tsx`

Two fixes on `phase-3`. The lung surfaces need a small change to `app/scene.tsx` (section A.4). The female outline needs no engine change. Three decisions are marked **Decision**.

## Two corrections first

- **The female skin is already downloaded and converted.** I skipped HRA's separate `skin-female` object, but the united female body (v1.10) contains its own whole-body skin mesh, `VH_F_skin` ("skin of body", UBERON:0002097). It is already in `public/models/female/atlas.json` under Body surface, with 19 breast and fat meshes. It is invisible because Body surface is off by default in both bodies; that is the 928 of 948 in your screenshot. No new download is needed.
- **The organ interiors were not aligned to the body.** Step 05 normalizes each one onto the stage: centered, then scaled so its largest side is 1.4 m. Putting lung lobes inside the male body needs a real registration, described below. It is new work, and I've measured how well it fits.

## A. Male lung surfaces

### A.1 What we have
- BodyParts3D right lung (FMA7309) is 156 meshes: 53 bronchial tree, 54 artery, 49 vein. Left lung (FMA7310) is 124. Neither has a lung surface. The five lobe concepts exist (upper, middle and lower lobe of the right lung: FMA7333, FMA7383, FMA7337; upper and lower lobe of the left lung: FMA7370, FMA7371), each made of airways and vessels.
- HRA `lung-male` v1.4, already downloaded and pinned, has five lobe surfaces (25 meshes, about 18,000 triangles). It also has its own bronchial tree, which I use only for alignment, and two hilum meshes, which I leave out.

### A.2 Fitting HRA lobes to the BodyParts3D body
The two bodies share axes (meters, Y-up, +x = body left, +z = front). The fit is a scale and translation per axis, no rotation:

1. Match the bounding box of HRA's bronchial tree (both sides together) to BodyParts3D's bronchial trees (FMA7309 + FMA7310 airways).
2. Clamp the width (x) and depth (z) scales so the lobes stay inside the rib cage: 1.2 cm inside the outer bounds of the 24 ribs, re-centered if needed.

Measured result:

| | x (width) | y (height) | z (depth) |
| --- | --- | --- | --- |
| Scale | ×0.959 | ×1.288 | ×0.896 |
| Translation (m) | −0.005 | +0.665 | −0.002 |
| Bronchial-tree center offset after fit, right / left | −0.2 / −0.7 cm | −0.1 / 0.0 cm | −0.7 / −1.0 cm |

The shell spans x −0.125 to 0.124, y 1.162 to 1.457, z −0.084 to 0.086. That is inside the ribs, except the apex, which sits 0.8 cm above the top of the ribs' inner bounds, as real lung apices do.

**Decision 1, the fit.**
- **Per-axis (recommended).** The lobes sit inside the ribs and around our airways, but they come out about 34% taller relative to their width than in HRA's model. The BodyParts3D chest is taller and narrower than the Visible Human male's.
- **Uniform (×1.148).** HRA's exact lobe shape, but the shell pokes 1.5–2.2 cm through the ribs at the sides and front, which would show through the see-through shell and the bones.

### A.3 Pipeline and data
- A "male lung surfaces" job in `pipeline/05-hra-to-manifest.mjs` reads the five lobe groups and applies the fit. It welds and simplifies them with the same settings as everything else, then appends 25 parts to the **male** manifest `public/models/atlas.json`, in one new chunk (`body-15.bin` + `.gz`, under 1 MB; the male body keeps its raw-chunk fallback).
- Parts are `shell-<HRA node name>`, system `respiratory`, `layer: "shell"`, named "Upper lobe of right lung (surface)" and so on. Their `conceptId` is the lung (FMA7309 / FMA7310), so a click selects the whole lung. Their ids are added to the lung concepts and to the matching lobe concepts, so "upper lobe of right lung" also shows its own surface.
- The job is idempotent: it removes any earlier shell parts before appending. The manifest records the source (HRA v2.5 lung-male v1.4) and the fitted transform, so the numbers above are visible in git.
- `validate-atlas.mjs` counts the BodyParts3D meshes separately from layer parts, because its "optimizer kept every mesh" check refers only to the original 2,234.
- The graph needs no new nodes. FMA7309, FMA7310 and the lobe nodes simply gain the surface parts in `geometry.male`.
- Credits: `public/ATTRIBUTION.md` and the About panel name HRA lung-male v1.4 as the source of the male lung surfaces, and describe the fit.

### A.4 `app/scene.tsx` change (needs your approval)
About 10 lines, all inside existing code paths; the shader is unchanged.

1. **Translucent shell material.** Parts with `layer: "shell"` are merged into their own mesh per system, using a translucent copy of that system's material: same color, opacity 0.22 (the skin uses 0.1), `depthWrite: false`, double-sided. It is built through the same `materialFor` function, so it has the same shader injection: hiding, explode, selection tint and related tint all work unchanged. It gets `renderOrder = 1` so it draws after opaque meshes and the airways show through it.
2. **Picking.** Today the skin is skipped by taps whenever solid parts are visible. That rule stays for the skin, but shells are pickable, so a tap on the lung hits the shell first and selects the lung.
3. **Decision 2, taps on airways inside a selected lung.** I recommend that when a shell is part of the current selection, taps skip shells, so you can then click a bronchus inside the lung you've selected. Without this, the airways inside a lung are reachable only from the panel's "Included structures" list or from search.

Nothing else in the engine changes: textures, layout, framing and disposal stay as they are.

Outside the engine:
- `app/anatomy.ts`: `Part` gains `layer?: 'shell'`.
- `app/page.tsx`: a tap on a shell part selects its concept (the whole lung: surface, airways and vessels) rather than the single mesh.

### A.5 What you get
- Clicking a lung anywhere on its surface selects the right or left lung. The selection tints the shell and every airway and vessel of that lung, and the panel shows the lung's text.
- Searching "lung" lists right lung and left lung, and both now include the shell. The **Organs** preset (Heart, Respiratory, Digestive, Urinary, Endocrine, Reproductive) shows the shells, because they are in the respiratory system.
- Hovering in the exploded view names the lobe.
- *Optional (not in this change):* also attach the HRA lung interior to each lung, so Zoom in works from a lung, not only from "Respiratory system". It's one line in step 11; say if you want it.

## B. Female body outline

- Show Body surface by default in the **female** body only. The skin uses the same translucent material as the male skin (opacity 0.1, never blocking taps on organs). The note about the partial skeleton and muscles stays, and no male bones are added.
- Default visible pieces go from 928 to 948.
- I checked the placement: the skin's bounding box equals the whole female body's (x ±0.48 m with arms out, y 0 to 1.66 m, z ±0.16 m), and the skin node's transform is applied by the converter. The browser check below confirms it visually.
- **Decision 3, what else turns on.** Body surface in the female body also contains the breast tissues (mammary lobes, ducts, areolae, fat) and three small patches of abdominal fat. They would appear faintly inside the skin.
  - **Leave them under Body surface (recommended).** HRA groups them with the integument, and translucent they read as breast anatomy.
  - **Move the breast tissues to Reproductive.** The skin would then be alone in Body surface, but the breasts would be opaque and visible by default.

  The male default stays off either way, since its muscles already give an outline. Tell me if you want male skin on by default too.
- No `app/scene.tsx` change: this is the default visible list per body in `app/page.tsx`, plus the same in the Body reset.

## C. Order of work after approval (check, commit, continue)

1. Lung fit and shell job in step 05; male manifest and validator update; graph rebuild; validation. Commit.
2. `app/scene.tsx` (A.4), `anatomy.ts`, and the page's tap rule. Typecheck, both validators, build. Commit.
3. Female default outline. Commit.
4. Credits in ATTRIBUTION.md and About. Commit.

Every committed file stays under 50 MB; the only new binary is the under-1 MB lung chunk.

## D. Browser checks after the change

1. **Male body.** The lungs read as translucent lung shapes inside the ribs, with airways visible through them. Clicking a lung selects it, and the shell and all its airways tint. With Decision 2, a second click inside reaches a bronchus.
2. **Organs preset and search.** The Organs preset shows the shells. Searching "lung" and choosing right lung lands on the shell.
3. **Female body.** On first load, a faint skin outline surrounds the organs and legs, and clicking organs through it still works. The partial-skeleton note is still there.
