# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.

## 2026-07-04

_Releases: pptx-react-viewer@1.3.0, pptx-vue-viewer@1.3.0, pptx-angular-viewer@1.3.0, @christophervr/pptx-viewer@1.3.0_

## 2026-07-04

_Releases: pptx-react-viewer@1.2.0, pptx-vue-viewer@1.2.0, pptx-angular-viewer@1.2.0, @christophervr/pptx-viewer@1.2.0_

### Features

- **cli:** Enforce a single UI framework and harden terminal handling (by @ChristopherVR) ([d1c9ae5](https://github.com/ChristopherVR/pptx-viewer/commit/d1c9ae551070ec29bf474a76af21f3b0682fb36d))
- **shared:** Add i18n keys for ribbon, shortcuts panel, and text formatting (by @ChristopherVR) ([6e97c3b](https://github.com/ChristopherVR/pptx-viewer/commit/6e97c3bc158e43fda5faba9bc9a9d661d0a71994))
- **demos:** Add French/Spanish translations for ribbon and shortcuts panel (by @ChristopherVR) ([4c336be](https://github.com/ChristopherVR/pptx-viewer/commit/4c336be85e923338377e4ff7caa3be41e3dc58e7))
- **demos:** Show a build-stamp badge with version/commit/date (by @ChristopherVR) ([62d1cdf](https://github.com/ChristopherVR/pptx-viewer/commit/62d1cdf46619ba1319787a0a57060d1613906338))
- **demos:** Stamp each demo with version, commit, and build date (by @ChristopherVR) ([c62406a](https://github.com/ChristopherVR/pptx-viewer/commit/c62406a82923b0d0e070f832f819b95c5a2af147))

### Bug Fixes

- **demos:** Theme-aware picker colors and correct open-menu stacking (by @ChristopherVR) ([0a43091](https://github.com/ChristopherVR/pptx-viewer/commit/0a43091bcdf36a3d451f3ccdbcd560b5124473a0))
- **demos:** Show the build stamp only on the landing screen (by @ChristopherVR) ([40c2472](https://github.com/ChristopherVR/pptx-viewer/commit/40c24725b2061eefadaffcfb47b9a994e0be95a4))

### Refactor

- **react:** Route ribbon/toolbar/shortcut labels through i18n (by @ChristopherVR) ([36bef8c](https://github.com/ChristopherVR/pptx-viewer/commit/36bef8cabb772f58fcf8603e56bb2001e4d958be))
- **vue:** Route ribbon/toolbar/shortcut labels through i18n (by @ChristopherVR) ([7d391a4](https://github.com/ChristopherVR/pptx-viewer/commit/7d391a4c532ca82c389989756de9c0685fe19847))
- **angular:** Route shortcut labels through i18n (by @ChristopherVR) ([c39ea0e](https://github.com/ChristopherVR/pptx-viewer/commit/c39ea0eaa2c86fc5d34df1e52a4c91d2e3d5e07f))

### Documentation

- Fix stale package names, tool counts, and feature descriptions (by @ChristopherVR) ([e62dc7a](https://github.com/ChristopherVR/pptx-viewer/commit/e62dc7a2154a3069547913a9515ad2810b07a0bf))
- **site:** Add per-package release notes and deploy after releases (by @ChristopherVR) ([948f342](https://github.com/ChristopherVR/pptx-viewer/commit/948f34228aa35bb36f014cd67160b18cb8610c9c))
- **site:** Limitations-only limitations page, fix stale and wrong content (by @ChristopherVR) ([60d2a69](https://github.com/ChristopherVR/pptx-viewer/commit/60d2a69c86ca159d9880ea57f1634906a6f8e489))

### Build & CI

- **release:** Batch releases on a schedule with commit-driven semver bumps (by @ChristopherVR) ([c882105](https://github.com/ChristopherVR/pptx-viewer/commit/c8821058a7b70f4f77818fe569524b898015f5a3))
- Run package tests as a matrix job and cache bun downloads (by @ChristopherVR) ([0618228](https://github.com/ChristopherVR/pptx-viewer/commit/0618228d8ff8fe03af660723f7148f96276516f3))
- **release:** Derive semver bumps from commits and batch releases (by @ChristopherVR) ([90607eb](https://github.com/ChristopherVR/pptx-viewer/commit/90607eb0cea984dc8a4463614d3ac491637742cf))
- **prune:** Cull old git tags along with pruned releases (by @ChristopherVR) ([37c23d2](https://github.com/ChristopherVR/pptx-viewer/commit/37c23d206b51266fc9c3b83ec03ed57fe825e36f))
- Collapse test jobs into a matrix and slim CI artifacts (by @ChristopherVR) ([6235539](https://github.com/ChristopherVR/pptx-viewer/commit/62355398e26aa995f6911ca473c13d02a5e094ee))
- **release:** Run releases hourly; dispatch docs deploy only on real releases (by @ChristopherVR) ([326f525](https://github.com/ChristopherVR/pptx-viewer/commit/326f525ec43d1c6923d3fecb9675971e2b7bda7b))

## [1.1.80](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-react-viewer@1.1.80) - 2026-07-03

### Styling

- **react:** Fix pre-existing oxfmt formatting violation (by @ChristopherVR) ([8ef5da9](https://github.com/ChristopherVR/pptx-viewer/commit/8ef5da9dcb436307c3c6f1a0a81055fc8fe63eea))

## [1.1.91](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.91) - 2026-07-03

### Bug Fixes

- **vue:** Repair merge corruption in PowerPointViewer.vue, wire up Insert Equation (by @ChristopherVR) ([e3e780b](https://github.com/ChristopherVR/pptx-viewer/commit/e3e780b2a9a88fd9cc5c12c6d59826bfa9a94c1a))

## [1.1.90](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.90) - 2026-07-03

### Bug Fixes

- **react:** Enlarge SmartArt colour-swatch hit targets and clamp popover position (by @ChristopherVR) ([4a14788](https://github.com/ChristopherVR/pptx-viewer/commit/4a14788f32fa04349289f4d5a771ff0adbabee89))
- **vue:** Fix SmartArt colour-scoping, hover popover, and dead Insert SmartArt wiring (by @ChristopherVR) ([51167ce](https://github.com/ChristopherVR/pptx-viewer/commit/51167ce1ef5c994bd687101860460b1ee65c6063))
- **angular:** Fix SmartArt colour-scoping and hover popover unclickability (by @ChristopherVR) ([555c018](https://github.com/ChristopherVR/pptx-viewer/commit/555c018bca8f157e25af29facd23dbf93fb0dbb4))
- **vue:** Mount the version-history and compare panels (by @ChristopherVR) ([064ff67](https://github.com/ChristopherVR/pptx-viewer/commit/064ff672337dd3d261589c7d3a44acb727500622))

### Refactor

- **vue:** Extract format painter and inline editing into composables (by @ChristopherVR) ([119434a](https://github.com/ChristopherVR/pptx-viewer/commit/119434ac8a606b2f7aac878a34ac59bf901bdeee))
- **vue:** Extract ribbon UI state, ink drawing and theme editing (by @ChristopherVR) ([2ad1f66](https://github.com/ChristopherVR/pptx-viewer/commit/2ad1f66d1e277e50603db202b8158b4b8a633dcb))
- **vue:** Extract signature, custom-shows and version-history wiring (by @ChristopherVR) ([c8e7834](https://github.com/ChristopherVR/pptx-viewer/commit/c8e7834c7ce887275100282bd550647e84914a65))
- **vue:** Extract editor keyboard shortcuts into a composable (by @ChristopherVR) ([e75773a](https://github.com/ChristopherVR/pptx-viewer/commit/e75773aa3aa49c08d9fd26c124fc997dbdb87f2e))
- **vue:** Extract collaboration + broadcast session wiring (by @ChristopherVR) ([9690dae](https://github.com/ChristopherVR/pptx-viewer/commit/9690dae59c17f912fab766c74ccb6b15374cc574))
- **vue:** Extract mobile bottom-bar chrome into a composable (by @ChristopherVR) ([590e561](https://github.com/ChristopherVR/pptx-viewer/commit/590e561af9c72aa33c7615126c9cf0fff418609f))
- **vue:** Extract remaining small dialog/menu wiring composables (by @ChristopherVR) ([71e3b9e](https://github.com/ChristopherVR/pptx-viewer/commit/71e3b9e62463b4f7989e114dfb6b1687cd9616dc))
- **vue:** Extract the ribbon-props adapter into composables (by @ChristopherVR) ([da1a8fc](https://github.com/ChristopherVR/pptx-viewer/commit/da1a8fc7a399080d4cadd8779bcfd00fc203eb02))
- **vue:** Extract export/download wiring into a composable (by @ChristopherVR) ([adc699d](https://github.com/ChristopherVR/pptx-viewer/commit/adc699daef2377831e0cdb2019adbe053a7f2fc1))
- **vue:** Extract table-cell and SmartArt inline-edit provide contexts (by @ChristopherVR) ([3a0ea58](https://github.com/ChristopherVR/pptx-viewer/commit/3a0ea584bee65007943dd516559c69da2713020b))
- **vue:** Extract presentation-mode and comments wiring (by @ChristopherVR) ([db281d3](https://github.com/ChristopherVR/pptx-viewer/commit/db281d306b036f54765961937e9ca6799095603e))
- **angular:** Extract zoom state into ViewerZoomService (by @ChristopherVR) ([ce8dc19](https://github.com/ChristopherVR/pptx-viewer/commit/ce8dc19e4399e62f7dc6fe3421b0b6e89ef5be5c))
- **angular:** Extract touch-gesture wiring into ViewerTouchGesturesService (by @ChristopherVR) ([7b4596e](https://github.com/ChristopherVR/pptx-viewer/commit/7b4596e24b8286684b2b98471a76ca4823d9ad79))
- **angular:** Extract presentation-mode wiring into ViewerPresentationModeService (by @ChristopherVR) ([a8a6b04](https://github.com/ChristopherVR/pptx-viewer/commit/a8a6b040711af9d00cef83347c7c146c5f09671c))
- **angular:** Extract mobile-sheet state into ViewerMobileSheetService (by @ChristopherVR) ([89b9335](https://github.com/ChristopherVR/pptx-viewer/commit/89b9335ebf1aeb71445513e64291a1f33fa44253))
- **angular:** Extract inspector-panel state into ViewerInspectorPanelService (by @ChristopherVR) ([f7fb981](https://github.com/ChristopherVR/pptx-viewer/commit/f7fb981de02306e64823001b15fdfef6ec5e812d))
- **angular:** Extract file-IO state into ViewerFileIOService (by @ChristopherVR) ([bede18e](https://github.com/ChristopherVR/pptx-viewer/commit/bede18e4352ad61fb51d22366e15e7b0e031165b))
- **angular:** Extract theme-gallery logic into ViewerThemeGalleryService (by @ChristopherVR) ([0947357](https://github.com/ChristopherVR/pptx-viewer/commit/0947357e3ffcdaf2b14c170e53ee32eb893fc451))
- **angular:** Extract canvas-editing handlers into ViewerCanvasEditingService (by @ChristopherVR) ([6c86449](https://github.com/ChristopherVR/pptx-viewer/commit/6c86449fa5cfe7832ff70fae6d5a4d5b7dbbb57e))
- **angular:** Extract collab-cursor broadcast into ViewerCollabCursorService (by @ChristopherVR) ([c944081](https://github.com/ChristopherVR/pptx-viewer/commit/c944081344f6b7afaf16f6a43f5a7f2e5294490e))
- **angular:** Extract document-properties state into ViewerDocumentPropertiesService (by @ChristopherVR) ([b501038](https://github.com/ChristopherVR/pptx-viewer/commit/b5010381b97300555959ecb704d972b8e0ad2b56))
- **angular:** Extract ruler tick-mark generation into ruler-ticks.ts (by @ChristopherVR) ([7d8e134](https://github.com/ChristopherVR/pptx-viewer/commit/7d8e134dc3af5996e34038098180153ec565b7ff))
- **angular:** Extract auto-fit scale measurement into CanvasFitService (by @ChristopherVR) ([ff95bdb](https://github.com/ChristopherVR/pptx-viewer/commit/ff95bdb82ecebfff3865b81a54cd8c4d3511ccd8))
- **angular:** Extract pen/eraser drawing logic into InkDrawingService (by @ChristopherVR) ([e7aada8](https://github.com/ChristopherVR/pptx-viewer/commit/e7aada84c1f1123ed471c6e9abd172097d3fcf64))
- **angular:** Extract ruler-guide state into RulerGuidesService (by @ChristopherVR) ([81e2c4b](https://github.com/ChristopherVR/pptx-viewer/commit/81e2c4b6e14fafc1414369f7c6b879a370e4666e))
- **angular:** Extract selection/handle geometry into selection-geometry.ts (by @ChristopherVR) ([5615099](https://github.com/ChristopherVR/pptx-viewer/commit/5615099a978c353c04f5779d7ec2ac1a0b3bcc26))

## [1.1.89](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.89) - 2026-07-03

### Features

- **demos:** Real JWT auth + server-enforced viewer role in collab relay (by @ChristopherVR) ([af21048](https://github.com/ChristopherVR/pptx-viewer/commit/af210481458eeedc196a5bd397ee84ab779887af))

### Documentation

- Remove completed ROADMAP and PORTING trackers, scrub stale references (by @ChristopherVR) ([8a745a1](https://github.com/ChristopherVR/pptx-viewer/commit/8a745a1d2a1ee3932503d37dd022494ab9cfcc4b))

## [1.1.87](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.87) - 2026-07-03

### Features

- **demos:** Reference collab servers with token auth + persistence (by @ChristopherVR) ([22cf973](https://github.com/ChristopherVR/pptx-viewer/commit/22cf973f5955b852395c4ec79369313b66351c53))

### Bug Fixes

- **vue:** Correct mobile toolbar aria-label translation keys (by @ChristopherVR) ([62c67c0](https://github.com/ChristopherVR/pptx-viewer/commit/62c67c0b38df57febfd9bdc368d9d607e2ff901a))
- **vue:** Auto-hide presentation toolbar and unmount edit chrome while presenting (by @ChristopherVR) ([e05a941](https://github.com/ChristopherVR/pptx-viewer/commit/e05a941a02f218fe4c01251606b4d79bc6ece548))
- **vue:** Clip descendant overflow at the viewer root (by @ChristopherVR) ([081fc4b](https://github.com/ChristopherVR/pptx-viewer/commit/081fc4b3f0d68884d767e44f2b57fd852dba4fab))

### Testing

- **e2e:** Enable mobile chrome/selection-chrome specs for vue (by @ChristopherVR) ([d41fccc](https://github.com/ChristopherVR/pptx-viewer/commit/d41fccc4939149b8617cc6f6332defcfae175ca9))

## [1.1.86](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.86) - 2026-07-03

### Features

- **shared:** Character-level merge of concurrent text-run edits (by @ChristopherVR) ([dec527e](https://github.com/ChristopherVR/pptx-viewer/commit/dec527e871108a736d42137c499e76ae556a8e39))

### Bug Fixes

- **react:** Repoint/add missing document-properties, master, media-trim, and transition i18n keys (by @ChristopherVR) ([a933471](https://github.com/ChristopherVR/pptx-viewer/commit/a933471791cadcabce2c536603f96ce915eeb581))

### Documentation

- **roadmap:** Refresh statuses; C3 char-level text merge done (by @ChristopherVR) ([634ab6b](https://github.com/ChristopherVR/pptx-viewer/commit/634ab6b4f3c4a97513ded0b71a815e91ccc7cca2))
- **vue,angular:** Correct stale parity-tracker claims (by @ChristopherVR) ([54c4f05](https://github.com/ChristopherVR/pptx-viewer/commit/54c4f0540e33692d82f961c96d8a1818c8678751))

### Chores

- **shared,vue:** Remove dead TODO markers referencing removed chart code (by @ChristopherVR) ([6e20b26](https://github.com/ChristopherVR/pptx-viewer/commit/6e20b2630a94a8a2095a2c0b8d52c7172b001332))

## [1.1.85](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.85) - 2026-07-03

### Features

- **shared:** Add 141 i18n keys missing across Vue and Angular (by @ChristopherVR) ([ab9e9a0](https://github.com/ChristopherVR/pptx-viewer/commit/ab9e9a0756bc6d73c93442eb2be2475d073ad714))
- **shared:** Add 112 more i18n keys referenced indirectly via labelKey (by @ChristopherVR) ([108cd7c](https://github.com/ChristopherVR/pptx-viewer/commit/108cd7c3e8298cb7f21bcd1ac653726a8254ad6f))

### Bug Fixes

- **demo:** Define the missing isP2PConfig helper in the React demo (by @ChristopherVR) ([fc5ad63](https://github.com/ChristopherVR/pptx-viewer/commit/fc5ad63fc5aa48f69805f779eb6dc56763d08e34))
- **angular:** Repoint i18n calls to their correct dictionary keys (by @ChristopherVR) ([ac27068](https://github.com/ChristopherVR/pptx-viewer/commit/ac270684ef180f6b6a4c44242ca03f022c3121f2))
- **vue:** Repoint i18n calls to their correct dictionary keys (by @ChristopherVR) ([9978cf4](https://github.com/ChristopherVR/pptx-viewer/commit/9978cf4584af1c8b15c0d20b543e963e75c8ea62))
- **shared:** Dedupe 9 i18n keys added independently by a parallel session (by @ChristopherVR) ([77e80f6](https://github.com/ChristopherVR/pptx-viewer/commit/77e80f68fc595a58e2fa1261f5f3586fd3dee4ed))
- **vue:** Repoint document-properties fields to pptx.properties.\*, fix last stale test strings (by @ChristopherVR) ([4c78d1d](https://github.com/ChristopherVR/pptx-viewer/commit/4c78d1d2d5a560e1ef0c9b72eda4dd972dbb764e))

### Testing

- **vue:** Install a real vue-i18n instance globally for component tests (by @ChristopherVR) ([47edca1](https://github.com/ChristopherVR/pptx-viewer/commit/47edca1d9060ef30899970038510c278716fe23a))

## [1.1.84](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.84) - 2026-07-03

### Features

- **shared:** Gate the first collaborative doc write on provider sync (by @ChristopherVR) ([f68aa79](https://github.com/ChristopherVR/pptx-viewer/commit/f68aa79242e0cfdabc7a701d4b58bf124c483c02))

### Bug Fixes

- **angular:** Apply display:contents to 3 more multi-root components (by @ChristopherVR) ([d3641fd](https://github.com/ChristopherVR/pptx-viewer/commit/d3641fda45426cdeafb7058a98d6cfc8efa026c7))

### Testing

- **vue:** Fix stale string expectations that match the real dictionary (by @ChristopherVR) ([8029646](https://github.com/ChristopherVR/pptx-viewer/commit/802964666ebaf0723626f242b1622fb52cc4ba29))

## [1.1.83](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.83) - 2026-07-03

### Features

- **shared:** Granular CRDT reconciliation and serverless collab transport (by @ChristopherVR) ([acf5087](https://github.com/ChristopherVR/pptx-viewer/commit/acf5087737f26da507f4237d490927c6d22bbb5b))
- **react:** P2P webrtc transport, granular sync, write-back, follow mode (by @ChristopherVR) ([fdbad55](https://github.com/ChristopherVR/pptx-viewer/commit/fdbad55843b76e335ac7f2d545947e8c1b252e84))
- **vue:** Interoperable presence schema, webrtc transport, granular sync (by @ChristopherVR) ([9b53df5](https://github.com/ChristopherVR/pptx-viewer/commit/9b53df5e9487c5fbb16e78f40f5e746752eb4574))
- **angular:** Wire collaboration end-to-end (by @ChristopherVR) ([0498cea](https://github.com/ChristopherVR/pptx-viewer/commit/0498cea40ac10e08069f560be0a1cea6f92a8721))
- **angular:** Rewire collaboration onto the split viewer services (by @ChristopherVR) ([22b2544](https://github.com/ChristopherVR/pptx-viewer/commit/22b2544ed9823f0c7e27ed02728b841bf1f4cc8d))

### Documentation

- **tools:** Note the codec schema diverges from the viewer sync layout (by @ChristopherVR) ([7ba5d9e](https://github.com/ChristopherVR/pptx-viewer/commit/7ba5d9ef76e95cb255f591b1483fcdab9fc824b9))
- Document serverless P2P collaboration and refresh the roadmap (by @ChristopherVR) ([2332cf1](https://github.com/ChristopherVR/pptx-viewer/commit/2332cf14b7f98ed641c3c4b367fdbb122e29c8d2))

### Dependencies

- **deps:** Declare yjs, y-websocket, and y-webrtc across bindings (by @ChristopherVR) ([27a2849](https://github.com/ChristopherVR/pptx-viewer/commit/27a2849da755a0902296dcd59557c1329a1cbadf))

## [1.1.82](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.82) - 2026-07-03

### Testing

- **e2e:** Add cross-framework ribbon-tab layout parity check (by @ChristopherVR) ([8116ce3](https://github.com/ChristopherVR/pptx-viewer/commit/8116ce3bcfa0ba041c8a69507b5e192150a9dcc3))

## [1.1.58](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.58) - 2026-07-03

### Bug Fixes

- **angular:** Stop Insert tab's Action/Field controls wrapping to a new row (by @ChristopherVR) ([300c4d8](https://github.com/ChristopherVR/pptx-viewer/commit/300c4d8dd1f914d6899867d9e6a9c8ff5b627b45))
- **angular:** Stop Home tab's Font group wrapping to 3 rows, fix Paragraph too (by @ChristopherVR) ([e404d5b](https://github.com/ChristopherVR/pptx-viewer/commit/e404d5b4b957d1e48fad03a8924061911e7a76a3))

## [1.1.81](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.81) - 2026-07-03

### Features

- Document localization and add demo language pickers (by @ChristopherVR) ([a07ad82](https://github.com/ChristopherVR/pptx-viewer/commit/a07ad8279e906590e0392d19cd1637855012a80e))
- **angular:** Render pressure-sensitive ink strokes (by @ChristopherVR) ([64f47fc](https://github.com/ChristopherVR/pptx-viewer/commit/64f47fc4b736a07a9438c19b302ad835be731129))
- **vue,shared:** Render connector shadow and glow effects (by @ChristopherVR) ([1a5f32a](https://github.com/ChristopherVR/pptx-viewer/commit/1a5f32ad67e2190e2369c805aea00c3fdf71da79))
- **angular,shared:** Render compound connector lines and line caps (by @ChristopherVR) ([60592e7](https://github.com/ChristopherVR/pptx-viewer/commit/60592e77eae6d1b44f89a642192b9e3dd3fb1e15))
- **angular:** Play audio/video media elements instead of poster-only (by @ChristopherVR) ([82d3288](https://github.com/ChristopherVR/pptx-viewer/commit/82d32885b0b3ebcb1783f0f3e75752f0991aeca1))
- **vue,shared,react:** Render pressure-sensitive ink strokes (by @ChristopherVR) ([6d07dfd](https://github.com/ChristopherVR/pptx-viewer/commit/6d07dfdeac15000540f77cc72397c3f221cc4368))

### Bug Fixes

- **vue:** Stop vue-i18n crashing on the shared dictionary, close notes panel by default (by @ChristopherVR) ([80c4209](https://github.com/ChristopherVR/pptx-viewer/commit/80c420913b0ce126ab207dd6bc6791b9104eecf0))
- **angular:** Stop ribbon groups stacking vertically after the section split (by @ChristopherVR) ([9ae8bf3](https://github.com/ChristopherVR/pptx-viewer/commit/9ae8bf387c996b341e16e2ddc0e5791b67b5dd34))

### Refactor

- **angular:** Split ribbon.component.ts into per-tab section components (by @ChristopherVR) ([b07f27d](https://github.com/ChristopherVR/pptx-viewer/commit/b07f27ddecafe5b07f448b88bcc1ae22987cfaa4))
- **angular:** Split power-point-viewer.component.ts into services (by @ChristopherVR) ([ed99083](https://github.com/ChristopherVR/pptx-viewer/commit/ed9908353763e6dd9512ddaa91fbe2ddf871d9e6))
- **vue:** Split PowerPointViewer.vue into composables (by @ChristopherVR) ([886851d](https://github.com/ChristopherVR/pptx-viewer/commit/886851d2eebb4f4d237ddeb8dc3a0cc6da05174b))

### Documentation

- **vue:** Correct stale parity-gap claims in PORTING.md (by @ChristopherVR) ([1ce524c](https://github.com/ChristopherVR/pptx-viewer/commit/1ce524cf5af80064b0d8268610e40c900ea43204))
- **angular:** Correct stale parity-gap claims in PORTING.md (by @ChristopherVR) ([55bca21](https://github.com/ChristopherVR/pptx-viewer/commit/55bca2108e6f0e498c7daff3660d1d9bb7f423dd))
- Soften Vue/Angular parity claim to list real remaining gaps (by @ChristopherVR) ([f460dd1](https://github.com/ChristopherVR/pptx-viewer/commit/f460dd1c49b161b339fb612bfced4890b4542eeb))
- Close out fixed parity gaps, drop the limitations caveat (by @ChristopherVR) ([53ae1f8](https://github.com/ChristopherVR/pptx-viewer/commit/53ae1f8460c47b1aa313020d2231edee91809fb0))
- Remove the Vue/Angular parity limitation entirely (by @ChristopherVR) ([7825bfb](https://github.com/ChristopherVR/pptx-viewer/commit/7825bfb2ac55be3e8eeef894595672eaa891c400))

## [1.1.72](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-react-viewer@1.1.72) - 2026-07-03

### Features

- **cli:** Arrow-key colour prompts and PowerPoint-ready scaffolds (by @ChristopherVR) ([8de03c9](https://github.com/ChristopherVR/pptx-viewer/commit/8de03c9da8c8d20e28cca253ff6d7083de65a0d8))

### Bug Fixes

- **react:** Translate SmartArt preset gallery labels (by @ChristopherVR) ([d67344d](https://github.com/ChristopherVR/pptx-viewer/commit/d67344d717b303271b92b8c5ac832001e96818aa))
- **angular:** Stop demo prod build crashing on open (by @ChristopherVR) ([7d3f491](https://github.com/ChristopherVR/pptx-viewer/commit/7d3f491061a92b40c7add2a2044cb735bd29ee05))

## [1.1.80](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.80) - 2026-07-02

### Features

- **shared:** Add canonical i18n translation dictionary (by @ChristopherVR) ([429e386](https://github.com/ChristopherVR/pptx-viewer/commit/429e386c7245fc5cf526ac72481fd5ab23b3e09d))
- **angular:** Wire ngx-translate, convert hardcoded UI strings to translation keys (by @ChristopherVR) ([33bc42e](https://github.com/ChristopherVR/pptx-viewer/commit/33bc42e0f221a8c8644f1cc80cc314971abc9791))
- **shared:** Backfill i18n dictionary with keys React already calls (by @ChristopherVR) ([5e4760a](https://github.com/ChristopherVR/pptx-viewer/commit/5e4760a957056c366c01b7687e764599bf6f9bae))
- **vue:** Finish remaining i18n sweep batches (by @ChristopherVR) ([d49a6b7](https://github.com/ChristopherVR/pptx-viewer/commit/d49a6b7ca0355ba2df4738dbf23ee0ca3dac991c))
- **angular:** Finish remaining i18n sweep batches (by @ChristopherVR) ([f48779a](https://github.com/ChristopherVR/pptx-viewer/commit/f48779afaf53280f1436310d153f2501667cdb34))
- **shared:** Merge newly-minted Vue/Angular i18n keys into dictionary (by @ChristopherVR) ([e16874f](https://github.com/ChristopherVR/pptx-viewer/commit/e16874f99267ea3e7f30bd9a519be9c32b3080cd))
- **angular:** Convert power-point-viewer root component to i18n (by @ChristopherVR) ([1a254d2](https://github.com/ChristopherVR/pptx-viewer/commit/1a254d2efde1e06a2cdb7befc4522f57af134239))
- **shared:** Merge Angular ribbon/mobile/notes/share i18n keys (by @ChristopherVR) ([c06259a](https://github.com/ChristopherVR/pptx-viewer/commit/c06259a74857c7418117a4b08e2969df3cb028dc))
- **shared:** Add labelKey to chart option catalogues, backfill dictionary (by @ChristopherVR) ([e9f02aa](https://github.com/ChristopherVR/pptx-viewer/commit/e9f02aa82b7e9a5951af830f26fa011fae3efeb7))
- **shared,vue:** Wire chart/SmartArt option labelKeys, add SmartArt i18n keys (by @ChristopherVR) ([f8f0e25](https://github.com/ChristopherVR/pptx-viewer/commit/f8f0e2551cb05b9f702bfd8c9c46f155d4afe080))
- **angular:** Wire chart/SmartArt option labelKeys (by @ChristopherVR) ([4d47fdb](https://github.com/ChristopherVR/pptx-viewer/commit/4d47fdba8e4b4f877cdc73b5430c3b70f1e19c27))
- **angular,shared:** I18n the animation-authoring option catalogs (by @ChristopherVR) ([b7464b9](https://github.com/ChristopherVR/pptx-viewer/commit/b7464b904e98e1cce224bfd18a93506eb97537e8))

### Bug Fixes

- **react:** Expose i18n dictionary via pptx-react-viewer, not the private shared package (by @ChristopherVR) ([09f49fe](https://github.com/ChristopherVR/pptx-viewer/commit/09f49fe68aa27d3305294f5896d5f53d3b52a160))
- **vue:** Expose i18n dictionary via pptx-vue-viewer, not the private shared package (by @ChristopherVR) ([8577907](https://github.com/ChristopherVR/pptx-viewer/commit/8577907cf63af3190853b31e7810f477f394fad2))
- **core:** Stop SmartArt edits from corrupting the saved pptx (by @ChristopherVR) ([507fe33](https://github.com/ChristopherVR/pptx-viewer/commit/507fe33d94af69ac657d6326cbe5a3cd089cedd0))

### Refactor

- **react:** Consume shared i18n dictionary in demo (by @ChristopherVR) ([35baf9e](https://github.com/ChristopherVR/pptx-viewer/commit/35baf9e05cdea56f4fa51b435406e075945625c2))

## [1.1.79](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.79) - 2026-07-02

### Bug Fixes

- **core:** Clear stale drawing shapes when switching smartart layout (by @ChristopherVR) ([c62959f](https://github.com/ChristopherVR/pptx-viewer/commit/c62959fab17e6cddea4ddb379f1add580aae1fd0))
- **react:** Keep smartart style-bar popover open on hover, align text editor (by @ChristopherVR) ([e615f4f](https://github.com/ChristopherVR/pptx-viewer/commit/e615f4f944a5ad22a47ddd058ea8f6f23998211b))
- **react:** Propagate drawing-shape clear and add missing smartart thumbnails (by @ChristopherVR) ([cffde54](https://github.com/ChristopherVR/pptx-viewer/commit/cffde54ae1c4c30b1bb2d95127379db4007a44d6))
- **vue:** Propagate cleared drawing shapes when switching smartart layout (by @ChristopherVR) ([9c18b08](https://github.com/ChristopherVR/pptx-viewer/commit/9c18b08844736865494f602d44f9b089a004aa4f))

## [1.1.78](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.78) - 2026-07-02

### Features

- **react:** Wire inline Ctrl/Cmd+B/I/U formatting shortcuts (by @ChristopherVR) ([09aac24](https://github.com/ChristopherVR/pptx-viewer/commit/09aac24d130a9cfccfc343461471041db549dc4f))
- **vue:** Inline Ctrl/Cmd+B/I/U formatting shortcuts (by @ChristopherVR) ([7b83ced](https://github.com/ChristopherVR/pptx-viewer/commit/7b83cedd042225072b6837f1198d9f9599b9d314))
- **angular:** Inline Ctrl/Cmd+B/I/U formatting shortcuts (by @ChristopherVR) ([f633ad5](https://github.com/ChristopherVR/pptx-viewer/commit/f633ad568cc3dafbea2bf13187f59d1260dc50bf))

### Bug Fixes

- Build issue (by @ChristopherVR) ([08a0d2c](https://github.com/ChristopherVR/pptx-viewer/commit/08a0d2cf3f9bcc2193aaa5fc451e8286b0330b71))

### Documentation

- Refresh parity and limitations pages (by @ChristopherVR) ([6659359](https://github.com/ChristopherVR/pptx-viewer/commit/6659359cf19df130cea8bd30d224b2fa2f5c598b))

### Dependencies

- **deps:** Resync bun.lock with the reverted xmldom@0.8.x pin (by @ChristopherVR) ([aa5013e](https://github.com/ChristopherVR/pptx-viewer/commit/aa5013e86bb2326d86c5f0c943e2ba4161068b32))

## [1.1.77](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.77) - 2026-07-02

### Bug Fixes

- **core:** Namespace layout/master element ids by owning part (by @ChristopherVR) ([baa499c](https://github.com/ChristopherVR/pptx-viewer/commit/baa499c8ae82ed89db3a1743f78704b862597380))

## [1.1.76](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.76) - 2026-07-02

### Features

- **shared:** Moved additional table rendering logic into the shared package (by @ChristopherVR) ([5a24ab0](https://github.com/ChristopherVR/pptx-viewer/commit/5a24ab02f60addf7019e8d93a02285caa18a99fb))
- **shared:** Image artistic-effect preset catalogue (by @ChristopherVR) ([4d3dc81](https://github.com/ChristopherVR/pptx-viewer/commit/4d3dc81191d5cd4d55a97cece42e1c744774b01e))
- **vue:** Media, chart-data, image, and text-effects inspector parity (by @ChristopherVR) ([ecfa548](https://github.com/ChristopherVR/pptx-viewer/commit/ecfa54882d1ff50d6b7349cbffb3a0e7c48f94bd))
- **vue:** Dialog, panel, and canvas-overlay parity (by @ChristopherVR) ([89aef1e](https://github.com/ChristopherVR/pptx-viewer/commit/89aef1e1c81e087fd841026f65e5db6daa7452d8))
- **vue:** Table editing parity (by @ChristopherVR) ([b4a0082](https://github.com/ChristopherVR/pptx-viewer/commit/b4a00825e83ffb10a8491a66b28fd2475057e891))
- **angular:** Secondary dialog and panel suite (by @ChristopherVR) ([aeb9083](https://github.com/ChristopherVR/pptx-viewer/commit/aeb90839707c051c97856eaa800ae0fe38f62314))
- **angular:** Table editing parity (by @ChristopherVR) ([d9cfda4](https://github.com/ChristopherVR/pptx-viewer/commit/d9cfda4cef9707ad629b22423555b4b2b5b88341))
- **cli:** Add interactive @christophervr/pptx-viewer installer (by @ChristopherVR) ([4df680d](https://github.com/ChristopherVR/pptx-viewer/commit/4df680d9791d18e38c0f413420e8e1e5f9f2907e))

### Bug Fixes

- **core,react:** Correct test regressions from bad find-replace and stale factory expectations (by @ChristopherVR) ([661505b](https://github.com/ChristopherVR/pptx-viewer/commit/661505b4ff5b90991df3b0f8fe2a85664e8ce5a0))
- **shared:** Emit --color-_ and --radius-_ tokens directly from themeToCssVars (by @adamschoenemann) ([519fae5](https://github.com/ChristopherVR/pptx-viewer/commit/519fae5b1ab65f2c0d5b6b5b7fc7703038f8e645))
- Format issues (by @ChristopherVR) ([bbf874d](https://github.com/ChristopherVR/pptx-viewer/commit/bbf874dda638932d6a435b28238cd822176d1cd6))
- **core:** Xmldom 0.9 type compatibility in signature-node (by @ChristopherVR) ([ad514e8](https://github.com/ChristopherVR/pptx-viewer/commit/ad514e83c70b9de1c143918f96317c250ecccff3))
- **react:** Wire inline SmartArt editing through the canvas render chain (by @ChristopherVR) ([c2a953d](https://github.com/ChristopherVR/pptx-viewer/commit/c2a953d8629b78f6d7878097e71f7ab09a3349d7))
- **core:** Correct install docs and drop the retired @christophervr/pptx-viewer alias (by @ChristopherVR) ([6544b4e](https://github.com/ChristopherVR/pptx-viewer/commit/6544b4eaf086945ecd8a18b877de5a483032aa14))
- **core,angular:** Revert xmldom to 0.8.x and fix shared import specifiers (by @ChristopherVR) ([29eda31](https://github.com/ChristopherVR/pptx-viewer/commit/29eda3119836559b63bc08733dd9dd6398a69c8d))

### Refactor

- **react:** Consume shared table and style-preset modules (by @ChristopherVR) ([6d3b437](https://github.com/ChristopherVR/pptx-viewer/commit/6d3b4377f0f2873ecc786464f510dcf3a75453e2))

## [1.1.75](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.75) - 2026-06-27

### Features

- **angular:** Collaboration host API, audience exports, ribbon + theme parity (by @ChristopherVR) ([961ac76](https://github.com/ChristopherVR/pptx-viewer/commit/961ac76f7a20f0290af65a731054f43551c3357a))
- **vue:** Theme gallery 10-theme parity and audience exports (by @ChristopherVR) ([a3eec9c](https://github.com/ChristopherVR/pptx-viewer/commit/a3eec9ce79aa632d2f1464fe2d2854eceb728849))
- **demo-vue:** React-parity floating theme picker and collaboration wiring (by @ChristopherVR) ([ce64625](https://github.com/ChristopherVR/pptx-viewer/commit/ce64625370ae9a6d7e5928e260f7d709a87b32b8))
- **demo-angular:** React-parity floating theme picker and collaboration wiring (by @ChristopherVR) ([3ee607f](https://github.com/ChristopherVR/pptx-viewer/commit/3ee607f34030c6ba318011ee33a8b1547e21ef0d))

### Bug Fixes

- **angular:** Break ChartDataEditorComponent circular-init crash (by @ChristopherVR) ([502d301](https://github.com/ChristopherVR/pptx-viewer/commit/502d3017625edbf647d6fa2b0d74088f5d6969f5))
- Added additional I parity to angular and vue (by @ChristopherVR) ([ab5cba3](https://github.com/ChristopherVR/pptx-viewer/commit/ab5cba3cd85d9fbe5220c3867e63240240c66dce))

## [1.1.73](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.73) - 2026-06-27

### Features

- **vue:** Zoom renderer, 3D extrusion overlay, duotone filter, and element style improvements (by @ChristopherVR) ([85b9443](https://github.com/ChristopherVR/pptx-viewer/commit/85b9443985a024d7b564dd3609857b85c4aedd37))
- **angular:** Zoom renderer, eyedropper, zoom-target service, and SmartArt refinements (by @ChristopherVR) ([adf754d](https://github.com/ChristopherVR/pptx-viewer/commit/adf754d2f2f088ab069920760a0e90629051612b))

### Styling

- **react,vue:** Lint and formatting fixes (by @ChristopherVR) ([6b39687](https://github.com/ChristopherVR/pptx-viewer/commit/6b396877f404a7af0259e43356e51d82413a76b0))

## [1.1.72](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.72) - 2026-06-26

### Features

- **core:** Add setElementLocked SDK helper (by @ChristopherVR) ([cc82e06](https://github.com/ChristopherVR/pptx-viewer/commit/cc82e06128c7b6d6aa976cc73a2674b35fc500fd))
- **react:** Add distribute buttons and element lock toggle (by @ChristopherVR) ([2981850](https://github.com/ChristopherVR/pptx-viewer/commit/29818502045b27f0eaf389664c1309a6caa751b0))
- **vue:** Add distribute buttons and element lock toggle (by @ChristopherVR) ([36bbd72](https://github.com/ChristopherVR/pptx-viewer/commit/36bbd72ca12449cfd6f7a0f614a8bca39e40a0ed))
- **angular:** Add distribute buttons and element lock toggle (by @ChristopherVR) ([2607f7e](https://github.com/ChristopherVR/pptx-viewer/commit/2607f7eddc814eebdaf3459caf81f4d1ac8f2ad5))

### Bug Fixes

- Missing document links (by @ChristopherVR) ([f52bd6f](https://github.com/ChristopherVR/pptx-viewer/commit/f52bd6fd2fc4f564f018ecf5e84e64d24c8fd240))
- **vue:** Thread distribute props through MobileMenuSheet to ArrangeSection (by @ChristopherVR) ([bf67c47](https://github.com/ChristopherVR/pptx-viewer/commit/bf67c47d48c106fff22f5134b57508c95e2429d5))

## [1.1.71](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.71) - 2026-06-26

### Features

- **react:** Add per-point marker and label override UI to chart inspector (by @ChristopherVR) ([3579209](https://github.com/ChristopherVR/pptx-viewer/commit/3579209e2dfe2af1a78e5fe32945c973d1c48a45))

### Documentation

- Update chart, morph, and animation limitation bullets (by @ChristopherVR) ([da34dd4](https://github.com/ChristopherVR/pptx-viewer/commit/da34dd42ac71b00392558f095835db8a2da7e120))

### Testing

- **e2e:** Toolbar breakpoint switching and inspector responsiveness specs (by @ChristopherVR) ([be2e6c9](https://github.com/ChristopherVR/pptx-viewer/commit/be2e6c93d8200760ff6ddc11c0ebf5f46e1aa3bb))

## [1.1.70](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.70) - 2026-06-26

### Features

- **vue:** Route to MobileToolbar on narrow viewports for mobile support (by @ChristopherVR) ([a406dd6](https://github.com/ChristopherVR/pptx-viewer/commit/a406dd634a6a143819649aa884c5e8606a8c383d))

### Bug Fixes

- **vue:** Route template element keyboard nudge through template store (by @ChristopherVR) ([c364fa1](https://github.com/ChristopherVR/pptx-viewer/commit/c364fa1dc71a8e52a1a250e153aab2c5c66127d2))

### Documentation

- Remove resolved mobile support and Vue/Angular parity limitations (by @ChristopherVR) ([2029f8a](https://github.com/ChristopherVR/pptx-viewer/commit/2029f8a9247d4e6e6f7c3ec3986d8006a3543046))

### Testing

- **angular:** Confirm editTemplateMode interactivity is fully wired (by @ChristopherVR) ([fa1e586](https://github.com/ChristopherVR/pptx-viewer/commit/fa1e58632d8fac8603a273cfb49dec53c20a6cb7))

## [1.1.68](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.68) - 2026-06-26

### Features

- **react:** Wire editTemplateMode partition, render layer, and save merge for master/layout editing (by @ChristopherVR) ([c683ab1](https://github.com/ChristopherVR/pptx-viewer/commit/c683ab1ceb0a6942b4bdda87dda7104f2436e1e8))

### Documentation

- Update limitations section for live reflow engine and toolbar parity (by @ChristopherVR) ([7c77cd1](https://github.com/ChristopherVR/pptx-viewer/commit/7c77cd109b870b4abffbd7f9e2423b78ef72d8ee))

### Styling

- **vue:** Align EditorToolbar button sizing, separators, and active states with React (by @ChristopherVR) ([9fcd0d1](https://github.com/ChristopherVR/pptx-viewer/commit/9fcd0d131fcf095e79784d563fd8e38e4a08fd89))
- **angular:** Align editor-toolbar button sizing, separators, and active states with React (by @ChristopherVR) ([aacc9df](https://github.com/ChristopherVR/pptx-viewer/commit/aacc9dffa9ce24cc901bc909c31238a662957e54))

## [1.1.67](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.67) - 2026-06-26

### Features

- **vue:** Add per-node fill colour picker to SmartArt inline editing layer (by @ChristopherVR) ([255cea6](https://github.com/ChristopherVR/pptx-viewer/commit/255cea68667689514a4dfec7309a0303b5bd151e))
- **angular:** Add per-node fill colour picker to SmartArt inline editing layer (by @ChristopherVR) ([28c6592](https://github.com/ChristopherVR/pptx-viewer/commit/28c6592f07b977bb3756ef7dba8a56efb23670c5))
- **shared:** Add reflowToDrawingShapes utility to convert layout result to drawing shapes (by @ChristopherVR) ([f8a2d9b](https://github.com/ChristopherVR/pptx-viewer/commit/f8a2d9bbb097edc9d010bbf9659cc1fa01c14ec0))
- **react:** Rebuild drawing shapes after structural SmartArt edits for live reflow (by @ChristopherVR) ([c88257c](https://github.com/ChristopherVR/pptx-viewer/commit/c88257c16d58f5c11dbec7f75950611695838e72))

### Documentation

- Update limitations section to reflect SmartArt editing and Vue/Angular parity improvements (by @ChristopherVR) ([22a2115](https://github.com/ChristopherVR/pptx-viewer/commit/22a2115b2496269dade50221f06be0b15d0dad3f))

## [1.1.66](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.66) - 2026-06-26

### Features

- **vue:** Add inline node text editing to SmartArt 3D renderer via SVG hit-test overlay (by @ChristopherVR) ([8e09f6f](https://github.com/ChristopherVR/pptx-viewer/commit/8e09f6f3840ff3dd1400ae2207f860f1af4dd592))
- **angular:** Add inline node text editing to SmartArt 3D renderer via SVG hit-test overlay (by @ChristopherVR) ([1651933](https://github.com/ChristopherVR/pptx-viewer/commit/16519338b90b0e0c0ffc955de6b1dfc2f7632491))

## [1.1.63](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.63) - 2026-06-26

### Features

- **vue:** Add hover outline ring to SmartArt editable nodes (by @ChristopherVR) ([0670588](https://github.com/ChristopherVR/pptx-viewer/commit/0670588214a297fe73d9197f440acc0606bff576))
- **angular:** Add hover outline ring to SmartArt editable nodes (by @ChristopherVR) ([06acf00](https://github.com/ChristopherVR/pptx-viewer/commit/06acf0073f57f9da5c38569dc0c4f1412187074d))
- **vue:** Support multi-line \n text in SmartArt SVG node renderers via tspan (by @ChristopherVR) ([944f671](https://github.com/ChristopherVR/pptx-viewer/commit/944f671b8e90be1cc1fc06bb69997d8a7e66e56a))
- **angular:** Support multi-line \n text in SmartArt SVG node renderers via tspan (by @ChristopherVR) ([98a2f9d](https://github.com/ChristopherVR/pptx-viewer/commit/98a2f9d6b186d5f1deea3f82ffacf4817ab93195))

## [1.1.62](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.62) - 2026-06-26

### Bug Fixes

- **vue:** Stop event bubbling from SmartArt inline editor textarea (by @ChristopherVR) ([d32a2a4](https://github.com/ChristopherVR/pptx-viewer/commit/d32a2a451385e0d6b5bcba7e2c834a99fe68f7d3))
- **angular:** Guard SmartArt inline editor against cancel-triggered blur commit (by @ChristopherVR) ([a06242f](https://github.com/ChristopherVR/pptx-viewer/commit/a06242f58f68d3f63b6dfcbdcde6fc4907966762))

## [1.1.58](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-react-viewer@1.1.58) - 2026-06-26

### Features

- **react:** Support multi-line text in timeline SmartArt renderer with axis-anchored tspan layout (by @ChristopherVR) ([55212fc](https://github.com/ChristopherVR/pptx-viewer/commit/55212fc427ce838264ddab54c09d3cf57a6a934e))
- **react:** Add per-node fill colour picker to SmartArt inline editing layer (by @ChristopherVR) ([9bc9779](https://github.com/ChristopherVR/pptx-viewer/commit/9bc9779083416ad0b4f3f07f083ab93305ff7c80))

## [1.1.57](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-react-viewer@1.1.57) - 2026-06-26

### Features

- **react:** Support multi-line text in SVG SmartArt node renderers via tspan splitting (by @ChristopherVR) ([1be63d8](https://github.com/ChristopherVR/pptx-viewer/commit/1be63d8ec9a9c440bedeb783d34c76e9bcdc3c0a))

## [1.1.61](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.61) - 2026-06-26

### Features

- **react:** Add hover cursor and node highlight to SmartArt inline editor (by @ChristopherVR) ([c8c8ef4](https://github.com/ChristopherVR/pptx-viewer/commit/c8c8ef4f1469bb5c02b0cfb257f0c5995314ffb7))
- **react:** Support multi-line text in SVG SmartArt node renderers via tspan splitting (by @ChristopherVR) ([af0d91f](https://github.com/ChristopherVR/pptx-viewer/commit/af0d91f1d12519a6f97dd858d4e42f37f97e12f7))
- **react:** Add inline node text editing to 3D SmartArt renderer via SVG hit-test overlay (by @ChristopherVR) ([4a94964](https://github.com/ChristopherVR/pptx-viewer/commit/4a949640ec9df755bf540b196a6307325ac3d1c6))
- **react:** Support multi-line text in timeline SmartArt renderer with axis-anchored tspan layout (by @ChristopherVR) ([cd0116b](https://github.com/ChristopherVR/pptx-viewer/commit/cd0116bfc4025d39ad083728e5fa4c185fe6eb0d))
- **react:** Add per-node fill colour picker to SmartArt inline editing layer (by @ChristopherVR) ([dae323f](https://github.com/ChristopherVR/pptx-viewer/commit/dae323f40ac0cc8158e291a41b52c3393e13287e))
- **react:** Add hover cursor and node highlight to SmartArt inline editor (by @ChristopherVR) ([4ea588f](https://github.com/ChristopherVR/pptx-viewer/commit/4ea588fcc4b49b6d2756af6ea27deeec6535a304))

### Bug Fixes

- **react:** Wire password protection through to save pipeline (by @ChristopherVR) ([bd3cfb2](https://github.com/ChristopherVR/pptx-viewer/commit/bd3cfb298724f9a2cf12adfd93ca8cc531afe2e4))
- **react:** Ensure drawing-shape path correctly tags nodes for inline editing (by @ChristopherVR) ([34c9be6](https://github.com/ChristopherVR/pptx-viewer/commit/34c9be650f4a5abd6d0e86f203a0d62c4919aec4))
- **shared:** Disable texture flipY to suppress WebGL texImage3D pixel-store error (by @ChristopherVR) ([39b2236](https://github.com/ChristopherVR/pptx-viewer/commit/39b2236baa4d7e5b71fa27c70057b175cc96af0f))
- **core,react:** Repair PPTX corruption from media/math save bugs (by @ChristopherVR) ([dfffd13](https://github.com/ChristopherVR/pptx-viewer/commit/dfffd131214f6db6488c70bf6d6c77a5efcedec0))
- **vue:** Stop event bubbling from SmartArt inline editor textarea (by @ChristopherVR) ([898891e](https://github.com/ChristopherVR/pptx-viewer/commit/898891e98538f2c5eccbe0f78caa67e83f24966e))
- **angular:** Guard SmartArt inline editor against cancel-triggered blur commit (by @ChristopherVR) ([c3acfb5](https://github.com/ChristopherVR/pptx-viewer/commit/c3acfb5e1627cb4eeac639d7e6a1afbce352a32d))
- **react:** Ensure drawing-shape path correctly tags nodes for inline editing (by @ChristopherVR) ([191b780](https://github.com/ChristopherVR/pptx-viewer/commit/191b780935b3f01050cd7b7be4433f3eb73c168e))

## [1.1.60](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.60) - 2026-06-25

### Other

- **smartart:** Snapshot in-progress SmartArt session work (by @ChristopherVR) ([0cac22f](https://github.com/ChristopherVR/pptx-viewer/commit/0cac22f5b1a0ecc33960f4712ff2ef691beb3f65))

## [1.1.58](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.58) - 2026-06-25

### Features

- **angular:** Wire the real separate-state editTemplateMode pipeline (load partition, dedicated layer, save merge-back) (by @ChristopherVR) ([2487538](https://github.com/ChristopherVR/pptx-viewer/commit/24875384e4d282b35e081d8824e40df90616c132))
- **vue:** Wire the real separate-state editTemplateMode pipeline (load partition, dedicated layer, save merge-back) (by @ChristopherVR) ([4f324af](https://github.com/ChristopherVR/pptx-viewer/commit/4f324af3fb76d014c6b2e90c3677bb6f65092521))
- **react:** Wire the real separate-state editTemplateMode pipeline (load partition, dedicated layer, save merge-back) (by @ChristopherVR) ([a3bff60](https://github.com/ChristopherVR/pptx-viewer/commit/a3bff6012ac9b5b2ec7d7b1b7a46ae705745e900))

## [1.1.51](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-react-viewer@1.1.51) - 2026-06-25

### Features

- **react:** Real editTemplateMode gating; drop dead template-elements scaffold (by @ChristopherVR) ([a2ef59d](https://github.com/ChristopherVR/pptx-viewer/commit/a2ef59d3c8b1135d666d74c62b976f0edfdbeed3))

## [1.1.57](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.57) - 2026-06-25

### Features

- **angular:** Real editTemplateMode gating for master/layout elements (by @ChristopherVR) ([ca0d405](https://github.com/ChristopherVR/pptx-viewer/commit/ca0d405fb5cfbc6f1beb788fdc1fe35c8329c8e1))
- **vue:** Real editTemplateMode gating for master/layout elements (by @ChristopherVR) ([1418b53](https://github.com/ChristopherVR/pptx-viewer/commit/1418b536c788ba503c8cb775b5de29fe9cd03d5a))

## [1.1.56](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.56) - 2026-06-25

### Features

- **vue,angular:** Substitute OOXML text fields (slide number, date, footer) (by @ChristopherVR) ([27b2d83](https://github.com/ChristopherVR/pptx-viewer/commit/27b2d83cb526670470d837277ca286b9c259d3c2))
- **vue,angular:** Render per-run text effects (fill, shadow, 3D, glow, reflection) (by @ChristopherVR) ([7d5b342](https://github.com/ChristopherVR/pptx-viewer/commit/7d5b342e3af28fae6f6ae726d6e290c621ed8c8b))

### Bug Fixes

- **core:** Preserve field/equation/ruby runs whose style matches neighbours (by @ChristopherVR) ([196bd9e](https://github.com/ChristopherVR/pptx-viewer/commit/196bd9e1ba2bdeee2381c3a9791ec81be741064b))

## [1.1.55](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.55) - 2026-06-25

### Features

- **core:** Expose per-slide template elements + verify master/layout edit round-trip (by @ChristopherVR) ([4da26b6](https://github.com/ChristopherVR/pptx-viewer/commit/4da26b642297f59c71959348e1e7032079b00f61))

### Bug Fixes

- **react:** Clear selection on empty viewport background click (by @ChristopherVR) ([064f1aa](https://github.com/ChristopherVR/pptx-viewer/commit/064f1aa95192fef5b90057f268cf90b549d54371))
- **angular:** Clear selection on empty viewport background click (by @ChristopherVR) ([1690ffe](https://github.com/ChristopherVR/pptx-viewer/commit/1690ffe9500721b409e3d81e7759df537a577ba8))

## [1.1.54](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.54) - 2026-06-25

### Features

- **vue,angular:** Render vertical text, underline variants and special alignment (by @ChristopherVR) ([d757f52](https://github.com/ChristopherVR/pptx-viewer/commit/d757f5225f09b1bf4450d15d55537521614b4e82))
- **angular:** Collapsible ribbon toggle (by @ChristopherVR) ([0ed28ac](https://github.com/ChristopherVR/pptx-viewer/commit/0ed28ac0003e3e1c1ca049a559363f7924053b65))

### Refactor

- **shared:** Extract mobile-viewport, formatters and broadcast helpers (by @ChristopherVR) ([9aeeb0a](https://github.com/ChristopherVR/pptx-viewer/commit/9aeeb0a7a2c37c8ef682c7cbd4df147314f169ef))
- **shared:** Extract OLE type helpers; dedup OLE actions (by @ChristopherVR) ([f9f90e2](https://github.com/ChristopherVR/pptx-viewer/commit/f9f90e21a273ebe08b93522c5acf4908ebc8efcc))
- **shared:** Consolidate download/jpeg/video export helpers (by @ChristopherVR) ([2cfdfd9](https://github.com/ChristopherVR/pptx-viewer/commit/2cfdfd94526135302fbecd67b6beda544d6e98c3))
- Repoint geometry/connector stale copies onto shared (by @ChristopherVR) ([8385ecb](https://github.com/ChristopherVR/pptx-viewer/commit/8385ecb371dcdc70f4738ecc96c3da36cd36ae4a))
- **angular:** Repoint text-warp/bullets/segment-style onto shared (by @ChristopherVR) ([2ac87e6](https://github.com/ChristopherVR/pptx-viewer/commit/2ac87e60be6c61920ae6f7b0fdb3cace8eaee13d))
- Convert editor pre-shim originals to shared re-exports (by @ChristopherVR) ([c47394c](https://github.com/ChristopherVR/pptx-viewer/commit/c47394ccabb198d92624073d2958cf9ab56b93f1))
- **shared:** Extract section, slide and action-button logic (by @ChristopherVR) ([7a70cd9](https://github.com/ChristopherVR/pptx-viewer/commit/7a70cd972e821e498db6d97a71863ab0c3bb1446))
- **shared:** Consolidate resize/marquee/group/align/history interaction logic (by @ChristopherVR) ([023da76](https://github.com/ChristopherVR/pptx-viewer/commit/023da763c95f811c9b2c5cdd88a90e0ff4fe6097))
- Collapse React collaboration onto shared; unify role model (by @ChristopherVR) ([f51f54e](https://github.com/ChristopherVR/pptx-viewer/commit/f51f54e0c51145d8bd77e1b3834372e49eec235c))
- **shared:** Extract text-rendering pure logic (line-height, warp, effects) (by @ChristopherVR) ([11c8d22](https://github.com/ChristopherVR/pptx-viewer/commit/11c8d22e9910dda9c8dfa18e0f6d7683577c7b9f))

## [1.1.53](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.53) - 2026-06-25

### Features

- **vue:** Collapsible ribbon toggle (wire isCompactToolbarOpen) (by @ChristopherVR) ([974ac16](https://github.com/ChristopherVR/pptx-viewer/commit/974ac16dcd6b9002fe3cdfc0e9760cd8500773b2))

### Bug Fixes

- **core:** Decode XML text entities so '&' no longer renders as '&amp;' (by @ChristopherVR) ([3c86556](https://github.com/ChristopherVR/pptx-viewer/commit/3c865564e75dd4aeb1233347a3005cadb710f021))

## [1.1.52](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.52) - 2026-06-25

### Features

- **vue:** Per-slide theme colour override in the slide inspector (by @ChristopherVR) ([e26a519](https://github.com/ChristopherVR/pptx-viewer/commit/e26a519119070fbdb14f4b202f1c05b93dd8d0bb))

### Documentation

- **vue:** Slide-properties inspector parity essentially complete (by @ChristopherVR) ([d0ddcd1](https://github.com/ChristopherVR/pptx-viewer/commit/d0ddcd18b455451cc5a3fb10a38c8f21b39ea9f8))

## [1.1.50](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.50) - 2026-06-25

### Features

- **vue:** Slide background editing in the slide-properties inspector (by @ChristopherVR) ([73f20ae](https://github.com/ChristopherVR/pptx-viewer/commit/73f20aeb9a5061a0a175cf7b7a26a412285279d3))
- **vue:** Transition direction/orientation/spokes in the slide inspector (by @ChristopherVR) ([e533ce7](https://github.com/ChristopherVR/pptx-viewer/commit/e533ce7c1993f266283f76eb13c4b8ccd9bb412e))

### Documentation

- **vue:** Update slide-properties inspector parity status (by @ChristopherVR) ([ac6e395](https://github.com/ChristopherVR/pptx-viewer/commit/ac6e395965086bd281bf1ccd372b05ef42eb0b53))

## [1.1.49](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.49) - 2026-06-25

### Features

- **vue:** Zoom-element click-to-navigate in presentation mode (by @ChristopherVR) ([30dcb3f](https://github.com/ChristopherVR/pptx-viewer/commit/30dcb3f433955c2e2ed3a7bd538937b2a27f024c))
- **angular:** Zoom-element click-to-navigate in presentation mode (by @ChristopherVR) ([f3d7852](https://github.com/ChristopherVR/pptx-viewer/commit/f3d785258d30d8541ce1062d2e209dd8cb4c87e1))

### Documentation

- **vue:** Mark zoom-element navigation done in the parity tracker (by @ChristopherVR) ([8cc7075](https://github.com/ChristopherVR/pptx-viewer/commit/8cc7075aedbed35257b03141d22c06fb5ec388e6))

## [1.1.48](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.48) - 2026-06-25

### Features

- **angular:** Interactive GLB/GLTF Model3D rendering (by @ChristopherVR) ([54f72c2](https://github.com/ChristopherVR/pptx-viewer/commit/54f72c2e714a071a945876623188df904cb297f7))
- **vue:** Render the a:clrChange image color-change effect (by @ChristopherVR) ([3035857](https://github.com/ChristopherVR/pptx-viewer/commit/303585777000f43f629276a28f5d708a4ea1abc3))
- **angular:** Render the a:clrChange image color-change effect (by @ChristopherVR) ([b4a22ec](https://github.com/ChristopherVR/pptx-viewer/commit/b4a22ece09419203d5b8b4b7c57f4035c5fc8ee4))

### Documentation

- **vue:** Mark interactive Model3D done in the parity tracker (by @ChristopherVR) ([614ebb6](https://github.com/ChristopherVR/pptx-viewer/commit/614ebb6a381159b7f0457600f35f5494ed38cb94))
- **vue:** Mark a:clrChange image effect done in the parity tracker (by @ChristopherVR) ([4833180](https://github.com/ChristopherVR/pptx-viewer/commit/4833180777b0dcb428da1270ebdd8c2e511b4335))

## [1.1.47](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.47) - 2026-06-24

### Features

- **vue:** Interactive GLB/GLTF Model3D rendering (by @ChristopherVR) ([c7d2b3d](https://github.com/ChristopherVR/pptx-viewer/commit/c7d2b3d2e61e9d3ce12cc65ab2e6f34cbc364c72))

## [1.1.46](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.46) - 2026-06-24

### Features

- **shared:** SmartArt accessibility metadata and per-node fill override (by @ChristopherVR) ([16afd94](https://github.com/ChristopherVR/pptx-viewer/commit/16afd94db612be96977cde806aca7f50de3f4a8c))
- **core:** Per-node SmartArt colour and emphasis override with round-trip (by @ChristopherVR) ([7e74e13](https://github.com/ChristopherVR/pptx-viewer/commit/7e74e13b51a64970833e6d73df38486e68ab961e))

## [1.1.45](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.45) - 2026-06-22

### Features

- **shared:** Extract pure element helpers to shared; React re-exports (by @ChristopherVR) ([df8c4d4](https://github.com/ChristopherVR/pptx-viewer/commit/df8c4d48e3d902805921a3e62c6bfd19ea8925ae))
- **shared:** Inline SmartArt node-edit helpers (lookup, commit-guard, geometry) (by @ChristopherVR) ([9ad6fe1](https://github.com/ChristopherVR/pptx-viewer/commit/9ad6fe1cc056eea5b46566494b49a9530bf979b1))
- **react:** Inline on-canvas SmartArt node text editing (by @ChristopherVR) ([83c8135](https://github.com/ChristopherVR/pptx-viewer/commit/83c813543e693b75c595f91f3764e836315e3b86))
- **vue:** Inline on-canvas SmartArt node text editing (by @ChristopherVR) ([cd8158f](https://github.com/ChristopherVR/pptx-viewer/commit/cd8158fc26a509d33e72972bfeb2734fc4e3ce7a))
- **angular:** Inline on-canvas SmartArt node text editing (by @ChristopherVR) ([a54ac88](https://github.com/ChristopherVR/pptx-viewer/commit/a54ac889c7c928898b60841afad7e216a03029d8))

### Bug Fixes

- **vue:** Add missing OLE actions helper used by OleRenderer (by @ChristopherVR) ([3aebe37](https://github.com/ChristopherVR/pptx-viewer/commit/3aebe3739d45c05092cf861832dc935ae8322a8f))

### Documentation

- SmartArt node text is editable on-canvas (double-click) in all bindings (by @ChristopherVR) ([2c17a55](https://github.com/ChristopherVR/pptx-viewer/commit/2c17a55b9a80f56aeaac90407b3d675cdc194b9f))

### Chores

- Added fixtures (by @ChristopherVR) ([af8f1d5](https://github.com/ChristopherVR/pptx-viewer/commit/af8f1d5198b83efc60fcc590af66ac9fcab414d8))

## [1.1.44](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-react-viewer@1.1.44) - 2026-06-22

### Features

- **shared:** OLE download/open helpers (file-size + browser-openable MIME) (by @ChristopherVR) ([097580c](https://github.com/ChristopherVR/pptx-viewer/commit/097580c10538be3bad6b49968a27cbfb2fb06cfd))
- **react:** OLE download/open actions and richer info (by @ChristopherVR) ([dca209f](https://github.com/ChristopherVR/pptx-viewer/commit/dca209f46f14ccb832b311deedd95c879e007998))
- **vue:** OLE download/open actions and richer info (by @ChristopherVR) ([c80c4fb](https://github.com/ChristopherVR/pptx-viewer/commit/c80c4fbc12f8d7ba9cfe553e8665a10c172dc217))
- **angular:** OLE download/open actions and richer info (by @ChristopherVR) ([7dfb1cc](https://github.com/ChristopherVR/pptx-viewer/commit/7dfb1cceb9cc5fd5beaa24136c676c1be6953ca4))

### Documentation

- OLE objects now offer download/open and richer info (by @ChristopherVR) ([b57ab97](https://github.com/ChristopherVR/pptx-viewer/commit/b57ab974060ae72837471a90c02ce78c3988b268))

## [1.1.44](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.44) - 2026-06-22

### Features

- **react:** Render GLB/GLTF models with vanilla three (no @react-three) (by @ChristopherVR) ([c8b047e](https://github.com/ChristopherVR/pptx-viewer/commit/c8b047e679ad202813f13e7fe28249a7018f9576))
- **core:** Extract embedded OLE payload for download/open and richer info (by @ChristopherVR) ([2c025f3](https://github.com/ChristopherVR/pptx-viewer/commit/2c025f338280955d76529cfb9ce389a862e766dd))
- **react:** 3D surface charts on vanilla three; drop @react-three peer deps (by @ChristopherVR) ([a8a1004](https://github.com/ChristopherVR/pptx-viewer/commit/a8a10048169678fa7bf559198d36c9f6023d2be0))

### Documentation

- 3D models/charts need only the single optional `three` peer dep (by @ChristopherVR) ([0b05f85](https://github.com/ChristopherVR/pptx-viewer/commit/0b05f857100cb71eb9db10fdc23dfbafc21dbb5d))

## [1.1.43](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.43) - 2026-06-22

### Features

- **shared:** Extract accessibility helpers to shared; React re-exports (by @ChristopherVR) ([64da687](https://github.com/ChristopherVR/pptx-viewer/commit/64da6874609e18d7b958cdeeb79d5a066a67d092))

### Bug Fixes

- **react:** Make remaining dialogs fit mobile viewports (by @ChristopherVR) ([acc334d](https://github.com/ChristopherVR/pptx-viewer/commit/acc334d0421dc0db027dfa8dafc016c1cd02bfd1))
- **vue:** Make dialogs fit mobile viewports via the shared modal shell (by @ChristopherVR) ([f06e65c](https://github.com/ChristopherVR/pptx-viewer/commit/f06e65c70df395fbd2a367982923fe2825d420eb))
- **angular:** Responsive modal shell and inspector on mobile (by @ChristopherVR) ([fb0f7be](https://github.com/ChristopherVR/pptx-viewer/commit/fb0f7be20eda13b943ed44c830c7e5bfcad6da37))

### Documentation

- Mobile UI now responsive across dialogs, inspector, and toolbar (by @ChristopherVR) ([6a1db5c](https://github.com/ChristopherVR/pptx-viewer/commit/6a1db5cf519a57bbf45fd7e30093a81345e76f03))

## [1.1.42](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.42) - 2026-06-22

### Features

- **shared:** Compound animation triggers and advanced morph transitions (by @ChristopherVR) ([2b8aa8b](https://github.com/ChristopherVR/pptx-viewer/commit/2b8aa8b5211711899b7dda27a5599d344d5b2969))
- **core:** Regenerate SmartArt colors/quickStyles on save and preserve per-run text (by @ChristopherVR) ([3f70e6d](https://github.com/ChristopherVR/pptx-viewer/commit/3f70e6d2a4ab1a52ca1957faf7317a54e579b819))
- **core:** Multi-container combo chart load and per-data-point label overrides (by @ChristopherVR) ([32dc2d7](https://github.com/ChristopherVR/pptx-viewer/commit/32dc2d715b09ac9fce2223ae886d4332b82d5688))
- **shared:** Extract pure clone helpers to shared; React re-exports (by @ChristopherVR) ([436d708](https://github.com/ChristopherVR/pptx-viewer/commit/436d7084267ac31d0ea9905ad3522dd0cd04c01b))
- **shared:** Chart-editor option constants and supported-type sets (by @ChristopherVR) ([dd67c0e](https://github.com/ChristopherVR/pptx-viewer/commit/dd67c0e39e835f4f32931adcadd71c8a168bb737))
- **vue:** Advanced chart editor parity with React (by @ChristopherVR) ([e57afac](https://github.com/ChristopherVR/pptx-viewer/commit/e57afac90a2b6e93d73366c38bc1414da057a12e))
- **angular:** Advanced chart editor parity with React (by @ChristopherVR) ([bf237d1](https://github.com/ChristopherVR/pptx-viewer/commit/bf237d14161318ed06efac623f1c08767bf1a195))

### Bug Fixes

- **vue:** Gate inline text editor to text-bearing elements (by @ChristopherVR) ([7c31be5](https://github.com/ChristopherVR/pptx-viewer/commit/7c31be53ad20bdfe5c81dac52d2a95a7e77d160b))

### Refactor

- **angular:** Route present-mode swipe through shared recognizer (by @ChristopherVR) ([9d2d375](https://github.com/ChristopherVR/pptx-viewer/commit/9d2d375df65b43ff84363e8ae28c835e4496ef94))

### Documentation

- Mark SmartArt, chart, animation, morph, and strict-OOXML limitations closed (by @ChristopherVR) ([e3426bc](https://github.com/ChristopherVR/pptx-viewer/commit/e3426bcd6c66edd64f632642ccd37cf5ee611314))
- Chart editor and framework parity complete across React/Vue/Angular (by @ChristopherVR) ([966d86c](https://github.com/ChristopherVR/pptx-viewer/commit/966d86ccfec97996df53b1a4a80ecd2582dd61ce))

## [1.1.41](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.41) - 2026-06-22

### Features

- **shared:** Swipe falls back to last move position without changedTouches (by @ChristopherVR) ([d42309a](https://github.com/ChristopherVR/pptx-viewer/commit/d42309addb8c422502747abd873924b09350c02d))

### Testing

- **e2e:** Cover mobile table-cell commit on tap-away (by @ChristopherVR) ([e624cab](https://github.com/ChristopherVR/pptx-viewer/commit/e624cab2659ad1271f94480a9fece0d7295d9811))

## [1.1.40](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.40) - 2026-06-22

### Features

- **vue:** Container-ref ResizeObserver path for useIsMobile (React parity) (by @ChristopherVR) ([72fb2ee](https://github.com/ChristopherVR/pptx-viewer/commit/72fb2ee027176648c48e2c5eb81a20a1fefecb49))
- **vue:** Drive mobile breakpoints from the viewer container (by @ChristopherVR) ([7ac1554](https://github.com/ChristopherVR/pptx-viewer/commit/7ac1554ffd863dc04c0b60b8f08e42f259b96b88))

### Bug Fixes

- **core:** Align strict OOXML save with real packages (OPC/MCE are conformance-independent) (by @ChristopherVR) ([c6b69e0](https://github.com/ChristopherVR/pptx-viewer/commit/c6b69e08d44d783c2533a807b037c91448d1cd42))

### Refactor

- **angular:** Consume shared setCellText (share-first dedup) (by @ChristopherVR) ([874b69e](https://github.com/ChristopherVR/pptx-viewer/commit/874b69edf7d151f146da7ef302a3a70827108162))

## [1.1.39](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.39) - 2026-06-22

### Features

- **shared:** Add immutable setCellText table-cell helper (by @ChristopherVR) ([7b5ace0](https://github.com/ChristopherVR/pptx-viewer/commit/7b5ace0dcf11e0d4bdc1674da4ab017183eaf290))
- **vue:** Inline table-cell editing (parity with React/Angular) (by @ChristopherVR) ([f30ac5b](https://github.com/ChristopherVR/pptx-viewer/commit/f30ac5b454e43098a1b8d5f870ae98b7532ea32c))

## [1.1.37](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.37) - 2026-06-21

### Features

- **shared:** Add framework-agnostic touch-gesture recognizer (by @ChristopherVR) ([477e5b4](https://github.com/ChristopherVR/pptx-viewer/commit/477e5b4a1a3c0f75f5be84d9235b860278e61f7b))
- **vue:** Mobile touch parity (pinch, long-press, presentation controls) (by @ChristopherVR) ([df5f310](https://github.com/ChristopherVR/pptx-viewer/commit/df5f310af4aa311efb73aad43da13265020fa03f))
- **angular:** Mobile touch parity (pinch-to-zoom and long-press) (by @ChristopherVR) ([9186bb1](https://github.com/ChristopherVR/pptx-viewer/commit/9186bb1f7b56309c253c87049e85079b376e77de))

### Bug Fixes

- **react:** Keep mobile table-cell edits from being lost on tap (by @ChristopherVR) ([230b846](https://github.com/ChristopherVR/pptx-viewer/commit/230b84667f195ae500ec74f7235cbe7d6e3f8dbb))

### Refactor

- **react:** Consume shared touch-gesture recognizer (by @ChristopherVR) ([c2090ba](https://github.com/ChristopherVR/pptx-viewer/commit/c2090ba7cd7a94cf6b292921f34020ba3d568dcb))

## [1.1.36](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.36) - 2026-06-21

### Features

- **core:** Make SmartArt editing round-trip lossless (by @ChristopherVR) ([15000f5](https://github.com/ChristopherVR/pptx-viewer/commit/15000f591ed43bd75bbc0ed345badef6c2591951))
- **shared:** Make all mapped SmartArt layouts insertable and add render tests (by @ChristopherVR) ([db9ed12](https://github.com/ChristopherVR/pptx-viewer/commit/db9ed12e36956b372a4d633c34aa996da213e637))
- **react:** Close production gaps in the SmartArt editor (by @ChristopherVR) ([1112227](https://github.com/ChristopherVR/pptx-viewer/commit/1112227c0cceb44875921ae8429d95d1874b67c9))
- **vue:** Add full SmartArt editing inspector (by @ChristopherVR) ([06ea167](https://github.com/ChristopherVR/pptx-viewer/commit/06ea167d9ea3b4cff96fd50a043768ee355daf62))
- **angular:** Add full SmartArt editing inspector (by @ChristopherVR) ([c7ab8e2](https://github.com/ChristopherVR/pptx-viewer/commit/c7ab8e24ff3965dae0d18cc9f7373bfc510a62c4))

### Documentation

- Reflect SmartArt reflow, lossless round-trip, and cross-binding editing (by @ChristopherVR) ([0db30d3](https://github.com/ChristopherVR/pptx-viewer/commit/0db30d36fb5f06037e1bd51dfecef357707444b9))

## [1.1.35](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.35) - 2026-06-21

### Features

- **core:** Round-trip any Strict OOXML namespace via structural derivation (by @ChristopherVR) ([6992489](https://github.com/ChristopherVR/pptx-viewer/commit/69924894a5e0bddf80291702c9315caae276cba6))

### Documentation

- Mark Strict OOXML conformance as fully round-tripping (by @ChristopherVR) ([ed06a4a](https://github.com/ChristopherVR/pptx-viewer/commit/ed06a4a6e3cb69ef7bd6bb2b4925eaa4fea39220))

## [1.1.33](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.33) - 2026-06-21

### Documentation

- Remove emf-converter and mtx-decompressor package pages (by @ChristopherVR) ([377bfbe](https://github.com/ChristopherVR/pptx-viewer/commit/377bfbe180ec9d49ccf911ad5a530326e9543460))
- Scrub stale in-repo references to emf-converter and mtx-decompressor (by @ChristopherVR) ([fe21e26](https://github.com/ChristopherVR/pptx-viewer/commit/fe21e26a1fd3f04e2b5ba0577f99ac46a4e858ea))

### Dependencies

- **deps:** Update dependencies within semver ranges (by @ChristopherVR) ([d472b58](https://github.com/ChristopherVR/pptx-viewer/commit/d472b58dfd47628b5c682bd5f4dc2014ec29b421))

### Chores

- Removed old documents (by @ChristopherVR) ([098b420](https://github.com/ChristopherVR/pptx-viewer/commit/098b420e1aec91ebe31d0398aeee9104ab38596f))

## [1.1.32](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.32) - 2026-06-21

### Bug Fixes

- **angular:** Replace bare file input with styled dropzone in demo (by @ChristopherVR) ([d47a4a5](https://github.com/ChristopherVR/pptx-viewer/commit/d47a4a538c8e7f7cd057ac652b2dbede527d92e3))

## [1.1.31](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.31) - 2026-06-21

### Bug Fixes

- **angular:** Update element-style test to use camelCase zIndex key (by @ChristopherVR) ([7808808](https://github.com/ChristopherVR/pptx-viewer/commit/78088086b848499cc9ea1b68003a56d6a6956aa4))
- **angular:** Bundle pptx-viewer-core and fix demo JIT + Vue demo alias (by @ChristopherVR) ([78838ec](https://github.com/ChristopherVR/pptx-viewer/commit/78838ec900fe2d8c90bc39333636d788c52c3161))

### Build & CI

- **release:** Inline npm publish into release workflow; add scoped package (by @ChristopherVR) ([6cdae4d](https://github.com/ChristopherVR/pptx-viewer/commit/6cdae4dcef675a3907fe80a875c59d56bd7847a2))
- **release:** Merge publish.yml into release.yml for OIDC (by @ChristopherVR) ([feff67c](https://github.com/ChristopherVR/pptx-viewer/commit/feff67cac840a6379e6956db333ed17ce438bf41))
- **release:** Fix script injection in publish job run steps (by @ChristopherVR) ([a46db0d](https://github.com/ChristopherVR/pptx-viewer/commit/a46db0d3cad1cec59792a2e15a694046886c3cde))
- **release:** Move plan before builds to skip expensive steps on no-op runs (by @ChristopherVR) ([443ac75](https://github.com/ChristopherVR/pptx-viewer/commit/443ac758e418d7306526857026367af0ced9f4f7))

## [1.1.30](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.30) - 2026-06-21

### Features

- **shared:** Add Three.js SmartArt 3D model + scene runtime (by @ChristopherVR) ([f949213](https://github.com/ChristopherVR/pptx-viewer/commit/f949213b33ed0dca4c52d5d1ab414c3dba67efe7))
- **react:** Opt-in Three.js SmartArt renderer (by @ChristopherVR) ([ed1fc3a](https://github.com/ChristopherVR/pptx-viewer/commit/ed1fc3a4902ab93099a094415dc31ff520b80274))
- **vue:** Opt-in Three.js SmartArt renderer (by @ChristopherVR) ([2d59be3](https://github.com/ChristopherVR/pptx-viewer/commit/2d59be365bee62521b1cfa670f9d5d5468418488))
- **angular:** Opt-in Three.js SmartArt renderer (by @ChristopherVR) ([be6d858](https://github.com/ChristopherVR/pptx-viewer/commit/be6d85818b4a2f70cf644ee91467fd44dc4506de))
- **shared:** Spatial 3D SmartArt layouts (phase 2) (by @ChristopherVR) ([eab4ed2](https://github.com/ChristopherVR/pptx-viewer/commit/eab4ed23a96539aafee1654f5be9628bcbaf563f))
- **react:** Use spatial 3D SmartArt layouts (by @ChristopherVR) ([1835631](https://github.com/ChristopherVR/pptx-viewer/commit/183563172af0c44ac5e867ee72a51a85af700581))
- **vue:** Use spatial 3D SmartArt layouts (by @ChristopherVR) ([a5f028e](https://github.com/ChristopherVR/pptx-viewer/commit/a5f028e35d20ed220e526ad3ba9afc5321720630))
- **angular:** Use spatial 3D SmartArt layouts (by @ChristopherVR) ([6faf9ad](https://github.com/ChristopherVR/pptx-viewer/commit/6faf9ad980f013daa9f77cd9f7790c6620fa0630))
- Extracted more shared logic into the shared package (by @ChristopherVR) ([977c608](https://github.com/ChristopherVR/pptx-viewer/commit/977c608ecdb142908b38aaa37104d983275b705b))
- **chart:** Insert new charts from the editor toolbar (by @ChristopherVR) ([6a14691](https://github.com/ChristopherVR/pptx-viewer/commit/6a1469152bb1502e6816284104f5d0e74ea4b607))
- **chart:** Edit per-series colour in the inspector (by @ChristopherVR) ([d54152e](https://github.com/ChristopherVR/pptx-viewer/commit/d54152e3e25122acd4f48e27ec7116d93b8a67f3))
- **chart:** Edit log scale, markers, combo, gridline/title style, dPt (by @ChristopherVR) ([df1dc7a](https://github.com/ChristopherVR/pptx-viewer/commit/df1dc7a3eff39e6c35a38f2ae33ff5da639fe31b))

### Bug Fixes

- **shared,vue:** Remove smartart-3d cross-chunk re-export; Rolldown constant workaround (by @ChristopherVR) ([f2e4a22](https://github.com/ChristopherVR/pptx-viewer/commit/f2e4a2274d3f28757293addf7f10beae748612be))
- **vue,ci:** Fix Rolldown build panic and isolate per-framework CI failures (by @ChristopherVR) ([7d282ee](https://github.com/ChristopherVR/pptx-viewer/commit/7d282eeadeb130814dca84996b0434568f2f5e0e))

### Refactor

- **shared:** Extract editor lifecycle foundation to shared (by @ChristopherVR) ([3dd4382](https://github.com/ChristopherVR/pptx-viewer/commit/3dd43821804b6a90be0656d65737d30907435b44))
- **shared:** Extract text utilities to shared (by @ChristopherVR) ([7e962be](https://github.com/ChristopherVR/pptx-viewer/commit/7e962be84fb82e037eaf5b4207198e61609fc3f2))
- **shared:** Export Phase 6 effects and dialog helpers from barrel (by @ChristopherVR) ([5bb0bf4](https://github.com/ChristopherVR/pptx-viewer/commit/5bb0bf454bdfebd7693d706727b1a092f264c477))
- **shared:** Extract export pipeline to shared (by @ChristopherVR) ([4ce9adc](https://github.com/ChristopherVR/pptx-viewer/commit/4ce9adc9517470b419b9bcf61d398d4bee0c49c9))
- **shared:** Extract rendering math and style builders to shared (by @ChristopherVR) ([081d333](https://github.com/ChristopherVR/pptx-viewer/commit/081d3337e74af583ef28a6fff6f0ae9fdbec96db))
- **shared:** Share px helper across element-style bindings (by @ChristopherVR) ([764be4f](https://github.com/ChristopherVR/pptx-viewer/commit/764be4fad1e0775f8b5af1b3ee12cb050914234a))

### Documentation

- Sharpen npm descriptions and keywords for discoverability (by @ChristopherVR) ([8fea56d](https://github.com/ChristopherVR/pptx-viewer/commit/8fea56d7650f7dc2f3167dea97b94b612a03a4e7))
- **core:** Reword README in plain language (by @ChristopherVR) ([793c26e](https://github.com/ChristopherVR/pptx-viewer/commit/793c26ec7e2415c66f34c637cb541483bf395a11))
- **react:** Soften jargon in README internals (by @ChristopherVR) ([74c28ec](https://github.com/ChristopherVR/pptx-viewer/commit/74c28ec5519ffd8704fd3c0aa4588ce76861e68b))
- **vue:** Reword README in plain language (by @ChristopherVR) ([3afac93](https://github.com/ChristopherVR/pptx-viewer/commit/3afac9321206ab492d8cd6d63babc6cedef7292f))
- **angular:** Reword README in plain language (by @ChristopherVR) ([ba72266](https://github.com/ChristopherVR/pptx-viewer/commit/ba722668b0c4846e86837b2cf255198231ab2631))
- **shared:** Correct print-document module comment (by @ChristopherVR) ([a5e0e0d](https://github.com/ChristopherVR/pptx-viewer/commit/a5e0e0d4a5afaf0c44a009ba188ea44884a50781))
- **chart:** Update limitations for full chart editing and insert (by @ChristopherVR) ([f788147](https://github.com/ChristopherVR/pptx-viewer/commit/f788147daded697a0b913d5cb0798bce38cb0a41))

### Build & CI

- **release:** Add GitHub Release retention pruning (by @ChristopherVR) ([616fb52](https://github.com/ChristopherVR/pptx-viewer/commit/616fb52f8846633ba685ac50864988da6bd9f0a7))
- **release:** Fail loudly when npm publishing is disabled (by @ChristopherVR) ([80b7c52](https://github.com/ChristopherVR/pptx-viewer/commit/80b7c52909bef91e7d6744cd9876363e2c19045e))
- **release:** Avoid script injection from release tag in publish (by @ChristopherVR) ([c514f4b](https://github.com/ChristopherVR/pptx-viewer/commit/c514f4be25c75f9b96d30aa87ed6ff307b7468d0))

## [1.1.29](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.29) - 2026-06-20

### Features

- **chart:** Edit value-axis display units in the inspector (by @ChristopherVR) ([88d9758](https://github.com/ChristopherVR/pptx-viewer/commit/88d9758eba7c42377403dd75f678f7cd11cf45a9))
- **collab:** Implement C3 collaboration hardening (by @ChristopherVR) ([f4a27cf](https://github.com/ChristopherVR/pptx-viewer/commit/f4a27cfa37de3d8b72cb2a6554a415303f269f2f))

### Documentation

- **collab:** Add C3 collaboration-hardening design proposal (by @ChristopherVR) ([f0b50ad](https://github.com/ChristopherVR/pptx-viewer/commit/f0b50adfcfc5e51a6edffac454496ead2bdee246))
- **collab:** Add Hocuspocus example and production deployment guide (by @ChristopherVR) ([45df385](https://github.com/ChristopherVR/pptx-viewer/commit/45df38510392431484749872ff134da2508d9045))

## [1.1.28](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.28) - 2026-06-20

### Features

- **viewer:** Mobile-adapted presenter view (by @ChristopherVR) ([93de717](https://github.com/ChristopherVR/pptx-viewer/commit/93de717cb0f8fa2a4d06ddb15ffd3ebb63863c9b))

### Bug Fixes

- **core:** Generate chart parts so SDK-created charts round-trip (by @ChristopherVR) ([a0243fa](https://github.com/ChristopherVR/pptx-viewer/commit/a0243fa73f752a8fc2343cc2dfbe35b598e01781))

### Documentation

- **roadmap:** Mark mobile + collaboration items shipped (by @ChristopherVR) ([6680a6a](https://github.com/ChristopherVR/pptx-viewer/commit/6680a6abf6b8b9aaf8a9dda0877fec059f5bd07d))

## [1.1.27](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.27) - 2026-06-20

### Features

- **viewer:** Keep the focused field visible when the mobile keyboard opens (by @ChristopherVR) ([0e0a27d](https://github.com/ChristopherVR/pptx-viewer/commit/0e0a27d6e7108694995deb329d6af003fca01641))

## [1.1.26](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.26) - 2026-06-20

### Features

- **chart:** Edit axis titles in the inspector (by @ChristopherVR) ([97045ba](https://github.com/ChristopherVR/pptx-viewer/commit/97045baa940b621fee65f6a825f5bfcd3267b7ab))
- **chart:** Toggle axis major/minor gridlines in the inspector (by @ChristopherVR) ([938dc7f](https://github.com/ChristopherVR/pptx-viewer/commit/938dc7fb19c83355a4714577fc820c41de391bb1))
- **viewer:** Export progress and cancel (by @ChristopherVR) ([b0d1161](https://github.com/ChristopherVR/pptx-viewer/commit/b0d1161449404c2ecbab146ee7fba6e917d1735a))

### Bug Fixes

- **core:** Enrich chart data on load so charts render from a pptx (by @ChristopherVR) ([59646fb](https://github.com/ChristopherVR/pptx-viewer/commit/59646fb5a5865a374d7d72e144af8f9557788d16))

## [1.1.25](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.25) - 2026-06-20

### Features

- **chart:** Edit chart-level data labels in the inspector (by @ChristopherVR) ([88348da](https://github.com/ChristopherVR/pptx-viewer/commit/88348da7d48c287030ad916a202e99df8597d5c8))
- **chart:** Edit per-series trendlines in the inspector (by @ChristopherVR) ([b558221](https://github.com/ChristopherVR/pptx-viewer/commit/b5582215857eb7f1d66c3bccdb776896f8c10a08))
- **chart:** Edit per-series error bars in the inspector (by @ChristopherVR) ([c9392ae](https://github.com/ChristopherVR/pptx-viewer/commit/c9392ae57f5f94458fc7b5fc2a352f5f88ece03c))
- **vue:** Real-time collaboration (yjs provider, presence, document sync) (by @ChristopherVR) ([26db3f8](https://github.com/ChristopherVR/pptx-viewer/commit/26db3f8372f3e8af415b396a1231ce4bf410f34b))

## [1.1.24](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.24) - 2026-06-20

### Features

- **shared:** Add funnel/sunburst/histogram/boxWhisker chart builders (by @ChristopherVR) ([2031e73](https://github.com/ChristopherVR/pptx-viewer/commit/2031e73daa491984cf03ca98910d71cc01b68cf9))
- **shared:** Wire log/secondary axes, display units, percentStacked, overlays (by @ChristopherVR) ([bbca4fb](https://github.com/ChristopherVR/pptx-viewer/commit/bbca4fb77951a479ccbd0f495210d7c19df0ef92))
- **tools:** Re-export core engine so no separate pptx-viewer-core install (by @ChristopherVR) ([d0ed793](https://github.com/ChristopherVR/pptx-viewer/commit/d0ed79302729adde8951821b10d2394b88e964d7))
- **core:** Persist chart legend visibility and position on save (by @ChristopherVR) ([92f1403](https://github.com/ChristopherVR/pptx-viewer/commit/92f14039d3f428f86da141f123f9c1e902219534))
- **vue:** Real-time collaboration (yjs provider, presence, document sync) (by @ChristopherVR) ([bb78631](https://github.com/ChristopherVR/pptx-viewer/commit/bb78631d6943e4a8eb62f1729666529ba6b3f8c1))
- **chart:** Edit value/category axis formatting in the inspector (by @ChristopherVR) ([ccbdadc](https://github.com/ChristopherVR/pptx-viewer/commit/ccbdadc79059a77fd4078db74e02694fe82aabec))
- **angular:** Share and broadcast collaboration dialog status (by @ChristopherVR) ([bd15732](https://github.com/ChristopherVR/pptx-viewer/commit/bd1573210421ce896dfb952179684f698b1c8b65))
- **viewer:** Responsive bottom-sheet dialogs on mobile (by @ChristopherVR) ([6d3bfb5](https://github.com/ChristopherVR/pptx-viewer/commit/6d3bfb50ec6958b3e525f3407658b4ee4aff3604))
- **vue:** Mobile editing chrome (toolbar, menu sheet, slides sheet) (by @ChristopherVR) ([4c0888d](https://github.com/ChristopherVR/pptx-viewer/commit/4c0888d69c4d9bdd222091b4daf645c2fbb1c0db))

### Bug Fixes

- **angular:** Render secondary value axis in the chart component (by @ChristopherVR) ([9eff953](https://github.com/ChristopherVR/pptx-viewer/commit/9eff953a2852211db567f56a1331f30821377aaa))
- **deps:** Unblock install after the 1.1.23 version alignment (by @ChristopherVR) ([542a92d](https://github.com/ChristopherVR/pptx-viewer/commit/542a92dcafe2041e8b1c3cb4b371ef0353a470c9))

### Refactor

- **react,vue:** Align funnel/sunburst/histogram/boxWhisker on shared engine (by @ChristopherVR) ([13b47ae](https://github.com/ChristopherVR/pptx-viewer/commit/13b47ae93be91388cef5bbfd176ca06a5e6b7ac1))
- **react,vue:** Align cartesian charts on the shared engine (by @ChristopherVR) ([694ca8b](https://github.com/ChristopherVR/pptx-viewer/commit/694ca8b5adccf0fcb76a66bf622cfca0d31229a7))

### Documentation

- Drop emf-converter and mtx-decompressor as in-repo packages (by @ChristopherVR) ([589f469](https://github.com/ChristopherVR/pptx-viewer/commit/589f4694966e9f2723a15e8fa636614f4b75c06e))
- Add mobile-first and collaboration roadmap (by @ChristopherVR) ([455b60a](https://github.com/ChristopherVR/pptx-viewer/commit/455b60a1de1b7c761a45a4dfce5de73abffd9399))
- **tools:** Make MCP first-class in README and drop em-dashes (by @ChristopherVR) ([89ebd64](https://github.com/ChristopherVR/pptx-viewer/commit/89ebd6453719cf46a4e655dfe689c9d5fae19549))

### Build & CI

- Independent per-package versioning, tags, and changelogs (by @ChristopherVR) ([79595d9](https://github.com/ChristopherVR/pptx-viewer/commit/79595d972d7c4102e8b1e1e3926f439486f76ba1))

## [1.4.17](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.17) - 2026-06-20

### Refactor

- **react:** Render pie/radar charts via the shared view-model engine (by @ChristopherVR) ([75c892d](https://github.com/ChristopherVR/pptx-viewer/commit/75c892dd476aeeaff36717dec151854c57b61783))
- **vue:** Render pie/radar charts via the shared view-model engine (by @ChristopherVR) ([a8b537d](https://github.com/ChristopherVR/pptx-viewer/commit/a8b537d228753e3532995b0080a644457f4440a8))

### Documentation

- Ban em-dashes in CLAUDE.md conventions (by @ChristopherVR) ([026d655](https://github.com/ChristopherVR/pptx-viewer/commit/026d655e7e25f9b73543589234b84539eacef423))
- Fix em-dash rule wording in CLAUDE.md (by @ChristopherVR) ([952a8b4](https://github.com/ChristopherVR/pptx-viewer/commit/952a8b4ce3725d65d2a9115d85d21508f4654599))

### Build & CI

- Release and publish only the packages that changed (by @ChristopherVR) ([eed9e58](https://github.com/ChristopherVR/pptx-viewer/commit/eed9e58156cf81cbe8dd9eb691bc3834a08e3dd1))

## [1.4.16](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.16) - 2026-06-20

### Features

- **viewer:** Swipe-down-to-dismiss for centered modal dialogs (by @ChristopherVR) ([3f37f62](https://github.com/ChristopherVR/pptx-viewer/commit/3f37f62d9e43a664fcf0e0d1bb55e30aa9892395))

### Refactor

- **angular:** Render SmartArt via the shared layout engine (by @ChristopherVR) ([0ec1975](https://github.com/ChristopherVR/pptx-viewer/commit/0ec1975a6ff715567ab1da5d61b3301b1af1c082))
- **react:** Remove em-dashes and clear pre-existing lint warnings (by @ChristopherVR) ([20e0903](https://github.com/ChristopherVR/pptx-viewer/commit/20e090301c3caadc181284e5f92f751d80c7cb2d))
- **vue:** Remove em-dashes and clear pre-existing lint warnings (by @ChristopherVR) ([5353396](https://github.com/ChristopherVR/pptx-viewer/commit/5353396f45e89baccbcf3fe81edf070509e5c20f))
- **react:** Remove em-dashes from smartart-process JSDoc (by @ChristopherVR) ([139317a](https://github.com/ChristopherVR/pptx-viewer/commit/139317ab3314b5bbec5b4b3c0003fd38b56b923c))
- Remove em-dashes from transition shim doc comments (by @ChristopherVR) ([e2fa40b](https://github.com/ChristopherVR/pptx-viewer/commit/e2fa40b31ed8cee032e08ab3533ff5241533f9f5))

## [1.4.15](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.15) - 2026-06-20

### Features

- **angular:** Swipe-dismiss the mobile inspector drawer (by @ChristopherVR) ([37b0e02](https://github.com/ChristopherVR/pptx-viewer/commit/37b0e02462ed5b387b136e290eed526ae602c0b8))

### Refactor

- **angular:** Remove em-dashes from code comments and prose (by @ChristopherVR) ([0166321](https://github.com/ChristopherVR/pptx-viewer/commit/01663210fd84f60b29c7c6176def02951e3903f3))
- **vue:** Remove em-dashes from code comments and prose (by @ChristopherVR) ([e306df9](https://github.com/ChristopherVR/pptx-viewer/commit/e306df9ed3d8ee65cc6de6f94ace8789682aa0bb))
- **react:** Remove em-dashes from code comments and prose (1/2) (by @ChristopherVR) ([863e941](https://github.com/ChristopherVR/pptx-viewer/commit/863e94132c19751d5c7327baa520244c53e7c115))
- **react:** Remove em-dashes from code comments and prose (2/2) (by @ChristopherVR) ([2544c13](https://github.com/ChristopherVR/pptx-viewer/commit/2544c1361643cb338be87a89d5123a8ac666aada))
- **core:** Move OOXML table XML read/write from React into core (by @ChristopherVR) ([66ee49b](https://github.com/ChristopherVR/pptx-viewer/commit/66ee49b9a9f65a6c0e09f7dd0fb90447ea105e43))

### Documentation

- Remove em-dashes and clarify demo link in viewer packages (by @ChristopherVR) ([f52afff](https://github.com/ChristopherVR/pptx-viewer/commit/f52afffd935016b747116a9909c523021b492225))

## [1.4.14](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.14) - 2026-06-19

### Features

- **viewer:** Mobile notes swipe-dismiss + File ▸ Open across bindings (by @ChristopherVR) ([f6505c9](https://github.com/ChristopherVR/pptx-viewer/commit/f6505c97fe711efb5a9042b8c2159096c1fd4895))

### Refactor

- **shared:** Extract slide-transition CSS/keyframes into shared (by @ChristopherVR) ([fabb975](https://github.com/ChristopherVR/pptx-viewer/commit/fabb975951dce40e3fea4ae6feeffa64f243d05b))
- **shared:** Extract element-animation authoring/playback into shared (by @ChristopherVR) ([fa0a4c3](https://github.com/ChristopherVR/pptx-viewer/commit/fa0a4c350a8d68ce6d8592a63f4f3875087592ab))

## [1.4.13](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.13) - 2026-06-19

### Features

- **shared:** Add framework-agnostic export pure-logic modules (by @ChristopherVR) ([7be9dee](https://github.com/ChristopherVR/pptx-viewer/commit/7be9deef7082655a33b8074176133767a89542e1))

### Bug Fixes

- **shared:** Avoid String.replaceAll in hyperlink-security (by @ChristopherVR) ([325657c](https://github.com/ChristopherVR/pptx-viewer/commit/325657c935e95a2894e9f11bd3392e72f931011c))

### Refactor

- **shared:** Extract morph transition logic into shared (by @ChristopherVR) ([c335ee2](https://github.com/ChristopherVR/pptx-viewer/commit/c335ee2feddd2f7aba0fdcbe88f4c3fc7249efb1))
- Shim binding export modules to shared/export pure helpers (by @ChristopherVR) ([c6fde4b](https://github.com/ChristopherVR/pptx-viewer/commit/c6fde4bfd6f197072e03e6f719ed5b7bbf5a908f))
- **shared:** Consolidate React effect/colour primitives into shared (by @ChristopherVR) ([0a84f88](https://github.com/ChristopherVR/pptx-viewer/commit/0a84f88aa4b6f0652ae91c509ec282d79f681149))
- **shared:** Extract native animation timeline engine into shared (by @ChristopherVR) ([d92af95](https://github.com/ChristopherVR/pptx-viewer/commit/d92af957721ac193964a5f700bb0c272a9e50a3b))
- **shared:** Extract snap-guide and ruler geometry into shared (by @ChristopherVR) ([fbe2bce](https://github.com/ChristopherVR/pptx-viewer/commit/fbe2bceb165e5e484f03de978751144250998564))
- **shared:** Extract SmartArt layout engine into shared (by @ChristopherVR) ([3b3136e](https://github.com/ChristopherVR/pptx-viewer/commit/3b3136ecf05133ff45b6c678d7dfc97b89563926))

## [1.4.12](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.12) - 2026-06-19

### Refactor

- **shared:** Consolidate small duplicated helpers into shared (by @ChristopherVR) ([c765620](https://github.com/ChristopherVR/pptx-viewer/commit/c765620d52fff503afaeafa773b77d4b883ef5cd))

## [1.4.11](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.11) - 2026-06-19

### Refactor

- **shared:** Consolidate warp-path generation into text-warp (by @ChristopherVR) ([2085f75](https://github.com/ChristopherVR/pptx-viewer/commit/2085f75c3d22b4f553f8117055fa538dca305242))
- **react:** Shim warp-path-generators to shared (by @ChristopherVR) ([bc034f5](https://github.com/ChristopherVR/pptx-viewer/commit/bc034f5365435caad0d0f98ebe641a92a8d03f7e))
- **angular:** Consume shared for warp, visual-effects, omml-to-mathml (by @ChristopherVR) ([a74ea17](https://github.com/ChristopherVR/pptx-viewer/commit/a74ea17b4734c76697fc4f1a8cd720e5a937dcf6))
- **shared:** Consolidate color/gradient/pattern logic into fill-style (by @ChristopherVR) ([0eb26ad](https://github.com/ChristopherVR/pptx-viewer/commit/0eb26ad39af81d6b4cf8bb502ffd94b9b3c589b2))
- **shared:** Extract connector routing/reroute/style into shared (by @ChristopherVR) ([8dde327](https://github.com/ChristopherVR/pptx-viewer/commit/8dde327a0ab32b1f4b8024e1c99fdc731eb26017))
- **shared:** Extract chart engine/geometry/overlays into shared (by @ChristopherVR) ([ab470b3](https://github.com/ChristopherVR/pptx-viewer/commit/ab470b35d0176c5a127db3fe0540735bf2cd9ed6))
- **react:** Shim OMML/LaTeX math conversion to shared (by @ChristopherVR) ([4cc176a](https://github.com/ChristopherVR/pptx-viewer/commit/4cc176abdbb74f73afb3e39986de322efd386b02))
- **shared:** Make visual-3d the superset; shim React shape-3d (by @ChristopherVR) ([a9c8a97](https://github.com/ChristopherVR/pptx-viewer/commit/a9c8a971821bd52c9cbd89fbc7ddec7c82e488c3))
- **shared:** Extract table merge/layout structural ops into shared (by @ChristopherVR) ([9e151d4](https://github.com/ChristopherVR/pptx-viewer/commit/9e151d4b45a52f61287ba90cccece5007a226084))

## [1.4.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.10) - 2026-06-18

### Features

- **vue:** Mobile bottom-sheet layer for format & comments (by @ChristopherVR) ([87f581f](https://github.com/ChristopherVR/pptx-viewer/commit/87f581f159127f1f12a46348e89c7fa5da71c68d))

### Bug Fixes

- **angular:** Mobile save button and wider sheet swipe region (by @ChristopherVR) ([d6eaa99](https://github.com/ChristopherVR/pptx-viewer/commit/d6eaa99bb7a15a697235576042c7c6346f877903))
- **vue:** Add Save to the mobile bottom bar (by @ChristopherVR) ([9d0ed2c](https://github.com/ChristopherVR/pptx-viewer/commit/9d0ed2c8b906b68d4c760944da5e4a6f1724f63b))

## [1.4.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.9) - 2026-06-18

### Features

- **angular:** Mobile chrome parity — run the React mobile e2e on Angular (by @ChristopherVR) ([7b22220](https://github.com/ChristopherVR/pptx-viewer/commit/7b22220dd68fe08a5c04c249fe98393a5a260bff))

### Bug Fixes

- **angular:** Un-skip mobile-table e2e — inspector table editor as div-grid (by @ChristopherVR) ([b6265e2](https://github.com/ChristopherVR/pptx-viewer/commit/b6265e22fc2c371ac9fcd5d66a9137f05be3c544))
- **react:** Mobile sheet swipe-to-close, save button, theme picker (by @ChristopherVR) ([6b6ce2b](https://github.com/ChristopherVR/pptx-viewer/commit/6b6ce2b298039c699d2b84e732add2083fb7f056))

### Documentation

- **angular:** Trim PORTING.md to status + what's-missing (drop session log) (by @ChristopherVR) ([393d5e2](https://github.com/ChristopherVR/pptx-viewer/commit/393d5e2e10361cd9158cf502c2f15e67bbe9e09c))
- **angular:** E2e now 28/0 (no skips); remaining = refactor/cosmetic debts only (by @ChristopherVR) ([7817092](https://github.com/ChristopherVR/pptx-viewer/commit/7817092780173c1a288029addfadc6c6e571e871))

### Dependencies

- **deps:** Bump all workspace manifest floors to latest (by @ChristopherVR) ([890c33d](https://github.com/ChristopherVR/pptx-viewer/commit/890c33d667a39480a69e6a3da893964382993b29))

## [1.4.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.8) - 2026-06-18

### Refactor

- **vue:** Extract ElementRenderer text logic to shared; split SFC (by @ChristopherVR) ([d4740ac](https://github.com/ChristopherVR/pptx-viewer/commit/d4740ac970baec5ae12e2f7e38188bb40f40687f))

### Documentation

- Require ≤300 LOC per file + default logic to pptx-viewer-shared (by @ChristopherVR) ([b2e9c6e](https://github.com/ChristopherVR/pptx-viewer/commit/b2e9c6eaa64fa95df35abe19a04fccac165bd5cc))

### Testing

- **core:** Replace sensitive V8 fixture with synthetic sample (by @ChristopherVR) ([7f89a27](https://github.com/ChristopherVR/pptx-viewer/commit/7f89a279a5ddc3ed978e83a2ed81db2bae812f6e))

### Dependencies

- **deps:** Update dependencies to latest (by @ChristopherVR) ([595287f](https://github.com/ChristopherVR/pptx-viewer/commit/595287f801f84cf87b8805e98de805a720c76488))

## [1.4.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.7) - 2026-06-18

### Features

- **vue:** Render bulleted lists (glyphs, auto-numbers, indents) (by @ChristopherVR) ([54f5b05](https://github.com/ChristopherVR/pptx-viewer/commit/54f5b0509197a4a29e523a14228e3297bddcf757))
- **shared:** Gradient tile-flip mode (a:gradFill/@flip) (by @ChristopherVR) ([8b64c7c](https://github.com/ChristopherVR/pptx-viewer/commit/8b64c7cf9440522317815a87b48543b986ff66c6))
- **shared:** Text-warp envelope/simple CSS-transform presets (by @ChristopherVR) ([7d6e4dc](https://github.com/ChristopherVR/pptx-viewer/commit/7d6e4dcbc6f7b8bbe878871b35497e12797fbfda))

### Bug Fixes

- **core:** Sort OLE2 directory entries for PowerPoint compatibility (by @ChristopherVR) ([f6d5c3e](https://github.com/ChristopherVR/pptx-viewer/commit/f6d5c3e783af7d10f05bd34d931af47470dfe138))

### Documentation

- **vue:** Trim PORTING.md to a parity-gap view (1042→175 lines) (by @ChristopherVR) ([e04848c](https://github.com/ChristopherVR/pptx-viewer/commit/e04848c1016838e58f3159bcab9c6c353d6a3c38))
- **vue:** Mark bullets/gradient-flip/text-warp done; drop non-gap equations (by @ChristopherVR) ([d22cddb](https://github.com/ChristopherVR/pptx-viewer/commit/d22cddbf4fcfc614dd5eaf4cecef11a43a6b9567))

## [1.4.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.5) - 2026-06-18

### Features

- **angular:** Present active custom show + correct inserted-equation OMML (by @ChristopherVR) ([178730d](https://github.com/ChristopherVR/pptx-viewer/commit/178730d3fb953aca1b7328f374c05e6f1c99c477))
- **vue:** Wire remaining File/Slide-Show ribbon actions (by @ChristopherVR) ([f04ea3f](https://github.com/ChristopherVR/pptx-viewer/commit/f04ea3f2c9b6f046b9ddc83b51073b3ff3d2bda7))
- **vue:** Wire Animations tab add/remove preset (by @ChristopherVR) ([6315f88](https://github.com/ChristopherVR/pptx-viewer/commit/6315f8821b908af9f7aa92120c9ec8e52713aaab))

### Documentation

- **angular:** Niche list complete — custom-show present + equation OMML; functional parity reached (by @ChristopherVR) ([ac719c7](https://github.com/ChristopherVR/pptx-viewer/commit/ac719c79af0a78d3d98902577c7c35a38c42423e))
- **vue:** Log File/Slide-Show/Animations ribbon wiring (by @ChristopherVR) ([b59b6ad](https://github.com/ChristopherVR/pptx-viewer/commit/b59b6ad5ff87fdf963e49988c198acf3a956e0fc))

## [1.4.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.4) - 2026-06-18

### Features

- **angular:** Add snap-to-grid, draggable ruler guides, and eyedropper (by @ChristopherVR) ([2b40442](https://github.com/ChristopherVR/pptx-viewer/commit/2b404425414741711cc28a9f3ee508b4522fef8c))

## [1.4.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.3) - 2026-06-18

### Features

- **vue:** View ▸ H/V Guides + Snap to Shape (by @ChristopherVR) ([f743404](https://github.com/ChristopherVR/pptx-viewer/commit/f743404e448660bf645800e2e2dd39e108cd0ad6))
- **angular:** Add Selection Pane and Custom Shows panels (by @ChristopherVR) ([b811dcf](https://github.com/ChristopherVR/pptx-viewer/commit/b811dcf4fd6323227dce148694d401421f86415a))
- **angular:** Add snap-to-grid, draggable ruler guides, and eyedropper (by @ChristopherVR) ([ecc201d](https://github.com/ChristopherVR/pptx-viewer/commit/ecc201ddfd58dff6e869d0909ace1ca9869d892e))
- **vue:** View ▸ Spell — host-controlled inline spell-check (by @ChristopherVR) ([f63ab1a](https://github.com/ChristopherVR/pptx-viewer/commit/f63ab1a615314e5681224b36c817f706060f5cfa))
- **angular:** Add Selection Pane and Custom Shows panels (by @ChristopherVR) ([7922508](https://github.com/ChristopherVR/pptx-viewer/commit/7922508b01644bfaa190341317053be65740a7ba))

### Documentation

- **vue:** Log H/V Guides + Snap to Shape; clear the emf/mtx break flag (by @ChristopherVR) ([99b6315](https://github.com/ChristopherVR/pptx-viewer/commit/99b6315c2a4923668549bbc48455c67190f82303))
- **angular:** Log niche wave (snap-to-grid/guides/eyedropper/selection-pane/custom-shows); 2161 tests, e2e 10/10 (by @ChristopherVR) ([fa77b49](https://github.com/ChristopherVR/pptx-viewer/commit/fa77b497938ea9bae60aa3794902f16f710efe54))
- **vue:** Log View ▸ Spell; all ribbon View-tab stubs now done (by @ChristopherVR) ([60673f8](https://github.com/ChristopherVR/pptx-viewer/commit/60673f8215749ed3a5379c1b9d236f82fe510fbe))

## [1.4.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.2) - 2026-06-18

### Features

- **angular:** Implement freehand ink drawing backend for the Draw tab (by @ChristopherVR) ([cb72c7b](https://github.com/ChristopherVR/pptx-viewer/commit/cb72c7b82c45e512a94ee169928a20906d1c99c9))

### Bug Fixes

- **vue:** Drop duplicate theme declarations in PowerPointViewer (by @ChristopherVR) ([b0eefce](https://github.com/ChristopherVR/pptx-viewer/commit/b0eefced4f180a155b462e4dbbdb3ef5c4483e2a))

### Build & CI

- **deps:** Lock emf-converter + mtx-decompressor to published 1.4.1 (by @ChristopherVR) ([c151d37](https://github.com/ChristopherVR/pptx-viewer/commit/c151d372a394db0dfde43602c784e3373f56fa3c))

## [1.4.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.4.1) - 2026-06-18

### Features

- **vue:** Design ▸ Edit Theme panel (by @ChristopherVR) ([59fb336](https://github.com/ChristopherVR/pptx-viewer/commit/59fb33656bfe7124cc7022b4744e3c6dc8276192))
- **vue:** Draw-tab ink tools (pen / highlighter / eraser) (by @ChristopherVR) ([bb855cc](https://github.com/ChristopherVR/pptx-viewer/commit/bb855ccf515ffc4526e7b3dfdc79c03acbdad3e6))
- **vue:** View ▸ Rulers (horizontal + vertical ruler strips) (by @ChristopherVR) ([b1dad01](https://github.com/ChristopherVR/pptx-viewer/commit/b1dad018eea0d486f82341db16aa21c0f6be394c))
- **angular:** Design tab theme gallery (apply built-in theme presets) (by @ChristopherVR) ([a8b42e8](https://github.com/ChristopherVR/pptx-viewer/commit/a8b42e8db3906cc3facc7206cf826cfb50bff02f))
- **angular:** Implement freehand ink drawing backend for the Draw tab (by @ChristopherVR) ([c495775](https://github.com/ChristopherVR/pptx-viewer/commit/c4957756769859413ae313d88575ffa642588781))
- **angular:** Add Table, SmartArt, and Equation insertion to ribbon Insert tab (by @ChristopherVR) ([3f310a8](https://github.com/ChristopherVR/pptx-viewer/commit/3f310a8bd74861599d94cde5861ff81846753835))
- **angular:** Add grid, rulers, and guides overlays to View tab ribbon (by @ChristopherVR) ([7b556ba](https://github.com/ChristopherVR/pptx-viewer/commit/7b556ba6fea179c24fe224c6403d45217711490b))
- **vue:** Design ▸ Themes gallery (apply built-in theme presets) (by @ChristopherVR) ([b16271a](https://github.com/ChristopherVR/pptx-viewer/commit/b16271a1e1b7a34f4a832f661f58e5bd8cc0eff6))
- **angular:** Design tab theme gallery (apply built-in theme presets) (by @ChristopherVR) ([dc01108](https://github.com/ChristopherVR/pptx-viewer/commit/dc01108886959c49c9dfbbf9eb530cdb8a7914fa))

### Bug Fixes

- **vue:** Hide slides rail on mobile so the slide is visible (by @ChristopherVR) ([75d2b85](https://github.com/ChristopherVR/pptx-viewer/commit/75d2b85984a29fbb9299a058cdced401ee3cda13))

### Refactor

- **core:** Consume emf-converter and mtx-decompressor from npm (by @ChristopherVR) ([2f6013d](https://github.com/ChristopherVR/pptx-viewer/commit/2f6013d5b8fab0aef5b32901841d94c0fa886f24))

### Documentation

- **vue:** Log theme editor + Draw-tab ink tools (by @ChristopherVR) ([37b81bf](https://github.com/ChristopherVR/pptx-viewer/commit/37b81bf074e97659d147518da1a8eb3789e361b3))
- **vue:** Log View ▸ Rulers + flag the emf/mtx workspace break (by @ChristopherVR) ([70f76ec](https://github.com/ChristopherVR/pptx-viewer/commit/70f76ec8ecb2e60db10adb8e6d21af05b46fd663))
- **angular:** Log Insert/View/Design/Draw depth landed (2148 tests, e2e 10/10) (by @ChristopherVR) ([cbe9dc7](https://github.com/ChristopherVR/pptx-viewer/commit/cbe9dc7cb1998d766def97fbb20db4169c869680))
- **vue:** Log layout + theme galleries; ribbon data-stubs complete (by @ChristopherVR) ([3e1c556](https://github.com/ChristopherVR/pptx-viewer/commit/3e1c55683eeffb3c237d5c8f8bef3ab5a0ab9052))

## [1.1.25](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.25) - 2026-06-18

### Features

- **angular:** Add Table, SmartArt, and Equation insertion to ribbon Insert tab (by @ChristopherVR) ([07c8736](https://github.com/ChristopherVR/pptx-viewer/commit/07c873662d3aaf194d3a0a51a5eeceab7de5fece))
- **angular:** Add grid, rulers, and guides overlays to View tab ribbon (by @ChristopherVR) ([3583d6f](https://github.com/ChristopherVR/pptx-viewer/commit/3583d6f864f31760a259771bfa3f62ea0c9e1155))
- **vue:** Design ▸ Themes gallery (apply built-in theme presets) (by @ChristopherVR) ([40b8a51](https://github.com/ChristopherVR/pptx-viewer/commit/40b8a517e34b5a5feb2094af7654c4655fd7c773))

### Other

- **angular:** Insert tab — Table/SmartArt/Equation insertion (by @ChristopherVR) ([8c6c90c](https://github.com/ChristopherVR/pptx-viewer/commit/8c6c90c87a1b61df99bd2c0511daf6aaadf8eca0))
- **angular:** View tab — grid/rulers/guides overlays (by @ChristopherVR) ([22f9b89](https://github.com/ChristopherVR/pptx-viewer/commit/22f9b895fecbff8cb1be4b98088973b083f07db7))

### Documentation

- **vue:** Log layout + theme galleries; ribbon data-stubs complete (by @ChristopherVR) ([6aa01ab](https://github.com/ChristopherVR/pptx-viewer/commit/6aa01ab03d9ab8e3194942ac3fc12faa78180545))

## [1.1.24](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.24) - 2026-06-18

### Features

- **vue:** Insert ▸ Media picker (audio/video) + media playback rendering (by @ChristopherVR) ([f2ce923](https://github.com/ChristopherVR/pptx-viewer/commit/f2ce923580273c48653e388f50a2885fe09513a9))
- **angular:** Port React's Office-style ribbon (shell + Home/Insert/Text/Arrange) (by @ChristopherVR) ([df472a0](https://github.com/ChristopherVR/pptx-viewer/commit/df472a0db7284791d5e7a46b95a840fc64ccb18c))
- **angular:** Add bottom status bar to complete the ribbon shell (by @ChristopherVR) ([fdeef54](https://github.com/ChristopherVR/pptx-viewer/commit/fdeef54f742c7f775294666e50978a345544b29c))
- **vue:** Wire Insert ▸ Action buttons (by @ChristopherVR) ([1201ff0](https://github.com/ChristopherVR/pptx-viewer/commit/1201ff038583a9a335455617c4c986e4974a19f6))
- **angular:** Implement Draw/Design/Transitions/Animations ribbon tabs (by @ChristopherVR) ([7cf8027](https://github.com/ChristopherVR/pptx-viewer/commit/7cf8027c35b6346bf1aa772d7bcaa452dde1822c))
- **vue:** Wire the New-Slide layout gallery (by @ChristopherVR) ([3f0ae0c](https://github.com/ChristopherVR/pptx-viewer/commit/3f0ae0c1ab59362f06fa3383b087ad696e33c815))

### Bug Fixes

- **core:** Declare jszip and fast-xml-parser as runtime dependencies (by @ChristopherVR) ([b6636be](https://github.com/ChristopherVR/pptx-viewer/commit/b6636be972206bb2c6acee0fed05c45b4759fbdc))
- **tools:** Ship pptx-viewer-core as a dependency so npx installs it (by @ChristopherVR) ([da33db1](https://github.com/ChristopherVR/pptx-viewer/commit/da33db11281f3573dc49defaba7e7404e59bc43f))
- **react:** Apply fill and stroke color changes live in the inspector (by @ChristopherVR) ([f9e134b](https://github.com/ChristopherVR/pptx-viewer/commit/f9e134ba5280bf9913067bee915f36669c5ffdf9))
- **react:** Support collaboration on static and GitHub Pages deploys (by @ChristopherVR) ([1edd271](https://github.com/ChristopherVR/pptx-viewer/commit/1edd271df3dae3199d1e6cb8102749780e7d30fe))
- **angular:** Restore e2e contract after ribbon + fix pt font inflation (by @ChristopherVR) ([227c44b](https://github.com/ChristopherVR/pptx-viewer/commit/227c44b5742df24f1391ebdb60a5fe6773f64a51))
- **angular:** Clear selection when entering presentation (no leaked edit chrome) (by @ChristopherVR) ([38f3c75](https://github.com/ChristopherVR/pptx-viewer/commit/38f3c75533a80b80d0e581b6bd24375034f8ccf0))
- **angular:** Dock mobile notes sheet in flow so its textarea is tappable (by @ChristopherVR) ([f46714b](https://github.com/ChristopherVR/pptx-viewer/commit/f46714bfe505fb983d77c8fdb2bff942d311524d))
- **e2e:** Destructure beforeEach fixtures arg in react-only mobile specs (by @ChristopherVR) ([1a22531](https://github.com/ChristopherVR/pptx-viewer/commit/1a2253141a0ea37135c86b58a7c98fe1fb7b57c3))

### Other

- **angular:** Tailwind 4 Office ribbon + pt→px font fix (by @ChristopherVR) ([ad5da60](https://github.com/ChristopherVR/pptx-viewer/commit/ad5da60e73c4a6ea780cda94773b4a74dcea9786))
- **angular:** Port Draw/Design/Transitions/Animations ribbon tabs (by @ChristopherVR) ([df7d98e](https://github.com/ChristopherVR/pptx-viewer/commit/df7d98ec5ed5f34e24ec7f7a9d4637d40104e6d7))
- **angular:** Fix mobile notes-sheet tap (normal flow vs fixed) — e2e 10/10 (by @ChristopherVR) ([52f5a45](https://github.com/ChristopherVR/pptx-viewer/commit/52f5a45dfe9615a33d257002362dec1d17108c66))

### Performance

- **core:** Emit compact XML on save by disabling pretty-print (by @ChristopherVR) ([2d7a9d8](https://github.com/ChristopherVR/pptx-viewer/commit/2d7a9d884d64d93f611b7a8fc0332ddf37e28173))

### Refactor

- **react:** Rename package from pptx-viewer to pptx-react-viewer (by @ChristopherVR) ([4cefa50](https://github.com/ChristopherVR/pptx-viewer/commit/4cefa501f38e0b26776607d68800d13738aba449))

### Documentation

- **vue:** Log media picker + note pre-existing useIsMobile red test (by @ChristopherVR) ([51de5b7](https://github.com/ChristopherVR/pptx-viewer/commit/51de5b7b2ff232c7c905707b194e293f56357d47))
- Streamline npm READMEs and add badges, screenshots, demo links (by @ChristopherVR) ([92e980d](https://github.com/ChristopherVR/pptx-viewer/commit/92e980d434900abd223c4d70c6cae19a623f9ca8))
- **vue,angular:** Point Try-demo links at per-framework demos (by @ChristopherVR) ([b5e6915](https://github.com/ChristopherVR/pptx-viewer/commit/b5e6915c416075f4f50630d76dfedbc324cde03e))
- **angular:** Log ribbon-port kickoff + Tailwind foundation status (by @ChristopherVR) ([40e0408](https://github.com/ChristopherVR/pptx-viewer/commit/40e04083c02b2f59f77253743df74218c4bca5b3))
- **angular:** Log ribbon shell + status bar landed, preflight verified (by @ChristopherVR) ([2b10e74](https://github.com/ChristopherVR/pptx-viewer/commit/2b10e74db1ae065785c8ac8ec50d4f46d3635ad7))
- **angular:** Log ribbon e2e status (8/10) + known mobile gaps + pt→px note (by @ChristopherVR) ([e0cb539](https://github.com/ChristopherVR/pptx-viewer/commit/e0cb5394473b96c453fce71e9b83205976ebd803))
- **angular:** Mark ribbon merged to main (by @ChristopherVR) ([9226bdc](https://github.com/ChristopherVR/pptx-viewer/commit/9226bdc08a3e87dc2d2322fbe06c3491d6476c35))
- Add per-package npm version badges to README header (by @ChristopherVR) ([8863cd9](https://github.com/ChristopherVR/pptx-viewer/commit/8863cd9c861a444a212ac76221f1d7bd8264d48d))
- **vue:** Log action buttons + suite-green note (by @ChristopherVR) ([b5a7ef6](https://github.com/ChristopherVR/pptx-viewer/commit/b5a7ef6f479ca26c4f21e481f5697c67ab0b3c0e))
- **angular:** Log advanced ribbon tabs landed (Transitions/Animations wired, Design partial, Draw UI-only) (by @ChristopherVR) ([deeb6c1](https://github.com/ChristopherVR/pptx-viewer/commit/deeb6c1adfd25516b3d3effe19b136721c9ee8a1))
- **angular:** Mobile e2e now 10/10 (notes-sheet flow fix); log trunk spec fix (by @ChristopherVR) ([92f4c44](https://github.com/ChristopherVR/pptx-viewer/commit/92f4c44a931233258981e452ecaccd5fe25f1a39))

### Testing

- **e2e:** Scope React-specific mobile specs to the react project (by @ChristopherVR) ([2057bfc](https://github.com/ChristopherVR/pptx-viewer/commit/2057bfccaf10a891e2e882b6cf77f7fc4963696d))
- **core:** Add large-deck (50MB+) performance benchmarks (by @ChristopherVR) ([9253d34](https://github.com/ChristopherVR/pptx-viewer/commit/9253d3420ef6d1f9b84410da4019bcfe679d5304))
- **react:** Add collaboration lifecycle and CRDT-sync coverage (by @ChristopherVR) ([56a1cdf](https://github.com/ChristopherVR/pptx-viewer/commit/56a1cdf95cdb199cbf44ea4ec063e7802003672a))
- **vue:** Align useIsMobile spec with the height-aware media query (by @ChristopherVR) ([96c1e43](https://github.com/ChristopherVR/pptx-viewer/commit/96c1e436fe759c7410e7d56d5e7237173d682aed))

### Build & CI

- Split release and npm publish into separate workflows (by @ChristopherVR) ([5c0d61c](https://github.com/ChristopherVR/pptx-viewer/commit/5c0d61c39776214c0d1c2cf1a938bfb9a7ac59ca))
- **pages:** Deploy Vue and Angular demos to their own subpaths (by @ChristopherVR) ([07c85be](https://github.com/ChristopherVR/pptx-viewer/commit/07c85be67c0d07d95722cfe1e7a7371dd572e8ec))
- **angular:** Adopt Tailwind 4 pipeline for ribbon chrome parity (by @ChristopherVR) ([65cf58f](https://github.com/ChristopherVR/pptx-viewer/commit/65cf58fbcce1fbf3ac0c3ce0f3b49b3c9604d1b1))

### Dependencies

- **deps:** Reconcile lockfile after Angular ribbon merge (by @ChristopherVR) ([cc7f008](https://github.com/ChristopherVR/pptx-viewer/commit/cc7f0082d94694ad60ba8978a235410fafdc94c6))

### Chores

- **changelog:** Remove emojis from git-cliff commit-parser groups (by @ChristopherVR) ([b29d1f3](https://github.com/ChristopherVR/pptx-viewer/commit/b29d1f3ba34f59ad349fb231efda787fe408a598))

## [1.1.23](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.23) - 2026-06-17

### Features

- **angular:** Satisfy framework-neutral e2e contract for viewer parity (by @ChristopherVR) ([88f3e0e](https://github.com/ChristopherVR/pptx-viewer/commit/88f3e0ed2a116f2b1be47323fab1bb537ee68e3a))
- **vue:** Port React's full Office-style ribbon toolbar (by @ChristopherVR) ([2341157](https://github.com/ChristopherVR/pptx-viewer/commit/23411572fb88ee50c7a3f64d93fc7d365e7ac73f))
- **vue:** Port React's bottom status bar to complete the ribbon chrome (by @ChristopherVR) ([d8c7f67](https://github.com/ChristopherVR/pptx-viewer/commit/d8c7f67bb1d7e799adc9e107ae440ac5b425cf31))
- **react:** Add on-canvas drag-to-rotate handle (by @ChristopherVR) ([e92132c](https://github.com/ChristopherVR/pptx-viewer/commit/e92132c2370a7ddfbec23e308e3755929f4172ab))
- **vue:** React-parity slides rail (SlidesPaneSidebar) (by @ChristopherVR) ([adc88a3](https://github.com/ChristopherVR/pptx-viewer/commit/adc88a3f14e263d395bf08dc1469aea5d3928e81))
- **vue:** Slide-level inspector with transition editing (by @ChristopherVR) ([315c33a](https://github.com/ChristopherVR/pptx-viewer/commit/315c33abd3fa27ece62a08cc61182402e7e81e1d))
- **vue:** Wire table + image insert; fix undo/selection wiped on every edit (by @ChristopherVR) ([436ac49](https://github.com/ChristopherVR/pptx-viewer/commit/436ac49bf7b95140b0517b82d57d22891d254be9))
- **vue:** View-tab grid overlay + snap-to-grid (by @ChristopherVR) ([ccccd2d](https://github.com/ChristopherVR/pptx-viewer/commit/ccccd2d599044b86461077b3a25b565053a9f55b))

### Bug Fixes

- **vue:** Render text font sizes in px, not pt, for React parity (by @ChristopherVR) ([8b950d5](https://github.com/ChristopherVR/pptx-viewer/commit/8b950d5af63bce349ea57ff3621648c278240c1c))
- **vue:** Default table body-cell text to dark colour for React parity (by @ChristopherVR) ([54a3dc3](https://github.com/ChristopherVR/pptx-viewer/commit/54a3dc31f6c0e9ef4ca8d36290490dbc97099c93))
- **angular:** Stop double-scaling slide thumbnails and presentation slides (by @ChristopherVR) ([8a225ff](https://github.com/ChristopherVR/pptx-viewer/commit/8a225ffac9e7f742c1649af8c64831b4222ae27f))
- **angular:** Move presentation annotation toolbar clear of the slide counter (by @ChristopherVR) ([c0c75b6](https://github.com/ChristopherVR/pptx-viewer/commit/c0c75b66d312b33dc6df7245d8bd7bab41e977ef))
- **react:** Content-height mobile menu sheet with wrapping sections (by @ChristopherVR) ([ba88ce8](https://github.com/ChristopherVR/pptx-viewer/commit/ba88ce8fc511c1986956eed5e5fd434ad43b703c))
- **react:** Use mobile chrome on landscape phones (height-aware breakpoint) (by @ChristopherVR) ([2ee25a5](https://github.com/ChristopherVR/pptx-viewer/commit/2ee25a5ab18c2d8dfacca41b861c174f3ffcbe2b))
- **react:** Fit slide to the viewport (measure editor area) (by @ChristopherVR) ([f54a2c6](https://github.com/ChristopherVR/pptx-viewer/commit/f54a2c6906adf6ac11dd17069b2f7ed1b32e2447))
- **demo:** Move theme picker clear of mobile bottom chrome (by @ChristopherVR) ([34de2f3](https://github.com/ChristopherVR/pptx-viewer/commit/34de2f3c8d5f19ec092ae356ca69101c9e8a9bf4))
- **vue:** Fit slide to viewport and make mobile breakpoint height-aware (by @ChristopherVR) ([04580e8](https://github.com/ChristopherVR/pptx-viewer/commit/04580e87d3d489d1dc942801b01177cf3d30cd5a))

### Refactor

- **vue:** Wire ribbon Arrange actions, move group/ungroup to context menu, drop dead chrome (by @ChristopherVR) ([216f597](https://github.com/ChristopherVR/pptx-viewer/commit/216f597e2dc658427c25c2d2b36250df5f80e54e))

### Documentation

- **vue:** Log px font-size fix + agnostic text-rendering e2e (by @ChristopherVR) ([3ffbe80](https://github.com/ChristopherVR/pptx-viewer/commit/3ffbe8056b2c7e6b87cf3f01fe14ef518e1c6e51))
- **angular:** Record framework-neutral e2e contract parity (by @ChristopherVR) ([6200fc9](https://github.com/ChristopherVR/pptx-viewer/commit/6200fc9cdf38f2c1623b3b519d1499cdc98515b3))
- **vue:** Log table body-cell colour fix + shared &amp; core bug (by @ChristopherVR) ([5fdf655](https://github.com/ChristopherVR/pptx-viewer/commit/5fdf6558523260096cc5b8b151bceae562ce253a))
- Make site framework-agnostic, promote demo, remove all em-dashes (by @ChristopherVR) ([e719ffa](https://github.com/ChristopherVR/pptx-viewer/commit/e719ffafe5d8c35458050ac50d9e07fc4c965962))
- **angular:** Record visual-parity audit vs React + remaining chrome gap (by @ChristopherVR) ([f3ae199](https://github.com/ChristopherVR/pptx-viewer/commit/f3ae19991d6208a2654a7137aff08dd3ee43b22e))
- **vue:** Log Office-style ribbon toolbar port + follow-ups (by @ChristopherVR) ([b2c0a54](https://github.com/ChristopherVR/pptx-viewer/commit/b2c0a54637ef19c1dad6e57a7219aafa650dc383))
- **vue:** Log bottom status bar port (ribbon chrome complete) (by @ChristopherVR) ([6e2a938](https://github.com/ChristopherVR/pptx-viewer/commit/6e2a9387596e21e2bcbb4ca97885110f03f3e8b3))
- **vue:** Log ribbon chrome cleanup + Arrange wiring (by @ChristopherVR) ([51ce920](https://github.com/ChristopherVR/pptx-viewer/commit/51ce920d21ab285f26c219ff2063dc74a621dc71))
- **vue:** Log slides-rail parity (desktop chrome complete) (by @ChristopherVR) ([5b258a0](https://github.com/ChristopherVR/pptx-viewer/commit/5b258a00a8ef96286d1e639576b632b2b9223b03))
- **vue:** Log slide-level inspector (transition editing restored) (by @ChristopherVR) ([df15436](https://github.com/ChristopherVR/pptx-viewer/commit/df15436b070f81520881756f6135c2cb52ca53e7))
- **vue:** Log table/image insert + undo/selection bugfix (by @ChristopherVR) ([61b6ef6](https://github.com/ChristopherVR/pptx-viewer/commit/61b6ef6cb8b9083a0d7b9b227f418867b9fef224))
- **vue:** Log View-tab grid overlay + snap-to-grid (by @ChristopherVR) ([55b8c78](https://github.com/ChristopherVR/pptx-viewer/commit/55b8c7813e1211ff1d4d416b58e35e62fe4809aa))

### Testing

- **e2e:** Add mobile audit and manipulation suites (by @ChristopherVR) ([85e9046](https://github.com/ChristopherVR/pptx-viewer/commit/85e9046f16f16afb1f590625f08b49c59d1c89a6))
- **e2e:** Add tablet/landscape and table-cell touch coverage (by @ChristopherVR) ([e6ef4b5](https://github.com/ChristopherVR/pptx-viewer/commit/e6ef4b5f6791a3c05147c62b01aabb0094de6f1d))

## [1.1.22](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.22) - 2026-06-16

### Features

- Development on visual parity for Vue (by @ChristopherVR) ([7d6d787](https://github.com/ChristopherVR/pptx-viewer/commit/7d6d7871075b4d31a69663e8f922076dbba5ee57))

### Build & CI

- **vue:** Adopt Tailwind 4 pipeline for chrome visual parity with React (by @ChristopherVR) ([451dacc](https://github.com/ChristopherVR/pptx-viewer/commit/451dacc831d41e620749f8403a2183d4e8b853df))

## [1.1.21](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.21) - 2026-06-16

### Testing

- **e2e:** Run one Playwright suite against both React and Vue demos (by @ChristopherVR) ([4762782](https://github.com/ChristopherVR/pptx-viewer/commit/476278229417fdbd550faa0b241d2b16819a3fe6))

## [1.1.20](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.20) - 2026-06-16

### Features

- **angular:** Text warp / WordArt rendering (by @ChristopherVR) ([be56710](https://github.com/ChristopherVR/pptx-viewer/commit/be56710509e0adedb8e53e1292bde0f5133cd9fd))
- **angular:** Presentation ink annotations + live captions (by @ChristopherVR) ([2403152](https://github.com/ChristopherVR/pptx-viewer/commit/2403152db0cdad60f44002e4616ee6cc082c44c1))
- **angular:** Map the exotic slide-transition catalogue (by @ChristopherVR) ([6924000](https://github.com/ChristopherVR/pptx-viewer/commit/69240008706d97847f9a51a18303a004a7594f15))

### Documentation

- **angular:** Record depth batch (chart overlays, text warp, annotations, transitions) (by @ChristopherVR) ([e68f07e](https://github.com/ChristopherVR/pptx-viewer/commit/e68f07e3a56ba881bbd0f178e518695baf34d139))

### Testing

- **e2e:** Run one Playwright suite against both React and Vue demos (by @ChristopherVR) ([7737fe1](https://github.com/ChristopherVR/pptx-viewer/commit/7737fe1a07343ebb04a79c47217172d77891bc2b))

## [1.1.19](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.19) - 2026-06-15

### Features

- **vue:** GIF/WebM export, slide-transition animations, collab depth, property round-trip (by @ChristopherVR) ([1d66b44](https://github.com/ChristopherVR/pptx-viewer/commit/1d66b443afe59cf062af0d7b96484b03f689de29))
- **angular:** Wire animation playback into the presentation overlay (by @ChristopherVR) ([fc4ab61](https://github.com/ChristopherVR/pptx-viewer/commit/fc4ab6166a97d9a211a96f1c184fd9a05825efb1))
- **angular:** Animation-authoring inspector tab (by @ChristopherVR) ([0dc66ac](https://github.com/ChristopherVR/pptx-viewer/commit/0dc66ac27aa60876048d23e424b63bce59077513))
- **angular:** Mobile chrome (bottom bar + slide-up sheets) (by @ChristopherVR) ([7e1ad8b](https://github.com/ChristopherVR/pptx-viewer/commit/7e1ad8b9bee265c3b59fad39cab1f3ddf03d34ba))
- **angular:** Chart overlays — trendlines, error bars, axis titles, data table (by @ChristopherVR) ([23da136](https://github.com/ChristopherVR/pptx-viewer/commit/23da1369d6db105b5291eb920846c7ae9096db48))

### Bug Fixes

- **react:** Don't leak edit chrome into presentation mode (by @ChristopherVR) ([701c808](https://github.com/ChristopherVR/pptx-viewer/commit/701c808340c808712f61a2eb1b5611e54836a144))

### Documentation

- **angular:** Record full feature parity (animation playback/authoring, mobile chrome) (by @ChristopherVR) ([e48a258](https://github.com/ChristopherVR/pptx-viewer/commit/e48a258e0e2a873f75121aaeff906d56de5b43c6))

## [1.1.18](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.18) - 2026-06-15

### Features

- **vue:** Version history/compare, insert-SmartArt & equation dialogs, settings (by @ChristopherVR) ([ba40c85](https://github.com/ChristopherVR/pptx-viewer/commit/ba40c8584297166d73496a8f78d97e22adf7f393))

## [1.1.17](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.17) - 2026-06-15

### Features

- **angular:** Duotone image-effect SVG filter injection (by @ChristopherVR) ([36ccab8](https://github.com/ChristopherVR/pptx-viewer/commit/36ccab85213b1fb21ab122043c8047ac916da6cb))
- **angular:** Advanced inspector tabs + table/chart data editing (by @ChristopherVR) ([0d21fa7](https://github.com/ChristopherVR/pptx-viewer/commit/0d21fa724d9b3182433f8dd1c9d0d3a98d9c24f5))
- **angular:** GIF & WebM video export (by @ChristopherVR) ([3f18a76](https://github.com/ChristopherVR/pptx-viewer/commit/3f18a76a1e6c80562fce868626c86674a49258dd))
- **angular:** Find & replace across slides (by @ChristopherVR) ([1dd7fbb](https://github.com/ChristopherVR/pptx-viewer/commit/1dd7fbb5ee3fcad5f623accce09cbfa6e59cafa7))
- **angular:** Wire signatures panel (parts-reading) into the viewer (by @ChristopherVR) ([d11afb9](https://github.com/ChristopherVR/pptx-viewer/commit/d11afb96195c998f9a56a218fa641b8adbf62fb6))
- **angular:** Wire share & broadcast dialogs into the viewer (by @ChristopherVR) ([fca4b2d](https://github.com/ChristopherVR/pptx-viewer/commit/fca4b2d2e374830fc5d940384f76e28710aceabc))
- **angular:** Wire presenter view into the viewer (by @ChristopherVR) ([19bf7a3](https://github.com/ChristopherVR/pptx-viewer/commit/19bf7a32b731707c7ad32e9c46a220cf61000bbe))
- **angular:** Play slide transitions in the presentation overlay (by @ChristopherVR) ([5f2c4cb](https://github.com/ChristopherVR/pptx-viewer/commit/5f2c4cb4857903ad701899b246d951668750d55e))
- **vue:** Master views, header/footer, sections & custom shows (by @ChristopherVR) ([b6a1dfb](https://github.com/ChristopherVR/pptx-viewer/commit/b6a1dfbfc931331d9986a030bae1d6a0e17ad10e))

### Bug Fixes

- **react:** Keep notes panel mounted when the virtual keyboard opens (by @ChristopherVR) ([a2f2efa](https://github.com/ChristopherVR/pptx-viewer/commit/a2f2efa61e9ebfa9977f200dfbcfeec11b328e6c))
- **react:** Commit inline text edit on touch tap-away (by @ChristopherVR) ([3599dcf](https://github.com/ChristopherVR/pptx-viewer/commit/3599dcfc428f1902c75501c3dd59eafd5eb2bba2))
- **angular:** Commit inline text edit deterministically on tap-away (by @ChristopherVR) ([1387cff](https://github.com/ChristopherVR/pptx-viewer/commit/1387cfffacbf0a01f9a579bbfeccda090b46769e))

### Documentation

- **angular:** Record parity push (charts, connectors, duotone, editor, export, subsystem wiring) (by @ChristopherVR) ([127a233](https://github.com/ChristopherVR/pptx-viewer/commit/127a2333f84eeb0ffb0956dd2a2d15518f18269e))

### Chores

- **angular:** Lockfile for jszip + fast-xml-parser deps (by @ChristopherVR) ([9ac5403](https://github.com/ChristopherVR/pptx-viewer/commit/9ac5403e8a624551f879d304b3cd2475484070d6))

## [1.1.16](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.16) - 2026-06-15

### Features

- **angular:** Add bubble & radar chart kinds (by @ChristopherVR) ([6ed5812](https://github.com/ChristopherVR/pptx-viewer/commit/6ed5812803704ca6c1bfe40d8faea42b5dc2a4ac))
- **angular:** Add combo, stock, surface, treemap, waterfall & regionMap charts (by @ChristopherVR) ([527a37f](https://github.com/ChristopherVR/pptx-viewer/commit/527a37fc32d39adc7263f45f0a9a446ce8c8c19a))
- **angular:** A\* connector routing + connector text overlay (by @ChristopherVR) ([01f58a8](https://github.com/ChristopherVR/pptx-viewer/commit/01f58a8328f94adaec836f7dc5f211c8667e91d0))
- **vue:** Editor-chrome parity — presenter view, print, shortcuts, doc properties (by @ChristopherVR) ([b8965b9](https://github.com/ChristopherVR/pptx-viewer/commit/b8965b9bb4bbd92814a9a79426dcfdd8a51288db))

### Refactor

- **angular:** Export chart chrome helpers for reuse (by @ChristopherVR) ([70f4334](https://github.com/ChristopherVR/pptx-viewer/commit/70f4334b595fd617761019452f06729a550bd31b))

### Documentation

- **angular:** Record bubble & radar chart kinds in PORTING.md (by @ChristopherVR) ([ea8dd22](https://github.com/ChristopherVR/pptx-viewer/commit/ea8dd226cca868fec18e1c6a2375d25ad942a03f))

## [1.1.15](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.15) - 2026-06-15

### Features

- **vue:** Resolve table banding by tableStyleMap GUID (by @ChristopherVR) ([c914b5c](https://github.com/ChristopherVR/pptx-viewer/commit/c914b5c8f3c2169373518582137c30fc90efa419))
- **vue:** Render connector text labels (by @ChristopherVR) ([22d5be3](https://github.com/ChristopherVR/pptx-viewer/commit/22d5be39029b6286760e54c05a409cf18cdd660b))
- **shared:** Add chart trendline regression engine (by @ChristopherVR) ([39dcb45](https://github.com/ChristopherVR/pptx-viewer/commit/39dcb4566b8199a676f751ba2c0b92185adc4e7b))
- **vue:** Chart trendlines, surface, and regionMap renderers (by @ChristopherVR) ([71f576f](https://github.com/ChristopherVR/pptx-viewer/commit/71f576f8d42332ea9a8f7840ce49239e37d36df3))

### Documentation

- **vue:** Record batch 17 (table GUIDs, connector labels, charts) (by @ChristopherVR) ([318b41a](https://github.com/ChristopherVR/pptx-viewer/commit/318b41aecd988eb364bded1038406ed8860eb181))

## [1.1.14](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.14) - 2026-06-15

### Features

- **vue:** Render exotic chart types (by @ChristopherVR) ([0e19ee4](https://github.com/ChristopherVR/pptx-viewer/commit/0e19ee4543c679043dfd3938f7fbf73b75fa4b87))
- **vue:** Bent, curved and compound connector routing (by @ChristopherVR) ([67d2899](https://github.com/ChristopherVR/pptx-viewer/commit/67d2899c6b409187580b6bc4fa43cc69add456e1))
- **vue:** SmartArt per-family fallback layouts (by @ChristopherVR) ([a2188cc](https://github.com/ChristopherVR/pptx-viewer/commit/a2188cc517b66f3f3f0d6da428201d09cbdbbaef))
- **vue:** Rich table cells, pattern fills and scheme-colour bands (by @ChristopherVR) ([ca98c05](https://github.com/ChristopherVR/pptx-viewer/commit/ca98c0506788c9a4637deaea0f853f324282833d))
- **angular:** Port comments, signatures, accessibility, fonts & animation (by @ChristopherVR) ([da06a1e](https://github.com/ChristopherVR/pptx-viewer/commit/da06a1e868ad2d6a2d91611555ae54df5bd6c45d))
- **angular:** Port collaboration, dialogs, print & presenter view (by @ChristopherVR) ([e80ca39](https://github.com/ChristopherVR/pptx-viewer/commit/e80ca39e5fb5d6973da0ac4305025577b94a86f5))
- **angular:** Wire advanced subsystems into PowerPointViewer (by @ChristopherVR) ([20b13e5](https://github.com/ChristopherVR/pptx-viewer/commit/20b13e56af852e3e332bb1a5a0c60db869a6f497))

### Bug Fixes

- **angular:** Drop legacy decorator flags from demo tsconfig (by @ChristopherVR) ([19d0586](https://github.com/ChristopherVR/pptx-viewer/commit/19d05865952e7442c07648e2d8795da40e1d4b9b))
- **angular:** Fit slide to viewport on mobile (by @ChristopherVR) ([329ccf3](https://github.com/ChristopherVR/pptx-viewer/commit/329ccf3aa5c1102c473f7ddfc2309781966add6e))
- **angular:** Emit contentChange from getContent (by @ChristopherVR) ([e2db75f](https://github.com/ChristopherVR/pptx-viewer/commit/e2db75f65f7ac256ecc5eef7c986742036b46a3b))
- **angular:** Gate document-properties save on canEdit (by @ChristopherVR) ([1ad8573](https://github.com/ChristopherVR/pptx-viewer/commit/1ad857388da8f57d014ca8f7cb78006bf85665b4))
- **deps:** Pin @xmldom/xmldom to 0.8.x in core to fix build (by @ChristopherVR) ([2ed7b2e](https://github.com/ChristopherVR/pptx-viewer/commit/2ed7b2e777d4e740a3e4c9ca7e2b3d6fc2bbd21f))

### Documentation

- **vue:** Record batch 16 render-fidelity work in PORTING.md (by @ChristopherVR) ([643fef9](https://github.com/ChristopherVR/pptx-viewer/commit/643fef94d8f334a155c42b029bbeec744344d472))
- **angular:** Record advanced-subsystem waves 1-2 in PORTING.md (by @ChristopherVR) ([63c78ff](https://github.com/ChristopherVR/pptx-viewer/commit/63c78ff996efe208540a1825d9c301feebb36956))
- **angular:** Record advanced-subsystem wiring in PORTING.md (by @ChristopherVR) ([ebc72a7](https://github.com/ChristopherVR/pptx-viewer/commit/ebc72a79bf5edb1c13d58a70b7b96a3cecc8a810))

### Styling

- **vue:** Reformat PORTING.md table to satisfy oxfmt (by @ChristopherVR) ([b71d989](https://github.com/ChristopherVR/pptx-viewer/commit/b71d989ead5f58ff3ee02a61e1f9ae50d35f5ead))

## [1.1.13](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.13) - 2026-06-15

### Bug Fixes

- **vue:** Fit slide to viewport on mobile (by @ChristopherVR) ([d210975](https://github.com/ChristopherVR/pptx-viewer/commit/d21097549a92a94c4f6a8d89134c2cf013abd71d))
- **angular:** Boot demo under Vite by loading the JIT compiler (by @ChristopherVR) ([1cf4d97](https://github.com/ChristopherVR/pptx-viewer/commit/1cf4d97d21db90bf7ac78976d300117c82ef0cac))

## [1.1.12](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.12) - 2026-06-15

### Bug Fixes

- **react:** Stop notes rich-editor reversing text on mobile (by @ChristopherVR) ([906fba5](https://github.com/ChristopherVR/pptx-viewer/commit/906fba586d0e6867fa30648c0a6d8f0ef58e739c))

### Refactor

- **shared:** Extract 3D + table render helpers (wave 2) (by @ChristopherVR) ([0348d81](https://github.com/ChristopherVR/pptx-viewer/commit/0348d819a407a6d615ad78ce373f16cefcebf803))

## [1.1.11](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.11) - 2026-06-15

### Features

- **angular:** Connector, table & clip-path renderers (by @ChristopherVR) ([12bb060](https://github.com/ChristopherVR/pptx-viewer/commit/12bb060841d9cdc2d473c5d3794f37502b6047eb))
- **vue:** Render tables and charts as native components (by @ChristopherVR) ([07a2106](https://github.com/ChristopherVR/pptx-viewer/commit/07a21069c2588b10627d75e8dd868a73971a058b))
- **vue:** Render SmartArt, ink, OLE, 3D, zoom + shape visual effects (by @ChristopherVR) ([740c068](https://github.com/ChristopherVR/pptx-viewer/commit/740c068ed5db47357e2a85885db712d6ac0a236a))
- **angular:** SVG charts and rich-text table cells (by @ChristopherVR) ([bbaa9b0](https://github.com/ChristopherVR/pptx-viewer/commit/bbaa9b0f2a6e18e90bc584f6e86d7a37c4842fed))
- **angular:** Bent & curved connector routing (by @ChristopherVR) ([dcdf98e](https://github.com/ChristopherVR/pptx-viewer/commit/dcdf98eb6de1f4c93bd0399ea3f65faafd751c6e))
- **angular:** SmartArt, ink, OLE, 3D, zoom renderers + shape effects (by @ChristopherVR) ([17d1ebb](https://github.com/ChristopherVR/pptx-viewer/commit/17d1ebbeba700d9bccafbfc00bb2d5bc87474f71))
- **vue:** Image effects, shape 3D, and equations (OMML→MathML) (by @ChristopherVR) ([1521de3](https://github.com/ChristopherVR/pptx-viewer/commit/1521de34f74d01299d64a45bd7a09ed6795b1133))
- **angular:** Full slide background (gradient + pattern) (by @ChristopherVR) ([8432577](https://github.com/ChristopherVR/pptx-viewer/commit/84325771fac58f9f29531a4adb74ef6f82c55f6a))
- **angular:** Render text hyperlinks (sanitized) (by @ChristopherVR) ([4f54680](https://github.com/ChristopherVR/pptx-viewer/commit/4f54680d44e2ff51750247f569d7e86bb75d59c3))
- **vue:** WordArt text-warp, structured fills, and editing foundation (by @ChristopherVR) ([1eaa3df](https://github.com/ChristopherVR/pptx-viewer/commit/1eaa3df78feaecaf194398d640da70c77763509c))
- **angular:** Structured gradients + OOXML pattern fills (by @ChristopherVR) ([74f1cc3](https://github.com/ChristopherVR/pptx-viewer/commit/74f1cc395cefc89751300357168777af8e5c7488))
- **angular:** SmartArt family layout fallback (by @ChristopherVR) ([26ec70d](https://github.com/ChristopherVR/pptx-viewer/commit/26ec70d27c4c4857baa060985cc57bd93235b99f))
- **vue:** Wire interactive editing (selection, drag/resize, toolbar) (by @ChristopherVR) ([c270c7a](https://github.com/ChristopherVR/pptx-viewer/commit/c270c7a69eedc7e51cbff1bd65d258ff8d1f1753))
- **angular:** Presentation mode, slide sorter, speaker notes (by @ChristopherVR) ([5652f42](https://github.com/ChristopherVR/pptx-viewer/commit/5652f428a57aef7750c6834500ce3389be1ddc0a))
- **vue:** Property inspector panels (arrange/fill/stroke/text/effects) (by @ChristopherVR) ([ed497f3](https://github.com/ChristopherVR/pptx-viewer/commit/ed497f346000f7f7af0563a42e0ab8cd38c73d64))
- **angular:** Bulleted/numbered lists + find-in-slides (by @ChristopherVR) ([8ace530](https://github.com/ChristopherVR/pptx-viewer/commit/8ace5304b011734096e72decfc6f380daaa6fcd5))
- **vue:** Slides pane, presentation mode, and context menu (by @ChristopherVR) ([782f1a0](https://github.com/ChristopherVR/pptx-viewer/commit/782f1a0da159ff0fb8ce3253cc2bb4c3201de3b2))
- **angular:** Render math equations (OMML→MathML) (by @ChristopherVR) ([fab2dd8](https://github.com/ChristopherVR/pptx-viewer/commit/fab2dd89c089a0b8622fab9aac22a5eb87d0a26c))
- **vue:** Find/replace, hyperlink dialog, reusable modal (by @ChristopherVR) ([53b7271](https://github.com/ChristopherVR/pptx-viewer/commit/53b72712b76da7566bb66389e9713d1e0a40e4f7))
- **vue:** Export to PNG/PDF + image & table inspector panels (by @ChristopherVR) ([6e8ca87](https://github.com/ChristopherVR/pptx-viewer/commit/6e8ca8779ee138dba2f17176b8ffffbf837f0110))
- **vue:** Accessibility checker, slide sorter, slide transitions (by @ChristopherVR) ([4f656ed](https://github.com/ChristopherVR/pptx-viewer/commit/4f656eded92e8b82d677dcb30696cadf5a0767eb))
- **angular:** PNG + PDF export (html2canvas-pro + jspdf) (by @ChristopherVR) ([e5aec3d](https://github.com/ChristopherVR/pptx-viewer/commit/e5aec3d58b84407629ca84292fe7c3407bd9d87e))
- **vue:** Animation, chart & notes panels (inspector set complete) (by @ChristopherVR) ([a9bb990](https://github.com/ChristopherVR/pptx-viewer/commit/a9bb99004904fc467e4c5e25d8554512642bcb2c))
- **angular:** Editor foundation (history + element ops + state service) (by @ChristopherVR) ([daaad13](https://github.com/ChristopherVR/pptx-viewer/commit/daaad13bec834468c3fd27daff1150185b512c8b))
- **angular:** Editor interaction (select + keyboard editing) (by @ChristopherVR) ([199394f](https://github.com/ChristopherVR/pptx-viewer/commit/199394f4e92d948098cc771a8f1734f7b6970273))
- **angular:** Persist edits through getContent (save-back) (by @ChristopherVR) ([02d2ff4](https://github.com/ChristopherVR/pptx-viewer/commit/02d2ff43afe0efd2a385e24ece0ebbcee38ae957))
- **vue:** Align/distribute/group tools + autosave (by @ChristopherVR) ([ea68c38](https://github.com/ChristopherVR/pptx-viewer/commit/ea68c380599ed3484503ee8e0eefbfb32762f86f))
- **angular:** Drag-to-move and resize handles (by @ChristopherVR) ([38799a6](https://github.com/ChristopherVR/pptx-viewer/commit/38799a69bffba40606fbea433724de9ef9e52f3a))
- **angular:** Editor inspector panel (by @ChristopherVR) ([7e17ecf](https://github.com/ChristopherVR/pptx-viewer/commit/7e17ecfd468f6ab7a24d68d43da61376751797bc))
- **angular:** Slide CRUD + element insert in editor state (by @ChristopherVR) ([9a5ac62](https://github.com/ChristopherVR/pptx-viewer/commit/9a5ac6257cac7f484fa320f6fb87914f330c718f))
- **angular:** Editor slides panel + insert/arrange toolbar (by @ChristopherVR) ([71474bc](https://github.com/ChristopherVR/pptx-viewer/commit/71474bc679a41be2d7ebd9f25ba33947a93cd6b3))
- **angular:** Clipboard (cut/copy/paste) for elements (by @ChristopherVR) ([18e4b0f](https://github.com/ChristopherVR/pptx-viewer/commit/18e4b0f210ba798d674977bb2d42d8130b372cb2))
- **vue:** Comments, animation playback, share & properties dialogs (by @ChristopherVR) ([9027c6c](https://github.com/ChristopherVR/pptx-viewer/commit/9027c6cd1a5546b41467a708cf9c1bacde239a0f))
- **angular:** Right-click context menu for the editor (by @ChristopherVR) ([2eeb39e](https://github.com/ChristopherVR/pptx-viewer/commit/2eeb39ed0054775f3a77359fa6d077c4446c90e4))
- **angular:** Inline text editing (double-click) (by @ChristopherVR) ([358fd2d](https://github.com/ChristopherVR/pptx-viewer/commit/358fd2d73b033c1d7d7ce9f6a29338214318d16f))
- **angular:** Align & distribute tools (by @ChristopherVR) ([904f4db](https://github.com/ChristopherVR/pptx-viewer/commit/904f4dba1643e4a2e015abbfcf297eeaeed51951))
- **vue:** Yjs collaboration, digital signatures, embedded fonts (by @ChristopherVR) ([1117e41](https://github.com/ChristopherVR/pptx-viewer/commit/1117e41f17b06d2c65a6629024092c5983266a84))
- **angular:** Rotation handle for selected element (by @ChristopherVR) ([af51f74](https://github.com/ChristopherVR/pptx-viewer/commit/af51f74ef2f15351397ec7e65e5f7d79f57372f4))
- **angular:** Marquee (rubber-band) multi-selection (by @ChristopherVR) ([167c0d7](https://github.com/ChristopherVR/pptx-viewer/commit/167c0d76551ce197dcfa30a36f8a03464c1f0408))
- **angular:** Group & ungroup elements (by @ChristopherVR) ([138b923](https://github.com/ChristopherVR/pptx-viewer/commit/138b9234e5870ef52729d84f985abbad71c6bc8f))
- **vue:** Broadcast dialog, mobile chrome, animation-preset fix (by @ChristopherVR) ([c01e4c6](https://github.com/ChristopherVR/pptx-viewer/commit/c01e4c6389a950d7ef2ea8f38e359a945ad63b0d))
- **angular:** Select-all + group keyboard shortcuts (by @ChristopherVR) ([f6d6318](https://github.com/ChristopherVR/pptx-viewer/commit/f6d6318f7fa99fe2fefc0147841ce1f51605c7da))
- **angular:** Alignment snap guides while dragging (by @ChristopherVR) ([615fab2](https://github.com/ChristopherVR/pptx-viewer/commit/615fab231ebacbcfe1efcda74b1a4270df99ffad))
- **angular:** Slide property editing (background + notes) (by @ChristopherVR) ([9ec6d55](https://github.com/ChristopherVR/pptx-viewer/commit/9ec6d55c4e0eac60e4ace4101c0e665708066216))

### Bug Fixes

- **angular:** Mobile/touch support across the viewer & editor (by @ChristopherVR) ([6fa9dc7](https://github.com/ChristopherVR/pptx-viewer/commit/6fa9dc7fd6b8a91807af5cf7071574244761b2f2))
- **react:** Mobile/touch support across the viewer & editor (by @ChristopherVR) ([3efa3df](https://github.com/ChristopherVR/pptx-viewer/commit/3efa3df462ad4daf4082890577887c081b2a742c))
- **vue:** Mobile/touch support across the viewer (by @ChristopherVR) ([cb96b8d](https://github.com/ChristopherVR/pptx-viewer/commit/cb96b8d132371c490d96667bea4c0a74cf14df4f))

### Refactor

- **shared:** Extract framework-agnostic render helpers + fix props persist (by @ChristopherVR) ([5b215a8](https://github.com/ChristopherVR/pptx-viewer/commit/5b215a8302feaa3e7e501cee455b3a1d61715cb7))

### Documentation

- **angular:** Update PORTING for charts, table rich text, connector routing (by @ChristopherVR) ([3baddb5](https://github.com/ChristopherVR/pptx-viewer/commit/3baddb5363294aa2bcbe08c18f51a7b8a0be4f1d))
- **angular:** Update PORTING for SmartArt/ink/OLE/3D/zoom + effects (by @ChristopherVR) ([d5393c6](https://github.com/ChristopherVR/pptx-viewer/commit/d5393c6269812941f2314f03e33432c076f39c79))
- **angular:** Record slide background + hyperlink rendering (by @ChristopherVR) ([0c21fe3](https://github.com/ChristopherVR/pptx-viewer/commit/0c21fe31ad18006c97807b0ea3c3e39bb950d163))
- **angular:** Update PORTING for parity waves 1-3 (by @ChristopherVR) ([e51e7b9](https://github.com/ChristopherVR/pptx-viewer/commit/e51e7b98e4ee833a28f4f2e2ba1cc0e8b8af881b))
- **angular:** Record export + editor foundation in PORTING (by @ChristopherVR) ([d6f494d](https://github.com/ChristopherVR/pptx-viewer/commit/d6f494df7c59b0f88c9b4a66bce5705c43c4603c))
- **angular:** Mark editor interaction UI + save-back done (by @ChristopherVR) ([ce0fddf](https://github.com/ChristopherVR/pptx-viewer/commit/ce0fddff33728155cee86930c5f530c66ed400d3))
- **angular:** Record drag/resize + inspector panel (by @ChristopherVR) ([04dd906](https://github.com/ChristopherVR/pptx-viewer/commit/04dd9069dec0a384bda83d7d1a8262eb39fb5eba))
- **angular:** Record editor chrome (panels, toolbar, clipboard, align) (by @ChristopherVR) ([69ba935](https://github.com/ChristopherVR/pptx-viewer/commit/69ba9354218ea9ce3066ea84fa4fa60659ff85d8))
- **angular:** Record rotation/marquee/group + direct-manipulation complete (by @ChristopherVR) ([bb45ccd](https://github.com/ChristopherVR/pptx-viewer/commit/bb45ccd938b83881d735f205a245c1eb1df3d8c3))
- **angular:** Record snap guides + slide props; parity summary (by @ChristopherVR) ([f748b18](https://github.com/ChristopherVR/pptx-viewer/commit/f748b1871307c97e2c81b2fa64cc9611f2b559d1))

## [1.1.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.10) - 2026-06-14

### Features

- **angular:** Image & gradient fills in element-style (by @ChristopherVR) ([2457aa2](https://github.com/ChristopherVR/pptx-viewer/commit/2457aa2163e6e6504aa36d464d3686d58f625338))
- **vue:** Preset-geometry clip-paths for shape rendering (by @ChristopherVR) ([bc37eda](https://github.com/ChristopherVR/pptx-viewer/commit/bc37edaabdbec0ffb3a75be5afab9fc505d85755))

### Bug Fixes

- **core:** Make parsed element IDs unique per slide (by @ChristopherVR) ([d107523](https://github.com/ChristopherVR/pptx-viewer/commit/d1075231200fd0f5a2f07168b618f123554403b8))
- **react:** Persist in-progress inline text edit on save (by @ChristopherVR) ([6b917d7](https://github.com/ChristopherVR/pptx-viewer/commit/6b917d7a560a825ed439ba8560a333660bcabaaf))
- **react:** Improve host-app CSS compatibility for buttons and dialogs (by @ChristopherVR) ([e07e883](https://github.com/ChristopherVR/pptx-viewer/commit/e07e883b775fc075849ad52770a6a9fdb1467651))

### Documentation

- Adopt trunk-based development workflow (by @ChristopherVR) ([eb19ac5](https://github.com/ChristopherVR/pptx-viewer/commit/eb19ac5ab21db04fb069bc164994634b91ca53bf))

### Build & CI

- Publish pptx-angular-viewer in release pipeline (by @ChristopherVR) ([f2a84d4](https://github.com/ChristopherVR/pptx-viewer/commit/f2a84d44d29eed8549e859b97c40041162ace622))

## [1.1.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.9) - 2026-06-14

### Bug Fixes

- Format issues (by @ChristopherVR) ([cc84180](https://github.com/ChristopherVR/pptx-viewer/commit/cc84180ed35b273283fb679b667be15d82ef2a55))

## [1.1.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.8) - 2026-06-14

### Features

- **vue:** Add pptx-vue-viewer package + bundled pptx-viewer-shared (by @ChristopherVR) ([1b7a958](https://github.com/ChristopherVR/pptx-viewer/commit/1b7a958ce91792a6d174f174932800bc8ff40ef9))
- **vue:** Live thumbnail previews + gradient/image fills (by @ChristopherVR) ([b13f27e](https://github.com/ChristopherVR/pptx-viewer/commit/b13f27e6b878e712d97365f6984d9378849ca122))
- **demo-vue:** Add Vite + Vue 3 demo app for pptx-vue-viewer (by @ChristopherVR) ([905abd5](https://github.com/ChristopherVR/pptx-viewer/commit/905abd558f12f2a95651d92a7ff2cd2d22d37c01))
- **vue:** Render straight connectors as SVG (by @ChristopherVR) ([e2b9521](https://github.com/ChristopherVR/pptx-viewer/commit/e2b95214d434fba2e293e753892ed57d6a60bfd0))
- **angular:** Add pptx-angular-viewer package + demo (by @ChristopherVR) ([81255a9](https://github.com/ChristopherVR/pptx-viewer/commit/81255a9251e855bc51b97c8dc68b55e71e206882))
- Added demo site for github pages (by @ChristopherVR) ([83a8758](https://github.com/ChristopherVR/pptx-viewer/commit/83a8758a2854a3e4296483fc1ff5d35dd41dd4ec))

### Bug Fixes

- **angular:** Import CanvasSize from the vendored shared barrel (by @ChristopherVR) ([e09dd5c](https://github.com/ChristopherVR/pptx-viewer/commit/e09dd5c6377e92091d81cfe59444b13ed2719a9d))
- **build:** Make all packages build + publish cleanly; align Vue README (by @ChristopherVR) ([7db5de6](https://github.com/ChristopherVR/pptx-viewer/commit/7db5de6a343887fc1a32dd526ae1ab68e1e3e6e0))

### Refactor

- **react:** Consume theme + loader from pptx-viewer-shared (by @ChristopherVR) ([1b93d1f](https://github.com/ChristopherVR/pptx-viewer/commit/1b93d1fccff378b0ac402810a0cbddea46add29c))
- **demos:** Move demo apps under demos/ and rename React demo (by @ChristopherVR) ([ab51018](https://github.com/ChristopherVR/pptx-viewer/commit/ab51018ff3662b500256b311478ef208185e4b64))
- **angular:** Keep core peer as workspace:\*, resolve at build time (by @ChristopherVR) ([b123ac9](https://github.com/ChristopherVR/pptx-viewer/commit/b123ac99e9611b7f585197d827ba2ac35217997e))

### Documentation

- Add documentation site (by @ChristopherVR) ([2c2145c](https://github.com/ChristopherVR/pptx-viewer/commit/2c2145cbf740e26423f7f27314e6b078aa22dde9))
- **readme:** Npm-friendly READMEs — hero image, capabilities & install first (by @ChristopherVR) ([c843d19](https://github.com/ChristopherVR/pptx-viewer/commit/c843d1934b846f901bba92e63d2b01f9479594d0))
- **site:** Fix package naming, license, and add a showcase to VitePress (by @ChristopherVR) ([04f9674](https://github.com/ChristopherVR/pptx-viewer/commit/04f96745b91540060ab725392d2a7910b3fa16d1))
- **assets:** Replace editor.png with a logo-free sample deck (by @ChristopherVR) ([08cbbed](https://github.com/ChristopherVR/pptx-viewer/commit/08cbbedc7bbe29716c17e298d91589f2e690d276))
- Remove obsolete followup notes (by @ChristopherVR) ([69c2439](https://github.com/ChristopherVR/pptx-viewer/commit/69c2439dc1d273af9be890076a483f1f81a40e89))

### Build & CI

- **react,vue:** Self-contained, minified, precompressed dist + vue CI (by @ChristopherVR) ([aa28df9](https://github.com/ChristopherVR/pptx-viewer/commit/aa28df916eee064ac502c01be3445e8c84ad37f6))
- Add dependabot config (by @ChristopherVR) ([660c80a](https://github.com/ChristopherVR/pptx-viewer/commit/660c80a15dcf2d40782c506b07424f27d385ba8f))

### Dependencies

- **deps:** Update all dependencies to latest (by @ChristopherVR) ([e3287c0](https://github.com/ChristopherVR/pptx-viewer/commit/e3287c03ff58b1a1ae103ed32a513468a454a084))
- **deps:** Update dependencies and CI actions to latest (by @ChristopherVR) ([b1a84a2](https://github.com/ChristopherVR/pptx-viewer/commit/b1a84a26814bfdb9b5d5ef7dd87aeabc4fa82c04))

### Chores

- Relicense from MIT to Apache-2.0 (by @ChristopherVR) ([e12f926](https://github.com/ChristopherVR/pptx-viewer/commit/e12f9266f02bebbfc218986b617c418fee43a56b))

## [1.1.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.7) - 2026-05-23

### Features

- **core:** Resolve layout display names + master path on PptxLayoutOption (by @ChristopherVR) ([be0c5d9](https://github.com/ChristopherVR/pptx-viewer/commit/be0c5d91d2f3271d5da6eabeffe199b83a8c45a2))
- **editor:** Scoped layout picker + format-painter UX polish (by @ChristopherVR) ([5cdfce7](https://github.com/ChristopherVR/pptx-viewer/commit/5cdfce7d04beca1aac5e8914a0288afe4fb895dd))
- **react:** Mobile-first viewer chrome (toolbar, sheets, bottom bar) (by @ChristopherVR) ([2588a19](https://github.com/ChristopherVR/pptx-viewer/commit/2588a19f5c71ee36c4b3cbbaff652e79dc571639))
- **core:** Typed xml-access helpers for fast-xml-parser output (by @ChristopherVR) ([a25e9b3](https://github.com/ChristopherVR/pptx-viewer/commit/a25e9b36ea8ff7678e529318461ad54356f468ca))

### Bug Fixes

- **react:** Remove dead `=== true` table-cell merge comparisons (by @ChristopherVR) ([fb00142](https://github.com/ChristopherVR/pptx-viewer/commit/fb00142c07fdf6c221e1787991bed55d02fd0123))

### Refactor

- Strongly type XmlObject and eliminate `any` across packages (by @ChristopherVR) ([5cc51cc](https://github.com/ChristopherVR/pptx-viewer/commit/5cc51cca8bab013a8fee2db2d9f31666b496f116))

### Testing

- **react:** Drop obsolete narrow-viewport Toolbar tests (by @ChristopherVR) ([554e98e](https://github.com/ChristopherVR/pptx-viewer/commit/554e98e353167b20945a66bbfe31a2091e69c0b0))

### Chores

- **e2e:** Add Playwright e2e harness with format-painter spec (by @ChristopherVR) ([da88226](https://github.com/ChristopherVR/pptx-viewer/commit/da882266bcc46acc0c8dc83cc4c6ba6454a7a3b5))

## [1.1.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.6) - 2026-05-07

### Features

- **core:** Parse and round-trip animation keyframes and animMotion/Rot/Scale attrs (by @ChristopherVR) ([ae03807](https://github.com/ChristopherVR/pptx-viewer/commit/ae03807bacd3c98dc839487ee57759e6b22f094d))
- **core:** Close txBody parity gaps (rot, anchorCtr, spcFirstLastPara, rtlCol, br, math) (by @ChristopherVR) ([a043605](https://github.com/ChristopherVR/pptx-viewer/commit/a043605d80b6543ad87ce79718ded7d62f54c1ad))
- **core:** Support ofPieChart, view3D, and chart chrome flags (by @ChristopherVR) ([45a4b02](https://github.com/ChristopherVR/pptx-viewer/commit/45a4b026738d83591d4e6a4ad0e8060516273bd5))
- **core:** Theme/background parity (phClr, tx1 alias, gamma, bgRef idx, shadeToTitle, pattFill) (by @ChristopherVR) ([8da6b93](https://github.com/ChristopherVR/pptx-viewer/commit/8da6b93c03d7f433b112f835ac910e69b9434be6))
- **core:** Theme/background parity (phClr, tx1 alias, gamma, bgRef idx, shadeToTitle, pattFill) (by @ChristopherVR) ([06ee28d](https://github.com/ChristopherVR/pptx-viewer/commit/06ee28d19320402f8f722abf0ea1a8cad674d483))
- **core:** Expand animation preset catalog to full PowerPoint library (by @ChristopherVR) ([4b3867c](https://github.com/ChristopherVR/pptx-viewer/commit/4b3867c82515d792d1fc592d510f0d9a7c69573e))
- **core:** Wire viewProps and tableStyles save writers (by @ChristopherVR) ([b14f510](https://github.com/ChristopherVR/pptx-viewer/commit/b14f510095cc8c3deebde6b83b49694056215d1e))
- **core:** Tier-3 ECMA-376 parity partial completion (8 domains) (by @ChristopherVR) ([85e3fc2](https://github.com/ChristopherVR/pptx-viewer/commit/85e3fc259584eea1b2faa52c725bdd99d296fe11))
- **core:** Apply image effects in SVG converter via SVG filter chain (by @ChristopherVR) ([db0c7cd](https://github.com/ChristopherVR/pptx-viewer/commit/db0c7cd9d4e614d186d981d892c5155009b1384d))
- **react:** Port image alpha primitives to viewer renderer (by @ChristopherVR) ([a41df2a](https://github.com/ChristopherVR/pptx-viewer/commit/a41df2aefb725b7883a26538c748891365901549))
- **react:** Action-button glyph overlays in slide renderer (by @ChristopherVR) ([ec0053d](https://github.com/ChristopherVR/pptx-viewer/commit/ec0053d929927d40bfa2d72839b32eb9daf63211))
- **core:** Cloud and cloudCallout Bezier path upgrade for high-DPI rendering (by @ChristopherVR) ([0247b09](https://github.com/ChristopherVR/pptx-viewer/commit/0247b09fc1be1c4545a521e13201ce018cf54fe6))
- **core:** Adjustment-aware geometry for pie/arc/donut/blockArc/wedge\*Callout/circularArrow/swooshArrow/cloudCallout (by @ChristopherVR) ([132a4cd](https://github.com/ChristopherVR/pptx-viewer/commit/132a4cdc99010fe2c11e9c32213e921588864b60))
- **core:** Spec-correct preset shape evaluator (30 shapes, gdLst-driven, adjustment-aware) (by @ChristopherVR) ([249b021](https://github.com/ChristopherVR/pptx-viewer/commit/249b021dc1576dc2bf0f7cb8613eb76174da2b79))
- **react:** Wire preset/adjustment/cloud geometry APIs into shape renderer (by @ChristopherVR) ([acebf79](https://github.com/ChristopherVR/pptx-viewer/commit/acebf79e7d1f6cec0c766276802d28a5a9a87621))
- **core:** Preset shape definitions for 28 flowchart shapes (by @ChristopherVR) ([15146d6](https://github.com/ChristopherVR/pptx-viewer/commit/15146d69dbae0a9aa14f619ec4ad3487490bdae8))
- **core:** Preset shape definitions for arrows + 3D primitives (~25 shapes) (by @ChristopherVR) ([76e113a](https://github.com/ChristopherVR/pptx-viewer/commit/76e113a813e4fcd9d4fafb2676a2c52f5b6dac7f))
- **core:** Preset shape definitions for stars + ribbons + callouts + math + decorations (~30 shapes) (by @ChristopherVR) ([743d592](https://github.com/ChristopherVR/pptx-viewer/commit/743d59208069e4418edf701313ecadfa2518a170))
- **core:** Aggregate arrow/flowchart/misc preset batches into master table (by @ChristopherVR) ([591625d](https://github.com/ChristopherVR/pptx-viewer/commit/591625df11de1f35f4d5d216333f1a23fffabbc2))
- **core:** Preset shape definitions for curved arrows and bent connectors (by @ChristopherVR) ([5bd0baf](https://github.com/ChristopherVR/pptx-viewer/commit/5bd0bafde51d30a59bf8597713ef298f521e0afa))
- **core:** Preset shape definitions for round/snip rect family + foldedCorner/teardrop/corner (by @ChristopherVR) ([67b2aca](https://github.com/ChristopherVR/pptx-viewer/commit/67b2aca28dc28b99e72ddd43ce39e3a8a89e9d7a))
- **core:** Preset shape definitions for arrow callouts + leftUpArrow (by @ChristopherVR) ([4fe834c](https://github.com/ChristopherVR/pptx-viewer/commit/4fe834cc58553936dadbd35946a7480fb1584c1f))
- **core:** Refine 8 arrow shapes with full ECMA-376 gdLst formulas (by @ChristopherVR) ([870983b](https://github.com/ChristopherVR/pptx-viewer/commit/870983b6900ce0ffbf8bcfa68674a12f6f09d763))
- **core:** Preset shape definitions for tabs/gears/decorations (by @ChristopherVR) ([c203306](https://github.com/ChristopherVR/pptx-viewer/commit/c20330680f3b7e1ac87a0c8b4ed4eb4149f8b3bc))
- **core:** Refine 8 arrow shapes with full ECMA-376 gdLst formulas (refined file) (by @ChristopherVR) ([c2273aa](https://github.com/ChristopherVR/pptx-viewer/commit/c2273aa5c5f3a412e8a006d3002d668bd19a67d7))
- **core:** Preset shape definitions for 12 actionButton\* shapes (by @ChristopherVR) ([fdaa29a](https://github.com/ChristopherVR/pptx-viewer/commit/fdaa29a9a5922ef705587589861b04997fa8ab4e))
- **core:** Aggregate 8 batch files into master preset shape table (by @ChristopherVR) ([5bdb46a](https://github.com/ChristopherVR/pptx-viewer/commit/5bdb46a19c3c360f0dc1ce1bab1de1c5ad81c0b2))

### Bug Fixes

- **core:** Correct OLE link/embed discriminator and media embed serialization (by @ChristopherVR) ([476c7fc](https://github.com/ChristopherVR/pptx-viewer/commit/476c7fc5fee35092bc2ccef87b71bf30a4ae71b3))
- **core:** Correct slide transition serialization (morph extLst, p14 3D, cut thruBlk, endSnd) (by @ChristopherVR) ([8f7b449](https://github.com/ChristopherVR/pptx-viewer/commit/8f7b4491d6993b114bf2eec0b4cf5a74d57093bf))

### Documentation

- **geometry:** Update followups to reflect shipped work (by @ChristopherVR) ([f685e35](https://github.com/ChristopherVR/pptx-viewer/commit/f685e358f11b5066ef44ca22edf28b1ced6543cc))

## [1.1.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.5) - 2026-05-06

### Bug Fixes

- Close security & performance findings from full-codebase review (by @ChristopherVR) ([7edda8a](https://github.com/ChristopherVR/pptx-viewer/commit/7edda8a1860002cc72bd78ca1830949b02dab2c9))

## [1.1.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.4) - 2026-05-05

### Features

- ECMA-376 parity pass across parse and save layers (by @ChristopherVR) ([b110e26](https://github.com/ChristopherVR/pptx-viewer/commit/b110e26583d72c78911d9e9598258695cbb6981a))

### Chores

- Bump dependencies to latest and minor-bump packages for parity work (by @ChristopherVR) ([da19fdf](https://github.com/ChristopherVR/pptx-viewer/commit/da19fdf9a4670d274d9973b67aa22d34217b8555))
- Roll TypeScript back to 5.9.x; quiet new oxlint vitest rules (by @ChristopherVR) ([713c020](https://github.com/ChristopherVR/pptx-viewer/commit/713c020ac2428db0fb1eb6cb30e56b2cff19a80f))

## [1.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.3) - 2026-04-18

### Features

- **save:** Replicate PowerPoint "Insert Table" defaults on SDK tables (by @ChristopherVR) ([c016ba3](https://github.com/ChristopherVR/pptx-viewer/commit/c016ba3a240c7aa41621e4deaabbbe8d41313233))
- **save:** Emit a16:colId and endParaRPr@dirty on SDK tables (by @ChristopherVR) ([400e7e8](https://github.com/ChristopherVR/pptx-viewer/commit/400e7e8718b639db27b8a44cd453f7a5bb5d0e50))

### Bug Fixes

- **save:** Serialize new-presentation templates and SDK-created tables (by @ChristopherVR) ([3dab9e4](https://github.com/ChristopherVR/pptx-viewer/commit/3dab9e43c583df5ca4b207fceaed7db635b0f69a))
- **save:** Emit table cell <a:rPr> before <a:t> per CT_RegularTextRun (by @ChristopherVR) ([11a7ade](https://github.com/ChristopherVR/pptx-viewer/commit/11a7ade46c134cc5d4da2642a6686e51e8d2a6dd))

### Chores

- Bump all packages to minor versions for SDK table support (by @ChristopherVR) ([2d4b635](https://github.com/ChristopherVR/pptx-viewer/commit/2d4b6351b0bf328f8a556cf593733fd8ad36c7b5))

## [1.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.2) - 2026-04-17

### Features

- Implement OpenXML specification gap closures (by @ChristopherVR) ([80b6939](https://github.com/ChristopherVR/pptx-viewer/commit/80b69398ff780ad05af40adc57695e9ed05fbcff))
- Add element name parsing, barrel exports, and gradient improvements (by @ChristopherVR) ([61aa8c0](https://github.com/ChristopherVR/pptx-viewer/commit/61aa8c060e344264e03d66cf005a0cd253ec79b0))
- **collab:** Add connection timeout and retry for WebSocket (by @ChristopherVR) ([73219b9](https://github.com/ChristopherVR/pptx-viewer/commit/73219b9c00e6ee0f78265e8bf71f7dddf1c9873e))
- **export:** Add Save as .pptx toolbar action (by @ChristopherVR) ([dc03f69](https://github.com/ChristopherVR/pptx-viewer/commit/dc03f6903c35681c96a78143c0a36a1c9206cf1a))

### Bug Fixes

- **mtx-decompressor:** Fix 8 bugs in MTX font decompression pipeline (by @ChristopherVR) ([43d43e3](https://github.com/ChristopherVR/pptx-viewer/commit/43d43e3cd86d48425e7327b45416e63ce1e040e4))
- **react:** Wire up format painter to copy and apply element formatting (by @ChristopherVR) ([1f1b795](https://github.com/ChristopherVR/pptx-viewer/commit/1f1b795b75bc557d6bdce83fbc5bca22edbe8d45))
- **animations:** Wire up Add Animation dropdown and Remove Animation button in toolbar (by @ChristopherVR) ([33d01d5](https://github.com/ChristopherVR/pptx-viewer/commit/33d01d5b94dc7a215eef5f686afe455045c6e859))
- **save:** Preserve embedded fonts and rId-referenced backgrounds on round-trip (by @ChristopherVR) ([a6cd733](https://github.com/ChristopherVR/pptx-viewer/commit/a6cd73315e919be6fb53af96c292709025c49460))
- **save:** Stop emitting <p:hf> at p:presentation root (by @ChristopherVR) ([32c067b](https://github.com/ChristopherVR/pptx-viewer/commit/32c067bd66dcbc9e10a2a805f608b3794087668b))
- **save:** Emit <p:showPr> children in schema order in presProps.xml (by @ChristopherVR) ([ec9da70](https://github.com/ChristopherVR/pptx-viewer/commit/ec9da70b2b14fe804cd63c6273e8c28a7d18355d))
- **save:** Strip ZIP directory entries before emitting the package (by @ChristopherVR) ([6aa953d](https://github.com/ChristopherVR/pptx-viewer/commit/6aa953d3aaca8f1fd565e47635ec8b9868d646a9))
- **save:** Don't overwrite EMF/WMF parts with converted PNG bytes (by @ChristopherVR) ([0bfdfd6](https://github.com/ChristopherVR/pptx-viewer/commit/0bfdfd64ec9b0d59b94beff2f6fcaf85e364e61f))
- **save:** Preserve element text literally instead of coercing to numbers (by @ChristopherVR) ([884bd7b](https://github.com/ChristopherVR/pptx-viewer/commit/884bd7b9103960a96c150b258f91301cf7a215fb))

### Testing

- **core:** Remove two obsolete svg-snapshots entries (by @ChristopherVR) ([b57740a](https://github.com/ChristopherVR/pptx-viewer/commit/b57740a828e2b2d5bd641a5742e5282d25e0667f))

### Chores

- Fix formatting and lint warnings across test suite (by @ChristopherVR) ([510c4f3](https://github.com/ChristopherVR/pptx-viewer/commit/510c4f359f3db710922adecd59d99350e09c4386))
- Update dependencies and CI configuration (by @ChristopherVR) ([1dc8465](https://github.com/ChristopherVR/pptx-viewer/commit/1dc8465ea51f1691ce9e025fedd7cf2b0d996b50))
- **test:** Fix preexisting lint warnings in Toolbar tests (by @ChristopherVR) ([c33b7b7](https://github.com/ChristopherVR/pptx-viewer/commit/c33b7b72eaef6389bcbdbe8c50bca623a48cfb80))
- Repair broken test assertions and clean up lint config (by @ChristopherVR) ([cc9b392](https://github.com/ChristopherVR/pptx-viewer/commit/cc9b3920e50b7a21d93a2b19b559a69759dad897))
- Bump all packages to 1.x.1 patch versions (by @ChristopherVR) ([c75205a](https://github.com/ChristopherVR/pptx-viewer/commit/c75205a96cc7797d1647ac4705395b7707ac8910))

## [1.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.1) - 2026-04-10

### Bug Fixes

- **ci:** Resolve npm publish version mismatch and add duplicate check (by @ChristopherVR) ([4f962fd](https://github.com/ChristopherVR/pptx-viewer/commit/4f962fdeeac95a6a38b8b6ab99139223ef7471da))

## [1.0.12](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.12) - 2026-04-09

### Features

- **react:** Implement functional Broadcast slide show with Yjs collaboration (by @ChristopherVR) ([67bdc71](https://github.com/ChristopherVR/pptx-viewer/commit/67bdc715f98cada5fa1f1048e6ef4b0582047d1d))
- **react:** Add collaboration overlays, eraser tool, and UI enhancements (by @ChristopherVR) ([84acc33](https://github.com/ChristopherVR/pptx-viewer/commit/84acc33db713b4c0278e60a9e60acfc103efe974))

## [1.0.11](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.11) - 2026-04-09

### Features

- **react:** Restructure toolbar into PowerPoint-style ribbon (by @ChristopherVR) ([ba04e83](https://github.com/ChristopherVR/pptx-viewer/commit/ba04e83deb58530acff86199695e8493cec70460))
- **react:** Redesign status bar with zoom, view modes, and notes toggle (by @ChristopherVR) ([49c01fb](https://github.com/ChristopherVR/pptx-viewer/commit/49c01fb1e555882cf78495f2a951d838dc3c5fd0))
- **react:** Restyle slide panel, custom scrollbars, and layout polish (by @ChristopherVR) ([e9ae32e](https://github.com/ChristopherVR/pptx-viewer/commit/e9ae32eeef361c2469f5587cc475750c2b3071f2))
- **react:** Add File, Animations, Slide Show tabs and enhance existing toolbar sections (by @ChristopherVR) ([503b01d](https://github.com/ChristopherVR/pptx-viewer/commit/503b01d0854890ebac1bb91bde1ad7ba0dbbb5ab))
- **react:** Add Settings dialog and Share collaboration dialog (by @ChristopherVR) ([8d21abe](https://github.com/ChristopherVR/pptx-viewer/commit/8d21abe90b479e7ca27c41273f047ea52db40c41))
- **react:** Implement full document sync via yJS CRDTs (by @ChristopherVR) ([bafda7a](https://github.com/ChristopherVR/pptx-viewer/commit/bafda7a8b63183fdbe47bd36d9ea6a8b61d7d331))
- **demo:** Add collaboration server, URL-based joining, and New Presentation button (by @ChristopherVR) ([0246d40](https://github.com/ChristopherVR/pptx-viewer/commit/0246d408dc06b8701131922965c36e9ac428198d))

### Bug Fixes

- **i18n:** Replace hardcoded English strings with t() translation calls (by @ChristopherVR) ([765368b](https://github.com/ChristopherVR/pptx-viewer/commit/765368bf8f40e5e0424a4de1d9d93bc498cc1886))
- **test:** Add i18n mocks to react tests and bump versions to 1.2.0 (by @ChristopherVR) ([2c1c962](https://github.com/ChristopherVR/pptx-viewer/commit/2c1c9628714b905b28592493abf02fb270107b65))

### Testing

- **react:** Add comprehensive toolbar, status bar, and collaboration tests (by @ChristopherVR) ([cd02206](https://github.com/ChristopherVR/pptx-viewer/commit/cd02206c1d84df8561b4170c7b8b53d228da8640))
- **tools:** Add comprehensive MCP package tests (192 total) (by @ChristopherVR) ([97a3303](https://github.com/ChristopherVR/pptx-viewer/commit/97a33038542988b7a32c3478998b626fa2c7f4d5))

### Chores

- Apply linter auto-fixes, template literals, and update gitignore (by @ChristopherVR) ([ce1288e](https://github.com/ChristopherVR/pptx-viewer/commit/ce1288edb1c4572a3bc8b33624cd69086c56d134))

## [1.0.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.10) - 2026-03-29

### Build & CI

- Add @pptx-viewer/tools to test, release, and publish pipeline (by @ChristopherVR) ([0e2ff95](https://github.com/ChristopherVR/pptx-viewer/commit/0e2ff9579a8ea039d4367d69f13998560ee9313d))

### Chores

- Rename package to pptx-viewer-mcp and publish to npm (by @ChristopherVR) ([9cb8a25](https://github.com/ChristopherVR/pptx-viewer/commit/9cb8a2567082b9bfdc91efee0b91cf2cbe2aa1c4))

## [1.0.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.9) - 2026-03-29

### Chores

- Remove MyClawAssist branding references (by @ChristopherVR) ([bf4d612](https://github.com/ChristopherVR/pptx-viewer/commit/bf4d612af81b026a14dce0ae4befe11952652ba7))
- **tools:** Bump @pptx-viewer/tools to v1.1.0 (by @ChristopherVR) ([c15aba6](https://github.com/ChristopherVR/pptx-viewer/commit/c15aba600c5f2a1137acb157b7dab896e659f37c))
- Bump all packages to v1.1.0 and remove remaining MyClawAssist refs (by @ChristopherVR) ([c386511](https://github.com/ChristopherVR/pptx-viewer/commit/c38651150c08011cee5e17e15f7ee8adc0014b80))

## [1.0.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.8) - 2026-03-29

### Features

- **tools:** Scaffold @pptx-viewer/tools package (by @ChristopherVR) ([f34b949](https://github.com/ChristopherVR/pptx-viewer/commit/f34b949e0f6d6460710aa223146399dfbc38a436))
- **tools:** Implement slide tools (getSlide, addSlide, deleteSlides, reorderSlides, duplicateSlide, updateSlideProperties, setSlideTransition, setCanvasSize) (by @ChristopherVR) ([dda381c](https://github.com/ChristopherVR/pptx-viewer/commit/dda381c33c6c228dba0c96f5a3ca9a6ffada4c6a))
- **tools:** Implement element, table, style, content, and conversion tools (by @ChristopherVR) ([dbea52c](https://github.com/ChristopherVR/pptx-viewer/commit/dbea52c83a93ec70d8658371a1a4dfbcac5fdcf3))
- **tools:** Add Zod schemas for all PPTX tools (by @ChristopherVR) ([51cfbf4](https://github.com/ChristopherVR/pptx-viewer/commit/51cfbf48211224871ef09c061f7855586a8cf3b4))
- **tools:** Add PptxCodec for Y.Doc <-> PptxData collaboration (by @ChristopherVR) ([2594779](https://github.com/ChristopherVR/pptx-viewer/commit/25947796fe78612458b57b9918cd2ffc8701b26d))
- **tools:** Implement MCP server with stdio transport (by @ChristopherVR) ([1a130a9](https://github.com/ChristopherVR/pptx-viewer/commit/1a130a99003c72be924738377d4657da67e0b6ac))
- **tools:** Add collaboration-aware execution pipeline with provider interfaces (by @ChristopherVR) ([43f137c](https://github.com/ChristopherVR/pptx-viewer/commit/43f137c053f324abca77240b82ffd005936e9995))
- **core:** Add signature-node module and shared signature utilities (by @ChristopherVR) ([e7cb263](https://github.com/ChristopherVR/pptx-viewer/commit/e7cb26335f15e633cfc37371f16a6ad210be5e11))

### Bug Fixes

- **tools:** Align schema types with tool function signatures (by @ChristopherVR) ([985d8f9](https://github.com/ChristopherVR/pptx-viewer/commit/985d8f9cbac323f564a248777b9618cb197ac3a4))

### Refactor

- **tools:** Migrate from deprecated server.tool() to server.registerTool() (by @ChristopherVR) ([b9a8bc0](https://github.com/ChristopherVR/pptx-viewer/commit/b9a8bc08854db6eb8ed7d9c83e46e07b50f979a5))

## [1.0.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.7) - 2026-03-17

### Build & CI

- Use NPM_TOKEN for publish auth with OIDC provenance signing (by @ChristopherVR) ([7f98cc7](https://github.com/ChristopherVR/pptx-viewer/commit/7f98cc738e1e89fd56377d1964eb45e3d030a5f0))
- Use Node 24 in publish job for OIDC trusted publishing (by @ChristopherVR) ([bab352d](https://github.com/ChristopherVR/pptx-viewer/commit/bab352d7081df4839efa21869bdc0afd65fc5341))

## [1.0.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.6) - 2026-03-16

### Build & CI

- Use NPM_TOKEN for publish auth instead of pure OIDC (by @ChristopherVR) ([395246f](https://github.com/ChristopherVR/pptx-viewer/commit/395246f51d6a125740ae131ec3ea9bcfeb6134fc))
- Fix npm OIDC trusted publishing by removing registry-url (by @ChristopherVR) ([d3abd98](https://github.com/ChristopherVR/pptx-viewer/commit/d3abd984e1407c17b1cf14d5c96d289fb1542fe4))

## [1.0.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.5) - 2026-03-16

### Build & CI

- Fix perl syntax error in publish and reuse build artifacts (by @ChristopherVR) ([fa533d6](https://github.com/ChristopherVR/pptx-viewer/commit/fa533d66f4a4fe7de14c3a2cef735c92a9b174cc))

## [1.0.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.4) - 2026-03-16

### Documentation

- Rewrite limitations with technical explanations and remove inaccurate claims (by @ChristopherVR) ([ac4bc84](https://github.com/ChristopherVR/pptx-viewer/commit/ac4bc84ed9bd03f62e3ae29c35baf3f444a3c0bf))

### Chores

- Add license files, NOTICE, and package metadata for npm publishing (by @ChristopherVR) ([9464bb8](https://github.com/ChristopherVR/pptx-viewer/commit/9464bb8b91734daf35131d3c7e52e60895fe0a1c))

## [1.0.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.2) - 2026-03-16

### Documentation

- Restructure root README, elevate limitations, fix outdated claims (by @ChristopherVR) ([86dcda9](https://github.com/ChristopherVR/pptx-viewer/commit/86dcda9b5e3129f2223341337055778db574e985))

## [1.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.1) - 2026-03-16

### Performance

- Speed up crypto tests by making spinCount configurable (by @ChristopherVR) ([a79582e](https://github.com/ChristopherVR/pptx-viewer/commit/a79582e3785a4de0e03dfd2d156a706a28cdc073))

### Build & CI

- Use semver v1.0.x release tags instead of date-based tags (by @ChristopherVR) ([1d2ec18](https://github.com/ChristopherVR/pptx-viewer/commit/1d2ec187acb01ca5be14f0ef627ca68c75960620))

## [20260316.093408](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v20260316.093408) - 2026-03-16

### Bug Fixes

- Lint and build type-checks (by @ChristopherVR) ([b5ffc33](https://github.com/ChristopherVR/pptx-viewer/commit/b5ffc3325a178ff5203910564285b64f3ce2176f))
- Resolve remaining typecheck failures in emf-converter and react (by @ChristopherVR) ([f4a46b0](https://github.com/ChristopherVR/pptx-viewer/commit/f4a46b0a40404bd89d2bf065ff7a81348e153fd7))
- Resolve build warnings for unused imports and chunk size (by @ChristopherVR) ([36361d2](https://github.com/ChristopherVR/pptx-viewer/commit/36361d271c1f309a1a29b03f1a02b21c909ac231))
- Enable vitest globals in all packages to fix expectTypeOf errors (by @ChristopherVR) ([6d90d72](https://github.com/ChristopherVR/pptx-viewer/commit/6d90d72ff0107ad0194f9c73ceeb3df244f4cfc6))
- Resolve all remaining test failures for CI (by @ChristopherVR) ([5db8609](https://github.com/ChristopherVR/pptx-viewer/commit/5db8609800b4a7fb829da69f6205fe6fb29a89b4))
- Remove 72 obsolete snapshots from render-snapshots (by @ChristopherVR) ([b5cc60e](https://github.com/ChristopherVR/pptx-viewer/commit/b5cc60ed100013d2f65ea26a0905adad1428ec26))

### Build & CI

- Split test job into parallel per-package jobs (by @ChristopherVR) ([9124f92](https://github.com/ChristopherVR/pptx-viewer/commit/9124f92855a1f626e5ed8d793e319d647189cfbb))
- Use verbose + github-actions reporters for clean CI test output (by @ChristopherVR) ([9909d80](https://github.com/ChristopherVR/pptx-viewer/commit/9909d80e0c2f73ab2556b00aec07dcdf4afc2008))

### Chores

- Update GitHub Actions to latest major versions (by @ChristopherVR) ([74bd03c](https://github.com/ChristopherVR/pptx-viewer/commit/74bd03c35bf9eae0207373b13244d34aa05a2b57))
- Updated action to latest version (by @ChristopherVR) ([6a19377](https://github.com/ChristopherVR/pptx-viewer/commit/6a19377fbaceed3bfdf908eb7a5f3e92a5a81ced))
- Removed obsolete snapshots and split tests further in pipeline (by @ChristopherVR) ([cb5a1d6](https://github.com/ChristopherVR/pptx-viewer/commit/cb5a1d6a21a41778bb61da8575969cc28a91f5a3))
- Fix format issue (by @ChristopherVR) ([20f767b](https://github.com/ChristopherVR/pptx-viewer/commit/20f767bed24db2b453d7857f635e3941695aaea2))
