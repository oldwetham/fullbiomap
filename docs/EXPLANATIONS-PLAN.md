# Explanations plan: a fact card for every structure, sourced explanations for the major ones

Goal: replace the unhelpful tier-1 text. About 2,640 structures show a generated sentence such as "Left palatine tonsil is a kind of palatine tonsil and part of the left faucial pillar", and most other Plain texts are ontology definitions written for specialists. Measured with the Flesch–Kincaid grade (section 5), today's Plain texts have medians of 10.9 for the generated sentences, 10.5 for NCIt definitions, 12.3 for Cell Ontology and 13.8 for GO.

Two parts:
- **Fact cards** for every structure, cell type and organelle, built from the graph by code, with no AI writing.
- **Written explanations** for the major structures, drafted and checked the way the morphology profiles were. Every sentence quotes an allowed source, and a sentence that can't be verified is dropped.

**Approved on 2026-11-08**, with these decisions:
1. `cells` stays the base; main was fast-forwarded to `cells` and tagged v0.4.1.
2. The 35 brain regions that are OpenStax key terms are included (Plain).
3. SEER text is used, text only, credited to NCI; no SEER graphics.
4. Plain must measure Flesch–Kincaid grade 10 or below, but a necessary technical term is never dropped to reach the number: it is kept and defined, and the sentences around it are made shorter and plainer instead.

The pilot runs first; if it projects more than 25% over the estimate in section 7, the work stops for a decision.

**Decision 1: base branch.** Decided: keep `cells`; main fast-forwarded to it and tagged v0.4.1.
- You asked for `explanations` from main. Main is 14 commits behind `cells` and lacks what this plan builds on: the 70 morphology profiles and their workflow, the pinned OpenStax copies (step 09), figures and search.
- Switching to main would also rewrite `public/` under your running dev server.
- So I created `explanations` from `cells`; no files changed.
- Options:
  - keep it (recommended);
  - fast-forward main to `cells` first with `git fetch . cells:main`. That changes no files, and `explanations` then sits directly on main.

## 1. What changes in the panel

- **Fact card, for every structure.** A short "Facts" section under the title, with rows from the graph (section 2):
  - each row appears only when the data has something for it;
  - structures that are in the 3D model are clickable, like connection chips;
  - the card names its data sources and carries the Unreviewed badge.
- **Plain and Core explanations, where written.**
  - The Plain tab shows the 2–4 sentence explanation, and the Core tab the longer one for organs and cell types.
  - Under the text, "Where each sentence comes from" works like the Morphology section: each sentence opens to the quote(s) it rests on, with the source section (linked) and its licence.
  - Explanations carry the Unreviewed badge until you review them (section 6).
- **No explanation yet.**
  - A structure with an ontology definition (NCIt, Uberon or FMA) keeps it, labelled with its source as today.
  - Otherwise, the fact card alone. The generated "X is a kind of Y and part of Z" sentences go, because the card's "Kind of" and "Part of" rows say the same thing. A structure with a content file no longer falls back to its system's general description.
- **The nine Human Atlas texts stay exactly as they are:** diaphragm, urinary bladder, brain, heart, stomach, spleen, liver, pancreas and trachea.
  - They remain their structures' Plain text. Those that are organs get a new Core text.
  - Step 12 records each file's checksum and fails if any of them changes.
- **Deep stays "not written yet".**
- **`app/scene.tsx` is not touched.**

## 2. Fact cards

Built by step 11 into each content file (`facts`), in FMA's and HRA's own wording. Coverage below is measured over today's 4,020 structures.

| Row | From | Structures with it |
| --- | --- | --- |
| Where it is | Side (FMA laterality or the label); "In the ⟨organ⟩" (the scale ladder, real organs only, not "Systemic arterial tree"); FMA's position relations: contained in, superior/inferior/anterior/posterior/medial/lateral to, surrounded by, and a muscle's origin and insertion; its group (FMA "member of", e.g. "Set of left tarsal bones") | 2,260 (56%) have at least one: side 1,290, in an organ 658, position 353, group 886 |
| Part of | FMA part-of (regional, constitutional) and the HRA hierarchy | 2,376 (59%) |
| Kind of | FMA / Uberon is-a | 3,620 (90%) |
| Supplied by, Drains to, Lymph drains to, Innervated by | FMA relations and the HRA vascular tables (VCCF) | 749 (19%) have at least one |
| Cell types | HRA ASCT+B placements: the cell types placed in the structure itself, else a count and a link to its organ's tissue board | 417 directly; 1,497 through their organ's board |

