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

## Organ interiors and female organs (Human Reference Atlas)

Human Reference Atlas (HRA) release v2.5, HuBMAP, https://humanatlas.io. CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Release manifest: https://cdn.humanatlas.io/digital-objects/collection/hra/v2.5/assets/digital-objects.yaml.

- Female body: Browne K, Schlehlein H (2026). *3D Reference Organ Set for Female, v1.10*. https://doi.org/10.48539/HBM637.DWBM.744. Converted but not shown: a complete female body isn't available in open data yet, and HRA models only some of its organs. The uterus, ovaries, fallopian tubes and breast tissue are shown on their own, from their HRA organ models below.
- Library: Browne K, Schlehlein H, Herr BW II, Quardokus E, Bueckle A, Börner K (2026). HuBMAP CCF 3D Reference Object Library. https://humanatlas.io/3d-reference-library
- Node-to-ontology crosswalks: each object's crosswalk.csv, and the ASCT+B Tables to 3D Reference Object Library Mapping v1.10, https://doi.org/10.48539/HBM626.BRWN.943
- HRA overview: Börner K et al. (2024). Human Reference Atlas. https://doi.org/10.1101/2024.12.22.630006

Adaptations: GLB meshes converted to Bio Map's part/chunk format; coincident vertices welded and geometry simplified with a 0.2% per-structure relative error bound; normals quantized to 16-bit. The female body is translated so its feet rest on the stage; the eight placenta and umbilical meshes in the united female model are left out (non-pregnant reference). Organ interiors are centered on the stage and scaled so their largest side is 1.4 m (the viewer labels the magnification). Display systems and colors are assigned by Bio Map (pipeline/maps/hra-organ-systems.json).

The female reference's skeleton and muscles are partial, one reason its whole-body view is disabled.

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

## Tissue and cells

- Cell types: HRA v2.5 ASCT+B tables (CC BY 4.0). Rows map anatomical structures to Bio Map structures and list Cell Ontology cell types; provisional (PCL) ids are not used. Tables used:

  - allen brain v1.9, https://doi.org/10.48539/HBM266.XLCW.993
  - blood pelvis v1.4, https://doi.org/10.48539/HBM326.VLJC.467
  - bone marrow v1.6, https://doi.org/10.48539/HBM885.LVBB.378
  - eye v1.5, https://doi.org/10.48539/HBM564.BKPQ.873
  - fallopian tube v1.5, https://doi.org/10.48539/HBM454.BTZT.755
  - heart v1.7, https://doi.org/10.48539/HBM662.RRDP.687
  - kidney v1.8, https://doi.org/10.48539/HBM342.NFDL.535
  - knee v1.4, https://doi.org/10.48539/HBM354.DWML.238
  - large intestine v1.5, https://doi.org/10.48539/HBM779.MRXG.925
  - liver v1.5, https://doi.org/10.48539/HBM945.HZDN.494
  - lung v1.6, https://doi.org/10.48539/HBM459.QMXK.379
  - lymph node v1.4, https://doi.org/10.48539/HBM653.DWLS.438
  - main bronchus v1.4, https://doi.org/10.48539/HBM295.WTKZ.986
  - mouth v1.2, https://doi.org/10.48539/HBM493.SBGT.435
  - muscular system v1.4, https://doi.org/10.48539/HBM556.MVMS.622
  - ovary v1.4, https://doi.org/10.48539/HBM485.CWTF.743
  - palatine tonsil v1.2, https://doi.org/10.48539/HBM225.MFHR.293
  - pancreas v1.4, https://doi.org/10.48539/HBM527.NDSX.792
  - peripheral nervous system v1.3, https://doi.org/10.48539/HBM723.RQGG.438
  - prostate v1.1, https://doi.org/10.48539/HBM542.LMZF.884
  - skeleton v1.3, https://doi.org/10.48539/HBM449.KQWN.983
  - skin v1.7, https://doi.org/10.48539/HBM539.LSRX.978
  - small intestine v1.4, https://doi.org/10.48539/HBM556.MDSS.878
  - spinal cord v1.1, https://doi.org/10.48539/HBM943.HDLM.983
  - spleen v1.6, https://doi.org/10.48539/HBM728.RXPP.245
  - thymus v1.5, https://doi.org/10.48539/HBM682.DVWX.968
  - trachea v1.1, https://doi.org/10.48539/HBM862.ZQRC.294
  - ureter v1.0, https://doi.org/10.48539/HBM882.LRSF.394
  - urinary bladder v1.0, https://doi.org/10.48539/HBM546.CKGW.888
  - uterus v1.3, https://doi.org/10.48539/HBM696.RVWF.244

- Cell type text: Cell Ontology (2026-06-08), CC BY 4.0, https://obofoundry.org/ontology/cl.html. Definitions citing Wikipedia are not used.
- Organelle and cell-part text (22 terms, from mitochondrion to axon): Gene Ontology (2026-07-26), CC BY 4.0, https://geneontology.org. Ashburner M et al. (2000), Nat Genet 25:25-29; Gene Ontology Consortium (2023), Genetics 224:iyad031.
- The 3D cells are Bio Map's own procedural illustrations (pipeline/13-cell.mjs), CC BY 4.0: a generic cell, and simplified shapes for eleven cell families (round immune cell, branched immune cell, red blood cell, platelet, neuron, skeletal muscle fiber, cardiac muscle cell, flat, cube-shaped and column-shaped epithelial cells with microvilli or cilia where the cell type has them, fat cell), chosen from each cell type's Cell Ontology ancestors (pipeline/maps/cell-families.json). Shapes, sizes and numbers are illustrative. The red blood cell's biconcave profile follows Evans E, Fung YC (1972), Improved measurements of the erythrocyte geometry, Microvascular Research 4:335-347.
- Histology: Human Protein Atlas 25.1 (released 2026-05-25), CC BY 4.0, https://www.proteinatlas.org/about/licence. Uhlén M et al. (2015), Tissue-based map of the human proteome, Science 347:1260419. One immunohistochemistry image per organ: the protein is stained brown (DAB) and cell nuclei blue (hematoxylin). Images are HPA's representative image for that gene and tissue, converted to WebP for the figures strip (pipeline/10-figures.py) and otherwise unchanged.

