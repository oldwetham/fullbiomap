# Figures plan: up to three 2D figures per structure, cell type and organelle

Goal: a Figures strip in the detail panel and on tissue boards, with up to three 2D figures per structure, cell type or organelle. Each figure opens full size on click, with its source, licence and a link to the original. Prefer one real micrograph plus one labeled diagram. Figures come only from the six sources below, are matched automatically only by the source's own id or exact title, and are marked unreviewed. Where a match is doubtful, there is no figure.

This plan needs your approval before any code or downloads. Four decisions are marked **Decision**.

## 1. What changes in the viewer

- **Detail panel.** Under the explanation, a strip of up to three thumbnails (about 96 px tall) for the selected structure, cell type or organelle. Each thumbnail shows a one-word kind label ("Micrograph", "Diagram", "Illustration") and an Unreviewed badge.
- **Tissue board.** The board's existing histology image and tissue-unit illustration move into the same strip, which can hold up to three figures for the organ. Nothing about the board's cell list changes.
- **Full-size viewer.** Clicking a thumbnail opens it full size in an overlay, like today's tissue-unit viewer: Esc and the close button dismiss it, focus is trapped, arrow keys step through the strip. Under the image: the caption, the source name, the licence (linked), the credit line, and "View the original" linking to the exact page.
- **Look-alike cell types.** For cell types that look alike under a light microscope (section 4), every figure caption says so and names the surface proteins that tell them apart.
- **No runtime fetching.** All images are fetched and cached by the pipeline and served from `public/figures/`, as with everything else.

## 2. Sources and their licences (each checked on its own site, Nov 8 2026)

| Source | Licence, as the source states it | What we would use | Credit line |
| --- | --- | --- | --- |
| Human Protein Atlas 25.1 | proteinatlas.org/about/licence: "licensed under the Creative Commons Attribution 4.0 International License", "for all copyrightable parts of our database". It asks that content is "never displayed in the absence of such citation", with a link to the specific item at v25.proteinatlas.org. Some third-party data have other terms; we use only HPA's own images. | Micrographs: tissue immunohistochemistry (organs, cell types) and subcellular immunofluorescence (organelles). | "Image from the Human Protein Atlas 25.1 (proteinatlas.org): ⟨gene⟩ in ⟨tissue⟩, ⟨link to the image⟩. CC BY 4.0." (the form step 08 already uses) |
| HRA illustrations (2D FTUs) | Each illustration's record in HRA's own knowledge graph (lod.humanatlas.io, cached by step 04) lists `"license": "https://creativecommons.org/licenses/by/4.0/"`. | Labeled diagrams: the 27 tissue-unit illustrations we already ship, with the cell type highlighted. | The record's own citation, e.g. "Bajema, Rachel. 2026. Mouth, Parotid Gland Ducto-Acinar 2D FTU v.1.2. https://doi.org/10.48539/HBM944.MMNZ.835", then "HuBMAP Human Reference Atlas v2.5, CC BY 4.0." |
| Servier Medical Art | smart.servier.com: "Servier Medical Art is licensed under" CC BY 4.0, which "allows reusers to distribute, remix, adapt, and build upon the material… even for commercial purposes". | Illustrations of cells and organelles. | Their wording: "Image(s) provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)." If we crop or label one, it starts with "Adapted from Servier Medical Art". |
| NIH BioArt Source (NIAID) | bioart.niaid.nih.gov/terms: content is "free for any use", but "Please review the license associated with the specific entry". Entries carry their own licence field: entry 100, for example, says "Public Domain", credited "Courtesy of NIAID". | Illustrations, only from entries whose own licence field says Public Domain or CC BY. Anything else is skipped and reported. | Their wording, under the image: "Illustration from NIAID NIH BioArt Source (bioart.niaid.nih.gov/bioart/###)", plus the entry's licence and credit. |
| OpenStax Anatomy and Physiology 2e | Only the copy published under CC BY. In the repository the LICENSE file changed to CC BY-NC-SA on 2026-03-19 and the book's own metadata on 2026-04-23, so step 09 now pins commit `b0058a74` (2026-03-11), where both say CC BY 4.0. See the note below. | Labeled diagrams; very few micrographs (below). Images come from the same pinned commit's `media/` folder. | The book's citation, "Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction", and the figure's own credit when it has one. |
| Gray's Anatomy, 1918 (20th US edition, Lea & Febiger, ed. W. H. Lewis) | No licence statement on any host I could reach. The Internet Archive item (archive.org/details/anatomyofhumanbo1918gray) has a scan with page images but no rights statement. Bartleby refused automated access (HTTP 403), so I could not read its terms. The book is in the US public domain by date: published 1918. | Labeled plates for organs, cropped from the page images, with the plate's own number and legend. | "Gray H. Anatomy of the Human Body, 20th ed., ed. Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. ⟨n⟩. Public domain in the United States." |

