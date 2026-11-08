# Archive

Converted assets kept in the repo but not deployed (only `public/` is deployed).

- `public/models/female/` — the HRA v2.5 united female body (948 meshes, gzip-only), converted by
  `pipeline/05-hra-to-manifest.mjs`. Its whole-body view is disabled (decided 2026-11-07): HRA models only
  some of the female organs and a complete open-data female body isn't available yet. Rebuild with
  `BIOMAP_FEMALE_BODY=1 node pipeline/05-hra-to-manifest.mjs united-female`, which writes here.
  To restore the view, move the folder back to `public/models/female/` and bring back the body toggle.
- `public/models/bodies.json` — per-system part counts for both bodies (the female coverage note).

Paths inside these manifests are the public ones (`/models/female/...`), so a move back needs no edits.
`graph/hra-models.json` marks the body `"archived": true`; steps 11 and 12 read and check it here.