| Organ | Protein (gene) | UniProt | Image | Gene tissue page |
| --- | --- | --- | --- | --- |
| adrenal gland | Cytochrome P450 family 17 subfamily A member 1 (CYP17A1) | P05093 | https://images.proteinatlas.org/ih_additional_tissue/48533/417_227.jpg | https://www.proteinatlas.org/ENSG00000148795-CYP17A1/tissue/adrenal%20gland |
| brain | Myelin basic protein (MBP) | P02686 | https://images.proteinatlas.org/2300/6024_B_9_5_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000197971-MBP/tissue/cerebral%20cortex |
| breast | Transcriptional repressor GATA binding 1 (TRPS1) | Q9UHF7 | https://images.proteinatlas.org/71767/165338_B_2_4_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000104447-TRPS1/tissue/breast |
| esophagus | Cystatin B (CSTB) | P04080 | https://images.proteinatlas.org/47320/103193_B_4_1_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000160213-CSTB/tissue/esophagus |
| fallopian tube | Oviductal glycoprotein 1 (OVGP1) | Q12889 | https://images.proteinatlas.org/62205/142921_A_8_7_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000085465-OVGP1/tissue/fallopian%20tube |
| gallbladder | Carbohydrate sulfotransferase 4 (CHST4) | Q8NCG5 | https://images.proteinatlas.org/21955/148702_A_5_4_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000140835-CHST4/tissue/gallbladder |
| heart | Natriuretic peptide A (NPPA) | P01160 | https://images.proteinatlas.org/58269/133550_B_4_6_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000175206-NPPA/tissue/heart%20muscle |
| kidney | FXYD domain containing ion transport regulator 2 (FXYD2) | P54710 | https://images.proteinatlas.org/68838/153874_A_8_5_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000137731-FXYD2/tissue/kidney |
| large intestine | Proline, histidine and glycine rich 1 (PHGR1) | C9JFL3 | https://images.proteinatlas.org/68787/153275_A_9_3_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000233041-PHGR1/tissue/colon |
| liver | Haptoglobin (HP) | P00738 | https://images.proteinatlas.org/47750/118508_A_9_4_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000257017-HP/tissue/liver |
| lung | Surfactant protein C (SFTPC) | P11686 | https://images.proteinatlas.org/10928/51559_A_2_4_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000168484-SFTPC/tissue/lung |
| main bronchus | Secretoglobin family 1A member 1 (SCGB1A1) | P11684 | https://images.proteinatlas.org/25686/56410_B_6_2_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000149021-SCGB1A1/tissue/bronchus |
| ovary | Zona pellucida glycoprotein 4 (ZP4) | Q12836 | https://images.proteinatlas.org/8547/160095_A_6_7_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000116996-ZP4/tissue/ovary |
| pancreas | Pancreatic lipase (PNLIP) | P16233 | https://images.proteinatlas.org/62430/143700_A_3_3_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000175535-PNLIP/tissue/pancreas |
| prostate | Microseminoprotein beta (MSMB) | P08118 | https://images.proteinatlas.org/26357/56373_A_2_5_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000263639-MSMB/tissue/prostate |
| skeletal muscle | Myosin heavy chain 1 (MYH1) | P12882 | https://images.proteinatlas.org/10759/24535_B_2_6_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000109061-MYH1/tissue/skeletal%20muscle |
| skin | Arachidonate 12-lipoxygenase, 12R type (ALOX12B) | O75342 | https://images.proteinatlas.org/24002/52924_B_4_8_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000179477-ALOX12B/tissue/skin |
| small intestine | Defensin alpha 5 (DEFA5) | Q01523 | https://images.proteinatlas.org/15775/141534_A_4_2_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000164816-DEFA5/tissue/small%20intestine |
| spleen | Heme oxygenase 1 (HMOX1) | P09601 | https://images.proteinatlas.org/17444/39144_B_8_4_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000100292-HMOX1/tissue/spleen |
| stomach | Alpha-1,4-N-acetylglucosaminyltransferase (A4GNT) | Q9UNA3 | https://images.proteinatlas.org/8017/152732_A_5_1_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000118017-A4GNT/tissue/stomach |
| testis | Protamine 1 (PRM1) | P04553 | https://images.proteinatlas.org/55150/125940_A_5_6_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000175646-PRM1/tissue/testis |
| urinary bladder | Uroplakin 1A (UPK1A) | O00322 | https://images.proteinatlas.org/49879/112549_A_5_5_rna_selected.jpg | https://www.proteinatlas.org/ENSG00000105668-UPK1A/tissue/urinary%20bladder |
| uterus | Progestagen associated endometrial protein (PAEP) | P09466 | https://images.proteinatlas.org/ih_additional_tissue/16762/3171_1168.jpg | https://www.proteinatlas.org/ENSG00000122133-PAEP/tissue/endometrium |

- 2D functional tissue units: HRA v2.5 illustrations (CC BY 4.0), shown unmodified (the figures strip shows a small WebP thumbnail rendered from each). Each illustration's HRA crosswalk (CC BY 4.0) links the cells it draws to Cell Ontology ids, which makes those cells clickable in the illustration viewer; the viewer highlights a cell type by drawing copies of its shapes on top and does not change the file:

  - Loop of Henle ascending limb thin segment (kidney-ascending-thin-loop-of-henle): https://doi.org/10.48539/HBM783.MHQZ.685
  - Cortical Collecting Duct (kidney-cortical-collecting-duct): https://doi.org/10.48539/HBM334.XPNG.824
  - Descending limb of loop of Henle (kidney-descending-thin-loop-of-henle): https://doi.org/10.48539/HBM485.WZJH.976
  - Inner medullary collecting duct (kidney-inner-medullary-collecting-duct): https://doi.org/10.48539/HBM837.WVQG.999
  - Nephron (kidney-nephron): https://doi.org/10.48539/HBM496.MJDK.347
  - Outer medullary collecting duct (kidney-outer-medullary-collecting-duct): https://doi.org/10.48539/HBM839.RVZB.668
  - Renal corpuscle (kidney-renal-corpuscle): https://doi.org/10.48539/HBM489.GJJK.324
  - Thick ascending limb of loop of Henle (kidney-thick-ascending-loop-of-henle): https://doi.org/10.48539/HBM426.LDRT.823
  - Crypt of Lieberkuhn of large intestine (large-intestine-crypt-lieberkuhn): https://doi.org/10.48539/HBM578.RMQR.736
  - Liver lobule (liver-liver-lobule): https://doi.org/10.48539/HBM693.LTPG.393
  - Bronchus submucosal gland (lung-bronchial-submucosal-gland): https://doi.org/10.48539/HBM287.HJJZ.687
  - Alveolus of lung (lung-pulmonary-alveolus): https://doi.org/10.48539/HBM949.RSKR.647
  - Parotid gland (mouth-parotid-gland): https://doi.org/10.48539/HBM944.MMNZ.835
  - Sublingual gland (mouth-sublingual-gland): https://doi.org/10.48539/HBM852.DKZG.476
  - Submandibular gland (mouth-submandibular-gland): https://doi.org/10.48539/HBM544.ZZVG.498
  - Islet of Langerhans (pancreas-endocrine-pancreas): https://doi.org/10.48539/HBM242.XXWX.292
  - Intercalated duct of pancreas (pancreas-intercalated-duct): https://doi.org/10.48539/HBM488.JHGT.523
  - Islet of Langerhans (pancreas-islets-langerhans): https://doi.org/10.48539/HBM354.HHRL.928
  - Pancreatic acinus (pancreas-pancreatic-acinus): https://doi.org/10.48539/HBM466.JQPZ.849
  - Prostate glandular acinus (prostate-prostate-glandular-acinus): https://doi.org/10.48539/HBM346.TQTN.357
  - Papillary layer of dermis (skin-dermal-papilla): https://doi.org/10.48539/HBM223.PSTT.966
  - Epidermal ridge of digit (skin-epidermal-ridge): https://doi.org/10.48539/HBM697.MRSV.939
  - Hair follicle (skin-hair-follicle): https://doi.org/10.48539/HBM697.MRSV.939
  - Intestinal villus (small-intestine-villus): https://doi.org/10.48539/HBM946.CQQC.734
  - Red pulp of spleen (spleen-red-pulp): https://doi.org/10.48539/HBM452.BXTV.428
  - White pulp of spleen (spleen-white-pulp): https://doi.org/10.48539/HBM538.PHWH.575
  - Thymus lobule (thymus-thymus-lobule): https://doi.org/10.48539/HBM793.JJWN.944

