# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.
A release listed with no entries carried no Conventional Commit in this package's
scope: scripts/release-plan.mjs re-releases a package whenever any of its files
change, not only on conventional ones.

## [3.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.4.0) - 2026-09-05

### Features

- **core:** Close ECMA-376 parse/serialize gaps from the 2026-09 parity audit (by @ChristopherVR) ([91ddcb7](https://github.com/ChristopherVR/pptx-viewer/commit/91ddcb7a53f67c7f52a9b9c16f00365d5f2f73ef))
- **core:** Close the remaining OpenXML parity gaps (wave 2) (by @ChristopherVR) ([59fecbf](https://github.com/ChristopherVR/pptx-viewer/commit/59fecbff7c44809640a3ea75d92491f3c93d67d1))

### Bug Fixes

- Clip pictures by their own shape geometry in every binding ([#202](https://github.com/ChristopherVR/pptx-viewer/issues/202)) (by @nikko82) ([6027607](https://github.com/ChristopherVR/pptx-viewer/commit/6027607329e28591ede5a93af5bf5760d9fc1585))

### Testing

- **core:** Declare the wave-2 e2e fixtures in the corpus manifest (by @ChristopherVR) ([593d3ba](https://github.com/ChristopherVR/pptx-viewer/commit/593d3ba1a807e3e712b41c372bd5f7c65ea396bc))

## [3.3.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.3.4) - 2026-09-03

### Bug Fixes

- **core:** Preserve fractional table font sizes ([#210](https://github.com/ChristopherVR/pptx-viewer/issues/210)) (by @Sudhansh6) ([3f0c1ba](https://github.com/ChristopherVR/pptx-viewer/commit/3f0c1ba908692715a9c9d745ee58fae4c30d893d))

## [3.3.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.3.3) - 2026-09-03

### Bug Fixes

- Preserve table-cell font sizes across renderers ([#208](https://github.com/ChristopherVR/pptx-viewer/issues/208)) (by @Sudhansh6) ([8c2d97d](https://github.com/ChristopherVR/pptx-viewer/commit/8c2d97d81fdaa3781ebd95bdf0fb04af79d42b84))

## [3.3.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.3.2) - 2026-09-03

### Bug Fixes

- **core,shared:** Preserve numbered text through edits ([#204](https://github.com/ChristopherVR/pptx-viewer/issues/204)) (by @Sudhansh6) ([9b5e9aa](https://github.com/ChristopherVR/pptx-viewer/commit/9b5e9aa2829cbaaa8a1bac643136fde62b6d634d))

## [3.3.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.3.1) - 2026-09-02

### Bug Fixes

- **core:** Preserve custom-geometry command order through placeholder merges (by @ChristopherVR) ([29af002](https://github.com/ChristopherVR/pptx-viewer/commit/29af002ba54e514aa0dd4a2b80dedf3ea6d92b3f))
- **core:** Regenerate slide background when an image is explicitly cleared (by @ChristopherVR) ([c43e1ea](https://github.com/ChristopherVR/pptx-viewer/commit/c43e1ea3bd48a970422fb40cd867deeefc38aed7))
- Recolour template-layer shapes on a live theme colour-scheme edit (by @ChristopherVR) ([34c3935](https://github.com/ChristopherVR/pptx-viewer/commit/34c3935daa5e3e6a18c3b2871fb25fe7e2c80bfa))
- **core:** Round-trip Hide Background Graphics (@showMasterSp) on save (by @ChristopherVR) ([75ac54f](https://github.com/ChristopherVR/pptx-viewer/commit/75ac54f9f4bc46ce5f11cb44a5ecbc3ce9369dab))

## [3.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.3.0) - 2026-09-02

### Features

- **core:** Master/layout CRUD, legacy comment threading, extended ppaction verbs (by @ChristopherVR) ([033b024](https://github.com/ChristopherVR/pptx-viewer/commit/033b024a70d041cf884aafb47dbc35e9d2ed10f6))

## [3.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.2.0) - 2026-09-02

### Features

- **core:** Parse and save bar3D shape, radar style and surface wireframe (by @ChristopherVR) ([1f46205](https://github.com/ChristopherVR/pptx-viewer/commit/1f46205a1f1280df55baf990a3ed496e308233a2))

### Bug Fixes

- **core:** Close OpenXML round-trip gaps in charts, pictures, tables, text and structure (by @ChristopherVR) ([9780265](https://github.com/ChristopherVR/pptx-viewer/commit/9780265ead99aba7f9e3fde80c0527eaed4f8d17))
- **core:** Write gridline elements on generated chart axes (by @ChristopherVR) ([0d03c1a](https://github.com/ChristopherVR/pptx-viewer/commit/0d03c1a17c29499e234cc7e836a55e2d29bd2716))
- **core:** Snapshot baked-in a14 corrections next to the live values (by @ChristopherVR) ([9e6cc01](https://github.com/ChristopherVR/pptx-viewer/commit/9e6cc01181e481d6e3132cc086c6f85c1c80fd44))

### Testing

- **e2e:** Pin the webfont fallback probe across the five bindings (by @nikko82) ([aabb9dd](https://github.com/ChristopherVR/pptx-viewer/commit/aabb9dd226fc08df63f270aef080936d9f602268))

## [3.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.1.3) - 2026-09-01

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#186](https://github.com/ChristopherVR/pptx-viewer/issues/186)) (by @dependabot[bot]) ([effb251](https://github.com/ChristopherVR/pptx-viewer/commit/effb2510e3a6cf633ceb3dd0c1234bb0998c275c))

## [3.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.1.2) - 2026-08-29

### Bug Fixes

- **animation:** Preserve authored PowerPoint playback and rendering ([#185](https://github.com/ChristopherVR/pptx-viewer/issues/185)) (by @primerch) ([628be23](https://github.com/ChristopherVR/pptx-viewer/commit/628be23999fb116d11cde2a5f62aac941416a1f5))

## [3.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.1.1) - 2026-08-28

### Bug Fixes

- **core:** Reindex chart data-point overrides after removing a category (by @ChristopherVR) ([7bd64f8](https://github.com/ChristopherVR/pptx-viewer/commit/7bd64f821d66d1bc7b3f91f46a3e262eda1072ee))

## [3.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.1.0) - 2026-08-28

### Features

- **core:** Decrypt RC4-encrypted legacy .ppt files (by @ChristopherVR) ([b95adc7](https://github.com/ChristopherVR/pptx-viewer/commit/b95adc74f036eefd4d44af441fa600512ff44282))
- **ole:** Make embedded OLE objects' Object Name editable (by @ChristopherVR) ([e06b32c](https://github.com/ChristopherVR/pptx-viewer/commit/e06b32c1b4e9375c37916097b494ab05bf4b7850))
- **shared:** Add Pareto as an insertable chart type (by @ChristopherVR) ([8fea110](https://github.com/ChristopherVR/pptx-viewer/commit/8fea110ef6aa4036fee97f232f4f7d8ecd5f7b94))
- **core:** Support writing ECMA-376 Standard scheme encryption (by @ChristopherVR) ([210d2a2](https://github.com/ChristopherVR/pptx-viewer/commit/210d2a22603467092f667f031bc7881f7e7833bf))
- **shared:** Apply the shadeToTitle background gradient effect (by @ChristopherVR) ([f287389](https://github.com/ChristopherVR/pptx-viewer/commit/f2873891828125b315f2cae2155824c84609626f))
- **core:** Allow animation drag-to-reorder across deck-native effects (by @ChristopherVR) ([6f48a34](https://github.com/ChristopherVR/pptx-viewer/commit/6f48a3455338c78f34c4d0978bcc4cf0be075db2))
- Author animation effect sound and after-animation controls (by @ChristopherVR) ([78daeb4](https://github.com/ChristopherVR/pptx-viewer/commit/78daeb4276733fe5ed048872d262a8cf080bfc3b))
- **shared:** Honour animRot/animScale absolute values, tavLst, txEl ranges, p:excl and bldLvl in playback (by @ChristopherVR) ([f71396b](https://github.com/ChristopherVR/pptx-viewer/commit/f71396bbc1309909aa3eecfd4855268f4e6fbfac))
- Author and embed transition sounds from the ribbon Sound picker (by @ChristopherVR) ([ada8cdb](https://github.com/ChristopherVR/pptx-viewer/commit/ada8cdb65a0689660b9afc852d0a85e2a1b04534))
- **ink:** Retain pen-tilt InkML channels and render a calligraphic nib (by @ChristopherVR) ([6adab79](https://github.com/ChristopherVR/pptx-viewer/commit/6adab79f7cf8ae19346c3e74d34413cccd2eb08f))
- **core,shared:** Surface p:tavLst attrName, honour colour ramps (by @ChristopherVR) ([2ccf45f](https://github.com/ChristopherVR/pptx-viewer/commit/2ccf45fbcb23da9e0084769c0895b35cfc027326))

### Bug Fixes

- Author Draw-tab ink as a PowerPoint-compatible content part (by @ChristopherVR) ([d91ce08](https://github.com/ChristopherVR/pptx-viewer/commit/d91ce08757c3697eab6891808e527c5e1eaea555))
- **animation:** Correct swapped exit/emphasis presets, cover 4 more IDs (by @ChristopherVR) ([11c2d2e](https://github.com/ChristopherVR/pptx-viewer/commit/11c2d2e8e68b0539c9920d8c6de4de93ca2cc5e1))
- **core:** Honour text-run reflection scale/skew/rotation/fade/anchor (by @ChristopherVR) ([41dfa76](https://github.com/ChristopherVR/pptx-viewer/commit/41dfa76c9540136b5c09fee52e21d8d0bc3e079c))
- **core:** Author Draw-tab ink InkML that real PowerPoint actually opens (by @ChristopherVR) ([38633c7](https://github.com/ChristopherVR/pptx-viewer/commit/38633c7f25af358c24ea91c42019ad76b786ca54))

### Testing

- **core:** Cover lte/equ ops and multi-hop bounds for SmartArt constraints (by @ChristopherVR) ([3d8c5a0](https://github.com/ChristopherVR/pptx-viewer/commit/3d8c5a08c85f7652dd2ba08cf9e345f98a767f8c))

### Chores

- Reformat limitations.md table and a core test after merge (by @ChristopherVR) ([d9db1f7](https://github.com/ChristopherVR/pptx-viewer/commit/d9db1f7c32e0ee7383837ac6db668e10a6060752))
- Fix oxfmt comment placement in ppt-import.test.ts (by @ChristopherVR) ([7cb2d3d](https://github.com/ChristopherVR/pptx-viewer/commit/7cb2d3dabe470f4a0ad2a2023d90a1f9642d2c28))

## [3.0.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.0.2) - 2026-08-26

### Dependencies

- **deps:** Update fast-xml-parser requirement from ^5.10.1 to ^5.11.0 ([#177](https://github.com/ChristopherVR/pptx-viewer/issues/177)) (by @dependabot[bot]) ([a876e0f](https://github.com/ChristopherVR/pptx-viewer/commit/a876e0f5fd07fd2e7063619882313cc23c4a0162))

## [3.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.0.1) - 2026-08-22

### Bug Fixes

- **core:** Spell the SmartArt role sentinel as a unicode escape (by @ChristopherVR) ([a2d4993](https://github.com/ChristopherVR/pptx-viewer/commit/a2d4993390bcdc28a3b24c1bf501c64f638f68d9))

## [3.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@3.0.0) - 2026-08-22

### Features

- **core:** Unify SmartArt layout onto one DiagramML interpreter (by @ChristopherVR) ([89116b1](https://github.com/ChristopherVR/pptx-viewer/commit/89116b131a3f13fb6b65789c46d3f9a7814d04db))
- **core:** Write chart edits back to the embedded workbook (by @ChristopherVR) ([dee19fc](https://github.com/ChristopherVR/pptx-viewer/commit/dee19fc69b02ad36eadd39f48e589de9e76689fa))
- **core:** Solve relative SmartArt constraints and apply org-chart hints (by @ChristopherVR) ([65eee20](https://github.com/ChristopherVR/pptx-viewer/commit/65eee20e9e772ab40317df0ba1acf0c26a412973))
- **core:** Author tag elements, model embedTrueTypeFonts, and add a text-style edit path (by @ChristopherVR) ([0048d16](https://github.com/ChristopherVR/pptx-viewer/commit/0048d163c6dd87d7a0bdc3207cbcbd4db39f8d0e))
- **core,shared:** Serialize data-table styling, and paint 3D chart surfaces (by @ChristopherVR) ([bd9595a](https://github.com/ChristopherVR/pptx-viewer/commit/bd9595a7bae6c545a649ff8e1929b27a638fcb5b))
- **core:** Honour per-node shapes, style roles and connector text in SmartArt (by @ChristopherVR) ([c823fca](https://github.com/ChristopherVR/pptx-viewer/commit/c823fca506f99e3c4f42ec11513e56cdb30f9a68))
- **core,shared:** Model timing templates and play animEffect filters (by @ChristopherVR) ([8bf91f2](https://github.com/ChristopherVR/pptx-viewer/commit/8bf91f20c907f9d92abbcd5a59fb424ddfabdbd8))
- **core,shared:** Cross-browser reflections, overlay fills, and remaining text gaps (by @ChristopherVR) ([c0b0d6d](https://github.com/ChristopherVR/pptx-viewer/commit/c0b0d6d6805c6383ba2a01da3c8a22792eb22cdb))

### Bug Fixes

- **core:** Close five OpenXML parse and serialize fidelity gaps (by @ChristopherVR) ([641b0b2](https://github.com/ChristopherVR/pptx-viewer/commit/641b0b21d82442262f3f2d0e4ed2894cd71c07e9))
- **core,shared:** Correct animation preset IDs against PowerPoint COM ground truth (by @ChristopherVR) ([61b0014](https://github.com/ChristopherVR/pptx-viewer/commit/61b001440de0bf73bfcd6efd21c8df21bd47e5c8))
- **core,shared:** Honour cTn timing attributes, after-animation and effect sound (by @ChristopherVR) ([07ee51f](https://github.com/ChristopherVR/pptx-viewer/commit/07ee51f8b11431153e9ce2553c4c11a51e15316e))
- **core:** Close slide-structure, notes-style and DrawingML parse gaps (by @ChristopherVR) ([ee1dbcd](https://github.com/ChristopherVR/pptx-viewer/commit/ee1dbcd3278e2bde7b066c4085a82f56cc818f6a))

### Documentation

- **core:** Record audited OpenXML construct coverage in the manifest (by @ChristopherVR) ([812fe61](https://github.com/ChristopherVR/pptx-viewer/commit/812fe61e66687a48c2cd19eeb0c502767c25e3c1))

### Testing

- **core:** Evidence previously unverified OpenXML constructs, and record what is not implemented (by @ChristopherVR) ([4dc6028](https://github.com/ChristopherVR/pptx-viewer/commit/4dc602876bd49cdb03b084f9f4fa2268aa01f22f))

### Chores

- **core:** Complete barrel and runtime wiring for the preceding two changes (by @ChristopherVR) ([115379e](https://github.com/ChristopherVR/pptx-viewer/commit/115379e9a757b029fbc0cbb74ae51628f7fb3e27))

## [2.3.14](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.14) - 2026-08-21

### Bug Fixes

- **core,vue:** Compute elbow/curved connector routing from actual shape geometry (by @ChristopherVR) ([f2882a1](https://github.com/ChristopherVR/pptx-viewer/commit/f2882a11d16253683c82b04463442f6e80b7d507))

### Documentation

- **core:** Correct stale OLE and SmartArt capability text (by @ChristopherVR) ([0c7e68d](https://github.com/ChristopherVR/pptx-viewer/commit/0c7e68d66cf27fdc35f31d9fa06faab0d287a16c))
- **core:** Certify DrawingML line/stroke properties in the OpenXML coverage manifest (by @ChristopherVR) ([caa2570](https://github.com/ChristopherVR/pptx-viewer/commit/caa2570d508b4904d8f541a392933da7be50dc32))

## [2.3.13](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.13) - 2026-08-21

### Bug Fixes

- **core:** Restore mc:AlternateContent envelope on passthrough template save (by @ChristopherVR) ([1659244](https://github.com/ChristopherVR/pptx-viewer/commit/165924427f0a2e1f834e1b24d7237a1c0125d8f6))
- **core:** Stop baking theme effectRef into a literal effectLst on save (by @ChristopherVR) ([59a5566](https://github.com/ChristopherVR/pptx-viewer/commit/59a5566aef9304d4f2a31c6b4e2f95f86841dd8f))
- **core:** Read line-family chart series colors on any chart, not just combo (by @ChristopherVR) ([e62dfcf](https://github.com/ChristopherVR/pptx-viewer/commit/e62dfcf2a6850a86944730f752b321c08b44e477))
- **core:** Write line-family chart series colors into a:ln, not a corrupting spPr (by @ChristopherVR) ([5b54357](https://github.com/ChristopherVR/pptx-viewer/commit/5b54357646ca63723944bbf44f8ac7c23912e035))

## [2.3.12](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.12) - 2026-08-21

### Bug Fixes

- **core:** Parse full custom geometry on pictures, not just path data (by @ChristopherVR) ([b6cbef6](https://github.com/ChristopherVR/pptx-viewer/commit/b6cbef64296fade4b1a0c77c32847e68ea0a18c5))

## [2.3.11](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.11) - 2026-08-20

### Bug Fixes

- **ci:** Resolve oxlint errors and warnings blocking CI lint job (by @ChristopherVR) ([a2031be](https://github.com/ChristopherVR/pptx-viewer/commit/a2031bedb27a4d1bf7c0cf754ce6b81a241972e5))
- **core:** Correct EOT header parsing for version 0x00020001 containers (by @ChristopherVR) ([e43720e](https://github.com/ChristopherVR/pptx-viewer/commit/e43720ed176c62e0779ddb6fd3fdffc08ba19bbd))
- **core:** Size table graphic frames from their grid extent (by @ChristopherVR) ([6d75c18](https://github.com/ChristopherVR/pptx-viewer/commit/6d75c18072cc0bb305b6550767dab780314d8dee))
- **core:** Accept Strict-OOXML lexical percentages in table style tint/shade (by @ChristopherVR) ([8fa8111](https://github.com/ChristopherVR/pptx-viewer/commit/8fa81117e68a9033c37ddd4cf61703100234171c))
- **core:** Stabilize Strict-conformance resaves (by @ChristopherVR) ([3c43f51](https://github.com/ChristopherVR/pptx-viewer/commit/3c43f5164d1e13edbc3d6e5450e66fd08664d108))
- **core:** Correct the Strict custom/extended-properties namespace mapping (by @ChristopherVR) ([d5001f9](https://github.com/ChristopherVR/pptx-viewer/commit/d5001f9f4b977fd0a76d31c0fef534ff1a53bea3))
- **core:** Stop a paragraph's alignment from leaking onto later paragraphs (by @ChristopherVR) ([c18b1e7](https://github.com/ChristopherVR/pptx-viewer/commit/c18b1e7161b4d6e5983c1542cbd2c7fe03081037))
- **core:** Keep SmartArt cached line-preset shapes with zero width or height (by @ChristopherVR) ([41e3059](https://github.com/ChristopherVR/pptx-viewer/commit/41e30596c4072295b6af3c50439c3966acae2b71))

## [2.3.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.10) - 2026-08-19

### Bug Fixes

- **core:** Correct OOXML a:tint colour math (ECMA-376 20.1.2.3.32) (by @ChristopherVR) ([7cf29f3](https://github.com/ChristopherVR/pptx-viewer/commit/7cf29f321994b7e9df8fe11d821a2c2fe686e1cd))
- **core:** Don't clone an arbitrary slide onto a new blank slide (by @ChristopherVR) ([1bd1bd6](https://github.com/ChristopherVR/pptx-viewer/commit/1bd1bd6be1aa657b89ef5782e5d3c466686102c4))
- **core:** Don't bind special placeholders to untyped ones by idx alone (by @ChristopherVR) ([d92eb11](https://github.com/ChristopherVR/pptx-viewer/commit/d92eb11095ee390a596126acc59c8dd9cc18f8a8))
- **core:** Resolve layout-switch geometry from the master when omitted (by @ChristopherVR) ([a09aa5a](https://github.com/ChristopherVR/pptx-viewer/commit/a09aa5a306e160954bbc09052444ad22ab4385a1))
- **core:** Reverse the GUID-derived XOR key for font de/obfuscation (by @ChristopherVR) ([7733edf](https://github.com/ChristopherVR/pptx-viewer/commit/7733edf62f9f9a307c470dd93cfba36c8dbb9339))
- **core:** Drop untouched placeholder prompts on repeated layout switch (by @ChristopherVR) ([8842223](https://github.com/ChristopherVR/pptx-viewer/commit/884222317ad7da002e28e6272257bb4563b89fb2))

## [2.3.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.9) - 2026-08-19

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#162](https://github.com/ChristopherVR/pptx-viewer/issues/162)) (by @dependabot[bot]) ([2645f25](https://github.com/ChristopherVR/pptx-viewer/commit/2645f258a35282b61960c30649f216e583879f12))

## [2.3.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.8) - 2026-08-14

### Bug Fixes

- **vanilla:** Repair the properties panel, inline editor, mobile chrome and show performance (by @ChristopherVR) ([47265ef](https://github.com/ChristopherVR/pptx-viewer/commit/47265efba9459359695bdcd74038b8b6d0787d0f))

### Testing

- Mask the fields that legitimately move, and size two waits for CI (by @ChristopherVR) ([68bae19](https://github.com/ChristopherVR/pptx-viewer/commit/68bae19fe8cb3e283e2c87a90d31946c48be5e3a))

## [2.3.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.7) - 2026-08-13

### Bug Fixes

- **core:** Repair the XML plumbing four separate defects were hiding behind (by @ChristopherVR) ([8beb664](https://github.com/ChristopherVR/pptx-viewer/commit/8beb66410975d492118120515bbae6cd070ef792))

## [2.3.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.6) - 2026-08-13

### Bug Fixes

- **core:** Stop save rewriting what the author never wrote (by @ChristopherVR) ([6fb2767](https://github.com/ChristopherVR/pptx-viewer/commit/6fb2767583de0e82747c3700e3311869dd693a1d))

## [2.3.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.5) - 2026-08-13

### Bug Fixes

- **core:** Repair save-pipeline corruption found by the OpenXML parity audit (by @ChristopherVR) ([554006e](https://github.com/ChristopherVR/pptx-viewer/commit/554006e004b6212f5561eb19954bbcff17bbdf7f))
- **core:** Close the round-trip defects the corpus harness exposed (by @ChristopherVR) ([2011c66](https://github.com/ChristopherVR/pptx-viewer/commit/2011c664049bfd580801529c3337ba65bd8d3f13))

## [2.3.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.4) - 2026-08-10

### Bug Fixes

- **core:** Read placeholder, list and percentage values as authored (by @ChristopherVR) ([dc2d679](https://github.com/ChristopherVR/pptx-viewer/commit/dc2d679d48d3be854743d3a09bd2e20c5dc5331f))

## [2.3.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.3) - 2026-08-10

### Bug Fixes

- **shared:** Morph a picture's scale, which OOXML stores as a source crop (by @ChristopherVR) ([e2743c7](https://github.com/ChristopherVR/pptx-viewer/commit/e2743c7509090272f4d7bed6df506402de8f6a91))

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#150](https://github.com/ChristopherVR/pptx-viewer/issues/150)) (by @dependabot[bot]) ([ab75bf1](https://github.com/ChristopherVR/pptx-viewer/commit/ab75bf10a96bb2a0da6e963a5b6b8634e4f73d5b))

## [2.3.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.2) - 2026-08-07

### Bug Fixes

- **core:** Measure parallelogram skew against the short side, not the width (by @ChristopherVR) ([fea647f](https://github.com/ChristopherVR/pptx-viewer/commit/fea647f94633e6e919a1c59bda7a71cda8b1b677))
- **core:** Bulge the teardrop preset's point outwards, not inwards (by @ChristopherVR) ([0b23bc4](https://github.com/ChristopherVR/pptx-viewer/commit/0b23bc4b6ecde5f82f7cebb0601859edbf1ab399))
- Render ellipses as ellipses, not pills (by @ChristopherVR) ([b6d2598](https://github.com/ChristopherVR/pptx-viewer/commit/b6d2598fb58f8fc81fbef463c728d87a78c129b4))

## [2.3.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.1) - 2026-08-07

### Bug Fixes

- **core:** Recognize nodeType="afterEffect" when parsing animation triggers (by @ChristopherVR) ([554c077](https://github.com/ChristopherVR/pptx-viewer/commit/554c077b6d0960c5777163a83afe27ee9795b8c2))

## [2.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.3.0) - 2026-08-07

### Features

- **core:** Import legacy PowerPoint 97-2003 (.ppt) files (by @ChristopherVR) ([6f71bd3](https://github.com/ChristopherVR/pptx-viewer/commit/6f71bd31270afac2bdc3df4ad082a3e08d5b3e75))
- **core:** Export and import decks as portable JSON (by @ChristopherVR) ([965fc05](https://github.com/ChristopherVR/pptx-viewer/commit/965fc05ce0993d97a15d6199c8763eada99fa646))
- **shared:** Blackboard mode, element rename and column charts (by @ChristopherVR) ([a69ffce](https://github.com/ChristopherVR/pptx-viewer/commit/a69ffce0a7635632cf19cb060b329a8ff5d19422))

### Bug Fixes

- **core:** Stop inferring motion-path auto-rotate from rAng (by @ChristopherVR) ([32ee041](https://github.com/ChristopherVR/pptx-viewer/commit/32ee041249ebd5f761f54275bb98148548c7364e))
- **core:** Read line-series colours from a:ln/a:solidFill (by @ChristopherVR) ([714c10a](https://github.com/ChristopherVR/pptx-viewer/commit/714c10a2b29843dbb8481c98330db0f29a509b2d))

## [2.2.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.2.2) - 2026-08-05

### Bug Fixes

- **core:** Resolve styled full font names and add condensed fallbacks (by @ChristopherVR) ([26b1f74](https://github.com/ChristopherVR/pptx-viewer/commit/26b1f745929fe33cda2044dc4a24ff4edbbab0d5))

## [2.2.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.2.1) - 2026-08-05

### Bug Fixes

- **core:** Resolve omitted-lvl paragraphs through lvl1pPr, defPPr beneath (by @ChristopherVR) ([af1cb66](https://github.com/ChristopherVR/pptx-viewer/commit/af1cb669b93757b2eb99ab0e9cb1a91de96d6d75))
- **core:** Play p14/p15 transitions written as mc:Choice direct children (by @ChristopherVR) ([b6877a6](https://github.com/ChristopherVR/pptx-viewer/commit/b6877a6b26bba9bb7ff7ca93e031878be91e507f))
- **core:** Resolve transition and timing across multiple mc envelopes (by @ChristopherVR) ([3e16e9e](https://github.com/ChristopherVR/pptx-viewer/commit/3e16e9eb5e5b8aae9b741b45e0ae482652c2a1eb))
- **shared:** Cross-slide audio foundation + visibility pause for slide shows (by @ChristopherVR) ([21ce9e0](https://github.com/ChristopherVR/pptx-viewer/commit/21ce9e08a9d4b05f285563ada8195273444e9ed4))
- **core:** Model a:stretch/a:fillRect as frame placement, not source crop (by @ChristopherVR) ([bbb7fc4](https://github.com/ChristopherVR/pptx-viewer/commit/bbb7fc4ee0841ece6bbab7eaf0c03b2380a3960c))

## [2.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.2.0) - 2026-08-01

### Features

- Fixed graphs and arrows shapes (by @ChristopherVR) ([94813f5](https://github.com/ChristopherVR/pptx-viewer/commit/94813f52a75fb3b42f72e7c33be41393b794cf82))

## [2.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.1.2) - 2026-08-01

### Bug Fixes

- Skip hidden slides in the show, and honour endWithBlackSlide (by @ChristopherVR) ([2a9ef49](https://github.com/ChristopherVR/pptx-viewer/commit/2a9ef49f97f976eb088a2fcc092b56a54b112fa3))
- Give every binding React's slide-show bar, and make slice clicks work (by @ChristopherVR) ([31f30f7](https://github.com/ChristopherVR/pptx-viewer/commit/31f30f7f26117e3badb34c2e2e0a29f32f8da608))

## [2.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.1.1) - 2026-07-31

### Bug Fixes

- **core:** Stop dropping a:pPr/@lvl when a paragraph's runs share one style (by @ChristopherVR) ([03aa4ed](https://github.com/ChristopherVR/pptx-viewer/commit/03aa4edeea15336b032227601cc57fb65d378b1c))

## [2.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.1.0) - 2026-07-31

### Features

- **core:** Model a gradient / pattern outline in structured form (by @ChristopherVR) ([69322c9](https://github.com/ChristopherVR/pptx-viewer/commit/69322c94ab40e37f19a1789c3149b5dd5d71498c))

### Bug Fixes

- **core:** Honour a preset path's own coordinate space, and repair hexagon (by @ChristopherVR) ([8e4a91d](https://github.com/ChristopherVR/pptx-viewer/commit/8e4a91d76a2bdd3ba3369ed541bc262d2a9c06f4))
- **core:** Rebuild flowChartTerminator from its spec Beziers (by @ChristopherVR) ([0e81403](https://github.com/ChristopherVR/pptx-viewer/commit/0e8140381fe6af3719a52dcc1b39f16609b5faf0))
- **core:** Keep an inline field in the position it was authored in (by @ChristopherVR) ([beb2067](https://github.com/ChristopherVR/pptx-viewer/commit/beb2067fc11ae709a26b4f9e6714fa557375ec85))
- **core:** Rebuild sun as a disc plus eight detached rays (by @ChristopherVR) ([cd2fcd4](https://github.com/ChristopherVR/pptx-viewer/commit/cd2fcd4baec66f040671aea332d1bcd2250a2e7f))
- **core:** Round-trip the Selection Pane hide toggle (by @ChristopherVR) ([14bdb23](https://github.com/ChristopherVR/pptx-viewer/commit/14bdb23d8c2840cc93d8a891c31ac9e8ffdf44cf))

### Testing

- **core:** Pin issue #132 fill and adjustment parsing against the reporter deck (by @ChristopherVR) ([06cd312](https://github.com/ChristopherVR/pptx-viewer/commit/06cd31287bcbd3895a834bed9f89af443526dca2))

## [2.0.11](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.11) - 2026-07-31

### Bug Fixes

- **core:** Stop an interactive sequence adding a phantom click step (by @ChristopherVR) ([65a4738](https://github.com/ChristopherVR/pptx-viewer/commit/65a4738a6eb8fd0b34999c52dd7e1244c5f0e6b5))

## [2.0.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.10) - 2026-07-30

## [2.0.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.9) - 2026-07-30

### Bug Fixes

- **core:** Stamp the endParaRPr size on an empty paragraph's separator (by @ChristopherVR) ([2b18374](https://github.com/ChristopherVR/pptx-viewer/commit/2b1837473bdde04bc41f9593f444a096dd4196b8))

## [2.0.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.8) - 2026-07-29

### Bug Fixes

- **core:** Keep grouped text at its authored point size (by @ChristopherVR) ([56f676a](https://github.com/ChristopherVR/pptx-viewer/commit/56f676a850a510fa405361d58c849e4a7adb3bea))

## [2.0.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.7) - 2026-07-27

### Bug Fixes

- **core:** Parse morph, fontRef text colour, and unsized bullets correctly (by @ChristopherVR) ([7607996](https://github.com/ChristopherVR/pptx-viewer/commit/7607996123e493ed1f33a6891e444f3b02bb2ed9))

## [2.0.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.6) - 2026-07-27

### Dependencies

- **deps:** Update emf-converter requirement from ^2.0.0 to ^2.0.2 ([#122](https://github.com/ChristopherVR/pptx-viewer/issues/122)) (by @dependabot[bot]) ([423034a](https://github.com/ChristopherVR/pptx-viewer/commit/423034ad1e6d48dbb75be17e1915c917c912517b))

## [2.0.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.5) - 2026-07-27

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## [2.0.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.4) - 2026-07-26

### Bug Fixes

- **core:** Keep the click step's own start conditions (by @ChristopherVR) ([755a4b2](https://github.com/ChristopherVR/pptx-viewer/commit/755a4b2e38dff73c9c460a5318c1fce913880328))
- **core:** Paint useBgFill shapes with the slide background (by @ChristopherVR) ([f819817](https://github.com/ChristopherVR/pptx-viewer/commit/f81981744c637368d1ef0d87b1ba884e634c938a))

## [2.0.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.3) - 2026-07-25

### Chores

- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))

## [2.0.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.2) - 2026-07-25

### Bug Fixes

- **core:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([eebf128](https://github.com/ChristopherVR/pptx-viewer/commit/eebf128df224247eb06ea1731c9418fcc36189f9))
- **core:** Honour a:noFill and stop painting hidden fills/lines (by @ChristopherVR) ([ae13541](https://github.com/ChristopherVR/pptx-viewer/commit/ae1354188b1c5d2bd5843dc36a7c438ba1d83c00))

## [2.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.1) - 2026-07-24

### Bug Fixes

- **core:** Preserve native bullets and boundary spaces ([#107](https://github.com/ChristopherVR/pptx-viewer/issues/107)) ([7ed0971](https://github.com/ChristopherVR/pptx-viewer/commit/7ed09718d2fc439b129ee5ed23c8f5c41fe399ba))

## [2.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@2.0.0) - 2026-07-23

### Features

- **core:** Upgrade emf-converter to 2.0.0 (breaking) (by @ChristopherVR) ([effa4e5](https://github.com/ChristopherVR/pptx-viewer/commit/effa4e5338b2b01796a3671f505bcb4563de74cc))

### Documentation

- Friendly 2.0.0 changelog for root and packages (by @ChristopherVR) ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))

## [1.6.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.10) - 2026-07-19

### Bug Fixes

- **core:** Preserve rich cell text, per-paragraph pPr and font fidelity (#68, #69, #83, #84, #85) (by @ChristopherVR) ([4d61e0e](https://github.com/ChristopherVR/pptx-viewer/commit/4d61e0ee4210bbe2897d58e3376539f1ea708a35))
- **shared:** Render chart markers, helper lines and pie/bar options (#88, #89, #72, #97) (by @ChristopherVR) ([042bd01](https://github.com/ChristopherVR/pptx-viewer/commit/042bd01af29921a29c9e3f548a290ccf582492e9))
- **core:** Wire viewProps.xml into load and default it on save (#90, #96) (by @ChristopherVR) ([2e6616e](https://github.com/ChristopherVR/pptx-viewer/commit/2e6616e89c256a75c560fb3af634b39646ee9a84))
- **core:** Recompute app.xml TitlesOfParts and HeadingPairs on save ([#91](https://github.com/ChristopherVR/pptx-viewer/issues/91)) (by @ChristopherVR) ([87585a7](https://github.com/ChristopherVR/pptx-viewer/commit/87585a74526746b35029da6d8844037f2e46add4))
- **core:** Round-trip cNvSpPr txBox and cover spLocks serialization ([#92](https://github.com/ChristopherVR/pptx-viewer/issues/92)) (by @ChristopherVR) ([9feb36b](https://github.com/ChristopherVR/pptx-viewer/commit/9feb36b96d55e6b4822d33d570182871a3ab6cd0))
- **core:** Resolve SmartArt dsp blip fills and enumerate nested shapes ([#73](https://github.com/ChristopherVR/pptx-viewer/issues/73)) (by @ChristopherVR) ([ff08821](https://github.com/ChristopherVR/pptx-viewer/commit/ff088215aeebdfdca5da73ee8a92b533c7218737))
- **core:** Parse SmartArt colour lists and presLayoutVars ([#94](https://github.com/ChristopherVR/pptx-viewer/issues/94)) (by @ChristopherVR) ([7917f71](https://github.com/ChristopherVR/pptx-viewer/commit/7917f714cb9d53b0a7df3e9d2d3c083963f03478))
- **core:** Remap custom-show and section slide refs on reorder/remove ([#96](https://github.com/ChristopherVR/pptx-viewer/issues/96)) (by @ChristopherVR) ([9f83519](https://github.com/ChristopherVR/pptx-viewer/commit/9f83519fd4fef7ac6a1fb7868408f531cc998b43))
- **core:** Embed non-data-URL slide background images on save ([#100](https://github.com/ChristopherVR/pptx-viewer/issues/100)) (by @ChristopherVR) ([61da958](https://github.com/ChristopherVR/pptx-viewer/commit/61da958b29295926b14bb24d576854e001b8cc7c))
- **core:** Round-trip gradient/pattern line fills and gradient tileRect/grpFill (#87, #97) (by @ChristopherVR) ([3942594](https://github.com/ChristopherVR/pptx-viewer/commit/3942594d22081a6228055219d30aab5bbb128e58))
- **core:** Broaden table-style fills/text and apply corner-cell fills ([#95](https://github.com/ChristopherVR/pptx-viewer/issues/95)) (by @ChristopherVR) ([c2cab10](https://github.com/ChristopherVR/pptx-viewer/commit/c2cab10bd031b596ccaa1afa7481ee857713251b))
- **core:** Render chart invertIfNegative and fix SDK generator containers ([#97](https://github.com/ChristopherVR/pptx-viewer/issues/97)) (by @ChristopherVR) ([888b9c7](https://github.com/ChristopherVR/pptx-viewer/commit/888b9c75da46c771b2817895b95787e7eb036bc6))
- **core:** Round-trip explicit run/paragraph text properties and fix colour maths ([#98](https://github.com/ChristopherVR/pptx-viewer/issues/98)) (by @ChristopherVR) ([3fe3ced](https://github.com/ChristopherVR/pptx-viewer/commit/3fe3ced01abf9f8666cbb93be11a9e3c3b960ee3))
- **core:** Apply animation easing, sound loop, comment resolved and p14 media embed ([#98](https://github.com/ChristopherVR/pptx-viewer/issues/98)) (by @ChristopherVR) ([e7c1fd6](https://github.com/ChristopherVR/pptx-viewer/commit/e7c1fd65441d4b5e017a18b596b1fec16ca7d8ec))

## [1.6.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.9) - 2026-07-19

### Bug Fixes

- **core:** Write sp3d colours as valid hex and preserve scene3d (#67, #86) (by @ChristopherVR) ([d30f5a7](https://github.com/ChristopherVR/pptx-viewer/commit/d30f5a754921d3c396856be8a7bbfc2b7233f2dd))
- **core:** Parse and render group rotation and flip ([#70](https://github.com/ChristopherVR/pptx-viewer/issues/70)) (by @ChristopherVR) ([5bb820a](https://github.com/ChristopherVR/pptx-viewer/commit/5bb820a3ee4d66f7b2810decce45b3a3b752884f))
- **core:** Resolve table-style borders from tcBdr ([#71](https://github.com/ChristopherVR/pptx-viewer/issues/71)) (by @ChristopherVR) ([1e8c072](https://github.com/ChristopherVR/pptx-viewer/commit/1e8c0726640b12723532bfe9e1f544841d1f021f))
- **core:** Parse gradient and pattern fills on SmartArt dsp shapes ([#73](https://github.com/ChristopherVR/pptx-viewer/issues/73)) (by @ChristopherVR) ([6b94c9a](https://github.com/ChristopherVR/pptx-viewer/commit/6b94c9a5aa16a663b2720f28d92d1823fd4cc631))
- **core:** Decode real InkML contentPart traces to SVG paths ([#74](https://github.com/ChristopherVR/pptx-viewer/issues/74)) (by @ChristopherVR) ([8204f7c](https://github.com/ChristopherVR/pptx-viewer/commit/8204f7cb9805d6ce9d893940a0a3e5c217fab69e))
- **core:** Resolve themed bullet colour via parseColor ([#75](https://github.com/ChristopherVR/pptx-viewer/issues/75)) (by @ChristopherVR) ([ba311d5](https://github.com/ChristopherVR/pptx-viewer/commit/ba311d57e17aa9a61a0ffc60fef4689b4cb1389c))
- **core:** Honour fly-in/out animation direction via presetSubtype ([#76](https://github.com/ChristopherVR/pptx-viewer/issues/76)) (by @ChristopherVR) ([316a7db](https://github.com/ChristopherVR/pptx-viewer/commit/316a7db02ad12f135b27635f01ecae1287a44adf))
- **core:** Parse p15 prstTrans transitions and stop spurious cut ([#77](https://github.com/ChristopherVR/pptx-viewer/issues/77)) (by @ChristopherVR) ([a32260e](https://github.com/ChristopherVR/pptx-viewer/commit/a32260e6d391ae1ed2b98a13b958ccb137bc1347))
- **core:** Serialize justLow/dist/thaiDist paragraph alignment ([#78](https://github.com/ChristopherVR/pptx-viewer/issues/78)) (by @ChristopherVR) ([59a882a](https://github.com/ChristopherVR/pptx-viewer/commit/59a882a60d43f83e9b8189063838f7ea4d2a5502))
- **core:** Flag embedded media as embedded, not linked ([#79](https://github.com/ChristopherVR/pptx-viewer/issues/79)) (by @ChristopherVR) ([0decc64](https://github.com/ChristopherVR/pptx-viewer/commit/0decc64d2c5b7b5c1bd3cd469bed6910c5766957))

## [1.6.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.8) - 2026-07-19

### Bug Fixes

- **core:** Themed background text, colour and geometry fidelity (by @ChristopherVR) ([a8fc2be](https://github.com/ChristopherVR/pptx-viewer/commit/a8fc2bea2407f70bc3df4008be5c152d107cc3eb))

## [1.6.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.7) - 2026-07-19

### Bug Fixes

- **core:** Stop truncating interleaved custom-geometry paths ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([9bbac7d](https://github.com/ChristopherVR/pptx-viewer/commit/9bbac7d024fbad8ccd476f7e2a5d993ce1ad2b1b))

### Performance

- **core:** Cache layout/master XML during background resolution (by @ChristopherVR) ([9eea305](https://github.com/ChristopherVR/pptx-viewer/commit/9eea3057d62825f2c6355cf9891123a77df0c8fb))

## [1.6.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.6) - 2026-07-18

### Bug Fixes

- **core:** Load themed backgrounds and inherited placeholders ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([bed627b](https://github.com/ChristopherVR/pptx-viewer/commit/bed627bc4e2abb5c897e7e9b49fb27735f5e01a1))

## [1.6.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.5) - 2026-07-18

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.6.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.4) - 2026-07-18

### Bug Fixes

- **core:** Preserve OMML sibling order through parse, save, and markdown (by @ChristopherVR) ([54e5de5](https://github.com/ChristopherVR/pptx-viewer/commit/54e5de5b4c0bc1509e80bf632a8d3c2a5c24be38))
- **core:** Resolve ReDoS and prototype pollution in OMML sibling-order scan (by @ChristopherVR) ([2eef210](https://github.com/ChristopherVR/pptx-viewer/commit/2eef210de3c5a366be8721e420aaac6a5643b0af))

## [1.6.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.3) - 2026-07-18

### Other

- Integrate release version bumps (by @ChristopherVR) ([4b3893f](https://github.com/ChristopherVR/pptx-viewer/commit/4b3893f4158803cc5533beb266ffdc8c776177cb))

### Dependencies

- **deps:** Update dependencies to latest and migrate core/shared/locales to TypeScript 7 (by @ChristopherVR) ([cc72948](https://github.com/ChristopherVR/pptx-viewer/commit/cc729482cc5ae4ae56e1219f290c2953ec83c12a))

## [1.6.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.2) - 2026-07-17

### Styling

- Fix oxfmt formatting drift blocking CI (by @ChristopherVR) ([4f26420](https://github.com/ChristopherVR/pptx-viewer/commit/4f26420ce8db8eae9176f315a6450d843054e2a6))

## [1.6.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.1) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.6.0) - 2026-07-17

### Features

- **core:** Preserve DrawingML image color effects (by @ChristopherVR) ([5ed726d](https://github.com/ChristopherVR/pptx-viewer/commit/5ed726d401a5a4e399854b77af63032287204ad1))
- **core:** Model PresentationML view geometry (by @ChristopherVR) ([3b07978](https://github.com/ChristopherVR/pptx-viewer/commit/3b07978204770e51d0470e624dbb0073844587e7))
- **core:** Round-trip ChartML markers and data points (by @ChristopherVR) ([ae8edc5](https://github.com/ChristopherVR/pptx-viewer/commit/ae8edc5514fb6ce1974bd912aa6d59a2844c4f22))
- **core:** Add DiagramML definition headers (by @ChristopherVR) ([314f9fa](https://github.com/ChristopherVR/pptx-viewer/commit/314f9fa1b1545ad423b1c5d40032b8b26e1fadc4))
- **core:** Complete DrawingML alpha effects (by @ChristopherVR) ([3a402f4](https://github.com/ChristopherVR/pptx-viewer/commit/3a402f479d0014610baa66d9c9c2d52426a383b7))
- **core:** Add ChartML print settings (by @ChristopherVR) ([f519b19](https://github.com/ChristopherVR/pptx-viewer/commit/f519b19cc75eeca4ec54384d8678918c9c764501))
- **core:** Edit DiagramML constraints and rules (by @ChristopherVR) ([01f1ed2](https://github.com/ChristopherVR/pptx-viewer/commit/01f1ed2be8ca9fea10520118f263776ac12351cf))
- **core:** Complete PresentationML print properties (by @ChristopherVR) ([671f348](https://github.com/ChristopherVR/pptx-viewer/commit/671f34888ae5b6e9af12f6ef5783f6754eaf7888))
- **core:** Add ChartML protection (by @ChristopherVR) ([e09b1a9](https://github.com/ChristopherVR/pptx-viewer/commit/e09b1a90edd579ec29edcc7a817fd962687e1b3e))
- **core:** Export print and protection types (by @ChristopherVR) ([ea228d6](https://github.com/ChristopherVR/pptx-viewer/commit/ea228d6e017bf941434e2a5b8fa0db439a938b76))
- **core:** Edit DiagramML layout algorithms (by @ChristopherVR) ([42e7dd3](https://github.com/ChristopherVR/pptx-viewer/commit/42e7dd3df964fc9481821dc21b688cbe636243aa))
- **core:** Complete ChartML pivot sources (by @ChristopherVR) ([afb317a](https://github.com/ChristopherVR/pptx-viewer/commit/afb317a135ce52b599bfe6f3f1031fd6e9c1ab3c))
- **core:** Complete DrawingML audio metadata (by @ChristopherVR) ([226c917](https://github.com/ChristopherVR/pptx-viewer/commit/226c9177b416b27af6feae6b3ad5952fbd0d84f0))
- **core:** Complete PresentationML embedded fonts (by @ChristopherVR) ([5d54284](https://github.com/ChristopherVR/pptx-viewer/commit/5d542848608447e408f8024e2290ad80e1d9d649))
- **core:** Edit DiagramML layout control flow (by @ChristopherVR) ([74fb263](https://github.com/ChristopherVR/pptx-viewer/commit/74fb263fcb1059f570d1163b014d57d849c8415d))
- **core:** Complete PresentationML kinsoku (by @ChristopherVR) ([9cc5604](https://github.com/ChristopherVR/pptx-viewer/commit/9cc5604030c03544505077bf75adf7803f147d9f))
- **core:** Edit ChartML pivot formats (by @ChristopherVR) ([87a646a](https://github.com/ChristopherVR/pptx-viewer/commit/87a646a2551099bb8f71e9b2e474375438e6d37f))
- **core:** Export rich elements as SVG (by @ChristopherVR) ([508fc6c](https://github.com/ChristopherVR/pptx-viewer/commit/508fc6cbd074dec5d7a0655b0c700ea6a95cd058))
- **core:** Persist chart palette and axis positions (by @ChristopherVR) ([69b05bd](https://github.com/ChristopherVR/pptx-viewer/commit/69b05bdc3cf86c883d16c4f1b9ddef1563ad99e7))
- **core:** Render funnel charts in SVG exports (by @ChristopherVR) ([efb6c36](https://github.com/ChristopherVR/pptx-viewer/commit/efb6c368fc6640a918cc6bbdc016b98c87e241ff))
- **core:** Author SDK funnel ChartEx parts (by @ChristopherVR) ([73265f4](https://github.com/ChristopherVR/pptx-viewer/commit/73265f4737f2f74705be380a2772586fd46557c0))
- **core:** Author SDK waterfall ChartEx parts (by @ChristopherVR) ([e5ff15b](https://github.com/ChristopherVR/pptx-viewer/commit/e5ff15b7aeab2c9b059963ae36aafd1b457ffe67))
- **core:** Author SDK treemap ChartEx parts (by @ChristopherVR) ([9264fad](https://github.com/ChristopherVR/pptx-viewer/commit/9264fad20c51725136722369aef7393f334d1832))
- **core:** Round-trip sunburst hierarchy (by @ChristopherVR) ([3cc868e](https://github.com/ChristopherVR/pptx-viewer/commit/3cc868ea721d78f8ac48365e6a9cb4cb1abfe57c))
- **core:** Round-trip PowerPoint slide Zoom (by @ChristopherVR) ([624c853](https://github.com/ChristopherVR/pptx-viewer/commit/624c853b6450f6c0f8b16d8789104ba6f2cc76e2))
- **core:** Author SDK box-whisker ChartEx parts (by @ChristopherVR) ([202496f](https://github.com/ChristopherVR/pptx-viewer/commit/202496f894d094535f8ca6fa9cad303c00f13a7c))
- **core:** Author histogram and Pareto ChartEx parts (by @ChristopherVR) ([b8d779c](https://github.com/ChristopherVR/pptx-viewer/commit/b8d779cd0923ceeeb39c0848cec25cd52223d5e3))
- **core:** Round-trip PowerPoint section Zoom (by @ChristopherVR) ([67a162f](https://github.com/ChristopherVR/pptx-viewer/commit/67a162f63f1b244a9fbf23621c9e7194b1538031))
- **core:** Author SDK region-map ChartEx parts (by @ChristopherVR) ([9d0c676](https://github.com/ChristopherVR/pptx-viewer/commit/9d0c676231f91e967e89eb82fbae472b23172113))
- **core:** Round-trip PowerPoint Summary Zoom (by @ChristopherVR) ([27c5671](https://github.com/ChristopherVR/pptx-viewer/commit/27c5671d6593d439f624cfbe2c9b37373fd6ec16))
- **shared:** Honor category axis ordering and ticks (by @ChristopherVR) ([45f7c1f](https://github.com/ChristopherVR/pptx-viewer/commit/45f7c1f13f2f92e07e3085fc060314b64060dd64))
- **core:** Author embedded 3D models (by @ChristopherVR) ([7189466](https://github.com/ChristopherVR/pptx-viewer/commit/7189466b8c86692c651a8eebc382d42ad8df56f1))
- **core:** Preserve ChartEx waterfall layout semantics (by @ChristopherVR) ([10feb1b](https://github.com/ChristopherVR/pptx-viewer/commit/10feb1bb15a5288d6607508a45ba030888d36adc))
- **core:** Author InkML content parts (by @ChristopherVR) ([b8df789](https://github.com/ChristopherVR/pptx-viewer/commit/b8df789682e6ca28e15e3a8732d550c016239b2a))
- **core:** Author user-defined tag parts (by @ChristopherVR) ([245dc7c](https://github.com/ChristopherVR/pptx-viewer/commit/245dc7cb9db4e69cb4b37c4d4e989ed6f0d8e2c8))
- **core:** Preserve classic date axis semantics (by @ChristopherVR) ([f9391cd](https://github.com/ChristopherVR/pptx-viewer/commit/f9391cde53a10058601d9a4a8205ea636f6a43c9))
- **core:** Author customer data parts (by @ChristopherVR) ([8d99be8](https://github.com/ChristopherVR/pptx-viewer/commit/8d99be831377d08cde510603ae8c9b00c0985169))
- **core:** Preserve chart axis crossing semantics (by @ChristopherVR) ([3fbcbc0](https://github.com/ChristopherVR/pptx-viewer/commit/3fbcbc01812272d2984f22986af81135d0d08fd6))
- **core:** Preserve ChartEx hierarchy and geography (by @ChristopherVR) ([4b8e3ab](https://github.com/ChristopherVR/pptx-viewer/commit/4b8e3abde0f4747cdbd7347ff48cb2156b9a3110))

### Bug Fixes

- **core:** Validate DiagramML iterator bounds (by @ChristopherVR) ([cb375ce](https://github.com/ChristopherVR/pptx-viewer/commit/cb375ce5ac221e854d3a6c203788a6795a5d1881))
- **core:** Correct DrawingML custom dash stops (by @ChristopherVR) ([9b7bd11](https://github.com/ChristopherVR/pptx-viewer/commit/9b7bd11da4438ce24c7e76fb421d07fb0b720d74))
- **core:** Export complete image colour effects (by @ChristopherVR) ([e1468d3](https://github.com/ChristopherVR/pptx-viewer/commit/e1468d316711b56fc883efddb0c14a957b6630ae))
- **viewer:** Restore thumbnail colours and suppress bullets (by @ChristopherVR) ([4563d2d](https://github.com/ChristopherVR/pptx-viewer/commit/4563d2d0a60ec70febbb5b26b438b9f2de6782b8))
- **core:** Parse all show property boolean forms (by @ChristopherVR) ([0dc7329](https://github.com/ChristopherVR/pptx-viewer/commit/0dc7329945b2690f2c504e8f31815220b8d8e896))
- **core:** Preserve structured custom geometry paths (by @ChristopherVR) ([423fb41](https://github.com/ChristopherVR/pptx-viewer/commit/423fb41b75393f65ba07e00f1f670e710348d7e5))
- **core:** Resolve theme effect placeholder colours (by @ChristopherVR) ([3e9e348](https://github.com/ChristopherVR/pptx-viewer/commit/3e9e3480d72612e270f8852fb5a870a60d10d6a3))
- **core:** Preserve combo secondary axis mapping (by @ChristopherVR) ([73085fd](https://github.com/ChristopherVR/pptx-viewer/commit/73085fd82fae6a73f23a205d85af368571276ad4))
- **core:** Resolve theme line placeholder colours (by @ChristopherVR) ([e5cdfce](https://github.com/ChristopherVR/pptx-viewer/commit/e5cdfce341633dec9992c1f102e3a383fab7b187))
- **core:** Normalize multi-path custom geometry (by @ChristopherVR) ([1cc46cd](https://github.com/ChristopherVR/pptx-viewer/commit/1cc46cdc7baa22c82e60cfd8809cb8321db8579c))
- **core:** Resolve theme fill placeholder colours (by @ChristopherVR) ([55fe588](https://github.com/ChristopherVR/pptx-viewer/commit/55fe5883f0544ac05b47b8c0e557a9ba1df06b07))
- **core:** Preserve SmartArt rich text ordering (by @ChristopherVR) ([ab56204](https://github.com/ChristopherVR/pptx-viewer/commit/ab5620452121f323d924b7d31f97882cce86b8ad))
- **core:** Persist authored OLE payloads (by @ChristopherVR) ([0c24f45](https://github.com/ChristopherVR/pptx-viewer/commit/0c24f45ae2b6bd17b03142f03fea3d1254c1c812))
- **core:** Resolve ChartEx data references (by @ChristopherVR) ([6faab07](https://github.com/ChristopherVR/pptx-viewer/commit/6faab073b149a42b01ae9485d7911b83b9c76213))
- **core:** Persist chart axis direction (by @ChristopherVR) ([47f70c1](https://github.com/ChristopherVR/pptx-viewer/commit/47f70c14a6dfedc7f185a494c313ec268a6618a0))
- **core:** Retain SmartArt cached shape skew (by @ChristopherVR) ([d219b0e](https://github.com/ChristopherVR/pptx-viewer/commit/d219b0edaff00a965d51389e228983b4d9df6d47))
- **core:** Author editable OpenXML ink (by @ChristopherVR) ([0e81e91](https://github.com/ChristopherVR/pptx-viewer/commit/0e81e9143a2c64dd30f81f49a9434c787ff2f823))
- **core:** Preserve SmartArt custom geometry (by @ChristopherVR) ([782a2aa](https://github.com/ChristopherVR/pptx-viewer/commit/782a2aa24421515a7d7f55f3b3643924fdf6fdcf))
- **core:** Persist notes on new slides (by @ChristopherVR) ([330d54e](https://github.com/ChristopherVR/pptx-viewer/commit/330d54e3fc3aae9a4567f05f90c6b2d63efbea0f))
- **core:** Author handout master package parts (by @ChristopherVR) ([0427da1](https://github.com/ChristopherVR/pptx-viewer/commit/0427da156c7911a6e342e2c3325eeade1404a3bc))
- **core:** Preserve custom geometry command order (by @ChristopherVR) ([695a2fe](https://github.com/ChristopherVR/pptx-viewer/commit/695a2fea59ffa3219c24fbb434c4d1ba92cbfef5))
- **core:** Allocate string Zoom fallback IDs (by @ChristopherVR) ([2fbb6e8](https://github.com/ChristopherVR/pptx-viewer/commit/2fbb6e8147e808e7c30019c3b157b129e3267861))
- **core:** Preserve SmartArt text paragraphs (by @ChristopherVR) ([78a51bd](https://github.com/ChristopherVR/pptx-viewer/commit/78a51bdd9ebb67185815c0b765fb5c113f7e434e))
- **core:** Retain SmartArt extension order (by @ChristopherVR) ([4475ba2](https://github.com/ChristopherVR/pptx-viewer/commit/4475ba2e2fae90d9d279de3a249bbdd602af6528))
- **core:** Load embedded 3D model payloads (by @ChristopherVR) ([f052f8c](https://github.com/ChristopherVR/pptx-viewer/commit/f052f8c27330b6d206202003752a4c6c1def48f1))
- **core:** Reconcile SmartArt legacy text edits (by @ChristopherVR) ([13253b5](https://github.com/ChristopherVR/pptx-viewer/commit/13253b5a5b2f46c105d72f8952355195bd12c07a))
- **core:** Project SmartArt rich text to shapes (by @ChristopherVR) ([5b106a6](https://github.com/ChristopherVR/pptx-viewer/commit/5b106a671c42ed3ae1f4b1068b571d9e95110b3c))
- **core:** Resolve SmartArt run text styles (by @ChristopherVR) ([6737afd](https://github.com/ChristopherVR/pptx-viewer/commit/6737afd47a0e3e7a9800da422b0730f4273271d7))
- **core:** Evaluate SmartArt layout rules (by @ChristopherVR) ([4a918fd](https://github.com/ChristopherVR/pptx-viewer/commit/4a918fd1664143d4def19211b5b8df10a5f68470))
- **core:** Guard SmartArt text order annotation (by @ChristopherVR) ([44d7013](https://github.com/ChristopherVR/pptx-viewer/commit/44d70131f2ed1f2fb9d4d62217a483ce2059021b))
- **core:** Preserve chart series option shape (by @ChristopherVR) ([87c0df4](https://github.com/ChristopherVR/pptx-viewer/commit/87c0df4ad34efae05e7479f1a2ace834d355481c))

### Refactor

- **core:** Name OpenXML coverage by capability (by @ChristopherVR) ([1e25a7f](https://github.com/ChristopherVR/pptx-viewer/commit/1e25a7fbb929092af4ce080a4ed19eab28e87472))
- **core:** Keep chart protection codec internal (by @ChristopherVR) ([da3fcc1](https://github.com/ChristopherVR/pptx-viewer/commit/da3fcc1d82c0a0b0f36e9d4d581aea0509915be2))

### Testing

- **core:** Record Wave 11 OpenXML coverage (by @ChristopherVR) ([54da8fa](https://github.com/ChristopherVR/pptx-viewer/commit/54da8fa3516af50f84dc41ffd5c3e268cb30ce16))
- **core:** Require evidence for OpenXML coverage (by @ChristopherVR) ([c1d27e0](https://github.com/ChristopherVR/pptx-viewer/commit/c1d27e0b9ab39f9ceba53332cfd48dbdafc340df))
- **core:** Record implemented OpenXML capabilities (by @ChristopherVR) ([a04f5ed](https://github.com/ChristopherVR/pptx-viewer/commit/a04f5ede9296a7cebff216941567186d93f15159))
- **core:** Record print protection and rule coverage (by @ChristopherVR) ([804c74e](https://github.com/ChristopherVR/pptx-viewer/commit/804c74eba4a7022af7ca228dacb186ae3d5bc645))
- **core:** Record font audio pivot and algorithm coverage (by @ChristopherVR) ([199a137](https://github.com/ChristopherVR/pptx-viewer/commit/199a13788111941105c0d56d33ebb48945daba3f))
- **core:** Record line layout and pivot coverage (by @ChristopherVR) ([f4e21db](https://github.com/ChristopherVR/pptx-viewer/commit/f4e21dbf637643f091b3a7f09c05dce30347f871))
- **core:** Assert structural chart SVG output (by @ChristopherVR) ([e52c3c7](https://github.com/ChristopherVR/pptx-viewer/commit/e52c3c77db03b72345acbb27be3f3a1f2eca5882))
- **core:** Assert typed authored ink reload (by @ChristopherVR) ([d12827f](https://github.com/ChristopherVR/pptx-viewer/commit/d12827ff92380b6ff592cf7e6cb4cb427a7b32c1))

### Chores

- **repo:** Capture pending workspace updates (by @ChristopherVR) ([5d274f1](https://github.com/ChristopherVR/pptx-viewer/commit/5d274f16627170790cba14b6ecc99496f90c7ab7))

## [1.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.5.0) - 2026-07-16

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

## [1.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.4.0) - 2026-07-13

### Bug Fixes

- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Dependencies

- **deps:** Update fast-xml-parser to 5.10.0 (by @dependabot[bot]) ([6080273](https://github.com/ChristopherVR/pptx-viewer/commit/6080273f6a6f603d10d69a71d54faad1e6d9bf05))
- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## [1.3.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.3.1) - 2026-07-13

### Bug Fixes

- **core:** Open Office-encrypted pptx files (by @ChristopherVR) ([51aa670](https://github.com/ChristopherVR/pptx-viewer/commit/51aa670e8ca78d78323f55766b1a4c0e8b366c00))

## [1.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.3.0) - 2026-07-11

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([0ecd3d9](https://github.com/ChristopherVR/pptx-viewer/commit/0ecd3d935f97c78e8b0a62bebc8bf610c42414ab))

## [1.2.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.8) - 2026-07-10

### Bug Fixes

- **core:** Preserve whitespace-only run text on load (by @ChristopherVR) ([b83bdbc](https://github.com/ChristopherVR/pptx-viewer/commit/b83bdbc76be729f65af42f271402bffe95505cb0))

## [1.2.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.7) - 2026-07-09

### Bug Fixes

- **core:** Close residual ReDoS/path-traversal gaps from the last CodeQL pass (by @ChristopherVR) ([9b17db9](https://github.com/ChristopherVR/pptx-viewer/commit/9b17db9067fac5f1b230d6fcc50fa9f8936d96ae))

## [1.2.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.6) - 2026-07-09

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([10acef8](https://github.com/ChristopherVR/pptx-viewer/commit/10acef81a7f5d79e778e4e4464d956cc84682f7c))

## [1.2.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.5) - 2026-07-09

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([b8c46bc](https://github.com/ChristopherVR/pptx-viewer/commit/b8c46bc3622e301d3365f5c489144e5aa5401782))

## [1.2.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.4) - 2026-07-09

### Bug Fixes

- **core:** Preserve SmartArt node geometry when round-tripping (by @ChristopherVR) ([cc5bd78](https://github.com/ChristopherVR/pptx-viewer/commit/cc5bd789e59d3cc772c9600512377317cad05772))

## [1.2.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.3) - 2026-07-08

### Documentation

- **core:** Remove explicit jszip/fast-xml-parser mention from install section (by @ChristopherVR) ([6b72906](https://github.com/ChristopherVR/pptx-viewer/commit/6b72906c08447ba38a704ff4572c89d7cad7e60c))

## [1.2.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.2) - 2026-07-07

### Bug Fixes

- **core:** Handle absolute relationship target paths in layout/master resolution (by @ChristopherVR) ([5ea40c2](https://github.com/ChristopherVR/pptx-viewer/commit/5ea40c22eca8420aa872b0ea923770085df72a0e))

## [1.2.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.1) - 2026-07-06

### Bug Fixes

- **core:** Cast xmldom Element to Node for xml-crypto canonicalization (by @ChristopherVR) ([8fbd97e](https://github.com/ChristopherVR/pptx-viewer/commit/8fbd97eb1221f66650a7bcb45e089ee08034439f))
- **core:** Cast xmldom Element to Node at all canonicalization call sites (by @ChristopherVR) ([5f0fa32](https://github.com/ChristopherVR/pptx-viewer/commit/5f0fa325b57931a43fecd9d3de2d17b406a509f1))
- **core:** Replace standard DOM types with structural interfaces in signature-node (by @ChristopherVR) ([febe7bd](https://github.com/ChristopherVR/pptx-viewer/commit/febe7bd5b392c7b972a8588891ddf56fc7181d61))

## [1.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.2.0) - 2026-07-05

### Features

- **core,cli:** Add react, angular, vue to npm keywords (by @ChristopherVR) ([528ec61](https://github.com/ChristopherVR/pptx-viewer/commit/528ec6182bb77c07444dd0e93560b65e604b9524))

## [1.1.48](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.1.48) - 2026-07-04

### Bug Fixes

- **core:** Namespace layout/master element ids by owning part (by @ChristopherVR) ([baa499c](https://github.com/ChristopherVR/pptx-viewer/commit/baa499c8ae82ed89db3a1743f78704b862597380))
- **core:** Xmldom 0.9 type compatibility in signature-node (by @ChristopherVR) ([ad514e8](https://github.com/ChristopherVR/pptx-viewer/commit/ad514e83c70b9de1c143918f96317c250ecccff3))
- **core:** Correct install docs and drop the retired @christophervr/pptx-viewer alias (by @ChristopherVR) ([6544b4e](https://github.com/ChristopherVR/pptx-viewer/commit/6544b4eaf086945ecd8a18b877de5a483032aa14))
- Build issue (by @ChristopherVR) ([08a0d2c](https://github.com/ChristopherVR/pptx-viewer/commit/08a0d2cf3f9bcc2193aaa5fc451e8286b0330b71))
- **core:** Clear stale drawing shapes when switching smartart layout (by @ChristopherVR) ([c62959f](https://github.com/ChristopherVR/pptx-viewer/commit/c62959fab17e6cddea4ddb379f1add580aae1fd0))
- **core:** Stop SmartArt edits from corrupting the saved pptx (by @ChristopherVR) ([507fe33](https://github.com/ChristopherVR/pptx-viewer/commit/507fe33d94af69ac657d6326cbe5a3cd089cedd0))
- **core:** Fabricate diagram parts so inserted SmartArt survives save (by @ChristopherVR) ([0d1341f](https://github.com/ChristopherVR/pptx-viewer/commit/0d1341fd4402518c51b3ed1e301aa4115a9af3b4))

## [1.1.43](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.1.43) - 2026-07-02

### Bug Fixes

- **core:** Correct install docs and drop the retired @christophervr/pptx-viewer alias (by @ChristopherVR) ([6544b4e](https://github.com/ChristopherVR/pptx-viewer/commit/6544b4eaf086945ecd8a18b877de5a483032aa14))
- **core,angular:** Revert xmldom to 0.8.x and fix shared import specifiers (by @ChristopherVR) ([29eda31](https://github.com/ChristopherVR/pptx-viewer/commit/29eda3119836559b63bc08733dd9dd6398a69c8d))

## [1.1.42](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.1.42) - 2026-06-27

### Bug Fixes

- Missing document links (by @ChristopherVR) ([f52bd6f](https://github.com/ChristopherVR/pptx-viewer/commit/f52bd6fd2fc4f564f018ecf5e84e64d24c8fd240))

## [1.1.28](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.1.28) - 2026-06-21

### Dependencies

- **deps:** Update dependencies within semver ranges (by @ChristopherVR) ([d472b58](https://github.com/ChristopherVR/pptx-viewer/commit/d472b58dfd47628b5c682bd5f4dc2014ec29b421))

## [1.1.27](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.1.27) - 2026-06-21

### Bug Fixes

- **angular:** Bundle pptx-viewer-core and fix demo JIT + Vue demo alias (by @ChristopherVR) ([78838ec](https://github.com/ChristopherVR/pptx-viewer/commit/78838ec900fe2d8c90bc39333636d788c52c3161))

## [1.1.26](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.1.26) - 2026-06-21

### Documentation

- Sharpen npm descriptions and keywords for discoverability (by @ChristopherVR) ([8fea56d](https://github.com/ChristopherVR/pptx-viewer/commit/8fea56d7650f7dc2f3167dea97b94b612a03a4e7))
- **core:** Reword README in plain language (by @ChristopherVR) ([793c26e](https://github.com/ChristopherVR/pptx-viewer/commit/793c26ec7e2415c66f34c637cb541483bf395a11))

## [1.1.24](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-core@1.1.24) - 2026-06-20

### Features

- **core:** Add signature-node module and shared signature utilities (by @ChristopherVR) ([e7cb263](https://github.com/ChristopherVR/pptx-viewer/commit/e7cb26335f15e633cfc37371f16a6ad210be5e11))

### Bug Fixes

- Enable vitest globals in all packages to fix expectTypeOf errors (by @ChristopherVR) ([6d90d72](https://github.com/ChristopherVR/pptx-viewer/commit/6d90d72ff0107ad0194f9c73ceeb3df244f4cfc6))
- **test:** Add i18n mocks to react tests and bump versions to 1.2.0 (by @ChristopherVR) ([2c1c962](https://github.com/ChristopherVR/pptx-viewer/commit/2c1c9628714b905b28592493abf02fb270107b65))
- **deps:** Pin @xmldom/xmldom to 0.8.x in core to fix build (by @ChristopherVR) ([2ed7b2e](https://github.com/ChristopherVR/pptx-viewer/commit/2ed7b2e777d4e740a3e4c9ca7e2b3d6fc2bbd21f))
- **core:** Declare jszip and fast-xml-parser as runtime dependencies (by @ChristopherVR) ([b6636be](https://github.com/ChristopherVR/pptx-viewer/commit/b6636be972206bb2c6acee0fed05c45b4759fbdc))

### Refactor

- **core:** Consume emf-converter and mtx-decompressor from npm (by @ChristopherVR) ([2f6013d](https://github.com/ChristopherVR/pptx-viewer/commit/2f6013d5b8fab0aef5b32901841d94c0fa886f24))

### Documentation

- Restructure root README, elevate limitations, fix outdated claims (by @ChristopherVR) ([86dcda9](https://github.com/ChristopherVR/pptx-viewer/commit/86dcda9b5e3129f2223341337055778db574e985))
- Rewrite limitations with technical explanations and remove inaccurate claims (by @ChristopherVR) ([ac4bc84](https://github.com/ChristopherVR/pptx-viewer/commit/ac4bc84ed9bd03f62e3ae29c35baf3f444a3c0bf))
- **readme:** Npm-friendly READMEs — hero image, capabilities & install first (by @ChristopherVR) ([c843d19](https://github.com/ChristopherVR/pptx-viewer/commit/c843d1934b846f901bba92e63d2b01f9479594d0))
- Streamline npm READMEs and add badges, screenshots, demo links (by @ChristopherVR) ([92e980d](https://github.com/ChristopherVR/pptx-viewer/commit/92e980d434900abd223c4d70c6cae19a623f9ca8))

### Build & CI

- Independent per-package versioning, tags, and changelogs (by @ChristopherVR) ([79595d9](https://github.com/ChristopherVR/pptx-viewer/commit/79595d972d7c4102e8b1e1e3926f439486f76ba1))

### Dependencies

- **deps:** Update all dependencies to latest (by @ChristopherVR) ([e3287c0](https://github.com/ChristopherVR/pptx-viewer/commit/e3287c03ff58b1a1ae103ed32a513468a454a084))
- **deps:** Bump all workspace manifest floors to latest (by @ChristopherVR) ([890c33d](https://github.com/ChristopherVR/pptx-viewer/commit/890c33d667a39480a69e6a3da893964382993b29))

### Chores

- Add license files, NOTICE, and package metadata for npm publishing (by @ChristopherVR) ([9464bb8](https://github.com/ChristopherVR/pptx-viewer/commit/9464bb8b91734daf35131d3c7e52e60895fe0a1c))
- Bump all packages to v1.1.0 and remove remaining MyClawAssist refs (by @ChristopherVR) ([c386511](https://github.com/ChristopherVR/pptx-viewer/commit/c38651150c08011cee5e17e15f7ee8adc0014b80))
- Bump all packages to 1.x.1 patch versions (by @ChristopherVR) ([c75205a](https://github.com/ChristopherVR/pptx-viewer/commit/c75205a96cc7797d1647ac4705395b7707ac8910))
- Bump all packages to minor versions for SDK table support (by @ChristopherVR) ([2d4b635](https://github.com/ChristopherVR/pptx-viewer/commit/2d4b6351b0bf328f8a556cf593733fd8ad36c7b5))
- Bump dependencies to latest and minor-bump packages for parity work (by @ChristopherVR) ([da19fdf](https://github.com/ChristopherVR/pptx-viewer/commit/da19fdf9a4670d274d9973b67aa22d34217b8555))
- Roll TypeScript back to 5.9.x; quiet new oxlint vitest rules (by @ChristopherVR) ([713c020](https://github.com/ChristopherVR/pptx-viewer/commit/713c020ac2428db0fb1eb6cb30e56b2cff19a80f))
- Relicense from MIT to Apache-2.0 (by @ChristopherVR) ([e12f926](https://github.com/ChristopherVR/pptx-viewer/commit/e12f9266f02bebbfc218986b617c418fee43a56b))
