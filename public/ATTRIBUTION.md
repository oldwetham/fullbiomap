# Anatomy data attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- License: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (updated 2025-02-27)
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License terms: https://creativecommons.org/licenses/by/4.0/
- Source geometry: `isa_BP3D_4.0_obj_99.zip`, BodyParts3D 4.0.
- English names and relationships: IS-A and PART-OF concept, element, and inclusion tables from the same archive.
- Publication: Mitsuhashi et al. (2009), BodyParts3D: 3D structure database for anatomical concepts. https://doi.org/10.1093/nar/gkn613

Adaptations: axes and units converted from millimeters/Z-up to meters/Y-up; translated to rest at the stage; geometry simplified using meshoptimizer with 0.2% relative error limit per structure; normals quantized to signed 16-bit; packed into binary chunks; curated display system groupings and colors. The source contains 2,234 individual OBJ meshes; all remain represented. The combined hierarchy contains 3,432 named FMA concepts, which may reference multiple meshes. Original source identity is preserved in the manifest.

Source OBJ comments mention an older CC BY-SA 2.1 Japan license. The official current database license linked above supersedes that legacy text and explicitly permits redistribution and adaptation under CC BY 4.0.

BodyParts3D represents an adult male reference anatomy based on TARO MRI and anatomical illustration refinements. It is not a complete model of every possible human anatomical structure or variation. This interface is educational and is not a clinical tool.

## Structure explanations (tier-1 text)