## Cell morphology profiles (OpenStax, Cell Ontology)

- What: each morphology profile (content/CL_<n>/morphology.md) quotes single sentences from these sources, unchanged except for whitespace; each cell type's panel shows every quote with its section, link and licence. Bio Map chose the sentences, set each claim's value, wrote the structure-and-job sentences and drew the 3D models from the claims (CC BY 4.0).
- OpenStax changed the licence of these books to CC BY-NC-SA 4.0 in 2026 (the repositories' LICENSE on 2026-03-19, the books' own metadata on 2026-04-23). Bio Map uses only copies OpenStax published under CC BY 4.0 before that change, pinned to the commits below, where both the repository LICENSE and the book's own licence declaration say CC BY 4.0.
- Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Copy used: github.com/openstax/osbooks-anatomy-physiology at commit b0058a743bdd2cc08196abaaa7d5469970c0d80c. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction
- Clark MA, Douglas M, Choi J (2018). Biology 2e. OpenStax. Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Copy used: github.com/openstax/osbooks-biology-bundle at commit d2779c2edfb435e75047325434fe2fe93d5aa120. Access for free at https://openstax.org/books/biology-2e/pages/1-introduction
- Cell Ontology (CL) definitions, CC BY 4.0, https://obofoundry.org/ontology/cl.html (via step 06). Definitions that cite Wikipedia are not used.

## Figures (2D images in the Figures strip)

- What: up to three 2D figures per structure, cell type and organelle, shown in the detail panel and on tissue boards; each opens full size with its source, licence, credit line and a link to the original. Figures are matched automatically by the source's own id or exact title and are unreviewed. Images are converted to WebP (at most 1400 px) with a 240 px thumbnail; tissue unit illustrations open as their original SVG.

