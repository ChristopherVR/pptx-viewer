# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.
A release listed with no entries carried no Conventional Commit in this package's
scope: scripts/release-plan.mjs re-releases a package whenever any of its files
change, not only on conventional ones.

## [2.1.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.1.4) - 2026-08-29

### Bug Fixes

- **animation:** Preserve authored PowerPoint playback and rendering ([#185](https://github.com/ChristopherVR/pptx-viewer/issues/185)) (by @primerch) ([628be23](https://github.com/ChristopherVR/pptx-viewer/commit/628be23999fb116d11cde2a5f62aac941416a1f5))

## [2.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.1.3) - 2026-08-29

### Bug Fixes

- **react:** Smooth collaboration cursors and remove webrtc join delay (by @ChristopherVR) ([332c547](https://github.com/ChristopherVR/pptx-viewer/commit/332c54713cbf82a5669f0d7825d58346e2ad8e45))
- **svelte:** Shrink mobile bottom bar and rebuild the hamburger menu (by @ChristopherVR) ([c8f394d](https://github.com/ChristopherVR/pptx-viewer/commit/c8f394d6b9ceedd8a250f9cd36392a66d0c57276))
- **ui:** Stop resize/rotate handles rendering behind their own element (by @ChristopherVR) ([1eefded](https://github.com/ChristopherVR/pptx-viewer/commit/1eefded8efb893f9eb9ee19c4f85c64fde94f86b))
- **ui:** Stop ribbon Insert/Animation/View tab content stretching and clipping (by @ChristopherVR) ([9487346](https://github.com/ChristopherVR/pptx-viewer/commit/9487346f32b7ec51a2180305643d960e1e7b65cb))
- **print:** Stop print opening a blank tab and doing nothing (by @ChristopherVR) ([6616f81](https://github.com/ChristopherVR/pptx-viewer/commit/6616f81003354b57b3b56e7de957d4044616b811))

## [2.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.1.2) - 2026-08-28

### Bug Fixes

- **vanilla:** Center the title-bar search box instead of absolute-positioning it (by @ChristopherVR) ([ae0816d](https://github.com/ChristopherVR/pptx-viewer/commit/ae0816dfd656320488a68bdf227bf90d7a50c6b0))
- **ui:** Stop ribbon action buttons from stretching to fill the row height (by @ChristopherVR) ([d53ce5b](https://github.com/ChristopherVR/pptx-viewer/commit/d53ce5b4b00e5cfaab70d8a230f37d3f0c241a96))
- **core:** Reindex chart data-point overrides after removing a category (by @ChristopherVR) ([7bd64f8](https://github.com/ChristopherVR/pptx-viewer/commit/7bd64f821d66d1bc7b3f91f46a3e262eda1072ee))
- **shared:** Repair print, drop Package for Sharing, wire Options behavior (by @ChristopherVR) ([bcc2ac7](https://github.com/ChristopherVR/pptx-viewer/commit/bcc2ac7420b50f69d7217f3b9915f0b3e0698640))
- **vanilla:** Repair print, drop Package for Sharing, wire Options behavior (by @ChristopherVR) ([00b0697](https://github.com/ChristopherVR/pptx-viewer/commit/00b0697c2def0ba01fabada2e388cc0bdc361268))
- **vanilla:** Remove an em-dash from the Protected View banner text (by @ChristopherVR) ([ba2dc03](https://github.com/ChristopherVR/pptx-viewer/commit/ba2dc0381f857093cebf79e411d91aebf673f8aa))

### Security

- **shared:** Drop duplicate Protected View banner strings (by @ChristopherVR) ([1c35863](https://github.com/ChristopherVR/pptx-viewer/commit/1c358639246cc7fe058e2afe6f95cf52893dfff7))

## [2.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.1.1) - 2026-08-28

### Bug Fixes

- **charts:** Offer 3-D chart types in the type-change dropdown (by @ChristopherVR) ([4e960f7](https://github.com/ChristopherVR/pptx-viewer/commit/4e960f7d25fa53149de667171f4e0fe4a168499c))
- **charts:** Stop 3-D charts from flashing their 2D rendering (by @ChristopherVR) ([18802e0](https://github.com/ChristopherVR/pptx-viewer/commit/18802e041d7293f99b10b860ba793c79eed82b67))

## [2.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.1.0) - 2026-08-28

### Features

- **core:** Decrypt RC4-encrypted legacy .ppt files (by @ChristopherVR) ([b95adc7](https://github.com/ChristopherVR/pptx-viewer/commit/b95adc74f036eefd4d44af441fa600512ff44282))
- **ole:** Make embedded OLE objects' Object Name editable (by @ChristopherVR) ([e06b32c](https://github.com/ChristopherVR/pptx-viewer/commit/e06b32c1b4e9375c37916097b494ab05bf4b7850))
- **shared:** Add Pareto as an insertable chart type (by @ChristopherVR) ([8fea110](https://github.com/ChristopherVR/pptx-viewer/commit/8fea110ef6aa4036fee97f232f4f7d8ecd5f7b94))
- **core:** Support writing ECMA-376 Standard scheme encryption (by @ChristopherVR) ([210d2a2](https://github.com/ChristopherVR/pptx-viewer/commit/210d2a22603467092f667f031bc7881f7e7833bf))
- **shared:** Apply the shadeToTitle background gradient effect (by @ChristopherVR) ([f287389](https://github.com/ChristopherVR/pptx-viewer/commit/f2873891828125b315f2cae2155824c84609626f))
- **core:** Allow animation drag-to-reorder across deck-native effects (by @ChristopherVR) ([6f48a34](https://github.com/ChristopherVR/pptx-viewer/commit/6f48a3455338c78f34c4d0978bcc4cf0be075db2))
- Author animation effect sound and after-animation controls (by @ChristopherVR) ([78daeb4](https://github.com/ChristopherVR/pptx-viewer/commit/78daeb4276733fe5ed048872d262a8cf080bfc3b))
- **shared:** Honour p:seq @concurrent/@nextAc/@prevAc and p:cTn @restart (by @ChristopherVR) ([3e3427d](https://github.com/ChristopherVR/pptx-viewer/commit/3e3427d9d747ae97485a5186b59e3d5aa80c1579))
- **shared:** Honour animRot/animScale absolute values, tavLst, txEl ranges, p:excl and bldLvl in playback (by @ChristopherVR) ([f71396b](https://github.com/ChristopherVR/pptx-viewer/commit/f71396bbc1309909aa3eecfd4855268f4e6fbfac))
- **shared:** Resolve 9 more SMIL animEffect filter families to real reveals (by @ChristopherVR) ([e47aa40](https://github.com/ChristopherVR/pptx-viewer/commit/e47aa409b5bcd10c24eadad3fb9aa8ab8f055fbd))
- Author and embed transition sounds from the ribbon Sound picker (by @ChristopherVR) ([ada8cdb](https://github.com/ChristopherVR/pptx-viewer/commit/ada8cdb65a0689660b9afc852d0a85e2a1b04534))
- Expose transition speed and morph-option controls in all five bindings (by @ChristopherVR) ([122894d](https://github.com/ChristopherVR/pptx-viewer/commit/122894db9366c91a87371311bf4f69ccbf53ffb4))
- **ink:** Retain pen-tilt InkML channels and render a calligraphic nib (by @ChristopherVR) ([6adab79](https://github.com/ChristopherVR/pptx-viewer/commit/6adab79f7cf8ae19346c3e74d34413cccd2eb08f))
- **shared:** Raycast hover tooltip for surface chart marks (by @ChristopherVR) ([c943646](https://github.com/ChristopherVR/pptx-viewer/commit/c9436468d2a1997168f12d079e0da758ab488758))
- **shared:** Resolve stretch, newsflash and random animEffect filters (by @ChristopherVR) ([58c898e](https://github.com/ChristopherVR/pptx-viewer/commit/58c898e55c2fb520cde7845baf8ae4b2e7a1c224))
- **core,shared:** Surface p:tavLst attrName, honour colour ramps (by @ChristopherVR) ([2ccf45f](https://github.com/ChristopherVR/pptx-viewer/commit/2ccf45fbcb23da9e0084769c0895b35cfc027326))
- **shared:** Widen native-animation preset playback coverage to 54/200 (by @ChristopherVR) ([41e2b52](https://github.com/ChristopherVR/pptx-viewer/commit/41e2b526dc654e4f7c24f3dd9026eb3124c47dd5))
- **shared:** True 3D bar3D chart scene via three.js, opt-in all bindings (by @ChristopherVR) ([ac920da](https://github.com/ChristopherVR/pptx-viewer/commit/ac920da1d2cc302f36ba7b2b19dc4011ac5aae07))
- **shared:** True 3D line3D/area3D chart scenes via three.js, opt-in all bindings (by @ChristopherVR) ([1447517](https://github.com/ChristopherVR/pptx-viewer/commit/1447517ee8c95ca958146f668a5cd0f64616b473))
- **charts:** Give pie3D charts true 3D rendering across all bindings (by @ChristopherVR) ([a1b32e7](https://github.com/ChristopherVR/pptx-viewer/commit/a1b32e7b9c44230f35d9c73cf786f8594b4b4157))

### Bug Fixes

- Author Draw-tab ink as a PowerPoint-compatible content part (by @ChristopherVR) ([d91ce08](https://github.com/ChristopherVR/pptx-viewer/commit/d91ce08757c3697eab6891808e527c5e1eaea555))
- **animation:** Correct swapped exit/emphasis presets, cover 4 more IDs (by @ChristopherVR) ([11c2d2e](https://github.com/ChristopherVR/pptx-viewer/commit/11c2d2e8e68b0539c9920d8c6de4de93ca2cc5e1))
- **shared:** Capture Draw tool pressure in all five bindings (by @ChristopherVR) ([b8a124a](https://github.com/ChristopherVR/pptx-viewer/commit/b8a124ae7cd48733b00baac11dda325eeefeea43))
- **shared:** Sample ink pressure curves along the actual Bezier path (by @ChristopherVR) ([629ab5d](https://github.com/ChristopherVR/pptx-viewer/commit/629ab5dc8af3fee409376176a2b92e0e0ed26c12))
- **core:** Honour text-run reflection scale/skew/rotation/fade/anchor (by @ChristopherVR) ([41dfa76](https://github.com/ChristopherVR/pptx-viewer/commit/41dfa76c9540136b5c09fee52e21d8d0bc3e079c))
- **shared:** Render rect path gradients as nested rectangles, not an ellipse (by @ChristopherVR) ([f6f479e](https://github.com/ChristopherVR/pptx-viewer/commit/f6f479ece08a4c632db8bb4840377641079dcf3b))
- **shared:** Add elliptical tilt foreshortening to pie3D charts (by @ChristopherVR) ([63f57ba](https://github.com/ChristopherVR/pptx-viewer/commit/63f57ba146b6918e068ace19449ce3964140968a))
- **shared:** Claim morph proximity pairs closest-first, not by document order (by @ChristopherVR) ([b68a04d](https://github.com/ChristopherVR/pptx-viewer/commit/b68a04d120f15db4d2fd4c2f2c33ac31761f208b))
- **deps:** Converge ai-sdk adapters on a single ai package version, fix two flaky tests (by @ChristopherVR) ([4365a02](https://github.com/ChristopherVR/pptx-viewer/commit/4365a0222d80abc4ba2d651a464dfb353f882656))
- **core:** Author Draw-tab ink InkML that real PowerPoint actually opens (by @ChristopherVR) ([38633c7](https://github.com/ChristopherVR/pptx-viewer/commit/38633c7f25af358c24ea91c42019ad76b786ca54))
- **animation:** Correct tests left stale by combining independent preset fix waves (by @ChristopherVR) ([02371bb](https://github.com/ChristopherVR/pptx-viewer/commit/02371bbdb1b6124b47be1932a7af80c5ddfbee20))
- **charts:** Repair merge conflicts left broken by a diff3 edge case, wire remaining demos (by @ChristopherVR) ([42d550d](https://github.com/ChristopherVR/pptx-viewer/commit/42d550d6016ab0fc8ae2b5c643958cdf43f1020b))

### Testing

- **core:** Cover lte/equ ops and multi-hop bounds for SmartArt constraints (by @ChristopherVR) ([3d8c5a0](https://github.com/ChristopherVR/pptx-viewer/commit/3d8c5a08c85f7652dd2ba08cf9e345f98a767f8c))

### Chores

- Reformat limitations.md table and a core test after merge (by @ChristopherVR) ([d9db1f7](https://github.com/ChristopherVR/pptx-viewer/commit/d9db1f7c32e0ee7383837ac6db668e10a6060752))
- Fix oxfmt comment placement in ppt-import.test.ts (by @ChristopherVR) ([7cb2d3d](https://github.com/ChristopherVR/pptx-viewer/commit/7cb2d3dabe470f4a0ad2a2023d90a1f9642d2c28))

## [2.0.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.0.3) - 2026-08-26

### Bug Fixes

- Stop duplicate inline-edit text render and fix ribbon popup clipping (by @ChristopherVR) ([f084c64](https://github.com/ChristopherVR/pptx-viewer/commit/f084c64c6bb69135b60f083200180933a7f770f7))
- Derive mobile chrome from the browser viewport, not the container (by @ChristopherVR) ([29e5ea1](https://github.com/ChristopherVR/pptx-viewer/commit/29e5ea17b87411fa2058e2d0a25a2323ce6a1133))

### Dependencies

- **deps:** Update fast-xml-parser requirement from ^5.10.1 to ^5.11.0 ([#177](https://github.com/ChristopherVR/pptx-viewer/issues/177)) (by @dependabot[bot]) ([a876e0f](https://github.com/ChristopherVR/pptx-viewer/commit/a876e0f5fd07fd2e7063619882313cc23c4a0162))
- **deps:** Update dompurify requirement from ^3.4.13 to ^3.4.14 ([#173](https://github.com/ChristopherVR/pptx-viewer/issues/173)) (by @dependabot[bot]) ([19afbe1](https://github.com/ChristopherVR/pptx-viewer/commit/19afbe117520bbdeb2c8e930332ae5133df21c30))

## [2.0.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.0.2) - 2026-08-22

### Bug Fixes

- **shared,angular:** Stop the stroke overlay inventing outlines, and finish the Angular whitespace fix (by @ChristopherVR) ([20d4d17](https://github.com/ChristopherVR/pptx-viewer/commit/20d4d177fee97b5f4452a0da739fd51ebaa9e183))

## [2.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.0.1) - 2026-08-22

### Bug Fixes

- **core:** Spell the SmartArt role sentinel as a unicode escape (by @ChristopherVR) ([a2d4993](https://github.com/ChristopherVR/pptx-viewer/commit/a2d4993390bcdc28a3b24c1bf501c64f638f68d9))

## [2.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@2.0.0) - 2026-08-22

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
- **vanilla:** Consume the shared render decisions and fix two gesture bugs (by @ChristopherVR) ([d818d8b](https://github.com/ChristopherVR/pptx-viewer/commit/d818d8b060b9165eef6817db9c7bafa42300320f))
- **core,shared:** Honour cTn timing attributes, after-animation and effect sound (by @ChristopherVR) ([07ee51f](https://github.com/ChristopherVR/pptx-viewer/commit/07ee51f8b11431153e9ce2553c4c11a51e15316e))
- **core:** Close slide-structure, notes-style and DrawingML parse gaps (by @ChristopherVR) ([ee1dbcd](https://github.com/ChristopherVR/pptx-viewer/commit/ee1dbcd3278e2bde7b066c4085a82f56cc818f6a))
- **shared:** Render data tables, legend entries, image overlays and 3D text (by @ChristopherVR) ([ecec502](https://github.com/ChristopherVR/pptx-viewer/commit/ecec502e205f06c1bb7dec042f7693ac4fd8a74e))
- **vanilla:** Consume the shared decisions for the second parity wave (by @ChristopherVR) ([a52a09a](https://github.com/ChristopherVR/pptx-viewer/commit/a52a09a7d96670e934b14fa324a33015d9a105c0))

### Refactor

- **shared:** Split oversized text modules and add the circle-in keyframe (by @ChristopherVR) ([1c0797f](https://github.com/ChristopherVR/pptx-viewer/commit/1c0797f7d5468dca16f6cb53c1ad413db4fc29e0))

### Documentation

- **core:** Record audited OpenXML construct coverage in the manifest (by @ChristopherVR) ([812fe61](https://github.com/ChristopherVR/pptx-viewer/commit/812fe61e66687a48c2cd19eeb0c502767c25e3c1))

### Testing

- **core:** Evidence previously unverified OpenXML constructs, and record what is not implemented (by @ChristopherVR) ([4dc6028](https://github.com/ChristopherVR/pptx-viewer/commit/4dc602876bd49cdb03b084f9f4fa2268aa01f22f))

### Chores

- **core:** Complete barrel and runtime wiring for the preceding two changes (by @ChristopherVR) ([115379e](https://github.com/ChristopherVR/pptx-viewer/commit/115379e9a757b029fbc0cbb74ae51628f7fb3e27))

## [1.24.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.24.0) - 2026-08-21

### Features

- **shared,react:** Wire interactive 3D surface chart scene (opt-in) (by @ChristopherVR) ([78587a4](https://github.com/ChristopherVR/pptx-viewer/commit/78587a4b2b34f745bd71a29d8952621eec31d3b9))
- **vanilla:** Wire interactive 3D surface chart scene (opt-in) (by @ChristopherVR) ([6975a8d](https://github.com/ChristopherVR/pptx-viewer/commit/6975a8ddd80d063fe685d564d518fe1fe6e55c7f))

### Bug Fixes

- **shared:** Compute elbow/curved connector routing from actual shape geometry (by @ChristopherVR) ([eecc519](https://github.com/ChristopherVR/pptx-viewer/commit/eecc519961d0a825f550c5d1b6c41f55b1d101ae))
- **core,vue:** Compute elbow/curved connector routing from actual shape geometry (by @ChristopherVR) ([f2882a1](https://github.com/ChristopherVR/pptx-viewer/commit/f2882a11d16253683c82b04463442f6e80b7d507))

### Documentation

- **core:** Correct stale OLE and SmartArt capability text (by @ChristopherVR) ([0c7e68d](https://github.com/ChristopherVR/pptx-viewer/commit/0c7e68d66cf27fdc35f31d9fa06faab0d287a16c))
- **core:** Certify DrawingML line/stroke properties in the OpenXML coverage manifest (by @ChristopherVR) ([caa2570](https://github.com/ChristopherVR/pptx-viewer/commit/caa2570d508b4904d8f541a392933da7be50dc32))

## [1.23.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.23.1) - 2026-08-21

### Bug Fixes

- **core:** Restore mc:AlternateContent envelope on passthrough template save (by @ChristopherVR) ([1659244](https://github.com/ChristopherVR/pptx-viewer/commit/165924427f0a2e1f834e1b24d7237a1c0125d8f6))
- **core:** Stop baking theme effectRef into a literal effectLst on save (by @ChristopherVR) ([59a5566](https://github.com/ChristopherVR/pptx-viewer/commit/59a5566aef9304d4f2a31c6b4e2f95f86841dd8f))
- **core:** Read line-family chart series colors on any chart, not just combo (by @ChristopherVR) ([e62dfcf](https://github.com/ChristopherVR/pptx-viewer/commit/e62dfcf2a6850a86944730f752b321c08b44e477))
- **core:** Write line-family chart series colors into a:ln, not a corrupting spPr (by @ChristopherVR) ([5b54357](https://github.com/ChristopherVR/pptx-viewer/commit/5b54357646ca63723944bbf44f8ac7c23912e035))

## [1.23.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.23.0) - 2026-08-21

### Features

- **shared:** Add header-footer dialog draft helpers (by @ChristopherVR) ([0f640c8](https://github.com/ChristopherVR/pptx-viewer/commit/0f640c887c4d6447d2a6cbba2754049cec69e121))
- **shared:** Add classifyMediaType, the audio/video MIME classifier (by @ChristopherVR) ([56520a1](https://github.com/ChristopherVR/pptx-viewer/commit/56520a1138f342b2e4e33ff5bbedb64f5a8ca9e4))
- **shared:** Add resolveTemplateBackgroundRows for the template background card (by @ChristopherVR) ([67d327d](https://github.com/ChristopherVR/pptx-viewer/commit/67d327d737a06b7ca737feffb01d9afe637c108f))
- **shared:** Add patchChartData, the type-aware chart data patcher (by @ChristopherVR) ([5309296](https://github.com/ChristopherVR/pptx-viewer/commit/5309296df312affd6c9f9994cc7e4612310d8119))
- **vanilla:** Add the missing element lock/unlock toggle (by @ChristopherVR) ([d56042b](https://github.com/ChristopherVR/pptx-viewer/commit/d56042be0301a6b31894b2c934a8114540396cf7))
- **shared:** Add pptx.group.childCount/groupedElement i18n keys (by @ChristopherVR) ([f5557e1](https://github.com/ChristopherVR/pptx-viewer/commit/f5557e1ac1ef74af4306cf81cd2c08c8b61dd960))
- **vanilla:** Add the missing group/OLE element info cards (by @ChristopherVR) ([1d027bd](https://github.com/ChristopherVR/pptx-viewer/commit/1d027bdc240c90e00dec510fc45bd45181b8ea56))
- **vanilla:** Add the table quick-style preset swatch gallery (by @ChristopherVR) ([db93b06](https://github.com/ChristopherVR/pptx-viewer/commit/db93b06c9fe83930ef01284f9c3fa5946707e9d6))
- **vanilla:** Add the missing transition click-to-play preview thumbnail (by @ChristopherVR) ([b95178b](https://github.com/ChristopherVR/pptx-viewer/commit/b95178b0c04e7eb98da0de25232c3cec807974cf))
- **vanilla:** Live-render SmartArt gallery previews, not a static icon (by @ChristopherVR) ([15117e4](https://github.com/ChristopherVR/pptx-viewer/commit/15117e4b5a5398da9248c83b4e1ce8d829997dd4))
- **vanilla:** Add SmartArt text-pane keyboard editing (Tab/Enter/Backspace) (by @ChristopherVR) ([6a32895](https://github.com/ChristopherVR/pptx-viewer/commit/6a3289532f4a12c72e0765f295cea75fe77c6fec))
- **vanilla:** Add table column/row drag-resize handles (by @ChristopherVR) ([4d1f969](https://github.com/ChristopherVR/pptx-viewer/commit/4d1f969b47cb387362a9a86ea21540b2493f2927))
- **vanilla:** Edit layout/master background from the slide inspector (by @ChristopherVR) ([054def4](https://github.com/ChristopherVR/pptx-viewer/commit/054def401963925b6376f943753e8d4f355cfbf4))

### Bug Fixes

- **shared:** Sanitize every download filename, not just callers that remember to (by @ChristopherVR) ([7bdf73b](https://github.com/ChristopherVR/pptx-viewer/commit/7bdf73be98ae30b4664067a52b1611878d7d97b3))
- **shared:** Floor animation timeline bar width to a visible minimum (by @ChristopherVR) ([918ac2f](https://github.com/ChristopherVR/pptx-viewer/commit/918ac2f5a50d11fb1ad7e015956794f9cd44dfee))
- **svelte,vanilla:** Commit in-progress SmartArt node text before Tab/Enter (by @ChristopherVR) ([2c79a1f](https://github.com/ChristopherVR/pptx-viewer/commit/2c79a1fa5276ecbde39c27b8fb71b2723781c336))

### Refactor

- **vanilla:** Repoint header-footer draft clone onto shared (by @ChristopherVR) ([c947ce2](https://github.com/ChristopherVR/pptx-viewer/commit/c947ce22d2c8a321bab10f4a07d3c8ba47955c5e))
- **react,vue,svelte,vanilla:** Repoint media-type check onto shared (by @ChristopherVR) ([bb8e95c](https://github.com/ChristopherVR/pptx-viewer/commit/bb8e95c810e2fd709e12f21d5b073b179e1dbf52))
- **vanilla:** Repoint animation timeline bar layout onto shared (by @ChristopherVR) ([c9ad169](https://github.com/ChristopherVR/pptx-viewer/commit/c9ad1697e68c54cda4e1f6597cb243a7933804ee))

## [1.22.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.22.4) - 2026-08-21

### Bug Fixes

- **core:** Parse full custom geometry on pictures, not just path data (by @ChristopherVR) ([b6cbef6](https://github.com/ChristopherVR/pptx-viewer/commit/b6cbef64296fade4b1a0c77c32847e68ea0a18c5))

## [1.22.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.22.3) - 2026-08-20

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

## [1.22.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.22.2) - 2026-08-20

### Bug Fixes

- **svelte,vanilla:** Fix the obfuscation key order in the embedded-font test fixture (by @ChristopherVR) ([20320c2](https://github.com/ChristopherVR/pptx-viewer/commit/20320c255c992a43c4b2b8a5117b18573be33374))
- **shared:** Describe stripped invisible characters by code point, not literally (by @ChristopherVR) ([9ddca51](https://github.com/ChristopherVR/pptx-viewer/commit/9ddca51028e7bba92a9433513dea0c5320415bdb))

## [1.22.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.22.1) - 2026-08-20

### Bug Fixes

- **shared:** Repoint options numeric-control clamp onto shared helper (by @ChristopherVR) ([138dfe5](https://github.com/ChristopherVR/pptx-viewer/commit/138dfe5d6cc780915ab8d9ca591f75c698b35f22))

### Refactor

- **shared,react,vue,vanilla:** Repoint comment mutations onto shared comments-list (by @ChristopherVR) ([0eb28dc](https://github.com/ChristopherVR/pptx-viewer/commit/0eb28dc5d714ebe695c8b23c6b09aefc6b99ac0d))

## [1.22.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.22.0) - 2026-08-20

### Features

- **shared:** Add hover tooltips to every chart mark, not just the region map (by @ChristopherVR) ([4ca29f5](https://github.com/ChristopherVR/pptx-viewer/commit/4ca29f590b1d1154b1034b7c5aeaa469610353d5))

### Bug Fixes

- **angular:** Wire Home ribbon Reset/Fill/Outline through shared commands (by @ChristopherVR) ([c06b894](https://github.com/ChristopherVR/pptx-viewer/commit/c06b8947fae4888b0db69f37c043bfe9e83dd66d))
- **vanilla:** Expand cell-merge rect over existing merges before validating (by @ChristopherVR) ([49d9ce7](https://github.com/ChristopherVR/pptx-viewer/commit/49d9ce7e8c6a2eb3ed4e58d4bef4d2679430b43d))
- **svelte,vanilla:** Wire double-click chart title rename (by @ChristopherVR) ([48b997c](https://github.com/ChristopherVR/pptx-viewer/commit/48b997ca7b24a3340100cf6f52b7251e5ca39e6e))
- **shared:** Stack line/area charts and lock their drag geometry (by @ChristopherVR) ([0da8ba5](https://github.com/ChristopherVR/pptx-viewer/commit/0da8ba55a5793d94af7822fcc7de63aa1d0243bb))
- **vanilla:** Surface on-canvas chart part selection to the inspector (by @ChristopherVR) ([e71646f](https://github.com/ChristopherVR/pptx-viewer/commit/e71646f30c8fe80db557c50fb5437f2238672b1d))
- **shared:** Extract table column-width redistribution to shared (by @ChristopherVR) ([cbd9fc7](https://github.com/ChristopherVR/pptx-viewer/commit/cbd9fc78dde57a72de3049a2ea01e1676957b463))

### Refactor

- **shared:** Extract SmartArt node-count bounds table (by @ChristopherVR) ([10cd945](https://github.com/ChristopherVR/pptx-viewer/commit/10cd945140ea3757086f0c4b1c6ea71adbb4d825))
- **shared:** Extract animation drag-to-reorder into shared (by @ChristopherVR) ([b136d02](https://github.com/ChristopherVR/pptx-viewer/commit/b136d023174959e9c51b3667e8ab78a8a983cb9f))
- **shared:** Extract SmartArt text-pane handlers to shared (by @ChristopherVR) ([911693c](https://github.com/ChristopherVR/pptx-viewer/commit/911693c9c02b63ee284890653b4dc977e35af170))
- **shared:** Extract chart legend layout to shared (by @ChristopherVR) ([acec62b](https://github.com/ChristopherVR/pptx-viewer/commit/acec62b1be7203e90206a0852e6544b73bb52266))
- **shared:** Extract animation timeline-bar layout math to shared (by @ChristopherVR) ([1a9f66d](https://github.com/ChristopherVR/pptx-viewer/commit/1a9f66d7629e18174997fdf9135edb7a70d8660e))
- **shared:** Extract table quick-style preset application (by @ChristopherVR) ([aa52c10](https://github.com/ChristopherVR/pptx-viewer/commit/aa52c106a158b2c2361b05e05968d9daadda2e52))
- **shared:** Extract export base-filename derivation to shared (by @ChristopherVR) ([58091bc](https://github.com/ChristopherVR/pptx-viewer/commit/58091bc18e766b3c870fe4af9f8c11bd0384899c))

## [1.21.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.7) - 2026-08-19

### Bug Fixes

- **core:** Correct OOXML a:tint colour math (ECMA-376 20.1.2.3.32) (by @ChristopherVR) ([7cf29f3](https://github.com/ChristopherVR/pptx-viewer/commit/7cf29f321994b7e9df8fe11d821a2c2fe686e1cd))
- **shared:** Stretch uncropped pictures to fill their frame (by @ChristopherVR) ([ff2fee3](https://github.com/ChristopherVR/pptx-viewer/commit/ff2fee3b3bba88e9a4d50a0735e9558c65e8041e))
- **core:** Don't clone an arbitrary slide onto a new blank slide (by @ChristopherVR) ([1bd1bd6](https://github.com/ChristopherVR/pptx-viewer/commit/1bd1bd6be1aa657b89ef5782e5d3c466686102c4))
- **core:** Don't bind special placeholders to untyped ones by idx alone (by @ChristopherVR) ([d92eb11](https://github.com/ChristopherVR/pptx-viewer/commit/d92eb11095ee390a596126acc59c8dd9cc18f8a8))
- **core:** Resolve layout-switch geometry from the master when omitted (by @ChristopherVR) ([a09aa5a](https://github.com/ChristopherVR/pptx-viewer/commit/a09aa5a306e160954bbc09052444ad22ab4385a1))
- **core:** Reverse the GUID-derived XOR key for font de/obfuscation (by @ChristopherVR) ([7733edf](https://github.com/ChristopherVR/pptx-viewer/commit/7733edf62f9f9a307c470dd93cfba36c8dbb9339))
- **core:** Drop untouched placeholder prompts on repeated layout switch (by @ChristopherVR) ([8842223](https://github.com/ChristopherVR/pptx-viewer/commit/884222317ad7da002e28e6272257bb4563b89fb2))
- **security:** Resolve code-scanning ReDoS and comment-sanitization alerts (by @ChristopherVR) ([e58e3f5](https://github.com/ChristopherVR/pptx-viewer/commit/e58e3f540e4e34c3617d32efdeea4ace6899e2bf))

## [1.21.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.6) - 2026-08-19

### Bug Fixes

- **shared:** Add collaboration-active-session connected-users view-model (by @ChristopherVR) ([7add165](https://github.com/ChristopherVR/pptx-viewer/commit/7add165d14ae855889bd9aedac13e859b86d2274))
- **vanilla:** Show connected users in the active Share dialog (by @ChristopherVR) ([8b73321](https://github.com/ChristopherVR/pptx-viewer/commit/8b7332123321040a3cd93f999f84c3d23ef5eec3))

## [1.21.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.5) - 2026-08-19

### Dependencies

- **deps:** Update y-websocket requirement from ^3.0.0 to ^3.1.0 ([#169](https://github.com/ChristopherVR/pptx-viewer/issues/169)) (by @dependabot[bot]) ([7e9c5a5](https://github.com/ChristopherVR/pptx-viewer/commit/7e9c5a51a7cb46df36223df4f91f192200562871))

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#162](https://github.com/ChristopherVR/pptx-viewer/issues/162)) (by @dependabot[bot]) ([2645f25](https://github.com/ChristopherVR/pptx-viewer/commit/2645f258a35282b61960c30649f216e583879f12))

## [1.21.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.4) - 2026-08-14

### Bug Fixes

- **vanilla:** Repair the properties panel, inline editor, mobile chrome and show performance (by @ChristopherVR) ([47265ef](https://github.com/ChristopherVR/pptx-viewer/commit/47265efba9459359695bdcd74038b8b6d0787d0f))

## [1.21.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.3) - 2026-08-14

### Bug Fixes

- **shared:** Run an in-place morph dissolve on the wrapper, not the element (by @ChristopherVR) ([d46d2ee](https://github.com/ChristopherVR/pptx-viewer/commit/d46d2eea5aeced925f1b51b4be2758f2b634ea3e))

## [1.21.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.2) - 2026-08-14

### Bug Fixes

- **shared:** Sum a morph cross-dissolve instead of stacking two fades (by @ChristopherVR) ([86a9e7a](https://github.com/ChristopherVR/pptx-viewer/commit/86a9e7a2ab851d7b0005ab2d1c2267f668b308a8))

### Testing

- Mask the fields that legitimately move, and size two waits for CI (by @ChristopherVR) ([68bae19](https://github.com/ChristopherVR/pptx-viewer/commit/68bae19fe8cb3e283e2c87a90d31946c48be5e3a))

## [1.21.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.1) - 2026-08-14

### Bug Fixes

- Repair five regressions this review introduced (by @ChristopherVR) ([952063b](https://github.com/ChristopherVR/pptx-viewer/commit/952063b7c1a198aed9acc0696b2b326deba35e95))

## [1.21.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.21.0) - 2026-08-13

### Features

- **shared:** Take the last six chart kinds and the autosave policy (by @ChristopherVR) ([efe8438](https://github.com/ChristopherVR/pptx-viewer/commit/efe84381688dfb5f2a44a2990e76aa09b65e5fba))

### Bug Fixes

- **core:** Repair the XML plumbing four separate defects were hiding behind (by @ChristopherVR) ([8beb664](https://github.com/ChristopherVR/pptx-viewer/commit/8beb66410975d492118120515bbae6cd070ef792))
- **bindings:** Stop read-only surfaces clobbering live state (by @ChristopherVR) ([e820984](https://github.com/ChristopherVR/pptx-viewer/commit/e8209842fad62819df1530944124f0bfc33e32ec))

## [1.20.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.20.0) - 2026-08-13

### Bug Fixes

- **core:** Stop save rewriting what the author never wrote (by @ChristopherVR) ([6fb2767](https://github.com/ChristopherVR/pptx-viewer/commit/6fb2767583de0e82747c3700e3311869dd693a1d))

## [1.19.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.19.0) - 2026-08-13

### Features

- **shared:** Own the decisions the bindings were each making themselves (by @ChristopherVR) ([5421272](https://github.com/ChristopherVR/pptx-viewer/commit/5421272a531536ab3b494e5df91068c98326e6ed))
- **shared:** Model hyperlinks and equations, and own the group rules (by @ChristopherVR) ([a6bf4c1](https://github.com/ChristopherVR/pptx-viewer/commit/a6bf4c15ab3b49a44a2d24e2122ddbe3cdd3b8ed))

### Bug Fixes

- **core:** Repair save-pipeline corruption found by the OpenXML parity audit (by @ChristopherVR) ([554006e](https://github.com/ChristopherVR/pptx-viewer/commit/554006e004b6212f5561eb19954bbcff17bbdf7f))
- **vanilla:** Wire the save path, canvas gestures and image controls (by @ChristopherVR) ([2fde373](https://github.com/ChristopherVR/pptx-viewer/commit/2fde37322b34753c096d623b9ac8c029a7562a67))
- **core:** Close the round-trip defects the corpus harness exposed (by @ChristopherVR) ([2011c66](https://github.com/ChristopherVR/pptx-viewer/commit/2011c664049bfd580801529c3337ba65bd8d3f13))
- **svelte,vanilla:** Wire SmartArt reflow and the shared run rendering (by @ChristopherVR) ([37b7e45](https://github.com/ChristopherVR/pptx-viewer/commit/37b7e45ce926c7949099f919715595db7c779405))

## [1.18.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.9) - 2026-08-11

### Bug Fixes

- **shared:** Keep a morph pair travelling when its outline is tweened too (by @ChristopherVR) ([0316cf7](https://github.com/ChristopherVR/pptx-viewer/commit/0316cf7b058bc49b247250d9e188822fdd4ef11f))
- **shared:** Dissolve a re-fitted morph paragraph in place instead of stretching it (by @ChristopherVR) ([975c6f6](https://github.com/ChristopherVR/pptx-viewer/commit/975c6f600a836081ec0f30c99fffb9aabbaaa598))

## [1.18.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.8) - 2026-08-11

### Bug Fixes

- **shared:** Stop Vue and Angular writing an inline pointer-events lock during a show (by @ChristopherVR) ([4cb649a](https://github.com/ChristopherVR/pptx-viewer/commit/4cb649a53f5903557ef2f93c190fe6ddd538599e))

## [1.18.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.7) - 2026-08-11

### Bug Fixes

- **vue:** Swap inherited layout artwork when a slide's layout changes (by @ChristopherVR) ([1e927ce](https://github.com/ChristopherVR/pptx-viewer/commit/1e927ce2f079c1e84659791fa62f47b9e2e0ad45))

### Refactor

- **shared:** One paragraph-spacing resolver, and delete four more binding copies (by @ChristopherVR) ([65f8268](https://github.com/ChristopherVR/pptx-viewer/commit/65f8268df08021c1985dc86d93d3338c96b792c8))
- **shared:** Give the cached-SmartArt projection the whole decision, and React's table styling too (by @ChristopherVR) ([411148f](https://github.com/ChristopherVR/pptx-viewer/commit/411148f44630a65b1cd6e90a2954a53a24f110a5))
- **shared:** Move find/replace and per-cell table CSS off their React copies (by @ChristopherVR) ([5b81728](https://github.com/ChristopherVR/pptx-viewer/commit/5b81728891f3e8cea1c2def2aed2d8b23e338081))

## [1.18.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.6) - 2026-08-10

### Bug Fixes

- **shared:** Render cached SmartArt shapes and transparent table headers as authored (by @ChristopherVR) ([24ec6b4](https://github.com/ChristopherVR/pptx-viewer/commit/24ec6b4f2079b55f02aa5559bfa3c3f1eae67652))

## [1.18.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.5) - 2026-08-10

### Bug Fixes

- **core:** Read placeholder, list and percentage values as authored (by @ChristopherVR) ([dc2d679](https://github.com/ChristopherVR/pptx-viewer/commit/dc2d679d48d3be854743d3a09bd2e20c5dc5331f))
- **shared:** Paint an inert morph ghost statically so it stops jittering (by @ChristopherVR) ([ce3be84](https://github.com/ChristopherVR/pptx-viewer/commit/ce3be8487d3530425afb3b455e1671b6c54ae61c))

## [1.18.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.4) - 2026-08-10

### Bug Fixes

- **shared:** Crossfade morph wording instead of fading it out then in (by @ChristopherVR) ([50984f1](https://github.com/ChristopherVR/pptx-viewer/commit/50984f141acc601d35aad19883b6fb1f8e0b79c2))

## [1.18.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.3) - 2026-08-10

### Dependencies

- **deps:** Update dompurify requirement from ^3.4.12 to ^3.4.13 ([#151](https://github.com/ChristopherVR/pptx-viewer/issues/151)) (by @dependabot[bot]) ([7b975ff](https://github.com/ChristopherVR/pptx-viewer/commit/7b975ff73403916341fd8a6192fb6fd6c88fdc17))
- **deps:** Update yjs requirement from ^13.6.31 to ^13.6.32 ([#152](https://github.com/ChristopherVR/pptx-viewer/issues/152)) (by @dependabot[bot]) ([456fdb8](https://github.com/ChristopherVR/pptx-viewer/commit/456fdb8493487ab3e346714755239a90698f6b4d))

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#150](https://github.com/ChristopherVR/pptx-viewer/issues/150)) (by @dependabot[bot]) ([ab75bf1](https://github.com/ChristopherVR/pptx-viewer/commit/ab75bf10a96bb2a0da6e963a5b6b8634e4f73d5b))

## [1.18.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.2) - 2026-08-08

### Bug Fixes

- Dissolve a morph's arriving shapes over the ghost that hid them (by @ChristopherVR) ([89536a3](https://github.com/ChristopherVR/pptx-viewer/commit/89536a36c3e38c3bc8b1219f702dee39e1526fcb))
- Dissolve a morph's centre panel the way PowerPoint measurably does (by @ChristopherVR) ([8c03a9a](https://github.com/ChristopherVR/pptx-viewer/commit/8c03a9a4db720dc4c6883ecd5778749e9148f3af))
- **shared:** Measure per word, and never measure a glyph in isolation (by @ChristopherVR) ([a92004b](https://github.com/ChristopherVR/pptx-viewer/commit/a92004bd554a66e5a0812d5bd20b3df1fff94379))

## [1.18.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.1) - 2026-08-07

### Bug Fixes

- **shared:** Morph a picture's scale, which OOXML stores as a source crop (by @ChristopherVR) ([e2743c7](https://github.com/ChristopherVR/pptx-viewer/commit/e2743c7509090272f4d7bed6df506402de8f6a91))
- **shared:** A still of a slide paints no media chrome (by @ChristopherVR) ([d99e6fd](https://github.com/ChristopherVR/pptx-viewer/commit/d99e6fda7de360e1b1c3f16c578119f8ce5b5d5a))
- **vanilla:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([5dbdd61](https://github.com/ChristopherVR/pptx-viewer/commit/5dbdd616c85182a0d35f8628bb231cea87c8088c))
- **shared:** Measure each run's PowerPoint width instead of guessing one (by @ChristopherVR) ([920d1f3](https://github.com/ChristopherVR/pptx-viewer/commit/920d1f38129886f834fcfe42681339e8251f6814))
- **shared:** A media fallback says WHICH badge, not just "a badge" (by @ChristopherVR) ([1cbe78f](https://github.com/ChristopherVR/pptx-viewer/commit/1cbe78f85985ca87a834380932d845303250606d))
- **vanilla:** Mark missing media as not found, not as playable (by @ChristopherVR) ([73df6cc](https://github.com/ChristopherVR/pptx-viewer/commit/73df6cc626dab7b85e3842e406fa2e8c189d8eec))

### Styling

- **shared:** Escape the measurement cache separator (by @ChristopherVR) ([944b312](https://github.com/ChristopherVR/pptx-viewer/commit/944b312abee48c351b84e39c794027a18ec2d758))

## [1.18.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.18.0) - 2026-08-07

### Features

- Navigate a running slide show on the wheel in every binding (by @ChristopherVR) ([91a19e9](https://github.com/ChristopherVR/pptx-viewer/commit/91a19e96df9d19862b92c3f89ca55acbfbde3111))

## [1.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.17.0) - 2026-08-07

### Features

- **shared:** Map wheel gestures to PowerPoint's intents (by @ChristopherVR) ([1cc7797](https://github.com/ChristopherVR/pptx-viewer/commit/1cc779799cf5b6ffa94c39199c71b563e21afa82))

### Refactor

- Route four bindings through the shared geometry cascade (by @ChristopherVR) ([859ca12](https://github.com/ChristopherVR/pptx-viewer/commit/859ca12b37efcf98e7614b2c2109f3bf1d9c0f72))

## [1.16.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.16.3) - 2026-08-07

### Bug Fixes

- **shared:** Stop category-axis labels crowding the plot (by @ChristopherVR) ([b511ac4](https://github.com/ChristopherVR/pptx-viewer/commit/b511ac44bb53ed2ca20932801c805ea7f0a2fcd1))
- Let clicks fall through an unfilled shape's interior (by @ChristopherVR) ([7e17f9d](https://github.com/ChristopherVR/pptx-viewer/commit/7e17f9ddacd058d9b5c13f1060f58621faeb9908))
- Hollow-shape click-through in the remaining four bindings (by @ChristopherVR) ([fee05ad](https://github.com/ChristopherVR/pptx-viewer/commit/fee05ad5463de9949f289d3aac889794bc7d834a))

### Refactor

- **shared:** Single-source the shape geometry cascade (by @ChristopherVR) ([396e4a2](https://github.com/ChristopherVR/pptx-viewer/commit/396e4a28299168af0564364e9b0be7413b2c8ce8))

## [1.16.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.16.2) - 2026-08-07

### Bug Fixes

- **core:** Measure parallelogram skew against the short side, not the width (by @ChristopherVR) ([fea647f](https://github.com/ChristopherVR/pptx-viewer/commit/fea647f94633e6e919a1c59bda7a71cda8b1b677))
- **core:** Bulge the teardrop preset's point outwards, not inwards (by @ChristopherVR) ([0b23bc4](https://github.com/ChristopherVR/pptx-viewer/commit/0b23bc4b6ecde5f82f7cebb0601859edbf1ab399))
- Render ellipses as ellipses, not pills (by @ChristopherVR) ([b6d2598](https://github.com/ChristopherVR/pptx-viewer/commit/b6d2598fb58f8fc81fbef463c728d87a78c129b4))
- Stop slicing overflowing text with an identity rect clip-path (by @ChristopherVR) ([7393111](https://github.com/ChristopherVR/pptx-viewer/commit/73931118e9e29bf16d1ffccb6f01d68a02091463))

## [1.16.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.16.1) - 2026-08-07

### Bug Fixes

- **core:** Recognize nodeType="afterEffect" when parsing animation triggers (by @ChristopherVR) ([554c077](https://github.com/ChristopherVR/pptx-viewer/commit/554c077b6d0960c5777163a83afe27ee9795b8c2))

## [1.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.16.0) - 2026-08-07

### Features

- **shared:** Remember the open deck so a refresh reopens it (by @ChristopherVR) ([abbe3bd](https://github.com/ChristopherVR/pptx-viewer/commit/abbe3bd15318dd2b7b470eb69b51468d5b9ed26a))

### Bug Fixes

- **shared:** Make Set Up Slide Show's Manual advance mode actually work (by @ChristopherVR) ([c308423](https://github.com/ChristopherVR/pptx-viewer/commit/c3084238158b582b149fcc74903045f4145a0981))

## [1.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.15.0) - 2026-08-07

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
- **vanilla:** Restore saved preferences and stop chrome leaking into slides (by @ChristopherVR) ([0a6f842](https://github.com/ChristopherVR/pptx-viewer/commit/0a6f842295eeb407ec27ec4cf457c9ba06aec203))
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
- **vanilla:** Put the zoom slice on the shared viewer runtime (by @ChristopherVR) ([367295d](https://github.com/ChristopherVR/pptx-viewer/commit/367295dc6bf65664fda72cddb25b5670f07f1ff9))

## [1.14.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.14.2) - 2026-08-05

### Bug Fixes

- **core:** Resolve styled full font names and add condensed fallbacks (by @ChristopherVR) ([26b1f74](https://github.com/ChristopherVR/pptx-viewer/commit/26b1f745929fe33cda2044dc4a24ff4edbbab0d5))
- **shared:** Draw chart text at point size and scale chart SVGs 1:1 (by @ChristopherVR) ([da333f9](https://github.com/ChristopherVR/pptx-viewer/commit/da333f933eeba0af226ca1894639696350e23cfb))
- **shared:** Suspend the show on window blur, not only tab-hide (by @ChristopherVR) ([4a2c254](https://github.com/ChristopherVR/pptx-viewer/commit/4a2c254350554c189a53a0284aeb72e84b724740))
- **shared:** Fold the origami transition like a sheet of paper (by @ChristopherVR) ([f0f9fc2](https://github.com/ChristopherVR/pptx-viewer/commit/f0f9fc2710a4c1a3760729cfddca0afc7f66c70d))
- **shared:** Cover the fillRect placement fields in the collab schema (by @ChristopherVR) ([d455ed7](https://github.com/ChristopherVR/pptx-viewer/commit/d455ed72b254633d34e08d7694069e6c0d9f5615))

## [1.14.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.14.1) - 2026-08-05

### Dependencies

- **deps:** Bump ai from 7.0.48 to 7.0.44 ([#134](https://github.com/ChristopherVR/pptx-viewer/issues/134)) (by @dependabot[bot]) ([08a13e0](https://github.com/ChristopherVR/pptx-viewer/commit/08a13e076caa6d97e22bd706e57657407aef1dd8))

## [1.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.14.0) - 2026-08-01

### Features

- Fixed graphs and arrows shapes (by @ChristopherVR) ([94813f5](https://github.com/ChristopherVR/pptx-viewer/commit/94813f52a75fb3b42f72e7c33be41393b794cf82))

## [1.13.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.13.1) - 2026-08-01

### Bug Fixes

- Make an inspector edit exactly one undo step, in every binding (by @ChristopherVR) ([48733d4](https://github.com/ChristopherVR/pptx-viewer/commit/48733d4a9dbe8d7887b0a103cc7cb1e90882464b))
- Let the presenter finish the show, and keep scrubbers out of its panes (by @ChristopherVR) ([c7c12bc](https://github.com/ChristopherVR/pptx-viewer/commit/c7c12bc053548c8e94d3da385461d6569a1695a0))

### Refactor

- **shared:** Split arrow markers and dash patterns out of connector-path (by @ChristopherVR) ([53d47d1](https://github.com/ChristopherVR/pptx-viewer/commit/53d47d1d529fe17f165a16ec9de7b7f29b17845c))

## [1.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.13.0) - 2026-08-01

### Features

- Mark hidden slides in every rail and sorter, and honour custom shows in vanilla and svelte (by @ChristopherVR) ([b61f202](https://github.com/ChristopherVR/pptx-viewer/commit/b61f2029b09d2bad78fc53bdd0f0d5538b171aa9))
- Name every animation preset a user can reach, in every locale (by @ChristopherVR) ([f99962d](https://github.com/ChristopherVR/pptx-viewer/commit/f99962d0e98d579ad45ee77299b1df1f326fde6d))
- **vue:** Add the connector arrowhead controls, and make connectors clickable (by @ChristopherVR) ([2b0976e](https://github.com/ChristopherVR/pptx-viewer/commit/2b0976ea68b4ffc6c3ab7fd5d58aed1c8f5d1356))
- Draw action affordances in every binding, and mark group children (by @ChristopherVR) ([39ed47f](https://github.com/ChristopherVR/pptx-viewer/commit/39ed47f5a7a7dada06362e422aeb39e563485cab))
- Make connectors clickable and give all five the same arrowhead controls (by @ChristopherVR) ([e482b12](https://github.com/ChristopherVR/pptx-viewer/commit/e482b12ff2a589f68953ab7e48c63d4bac927fb4))
- Give all five the same presenter console, and stop vanilla dropping the show (by @ChristopherVR) ([bf861fd](https://github.com/ChristopherVR/pptx-viewer/commit/bf861fd79c55874ec4f4e66ee25357d003b6189d))

### Bug Fixes

- **vanilla:** Let a ribbon button with a text label size to its text (by @ChristopherVR) ([e8ed06e](https://github.com/ChristopherVR/pptx-viewer/commit/e8ed06e1ed6e499f1005ea2a44969fa946c3d60e))
- **shared:** Paint SVG-only pictures, honour srcRect crops, stop bold leaking (by @ChristopherVR) ([ff866db](https://github.com/ChristopherVR/pptx-viewer/commit/ff866db22a2f59f0fbb6da518b4055e8edd80481))
- Give every binding React's slide-show bar, and make slice clicks work (by @ChristopherVR) ([31f30f7](https://github.com/ChristopherVR/pptx-viewer/commit/31f30f7f26117e3badb34c2e2e0a29f32f8da608))
- Play slide media the way the deck authored it (by @ChristopherVR) ([855f140](https://github.com/ChristopherVR/pptx-viewer/commit/855f140bd3507a87de91479e62af0b67be4c8649))

## [1.12.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.12.1) - 2026-07-31

### Bug Fixes

- **shared:** Stop a morph gliding one text box into an unrelated one (by @ChristopherVR) ([bc4789f](https://github.com/ChristopherVR/pptx-viewer/commit/bc4789fef0dbcaf8d524b19f99fac15847597ad0))
- **shared:** Stop a morph double-painting unchanged shapes, and dissolve text (by @ChristopherVR) ([d4b3952](https://github.com/ChristopherVR/pptx-viewer/commit/d4b3952757d719b2c7e1b4be307b14a15c56f73a))
- Stop showing users raw OOXML tokens, and make Vanilla's point index work (by @ChristopherVR) ([33d63ce](https://github.com/ChristopherVR/pptx-viewer/commit/33d63cec94a22ddf7cc0b57ddaa61ddb43eaedd3))
- Skip hidden slides in the show, and honour endWithBlackSlide (by @ChristopherVR) ([2a9ef49](https://github.com/ChristopherVR/pptx-viewer/commit/2a9ef49f97f976eb088a2fcc092b56a54b112fa3))

## [1.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.12.0) - 2026-07-31

### Features

- **shared:** Outline view, motion-path authoring, and chart marker resolution (by @ChristopherVR) ([e6a3621](https://github.com/ChristopherVR/pptx-viewer/commit/e6a362195b811231c76a24eb94de8e95795716f8))
- Outline view, motion-path authoring and the missing chart controls (by @ChristopherVR) ([278de2f](https://github.com/ChristopherVR/pptx-viewer/commit/278de2f5754f2b8bb19722460e047deb4cd72fbb))

### Bug Fixes

- **core:** Stop dropping a:pPr/@lvl when a paragraph's runs share one style (by @ChristopherVR) ([03aa4ed](https://github.com/ChristopherVR/pptx-viewer/commit/03aa4edeea15336b032227601cc57fb65d378b1c))

## [1.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.11.0) - 2026-07-31

### Features

- **shared:** Own the equation, media, reading-view and table-grid logic (by @ChristopherVR) ([c33af39](https://github.com/ChristopherVR/pptx-viewer/commit/c33af39d2157fdb8610c104a8a3e54fa8ae7c672))
- Wire reading view, the shared equation pipeline and a table data grid (by @ChristopherVR) ([b731b52](https://github.com/ChristopherVR/pptx-viewer/commit/b731b52f926737f0ccef95247f20db217cee1fb5))

### Bug Fixes

- **shared:** Resolve linked text-box chains inside groups (by @ChristopherVR) ([5e09586](https://github.com/ChristopherVR/pptx-viewer/commit/5e0958689a591f839ccfdf20bb3ae174af00030a))

## [1.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.10.0) - 2026-07-31

### Features

- **shared:** Give every referenced translation key a real entry (by @ChristopherVR) ([8ff4461](https://github.com/ChristopherVR/pptx-viewer/commit/8ff4461d0376408330ef5ce875b4aa7a13d0614f))
- **shared:** Own the logic five bindings had each hand-ported (by @ChristopherVR) ([60b9b0d](https://github.com/ChristopherVR/pptx-viewer/commit/60b9b0d06d60d674835ef23166ca9c46c1b191ba))
- **vanilla:** Reach ribbon, inspector and canvas parity with the reference (by @ChristopherVR) ([26ff896](https://github.com/ChristopherVR/pptx-viewer/commit/26ff8968b20a7affdd48ee6e8dcf89d18097302b))
- **core:** Model a gradient / pattern outline in structured form (by @ChristopherVR) ([69322c9](https://github.com/ChristopherVR/pptx-viewer/commit/69322c94ab40e37f19a1789c3149b5dd5d71498c))
- **shared:** Stroke a gradient outline as SVG instead of a flat border (by @ChristopherVR) ([fc72324](https://github.com/ChristopherVR/pptx-viewer/commit/fc723241643cdc18bb6ad0c113ca08763c9426ad))
- **vanilla:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([b9804ac](https://github.com/ChristopherVR/pptx-viewer/commit/b9804ac1d6a0fd5d72f40b360d576132cca2fb90))
- **shared:** Stroke a patterned outline with a real pattern tile (by @ChristopherVR) ([9d8c3bd](https://github.com/ChristopherVR/pptx-viewer/commit/9d8c3bdfbd40e78d0fc66d9325efedb0bc9a3ea4))
- **vanilla:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([1b3ee4f](https://github.com/ChristopherVR/pptx-viewer/commit/1b3ee4f75444027b88bce70928328233edad49af))
- **shared:** Translate the File backstage and merge the stray key namespaces (by @ChristopherVR) ([e56aa6d](https://github.com/ChristopherVR/pptx-viewer/commit/e56aa6d3f00e4cbd23983036a195cba3c2d6bf6b))

### Bug Fixes

- **shared:** Honour authored preset adjustments and emit parseable gradient CSS (by @ChristopherVR) ([dbf5640](https://github.com/ChristopherVR/pptx-viewer/commit/dbf5640fb532082ca96d6a7dc8b439e07dd34a80))
- **core:** Honour a preset path's own coordinate space, and repair hexagon (by @ChristopherVR) ([8e4a91d](https://github.com/ChristopherVR/pptx-viewer/commit/8e4a91d76a2bdd3ba3369ed541bc262d2a9c06f4))
- **core:** Rebuild flowChartTerminator from its spec Beziers (by @ChristopherVR) ([0e81403](https://github.com/ChristopherVR/pptx-viewer/commit/0e8140381fe6af3719a52dcc1b39f16609b5faf0))
- **core:** Keep an inline field in the position it was authored in (by @ChristopherVR) ([beb2067](https://github.com/ChristopherVR/pptx-viewer/commit/beb2067fc11ae709a26b4f9e6714fa557375ec85))
- **core:** Rebuild sun as a disc plus eight detached rays (by @ChristopherVR) ([cd2fcd4](https://github.com/ChristopherVR/pptx-viewer/commit/cd2fcd4baec66f040671aea332d1bcd2250a2e7f))
- **core:** Round-trip the Selection Pane hide toggle (by @ChristopherVR) ([14bdb23](https://github.com/ChristopherVR/pptx-viewer/commit/14bdb23d8c2840cc93d8a891c31ac9e8ffdf44cf))
- **shared:** Resolve a click on a group's child to the group (by @ChristopherVR) ([88ef671](https://github.com/ChristopherVR/pptx-viewer/commit/88ef671c4af065c0e21327ceec5840a2de4d4516))
- **shared:** Flow linked text-box overflow in every binding (by @ChristopherVR) ([abe1bb0](https://github.com/ChristopherVR/pptx-viewer/commit/abe1bb0702315c8a65582f1d64f62c6679298143))

### Testing

- **core:** Pin issue #132 fill and adjustment parsing against the reporter deck (by @ChristopherVR) ([06cd312](https://github.com/ChristopherVR/pptx-viewer/commit/06cd31287bcbd3895a834bed9f89af443526dca2))

## [1.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.9.0) - 2026-07-31

### Features

- **shared:** Decide which slide-show clicks are a PowerPoint advance (by @ChristopherVR) ([12ab5c8](https://github.com/ChristopherVR/pptx-viewer/commit/12ab5c82f08083e725eae332ee19b03b5021ce79))

### Bug Fixes

- **vanilla:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([525a167](https://github.com/ChristopherVR/pptx-viewer/commit/525a1673aad8ce00625ad0e0758b949b516c7141))
- **e2e:** Drop binding-specific selectors from the new present specs (by @ChristopherVR) ([4db83a8](https://github.com/ChristopherVR/pptx-viewer/commit/4db83a8c401f3b3586784b7244ca131511757023))

## [1.8.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.8.1) - 2026-07-31

### Bug Fixes

- **shared:** Match PowerPoint's morph dissolve windows and half-turn direction (by @ChristopherVR) ([661c250](https://github.com/ChristopherVR/pptx-viewer/commit/661c250ff429f0d8ea2f0bb5e2992a7d57af0353))
- **shared:** Stop morph pairing a shape with the group that wraps it (by @ChristopherVR) ([d240498](https://github.com/ChristopherVR/pptx-viewer/commit/d240498388734b5e81b238036856d891f86f2570))
- **core:** Stop an interactive sequence adding a phantom click step (by @ChristopherVR) ([65a4738](https://github.com/ChristopherVR/pptx-viewer/commit/65a4738a6eb8fd0b34999c52dd7e1244c5f0e6b5))
- **shared:** Resolve the timed slide auto-advance delay (by @ChristopherVR) ([beba8cc](https://github.com/ChristopherVR/pptx-viewer/commit/beba8ccb834f1eb04db305d68ac31d40beda4232))
- **vanilla:** Make the slide show's transitions visible on a large display (by @ChristopherVR) ([ef02b5e](https://github.com/ChristopherVR/pptx-viewer/commit/ef02b5e8f00398f4bb59d41c3918104b5b074654))

### Refactor

- **shared:** Break the morph-matching <-> morph-flatten import cycle (by @ChristopherVR) ([92223c5](https://github.com/ChristopherVR/pptx-viewer/commit/92223c542d357d2831b4b3641180fec20c264dc1))

## [1.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.8.0) - 2026-07-31

### Features

- **shared:** Morph a !!-named shape across a grouping boundary (by @ChristopherVR) ([c74847d](https://github.com/ChristopherVR/pptx-viewer/commit/c74847dd53ef3344c4624c036a2f806ea62794c1))

### Bug Fixes

- **shared:** Morph rotates the short way round, like PowerPoint (by @ChristopherVR) ([255d0b5](https://github.com/ChristopherVR/pptx-viewer/commit/255d0b5541bdf12d66ab773090fee179072eb852))
- **shared:** Honour the legacy spd speed, including for morph (by @ChristopherVR) ([ab796b9](https://github.com/ChristopherVR/pptx-viewer/commit/ab796b94e27fa8addbad5f70578b4c9a591c1b11))
- **shared:** Keep a morphing object solid instead of dipping to the background (by @ChristopherVR) ([5f2b518](https://github.com/ChristopherVR/pptx-viewer/commit/5f2b518d39c16eeb207f70ea1df2583405022611))

## [1.7.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.7.6) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph id-pairing shapes whose creationId GUIDs differ (by @ChristopherVR) ([b9afc84](https://github.com/ChristopherVR/pptx-viewer/commit/b9afc844f0cab88ed44b25236f21b4628f1309a6))

## [1.7.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.7.5) - 2026-07-30

### Bug Fixes

- **core:** Stamp the endParaRPr size on an empty paragraph's separator (by @ChristopherVR) ([2b18374](https://github.com/ChristopherVR/pptx-viewer/commit/2b1837473bdde04bc41f9593f444a096dd4196b8))
- **shared:** PowerPoint-exact line height, blank-line strut, marker indent reset (by @ChristopherVR) ([7f7181b](https://github.com/ChristopherVR/pptx-viewer/commit/7f7181b2d4ec36f990b157964c2aa648d291b20f))

## [1.7.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.7.4) - 2026-07-30

### Bug Fixes

- **shared:** Restate the static transform in every morph keyframe (by @ChristopherVR) ([075a645](https://github.com/ChristopherVR/pptx-viewer/commit/075a6454fe4a5a17e79e2b2adb213ea2e21ccfb0))

## [1.7.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.7.3) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph pairing nearby shapes of very different sizes; 2s default (by @ChristopherVR) ([3d49c67](https://github.com/ChristopherVR/pptx-viewer/commit/3d49c672089ae26008f24f8cce7160ef22709507))

## [1.7.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.7.2) - 2026-07-30

### Bug Fixes

- **shared:** Crossfade a morph pair whose GROUP children changed (by @ChristopherVR) ([7492f26](https://github.com/ChristopherVR/pptx-viewer/commit/7492f26a236659f2c15a99c36a92023f7da6cbbc))

## [1.7.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.7.1) - 2026-07-29

### Bug Fixes

- **core:** Keep grouped text at its authored point size (by @ChristopherVR) ([56f676a](https://github.com/ChristopherVR/pptx-viewer/commit/56f676a850a510fa405361d58c849e4a7adb3bea))
- **shared:** Keep authored blank lines and give the bullet its hanging box (by @ChristopherVR) ([0a8de56](https://github.com/ChristopherVR/pptx-viewer/commit/0a8de560f117fdaeb06374e61e49a2cf4e1372b7))
- **shared:** Make morph animate a near-duplicate slide pair (by @ChristopherVR) ([e73ade7](https://github.com/ChristopherVR/pptx-viewer/commit/e73ade737892f3b46a79eb183370a86e3f8b59fe))
- **vanilla:** Render authored blank lines and drop the bullet spacer (by @ChristopherVR) ([b85c2c7](https://github.com/ChristopherVR/pptx-viewer/commit/b85c2c7e48b7dcc4388406d410dcdf9fe320e168))

## [1.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.7.0) - 2026-07-27

### Features

- **shared:** Morph transition render plan and paragraph strut basis (by @ChristopherVR) ([94cfddd](https://github.com/ChristopherVR/pptx-viewer/commit/94cfddd2afc9ab20f294f6aa08ddf95fff7f5213))

### Bug Fixes

- **core:** Parse morph, fontRef text colour, and unsized bullets correctly (by @ChristopherVR) ([7607996](https://github.com/ChristopherVR/pptx-viewer/commit/7607996123e493ed1f33a6891e444f3b02bb2ed9))
- **vanilla:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([6f863d6](https://github.com/ChristopherVR/pptx-viewer/commit/6f863d69f9da582afbbcd308b174239056fea477))

## [1.6.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.6.3) - 2026-07-27

### Dependencies

- **deps:** Update emf-converter requirement from ^2.0.0 to ^2.0.2 ([#122](https://github.com/ChristopherVR/pptx-viewer/issues/122)) (by @dependabot[bot]) ([423034a](https://github.com/ChristopherVR/pptx-viewer/commit/423034ad1e6d48dbb75be17e1915c917c912517b))
- **deps:** Update html2canvas-pro requirement from ^2.3.1 to ^2.3.2 ([#124](https://github.com/ChristopherVR/pptx-viewer/issues/124)) (by @dependabot[bot]) ([6ad6bce](https://github.com/ChristopherVR/pptx-viewer/commit/6ad6bceecf88670f33e2544dbeb1a98c8b1bf9f6))

## [1.6.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.6.2) - 2026-07-27

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## [1.6.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.6.1) - 2026-07-26

### Testing

- **e2e:** Cover remote presence geometry in every binding (by @ChristopherVR) ([adb9b3c](https://github.com/ChristopherVR/pptx-viewer/commit/adb9b3c180d3f7fce1bd175dfc0b29d385937a51))

## [1.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.6.0) - 2026-07-26

### Features

- **shared:** Lock the audience display out of edit mode (by @ChristopherVR) ([79dc876](https://github.com/ChristopherVR/pptx-viewer/commit/79dc8768ff599e662c4291861b340c2939001f84))
- **shared:** Seed a slide as fully built, and keep audience input inert (by @ChristopherVR) ([6acdf5e](https://github.com/ChristopherVR/pptx-viewer/commit/6acdf5e02c6d727828433ba067942e72d6547922))

### Bug Fixes

- **core:** Keep the click step's own start conditions (by @ChristopherVR) ([755a4b2](https://github.com/ChristopherVR/pptx-viewer/commit/755a4b2e38dff73c9c460a5318c1fce913880328))
- **shared:** Play a slide's opening build without a click (by @ChristopherVR) ([9d0ecec](https://github.com/ChristopherVR/pptx-viewer/commit/9d0ecec007d1f7ef48ecbd97429b55073352a487))
- **vanilla:** Auto-play the opening build and lock the audience display (by @ChristopherVR) ([e8dcf41](https://github.com/ChristopherVR/pptx-viewer/commit/e8dcf4133243609653006dff6d51d41c6a899a75))
- **core:** Paint useBgFill shapes with the slide background (by @ChristopherVR) ([f819817](https://github.com/ChristopherVR/pptx-viewer/commit/f81981744c637368d1ef0d87b1ba884e634c938a))
- **shared:** Ripple a by-paragraph build that also iterates (by @ChristopherVR) ([73238d5](https://github.com/ChristopherVR/pptx-viewer/commit/73238d590217f8c61e86c9f065d19436dd6b699b))
- **vanilla:** Render staged text builds, hold back on a back step (by @ChristopherVR) ([cf2909b](https://github.com/ChristopherVR/pptx-viewer/commit/cf2909b927e0f3f7b6867c29b168303baf365aeb))

## [1.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.5.0) - 2026-07-25

### Dependencies

- **deps:** Update lucide requirement from ^1.25.0 to ^1.26.0 ([#111](https://github.com/ChristopherVR/pptx-viewer/issues/111)) (by @dependabot[bot]) ([d145723](https://github.com/ChristopherVR/pptx-viewer/commit/d1457230d11ba90ca91e3af037345b89439a245a))
- **deps:** Update ai requirement from ^7.0.35 to ^7.0.37 ([#115](https://github.com/ChristopherVR/pptx-viewer/issues/115)) (by @dependabot[bot]) ([71d200d](https://github.com/ChristopherVR/pptx-viewer/commit/71d200d5aa0627c90fb2c8bfc0c50ee4b132a7d8))

### Chores

- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))
- **deps-dev:** Update happy-dom requirement from ^20.11.0 to ^20.11.1 ([#116](https://github.com/ChristopherVR/pptx-viewer/issues/116)) (by @dependabot[bot]) ([0a2f499](https://github.com/ChristopherVR/pptx-viewer/commit/0a2f4990ae3caa60de537c9e0ea38ca8d796fd56))

## [1.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.4.0) - 2026-07-25

### Features

- **shared:** Rule for advancing a show from the presenter slide pane (by @ChristopherVR) ([ee2d0f5](https://github.com/ChristopherVR/pptx-viewer/commit/ee2d0f584dd042eeee89c57ec3c33335208bde28))

### Bug Fixes

- **core:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([eebf128](https://github.com/ChristopherVR/pptx-viewer/commit/eebf128df224247eb06ea1731c9418fcc36189f9))
- **shared:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([406d78b](https://github.com/ChristopherVR/pptx-viewer/commit/406d78b2471ec171fe5cbd8b2ef6abb3216c3c3b))
- **shared:** Parse playFrom media commands in linear time (by @ChristopherVR) ([60820b1](https://github.com/ChristopherVR/pptx-viewer/commit/60820b10ebf641ec2adf6c6d1089fe9f2bc4e490))
- Svelte border width for selected element (by @ChristopherVR) ([b1dccd1](https://github.com/ChristopherVR/pptx-viewer/commit/b1dccd192edb7509ed8b59e76a3e638dbef0e3af))
- **core:** Honour a:noFill and stop painting hidden fills/lines (by @ChristopherVR) ([ae13541](https://github.com/ChristopherVR/pptx-viewer/commit/ae1354188b1c5d2bd5843dc36a7c438ba1d83c00))

## [1.3.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.3.1) - 2026-07-24

### Bug Fixes

- **core:** Preserve native bullets and boundary spaces ([#107](https://github.com/ChristopherVR/pptx-viewer/issues/107)) ([7ed0971](https://github.com/ChristopherVR/pptx-viewer/commit/7ed09718d2fc439b129ee5ed23c8f5c41fe399ba))
- **vanilla:** Enable touch move/resize of elements on mobile (by @ChristopherVR) ([e51b768](https://github.com/ChristopherVR/pptx-viewer/commit/e51b76812659478c76b8f2d11e692d947985534e))

## [1.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.3.0) - 2026-07-24

### Features

- **shared:** Powerpoint-accurate slide-show keyboard map (by @ChristopherVR) ([fdf55d4](https://github.com/ChristopherVR/pptx-viewer/commit/fdf55d45779e090c36aa994cdc17fae8f01df79b))
- **vanilla:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([629903c](https://github.com/ChristopherVR/pptx-viewer/commit/629903c8c1ecab33e5dde40ffef42a88e8bde94e))
- **react:** Give the slide-show menu PowerPoint's full command set (by @ChristopherVR) ([33c826d](https://github.com/ChristopherVR/pptx-viewer/commit/33c826d887c69e5103b0f0148e9ee1b1c17b16b0))

## [1.2.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.2.1) - 2026-07-23

### Refactor

- **vanilla:** Extract the collab controller's public types (by @ChristopherVR) ([9c06b9c](https://github.com/ChristopherVR/pptx-viewer/commit/9c06b9cfebfe33fcab7047e7cbe918152a164a75))

## [1.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.2.0) - 2026-07-23

### Features

- **shared:** Live-patch channel for interim collaboration state (by @ChristopherVR) ([efdcc1e](https://github.com/ChristopherVR/pptx-viewer/commit/efdcc1e13ef824f6b26f3c92ba199e0da732b164))
- **shared:** Make a departing collaborator actually leave the room (by @ChristopherVR) ([6af3d8c](https://github.com/ChristopherVR/pptx-viewer/commit/6af3d8ce9933946a5420f1a21c8de55cf7da3548))

### Bug Fixes

- **vanilla:** Publish inline-editor typing to peers before commit (by @ChristopherVR) ([ab2875c](https://github.com/ChristopherVR/pptx-viewer/commit/ab2875c60047bbd94dad44eea5274f3cd80cb7bc))
- **vanilla:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([e10b2f9](https://github.com/ChristopherVR/pptx-viewer/commit/e10b2f93e07ddd2cf64dff25d23ecec0238f28c6))

### Other

- Peers leave the room synchronously on frame teardown (no ghost collaborators) (by @ChristopherVR) ([ae9acad](https://github.com/ChristopherVR/pptx-viewer/commit/ae9acad9cfe65ee8dfa6a9676152b6c1abab5b0f))

### Refactor

- **shared:** Split the live-patch module and escape its NUL key separator (by @ChristopherVR) ([6362b22](https://github.com/ChristopherVR/pptx-viewer/commit/6362b22135da6b7503113799f2631f8085ea49c5))

## [1.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.1.0) - 2026-07-23

### Features

- **vanilla:** Remote selection highlights; fix mobile notes strip + follow bar (by @ChristopherVR) ([c4ac6f8](https://github.com/ChristopherVR/pptx-viewer/commit/c4ac6f850d607cfda3461cabe33ad3eff497a6d8))

## [1.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@1.0.0) - 2026-07-23

### Features

- **shared:** Ai config, loader and bridge contracts (by @ChristopherVR) ([1c40e28](https://github.com/ChristopherVR/pptx-viewer/commit/1c40e28b1661895e2993b01c11bea6262459cb88))
- **vanilla:** Ai bridge over the viewer controller (by @ChristopherVR) ([a031301](https://github.com/ChristopherVR/pptx-viewer/commit/a031301511bfb13762b49a70541fdeb2183dd497))
- **shared:** Indexeddb-first ai chat history store (by @ChristopherVR) ([88920f2](https://github.com/ChristopherVR/pptx-viewer/commit/88920f20eb00e72b84efa9ef2cb500dfd6d20db4))
- **shared:** Rebuild AI assistant tools on pptx-viewer-mcp (by @ChristopherVR) ([da1c31e](https://github.com/ChristopherVR/pptx-viewer/commit/da1c31ee88c0b60a82628003c8a1b16245f028ed))
- **core:** Upgrade emf-converter to 2.0.0 (breaking) (by @ChristopherVR) ([effa4e5](https://github.com/ChristopherVR/pptx-viewer/commit/effa4e5338b2b01796a3671f505bcb4563de74cc))

### Documentation

- Friendly 2.0.0 changelog for root and packages (by @ChristopherVR) ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))

### Testing

- **vanilla:** Ai panel gating and proposals (by @ChristopherVR) ([f7613fd](https://github.com/ChristopherVR/pptx-viewer/commit/f7613fdca28b0cb84c7ddaeb96e49dc27a49b3e8))
- **shared:** Opt-in live gpt-4o-mini ai integration test (by @ChristopherVR) ([48622f1](https://github.com/ChristopherVR/pptx-viewer/commit/48622f135a5f2ee4c28d97d08478d3c203745f47))

### Build & CI

- **shared:** Keep the ai SDK external across bindings (by @ChristopherVR) ([fa5e6b7](https://github.com/ChristopherVR/pptx-viewer/commit/fa5e6b77e6586764d9e7717439f574291810e93b))

## [0.17.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.17.5) - 2026-07-19

### Bug Fixes

- **core:** Preserve rich cell text, per-paragraph pPr and font fidelity (#68, #69, #83, #84, #85) (by @ChristopherVR) ([4d61e0e](https://github.com/ChristopherVR/pptx-viewer/commit/4d61e0ee4210bbe2897d58e3376539f1ea708a35))
- **shared:** Route exotic transitions to faithful p14 keyframes ([#80](https://github.com/ChristopherVR/pptx-viewer/issues/80)) (by @ChristopherVR) ([80b972d](https://github.com/ChristopherVR/pptx-viewer/commit/80b972d7a59bbb77fc8d80ae86bf6f97eb80a8b7))
- **shared:** Keep unmapped animation presets from stranding elements ([#81](https://github.com/ChristopherVR/pptx-viewer/issues/81)) (by @ChristopherVR) ([caf4e5e](https://github.com/ChristopherVR/pptx-viewer/commit/caf4e5e78db3fd2800cf6d1ae45e1a8248679435))
- **shared:** Render chart markers, helper lines and pie/bar options (#88, #89, #72, #97) (by @ChristopherVR) ([042bd01](https://github.com/ChristopherVR/pptx-viewer/commit/042bd01af29921a29c9e3f548a290ccf582492e9))
- **core:** Wire viewProps.xml into load and default it on save (#90, #96) (by @ChristopherVR) ([2e6616e](https://github.com/ChristopherVR/pptx-viewer/commit/2e6616e89c256a75c560fb3af634b39646ee9a84))
- **core:** Recompute app.xml TitlesOfParts and HeadingPairs on save ([#91](https://github.com/ChristopherVR/pptx-viewer/issues/91)) (by @ChristopherVR) ([87585a7](https://github.com/ChristopherVR/pptx-viewer/commit/87585a74526746b35029da6d8844037f2e46add4))
- **core:** Round-trip cNvSpPr txBox and cover spLocks serialization ([#92](https://github.com/ChristopherVR/pptx-viewer/issues/92)) (by @ChristopherVR) ([9feb36b](https://github.com/ChristopherVR/pptx-viewer/commit/9feb36b96d55e6b4822d33d570182871a3ab6cd0))
- **shared:** Recompute connector flip and use real connection sites ([#93](https://github.com/ChristopherVR/pptx-viewer/issues/93)) (by @ChristopherVR) ([fa67196](https://github.com/ChristopherVR/pptx-viewer/commit/fa67196bfc737e5ec21a7c771abc3cb6355888fc))
- **core:** Resolve SmartArt dsp blip fills and enumerate nested shapes ([#73](https://github.com/ChristopherVR/pptx-viewer/issues/73)) (by @ChristopherVR) ([ff08821](https://github.com/ChristopherVR/pptx-viewer/commit/ff088215aeebdfdca5da73ee8a92b533c7218737))
- **core:** Parse SmartArt colour lists and presLayoutVars ([#94](https://github.com/ChristopherVR/pptx-viewer/issues/94)) (by @ChristopherVR) ([7917f71](https://github.com/ChristopherVR/pptx-viewer/commit/7917f714cb9d53b0a7df3e9d2d3c083963f03478))
- **core:** Remap custom-show and section slide refs on reorder/remove ([#96](https://github.com/ChristopherVR/pptx-viewer/issues/96)) (by @ChristopherVR) ([9f83519](https://github.com/ChristopherVR/pptx-viewer/commit/9f83519fd4fef7ac6a1fb7868408f531cc998b43))
- **core:** Embed non-data-URL slide background images on save ([#100](https://github.com/ChristopherVR/pptx-viewer/issues/100)) (by @ChristopherVR) ([61da958](https://github.com/ChristopherVR/pptx-viewer/commit/61da958b29295926b14bb24d576854e001b8cc7c))
- **core:** Round-trip gradient/pattern line fills and gradient tileRect/grpFill (#87, #97) (by @ChristopherVR) ([3942594](https://github.com/ChristopherVR/pptx-viewer/commit/3942594d22081a6228055219d30aab5bbb128e58))
- **core:** Broaden table-style fills/text and apply corner-cell fills ([#95](https://github.com/ChristopherVR/pptx-viewer/issues/95)) (by @ChristopherVR) ([c2cab10](https://github.com/ChristopherVR/pptx-viewer/commit/c2cab10bd031b596ccaa1afa7481ee857713251b))
- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))
- **core:** Render chart invertIfNegative and fix SDK generator containers ([#97](https://github.com/ChristopherVR/pptx-viewer/issues/97)) (by @ChristopherVR) ([888b9c7](https://github.com/ChristopherVR/pptx-viewer/commit/888b9c75da46c771b2817895b95787e7eb036bc6))
- **core:** Round-trip explicit run/paragraph text properties and fix colour maths ([#98](https://github.com/ChristopherVR/pptx-viewer/issues/98)) (by @ChristopherVR) ([3fe3ced](https://github.com/ChristopherVR/pptx-viewer/commit/3fe3ced01abf9f8666cbb93be11a9e3c3b960ee3))
- **core:** Apply animation easing, sound loop, comment resolved and p14 media embed ([#98](https://github.com/ChristopherVR/pptx-viewer/issues/98)) (by @ChristopherVR) ([e7c1fd6](https://github.com/ChristopherVR/pptx-viewer/commit/e7c1fd65441d4b5e017a18b596b1fec16ca7d8ec))

## [0.17.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.17.4) - 2026-07-19

### Bug Fixes

- **core:** Write sp3d colours as valid hex and preserve scene3d (#67, #86) (by @ChristopherVR) ([d30f5a7](https://github.com/ChristopherVR/pptx-viewer/commit/d30f5a754921d3c396856be8a7bbfc2b7233f2dd))
- **core:** Parse and render group rotation and flip ([#70](https://github.com/ChristopherVR/pptx-viewer/issues/70)) (by @ChristopherVR) ([5bb820a](https://github.com/ChristopherVR/pptx-viewer/commit/5bb820a3ee4d66f7b2810decce45b3a3b752884f))
- **core:** Resolve table-style borders from tcBdr ([#71](https://github.com/ChristopherVR/pptx-viewer/issues/71)) (by @ChristopherVR) ([1e8c072](https://github.com/ChristopherVR/pptx-viewer/commit/1e8c0726640b12723532bfe9e1f544841d1f021f))
- **shared:** Render per-point chart dPt fills and pie varyColors ([#72](https://github.com/ChristopherVR/pptx-viewer/issues/72)) (by @ChristopherVR) ([6184c10](https://github.com/ChristopherVR/pptx-viewer/commit/6184c106a1a0ff5c874211dd741bb08d1e8fdf8c))
- **core:** Parse gradient and pattern fills on SmartArt dsp shapes ([#73](https://github.com/ChristopherVR/pptx-viewer/issues/73)) (by @ChristopherVR) ([6b94c9a](https://github.com/ChristopherVR/pptx-viewer/commit/6b94c9a5aa16a663b2720f28d92d1823fd4cc631))
- **core:** Decode real InkML contentPart traces to SVG paths ([#74](https://github.com/ChristopherVR/pptx-viewer/issues/74)) (by @ChristopherVR) ([8204f7c](https://github.com/ChristopherVR/pptx-viewer/commit/8204f7cb9805d6ce9d893940a0a3e5c217fab69e))
- **core:** Resolve themed bullet colour via parseColor ([#75](https://github.com/ChristopherVR/pptx-viewer/issues/75)) (by @ChristopherVR) ([ba311d5](https://github.com/ChristopherVR/pptx-viewer/commit/ba311d57e17aa9a61a0ffc60fef4689b4cb1389c))
- **core:** Honour fly-in/out animation direction via presetSubtype ([#76](https://github.com/ChristopherVR/pptx-viewer/issues/76)) (by @ChristopherVR) ([316a7db](https://github.com/ChristopherVR/pptx-viewer/commit/316a7db02ad12f135b27635f01ecae1287a44adf))
- **core:** Parse p15 prstTrans transitions and stop spurious cut ([#77](https://github.com/ChristopherVR/pptx-viewer/issues/77)) (by @ChristopherVR) ([a32260e](https://github.com/ChristopherVR/pptx-viewer/commit/a32260e6d391ae1ed2b98a13b958ccb137bc1347))
- **core:** Serialize justLow/dist/thaiDist paragraph alignment ([#78](https://github.com/ChristopherVR/pptx-viewer/issues/78)) (by @ChristopherVR) ([59a882a](https://github.com/ChristopherVR/pptx-viewer/commit/59a882a60d43f83e9b8189063838f7ea4d2a5502))
- **core:** Flag embedded media as embedded, not linked ([#79](https://github.com/ChristopherVR/pptx-viewer/issues/79)) (by @ChristopherVR) ([0decc64](https://github.com/ChristopherVR/pptx-viewer/commit/0decc64d2c5b7b5c1bd3cd469bed6910c5766957))

## [0.17.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.17.3) - 2026-07-19

### Bug Fixes

- **core:** Themed background text, colour and geometry fidelity (by @ChristopherVR) ([a8fc2be](https://github.com/ChristopherVR/pptx-viewer/commit/a8fc2bea2407f70bc3df4008be5c152d107cc3eb))
- **shared:** Render freeform fills via clip-path and correct flip/rotate order (by @ChristopherVR) ([7122f43](https://github.com/ChristopherVR/pptx-viewer/commit/7122f43c7ff9bae5bf0278d2753a6209bc1821af))

## [0.17.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.17.2) - 2026-07-19

### Bug Fixes

- **core:** Stop truncating interleaved custom-geometry paths ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([9bbac7d](https://github.com/ChristopherVR/pptx-viewer/commit/9bbac7d024fbad8ccd476f7e2a5d993ce1ad2b1b))

### Performance

- **core:** Cache layout/master XML during background resolution (by @ChristopherVR) ([9eea305](https://github.com/ChristopherVR/pptx-viewer/commit/9eea3057d62825f2c6355cf9891123a77df0c8fb))

## [0.17.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.17.1) - 2026-07-18

### Bug Fixes

- **core:** Load themed backgrounds and inherited placeholders ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([bed627b](https://github.com/ChristopherVR/pptx-viewer/commit/bed627bc4e2abb5c897e7e9b49fb27735f5e01a1))

## [0.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.17.0) - 2026-07-18

### Features

- **shared:** PowerPoint File > Options parity model (by @ChristopherVR) ([b1f041d](https://github.com/ChristopherVR/pptx-viewer/commit/b1f041d2396520e3d04c30172a4842f725c7c655))
- **vanilla:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([81ba347](https://github.com/ChristopherVR/pptx-viewer/commit/81ba34734ef9d3df45ebe8f1deb03ae0058700b0))

## [0.16.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.16.1) - 2026-07-18

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [0.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.16.0) - 2026-07-18

### Features

- **vanilla:** Export createRibbon for independent composition (by @ChristopherVR) ([521d494](https://github.com/ChristopherVR/pptx-viewer/commit/521d4943e2d457d87e5305c15090928212c58a3c))

## [0.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.15.0) - 2026-07-18

### Dependencies

- **deps:** Update dependencies to latest and migrate core/shared/locales to TypeScript 7 (by @ChristopherVR) ([cc72948](https://github.com/ChristopherVR/pptx-viewer/commit/cc729482cc5ae4ae56e1219f290c2953ec83c12a))

## [0.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.14.0) - 2026-07-18

### Bug Fixes

- **vanilla:** Ship jszip and fast-xml-parser as real dependencies (by @ChristopherVR) ([786186d](https://github.com/ChristopherVR/pptx-viewer/commit/786186db8a0cdc8acf2cb4988a25865388b7a5af))

## [0.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.13.0) - 2026-07-18

### Features

- **vanilla:** Ribbon and chrome parity with React (by @ChristopherVR) ([c385ee9](https://github.com/ChristopherVR/pptx-viewer/commit/c385ee9a83f6d2228767bb489b97bf57d404aef5))
- **vanilla:** Full React-parity Properties sections in the inspector (by @ChristopherVR) ([c8ef0c0](https://github.com/ChristopherVR/pptx-viewer/commit/c8ef0c021237a3a130e4c192ee07b19ee9500916))

### Bug Fixes

- **vanilla:** Stop the 24px tap-target floor from ballooning small controls (by @ChristopherVR) ([297e3cf](https://github.com/ChristopherVR/pptx-viewer/commit/297e3cfffd603165b3079b9444320369a11fb7b3))

## [0.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.12.0) - 2026-07-17

### Features

- **vanilla:** Persist theme/language switching and add a real Account page (by @ChristopherVR) ([c6959e0](https://github.com/ChristopherVR/pptx-viewer/commit/c6959e094a2d3ba044ecac6cced6076394ab40de))

### Other

- Integrate React theme/language switching and Account page (by @ChristopherVR) ([2fb0854](https://github.com/ChristopherVR/pptx-viewer/commit/2fb0854ed4f4505dbb22889aa6c4e5d3c2540094))
- Integrate Vanilla theme/language persistence and Account page (by @ChristopherVR) ([d86984f](https://github.com/ChristopherVR/pptx-viewer/commit/d86984fdd63c3305c3f3f4654b7be0d719514896))

## [0.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.11.0) - 2026-07-17

### Features

- **vanilla:** Add hiddenActions option to hide individual toolbar/ribbon actions (by @ChristopherVR) ([2c6af54](https://github.com/ChristopherVR/pptx-viewer/commit/2c6af54d21ed93fa6b8151d7c5812cf37a3a8885))

### Other

- Integrate release version bumps (by @ChristopherVR) ([4b3893f](https://github.com/ChristopherVR/pptx-viewer/commit/4b3893f4158803cc5533beb266ffdc8c776177cb))

## [0.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.10.0) - 2026-07-17

### Features

- **shared:** Add theme/locale catalogs, viewer prefs storage, and account model (by @ChristopherVR) ([9b9ad18](https://github.com/ChristopherVR/pptx-viewer/commit/9b9ad1888507dc879693f5d9b844ddcaabad909a))

### Bug Fixes

- **shared:** Add missing toolbar-actions module (by @ChristopherVR) ([21144f5](https://github.com/ChristopherVR/pptx-viewer/commit/21144f525fcd4aff77ec42dc98cdd599c98cddf9))

### Styling

- Fix oxfmt formatting drift blocking CI (by @ChristopherVR) ([4f26420](https://github.com/ChristopherVR/pptx-viewer/commit/4f26420ce8db8eae9176f315a6450d843054e2a6))

## [0.9.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.9.1) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [0.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.9.0) - 2026-07-17

### Features

- **file:** Use Lucide icons in Svelte and Vanilla (by @ChristopherVR) ([a956f1b](https://github.com/ChristopherVR/pptx-viewer/commit/a956f1ba7c05c949db517184cd0413cc0271b8dc))

## [0.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.8.0) - 2026-07-16

### Features

- **viewer:** Complete presenter parity and conformance (by @ChristopherVR) ([ac2be2f](https://github.com/ChristopherVR/pptx-viewer/commit/ac2be2fec909f07b3338b93091ca9f9f83e5051f))

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

## [0.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.7.0) - 2026-07-15

### Features

- **viewer:** Complete shared e2e parity (by @ChristopherVR) ([170bc74](https://github.com/ChristopherVR/pptx-viewer/commit/170bc74f21dc1c4c5a1d7c5583cf5c8656a312d3))

### Bug Fixes

- **viewer:** Align inspector and status chrome (by @ChristopherVR) ([0a4b38a](https://github.com/ChristopherVR/pptx-viewer/commit/0a4b38a851f42ec7dbc18b097904bfaa4e95a67c))
- **viewer:** Align responsive mobile chrome (by @ChristopherVR) ([547f98c](https://github.com/ChristopherVR/pptx-viewer/commit/547f98cb37705aff9c36a6098f7cb6986101992f))

### Testing

- **viewer:** Enforce framework-neutral e2e parity (by @ChristopherVR) ([7389c7e](https://github.com/ChristopherVR/pptx-viewer/commit/7389c7e7586e7ce926400a096945b7e51448f709))

## [0.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.6.0) - 2026-07-13

### Features

- **bindings:** Close svelte and vanilla parity gaps (by @ChristopherVR) ([9cb9d7e](https://github.com/ChristopherVR/pptx-viewer/commit/9cb9d7e53bf1dcda3b051b0ba5737e17115be4c4))

### Bug Fixes

- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Dependencies

- **deps:** Update html2canvas-pro to 2.2.3 (by @dependabot[bot]) ([0fe015b](https://github.com/ChristopherVR/pptx-viewer/commit/0fe015b83722534f14864b2054ce6561b09386ca))
- **deps:** Update fast-xml-parser to 5.10.0 (by @dependabot[bot]) ([6080273](https://github.com/ChristopherVR/pptx-viewer/commit/6080273f6a6f603d10d69a71d54faad1e6d9bf05))
- **deps:** Update dompurify to 3.4.12 (by @dependabot[bot]) ([00a6ca4](https://github.com/ChristopherVR/pptx-viewer/commit/00a6ca49609d5a0e922a9e20447460b11ec690ba))
- **deps:** Update minor and patch dependencies (by @dependabot[bot]) ([5cd81fb](https://github.com/ChristopherVR/pptx-viewer/commit/5cd81fb0c8708e53990ac4858660d0b6a4b17a7a))
- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## [0.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.5.1) - 2026-07-13

### Bug Fixes

- **core:** Open Office-encrypted pptx files (by @ChristopherVR) ([51aa670](https://github.com/ChristopherVR/pptx-viewer/commit/51aa670e8ca78d78323f55766b1a4c0e8b366c00))

## [0.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.5.0) - 2026-07-11

### Features

- **core:** Add canonical collaboration field-schema (by @ChristopherVR) ([cc78c1e](https://github.com/ChristopherVR/pptx-viewer/commit/cc78c1ed352fac3f69180ec2846d1df3e1dbd377))
- **vanilla:** Full collaboration presence + UI (Share/Broadcast/cursors) (by @ChristopherVR) ([5cc6c89](https://github.com/ChristopherVR/pptx-viewer/commit/5cc6c898c53aa6b4d8e111c9ad25e6b963e3a797))
- **shared:** Add the office colour swatch catalogue (by @ChristopherVR) ([41135a0](https://github.com/ChristopherVR/pptx-viewer/commit/41135a0f8687550cb17ded1451fa8f361fc975b1))
- **vanilla:** Add Draw ribbon tab shell with tool/colour/width controls (by @ChristopherVR) ([353191b](https://github.com/ChristopherVR/pptx-viewer/commit/353191b1f206bc06808e5d93b48f87ac032d9c2a))
- **vanilla:** Add history-integrated ink stroke commit/erase actions (by @ChristopherVR) ([29aaab5](https://github.com/ChristopherVR/pptx-viewer/commit/29aaab53d323ccfb9bb35c640ebfb7c5bb9793f9))
- **vanilla:** Wire pen/highlighter/eraser pointer gestures on the stage (by @ChristopherVR) ([360596a](https://github.com/ChristopherVR/pptx-viewer/commit/360596a34bc262db1893e424a20d2e5a34186c69))

### Bug Fixes

- **shared:** Close CRDT allowlist data-loss gaps, add binary asset map (by @ChristopherVR) ([60ad222](https://github.com/ChristopherVR/pptx-viewer/commit/60ad2226bc4f3450c2992362e9fcceaac77f2ccf))

## [0.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.4.0) - 2026-07-11

### Features

- **vanilla:** Insert media, chart, equation, smartart, action button, field (by @ChristopherVR) ([7e70a21](https://github.com/ChristopherVR/pptx-viewer/commit/7e70a21fbc489e915c83c13528ac492ba5bd83ff))
- **vanilla:** Add Design, Transitions, and Animations ribbon tabs (by @ChristopherVR) ([5c2058e](https://github.com/ChristopherVR/pptx-viewer/commit/5c2058ea6e5281c122019ff174fd2b98065d9cf0))
- **shared:** Add text wrap/autofit, image adjustments, and table inspector helpers (by @ChristopherVR) ([54b2eda](https://github.com/ChristopherVR/pptx-viewer/commit/54b2eda35254bc75257932568442396a5f343708))
- **vanilla:** Element-type-aware property inspector panels (by @ChristopherVR) ([5bd1fb4](https://github.com/ChristopherVR/pptx-viewer/commit/5bd1fb4837a17d7125e05e111328220ab0eb3659))

### Documentation

- **shared:** Add i18n keys for the vanilla Design tab theme gallery (by @ChristopherVR) ([593ea23](https://github.com/ChristopherVR/pptx-viewer/commit/593ea230e61f606056ffc013e2fdb82bea70738b))

## [0.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.3.0) - 2026-07-11

### Features

- **vanilla:** Add tabbed ribbon shell with File/Home/Insert/View tabs (by @ChristopherVR) ([43594c6](https://github.com/ChristopherVR/pptx-viewer/commit/43594c6b675a067748714a4b0ce3f30a2e57e909))
- **vanilla:** Wire Ctrl+C/X/V clipboard shortcuts into the editor keyboard (by @ChristopherVR) ([423b3e3](https://github.com/ChristopherVR/pptx-viewer/commit/423b3e32d7877ebc9d8a465f07b2af992ce65ca0))

### Bug Fixes

- **shared,react,vue,angular:** Make the Aa Change Case dropdown actually rewrite text (by @ChristopherVR) ([d84fd78](https://github.com/ChristopherVR/pptx-viewer/commit/d84fd788097253cf8b9281eca35af35caad20dce))

### Refactor

- **shared:** Extract clipboard, shape-preset, and text-format catalogs from react (by @ChristopherVR) ([b9d7cc9](https://github.com/ChristopherVR/pptx-viewer/commit/b9d7cc9b061b8c9dcaad91038136349c9360080d))
- **shared:** Dedupe change-case logic against text-case-transform (by @ChristopherVR) ([d007c07](https://github.com/ChristopherVR/pptx-viewer/commit/d007c070fb5bf8573bd8ac6dbeae160b46fc2dde))
- **vanilla:** Move ribbon primary/nav row CSS out of css.ts (by @ChristopherVR) ([477ddd8](https://github.com/ChristopherVR/pptx-viewer/commit/477ddd8c2c49d1754058914f4fb46d63afe8d728))

### Testing

- **vanilla:** Cover the ribbon tab registry, insert grid, and clipboard group (by @ChristopherVR) ([cee383f](https://github.com/ChristopherVR/pptx-viewer/commit/cee383fc4bc8c55832c2fb9a6ad56db24bf3cf7b))

## [0.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.2.0) - 2026-07-11

### Features

- **vanilla:** Collaboration and autosave (by @ChristopherVR) ([2c507e2](https://github.com/ChristopherVR/pptx-viewer/commit/2c507e2ea9297d2dd7f6b13131c99e2039947a8b))

## [0.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.1.3) - 2026-07-11

### Documentation

- **vanilla:** Restyle readme to match the established binding readmes (by @ChristopherVR) ([275dc2d](https://github.com/ChristopherVR/pptx-viewer/commit/275dc2df23b081d3a7f93f718ffd09f8cb61c85c))

## [0.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vanilla-viewer@0.1.2) - 2026-07-10

### Features

- **core:** Add signature-node module and shared signature utilities (by @ChristopherVR) ([e7cb263](https://github.com/ChristopherVR/pptx-viewer/commit/e7cb26335f15e633cfc37371f16a6ad210be5e11))
- **vue:** Add pptx-vue-viewer package + bundled pptx-viewer-shared (by @ChristopherVR) ([1b7a958](https://github.com/ChristopherVR/pptx-viewer/commit/1b7a958ce91792a6d174f174932800bc8ff40ef9))
- **shared:** Add Three.js SmartArt 3D model + scene runtime (by @ChristopherVR) ([f949213](https://github.com/ChristopherVR/pptx-viewer/commit/f949213b33ed0dca4c52d5d1ab414c3dba67efe7))
- **shared:** Add canonical i18n translation dictionary (by @ChristopherVR) ([429e386](https://github.com/ChristopherVR/pptx-viewer/commit/429e386c7245fc5cf526ac72481fd5ab23b3e09d))
- **core,cli:** Add react, angular, vue to npm keywords (by @ChristopherVR) ([528ec61](https://github.com/ChristopherVR/pptx-viewer/commit/528ec6182bb77c07444dd0e93560b65e604b9524))
- **vanilla:** Add pptx-vanilla-viewer zero-framework binding (viewer core) (by @ChristopherVR) ([e5374a6](https://github.com/ChristopherVR/pptx-viewer/commit/e5374a66522daf27606c7f0d3d93a50d9da43146))
- **vanilla,svelte:** Opt-in 3D SmartArt renderer (by @ChristopherVR) ([15337c9](https://github.com/ChristopherVR/pptx-viewer/commit/15337c9bc1a31ad614a4aca88be3e71ba848413f))
- **vanilla:** PNG and PDF export (by @ChristopherVR) ([a314688](https://github.com/ChristopherVR/pptx-viewer/commit/a3146882c706e6591b30176fbd06f62c001fd31f))

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
- Correct stale vanilla/svelte docs and add both bindings to core guide (by @ChristopherVR) ([6815740](https://github.com/ChristopherVR/pptx-viewer/commit/6815740f71f85d3876e548d177bb2e709f1b91d1))

### Build & CI

- Independent per-package versioning, tags, and changelogs (by @ChristopherVR) ([79595d9](https://github.com/ChristopherVR/pptx-viewer/commit/79595d972d7c4102e8b1e1e3926f439486f76ba1))
- Publish pptx-vanilla-viewer and pptx-svelte-viewer from the release pipeline (by @ChristopherVR) ([50dd90a](https://github.com/ChristopherVR/pptx-viewer/commit/50dd90aa3a7a707d9c56d3755098b431c37457b5))

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

All notable changes to `pptx-vanilla-viewer` are documented in this file.