No Wikipedia text is used anywhere. Tier-1 text is the first available of an NCIt, Uberon or FMA definition, otherwise a sentence Bio Map generates from the FMA hierarchy. Each detail panel shows the source term, a link to it, and its license; definitions are reproduced verbatim (whitespace normalized; Uberon's "[Automatically generated definition]" marker removed). Ontology terms were retrieved through the EBI Ontology Lookup Service (OLS4, https://www.ebi.ac.uk/ols4).

- NCI Thesaurus (NCIt), National Cancer Institute, OBO Edition as loaded in OLS4. CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Concept codes are cited per structure.
- Uberon multi-species anatomy ontology. Mungall CJ et al. (2012), Uberon, an integrative multi-species anatomy ontology, Genome Biology 13:R5, https://doi.org/10.1186/gb-2012-13-1-r5. CC BY 3.0, https://creativecommons.org/licenses/by/3.0/. Uberon definitions whose provenance cites Wikipedia are not used.
- Foundational Model of Anatomy (FMA) 5.1, University of Washington Structural Informatics Group. Rosse C, Mejino JLV (2003), A reference ontology for biomedical informatics: the Foundational Model of Anatomy, J Biomed Inform 36:478–500, https://doi.org/10.1016/j.jbi.2003.11.007. CC BY 3.0. Labels, synonyms, definitions and is_a / part_of relations; generated hierarchy sentences are Bio Map text under CC BY 4.0.
- Nine structures (heart, liver, brain, stomach, spleen, pancreas, urinary bladder, trachea, diaphragm) keep their original Human Atlas text (MIT License).

## Connections (supply, drainage, innervation, branching, attachments)

- Relations (arterial supply, venous drainage, nerve supply, lymphatic drainage, branch of, tributary of, attaches to, articulates with, continuous with) come from the Foundational Model of Anatomy (FMA) 5.1 via EBI OLS4, CC BY 3.0, credited above.
- Vessel branching also comes from the Human Reference Atlas ASCT+B table for Blood Vasculature v1.10, the data behind the HRA vasculature common coordinate framework (VCCF): Weber G, Lee S, Malhotra R (2025), HuBMAP ASCT+B Tables. Blood Vasculature v1.10, https://doi.org/10.48539/HBM497.DSBZ.627; HuBMAP / Human Reference Atlas, https://humanatlas.io. CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Adaptation: consecutive vessels in each row were mapped to Bio Map structures (directly by FMA id, or through Uberon cross-references) and recorded as branch_of (arteries) or tributary_of (veins).

## Female body and organ interiors (Human Reference Atlas)

Human Reference Atlas (HRA) release v2.5, HuBMAP, https://humanatlas.io. CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Release manifest: https://cdn.humanatlas.io/digital-objects/collection/hra/v2.5/assets/digital-objects.yaml.

- Female body: Browne K, Schlehlein H (2026). *3D Reference Organ Set for Female, v1.10*. https://doi.org/10.48539/HBM637.DWBM.744
- Library: Browne K, Schlehlein H, Herr BW II, Quardokus E, Bueckle A, Börner K (2026). HuBMAP CCF 3D Reference Object Library. https://humanatlas.io/3d-reference-library
- Node-to-ontology crosswalks: each object's crosswalk.csv, and the ASCT+B Tables to 3D Reference Object Library Mapping v1.10, https://doi.org/10.48539/HBM626.BRWN.943
- HRA overview: Börner K et al. (2024). Human Reference Atlas. https://doi.org/10.1101/2024.12.22.630006

Adaptations: GLB meshes converted to Bio Map's part/chunk format; coincident vertices welded and geometry simplified with a 0.2% per-structure relative error bound; normals quantized to 16-bit. The female body is translated so its feet rest on the stage; the eight placenta and umbilical meshes in the united female model are left out (non-pregnant reference). Organ interiors are centered on the stage and scaled so their largest side is 1.4 m (the viewer labels the magnification). Display systems and colors are assigned by Bio Map (pipeline/maps/hra-organ-systems.json).

The female reference's skeleton and muscles are partial; the viewer says so where the female body is shown.

Male lung surfaces: BodyParts3D models each lung only as bronchial trees and vessels, so the male body shows the five lobe surfaces of HRA v2.5 lung-male v1.4 (https://doi.org/10.48539/HBM532.KLZD.394) as a see-through layer of the respiratory system (25 meshes). They are fitted into the BodyParts3D chest by a per-axis, stretch capped at 15% scale (x 0.9589, y 1.0306, z 0.8962) and translation, kept inside the ribs; a uniform scale that kept HRA's exact lobe shape left the BodyParts3D airways up to 3.4 cm outside the surfaces and was not used. With the fit used, 12.4% of the airway vertices lie outside the surfaces, at most 2.3 cm (reports/lung-shells.md). The lobe shapes are therefore approximate for this body.

| HRA object | Version | DOI |
| --- | --- | --- |
| brain-female | v1.4 | https://doi.org/10.48539/HBM674.NTLM.353 |
| brain-male | v1.4 | https://doi.org/10.48539/HBM538.NKCT.649 |
| epiploic-appendage-of-transverse-colon-female | v1.0 | https://doi.org/10.48539/HBM926.ZRGW.252 |
| epiploic-appendage-of-transverse-colon-male | v1.0 | https://doi.org/10.48539/HBM829.BSRC.927 |
| eye-female-left | v1.3 | https://doi.org/10.48539/HBM525.TRWD.376 |
| eye-female-right | v1.3 | https://doi.org/10.48539/HBM632.KTDP.379 |
| eye-male-left | v1.3 | https://doi.org/10.48539/HBM769.RWTZ.963 |
| eye-male-right | v1.3 | https://doi.org/10.48539/HBM272.VPJG.573 |
| fallopian-tube-female-left | v1.2 | https://doi.org/10.48539/HBM529.KBQT.896 |
| fallopian-tube-female-right | v1.2 | https://doi.org/10.48539/HBM952.XJJV.857 |
| heart-female | v1.3 | https://doi.org/10.48539/HBM449.SHRV.225 |
| heart-male | v1.3 | https://doi.org/10.48539/HBM564.WKNG.249 |
| intervertebral-disk-female | v1.0 | https://doi.org/10.48539/HBM824.BNBP.227 |
| intervertebral-disk-male | v1.0 | https://doi.org/10.48539/HBM747.XJJX.236 |
| kidney-female-left | v1.3 | https://doi.org/10.48539/HBM449.JPXL.964 |
| kidney-female-right | v1.3 | https://doi.org/10.48539/HBM968.HSNL.854 |
| kidney-male-left | v1.3 | https://doi.org/10.48539/HBM759.JKKF.434 |
| kidney-male-right | v1.3 | https://doi.org/10.48539/HBM364.QTSC.334 |
| knee-female-left | v1.3 | https://doi.org/10.48539/HBM892.RGKB.238 |
| knee-female-right | v1.3 | https://doi.org/10.48539/HBM542.WHJW.673 |
| knee-male-left | v1.2 | https://doi.org/10.48539/HBM839.JJQF.873 |
| knee-male-right | v1.2 | https://doi.org/10.48539/HBM984.JRHT.838 |
| large-intestine-female | v1.3 | https://doi.org/10.48539/HBM682.RSXX.965 |
| large-intestine-male | v1.3 | https://doi.org/10.48539/HBM487.ZKSN.693 |
| larynx-female | v1.1 | https://doi.org/10.48539/HBM525.FJHR.643 |
| larynx-male | v1.1 | https://doi.org/10.48539/HBM362.HNZB.247 |
| liver-female | v1.2 | https://doi.org/10.48539/HBM599.GZLD.639 |
| liver-male | v1.2 | https://doi.org/10.48539/HBM896.WMSL.867 |
| lung-female | v1.4 | https://doi.org/10.48539/HBM994.HXJP.575 |
| lung-male | v1.4 | https://doi.org/10.48539/HBM532.KLZD.394 |
| lymph-node-female | v1.4 | https://doi.org/10.48539/HBM425.PTPB.732 |
| lymph-node-male | v1.4 | https://doi.org/10.48539/HBM532.TNXR.875 |
| main-bronchus-female | v1.1 | https://doi.org/10.48539/HBM266.CXBT.375 |
| main-bronchus-male | v1.1 | https://doi.org/10.48539/HBM373.XHXV.928 |
| mammary-gland-female-left | v1.1 | https://doi.org/10.48539/HBM533.BNJL.834 |
| mammary-gland-female-right | v1.1 | https://doi.org/10.48539/HBM235.CHRK.259 |
| manubrium-female | v1.0 | https://doi.org/10.48539/HBM668.VJNV.946 |
| mouth-female | v1.0 | https://doi.org/10.48539/HBM856.VZWZ.422 |
| mouth-male | v1.0 | https://doi.org/10.48539/HBM568.RFGM.978 |
| omentum-female | v1.0 | https://doi.org/10.48539/HBM636.GWRW.698 |
| omentum-male | v1.0 | https://doi.org/10.48539/HBM428.TMNG.749 |
| ovary-female-left | v1.3 | https://doi.org/10.48539/HBM695.KCXS.294 |
| ovary-female-right | v1.3 | https://doi.org/10.48539/HBM277.TVMB.676 |
| palatine-tonsil-female-left | v1.2 | https://doi.org/10.48539/HBM245.VCTP.795 |
| palatine-tonsil-female-right | v1.2 | https://doi.org/10.48539/HBM549.HTLQ.527 |
| palatine-tonsil-male-left | v1.2 | https://doi.org/10.48539/HBM366.GHGT.974 |
| palatine-tonsil-male-right | v1.2 | https://doi.org/10.48539/HBM867.FQCX.589 |
| pancreas-female | v1.3 | https://doi.org/10.48539/HBM866.PNNZ.328 |
| pancreas-male | v1.3 | https://doi.org/10.48539/HBM396.QWWJ.639 |
| pelvis-female | v1.3 | https://doi.org/10.48539/HBM853.VCFM.778 |
| pelvis-male | v1.3 | https://doi.org/10.48539/HBM384.SBWX.873 |
| prostate-male | v1.2 | https://doi.org/10.48539/HBM545.CTNV.442 |
| renal-pelvis-female-left | v1.0 | https://doi.org/10.48539/HBM425.ZSXF.722 |
| renal-pelvis-female-right | v1.0 | https://doi.org/10.48539/HBM445.MNJL.333 |
| renal-pelvis-male-left | v1.0 | https://doi.org/10.48539/HBM636.ZFCT.453 |
| renal-pelvis-male-right | v1.0 | https://doi.org/10.48539/HBM349.XLHR.437 |
| small-intestine-female | v1.2 | https://doi.org/10.48539/HBM784.FBXB.245 |
| small-intestine-male | v1.2 | https://doi.org/10.48539/HBM789.XTDK.794 |
| spinal-cord-female | v1.1 | https://doi.org/10.48539/HBM242.QQQB.777 |
| spinal-cord-male | v1.1 | https://doi.org/10.48539/HBM575.VDJW.494 |
| spleen-female | v1.3 | https://doi.org/10.48539/HBM883.DZCZ.658 |
| spleen-male | v1.3 | https://doi.org/10.48539/HBM437.LMTZ.752 |
| sternum-female | v1.0 | https://doi.org/10.48539/HBM669.VLNS.645 |
| thymus-female | v1.3 | https://doi.org/10.48539/HBM962.VFVM.626 |
| thymus-male | v1.3 | https://doi.org/10.48539/HBM923.RZCC.934 |
| trachea-female | v1.1 | https://doi.org/10.48539/HBM795.KFPV.358 |
| trachea-male | v1.1 | https://doi.org/10.48539/HBM357.VGJC.676 |
| united-female | v1.10 | https://doi.org/10.48539/HBM637.DWBM.744 |
| ureter-female-left | v1.2 | https://doi.org/10.48539/HBM343.JGCD.345 |
| ureter-female-right | v1.2 | https://doi.org/10.48539/HBM375.FNHZ.563 |
| ureter-male-left | v1.2 | https://doi.org/10.48539/HBM434.VLQJ.299 |
| ureter-male-right | v1.2 | https://doi.org/10.48539/HBM852.SVFJ.388 |
| urinary-bladder-female | v1.2 | https://doi.org/10.48539/HBM595.LMKX.573 |
| urinary-bladder-male | v1.2 | https://doi.org/10.48539/HBM722.RMHQ.397 |
| uterus-female | v1.2 | https://doi.org/10.48539/HBM627.VTKD.892 |