- Human Protein Atlas 25.1 (CC BY 4.0, https://www.proteinatlas.org/about/licence):

  - Acrosome: SPACA4 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Acrosome: SPACA4 immunofluorescence, https://images.proteinatlas.org/61302/2204_E1_10_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000177202-SPACA4/subcellular
  - Adipocytes in breast: LIPE immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Adipocytes in breast: LIPE immunohistochemistry, https://images.proteinatlas.org/17700/132029_B_2_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000079435-LIPE/tissue/breast
  - Adrenal gland: CYP17A1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Adrenal gland: CYP17A1 immunohistochemistry, https://images.proteinatlas.org/ih_additional_tissue/48533/417_227.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000148795-CYP17A1/tissue/adrenal%20gland
  - Breast: TRPS1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Breast: TRPS1 immunohistochemistry, https://images.proteinatlas.org/71767/165338_B_2_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000104447-TRPS1/tissue/breast
  - Bronchus: SCGB1A1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Bronchus: SCGB1A1 immunohistochemistry, https://images.proteinatlas.org/25686/56410_B_6_2.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000149021-SCGB1A1/tissue/bronchus
  - Cardiomyocytes in heart muscle: ACTA1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Cardiomyocytes in heart muscle: ACTA1 immunohistochemistry, https://images.proteinatlas.org/45/300_B_5_6.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000143632-ACTA1/tissue/heart%20muscle
  - Cerebral cortex: MBP immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Cerebral cortex: MBP immunohistochemistry, https://images.proteinatlas.org/2300/6024_B_9_5.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000197971-MBP/tissue/cerebral%20cortex
  - Chondrocytes in soft tissue: SCIN immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Chondrocytes in soft tissue: SCIN immunohistochemistry, https://images.proteinatlas.org/24264/54923_B_1_8.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000006747-SCIN/tissue/soft%20tissue
  - Colon: PHGR1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Colon: PHGR1 immunohistochemistry, https://images.proteinatlas.org/68787/153275_A_9_3.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000233041-PHGR1/tissue/colon
  - Endometrium: PAEP immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Endometrium: PAEP immunohistochemistry, https://images.proteinatlas.org/ih_additional_tissue/16762/3171_1168.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000122133-PAEP/tissue/endometrium
  - Endothelial cells in cerebral cortex: ABCG2 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Endothelial cells in cerebral cortex: ABCG2 immunohistochemistry, https://images.proteinatlas.org/54719/135304_B_7_5.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000118777-ABCG2/tissue/cerebral%20cortex
  - Enterocytes in colon: GAL3ST2 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Enterocytes in colon: GAL3ST2 immunohistochemistry, https://images.proteinatlas.org/71809/155879_A_8_3.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000154252-GAL3ST2/tissue/colon
  - Esophagus: CSTB immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Esophagus: CSTB immunohistochemistry, https://images.proteinatlas.org/47320/103193_B_4_1.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000160213-CSTB/tissue/esophagus
  - Fallopian tube: OVGP1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Fallopian tube: OVGP1 immunohistochemistry, https://images.proteinatlas.org/62205/142921_A_8_7.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000085465-OVGP1/tissue/fallopian%20tube
  - Fibroblasts in colon: CADM3 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Fibroblasts in colon: CADM3 immunohistochemistry, https://images.proteinatlas.org/2981/8436_A_7_3.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000162706-CADM3/tissue/colon
  - Gallbladder: CHST4 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Gallbladder: CHST4 immunohistochemistry, https://images.proteinatlas.org/21955/148702_A_5_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000140835-CHST4/tissue/gallbladder
  - Golgi apparatus: APBA2 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Golgi apparatus: APBA2 immunofluorescence, https://images.proteinatlas.org/70376/1776_A2_3_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000034053-APBA2/subcellular
  - Heart muscle: NPPA immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Heart muscle: NPPA immunohistochemistry, https://images.proteinatlas.org/58269/133550_B_4_6.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000175206-NPPA/tissue/heart%20muscle
  - Hepatocytes in liver: ABAT immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Hepatocytes in liver: ABAT immunohistochemistry, https://images.proteinatlas.org/41690/91008_A_8_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000183044-ABAT/tissue/liver
  - Keratinocytes in skin: ADGRF4 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Keratinocytes in skin: ADGRF4 immunohistochemistry, https://images.proteinatlas.org/7131/159668_B_9_1.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000153294-ADGRF4/tissue/skin
  - Kidney: FXYD2 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Kidney: FXYD2 immunohistochemistry, https://images.proteinatlas.org/68838/153874_A_8_5.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000137731-FXYD2/tissue/kidney
  - Leydig cells in testis: AASS immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Leydig cells in testis: AASS immunohistochemistry, https://images.proteinatlas.org/20728/47594_A_5_6.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000008311-AASS/tissue/testis
  - Lipid droplets: HSD3B7 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Lipid droplets: HSD3B7 immunofluorescence, https://images.proteinatlas.org/60847/1136_H8_2_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000099377-HSD3B7/subcellular
  - Liver: HP immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Liver: HP immunohistochemistry, https://images.proteinatlas.org/47750/118508_A_9_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000257017-HP/tissue/liver
  - Lung: SFTPC immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Lung: SFTPC immunohistochemistry, https://images.proteinatlas.org/10928/51559_A_2_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000168484-SFTPC/tissue/lung
  - Lysosomes: STX7 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Lysosomes: STX7 immunofluorescence, https://images.proteinatlas.org/1467/28_H9_2_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000079950-STX7/subcellular
  - Macrophages in lung: ACP5 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Macrophages in lung: ACP5 immunohistochemistry, https://images.proteinatlas.org/59463/139573_A_3_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000102575-ACP5/tissue/lung
  - Melanocytes in skin: DCT immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Melanocytes in skin: DCT immunohistochemistry, https://images.proteinatlas.org/10743/26206_B_9_1.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000080166-DCT/tissue/skin
  - Mitochondria: AARS2 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Mitochondria: AARS2 immunofluorescence, https://images.proteinatlas.org/35636/380_A8_2_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000124608-AARS2/subcellular
  - Nucleoli: DDX50 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Nucleoli: DDX50 immunofluorescence, https://images.proteinatlas.org/37389/1216_D6_1_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000107625-DDX50/subcellular
  - Ovary: ZP4 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Ovary: ZP4 immunohistochemistry, https://images.proteinatlas.org/8547/160095_A_6_7.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000116996-ZP4/tissue/ovary
  - Pancreas: PNLIP immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Pancreas: PNLIP immunohistochemistry, https://images.proteinatlas.org/62430/143700_A_3_3.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000175535-PNLIP/tissue/pancreas
  - Peroxisomes: ABCD3 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Peroxisomes: ABCD3 immunofluorescence, https://images.proteinatlas.org/32026/570_F10_2_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000117528-ABCD3/subcellular
  - Plasma membrane: ARHGAP19 immunofluorescence: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Plasma membrane: ARHGAP19 immunofluorescence, https://images.proteinatlas.org/43231/494_A6_3_blue_red_green.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000213390-ARHGAP19/subcellular
  - Prostate: MSMB immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Prostate: MSMB immunohistochemistry, https://images.proteinatlas.org/26357/56373_A_2_5.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000263639-MSMB/tissue/prostate
  - Sertoli cells in testis: ABAT immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Sertoli cells in testis: ABAT immunohistochemistry, https://images.proteinatlas.org/41690/91008_A_5_6.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000183044-ABAT/tissue/testis
  - Skeletal muscle: MYH1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Skeletal muscle: MYH1 immunohistochemistry, https://images.proteinatlas.org/10759/24535_B_2_6.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000109061-MYH1/tissue/skeletal%20muscle
  - Skin: ALOX12B immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Skin: ALOX12B immunohistochemistry, https://images.proteinatlas.org/24002/52924_B_4_8.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000179477-ALOX12B/tissue/skin
  - Small intestine: DEFA5 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Small intestine: DEFA5 immunohistochemistry, https://images.proteinatlas.org/15775/141534_A_4_2.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000164816-DEFA5/tissue/small%20intestine
  - Smooth muscle cells in smooth muscle: ALDH1B1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Smooth muscle cells in smooth muscle: ALDH1B1 immunohistochemistry, https://images.proteinatlas.org/77080/168751_B_6_7.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000137124-ALDH1B1/tissue/smooth%20muscle
  - Spleen: HMOX1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Spleen: HMOX1 immunohistochemistry, https://images.proteinatlas.org/17444/39144_B_8_4.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000100292-HMOX1/tissue/spleen
  - Stomach: A4GNT immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Stomach: A4GNT immunohistochemistry, https://images.proteinatlas.org/8017/152732_A_5_1.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000118017-A4GNT/tissue/stomach
  - Testis: PRM1 immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Testis: PRM1 immunohistochemistry, https://images.proteinatlas.org/55150/125940_A_5_6.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000175646-PRM1/tissue/testis
  - Urinary bladder: UPK1A immunohistochemistry: Image from the Human Protein Atlas 25.1 (proteinatlas.org): Urinary bladder: UPK1A immunohistochemistry, https://images.proteinatlas.org/49879/112549_A_5_5.jpg. CC BY 4.0. https://v25.proteinatlas.org/ENSG00000105668-UPK1A/tissue/urinary%20bladder

- Human Reference Atlas v2.5 2D functional tissue units (CC BY 4.0):

  - Alveolus of lung (functional tissue unit): Bajema, Rachel. 2026. *2D Pulmonary Alveolus Functional Tissue Unit (FTU) for Lung, v1.5*. https://doi.org/10.48539/HBM949.RSKR.647. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM949.RSKR.647
  - Bronchus submucosal gland (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Bronchial Submucosal Gland FTU for Lung, v1.4. https://doi.org/10.48539/HBM287.HJJZ.687. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM287.HJJZ.687
  - Cortical Collecting Duct (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Cortical Collecting Duct FTU for Kidney, v1.5. https://doi.org/10.48539/HBM334.XPNG.824. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM334.XPNG.824
  - Crypt of Lieberkuhn of large intestine (functional tissue unit): Bajema, Rachel. 2026. 2D Crypt of Lieberkuhn FTU for Large Intestine, v1.4. https://doi.org/10.48539/HBM578.RMQR.736. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM578.RMQR.736
  - Descending limb of loop of Henle (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Descending Thin Limb of Loop of Henle FTU for Kidney, v1.3. https://doi.org/10.48539/HBM485.WZJH.976. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM485.WZJH.976
  - Epidermal ridge of digit (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Epidermal Ridge FTU for Skin, v1.3. https://doi.org/10.48539/HBM697.MRSV.939. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM697.MRSV.939
  - Hair follicle (functional tissue unit): Bajema, Rachel. 2024. Skin, Hair Follicle 2D FTU v.1.2. https://doi.org/10.48539/HBM697.MRSV.939. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM697.MRSV.939
  - Inner medullary collecting duct (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Inner Medullary Collecting Duct FTU for Kidney, v1.3. https://doi.org/10.48539/HBM837.WVQG.999. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM837.WVQG.999
  - Intercalated duct of pancreas (functional tissue unit): Bajema, Rachel. 2026. Pancreas, Intercalated Duct 2D FTU v1.3. https://doi.org/10.48539/HBM488.JHGT.523. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM488.JHGT.523
  - Intestinal villus (functional tissue unit): Bajema, Rachel. 2026. 2D Intestinal Villus FTU for Small Intestine, v1.2, https://doi.org/10.48539/HBM946.CQQC.734. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM946.CQQC.734
  - Islet of Langerhans (functional tissue unit): Bajema, Rachel. 2026. 2D Endocrine Pancreas FTU for Pancreas, v1.0. https://doi.org/10.48539/HBM242.XXWX.292. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM242.XXWX.292
  - Islet of Langerhans (functional tissue unit): Bajema, Rachel. 2026. 2D Islets of Langerhans FTU for Pancreas, v1.4. https://doi.org/10.48539/HBM354.HHRL.928. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM354.HHRL.928
  - Liver lobule (functional tissue unit): Bajema, Rachel. 2026. 2D Liver Lobule Functional Tissue Unit (FTU) for Liver, v1.5. https://doi.org/10.48539/HBM693.LTPG.393. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM693.LTPG.393
  - Loop of Henle ascending limb thin segment (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Ascending Thin Limb of Loop of Henle FTU for Kidney, v1.4. https://doi.org/10.48539/HBM783.MHQZ.685. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM783.MHQZ.685
  - Nephron (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Nephron FTU for Kidney, v1.3. https://doi.org/10.48539/HBM496.MJDK.347. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM496.MJDK.347
  - Outer medullary collecting duct (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Outer Medullary Collecting Duct FTU for Kidney, v1.4. https://doi.org/10.48539/HBM839.RVZB.668) Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM839.RVZB.668
  - Pancreatic acinus (functional tissue unit): Bajema, Rachel. 2026. Pancreas, Acinus 2D FTU v.1.4. https://doi.org/10.48539/HBM466.JQPZ.849. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM466.JQPZ.849
  - Papillary layer of dermis (functional tissue unit): Bajema, Rachel. 2026. 2D Dermal Papilla FTU for Skin, v1.3. https://doi.org/10.48539/HBM223.PSTT.966. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM223.PSTT.966
  - Parotid gland (functional tissue unit): Bajema, Rachel. 2026. Mouth, Parotid Gland Ducto-Acinar 2D FTU v.1.2. https://doi.org/10.48539/HBM944.MMNZ.835. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM944.MMNZ.835
  - Prostate glandular acinus (functional tissue unit): Bajema, Rachel. 2026. 2D Prostate Glandular Acinus FTU for Prostate, v1.3. https://doi.org/10.48539/HBM346.TQTN.357. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM346.TQTN.357
  - Red pulp of spleen (functional tissue unit): Bajema, Rachel. 2026. 2D Red Pulp Functional Tissue Unit (FTU) for Spleen v1.4. https://doi.org/10.48539/HBM452.BXTV.428. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM452.BXTV.428
  - Renal corpuscle (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Renal Corpuscle FTU for Kidney, v1.4. https://doi.org/10.48539/HBM489.GJJK.324. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM489.GJJK.324
  - Sublingual gland (functional tissue unit): Bajema, Rachel. 2026. Mouth, Sublingual Gland Ducto-Acinar 2D FTU v.1.2. https://doi.org/10.48539/HBM852.DKZG.476. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM852.DKZG.476
  - Submandibular gland (functional tissue unit): Bajema, Rachel. 2026. Mouth, Submandibular Gland Ducto-Acinar 2D FTU v.1.2. https://doi.org/10.48539/HBM544.ZZVG.498. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM544.ZZVG.498
  - Thick ascending limb of loop of Henle (functional tissue unit): Bajema, Rachel. 2026. 2D Reference Thick Ascending Limb of Loop of Henle FTU, v1.3. https://doi.org/10.48539/HBM426.LDRT.823. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM426.LDRT.823
  - Thymus lobule (functional tissue unit): Bajema, Rachel. 2026. 2D Thymus Lobule Functional Tissue Unit (FTU) for Thymus, v1.5. https://doi.org/10.48539/HBM793.JJWN.944. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM793.JJWN.944
  - White pulp of spleen (functional tissue unit): Bajema, Rachel. 2026. 2D White Pulp Functional Tissue Unit (FTU) for Spleen v1.4. https://doi.org/10.48539/HBM538.PHWH.575. Accessed on June 15, 2026. HuBMAP Human Reference Atlas v2.5, CC BY 4.0. https://doi.org/10.48539/HBM538.PHWH.575

- OpenStax, from the CC BY 4.0 copies pinned in pipeline/maps/openstax.json:

  - Aorta: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Aorta”, section 20.5 Circulatory Pathways. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways#fig-ch21_05_04
  - Cell Membrane: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Cell Membrane”, section 3.1 The Cell Membrane. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/3-1-the-cell-membrane#fig-ch03_01_03
  - Circle of Willis: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Circle of Willis”, section 13.3 Circulation and the Central Nervous System. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/13-3-circulation-and-the-central-nervous-system#fig-ch13_03_01
  - Esophagus: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Esophagus”, section 23.3 The Mouth, Pharynx, and Esophagus. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/23-3-the-mouth-pharynx-and-esophagus#fig-ch24_03_07
  - Ethmoid Bone: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Ethmoid Bone”, section 7.2 The Skull. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/7-2-the-skull#fig-ch07_02_10
  - Extraocular Muscles: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Extraocular Muscles”, section 14.1 Sensory Perception. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/14-1-sensory-perception#fig-ch14_01_13
  - Gallbladder: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Gallbladder”, section 23.6 Accessory Organs in Digestion: The Liver, Pancreas, and Gallbladder. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/23-6-accessory-organs-in-digestion-the-liver-pancreas-and-gallbladder#fig-ch24_06_04
  - Golgi Apparatus: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Golgi Apparatus”, section 3.2 The Cytoplasm and Cellular Organelles. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/3-2-the-cytoplasm-and-cellular-organelles#fig-ch03_02_03
  - Hyoid Bone: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Hyoid Bone”, section 7.2 The Skull. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/7-2-the-skull#fig-ch07_02_17
  - Intercostal Muscles: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Intercostal Muscles”, section 11.4 Axial Muscles of the Abdominal Wall, and Thorax. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax#fig-ch11_04_03
  - Large Intestine: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Large Intestine”, section 23.5 The Small and Large Intestines. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/23-5-the-small-and-large-intestines#fig-ch24_05_04
  - Mouth: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Mouth”, section 23.3 The Mouth, Pharynx, and Esophagus. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/23-3-the-mouth-pharynx-and-esophagus#fig-ch24_03_01
  - Peroxisome: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Peroxisome”, section 3.2 The Cytoplasm and Cellular Organelles. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/3-2-the-cytoplasm-and-cellular-organelles#fig-ch03_02_05
  - Platelets: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Platelets”, section 18.4 Leukocytes and Platelets. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/18-4-leukocytes-and-platelets#fig-ch19_04_03
  - Podocytes: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Podocytes”, section 25.4 Microscopic Anatomy of the Kidney. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/25-4-microscopic-anatomy-of-the-kidney#fig-ch26_04_01
  - Scapula: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Scapula”, section 8.1 The Pectoral Girdle. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle#fig-ch08_01_03
  - Small Intestine: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Small Intestine”, section 23.5 The Small and Large Intestines. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/23-5-the-small-and-large-intestines#fig-ch24_05_01
  - Sphenoid Bone: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Sphenoid Bone”, section 7.2 The Skull. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/7-2-the-skull#fig-ch07_02_08
  - Stomach: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Stomach”, section 23.4 The Stomach. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/23-4-the-stomach#fig-ch24_04_01
  - Temporal Bone: Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P (2022). Anatomy and Physiology 2e. OpenStax. Figure “Temporal Bone”, section 7.2 The Skull. CC BY 4.0. Access for free at https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction https://openstax.org/books/anatomy-and-physiology-2e/pages/7-2-the-skull#fig-ch07_02_05

- Servier Medical Art (CC BY 4.0, https://smart.servier.com):

  - Adrenal gland: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/adrenal-gland-overview/
  - Bladder: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/bladder/
  - Brain: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/brain/
  - Breast: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/breast/
  - Cardiac muscle cells: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/smart-heart-cells/
  - Cell membrane: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/cell-membrane/
  - Circle of Willis: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/circle-of-willis/
  - Ependymal cell: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/ependymal-cell/
  - Erythrocyte: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/erythrocyte-12/
  - Esophagus: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/esophagus/
  - Gallbladder: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/gallbladder-organ/
  - Golgi apparatus: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/golgi-apparatus/
  - Heart: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/heart/
  - Intermediate filament: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/intermediate-filament/
  - Kidney: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/kidney/
  - Liver: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/liver/
  - Lungs: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/lungs-11/
  - Mitochondria: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/mitochondria/
  - Monocyte: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/monocyte/
  - Mouth: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/mouth/
  - Nucleus: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/nucleus/
  - Ovary: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/ovary-ov/
  - Pancreas: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/pancreas/
  - Platelet: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/platelet/
  - Rough endoplasmic reticulum: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/endoplasmic-reticulum/
  - Skin: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/skin/
  - Spermatozoon: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/spermatozoon/
  - Spleen: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/spleen/
  - Stomach: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/stomach/
  - Testicle: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/testicle/
  - Thymus: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/thymus/
  - Uterus: Image provided by Servier Medical Art (https://smart.servier.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). https://smart.servier.com/smart_image/uterus/

- Gray's Anatomy (1918), https://archive.org/details/anatomyofhumanbo1918gray (public domain in the United States):

  - Fig. 129: Occipital bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 129. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n128/mode/1up
  - Fig. 133: Left parietal bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 133. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n133/mode/1up
  - Fig. 134: Frontal bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 134. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n135/mode/1up
  - Fig. 135: Frontal bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 135. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n136/mode/1up
  - Fig. 138: Left temporal bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 138. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n139/mode/1up
  - Fig. 141: Left temporal bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 141. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n143/mode/1up
  - Fig. 155: Right nasal bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 155. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n156/mode/1up
  - Fig. 158: Left maxilla: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 158. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n158/mode/1up
  - Fig. 166: Left zygomatic bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 166. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n164/mode/1up
  - Fig. 176: Mandible: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 176. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n171/mode/1up
  - Fig. 177: Mandible: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 177. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n172/mode/1up
  - Fig. 200: Left clavicle: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 200. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n200/mode/1up
  - Fig. 205: Left scapula: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 205. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n206/mode/1up
  - Fig. 207: Left humerus: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 207. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n209/mode/1up
  - Fig. 235: Right hip bone: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 235. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n231/mode/1up
  - Fig. 244: Right femur: Gray H. Anatomy of the Human Body, 20th ed., edited by Lewis WH. Philadelphia: Lea & Febiger, 1918. Fig. 244. Public domain in the United States (published 1918). Scan: Internet Archive, digitized by Brigham Young University, Harold B. Lee Library. https://archive.org/details/anatomyofhumanbo1918gray/page/n243/mode/1up

## Neuron and glia reconstructions (NeuroMorpho.Org)

- Source: NeuroMorpho.Org release 8.7, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/; terms of use: https://neuromorpho.org/useterm.jsp).
- Cite with each use: NeuroMorpho.Org (RRID:SCR_002145); Tecuatl C, Ljungquist B, Ascoli GA (2024). Accelerating the continuous community sharing of digital neuromorphology data. FASEB BioAdvances 6(7):207-221. doi:10.1096/fba.2024-00048; and the reconstruction's original paper, listed below with its NeuroMorpho.Org ID.
- Adapted: each standardized (CNG) tracing is drawn as tubes using its recorded radii, scaled onto the stage with a minimum thickness so fine branches stay visible; the nucleus is illustrative, and tracings without a soma get one drawn at their root. Each cell type uses a reconstruction of its own type, or one representing its class (captioned "a representative ... not this subtype specifically"); the full list is reports/neuromorpho.md.

| Shown as | Species | NeuroMorpho.Org ID | Neuron (archive) | Original paper |
| --- | --- | --- | --- | --- |
| layer 5 cortical pyramidal neuron | human | [NMO_01065](https://neuromorpho.org/neuron_info.jsp?neuron_name=07a_pyramidal13aACC) | 07a_pyramidal13aACC (Allman) | Watson KK et al. (2006). Dendritic architecture of the von Economo neurons. Neuroscience. doi:10.1016/j.neuroscience.2006.04.084 |
| somatostatin interneuron | mouse | [NMO_01839](https://neuromorpho.org/neuron_info.jsp?neuron_name=020315-2-ST) | 020315-2-ST (Yuste) | Dumitriu D et al. (2007). Correlation between axonal morphologies and synaptic input kinetics of interneurons from mouse visual cortex. Cereb Cortex. doi:10.1093/cercor/bhj126 |
| olfactory bulb periglomerular cell | mouse | [NMO_05768](https://neuromorpho.org/neuron_info.jsp?neuron_name=M24-S1) | M24-S1 (Mizrahi) | Mizrahi A (2007). Dendritic development and plasticity of adult-born neurons in the mouse olfactory bulb. Nat Neurosci. doi:10.1038/nn1875 |
| amygdala pyramidal neuron | mouse | [NMO_07586](https://neuromorpho.org/neuron_info.jsp?neuron_name=N-1-1-2-3-R) | N-1-1-2-3-R (Lee) | Carim-Todd L et al. (2009). Endogenous truncated TrkB.T1 receptor regulates neuronal complexity and TrkB kinase receptor function in vivo. J Neurosci. doi:10.1523/JNEUROSCI.5060-08.2009 |
| D2 medium spiny neuron; striatal medium spiny neuron | mouse | [NMO_101622](https://neuromorpho.org/neuron_info.jsp?neuron_name=Apr12IR1b) | Apr12IR1b (Luebke) | Goodliffe JW et al. (2018). Differential changes to D1 and D2 medium spiny neurons in the 12-month-old Q175+/- mouse model of Huntington's Disease. PLoS One. doi:10.1371/journal.pone.0200626 |
| D1 medium spiny neuron | mouse | [NMO_101636](https://neuromorpho.org/neuron_info.jsp?neuron_name=Apr12IR2a) | Apr12IR2a (Luebke) | Goodliffe JW et al. (2018). Differential changes to D1 and D2 medium spiny neurons in the 12-month-old Q175+/- mouse model of Huntington's Disease. PLoS One. doi:10.1371/journal.pone.0200626 |
| substantia nigra dopaminergic neuron | mouse | [NMO_104502](https://neuromorpho.org/neuron_info.jsp?neuron_name=MYUX58R-RECONSTRUCCION-CORREGIDA-AIS-AND-SC) | MYUX58R-RECONSTRUCCION-CORREGIDA-AIS-AND-SC (Henny) | Meza RC et al. (2018). Role of the Axon Initial Segment in the Control of Spontaneous Frequency of Nigral Dopaminergic Neurons In Vivo. J Neurosci. doi:10.1523/JNEUROSCI.1432-17.2017 |
| cortical basket cell | human | [NMO_107145](https://neuromorpho.org/neuron_info.jsp?neuron_name=Fig1b_140312-1rm6_int) | Fig1b_140312-1rm6_int (Tamas) | Molnár G et al. (2016). Human pyramidal to interneuron synapses are mediated by multi-vesicular release and multiple docked vesicles. Elife. doi:10.7554/eLife.18167 |
| cortical pyramidal neuron | human | [NMO_107146](https://neuromorpho.org/neuron_info.jsp?neuron_name=Fig1b_140312-1rm6_pyr) | Fig1b_140312-1rm6_pyr (Tamas) | Molnár G et al. (2016). Human pyramidal to interneuron synapses are mediated by multi-vesicular release and multiple docked vesicles. Elife. doi:10.7554/eLife.18167 |
| neurogliaform cell | human | [NMO_107156](https://neuromorpho.org/neuron_info.jsp?neuron_name=Fig2c_cell1_1402022rm) | Fig2c_cell1_1402022rm (Tamas) | Boldog E et al. (2018). Transcriptomic and morphophysiological evidence for a specialized human cortical GABAergic cell type. Nat Neurosci. doi:10.1038/s41593-018-0205-2 |
| nucleus accumbens medium spiny neuron | mouse | [NMO_107441](https://neuromorpho.org/neuron_info.jsp?neuron_name=2-ENU2-treated-neuron2_1) | 2-ENU2-treated-neuron2_1 (Pascucci) | Pascucci T et al. (2018). A new therapy prevents intellectual disability in mouse with phenylketonuria. Mol Genet Metab. doi:10.1016/j.ymgme.2018.03.009 |
| spinal motor neuron | mouse | [NMO_129194](https://neuromorpho.org/neuron_info.jsp?neuron_name=GFP_90) | GFP_90 (Vitriol) | Osking Z et al. (2019). ALS-Linked SOD1 Mutants Enhance Neurite Outgrowth and Branching in Adult Motor Neurons. iScience. doi:10.1016/j.isci.2018.12.026 |
| VIP interneuron | mouse | [NMO_130669](https://neuromorpho.org/neuron_info.jsp?neuron_name=2017-03-07-slice-2-cell-7-rotated) | 2017-03-07-slice-2-cell-7-rotated (Tolias) | Scala F et al. (2019). Layer 4 of mouse neocortex differs in cell types and circuit organization between sensory areas. Nat Commun. doi:10.1038/s41467-019-12058-z |
| thalamocortical relay neuron | mouse | [NMO_130725](https://neuromorpho.org/neuron_info.jsp?neuron_name=19219cell2) | 19219cell2 (VanHook) | Bhandari A et al. (2019). Early-Stage Ocular Hypertension Alters Retinal Ganglion Cell Synaptic Transmission in the Visual Thalamus. Front Cell Neurosci. doi:10.3389/fncel.2019.00426 |
| striatal cholinergic interneuron | mouse | [NMO_141453](https://neuromorpho.org/neuron_info.jsp?neuron_name=6602-1) | 6602-1 (Cai) | Roossien DH et al. (2019). Multispectral tracing in densely labeled mouse brain with nTracer. Bioinformatics. doi:10.1093/bioinformatics/btz084 |
| hippocampal pyramidal neuron | human | [NMO_147058](https://neuromorpho.org/neuron_info.jsp?neuron_name=52-human-hcca-idab1-porta4-sec1-cel17-soma-z-corr-1-7) | 52-human-hcca-idab1-porta4-sec1-cel17-soma-z-corr-1-7 (DeFelipe) | Benavides-Piccione R et al. (2020). Differential Structure of Hippocampal CA1 Pyramidal Neurons in the Human and Mouse. Cereb Cortex. doi:10.1093/cercor/bhz122 |
| oligodendrocyte | mouse | [NMO_152388](https://neuromorpho.org/neuron_info.jsp?neuron_name=TTX_D_52) | TTX_D_52 (Fulton) | Toth E et al. (2021). A morphological analysis of activity-dependent myelination and myelin injury in transitional oligodendrocytes. Sci Rep. doi:10.1038/s41598-021-88887-0 |
| MGE-derived interneuron | mouse | [NMO_157650](https://neuromorpho.org/neuron_info.jsp?neuron_name=6N1-5072019_TileScan-3_Merged_wt10a) | 6N1-5072019_TileScan-3_Merged_wt10a (Mancia-Leon) | Mancia Leon WR et al. (2020). Clustered gamma-protocadherins regulate cortical interneuron programmed cell death. Elife. doi:10.7554/eLife.55374 |
| striatal interneuron | mouse | [NMO_163626](https://neuromorpho.org/neuron_info.jsp?neuron_name=18455_00041-semi_r) | 18455_00041-semi_r (Peng) | Original publication: doi:10.1101/675280 |
| dorsal root ganglion neuron; sensory ganglion neuron | mouse | [NMO_184964](https://neuromorpho.org/neuron_info.jsp?neuron_name=F7_15-LOX1_EE5_DHA40-1_c) | F7_15-LOX1_EE5_DHA40-1_c (Yorek) | Coppey L et al. (2021). Characterization of Mice Ubiquitously Overexpressing Human 15-Lipoxygenase-1: Effect of Diabetes on Peripheral Neuropathy and Treatment with Menhaden Oil. J Diabetes Res. doi:10.1155/2021/5564477 |
| astrocyte | human | [NMO_189666](https://neuromorpho.org/neuron_info.jsp?neuron_name=s5vimpfcwmcell2) | s5vimpfcwmcell2 (Mechawar) | O'Leary LA et al. (2021). Widespread Decrease of Cerebral Vimentin-Immunoreactive Astrocytes in Depressed Suicides. Front Psychiatry. doi:10.3389/fpsyt.2021.640963 |
| hippocampal astrocyte | rat | [NMO_190426](https://neuromorpho.org/neuron_info.jsp?neuron_name=Naive-195-2) | Naive-195-2 (Kodali_Shetty) | Kodali M et al. (2021). Moderate, intermittent voluntary exercise in a model of Gulf War Illness improves cognitive and mood function with alleviation of activated microglia and astrocytes, and enhanced neurogenesis in the hippocampus. Brain Behav Immun. doi:10.1016/j.bbi.2021.07.005 |
| Müller glial cell | mouse | [NMO_190685](https://neuromorpho.org/neuron_info.jsp?neuron_name=cell12_ko_older_traces) | cell12_ko_older_traces (Feller) | Tworig JM et al. (2021). Excitatory neurotransmission activates compartmentalized calcium transients in Müller glia without affecting lateral process motility. Elife. doi:10.7554/eLife.73202 |
| retinal horizontal cell | monkey | [NMO_194109](https://neuromorpho.org/neuron_info.jsp?neuron_name=c2795) | c2795 (Patterson_Neitz) | Patterson SS et al. (2019). An S-cone circuit for edge detection in the primate retina. Sci Rep. doi:10.1038/s41598-019-48042-2 |
| OFF bipolar cell | monkey | [NMO_194111](https://neuromorpho.org/neuron_info.jsp?neuron_name=c142_Scone) | c142_Scone (Patterson_Neitz) | Patterson SS et al. (2019). An S-cone circuit for edge detection in the primate retina. Sci Rep. doi:10.1038/s41598-019-48042-2 |
| ON bipolar cell | monkey | [NMO_194124](https://neuromorpho.org/neuron_info.jsp?neuron_name=c238) | c238 (Patterson_Neitz) | Patterson SS et al. (2019). An S-cone circuit for edge detection in the primate retina. Sci Rep. doi:10.1038/s41598-019-48042-2 |
| midget ganglion cell | monkey | [NMO_194130](https://neuromorpho.org/neuron_info.jsp?neuron_name=c1441_Scone) | c1441_Scone (Patterson_Neitz) | Patterson SS et al. (2019). An S-cone circuit for edge detection in the primate retina. Sci Rep. doi:10.1038/s41598-019-48042-2 |
| dentate gyrus granule cell | human | [NMO_275838](https://neuromorpho.org/neuron_info.jsp?neuron_name=H16-06-013-05-08-01_575586329_m_DendriteAxon) | H16-06-013-05-08-01_575586329_m_DendriteAxon (Allen Cell Types) | Buchin A et al. (2022). Multi-modal characterization and simulation of human epileptic circuitry. Cell Rep. doi:10.1016/j.celrep.2022.111873 |
| layer 6 cortical pyramidal neuron | human | [NMO_290938](https://neuromorpho.org/neuron_info.jsp?neuron_name=2576_Mohan_etal_2015) | 2576_Mohan_etal_2015 (DeKock) | Mohan H et al. (2015). Dendritic and Axonal Architecture of Individual Pyramidal Neurons across Layers of Adult Human Neocortex. Cereb Cortex. doi:10.1093/cercor/bhv188 |
| autonomic ganglion neuron; sympathetic ganglion neuron | rat | [NMO_298111](https://neuromorpho.org/neuron_info.jsp?neuron_name=12-8-22-EARLY_a) | 12-8-22-EARLY_a (Sanchez-Alonso) | Mohammadi N et al. (2025). Sympathetic neurons can modify the intrinsic structural and functional properties of human pluripotent stem cell-derived cardiomyocytes. J Physiol. doi:10.1113/JP287569 |
| microglial cell | human | [NMO_301524](https://neuromorpho.org/neuron_info.jsp?neuron_name=634_55_4_066) | 634_55_4_066 (Seney) | Yoblinski AR et al. (2025). Brain region and sex differences in human microglia morphology and function. Cereb Cortex. doi:10.1093/cercor/bhaf120 |
| cerebellar basket cell | human | [NMO_32551](https://neuromorpho.org/neuron_info.jsp?neuron_name=189-1-11dw) | 189-1-11dw (Jacobs) | Jacobs B et al. (2014). Comparative neuronal morphology of the cerebellar cortex in afrotherians, carnivores, cetartiodactyls, and primates. Front Neuroanat. doi:10.3389/fnana.2014.00024 |
| oligodendrocyte precursor (NG2) cell | mouse | [NMO_52273](https://neuromorpho.org/neuron_info.jsp?neuron_name=C11-processes) | C11-processes (Fulton) | Fannon J et al. (2015). Neuronal activity and AMPA-type glutamate receptor activation regulates the morphological development of oligodendrocyte precursor cells. Glia. doi:10.1002/glia.22799 |
| amacrine cell | human | [NMO_53278](https://neuromorpho.org/neuron_info.jsp?neuron_name=humret_CR_AII_63x_2) | humret_CR_AII_63x_2 (Kantor) | Kántor O et al. (2016). Calcium buffer proteins are specific markers of human retinal neurons. Cell Tissue Res. doi:10.1007/s00441-016-2376-z |
| retinal bipolar cell | human | [NMO_53289](https://neuromorpho.org/neuron_info.jsp?neuron_name=humret_GBB_63x_11) | humret_GBB_63x_11 (Kantor) | Kántor O et al. (2016). Calcium buffer proteins are specific markers of human retinal neurons. Cell Tissue Res. doi:10.1007/s00441-016-2376-z |
| CGE-derived interneuron | mouse | [NMO_66355](https://neuromorpho.org/neuron_info.jsp?neuron_name=110909-05) | 110909-05 (McBain) | Matta JA et al. (2013). Developmental origin dictates interneuron AMPA and NMDA receptor subunit composition and plasticity. Nat Neurosci. doi:10.1038/nn.3459 |
| globus pallidus neuron | mouse | [NMO_85004](https://neuromorpho.org/neuron_info.jsp?neuron_name=AA0017) | AA0017 (MouseLight) | Gerfen CR et al. (2018). Long distance projections of cortical pyramidal neurons. J Neurosci Res. doi:10.1002/jnr.23978 |
| retinal ganglion cell | human | [NMO_87059](https://neuromorpho.org/neuron_info.jsp?neuron_name=LPC13_01_2015_13_38_54id1448Z65sdx20ov10_1a) | LPC13_01_2015_13_38_54id1448Z65sdx20ov10_1a (Hannibal) | Hannibal J et al. (2017). Melanopsin expressing human retinal ganglion cells: Subtypes, distribution, and intraretinal connectivity. J Comp Neurol. doi:10.1002/cne.24181 |
| subthalamic nucleus neuron | mouse | [NMO_97833](https://neuromorpho.org/neuron_info.jsp?neuron_name=20160111_sham1) | 20160111_sham1 (Bevan_Chu) | Chu HY et al. (2017). Loss of Hyperdirect Pathway Cortico-Subthalamic Inputs Following Degeneration of Midbrain Dopamine Neurons. Neuron. doi:10.1016/j.neuron.2017.08.038 |
