# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.

## [1.1.32](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.32) - 2026-06-21

### Bug Fixes

- **angular:** Replace bare file input with styled dropzone in demo (by @ChristopherVR) ([d47a4a5](https://github.com/ChristopherVR/pptx-viewer/commit/d47a4a538c8e7f7cd057ac652b2dbede527d92e3))

## [1.1.31](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.31) - 2026-06-21

### Bug Fixes

- **angular:** Bundle pptx-viewer-core and fix demo JIT + Vue demo alias (by @ChristopherVR) ([78838ec](https://github.com/ChristopherVR/pptx-viewer/commit/78838ec900fe2d8c90bc39333636d788c52c3161))

## [1.1.30](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.30) - 2026-06-21

### Features

- **shared:** Add Three.js SmartArt 3D model + scene runtime (by @ChristopherVR) ([f949213](https://github.com/ChristopherVR/pptx-viewer/commit/f949213b33ed0dca4c52d5d1ab414c3dba67efe7))
- **vue:** Opt-in Three.js SmartArt renderer (by @ChristopherVR) ([2d59be3](https://github.com/ChristopherVR/pptx-viewer/commit/2d59be365bee62521b1cfa670f9d5d5468418488))

### Bug Fixes

- **vue,ci:** Fix Rolldown build panic and isolate per-framework CI failures (by @ChristopherVR) ([7d282ee](https://github.com/ChristopherVR/pptx-viewer/commit/7d282eeadeb130814dca84996b0434568f2f5e0e))

### Documentation

- Sharpen npm descriptions and keywords for discoverability (by @ChristopherVR) ([8fea56d](https://github.com/ChristopherVR/pptx-viewer/commit/8fea56d7650f7dc2f3167dea97b94b612a03a4e7))
- **core:** Reword README in plain language (by @ChristopherVR) ([793c26e](https://github.com/ChristopherVR/pptx-viewer/commit/793c26ec7e2415c66f34c637cb541483bf395a11))
- **vue:** Reword README in plain language (by @ChristopherVR) ([3afac93](https://github.com/ChristopherVR/pptx-viewer/commit/3afac9321206ab492d8cd6d63babc6cedef7292f))

## [1.1.24](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.24) - 2026-06-20

### Features

- **core:** Add signature-node module and shared signature utilities (by @ChristopherVR) ([e7cb263](https://github.com/ChristopherVR/pptx-viewer/commit/e7cb26335f15e633cfc37371f16a6ad210be5e11))
- **vue:** Add pptx-vue-viewer package + bundled pptx-viewer-shared (by @ChristopherVR) ([1b7a958](https://github.com/ChristopherVR/pptx-viewer/commit/1b7a958ce91792a6d174f174932800bc8ff40ef9))
- **vue:** Live thumbnail previews + gradient/image fills (by @ChristopherVR) ([b13f27e](https://github.com/ChristopherVR/pptx-viewer/commit/b13f27e6b878e712d97365f6984d9378849ca122))
- **vue:** Render straight connectors as SVG (by @ChristopherVR) ([e2b9521](https://github.com/ChristopherVR/pptx-viewer/commit/e2b95214d434fba2e293e753892ed57d6a60bfd0))
- **vue:** Preset-geometry clip-paths for shape rendering (by @ChristopherVR) ([bc37eda](https://github.com/ChristopherVR/pptx-viewer/commit/bc37edaabdbec0ffb3a75be5afab9fc505d85755))
- **vue:** Render tables and charts as native components (by @ChristopherVR) ([07a2106](https://github.com/ChristopherVR/pptx-viewer/commit/07a21069c2588b10627d75e8dd868a73971a058b))
- **vue:** Render SmartArt, ink, OLE, 3D, zoom + shape visual effects (by @ChristopherVR) ([740c068](https://github.com/ChristopherVR/pptx-viewer/commit/740c068ed5db47357e2a85885db712d6ac0a236a))
- **vue:** Image effects, shape 3D, and equations (OMML→MathML) (by @ChristopherVR) ([1521de3](https://github.com/ChristopherVR/pptx-viewer/commit/1521de34f74d01299d64a45bd7a09ed6795b1133))
- **vue:** WordArt text-warp, structured fills, and editing foundation (by @ChristopherVR) ([1eaa3df](https://github.com/ChristopherVR/pptx-viewer/commit/1eaa3df78feaecaf194398d640da70c77763509c))
- **vue:** Wire interactive editing (selection, drag/resize, toolbar) (by @ChristopherVR) ([c270c7a](https://github.com/ChristopherVR/pptx-viewer/commit/c270c7a69eedc7e51cbff1bd65d258ff8d1f1753))
- **vue:** Property inspector panels (arrange/fill/stroke/text/effects) (by @ChristopherVR) ([ed497f3](https://github.com/ChristopherVR/pptx-viewer/commit/ed497f346000f7f7af0563a42e0ab8cd38c73d64))
- **vue:** Slides pane, presentation mode, and context menu (by @ChristopherVR) ([782f1a0](https://github.com/ChristopherVR/pptx-viewer/commit/782f1a0da159ff0fb8ce3253cc2bb4c3201de3b2))
- **vue:** Find/replace, hyperlink dialog, reusable modal (by @ChristopherVR) ([53b7271](https://github.com/ChristopherVR/pptx-viewer/commit/53b72712b76da7566bb66389e9713d1e0a40e4f7))
- **vue:** Export to PNG/PDF + image & table inspector panels (by @ChristopherVR) ([6e8ca87](https://github.com/ChristopherVR/pptx-viewer/commit/6e8ca8779ee138dba2f17176b8ffffbf837f0110))
- **vue:** Accessibility checker, slide sorter, slide transitions (by @ChristopherVR) ([4f656ed](https://github.com/ChristopherVR/pptx-viewer/commit/4f656eded92e8b82d677dcb30696cadf5a0767eb))
- **vue:** Animation, chart & notes panels (inspector set complete) (by @ChristopherVR) ([a9bb990](https://github.com/ChristopherVR/pptx-viewer/commit/a9bb99004904fc467e4c5e25d8554512642bcb2c))
- **vue:** Align/distribute/group tools + autosave (by @ChristopherVR) ([ea68c38](https://github.com/ChristopherVR/pptx-viewer/commit/ea68c380599ed3484503ee8e0eefbfb32762f86f))
- **vue:** Comments, animation playback, share & properties dialogs (by @ChristopherVR) ([9027c6c](https://github.com/ChristopherVR/pptx-viewer/commit/9027c6cd1a5546b41467a708cf9c1bacde239a0f))
- **vue:** Yjs collaboration, digital signatures, embedded fonts (by @ChristopherVR) ([1117e41](https://github.com/ChristopherVR/pptx-viewer/commit/1117e41f17b06d2c65a6629024092c5983266a84))
- **vue:** Broadcast dialog, mobile chrome, animation-preset fix (by @ChristopherVR) ([c01e4c6](https://github.com/ChristopherVR/pptx-viewer/commit/c01e4c6389a950d7ef2ea8f38e359a945ad63b0d))
- **vue:** Editor-chrome parity — presenter view, print, shortcuts, doc properties (by @ChristopherVR) ([b8965b9](https://github.com/ChristopherVR/pptx-viewer/commit/b8965b9bb4bbd92814a9a79426dcfdd8a51288db))
- **vue:** Master views, header/footer, sections & custom shows (by @ChristopherVR) ([b6a1dfb](https://github.com/ChristopherVR/pptx-viewer/commit/b6a1dfbfc931331d9986a030bae1d6a0e17ad10e))
- **vue:** Version history/compare, insert-SmartArt & equation dialogs, settings (by @ChristopherVR) ([ba40c85](https://github.com/ChristopherVR/pptx-viewer/commit/ba40c8584297166d73496a8f78d97e22adf7f393))
- **vue:** GIF/WebM export, slide-transition animations, collab depth, property round-trip (by @ChristopherVR) ([1d66b44](https://github.com/ChristopherVR/pptx-viewer/commit/1d66b443afe59cf062af0d7b96484b03f689de29))
- **vue:** Port React's full Office-style ribbon toolbar (by @ChristopherVR) ([2341157](https://github.com/ChristopherVR/pptx-viewer/commit/23411572fb88ee50c7a3f64d93fc7d365e7ac73f))

### Bug Fixes

- Enable vitest globals in all packages to fix expectTypeOf errors (by @ChristopherVR) ([6d90d72](https://github.com/ChristopherVR/pptx-viewer/commit/6d90d72ff0107ad0194f9c73ceeb3df244f4cfc6))
- **test:** Add i18n mocks to react tests and bump versions to 1.2.0 (by @ChristopherVR) ([2c1c962](https://github.com/ChristopherVR/pptx-viewer/commit/2c1c9628714b905b28592493abf02fb270107b65))
- **build:** Make all packages build + publish cleanly; align Vue README (by @ChristopherVR) ([7db5de6](https://github.com/ChristopherVR/pptx-viewer/commit/7db5de6a343887fc1a32dd526ae1ab68e1e3e6e0))
- Format issues (by @ChristopherVR) ([cc84180](https://github.com/ChristopherVR/pptx-viewer/commit/cc84180ed35b273283fb679b667be15d82ef2a55))
- **deps:** Pin @xmldom/xmldom to 0.8.x in core to fix build (by @ChristopherVR) ([2ed7b2e](https://github.com/ChristopherVR/pptx-viewer/commit/2ed7b2e777d4e740a3e4c9ca7e2b3d6fc2bbd21f))
- **core:** Declare jszip and fast-xml-parser as runtime dependencies (by @ChristopherVR) ([b6636be](https://github.com/ChristopherVR/pptx-viewer/commit/b6636be972206bb2c6acee0fed05c45b4759fbdc))

### Refactor

- **react:** Consume theme + loader from pptx-viewer-shared (by @ChristopherVR) ([1b93d1f](https://github.com/ChristopherVR/pptx-viewer/commit/1b93d1fccff378b0ac402810a0cbddea46add29c))
- **shared:** Extract framework-agnostic render helpers + fix props persist (by @ChristopherVR) ([5b215a8](https://github.com/ChristopherVR/pptx-viewer/commit/5b215a8302feaa3e7e501cee455b3a1d61715cb7))
- **shared:** Extract 3D + table render helpers (wave 2) (by @ChristopherVR) ([0348d81](https://github.com/ChristopherVR/pptx-viewer/commit/0348d819a407a6d615ad78ce373f16cefcebf803))
- **core:** Consume emf-converter and mtx-decompressor from npm (by @ChristopherVR) ([2f6013d](https://github.com/ChristopherVR/pptx-viewer/commit/2f6013d5b8fab0aef5b32901841d94c0fa886f24))
- **vue:** Remove em-dashes from code comments and prose (by @ChristopherVR) ([e306df9](https://github.com/ChristopherVR/pptx-viewer/commit/e306df9ed3d8ee65cc6de6f94ace8789682aa0bb))

### Documentation

- Restructure root README, elevate limitations, fix outdated claims (by @ChristopherVR) ([86dcda9](https://github.com/ChristopherVR/pptx-viewer/commit/86dcda9b5e3129f2223341337055778db574e985))
- Rewrite limitations with technical explanations and remove inaccurate claims (by @ChristopherVR) ([ac4bc84](https://github.com/ChristopherVR/pptx-viewer/commit/ac4bc84ed9bd03f62e3ae29c35baf3f444a3c0bf))
- **readme:** Npm-friendly READMEs — hero image, capabilities & install first (by @ChristopherVR) ([c843d19](https://github.com/ChristopherVR/pptx-viewer/commit/c843d1934b846f901bba92e63d2b01f9479594d0))
- **vue:** Record batch 16 render-fidelity work in PORTING.md (by @ChristopherVR) ([643fef9](https://github.com/ChristopherVR/pptx-viewer/commit/643fef94d8f334a155c42b029bbeec744344d472))
- **vue:** Record batch 17 (table GUIDs, connector labels, charts) (by @ChristopherVR) ([318b41a](https://github.com/ChristopherVR/pptx-viewer/commit/318b41aecd988eb364bded1038406ed8860eb181))
- **vue:** Log px font-size fix + agnostic text-rendering e2e (by @ChristopherVR) ([3ffbe80](https://github.com/ChristopherVR/pptx-viewer/commit/3ffbe8056b2c7e6b87cf3f01fe14ef518e1c6e51))
- **vue:** Log table body-cell colour fix + shared &amp; core bug (by @ChristopherVR) ([5fdf655](https://github.com/ChristopherVR/pptx-viewer/commit/5fdf6558523260096cc5b8b151bceae562ce253a))
- **vue:** Log Office-style ribbon toolbar port + follow-ups (by @ChristopherVR) ([b2c0a54](https://github.com/ChristopherVR/pptx-viewer/commit/b2c0a54637ef19c1dad6e57a7219aafa650dc383))
- **vue:** Log bottom status bar port (ribbon chrome complete) (by @ChristopherVR) ([6e2a938](https://github.com/ChristopherVR/pptx-viewer/commit/6e2a9387596e21e2bcbb4ca97885110f03f3e8b3))
- **vue:** Log ribbon chrome cleanup + Arrange wiring (by @ChristopherVR) ([51ce920](https://github.com/ChristopherVR/pptx-viewer/commit/51ce920d21ab285f26c219ff2063dc74a621dc71))
- **vue:** Log slides-rail parity (desktop chrome complete) (by @ChristopherVR) ([5b258a0](https://github.com/ChristopherVR/pptx-viewer/commit/5b258a00a8ef96286d1e639576b632b2b9223b03))
- **vue:** Log slide-level inspector (transition editing restored) (by @ChristopherVR) ([df15436](https://github.com/ChristopherVR/pptx-viewer/commit/df15436b070f81520881756f6135c2cb52ca53e7))
- **vue:** Log table/image insert + undo/selection bugfix (by @ChristopherVR) ([61b6ef6](https://github.com/ChristopherVR/pptx-viewer/commit/61b6ef6cb8b9083a0d7b9b227f418867b9fef224))
- **vue:** Log View-tab grid overlay + snap-to-grid (by @ChristopherVR) ([55b8c78](https://github.com/ChristopherVR/pptx-viewer/commit/55b8c7813e1211ff1d4d416b58e35e62fe4809aa))
- **vue:** Log media picker + note pre-existing useIsMobile red test (by @ChristopherVR) ([51de5b7](https://github.com/ChristopherVR/pptx-viewer/commit/51de5b7b2ff232c7c905707b194e293f56357d47))
- Streamline npm READMEs and add badges, screenshots, demo links (by @ChristopherVR) ([92e980d](https://github.com/ChristopherVR/pptx-viewer/commit/92e980d434900abd223c4d70c6cae19a623f9ca8))
- **vue,angular:** Point Try-demo links at per-framework demos (by @ChristopherVR) ([b5e6915](https://github.com/ChristopherVR/pptx-viewer/commit/b5e6915c416075f4f50630d76dfedbc324cde03e))
- **vue:** Log action buttons + suite-green note (by @ChristopherVR) ([b5a7ef6](https://github.com/ChristopherVR/pptx-viewer/commit/b5a7ef6f479ca26c4f21e481f5697c67ab0b3c0e))
- **vue:** Log layout + theme galleries; ribbon data-stubs complete (by @ChristopherVR) ([6aa01ab](https://github.com/ChristopherVR/pptx-viewer/commit/6aa01ab03d9ab8e3194942ac3fc12faa78180545))
- **vue:** Log theme editor + Draw-tab ink tools (by @ChristopherVR) ([37b81bf](https://github.com/ChristopherVR/pptx-viewer/commit/37b81bf074e97659d147518da1a8eb3789e361b3))
- **vue:** Log View ▸ Rulers + flag the emf/mtx workspace break (by @ChristopherVR) ([70f76ec](https://github.com/ChristopherVR/pptx-viewer/commit/70f76ec8ecb2e60db10adb8e6d21af05b46fd663))
- **vue:** Log layout + theme galleries; ribbon data-stubs complete (by @ChristopherVR) ([3e1c556](https://github.com/ChristopherVR/pptx-viewer/commit/3e1c55683eeffb3c237d5c8f8bef3ab5a0ab9052))
- **vue:** Log H/V Guides + Snap to Shape; clear the emf/mtx break flag (by @ChristopherVR) ([99b6315](https://github.com/ChristopherVR/pptx-viewer/commit/99b6315c2a4923668549bbc48455c67190f82303))
- **vue:** Log View ▸ Spell; all ribbon View-tab stubs now done (by @ChristopherVR) ([60673f8](https://github.com/ChristopherVR/pptx-viewer/commit/60673f8215749ed3a5379c1b9d236f82fe510fbe))
- **vue:** Log File/Slide-Show/Animations ribbon wiring (by @ChristopherVR) ([b59b6ad](https://github.com/ChristopherVR/pptx-viewer/commit/b59b6ad5ff87fdf963e49988c198acf3a956e0fc))
- **vue:** Trim PORTING.md to a parity-gap view (1042→175 lines) (by @ChristopherVR) ([e04848c](https://github.com/ChristopherVR/pptx-viewer/commit/e04848c1016838e58f3159bcab9c6c353d6a3c38))
- **vue:** Mark bullets/gradient-flip/text-warp done; drop non-gap equations (by @ChristopherVR) ([d22cddb](https://github.com/ChristopherVR/pptx-viewer/commit/d22cddbf4fcfc614dd5eaf4cecef11a43a6b9567))
- Remove em-dashes and clarify demo link in viewer packages (by @ChristopherVR) ([f52afff](https://github.com/ChristopherVR/pptx-viewer/commit/f52afffd935016b747116a9909c523021b492225))

### Testing

- **e2e:** Run one Playwright suite against both React and Vue demos (by @ChristopherVR) ([7737fe1](https://github.com/ChristopherVR/pptx-viewer/commit/7737fe1a07343ebb04a79c47217172d77891bc2b))
- **e2e:** Run one Playwright suite against both React and Vue demos (by @ChristopherVR) ([4762782](https://github.com/ChristopherVR/pptx-viewer/commit/476278229417fdbd550faa0b241d2b16819a3fe6))

### Build & CI

- **react,vue:** Self-contained, minified, precompressed dist + vue CI (by @ChristopherVR) ([aa28df9](https://github.com/ChristopherVR/pptx-viewer/commit/aa28df916eee064ac502c01be3445e8c84ad37f6))
- **vue:** Adopt Tailwind 4 pipeline for chrome visual parity with React (by @ChristopherVR) ([451dacc](https://github.com/ChristopherVR/pptx-viewer/commit/451dacc831d41e620749f8403a2183d4e8b853df))
- Independent per-package versioning, tags, and changelogs (by @ChristopherVR) ([79595d9](https://github.com/ChristopherVR/pptx-viewer/commit/79595d972d7c4102e8b1e1e3926f439486f76ba1))

### Styling

- **vue:** Reformat PORTING.md table to satisfy oxfmt (by @ChristopherVR) ([b71d989](https://github.com/ChristopherVR/pptx-viewer/commit/b71d989ead5f58ff3ee02a61e1f9ae50d35f5ead))

### Dependencies

- **deps:** Update all dependencies to latest (by @ChristopherVR) ([e3287c0](https://github.com/ChristopherVR/pptx-viewer/commit/e3287c03ff58b1a1ae103ed32a513468a454a084))
- **deps:** Update dependencies and CI actions to latest (by @ChristopherVR) ([b1a84a2](https://github.com/ChristopherVR/pptx-viewer/commit/b1a84a26814bfdb9b5d5ef7dd87aeabc4fa82c04))
- **deps:** Bump all workspace manifest floors to latest (by @ChristopherVR) ([890c33d](https://github.com/ChristopherVR/pptx-viewer/commit/890c33d667a39480a69e6a3da893964382993b29))

### Chores

- Add license files, NOTICE, and package metadata for npm publishing (by @ChristopherVR) ([9464bb8](https://github.com/ChristopherVR/pptx-viewer/commit/9464bb8b91734daf35131d3c7e52e60895fe0a1c))
- Bump all packages to v1.1.0 and remove remaining MyClawAssist refs (by @ChristopherVR) ([c386511](https://github.com/ChristopherVR/pptx-viewer/commit/c38651150c08011cee5e17e15f7ee8adc0014b80))
- Bump all packages to 1.x.1 patch versions (by @ChristopherVR) ([c75205a](https://github.com/ChristopherVR/pptx-viewer/commit/c75205a96cc7797d1647ac4705395b7707ac8910))
- Bump all packages to minor versions for SDK table support (by @ChristopherVR) ([2d4b635](https://github.com/ChristopherVR/pptx-viewer/commit/2d4b6351b0bf328f8a556cf593733fd8ad36c7b5))
- Bump dependencies to latest and minor-bump packages for parity work (by @ChristopherVR) ([da19fdf](https://github.com/ChristopherVR/pptx-viewer/commit/da19fdf9a4670d274d9973b67aa22d34217b8555))
- Roll TypeScript back to 5.9.x; quiet new oxlint vitest rules (by @ChristopherVR) ([713c020](https://github.com/ChristopherVR/pptx-viewer/commit/713c020ac2428db0fb1eb6cb30e56b2cff19a80f))
- Relicense from MIT to Apache-2.0 (by @ChristopherVR) ([e12f926](https://github.com/ChristopherVR/pptx-viewer/commit/e12f9266f02bebbfc218986b617c418fee43a56b))