- **Cell types:** Found in (with the tissue-board links), Kind of (Cell Ontology), and their figures.
- **Organelles:** Kind of and Part of (GO), and the cells drawn with them.
- **No new downloads.** Step 06 reads the extra FMA relations (positions, member of, origin and insertion) from the OLS4 responses it has already cached.
- **No guessing.** Where the data gives no position, the row is left out. That is 44% of structures, such as the arch of the aorta and the abdominal aorta.
- **Connections section:** to avoid listing things twice, the supply, drainage and nerve groups move from it into the card, keeping their hover-to-tint. Branches, tributaries, joints, attachments and continuity stay in Connections.

## 3. Which structures get written explanations

| Group | Rule | Subjects | Tiers |
| --- | --- | --- | --- |
| Organs | An explicit list in `pipeline/maps/explanations.json`, seeded from every organ with a tissue board or an HRA model, plus organs OpenStax names as key terms. For example: heart, lungs, trachea, larynx, esophagus, stomach, small and large intestine, liver, gallbladder, pancreas, salivary glands, spleen, thymus, lymph node, tonsils, kidneys, ureters, bladder, adrenal and pituitary glands, brain, spinal cord, eye, skin, breast tissue and the reproductive organs. The thyroid isn't in the model. | about 50 | Plain and Core; the 9 above keep their Plain and get Core only |
| Major bones, muscles, vessels | The structure, its name without left/right, or its numbered class ("fourth rib" → rib) is a key term in the pinned OpenStax A&P 2e glossary (3,030 terms). Generic terms (arm, long bone, artery) are excluded. | about 70 bones, 115 muscles, 90 vessels | Plain |
| Major nerves | The same rule. BodyParts3D models only the nerves around the eye (optic, trochlear, and branches of the oculomotor and ophthalmic nerves); no sciatic, femoral or median nerve. | 3: optic nerve, trochlear nerve, ciliary ganglion | Plain |
| Cell types | The 70 with morphology profiles | 70 | Plain and Core |
| Organelles | All 40 (none has a profile) | 40 | Plain |

- **Shared texts.** Left and right structures, and numbered ones, share their class's explanation: one "Kidney" text for both kidneys, one "Rib" text for all 24 ribs.
  - The explanation is stored under the class (e.g. `content/FMA_7203/` for Kidney) and written to read right for each instance ("Each kidney…").
  - The fact card gives the side and position.
  - In all, about 440 texts cover roughly 1,000 structures.
- **Exact lists first.** The selection script writes the lists to `reports/explanations.md` before any drafting, for you to check.

**Decision 2: brain regions.** Decided: include the 35.
- The atlas's nervous system is mostly brain: 167 parts, 35 of them OpenStax key terms (cerebellum, hippocampus, hypothalamus, corpus callosum…).
- They aren't in your list, and without them the nervous system gets only the brain, the spinal cord and three eye nerves.
- Recommendation: include the 35 brain regions as Plain texts (adds about 1.5M tokens).
- Other organ parts (heart chambers and valves, colon segments) wait for a later pass.

## 4. Sources

All local, pinned, read only from `data/build/sources/`, as for the profiles. Agents may not use the web.

- **OpenStax Anatomy and Physiology 2e and Biology 2e:** the CC BY copies step 09 already pins (A&P `b0058a74`, Biology `d2779c2e`), one file per section.
  - New: step 09 also writes each chapter's key-term glossary, 3,030 terms in A&P alone. These give quotable definitions for technical terms.
- **Ontology definitions:** FMA, Uberon, Cell Ontology, GO and NCIt, one file per term, written by step 09 from step 06's records. Cell Ontology files already exist.
  - Any definition whose provenance cites Wikipedia is excluded, as step 07 does now.
