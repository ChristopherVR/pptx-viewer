# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.

## [1.1.12](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.12) - 2026-06-15

### 🐛 Bug Fixes

- **react:** Stop notes rich-editor reversing text on mobile (by @ChristopherVR) ([906fba5](https://github.com/ChristopherVR/pptx-viewer/commit/906fba586d0e6867fa30648c0a6d8f0ef58e739c))

### ♻️ Refactor

- **shared:** Extract 3D + table render helpers (wave 2) (by @ChristopherVR) ([0348d81](https://github.com/ChristopherVR/pptx-viewer/commit/0348d819a407a6d615ad78ce373f16cefcebf803))

## [1.1.11](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.11) - 2026-06-15

### 🚀 Features

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

### 🐛 Bug Fixes

- **angular:** Mobile/touch support across the viewer & editor (by @ChristopherVR) ([6fa9dc7](https://github.com/ChristopherVR/pptx-viewer/commit/6fa9dc7fd6b8a91807af5cf7071574244761b2f2))
- **react:** Mobile/touch support across the viewer & editor (by @ChristopherVR) ([3efa3df](https://github.com/ChristopherVR/pptx-viewer/commit/3efa3df462ad4daf4082890577887c081b2a742c))
- **vue:** Mobile/touch support across the viewer (by @ChristopherVR) ([cb96b8d](https://github.com/ChristopherVR/pptx-viewer/commit/cb96b8d132371c490d96667bea4c0a74cf14df4f))

### ♻️ Refactor

- **shared:** Extract framework-agnostic render helpers + fix props persist (by @ChristopherVR) ([5b215a8](https://github.com/ChristopherVR/pptx-viewer/commit/5b215a8302feaa3e7e501cee455b3a1d61715cb7))

### 📚 Documentation

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
- **changelog:** Update for v1.1.11 [skip ci] (by @github-actions[bot]) ([53a3f16](https://github.com/ChristopherVR/pptx-viewer/commit/53a3f167e67660a564e12c5cb4d7590c33d4dca5))

## [1.1.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.10) - 2026-06-14

### 🚀 Features

- **angular:** Image & gradient fills in element-style (by @ChristopherVR) ([2457aa2](https://github.com/ChristopherVR/pptx-viewer/commit/2457aa2163e6e6504aa36d464d3686d58f625338))
- **vue:** Preset-geometry clip-paths for shape rendering (by @ChristopherVR) ([bc37eda](https://github.com/ChristopherVR/pptx-viewer/commit/bc37edaabdbec0ffb3a75be5afab9fc505d85755))

### 🐛 Bug Fixes

- **core:** Make parsed element IDs unique per slide (by @ChristopherVR) ([d107523](https://github.com/ChristopherVR/pptx-viewer/commit/d1075231200fd0f5a2f07168b618f123554403b8))
- **react:** Persist in-progress inline text edit on save (by @ChristopherVR) ([6b917d7](https://github.com/ChristopherVR/pptx-viewer/commit/6b917d7a560a825ed439ba8560a333660bcabaaf))
- **react:** Improve host-app CSS compatibility for buttons and dialogs (by @ChristopherVR) ([e07e883](https://github.com/ChristopherVR/pptx-viewer/commit/e07e883b775fc075849ad52770a6a9fdb1467651))

### 📚 Documentation

- Adopt trunk-based development workflow (by @ChristopherVR) ([eb19ac5](https://github.com/ChristopherVR/pptx-viewer/commit/eb19ac5ab21db04fb069bc164994634b91ca53bf))
- **changelog:** Update for v1.1.10 [skip ci] (by @github-actions[bot]) ([711b9f2](https://github.com/ChristopherVR/pptx-viewer/commit/711b9f2bc10c62bf9a3b15aa1fa2853ef1774213))

### 🛠️ Build & CI

- Publish pptx-angular-viewer in release pipeline (by @ChristopherVR) ([f2a84d4](https://github.com/ChristopherVR/pptx-viewer/commit/f2a84d44d29eed8549e859b97c40041162ace622))

## [1.1.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.9) - 2026-06-14

### 🐛 Bug Fixes

- Format issues (by @ChristopherVR) ([cc84180](https://github.com/ChristopherVR/pptx-viewer/commit/cc84180ed35b273283fb679b667be15d82ef2a55))

### 📚 Documentation

- **changelog:** Update for v1.1.9 [skip ci] (by @github-actions[bot]) ([f850c0e](https://github.com/ChristopherVR/pptx-viewer/commit/f850c0e33a16de303b2eee8b34abe09b304ef0fd))

## [1.1.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.8) - 2026-06-14

### 🚀 Features

- **vue:** Add pptx-vue-viewer package + bundled pptx-viewer-shared (by @ChristopherVR) ([1b7a958](https://github.com/ChristopherVR/pptx-viewer/commit/1b7a958ce91792a6d174f174932800bc8ff40ef9))
- **vue:** Live thumbnail previews + gradient/image fills (by @ChristopherVR) ([b13f27e](https://github.com/ChristopherVR/pptx-viewer/commit/b13f27e6b878e712d97365f6984d9378849ca122))
- **demo-vue:** Add Vite + Vue 3 demo app for pptx-vue-viewer (by @ChristopherVR) ([905abd5](https://github.com/ChristopherVR/pptx-viewer/commit/905abd558f12f2a95651d92a7ff2cd2d22d37c01))
- **vue:** Render straight connectors as SVG (by @ChristopherVR) ([e2b9521](https://github.com/ChristopherVR/pptx-viewer/commit/e2b95214d434fba2e293e753892ed57d6a60bfd0))
- **angular:** Add pptx-angular-viewer package + demo (by @ChristopherVR) ([81255a9](https://github.com/ChristopherVR/pptx-viewer/commit/81255a9251e855bc51b97c8dc68b55e71e206882))
- Added demo site for github pages (by @ChristopherVR) ([83a8758](https://github.com/ChristopherVR/pptx-viewer/commit/83a8758a2854a3e4296483fc1ff5d35dd41dd4ec))

### 🐛 Bug Fixes

- **angular:** Import CanvasSize from the vendored shared barrel (by @ChristopherVR) ([e09dd5c](https://github.com/ChristopherVR/pptx-viewer/commit/e09dd5c6377e92091d81cfe59444b13ed2719a9d))
- **build:** Make all packages build + publish cleanly; align Vue README (by @ChristopherVR) ([7db5de6](https://github.com/ChristopherVR/pptx-viewer/commit/7db5de6a343887fc1a32dd526ae1ab68e1e3e6e0))

### ♻️ Refactor

- **react:** Consume theme + loader from pptx-viewer-shared (by @ChristopherVR) ([1b93d1f](https://github.com/ChristopherVR/pptx-viewer/commit/1b93d1fccff378b0ac402810a0cbddea46add29c))
- **demos:** Move demo apps under demos/ and rename React demo (by @ChristopherVR) ([ab51018](https://github.com/ChristopherVR/pptx-viewer/commit/ab51018ff3662b500256b311478ef208185e4b64))
- **angular:** Keep core peer as workspace:\*, resolve at build time (by @ChristopherVR) ([b123ac9](https://github.com/ChristopherVR/pptx-viewer/commit/b123ac99e9611b7f585197d827ba2ac35217997e))

### 📚 Documentation

- Add documentation site (by @ChristopherVR) ([2c2145c](https://github.com/ChristopherVR/pptx-viewer/commit/2c2145cbf740e26423f7f27314e6b078aa22dde9))
- **readme:** Npm-friendly READMEs — hero image, capabilities & install first (by @ChristopherVR) ([c843d19](https://github.com/ChristopherVR/pptx-viewer/commit/c843d1934b846f901bba92e63d2b01f9479594d0))
- **site:** Fix package naming, license, and add a showcase to VitePress (by @ChristopherVR) ([04f9674](https://github.com/ChristopherVR/pptx-viewer/commit/04f96745b91540060ab725392d2a7910b3fa16d1))
- **assets:** Replace editor.png with a logo-free sample deck (by @ChristopherVR) ([08cbbed](https://github.com/ChristopherVR/pptx-viewer/commit/08cbbedc7bbe29716c17e298d91589f2e690d276))
- Remove obsolete followup notes (by @ChristopherVR) ([69c2439](https://github.com/ChristopherVR/pptx-viewer/commit/69c2439dc1d273af9be890076a483f1f81a40e89))
- **changelog:** Update for v1.1.8 [skip ci] (by @github-actions[bot]) ([494fbe5](https://github.com/ChristopherVR/pptx-viewer/commit/494fbe5ea5be1e4584695cf51eb8b412da1a1b09))

### 🛠️ Build & CI

- **changelog:** Generate CHANGELOG.md with git-cliff (by @ChristopherVR) ([8168866](https://github.com/ChristopherVR/pptx-viewer/commit/816886629a48111b0095c108fdfa6e1883766790))
- **react,vue:** Self-contained, minified, precompressed dist + vue CI (by @ChristopherVR) ([aa28df9](https://github.com/ChristopherVR/pptx-viewer/commit/aa28df916eee064ac502c01be3445e8c84ad37f6))
- Add dependabot config (by @ChristopherVR) ([660c80a](https://github.com/ChristopherVR/pptx-viewer/commit/660c80a15dcf2d40782c506b07424f27d385ba8f))

### 📦 Dependencies

- **deps:** Update all dependencies to latest (by @ChristopherVR) ([e3287c0](https://github.com/ChristopherVR/pptx-viewer/commit/e3287c03ff58b1a1ae103ed32a513468a454a084))
- **deps:** Update dependencies and CI actions to latest (by @ChristopherVR) ([b1a84a2](https://github.com/ChristopherVR/pptx-viewer/commit/b1a84a26814bfdb9b5d5ef7dd87aeabc4fa82c04))

### 🧹 Chores

- Relicense from MIT to Apache-2.0 (by @ChristopherVR) ([e12f926](https://github.com/ChristopherVR/pptx-viewer/commit/e12f9266f02bebbfc218986b617c418fee43a56b))

## [1.1.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.7) - 2026-05-23

### 🚀 Features

- **core:** Resolve layout display names + master path on PptxLayoutOption (by @ChristopherVR) ([be0c5d9](https://github.com/ChristopherVR/pptx-viewer/commit/be0c5d91d2f3271d5da6eabeffe199b83a8c45a2))
- **editor:** Scoped layout picker + format-painter UX polish (by @ChristopherVR) ([5cdfce7](https://github.com/ChristopherVR/pptx-viewer/commit/5cdfce7d04beca1aac5e8914a0288afe4fb895dd))
- **react:** Mobile-first viewer chrome (toolbar, sheets, bottom bar) (by @ChristopherVR) ([2588a19](https://github.com/ChristopherVR/pptx-viewer/commit/2588a19f5c71ee36c4b3cbbaff652e79dc571639))
- **core:** Typed xml-access helpers for fast-xml-parser output (by @ChristopherVR) ([a25e9b3](https://github.com/ChristopherVR/pptx-viewer/commit/a25e9b36ea8ff7678e529318461ad54356f468ca))

### 🐛 Bug Fixes

- **react:** Remove dead `=== true` table-cell merge comparisons (by @ChristopherVR) ([fb00142](https://github.com/ChristopherVR/pptx-viewer/commit/fb00142c07fdf6c221e1787991bed55d02fd0123))

### ♻️ Refactor

- Strongly type XmlObject and eliminate `any` across packages (by @ChristopherVR) ([5cc51cc](https://github.com/ChristopherVR/pptx-viewer/commit/5cc51cca8bab013a8fee2db2d9f31666b496f116))

### 🧪 Testing

- **react:** Drop obsolete narrow-viewport Toolbar tests (by @ChristopherVR) ([554e98e](https://github.com/ChristopherVR/pptx-viewer/commit/554e98e353167b20945a66bbfe31a2091e69c0b0))

### 🧹 Chores

- **e2e:** Add Playwright e2e harness with format-painter spec (by @ChristopherVR) ([da88226](https://github.com/ChristopherVR/pptx-viewer/commit/da882266bcc46acc0c8dc83cc4c6ba6454a7a3b5))

## [1.1.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.6) - 2026-05-07

### 🚀 Features

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

### 🐛 Bug Fixes

- **core:** Correct OLE link/embed discriminator and media embed serialization (by @ChristopherVR) ([476c7fc](https://github.com/ChristopherVR/pptx-viewer/commit/476c7fc5fee35092bc2ccef87b71bf30a4ae71b3))
- **core:** Correct slide transition serialization (morph extLst, p14 3D, cut thruBlk, endSnd) (by @ChristopherVR) ([8f7b449](https://github.com/ChristopherVR/pptx-viewer/commit/8f7b4491d6993b114bf2eec0b4cf5a74d57093bf))

### 📚 Documentation

- **geometry:** Update followups to reflect shipped work (by @ChristopherVR) ([f685e35](https://github.com/ChristopherVR/pptx-viewer/commit/f685e358f11b5066ef44ca22edf28b1ced6543cc))

## [1.1.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.5) - 2026-05-06

### 🐛 Bug Fixes

- Close security & performance findings from full-codebase review (by @ChristopherVR) ([7edda8a](https://github.com/ChristopherVR/pptx-viewer/commit/7edda8a1860002cc72bd78ca1830949b02dab2c9))

## [1.1.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.4) - 2026-05-05

### 🚀 Features

- ECMA-376 parity pass across parse and save layers (by @ChristopherVR) ([b110e26](https://github.com/ChristopherVR/pptx-viewer/commit/b110e26583d72c78911d9e9598258695cbb6981a))

### 🧹 Chores

- Bump dependencies to latest and minor-bump packages for parity work (by @ChristopherVR) ([da19fdf](https://github.com/ChristopherVR/pptx-viewer/commit/da19fdf9a4670d274d9973b67aa22d34217b8555))
- Roll TypeScript back to 5.9.x; quiet new oxlint vitest rules (by @ChristopherVR) ([713c020](https://github.com/ChristopherVR/pptx-viewer/commit/713c020ac2428db0fb1eb6cb30e56b2cff19a80f))

## [1.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.3) - 2026-04-18

### 🚀 Features

- **save:** Replicate PowerPoint "Insert Table" defaults on SDK tables (by @ChristopherVR) ([c016ba3](https://github.com/ChristopherVR/pptx-viewer/commit/c016ba3a240c7aa41621e4deaabbbe8d41313233))
- **save:** Emit a16:colId and endParaRPr@dirty on SDK tables (by @ChristopherVR) ([400e7e8](https://github.com/ChristopherVR/pptx-viewer/commit/400e7e8718b639db27b8a44cd453f7a5bb5d0e50))

### 🐛 Bug Fixes

- **save:** Serialize new-presentation templates and SDK-created tables (by @ChristopherVR) ([3dab9e4](https://github.com/ChristopherVR/pptx-viewer/commit/3dab9e43c583df5ca4b207fceaed7db635b0f69a))
- **save:** Emit table cell <a:rPr> before <a:t> per CT_RegularTextRun (by @ChristopherVR) ([11a7ade](https://github.com/ChristopherVR/pptx-viewer/commit/11a7ade46c134cc5d4da2642a6686e51e8d2a6dd))

### 🧹 Chores

- Bump all packages to minor versions for SDK table support (by @ChristopherVR) ([2d4b635](https://github.com/ChristopherVR/pptx-viewer/commit/2d4b6351b0bf328f8a556cf593733fd8ad36c7b5))

## [1.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.2) - 2026-04-17

### 🚀 Features

- Implement OpenXML specification gap closures (by @ChristopherVR) ([80b6939](https://github.com/ChristopherVR/pptx-viewer/commit/80b69398ff780ad05af40adc57695e9ed05fbcff))
- Add element name parsing, barrel exports, and gradient improvements (by @ChristopherVR) ([61aa8c0](https://github.com/ChristopherVR/pptx-viewer/commit/61aa8c060e344264e03d66cf005a0cd253ec79b0))
- **collab:** Add connection timeout and retry for WebSocket (by @ChristopherVR) ([73219b9](https://github.com/ChristopherVR/pptx-viewer/commit/73219b9c00e6ee0f78265e8bf71f7dddf1c9873e))
- **export:** Add Save as .pptx toolbar action (by @ChristopherVR) ([dc03f69](https://github.com/ChristopherVR/pptx-viewer/commit/dc03f6903c35681c96a78143c0a36a1c9206cf1a))

### 🐛 Bug Fixes

- **mtx-decompressor:** Fix 8 bugs in MTX font decompression pipeline (by @ChristopherVR) ([43d43e3](https://github.com/ChristopherVR/pptx-viewer/commit/43d43e3cd86d48425e7327b45416e63ce1e040e4))
- **react:** Wire up format painter to copy and apply element formatting (by @ChristopherVR) ([1f1b795](https://github.com/ChristopherVR/pptx-viewer/commit/1f1b795b75bc557d6bdce83fbc5bca22edbe8d45))
- **animations:** Wire up Add Animation dropdown and Remove Animation button in toolbar (by @ChristopherVR) ([33d01d5](https://github.com/ChristopherVR/pptx-viewer/commit/33d01d5b94dc7a215eef5f686afe455045c6e859))
- **save:** Preserve embedded fonts and rId-referenced backgrounds on round-trip (by @ChristopherVR) ([a6cd733](https://github.com/ChristopherVR/pptx-viewer/commit/a6cd73315e919be6fb53af96c292709025c49460))
- **save:** Stop emitting <p:hf> at p:presentation root (by @ChristopherVR) ([32c067b](https://github.com/ChristopherVR/pptx-viewer/commit/32c067bd66dcbc9e10a2a805f608b3794087668b))
- **save:** Emit <p:showPr> children in schema order in presProps.xml (by @ChristopherVR) ([ec9da70](https://github.com/ChristopherVR/pptx-viewer/commit/ec9da70b2b14fe804cd63c6273e8c28a7d18355d))
- **save:** Strip ZIP directory entries before emitting the package (by @ChristopherVR) ([6aa953d](https://github.com/ChristopherVR/pptx-viewer/commit/6aa953d3aaca8f1fd565e47635ec8b9868d646a9))
- **save:** Don't overwrite EMF/WMF parts with converted PNG bytes (by @ChristopherVR) ([0bfdfd6](https://github.com/ChristopherVR/pptx-viewer/commit/0bfdfd64ec9b0d59b94beff2f6fcaf85e364e61f))
- **save:** Preserve element text literally instead of coercing to numbers (by @ChristopherVR) ([884bd7b](https://github.com/ChristopherVR/pptx-viewer/commit/884bd7b9103960a96c150b258f91301cf7a215fb))

### 🧪 Testing

- **core:** Remove two obsolete svg-snapshots entries (by @ChristopherVR) ([b57740a](https://github.com/ChristopherVR/pptx-viewer/commit/b57740a828e2b2d5bd641a5742e5282d25e0667f))

### 🧹 Chores

- Fix formatting and lint warnings across test suite (by @ChristopherVR) ([510c4f3](https://github.com/ChristopherVR/pptx-viewer/commit/510c4f359f3db710922adecd59d99350e09c4386))
- Update dependencies and CI configuration (by @ChristopherVR) ([1dc8465](https://github.com/ChristopherVR/pptx-viewer/commit/1dc8465ea51f1691ce9e025fedd7cf2b0d996b50))
- **test:** Fix preexisting lint warnings in Toolbar tests (by @ChristopherVR) ([c33b7b7](https://github.com/ChristopherVR/pptx-viewer/commit/c33b7b72eaef6389bcbdbe8c50bca623a48cfb80))
- Repair broken test assertions and clean up lint config (by @ChristopherVR) ([cc9b392](https://github.com/ChristopherVR/pptx-viewer/commit/cc9b3920e50b7a21d93a2b19b559a69759dad897))
- Bump all packages to 1.x.1 patch versions (by @ChristopherVR) ([c75205a](https://github.com/ChristopherVR/pptx-viewer/commit/c75205a96cc7797d1647ac4705395b7707ac8910))

## [1.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.1.1) - 2026-04-10

### 🐛 Bug Fixes

- **ci:** Resolve npm publish version mismatch and add duplicate check (by @ChristopherVR) ([4f962fd](https://github.com/ChristopherVR/pptx-viewer/commit/4f962fdeeac95a6a38b8b6ab99139223ef7471da))

## [1.0.12](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.12) - 2026-04-09

### 🚀 Features

- **react:** Implement functional Broadcast slide show with Yjs collaboration (by @ChristopherVR) ([67bdc71](https://github.com/ChristopherVR/pptx-viewer/commit/67bdc715f98cada5fa1f1048e6ef4b0582047d1d))
- **react:** Add collaboration overlays, eraser tool, and UI enhancements (by @ChristopherVR) ([84acc33](https://github.com/ChristopherVR/pptx-viewer/commit/84acc33db713b4c0278e60a9e60acfc103efe974))

## [1.0.11](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.11) - 2026-04-09

### 🚀 Features

- **react:** Restructure toolbar into PowerPoint-style ribbon (by @ChristopherVR) ([ba04e83](https://github.com/ChristopherVR/pptx-viewer/commit/ba04e83deb58530acff86199695e8493cec70460))
- **react:** Redesign status bar with zoom, view modes, and notes toggle (by @ChristopherVR) ([49c01fb](https://github.com/ChristopherVR/pptx-viewer/commit/49c01fb1e555882cf78495f2a951d838dc3c5fd0))
- **react:** Restyle slide panel, custom scrollbars, and layout polish (by @ChristopherVR) ([e9ae32e](https://github.com/ChristopherVR/pptx-viewer/commit/e9ae32eeef361c2469f5587cc475750c2b3071f2))
- **react:** Add File, Animations, Slide Show tabs and enhance existing toolbar sections (by @ChristopherVR) ([503b01d](https://github.com/ChristopherVR/pptx-viewer/commit/503b01d0854890ebac1bb91bde1ad7ba0dbbb5ab))
- **react:** Add Settings dialog and Share collaboration dialog (by @ChristopherVR) ([8d21abe](https://github.com/ChristopherVR/pptx-viewer/commit/8d21abe90b479e7ca27c41273f047ea52db40c41))
- **react:** Implement full document sync via yJS CRDTs (by @ChristopherVR) ([bafda7a](https://github.com/ChristopherVR/pptx-viewer/commit/bafda7a8b63183fdbe47bd36d9ea6a8b61d7d331))
- **demo:** Add collaboration server, URL-based joining, and New Presentation button (by @ChristopherVR) ([0246d40](https://github.com/ChristopherVR/pptx-viewer/commit/0246d408dc06b8701131922965c36e9ac428198d))

### 🐛 Bug Fixes

- **i18n:** Replace hardcoded English strings with t() translation calls (by @ChristopherVR) ([765368b](https://github.com/ChristopherVR/pptx-viewer/commit/765368bf8f40e5e0424a4de1d9d93bc498cc1886))
- **test:** Add i18n mocks to react tests and bump versions to 1.2.0 (by @ChristopherVR) ([2c1c962](https://github.com/ChristopherVR/pptx-viewer/commit/2c1c9628714b905b28592493abf02fb270107b65))

### 🧪 Testing

- **react:** Add comprehensive toolbar, status bar, and collaboration tests (by @ChristopherVR) ([cd02206](https://github.com/ChristopherVR/pptx-viewer/commit/cd02206c1d84df8561b4170c7b8b53d228da8640))
- **tools:** Add comprehensive MCP package tests (192 total) (by @ChristopherVR) ([97a3303](https://github.com/ChristopherVR/pptx-viewer/commit/97a33038542988b7a32c3478998b626fa2c7f4d5))

### 🧹 Chores

- Apply linter auto-fixes, template literals, and update gitignore (by @ChristopherVR) ([ce1288e](https://github.com/ChristopherVR/pptx-viewer/commit/ce1288edb1c4572a3bc8b33624cd69086c56d134))

## [1.0.10](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.10) - 2026-03-29

### 🛠️ Build & CI

- Add @pptx-viewer/tools to test, release, and publish pipeline (by @ChristopherVR) ([0e2ff95](https://github.com/ChristopherVR/pptx-viewer/commit/0e2ff9579a8ea039d4367d69f13998560ee9313d))

### 🧹 Chores

- Rename package to pptx-viewer-mcp and publish to npm (by @ChristopherVR) ([9cb8a25](https://github.com/ChristopherVR/pptx-viewer/commit/9cb8a2567082b9bfdc91efee0b91cf2cbe2aa1c4))

## [1.0.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.9) - 2026-03-29

### 🧹 Chores

- Remove MyClawAssist branding references (by @ChristopherVR) ([bf4d612](https://github.com/ChristopherVR/pptx-viewer/commit/bf4d612af81b026a14dce0ae4befe11952652ba7))
- **tools:** Bump @pptx-viewer/tools to v1.1.0 (by @ChristopherVR) ([c15aba6](https://github.com/ChristopherVR/pptx-viewer/commit/c15aba600c5f2a1137acb157b7dab896e659f37c))
- Bump all packages to v1.1.0 and remove remaining MyClawAssist refs (by @ChristopherVR) ([c386511](https://github.com/ChristopherVR/pptx-viewer/commit/c38651150c08011cee5e17e15f7ee8adc0014b80))

## [1.0.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.8) - 2026-03-29

### 🚀 Features

- **tools:** Scaffold @pptx-viewer/tools package (by @ChristopherVR) ([f34b949](https://github.com/ChristopherVR/pptx-viewer/commit/f34b949e0f6d6460710aa223146399dfbc38a436))
- **tools:** Implement slide tools (getSlide, addSlide, deleteSlides, reorderSlides, duplicateSlide, updateSlideProperties, setSlideTransition, setCanvasSize) (by @ChristopherVR) ([dda381c](https://github.com/ChristopherVR/pptx-viewer/commit/dda381c33c6c228dba0c96f5a3ca9a6ffada4c6a))
- **tools:** Implement element, table, style, content, and conversion tools (by @ChristopherVR) ([dbea52c](https://github.com/ChristopherVR/pptx-viewer/commit/dbea52c83a93ec70d8658371a1a4dfbcac5fdcf3))
- **tools:** Add Zod schemas for all PPTX tools (by @ChristopherVR) ([51cfbf4](https://github.com/ChristopherVR/pptx-viewer/commit/51cfbf48211224871ef09c061f7855586a8cf3b4))
- **tools:** Add PptxCodec for Y.Doc <-> PptxData collaboration (by @ChristopherVR) ([2594779](https://github.com/ChristopherVR/pptx-viewer/commit/25947796fe78612458b57b9918cd2ffc8701b26d))
- **tools:** Implement MCP server with stdio transport (by @ChristopherVR) ([1a130a9](https://github.com/ChristopherVR/pptx-viewer/commit/1a130a99003c72be924738377d4657da67e0b6ac))
- **tools:** Add collaboration-aware execution pipeline with provider interfaces (by @ChristopherVR) ([43f137c](https://github.com/ChristopherVR/pptx-viewer/commit/43f137c053f324abca77240b82ffd005936e9995))
- **core:** Add signature-node module and shared signature utilities (by @ChristopherVR) ([e7cb263](https://github.com/ChristopherVR/pptx-viewer/commit/e7cb26335f15e633cfc37371f16a6ad210be5e11))

### 🐛 Bug Fixes

- **tools:** Align schema types with tool function signatures (by @ChristopherVR) ([985d8f9](https://github.com/ChristopherVR/pptx-viewer/commit/985d8f9cbac323f564a248777b9618cb197ac3a4))

### ♻️ Refactor

- **tools:** Migrate from deprecated server.tool() to server.registerTool() (by @ChristopherVR) ([b9a8bc0](https://github.com/ChristopherVR/pptx-viewer/commit/b9a8bc08854db6eb8ed7d9c83e46e07b50f979a5))

## [1.0.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.7) - 2026-03-17

### 🛠️ Build & CI

- Use NPM_TOKEN for publish auth with OIDC provenance signing (by @ChristopherVR) ([7f98cc7](https://github.com/ChristopherVR/pptx-viewer/commit/7f98cc738e1e89fd56377d1964eb45e3d030a5f0))
- Use Node 24 in publish job for OIDC trusted publishing (by @ChristopherVR) ([bab352d](https://github.com/ChristopherVR/pptx-viewer/commit/bab352d7081df4839efa21869bdc0afd65fc5341))

## [1.0.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.6) - 2026-03-16

### 🛠️ Build & CI

- Use NPM_TOKEN for publish auth instead of pure OIDC (by @ChristopherVR) ([395246f](https://github.com/ChristopherVR/pptx-viewer/commit/395246f51d6a125740ae131ec3ea9bcfeb6134fc))
- Fix npm OIDC trusted publishing by removing registry-url (by @ChristopherVR) ([d3abd98](https://github.com/ChristopherVR/pptx-viewer/commit/d3abd984e1407c17b1cf14d5c96d289fb1542fe4))

## [1.0.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.5) - 2026-03-16

### 🛠️ Build & CI

- Fix perl syntax error in publish and reuse build artifacts (by @ChristopherVR) ([fa533d6](https://github.com/ChristopherVR/pptx-viewer/commit/fa533d66f4a4fe7de14c3a2cef735c92a9b174cc))

## [1.0.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.4) - 2026-03-16

### 📚 Documentation

- Rewrite limitations with technical explanations and remove inaccurate claims (by @ChristopherVR) ([ac4bc84](https://github.com/ChristopherVR/pptx-viewer/commit/ac4bc84ed9bd03f62e3ae29c35baf3f444a3c0bf))

### 🧹 Chores

- Add license files, NOTICE, and package metadata for npm publishing (by @ChristopherVR) ([9464bb8](https://github.com/ChristopherVR/pptx-viewer/commit/9464bb8b91734daf35131d3c7e52e60895fe0a1c))

## [1.0.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.2) - 2026-03-16

### 📚 Documentation

- Restructure root README, elevate limitations, fix outdated claims (by @ChristopherVR) ([86dcda9](https://github.com/ChristopherVR/pptx-viewer/commit/86dcda9b5e3129f2223341337055778db574e985))

## [1.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v1.0.1) - 2026-03-16

### ⚡ Performance

- Speed up crypto tests by making spinCount configurable (by @ChristopherVR) ([a79582e](https://github.com/ChristopherVR/pptx-viewer/commit/a79582e3785a4de0e03dfd2d156a706a28cdc073))

### 🛠️ Build & CI

- Use semver v1.0.x release tags instead of date-based tags (by @ChristopherVR) ([1d2ec18](https://github.com/ChristopherVR/pptx-viewer/commit/1d2ec187acb01ca5be14f0ef627ca68c75960620))

## [20260316.093408](https://github.com/ChristopherVR/pptx-viewer/releases/tag/v20260316.093408) - 2026-03-16

### 🐛 Bug Fixes

- Lint and build type-checks (by @ChristopherVR) ([b5ffc33](https://github.com/ChristopherVR/pptx-viewer/commit/b5ffc3325a178ff5203910564285b64f3ce2176f))
- Resolve remaining typecheck failures in emf-converter and react (by @ChristopherVR) ([f4a46b0](https://github.com/ChristopherVR/pptx-viewer/commit/f4a46b0a40404bd89d2bf065ff7a81348e153fd7))
- Resolve build warnings for unused imports and chunk size (by @ChristopherVR) ([36361d2](https://github.com/ChristopherVR/pptx-viewer/commit/36361d271c1f309a1a29b03f1a02b21c909ac231))
- Enable vitest globals in all packages to fix expectTypeOf errors (by @ChristopherVR) ([6d90d72](https://github.com/ChristopherVR/pptx-viewer/commit/6d90d72ff0107ad0194f9c73ceeb3df244f4cfc6))
- Resolve all remaining test failures for CI (by @ChristopherVR) ([5db8609](https://github.com/ChristopherVR/pptx-viewer/commit/5db8609800b4a7fb829da69f6205fe6fb29a89b4))
- Remove 72 obsolete snapshots from render-snapshots (by @ChristopherVR) ([b5cc60e](https://github.com/ChristopherVR/pptx-viewer/commit/b5cc60ed100013d2f65ea26a0905adad1428ec26))

### 🛠️ Build & CI

- Split test job into parallel per-package jobs (by @ChristopherVR) ([9124f92](https://github.com/ChristopherVR/pptx-viewer/commit/9124f92855a1f626e5ed8d793e319d647189cfbb))
- Use verbose + github-actions reporters for clean CI test output (by @ChristopherVR) ([9909d80](https://github.com/ChristopherVR/pptx-viewer/commit/9909d80e0c2f73ab2556b00aec07dcdf4afc2008))

### 🧹 Chores

- Update GitHub Actions to latest major versions (by @ChristopherVR) ([74bd03c](https://github.com/ChristopherVR/pptx-viewer/commit/74bd03c35bf9eae0207373b13244d34aa05a2b57))
- Updated action to latest version (by @ChristopherVR) ([6a19377](https://github.com/ChristopherVR/pptx-viewer/commit/6a19377fbaceed3bfdf908eb7a5f3e92a5a81ced))
- Removed obsolete snapshots and split tests further in pipeline (by @ChristopherVR) ([cb5a1d6](https://github.com/ChristopherVR/pptx-viewer/commit/cb5a1d6a21a41778bb61da8575969cc28a91f5a3))
- Fix format issue (by @ChristopherVR) ([20f767b](https://github.com/ChristopherVR/pptx-viewer/commit/20f767bed24db2b453d7857f635e3941695aaea2))