**OpenStax figures: every caption is checked whole, not just its credit line.** In the pinned A&P copy, 720 figures sit in the text and 672 have captions. Of those:
- 537 carry no third-party credit. They are OpenStax's own work under CC BY 4.0 and are usable.
- 61 carry third-party rights and are excluded. Almost all are micrographs "provided by the Regents of University of Michigan Medical School © 2012"; 59 of the 63 captions that mention a micrograph are of this kind, usually without the word "credit".
- 69 credit someone else, often a Flickr photographer. Each is used only if its own source page shows a CC BY or public-domain licence; otherwise it is skipped.
- 5 credit US government agencies (public domain).

So OpenStax gives labeled diagrams, and the real micrographs come almost entirely from HPA.

**Note on the cells commit.** While checking OpenStax for this plan, I found that the repository LICENSE changed to CC BY-NC-SA five weeks before the book metadata did. Step 09 had pinned commits between the two dates. I re-pinned both books to the last commits before the LICENSE change: A&P `b0058a74`, Biology `d2779c2e`. Step 09 now requires CC BY 4.0 in both the LICENSE and the metadata, and every one of the 605 profile quotes was re-verified word for word against those copies. This is in commit `eec28054`.

**Decision 1: Gray's host and scope.**
- Recommendation: crop plates from the Internet Archive scan, credit them as US public domain, and record the page and figure number for each.
- The catch: outside the US the term follows the authors' lives. Gray died in 1861 and Carter in 1897, but Lewis, the 1918 editor, died in 1964. A plate he added could still be in copyright where the term is life + 70 years (until 2034).
- Options:
  - accept US public-domain status (the usual practice);
  - use only plates that also appear in editions before Lewis's (1901 or earlier), which I can check plate by plate against an earlier scan;
  - leave Gray's out of the first pass.

## 3. How a figure is matched

Only exact matches, made automatically and marked unreviewed. A figure that does not match exactly is not shown.

| Source | Matched by | Example |
| --- | --- | --- |
| HPA subcellular | The GO id HPA gives each subcellular location equals the organelle's GO id. To confirm at the start: older HPA downloads carried a "GO id" column; if 25.1 lacks it, organelles use exact location names instead. | "Mitochondria" (GO:0005739) gets an immunofluorescence image of a protein HPA locates only there, reliability Enhanced |
| HPA tissue | Organ: the organ's own HPA tissue name, as step 08 already maps them. Cell type: HPA's cell-type annotation in that tissue equals our label (Decision 2). | Testis, then "Leydig cells" for the Leydig cell |
| HRA FTUs | The crosswalk's Cell Ontology id equals the cell type's id; the organ's Uberon id for organs. Already exact. | Kidney nephron illustration, podocyte highlighted |
| Servier | Exact title equals our label or a Cell Ontology / GO exact synonym. | "Neutrophil" |
| NIH BioArt | Exact entry title, and only entries with an allowed licence field. | |
| OpenStax | Exact figure title (719 of 720 figures have one) equals our label. | "Gallbladder", "Golgi Apparatus", "Cell Membrane" |
| Gray's | Exact plate legend equals our label (rare; mostly organs). | |