- **NCI SEER Training Modules, Anatomy & Physiology:** if approved (Decision 3).
  - Step 09 fetches it through `_http.py`, text only, one file per page.
- **Quote check.** Step 09 checks every quote word for word against its file, as it does for profile claims. Step 12 rejects any source file outside these folders and any mention of Wikipedia.
- **Credits.** Each explanation file lists the sources it quotes, with citations and licences, and the panel's credit line is built from them. The explanation text itself is original, CC BY 4.0. New sources go into `public/ATTRIBUTION.md` and the About panel in the same change.

**Decision 3: SEER.** Decided: use SEER text only, credited to NCI, under NCI's policy (recorded in `pipeline/maps/seer.json`; step 09 stops if the policy page changes). I could not confirm public-domain status on SEER's own pages.
- **What SEER's pages say:**
  - The module and topic pages (e.g. training.seer.cancer.gov/anatomy/urinary/components/kidney.html) carry no licence or copyright line, only a suggested citation: "SEER Training Modules: Kidneys. U.S. National Institutes of Health, National Cancer Institute."
  - SEER's policies page (seer.cancer.gov/policies/) and the training site's old citation page both return 404.
- **What NCI's policy says.** NCI's reuse policy (cancer.gov/policies/copyright-reuse, reviewed March 12, 2025) says: "Unless otherwise indicated, all text within National Cancer Institute (NCI) products is free of copyright and may be reused without our permission." It asks reusers to "Credit the National Cancer Institute as the source."
  - The policy doesn't name the training site, but the pages present themselves as an NCI product and indicate nothing otherwise.
  - Graphics are a mix of copyrighted and copyright-free material, so we would take text only.
- Options:
  - use SEER text under NCI's policy, credited "SEER Training Modules, U.S. National Institutes of Health, National Cancer Institute", with the policy's wording and review date recorded in the source map (recommended: its plain wording suits high-school-level text);
  - leave SEER out; OpenStax and the ontologies cover the same structures in harder language.

## 5. How an explanation is written and checked

The same pipeline as the morphology profiles: one agent drafts, an independent agent checks, and code checks what code can.

1. **Draft.**
   - One agent per organ or cell type. Bones, muscles, vessels and organelles go in batches of up to 5 subjects from the same OpenStax section, so the section is read once; each subject still gets its own text.
   - The agent returns sentences, each with one quote, or two when the sentence also defines a term.
   - Style rules:
     - lead with what the structure does, then where it is;
     - define each technical term the first time it appears, with a quoted definition;
     - no numbers unless the quote has them;
     - nothing diagnostic;
     - shared texts must read right for every instance.
   - Plain is 2–4 sentences; Core is 5–10, covering function, location, structure and how it works.
2. **Check.** A separate agent opens each cited file and, for each sentence:
   - fails it if the quote isn't there;
   - fails it if the quote, read in context, doesn't state the sentence's facts for this structure or its exact class;
   - fails it if the sentence goes beyond the quote.
   - It also reports whether the kept sentences still read well together, whether the first one says what the structure does, and any technical term left undefined.
   - It is told to be strict: when unsure, fail.
3. **Code checks.**
   - Every quote word for word, in an allowed file.
   - Sentence counts.
   - Plain's reading level: the Flesch–Kincaid grade, computed by `pipeline/_readability.mjs` with one fixed formula and syllable counter for every text, so grades compare.
4. **Repair, once.**
   - Failed sentences are dropped. A text that lost its lead sentence, fell below 2 sentences, reads badly after the drops, leaves a term undefined or measures above the grade limit gets one new draft and check.
   - A repair for the grade limit keeps every technical term the text defined: it splits long sentences and plainer words go around the terms, never instead of them. Code checks that each defined term is still there.
   - If it still fails, it isn't published: the structure keeps its definition or fact card, and the report lists it with the reasons.

