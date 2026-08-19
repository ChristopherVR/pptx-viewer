# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.
A release listed with no entries carried no Conventional Commit in this package's
scope: scripts/release-plan.mjs re-releases a package whenever any of its files
change, not only on conventional ones.

## [2.18.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.18.5) - 2026-08-19

### Dependencies

- **deps:** Update @angular/core requirement from ^22.1.0 to ^22.1.2 ([#170](https://github.com/ChristopherVR/pptx-viewer/issues/170)) (by @dependabot[bot]) ([ee56a6f](https://github.com/ChristopherVR/pptx-viewer/commit/ee56a6f91c74e6bb72aad8b51394b6218c8680b0))
- **deps:** Update y-websocket requirement from ^3.0.0 to ^3.1.0 ([#169](https://github.com/ChristopherVR/pptx-viewer/issues/169)) (by @dependabot[bot]) ([7e9c5a5](https://github.com/ChristopherVR/pptx-viewer/commit/7e9c5a51a7cb46df36223df4f91f192200562871))

### Chores

- **deps-dev:** Bump jsdom from 29.1.1 to 30.0.1 ([#171](https://github.com/ChristopherVR/pptx-viewer/issues/171)) (by @dependabot[bot]) ([cfe38c9](https://github.com/ChristopherVR/pptx-viewer/commit/cfe38c9e848bd509e59dfbbb6898aac13ce69b7e))
- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#162](https://github.com/ChristopherVR/pptx-viewer/issues/162)) (by @dependabot[bot]) ([2645f25](https://github.com/ChristopherVR/pptx-viewer/commit/2645f258a35282b61960c30649f216e583879f12))

## [2.18.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.18.4) - 2026-08-14

### Bug Fixes

- **vanilla:** Repair the properties panel, inline editor, mobile chrome and show performance (by @ChristopherVR) ([47265ef](https://github.com/ChristopherVR/pptx-viewer/commit/47265efba9459359695bdcd74038b8b6d0787d0f))

## [2.18.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.18.3) - 2026-08-14

### Bug Fixes

- **shared:** Run an in-place morph dissolve on the wrapper, not the element (by @ChristopherVR) ([d46d2ee](https://github.com/ChristopherVR/pptx-viewer/commit/d46d2eea5aeced925f1b51b4be2758f2b634ea3e))

## [2.18.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.18.2) - 2026-08-14

### Bug Fixes

- **shared:** Sum a morph cross-dissolve instead of stacking two fades (by @ChristopherVR) ([86a9e7a](https://github.com/ChristopherVR/pptx-viewer/commit/86a9e7a2ab851d7b0005ab2d1c2267f668b308a8))

### Testing

- Mask the fields that legitimately move, and size two waits for CI (by @ChristopherVR) ([68bae19](https://github.com/ChristopherVR/pptx-viewer/commit/68bae19fe8cb3e283e2c87a90d31946c48be5e3a))

## [2.18.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.18.1) - 2026-08-14

### Bug Fixes

- Repair five regressions this review introduced (by @ChristopherVR) ([952063b](https://github.com/ChristopherVR/pptx-viewer/commit/952063b7c1a198aed9acc0696b2b326deba35e95))

## [2.18.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.18.0) - 2026-08-13

### Features

- **shared:** Own the decisions the bindings were each making themselves (by @ChristopherVR) ([5421272](https://github.com/ChristopherVR/pptx-viewer/commit/5421272a531536ab3b494e5df91068c98326e6ed))
- **shared:** Model hyperlinks and equations, and own the group rules (by @ChristopherVR) ([a6bf4c1](https://github.com/ChristopherVR/pptx-viewer/commit/a6bf4c15ab3b49a44a2d24e2122ddbe3cdd3b8ed))
- **shared:** Own the decisions the bindings were still making apart (by @ChristopherVR) ([2bee9c5](https://github.com/ChristopherVR/pptx-viewer/commit/2bee9c5c1ec731d3f7097983a0c9c739ce95f5a4))
- **shared:** Take the last six chart kinds and the autosave policy (by @ChristopherVR) ([efe8438](https://github.com/ChristopherVR/pptx-viewer/commit/efe84381688dfb5f2a44a2990e76aa09b65e5fba))

### Bug Fixes

- **core:** Repair save-pipeline corruption found by the OpenXML parity audit (by @ChristopherVR) ([554006e](https://github.com/ChristopherVR/pptx-viewer/commit/554006e004b6212f5561eb19954bbcff17bbdf7f))
- **core:** Close the round-trip defects the corpus harness exposed (by @ChristopherVR) ([2011c66](https://github.com/ChristopherVR/pptx-viewer/commit/2011c664049bfd580801529c3337ba65bd8d3f13))
- **angular:** Bind the SmartArt descriptors and route master edits (by @ChristopherVR) ([3ccdef6](https://github.com/ChristopherVR/pptx-viewer/commit/3ccdef643aa73ec6619d258a0a31564540043bb0))
- **core:** Stop save rewriting what the author never wrote (by @ChristopherVR) ([6fb2767](https://github.com/ChristopherVR/pptx-viewer/commit/6fb2767583de0e82747c3700e3311869dd693a1d))
- **angular,svelte,vanilla:** Close the remaining binding gaps (by @ChristopherVR) ([a7c377c](https://github.com/ChristopherVR/pptx-viewer/commit/a7c377c9d40e174434e6d7801cfc72d0e871a37f))
- **core:** Repair the XML plumbing four separate defects were hiding behind (by @ChristopherVR) ([8beb664](https://github.com/ChristopherVR/pptx-viewer/commit/8beb66410975d492118120515bbae6cd070ef792))
- **bindings:** Stop read-only surfaces clobbering live state (by @ChristopherVR) ([e820984](https://github.com/ChristopherVR/pptx-viewer/commit/e8209842fad62819df1530944124f0bfc33e32ec))

### Refactor

- **angular:** Retire hand-ported logic and wire the missing renderers (by @ChristopherVR) ([d9e629e](https://github.com/ChristopherVR/pptx-viewer/commit/d9e629e283a5e8843139c88afb60b90523628f15))

## [2.17.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.9) - 2026-08-11

### Bug Fixes

- **shared:** Keep a morph pair travelling when its outline is tweened too (by @ChristopherVR) ([0316cf7](https://github.com/ChristopherVR/pptx-viewer/commit/0316cf7b058bc49b247250d9e188822fdd4ef11f))
- **shared:** Dissolve a re-fitted morph paragraph in place instead of stretching it (by @ChristopherVR) ([975c6f6](https://github.com/ChristopherVR/pptx-viewer/commit/975c6f600a836081ec0f30c99fffb9aabbaaa598))

## [2.17.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.8) - 2026-08-11

### Bug Fixes

- **shared:** Stop Vue and Angular writing an inline pointer-events lock during a show (by @ChristopherVR) ([4cb649a](https://github.com/ChristopherVR/pptx-viewer/commit/4cb649a53f5903557ef2f93c190fe6ddd538599e))

## [2.17.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.7) - 2026-08-11

### Refactor

- **shared:** One paragraph-spacing resolver, and delete four more binding copies (by @ChristopherVR) ([65f8268](https://github.com/ChristopherVR/pptx-viewer/commit/65f8268df08021c1985dc86d93d3338c96b792c8))
- **shared:** Give the cached-SmartArt projection the whole decision, and React's table styling too (by @ChristopherVR) ([411148f](https://github.com/ChristopherVR/pptx-viewer/commit/411148f44630a65b1cd6e90a2954a53a24f110a5))
- **react:** Delete the unreachable SmartArt renderer tree and shim seven more copies (by @ChristopherVR) ([02dddb6](https://github.com/ChristopherVR/pptx-viewer/commit/02dddb65543c7db4bde1a08d30d3d64fffa87440))
- **shared:** Move find/replace and per-cell table CSS off their React copies (by @ChristopherVR) ([5b81728](https://github.com/ChristopherVR/pptx-viewer/commit/5b81728891f3e8cea1c2def2aed2d8b23e338081))

## [2.17.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.6) - 2026-08-10

### Bug Fixes

- **shared:** Render cached SmartArt shapes and transparent table headers as authored (by @ChristopherVR) ([24ec6b4](https://github.com/ChristopherVR/pptx-viewer/commit/24ec6b4f2079b55f02aa5559bfa3c3f1eae67652))
- **react:** Connect the Home tab's Layout control to the slide it acts on (by @ChristopherVR) ([6cb76bb](https://github.com/ChristopherVR/pptx-viewer/commit/6cb76bb27caaf486c280f432f9476f2365eb46ca))

## [2.17.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.5) - 2026-08-10

### Bug Fixes

- **core:** Read placeholder, list and percentage values as authored (by @ChristopherVR) ([dc2d679](https://github.com/ChristopherVR/pptx-viewer/commit/dc2d679d48d3be854743d3a09bd2e20c5dc5331f))
- **shared:** Paint an inert morph ghost statically so it stops jittering (by @ChristopherVR) ([ce3be84](https://github.com/ChristopherVR/pptx-viewer/commit/ce3be8487d3530425afb3b455e1671b6c54ae61c))

## [2.17.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.4) - 2026-08-10

### Bug Fixes

- **shared:** Crossfade morph wording instead of fading it out then in (by @ChristopherVR) ([50984f1](https://github.com/ChristopherVR/pptx-viewer/commit/50984f141acc601d35aad19883b6fb1f8e0b79c2))

## [2.17.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.3) - 2026-08-10

### Dependencies

- **deps:** Update dompurify requirement from ^3.4.12 to ^3.4.13 ([#151](https://github.com/ChristopherVR/pptx-viewer/issues/151)) (by @dependabot[bot]) ([7b975ff](https://github.com/ChristopherVR/pptx-viewer/commit/7b975ff73403916341fd8a6192fb6fd6c88fdc17))
- **deps:** Update yjs requirement from ^13.6.31 to ^13.6.32 ([#152](https://github.com/ChristopherVR/pptx-viewer/issues/152)) (by @dependabot[bot]) ([456fdb8](https://github.com/ChristopherVR/pptx-viewer/commit/456fdb8493487ab3e346714755239a90698f6b4d))

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#150](https://github.com/ChristopherVR/pptx-viewer/issues/150)) (by @dependabot[bot]) ([ab75bf1](https://github.com/ChristopherVR/pptx-viewer/commit/ab75bf10a96bb2a0da6e963a5b6b8634e4f73d5b))

## [2.17.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.2) - 2026-08-08

### Bug Fixes

- Dissolve a morph's arriving shapes over the ghost that hid them (by @ChristopherVR) ([89536a3](https://github.com/ChristopherVR/pptx-viewer/commit/89536a36c3e38c3bc8b1219f702dee39e1526fcb))
- Dissolve a morph's centre panel the way PowerPoint measurably does (by @ChristopherVR) ([8c03a9a](https://github.com/ChristopherVR/pptx-viewer/commit/8c03a9a4db720dc4c6883ecd5778749e9148f3af))
- **shared:** Measure per word, and never measure a glyph in isolation (by @ChristopherVR) ([a92004b](https://github.com/ChristopherVR/pptx-viewer/commit/a92004bd554a66e5a0812d5bd20b3df1fff94379))

## [2.17.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.1) - 2026-08-07

### Bug Fixes

- **shared:** Morph a picture's scale, which OOXML stores as a source crop (by @ChristopherVR) ([e2743c7](https://github.com/ChristopherVR/pptx-viewer/commit/e2743c7509090272f4d7bed6df506402de8f6a91))
- **shared:** A still of a slide paints no media chrome (by @ChristopherVR) ([d99e6fd](https://github.com/ChristopherVR/pptx-viewer/commit/d99e6fda7de360e1b1c3f16c578119f8ce5b5d5a))
- **angular:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([7a97cea](https://github.com/ChristopherVR/pptx-viewer/commit/7a97cea6c5bb8e742ed16bc8a7c883595564bb71))
- **shared:** Measure each run's PowerPoint width instead of guessing one (by @ChristopherVR) ([920d1f3](https://github.com/ChristopherVR/pptx-viewer/commit/920d1f38129886f834fcfe42681339e8251f6814))
- **shared:** A media fallback says WHICH badge, not just "a badge" (by @ChristopherVR) ([1cbe78f](https://github.com/ChristopherVR/pptx-viewer/commit/1cbe78f85985ca87a834380932d845303250606d))
- **angular:** Mark missing media as not found, not as playable (by @ChristopherVR) ([b674f0f](https://github.com/ChristopherVR/pptx-viewer/commit/b674f0f7f764aee3ad7e879232b232bd3e437172))

### Styling

- **shared:** Escape the measurement cache separator (by @ChristopherVR) ([944b312](https://github.com/ChristopherVR/pptx-viewer/commit/944b312abee48c351b84e39c794027a18ec2d758))

## [2.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.17.0) - 2026-08-07

### Features

- Navigate a running slide show on the wheel in every binding (by @ChristopherVR) ([91a19e9](https://github.com/ChristopherVR/pptx-viewer/commit/91a19e96df9d19862b92c3f89ca55acbfbde3111))

## [2.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.16.0) - 2026-08-07

### Features

- **shared:** Map wheel gestures to PowerPoint's intents (by @ChristopherVR) ([1cc7797](https://github.com/ChristopherVR/pptx-viewer/commit/1cc779799cf5b6ffa94c39199c71b563e21afa82))

### Refactor

- Route four bindings through the shared geometry cascade (by @ChristopherVR) ([859ca12](https://github.com/ChristopherVR/pptx-viewer/commit/859ca12b37efcf98e7614b2c2109f3bf1d9c0f72))

## [2.15.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.15.3) - 2026-08-07

### Bug Fixes

- **shared:** Stop category-axis labels crowding the plot (by @ChristopherVR) ([b511ac4](https://github.com/ChristopherVR/pptx-viewer/commit/b511ac44bb53ed2ca20932801c805ea7f0a2fcd1))
- Let clicks fall through an unfilled shape's interior (by @ChristopherVR) ([7e17f9d](https://github.com/ChristopherVR/pptx-viewer/commit/7e17f9ddacd058d9b5c13f1060f58621faeb9908))
- Hollow-shape click-through in the remaining four bindings (by @ChristopherVR) ([fee05ad](https://github.com/ChristopherVR/pptx-viewer/commit/fee05ad5463de9949f289d3aac889794bc7d834a))

### Refactor

- **shared:** Single-source the shape geometry cascade (by @ChristopherVR) ([396e4a2](https://github.com/ChristopherVR/pptx-viewer/commit/396e4a28299168af0564364e9b0be7413b2c8ce8))

## [2.15.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.15.2) - 2026-08-07

### Bug Fixes

- **core:** Measure parallelogram skew against the short side, not the width (by @ChristopherVR) ([fea647f](https://github.com/ChristopherVR/pptx-viewer/commit/fea647f94633e6e919a1c59bda7a71cda8b1b677))
- **core:** Bulge the teardrop preset's point outwards, not inwards (by @ChristopherVR) ([0b23bc4](https://github.com/ChristopherVR/pptx-viewer/commit/0b23bc4b6ecde5f82f7cebb0601859edbf1ab399))
- Render ellipses as ellipses, not pills (by @ChristopherVR) ([b6d2598](https://github.com/ChristopherVR/pptx-viewer/commit/b6d2598fb58f8fc81fbef463c728d87a78c129b4))
- Stop slicing overflowing text with an identity rect clip-path (by @ChristopherVR) ([7393111](https://github.com/ChristopherVR/pptx-viewer/commit/73931118e9e29bf16d1ffccb6f01d68a02091463))

## [2.15.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.15.1) - 2026-08-07

### Bug Fixes

- **core:** Recognize nodeType="afterEffect" when parsing animation triggers (by @ChristopherVR) ([554c077](https://github.com/ChristopherVR/pptx-viewer/commit/554c077b6d0960c5777163a83afe27ee9795b8c2))

## [2.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.15.0) - 2026-08-07

### Features

- **shared:** Remember the open deck so a refresh reopens it (by @ChristopherVR) ([abbe3bd](https://github.com/ChristopherVR/pptx-viewer/commit/abbe3bd15318dd2b7b470eb69b51468d5b9ed26a))

### Bug Fixes

- **shared:** Make Set Up Slide Show's Manual advance mode actually work (by @ChristopherVR) ([c308423](https://github.com/ChristopherVR/pptx-viewer/commit/c3084238158b582b149fcc74903045f4145a0981))
- **angular:** Resolve viewer-store-signal test import from vendored shared (by @ChristopherVR) ([e7aa0cc](https://github.com/ChristopherVR/pptx-viewer/commit/e7aa0cce1509b62b5326d39ecf81309ad330c48e))

## [2.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.14.0) - 2026-08-07

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
- **angular:** Apply animation styles before paint and fix the AI sheet (by @ChristopherVR) ([2ba4267](https://github.com/ChristopherVR/pptx-viewer/commit/2ba4267912b0d1cc2946c29a78b467521c747feb))
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

## [2.13.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.13.2) - 2026-08-05

### Bug Fixes

- **core:** Resolve styled full font names and add condensed fallbacks (by @ChristopherVR) ([26b1f74](https://github.com/ChristopherVR/pptx-viewer/commit/26b1f745929fe33cda2044dc4a24ff4edbbab0d5))
- **shared:** Draw chart text at point size and scale chart SVGs 1:1 (by @ChristopherVR) ([da333f9](https://github.com/ChristopherVR/pptx-viewer/commit/da333f933eeba0af226ca1894639696350e23cfb))
- **shared:** Suspend the show on window blur, not only tab-hide (by @ChristopherVR) ([4a2c254](https://github.com/ChristopherVR/pptx-viewer/commit/4a2c254350554c189a53a0284aeb72e84b724740))
- **shared:** Fold the origami transition like a sheet of paper (by @ChristopherVR) ([f0f9fc2](https://github.com/ChristopherVR/pptx-viewer/commit/f0f9fc2710a4c1a3760729cfddca0afc7f66c70d))
- **shared:** Cover the fillRect placement fields in the collab schema (by @ChristopherVR) ([d455ed7](https://github.com/ChristopherVR/pptx-viewer/commit/d455ed72b254633d34e08d7694069e6c0d9f5615))

## [2.13.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.13.1) - 2026-08-05

### Dependencies

- **deps:** Bump ai from 7.0.48 to 7.0.44 ([#134](https://github.com/ChristopherVR/pptx-viewer/issues/134)) (by @dependabot[bot]) ([08a13e0](https://github.com/ChristopherVR/pptx-viewer/commit/08a13e076caa6d97e22bd706e57657407aef1dd8))
- **deps:** Bump Angular to 22.1.x consistently across all packages (by @ChristopherVR) ([13c4e5e](https://github.com/ChristopherVR/pptx-viewer/commit/13c4e5e1ee6bcd9723b89757d1a32da2cced1a2a))

## [2.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.13.0) - 2026-08-01

### Features

- Fixed graphs and arrows shapes (by @ChristopherVR) ([94813f5](https://github.com/ChristopherVR/pptx-viewer/commit/94813f52a75fb3b42f72e7c33be41393b794cf82))

## [2.12.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.12.1) - 2026-08-01

### Bug Fixes

- Let the presenter finish the show, and keep scrubbers out of its panes (by @ChristopherVR) ([c7c12bc](https://github.com/ChristopherVR/pptx-viewer/commit/c7c12bc053548c8e94d3da385461d6569a1695a0))

### Refactor

- **shared:** Split arrow markers and dash patterns out of connector-path (by @ChristopherVR) ([53d47d1](https://github.com/ChristopherVR/pptx-viewer/commit/53d47d1d529fe17f165a16ec9de7b7f29b17845c))

## [2.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.12.0) - 2026-08-01

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
- **angular:** Put the show's touch controls where a by-name lookup finds them (by @ChristopherVR) ([826cd54](https://github.com/ChristopherVR/pptx-viewer/commit/826cd54d1f0aff42907ad0efba8fd6cd62986127))

## [2.11.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.11.1) - 2026-07-31

### Bug Fixes

- **shared:** Stop a morph gliding one text box into an unrelated one (by @ChristopherVR) ([bc4789f](https://github.com/ChristopherVR/pptx-viewer/commit/bc4789fef0dbcaf8d524b19f99fac15847597ad0))
- **shared:** Stop a morph double-painting unchanged shapes, and dissolve text (by @ChristopherVR) ([d4b3952](https://github.com/ChristopherVR/pptx-viewer/commit/d4b3952757d719b2c7e1b4be307b14a15c56f73a))
- Stop showing users raw OOXML tokens, and make Vanilla's point index work (by @ChristopherVR) ([33d63ce](https://github.com/ChristopherVR/pptx-viewer/commit/33d63cec94a22ddf7cc0b57ddaa61ddb43eaedd3))
- Skip hidden slides in the show, and honour endWithBlackSlide (by @ChristopherVR) ([2a9ef49](https://github.com/ChristopherVR/pptx-viewer/commit/2a9ef49f97f976eb088a2fcc092b56a54b112fa3))

### Refactor

- **angular:** Decompose the view layer's oversized components (by @ChristopherVR) ([2887d2e](https://github.com/ChristopherVR/pptx-viewer/commit/2887d2e0d4c4f600d7cb80c497bf7d65c8f6635a))

## [2.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.11.0) - 2026-07-31

### Features

- **shared:** Outline view, motion-path authoring, and chart marker resolution (by @ChristopherVR) ([e6a3621](https://github.com/ChristopherVR/pptx-viewer/commit/e6a362195b811231c76a24eb94de8e95795716f8))
- Outline view, motion-path authoring and the missing chart controls (by @ChristopherVR) ([278de2f](https://github.com/ChristopherVR/pptx-viewer/commit/278de2f5754f2b8bb19722460e047deb4cd72fbb))

### Bug Fixes

- **core:** Stop dropping a:pPr/@lvl when a paragraph's runs share one style (by @ChristopherVR) ([03aa4ed](https://github.com/ChristopherVR/pptx-viewer/commit/03aa4edeea15336b032227601cc57fb65d378b1c))

## [2.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.10.0) - 2026-07-31

### Features

- **shared:** Own the equation, media, reading-view and table-grid logic (by @ChristopherVR) ([c33af39](https://github.com/ChristopherVR/pptx-viewer/commit/c33af39d2157fdb8610c104a8a3e54fa8ae7c672))
- Wire reading view, the shared equation pipeline and a table data grid (by @ChristopherVR) ([b731b52](https://github.com/ChristopherVR/pptx-viewer/commit/b731b52f926737f0ccef95247f20db217cee1fb5))

### Bug Fixes

- **shared:** Resolve linked text-box chains inside groups (by @ChristopherVR) ([5e09586](https://github.com/ChristopherVR/pptx-viewer/commit/5e0958689a591f839ccfdf20bb3ae174af00030a))

## [2.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.9.0) - 2026-07-31

### Features

- **shared:** Give every referenced translation key a real entry (by @ChristopherVR) ([8ff4461](https://github.com/ChristopherVR/pptx-viewer/commit/8ff4461d0376408330ef5ce875b4aa7a13d0614f))
- **shared:** Own the logic five bindings had each hand-ported (by @ChristopherVR) ([60b9b0d](https://github.com/ChristopherVR/pptx-viewer/commit/60b9b0d06d60d674835ef23166ca9c46c1b191ba))
- **angular:** Reach ribbon and inspector parity, and stop double-stamping elements (by @ChristopherVR) ([5982b7a](https://github.com/ChristopherVR/pptx-viewer/commit/5982b7a4ee7bc233b20ee7705e9f84160831c986))
- **core:** Model a gradient / pattern outline in structured form (by @ChristopherVR) ([69322c9](https://github.com/ChristopherVR/pptx-viewer/commit/69322c94ab40e37f19a1789c3149b5dd5d71498c))
- **shared:** Stroke a gradient outline as SVG instead of a flat border (by @ChristopherVR) ([fc72324](https://github.com/ChristopherVR/pptx-viewer/commit/fc723241643cdc18bb6ad0c113ca08763c9426ad))
- **angular:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([352ea59](https://github.com/ChristopherVR/pptx-viewer/commit/352ea59a97af4966af13680f2d48caabe8987af0))
- **shared:** Stroke a patterned outline with a real pattern tile (by @ChristopherVR) ([9d8c3bd](https://github.com/ChristopherVR/pptx-viewer/commit/9d8c3bdfbd40e78d0fc66d9325efedb0bc9a3ea4))
- **angular:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([8da41b8](https://github.com/ChristopherVR/pptx-viewer/commit/8da41b8b6d016de0c025d14155b87f0994f12188))
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

- **angular:** Pin the ellipse-sized circle path gradient (by @ChristopherVR) ([9b12ba1](https://github.com/ChristopherVR/pptx-viewer/commit/9b12ba1b8396c57763d21119ceb7dd247469973b))
- **core:** Pin issue #132 fill and adjustment parsing against the reporter deck (by @ChristopherVR) ([06cd312](https://github.com/ChristopherVR/pptx-viewer/commit/06cd31287bcbd3895a834bed9f89af443526dca2))

## [2.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.8.0) - 2026-07-31

### Features

- **shared:** Decide which slide-show clicks are a PowerPoint advance (by @ChristopherVR) ([12ab5c8](https://github.com/ChristopherVR/pptx-viewer/commit/12ab5c82f08083e725eae332ee19b03b5021ce79))

### Bug Fixes

- **angular:** Stop a morph's departing layer covering the incoming slide (by @ChristopherVR) ([e338731](https://github.com/ChristopherVR/pptx-viewer/commit/e3387314197ee7107d135e10fa04aef26bb86bf6))

## [2.7.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.7.1) - 2026-07-31

### Bug Fixes

- **shared:** Match PowerPoint's morph dissolve windows and half-turn direction (by @ChristopherVR) ([661c250](https://github.com/ChristopherVR/pptx-viewer/commit/661c250ff429f0d8ea2f0bb5e2992a7d57af0353))
- **shared:** Stop morph pairing a shape with the group that wraps it (by @ChristopherVR) ([d240498](https://github.com/ChristopherVR/pptx-viewer/commit/d240498388734b5e81b238036856d891f86f2570))
- **core:** Stop an interactive sequence adding a phantom click step (by @ChristopherVR) ([65a4738](https://github.com/ChristopherVR/pptx-viewer/commit/65a4738a6eb8fd0b34999c52dd7e1244c5f0e6b5))
- **shared:** Resolve the timed slide auto-advance delay (by @ChristopherVR) ([beba8cc](https://github.com/ChristopherVR/pptx-viewer/commit/beba8ccb834f1eb04db305d68ac31d40beda4232))
- **angular:** Paint a fully transparent solid fill transparently (by @ChristopherVR) ([8410d7d](https://github.com/ChristopherVR/pptx-viewer/commit/8410d7dc08fe9fdf49cc684346cdbe0ca1042a1c))
- **angular:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([6435beb](https://github.com/ChristopherVR/pptx-viewer/commit/6435beb0156cb71087a61f90c857f44f7b10da06))

### Refactor

- **shared:** Break the morph-matching <-> morph-flatten import cycle (by @ChristopherVR) ([92223c5](https://github.com/ChristopherVR/pptx-viewer/commit/92223c542d357d2831b4b3641180fec20c264dc1))

## [2.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.7.0) - 2026-07-31

### Features

- **shared:** Morph a !!-named shape across a grouping boundary (by @ChristopherVR) ([c74847d](https://github.com/ChristopherVR/pptx-viewer/commit/c74847dd53ef3344c4624c036a2f806ea62794c1))

### Bug Fixes

- **shared:** Morph rotates the short way round, like PowerPoint (by @ChristopherVR) ([255d0b5](https://github.com/ChristopherVR/pptx-viewer/commit/255d0b5541bdf12d66ab773090fee179072eb852))
- **shared:** Honour the legacy spd speed, including for morph (by @ChristopherVR) ([ab796b9](https://github.com/ChristopherVR/pptx-viewer/commit/ab796b94e27fa8addbad5f70578b4c9a591c1b11))
- **shared:** Keep a morphing object solid instead of dipping to the background (by @ChristopherVR) ([5f2b518](https://github.com/ChristopherVR/pptx-viewer/commit/5f2b518d39c16eeb207f70ea1df2583405022611))

## [2.6.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.6.6) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph id-pairing shapes whose creationId GUIDs differ (by @ChristopherVR) ([b9afc84](https://github.com/ChristopherVR/pptx-viewer/commit/b9afc844f0cab88ed44b25236f21b4628f1309a6))
- **angular:** Size a blank line from its endParaRPr, not the body default (by @ChristopherVR) ([ec94d3f](https://github.com/ChristopherVR/pptx-viewer/commit/ec94d3f127e9b67a8770a3a9e8e429f7e7e3a4e5))

## [2.6.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.6.5) - 2026-07-30

### Bug Fixes

- **core:** Stamp the endParaRPr size on an empty paragraph's separator (by @ChristopherVR) ([2b18374](https://github.com/ChristopherVR/pptx-viewer/commit/2b1837473bdde04bc41f9593f444a096dd4196b8))
- **shared:** PowerPoint-exact line height, blank-line strut, marker indent reset (by @ChristopherVR) ([7f7181b](https://github.com/ChristopherVR/pptx-viewer/commit/7f7181b2d4ec36f990b157964c2aa648d291b20f))

## [2.6.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.6.4) - 2026-07-30

### Bug Fixes

- **shared:** Restate the static transform in every morph keyframe (by @ChristopherVR) ([075a645](https://github.com/ChristopherVR/pptx-viewer/commit/075a6454fe4a5a17e79e2b2adb213ea2e21ccfb0))

## [2.6.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.6.3) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph pairing nearby shapes of very different sizes; 2s default (by @ChristopherVR) ([3d49c67](https://github.com/ChristopherVR/pptx-viewer/commit/3d49c672089ae26008f24f8cce7160ef22709507))
- **angular:** Default morph to PowerPoint's 2s in the duration policy (by @ChristopherVR) ([fcca9aa](https://github.com/ChristopherVR/pptx-viewer/commit/fcca9aa469f17fdc106ce72782f82c7816f6ee31))

## [2.6.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.6.2) - 2026-07-30

### Bug Fixes

- **shared:** Crossfade a morph pair whose GROUP children changed (by @ChristopherVR) ([7492f26](https://github.com/ChristopherVR/pptx-viewer/commit/7492f26a236659f2c15a99c36a92023f7da6cbbc))

## [2.6.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.6.1) - 2026-07-29

### Bug Fixes

- **core:** Keep grouped text at its authored point size (by @ChristopherVR) ([56f676a](https://github.com/ChristopherVR/pptx-viewer/commit/56f676a850a510fa405361d58c849e4a7adb3bea))
- **shared:** Keep authored blank lines and give the bullet its hanging box (by @ChristopherVR) ([0a8de56](https://github.com/ChristopherVR/pptx-viewer/commit/0a8de560f117fdaeb06374e61e49a2cf4e1372b7))
- **shared:** Make morph animate a near-duplicate slide pair (by @ChristopherVR) ([e73ade7](https://github.com/ChristopherVR/pptx-viewer/commit/e73ade737892f3b46a79eb183370a86e3f8b59fe))
- **angular:** Split paragraphs on load, apply text-body insets and blank lines (by @ChristopherVR) ([e73e1ac](https://github.com/ChristopherVR/pptx-viewer/commit/e73e1ac391d22700bb4615a6762190158b91b34f))

## [2.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.6.0) - 2026-07-27

### Features

- **shared:** Morph transition render plan and paragraph strut basis (by @ChristopherVR) ([94cfddd](https://github.com/ChristopherVR/pptx-viewer/commit/94cfddd2afc9ab20f294f6aa08ddf95fff7f5213))

### Bug Fixes

- **core:** Parse morph, fontRef text colour, and unsized bullets correctly (by @ChristopherVR) ([7607996](https://github.com/ChristopherVR/pptx-viewer/commit/7607996123e493ed1f33a6891e444f3b02bb2ed9))
- **angular:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([09aad03](https://github.com/ChristopherVR/pptx-viewer/commit/09aad031755cb91326d2a8c6d862046775dceb0f))

## [2.5.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.5.3) - 2026-07-27

### Dependencies

- **deps:** Update emf-converter requirement from ^2.0.0 to ^2.0.2 ([#122](https://github.com/ChristopherVR/pptx-viewer/issues/122)) (by @dependabot[bot]) ([423034a](https://github.com/ChristopherVR/pptx-viewer/commit/423034ad1e6d48dbb75be17e1915c917c912517b))
- **deps:** Update html2canvas-pro requirement from ^2.3.1 to ^2.3.2 ([#124](https://github.com/ChristopherVR/pptx-viewer/issues/124)) (by @dependabot[bot]) ([6ad6bce](https://github.com/ChristopherVR/pptx-viewer/commit/6ad6bceecf88670f33e2544dbeb1a98c8b1bf9f6))
- **deps:** Update @lucide/angular requirement from ^1.26.0 to ^1.27.0 ([#127](https://github.com/ChristopherVR/pptx-viewer/issues/127)) (by @dependabot[bot]) ([08dcd42](https://github.com/ChristopherVR/pptx-viewer/commit/08dcd42eb6f05d44f3374256253f2434d8460e35))

### Chores

- **deps-dev:** Update ng-packagr requirement from ^22.0.1 to ^22.0.2 ([#120](https://github.com/ChristopherVR/pptx-viewer/issues/120)) (by @dependabot[bot]) ([5947b3d](https://github.com/ChristopherVR/pptx-viewer/commit/5947b3d292fefa61ce8473fd0744656e16a503e2))

## [2.5.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.5.2) - 2026-07-27

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## [2.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.5.1) - 2026-07-26

### Bug Fixes

- **angular:** Draw collaboration presence in slide space (by @ChristopherVR) ([297aa8f](https://github.com/ChristopherVR/pptx-viewer/commit/297aa8ff6e563d1d60d1d83a6f3ec82c7f9245f2))

## [2.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.5.0) - 2026-07-26

### Features

- **shared:** Lock the audience display out of edit mode (by @ChristopherVR) ([79dc876](https://github.com/ChristopherVR/pptx-viewer/commit/79dc8768ff599e662c4291861b340c2939001f84))
- **shared:** Seed a slide as fully built, and keep audience input inert (by @ChristopherVR) ([6acdf5e](https://github.com/ChristopherVR/pptx-viewer/commit/6acdf5e02c6d727828433ba067942e72d6547922))

### Bug Fixes

- **core:** Keep the click step's own start conditions (by @ChristopherVR) ([755a4b2](https://github.com/ChristopherVR/pptx-viewer/commit/755a4b2e38dff73c9c460a5318c1fce913880328))
- **shared:** Play a slide's opening build without a click (by @ChristopherVR) ([9d0ecec](https://github.com/ChristopherVR/pptx-viewer/commit/9d0ecec007d1f7ef48ecbd97429b55073352a487))
- **angular:** Never show the editor in an audience display (by @ChristopherVR) ([b276613](https://github.com/ChristopherVR/pptx-viewer/commit/b276613b3bed09f1a1dc324c0aca1ead406fd247))
- **core:** Paint useBgFill shapes with the slide background (by @ChristopherVR) ([f819817](https://github.com/ChristopherVR/pptx-viewer/commit/f81981744c637368d1ef0d87b1ba884e634c938a))
- **shared:** Ripple a by-paragraph build that also iterates (by @ChristopherVR) ([73238d5](https://github.com/ChristopherVR/pptx-viewer/commit/73238d590217f8c61e86c9f065d19436dd6b699b))
- **angular:** Hold back on a back step, ignore audience input (by @ChristopherVR) ([291524c](https://github.com/ChristopherVR/pptx-viewer/commit/291524c5f8876314db78eab4c0c9df33786e03c3))

## [2.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.4.0) - 2026-07-25

### Dependencies

- **deps:** Update @lucide/angular requirement from ^1.25.0 to ^1.26.0 ([#114](https://github.com/ChristopherVR/pptx-viewer/issues/114)) (by @dependabot[bot]) ([6ece65a](https://github.com/ChristopherVR/pptx-viewer/commit/6ece65a1d73c4deb975b08cf88085f7caf0322b8))
- **deps:** Update ai requirement from ^7.0.35 to ^7.0.37 ([#115](https://github.com/ChristopherVR/pptx-viewer/issues/115)) (by @dependabot[bot]) ([71d200d](https://github.com/ChristopherVR/pptx-viewer/commit/71d200d5aa0627c90fb2c8bfc0c50ee4b132a7d8))

### Chores

- **deps-dev:** Update @analogjs/vite-plugin-angular requirement ([#118](https://github.com/ChristopherVR/pptx-viewer/issues/118)) (by @dependabot[bot]) ([cade4fd](https://github.com/ChristopherVR/pptx-viewer/commit/cade4fde76da26268c95bed2f166376670edf14d))
- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))
- **deps-dev:** Update happy-dom requirement from ^20.11.0 to ^20.11.1 ([#116](https://github.com/ChristopherVR/pptx-viewer/issues/116)) (by @dependabot[bot]) ([0a2f499](https://github.com/ChristopherVR/pptx-viewer/commit/0a2f4990ae3caa60de537c9e0ea38ca8d796fd56))

## [2.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.3.0) - 2026-07-25

### Features

- **shared:** Rule for advancing a show from the presenter slide pane (by @ChristopherVR) ([ee2d0f5](https://github.com/ChristopherVR/pptx-viewer/commit/ee2d0f584dd042eeee89c57ec3c33335208bde28))

### Bug Fixes

- **core:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([eebf128](https://github.com/ChristopherVR/pptx-viewer/commit/eebf128df224247eb06ea1731c9418fcc36189f9))
- **shared:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([406d78b](https://github.com/ChristopherVR/pptx-viewer/commit/406d78b2471ec171fe5cbd8b2ef6abb3216c3c3b))
- **shared:** Parse playFrom media commands in linear time (by @ChristopherVR) ([60820b1](https://github.com/ChristopherVR/pptx-viewer/commit/60820b10ebf641ec2adf6c6d1089fe9f2bc4e490))
- **angular:** Rotate gradient angles into CSS space (by @ChristopherVR) ([f756f70](https://github.com/ChristopherVR/pptx-viewer/commit/f756f70c254aebed71eaade41e3a2d07e82daf7c))
- **angular:** Scale the outgoing slide during a transition (by @ChristopherVR) ([fe9a450](https://github.com/ChristopherVR/pptx-viewer/commit/fe9a4501be61de9078ff0b71724cc0c4ac923134))
- **core:** Honour a:noFill and stop painting hidden fills/lines (by @ChristopherVR) ([ae13541](https://github.com/ChristopherVR/pptx-viewer/commit/ae1354188b1c5d2bd5843dc36a7c438ba1d83c00))

## [2.2.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.2.1) - 2026-07-24

### Bug Fixes

- **core:** Preserve native bullets and boundary spaces ([#107](https://github.com/ChristopherVR/pptx-viewer/issues/107)) ([7ed0971](https://github.com/ChristopherVR/pptx-viewer/commit/7ed09718d2fc439b129ee5ed23c8f5c41fe399ba))

## [2.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.2.0) - 2026-07-24

### Features

- **shared:** Powerpoint-accurate slide-show keyboard map (by @ChristopherVR) ([fdf55d4](https://github.com/ChristopherVR/pptx-viewer/commit/fdf55d45779e090c36aa994cdc17fae8f01df79b))
- **angular:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([fc363a8](https://github.com/ChristopherVR/pptx-viewer/commit/fc363a8406fb749caa81a6e4b3e23609b83cdfbe))
- **vanilla:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([629903c](https://github.com/ChristopherVR/pptx-viewer/commit/629903c8c1ecab33e5dde40ffef42a88e8bde94e))
- **react:** Give the slide-show menu PowerPoint's full command set (by @ChristopherVR) ([33c826d](https://github.com/ChristopherVR/pptx-viewer/commit/33c826d887c69e5103b0f0148e9ee1b1c17b16b0))

## [2.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.1.1) - 2026-07-23

### Refactor

- **angular:** Split the collaboration service into focused modules (by @ChristopherVR) ([b8d06ec](https://github.com/ChristopherVR/pptx-viewer/commit/b8d06ec6d3ee793669c658e8278c1a8bfad26910))

## [2.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.1.0) - 2026-07-23

### Features

- **angular:** Widen the peer range to Angular 19-22 (by @ChristopherVR) ([825e5f1](https://github.com/ChristopherVR/pptx-viewer/commit/825e5f1a6df52c50a0dfaef2bb457b474f810bcf))

## [2.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.0.1) - 2026-07-23

### Bug Fixes

- **angular:** Reentrancy-safe collab connect, overlay mobile inspector, mobile share (by @ChristopherVR) ([cb26ab2](https://github.com/ChristopherVR/pptx-viewer/commit/cb26ab2b7630d7448587dfbd694c83181ebe3017))

## [2.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@2.0.0) - 2026-07-23

### Features

- **shared:** Ai config, loader and bridge contracts (by @ChristopherVR) ([1c40e28](https://github.com/ChristopherVR/pptx-viewer/commit/1c40e28b1661895e2993b01c11bea6262459cb88))
- **angular:** Move internal building blocks off the package root (by @ChristopherVR) ([fd64790](https://github.com/ChristopherVR/pptx-viewer/commit/fd64790ac37070e751e873b831c66e8de9bce90b))
- **angular:** Ai bridge and chat service (by @ChristopherVR) ([90bf211](https://github.com/ChristopherVR/pptx-viewer/commit/90bf2113493e4c31aee55acaf775c49cd29e7bdb))
- **shared:** Indexeddb-first ai chat history store (by @ChristopherVR) ([88920f2](https://github.com/ChristopherVR/pptx-viewer/commit/88920f20eb00e72b84efa9ef2cb500dfd6d20db4))
- **shared:** Rebuild AI assistant tools on pptx-viewer-mcp (by @ChristopherVR) ([da1c31e](https://github.com/ChristopherVR/pptx-viewer/commit/da1c31ee88c0b60a82628003c8a1b16245f028ed))
- **core:** Upgrade emf-converter to 2.0.0 (breaking) (by @ChristopherVR) ([effa4e5](https://github.com/ChristopherVR/pptx-viewer/commit/effa4e5338b2b01796a3671f505bcb4563de74cc))

### Documentation

- Friendly 2.0.0 changelog for root and packages (by @ChristopherVR) ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))

### Testing

- **shared:** Opt-in live gpt-4o-mini ai integration test (by @ChristopherVR) ([48622f1](https://github.com/ChristopherVR/pptx-viewer/commit/48622f135a5f2ee4c28d97d08478d3c203745f47))
- **angular:** Align AI tool fixtures with MCP-backed tool names (by @ChristopherVR) ([834e598](https://github.com/ChristopherVR/pptx-viewer/commit/834e598e54ae8ce0d54091ea2bfba7958c442d00))

### Build & CI

- Pin Vue/Angular/Svelte to exact TypeScript 6.0.3 (by @ChristopherVR) ([3d80082](https://github.com/ChristopherVR/pptx-viewer/commit/3d8008282231e1ee4bc11300757d1cc35e8dc174))

## [1.31.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.31.5) - 2026-07-19

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

## [1.31.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.31.4) - 2026-07-19

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

## [1.31.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.31.3) - 2026-07-19

### Bug Fixes

- **core:** Themed background text, colour and geometry fidelity (by @ChristopherVR) ([a8fc2be](https://github.com/ChristopherVR/pptx-viewer/commit/a8fc2bea2407f70bc3df4008be5c152d107cc3eb))
- **shared:** Render freeform fills via clip-path and correct flip/rotate order (by @ChristopherVR) ([7122f43](https://github.com/ChristopherVR/pptx-viewer/commit/7122f43c7ff9bae5bf0278d2753a6209bc1821af))

## [1.31.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.31.2) - 2026-07-19

### Bug Fixes

- **core:** Stop truncating interleaved custom-geometry paths ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([9bbac7d](https://github.com/ChristopherVR/pptx-viewer/commit/9bbac7d024fbad8ccd476f7e2a5d993ce1ad2b1b))

### Performance

- **core:** Cache layout/master XML during background resolution (by @ChristopherVR) ([9eea305](https://github.com/ChristopherVR/pptx-viewer/commit/9eea3057d62825f2c6355cf9891123a77df0c8fb))

## [1.31.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.31.1) - 2026-07-18

### Bug Fixes

- **core:** Load themed backgrounds and inherited placeholders ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([bed627b](https://github.com/ChristopherVR/pptx-viewer/commit/bed627bc4e2abb5c897e7e9b49fb27735f5e01a1))

## [1.31.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.31.0) - 2026-07-18

### Features

- **shared:** PowerPoint File > Options parity model (by @ChristopherVR) ([b1f041d](https://github.com/ChristopherVR/pptx-viewer/commit/b1f041d2396520e3d04c30172a4842f725c7c655))
- **angular:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([8635ad6](https://github.com/ChristopherVR/pptx-viewer/commit/8635ad677ac1c224850af65a0b5110cd7cd2fd7e))

## [1.30.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.30.1) - 2026-07-18

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.30.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.30.0) - 2026-07-18

### Features

- **angular:** Promote RibbonComponent for independent composition (by @ChristopherVR) ([00ab33e](https://github.com/ChristopherVR/pptx-viewer/commit/00ab33e515857cd60a5aef01537c1024297e08e5))

## [1.29.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.29.0) - 2026-07-18

### Dependencies

- **deps:** Update dependencies to latest and migrate core/shared/locales to TypeScript 7 (by @ChristopherVR) ([cc72948](https://github.com/ChristopherVR/pptx-viewer/commit/cc729482cc5ae4ae56e1219f290c2953ec83c12a))

## [1.28.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.28.1) - 2026-07-18

### Bug Fixes

- **angular:** Make Home-tab Drawing shape insert actually insert (by @ChristopherVR) ([2e51ec7](https://github.com/ChristopherVR/pptx-viewer/commit/2e51ec73dc27975a146f3d0885d05a5e5b47c7c0))
- **angular:** Persist Info-dialog document-property edits on save (by @ChristopherVR) ([8d9b3a7](https://github.com/ChristopherVR/pptx-viewer/commit/8d9b3a740a60bfe697b482f6bca2be91b14659b1))
- **angular:** Start the format pane closed on mobile (by @ChristopherVR) ([906bb98](https://github.com/ChristopherVR/pptx-viewer/commit/906bb982ad87e3b4e87737142debd45991a9402c))
- **angular:** Stop undo from wiping the history via the deck-seed effect (by @ChristopherVR) ([a3c2ec0](https://github.com/ChristopherVR/pptx-viewer/commit/a3c2ec05c431e0851513ecf8144dd64f8f1dbc64))

## [1.28.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.28.0) - 2026-07-18

### Features

- **angular:** Tabbed default inspector at React parity (by @ChristopherVR) ([a415ed6](https://github.com/ChristopherVR/pptx-viewer/commit/a415ed6f50ce4eff01cf04f121412852a4acf5b7))
- **angular:** Persistent inspector tabs, docProps save, Home Arrange group (by @ChristopherVR) ([40606e5](https://github.com/ChristopherVR/pptx-viewer/commit/40606e5ca8bc521a6fdd73c86c6a76a11f7b4b56))

### Bug Fixes

- **angular:** Restore horizontal ribbon layout and dedup Home font/paragraph groups (by @ChristopherVR) ([fd7e1d2](https://github.com/ChristopherVR/pptx-viewer/commit/fd7e1d20f7e93e56354e6b955714e3879fe3d4d4))
- **angular:** Stop the 24px tap-target floor from ballooning small controls (by @ChristopherVR) ([c6b2e7f](https://github.com/ChristopherVR/pptx-viewer/commit/c6b2e7fe277950ef6fe7022dd76c4f19d5eb8a24))

## [1.27.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.27.0) - 2026-07-17

### Features

- **angular:** Add theme/language switching and a real Account page (by @ChristopherVR) ([b33cdb9](https://github.com/ChristopherVR/pptx-viewer/commit/b33cdb92e44b149f73319945aa230068d35370cb))

### Other

- Integrate React theme/language switching and Account page (by @ChristopherVR) ([2fb0854](https://github.com/ChristopherVR/pptx-viewer/commit/2fb0854ed4f4505dbb22889aa6c4e5d3c2540094))
- Integrate Angular theme/language switching and Account page (by @ChristopherVR) ([2683183](https://github.com/ChristopherVR/pptx-viewer/commit/2683183be0508b4f5322e1909cfc762e6f7a82cc))

## [1.26.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.26.0) - 2026-07-17

### Features

- **angular:** Add hiddenActions input to hide individual toolbar/ribbon actions (by @ChristopherVR) ([61eb995](https://github.com/ChristopherVR/pptx-viewer/commit/61eb995be25b317f2172a5983b83575deaefc16c))

### Other

- Integrate release version bumps (by @ChristopherVR) ([4b3893f](https://github.com/ChristopherVR/pptx-viewer/commit/4b3893f4158803cc5533beb266ffdc8c776177cb))

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.25.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.25.0) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.24.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.24.0) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.23.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.23.0) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.22.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.22.0) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.21.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.21.0) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.20.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.20.0) - 2026-07-17

## [1.19.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.19.0) - 2026-07-17

### Features

- **angular:** Copy slides as images (by @ChristopherVR) ([579b699](https://github.com/ChristopherVR/pptx-viewer/commit/579b6998de9d3538f710b1da1da8e149e9e0f66e))
- **core:** Preserve DrawingML image color effects (by @ChristopherVR) ([5ed726d](https://github.com/ChristopherVR/pptx-viewer/commit/5ed726d401a5a4e399854b77af63032287204ad1))
- **core:** Model PresentationML view geometry (by @ChristopherVR) ([3b07978](https://github.com/ChristopherVR/pptx-viewer/commit/3b07978204770e51d0470e624dbb0073844587e7))
- **core:** Round-trip ChartML markers and data points (by @ChristopherVR) ([ae8edc5](https://github.com/ChristopherVR/pptx-viewer/commit/ae8edc5514fb6ce1974bd912aa6d59a2844c4f22))
- **angular:** Save slideshow formats (by @ChristopherVR) ([d2e03eb](https://github.com/ChristopherVR/pptx-viewer/commit/d2e03ebe50a7a798942911997b78b10418dbae85))
- **shared:** Build package sharing readmes (by @ChristopherVR) ([01a9bd6](https://github.com/ChristopherVR/pptx-viewer/commit/01a9bd67d7ad7dbf406011a98308368425ff901b))
- **angular:** Package presentations for sharing (by @ChristopherVR) ([ea72c80](https://github.com/ChristopherVR/pptx-viewer/commit/ea72c802202780549f7807c89754b792ac92d89a))
- **core:** Add DiagramML definition headers (by @ChristopherVR) ([314f9fa](https://github.com/ChristopherVR/pptx-viewer/commit/314f9fa1b1545ad423b1c5d40032b8b26e1fadc4))
- **core:** Complete DrawingML alpha effects (by @ChristopherVR) ([3a402f4](https://github.com/ChristopherVR/pptx-viewer/commit/3a402f479d0014610baa66d9c9c2d52426a383b7))
- **core:** Add ChartML print settings (by @ChristopherVR) ([f519b19](https://github.com/ChristopherVR/pptx-viewer/commit/f519b19cc75eeca4ec54384d8678918c9c764501))
- **shared:** Compute virtual thumbnail ranges (by @ChristopherVR) ([9edde91](https://github.com/ChristopherVR/pptx-viewer/commit/9edde91f8ad2e45f463cf9a8fcb3771b09c574d3))
- **core:** Edit DiagramML constraints and rules (by @ChristopherVR) ([01f1ed2](https://github.com/ChristopherVR/pptx-viewer/commit/01f1ed2be8ca9fea10520118f263776ac12351cf))
- **core:** Complete PresentationML print properties (by @ChristopherVR) ([671f348](https://github.com/ChristopherVR/pptx-viewer/commit/671f34888ae5b6e9af12f6ef5783f6754eaf7888))
- **core:** Add ChartML protection (by @ChristopherVR) ([e09b1a9](https://github.com/ChristopherVR/pptx-viewer/commit/e09b1a90edd579ec29edcc7a817fd962687e1b3e))
- **core:** Export print and protection types (by @ChristopherVR) ([ea228d6](https://github.com/ChristopherVR/pptx-viewer/commit/ea228d6e017bf941434e2a5b8fa0db439a938b76))
- **shared:** Group slides by section (by @ChristopherVR) ([b8eb51d](https://github.com/ChristopherVR/pptx-viewer/commit/b8eb51de19aebbf728df58c9fe5e3b82cad2416e))
- **core:** Edit DiagramML layout algorithms (by @ChristopherVR) ([42e7dd3](https://github.com/ChristopherVR/pptx-viewer/commit/42e7dd3df964fc9481821dc21b688cbe636243aa))
- **core:** Complete ChartML pivot sources (by @ChristopherVR) ([afb317a](https://github.com/ChristopherVR/pptx-viewer/commit/afb317a135ce52b599bfe6f3f1031fd6e9c1ab3c))
- **core:** Complete DrawingML audio metadata (by @ChristopherVR) ([226c917](https://github.com/ChristopherVR/pptx-viewer/commit/226c9177b416b27af6feae6b3ad5952fbd0d84f0))
- **core:** Complete PresentationML embedded fonts (by @ChristopherVR) ([5d54284](https://github.com/ChristopherVR/pptx-viewer/commit/5d542848608447e408f8024e2290ad80e1d9d649))
- **core:** Edit DiagramML layout control flow (by @ChristopherVR) ([74fb263](https://github.com/ChristopherVR/pptx-viewer/commit/74fb263fcb1059f570d1163b014d57d849c8415d))
- **core:** Complete PresentationML kinsoku (by @ChristopherVR) ([9cc5604](https://github.com/ChristopherVR/pptx-viewer/commit/9cc5604030c03544505077bf75adf7803f147d9f))
- **core:** Edit ChartML pivot formats (by @ChristopherVR) ([87a646a](https://github.com/ChristopherVR/pptx-viewer/commit/87a646a2551099bb8f71e9b2e474375438e6d37f))
- **angular:** Manage slide sections (by @ChristopherVR) ([3fc7b8c](https://github.com/ChristopherVR/pptx-viewer/commit/3fc7b8cd2e70adc3248ddf58aa595880a84be53f))
- **angular:** Move slides between sections (by @ChristopherVR) ([7e49822](https://github.com/ChristopherVR/pptx-viewer/commit/7e4982227961b191727fbd529dc9e37969d11088))
- **shared:** Compute live document statistics (by @ChristopherVR) ([13159a2](https://github.com/ChristopherVR/pptx-viewer/commit/13159a29a72bed8105dee689af07b41cd70d3e3c))
- **core:** Export rich elements as SVG (by @ChristopherVR) ([508fc6c](https://github.com/ChristopherVR/pptx-viewer/commit/508fc6cbd074dec5d7a0655b0c700ea6a95cd058))
- **core:** Persist chart palette and axis positions (by @ChristopherVR) ([69b05bd](https://github.com/ChristopherVR/pptx-viewer/commit/69b05bdc3cf86c883d16c4f1b9ddef1563ad99e7))
- **shared:** Resolve image source effects (by @ChristopherVR) ([7400764](https://github.com/ChristopherVR/pptx-viewer/commit/74007645ae432d7e2b3cd8394fd04f6dde9cce61))
- **angular:** Add vector SVG export and printing (by @ChristopherVR) ([5ca1670](https://github.com/ChristopherVR/pptx-viewer/commit/5ca1670cb35d1857e107ac874a61920662e4908c))
- **angular:** Add live viewer settings (by @ChristopherVR) ([f9078fb](https://github.com/ChristopherVR/pptx-viewer/commit/f9078fba9da07956f7bb902d4a1ef0ae13617fc1))
- **core:** Render funnel charts in SVG exports (by @ChristopherVR) ([efb6c36](https://github.com/ChristopherVR/pptx-viewer/commit/efb6c368fc6640a918cc6bbdc016b98c87e241ff))
- **core:** Author SDK funnel ChartEx parts (by @ChristopherVR) ([73265f4](https://github.com/ChristopherVR/pptx-viewer/commit/73265f4737f2f74705be380a2772586fd46557c0))
- **core:** Author SDK waterfall ChartEx parts (by @ChristopherVR) ([e5ff15b](https://github.com/ChristopherVR/pptx-viewer/commit/e5ff15b7aeab2c9b059963ae36aafd1b457ffe67))
- **shared:** Render chart axis tick formatting (by @ChristopherVR) ([5c22a9b](https://github.com/ChristopherVR/pptx-viewer/commit/5c22a9b4c96f3cb3d24c750dd4dab115ef42fb2b))
- **core:** Author SDK treemap ChartEx parts (by @ChristopherVR) ([9264fad](https://github.com/ChristopherVR/pptx-viewer/commit/9264fad20c51725136722369aef7393f334d1832))
- **core:** Round-trip sunburst hierarchy (by @ChristopherVR) ([3cc868e](https://github.com/ChristopherVR/pptx-viewer/commit/3cc868ea721d78f8ac48365e6a9cb4cb1abfe57c))
- **angular:** Add deep inspector authoring (by @ChristopherVR) ([f04baf3](https://github.com/ChristopherVR/pptx-viewer/commit/f04baf397b43936a9d39dc5761f637cf09e15f78))
- **bindings:** Wire deep inspector panels (by @ChristopherVR) ([1ce5e9b](https://github.com/ChristopherVR/pptx-viewer/commit/1ce5e9b5f6e58d437190609aed7775495d725c38))
- **core:** Round-trip PowerPoint slide Zoom (by @ChristopherVR) ([624c853](https://github.com/ChristopherVR/pptx-viewer/commit/624c853b6450f6c0f8b16d8789104ba6f2cc76e2))
- **core:** Author SDK box-whisker ChartEx parts (by @ChristopherVR) ([202496f](https://github.com/ChristopherVR/pptx-viewer/commit/202496f894d094535f8ca6fa9cad303c00f13a7c))
- **shared:** Render ChartEx sunburst hierarchy (by @ChristopherVR) ([0507e6f](https://github.com/ChristopherVR/pptx-viewer/commit/0507e6f98084ed566287fdc4e7e0ec5ded0629a6))
- **core:** Author histogram and Pareto ChartEx parts (by @ChristopherVR) ([b8d779c](https://github.com/ChristopherVR/pptx-viewer/commit/b8d779cd0923ceeeb39c0848cec25cd52223d5e3))
- **core:** Round-trip PowerPoint section Zoom (by @ChristopherVR) ([67a162f](https://github.com/ChristopherVR/pptx-viewer/commit/67a162f63f1b244a9fbf23621c9e7194b1538031))
- **shared:** Add media trim timeline helpers (by @ChristopherVR) ([c8cc257](https://github.com/ChristopherVR/pptx-viewer/commit/c8cc2570f2466e026221596e3e8f09126864d35a))
- **angular:** Complete media and header footer parity (by @ChristopherVR) ([7367237](https://github.com/ChristopherVR/pptx-viewer/commit/73672373472257fd1ff455b1dd36f543559b31d6))
- **shared:** Render ChartEx distribution options (by @ChristopherVR) ([f0d2c22](https://github.com/ChristopherVR/pptx-viewer/commit/f0d2c222cc3193ecdff51d934117ccb1be50bde4))
- **core:** Author SDK region-map ChartEx parts (by @ChristopherVR) ([9d0c676](https://github.com/ChristopherVR/pptx-viewer/commit/9d0c676231f91e967e89eb82fbae472b23172113))
- **angular:** Complete element inspector authoring (by @ChristopherVR) ([1a8ddea](https://github.com/ChristopherVR/pptx-viewer/commit/1a8ddea0dc9d8d6bd017a4139ebde17f721e35ed))
- **shared:** Render Summary Zoom section tiles (by @ChristopherVR) ([5266e10](https://github.com/ChristopherVR/pptx-viewer/commit/5266e10e28d611c99701c3e734ff9f22746aba42))
- **core:** Round-trip PowerPoint Summary Zoom (by @ChristopherVR) ([27c5671](https://github.com/ChristopherVR/pptx-viewer/commit/27c5671d6593d439f624cfbe2c9b37373fd6ec16))
- **angular:** Finish element inspector parity (by @ChristopherVR) ([b2cdece](https://github.com/ChristopherVR/pptx-viewer/commit/b2cdece85f9c827550d050ef00a5b4b7a807c47f))
- **shared:** Honor category axis ordering and ticks (by @ChristopherVR) ([45f7c1f](https://github.com/ChristopherVR/pptx-viewer/commit/45f7c1f13f2f92e07e3085fc060314b64060dd64))
- **core:** Author embedded 3D models (by @ChristopherVR) ([7189466](https://github.com/ChristopherVR/pptx-viewer/commit/7189466b8c86692c651a8eebc382d42ad8df56f1))
- **core:** Preserve ChartEx waterfall layout semantics (by @ChristopherVR) ([10feb1b](https://github.com/ChristopherVR/pptx-viewer/commit/10feb1bb15a5288d6607508a45ba030888d36adc))
- **core:** Author InkML content parts (by @ChristopherVR) ([b8df789](https://github.com/ChristopherVR/pptx-viewer/commit/b8df789682e6ca28e15e3a8732d550c016239b2a))
- **angular:** Complete animation timeline parity (by @ChristopherVR) ([a87590f](https://github.com/ChristopherVR/pptx-viewer/commit/a87590fdda0d3e92c4e930b25de4fef847eabb6d))
- **shared:** Render semantic Pareto charts (by @ChristopherVR) ([6fc6a5e](https://github.com/ChristopherVR/pptx-viewer/commit/6fc6a5e4b0b86601a198661e5e276573370d3414))
- **core:** Author user-defined tag parts (by @ChristopherVR) ([245dc7c](https://github.com/ChristopherVR/pptx-viewer/commit/245dc7cb9db4e69cb4b37c4d4e989ed6f0d8e2c8))
- **core:** Preserve classic date axis semantics (by @ChristopherVR) ([f9391cd](https://github.com/ChristopherVR/pptx-viewer/commit/f9391cde53a10058601d9a4a8205ea636f6a43c9))
- **core:** Author customer data parts (by @ChristopherVR) ([8d99be8](https://github.com/ChristopherVR/pptx-viewer/commit/8d99be831377d08cde510603ae8c9b00c0985169))
- **shared:** Render continuous date axes (by @ChristopherVR) ([d644399](https://github.com/ChristopherVR/pptx-viewer/commit/d6443991467a45ea92f1b3947a9a0253faa471c6))
- **shared:** Render slide background patterns (by @ChristopherVR) ([2794b71](https://github.com/ChristopherVR/pptx-viewer/commit/2794b71c0f90f38af6417790e57deaaf2d4fc010))
- **shared:** Resolve picture bullet markers (by @ChristopherVR) ([172a5c0](https://github.com/ChristopherVR/pptx-viewer/commit/172a5c0b25b33d99593fffd3ff4ef3c0dee3a371))
- **core:** Preserve chart axis crossing semantics (by @ChristopherVR) ([3fbcbc0](https://github.com/ChristopherVR/pptx-viewer/commit/3fbcbc01812272d2984f22986af81135d0d08fd6))
- **angular:** Add functional review and record commands (by @ChristopherVR) ([a923428](https://github.com/ChristopherVR/pptx-viewer/commit/a92342801bf3ed4106b5921623da0dadd83bcb2a))
- **angular:** Wire review and rehearsal controls (by @ChristopherVR) ([8c83d83](https://github.com/ChristopherVR/pptx-viewer/commit/8c83d83ca64e8ca564dae1a214271e8df979579b))
- **shared:** Render X-direction chart error bars (by @ChristopherVR) ([c3f825b](https://github.com/ChristopherVR/pptx-viewer/commit/c3f825bfb5e08b7ac81cd16d7e580312edfbc154))
- **angular:** Render picture bullet markers (by @ChristopherVR) ([bff084b](https://github.com/ChristopherVR/pptx-viewer/commit/bff084b3ca11c82ffaf4ee07728475a15042a6aa))
- **shared:** Render chart axis crossings (by @ChristopherVR) ([38a2591](https://github.com/ChristopherVR/pptx-viewer/commit/38a259176035e4a7b5de60980233798759e7f202))
- **core:** Preserve ChartEx hierarchy and geography (by @ChristopherVR) ([4b8e3ab](https://github.com/ChristopherVR/pptx-viewer/commit/4b8e3abde0f4747cdbd7347ff48cb2156b9a3110))
- **shared:** Render hierarchical ChartEx treemaps (by @ChristopherVR) ([999f8f9](https://github.com/ChristopherVR/pptx-viewer/commit/999f8f938125e99dab09a17b8c940a7c9cfe225b))
- **shared:** Render ChartEx geography options (by @ChristopherVR) ([c2edbd7](https://github.com/ChristopherVR/pptx-viewer/commit/c2edbd7ac5d843e5d8a5190284ce32e792d541dd))
- **shared:** Render multi-level chart axes (by @ChristopherVR) ([d5d7008](https://github.com/ChristopherVR/pptx-viewer/commit/d5d7008f64c555046030a556e4306e06673108d6))

### Bug Fixes

- **core:** Validate DiagramML iterator bounds (by @ChristopherVR) ([cb375ce](https://github.com/ChristopherVR/pptx-viewer/commit/cb375ce5ac221e854d3a6c203788a6795a5d1881))
- **core:** Correct DrawingML custom dash stops (by @ChristopherVR) ([9b7bd11](https://github.com/ChristopherVR/pptx-viewer/commit/9b7bd11da4438ce24c7e76fb421d07fb0b720d74))
- **shared:** Render complete image colour effects (by @ChristopherVR) ([2dc9969](https://github.com/ChristopherVR/pptx-viewer/commit/2dc9969660bb0c999f9d33bc09899f63105c1d24))
- **core:** Export complete image colour effects (by @ChristopherVR) ([e1468d3](https://github.com/ChristopherVR/pptx-viewer/commit/e1468d316711b56fc883efddb0c14a957b6630ae))
- **viewer:** Restore thumbnail colours and suppress bullets (by @ChristopherVR) ([4563d2d](https://github.com/ChristopherVR/pptx-viewer/commit/4563d2d0a60ec70febbb5b26b438b9f2de6782b8))
- **angular:** Render complete image effects (by @ChristopherVR) ([7c34864](https://github.com/ChristopherVR/pptx-viewer/commit/7c34864ef96614f501c4ccac657ffe0c187f5c02))
- **shared:** Preserve SVG roots in print documents (by @ChristopherVR) ([a7e4d97](https://github.com/ChristopherVR/pptx-viewer/commit/a7e4d9795325899a87eb22beb8b032ce2c7128e5))
- **shared:** Sync media reference content types (by @ChristopherVR) ([b0a6703](https://github.com/ChristopherVR/pptx-viewer/commit/b0a670356b40bc6a735d39c9873f65452cef8646))
- **core:** Parse all show property boolean forms (by @ChristopherVR) ([0dc7329](https://github.com/ChristopherVR/pptx-viewer/commit/0dc7329945b2690f2c504e8f31815220b8d8e896))
- **core:** Preserve structured custom geometry paths (by @ChristopherVR) ([423fb41](https://github.com/ChristopherVR/pptx-viewer/commit/423fb41b75393f65ba07e00f1f670e710348d7e5))
- **core:** Resolve theme effect placeholder colours (by @ChristopherVR) ([3e9e348](https://github.com/ChristopherVR/pptx-viewer/commit/3e9e3480d72612e270f8852fb5a870a60d10d6a3))
- **core:** Preserve combo secondary axis mapping (by @ChristopherVR) ([73085fd](https://github.com/ChristopherVR/pptx-viewer/commit/73085fd82fae6a73f23a205d85af368571276ad4))
- **core:** Resolve theme line placeholder colours (by @ChristopherVR) ([e5cdfce](https://github.com/ChristopherVR/pptx-viewer/commit/e5cdfce341633dec9992c1f102e3a383fab7b187))
- **core:** Normalize multi-path custom geometry (by @ChristopherVR) ([1cc46cd](https://github.com/ChristopherVR/pptx-viewer/commit/1cc46cdc7baa22c82e60cfd8809cb8321db8579c))
- **core:** Resolve theme fill placeholder colours (by @ChristopherVR) ([55fe588](https://github.com/ChristopherVR/pptx-viewer/commit/55fe5883f0544ac05b47b8c0e557a9ba1df06b07))
- **shared:** Honor combo secondary axis constraints (by @ChristopherVR) ([c324247](https://github.com/ChristopherVR/pptx-viewer/commit/c324247e6adf003f8943cf0df45ed88f947c4cde))
- **shared:** Honor disabled slideshow animations (by @ChristopherVR) ([970693c](https://github.com/ChristopherVR/pptx-viewer/commit/970693c3fdc40206a45bc6d01a6c359d9091d897))
- **shared:** Retain boundary log axis ticks (by @ChristopherVR) ([5cd7cdc](https://github.com/ChristopherVR/pptx-viewer/commit/5cd7cdcc56912c8b522d0dbf642926ed414f3362))
- **core:** Preserve SmartArt rich text ordering (by @ChristopherVR) ([ab56204](https://github.com/ChristopherVR/pptx-viewer/commit/ab5620452121f323d924b7d31f97882cce86b8ad))
- **core:** Persist authored OLE payloads (by @ChristopherVR) ([0c24f45](https://github.com/ChristopherVR/pptx-viewer/commit/0c24f45ae2b6bd17b03142f03fea3d1254c1c812))
- **core:** Resolve ChartEx data references (by @ChristopherVR) ([6faab07](https://github.com/ChristopherVR/pptx-viewer/commit/6faab073b149a42b01ae9485d7911b83b9c76213))
- **core:** Persist chart axis direction (by @ChristopherVR) ([47f70c1](https://github.com/ChristopherVR/pptx-viewer/commit/47f70c14a6dfedc7f185a494c313ec268a6618a0))
- **core:** Retain SmartArt cached shape skew (by @ChristopherVR) ([d219b0e](https://github.com/ChristopherVR/pptx-viewer/commit/d219b0edaff00a965d51389e228983b4d9df6d47))
- **core:** Author editable OpenXML ink (by @ChristopherVR) ([0e81e91](https://github.com/ChristopherVR/pptx-viewer/commit/0e81e9143a2c64dd30f81f49a9434c787ff2f823))
- **shared:** Honor chart axis tick direction (by @ChristopherVR) ([ca45bef](https://github.com/ChristopherVR/pptx-viewer/commit/ca45bef1c407a653ee4375d13f8ecf3842a55667))
- **core:** Preserve SmartArt custom geometry (by @ChristopherVR) ([782a2aa](https://github.com/ChristopherVR/pptx-viewer/commit/782a2aa24421515a7d7f55f3b3643924fdf6fdcf))
- **core:** Persist notes on new slides (by @ChristopherVR) ([330d54e](https://github.com/ChristopherVR/pptx-viewer/commit/330d54e3fc3aae9a4567f05f90c6b2d63efbea0f))
- **core:** Author handout master package parts (by @ChristopherVR) ([0427da1](https://github.com/ChristopherVR/pptx-viewer/commit/0427da156c7911a6e342e2c3325eeade1404a3bc))
- **core:** Preserve custom geometry command order (by @ChristopherVR) ([695a2fe](https://github.com/ChristopherVR/pptx-viewer/commit/695a2fea59ffa3219c24fbb434c4d1ba92cbfef5))
- **core:** Allocate string Zoom fallback IDs (by @ChristopherVR) ([2fbb6e8](https://github.com/ChristopherVR/pptx-viewer/commit/2fbb6e8147e808e7c30019c3b157b129e3267861))
- **core:** Preserve SmartArt text paragraphs (by @ChristopherVR) ([78a51bd](https://github.com/ChristopherVR/pptx-viewer/commit/78a51bdd9ebb67185815c0b765fb5c113f7e434e))
- **core:** Retain SmartArt extension order (by @ChristopherVR) ([4475ba2](https://github.com/ChristopherVR/pptx-viewer/commit/4475ba2e2fae90d9d279de3a249bbdd602af6528))
- **core:** Load embedded 3D model payloads (by @ChristopherVR) ([f052f8c](https://github.com/ChristopherVR/pptx-viewer/commit/f052f8c27330b6d206202003752a4c6c1def48f1))
- **shared:** Hydrate 3D model assets on load (by @ChristopherVR) ([e64f3a8](https://github.com/ChristopherVR/pptx-viewer/commit/e64f3a8b6e7b15afc8b73d8bcb3e79f3723f957a))
- **core:** Reconcile SmartArt legacy text edits (by @ChristopherVR) ([13253b5](https://github.com/ChristopherVR/pptx-viewer/commit/13253b5a5b2f46c105d72f8952355195bd12c07a))
- **core:** Project SmartArt rich text to shapes (by @ChristopherVR) ([5b106a6](https://github.com/ChristopherVR/pptx-viewer/commit/5b106a671c42ed3ae1f4b1068b571d9e95110b3c))
- **shared:** Keep chart helpers target portable (by @ChristopherVR) ([db9d675](https://github.com/ChristopherVR/pptx-viewer/commit/db9d67551dcdf7105658048f812ec11668429221))
- **core:** Resolve SmartArt run text styles (by @ChristopherVR) ([6737afd](https://github.com/ChristopherVR/pptx-viewer/commit/6737afd47a0e3e7a9800da422b0730f4273271d7))
- **core:** Evaluate SmartArt layout rules (by @ChristopherVR) ([4a918fd](https://github.com/ChristopherVR/pptx-viewer/commit/4a918fd1664143d4def19211b5b8df10a5f68470))
- **core:** Guard SmartArt text order annotation (by @ChristopherVR) ([44d7013](https://github.com/ChristopherVR/pptx-viewer/commit/44d70131f2ed1f2fb9d4d62217a483ce2059021b))
- **core:** Preserve chart series option shape (by @ChristopherVR) ([87c0df4](https://github.com/ChristopherVR/pptx-viewer/commit/87c0df4ad34efae05e7479f1a2ace834d355481c))
- **shared:** Sync InkML collaboration fields (by @ChristopherVR) ([f2929cb](https://github.com/ChristopherVR/pptx-viewer/commit/f2929cbf44f53fc60fff32b1d958a2346bcee6f2))
- **angular:** Keep parity bindings inside ribbon hosts (by @ChristopherVR) ([1a753ce](https://github.com/ChristopherVR/pptx-viewer/commit/1a753ce0d94651992a028efbf9c71b1c0f17d53e))
- **angular:** Finalize ribbon command placement (by @ChristopherVR) ([f54a7f5](https://github.com/ChristopherVR/pptx-viewer/commit/f54a7f54ff2ac59ea1c4ea63e90c63802d9e857e))

### Performance

- **angular:** Virtualize large slide decks (by @ChristopherVR) ([603974e](https://github.com/ChristopherVR/pptx-viewer/commit/603974ec880d21e3b3dc7652f848218bbcdf8b2f))

### Refactor

- **core:** Name OpenXML coverage by capability (by @ChristopherVR) ([1e25a7f](https://github.com/ChristopherVR/pptx-viewer/commit/1e25a7fbb929092af4ce080a4ed19eab28e87472))
- **core:** Keep chart protection codec internal (by @ChristopherVR) ([da3fcc1](https://github.com/ChristopherVR/pptx-viewer/commit/da3fcc1d82c0a0b0f36e9d4d581aea0509915be2))
- **shared:** Generalize section grouping (by @ChristopherVR) ([ffc7fec](https://github.com/ChristopherVR/pptx-viewer/commit/ffc7fecb7c2c9fdee6f571abc41d9660abda1353))
- **shared:** Collect used presentation fonts (by @ChristopherVR) ([3d92599](https://github.com/ChristopherVR/pptx-viewer/commit/3d92599c04bb186d0dbba83cdc11d4401540c2f9))
- **shared:** Scan browser font availability (by @ChristopherVR) ([cde4ef8](https://github.com/ChristopherVR/pptx-viewer/commit/cde4ef8c659a1ffca1e45023623a86ca7968acf9))
- **shared:** Validate protection passwords (by @ChristopherVR) ([85690c9](https://github.com/ChristopherVR/pptx-viewer/commit/85690c900659491f7722372bba55d42cda9ea793))
- **shared:** Centralize viewer setup metadata (by @ChristopherVR) ([da95839](https://github.com/ChristopherVR/pptx-viewer/commit/da95839795cf6829682115fe4d90545059ee3cdf))
- **shared:** Centralize subtitle recognition helpers (by @ChristopherVR) ([ac211d7](https://github.com/ChristopherVR/pptx-viewer/commit/ac211d746ba957dfb0dab0a599dc56d96b2805f9))

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

## [1.18.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.18.0) - 2026-07-16

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

## [1.17.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.17.1) - 2026-07-15

### Testing

- **viewer:** Enforce framework-neutral e2e parity (by @ChristopherVR) ([7389c7e](https://github.com/ChristopherVR/pptx-viewer/commit/7389c7e7586e7ce926400a096945b7e51448f709))

## [1.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.17.0) - 2026-07-13

### Bug Fixes

- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Dependencies

- **deps:** Update html2canvas-pro to 2.2.3 (by @dependabot[bot]) ([0fe015b](https://github.com/ChristopherVR/pptx-viewer/commit/0fe015b83722534f14864b2054ce6561b09386ca))
- **deps:** Update angular compiler to 22.0.6 (by @dependabot[bot]) ([3990f82](https://github.com/ChristopherVR/pptx-viewer/commit/3990f821128012438f9e72337b293fce7110d0fc))
- **deps:** Update fast-xml-parser to 5.10.0 (by @dependabot[bot]) ([6080273](https://github.com/ChristopherVR/pptx-viewer/commit/6080273f6a6f603d10d69a71d54faad1e6d9bf05))
- **deps:** Update angular vite plugin to 2.6.3 (by @dependabot[bot]) ([f3c664e](https://github.com/ChristopherVR/pptx-viewer/commit/f3c664e28425ff0059073b3119f215e981f56d00))
- **deps:** Update dompurify to 3.4.12 (by @dependabot[bot]) ([00a6ca4](https://github.com/ChristopherVR/pptx-viewer/commit/00a6ca49609d5a0e922a9e20447460b11ec690ba))
- **deps:** Update minor and patch dependencies (by @dependabot[bot]) ([5cd81fb](https://github.com/ChristopherVR/pptx-viewer/commit/5cd81fb0c8708e53990ac4858660d0b6a4b17a7a))
- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## [1.16.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.16.1) - 2026-07-13

### Bug Fixes

- **core:** Open Office-encrypted pptx files (by @ChristopherVR) ([51aa670](https://github.com/ChristopherVR/pptx-viewer/commit/51aa670e8ca78d78323f55766b1a4c0e8b366c00))

## [1.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.16.0) - 2026-07-11

### Features

- **core:** Add canonical collaboration field-schema (by @ChristopherVR) ([cc78c1e](https://github.com/ChristopherVR/pptx-viewer/commit/cc78c1ed352fac3f69180ec2846d1df3e1dbd377))
- **shared:** Add the office colour swatch catalogue (by @ChristopherVR) ([41135a0](https://github.com/ChristopherVR/pptx-viewer/commit/41135a0f8687550cb17ded1451fa8f361fc975b1))

### Bug Fixes

- **shared:** Close CRDT allowlist data-loss gaps, add binary asset map (by @ChristopherVR) ([60ad222](https://github.com/ChristopherVR/pptx-viewer/commit/60ad2226bc4f3450c2992362e9fcceaac77f2ccf))
- **angular:** Fix dev-mode collaboration import failure, re-arm gate (by @ChristopherVR) ([6ede10f](https://github.com/ChristopherVR/pptx-viewer/commit/6ede10f936ed97f9bbe123ce45de15a9793bab32))

## [1.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.15.0) - 2026-07-11

### Features

- **shared:** Add text wrap/autofit, image adjustments, and table inspector helpers (by @ChristopherVR) ([54b2eda](https://github.com/ChristopherVR/pptx-viewer/commit/54b2eda35254bc75257932568442396a5f343708))

### Documentation

- **shared:** Add i18n keys for the vanilla Design tab theme gallery (by @ChristopherVR) ([593ea23](https://github.com/ChristopherVR/pptx-viewer/commit/593ea230e61f606056ffc013e2fdb82bea70738b))

## [1.14.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.14.1) - 2026-07-11

### Bug Fixes

- **shared,react,vue,angular:** Make the Aa Change Case dropdown actually rewrite text (by @ChristopherVR) ([d84fd78](https://github.com/ChristopherVR/pptx-viewer/commit/d84fd788097253cf8b9281eca35af35caad20dce))
- **react,vue,angular:** Drop stray space when splitting a wrapped line (by @ChristopherVR) ([1a43c81](https://github.com/ChristopherVR/pptx-viewer/commit/1a43c810fd43cf57d3691c124568e73f31fd7b0a))
- **angular:** Resolve change-case helpers via the vendored shared source (by @ChristopherVR) ([6cfe41e](https://github.com/ChristopherVR/pptx-viewer/commit/6cfe41e0d348e3e9dff3a1ecc7bbb57902547683))

### Refactor

- **shared:** Extract clipboard, shape-preset, and text-format catalogs from react (by @ChristopherVR) ([b9d7cc9](https://github.com/ChristopherVR/pptx-viewer/commit/b9d7cc9b061b8c9dcaad91038136349c9360080d))
- **shared:** Dedupe change-case logic against text-case-transform (by @ChristopherVR) ([d007c07](https://github.com/ChristopherVR/pptx-viewer/commit/d007c070fb5bf8573bd8ac6dbeae160b46fc2dde))

## [1.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.14.0) - 2026-07-11

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([0ecd3d9](https://github.com/ChristopherVR/pptx-viewer/commit/0ecd3d935f97c78e8b0a62bebc8bf610c42414ab))

## [1.13.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.13.2) - 2026-07-10

### Bug Fixes

- **shared:** Sanitize print-document/SVG assembly with DOMPurify (by @ChristopherVR) ([84527b6](https://github.com/ChristopherVR/pptx-viewer/commit/84527b63350643d0a78b37d7ea55238fe4a8fa72))

## [1.13.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.13.1) - 2026-07-09

### Bug Fixes

- **core:** Close residual ReDoS/path-traversal gaps from the last CodeQL pass (by @ChristopherVR) ([9b17db9](https://github.com/ChristopherVR/pptx-viewer/commit/9b17db9067fac5f1b230d6fcc50fa9f8936d96ae))
- **shared:** Harden print-document HTML assembly against injection (by @ChristopherVR) ([e6add81](https://github.com/ChristopherVR/pptx-viewer/commit/e6add81b93dd71d42c2ef54e459fcc0629a17fa8))

## [1.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.13.0) - 2026-07-09

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([ef5fc85](https://github.com/ChristopherVR/pptx-viewer/commit/ef5fc85dca2e20ff3e105d622594e0f65d010fb0))
- Reconcile with origin/main before push (by @ChristopherVR) ([030b28b](https://github.com/ChristopherVR/pptx-viewer/commit/030b28bb21697ed681e4e59aa40db29f4b4a18d0))

## [1.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.12.0) - 2026-07-09

### Features

- **shared:** Add vermilion light/dark theme presets to all bindings (by @ChristopherVR) ([1b6e816](https://github.com/ChristopherVR/pptx-viewer/commit/1b6e8161679a3f984cbfedb09ece0c8c01570c0a))

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([10acef8](https://github.com/ChristopherVR/pptx-viewer/commit/10acef81a7f5d79e778e4e4464d956cc84682f7c))

## [1.11.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.11.1) - 2026-07-09

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([b8c46bc](https://github.com/ChristopherVR/pptx-viewer/commit/b8c46bc3622e301d3365f5c489144e5aa5401782))

## [1.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.11.0) - 2026-07-09

### Features

- **angular:** Use lucide SVG icons and scrollable ribbon tabs (by @ChristopherVR) ([5a2e9aa](https://github.com/ChristopherVR/pptx-viewer/commit/5a2e9aaf07550f7dd1a6528dd3ce2bf8e5487da8))

## [1.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.10.0) - 2026-07-08

### Features

- **shared:** Add smartart preset data builder (by @ChristopherVR) ([872b0ff](https://github.com/ChristopherVR/pptx-viewer/commit/872b0ff274950ab50193456e4398b9ef2f112fdd))

### Bug Fixes

- **angular:** Always show the speaker-notes footer strip (by @ChristopherVR) ([43274fa](https://github.com/ChristopherVR/pptx-viewer/commit/43274fa97649335bcca4775c1bf44d34fffa0df7))
- **angular:** Live smartart gallery previews via the real renderer (by @ChristopherVR) ([147c788](https://github.com/ChristopherVR/pptx-viewer/commit/147c788df835336c316ac0efde82cb84b4dd7315))

## [1.9.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.9.1) - 2026-07-08

### Documentation

- **core:** Remove explicit jszip/fast-xml-parser mention from install section (by @ChristopherVR) ([6b72906](https://github.com/ChristopherVR/pptx-viewer/commit/6b72906c08447ba38a704ff4572c89d7cad7e60c))

## [1.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.9.0) - 2026-07-07

### Features

- **shared:** Ribbon parity with PowerPoint - localize all tabs, add command search, advance slide controls (by @ChristopherVR) ([6bd1e5a](https://github.com/ChristopherVR/pptx-viewer/commit/6bd1e5ad16c079fd994080888119fe2e027c9a5c))
- **shared:** Add Review tab Language and Accessibility buttons across all frameworks (by @ChristopherVR) ([2dfd7bf](https://github.com/ChristopherVR/pptx-viewer/commit/2dfd7bf17d4583fa591246b77e178951b795aa32))

## [1.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.8.0) - 2026-07-07

### Features

- **shared:** Autosave disabled status with reason, recovery helpers (by @ChristopherVR) ([8ccc7eb](https://github.com/ChristopherVR/pptx-viewer/commit/8ccc7ebd451a8101c6e045708ee7c3a1cb006e1d))

## [1.7.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.7.2) - 2026-07-07

### Bug Fixes

- **angular:** Stop text boxes clipping their own glyphs ([67df04b](https://github.com/ChristopherVR/pptx-viewer/commit/67df04b4494289dfaa72f80ae32b025a928cb1b9))
- **core:** Handle absolute relationship target paths in layout/master resolution (by @ChristopherVR) ([5ea40c2](https://github.com/ChristopherVR/pptx-viewer/commit/5ea40c22eca8420aa872b0ea923770085df72a0e))

## [1.7.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.7.1) - 2026-07-06

### Dependencies

- **deps:** Update tailwindcss to ^4.3.2 and @angular/common to ^22.0.5 (by @ChristopherVR) ([ae1b615](https://github.com/ChristopherVR/pptx-viewer/commit/ae1b615b3632a8dc3bcd9a201fbab583648da97c))

## [1.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.7.0) - 2026-07-05

### Features

- **vue,angular:** Add line spacing, text direction, columns, and editing controls (by @ChristopherVR) ([71e1c69](https://github.com/ChristopherVR/pptx-viewer/commit/71e1c69c4e3dca22329fb4125da67373e0851efe))
- **react,vue,angular:** Remove Text and Arrange tabs, merge into Home (by @ChristopherVR) ([6183ff3](https://github.com/ChristopherVR/pptx-viewer/commit/6183ff3a4c50e31b5d267eb31de8aab9da068aff))
- **react,vue,angular:** Add Drawing group, Slides controls, and Record tab (by @ChristopherVR) ([8b68ba7](https://github.com/ChristopherVR/pptx-viewer/commit/8b68ba78599c3c3ded50ab99ab2bbcf38991caf2))

## [1.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.6.0) - 2026-07-05

### Features

- **core,cli:** Add react, angular, vue to npm keywords (by @ChristopherVR) ([528ec61](https://github.com/ChristopherVR/pptx-viewer/commit/528ec6182bb77c07444dd0e93560b65e604b9524))
- **shared:** Progressive imperative API for all viewer bindings (by @ChristopherVR) ([877339d](https://github.com/ChristopherVR/pptx-viewer/commit/877339d05b486d697f2d04d01b3fd954e3c54746))

## [1.5.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.5.3) - 2026-07-04

## [1.5.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.5.2) - 2026-07-04

## [1.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.5.1) - 2026-07-04

## [1.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.5.0) - 2026-07-04

## [1.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.4.0) - 2026-07-04

### Features

- Reworking the UI to align more on MS powerpoint UI (by @ChristopherVR) ([39386c0](https://github.com/ChristopherVR/pptx-viewer/commit/39386c0c8ff93b185352d8e5b9f17ec6b8cd7d45))

## [1.3.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.3.1) - 2026-07-04

### Bug Fixes

- **core:** Fabricate diagram parts so inserted SmartArt survives save (by @ChristopherVR) ([0d1341f](https://github.com/ChristopherVR/pptx-viewer/commit/0d1341fd4402518c51b3ed1e301aa4115a9af3b4))
- **shared:** Preserve equation and field metadata in remapTextToSegments (by @ChristopherVR) ([9675d18](https://github.com/ChristopherVR/pptx-viewer/commit/9675d18a652f1c87cc65b40bf7150251fc945587))

## [1.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.3.0) - 2026-07-04

## [1.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.2.0) - 2026-07-04

### Features

- **shared:** Add i18n keys for ribbon, shortcuts panel, and text formatting (by @ChristopherVR) ([6e97c3b](https://github.com/ChristopherVR/pptx-viewer/commit/6e97c3bc158e43fda5faba9bc9a9d661d0a71994))

### Refactor

- **angular:** Route shortcut labels through i18n (by @ChristopherVR) ([c39ea0e](https://github.com/ChristopherVR/pptx-viewer/commit/c39ea0eaa2c86fc5d34df1e52a4c91d2e3d5e07f))

## [1.1.66](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.66) - 2026-07-04

### Bug Fixes

- **angular:** Load @angular/compiler in vitest so component-file imports don't crash (by @ChristopherVR) ([8c48b93](https://github.com/ChristopherVR/pptx-viewer/commit/8c48b9322fa684aad4963f43efa528c51e4f2a00))

## [1.1.63](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.63) - 2026-07-03

### Documentation

- Remove completed ROADMAP and PORTING trackers, scrub stale references (by @ChristopherVR) ([8a745a1](https://github.com/ChristopherVR/pptx-viewer/commit/8a745a1d2a1ee3932503d37dd022494ab9cfcc4b))

## [1.1.59](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.59) - 2026-07-03

### Dependencies

- **deps:** Declare yjs, y-websocket, and y-webrtc across bindings (by @ChristopherVR) ([27a2849](https://github.com/ChristopherVR/pptx-viewer/commit/27a2849da755a0902296dcd59557c1329a1cbadf))

## [1.1.57](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.57) - 2026-07-03

### Features

- Document localization and add demo language pickers (by @ChristopherVR) ([a07ad82](https://github.com/ChristopherVR/pptx-viewer/commit/a07ad8279e906590e0392d19cd1637855012a80e))

## [1.1.56](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.56) - 2026-07-02

### Features

- **shared:** Add canonical i18n translation dictionary (by @ChristopherVR) ([429e386](https://github.com/ChristopherVR/pptx-viewer/commit/429e386c7245fc5cf526ac72481fd5ab23b3e09d))
- **angular:** Wire ngx-translate, convert hardcoded UI strings to translation keys (by @ChristopherVR) ([33bc42e](https://github.com/ChristopherVR/pptx-viewer/commit/33bc42e0f221a8c8644f1cc80cc314971abc9791))

## [1.1.52](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.52) - 2026-07-02

### Bug Fixes

- Format issues (by @ChristopherVR) ([bbf874d](https://github.com/ChristopherVR/pptx-viewer/commit/bbf874dda638932d6a435b28238cd822176d1cd6))
- **core:** Correct install docs and drop the retired @christophervr/pptx-viewer alias (by @ChristopherVR) ([6544b4e](https://github.com/ChristopherVR/pptx-viewer/commit/6544b4eaf086945ecd8a18b877de5a483032aa14))
- **core,angular:** Revert xmldom to 0.8.x and fix shared import specifiers (by @ChristopherVR) ([29eda31](https://github.com/ChristopherVR/pptx-viewer/commit/29eda3119836559b63bc08733dd9dd6398a69c8d))

## [1.1.51](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.51) - 2026-06-27

### Bug Fixes

- Missing document links (by @ChristopherVR) ([f52bd6f](https://github.com/ChristopherVR/pptx-viewer/commit/f52bd6fd2fc4f564f018ecf5e84e64d24c8fd240))

## [1.1.45](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.45) - 2026-06-25

### Other

- **smartart:** Snapshot in-progress SmartArt session work (by @ChristopherVR) ([0cac22f](https://github.com/ChristopherVR/pptx-viewer/commit/0cac22f5b1a0ecc33960f4712ff2ef691beb3f65))

### Refactor

- **shared:** Extract text-rendering pure logic (line-height, warp, effects) (by @ChristopherVR) ([11c8d22](https://github.com/ChristopherVR/pptx-viewer/commit/11c8d22e9910dda9c8dfa18e0f6d7683577c7b9f))

## [1.1.32](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.32) - 2026-06-21

### Dependencies

- **deps:** Update dependencies within semver ranges (by @ChristopherVR) ([d472b58](https://github.com/ChristopherVR/pptx-viewer/commit/d472b58dfd47628b5c682bd5f4dc2014ec29b421))

## [1.1.31](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.31) - 2026-06-21

### Bug Fixes

- **angular:** Replace bare file input with styled dropzone in demo (by @ChristopherVR) ([d47a4a5](https://github.com/ChristopherVR/pptx-viewer/commit/d47a4a538c8e7f7cd057ac652b2dbede527d92e3))

## [1.1.30](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.30) - 2026-06-21

### Bug Fixes

- **angular:** Bundle pptx-viewer-core and fix demo JIT + Vue demo alias (by @ChristopherVR) ([78838ec](https://github.com/ChristopherVR/pptx-viewer/commit/78838ec900fe2d8c90bc39333636d788c52c3161))

## [1.1.29](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.29) - 2026-06-21

### Features

- **shared:** Add Three.js SmartArt 3D model + scene runtime (by @ChristopherVR) ([f949213](https://github.com/ChristopherVR/pptx-viewer/commit/f949213b33ed0dca4c52d5d1ab414c3dba67efe7))
- **angular:** Opt-in Three.js SmartArt renderer (by @ChristopherVR) ([be6d858](https://github.com/ChristopherVR/pptx-viewer/commit/be6d85818b4a2f70cf644ee91467fd44dc4506de))

### Documentation

- Sharpen npm descriptions and keywords for discoverability (by @ChristopherVR) ([8fea56d](https://github.com/ChristopherVR/pptx-viewer/commit/8fea56d7650f7dc2f3167dea97b94b612a03a4e7))
- **core:** Reword README in plain language (by @ChristopherVR) ([793c26e](https://github.com/ChristopherVR/pptx-viewer/commit/793c26ec7e2415c66f34c637cb541483bf395a11))
- **angular:** Reword README in plain language (by @ChristopherVR) ([ba72266](https://github.com/ChristopherVR/pptx-viewer/commit/ba722668b0c4846e86837b2cf255198231ab2631))

## [1.1.24](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-angular-viewer@1.1.24) - 2026-06-20

### Features

- **core:** Add signature-node module and shared signature utilities (by @ChristopherVR) ([e7cb263](https://github.com/ChristopherVR/pptx-viewer/commit/e7cb26335f15e633cfc37371f16a6ad210be5e11))
- **vue:** Add pptx-vue-viewer package + bundled pptx-viewer-shared (by @ChristopherVR) ([1b7a958](https://github.com/ChristopherVR/pptx-viewer/commit/1b7a958ce91792a6d174f174932800bc8ff40ef9))
- **angular:** Add pptx-angular-viewer package + demo (by @ChristopherVR) ([81255a9](https://github.com/ChristopherVR/pptx-viewer/commit/81255a9251e855bc51b97c8dc68b55e71e206882))
- **angular:** PNG + PDF export (html2canvas-pro + jspdf) (by @ChristopherVR) ([e5aec3d](https://github.com/ChristopherVR/pptx-viewer/commit/e5aec3d58b84407629ca84292fe7c3407bd9d87e))
- **angular:** Wire signatures panel (parts-reading) into the viewer (by @ChristopherVR) ([d11afb9](https://github.com/ChristopherVR/pptx-viewer/commit/d11afb96195c998f9a56a218fa641b8adbf62fb6))

### Bug Fixes

- Enable vitest globals in all packages to fix expectTypeOf errors (by @ChristopherVR) ([6d90d72](https://github.com/ChristopherVR/pptx-viewer/commit/6d90d72ff0107ad0194f9c73ceeb3df244f4cfc6))
- **test:** Add i18n mocks to react tests and bump versions to 1.2.0 (by @ChristopherVR) ([2c1c962](https://github.com/ChristopherVR/pptx-viewer/commit/2c1c9628714b905b28592493abf02fb270107b65))
- **build:** Make all packages build + publish cleanly; align Vue README (by @ChristopherVR) ([7db5de6](https://github.com/ChristopherVR/pptx-viewer/commit/7db5de6a343887fc1a32dd526ae1ab68e1e3e6e0))
- **deps:** Pin @xmldom/xmldom to 0.8.x in core to fix build (by @ChristopherVR) ([2ed7b2e](https://github.com/ChristopherVR/pptx-viewer/commit/2ed7b2e777d4e740a3e4c9ca7e2b3d6fc2bbd21f))
- **core:** Declare jszip and fast-xml-parser as runtime dependencies (by @ChristopherVR) ([b6636be](https://github.com/ChristopherVR/pptx-viewer/commit/b6636be972206bb2c6acee0fed05c45b4759fbdc))

### Other

- **angular:** Tailwind 4 Office ribbon + pt→px font fix (by @ChristopherVR) ([ad5da60](https://github.com/ChristopherVR/pptx-viewer/commit/ad5da60e73c4a6ea780cda94773b4a74dcea9786))

### Refactor

- **react:** Consume theme + loader from pptx-viewer-shared (by @ChristopherVR) ([1b93d1f](https://github.com/ChristopherVR/pptx-viewer/commit/1b93d1fccff378b0ac402810a0cbddea46add29c))
- **angular:** Keep core peer as workspace:\*, resolve at build time (by @ChristopherVR) ([b123ac9](https://github.com/ChristopherVR/pptx-viewer/commit/b123ac99e9611b7f585197d827ba2ac35217997e))
- **core:** Consume emf-converter and mtx-decompressor from npm (by @ChristopherVR) ([2f6013d](https://github.com/ChristopherVR/pptx-viewer/commit/2f6013d5b8fab0aef5b32901841d94c0fa886f24))
- **angular:** Remove em-dashes from code comments and prose (by @ChristopherVR) ([0166321](https://github.com/ChristopherVR/pptx-viewer/commit/01663210fd84f60b29c7c6176def02951e3903f3))

### Documentation

- Restructure root README, elevate limitations, fix outdated claims (by @ChristopherVR) ([86dcda9](https://github.com/ChristopherVR/pptx-viewer/commit/86dcda9b5e3129f2223341337055778db574e985))
- Rewrite limitations with technical explanations and remove inaccurate claims (by @ChristopherVR) ([ac4bc84](https://github.com/ChristopherVR/pptx-viewer/commit/ac4bc84ed9bd03f62e3ae29c35baf3f444a3c0bf))
- **readme:** Npm-friendly READMEs — hero image, capabilities & install first (by @ChristopherVR) ([c843d19](https://github.com/ChristopherVR/pptx-viewer/commit/c843d1934b846f901bba92e63d2b01f9479594d0))
- Streamline npm READMEs and add badges, screenshots, demo links (by @ChristopherVR) ([92e980d](https://github.com/ChristopherVR/pptx-viewer/commit/92e980d434900abd223c4d70c6cae19a623f9ca8))
- **vue,angular:** Point Try-demo links at per-framework demos (by @ChristopherVR) ([b5e6915](https://github.com/ChristopherVR/pptx-viewer/commit/b5e6915c416075f4f50630d76dfedbc324cde03e))
- Remove em-dashes and clarify demo link in viewer packages (by @ChristopherVR) ([f52afff](https://github.com/ChristopherVR/pptx-viewer/commit/f52afffd935016b747116a9909c523021b492225))

### Build & CI

- **angular:** Adopt Tailwind 4 pipeline for ribbon chrome parity (by @ChristopherVR) ([65cf58f](https://github.com/ChristopherVR/pptx-viewer/commit/65cf58fbcce1fbf3ac0c3ce0f3b49b3c9604d1b1))
- Independent per-package versioning, tags, and changelogs (by @ChristopherVR) ([79595d9](https://github.com/ChristopherVR/pptx-viewer/commit/79595d972d7c4102e8b1e1e3926f439486f76ba1))

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
