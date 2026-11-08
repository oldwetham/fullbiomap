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
- Histology: Human Protein Atlas 25.1 (released 2026-05-25), CC BY 4.0, https://www.proteinatlas.org/about/licence. Uhlén M et al. (2015), Tissue-based map of the human proteome, Science 347:1260419. One immunohistochemistry image per organ: the protein is stained brown (DAB) and cell nuclei blue (hematoxylin). Images are HPA's representative image for that gene and tissue, unmodified.

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

- 2D functional tissue units: HRA v2.5 illustrations (CC BY 4.0), shown unmodified. Each illustration's HRA crosswalk (CC BY 4.0) links the cells it draws to Cell Ontology ids, which makes those cells clickable in the illustration viewer; the viewer highlights a cell type by drawing copies of its shapes on top and does not change the file:

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