**Decision 4: reading level.** Decided: grade 10 or below, without dropping necessary technical terms (see the repair rule below).
- Recommendation: Plain must measure Flesch–Kincaid grade 10 or below (early high school; target 8–10).
- Core's grade is reported but not limited.
- The nine Human Atlas texts are exempt and untouched (the brain's measures 12.7).
- The limit is one number in `pipeline/maps/explanations.json`.

## 6. Storage, status and review

- **Files.** `content/<ID>/tier1.md` (Plain) and `tier2.md` (Core), like the Human Atlas files and never written by the pipeline. Front matter, one `key: <JSON>` per line:
  - `status: "drafted"`;
  - the sentences, each with its quotes (file, section, url, licence);
  - the measured grade;
  - a method line ("Drafted by an AI agent from the quoted sources; each sentence checked by an independent AI agent; not yet reviewed");
  - `sources`, `license`, `attribution`;
  - `reviewer: null`, `reviewed_on: null`.
- **What the app gets.** Step 11 carries all of this into `public/content/<id>.json`. A left or right structure gets its class's text with an `inheritedFrom` note.
- **Review.**
  - `reports/explanations.md` lists every text with its quotes, grade, dropped sentences and their reasons, grouped by organ system for review.
  - Marking a text reviewed sets `status: "reviewed"`, `reviewer` and `reviewed_on` in its file; a small script can do this per file or per group.
  - Fact cards show Unreviewed too, until you mark them reviewed.
- **Step 12** fails the build if any of these break:
  - a quote doesn't match its file, or a source falls outside the allowed folders;
  - a Plain text is over the grade limit or the wrong length;
  - a licence or attribution is missing;
  - Wikipedia is mentioned anywhere;
  - a fact card names an id that isn't a node;
  - any of the nine Human Atlas files changed.

## 7. Usage estimate

The basis is the morphology run on `cells`: 71 cell types, 141 agents, 11.4M tokens and about 40 minutes. A draft averaged 88k tokens and a check 73k.

| Work | Subjects | Agents | Tokens, estimated |
| --- | --- | --- | --- |
| Organs and cell types, Plain and Core, one per agent | 120 | 240 | about 19M |
| Bones, muscles, vessels, nerves, Plain, batches of 5 | about 280 | about 112 | about 12M |
| Organelles, Plain, batches of 4 | 40 | 20 | about 2M |
| One repair round (about 15% of texts) | | about 55 | about 5M |
| **Total** | **about 440** | **about 430** | **about 38M (likely 30–55M), about 2–3 hours of workflow time** |
| Brain regions, if Decision 2 is yes | 35 | 14 | about 1.5M |

- About 3.3 times the morphology run.
- Fact cards, the source step, the app and the validator use no agents, only ordinary session work.
- **Pilot first.** 2 organs and 2 cell types, and one full-size batch of each batched group (5 bones, 5 muscles, 5 vessels, the 3 nerves, 4 organelles, 5 brain regions), so batch costs are measured at the size the full run uses: 31 subjects, 20 agents, about 2.5M tokens. Its texts are kept as part of the run.
  - I report their actual tokens, pass rates and grades, with sample texts.
  - If the projection comes out more than 25% over this estimate, I stop and ask before the full run.

### Pilot results (2026-11-08)

- **Run:** 31 subjects in 10 jobs (20 agents), then one repair round (3 texts, 6 agents). 3.21M tokens in all (2.72M first round, 0.50M repairs), about 33 minutes.
- **Outcome:** 34 texts drafted; 160 sentences, 158 passed the independent check; every quote found word for word (238). 31 texts passed first time, 3 were repaired, 2 of those passed. 33 published; the hypothalamus Plain text was not (reads ambiguously after its repair) and keeps its definition and fact card.
- **Reading level:** Plain grades 3.8–9.0 (median 7.0), all within the limit of 10 with their technical terms defined; Core 10.3–12.9.
- **Cost per job:** an organ or cell type costs about 270k tokens (a 200k draft and a 65–75k check), not the 160k assumed from the morphology run; a batch of 3–5 bones, muscles, vessels, nerves, organelles or brain regions costs about the same per job (240–320k), so about 50–60k per subject. A repaired text costs about 166k.
- **Projection for the whole run:** about 59–60M tokens (first round 50.8M, repairs about 8M), 52% over the 39.5M estimate, so the full run waits for a decision (section 7).
- **Decision (2026-11-08):** organs and cell types are drafted three at a time, within one system (organs) or tissue group (cell types, `cellGroups` in `pipeline/maps/explanations.json`), and repairs are grouped by batch. Batching must not cost quality: each organ and cell-type text (each Plain and each Core) is checked by its own independent agent. The other groups keep one checker per batch, as in the pilot. One test batch of three cell types runs first; if the projection is still above 49.4M, the work stops again.
- **Test batch (macrophage, basophil, eosinophil):** one draft (325k tokens) and six per-text checks (46–75k each), 673k in all, 224k per cell type against 270k drafted alone. All 40 sentences passed, but the per-text checkers sent 3 of the 6 texts to repair for reading problems the batch checkers had not flagged: an undefined term ("granules"), a pronoun that could be misread, a contrast not marked. Macrophage Plain and Core and basophil Core are published; the other three wait for their repair.
- **Projection with the test batch:** as decided, 60–67M tokens (repairs at 30–50% of organ and cell-type texts); with one checker per organ or cell type for both its texts, about 48M; as decided but cell types in Plain only, about 52.5M. Above 49.4M, so the work stopped again for a decision.
- **Decision (2026-11-08, second):** keep one checker per organ and cell-type text and Core for cell types, raise the limit to 80M tokens as a hard stop, and add the test batch's three lessons to the drafting prompt (define everyday biology words such as "granules"; no "it", "they" or "their" that could point two ways; mark contrasts). The full run goes ahead in waves (organs and cell types, then the other groups), each with its repair round; the work stops and asks only if the projection passes 80M.

### Full run results (2026-11-09)

- **Run:** wave 1 (organs and cell types, one checker per text) and wave 2 (organelles, bones, muscles, vessels, brain regions, one checker per batch) ran side by side, then one repair round each. 58.0M tokens for the whole run including the pilot and test batch (pilot 3.2M, test batch 0.7M, wave 1 25.1M plus 7.0M repairs, wave 2 19.5M plus 2.5M repairs), under the 80M stop.
- **Published:** 538 of 546 texts, 425 Plain and 113 Core, all unreviewed; 2,666 sentences resting on 4,170 quotes (OpenStax A&P 2,837, Biology 629, SEER 233, NCIt 220, Cell Ontology 144, GO 50, Uberon 37, FMA 20), every quote found word for word by step 09. Left, right and numbered structures share their class's text (597 of them), so 1,066 nodes show a written Plain text.
- **Reading level:** Plain grades 2.7–9.9 (median 7.7); Core 8.3–14.0 (median 10.9).
- **Not published (8), each keeping its definition and fact card:** Plain for the hypothalamus, subscapular vein and apical dendrite; Core for the hematopoietic stem cell, adipocyte, smooth muscle cell, monocyte and omentum. The reasons (reading problems after repair, or an undefined term) are in `reports/explanations.md` and `graph/explanation-runs.json`.

## 8. Order of work

Each step is checked and committed before the next; nothing is pushed.

1. **Sources:** step 09 writes the glossaries, the definition files and SEER (if approved); credits in `ATTRIBUTION.md` and About.
2. **Fact cards:** step 06 (extra FMA relations from the cache), step 11 (`facts`), the Facts section in the panel, Connections trimmed, step 07 stops writing the "kind of / part of" sentences, step 12 checks, and a headless browser test.
3. **Explanation format:** the validator, the readability module, the panel's explanation and sentence-source rows, the Core tab, and the selection lists in `reports/explanations.md`.
4. **Pilot:** report, then continue or ask (section 7).
5. **Full run by group:** organs, then cell types, organelles, bones, muscles, vessels, nerves (and brain regions). After each group: step 09's quote check, steps 11 and 12, browser spot checks, commit.
6. **Wrap-up:** `reports/explanations.md` final, the About text, `CLAUDE.md`, and a list of what to check in the browser.
