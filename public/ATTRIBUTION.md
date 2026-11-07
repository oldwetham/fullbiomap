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

## Historical assets (not included in the current release)

Earlier repository revisions included female reference anatomy: Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP, *3D Reference Organ Set for Female v1.5* (2023). CC BY 4.0. Geometry adapted for this viewer.

- Source DOI: https://doi.org/10.48539/HBM352.BTSQ.586
- Dataset: https://lod.humanatlas.io/ref-organ/united-female/v1.5
- Original GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb
- License: https://creativecommons.org/licenses/by/4.0/

Adaptations: translated native meter/Y-up coordinates onto the stage, coincident vertices welded and source normals averaged, geometry simplified with a 0.2% per-structure relative error bound, and normals quantized. Colors and display systems are curated for this interface. All 888 source meshes are represented, with 1,073 source nodes available as selectable individual or compound concepts.

This is a reference assembly with whole-body surface and selected organs, including female reproductive anatomy. Its skeleton and muscle coverage is partial. It is not a complete model of every human structure or a single-person scan. Eight placenta/umbilical structures are classified under Pregnancy reference and hidden by default.