- **Choosing up to three.** One micrograph first (HPA), then one labeled diagram (HRA, OpenStax or Gray's), then one illustration (Servier or BioArt) if there is room. Within a kind, a match by id beats a match by title.
- **Organelles** use the generic cell's organelle node, so a figure for "Mitochondria" shows wherever mitochondria are selected.
- **Coverage, estimated.** For the first-pass targets (section 5), exact OpenStax titles match 13 of 140 (pancreas, spleen, stomach, gallbladder, trachea, cell membrane, Golgi apparatus and others).
  - HPA should cover all 30 organs and most organelles. The HRA crosswalk covers cell types in the 27 tissue units.
  - Many cell types will get no figure. I will report how many structures end up with 0, 1, 2 or 3 figures.
- **A reviewed map for later.** `pipeline/maps/figures.json` will let a person pin or block a figure for a structure. Pinned figures show as reviewed; nothing goes in it automatically.

**Decision 2: how exact is "exact" for titles?**
- Recommendation: case-insensitive equality, ignoring a final plural "s", so that "Leydig cells" matches "Leydig cell" and "Podocytes" matches "Podocyte". This adds 5 OpenStax matches.
- The alternative is strict string equality.

## 4. Cell types that look alike under a microscope

- A map, `pipeline/maps/look-alike.json`, lists groups of cell types that cannot be told apart by shape in an ordinary stained section, and the surface proteins that tell them apart.
- Every protein comes from a cited, CC BY source:
  - the cell type's Cell Ontology logical definition ("has plasma membrane part", for example CD4 for CL:0000624);
  - or the HRA ASCT+B biomarker rows for that cell type.
- First groups:
  - **Lymphocytes:** T cells (CD3; helper CD4, cytotoxic CD8), B cells (CD19, CD20) and NK cells (CD56, CD16; no CD3).
  - **Monocytes and macrophages** in tissue.
  - **Pancreatic islet alpha and beta cells.**
  - **Collecting-duct principal and intercalated cells.**

  Each marker is listed only where its source says it.
- Every figure caption for a group member adds, for example: "Under a light microscope T cells, B cells and NK cells look alike: small round cells with a large nucleus. Surface proteins tell them apart: CD3 on T cells, CD19 and CD20 on B cells, CD56 on NK cells (Cell Ontology; HRA ASCT+B)."
- Step 12 fails if a group member's figure lacks that sentence, or if a marker has no source.

## 5. Scope of the first pass

- **Profiled cell types: 70** (the morphology profiles just committed).
- **Organs: the 30 with histology** in `pipeline/maps/tissue-media.json` (heart, lung, liver, kidney, brain, stomach, pancreas, skin, testis, ovary, and the rest). Left and right organs share their figures, and the organ's figures show on its tissue board.
- **Organelles: every one a cell model draws** (40 GO terms today).

Other structures (muscles, bones, vessels) wait for a second pass.

## 6. Pipeline, files and checks

- **New step 10, `pipeline/10-figures.py`**, after 09 and before 14. Every request goes through `_http.py`: cached, throttled, with a descriptive user agent; robots.txt is respected; Servier and BioArt are fetched page by page, not crawled in bulk. For each candidate it:
  - records the source's own licence field (HPA: the release licence; HRA: the record's `license`; BioArt: the entry's field; OpenStax: book licence plus the whole-caption check; Servier: site licence);
  - keeps only CC BY 4.0 or public domain;
  - downloads the original and writes `public/figures/<id>.webp`, at most 1400 px on the long side, plus `<id>-thumb.webp` at 240 px;
  - writes `graph/figures.json` with one record per figure: id, source, title, caption, kind, licence, licence URL, credit, page URL, image URL, how it matched, status `auto`. It also writes `reports/figures.md` (coverage, plus every candidate rejected and why).
- **Step 11** attaches up to three figures to each node's content file and to each board.
- **Step 12** checks every figure:
  - the file exists and has licence, credit and page URL;
  - the licence is in the allowed set;
  - an OpenStax figure's caption has no third-party rights;
  - no Wikipedia or Wikimedia URL or text anywhere;
  - look-alike captions are present;
  - every file is under its size limit.
- **ATTRIBUTION.md** gets a figures section per source, written by step 10, with each figure's credit line. The About panel adds one line per source.

**Decision 3: image tool.**
- Recommendation: `sharp` 0.34.5, a fast and well-maintained image library. It is already in `package-lock.json`, but only through miniflare. I'd add it as a direct devDependency at that version, so the lockfile pins what step 10 uses; it downloads nothing new.
- The alternatives are system Pillow (12.0, not pinned by the repository) or macOS `sips` (not available on Linux).

**Decision 4: size budget.**
- The estimate is about 180 structures × up to 3 figures, many shared, so roughly 400 images. At about 90 KB full size plus 10 KB for the thumbnail, that is about 40 MB.
- I propose a hard limit of 60 MB for `public/figures/`, with step 12 failing above it, and I'll stop and ask before raising it. Every file stays well under 50 MB.

## 7. Order of work after approval (check, commit, continue)

1. Step 10 for HPA and HRA, the figure strip and viewer, and steps 11 and 12. Check in the headless browser, commit.
2. OpenStax diagrams with the whole-caption rights check, and the look-alike map and captions. Commit.
3. Servier and NIH BioArt, entry by entry, with licence fields. Commit.
4. Gray's plates, per Decision 1. Commit.
5. Report coverage (structures with 0, 1, 2 or 3 figures), every rejected candidate with its reason, and the total size.
