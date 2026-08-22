# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.
A release listed with no entries carried no Conventional Commit in this package's
scope: scripts/release-plan.mjs re-releases a package whenever any of its files
change, not only on conventional ones.

## [2.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@2.0.1) - 2026-08-22

### Bug Fixes

- **react,angular:** Unclip selection handles and stop Angular text runs leaking whitespace (by @ChristopherVR) ([18eebb6](https://github.com/ChristopherVR/pptx-viewer/commit/18eebb6fd8451e1f1d46d0c248c1e0a5b0d94a53))

## [2.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@2.0.0) - 2026-08-22

### Features

- **core:** Unify SmartArt layout onto one DiagramML interpreter (by @ChristopherVR) ([89116b1](https://github.com/ChristopherVR/pptx-viewer/commit/89116b131a3f13fb6b65789c46d3f9a7814d04db))
- **shared:** Print notes pages in every binding, and honour notesStyle in the master preview (by @ChristopherVR) ([6f2f54d](https://github.com/ChristopherVR/pptx-viewer/commit/6f2f54d503806054ae48bfc8f0d0c0ee565977ce))
- **core,shared:** Model timing templates and play animEffect filters (by @ChristopherVR) ([8bf91f2](https://github.com/ChristopherVR/pptx-viewer/commit/8bf91f20c907f9d92abbcd5a59fb424ddfabdbd8))
- **core,shared:** Cross-browser reflections, overlay fills, and remaining text gaps (by @ChristopherVR) ([c0b0d6d](https://github.com/ChristopherVR/pptx-viewer/commit/c0b0d6d6805c6383ba2a01da3c8a22792eb22cdb))

### Bug Fixes

- **core,shared:** Correct animation preset IDs against PowerPoint COM ground truth (by @ChristopherVR) ([61b0014](https://github.com/ChristopherVR/pptx-viewer/commit/61b001440de0bf73bfcd6efd21c8df21bd47e5c8))
- **react:** Consume the shared render decisions and fix a swallowed load error (by @ChristopherVR) ([7ec6892](https://github.com/ChristopherVR/pptx-viewer/commit/7ec6892d445980597d584166c905d2bd26375752))
- **core,shared:** Honour cTn timing attributes, after-animation and effect sound (by @ChristopherVR) ([07ee51f](https://github.com/ChristopherVR/pptx-viewer/commit/07ee51f8b11431153e9ce2553c4c11a51e15316e))
- **react:** Consume the shared decisions for the second parity wave (by @ChristopherVR) ([7238a36](https://github.com/ChristopherVR/pptx-viewer/commit/7238a36e63c639376f241316b5d8c661e824fedb))

## [1.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.9.0) - 2026-08-21

### Features

- **shared,react:** Wire interactive 3D surface chart scene (opt-in) (by @ChristopherVR) ([78587a4](https://github.com/ChristopherVR/pptx-viewer/commit/78587a4b2b34f745bd71a29d8952621eec31d3b9))

## [1.8.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.8.1) - 2026-08-21

### Bug Fixes

- **react:** Route GroupInfoPanel text through t(), not hardcoded English (by @ChristopherVR) ([48cc85f](https://github.com/ChristopherVR/pptx-viewer/commit/48cc85f4b3b42d49bbdb321ab02191b8a7d1332a))

### Refactor

- **react:** Drop now-redundant local download-sanitization wrapper (by @ChristopherVR) ([7b5e6a1](https://github.com/ChristopherVR/pptx-viewer/commit/7b5e6a1508a6b42b50165fd47eef5d7ee49b89bc))
- **react,vue,svelte,vanilla:** Repoint media-type check onto shared (by @ChristopherVR) ([bb8e95c](https://github.com/ChristopherVR/pptx-viewer/commit/bb8e95c810e2fd709e12f21d5b073b179e1dbf52))
- **react:** Repoint template background card onto shared row resolver (by @ChristopherVR) ([b27fd04](https://github.com/ChristopherVR/pptx-viewer/commit/b27fd04a1514377fca139b91b8c079ea3cf7ceec))
- **react:** Repoint chart type-change patch onto shared patchChartData (by @ChristopherVR) ([9a97113](https://github.com/ChristopherVR/pptx-viewer/commit/9a971139a5acd0ec7cf7e87b73b1f59e9a55f100))

## [1.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.8.0) - 2026-08-21

### Features

- **shared:** Add hover tooltips to every chart mark, not just the region map (by @ChristopherVR) ([4ca29f5](https://github.com/ChristopherVR/pptx-viewer/commit/4ca29f590b1d1154b1034b7c5aeaa469610353d5))

### Bug Fixes

- **react:** Disable mobile bottom bar actions with no slides loaded (by @ChristopherVR) ([ae9892f](https://github.com/ChristopherVR/pptx-viewer/commit/ae9892fc5a0effc35ebe1e41add79f053920f597))
- **react,svelte:** Block unsafe URL schemes on hyperlink save (by @ChristopherVR) ([61b43e6](https://github.com/ChristopherVR/pptx-viewer/commit/61b43e6d0b5dfc4b101d82bfe817bbc58680ef37))
- **shared:** Extract table column-width redistribution to shared (by @ChristopherVR) ([cbd9fc7](https://github.com/ChristopherVR/pptx-viewer/commit/cbd9fc78dde57a72de3049a2ea01e1676957b463))
- **mobile:** Repoint react/vue/angular mobile sheet toggling onto shared (by @ChristopherVR) ([d8e6228](https://github.com/ChristopherVR/pptx-viewer/commit/d8e62280d49f1b7cdaa3e5034e2134c7380e5063))
- **shared:** Repoint options numeric-control clamp onto shared helper (by @ChristopherVR) ([138dfe5](https://github.com/ChristopherVR/pptx-viewer/commit/138dfe5d6cc780915ab8d9ca591f75c698b35f22))
- **react:** Repoint comment markers onto shared buildCommentMarkers (by @ChristopherVR) ([d3ddba1](https://github.com/ChristopherVR/pptx-viewer/commit/d3ddba1ff766a6d619b53a2e18d6363ad9323423))
- **ci:** Resolve oxlint errors and warnings blocking CI lint job (by @ChristopherVR) ([a2031be](https://github.com/ChristopherVR/pptx-viewer/commit/a2031bedb27a4d1bf7c0cf754ce6b81a241972e5))
- **react:** Let table-style band colors survive un-styled cells (by @ChristopherVR) ([b1c8215](https://github.com/ChristopherVR/pptx-viewer/commit/b1c82152c13e24a1eb2e952ec267674fc1057d75))

### Refactor

- **shared:** Extract SmartArt node-count bounds table (by @ChristopherVR) ([10cd945](https://github.com/ChristopherVR/pptx-viewer/commit/10cd945140ea3757086f0c4b1c6ea71adbb4d825))
- **shared:** Extract animation drag-to-reorder into shared (by @ChristopherVR) ([b136d02](https://github.com/ChristopherVR/pptx-viewer/commit/b136d023174959e9c51b3667e8ab78a8a983cb9f))
- **shared:** Extract SmartArt text-pane handlers to shared (by @ChristopherVR) ([911693c](https://github.com/ChristopherVR/pptx-viewer/commit/911693c9c02b63ee284890653b4dc977e35af170))
- **shared:** Extract chart legend layout to shared (by @ChristopherVR) ([acec62b](https://github.com/ChristopherVR/pptx-viewer/commit/acec62b1be7203e90206a0852e6544b73bb52266))
- **shared:** Extract animation timeline-bar layout math to shared (by @ChristopherVR) ([1a9f66d](https://github.com/ChristopherVR/pptx-viewer/commit/1a9f66d7629e18174997fdf9135edb7a70d8660e))
- **shared:** Extract table quick-style preset application (by @ChristopherVR) ([aa52c10](https://github.com/ChristopherVR/pptx-viewer/commit/aa52c106a158b2c2361b05e05968d9daadda2e52))
- **react,vue,angular:** Repoint chart value-drag onto shared engine (by @ChristopherVR) ([1d5fd6a](https://github.com/ChristopherVR/pptx-viewer/commit/1d5fd6af4a8847168674b50e9039d6ba96926f43))
- **shared,react,vue,vanilla:** Repoint comment mutations onto shared comments-list (by @ChristopherVR) ([0eb28dc](https://github.com/ChristopherVR/pptx-viewer/commit/0eb28dc5d714ebe695c8b23c6b09aefc6b99ac0d))
- **react,vue:** Repoint SmartArt chrome style onto shared buildChromeStyle (by @ChristopherVR) ([2a9602f](https://github.com/ChristopherVR/pptx-viewer/commit/2a9602f8ee7f930c4d950f19ba616196bc9d9cb7))
- **react:** Repoint print handlers onto shared print helpers (by @ChristopherVR) ([b921759](https://github.com/ChristopherVR/pptx-viewer/commit/b921759efae72adc93509e1d21c4f36d2aba6606))

### Documentation

- Correct chart-interactivity limitations text (by @ChristopherVR) ([4e91c36](https://github.com/ChristopherVR/pptx-viewer/commit/4e91c360eb13c1e62f8e42abd207c7844f822975))

## [1.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.7.0) - 2026-08-19

### Features

- **cli:** Make @christophervr/pptx-viewer a drop-in for pptx-react-viewer (by @ChristopherVR) ([2c13717](https://github.com/ChristopherVR/pptx-viewer/commit/2c13717c4f16cb73882bf887087af75986ebd264))

### Bug Fixes

- **ci:** Stop the hourly release writing an empty changelog section (by @ChristopherVR) ([d53c0fe](https://github.com/ChristopherVR/pptx-viewer/commit/d53c0feffa2c2d9c67dfc495cb8dbefdf23638ae))

## [1.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.6.0) - 2026-08-07

### Features

- **core:** Export and import decks as portable JSON (by @ChristopherVR) ([965fc05](https://github.com/ChristopherVR/pptx-viewer/commit/965fc05ce0993d97a15d6199c8763eada99fa646))
- **shared:** Blackboard mode, element rename and column charts (by @ChristopherVR) ([a69ffce](https://github.com/ChristopherVR/pptx-viewer/commit/a69ffce0a7635632cf19cb060b329a8ff5d19422))

## [1.5.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.9) - 2026-07-27

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## [1.5.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.8) - 2026-07-25

### Chores

- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))

## [1.5.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.7) - 2026-07-23

### Bug Fixes

- **cli:** Accept every framework major the viewer packages support (by @ChristopherVR) ([fb00075](https://github.com/ChristopherVR/pptx-viewer/commit/fb000758169a74ad15de48344c458e54b3d8ccde))

## [1.5.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.6) - 2026-07-23

## [1.5.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.5) - 2026-07-18

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.5.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.4) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.5.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.3) - 2026-07-16

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

## [1.5.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.2) - 2026-07-13

### Bug Fixes

- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Dependencies

- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## [1.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.1) - 2026-07-12

### Bug Fixes

- **cli:** Fix Angular Node.js preflight, vanilla three dep, collab packages prompt (by @ChristopherVR) ([8e41cea](https://github.com/ChristopherVR/pptx-viewer/commit/8e41cea107925c61a6ec94480a71fc91df31e4d9))

## [1.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.5.0) - 2026-07-11

### Features

- **cli:** Add svelte and vanilla js install/scaffold targets (by @ChristopherVR) ([768aafe](https://github.com/ChristopherVR/pptx-viewer/commit/768aafe14f57b75cc3d91a00c62be261c4044789))

## [1.4.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.4.2) - 2026-07-07

### Bug Fixes

- CLI interactive installation (by @ChristopherVR) ([7b0f649](https://github.com/ChristopherVR/pptx-viewer/commit/7b0f649caa2a2f7bdea949f2583f6c86ff218cc5))

## [1.4.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.4.1) - 2026-07-05

### Bug Fixes

- **cli:** Scaffold i18n setup, suppress scaffolder output, auto-run dev (by @ChristopherVR) ([d99b463](https://github.com/ChristopherVR/pptx-viewer/commit/d99b463ccbf39d05f47c044af7053c53f400b2d9))

## [1.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.4.0) - 2026-07-05

### Features

- **core,cli:** Add react, angular, vue to npm keywords (by @ChristopherVR) ([528ec61](https://github.com/ChristopherVR/pptx-viewer/commit/528ec6182bb77c07444dd0e93560b65e604b9524))

## [1.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.3.0) - 2026-07-04

## [1.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.2.0) - 2026-07-04

### Features

- **cli:** Enforce a single UI framework and harden terminal handling (by @ChristopherVR) ([d1c9ae5](https://github.com/ChristopherVR/pptx-viewer/commit/d1c9ae551070ec29bf474a76af21f3b0682fb36d))

## [1.1.46](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.1.46) - 2026-07-03

### Features

- **cli:** Arrow-key colour prompts and PowerPoint-ready scaffolds (by @ChristopherVR) ([8de03c9](https://github.com/ChristopherVR/pptx-viewer/commit/8de03c9da8c8d20e28cca253ff6d7083de65a0d8))

## [1.1.45](https://github.com/ChristopherVR/pptx-viewer/releases/tag/@christophervr/pptx-viewer@1.1.45) - 2026-07-02

### Features

- **cli:** Add interactive @christophervr/pptx-viewer installer (by @ChristopherVR) ([4df680d](https://github.com/ChristopherVR/pptx-viewer/commit/4df680d9791d18e38c0f413420e8e1e5f9f2907e))
