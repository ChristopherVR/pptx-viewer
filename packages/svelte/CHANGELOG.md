# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.
A release listed with no entries carried no Conventional Commit in this package's
scope: scripts/release-plan.mjs re-releases a package whenever any of its files
change, not only on conventional ones.

## [3.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@3.0.1) - 2026-08-22

### Bug Fixes

- **core:** Spell the SmartArt role sentinel as a unicode escape (by @ChristopherVR) ([a2d4993](https://github.com/ChristopherVR/pptx-viewer/commit/a2d4993390bcdc28a3b24c1bf501c64f638f68d9))

## [3.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@3.0.0) - 2026-08-22

### Features

- **core:** Unify SmartArt layout onto one DiagramML interpreter (by @ChristopherVR) ([89116b1](https://github.com/ChristopherVR/pptx-viewer/commit/89116b131a3f13fb6b65789c46d3f9a7814d04db))
- **core:** Write chart edits back to the embedded workbook (by @ChristopherVR) ([dee19fc](https://github.com/ChristopherVR/pptx-viewer/commit/dee19fc69b02ad36eadd39f48e589de9e76689fa))
- **core:** Solve relative SmartArt constraints and apply org-chart hints (by @ChristopherVR) ([65eee20](https://github.com/ChristopherVR/pptx-viewer/commit/65eee20e9e772ab40317df0ba1acf0c26a412973))
- **shared:** Print notes pages in every binding, and honour notesStyle in the master preview (by @ChristopherVR) ([6f2f54d](https://github.com/ChristopherVR/pptx-viewer/commit/6f2f54d503806054ae48bfc8f0d0c0ee565977ce))
- **core:** Author tag elements, model embedTrueTypeFonts, and add a text-style edit path (by @ChristopherVR) ([0048d16](https://github.com/ChristopherVR/pptx-viewer/commit/0048d163c6dd87d7a0bdc3207cbcbd4db39f8d0e))
- **core,shared:** Serialize data-table styling, and paint 3D chart surfaces (by @ChristopherVR) ([bd9595a](https://github.com/ChristopherVR/pptx-viewer/commit/bd9595a7bae6c545a649ff8e1929b27a638fcb5b))
- **core:** Honour per-node shapes, style roles and connector text in SmartArt (by @ChristopherVR) ([c823fca](https://github.com/ChristopherVR/pptx-viewer/commit/c823fca506f99e3c4f42ec11513e56cdb30f9a68))
- **core,shared:** Model timing templates and play animEffect filters (by @ChristopherVR) ([8bf91f2](https://github.com/ChristopherVR/pptx-viewer/commit/8bf91f20c907f9d92abbcd5a59fb424ddfabdbd8))
- **core,shared:** Cross-browser reflections, overlay fills, and remaining text gaps (by @ChristopherVR) ([c0b0d6d](https://github.com/ChristopherVR/pptx-viewer/commit/c0b0d6d6805c6383ba2a01da3c8a22792eb22cdb))

### Bug Fixes

- **core:** Close five OpenXML parse and serialize fidelity gaps (by @ChristopherVR) ([641b0b2](https://github.com/ChristopherVR/pptx-viewer/commit/641b0b21d82442262f3f2d0e4ed2894cd71c07e9))
- **core,shared:** Correct animation preset IDs against PowerPoint COM ground truth (by @ChristopherVR) ([61b0014](https://github.com/ChristopherVR/pptx-viewer/commit/61b001440de0bf73bfcd6efd21c8df21bd47e5c8))
- **shared:** Honour a:ln/@algn and per-subpath fill modes (by @ChristopherVR) ([d049a8f](https://github.com/ChristopherVR/pptx-viewer/commit/d049a8f7806b7efb85e643e12643393372ccf603))
- **shared:** Correct autofit and paragraph-spacing semantics (by @ChristopherVR) ([86f61e9](https://github.com/ChristopherVR/pptx-viewer/commit/86f61e9b6e2cb0fe34f2e958273f35702f58fc6a))
- **shared:** Move per-script fonts and measured tab layout out of React (by @ChristopherVR) ([dbd3442](https://github.com/ChristopherVR/pptx-viewer/commit/dbd3442e2173a8b8b397af592f01e39daad95ff8))
- **shared:** Render table cell image fill, zero margins and authored grid spacing (by @ChristopherVR) ([d4079d2](https://github.com/ChristopherVR/pptx-viewer/commit/d4079d20b6517a0aac4655882e27228abc06ae09))
- **svelte:** Consume the shared render decisions for the OpenXML fidelity fixes (by @ChristopherVR) ([8d6c2be](https://github.com/ChristopherVR/pptx-viewer/commit/8d6c2beacd4897b98644166672752e8a348b3a75))
- **core,shared:** Honour cTn timing attributes, after-animation and effect sound (by @ChristopherVR) ([07ee51f](https://github.com/ChristopherVR/pptx-viewer/commit/07ee51f8b11431153e9ce2553c4c11a51e15316e))
- **core:** Close slide-structure, notes-style and DrawingML parse gaps (by @ChristopherVR) ([ee1dbcd](https://github.com/ChristopherVR/pptx-viewer/commit/ee1dbcd3278e2bde7b066c4085a82f56cc818f6a))
- **shared:** Render data tables, legend entries, image overlays and 3D text (by @ChristopherVR) ([ecec502](https://github.com/ChristopherVR/pptx-viewer/commit/ecec502e205f06c1bb7dec042f7693ac4fd8a74e))
- **svelte:** Consume the shared decisions for the second parity wave (by @ChristopherVR) ([971c76d](https://github.com/ChristopherVR/pptx-viewer/commit/971c76d07953b1282b794097179d6117e8aa2517))

### Refactor

- **shared:** Split oversized text modules and add the circle-in keyframe (by @ChristopherVR) ([1c0797f](https://github.com/ChristopherVR/pptx-viewer/commit/1c0797f7d5468dca16f6cb53c1ad413db4fc29e0))

### Documentation

- **core:** Record audited OpenXML construct coverage in the manifest (by @ChristopherVR) ([812fe61](https://github.com/ChristopherVR/pptx-viewer/commit/812fe61e66687a48c2cd19eeb0c502767c25e3c1))

### Testing

- **core:** Evidence previously unverified OpenXML constructs, and record what is not implemented (by @ChristopherVR) ([4dc6028](https://github.com/ChristopherVR/pptx-viewer/commit/4dc602876bd49cdb03b084f9f4fa2268aa01f22f))

### Chores

- **core:** Complete barrel and runtime wiring for the preceding two changes (by @ChristopherVR) ([115379e](https://github.com/ChristopherVR/pptx-viewer/commit/115379e9a757b029fbc0cbb74ae51628f7fb3e27))

## [2.23.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.23.0) - 2026-08-21

### Features

- **shared,react:** Wire interactive 3D surface chart scene (opt-in) (by @ChristopherVR) ([78587a4](https://github.com/ChristopherVR/pptx-viewer/commit/78587a4b2b34f745bd71a29d8952621eec31d3b9))
- **svelte:** Wire interactive 3D surface chart scene (opt-in) (by @ChristopherVR) ([f37c598](https://github.com/ChristopherVR/pptx-viewer/commit/f37c5985f406401b1666630ab204aa1dcb69f7de))

### Bug Fixes

- **shared:** Compute elbow/curved connector routing from actual shape geometry (by @ChristopherVR) ([eecc519](https://github.com/ChristopherVR/pptx-viewer/commit/eecc519961d0a825f550c5d1b6c41f55b1d101ae))
- **core,vue:** Compute elbow/curved connector routing from actual shape geometry (by @ChristopherVR) ([f2882a1](https://github.com/ChristopherVR/pptx-viewer/commit/f2882a11d16253683c82b04463442f6e80b7d507))

### Documentation

- **core:** Correct stale OLE and SmartArt capability text (by @ChristopherVR) ([0c7e68d](https://github.com/ChristopherVR/pptx-viewer/commit/0c7e68d66cf27fdc35f31d9fa06faab0d287a16c))
- **core:** Certify DrawingML line/stroke properties in the OpenXML coverage manifest (by @ChristopherVR) ([caa2570](https://github.com/ChristopherVR/pptx-viewer/commit/caa2570d508b4904d8f541a392933da7be50dc32))

## [2.22.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.22.1) - 2026-08-21

### Bug Fixes

- **core:** Restore mc:AlternateContent envelope on passthrough template save (by @ChristopherVR) ([1659244](https://github.com/ChristopherVR/pptx-viewer/commit/165924427f0a2e1f834e1b24d7237a1c0125d8f6))
- **core:** Stop baking theme effectRef into a literal effectLst on save (by @ChristopherVR) ([59a5566](https://github.com/ChristopherVR/pptx-viewer/commit/59a5566aef9304d4f2a31c6b4e2f95f86841dd8f))
- **core:** Read line-family chart series colors on any chart, not just combo (by @ChristopherVR) ([e62dfcf](https://github.com/ChristopherVR/pptx-viewer/commit/e62dfcf2a6850a86944730f752b321c08b44e477))
- **core:** Write line-family chart series colors into a:ln, not a corrupting spPr (by @ChristopherVR) ([5b54357](https://github.com/ChristopherVR/pptx-viewer/commit/5b54357646ca63723944bbf44f8ac7c23912e035))

## [2.22.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.22.0) - 2026-08-21

### Features

- **shared:** Add header-footer dialog draft helpers (by @ChristopherVR) ([0f640c8](https://github.com/ChristopherVR/pptx-viewer/commit/0f640c887c4d6447d2a6cbba2754049cec69e121))
- **shared:** Add classifyMediaType, the audio/video MIME classifier (by @ChristopherVR) ([56520a1](https://github.com/ChristopherVR/pptx-viewer/commit/56520a1138f342b2e4e33ff5bbedb64f5a8ca9e4))
- **shared:** Add resolveTemplateBackgroundRows for the template background card (by @ChristopherVR) ([67d327d](https://github.com/ChristopherVR/pptx-viewer/commit/67d327d737a06b7ca737feffb01d9afe637c108f))
- **shared:** Add patchChartData, the type-aware chart data patcher (by @ChristopherVR) ([5309296](https://github.com/ChristopherVR/pptx-viewer/commit/5309296df312affd6c9f9994cc7e4612310d8119))
- **svelte:** Add the missing element lock/unlock toggle (by @ChristopherVR) ([e235f66](https://github.com/ChristopherVR/pptx-viewer/commit/e235f6651e72b5f3f281d3be5f1d4f64fca297ed))
- **shared:** Add pptx.group.childCount/groupedElement i18n keys (by @ChristopherVR) ([f5557e1](https://github.com/ChristopherVR/pptx-viewer/commit/f5557e1ac1ef74af4306cf81cd2c08c8b61dd960))
- **svelte:** Add the missing group/OLE element info cards (by @ChristopherVR) ([8eb1adf](https://github.com/ChristopherVR/pptx-viewer/commit/8eb1adf52313213e0c3cbd299eb7ee3656741b02))
- **svelte:** Add the table quick-style preset swatch gallery (by @ChristopherVR) ([b2c8d8c](https://github.com/ChristopherVR/pptx-viewer/commit/b2c8d8cadaffb46229b618e877ea39d63d12a0dc))
- **svelte:** Fill out the ribbon overflow "..." menu (by @ChristopherVR) ([077c867](https://github.com/ChristopherVR/pptx-viewer/commit/077c867f183fd724f47dd7b71e4e2f96462798f7))
- **svelte:** Add SmartArt text-pane keyboard editing (Tab/Enter/Backspace) (by @ChristopherVR) ([21abb01](https://github.com/ChristopherVR/pptx-viewer/commit/21abb013e180dd20f3eae20fc98d6c03edfdf2dd))
- **svelte:** Add table column/row drag-resize handles (by @ChristopherVR) ([37d965c](https://github.com/ChristopherVR/pptx-viewer/commit/37d965c58b4e2909e718c76fc65ecb0ce3e78716))
- **svelte:** Add slide sorter context menu (duplicate/hide/delete) (by @ChristopherVR) ([e187e58](https://github.com/ChristopherVR/pptx-viewer/commit/e187e5842f71a7ea9c51caeebba04c267d8f1d5e))
- **svelte:** Add editor-canvas pinch-zoom and touch double-tap-to-edit (by @ChristopherVR) ([48158f8](https://github.com/ChristopherVR/pptx-viewer/commit/48158f8d30d9f557c11a1707b0e17eaea64e7cd5))
- **svelte:** Edit layout/master background from the slide inspector (by @ChristopherVR) ([7611027](https://github.com/ChristopherVR/pptx-viewer/commit/7611027adefb6b842a70b1e60483c62616fe22e0))

### Bug Fixes

- **shared:** Sanitize every download filename, not just callers that remember to (by @ChristopherVR) ([7bdf73b](https://github.com/ChristopherVR/pptx-viewer/commit/7bdf73be98ae30b4664067a52b1611878d7d97b3))
- **shared:** Floor animation timeline bar width to a visible minimum (by @ChristopherVR) ([918ac2f](https://github.com/ChristopherVR/pptx-viewer/commit/918ac2f5a50d11fb1ad7e015956794f9cd44dfee))
- **angular,svelte:** Render each font-picker option in its own font (by @ChristopherVR) ([b1845fa](https://github.com/ChristopherVR/pptx-viewer/commit/b1845fa7c028afb8a4db51940f2ecd65e1741100))
- **svelte,vanilla:** Commit in-progress SmartArt node text before Tab/Enter (by @ChristopherVR) ([2c79a1f](https://github.com/ChristopherVR/pptx-viewer/commit/2c79a1fa5276ecbde39c27b8fb71b2723781c336))

### Refactor

- **svelte:** Repoint header-footer draft clone/patch onto shared (by @ChristopherVR) ([8bafb06](https://github.com/ChristopherVR/pptx-viewer/commit/8bafb06a7338b47be7199383acae5cc02cc0cf23))
- **react,vue,svelte,vanilla:** Repoint media-type check onto shared (by @ChristopherVR) ([bb8e95c](https://github.com/ChristopherVR/pptx-viewer/commit/bb8e95c810e2fd709e12f21d5b073b179e1dbf52))

## [2.21.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.21.4) - 2026-08-21

### Bug Fixes

- **core:** Parse full custom geometry on pictures, not just path data (by @ChristopherVR) ([b6cbef6](https://github.com/ChristopherVR/pptx-viewer/commit/b6cbef64296fade4b1a0c77c32847e68ea0a18c5))

## [2.21.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.21.3) - 2026-08-20

### Bug Fixes

- **ci:** Resolve oxlint errors and warnings blocking CI lint job (by @ChristopherVR) ([a2031be](https://github.com/ChristopherVR/pptx-viewer/commit/a2031bedb27a4d1bf7c0cf754ce6b81a241972e5))
- **core:** Correct EOT header parsing for version 0x00020001 containers (by @ChristopherVR) ([e43720e](https://github.com/ChristopherVR/pptx-viewer/commit/e43720ed176c62e0779ddb6fd3fdffc08ba19bbd))
- **core:** Size table graphic frames from their grid extent (by @ChristopherVR) ([6d75c18](https://github.com/ChristopherVR/pptx-viewer/commit/6d75c18072cc0bb305b6550767dab780314d8dee))
- **core:** Accept Strict-OOXML lexical percentages in table style tint/shade (by @ChristopherVR) ([8fa8111](https://github.com/ChristopherVR/pptx-viewer/commit/8fa81117e68a9033c37ddd4cf61703100234171c))
- **core:** Stabilize Strict-conformance resaves (by @ChristopherVR) ([3c43f51](https://github.com/ChristopherVR/pptx-viewer/commit/3c43f5164d1e13edbc3d6e5450e66fd08664d108))
- **core:** Correct the Strict custom/extended-properties namespace mapping (by @ChristopherVR) ([d5001f9](https://github.com/ChristopherVR/pptx-viewer/commit/d5001f9f4b977fd0a76d31c0fef534ff1a53bea3))
- **core:** Stop a paragraph's alignment from leaking onto later paragraphs (by @ChristopherVR) ([c18b1e7](https://github.com/ChristopherVR/pptx-viewer/commit/c18b1e7161b4d6e5983c1542cbd2c7fe03081037))
- **core:** Keep SmartArt cached line-preset shapes with zero width or height (by @ChristopherVR) ([41e3059](https://github.com/ChristopherVR/pptx-viewer/commit/41e30596c4072295b6af3c50439c3966acae2b71))
- **shared:** Apply autofit shrink-to-fit scale/reduction to paragraph struts (by @ChristopherVR) ([4c1d5c8](https://github.com/ChristopherVR/pptx-viewer/commit/4c1d5c8f4c54ee8200d61c58027284b32e5f8f2c))

## [2.21.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.21.2) - 2026-08-20

### Bug Fixes

- **svelte,vanilla:** Fix the obfuscation key order in the embedded-font test fixture (by @ChristopherVR) ([20320c2](https://github.com/ChristopherVR/pptx-viewer/commit/20320c255c992a43c4b2b8a5117b18573be33374))
- **shared:** Describe stripped invisible characters by code point, not literally (by @ChristopherVR) ([9ddca51](https://github.com/ChristopherVR/pptx-viewer/commit/9ddca51028e7bba92a9433513dea0c5320415bdb))

## [2.21.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.21.1) - 2026-08-20

### Bug Fixes

- **shared:** Repoint options numeric-control clamp onto shared helper (by @ChristopherVR) ([138dfe5](https://github.com/ChristopherVR/pptx-viewer/commit/138dfe5d6cc780915ab8d9ca591f75c698b35f22))

### Refactor

- **shared,react,vue,vanilla:** Repoint comment mutations onto shared comments-list (by @ChristopherVR) ([0eb28dc](https://github.com/ChristopherVR/pptx-viewer/commit/0eb28dc5d714ebe695c8b23c6b09aefc6b99ac0d))

## [2.21.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.21.0) - 2026-08-20

### Features

- **shared:** Add hover tooltips to every chart mark, not just the region map (by @ChristopherVR) ([4ca29f5](https://github.com/ChristopherVR/pptx-viewer/commit/4ca29f590b1d1154b1034b7c5aeaa469610353d5))

### Bug Fixes

- **angular:** Wire Home ribbon Reset/Fill/Outline through shared commands (by @ChristopherVR) ([c06b894](https://github.com/ChristopherVR/pptx-viewer/commit/c06b8947fae4888b0db69f37c043bfe9e83dd66d))
- **svelte:** Make table row/column insert-delete merge-aware (by @ChristopherVR) ([111d272](https://github.com/ChristopherVR/pptx-viewer/commit/111d272a7d974ed70697d73ca7e523a191faffa1))
- **svelte,vanilla:** Wire double-click chart title rename (by @ChristopherVR) ([48b997c](https://github.com/ChristopherVR/pptx-viewer/commit/48b997ca7b24a3340100cf6f52b7251e5ca39e6e))
- **react,svelte:** Block unsafe URL schemes on hyperlink save (by @ChristopherVR) ([61b43e6](https://github.com/ChristopherVR/pptx-viewer/commit/61b43e6d0b5dfc4b101d82bfe817bbc58680ef37))
- **shared:** Stack line/area charts and lock their drag geometry (by @ChristopherVR) ([0da8ba5](https://github.com/ChristopherVR/pptx-viewer/commit/0da8ba55a5793d94af7822fcc7de63aa1d0243bb))
- **shared:** Extract table column-width redistribution to shared (by @ChristopherVR) ([cbd9fc7](https://github.com/ChristopherVR/pptx-viewer/commit/cbd9fc78dde57a72de3049a2ea01e1676957b463))

### Refactor

- **shared:** Extract SmartArt node-count bounds table (by @ChristopherVR) ([10cd945](https://github.com/ChristopherVR/pptx-viewer/commit/10cd945140ea3757086f0c4b1c6ea71adbb4d825))
- **shared:** Extract animation drag-to-reorder into shared (by @ChristopherVR) ([b136d02](https://github.com/ChristopherVR/pptx-viewer/commit/b136d023174959e9c51b3667e8ab78a8a983cb9f))
- **shared:** Extract SmartArt text-pane handlers to shared (by @ChristopherVR) ([911693c](https://github.com/ChristopherVR/pptx-viewer/commit/911693c9c02b63ee284890653b4dc977e35af170))
- **shared:** Extract chart legend layout to shared (by @ChristopherVR) ([acec62b](https://github.com/ChristopherVR/pptx-viewer/commit/acec62b1be7203e90206a0852e6544b73bb52266))
- **shared:** Extract animation timeline-bar layout math to shared (by @ChristopherVR) ([1a9f66d](https://github.com/ChristopherVR/pptx-viewer/commit/1a9f66d7629e18174997fdf9135edb7a70d8660e))
- **shared:** Extract table quick-style preset application (by @ChristopherVR) ([aa52c10](https://github.com/ChristopherVR/pptx-viewer/commit/aa52c106a158b2c2361b05e05968d9daadda2e52))
- **shared:** Extract export base-filename derivation to shared (by @ChristopherVR) ([58091bc](https://github.com/ChristopherVR/pptx-viewer/commit/58091bc18e766b3c870fe4af9f8c11bd0384899c))

## [2.20.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.7) - 2026-08-19

### Bug Fixes

- **core:** Correct OOXML a:tint colour math (ECMA-376 20.1.2.3.32) (by @ChristopherVR) ([7cf29f3](https://github.com/ChristopherVR/pptx-viewer/commit/7cf29f321994b7e9df8fe11d821a2c2fe686e1cd))
- **shared:** Stretch uncropped pictures to fill their frame (by @ChristopherVR) ([ff2fee3](https://github.com/ChristopherVR/pptx-viewer/commit/ff2fee3b3bba88e9a4d50a0735e9558c65e8041e))
- **core:** Don't clone an arbitrary slide onto a new blank slide (by @ChristopherVR) ([1bd1bd6](https://github.com/ChristopherVR/pptx-viewer/commit/1bd1bd6be1aa657b89ef5782e5d3c466686102c4))
- **core:** Don't bind special placeholders to untyped ones by idx alone (by @ChristopherVR) ([d92eb11](https://github.com/ChristopherVR/pptx-viewer/commit/d92eb11095ee390a596126acc59c8dd9cc18f8a8))
- **core:** Resolve layout-switch geometry from the master when omitted (by @ChristopherVR) ([a09aa5a](https://github.com/ChristopherVR/pptx-viewer/commit/a09aa5a306e160954bbc09052444ad22ab4385a1))
- **core:** Reverse the GUID-derived XOR key for font de/obfuscation (by @ChristopherVR) ([7733edf](https://github.com/ChristopherVR/pptx-viewer/commit/7733edf62f9f9a307c470dd93cfba36c8dbb9339))
- **core:** Drop untouched placeholder prompts on repeated layout switch (by @ChristopherVR) ([8842223](https://github.com/ChristopherVR/pptx-viewer/commit/884222317ad7da002e28e6272257bb4563b89fb2))
- **security:** Resolve code-scanning ReDoS and comment-sanitization alerts (by @ChristopherVR) ([e58e3f5](https://github.com/ChristopherVR/pptx-viewer/commit/e58e3f540e4e34c3617d32efdeea4ace6899e2bf))

## [2.20.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.6) - 2026-08-19

### Bug Fixes

- **shared:** Add collaboration-active-session connected-users view-model (by @ChristopherVR) ([7add165](https://github.com/ChristopherVR/pptx-viewer/commit/7add165d14ae855889bd9aedac13e859b86d2274))
- **svelte:** Mobile Comments double header, Share dialog user list (by @ChristopherVR) ([e97fdd6](https://github.com/ChristopherVR/pptx-viewer/commit/e97fdd671491fabf5b7d338d1b2471c7c49d125c))

## [2.20.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.5) - 2026-08-19

### Dependencies

- **deps:** Update y-websocket requirement from ^3.0.0 to ^3.1.0 ([#169](https://github.com/ChristopherVR/pptx-viewer/issues/169)) (by @dependabot[bot]) ([7e9c5a5](https://github.com/ChristopherVR/pptx-viewer/commit/7e9c5a51a7cb46df36223df4f91f192200562871))
- **deps:** Update @lucide/svelte requirement from ^1.28.0 to ^1.31.0 ([#166](https://github.com/ChristopherVR/pptx-viewer/issues/166)) (by @dependabot[bot]) ([3e1a554](https://github.com/ChristopherVR/pptx-viewer/commit/3e1a55404483f8010455169781dcd39a3721ef8d))

### Chores

- **deps-dev:** Update rollup-plugin-dts requirement ([#167](https://github.com/ChristopherVR/pptx-viewer/issues/167)) (by @dependabot[bot]) ([d6ecdf5](https://github.com/ChristopherVR/pptx-viewer/commit/d6ecdf53132ca750f9fc5e8b2bb45b4560f9e340))
- **deps-dev:** Update vite requirement from ^8.2.0 to ^8.2.1 ([#165](https://github.com/ChristopherVR/pptx-viewer/issues/165)) (by @dependabot[bot]) ([a059a9e](https://github.com/ChristopherVR/pptx-viewer/commit/a059a9ecbd374279864c42d45c249bcb5c0ecc6b))
- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#162](https://github.com/ChristopherVR/pptx-viewer/issues/162)) (by @dependabot[bot]) ([2645f25](https://github.com/ChristopherVR/pptx-viewer/commit/2645f258a35282b61960c30649f216e583879f12))

## [2.20.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.4) - 2026-08-14

### Bug Fixes

- **vanilla:** Repair the properties panel, inline editor, mobile chrome and show performance (by @ChristopherVR) ([47265ef](https://github.com/ChristopherVR/pptx-viewer/commit/47265efba9459359695bdcd74038b8b6d0787d0f))

## [2.20.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.3) - 2026-08-14

### Bug Fixes

- **shared:** Run an in-place morph dissolve on the wrapper, not the element (by @ChristopherVR) ([d46d2ee](https://github.com/ChristopherVR/pptx-viewer/commit/d46d2eea5aeced925f1b51b4be2758f2b634ea3e))

## [2.20.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.2) - 2026-08-14

### Bug Fixes

- **shared:** Sum a morph cross-dissolve instead of stacking two fades (by @ChristopherVR) ([86a9e7a](https://github.com/ChristopherVR/pptx-viewer/commit/86a9e7a2ab851d7b0005ab2d1c2267f668b308a8))

### Testing

- Mask the fields that legitimately move, and size two waits for CI (by @ChristopherVR) ([68bae19](https://github.com/ChristopherVR/pptx-viewer/commit/68bae19fe8cb3e283e2c87a90d31946c48be5e3a))

## [2.20.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.1) - 2026-08-14

### Bug Fixes

- Repair five regressions this review introduced (by @ChristopherVR) ([952063b](https://github.com/ChristopherVR/pptx-viewer/commit/952063b7c1a198aed9acc0696b2b326deba35e95))

## [2.20.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.20.0) - 2026-08-13

### Features

- **shared:** Take the last six chart kinds and the autosave policy (by @ChristopherVR) ([efe8438](https://github.com/ChristopherVR/pptx-viewer/commit/efe84381688dfb5f2a44a2990e76aa09b65e5fba))

### Bug Fixes

- **core:** Repair the XML plumbing four separate defects were hiding behind (by @ChristopherVR) ([8beb664](https://github.com/ChristopherVR/pptx-viewer/commit/8beb66410975d492118120515bbae6cd070ef792))
- **bindings:** Stop read-only surfaces clobbering live state (by @ChristopherVR) ([e820984](https://github.com/ChristopherVR/pptx-viewer/commit/e8209842fad62819df1530944124f0bfc33e32ec))

## [2.19.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.19.0) - 2026-08-13

### Bug Fixes

- **core:** Stop save rewriting what the author never wrote (by @ChristopherVR) ([6fb2767](https://github.com/ChristopherVR/pptx-viewer/commit/6fb2767583de0e82747c3700e3311869dd693a1d))

## [2.18.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.18.0) - 2026-08-13

### Features

- **shared:** Own the decisions the bindings were each making themselves (by @ChristopherVR) ([5421272](https://github.com/ChristopherVR/pptx-viewer/commit/5421272a531536ab3b494e5df91068c98326e6ed))
- **shared:** Model hyperlinks and equations, and own the group rules (by @ChristopherVR) ([a6bf4c1](https://github.com/ChristopherVR/pptx-viewer/commit/a6bf4c15ab3b49a44a2d24e2122ddbe3cdd3b8ed))

### Bug Fixes

- **core:** Repair save-pipeline corruption found by the OpenXML parity audit (by @ChristopherVR) ([554006e](https://github.com/ChristopherVR/pptx-viewer/commit/554006e004b6212f5561eb19954bbcff17bbdf7f))
- **svelte:** Stop shadowing shared table ops and wire the missing gestures (by @ChristopherVR) ([c90fb3f](https://github.com/ChristopherVR/pptx-viewer/commit/c90fb3f1d468a3a89b5e76703167857d313f6474))
- **core:** Close the round-trip defects the corpus harness exposed (by @ChristopherVR) ([2011c66](https://github.com/ChristopherVR/pptx-viewer/commit/2011c664049bfd580801529c3337ba65bd8d3f13))
- **svelte,vanilla:** Wire SmartArt reflow and the shared run rendering (by @ChristopherVR) ([37b7e45](https://github.com/ChristopherVR/pptx-viewer/commit/37b7e45ce926c7949099f919715595db7c779405))

## [2.17.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.9) - 2026-08-11

### Bug Fixes

- **shared:** Keep a morph pair travelling when its outline is tweened too (by @ChristopherVR) ([0316cf7](https://github.com/ChristopherVR/pptx-viewer/commit/0316cf7b058bc49b247250d9e188822fdd4ef11f))
- **shared:** Dissolve a re-fitted morph paragraph in place instead of stretching it (by @ChristopherVR) ([975c6f6](https://github.com/ChristopherVR/pptx-viewer/commit/975c6f600a836081ec0f30c99fffb9aabbaaa598))

## [2.17.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.8) - 2026-08-11

### Bug Fixes

- **shared:** Stop Vue and Angular writing an inline pointer-events lock during a show (by @ChristopherVR) ([4cb649a](https://github.com/ChristopherVR/pptx-viewer/commit/4cb649a53f5903557ef2f93c190fe6ddd538599e))
- **svelte:** Stop the show stage writing an inline pointer-events unlock (by @ChristopherVR) ([6f0a9f4](https://github.com/ChristopherVR/pptx-viewer/commit/6f0a9f4c33879543311e783f51d5fb595e5a150d))

## [2.17.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.7) - 2026-08-11

### Bug Fixes

- **vue:** Swap inherited layout artwork when a slide's layout changes (by @ChristopherVR) ([1e927ce](https://github.com/ChristopherVR/pptx-viewer/commit/1e927ce2f079c1e84659791fa62f47b9e2e0ad45))

### Refactor

- **shared:** One paragraph-spacing resolver, and delete four more binding copies (by @ChristopherVR) ([65f8268](https://github.com/ChristopherVR/pptx-viewer/commit/65f8268df08021c1985dc86d93d3338c96b792c8))
- **shared:** Give the cached-SmartArt projection the whole decision, and React's table styling too (by @ChristopherVR) ([411148f](https://github.com/ChristopherVR/pptx-viewer/commit/411148f44630a65b1cd6e90a2954a53a24f110a5))
- **shared:** Move find/replace and per-cell table CSS off their React copies (by @ChristopherVR) ([5b81728](https://github.com/ChristopherVR/pptx-viewer/commit/5b81728891f3e8cea1c2def2aed2d8b23e338081))

## [2.17.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.6) - 2026-08-10

### Bug Fixes

- **shared:** Render cached SmartArt shapes and transparent table headers as authored (by @ChristopherVR) ([24ec6b4](https://github.com/ChristopherVR/pptx-viewer/commit/24ec6b4f2079b55f02aa5559bfa3c3f1eae67652))

## [2.17.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.5) - 2026-08-10

### Bug Fixes

- **core:** Read placeholder, list and percentage values as authored (by @ChristopherVR) ([dc2d679](https://github.com/ChristopherVR/pptx-viewer/commit/dc2d679d48d3be854743d3a09bd2e20c5dc5331f))
- **shared:** Paint an inert morph ghost statically so it stops jittering (by @ChristopherVR) ([ce3be84](https://github.com/ChristopherVR/pptx-viewer/commit/ce3be8487d3530425afb3b455e1671b6c54ae61c))

## [2.17.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.4) - 2026-08-10

### Bug Fixes

- **shared:** Crossfade morph wording instead of fading it out then in (by @ChristopherVR) ([50984f1](https://github.com/ChristopherVR/pptx-viewer/commit/50984f141acc601d35aad19883b6fb1f8e0b79c2))

## [2.17.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.3) - 2026-08-10

### Dependencies

- **deps:** Update dompurify requirement from ^3.4.12 to ^3.4.13 ([#151](https://github.com/ChristopherVR/pptx-viewer/issues/151)) (by @dependabot[bot]) ([7b975ff](https://github.com/ChristopherVR/pptx-viewer/commit/7b975ff73403916341fd8a6192fb6fd6c88fdc17))
- **deps:** Update yjs requirement from ^13.6.31 to ^13.6.32 ([#152](https://github.com/ChristopherVR/pptx-viewer/issues/152)) (by @dependabot[bot]) ([456fdb8](https://github.com/ChristopherVR/pptx-viewer/commit/456fdb8493487ab3e346714755239a90698f6b4d))

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#150](https://github.com/ChristopherVR/pptx-viewer/issues/150)) (by @dependabot[bot]) ([ab75bf1](https://github.com/ChristopherVR/pptx-viewer/commit/ab75bf10a96bb2a0da6e963a5b6b8634e4f73d5b))

## [2.17.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.2) - 2026-08-08

### Bug Fixes

- Dissolve a morph's arriving shapes over the ghost that hid them (by @ChristopherVR) ([89536a3](https://github.com/ChristopherVR/pptx-viewer/commit/89536a36c3e38c3bc8b1219f702dee39e1526fcb))
- Dissolve a morph's centre panel the way PowerPoint measurably does (by @ChristopherVR) ([8c03a9a](https://github.com/ChristopherVR/pptx-viewer/commit/8c03a9a4db720dc4c6883ecd5778749e9148f3af))
- **shared:** Measure per word, and never measure a glyph in isolation (by @ChristopherVR) ([a92004b](https://github.com/ChristopherVR/pptx-viewer/commit/a92004bd554a66e5a0812d5bd20b3df1fff94379))

## [2.17.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.1) - 2026-08-07

### Bug Fixes

- **shared:** Morph a picture's scale, which OOXML stores as a source crop (by @ChristopherVR) ([e2743c7](https://github.com/ChristopherVR/pptx-viewer/commit/e2743c7509090272f4d7bed6df506402de8f6a91))
- **shared:** A still of a slide paints no media chrome (by @ChristopherVR) ([d99e6fd](https://github.com/ChristopherVR/pptx-viewer/commit/d99e6fda7de360e1b1c3f16c578119f8ce5b5d5a))
- **svelte:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([f6b3b8d](https://github.com/ChristopherVR/pptx-viewer/commit/f6b3b8d91e409d30388c187c7fc6cad1d011f727))
- **shared:** Measure each run's PowerPoint width instead of guessing one (by @ChristopherVR) ([920d1f3](https://github.com/ChristopherVR/pptx-viewer/commit/920d1f38129886f834fcfe42681339e8251f6814))
- **shared:** A media fallback says WHICH badge, not just "a badge" (by @ChristopherVR) ([1cbe78f](https://github.com/ChristopherVR/pptx-viewer/commit/1cbe78f85985ca87a834380932d845303250606d))
- **svelte:** Mark missing media as not found, not as playable (by @ChristopherVR) ([03e21b0](https://github.com/ChristopherVR/pptx-viewer/commit/03e21b0f413cb1e028b9075eeb43a740f5c19053))

### Styling

- **shared:** Escape the measurement cache separator (by @ChristopherVR) ([944b312](https://github.com/ChristopherVR/pptx-viewer/commit/944b312abee48c351b84e39c794027a18ec2d758))

## [2.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.17.0) - 2026-08-07

### Features

- Navigate a running slide show on the wheel in every binding (by @ChristopherVR) ([91a19e9](https://github.com/ChristopherVR/pptx-viewer/commit/91a19e96df9d19862b92c3f89ca55acbfbde3111))

## [2.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.16.0) - 2026-08-07

### Features

- **shared:** Map wheel gestures to PowerPoint's intents (by @ChristopherVR) ([1cc7797](https://github.com/ChristopherVR/pptx-viewer/commit/1cc779799cf5b6ffa94c39199c71b563e21afa82))

### Refactor

- Route four bindings through the shared geometry cascade (by @ChristopherVR) ([859ca12](https://github.com/ChristopherVR/pptx-viewer/commit/859ca12b37efcf98e7614b2c2109f3bf1d9c0f72))

## [2.15.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.15.3) - 2026-08-07

### Bug Fixes

- **shared:** Stop category-axis labels crowding the plot (by @ChristopherVR) ([b511ac4](https://github.com/ChristopherVR/pptx-viewer/commit/b511ac44bb53ed2ca20932801c805ea7f0a2fcd1))
- Let clicks fall through an unfilled shape's interior (by @ChristopherVR) ([7e17f9d](https://github.com/ChristopherVR/pptx-viewer/commit/7e17f9ddacd058d9b5c13f1060f58621faeb9908))
- Hollow-shape click-through in the remaining four bindings (by @ChristopherVR) ([fee05ad](https://github.com/ChristopherVR/pptx-viewer/commit/fee05ad5463de9949f289d3aac889794bc7d834a))

### Refactor

- **shared:** Single-source the shape geometry cascade (by @ChristopherVR) ([396e4a2](https://github.com/ChristopherVR/pptx-viewer/commit/396e4a28299168af0564364e9b0be7413b2c8ce8))

## [2.15.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.15.2) - 2026-08-07

### Bug Fixes

- **core:** Measure parallelogram skew against the short side, not the width (by @ChristopherVR) ([fea647f](https://github.com/ChristopherVR/pptx-viewer/commit/fea647f94633e6e919a1c59bda7a71cda8b1b677))
- **core:** Bulge the teardrop preset's point outwards, not inwards (by @ChristopherVR) ([0b23bc4](https://github.com/ChristopherVR/pptx-viewer/commit/0b23bc4b6ecde5f82f7cebb0601859edbf1ab399))
- Render ellipses as ellipses, not pills (by @ChristopherVR) ([b6d2598](https://github.com/ChristopherVR/pptx-viewer/commit/b6d2598fb58f8fc81fbef463c728d87a78c129b4))
- Stop slicing overflowing text with an identity rect clip-path (by @ChristopherVR) ([7393111](https://github.com/ChristopherVR/pptx-viewer/commit/73931118e9e29bf16d1ffccb6f01d68a02091463))

## [2.15.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.15.1) - 2026-08-07

### Bug Fixes

- **core:** Recognize nodeType="afterEffect" when parsing animation triggers (by @ChristopherVR) ([554c077](https://github.com/ChristopherVR/pptx-viewer/commit/554c077b6d0960c5777163a83afe27ee9795b8c2))

## [2.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.15.0) - 2026-08-07

### Features

- **shared:** Remember the open deck so a refresh reopens it (by @ChristopherVR) ([abbe3bd](https://github.com/ChristopherVR/pptx-viewer/commit/abbe3bd15318dd2b7b470eb69b51468d5b9ed26a))

### Bug Fixes

- **shared:** Make Set Up Slide Show's Manual advance mode actually work (by @ChristopherVR) ([c308423](https://github.com/ChristopherVR/pptx-viewer/commit/c3084238158b582b149fcc74903045f4145a0981))

## [2.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.14.0) - 2026-08-07

### Features

- **core:** Import legacy PowerPoint 97-2003 (.ppt) files (by @ChristopherVR) ([6f71bd3](https://github.com/ChristopherVR/pptx-viewer/commit/6f71bd31270afac2bdc3df4ad082a3e08d5b3e75))
- **core:** Export and import decks as portable JSON (by @ChristopherVR) ([965fc05](https://github.com/ChristopherVR/pptx-viewer/commit/965fc05ce0993d97a15d6199c8763eada99fa646))
- **shared:** Insert slides from a template gallery (by @ChristopherVR) ([abc7f77](https://github.com/ChristopherVR/pptx-viewer/commit/abc7f77d911c644faa09540eaab30a684f4b6e19))
- **shared:** Blackboard mode, element rename and column charts (by @ChristopherVR) ([a69ffce](https://github.com/ChristopherVR/pptx-viewer/commit/a69ffce0a7635632cf19cb060b329a8ff5d19422))
- **shared:** Selectively-subscribable viewer store with per-binding adapters (by @ChristopherVR) ([745c554](https://github.com/ChristopherVR/pptx-viewer/commit/745c554866d66c6318db353ab678e34f235f8037))

### Bug Fixes

- **core:** Stop inferring motion-path auto-rotate from rAng (by @ChristopherVR) ([32ee041](https://github.com/ChristopherVR/pptx-viewer/commit/32ee041249ebd5f761f54275bb98148548c7364e))
- **core:** Read line-series colours from a:ln/a:solidFill (by @ChristopherVR) ([714c10a](https://github.com/ChristopherVR/pptx-viewer/commit/714c10a2b29843dbb8481c98330db0f29a509b2d))
- **shared:** Animation reveal, stroke paint and comment threading (by @ChristopherVR) ([946aea2](https://github.com/ChristopherVR/pptx-viewer/commit/946aea274a82dbc9fd231e4caeb269fecf9d8334))
- **svelte:** Translate inspector tabs and place the caret at the end (by @ChristopherVR) ([b6d302c](https://github.com/ChristopherVR/pptx-viewer/commit/b6d302cd570a1d8b09f3cc06dfcca1d897b354a9))
- **angular:** Title the Selection Pane control like every other binding (by @ChristopherVR) ([801a88a](https://github.com/ChristopherVR/pptx-viewer/commit/801a88a7c5a06cd8d2d1592b94ab28936e0143c3))
- **shared:** Keep a drawing gesture from advancing the show (by @ChristopherVR) ([e2578cc](https://github.com/ChristopherVR/pptx-viewer/commit/e2578cc462725d70761058295de13f35c3ccb6fe))
- **shared:** Return the keyboard to the viewer after an inline edit (by @ChristopherVR) ([351947a](https://github.com/ChristopherVR/pptx-viewer/commit/351947a1e515ad748f2fa23ec0dee59b1b1a8fbc))
- **present:** Let a blanked screen pass clicks through to the show (by @ChristopherVR) ([a8cc5d2](https://github.com/ChristopherVR/pptx-viewer/commit/a8cc5d265959d98a8bee8ab9ace42dfeef53aba2))
- **shared:** Translate the labels five bindings were rendering in English (by @ChristopherVR) ([d1bfad6](https://github.com/ChristopherVR/pptx-viewer/commit/d1bfad666119f27b3a01266729a471af8a0e47ea))
- **cli:** Let the scaffolded starters open legacy .ppt decks (by @ChristopherVR) ([2cde7f8](https://github.com/ChristopherVR/pptx-viewer/commit/2cde7f84dded2d4beca7e0f48b8d0a50d0968bf5))
- **shared:** Escape SVG gradient markup attributes (by @ChristopherVR) ([7e5dd23](https://github.com/ChristopherVR/pptx-viewer/commit/7e5dd232103f90b822ca268fdb5a15b0c619be1b))
- **shared:** Route numeric SVG gradient attributes through the escape barrier (by @ChristopherVR) ([58485f3](https://github.com/ChristopherVR/pptx-viewer/commit/58485f36219d8b07c73825e47c8f7cd8b43e5a19))
- **shared:** Stop a morph inventing pairs and hiding what arrives (by @ChristopherVR) ([058051d](https://github.com/ChristopherVR/pptx-viewer/commit/058051d88201f71d64c3dee8b373af70a5f005a9))

### Performance

- **shared:** Drop state writes that carry no new information (by @ChristopherVR) ([74ba824](https://github.com/ChristopherVR/pptx-viewer/commit/74ba82402f5f73fe1d3d7c04989374417444f2d2))

### Refactor

- **shared:** Place the eight resize handles from one table (by @ChristopherVR) ([86feabb](https://github.com/ChristopherVR/pptx-viewer/commit/86feabbdf23fb0bed31b44a472b2ae411110dba9))
- **shared:** Move the canvas zoom slice onto the viewer runtime (by @ChristopherVR) ([054c9eb](https://github.com/ChristopherVR/pptx-viewer/commit/054c9eb5757ceefc10d71e596acb3b0b46d96820))

## [2.13.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.13.2) - 2026-08-05

### Bug Fixes

- **core:** Resolve styled full font names and add condensed fallbacks (by @ChristopherVR) ([26b1f74](https://github.com/ChristopherVR/pptx-viewer/commit/26b1f745929fe33cda2044dc4a24ff4edbbab0d5))
- **shared:** Draw chart text at point size and scale chart SVGs 1:1 (by @ChristopherVR) ([da333f9](https://github.com/ChristopherVR/pptx-viewer/commit/da333f933eeba0af226ca1894639696350e23cfb))
- **shared:** Suspend the show on window blur, not only tab-hide (by @ChristopherVR) ([4a2c254](https://github.com/ChristopherVR/pptx-viewer/commit/4a2c254350554c189a53a0284aeb72e84b724740))
- **shared:** Fold the origami transition like a sheet of paper (by @ChristopherVR) ([f0f9fc2](https://github.com/ChristopherVR/pptx-viewer/commit/f0f9fc2710a4c1a3760729cfddca0afc7f66c70d))
- **shared:** Cover the fillRect placement fields in the collab schema (by @ChristopherVR) ([d455ed7](https://github.com/ChristopherVR/pptx-viewer/commit/d455ed72b254633d34e08d7694069e6c0d9f5615))

## [2.13.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.13.1) - 2026-08-05

### Dependencies

- **deps:** Bump ai from 7.0.48 to 7.0.44 ([#134](https://github.com/ChristopherVR/pptx-viewer/issues/134)) (by @dependabot[bot]) ([08a13e0](https://github.com/ChristopherVR/pptx-viewer/commit/08a13e076caa6d97e22bd706e57657407aef1dd8))
- **deps:** Update @lucide/svelte requirement from ^1.27.0 to ^1.28.0 ([#142](https://github.com/ChristopherVR/pptx-viewer/issues/142)) (by @dependabot[bot]) ([1a13fb6](https://github.com/ChristopherVR/pptx-viewer/commit/1a13fb6f78117837865769323735d57ad4cb0a8f))

### Chores

- **deps-dev:** Update vite requirement from ^8.1.5 to ^8.2.0 ([#135](https://github.com/ChristopherVR/pptx-viewer/issues/135)) (by @dependabot[bot]) ([1e7e296](https://github.com/ChristopherVR/pptx-viewer/commit/1e7e2965eff8635dfa8b94fa196b89ed1d0fd0c7))

## [2.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.13.0) - 2026-08-01

### Features

- Fixed graphs and arrows shapes (by @ChristopherVR) ([94813f5](https://github.com/ChristopherVR/pptx-viewer/commit/94813f52a75fb3b42f72e7c33be41393b794cf82))

## [2.12.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.12.1) - 2026-08-01

### Bug Fixes

- Let the presenter finish the show, and keep scrubbers out of its panes (by @ChristopherVR) ([c7c12bc](https://github.com/ChristopherVR/pptx-viewer/commit/c7c12bc053548c8e94d3da385461d6569a1695a0))

### Refactor

- **shared:** Split arrow markers and dash patterns out of connector-path (by @ChristopherVR) ([53d47d1](https://github.com/ChristopherVR/pptx-viewer/commit/53d47d1d529fe17f165a16ec9de7b7f29b17845c))

## [2.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.12.0) - 2026-08-01

### Features

- Mark hidden slides in every rail and sorter, and honour custom shows in vanilla and svelte (by @ChristopherVR) ([b61f202](https://github.com/ChristopherVR/pptx-viewer/commit/b61f2029b09d2bad78fc53bdd0f0d5538b171aa9))
- Name every animation preset a user can reach, in every locale (by @ChristopherVR) ([f99962d](https://github.com/ChristopherVR/pptx-viewer/commit/f99962d0e98d579ad45ee77299b1df1f326fde6d))
- **vue:** Add the connector arrowhead controls, and make connectors clickable (by @ChristopherVR) ([2b0976e](https://github.com/ChristopherVR/pptx-viewer/commit/2b0976ea68b4ffc6c3ab7fd5d58aed1c8f5d1356))
- Draw action affordances in every binding, and mark group children (by @ChristopherVR) ([39ed47f](https://github.com/ChristopherVR/pptx-viewer/commit/39ed47f5a7a7dada06362e422aeb39e563485cab))
- Make connectors clickable and give all five the same arrowhead controls (by @ChristopherVR) ([e482b12](https://github.com/ChristopherVR/pptx-viewer/commit/e482b12ff2a589f68953ab7e48c63d4bac927fb4))
- Give all five the same presenter console, and stop vanilla dropping the show (by @ChristopherVR) ([bf861fd](https://github.com/ChristopherVR/pptx-viewer/commit/bf861fd79c55874ec4f4e66ee25357d003b6189d))

### Bug Fixes

- **shared:** Paint SVG-only pictures, honour srcRect crops, stop bold leaking (by @ChristopherVR) ([ff866db](https://github.com/ChristopherVR/pptx-viewer/commit/ff866db22a2f59f0fbb6da518b4055e8edd80481))
- Give every binding React's slide-show bar, and make slice clicks work (by @ChristopherVR) ([31f30f7](https://github.com/ChristopherVR/pptx-viewer/commit/31f30f7f26117e3badb34c2e2e0a29f32f8da608))
- Play slide media the way the deck authored it (by @ChristopherVR) ([855f140](https://github.com/ChristopherVR/pptx-viewer/commit/855f140bd3507a87de91479e62af0b67be4c8649))

## [2.11.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.11.1) - 2026-07-31

### Bug Fixes

- **shared:** Stop a morph gliding one text box into an unrelated one (by @ChristopherVR) ([bc4789f](https://github.com/ChristopherVR/pptx-viewer/commit/bc4789fef0dbcaf8d524b19f99fac15847597ad0))
- **shared:** Stop a morph double-painting unchanged shapes, and dissolve text (by @ChristopherVR) ([d4b3952](https://github.com/ChristopherVR/pptx-viewer/commit/d4b3952757d719b2c7e1b4be307b14a15c56f73a))
- Stop showing users raw OOXML tokens, and make Vanilla's point index work (by @ChristopherVR) ([33d63ce](https://github.com/ChristopherVR/pptx-viewer/commit/33d63cec94a22ddf7cc0b57ddaa61ddb43eaedd3))
- Skip hidden slides in the show, and honour endWithBlackSlide (by @ChristopherVR) ([2a9ef49](https://github.com/ChristopherVR/pptx-viewer/commit/2a9ef49f97f976eb088a2fcc092b56a54b112fa3))

## [2.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.11.0) - 2026-07-31

### Features

- **shared:** Outline view, motion-path authoring, and chart marker resolution (by @ChristopherVR) ([e6a3621](https://github.com/ChristopherVR/pptx-viewer/commit/e6a362195b811231c76a24eb94de8e95795716f8))
- Outline view, motion-path authoring and the missing chart controls (by @ChristopherVR) ([278de2f](https://github.com/ChristopherVR/pptx-viewer/commit/278de2f5754f2b8bb19722460e047deb4cd72fbb))

### Bug Fixes

- **core:** Stop dropping a:pPr/@lvl when a paragraph's runs share one style (by @ChristopherVR) ([03aa4ed](https://github.com/ChristopherVR/pptx-viewer/commit/03aa4edeea15336b032227601cc57fb65d378b1c))

## [2.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.10.0) - 2026-07-31

### Features

- **shared:** Own the equation, media, reading-view and table-grid logic (by @ChristopherVR) ([c33af39](https://github.com/ChristopherVR/pptx-viewer/commit/c33af39d2157fdb8610c104a8a3e54fa8ae7c672))
- Wire reading view, the shared equation pipeline and a table data grid (by @ChristopherVR) ([b731b52](https://github.com/ChristopherVR/pptx-viewer/commit/b731b52f926737f0ccef95247f20db217cee1fb5))

### Bug Fixes

- **shared:** Resolve linked text-box chains inside groups (by @ChristopherVR) ([5e09586](https://github.com/ChristopherVR/pptx-viewer/commit/5e0958689a591f839ccfdf20bb3ae174af00030a))

## [2.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.9.0) - 2026-07-31

### Features

- **shared:** Give every referenced translation key a real entry (by @ChristopherVR) ([8ff4461](https://github.com/ChristopherVR/pptx-viewer/commit/8ff4461d0376408330ef5ce875b4aa7a13d0614f))
- **shared:** Own the logic five bindings had each hand-ported (by @ChristopherVR) ([60b9b0d](https://github.com/ChristopherVR/pptx-viewer/commit/60b9b0d06d60d674835ef23166ca9c46c1b191ba))
- **svelte:** Close the ribbon, inspector and ruler gaps against the reference (by @ChristopherVR) ([f2e0684](https://github.com/ChristopherVR/pptx-viewer/commit/f2e0684c4df94ff9e27dc878b7221431ec71e9de))
- **core:** Model a gradient / pattern outline in structured form (by @ChristopherVR) ([69322c9](https://github.com/ChristopherVR/pptx-viewer/commit/69322c94ab40e37f19a1789c3149b5dd5d71498c))
- **shared:** Stroke a gradient outline as SVG instead of a flat border (by @ChristopherVR) ([fc72324](https://github.com/ChristopherVR/pptx-viewer/commit/fc723241643cdc18bb6ad0c113ca08763c9426ad))
- **svelte:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([dd43f2d](https://github.com/ChristopherVR/pptx-viewer/commit/dd43f2ddf135ab698cf37086823a0ea54ffd6694))
- **shared:** Stroke a patterned outline with a real pattern tile (by @ChristopherVR) ([9d8c3bd](https://github.com/ChristopherVR/pptx-viewer/commit/9d8c3bdfbd40e78d0fc66d9325efedb0bc9a3ea4))
- **svelte:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([f11c0f5](https://github.com/ChristopherVR/pptx-viewer/commit/f11c0f5b613911a3cbeda61d31af731729f0dab5))
- **shared:** Translate the File backstage and merge the stray key namespaces (by @ChristopherVR) ([e56aa6d](https://github.com/ChristopherVR/pptx-viewer/commit/e56aa6d3f00e4cbd23983036a195cba3c2d6bf6b))

### Bug Fixes

- **shared:** Honour authored preset adjustments and emit parseable gradient CSS (by @ChristopherVR) ([dbf5640](https://github.com/ChristopherVR/pptx-viewer/commit/dbf5640fb532082ca96d6a7dc8b439e07dd34a80))
- **svelte:** Apply the gradient tile background-position (by @ChristopherVR) ([7c3d664](https://github.com/ChristopherVR/pptx-viewer/commit/7c3d664e4ec635570549f0d0b464294170dfbde0))
- **core:** Honour a preset path's own coordinate space, and repair hexagon (by @ChristopherVR) ([8e4a91d](https://github.com/ChristopherVR/pptx-viewer/commit/8e4a91d76a2bdd3ba3369ed541bc262d2a9c06f4))
- **core:** Rebuild flowChartTerminator from its spec Beziers (by @ChristopherVR) ([0e81403](https://github.com/ChristopherVR/pptx-viewer/commit/0e8140381fe6af3719a52dcc1b39f16609b5faf0))
- **core:** Keep an inline field in the position it was authored in (by @ChristopherVR) ([beb2067](https://github.com/ChristopherVR/pptx-viewer/commit/beb2067fc11ae709a26b4f9e6714fa557375ec85))
- **core:** Rebuild sun as a disc plus eight detached rays (by @ChristopherVR) ([cd2fcd4](https://github.com/ChristopherVR/pptx-viewer/commit/cd2fcd4baec66f040671aea332d1bcd2250a2e7f))
- **core:** Round-trip the Selection Pane hide toggle (by @ChristopherVR) ([14bdb23](https://github.com/ChristopherVR/pptx-viewer/commit/14bdb23d8c2840cc93d8a891c31ac9e8ffdf44cf))
- **shared:** Resolve a click on a group's child to the group (by @ChristopherVR) ([88ef671](https://github.com/ChristopherVR/pptx-viewer/commit/88ef671c4af065c0e21327ceec5840a2de4d4516))
- **shared:** Flow linked text-box overflow in every binding (by @ChristopherVR) ([abe1bb0](https://github.com/ChristopherVR/pptx-viewer/commit/abe1bb0702315c8a65582f1d64f62c6679298143))

### Refactor

- **svelte:** Clear the file-size debt, and the duplicate viewer state behind it (by @ChristopherVR) ([830bcc9](https://github.com/ChristopherVR/pptx-viewer/commit/830bcc9ed77d85f1461f4861a326dbbba7ebcc31))

### Testing

- **core:** Pin issue #132 fill and adjustment parsing against the reporter deck (by @ChristopherVR) ([06cd312](https://github.com/ChristopherVR/pptx-viewer/commit/06cd31287bcbd3895a834bed9f89af443526dca2))

## [2.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.8.0) - 2026-07-31

### Features

- **shared:** Decide which slide-show clicks are a PowerPoint advance (by @ChristopherVR) ([12ab5c8](https://github.com/ChristopherVR/pptx-viewer/commit/12ab5c82f08083e725eae332ee19b03b5021ce79))

## [2.7.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.7.1) - 2026-07-31

### Bug Fixes

- **shared:** Match PowerPoint's morph dissolve windows and half-turn direction (by @ChristopherVR) ([661c250](https://github.com/ChristopherVR/pptx-viewer/commit/661c250ff429f0d8ea2f0bb5e2992a7d57af0353))
- **shared:** Stop morph pairing a shape with the group that wraps it (by @ChristopherVR) ([d240498](https://github.com/ChristopherVR/pptx-viewer/commit/d240498388734b5e81b238036856d891f86f2570))
- **core:** Stop an interactive sequence adding a phantom click step (by @ChristopherVR) ([65a4738](https://github.com/ChristopherVR/pptx-viewer/commit/65a4738a6eb8fd0b34999c52dd7e1244c5f0e6b5))
- **shared:** Resolve the timed slide auto-advance delay (by @ChristopherVR) ([beba8cc](https://github.com/ChristopherVR/pptx-viewer/commit/beba8ccb834f1eb04db305d68ac31d40beda4232))
- **svelte:** Wire the backstage browse control and stretch its nav rail (by @ChristopherVR) ([339adb2](https://github.com/ChristopherVR/pptx-viewer/commit/339adb2c0c8a0871f8690562499c1c7f04b463a5))
- **svelte:** Make the slide show's transitions visible on a large display (by @ChristopherVR) ([f8a8b8a](https://github.com/ChristopherVR/pptx-viewer/commit/f8a8b8a47145577bb57dda020ada69ab9bb74fa0))
- **svelte:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([3ce750a](https://github.com/ChristopherVR/pptx-viewer/commit/3ce750ae5847a9406f24a221fd31cda6f36dc8a0))

### Refactor

- **shared:** Break the morph-matching <-> morph-flatten import cycle (by @ChristopherVR) ([92223c5](https://github.com/ChristopherVR/pptx-viewer/commit/92223c542d357d2831b4b3641180fec20c264dc1))

## [2.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.7.0) - 2026-07-31

### Features

- **shared:** Morph a !!-named shape across a grouping boundary (by @ChristopherVR) ([c74847d](https://github.com/ChristopherVR/pptx-viewer/commit/c74847dd53ef3344c4624c036a2f806ea62794c1))

### Bug Fixes

- **shared:** Morph rotates the short way round, like PowerPoint (by @ChristopherVR) ([255d0b5](https://github.com/ChristopherVR/pptx-viewer/commit/255d0b5541bdf12d66ab773090fee179072eb852))
- **shared:** Honour the legacy spd speed, including for morph (by @ChristopherVR) ([ab796b9](https://github.com/ChristopherVR/pptx-viewer/commit/ab796b94e27fa8addbad5f70578b4c9a591c1b11))
- **shared:** Keep a morphing object solid instead of dipping to the background (by @ChristopherVR) ([5f2b518](https://github.com/ChristopherVR/pptx-viewer/commit/5f2b518d39c16eeb207f70ea1df2583405022611))

## [2.6.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.6.6) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph id-pairing shapes whose creationId GUIDs differ (by @ChristopherVR) ([b9afc84](https://github.com/ChristopherVR/pptx-viewer/commit/b9afc844f0cab88ed44b25236f21b4628f1309a6))

## [2.6.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.6.5) - 2026-07-30

### Bug Fixes

- **core:** Stamp the endParaRPr size on an empty paragraph's separator (by @ChristopherVR) ([2b18374](https://github.com/ChristopherVR/pptx-viewer/commit/2b1837473bdde04bc41f9593f444a096dd4196b8))
- **shared:** PowerPoint-exact line height, blank-line strut, marker indent reset (by @ChristopherVR) ([7f7181b](https://github.com/ChristopherVR/pptx-viewer/commit/7f7181b2d4ec36f990b157964c2aa648d291b20f))

## [2.6.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.6.4) - 2026-07-30

### Bug Fixes

- **shared:** Restate the static transform in every morph keyframe (by @ChristopherVR) ([075a645](https://github.com/ChristopherVR/pptx-viewer/commit/075a6454fe4a5a17e79e2b2adb213ea2e21ccfb0))

## [2.6.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.6.3) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph pairing nearby shapes of very different sizes; 2s default (by @ChristopherVR) ([3d49c67](https://github.com/ChristopherVR/pptx-viewer/commit/3d49c672089ae26008f24f8cce7160ef22709507))

## [2.6.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.6.2) - 2026-07-30

### Bug Fixes

- **shared:** Crossfade a morph pair whose GROUP children changed (by @ChristopherVR) ([7492f26](https://github.com/ChristopherVR/pptx-viewer/commit/7492f26a236659f2c15a99c36a92023f7da6cbbc))

## [2.6.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.6.1) - 2026-07-29

### Bug Fixes

- **core:** Keep grouped text at its authored point size (by @ChristopherVR) ([56f676a](https://github.com/ChristopherVR/pptx-viewer/commit/56f676a850a510fa405361d58c849e4a7adb3bea))
- **shared:** Keep authored blank lines and give the bullet its hanging box (by @ChristopherVR) ([0a8de56](https://github.com/ChristopherVR/pptx-viewer/commit/0a8de560f117fdaeb06374e61e49a2cf4e1372b7))
- **shared:** Make morph animate a near-duplicate slide pair (by @ChristopherVR) ([e73ade7](https://github.com/ChristopherVR/pptx-viewer/commit/e73ade737892f3b46a79eb183370a86e3f8b59fe))
- **svelte:** Render authored blank lines and drop the bullet spacer (by @ChristopherVR) ([a964ad1](https://github.com/ChristopherVR/pptx-viewer/commit/a964ad1f4502962e551f0c10ea3c71120473686d))

## [2.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.6.0) - 2026-07-27

### Features

- **shared:** Morph transition render plan and paragraph strut basis (by @ChristopherVR) ([94cfddd](https://github.com/ChristopherVR/pptx-viewer/commit/94cfddd2afc9ab20f294f6aa08ddf95fff7f5213))

### Bug Fixes

- **core:** Parse morph, fontRef text colour, and unsized bullets correctly (by @ChristopherVR) ([7607996](https://github.com/ChristopherVR/pptx-viewer/commit/7607996123e493ed1f33a6891e444f3b02bb2ed9))
- **svelte:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([8c44caf](https://github.com/ChristopherVR/pptx-viewer/commit/8c44caf16f755af8ce0ced24bf3ee55d2f50261e))

## [2.5.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.5.3) - 2026-07-27

### Dependencies

- **deps:** Update @lucide/svelte requirement from ^1.26.0 to ^1.27.0 ([#121](https://github.com/ChristopherVR/pptx-viewer/issues/121)) (by @dependabot[bot]) ([eec772a](https://github.com/ChristopherVR/pptx-viewer/commit/eec772ad7a6e06d54306641c48ba93b2877725c3))
- **deps:** Update emf-converter requirement from ^2.0.0 to ^2.0.2 ([#122](https://github.com/ChristopherVR/pptx-viewer/issues/122)) (by @dependabot[bot]) ([423034a](https://github.com/ChristopherVR/pptx-viewer/commit/423034ad1e6d48dbb75be17e1915c917c912517b))
- **deps:** Update html2canvas-pro requirement from ^2.3.1 to ^2.3.2 ([#124](https://github.com/ChristopherVR/pptx-viewer/issues/124)) (by @dependabot[bot]) ([6ad6bce](https://github.com/ChristopherVR/pptx-viewer/commit/6ad6bceecf88670f33e2544dbeb1a98c8b1bf9f6))

### Chores

- **deps-dev:** Update rollup requirement from ^4.62.2 to ^4.62.3 ([#125](https://github.com/ChristopherVR/pptx-viewer/issues/125)) (by @dependabot[bot]) ([61a7b66](https://github.com/ChristopherVR/pptx-viewer/commit/61a7b66fa5ff6fd3fd32c531d87d20875c77a28f))

## [2.5.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.5.2) - 2026-07-27

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## [2.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.5.1) - 2026-07-26

### Testing

- **e2e:** Cover remote presence geometry in every binding (by @ChristopherVR) ([adb9b3c](https://github.com/ChristopherVR/pptx-viewer/commit/adb9b3c180d3f7fce1bd175dfc0b29d385937a51))

## [2.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.5.0) - 2026-07-26

### Features

- **shared:** Lock the audience display out of edit mode (by @ChristopherVR) ([79dc876](https://github.com/ChristopherVR/pptx-viewer/commit/79dc8768ff599e662c4291861b340c2939001f84))
- **shared:** Seed a slide as fully built, and keep audience input inert (by @ChristopherVR) ([6acdf5e](https://github.com/ChristopherVR/pptx-viewer/commit/6acdf5e02c6d727828433ba067942e72d6547922))

### Bug Fixes

- **core:** Keep the click step's own start conditions (by @ChristopherVR) ([755a4b2](https://github.com/ChristopherVR/pptx-viewer/commit/755a4b2e38dff73c9c460a5318c1fce913880328))
- **shared:** Play a slide's opening build without a click (by @ChristopherVR) ([9d0ecec](https://github.com/ChristopherVR/pptx-viewer/commit/9d0ecec007d1f7ef48ecbd97429b55073352a487))
- **svelte:** Never show the editor in an audience display (by @ChristopherVR) ([4b2c39b](https://github.com/ChristopherVR/pptx-viewer/commit/4b2c39b30e5382b20d9033c1b03524cd8ea712a7))
- **core:** Paint useBgFill shapes with the slide background (by @ChristopherVR) ([f819817](https://github.com/ChristopherVR/pptx-viewer/commit/f81981744c637368d1ef0d87b1ba884e634c938a))
- **shared:** Ripple a by-paragraph build that also iterates (by @ChristopherVR) ([73238d5](https://github.com/ChristopherVR/pptx-viewer/commit/73238d590217f8c61e86c9f065d19436dd6b699b))
- **svelte:** Hold back on a back step, ignore audience input (by @ChristopherVR) ([4794bbe](https://github.com/ChristopherVR/pptx-viewer/commit/4794bbe26cc319f37b5cee64e26c38a4fb54bd71))

## [2.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.4.0) - 2026-07-25

### Bug Fixes

- **svelte:** Clear the build warnings and repair windows dts bundling (by @ChristopherVR) ([40c170a](https://github.com/ChristopherVR/pptx-viewer/commit/40c170ae2050f827b71814aa1af1eedd869e32f7))

### Dependencies

- **deps:** Update @lucide/svelte requirement from ^1.25.0 to ^1.26.0 ([#113](https://github.com/ChristopherVR/pptx-viewer/issues/113)) (by @dependabot[bot]) ([66c656f](https://github.com/ChristopherVR/pptx-viewer/commit/66c656ff50ff7e9cfaf0139dc70ea0944aaf1528))
- **deps:** Update ai requirement from ^7.0.35 to ^7.0.37 ([#115](https://github.com/ChristopherVR/pptx-viewer/issues/115)) (by @dependabot[bot]) ([71d200d](https://github.com/ChristopherVR/pptx-viewer/commit/71d200d5aa0627c90fb2c8bfc0c50ee4b132a7d8))

### Chores

- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))
- **deps-dev:** Update happy-dom requirement from ^20.11.0 to ^20.11.1 ([#116](https://github.com/ChristopherVR/pptx-viewer/issues/116)) (by @dependabot[bot]) ([0a2f499](https://github.com/ChristopherVR/pptx-viewer/commit/0a2f4990ae3caa60de537c9e0ea38ca8d796fd56))

## [2.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.3.0) - 2026-07-25

### Features

- **shared:** Rule for advancing a show from the presenter slide pane (by @ChristopherVR) ([ee2d0f5](https://github.com/ChristopherVR/pptx-viewer/commit/ee2d0f584dd042eeee89c57ec3c33335208bde28))

### Bug Fixes

- **core:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([eebf128](https://github.com/ChristopherVR/pptx-viewer/commit/eebf128df224247eb06ea1731c9418fcc36189f9))
- **shared:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([406d78b](https://github.com/ChristopherVR/pptx-viewer/commit/406d78b2471ec171fe5cbd8b2ef6abb3216c3c3b))
- **shared:** Parse playFrom media commands in linear time (by @ChristopherVR) ([60820b1](https://github.com/ChristopherVR/pptx-viewer/commit/60820b10ebf641ec2adf6c6d1089fe9f2bc4e490))
- **svelte:** Restore double-tap to edit under finger-sized handles (by @ChristopherVR) ([956281e](https://github.com/ChristopherVR/pptx-viewer/commit/956281ec4b6ae6a5174f08e776ebf6a7830a683a))
- Svelte border width for selected element (by @ChristopherVR) ([b1dccd1](https://github.com/ChristopherVR/pptx-viewer/commit/b1dccd192edb7509ed8b59e76a3e638dbef0e3af))
- **core:** Honour a:noFill and stop painting hidden fills/lines (by @ChristopherVR) ([ae13541](https://github.com/ChristopherVR/pptx-viewer/commit/ae1354188b1c5d2bd5843dc36a7c438ba1d83c00))

## [2.2.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.2.1) - 2026-07-24

### Bug Fixes

- **core:** Preserve native bullets and boundary spaces ([#107](https://github.com/ChristopherVR/pptx-viewer/issues/107)) ([7ed0971](https://github.com/ChristopherVR/pptx-viewer/commit/7ed09718d2fc439b129ee5ed23c8f5c41fe399ba))
- **svelte:** Enable touch resize of elements on mobile (by @ChristopherVR) ([6cab6d6](https://github.com/ChristopherVR/pptx-viewer/commit/6cab6d66e8f197d56270cff711c3d9501730c224))

## [2.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.2.0) - 2026-07-24

### Features

- **shared:** Powerpoint-accurate slide-show keyboard map (by @ChristopherVR) ([fdf55d4](https://github.com/ChristopherVR/pptx-viewer/commit/fdf55d45779e090c36aa994cdc17fae8f01df79b))
- **vanilla:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([629903c](https://github.com/ChristopherVR/pptx-viewer/commit/629903c8c1ecab33e5dde40ffef42a88e8bde94e))
- **svelte:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([7d349f3](https://github.com/ChristopherVR/pptx-viewer/commit/7d349f3d17170ef8603267e6d821585083d6da8a))
- **react:** Give the slide-show menu PowerPoint's full command set (by @ChristopherVR) ([33c826d](https://github.com/ChristopherVR/pptx-viewer/commit/33c826d887c69e5103b0f0148e9ee1b1c17b16b0))

## [2.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.1.0) - 2026-07-23

### Features

- **shared:** Live-patch channel for interim collaboration state (by @ChristopherVR) ([efdcc1e](https://github.com/ChristopherVR/pptx-viewer/commit/efdcc1e13ef824f6b26f3c92ba199e0da732b164))
- **shared:** Make a departing collaborator actually leave the room (by @ChristopherVR) ([6af3d8c](https://github.com/ChristopherVR/pptx-viewer/commit/6af3d8ce9933946a5420f1a21c8de55cf7da3548))

### Bug Fixes

- **svelte:** Publish inline-editor typing to peers before commit (by @ChristopherVR) ([ad63f5b](https://github.com/ChristopherVR/pptx-viewer/commit/ad63f5b3e1d4fc8cb5e7662fd74745fea66890c3))
- **svelte:** Draw chrome icons with lucide, not text glyphs (by @ChristopherVR) ([8df0a37](https://github.com/ChristopherVR/pptx-viewer/commit/8df0a3700263bd49aa7049bdac512f6a0d7feb76))
- **svelte:** Stack the follow bar above the mobile bottom bar (by @ChristopherVR) ([7f2140f](https://github.com/ChristopherVR/pptx-viewer/commit/7f2140fc1d7e07b9e118ef1acf5bc6140c0d8160))
- **svelte:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([17bd9f1](https://github.com/ChristopherVR/pptx-viewer/commit/17bd9f16ac2b30aeb0ec3eae216720613df61e7e))
- **svelte:** Anchor the follow bar top-centre and trim the collab controller (by @ChristopherVR) ([daade43](https://github.com/ChristopherVR/pptx-viewer/commit/daade4365205ff147229cc311bbb260e9ae1da9e))

### Other

- Svelte lucide icon sweep + follow bar clears the mobile bottom bar (by @ChristopherVR) ([8b99577](https://github.com/ChristopherVR/pptx-viewer/commit/8b995771af93eb90ab2b0ab03e29dd0314514a09))
- Peers leave the room synchronously on frame teardown (no ghost collaborators) (by @ChristopherVR) ([ae9acad](https://github.com/ChristopherVR/pptx-viewer/commit/ae9acad9cfe65ee8dfa6a9676152b6c1abab5b0f))

### Refactor

- **shared:** Split the live-patch module and escape its NUL key separator (by @ChristopherVR) ([6362b22](https://github.com/ChristopherVR/pptx-viewer/commit/6362b22135da6b7503113799f2631f8085ea49c5))
- **svelte:** Lift the collab controller's effects into their own module (by @ChristopherVR) ([b3b9acd](https://github.com/ChristopherVR/pptx-viewer/commit/b3b9acd4b10e1e65e0dcc0040cfe37788b27ce82))

## [2.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@2.0.0) - 2026-07-23

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))
- **shared:** Ai config, loader and bridge contracts (by @ChristopherVR) ([1c40e28](https://github.com/ChristopherVR/pptx-viewer/commit/1c40e28b1661895e2993b01c11bea6262459cb88))
- **vue:** Ai bridge and chat session composables (by @ChristopherVR) ([0f5cfd3](https://github.com/ChristopherVR/pptx-viewer/commit/0f5cfd3b35df3ef90cc5057b268a7f70dd44ab9f))
- **shared:** Indexeddb-first ai chat history store (by @ChristopherVR) ([88920f2](https://github.com/ChristopherVR/pptx-viewer/commit/88920f20eb00e72b84efa9ef2cb500dfd6d20db4))
- **shared:** Rebuild AI assistant tools on pptx-viewer-mcp (by @ChristopherVR) ([da1c31e](https://github.com/ChristopherVR/pptx-viewer/commit/da1c31ee88c0b60a82628003c8a1b16245f028ed))
- **core:** Upgrade emf-converter to 2.0.0 (breaking) (by @ChristopherVR) ([effa4e5](https://github.com/ChristopherVR/pptx-viewer/commit/effa4e5338b2b01796a3671f505bcb4563de74cc))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))
- **build:** Restore pptx-viewer-shared/ai vitest alias after main merge (by @ChristopherVR) ([f878be8](https://github.com/ChristopherVR/pptx-viewer/commit/f878be8dc5b4735081690b691ca30bf3b0264559))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))
- Friendly 2.0.0 changelog for root and packages (by @ChristopherVR) ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))

### Testing

- **shared:** Opt-in live gpt-4o-mini ai integration test (by @ChristopherVR) ([48622f1](https://github.com/ChristopherVR/pptx-viewer/commit/48622f135a5f2ee4c28d97d08478d3c203745f47))

### Build & CI

- **shared:** Keep the ai SDK external across bindings (by @ChristopherVR) ([fa5e6b7](https://github.com/ChristopherVR/pptx-viewer/commit/fa5e6b77e6586764d9e7717439f574291810e93b))
- Pin Vue/Angular/Svelte to exact TypeScript 6.0.3 (by @ChristopherVR) ([3d80082](https://github.com/ChristopherVR/pptx-viewer/commit/3d8008282231e1ee4bc11300757d1cc35e8dc174))

## [1.39.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.39.0) - 2026-07-21

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.38.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.38.0) - 2026-07-21

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.37.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.37.0) - 2026-07-21

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.36.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.36.0) - 2026-07-21

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.35.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.35.0) - 2026-07-21

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.34.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.34.0) - 2026-07-21

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.33.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.33.0) - 2026-07-20

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.32.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.32.0) - 2026-07-20

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.31.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.31.0) - 2026-07-20

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.30.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.30.0) - 2026-07-20

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.29.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.29.0) - 2026-07-20

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.28.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.28.0) - 2026-07-20

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.27.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.27.0) - 2026-07-20

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.26.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.26.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.25.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.25.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.24.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.24.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.23.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.23.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.22.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.22.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.21.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.21.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.20.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.20.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.19.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.19.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.18.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.18.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.17.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.16.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.15.0) - 2026-07-19

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.14.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.13.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.12.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.11.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.10.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.9.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.8.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.7.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.6.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.5.0) - 2026-07-18

### Features

- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

## [1.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.4.0) - 2026-07-18

### Dependencies

- **deps:** Update dependencies to latest and migrate core/shared/locales to TypeScript 7 (by @ChristopherVR) ([cc72948](https://github.com/ChristopherVR/pptx-viewer/commit/cc729482cc5ae4ae56e1219f290c2953ec83c12a))

## [1.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.3.0) - 2026-07-18

### Bug Fixes

- **svelte:** Ship jszip and fast-xml-parser as real dependencies (by @ChristopherVR) ([20d8cf2](https://github.com/ChristopherVR/pptx-viewer/commit/20d8cf2de4ff94de2598143bfc9a8aa1c9d26f71))

## [1.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.2.0) - 2026-07-18

### Features

- **svelte:** Ribbon and chrome parity with React (by @ChristopherVR) ([41b5bf1](https://github.com/ChristopherVR/pptx-viewer/commit/41b5bf100afb99b58a7db3d2d0b26ccc77d413fc))
- **svelte:** Full React-parity Properties sections in the inspector (by @ChristopherVR) ([2afd746](https://github.com/ChristopherVR/pptx-viewer/commit/2afd74633dadb0634db3b19fb42864394cd00c21))

## [1.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.1.0) - 2026-07-17

### Features

- **svelte:** Add theme/language switching and a real Account page (by @ChristopherVR) ([499fef4](https://github.com/ChristopherVR/pptx-viewer/commit/499fef497be18a8137ed3956e5dce2186ad31411))

### Other

- Integrate release version bumps (by @ChristopherVR) ([4b3893f](https://github.com/ChristopherVR/pptx-viewer/commit/4b3893f4158803cc5533beb266ffdc8c776177cb))
- Integrate Svelte theme/language switching and Account page (by @ChristopherVR) ([2f1488e](https://github.com/ChristopherVR/pptx-viewer/commit/2f1488e435497e967bf2fe268d7495778957245b))

## [1.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@1.0.0) - 2026-07-17

### Features

- **svelte:** Add hiddenActions prop to hide individual toolbar/ribbon actions (by @ChristopherVR) ([dbc6a7d](https://github.com/ChristopherVR/pptx-viewer/commit/dbc6a7d4c9480de00d269697820092de426f600e))

### Bug Fixes

- **svelte:** Ship extracted stylesheet instead of runtime-injected CSS (by @ChristopherVR) ([80270a1](https://github.com/ChristopherVR/pptx-viewer/commit/80270a17e39ed6a8d06189fa21c99a56ccb88490))

## [0.9.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.9.1) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [0.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.9.0) - 2026-07-17

### Features

- **file:** Use Lucide icons in Svelte and Vanilla (by @ChristopherVR) ([a956f1b](https://github.com/ChristopherVR/pptx-viewer/commit/a956f1ba7c05c949db517184cd0413cc0271b8dc))

## [0.8.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.8.1) - 2026-07-16

### Bug Fixes

- **e2e:** Relax media pause timing check (by @ChristopherVR) ([17e5116](https://github.com/ChristopherVR/pptx-viewer/commit/17e511652f6f5e6594bc6b9b2285ceb81fee47f9))

## [0.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.8.0) - 2026-07-16

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

## [0.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.7.0) - 2026-07-15

### Features

- **viewer:** Complete shared e2e parity (by @ChristopherVR) ([170bc74](https://github.com/ChristopherVR/pptx-viewer/commit/170bc74f21dc1c4c5a1d7c5583cf5c8656a312d3))

### Bug Fixes

- **viewer:** Align inspector and status chrome (by @ChristopherVR) ([0a4b38a](https://github.com/ChristopherVR/pptx-viewer/commit/0a4b38a851f42ec7dbc18b097904bfaa4e95a67c))
- **viewer:** Align responsive mobile chrome (by @ChristopherVR) ([547f98c](https://github.com/ChristopherVR/pptx-viewer/commit/547f98cb37705aff9c36a6098f7cb6986101992f))

### Testing

- **viewer:** Enforce framework-neutral e2e parity (by @ChristopherVR) ([7389c7e](https://github.com/ChristopherVR/pptx-viewer/commit/7389c7e7586e7ce926400a096945b7e51448f709))

## [0.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.6.0) - 2026-07-13

### Features

- **bindings:** Close svelte and vanilla parity gaps (by @ChristopherVR) ([9cb9d7e](https://github.com/ChristopherVR/pptx-viewer/commit/9cb9d7e53bf1dcda3b051b0ba5737e17115be4c4))

### Bug Fixes

- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Dependencies

- **deps:** Update html2canvas-pro to 2.2.3 (by @dependabot[bot]) ([0fe015b](https://github.com/ChristopherVR/pptx-viewer/commit/0fe015b83722534f14864b2054ce6561b09386ca))
- **deps:** Update fast-xml-parser to 5.10.0 (by @dependabot[bot]) ([6080273](https://github.com/ChristopherVR/pptx-viewer/commit/6080273f6a6f603d10d69a71d54faad1e6d9bf05))
- **deps:** Update dompurify to 3.4.12 (by @dependabot[bot]) ([00a6ca4](https://github.com/ChristopherVR/pptx-viewer/commit/00a6ca49609d5a0e922a9e20447460b11ec690ba))
- **deps:** Update api-extractor to 7.58.9 (by @dependabot[bot]) ([0225e1f](https://github.com/ChristopherVR/pptx-viewer/commit/0225e1f2281358643a6325018a9750676990c604))
- **deps:** Update minor and patch dependencies (by @dependabot[bot]) ([5cd81fb](https://github.com/ChristopherVR/pptx-viewer/commit/5cd81fb0c8708e53990ac4858660d0b6a4b17a7a))
- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## [0.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.5.1) - 2026-07-13

### Bug Fixes

- **svelte:** Raise smart-art-3d-view's flushMount tick budget to de-flake CI (by @ChristopherVR) ([cefb575](https://github.com/ChristopherVR/pptx-viewer/commit/cefb57565eba8c3465d2d331179c11ae364affce))
- **core:** Open Office-encrypted pptx files (by @ChristopherVR) ([51aa670](https://github.com/ChristopherVR/pptx-viewer/commit/51aa670e8ca78d78323f55766b1a4c0e8b366c00))

## [0.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.5.0) - 2026-07-11

### Features

- **core:** Add canonical collaboration field-schema (by @ChristopherVR) ([cc78c1e](https://github.com/ChristopherVR/pptx-viewer/commit/cc78c1ed352fac3f69180ec2846d1df3e1dbd377))
- **svelte:** Full collaboration presence + UI (Share/Broadcast/cursors) (by @ChristopherVR) ([b5dda6e](https://github.com/ChristopherVR/pptx-viewer/commit/b5dda6ef8319ec9059e2730bc578f9f347c89cf4))
- **shared:** Add the office colour swatch catalogue (by @ChristopherVR) ([41135a0](https://github.com/ChristopherVR/pptx-viewer/commit/41135a0f8687550cb17ded1451fa8f361fc975b1))
- **svelte:** Add ink-stroke editing state (EditorInkController) (by @ChristopherVR) ([9f8d2ec](https://github.com/ChristopherVR/pptx-viewer/commit/9f8d2ec0d1d705ff4ccf23d2eb30e9668b79b134))
- **svelte:** Wire pen/highlighter/eraser pointer gestures on the stage (by @ChristopherVR) ([25540a6](https://github.com/ChristopherVR/pptx-viewer/commit/25540a6d4c5b1da751c3f379c4f747cc5178cad9))
- **svelte:** Add the Draw ribbon tab (by @ChristopherVR) ([90bb39b](https://github.com/ChristopherVR/pptx-viewer/commit/90bb39b44c134062ffa46d0fd69a3cb6b075a6e2))

### Bug Fixes

- **shared:** Close CRDT allowlist data-loss gaps, add binary asset map (by @ChristopherVR) ([60ad222](https://github.com/ChristopherVR/pptx-viewer/commit/60ad2226bc4f3450c2992362e9fcceaac77f2ccf))
- **svelte:** Keep zoom/fullscreen/notes controls always visible in the ribbon (by @ChristopherVR) ([00fd396](https://github.com/ChristopherVR/pptx-viewer/commit/00fd396057c9c992b6b54272d2a2b4072faa5c93))

## [0.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.4.0) - 2026-07-11

### Features

- **svelte:** Add chart insert to the Insert tab (by @ChristopherVR) ([b4dbbc3](https://github.com/ChristopherVR/pptx-viewer/commit/b4dbbc3c3fffb455d1853d3e05fac9c4b2e92600))
- **svelte:** Add equation insert to the Insert tab (by @ChristopherVR) ([5d8a5fd](https://github.com/ChristopherVR/pptx-viewer/commit/5d8a5fdc5422642c50c072dcf441e221a0392b64))
- **svelte:** Add SmartArt insert to the Insert tab (by @ChristopherVR) ([6a5a12e](https://github.com/ChristopherVR/pptx-viewer/commit/6a5a12e2dd47c030eb60f59c75534e0f2be13f24))
- **svelte:** Add media insert factory for the Insert tab (by @ChristopherVR) ([3fe31b7](https://github.com/ChristopherVR/pptx-viewer/commit/3fe31b7570091644f03be2ffe1efaae18b997588))
- **svelte:** Add action button insert to the Insert tab (by @ChristopherVR) ([22136ca](https://github.com/ChristopherVR/pptx-viewer/commit/22136ca4499a383b98d6dd147a812d6a42e07086))
- **svelte:** Add field insert to the Insert tab (by @ChristopherVR) ([e8c4f7f](https://github.com/ChristopherVR/pptx-viewer/commit/e8c4f7fe7c3fe908f705e6a29eee31c3431353af))
- **svelte:** Wire the new Insert actions into the ribbon (by @ChristopherVR) ([105a338](https://github.com/ChristopherVR/pptx-viewer/commit/105a338b600f8ad265a2f4f513c37f75c8ea228d))
- **svelte:** Add slide-background/transition/animation editor actions (by @ChristopherVR) ([f032a47](https://github.com/ChristopherVR/pptx-viewer/commit/f032a4773e2b7d43a66121c12bfadffdbeccb687))
- **svelte:** Add Design, Transitions, and Animations ribbon tabs (by @ChristopherVR) ([86caaec](https://github.com/ChristopherVR/pptx-viewer/commit/86caaec25cdb9753fc76ca205f806daf903c6075))
- **shared:** Add text wrap/autofit, image adjustments, and table inspector helpers (by @ChristopherVR) ([54b2eda](https://github.com/ChristopherVR/pptx-viewer/commit/54b2eda35254bc75257932568442396a5f343708))
- **svelte:** Add fill/stroke opacity and gradient to the inspector (by @ChristopherVR) ([34cb1ab](https://github.com/ChristopherVR/pptx-viewer/commit/34cb1ab62c4cef0739a1da9fc5e156b64f0b288b))
- **svelte:** Add text properties to the inspector panel (by @ChristopherVR) ([7d8819b](https://github.com/ChristopherVR/pptx-viewer/commit/7d8819b57b9adadf094c4225f71551c0a05e975e))
- **svelte:** Add image adjustment and crop controls to the inspector (by @ChristopherVR) ([fbe0f85](https://github.com/ChristopherVR/pptx-viewer/commit/fbe0f8531b8701592f6d9083c3e4cb2efbecb5f2))
- **svelte:** Add table properties to the inspector panel (by @ChristopherVR) ([d87360f](https://github.com/ChristopherVR/pptx-viewer/commit/d87360f15a58561e180a24a99c509078a76d2abf))

### Documentation

- **shared:** Add i18n keys for the vanilla Design tab theme gallery (by @ChristopherVR) ([593ea23](https://github.com/ChristopherVR/pptx-viewer/commit/593ea230e61f606056ffc013e2fdb82bea70738b))

## [0.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.3.0) - 2026-07-11

### Features

- **svelte:** Add ribbon editor logic (clipboard, slides, arrange, text/paragraph, find-replace) (by @ChristopherVR) ([12d53da](https://github.com/ChristopherVR/pptx-viewer/commit/12d53da5984957d473c7ee47327b5957747c6c5d))
- **svelte:** Add tabbed ribbon shell with File/Home/Insert/View tabs (by @ChristopherVR) ([4f391ab](https://github.com/ChristopherVR/pptx-viewer/commit/4f391ab80092b5562d0bd584664bd3acca3ce1f9))

### Bug Fixes

- **shared,react,vue,angular:** Make the Aa Change Case dropdown actually rewrite text (by @ChristopherVR) ([d84fd78](https://github.com/ChristopherVR/pptx-viewer/commit/d84fd788097253cf8b9281eca35af35caad20dce))
- **svelte:** Prune the selection on undo/redo so ribbon buttons re-disable (by @ChristopherVR) ([7539b70](https://github.com/ChristopherVR/pptx-viewer/commit/7539b70ad5ac18be028bd1fa39c1438469038002))

### Refactor

- **shared:** Extract clipboard, shape-preset, and text-format catalogs from react (by @ChristopherVR) ([b9d7cc9](https://github.com/ChristopherVR/pptx-viewer/commit/b9d7cc9b061b8c9dcaad91038136349c9360080d))
- **svelte:** Multi-element selection state (by @ChristopherVR) ([a259d5d](https://github.com/ChristopherVR/pptx-viewer/commit/a259d5df7a37f90c3baf3952b280b48c3d739dae))
- **shared:** Dedupe change-case logic against text-case-transform (by @ChristopherVR) ([d007c07](https://github.com/ChristopherVR/pptx-viewer/commit/d007c070fb5bf8573bd8ac6dbeae160b46fc2dde))

## [0.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.2.0) - 2026-07-11

### Features

- **svelte:** Collaboration and autosave (by @ChristopherVR) ([240bc2c](https://github.com/ChristopherVR/pptx-viewer/commit/240bc2cb5f1547fcc3a25eeb71b8bf23a5eb73ec))

## [0.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.1.3) - 2026-07-11

### Documentation

- **svelte:** Restyle readme to match the established binding readmes (by @ChristopherVR) ([5328bc8](https://github.com/ChristopherVR/pptx-viewer/commit/5328bc808b20b782c8234b9c859d3932fb41cfe4))

## [0.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-svelte-viewer@0.1.2) - 2026-07-10

### Features

- **core:** Add signature-node module and shared signature utilities (by @ChristopherVR) ([e7cb263](https://github.com/ChristopherVR/pptx-viewer/commit/e7cb26335f15e633cfc37371f16a6ad210be5e11))
- **vue:** Add pptx-vue-viewer package + bundled pptx-viewer-shared (by @ChristopherVR) ([1b7a958](https://github.com/ChristopherVR/pptx-viewer/commit/1b7a958ce91792a6d174f174932800bc8ff40ef9))
- **shared:** Add Three.js SmartArt 3D model + scene runtime (by @ChristopherVR) ([f949213](https://github.com/ChristopherVR/pptx-viewer/commit/f949213b33ed0dca4c52d5d1ab414c3dba67efe7))
- **shared:** Add canonical i18n translation dictionary (by @ChristopherVR) ([429e386](https://github.com/ChristopherVR/pptx-viewer/commit/429e386c7245fc5cf526ac72481fd5ab23b3e09d))
- **core,cli:** Add react, angular, vue to npm keywords (by @ChristopherVR) ([528ec61](https://github.com/ChristopherVR/pptx-viewer/commit/528ec6182bb77c07444dd0e93560b65e604b9524))
- **svelte:** Add pptx-svelte-viewer Svelte 5 binding (viewer) (by @ChristopherVR) ([d5c9164](https://github.com/ChristopherVR/pptx-viewer/commit/d5c916428ffa4c469ec9c79150d60f7aa6c9f560))
- **svelte:** Render table, chart, smartArt, media, ink, and ole elements (by @ChristopherVR) ([5077d82](https://github.com/ChristopherVR/pptx-viewer/commit/5077d827002f8dbbfd92f66ecebb13cafcf86537))
- **vanilla,svelte:** Opt-in 3D SmartArt renderer (by @ChristopherVR) ([15337c9](https://github.com/ChristopherVR/pptx-viewer/commit/15337c9bc1a31ad614a4aca88be3e71ba848413f))
- **svelte:** PNG and PDF export (by @ChristopherVR) ([b1c273e](https://github.com/ChristopherVR/pptx-viewer/commit/b1c273e634904f66c91ec7c035c879423fd39372))

### Bug Fixes

- Enable vitest globals in all packages to fix expectTypeOf errors (by @ChristopherVR) ([6d90d72](https://github.com/ChristopherVR/pptx-viewer/commit/6d90d72ff0107ad0194f9c73ceeb3df244f4cfc6))
- **test:** Add i18n mocks to react tests and bump versions to 1.2.0 (by @ChristopherVR) ([2c1c962](https://github.com/ChristopherVR/pptx-viewer/commit/2c1c9628714b905b28592493abf02fb270107b65))
- **deps:** Pin @xmldom/xmldom to 0.8.x in core to fix build (by @ChristopherVR) ([2ed7b2e](https://github.com/ChristopherVR/pptx-viewer/commit/2ed7b2e777d4e740a3e4c9ca7e2b3d6fc2bbd21f))
- **core:** Declare jszip and fast-xml-parser as runtime dependencies (by @ChristopherVR) ([b6636be](https://github.com/ChristopherVR/pptx-viewer/commit/b6636be972206bb2c6acee0fed05c45b4759fbdc))
- **angular:** Bundle pptx-viewer-core and fix demo JIT + Vue demo alias (by @ChristopherVR) ([78838ec](https://github.com/ChristopherVR/pptx-viewer/commit/78838ec900fe2d8c90bc39333636d788c52c3161))
- Missing document links (by @ChristopherVR) ([f52bd6f](https://github.com/ChristopherVR/pptx-viewer/commit/f52bd6fd2fc4f564f018ecf5e84e64d24c8fd240))
- **core:** Correct install docs and drop the retired @christophervr/pptx-viewer alias (by @ChristopherVR) ([6544b4e](https://github.com/ChristopherVR/pptx-viewer/commit/6544b4eaf086945ecd8a18b877de5a483032aa14))
- **core,angular:** Revert xmldom to 0.8.x and fix shared import specifiers (by @ChristopherVR) ([29eda31](https://github.com/ChristopherVR/pptx-viewer/commit/29eda3119836559b63bc08733dd9dd6398a69c8d))

### Other

- **smartart:** Snapshot in-progress SmartArt session work (by @ChristopherVR) ([0cac22f](https://github.com/ChristopherVR/pptx-viewer/commit/0cac22f5b1a0ecc33960f4712ff2ef691beb3f65))
- Reconcile with origin/main before push (by @ChristopherVR) ([b8c46bc](https://github.com/ChristopherVR/pptx-viewer/commit/b8c46bc3622e301d3365f5c489144e5aa5401782))
- Reconcile with origin/main before push (by @ChristopherVR) ([10acef8](https://github.com/ChristopherVR/pptx-viewer/commit/10acef81a7f5d79e778e4e4464d956cc84682f7c))
- Reconcile with origin/main before push (by @ChristopherVR) ([0ecd3d9](https://github.com/ChristopherVR/pptx-viewer/commit/0ecd3d935f97c78e8b0a62bebc8bf610c42414ab))

### Refactor

- **react:** Consume theme + loader from pptx-viewer-shared (by @ChristopherVR) ([1b93d1f](https://github.com/ChristopherVR/pptx-viewer/commit/1b93d1fccff378b0ac402810a0cbddea46add29c))
- **core:** Consume emf-converter and mtx-decompressor from npm (by @ChristopherVR) ([2f6013d](https://github.com/ChristopherVR/pptx-viewer/commit/2f6013d5b8fab0aef5b32901841d94c0fa886f24))
- **shared:** Extract text-rendering pure logic (line-height, warp, effects) (by @ChristopherVR) ([11c8d22](https://github.com/ChristopherVR/pptx-viewer/commit/11c8d22e9910dda9c8dfa18e0f6d7683577c7b9f))

### Documentation

- Restructure root README, elevate limitations, fix outdated claims (by @ChristopherVR) ([86dcda9](https://github.com/ChristopherVR/pptx-viewer/commit/86dcda9b5e3129f2223341337055778db574e985))
- Rewrite limitations with technical explanations and remove inaccurate claims (by @ChristopherVR) ([ac4bc84](https://github.com/ChristopherVR/pptx-viewer/commit/ac4bc84ed9bd03f62e3ae29c35baf3f444a3c0bf))
- **readme:** Npm-friendly READMEs — hero image, capabilities & install first (by @ChristopherVR) ([c843d19](https://github.com/ChristopherVR/pptx-viewer/commit/c843d1934b846f901bba92e63d2b01f9479594d0))
- Streamline npm READMEs and add badges, screenshots, demo links (by @ChristopherVR) ([92e980d](https://github.com/ChristopherVR/pptx-viewer/commit/92e980d434900abd223c4d70c6cae19a623f9ca8))
- Sharpen npm descriptions and keywords for discoverability (by @ChristopherVR) ([8fea56d](https://github.com/ChristopherVR/pptx-viewer/commit/8fea56d7650f7dc2f3167dea97b94b612a03a4e7))
- **core:** Reword README in plain language (by @ChristopherVR) ([793c26e](https://github.com/ChristopherVR/pptx-viewer/commit/793c26ec7e2415c66f34c637cb541483bf395a11))
- Remove completed ROADMAP and PORTING trackers, scrub stale references (by @ChristopherVR) ([8a745a1](https://github.com/ChristopherVR/pptx-viewer/commit/8a745a1d2a1ee3932503d37dd022494ab9cfcc4b))
- **core:** Remove explicit jszip/fast-xml-parser mention from install section (by @ChristopherVR) ([6b72906](https://github.com/ChristopherVR/pptx-viewer/commit/6b72906c08447ba38a704ff4572c89d7cad7e60c))

### Build & CI

- Independent per-package versioning, tags, and changelogs (by @ChristopherVR) ([79595d9](https://github.com/ChristopherVR/pptx-viewer/commit/79595d972d7c4102e8b1e1e3926f439486f76ba1))

### Dependencies

- **deps:** Update all dependencies to latest (by @ChristopherVR) ([e3287c0](https://github.com/ChristopherVR/pptx-viewer/commit/e3287c03ff58b1a1ae103ed32a513468a454a084))
- **deps:** Bump all workspace manifest floors to latest (by @ChristopherVR) ([890c33d](https://github.com/ChristopherVR/pptx-viewer/commit/890c33d667a39480a69e6a3da893964382993b29))
- **deps:** Update dependencies within semver ranges (by @ChristopherVR) ([d472b58](https://github.com/ChristopherVR/pptx-viewer/commit/d472b58dfd47628b5c682bd5f4dc2014ec29b421))
- **deps:** Declare yjs, y-websocket, and y-webrtc across bindings (by @ChristopherVR) ([27a2849](https://github.com/ChristopherVR/pptx-viewer/commit/27a2849da755a0902296dcd59557c1329a1cbadf))

### Chores

- Add license files, NOTICE, and package metadata for npm publishing (by @ChristopherVR) ([9464bb8](https://github.com/ChristopherVR/pptx-viewer/commit/9464bb8b91734daf35131d3c7e52e60895fe0a1c))
- Bump all packages to v1.1.0 and remove remaining MyClawAssist refs (by @ChristopherVR) ([c386511](https://github.com/ChristopherVR/pptx-viewer/commit/c38651150c08011cee5e17e15f7ee8adc0014b80))
- Bump all packages to 1.x.1 patch versions (by @ChristopherVR) ([c75205a](https://github.com/ChristopherVR/pptx-viewer/commit/c75205a96cc7797d1647ac4705395b7707ac8910))
- Bump all packages to minor versions for SDK table support (by @ChristopherVR) ([2d4b635](https://github.com/ChristopherVR/pptx-viewer/commit/2d4b6351b0bf328f8a556cf593733fd8ad36c7b5))
- Bump dependencies to latest and minor-bump packages for parity work (by @ChristopherVR) ([da19fdf](https://github.com/ChristopherVR/pptx-viewer/commit/da19fdf9a4670d274d9973b67aa22d34217b8555))
- Roll TypeScript back to 5.9.x; quiet new oxlint vitest rules (by @ChristopherVR) ([713c020](https://github.com/ChristopherVR/pptx-viewer/commit/713c020ac2428db0fb1eb6cb30e56b2cff19a80f))
- Relicense from MIT to Apache-2.0 (by @ChristopherVR) ([e12f926](https://github.com/ChristopherVR/pptx-viewer/commit/e12f9266f02bebbfc218986b617c418fee43a56b))
- Bump vanilla + svelte to 0.1.1; clarify view-only in READMEs (by @ChristopherVR) ([0bc44ab](https://github.com/ChristopherVR/pptx-viewer/commit/0bc44ab3b083c7d8aeed51197584f8eee04fc9ee))

# Changelog

All notable changes to `pptx-svelte-viewer` are documented in this file.
