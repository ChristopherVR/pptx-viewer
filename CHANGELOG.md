# Changelog

All notable changes to this project are documented here.

The `2.0.0` section below is hand-authored to showcase the V2 release; the
dated sections beneath it are generated from
[Conventional Commits](https://www.conventionalcommits.org) by
[git-cliff](https://git-cliff.org). The exact version number and date for
`2.0.0` are finalized when the release is tagged.

## 2026-08-19

_Releases: pptx-viewer-core@2.3.10, pptx-react-viewer@2.19.7, pptx-vue-viewer@2.20.7, pptx-angular-viewer@2.18.7, pptx-vanilla-viewer@1.21.7, pptx-svelte-viewer@2.20.7, @christophervr/pptx-viewer@1.7.0_

### Features

- **cli:** Make @christophervr/pptx-viewer a drop-in for pptx-react-viewer (by @ChristopherVR) ([2c13717](https://github.com/ChristopherVR/pptx-viewer/commit/2c13717c4f16cb73882bf887087af75986ebd264))

### Bug Fixes

- **core:** Correct OOXML a:tint colour math (ECMA-376 20.1.2.3.32) (by @ChristopherVR) ([7cf29f3](https://github.com/ChristopherVR/pptx-viewer/commit/7cf29f321994b7e9df8fe11d821a2c2fe686e1cd))
- **shared:** Stretch uncropped pictures to fill their frame (by @ChristopherVR) ([ff2fee3](https://github.com/ChristopherVR/pptx-viewer/commit/ff2fee3b3bba88e9a4d50a0735e9558c65e8041e))
- **core:** Don't clone an arbitrary slide onto a new blank slide (by @ChristopherVR) ([1bd1bd6](https://github.com/ChristopherVR/pptx-viewer/commit/1bd1bd6be1aa657b89ef5782e5d3c466686102c4))
- **core:** Don't bind special placeholders to untyped ones by idx alone (by @ChristopherVR) ([d92eb11](https://github.com/ChristopherVR/pptx-viewer/commit/d92eb11095ee390a596126acc59c8dd9cc18f8a8))
- **core:** Resolve layout-switch geometry from the master when omitted (by @ChristopherVR) ([a09aa5a](https://github.com/ChristopherVR/pptx-viewer/commit/a09aa5a306e160954bbc09052444ad22ab4385a1))
- **core:** Reverse the GUID-derived XOR key for font de/obfuscation (by @ChristopherVR) ([7733edf](https://github.com/ChristopherVR/pptx-viewer/commit/7733edf62f9f9a307c470dd93cfba36c8dbb9339))
- **core:** Drop untouched placeholder prompts on repeated layout switch (by @ChristopherVR) ([8842223](https://github.com/ChristopherVR/pptx-viewer/commit/884222317ad7da002e28e6272257bb4563b89fb2))
- **security:** Resolve code-scanning ReDoS and comment-sanitization alerts (by @ChristopherVR) ([e58e3f5](https://github.com/ChristopherVR/pptx-viewer/commit/e58e3f540e4e34c3617d32efdeea4ace6899e2bf))

## 2026-08-19

_Releases: pptx-react-viewer@2.19.6, pptx-vue-viewer@2.20.6, pptx-angular-viewer@2.18.6, pptx-vanilla-viewer@1.21.6, pptx-svelte-viewer@2.20.6_

### Bug Fixes

- **shared:** Add collaboration-active-session connected-users view-model (by @ChristopherVR) ([7add165](https://github.com/ChristopherVR/pptx-viewer/commit/7add165d14ae855889bd9aedac13e859b86d2274))
- **vue:** Mobile Comments/Notes double header, Share dialog user list (by @ChristopherVR) ([9091398](https://github.com/ChristopherVR/pptx-viewer/commit/90913981aab89a608b38416ec4e22a5d429990c4))
- **angular:** Show connected users in the active Share dialog (by @ChristopherVR) ([b5630ba](https://github.com/ChristopherVR/pptx-viewer/commit/b5630bad9fa7ef16c5b9c8707b96b9cb42e2bb76))
- **svelte:** Mobile Comments double header, Share dialog user list (by @ChristopherVR) ([e97fdd6](https://github.com/ChristopherVR/pptx-viewer/commit/e97fdd671491fabf5b7d338d1b2471c7c49d125c))
- **vanilla:** Show connected users in the active Share dialog (by @ChristopherVR) ([8b73321](https://github.com/ChristopherVR/pptx-viewer/commit/8b7332123321040a3cd93f999f84c3d23ef5eec3))

### Refactor

- **react:** Source the Share dialog user list from shared (by @ChristopherVR) ([bd41a14](https://github.com/ChristopherVR/pptx-viewer/commit/bd41a1440b4f33b0d68616ae141e4c89bd5a4f50))

### Dependencies

- **deps:** Update all outdated dependencies (by @ChristopherVR) ([4bba8db](https://github.com/ChristopherVR/pptx-viewer/commit/4bba8dbdf8b49a3aa8b404fd79eb3c9e5997f591))
- **deps:** Update oxfmt to 0.64.0 (by @ChristopherVR) ([8957155](https://github.com/ChristopherVR/pptx-viewer/commit/89571554737abc415f0ef274a95b4fbb6da2bae8))

## 2026-08-19

_Releases: pptx-viewer-core@2.3.9, pptx-react-viewer@2.19.5, pptx-vue-viewer@2.20.5, pptx-angular-viewer@2.18.5, pptx-vanilla-viewer@1.21.5, pptx-svelte-viewer@2.20.5_

### Dependencies

- **deps:** Update @angular/core requirement from ^22.1.0 to ^22.1.2 ([#170](https://github.com/ChristopherVR/pptx-viewer/issues/170)) (by @dependabot[bot]) ([ee56a6f](https://github.com/ChristopherVR/pptx-viewer/commit/ee56a6f91c74e6bb72aad8b51394b6218c8680b0))
- **deps:** Update y-websocket requirement from ^3.0.0 to ^3.1.0 ([#169](https://github.com/ChristopherVR/pptx-viewer/issues/169)) (by @dependabot[bot]) ([7e9c5a5](https://github.com/ChristopherVR/pptx-viewer/commit/7e9c5a51a7cb46df36223df4f91f192200562871))
- **deps:** Update @lucide/svelte requirement from ^1.28.0 to ^1.31.0 ([#166](https://github.com/ChristopherVR/pptx-viewer/issues/166)) (by @dependabot[bot]) ([3e1a554](https://github.com/ChristopherVR/pptx-viewer/commit/3e1a55404483f8010455169781dcd39a3721ef8d))
- **deps:** Bump @ai-sdk/vue from 4.0.66 to 4.0.65 ([#163](https://github.com/ChristopherVR/pptx-viewer/issues/163)) (by @dependabot[bot]) ([996f840](https://github.com/ChristopherVR/pptx-viewer/commit/996f84080e06cace9c945c27d293e8305a60999d))

### Chores

- **deps-dev:** Bump jsdom from 29.1.1 to 30.0.1 ([#171](https://github.com/ChristopherVR/pptx-viewer/issues/171)) (by @dependabot[bot]) ([cfe38c9](https://github.com/ChristopherVR/pptx-viewer/commit/cfe38c9e848bd509e59dfbbb6898aac13ce69b7e))
- **deps-dev:** Update rollup-plugin-dts requirement ([#167](https://github.com/ChristopherVR/pptx-viewer/issues/167)) (by @dependabot[bot]) ([d6ecdf5](https://github.com/ChristopherVR/pptx-viewer/commit/d6ecdf53132ca750f9fc5e8b2bb45b4560f9e340))
- **deps-dev:** Update vite requirement from ^8.2.0 to ^8.2.1 ([#165](https://github.com/ChristopherVR/pptx-viewer/issues/165)) (by @dependabot[bot]) ([a059a9e](https://github.com/ChristopherVR/pptx-viewer/commit/a059a9ecbd374279864c42d45c249bcb5c0ecc6b))
- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#162](https://github.com/ChristopherVR/pptx-viewer/issues/162)) (by @dependabot[bot]) ([2645f25](https://github.com/ChristopherVR/pptx-viewer/commit/2645f258a35282b61960c30649f216e583879f12))

## 2026-08-14

_Releases: pptx-viewer-core@2.3.8, pptx-react-viewer@2.19.4, pptx-vue-viewer@2.20.4, pptx-angular-viewer@2.18.4, pptx-vanilla-viewer@1.21.4, pptx-svelte-viewer@2.20.4_

### Bug Fixes

- **vanilla:** Repair the properties panel, inline editor, mobile chrome and show performance (by @ChristopherVR) ([47265ef](https://github.com/ChristopherVR/pptx-viewer/commit/47265efba9459359695bdcd74038b8b6d0787d0f))

## 2026-08-14

_Releases: pptx-react-viewer@2.19.3, pptx-vue-viewer@2.20.3, pptx-angular-viewer@2.18.3, pptx-vanilla-viewer@1.21.3, pptx-svelte-viewer@2.20.3_

### Bug Fixes

- **shared:** Run an in-place morph dissolve on the wrapper, not the element (by @ChristopherVR) ([d46d2ee](https://github.com/ChristopherVR/pptx-viewer/commit/d46d2eea5aeced925f1b51b4be2758f2b634ea3e))

## 2026-08-14

_Releases: pptx-react-viewer@2.19.2, pptx-vue-viewer@2.20.2, pptx-angular-viewer@2.18.2, pptx-vanilla-viewer@1.21.2, pptx-svelte-viewer@2.20.2_

### Bug Fixes

- **shared:** Sum a morph cross-dissolve instead of stacking two fades (by @ChristopherVR) ([86a9e7a](https://github.com/ChristopherVR/pptx-viewer/commit/86a9e7a2ab851d7b0005ab2d1c2267f668b308a8))

### Testing

- Mask the fields that legitimately move, and size two waits for CI (by @ChristopherVR) ([68bae19](https://github.com/ChristopherVR/pptx-viewer/commit/68bae19fe8cb3e283e2c87a90d31946c48be5e3a))

## 2026-08-14

_Releases: pptx-react-viewer@2.19.1, pptx-vue-viewer@2.20.1, pptx-angular-viewer@2.18.1, pptx-vanilla-viewer@1.21.1, pptx-svelte-viewer@2.20.1_

### Bug Fixes

- Repair five regressions this review introduced (by @ChristopherVR) ([952063b](https://github.com/ChristopherVR/pptx-viewer/commit/952063b7c1a198aed9acc0696b2b326deba35e95))

## 2026-08-13

_Releases: pptx-viewer-core@2.3.7, pptx-react-viewer@2.19.0, pptx-vue-viewer@2.20.0, pptx-angular-viewer@2.18.0, pptx-vanilla-viewer@1.21.0, pptx-svelte-viewer@2.20.0_

### Features

- **shared:** Take the last six chart kinds and the autosave policy (by @ChristopherVR) ([efe8438](https://github.com/ChristopherVR/pptx-viewer/commit/efe84381688dfb5f2a44a2990e76aa09b65e5fba))

### Bug Fixes

- **core:** Repair the XML plumbing four separate defects were hiding behind (by @ChristopherVR) ([8beb664](https://github.com/ChristopherVR/pptx-viewer/commit/8beb66410975d492118120515bbae6cd070ef792))
- **bindings:** Stop read-only surfaces clobbering live state (by @ChristopherVR) ([e820984](https://github.com/ChristopherVR/pptx-viewer/commit/e8209842fad62819df1530944124f0bfc33e32ec))
- **ci:** Stop the hourly release writing an empty changelog section (by @ChristopherVR) ([d53c0fe](https://github.com/ChristopherVR/pptx-viewer/commit/d53c0feffa2c2d9c67dfc495cb8dbefdf23638ae))

### Testing

- **e2e:** Assert the behaviours wave 5 could not previously see (by @ChristopherVR) ([77672da](https://github.com/ChristopherVR/pptx-viewer/commit/77672da34c893aefdd4e0a858352d077861a8e92))

### Chores

- Make four source files searchable again (by @ChristopherVR) ([9f01520](https://github.com/ChristopherVR/pptx-viewer/commit/9f0152030fce9ded95c5e422833d6aa6d31b345e))

## 2026-08-13

_Releases: pptx-viewer-core@2.3.6, pptx-react-viewer@2.18.0, pptx-vue-viewer@2.19.0, pptx-vanilla-viewer@1.20.0, pptx-svelte-viewer@2.19.0_

### Features

- **shared:** Own the decisions the bindings were still making apart (by @ChristopherVR) ([2bee9c5](https://github.com/ChristopherVR/pptx-viewer/commit/2bee9c5c1ec731d3f7097983a0c9c739ce95f5a4))

### Bug Fixes

- **core:** Stop save rewriting what the author never wrote (by @ChristopherVR) ([6fb2767](https://github.com/ChristopherVR/pptx-viewer/commit/6fb2767583de0e82747c3700e3311869dd693a1d))
- **react,vue:** Wire the surfaces that rendered without acting (by @ChristopherVR) ([9eed8a3](https://github.com/ChristopherVR/pptx-viewer/commit/9eed8a37aa42d7e20cee627a6a5a20a0c601b532))
- **angular,svelte,vanilla:** Close the remaining binding gaps (by @ChristopherVR) ([a7c377c](https://github.com/ChristopherVR/pptx-viewer/commit/a7c377c9d40e174434e6d7801cfc72d0e871a37f))
- **demos:** Accept every file kind the loader does (by @ChristopherVR) ([b530f6d](https://github.com/ChristopherVR/pptx-viewer/commit/b530f6de906ca59ff764209ddf8bacf20866a374))

### Documentation

- Make the capability claims true in both directions (by @ChristopherVR) ([c469d9f](https://github.com/ChristopherVR/pptx-viewer/commit/c469d9fe50aa7ac9c260ffdc13699385434a3dbd))

### Testing

- **e2e:** Cover the wave-4 surfaces, and the fixtures to prove them (by @ChristopherVR) ([686809b](https://github.com/ChristopherVR/pptx-viewer/commit/686809b727fa3fefab08a5392979dc032c16c8f5))

## 2026-08-13

_Releases: pptx-viewer-core@2.3.5, pptx-react-viewer@2.17.0, pptx-vue-viewer@2.18.0, pptx-vanilla-viewer@1.19.0, pptx-svelte-viewer@2.18.0, pptx-viewer-mcp@2.1.2_

### Features

- **shared:** Own the decisions the bindings were each making themselves (by @ChristopherVR) ([5421272](https://github.com/ChristopherVR/pptx-viewer/commit/5421272a531536ab3b494e5df91068c98326e6ed))
- **locales:** Add de/es/fr entries for the new options and master strings (by @ChristopherVR) ([63d0f2f](https://github.com/ChristopherVR/pptx-viewer/commit/63d0f2fdf0c3eb04a033535fc7710daa6e15daf9))
- **shared:** Model hyperlinks and equations, and own the group rules (by @ChristopherVR) ([a6bf4c1](https://github.com/ChristopherVR/pptx-viewer/commit/a6bf4c15ab3b49a44a2d24e2122ddbe3cdd3b8ed))

### Bug Fixes

- **core:** Repair save-pipeline corruption found by the OpenXML parity audit (by @ChristopherVR) ([554006e](https://github.com/ChristopherVR/pptx-viewer/commit/554006e004b6212f5561eb19954bbcff17bbdf7f))
- **vue:** Make the controls that render actually do something (by @ChristopherVR) ([11686f0](https://github.com/ChristopherVR/pptx-viewer/commit/11686f0d9bfbc1af4f0a0e82ab941ae89bd5ff7f))
- **svelte:** Stop shadowing shared table ops and wire the missing gestures (by @ChristopherVR) ([c90fb3f](https://github.com/ChristopherVR/pptx-viewer/commit/c90fb3f1d468a3a89b5e76703167857d313f6474))
- **vanilla:** Wire the save path, canvas gestures and image controls (by @ChristopherVR) ([2fde373](https://github.com/ChristopherVR/pptx-viewer/commit/2fde37322b34753c096d623b9ac8c029a7562a67))
- **vue:** Thread the ribbon props the toolbar sections require (by @ChristopherVR) ([c86209e](https://github.com/ChristopherVR/pptx-viewer/commit/c86209ebc260db27d3448e3028734dea27dac8ff))
- **vue:** Complete the custom-fonts wiring through the settings dialog (by @ChristopherVR) ([5e6d71a](https://github.com/ChristopherVR/pptx-viewer/commit/5e6d71a59eaa0305fbc797d5cb09b67620ecaa05))
- **vue:** Drop a duplicated SettingsCustomFontsSection import (by @ChristopherVR) ([e136ad0](https://github.com/ChristopherVR/pptx-viewer/commit/e136ad078b9fbac487a8c8c0e43053c048c3f299))
- **core:** Close the round-trip defects the corpus harness exposed (by @ChristopherVR) ([2011c66](https://github.com/ChristopherVR/pptx-viewer/commit/2011c664049bfd580801529c3337ba65bd8d3f13))
- **angular:** Bind the SmartArt descriptors and route master edits (by @ChristopherVR) ([3ccdef6](https://github.com/ChristopherVR/pptx-viewer/commit/3ccdef643aa73ec6619d258a0a31564540043bb0))
- **vue:** Autosave template edits and render SmartArt labels (by @ChristopherVR) ([1e45359](https://github.com/ChristopherVR/pptx-viewer/commit/1e453591b171c6e165b13502f7cf6325cb4e9d5e))
- **svelte,vanilla:** Wire SmartArt reflow and the shared run rendering (by @ChristopherVR) ([37b7e45](https://github.com/ChristopherVR/pptx-viewer/commit/37b7e45ce926c7949099f919715595db7c779405))

### Refactor

- **react:** Consume shared rendering instead of private copies (by @ChristopherVR) ([1836ffc](https://github.com/ChristopherVR/pptx-viewer/commit/1836ffc5ce76f86cf19673e49ce8315dc0e01d94))
- **angular:** Retire hand-ported logic and wire the missing renderers (by @ChristopherVR) ([d9e629e](https://github.com/ChristopherVR/pptx-viewer/commit/d9e629e283a5e8843139c88afb60b90523628f15))
- **react:** Retire the last private render pipeline (by @ChristopherVR) ([0d2f368](https://github.com/ChristopherVR/pptx-viewer/commit/0d2f368258d55416dc7fa11a8c3ec6d2aebcc8ba))

### Documentation

- Correct the round-trip claims that were not true (by @ChristopherVR) ([ccfb60c](https://github.com/ChristopherVR/pptx-viewer/commit/ccfb60c33a76eceb99989b4c689b35e5ec7390b5))

### Testing

- **e2e:** Assert effect rather than presence across all five bindings (by @ChristopherVR) ([4f62676](https://github.com/ChristopherVR/pptx-viewer/commit/4f62676a57aaed7b62f8c936619c71cee7eb5828))
- **e2e:** Add the corpus round-trip harness and a COM acceptance gate (by @ChristopherVR) ([edf6dd5](https://github.com/ChristopherVR/pptx-viewer/commit/edf6dd5f23d2644bae5ad290c9f755055537ae51))

### Chores

- Ignore per-package test-results and add the shape-3d fixture generator (by @ChristopherVR) ([ba98a81](https://github.com/ChristopherVR/pptx-viewer/commit/ba98a8152dab147fcf5d79ba35e94ec3387ac0cf))

## 2026-08-12

_Releases: pptx-react-viewer@2.16.10_

### Bug Fixes

- **react:** Stop the transition overlay shrinking away from the live slide (by @ChristopherVR) ([ec58f39](https://github.com/ChristopherVR/pptx-viewer/commit/ec58f39cc7c7407ee2d7af641287145f5950bf10))

## 2026-08-11

_Releases: pptx-react-viewer@2.16.9, pptx-vue-viewer@2.17.9, pptx-angular-viewer@2.17.9, pptx-vanilla-viewer@1.18.9, pptx-svelte-viewer@2.17.9_

### Bug Fixes

- **shared:** Keep a morph pair travelling when its outline is tweened too (by @ChristopherVR) ([0316cf7](https://github.com/ChristopherVR/pptx-viewer/commit/0316cf7b058bc49b247250d9e188822fdd4ef11f))
- **shared:** Dissolve a re-fitted morph paragraph in place instead of stretching it (by @ChristopherVR) ([975c6f6](https://github.com/ChristopherVR/pptx-viewer/commit/975c6f600a836081ec0f30c99fffb9aabbaaa598))

### Testing

- **e2e:** Stop reloading the video deck on every media-transition sample (by @ChristopherVR) ([0ac3a80](https://github.com/ChristopherVR/pptx-viewer/commit/0ac3a80f0d23400ebd6631e9adc3c5154a914143))

## 2026-08-11

_Releases: pptx-react-viewer@2.16.8, pptx-vue-viewer@2.17.8, pptx-angular-viewer@2.17.8, pptx-vanilla-viewer@1.18.8, pptx-svelte-viewer@2.17.8_

### Bug Fixes

- **shared:** Stop Vue and Angular writing an inline pointer-events lock during a show (by @ChristopherVR) ([4cb649a](https://github.com/ChristopherVR/pptx-viewer/commit/4cb649a53f5903557ef2f93c190fe6ddd538599e))
- **svelte:** Stop the show stage writing an inline pointer-events unlock (by @ChristopherVR) ([6f0a9f4](https://github.com/ChristopherVR/pptx-viewer/commit/6f0a9f4c33879543311e783f51d5fb595e5a150d))

## 2026-08-11

_Releases: pptx-react-viewer@2.16.7, pptx-vue-viewer@2.17.7, pptx-angular-viewer@2.17.7, pptx-vanilla-viewer@1.18.7, pptx-svelte-viewer@2.17.7_

### Bug Fixes

- **vue:** Swap inherited layout artwork when a slide's layout changes (by @ChristopherVR) ([1e927ce](https://github.com/ChristopherVR/pptx-viewer/commit/1e927ce2f079c1e84659791fa62f47b9e2e0ad45))

### Refactor

- **shared:** One paragraph-spacing resolver, and delete four more binding copies (by @ChristopherVR) ([65f8268](https://github.com/ChristopherVR/pptx-viewer/commit/65f8268df08021c1985dc86d93d3338c96b792c8))
- **shared:** Give the cached-SmartArt projection the whole decision, and React's table styling too (by @ChristopherVR) ([411148f](https://github.com/ChristopherVR/pptx-viewer/commit/411148f44630a65b1cd6e90a2954a53a24f110a5))
- **react:** Re-export the SmartArt and template helpers instead of copying them (by @ChristopherVR) ([32d91bc](https://github.com/ChristopherVR/pptx-viewer/commit/32d91bcf0aa7ef78db9f181677f6f295d383766d))
- **react:** Delete the unreachable SmartArt renderer tree and shim seven more copies (by @ChristopherVR) ([02dddb6](https://github.com/ChristopherVR/pptx-viewer/commit/02dddb65543c7db4bde1a08d30d3d64fffa87440))
- **shared:** Move find/replace and per-cell table CSS off their React copies (by @ChristopherVR) ([5b81728](https://github.com/ChristopherVR/pptx-viewer/commit/5b81728891f3e8cea1c2def2aed2d8b23e338081))
- **vue:** Take the comment id from shared (by @ChristopherVR) ([b8d2950](https://github.com/ChristopherVR/pptx-viewer/commit/b8d2950edc73e5ac6691a0164825d9f2ff58ac39))

## 2026-08-10

_Releases: pptx-react-viewer@2.16.6, pptx-vue-viewer@2.17.6, pptx-angular-viewer@2.17.6, pptx-vanilla-viewer@1.18.6, pptx-svelte-viewer@2.17.6_

### Bug Fixes

- **shared:** Render cached SmartArt shapes and transparent table headers as authored (by @ChristopherVR) ([24ec6b4](https://github.com/ChristopherVR/pptx-viewer/commit/24ec6b4f2079b55f02aa5559bfa3c3f1eae67652))
- **react:** Connect the Home tab's Layout control to the slide it acts on (by @ChristopherVR) ([6cb76bb](https://github.com/ChristopherVR/pptx-viewer/commit/6cb76bb27caaf486c280f432f9476f2365eb46ca))

### Chores

- Updated CLAUDE guidelines (by @ChristopherVR) ([b8dea58](https://github.com/ChristopherVR/pptx-viewer/commit/b8dea5811d2940369f60f6786081f86ae3035bc7))

## 2026-08-10

_Releases: pptx-viewer-core@2.3.4, pptx-react-viewer@2.16.5, pptx-vue-viewer@2.17.5, pptx-angular-viewer@2.17.5, pptx-vanilla-viewer@1.18.5, pptx-svelte-viewer@2.17.5_

### Bug Fixes

- **core:** Read placeholder, list and percentage values as authored (by @ChristopherVR) ([dc2d679](https://github.com/ChristopherVR/pptx-viewer/commit/dc2d679d48d3be854743d3a09bd2e20c5dc5331f))
- **shared:** Paint an inert morph ghost statically so it stops jittering (by @ChristopherVR) ([ce3be84](https://github.com/ChristopherVR/pptx-viewer/commit/ce3be8487d3530425afb3b455e1671b6c54ae61c))

## 2026-08-10

_Releases: pptx-react-viewer@2.16.4, pptx-vue-viewer@2.17.4, pptx-angular-viewer@2.17.4, pptx-vanilla-viewer@1.18.4, pptx-svelte-viewer@2.17.4_

### Bug Fixes

- **shared:** Crossfade morph wording instead of fading it out then in (by @ChristopherVR) ([50984f1](https://github.com/ChristopherVR/pptx-viewer/commit/50984f141acc601d35aad19883b6fb1f8e0b79c2))

## 2026-08-10

_Releases: pptx-viewer-core@2.3.3, pptx-react-viewer@2.16.3, pptx-vue-viewer@2.17.3, pptx-angular-viewer@2.17.3, pptx-vanilla-viewer@1.18.3, pptx-svelte-viewer@2.17.3, pptx-viewer-mcp@2.1.1_

### Bug Fixes

- **vanilla:** Give the master background swatch its real accessible name (by @ChristopherVR) ([6b5a988](https://github.com/ChristopherVR/pptx-viewer/commit/6b5a9888e0b2b9ead8904564aac74b863ccb9c00))
- **i18n:** Translate the master background swatch's accessible name (by @ChristopherVR) ([1fb6c2e](https://github.com/ChristopherVR/pptx-viewer/commit/1fb6c2e37ef1317fe6404b9cca03b62909853215))
- **angular:** Gate template element pointer-events on editTemplateMode (by @ChristopherVR) ([6ff0deb](https://github.com/ChristopherVR/pptx-viewer/commit/6ff0deb707bc90415eefc49a76f04e44dd49f147))
- **angular:** Clip the show overlay so the phone toolbar can be reached (by @ChristopherVR) ([7d4d743](https://github.com/ChristopherVR/pptx-viewer/commit/7d4d743aecb8e9a4376e59e54523159406b5a499))
- **svelte:** Pre-bundle the AI panel's lazy deps so the toggle click isn't lost (by @ChristopherVR) ([4a50700](https://github.com/ChristopherVR/pptx-viewer/commit/4a507002a0b86dc34305351bb354917b62ec62dc))
- **vue:** Gate template element pointer-events on editTemplateMode (by @ChristopherVR) ([a3b4928](https://github.com/ChristopherVR/pptx-viewer/commit/a3b492823470c22f2499ccd204e4a7031a88d91e))
- **react:** Don't let a resize/drag's trailing click open the text editor (by @ChristopherVR) ([1c61788](https://github.com/ChristopherVR/pptx-viewer/commit/1c61788385b2ffeb0d71cd3c2c1c54e053fbde79))

### Testing

- **e2e:** Widen the cross-binding deck-load timeout under concurrency (by @ChristopherVR) ([c9ee690](https://github.com/ChristopherVR/pptx-viewer/commit/c9ee690ee97158ee23180c13ee147e0e00a9baa4))

### Dependencies

- **deps:** Update dompurify requirement from ^3.4.12 to ^3.4.13 ([#151](https://github.com/ChristopherVR/pptx-viewer/issues/151)) (by @dependabot[bot]) ([7b975ff](https://github.com/ChristopherVR/pptx-viewer/commit/7b975ff73403916341fd8a6192fb6fd6c88fdc17))
- **deps:** Update yjs requirement from ^13.6.31 to ^13.6.32 ([#152](https://github.com/ChristopherVR/pptx-viewer/issues/152)) (by @dependabot[bot]) ([456fdb8](https://github.com/ChristopherVR/pptx-viewer/commit/456fdb8493487ab3e346714755239a90698f6b4d))
- **deps:** Update @modelcontextprotocol/sdk requirement ([#153](https://github.com/ChristopherVR/pptx-viewer/issues/153)) (by @dependabot[bot]) ([974413f](https://github.com/ChristopherVR/pptx-viewer/commit/974413f162851d16dc1816ce6d94d3d80a5ff817))
- **deps:** Bump @ai-sdk/vue from 4.0.58 to 4.0.56 ([#154](https://github.com/ChristopherVR/pptx-viewer/issues/154)) (by @dependabot[bot]) ([684248e](https://github.com/ChristopherVR/pptx-viewer/commit/684248efdd237f2236da6e8bb6cc1b5531992d47))
- **deps:** Bump @ai-sdk/react from 4.0.61 to 4.0.59 ([#155](https://github.com/ChristopherVR/pptx-viewer/issues/155)) (by @dependabot[bot]) ([e1d0140](https://github.com/ChristopherVR/pptx-viewer/commit/e1d0140efc316b4266032eb5687714d6af4900c2))
- **deps:** Update @react-three/drei requirement ([#156](https://github.com/ChristopherVR/pptx-viewer/issues/156)) (by @dependabot[bot]) ([3cf2e16](https://github.com/ChristopherVR/pptx-viewer/commit/3cf2e16d38faf9a7f6445bd8215771dfef4e1515))
- **deps:** Bump lucide-react from 1.31.0 to 1.29.0 ([#158](https://github.com/ChristopherVR/pptx-viewer/issues/158)) (by @dependabot[bot]) ([e1556e1](https://github.com/ChristopherVR/pptx-viewer/commit/e1556e18c009bebaec0b21d0b22904e99b891c67))
- **deps:** Update vue-tsc requirement from ^3.3.8 to ^3.3.9 ([#159](https://github.com/ChristopherVR/pptx-viewer/issues/159)) (by @dependabot[bot]) ([665ef13](https://github.com/ChristopherVR/pptx-viewer/commit/665ef139ab96a1c84815343c84bb53912b1b21d2))

### Chores

- **deps-dev:** Update @playwright/test requirement ([#157](https://github.com/ChristopherVR/pptx-viewer/issues/157)) (by @dependabot[bot]) ([d8be437](https://github.com/ChristopherVR/pptx-viewer/commit/d8be437d559f8c5eab427f02645c6b2dfcb60cb6))
- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#150](https://github.com/ChristopherVR/pptx-viewer/issues/150)) (by @dependabot[bot]) ([ab75bf1](https://github.com/ChristopherVR/pptx-viewer/commit/ab75bf10a96bb2a0da6e963a5b6b8634e4f73d5b))

## 2026-08-08

_Releases: pptx-react-viewer@2.16.2, pptx-vue-viewer@2.17.2, pptx-angular-viewer@2.17.2, pptx-vanilla-viewer@1.18.2, pptx-svelte-viewer@2.17.2_

### Bug Fixes

- Dissolve a morph's arriving shapes over the ghost that hid them (by @ChristopherVR) ([89536a3](https://github.com/ChristopherVR/pptx-viewer/commit/89536a36c3e38c3bc8b1219f702dee39e1526fcb))
- Dissolve a morph's centre panel the way PowerPoint measurably does (by @ChristopherVR) ([8c03a9a](https://github.com/ChristopherVR/pptx-viewer/commit/8c03a9a4db720dc4c6883ecd5778749e9148f3af))
- **shared:** Measure per word, and never measure a glyph in isolation (by @ChristopherVR) ([a92004b](https://github.com/ChristopherVR/pptx-viewer/commit/a92004bd554a66e5a0812d5bd20b3df1fff94379))

## 2026-08-07

_Releases: pptx-react-viewer@2.16.1, pptx-vue-viewer@2.17.1, pptx-angular-viewer@2.17.1, pptx-vanilla-viewer@1.18.1, pptx-svelte-viewer@2.17.1_

### Bug Fixes

- **shared:** Morph a picture's scale, which OOXML stores as a source crop (by @ChristopherVR) ([e2743c7](https://github.com/ChristopherVR/pptx-viewer/commit/e2743c7509090272f4d7bed6df506402de8f6a91))
- **shared:** A still of a slide paints no media chrome (by @ChristopherVR) ([d99e6fd](https://github.com/ChristopherVR/pptx-viewer/commit/d99e6fda7de360e1b1c3f16c578119f8ce5b5d5a))
- **react:** Drop the play badge from a slide-transition ghost (by @ChristopherVR) ([496f16d](https://github.com/ChristopherVR/pptx-viewer/commit/496f16dd34e2cf0fd58aed14fe7cce3b66707d2b))
- **vue:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([9eec996](https://github.com/ChristopherVR/pptx-viewer/commit/9eec9969af543a1e66c35cfb2ced38b0821cac5a))
- **angular:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([7a97cea](https://github.com/ChristopherVR/pptx-viewer/commit/7a97cea6c5bb8e742ed16bc8a7c883595564bb71))
- **svelte:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([f6b3b8d](https://github.com/ChristopherVR/pptx-viewer/commit/f6b3b8d91e409d30388c187c7fc6cad1d011f727))
- **vanilla:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([5dbdd61](https://github.com/ChristopherVR/pptx-viewer/commit/5dbdd616c85182a0d35f8628bb231cea87c8088c))
- **shared:** Measure each run's PowerPoint width instead of guessing one (by @ChristopherVR) ([920d1f3](https://github.com/ChristopherVR/pptx-viewer/commit/920d1f38129886f834fcfe42681339e8251f6814))
- **shared:** A media fallback says WHICH badge, not just "a badge" (by @ChristopherVR) ([1cbe78f](https://github.com/ChristopherVR/pptx-viewer/commit/1cbe78f85985ca87a834380932d845303250606d))
- **react:** Translate the media fallback label, and share its icons (by @ChristopherVR) ([549e169](https://github.com/ChristopherVR/pptx-viewer/commit/549e169c0c5b8bbb30e437629facd8f442f6d65a))
- **vue:** Mark missing media as not found, not as playable (by @ChristopherVR) ([1931659](https://github.com/ChristopherVR/pptx-viewer/commit/1931659c14d28a17424dbccd513afb92c4fa9cdd))
- **angular:** Mark missing media as not found, not as playable (by @ChristopherVR) ([b674f0f](https://github.com/ChristopherVR/pptx-viewer/commit/b674f0f7f764aee3ad7e879232b232bd3e437172))
- **svelte:** Mark missing media as not found, not as playable (by @ChristopherVR) ([03e21b0](https://github.com/ChristopherVR/pptx-viewer/commit/03e21b0f413cb1e028b9075eeb43a740f5c19053))
- **vanilla:** Mark missing media as not found, not as playable (by @ChristopherVR) ([73df6cc](https://github.com/ChristopherVR/pptx-viewer/commit/73df6cc626dab7b85e3842e406fa2e8c189d8eec))

### Testing

- **e2e:** Assert no media chrome rides along in a transition (by @ChristopherVR) ([8c35c45](https://github.com/ChristopherVR/pptx-viewer/commit/8c35c45db2bfdf4e185867c4a3922c70586d5b16))
- **e2e:** Re-pause on every morph scrub, not just once after the click (by @ChristopherVR) ([bb619c5](https://github.com/ChristopherVR/pptx-viewer/commit/bb619c574fba32ebb6ba233b16d37e8e9090cb89))
- **e2e:** Follow the play badge from a polygon to a shared path (by @ChristopherVR) ([2e410f7](https://github.com/ChristopherVR/pptx-viewer/commit/2e410f72f24006a5cd2868c00bab1d0686e84c92))

### Styling

- **shared:** Escape the measurement cache separator (by @ChristopherVR) ([944b312](https://github.com/ChristopherVR/pptx-viewer/commit/944b312abee48c351b84e39c794027a18ec2d758))

## 2026-08-07

_Releases: pptx-vue-viewer@2.17.0, pptx-angular-viewer@2.17.0, pptx-vanilla-viewer@1.18.0, pptx-svelte-viewer@2.17.0_

### Features

- Navigate a running slide show on the wheel in every binding (by @ChristopherVR) ([91a19e9](https://github.com/ChristopherVR/pptx-viewer/commit/91a19e96df9d19862b92c3f89ca55acbfbde3111))

### Testing

- **e2e:** Clear the tab session inside the shared loadDeck too (by @ChristopherVR) ([862020f](https://github.com/ChristopherVR/pptx-viewer/commit/862020f7737ee469f514ba573bff4905bff4e1c9))

## 2026-08-07

_Releases: pptx-react-viewer@2.16.0, pptx-vue-viewer@2.16.0, pptx-angular-viewer@2.16.0, pptx-vanilla-viewer@1.17.0, pptx-svelte-viewer@2.16.0_

### Features

- **shared:** Map wheel gestures to PowerPoint's intents (by @ChristopherVR) ([1cc7797](https://github.com/ChristopherVR/pptx-viewer/commit/1cc779799cf5b6ffa94c39199c71b563e21afa82))

### Refactor

- Route four bindings through the shared geometry cascade (by @ChristopherVR) ([859ca12](https://github.com/ChristopherVR/pptx-viewer/commit/859ca12b37efcf98e7614b2c2109f3bf1d9c0f72))

### Testing

- **e2e:** Expect the real accept list on the landing file input (by @ChristopherVR) ([cdec7a6](https://github.com/ChristopherVR/pptx-viewer/commit/cdec7a668e06f04055febba7e015e850310cb266))
- **e2e:** Forget the tab session before every deck-load navigation (by @ChristopherVR) ([29c8f7a](https://github.com/ChristopherVR/pptx-viewer/commit/29c8f7abc11902bddefba4d2fe30d352f5e3461f))

### Build & CI

- Shard the e2e matrix, and unstick three session-restore specs (by @ChristopherVR) ([0631c35](https://github.com/ChristopherVR/pptx-viewer/commit/0631c35a475daf42059a1b036df211050d2efea9))

## 2026-08-07

_Releases: pptx-react-viewer@2.15.3, pptx-vue-viewer@2.15.3, pptx-angular-viewer@2.15.3, pptx-vanilla-viewer@1.16.3, pptx-svelte-viewer@2.15.3_

### Bug Fixes

- **shared:** Stop category-axis labels crowding the plot (by @ChristopherVR) ([b511ac4](https://github.com/ChristopherVR/pptx-viewer/commit/b511ac44bb53ed2ca20932801c805ea7f0a2fcd1))
- Let clicks fall through an unfilled shape's interior (by @ChristopherVR) ([7e17f9d](https://github.com/ChristopherVR/pptx-viewer/commit/7e17f9ddacd058d9b5c13f1060f58621faeb9908))
- Hollow-shape click-through in the remaining four bindings (by @ChristopherVR) ([fee05ad](https://github.com/ChristopherVR/pptx-viewer/commit/fee05ad5463de9949f289d3aac889794bc7d834a))

### Refactor

- **shared:** Single-source the shape geometry cascade (by @ChristopherVR) ([396e4a2](https://github.com/ChristopherVR/pptx-viewer/commit/396e4a28299168af0564364e9b0be7413b2c8ce8))

### Documentation

- Record how binding duplication actually happens (by @ChristopherVR) ([918ef78](https://github.com/ChristopherVR/pptx-viewer/commit/918ef78dbe8ce10fba170bdf68ac5627158d7fe7))

## 2026-08-07

_Releases: pptx-viewer-core@2.3.2, pptx-react-viewer@2.15.2, pptx-vue-viewer@2.15.2, pptx-angular-viewer@2.15.2, pptx-vanilla-viewer@1.16.2, pptx-svelte-viewer@2.15.2_

### Bug Fixes

- **core:** Measure parallelogram skew against the short side, not the width (by @ChristopherVR) ([fea647f](https://github.com/ChristopherVR/pptx-viewer/commit/fea647f94633e6e919a1c59bda7a71cda8b1b677))
- **core:** Bulge the teardrop preset's point outwards, not inwards (by @ChristopherVR) ([0b23bc4](https://github.com/ChristopherVR/pptx-viewer/commit/0b23bc4b6ecde5f82f7cebb0601859edbf1ab399))
- **react:** Stop clipping connectors out of slide thumbnails (by @ChristopherVR) ([3005067](https://github.com/ChristopherVR/pptx-viewer/commit/3005067c96b1e752bf5980f17fdd914bece64ed6))
- **react:** Actually attach the canvas wheel listener (by @ChristopherVR) ([7e37f57](https://github.com/ChristopherVR/pptx-viewer/commit/7e37f57171b520c445cb5f916d79c69cfef8755f))
- Render ellipses as ellipses, not pills (by @ChristopherVR) ([b6d2598](https://github.com/ChristopherVR/pptx-viewer/commit/b6d2598fb58f8fc81fbef463c728d87a78c129b4))
- Stop slicing overflowing text with an identity rect clip-path (by @ChristopherVR) ([7393111](https://github.com/ChristopherVR/pptx-viewer/commit/73931118e9e29bf16d1ffccb6f01d68a02091463))

## 2026-08-07

_Releases: pptx-viewer-core@2.3.1, pptx-react-viewer@2.15.1, pptx-vue-viewer@2.15.1, pptx-angular-viewer@2.15.1, pptx-vanilla-viewer@1.16.1, pptx-svelte-viewer@2.15.1_

### Bug Fixes

- **core:** Recognize nodeType="afterEffect" when parsing animation triggers (by @ChristopherVR) ([554c077](https://github.com/ChristopherVR/pptx-viewer/commit/554c077b6d0960c5777163a83afe27ee9795b8c2))

## 2026-08-07

_Releases: pptx-react-viewer@2.15.0, pptx-vue-viewer@2.15.0, pptx-angular-viewer@2.15.0, pptx-vanilla-viewer@1.16.0, pptx-svelte-viewer@2.15.0_

### Features

- **shared:** Remember the open deck so a refresh reopens it (by @ChristopherVR) ([abbe3bd](https://github.com/ChristopherVR/pptx-viewer/commit/abbe3bd15318dd2b7b470eb69b51468d5b9ed26a))

### Bug Fixes

- **demos:** Keep the open presentation across a refresh (by @ChristopherVR) ([d202f95](https://github.com/ChristopherVR/pptx-viewer/commit/d202f9598c36cf6927dbc2133a8c317d34c363c9))
- **shared:** Make Set Up Slide Show's Manual advance mode actually work (by @ChristopherVR) ([c308423](https://github.com/ChristopherVR/pptx-viewer/commit/c3084238158b582b149fcc74903045f4145a0981))
- **angular:** Resolve viewer-store-signal test import from vendored shared (by @ChristopherVR) ([e7aa0cc](https://github.com/ChristopherVR/pptx-viewer/commit/e7aa0cce1509b62b5326d39ecf81309ad330c48e))

## 2026-08-07

_Releases: pptx-viewer-core@2.3.0, pptx-react-viewer@2.14.0, pptx-vue-viewer@2.14.0, pptx-angular-viewer@2.14.0, pptx-vanilla-viewer@1.15.0, pptx-svelte-viewer@2.14.0, pptx-viewer-mcp@2.1.0, @christophervr/pptx-viewer@1.6.0_

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
- **locales:** Cover new shape and selection keys in de, es and fr (by @ChristopherVR) ([09eabb0](https://github.com/ChristopherVR/pptx-viewer/commit/09eabb02e2cd7cafd87a11378653b1996fc2760e))
- **react:** Seed entrance animations before the slide paints (by @ChristopherVR) ([6e64403](https://github.com/ChristopherVR/pptx-viewer/commit/6e64403caee423118f6f8ad4c865d53cb6f0de69))
- **vue:** Reach the AI assistant on mobile and scale resize handles (by @ChristopherVR) ([f2795d5](https://github.com/ChristopherVR/pptx-viewer/commit/f2795d5190bb310ca4ad8ea5c6dfe546b088eb4e))
- **angular:** Apply animation styles before paint and fix the AI sheet (by @ChristopherVR) ([2ba4267](https://github.com/ChristopherVR/pptx-viewer/commit/2ba4267912b0d1cc2946c29a78b467521c747feb))
- **svelte:** Translate inspector tabs and place the caret at the end (by @ChristopherVR) ([b6d302c](https://github.com/ChristopherVR/pptx-viewer/commit/b6d302cd570a1d8b09f3cc06dfcca1d897b354a9))
- **vanilla:** Restore saved preferences and stop chrome leaking into slides (by @ChristopherVR) ([0a6f842](https://github.com/ChristopherVR/pptx-viewer/commit/0a6f842295eeb407ec27ec4cf457c9ba06aec203))
- **angular:** Title the Selection Pane control like every other binding (by @ChristopherVR) ([801a88a](https://github.com/ChristopherVR/pptx-viewer/commit/801a88a7c5a06cd8d2d1592b94ab28936e0143c3))
- **shared:** Keep a drawing gesture from advancing the show (by @ChristopherVR) ([e2578cc](https://github.com/ChristopherVR/pptx-viewer/commit/e2578cc462725d70761058295de13f35c3ccb6fe))
- **shared:** Return the keyboard to the viewer after an inline edit (by @ChristopherVR) ([351947a](https://github.com/ChristopherVR/pptx-viewer/commit/351947a1e515ad748f2fa23ec0dee59b1b1a8fbc))
- **present:** Let a blanked screen pass clicks through to the show (by @ChristopherVR) ([a8cc5d2](https://github.com/ChristopherVR/pptx-viewer/commit/a8cc5d265959d98a8bee8ab9ace42dfeef53aba2))
- **shared:** Translate the labels five bindings were rendering in English (by @ChristopherVR) ([d1bfad6](https://github.com/ChristopherVR/pptx-viewer/commit/d1bfad666119f27b3a01266729a471af8a0e47ea))
- **cli:** Let the scaffolded starters open legacy .ppt decks (by @ChristopherVR) ([2cde7f8](https://github.com/ChristopherVR/pptx-viewer/commit/2cde7f84dded2d4beca7e0f48b8d0a50d0968bf5))
- **shared:** Escape SVG gradient markup attributes (by @ChristopherVR) ([7e5dd23](https://github.com/ChristopherVR/pptx-viewer/commit/7e5dd232103f90b822ca268fdb5a15b0c619be1b))
- **react:** Stop the presenter clock re-rendering the editor once a second (by @ChristopherVR) ([6a6d3e4](https://github.com/ChristopherVR/pptx-viewer/commit/6a6d3e453fc611115a9257cc2a20ba379241626a))
- **shared:** Route numeric SVG gradient attributes through the escape barrier (by @ChristopherVR) ([58485f3](https://github.com/ChristopherVR/pptx-viewer/commit/58485f36219d8b07c73825e47c8f7cd8b43e5a19))
- **shared:** Stop a morph inventing pairs and hiding what arrives (by @ChristopherVR) ([058051d](https://github.com/ChristopherVR/pptx-viewer/commit/058051d88201f71d64c3dee8b373af70a5f005a9))

### Performance

- **shared:** Drop state writes that carry no new information (by @ChristopherVR) ([74ba824](https://github.com/ChristopherVR/pptx-viewer/commit/74ba82402f5f73fe1d3d7c04989374417444f2d2))

### Refactor

- **shared:** Place the eight resize handles from one table (by @ChristopherVR) ([86feabb](https://github.com/ChristopherVR/pptx-viewer/commit/86feabbdf23fb0bed31b44a472b2ae411110dba9))
- **shared:** Move the canvas zoom slice onto the viewer runtime (by @ChristopherVR) ([054c9eb](https://github.com/ChristopherVR/pptx-viewer/commit/054c9eb5757ceefc10d71e596acb3b0b46d96820))
- **vanilla:** Put the zoom slice on the shared viewer runtime (by @ChristopherVR) ([367295d](https://github.com/ChristopherVR/pptx-viewer/commit/367295dc6bf65664fda72cddb25b5670f07f1ff9))

### Testing

- **e2e:** Compare bindings visually and close the parity exclusions (by @ChristopherVR) ([32b6314](https://github.com/ChristopherVR/pptx-viewer/commit/32b631430e1f4bd3ab9ee8d6e8cacf1771d08a8f))
- **e2e:** Make heavy-deck navigation and post-import waits reliable (by @ChristopherVR) ([d0c51f4](https://github.com/ChristopherVR/pptx-viewer/commit/d0c51f48284bdd1e00bc85d2cd0d39b178fbbd7f))

### Chores

- **demos:** Accept .ppt in the file pickers and dropzones (by @ChristopherVR) ([0e2193c](https://github.com/ChristopherVR/pptx-viewer/commit/0e2193cd5eb53867bc72a2249e9cb2c322725bd3))

## 2026-08-05

_Releases: pptx-viewer-core@2.2.2, pptx-react-viewer@2.13.2, pptx-vue-viewer@2.13.2, pptx-angular-viewer@2.13.2, pptx-vanilla-viewer@1.14.2, pptx-svelte-viewer@2.13.2_

### Bug Fixes

- **core:** Resolve styled full font names and add condensed fallbacks (by @ChristopherVR) ([26b1f74](https://github.com/ChristopherVR/pptx-viewer/commit/26b1f745929fe33cda2044dc4a24ff4edbbab0d5))
- **shared:** Draw chart text at point size and scale chart SVGs 1:1 (by @ChristopherVR) ([da333f9](https://github.com/ChristopherVR/pptx-viewer/commit/da333f933eeba0af226ca1894639696350e23cfb))
- **shared:** Suspend the show on window blur, not only tab-hide (by @ChristopherVR) ([4a2c254](https://github.com/ChristopherVR/pptx-viewer/commit/4a2c254350554c189a53a0284aeb72e84b724740))
- **shared:** Fold the origami transition like a sheet of paper (by @ChristopherVR) ([f0f9fc2](https://github.com/ChristopherVR/pptx-viewer/commit/f0f9fc2710a4c1a3760729cfddca0afc7f66c70d))
- **shared:** Cover the fillRect placement fields in the collab schema (by @ChristopherVR) ([d455ed7](https://github.com/ChristopherVR/pptx-viewer/commit/d455ed72b254633d34e08d7694069e6c0d9f5615))

## 2026-08-05

_Releases: pptx-viewer-core@2.2.1, pptx-react-viewer@2.13.1, pptx-vue-viewer@2.13.1, pptx-angular-viewer@2.13.1, pptx-vanilla-viewer@1.14.1, pptx-svelte-viewer@2.13.1_

### Bug Fixes

- **shared:** Wrap knife-edge lines where PowerPoint wraps them (by @ChristopherVR) ([b8c7a1b](https://github.com/ChristopherVR/pptx-viewer/commit/b8c7a1b389e65c8be500f0cf62ac88a01ead37ee))
- **svelte:** Load @ai-sdk/svelte's Chat through a dynamic import (by @ChristopherVR) ([47f35ed](https://github.com/ChristopherVR/pptx-viewer/commit/47f35ed6b63e2f8e6a451afce3611c101653f6c7))
- **react:** Load @ai-sdk/react's useChat through a dynamic import (by @ChristopherVR) ([e36f98b](https://github.com/ChristopherVR/pptx-viewer/commit/e36f98bc5651b6d2f4469311b85bd4425484ccf1))
- **vue:** Load @ai-sdk/vue's useChat through a dynamic import (by @ChristopherVR) ([c3c59d3](https://github.com/ChristopherVR/pptx-viewer/commit/c3c59d37be3a21e5de41967934a5d066ed25cd86))
- **core:** Resolve omitted-lvl paragraphs through lvl1pPr, defPPr beneath (by @ChristopherVR) ([af1cb66](https://github.com/ChristopherVR/pptx-viewer/commit/af1cb669b93757b2eb99ab0e9cb1a91de96d6d75))
- **shared:** Stack a:spcPct line spacing on the 1.2 single-spacing pitch (by @ChristopherVR) ([ab47eff](https://github.com/ChristopherVR/pptx-viewer/commit/ab47eff995da02cab3a0979b418b7b4099033eb0))
- **core:** Play p14/p15 transitions written as mc:Choice direct children (by @ChristopherVR) ([b6877a6](https://github.com/ChristopherVR/pptx-viewer/commit/b6877a6b26bba9bb7ff7ca93e031878be91e507f))
- **core:** Resolve transition and timing across multiple mc envelopes (by @ChristopherVR) ([3e16e9e](https://github.com/ChristopherVR/pptx-viewer/commit/3e16e9eb5e5b8aae9b741b45e0ae482652c2a1eb))
- **shared:** Cross-slide audio foundation + visibility pause for slide shows (by @ChristopherVR) ([21ce9e0](https://github.com/ChristopherVR/pptx-viewer/commit/21ce9e08a9d4b05f285563ada8195273444e9ed4))
- **core:** Model a:stretch/a:fillRect as frame placement, not source crop (by @ChristopherVR) ([bbb7fc4](https://github.com/ChristopherVR/pptx-viewer/commit/bbb7fc4ee0841ece6bbab7eaf0c03b2380a3960c))
- **react:** Play map-sourced cross-slide audio and pause the show when hidden (by @ChristopherVR) ([69adb91](https://github.com/ChristopherVR/pptx-viewer/commit/69adb9197d2470c59e0b125cb132d0c7ca1e12c4))
- **vue:** Keep cross-slide audio playing and pause the show when hidden (by @ChristopherVR) ([5cc9974](https://github.com/ChristopherVR/pptx-viewer/commit/5cc9974cadc56aa9087c261e5bfcdc88beeaba14))
- **svelte:** Keep cross-slide audio playing and pause the show when hidden (by @ChristopherVR) ([6ea6a7b](https://github.com/ChristopherVR/pptx-viewer/commit/6ea6a7b89b342e4b07f3e6a45c056b77a94468f6))
- **vanilla:** Keep cross-slide audio playing and pause the show when hidden (by @ChristopherVR) ([7bb75ec](https://github.com/ChristopherVR/pptx-viewer/commit/7bb75ecfa6c2c697471d9acc90dff9c6ef87b718))
- **angular:** Keep cross-slide audio playing and pause the show when hidden (by @ChristopherVR) ([90e6f54](https://github.com/ChristopherVR/pptx-viewer/commit/90e6f544ab6535c6fe114872c71ffc22102a7895))

### Testing

- **angular:** Guard against a static optional-peer AI import reappearing (by @ChristopherVR) ([121daeb](https://github.com/ChristopherVR/pptx-viewer/commit/121daeb68cdccbc66bc059a16dd7ef37d5076fbd))
- **vanilla:** Guard against a static optional-peer AI import reappearing (by @ChristopherVR) ([13a3cc7](https://github.com/ChristopherVR/pptx-viewer/commit/13a3cc75d06153dec49d81a960760a891d1eb7c3))

### Dependencies

- **deps:** Bump ai from 7.0.48 to 7.0.44 ([#134](https://github.com/ChristopherVR/pptx-viewer/issues/134)) (by @dependabot[bot]) ([08a13e0](https://github.com/ChristopherVR/pptx-viewer/commit/08a13e076caa6d97e22bd706e57657407aef1dd8))
- **deps:** Update lucide-react requirement from ^1.27.0 to ^1.28.0 ([#140](https://github.com/ChristopherVR/pptx-viewer/issues/140)) (by @dependabot[bot]) ([5d29620](https://github.com/ChristopherVR/pptx-viewer/commit/5d296201e4307c959fbd8cb987f8fb46ea8e73e2))
- **deps:** Update @lucide/svelte requirement from ^1.27.0 to ^1.28.0 ([#142](https://github.com/ChristopherVR/pptx-viewer/issues/142)) (by @dependabot[bot]) ([1a13fb6](https://github.com/ChristopherVR/pptx-viewer/commit/1a13fb6f78117837865769323735d57ad4cb0a8f))
- **deps:** Update @vitejs/plugin-react requirement ([#139](https://github.com/ChristopherVR/pptx-viewer/issues/139)) (by @dependabot[bot]) ([2768ad0](https://github.com/ChristopherVR/pptx-viewer/commit/2768ad0165d8dbf28628278dfaabb5dc0490ce40))
- **deps:** Bump Angular to 22.1.x consistently across all packages (by @ChristopherVR) ([13c4e5e](https://github.com/ChristopherVR/pptx-viewer/commit/13c4e5e1ee6bcd9723b89757d1a32da2cced1a2a))

### Chores

- **deps-dev:** Bump oxfmt in the minor-and-patch group ([#133](https://github.com/ChristopherVR/pptx-viewer/issues/133)) (by @dependabot[bot]) ([5df1086](https://github.com/ChristopherVR/pptx-viewer/commit/5df1086f0f5bebc197cc03605cb5167f209f0357))
- **deps-dev:** Update vite requirement from ^8.1.5 to ^8.2.0 ([#135](https://github.com/ChristopherVR/pptx-viewer/issues/135)) (by @dependabot[bot]) ([1e7e296](https://github.com/ChristopherVR/pptx-viewer/commit/1e7e2965eff8635dfa8b94fa196b89ed1d0fd0c7))
- **deps-dev:** Bump oxlint from 1.77.0 to 1.76.0 ([#138](https://github.com/ChristopherVR/pptx-viewer/issues/138)) (by @dependabot[bot]) ([0a33b5e](https://github.com/ChristopherVR/pptx-viewer/commit/0a33b5ec442a6ca4dca89bafeecc743cf4196669))

## 2026-08-01

_Releases: pptx-viewer-core@2.2.0, pptx-react-viewer@2.13.0, pptx-vue-viewer@2.13.0, pptx-angular-viewer@2.13.0, pptx-vanilla-viewer@1.14.0, pptx-svelte-viewer@2.13.0_

### Features

- Fixed graphs and arrows shapes (by @ChristopherVR) ([94813f5](https://github.com/ChristopherVR/pptx-viewer/commit/94813f52a75fb3b42f72e7c33be41393b794cf82))

## 2026-08-01

_Releases: pptx-react-viewer@2.12.1, pptx-vue-viewer@2.12.1, pptx-angular-viewer@2.12.1, pptx-vanilla-viewer@1.13.1, pptx-svelte-viewer@2.12.1_

### Bug Fixes

- Make an inspector edit exactly one undo step, in every binding (by @ChristopherVR) ([48733d4](https://github.com/ChristopherVR/pptx-viewer/commit/48733d4a9dbe8d7887b0a103cc7cb1e90882464b))
- Let the presenter finish the show, and keep scrubbers out of its panes (by @ChristopherVR) ([c7c12bc](https://github.com/ChristopherVR/pptx-viewer/commit/c7c12bc053548c8e94d3da385461d6569a1695a0))

### Refactor

- **vue:** Drop the orphaned useSelection composable (by @ChristopherVR) ([f5f31f3](https://github.com/ChristopherVR/pptx-viewer/commit/f5f31f3710bbf26e0dd60e0c68a852b033ee8e22))
- **shared:** Split arrow markers and dash patterns out of connector-path (by @ChristopherVR) ([53d47d1](https://github.com/ChristopherVR/pptx-viewer/commit/53d47d1d529fe17f165a16ec9de7b7f29b17845c))

## 2026-08-01

_Releases: pptx-viewer-core@2.1.2, pptx-react-viewer@2.12.0, pptx-vue-viewer@2.12.0, pptx-angular-viewer@2.12.0, pptx-vanilla-viewer@1.13.0, pptx-svelte-viewer@2.12.0_

### Features

- Mark hidden slides in every rail and sorter, and honour custom shows in vanilla and svelte (by @ChristopherVR) ([b61f202](https://github.com/ChristopherVR/pptx-viewer/commit/b61f2029b09d2bad78fc53bdd0f0d5538b171aa9))
- Name every animation preset a user can reach, in every locale (by @ChristopherVR) ([f99962d](https://github.com/ChristopherVR/pptx-viewer/commit/f99962d0e98d579ad45ee77299b1df1f326fde6d))
- **vue:** Add the connector arrowhead controls, and make connectors clickable (by @ChristopherVR) ([2b0976e](https://github.com/ChristopherVR/pptx-viewer/commit/2b0976ea68b4ffc6c3ab7fd5d58aed1c8f5d1356))

### Bug Fixes

- **vanilla:** Let a ribbon button with a text label size to its text (by @ChristopherVR) ([e8ed06e](https://github.com/ChristopherVR/pptx-viewer/commit/e8ed06e1ed6e499f1005ea2a44969fa946c3d60e))
- **shared:** Paint SVG-only pictures, honour srcRect crops, stop bold leaking (by @ChristopherVR) ([ff866db](https://github.com/ChristopherVR/pptx-viewer/commit/ff866db22a2f59f0fbb6da518b4055e8edd80481))
- Give every binding React's slide-show bar, and make slice clicks work (by @ChristopherVR) ([31f30f7](https://github.com/ChristopherVR/pptx-viewer/commit/31f30f7f26117e3badb34c2e2e0a29f32f8da608))

### Refactor

- **vue:** Decompose the two largest view-layer files (by @ChristopherVR) ([0bd2568](https://github.com/ChristopherVR/pptx-viewer/commit/0bd25680a428a47eecba38c4f50839c7a93eba80))

## 2026-07-31

_Releases: pptx-react-viewer@2.11.1, pptx-vue-viewer@2.11.1, pptx-angular-viewer@2.11.1, pptx-vanilla-viewer@1.12.1, pptx-svelte-viewer@2.11.1_

### Bug Fixes

- **shared:** Stop a morph gliding one text box into an unrelated one (by @ChristopherVR) ([bc4789f](https://github.com/ChristopherVR/pptx-viewer/commit/bc4789fef0dbcaf8d524b19f99fac15847597ad0))
- **shared:** Stop a morph double-painting unchanged shapes, and dissolve text (by @ChristopherVR) ([d4b3952](https://github.com/ChristopherVR/pptx-viewer/commit/d4b3952757d719b2c7e1b4be307b14a15c56f73a))
- Stop showing users raw OOXML tokens, and make Vanilla's point index work (by @ChristopherVR) ([33d63ce](https://github.com/ChristopherVR/pptx-viewer/commit/33d63cec94a22ddf7cc0b57ddaa61ddb43eaedd3))
- Skip hidden slides in the show, and honour endWithBlackSlide (by @ChristopherVR) ([2a9ef49](https://github.com/ChristopherVR/pptx-viewer/commit/2a9ef49f97f976eb088a2fcc092b56a54b112fa3))

### Refactor

- **angular:** Decompose the view layer's oversized components (by @ChristopherVR) ([2887d2e](https://github.com/ChristopherVR/pptx-viewer/commit/2887d2e0d4c4f600d7cb80c497bf7d65c8f6635a))

## 2026-07-31

_Releases: pptx-viewer-core@2.1.1, pptx-react-viewer@2.11.0, pptx-vue-viewer@2.11.0, pptx-angular-viewer@2.11.0, pptx-vanilla-viewer@1.12.0, pptx-svelte-viewer@2.11.0_

### Features

- **shared:** Outline view, motion-path authoring, and chart marker resolution (by @ChristopherVR) ([e6a3621](https://github.com/ChristopherVR/pptx-viewer/commit/e6a362195b811231c76a24eb94de8e95795716f8))
- Outline view, motion-path authoring and the missing chart controls (by @ChristopherVR) ([278de2f](https://github.com/ChristopherVR/pptx-viewer/commit/278de2f5754f2b8bb19722460e047deb4cd72fbb))

### Bug Fixes

- **core:** Stop dropping a:pPr/@lvl when a paragraph's runs share one style (by @ChristopherVR) ([03aa4ed](https://github.com/ChristopherVR/pptx-viewer/commit/03aa4edeea15336b032227601cc57fb65d378b1c))

### Documentation

- Record the two stale-cache failure modes that keep costing time (by @ChristopherVR) ([e580d8c](https://github.com/ChristopherVR/pptx-viewer/commit/e580d8ccac2c8f3d4d31d7500a681d2c95f7dd38))

## 2026-07-31

_Releases: pptx-react-viewer@2.10.0, pptx-vue-viewer@2.10.0, pptx-angular-viewer@2.10.0, pptx-vanilla-viewer@1.11.0, pptx-svelte-viewer@2.10.0_

### Features

- **shared:** Own the equation, media, reading-view and table-grid logic (by @ChristopherVR) ([c33af39](https://github.com/ChristopherVR/pptx-viewer/commit/c33af39d2157fdb8610c104a8a3e54fa8ae7c672))
- Wire reading view, the shared equation pipeline and a table data grid (by @ChristopherVR) ([b731b52](https://github.com/ChristopherVR/pptx-viewer/commit/b731b52f926737f0ccef95247f20db217cee1fb5))

### Bug Fixes

- **shared:** Resolve linked text-box chains inside groups (by @ChristopherVR) ([5e09586](https://github.com/ChristopherVR/pptx-viewer/commit/5e0958689a591f839ccfdf20bb3ae174af00030a))

## 2026-07-31

_Releases: pptx-viewer-core@2.1.0, pptx-react-viewer@2.9.0, pptx-vue-viewer@2.9.0, pptx-angular-viewer@2.9.0, pptx-vanilla-viewer@1.10.0, pptx-svelte-viewer@2.9.0_

### Features

- **shared:** Give every referenced translation key a real entry (by @ChristopherVR) ([8ff4461](https://github.com/ChristopherVR/pptx-viewer/commit/8ff4461d0376408330ef5ce875b4aa7a13d0614f))
- **shared:** Own the logic five bindings had each hand-ported (by @ChristopherVR) ([60b9b0d](https://github.com/ChristopherVR/pptx-viewer/commit/60b9b0d06d60d674835ef23166ca9c46c1b191ba))
- **vanilla:** Reach ribbon, inspector and canvas parity with the reference (by @ChristopherVR) ([26ff896](https://github.com/ChristopherVR/pptx-viewer/commit/26ff8968b20a7affdd48ee6e8dcf89d18097302b))
- **svelte:** Close the ribbon, inspector and ruler gaps against the reference (by @ChristopherVR) ([f2e0684](https://github.com/ChristopherVR/pptx-viewer/commit/f2e0684c4df94ff9e27dc878b7221431ec71e9de))
- **vue:** Close the ribbon, context-menu and field-context gaps (by @ChristopherVR) ([8273f08](https://github.com/ChristopherVR/pptx-viewer/commit/8273f089a2646f266ed3f176bc8ce7a20fa71b30))
- **angular:** Reach ribbon and inspector parity, and stop double-stamping elements (by @ChristopherVR) ([5982b7a](https://github.com/ChristopherVR/pptx-viewer/commit/5982b7a4ee7bc233b20ee7705e9f84160831c986))
- **core:** Model a gradient / pattern outline in structured form (by @ChristopherVR) ([69322c9](https://github.com/ChristopherVR/pptx-viewer/commit/69322c94ab40e37f19a1789c3149b5dd5d71498c))
- **shared:** Stroke a gradient outline as SVG instead of a flat border (by @ChristopherVR) ([fc72324](https://github.com/ChristopherVR/pptx-viewer/commit/fc723241643cdc18bb6ad0c113ca08763c9426ad))
- **react:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([5885d81](https://github.com/ChristopherVR/pptx-viewer/commit/5885d817ff7329b79edf1b59610718edaaaaa3ed))
- **vue:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([33d8b10](https://github.com/ChristopherVR/pptx-viewer/commit/33d8b1000664c94a82fbb590cba0226c53931b9b))
- **svelte:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([dd43f2d](https://github.com/ChristopherVR/pptx-viewer/commit/dd43f2ddf135ab698cf37086823a0ea54ffd6694))
- **vanilla:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([b9804ac](https://github.com/ChristopherVR/pptx-viewer/commit/b9804ac1d6a0fd5d72f40b360d576132cca2fb90))
- **angular:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([352ea59](https://github.com/ChristopherVR/pptx-viewer/commit/352ea59a97af4966af13680f2d48caabe8987af0))
- **shared:** Stroke a patterned outline with a real pattern tile (by @ChristopherVR) ([9d8c3bd](https://github.com/ChristopherVR/pptx-viewer/commit/9d8c3bdfbd40e78d0fc66d9325efedb0bc9a3ea4))
- **react:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([fc6348e](https://github.com/ChristopherVR/pptx-viewer/commit/fc6348ef022d55442ee7b5125ab52d74aa38e2d5))
- **vue:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([72e2a4c](https://github.com/ChristopherVR/pptx-viewer/commit/72e2a4cfcaab5e05b950582b12d811c47b57f83f))
- **svelte:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([f11c0f5](https://github.com/ChristopherVR/pptx-viewer/commit/f11c0f5b613911a3cbeda61d31af731729f0dab5))
- **vanilla:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([1b3ee4f](https://github.com/ChristopherVR/pptx-viewer/commit/1b3ee4f75444027b88bce70928328233edad49af))
- **angular:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([8da41b8](https://github.com/ChristopherVR/pptx-viewer/commit/8da41b8b6d016de0c025d14155b87f0994f12188))
- **shared:** Translate the File backstage and merge the stray key namespaces (by @ChristopherVR) ([e56aa6d](https://github.com/ChristopherVR/pptx-viewer/commit/e56aa6d3f00e4cbd23983036a195cba3c2d6bf6b))

### Bug Fixes

- **shared:** Honour authored preset adjustments and emit parseable gradient CSS (by @ChristopherVR) ([dbf5640](https://github.com/ChristopherVR/pptx-viewer/commit/dbf5640fb532082ca96d6a7dc8b439e07dd34a80))
- **react:** Paint freeform gradients and honour gradient tiling (by @ChristopherVR) ([cff1958](https://github.com/ChristopherVR/pptx-viewer/commit/cff1958b9858fdd9e1861e86dd6e692a2d2a84d4))
- **vue:** Apply the gradient tile background-position (by @ChristopherVR) ([eafb597](https://github.com/ChristopherVR/pptx-viewer/commit/eafb597f7b69b638ef028dfeb707c43d39292ca7))
- **svelte:** Apply the gradient tile background-position (by @ChristopherVR) ([7c3d664](https://github.com/ChristopherVR/pptx-viewer/commit/7c3d664e4ec635570549f0d0b464294170dfbde0))
- **e2e:** Measure the clip-path area against the path's own extent (by @ChristopherVR) ([484ce9e](https://github.com/ChristopherVR/pptx-viewer/commit/484ce9e245783210dab3899fc8cff00f3ddd36ab))
- **core:** Honour a preset path's own coordinate space, and repair hexagon (by @ChristopherVR) ([8e4a91d](https://github.com/ChristopherVR/pptx-viewer/commit/8e4a91d76a2bdd3ba3369ed541bc262d2a9c06f4))
- **core:** Rebuild flowChartTerminator from its spec Beziers (by @ChristopherVR) ([0e81403](https://github.com/ChristopherVR/pptx-viewer/commit/0e8140381fe6af3719a52dcc1b39f16609b5faf0))
- **core:** Keep an inline field in the position it was authored in (by @ChristopherVR) ([beb2067](https://github.com/ChristopherVR/pptx-viewer/commit/beb2067fc11ae709a26b4f9e6714fa557375ec85))
- **core:** Rebuild sun as a disc plus eight detached rays (by @ChristopherVR) ([cd2fcd4](https://github.com/ChristopherVR/pptx-viewer/commit/cd2fcd4baec66f040671aea332d1bcd2250a2e7f))
- **react:** Stop firing every shortcut twice, and surface the panels it had built (by @ChristopherVR) ([05f9eba](https://github.com/ChristopherVR/pptx-viewer/commit/05f9eba3333d7fad275a000855b2e114bd6dd44b))
- **core:** Round-trip the Selection Pane hide toggle (by @ChristopherVR) ([14bdb23](https://github.com/ChristopherVR/pptx-viewer/commit/14bdb23d8c2840cc93d8a891c31ac9e8ffdf44cf))
- **shared:** Resolve a click on a group's child to the group (by @ChristopherVR) ([88ef671](https://github.com/ChristopherVR/pptx-viewer/commit/88ef671c4af065c0e21327ceec5840a2de4d4516))
- **shared:** Flow linked text-box overflow in every binding (by @ChristopherVR) ([abe1bb0](https://github.com/ChristopherVR/pptx-viewer/commit/abe1bb0702315c8a65582f1d64f62c6679298143))

### Refactor

- **svelte:** Clear the file-size debt, and the duplicate viewer state behind it (by @ChristopherVR) ([830bcc9](https://github.com/ChristopherVR/pptx-viewer/commit/830bcc9ed77d85f1461f4861a326dbbba7ebcc31))

### Testing

- **angular:** Pin the ellipse-sized circle path gradient (by @ChristopherVR) ([9b12ba1](https://github.com/ChristopherVR/pptx-viewer/commit/9b12ba1b8396c57763d21119ceb7dd247469973b))
- **core:** Pin issue #132 fill and adjustment parsing against the reporter deck (by @ChristopherVR) ([06cd312](https://github.com/ChristopherVR/pptx-viewer/commit/06cd31287bcbd3895a834bed9f89af443526dca2))
- **e2e:** Add the issue #132 deck fixture and cross-binding spec (by @ChristopherVR) ([74f960a](https://github.com/ChristopherVR/pptx-viewer/commit/74f960ad5334dbd5d9dad548bb834b1513fd11e1))
- **e2e:** Diff the five bindings against each other, not just thresholds (by @ChristopherVR) ([2014f44](https://github.com/ChristopherVR/pptx-viewer/commit/2014f445a38c6a93aa248ee5a24a525a49785ce0))
- **e2e:** Assert a gradient outline is stroked in every binding (by @ChristopherVR) ([d46fde5](https://github.com/ChristopherVR/pptx-viewer/commit/d46fde56d754748920d7cc6a0967d89a66ba7857))
- **e2e:** Cover gradient and pattern outlines across the bindings (by @ChristopherVR) ([2492c53](https://github.com/ChristopherVR/pptx-viewer/commit/2492c53d8feee2ad881bae09b9c72b1d0408a1f5))
- **e2e:** Wait for the shapes, not a fixed delay, in the outline spec (by @ChristopherVR) ([c5a8da9](https://github.com/ChristopherVR/pptx-viewer/commit/c5a8da9d1c15d6b4104e3227c8748c443382f084))

### Styling

- **e2e:** Drop em-dashes from spec comments (by @ChristopherVR) ([003052d](https://github.com/ChristopherVR/pptx-viewer/commit/003052dba950e4740f5da3d2f1f7ac844999bfce))

## 2026-07-31

_Releases: pptx-react-viewer@2.8.0, pptx-vue-viewer@2.8.0, pptx-angular-viewer@2.8.0, pptx-vanilla-viewer@1.9.0, pptx-svelte-viewer@2.8.0_

### Features

- **shared:** Decide which slide-show clicks are a PowerPoint advance (by @ChristopherVR) ([12ab5c8](https://github.com/ChristopherVR/pptx-viewer/commit/12ab5c82f08083e725eae332ee19b03b5021ce79))

### Bug Fixes

- **react:** Advance the slide show when the presenter clicks (by @ChristopherVR) ([35490cc](https://github.com/ChristopherVR/pptx-viewer/commit/35490cc6164b6d4beb58d72bd6a19c919aba9862))
- **vue:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([781d0d1](https://github.com/ChristopherVR/pptx-viewer/commit/781d0d1bce1e6761f9429ee30fc1126a29c211f4))
- **angular:** Stop a morph's departing layer covering the incoming slide (by @ChristopherVR) ([e338731](https://github.com/ChristopherVR/pptx-viewer/commit/e3387314197ee7107d135e10fa04aef26bb86bf6))
- **vue:** Paint a video's poster frame and hide its transport in a show (by @ChristopherVR) ([59c2852](https://github.com/ChristopherVR/pptx-viewer/commit/59c285287d990cd9254d8ac4929706568bd02f49))
- **vanilla:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([525a167](https://github.com/ChristopherVR/pptx-viewer/commit/525a1673aad8ce00625ad0e0758b949b516c7141))
- **e2e:** Drop binding-specific selectors from the new present specs (by @ChristopherVR) ([4db83a8](https://github.com/ChristopherVR/pptx-viewer/commit/4db83a8c401f3b3586784b7244ca131511757023))

### Testing

- **e2e:** Pin the morph departing layer to a see-through stage (by @ChristopherVR) ([34cd034](https://github.com/ChristopherVR/pptx-viewer/commit/34cd03460e4ae1612abd9e7c6525b60b64002b3c))

## 2026-07-31

_Releases: pptx-viewer-core@2.0.11, pptx-react-viewer@2.7.1, pptx-vue-viewer@2.7.1, pptx-angular-viewer@2.7.1, pptx-vanilla-viewer@1.8.1, pptx-svelte-viewer@2.7.1_

### Bug Fixes

- **demos:** Make the whole landing dropzone open the file picker (by @ChristopherVR) ([c170443](https://github.com/ChristopherVR/pptx-viewer/commit/c17044308f4aab22409c1f1fa585860ce2487483))
- **shared:** Match PowerPoint's morph dissolve windows and half-turn direction (by @ChristopherVR) ([661c250](https://github.com/ChristopherVR/pptx-viewer/commit/661c250ff429f0d8ea2f0bb5e2992a7d57af0353))
- **shared:** Stop morph pairing a shape with the group that wraps it (by @ChristopherVR) ([d240498](https://github.com/ChristopherVR/pptx-viewer/commit/d240498388734b5e81b238036856d891f86f2570))
- **core:** Stop an interactive sequence adding a phantom click step (by @ChristopherVR) ([65a4738](https://github.com/ChristopherVR/pptx-viewer/commit/65a4738a6eb8fd0b34999c52dd7e1244c5f0e6b5))
- **vue:** Make the slide show's transitions visible on a large display (by @ChristopherVR) ([8c6acd9](https://github.com/ChristopherVR/pptx-viewer/commit/8c6acd9bb9226b9522161bfe00fdb44f4c6bba20))
- **demos:** Match the React landing card metrics in the Vue demo (by @ChristopherVR) ([3fcaa69](https://github.com/ChristopherVR/pptx-viewer/commit/3fcaa69a963d3c84de12b6dabecf05b2874e876b))
- **shared:** Resolve the timed slide auto-advance delay (by @ChristopherVR) ([beba8cc](https://github.com/ChristopherVR/pptx-viewer/commit/beba8ccb834f1eb04db305d68ac31d40beda4232))
- **angular:** Paint a fully transparent solid fill transparently (by @ChristopherVR) ([8410d7d](https://github.com/ChristopherVR/pptx-viewer/commit/8410d7dc08fe9fdf49cc684346cdbe0ca1042a1c))
- **angular:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([6435beb](https://github.com/ChristopherVR/pptx-viewer/commit/6435beb0156cb71087a61f90c857f44f7b10da06))
- **svelte:** Wire the backstage browse control and stretch its nav rail (by @ChristopherVR) ([339adb2](https://github.com/ChristopherVR/pptx-viewer/commit/339adb2c0c8a0871f8690562499c1c7f04b463a5))
- **svelte:** Make the slide show's transitions visible on a large display (by @ChristopherVR) ([f8a8b8a](https://github.com/ChristopherVR/pptx-viewer/commit/f8a8b8a47145577bb57dda020ada69ab9bb74fa0))
- **vanilla:** Make the slide show's transitions visible on a large display (by @ChristopherVR) ([ef02b5e](https://github.com/ChristopherVR/pptx-viewer/commit/ef02b5e8f00398f4bb59d41c3918104b5b074654))
- **svelte:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([3ce750a](https://github.com/ChristopherVR/pptx-viewer/commit/3ce750ae5847a9406f24a221fd31cda6f36dc8a0))

### Refactor

- **shared:** Break the morph-matching <-> morph-flatten import cycle (by @ChristopherVR) ([92223c5](https://github.com/ChristopherVR/pptx-viewer/commit/92223c542d357d2831b4b3641180fec20c264dc1))

### Testing

- **e2e:** Drive the landing browse controls, not the hidden input (by @ChristopherVR) ([7416220](https://github.com/ChristopherVR/pptx-viewer/commit/7416220442ed1a17740d1f5cfcb0735eb401474c))
- **e2e:** Pin the morph centre to PowerPoint's dissolve, in all five bindings (by @ChristopherVR) ([34fc778](https://github.com/ChristopherVR/pptx-viewer/commit/34fc7787368b2e3543d8cc294be8601718221636))
- **e2e:** Add a production-build slide-show smoke guard (by @ChristopherVR) ([9830d1e](https://github.com/ChristopherVR/pptx-viewer/commit/9830d1ee1166f755e22b6d836f8c10f40de468ae))
- **e2e:** Assert transitions and the browse button by what a human sees (by @ChristopherVR) ([0d7f46a](https://github.com/ChristopherVR/pptx-viewer/commit/0d7f46a18a461cdd50a29dfa3d9b2812d8917574))
- **e2e:** Drive the viewer's own File > Open browse control (by @ChristopherVR) ([0978b6b](https://github.com/ChristopherVR/pptx-viewer/commit/0978b6b1e1c737e09ea864a87c18da1f730ab28f))
- **e2e:** Pin the slide-2 transparent overlay and the timed advance (by @ChristopherVR) ([4e3d1fd](https://github.com/ChristopherVR/pptx-viewer/commit/4e3d1fd04de79e8a827501c95e12706db274b855))

## 2026-07-31

_Releases: pptx-react-viewer@2.7.0, pptx-vue-viewer@2.7.0, pptx-angular-viewer@2.7.0, pptx-vanilla-viewer@1.8.0, pptx-svelte-viewer@2.7.0_

### Features

- **shared:** Morph a !!-named shape across a grouping boundary (by @ChristopherVR) ([c74847d](https://github.com/ChristopherVR/pptx-viewer/commit/c74847dd53ef3344c4624c036a2f806ea62794c1))

### Bug Fixes

- **shared:** Morph rotates the short way round, like PowerPoint (by @ChristopherVR) ([255d0b5](https://github.com/ChristopherVR/pptx-viewer/commit/255d0b5541bdf12d66ab773090fee179072eb852))
- **shared:** Honour the legacy spd speed, including for morph (by @ChristopherVR) ([ab796b9](https://github.com/ChristopherVR/pptx-viewer/commit/ab796b94e27fa8addbad5f70578b4c9a591c1b11))
- **shared:** Keep a morphing object solid instead of dipping to the background (by @ChristopherVR) ([5f2b518](https://github.com/ChristopherVR/pptx-viewer/commit/5f2b518d39c16eeb207f70ea1df2583405022611))
- **react:** Animate a group child that morphs on its own (by @ChristopherVR) ([6f1c44d](https://github.com/ChristopherVR/pptx-viewer/commit/6f1c44dfb9ced002566ad88aa45234c9650b4788))

### Testing

- **e2e:** Pin cross-group !! morph matching in all five bindings (by @ChristopherVR) ([ab64b96](https://github.com/ChristopherVR/pptx-viewer/commit/ab64b9640383f292b3f6794ab04b7924534772b1))

## 2026-07-30

_Releases: pptx-viewer-core@2.0.10, pptx-react-viewer@2.6.7, pptx-vue-viewer@2.6.6, pptx-angular-viewer@2.6.6, pptx-vanilla-viewer@1.7.6, pptx-svelte-viewer@2.6.6_

### Bug Fixes

- **core:** Stamp the endParaRPr size on an empty paragraph's separator (by @ChristopherVR) ([2b18374](https://github.com/ChristopherVR/pptx-viewer/commit/2b1837473bdde04bc41f9593f444a096dd4196b8))
- **shared:** PowerPoint-exact line height, blank-line strut, marker indent reset (by @ChristopherVR) ([7f7181b](https://github.com/ChristopherVR/pptx-viewer/commit/7f7181b2d4ec36f990b157964c2aa648d291b20f))
- **react:** Tab a hanging bullet's first line to the indent stop (by @ChristopherVR) ([a6d899f](https://github.com/ChristopherVR/pptx-viewer/commit/a6d899fb8fca6879673b0cedc240ab7d398606a7))
- **shared:** Stop morph id-pairing shapes whose creationId GUIDs differ (by @ChristopherVR) ([b9afc84](https://github.com/ChristopherVR/pptx-viewer/commit/b9afc844f0cab88ed44b25236f21b4628f1309a6))
- **angular:** Size a blank line from its endParaRPr, not the body default (by @ChristopherVR) ([ec94d3f](https://github.com/ChristopherVR/pptx-viewer/commit/ec94d3f127e9b67a8770a3a9e8e429f7e7e3a4e5))

### Testing

- **e2e:** Pin slide-13 hanging-indent tab and heading rhythm to PowerPoint (by @ChristopherVR) ([e976d32](https://github.com/ChristopherVR/pptx-viewer/commit/e976d321c3d6e1fbc80d26fddb04d0dda5ca7931))
- **vue:** Expect PowerPoint's 1.2 default line-height (by @ChristopherVR) ([1023888](https://github.com/ChristopherVR/pptx-viewer/commit/10238888c51cfc7a9739df2cc56bae24c59249cb))

## 2026-07-30

_Releases: pptx-viewer-core@2.0.9, pptx-react-viewer@2.6.6, pptx-vue-viewer@2.6.5, pptx-angular-viewer@2.6.5, pptx-vanilla-viewer@1.7.5, pptx-svelte-viewer@2.6.5_

### Bug Fixes

- **core:** Stamp the endParaRPr size on an empty paragraph's separator (by @ChristopherVR) ([2b18374](https://github.com/ChristopherVR/pptx-viewer/commit/2b1837473bdde04bc41f9593f444a096dd4196b8))
- **shared:** PowerPoint-exact line height, blank-line strut, marker indent reset (by @ChristopherVR) ([7f7181b](https://github.com/ChristopherVR/pptx-viewer/commit/7f7181b2d4ec36f990b157964c2aa648d291b20f))
- **react:** Tab a hanging bullet's first line to the indent stop (by @ChristopherVR) ([a6d899f](https://github.com/ChristopherVR/pptx-viewer/commit/a6d899fb8fca6879673b0cedc240ab7d398606a7))

### Testing

- **e2e:** Pin slide-13 hanging-indent tab and heading rhythm to PowerPoint (by @ChristopherVR) ([e976d32](https://github.com/ChristopherVR/pptx-viewer/commit/e976d321c3d6e1fbc80d26fddb04d0dda5ca7931))

## 2026-07-30

_Releases: pptx-react-viewer@2.6.5_

### Bug Fixes

- **react:** Stop dialog focus trap re-arming on every viewer render (by @ChristopherVR) ([b9217b6](https://github.com/ChristopherVR/pptx-viewer/commit/b9217b6aceecdd469da07fb6a49f9a7702d5641c))

### Testing

- **e2e:** Share-dialog input focus spec across all five bindings (by @ChristopherVR) ([db537d2](https://github.com/ChristopherVR/pptx-viewer/commit/db537d28f73e0db70abcc8535356efaba024c353))

### Build & CI

- Raise e2e job timeout to 25 minutes (by @ChristopherVR) ([b87037a](https://github.com/ChristopherVR/pptx-viewer/commit/b87037ae4d9708f1cdd4b97e12d6ad6fcaf0f80e))

## 2026-07-30

_Releases: pptx-react-viewer@2.6.4, pptx-vue-viewer@2.6.4, pptx-angular-viewer@2.6.4, pptx-vanilla-viewer@1.7.4, pptx-svelte-viewer@2.6.4_

### Bug Fixes

- **shared:** Restate the static transform in every morph keyframe (by @ChristopherVR) ([075a645](https://github.com/ChristopherVR/pptx-viewer/commit/075a6454fe4a5a17e79e2b2adb213ea2e21ccfb0))
- **react:** Ride the morph ghost animation on the element's own container (by @ChristopherVR) ([33c0832](https://github.com/ChristopherVR/pptx-viewer/commit/33c083282fda01d83397db10cc6aff9b8b4fca6f))

## 2026-07-30

_Releases: pptx-react-viewer@2.6.3, pptx-vue-viewer@2.6.3, pptx-angular-viewer@2.6.3, pptx-vanilla-viewer@1.7.3, pptx-svelte-viewer@2.6.3_

### Bug Fixes

- **react:** Play the destination slide's transition on a hyperlink jump (by @ChristopherVR) ([1e5c995](https://github.com/ChristopherVR/pptx-viewer/commit/1e5c9950f0d8ba2d1bcdf90241b77cbf0ad78f39))
- **shared:** Stop morph pairing nearby shapes of very different sizes; 2s default (by @ChristopherVR) ([3d49c67](https://github.com/ChristopherVR/pptx-viewer/commit/3d49c672089ae26008f24f8cce7160ef22709507))
- **angular:** Default morph to PowerPoint's 2s in the duration policy (by @ChristopherVR) ([fcca9aa](https://github.com/ChristopherVR/pptx-viewer/commit/fcca9aa469f17fdc106ce72782f82c7816f6ee31))

### Testing

- **e2e:** Pin that an on-slide hyperlink jump still morphs (by @ChristopherVR) ([5607eeb](https://github.com/ChristopherVR/pptx-viewer/commit/5607eeb5b004b3787c900914257544c86a2dfbcf))

## 2026-07-30

_Releases: pptx-react-viewer@2.6.2, pptx-vue-viewer@2.6.2, pptx-angular-viewer@2.6.2, pptx-vanilla-viewer@1.7.2, pptx-svelte-viewer@2.6.2_

### Bug Fixes

- **shared:** Crossfade a morph pair whose GROUP children changed (by @ChristopherVR) ([7492f26](https://github.com/ChristopherVR/pptx-viewer/commit/7492f26a236659f2c15a99c36a92023f7da6cbbc))

## 2026-07-29

_Releases: pptx-viewer-core@2.0.8, pptx-react-viewer@2.6.1, pptx-vue-viewer@2.6.1, pptx-angular-viewer@2.6.1, pptx-vanilla-viewer@1.7.1, pptx-svelte-viewer@2.6.1_

### Bug Fixes

- **ci:** Reference tsconfig files by path so playwright 1.62 can load them (by @ChristopherVR) ([fae1581](https://github.com/ChristopherVR/pptx-viewer/commit/fae1581e71ba95aa15a66d6dc16fdfae70cc0d73))
- **core:** Keep grouped text at its authored point size (by @ChristopherVR) ([56f676a](https://github.com/ChristopherVR/pptx-viewer/commit/56f676a850a510fa405361d58c849e4a7adb3bea))
- **shared:** Keep authored blank lines and give the bullet its hanging box (by @ChristopherVR) ([0a8de56](https://github.com/ChristopherVR/pptx-viewer/commit/0a8de560f117fdaeb06374e61e49a2cf4e1372b7))
- **shared:** Make morph animate a near-duplicate slide pair (by @ChristopherVR) ([e73ade7](https://github.com/ChristopherVR/pptx-viewer/commit/e73ade737892f3b46a79eb183370a86e3f8b59fe))
- **react:** Restore the text-body inset, blank lines and the AutoSave toggle (by @ChristopherVR) ([d9c53c1](https://github.com/ChristopherVR/pptx-viewer/commit/d9c53c10781f84e6893253e70d57c829d492c010))
- **angular:** Split paragraphs on load, apply text-body insets and blank lines (by @ChristopherVR) ([e73e1ac](https://github.com/ChristopherVR/pptx-viewer/commit/e73e1ac391d22700bb4615a6762190158b91b34f))
- **vue:** Render authored blank lines and drop the bullet spacer (by @ChristopherVR) ([1e4d270](https://github.com/ChristopherVR/pptx-viewer/commit/1e4d2700d8a46568a0e61d2e9a27c38c5c6ffb4b))
- **svelte:** Render authored blank lines and drop the bullet spacer (by @ChristopherVR) ([a964ad1](https://github.com/ChristopherVR/pptx-viewer/commit/a964ad1f4502962e551f0c10ea3c71120473686d))
- **vanilla:** Render authored blank lines and drop the bullet spacer (by @ChristopherVR) ([b85c2c7](https://github.com/ChristopherVR/pptx-viewer/commit/b85c2c7e48b7dcc4388406d410dcdf9fe320e168))

### Testing

- **e2e:** Anchor issue #130 assertions so they hold in every binding (by @ChristopherVR) ([2193ad9](https://github.com/ChristopherVR/pptx-viewer/commit/2193ad95564bf61f44a3a3c26665e1449ec4ed78))
- **e2e:** Cover issue #131 against the reporter's own deck (by @ChristopherVR) ([844faa3](https://github.com/ChristopherVR/pptx-viewer/commit/844faa3a9cade1967283e545e20745d27cb92b61))

## 2026-07-27

_Releases: pptx-viewer-core@2.0.7, pptx-react-viewer@2.6.0, pptx-vue-viewer@2.6.0, pptx-angular-viewer@2.6.0, pptx-vanilla-viewer@1.7.0, pptx-svelte-viewer@2.6.0_

### Features

- **shared:** Morph transition render plan and paragraph strut basis (by @ChristopherVR) ([94cfddd](https://github.com/ChristopherVR/pptx-viewer/commit/94cfddd2afc9ab20f294f6aa08ddf95fff7f5213))

### Bug Fixes

- **core:** Parse morph, fontRef text colour, and unsized bullets correctly (by @ChristopherVR) ([7607996](https://github.com/ChristopherVR/pptx-viewer/commit/7607996123e493ed1f33a6891e444f3b02bb2ed9))
- **react:** Grouped-shape links, paragraph line boxes, exact element boxes, morph (by @ChristopherVR) ([285f284](https://github.com/ChristopherVR/pptx-viewer/commit/285f28426fdf926d0cb22fadd687eb370b704be3))
- **vue:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([99df808](https://github.com/ChristopherVR/pptx-viewer/commit/99df808add09864870fa97db76ce224fa8a8831f))
- **angular:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([09aad03](https://github.com/ChristopherVR/pptx-viewer/commit/09aad031755cb91326d2a8c6d862046775dceb0f))
- **svelte:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([8c44caf](https://github.com/ChristopherVR/pptx-viewer/commit/8c44caf16f755af8ce0ced24bf3ee55d2f50261e))
- **vanilla:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([6f863d6](https://github.com/ChristopherVR/pptx-viewer/commit/6f863d69f9da582afbbcd308b174239056fea477))

### Testing

- **e2e:** Cover issue #130 fidelity against the reporter's own deck (by @ChristopherVR) ([1b0d395](https://github.com/ChristopherVR/pptx-viewer/commit/1b0d3955ce4bdb264686a8c51c7f8162a6e7b7da))

## 2026-07-27

_Releases: pptx-viewer-core@2.0.6, pptx-react-viewer@2.5.3, pptx-vue-viewer@2.5.3, pptx-angular-viewer@2.5.3, pptx-vanilla-viewer@1.6.3, pptx-svelte-viewer@2.5.3_

### Dependencies

- **deps:** Update @lucide/svelte requirement from ^1.26.0 to ^1.27.0 ([#121](https://github.com/ChristopherVR/pptx-viewer/issues/121)) (by @dependabot[bot]) ([eec772a](https://github.com/ChristopherVR/pptx-viewer/commit/eec772ad7a6e06d54306641c48ba93b2877725c3))
- **deps:** Update emf-converter requirement from ^2.0.0 to ^2.0.2 ([#122](https://github.com/ChristopherVR/pptx-viewer/issues/122)) (by @dependabot[bot]) ([423034a](https://github.com/ChristopherVR/pptx-viewer/commit/423034ad1e6d48dbb75be17e1915c917c912517b))
- **deps:** Update html2canvas-pro requirement from ^2.3.1 to ^2.3.2 ([#124](https://github.com/ChristopherVR/pptx-viewer/issues/124)) (by @dependabot[bot]) ([6ad6bce](https://github.com/ChristopherVR/pptx-viewer/commit/6ad6bceecf88670f33e2544dbeb1a98c8b1bf9f6))
- **deps:** Update lucide-react requirement from ^1.26.0 to ^1.27.0 ([#126](https://github.com/ChristopherVR/pptx-viewer/issues/126)) (by @dependabot[bot]) ([d6506f2](https://github.com/ChristopherVR/pptx-viewer/commit/d6506f219082b0605eda712db9c6135f423754e1))
- **deps:** Update @lucide/angular requirement from ^1.26.0 to ^1.27.0 ([#127](https://github.com/ChristopherVR/pptx-viewer/issues/127)) (by @dependabot[bot]) ([08dcd42](https://github.com/ChristopherVR/pptx-viewer/commit/08dcd42eb6f05d44f3374256253f2434d8460e35))

### Chores

- **deps-dev:** Update @angular/build requirement ([#119](https://github.com/ChristopherVR/pptx-viewer/issues/119)) (by @dependabot[bot]) ([f315793](https://github.com/ChristopherVR/pptx-viewer/commit/f31579338b5453cb3d2465373c9910bec6271407))
- **deps-dev:** Update ng-packagr requirement from ^22.0.1 to ^22.0.2 ([#120](https://github.com/ChristopherVR/pptx-viewer/issues/120)) (by @dependabot[bot]) ([5947b3d](https://github.com/ChristopherVR/pptx-viewer/commit/5947b3d292fefa61ce8473fd0744656e16a503e2))
- **deps-dev:** Update rollup requirement from ^4.62.2 to ^4.62.3 ([#125](https://github.com/ChristopherVR/pptx-viewer/issues/125)) (by @dependabot[bot]) ([61a7b66](https://github.com/ChristopherVR/pptx-viewer/commit/61a7b66fa5ff6fd3fd32c531d87d20875c77a28f))
- **deps-dev:** Update lint-staged requirement from ^17.1.1 to ^17.2.0 ([#128](https://github.com/ChristopherVR/pptx-viewer/issues/128)) (by @dependabot[bot]) ([f04238a](https://github.com/ChristopherVR/pptx-viewer/commit/f04238ad6eb10a17f9ae29b4148d5fd2197b33d2))
- **deps-dev:** Update @playwright/test requirement ([#123](https://github.com/ChristopherVR/pptx-viewer/issues/123)) (by @dependabot[bot]) ([1c5f19b](https://github.com/ChristopherVR/pptx-viewer/commit/1c5f19b77352ecd00cdb6603e3f2cb584397457e))

## 2026-07-27

_Releases: pptx-viewer-core@2.0.5, pptx-react-viewer@2.5.2, pptx-vue-viewer@2.5.2, pptx-angular-viewer@2.5.2, pptx-vanilla-viewer@1.6.2, pptx-svelte-viewer@2.5.2, pptx-viewer-mcp@2.0.2, @christophervr/pptx-viewer@1.5.9_

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## 2026-07-26

_Releases: pptx-react-viewer@2.5.1, pptx-vue-viewer@2.5.1, pptx-angular-viewer@2.5.1, pptx-vanilla-viewer@1.6.1, pptx-svelte-viewer@2.5.1_

### Bug Fixes

- **angular:** Draw collaboration presence in slide space (by @ChristopherVR) ([297aa8f](https://github.com/ChristopherVR/pptx-viewer/commit/297aa8ff6e563d1d60d1d83a6f3ec82c7f9245f2))

### Testing

- **e2e:** Cover remote presence geometry in every binding (by @ChristopherVR) ([adb9b3c](https://github.com/ChristopherVR/pptx-viewer/commit/adb9b3c180d3f7fce1bd175dfc0b29d385937a51))

## 2026-07-26

_Releases: pptx-viewer-core@2.0.4, pptx-react-viewer@2.5.0, pptx-vue-viewer@2.5.0, pptx-angular-viewer@2.5.0, pptx-vanilla-viewer@1.6.0, pptx-svelte-viewer@2.5.0_

### Features

- **shared:** Lock the audience display out of edit mode (by @ChristopherVR) ([79dc876](https://github.com/ChristopherVR/pptx-viewer/commit/79dc8768ff599e662c4291861b340c2939001f84))
- **shared:** Seed a slide as fully built, and keep audience input inert (by @ChristopherVR) ([6acdf5e](https://github.com/ChristopherVR/pptx-viewer/commit/6acdf5e02c6d727828433ba067942e72d6547922))

### Bug Fixes

- **core:** Keep the click step's own start conditions (by @ChristopherVR) ([755a4b2](https://github.com/ChristopherVR/pptx-viewer/commit/755a4b2e38dff73c9c460a5318c1fce913880328))
- **shared:** Play a slide's opening build without a click (by @ChristopherVR) ([9d0ecec](https://github.com/ChristopherVR/pptx-viewer/commit/9d0ecec007d1f7ef48ecbd97429b55073352a487))
- **react:** Keep run formatting through a staged text build (by @ChristopherVR) ([e62487f](https://github.com/ChristopherVR/pptx-viewer/commit/e62487fb24f4d67700dac6ee33a2c90a50241857))
- **react:** Never show the editor in an audience display (by @ChristopherVR) ([28d8d04](https://github.com/ChristopherVR/pptx-viewer/commit/28d8d04c8ae6294b20733431ea34853600cd48e0))
- **vue:** Never show the editor in an audience display (by @ChristopherVR) ([dc1e2ee](https://github.com/ChristopherVR/pptx-viewer/commit/dc1e2ee6a1505c8505d28d196488fe140951c4ff))
- **angular:** Never show the editor in an audience display (by @ChristopherVR) ([b276613](https://github.com/ChristopherVR/pptx-viewer/commit/b276613b3bed09f1a1dc324c0aca1ead406fd247))
- **svelte:** Never show the editor in an audience display (by @ChristopherVR) ([4b2c39b](https://github.com/ChristopherVR/pptx-viewer/commit/4b2c39b30e5382b20d9033c1b03524cd8ea712a7))
- **vanilla:** Auto-play the opening build and lock the audience display (by @ChristopherVR) ([e8dcf41](https://github.com/ChristopherVR/pptx-viewer/commit/e8dcf4133243609653006dff6d51d41c6a899a75))
- **core:** Paint useBgFill shapes with the slide background (by @ChristopherVR) ([f819817](https://github.com/ChristopherVR/pptx-viewer/commit/f81981744c637368d1ef0d87b1ba884e634c938a))
- **shared:** Ripple a by-paragraph build that also iterates (by @ChristopherVR) ([73238d5](https://github.com/ChristopherVR/pptx-viewer/commit/73238d590217f8c61e86c9f065d19436dd6b699b))
- **react:** Finish the show, hold back on a back step, ignore audience input (by @ChristopherVR) ([6a0f0ca](https://github.com/ChristopherVR/pptx-viewer/commit/6a0f0ca9de2444166d4e4c0a2143c32ccc7e3982))
- **vue:** Hold back on a back step, ignore audience input (by @ChristopherVR) ([45c82cf](https://github.com/ChristopherVR/pptx-viewer/commit/45c82cf28df3413dd90d5bc3533bbd8ada95af6d))
- **angular:** Hold back on a back step, ignore audience input (by @ChristopherVR) ([291524c](https://github.com/ChristopherVR/pptx-viewer/commit/291524c5f8876314db78eab4c0c9df33786e03c3))
- **svelte:** Hold back on a back step, ignore audience input (by @ChristopherVR) ([4794bbe](https://github.com/ChristopherVR/pptx-viewer/commit/4794bbe26cc319f37b5cee64e26c38a4fb54bd71))
- **vanilla:** Render staged text builds, hold back on a back step (by @ChristopherVR) ([cf2909b](https://github.com/ChristopherVR/pptx-viewer/commit/cf2909b927e0f3f7b6867c29b168303baf365aeb))

### Documentation

- Forbid Claude chat share links in the repo (by @ChristopherVR) ([db4bfa7](https://github.com/ChristopherVR/pptx-viewer/commit/db4bfa715da6ca5aeb53242e325b2faeb82182da))

### Testing

- **e2e:** Cover slide-show fidelity against a real PowerPoint deck (by @ChristopherVR) ([c1b74db](https://github.com/ChristopherVR/pptx-viewer/commit/c1b74dbfccb5ceb4f81267be39b9f68e3ab23998))
- **e2e:** Fail the run on stale dist instead of testing old code (by @ChristopherVR) ([6233f8f](https://github.com/ChristopherVR/pptx-viewer/commit/6233f8f109183285c28766da0aebd2c1bab3d27c))

## 2026-07-25

_Releases: pptx-viewer-core@2.0.3, pptx-react-viewer@2.4.0, pptx-vue-viewer@2.4.0, pptx-angular-viewer@2.4.0, pptx-vanilla-viewer@1.5.0, pptx-svelte-viewer@2.4.0, pptx-viewer-mcp@2.0.1, @christophervr/pptx-viewer@1.5.8_

### Features

- **shared:** Framework-agnostic spec for staged text builds, used by Vue (by @ChristopherVR) ([cf2eabf](https://github.com/ChristopherVR/pptx-viewer/commit/cf2eabfbac6088b13883ba01cc07eb9aee8a27a3))
- **svelte:** Render staged text builds from the shared spec (by @ChristopherVR) ([256e5a0](https://github.com/ChristopherVR/pptx-viewer/commit/256e5a0ddc6cf97b73b5925409e6ff3483adf6c9))
- **angular:** Render staged text builds from the shared spec (by @ChristopherVR) ([d67aed4](https://github.com/ChristopherVR/pptx-viewer/commit/d67aed489fa722b5f9c58e050d406a2bdc23dc0e))
- **vanilla:** Render staged text builds from the shared spec (by @ChristopherVR) ([5551864](https://github.com/ChristopherVR/pptx-viewer/commit/555186453e77565ef9d4592dc03355d56be205c6))

### Bug Fixes

- **core:** Read effect delay and duration from where PowerPoint writes them (by @ChristopherVR) ([44f6529](https://github.com/ChristopherVR/pptx-viewer/commit/44f6529d198bc1c81a57145d95512ee5e9e3aacd))
- **shared:** Animate text by letter, and stop double-counting effect delay (by @ChristopherVR) ([06d0f0f](https://github.com/ChristopherVR/pptx-viewer/commit/06d0f0f9c6566bfff157ab677378cdfc44fcf87e))
- **shared:** Add the missing end-of-slide-show string (by @ChristopherVR) ([6017f70](https://github.com/ChristopherVR/pptx-viewer/commit/6017f704dcae07429643579da98bc0ffbd6534e2))
- **react:** Surface end-of-show in the presenter console, and theme it (by @ChristopherVR) ([7e238ef](https://github.com/ChristopherVR/pptx-viewer/commit/7e238ef329dea25e8160e7c53bfb6c07e7113c60))
- **ci:** Stop the commit check failing on every pull request (by @ChristopherVR) ([9764fbf](https://github.com/ChristopherVR/pptx-viewer/commit/9764fbf4b5caf98400400b213618d73266220e33))
- **ci:** Put --coverage inside each test leg's command (by @ChristopherVR) ([f91ded9](https://github.com/ChristopherVR/pptx-viewer/commit/f91ded94bf8dd251cd96c84c3d967d8990bd9a31))
- Click the slide to advance a show in every binding (by @ChristopherVR) ([a565c7c](https://github.com/ChristopherVR/pptx-viewer/commit/a565c7cd315a1fb5e0703c099a47546e660da4c2))
- Presenter console follows the theme, and vanilla enters the show (by @ChristopherVR) ([1de427b](https://github.com/ChristopherVR/pptx-viewer/commit/1de427b9a8e00c0fa7e19e538eda6fa87e84b32c))
- **svelte:** Patch text-build spans and read the states context at init (by @ChristopherVR) ([8fdbd5f](https://github.com/ChristopherVR/pptx-viewer/commit/8fdbd5fcd4536dd9315b0058b286c4fd850cd584))
- Show the end-of-slide-show screen in every binding (by @ChristopherVR) ([15bfd73](https://github.com/ChristopherVR/pptx-viewer/commit/15bfd7378dca971bd7dea3d9f6ecd3b995d5b6fb))
- **react:** Clear the declaration and bundle build warnings (by @ChristopherVR) ([a594383](https://github.com/ChristopherVR/pptx-viewer/commit/a594383b795b2a028349801191a031b0fd7143a8))
- **build:** Inline internal declarations on windows (by @ChristopherVR) ([51158a3](https://github.com/ChristopherVR/pptx-viewer/commit/51158a3a6ff8d91561632f7e0d43066f013e128a))
- **svelte:** Clear the build warnings and repair windows dts bundling (by @ChristopherVR) ([40c170a](https://github.com/ChristopherVR/pptx-viewer/commit/40c170ae2050f827b71814aa1af1eedd869e32f7))
- **tools:** Keep node:path out of the browser-reachable tool graph (by @ChristopherVR) ([6fb50e3](https://github.com/ChristopherVR/pptx-viewer/commit/6fb50e35f29b796417da23128e8e692edd914507))
- **tools:** Resolve pptx-viewer-core to the workspace copy (by @ChristopherVR) ([1d4e3ff](https://github.com/ChristopherVR/pptx-viewer/commit/1d4e3ff00694d12606245de7726210d675d713f6))
- **react:** Clear the declaration and bundle build warnings (by @ChristopherVR) ([35e7d31](https://github.com/ChristopherVR/pptx-viewer/commit/35e7d31debf9deab91019959520c81dcfa2746ff))

### Refactor

- **shared:** Import PptxHandler statically in collaboration write-back (by @ChristopherVR) ([6430a7a](https://github.com/ChristopherVR/pptx-viewer/commit/6430a7a9fddde61838c1a538fe2c6d1aa705ea60))
- **react:** Import PptxHandler statically in collaboration write-back (by @ChristopherVR) ([6221c63](https://github.com/ChristopherVR/pptx-viewer/commit/6221c631a540520c99f8692dc45b2012e89c3ca6))
- **vue:** Import jszip and fast-xml-parser statically (by @ChristopherVR) ([22b56fa](https://github.com/ChristopherVR/pptx-viewer/commit/22b56fab782f225590430435fb2ddf97e2e003f1))
- **angular:** Import jszip, fast-xml-parser and PptxHandler statically (by @ChristopherVR) ([489280b](https://github.com/ChristopherVR/pptx-viewer/commit/489280bf6ad48d7b335253584855d03556e4b980))

### Build & CI

- Require green CI on PRs and check cross-binding parity (by @ChristopherVR) ([acedb7b](https://github.com/ChristopherVR/pptx-viewer/commit/acedb7bf8a97c7641ed3e70f7538202d1651d103))
- Scope pull-request checks to the packages they can affect (by @ChristopherVR) ([f9480ad](https://github.com/ChristopherVR/pptx-viewer/commit/f9480ad500105b17b74392b923f762f0ecfd081a))
- **demo-angular:** Split vendor chunks and raise the size warning limit (by @ChristopherVR) ([fcbfc71](https://github.com/ChristopherVR/pptx-viewer/commit/fcbfc713989611f4599f0f14ccdbff94fe1fa975))
- **release:** Authenticate git-cliff and survive a raced push (by @ChristopherVR) ([9d9cfcf](https://github.com/ChristopherVR/pptx-viewer/commit/9d9cfcfea3a7b76c6d9042e7350e215b3ccb5d2d))
- **release:** Push the release commit with a bypass-capable token (by @ChristopherVR) ([5af8c88](https://github.com/ChristopherVR/pptx-viewer/commit/5af8c88d75af043802e3aa5ef36b2b4102409114))
- **release:** Revert the release-token push, trim the failure message (by @ChristopherVR) ([d450478](https://github.com/ChristopherVR/pptx-viewer/commit/d45047884c512b215027fe8c33b1f6badce5530b))

### Dependencies

- **deps:** Update @lucide/svelte requirement from ^1.25.0 to ^1.26.0 ([#113](https://github.com/ChristopherVR/pptx-viewer/issues/113)) (by @dependabot[bot]) ([66c656f](https://github.com/ChristopherVR/pptx-viewer/commit/66c656ff50ff7e9cfaf0139dc70ea0944aaf1528))
- **deps:** Update @lucide/angular requirement from ^1.25.0 to ^1.26.0 ([#114](https://github.com/ChristopherVR/pptx-viewer/issues/114)) (by @dependabot[bot]) ([6ece65a](https://github.com/ChristopherVR/pptx-viewer/commit/6ece65a1d73c4deb975b08cf88085f7caf0322b8))
- **deps:** Update lucide requirement from ^1.25.0 to ^1.26.0 ([#111](https://github.com/ChristopherVR/pptx-viewer/issues/111)) (by @dependabot[bot]) ([d145723](https://github.com/ChristopherVR/pptx-viewer/commit/d1457230d11ba90ca91e3af037345b89439a245a))
- **deps:** Update lucide-react requirement from ^1.24.0 to ^1.26.0 ([#110](https://github.com/ChristopherVR/pptx-viewer/issues/110)) (by @dependabot[bot]) ([0698da2](https://github.com/ChristopherVR/pptx-viewer/commit/0698da2f810334a2f8ed4193b5dd8647f64b1741))
- **deps:** Update @ai-sdk/react requirement from ^4.0.38 to ^4.0.40 ([#117](https://github.com/ChristopherVR/pptx-viewer/issues/117)) (by @dependabot[bot]) ([52e3da0](https://github.com/ChristopherVR/pptx-viewer/commit/52e3da0672dd27f8fed58357d07536ae3fc1793a))
- **deps:** Update ai requirement from ^7.0.35 to ^7.0.37 ([#115](https://github.com/ChristopherVR/pptx-viewer/issues/115)) (by @dependabot[bot]) ([71d200d](https://github.com/ChristopherVR/pptx-viewer/commit/71d200d5aa0627c90fb2c8bfc0c50ee4b132a7d8))
- **deps:** Refresh bun.lock for the merged dependency bumps (by @ChristopherVR) ([c925144](https://github.com/ChristopherVR/pptx-viewer/commit/c9251447cfa4a5303ecd9d8333b92d23a99a1d56))

### Chores

- **ci:** Stop dependabot proposing typescript majors (by @ChristopherVR) ([268ea34](https://github.com/ChristopherVR/pptx-viewer/commit/268ea34cb7d336ef7020dc73c8f3b7f2d9ad776a))
- **ci:** Bump the actions group across 1 directory with 3 updates ([#108](https://github.com/ChristopherVR/pptx-viewer/issues/108)) (by @dependabot[bot]) ([01c8e79](https://github.com/ChristopherVR/pptx-viewer/commit/01c8e79f8f2abe1f724432541c8cd670674cdddd))
- **deps-dev:** Update @analogjs/vite-plugin-angular requirement ([#118](https://github.com/ChristopherVR/pptx-viewer/issues/118)) (by @dependabot[bot]) ([cade4fd](https://github.com/ChristopherVR/pptx-viewer/commit/cade4fde76da26268c95bed2f166376670edf14d))
- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))
- **deps-dev:** Update happy-dom requirement from ^20.11.0 to ^20.11.1 ([#116](https://github.com/ChristopherVR/pptx-viewer/issues/116)) (by @dependabot[bot]) ([0a2f499](https://github.com/ChristopherVR/pptx-viewer/commit/0a2f4990ae3caa60de537c9e0ea38ca8d796fd56))

## 2026-07-25

_Releases: pptx-viewer-core@2.0.2, pptx-react-viewer@2.3.0, pptx-vue-viewer@2.3.0, pptx-angular-viewer@2.3.0, pptx-vanilla-viewer@1.4.0, pptx-svelte-viewer@2.3.0_

### Features

- **shared:** Rule for advancing a show from the presenter slide pane (by @ChristopherVR) ([ee2d0f5](https://github.com/ChristopherVR/pptx-viewer/commit/ee2d0f584dd042eeee89c57ec3c33335208bde28))

### Bug Fixes

- **core:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([eebf128](https://github.com/ChristopherVR/pptx-viewer/commit/eebf128df224247eb06ea1731c9418fcc36189f9))
- **shared:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([406d78b](https://github.com/ChristopherVR/pptx-viewer/commit/406d78b2471ec171fe5cbd8b2ef6abb3216c3c3b))
- **shared:** Parse playFrom media commands in linear time (by @ChristopherVR) ([60820b1](https://github.com/ChristopherVR/pptx-viewer/commit/60820b10ebf641ec2adf6c6d1089fe9f2bc4e490))
- **react:** Rotate table-cell gradient angles into CSS space (by @ChristopherVR) ([17868b9](https://github.com/ChristopherVR/pptx-viewer/commit/17868b92503a2e7bebde852bc4363b716bd9dcd2))
- **react:** Stop the one-frame flash at the start of a transition (by @ChristopherVR) ([65b71cb](https://github.com/ChristopherVR/pptx-viewer/commit/65b71cb6218ec99785a3029df17b4cd564563242))
- **angular:** Rotate gradient angles into CSS space (by @ChristopherVR) ([f756f70](https://github.com/ChristopherVR/pptx-viewer/commit/f756f70c254aebed71eaade41e3a2d07e82daf7c))
- **angular:** Scale the outgoing slide during a transition (by @ChristopherVR) ([fe9a450](https://github.com/ChristopherVR/pptx-viewer/commit/fe9a4501be61de9078ff0b71724cc0c4ac923134))
- **svelte:** Restore double-tap to edit under finger-sized handles (by @ChristopherVR) ([956281e](https://github.com/ChristopherVR/pptx-viewer/commit/956281ec4b6ae6a5174f08e776ebf6a7830a683a))
- Svelte border width for selected element (by @ChristopherVR) ([b1dccd1](https://github.com/ChristopherVR/pptx-viewer/commit/b1dccd192edb7509ed8b59e76a3e638dbef0e3af))
- **core:** Honour a:noFill and stop painting hidden fills/lines (by @ChristopherVR) ([ae13541](https://github.com/ChristopherVR/pptx-viewer/commit/ae1354188b1c5d2bd5843dc36a7c438ba1d83c00))
- **react:** Stop gradient fills washing and streaking the shape (by @ChristopherVR) ([4e52512](https://github.com/ChristopherVR/pptx-viewer/commit/4e525128f11a77860f31f3d993a960dc5ef0c539))
- **react:** Click the presenter slide to advance the show (by @ChristopherVR) ([64e6d86](https://github.com/ChristopherVR/pptx-viewer/commit/64e6d8649e659e4b165372bf244ce33899f54d83))

## 2026-07-24

_Releases: pptx-viewer-core@2.0.1, pptx-react-viewer@2.2.1, pptx-vue-viewer@2.2.2, pptx-angular-viewer@2.2.1, pptx-vanilla-viewer@1.3.1, pptx-svelte-viewer@2.2.1_

### Bug Fixes

- **core:** Preserve native bullets and boundary spaces ([#107](https://github.com/ChristopherVR/pptx-viewer/issues/107)) (by @Leopc1977) ([7ed0971](https://github.com/ChristopherVR/pptx-viewer/commit/7ed09718d2fc439b129ee5ed23c8f5c41fe399ba))
- **vanilla:** Enable touch move/resize of elements on mobile (by @ChristopherVR) ([e51b768](https://github.com/ChristopherVR/pptx-viewer/commit/e51b76812659478c76b8f2d11e692d947985534e))
- **svelte:** Enable touch resize of elements on mobile (by @ChristopherVR) ([6cab6d6](https://github.com/ChristopherVR/pptx-viewer/commit/6cab6d66e8f197d56270cff711c3d9501730c224))

## 2026-07-24

_Releases: pptx-vue-viewer@2.2.1_

### Bug Fixes

- **vue:** Rebuild the mobile bottom bar as React's five-tab nav (by @ChristopherVR) ([5c704ed](https://github.com/ChristopherVR/pptx-viewer/commit/5c704ed201bd58d9855da74c0cc6d3c1c0dc65f3))

## 2026-07-24

_Releases: pptx-react-viewer@2.2.0, pptx-vue-viewer@2.2.0, pptx-angular-viewer@2.2.0, pptx-vanilla-viewer@1.3.0, pptx-svelte-viewer@2.2.0_

### Features

- **shared:** Powerpoint-accurate slide-show keyboard map (by @ChristopherVR) ([fdf55d4](https://github.com/ChristopherVR/pptx-viewer/commit/fdf55d45779e090c36aa994cdc17fae8f01df79b))
- **react:** Follow PowerPoint's slide-show shortcuts and blank screens (by @ChristopherVR) ([7f76ee2](https://github.com/ChristopherVR/pptx-viewer/commit/7f76ee23b8be446eb73fdcd5c598172db5ce3cac))
- **vue:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([4ff2da9](https://github.com/ChristopherVR/pptx-viewer/commit/4ff2da98c0e58cb4edbc2ef60cacc2ffc71ede20))
- **angular:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([fc363a8](https://github.com/ChristopherVR/pptx-viewer/commit/fc363a8406fb749caa81a6e4b3e23609b83cdfbe))
- **vanilla:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([629903c](https://github.com/ChristopherVR/pptx-viewer/commit/629903c8c1ecab33e5dde40ffef42a88e8bde94e))
- **svelte:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([7d349f3](https://github.com/ChristopherVR/pptx-viewer/commit/7d349f3d17170ef8603267e6d821585083d6da8a))
- **react:** Give the slide-show menu PowerPoint's full command set (by @ChristopherVR) ([33c826d](https://github.com/ChristopherVR/pptx-viewer/commit/33c826d887c69e5103b0f0148e9ee1b1c17b16b0))
- **locales:** Translate the new slide-show menu commands (by @ChristopherVR) ([21952d7](https://github.com/ChristopherVR/pptx-viewer/commit/21952d7b7e948724bebe91fd46466861b78dffbd))

### Bug Fixes

- **react:** Present the slide show on its own full-bleed stage (by @ChristopherVR) ([f1b23d0](https://github.com/ChristopherVR/pptx-viewer/commit/f1b23d0dde9e4c17eb424133a217ba8fd09e1c72))
- **react:** Stop the presenter console collapsing the current slide (by @ChristopherVR) ([ca48bc5](https://github.com/ChristopherVR/pptx-viewer/commit/ca48bc526bfe17e32fe467f194f556a2d0b56f0f))

### Documentation

- Explain how the demos resolve packages (by @ChristopherVR) ([ef22968](https://github.com/ChristopherVR/pptx-viewer/commit/ef22968e8a214ce10b8e2495835dc6f699297186))

### Testing

- **e2e:** Cover slide-show sizing and PowerPoint navigation keys (by @ChristopherVR) ([ba6e73f](https://github.com/ChristopherVR/pptx-viewer/commit/ba6e73f3c22e4e2f27247fb10b91f5aa0feb4209))

## 2026-07-23

_Releases: pptx-angular-viewer@2.1.1, pptx-vanilla-viewer@1.2.1_

### Refactor

- **vanilla:** Extract the collab controller's public types (by @ChristopherVR) ([9c06b9c](https://github.com/ChristopherVR/pptx-viewer/commit/9c06b9cfebfe33fcab7047e7cbe918152a164a75))
- **angular:** Split the collaboration service into focused modules (by @ChristopherVR) ([b8d06ec](https://github.com/ChristopherVR/pptx-viewer/commit/b8d06ec6d3ee793669c658e8278c1a8bfad26910))

### Build & CI

- **release:** Refresh bun.lock in the release commit so it stops drifting (by @ChristopherVR) ([5a9363b](https://github.com/ChristopherVR/pptx-viewer/commit/5a9363bee02607b98213dd85dbbc8374409b32eb))

### Chores

- Refresh bun.lock to match committed package versions (by @ChristopherVR) ([5aeeba6](https://github.com/ChristopherVR/pptx-viewer/commit/5aeeba685b67fa78bb3043f9b1784053a31573b1))

## 2026-07-23

_Releases: pptx-react-viewer@2.1.0, pptx-vue-viewer@2.1.0, pptx-angular-viewer@2.1.0, pptx-vanilla-viewer@1.2.0, pptx-svelte-viewer@2.1.0, @christophervr/pptx-viewer@1.5.7_

### Features

- **react:** Support React 18 alongside React 19 (by @ChristopherVR) ([21bc383](https://github.com/ChristopherVR/pptx-viewer/commit/21bc383f1d7b57541eb1b844cba1e5dfc5d8280c))
- **angular:** Widen the peer range to Angular 19-22 (by @ChristopherVR) ([825e5f1](https://github.com/ChristopherVR/pptx-viewer/commit/825e5f1a6df52c50a0dfaef2bb457b474f810bcf))
- **shared:** Live-patch channel for interim collaboration state (by @ChristopherVR) ([efdcc1e](https://github.com/ChristopherVR/pptx-viewer/commit/efdcc1e13ef824f6b26f3c92ba199e0da732b164))
- **shared:** Make a departing collaborator actually leave the room (by @ChristopherVR) ([6af3d8c](https://github.com/ChristopherVR/pptx-viewer/commit/6af3d8ce9933946a5420f1a21c8de55cf7da3548))

### Bug Fixes

- **cli:** Accept every framework major the viewer packages support (by @ChristopherVR) ([fb00075](https://github.com/ChristopherVR/pptx-viewer/commit/fb000758169a74ad15de48344c458e54b3d8ccde))
- **vue:** Render the mobile bottom bar with lucide icons (by @ChristopherVR) ([341cdb4](https://github.com/ChristopherVR/pptx-viewer/commit/341cdb4df8ea56655c738b187c4d716bd91da533))
- **angular:** Theme the mobile chrome and match React's mobile controls (by @ChristopherVR) ([3d0f567](https://github.com/ChristopherVR/pptx-viewer/commit/3d0f5670b9a09bd4a7a15ca14dbebda895d886c2))
- **vue:** Draw toolbar and backstage icons with lucide (by @ChristopherVR) ([0ca967a](https://github.com/ChristopherVR/pptx-viewer/commit/0ca967a6209b22574f4b1d6643d8a3f1570ed738))
- **vue:** Draw presentation-mode icons with lucide (by @ChristopherVR) ([a6cf141](https://github.com/ChristopherVR/pptx-viewer/commit/a6cf141dee00055271d8c50eb06abaf215b1a26a))
- **vue:** Draw panel and inspector icons with lucide (by @ChristopherVR) ([860a057](https://github.com/ChristopherVR/pptx-viewer/commit/860a057f7f1ec9c5880d01647d895238eb8736b2))
- **react:** Publish drag/resize and typing to peers before commit (by @ChristopherVR) ([bbecc2b](https://github.com/ChristopherVR/pptx-viewer/commit/bbecc2ba1731d5bc3324e44362983a9f817c9aeb))
- **vue:** Publish inline-editor typing to peers before commit (by @ChristopherVR) ([4aafe84](https://github.com/ChristopherVR/pptx-viewer/commit/4aafe84f1b3c6ecd24c83922258bb0a7a900f525))
- **angular:** Publish inline-editor typing to peers before commit (by @ChristopherVR) ([f882c12](https://github.com/ChristopherVR/pptx-viewer/commit/f882c126dfd5992bd85769622289f277d499e401))
- **svelte:** Publish inline-editor typing to peers before commit (by @ChristopherVR) ([ad63f5b](https://github.com/ChristopherVR/pptx-viewer/commit/ad63f5b3e1d4fc8cb5e7662fd74745fea66890c3))
- **vanilla:** Publish inline-editor typing to peers before commit (by @ChristopherVR) ([ab2875c](https://github.com/ChristopherVR/pptx-viewer/commit/ab2875c60047bbd94dad44eea5274f3cd80cb7bc))
- **svelte:** Draw chrome icons with lucide, not text glyphs (by @ChristopherVR) ([8df0a37](https://github.com/ChristopherVR/pptx-viewer/commit/8df0a3700263bd49aa7049bdac512f6a0d7feb76))
- **svelte:** Stack the follow bar above the mobile bottom bar (by @ChristopherVR) ([7f2140f](https://github.com/ChristopherVR/pptx-viewer/commit/7f2140fc1d7e07b9e118ef1acf5bc6140c0d8160))
- **svelte:** Anchor the follow bar top-centre and trim the collab controller (by @ChristopherVR) ([daade43](https://github.com/ChristopherVR/pptx-viewer/commit/daade4365205ff147229cc311bbb260e9ae1da9e))
- **react:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([3388c9c](https://github.com/ChristopherVR/pptx-viewer/commit/3388c9c9050d49d3e17515c522f7a66026da3c11))
- **vue:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([aa12464](https://github.com/ChristopherVR/pptx-viewer/commit/aa12464f629f73073370376e25d460c3846b408f))
- **angular:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([44f6b5a](https://github.com/ChristopherVR/pptx-viewer/commit/44f6b5af01bc321a2bfe69995c52ea2851d737ea))
- **svelte:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([17bd9f1](https://github.com/ChristopherVR/pptx-viewer/commit/17bd9f16ac2b30aeb0ec3eae216720613df61e7e))
- **vanilla:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([e10b2f9](https://github.com/ChristopherVR/pptx-viewer/commit/e10b2f93e07ddd2cf64dff25d23ecec0238f28c6))

### Other

- Angular mobile chrome theming + React-matching Present/Share controls (by @ChristopherVR) ([80bd854](https://github.com/ChristopherVR/pptx-viewer/commit/80bd85484854cce5deabb6cdfafe381feca90498))
- Vue icon-parity sweep (glyphs to lucide-vue-next) (by @ChristopherVR) ([577b1c5](https://github.com/ChristopherVR/pptx-viewer/commit/577b1c51f0baa4b6573ec7ca22ff5ce3c17eb851))
- Live collaboration preview for drag/resize geometry and inline typing (by @ChristopherVR) ([26a7069](https://github.com/ChristopherVR/pptx-viewer/commit/26a706931be405a8605138a756f7e3c84622f0ca))
- Svelte lucide icon sweep + follow bar clears the mobile bottom bar (by @ChristopherVR) ([8b99577](https://github.com/ChristopherVR/pptx-viewer/commit/8b995771af93eb90ab2b0ab03e29dd0314514a09))
- Peers leave the room synchronously on frame teardown (no ghost collaborators) (by @ChristopherVR) ([ae9acad](https://github.com/ChristopherVR/pptx-viewer/commit/ae9acad9cfe65ee8dfa6a9676152b6c1abab5b0f))

### Refactor

- **shared:** Split the live-patch module and escape its NUL key separator (by @ChristopherVR) ([6362b22](https://github.com/ChristopherVR/pptx-viewer/commit/6362b22135da6b7503113799f2631f8085ea49c5))
- **svelte:** Lift the collab controller's effects into their own module (by @ChristopherVR) ([b3b9acd](https://github.com/ChristopherVR/pptx-viewer/commit/b3b9acd4b10e1e65e0dcc0040cfe37788b27ce82))

### Documentation

- State the supported React and Angular version windows (by @ChristopherVR) ([ad8937e](https://github.com/ChristopherVR/pptx-viewer/commit/ad8937eacbfaa3dfc66cdc8dd491740ac9a02d29))
- **landing:** Signal a live-demo pane's exit before destroying it (by @ChristopherVR) ([688676c](https://github.com/ChristopherVR/pptx-viewer/commit/688676c556aaf057880cee2efb5d8edd2e5f22e7))

### Build & CI

- Add a React 18 leg to the test matrix (by @ChristopherVR) ([124b30c](https://github.com/ChristopherVR/pptx-viewer/commit/124b30c07d97568773e60636abbf8ae2e77ef40c))

### Chores

- **demos:** Drop the AI provider form from the landing screens (by @ChristopherVR) ([ed9b239](https://github.com/ChristopherVR/pptx-viewer/commit/ed9b239ac7e6eb5386ed3042d8487b2329c6a9a3))

## 2026-07-23

_Releases: pptx-vue-viewer@2.0.1, pptx-angular-viewer@2.0.1, pptx-vanilla-viewer@1.1.0, pptx-svelte-viewer@2.0.0_

### Features

- **svelte:** Render remote selection highlights for collaborators (by @ChristopherVR) ([33adfbd](https://github.com/ChristopherVR/pptx-viewer/commit/33adfbda8bb56faed1069f264d1b4a2e516f17b9))
- **vanilla:** Remote selection highlights; fix mobile notes strip + follow bar (by @ChristopherVR) ([c4ac6f8](https://github.com/ChristopherVR/pptx-viewer/commit/c4ac6f850d607cfda3461cabe33ad3eff497a6d8))

### Bug Fixes

- **vue:** Stop double-applying zoom to remote cursor/selection overlays (by @ChristopherVR) ([1ca4e67](https://github.com/ChristopherVR/pptx-viewer/commit/1ca4e6773766b2506b7614b2b853689ece0d2b62))
- **svelte:** Export view components via typed constants to unbreak dts bundling (by @ChristopherVR) ([7de1bf2](https://github.com/ChristopherVR/pptx-viewer/commit/7de1bf2cd93cb6764e97d57e5ebacab3bba83b18))
- **angular:** Reentrancy-safe collab connect, overlay mobile inspector, mobile share (by @ChristopherVR) ([cb26ab2](https://github.com/ChristopherVR/pptx-viewer/commit/cb26ab2b7630d7448587dfbd694c83181ebe3017))
- **svelte:** Route PresentationTransitionOverlay through a typed constant (by @ChristopherVR) ([0d42bc1](https://github.com/ChristopherVR/pptx-viewer/commit/0d42bc1ec923ed1862b5a2a31a9cf7fdea134a81))

### Build & CI

- **docs:** Fail loudly when a demo is skipped from the Pages bundle (by @ChristopherVR) ([dff03e1](https://github.com/ChristopherVR/pptx-viewer/commit/dff03e18463f85b0b8694afd1c968521d5f6c62c))

## 2026-07-23

_Releases: pptx-viewer-core@2.0.0, pptx-react-viewer@2.0.0, pptx-vue-viewer@2.0.0, pptx-angular-viewer@2.0.0, pptx-vanilla-viewer@1.0.0, pptx-viewer-mcp@2.0.0, @christophervr/pptx-viewer@1.5.6_

### Features

- **react:** Rename hooks-unstable subpath to internals (by @ChristopherVR) ([03fc39c](https://github.com/ChristopherVR/pptx-viewer/commit/03fc39c574a3a411f9b28b62d3a79f2699ad839e))
- **shared:** BuildPreviewElements preview composition helper (by @ChristopherVR) ([0d6d1b3](https://github.com/ChristopherVR/pptx-viewer/commit/0d6d1b3e1f58a7f30d377ad48655459ab7d37999))
- **vue:** Rename unstable subpath to internals and unify collab API (by @ChristopherVR) ([8bcf4e7](https://github.com/ChristopherVR/pptx-viewer/commit/8bcf4e7dbea249b98a746f857830f1243a8bcdb6))
- **shared:** Ai config, loader and bridge contracts (by @ChristopherVR) ([1c40e28](https://github.com/ChristopherVR/pptx-viewer/commit/1c40e28b1661895e2993b01c11bea6262459cb88))
- **angular:** Move internal building blocks off the package root (by @ChristopherVR) ([fd64790](https://github.com/ChristopherVR/pptx-viewer/commit/fd64790ac37070e751e873b831c66e8de9bce90b))
- **shared:** Ai tool schemas, proposal store and deck context (by @ChristopherVR) ([d1d6d60](https://github.com/ChristopherVR/pptx-viewer/commit/d1d6d60e3ff6e4fda8b27290ab31d32ee348e3f1))
- **core:** Drop deprecated presentation print aliases and signature re-export (by @ChristopherVR) ([9c4cef0](https://github.com/ChristopherVR/pptx-viewer/commit/9c4cef0eb96c496cb677d9b21e8273c328ebcd03))
- **shared:** Add typed print-settings helpers for handout slides-per-page (by @ChristopherVR) ([716dfe8](https://github.com/ChristopherVR/pptx-viewer/commit/716dfe81dc32f7ae8d3245d7374ac8b7a23df98c))
- **shared:** Ai chat session, vanilla adapter and server helpers (by @ChristopherVR) ([9986fcf](https://github.com/ChristopherVR/pptx-viewer/commit/9986fcf6cabc4e0a2cf0bc6c66987847bc1d7e2f))
- **core:** Typed serialization for activex controls (by @ChristopherVR) ([c49670d](https://github.com/ChristopherVR/pptx-viewer/commit/c49670da27e58b606e899c042671677f5d887ac1))
- **core:** Honor adjustments with exact bent-arrow geometry (by @ChristopherVR) ([0c8728a](https://github.com/ChristopherVR/pptx-viewer/commit/0c8728a6564313fc20621ae8230b11c7132ca5f0))
- **shared:** Add ai assistant i18n keys (by @ChristopherVR) ([0d78063](https://github.com/ChristopherVR/pptx-viewer/commit/0d780634e8cab46a41ed8423ad6df95781e16808))
- **vanilla:** Ai bridge over the viewer controller (by @ChristopherVR) ([a031301](https://github.com/ChristopherVR/pptx-viewer/commit/a031301511bfb13762b49a70541fdeb2183dd497))
- **vanilla:** Ai chat panel dom and styles (by @ChristopherVR) ([58473c9](https://github.com/ChristopherVR/pptx-viewer/commit/58473c923be7ec3190ef4b4f43eea929db3fb555))
- **vanilla:** Wire ai config into demo (by @ChristopherVR) ([9ab2c2d](https://github.com/ChristopherVR/pptx-viewer/commit/9ab2c2d16cca553a0164c411c887c8c2cd6723cb))
- **react:** Add ai bridge and chat session hooks (by @ChristopherVR) ([9a153a7](https://github.com/ChristopherVR/pptx-viewer/commit/9a153a752c47c5e2c140bf58de2984682bcc39ee))
- **react:** Add ai chat panel and toolbar toggle (by @ChristopherVR) ([376a17f](https://github.com/ChristopherVR/pptx-viewer/commit/376a17fd6ffb4fa224b980d8fb255e8731a593b9))
- **react:** Wire ai config into the demo (by @ChristopherVR) ([3c23672](https://github.com/ChristopherVR/pptx-viewer/commit/3c23672360bd982deff5696b6698319d73e7480c))
- **shared:** Export ai element-update and panel transcript helpers (by @ChristopherVR) ([15472e3](https://github.com/ChristopherVR/pptx-viewer/commit/15472e3afc8bb8c5ec495aa8b79d4674b7bea31a))
- **locales:** Translate ai assistant strings for fr, es and de (by @ChristopherVR) ([3467221](https://github.com/ChristopherVR/pptx-viewer/commit/3467221ba9ea7cd2e72e35efc87c334d7451e176))
- **core:** Spec-exact curved arrow geometry (by @ChristopherVR) ([903d0a7](https://github.com/ChristopherVR/pptx-viewer/commit/903d0a7fdafa9c29e9e6976ba00fafb025ef9aee))
- **core:** Type chart manual-layout extension list (by @ChristopherVR) ([2f1f5df](https://github.com/ChristopherVR/pptx-viewer/commit/2f1f5df37886d37e3a7c216959ec78a3cc8f9f7b))
- **angular:** Ai bridge and chat service (by @ChristopherVR) ([90bf211](https://github.com/ChristopherVR/pptx-viewer/commit/90bf2113493e4c31aee55acaf775c49cd29e7bdb))
- **angular:** Ai chat panel and toolbar toggle (by @ChristopherVR) ([23ddf25](https://github.com/ChristopherVR/pptx-viewer/commit/23ddf25373e40024fb27b3aec78103a5e9badc4b))
- **angular:** Wire ai config into demo (by @ChristopherVR) ([4fd50e7](https://github.com/ChristopherVR/pptx-viewer/commit/4fd50e7aba0f3f32f93e461309cbce48bfb4977f))
- **vue:** Ai bridge and chat session composables (by @ChristopherVR) ([7143ee7](https://github.com/ChristopherVR/pptx-viewer/commit/7143ee767e90acb15813802aecb29afb413bf096))
- **vue:** Ai chat panel and toolbar toggle (by @ChristopherVR) ([c711d57](https://github.com/ChristopherVR/pptx-viewer/commit/c711d57593d355ffdb556d9201a717367e72bc87))
- **vue:** Ai bridge and chat session composables (by @ChristopherVR) ([0f5cfd3](https://github.com/ChristopherVR/pptx-viewer/commit/0f5cfd3b35df3ef90cc5057b268a7f70dd44ab9f))
- **vue:** Wire ai config into demo (by @ChristopherVR) ([27290e0](https://github.com/ChristopherVR/pptx-viewer/commit/27290e0cfd28b63b9044e650176c7c4258afbb06))
- **svelte:** Ai chat panel and toolbar toggle (by @ChristopherVR) ([a569bee](https://github.com/ChristopherVR/pptx-viewer/commit/a569bee394738190d09abfeb785b5f3427ac85f0))
- **svelte:** Wire ai config into demo (by @ChristopherVR) ([cbd34df](https://github.com/ChristopherVR/pptx-viewer/commit/cbd34df0b930947335769ccb156edfc5d8d9234d))
- **shared:** Indexeddb-first ai chat history store (by @ChristopherVR) ([88920f2](https://github.com/ChristopherVR/pptx-viewer/commit/88920f20eb00e72b84efa9ef2cb500dfd6d20db4))
- **shared:** Focused-target context for the ai assistant (by @ChristopherVR) ([530e8d6](https://github.com/ChristopherVR/pptx-viewer/commit/530e8d6b7e2a98dc8442dc07fbc650fae1d1b507))
- **shared:** Table-merge helper and merge_tables ai tool (by @ChristopherVR) ([2e4098d](https://github.com/ChristopherVR/pptx-viewer/commit/2e4098d5d3e027d75f35be6197e88e182f4c2704))
- **shared:** Apply AI theme edits immediately with undo snapshot (by @ChristopherVR) ([a02893b](https://github.com/ChristopherVR/pptx-viewer/commit/a02893b8108dbaebaaa7520c53d0cccaba436e10))
- **shared:** Add AI assistant round-2 i18n keys (en) (by @ChristopherVR) ([98157c3](https://github.com/ChristopherVR/pptx-viewer/commit/98157c36491f5a60440bfcd324c248475fbac21e))
- **react:** AI assistant round-2 (focus, context, history, merge, fixes) (by @ChristopherVR) ([ae429ff](https://github.com/ChristopherVR/pptx-viewer/commit/ae429ffc6672a13d439aa5a2632becc08c30fe62))
- **shared:** Let the ai insert charts and smartart (by @ChristopherVR) ([e22e595](https://github.com/ChristopherVR/pptx-viewer/commit/e22e595acee83f8a3248b2a7007b7d3f5e768578))
- **react:** Ai settings section with detailed chat log export (by @ChristopherVR) ([713e4ba](https://github.com/ChristopherVR/pptx-viewer/commit/713e4bae8fc484234b90ef890d5779fcbb148914))
- **shared:** Human-friendly ai tool activity labels (by @ChristopherVR) ([ca19c78](https://github.com/ChristopherVR/pptx-viewer/commit/ca19c78fa24ff12aa31bc04adde3a24ed0471a28))
- **react:** Pick-to-focus mode with animated element highlight (by @ChristopherVR) ([ebfc997](https://github.com/ChristopherVR/pptx-viewer/commit/ebfc99786f6b26e05b08f0ab7686beabecfa6200))
- **react:** Friendlier ai proposal and message cards (by @ChristopherVR) ([29dc064](https://github.com/ChristopherVR/pptx-viewer/commit/29dc06402ea879f4d86d41c4227560ba286acd51))
- **locales:** Translate new ai assistant strings for fr, es and de (by @ChristopherVR) ([67c7543](https://github.com/ChristopherVR/pptx-viewer/commit/67c7543232d5bf04bb9ab7cfef358336f77a82b6))
- **svelte:** Friendly AI tool + proposal cards (by @ChristopherVR) ([e869a45](https://github.com/ChristopherVR/pptx-viewer/commit/e869a4501553c439f2b98ff859ba73a2eecea94d))
- **vanilla:** Friendly AI tool-call and proposal cards (by @ChristopherVR) ([a52d119](https://github.com/ChristopherVR/pptx-viewer/commit/a52d1196ce31106bab8b7b9f2eb01a63744a27cd))
- **svelte:** AI pick mode, focus bar, live canvas presence (by @ChristopherVR) ([dbdd8dc](https://github.com/ChristopherVR/pptx-viewer/commit/dbdd8dc37aeac0497a81960c15d20f154d0881cb))
- **svelte:** AI settings chat-log export + transcript persistence (by @ChristopherVR) ([3976231](https://github.com/ChristopherVR/pptx-viewer/commit/39762314d270c3cd6f16080fcc3d2279f04bfbeb))
- **angular:** Friendlier AI tool-call and proposal cards (by @ChristopherVR) ([40b071d](https://github.com/ChristopherVR/pptx-viewer/commit/40b071d2aa4b70c1a34d1fd41270cad922fa8b8f))
- **angular:** AI focus scope, pick mode, live canvas presence (by @ChristopherVR) ([2f81a25](https://github.com/ChristopherVR/pptx-viewer/commit/2f81a2534621eadf2350c09b6c4a28fbd9669001))
- **angular:** AI chat-log export in the Settings dialog (by @ChristopherVR) ([660b672](https://github.com/ChristopherVR/pptx-viewer/commit/660b672b1a697c2ca15fe5162148858ac6e10e64))
- **vanilla:** AI pick mode, live canvas presence, click-to-ask, log export (by @ChristopherVR) ([a678d39](https://github.com/ChristopherVR/pptx-viewer/commit/a678d394cb2f823081b871858a3b1fabfbc9b110))
- **vue:** Friendlier ai activity and proposal cards (by @ChristopherVR) ([89e1f7a](https://github.com/ChristopherVR/pptx-viewer/commit/89e1f7af2f3a4dd36a2c154d41b75609b8fd8dce))
- **vue:** Ai pick mode, canvas highlight and live presence (by @ChristopherVR) ([c830e8a](https://github.com/ChristopherVR/pptx-viewer/commit/c830e8a7ac67b88ef3e63dccb48e05adbf774e49))
- **vue:** Ai click-to-ask context menu entries (by @ChristopherVR) ([8b8e9b5](https://github.com/ChristopherVR/pptx-viewer/commit/8b8e9b5e1969ac5f3b92aace000821fa0d315ba9))
- **vue:** Ai settings chat-log export (by @ChristopherVR) ([09f654d](https://github.com/ChristopherVR/pptx-viewer/commit/09f654d67014a9a9238298ef3c3be7588251402c))
- **vue:** Wire ai focus, picks and canvas presence into viewer (by @ChristopherVR) ([eed7af3](https://github.com/ChristopherVR/pptx-viewer/commit/eed7af3b0935cb6a55e49257186ffd9453cc6114))
- **shared:** Rebuild AI assistant tools on pptx-viewer-mcp (by @ChristopherVR) ([da1c31e](https://github.com/ChristopherVR/pptx-viewer/commit/da1c31ee88c0b60a82628003c8a1b16245f028ed))
- **shared:** Route apply_layout to slides and add deck-data AI seam (by @ChristopherVR) ([d1d9143](https://github.com/ChristopherVR/pptx-viewer/commit/d1d91432b22f56c254d69e3725c9c585d01a149a))
- **react:** Implement the AI getDeckData/applyDeckData bridge seam (by @ChristopherVR) ([6324ee9](https://github.com/ChristopherVR/pptx-viewer/commit/6324ee93376442c5ccbc0ec53f89b8c0f8f63573))
- **svelte:** Implement the AI getDeckData/applyDeckData bridge seam (by @ChristopherVR) ([4e66cf3](https://github.com/ChristopherVR/pptx-viewer/commit/4e66cf3607f1a36e8379e0c5df6978f0d248d8dc))
- **vue:** Implement the AI getDeckData/applyDeckData bridge seam (by @ChristopherVR) ([8670f9e](https://github.com/ChristopherVR/pptx-viewer/commit/8670f9e6f764752fd735f767369fb9aca902326c))
- **angular:** Implement the AI getDeckData/applyDeckData bridge seam (by @ChristopherVR) ([51887b7](https://github.com/ChristopherVR/pptx-viewer/commit/51887b70c2c6a444c027e245cf3f67fbc7334d89))
- **vanilla:** Implement the AI getDeckData/applyDeckData bridge seam (by @ChristopherVR) ([5e00c19](https://github.com/ChristopherVR/pptx-viewer/commit/5e00c199d8c7c1c72bfa15cfb9720cc4f42207fb))
- **shared:** Animate AI edits on the canvas (change animator) (by @ChristopherVR) ([9208cc8](https://github.com/ChristopherVR/pptx-viewer/commit/9208cc881ff215dfa873e70085fb502744445012))
- **vue:** Play the AI change animation on the canvas (by @ChristopherVR) ([aa7b899](https://github.com/ChristopherVR/pptx-viewer/commit/aa7b899f4ca30261dab8f74fd943aff8d19955a8))
- **svelte:** Play the AI change animation on the canvas (by @ChristopherVR) ([6d5b8f2](https://github.com/ChristopherVR/pptx-viewer/commit/6d5b8f2c0240fa4cf9ca8991c36d714819c86f9e))
- **vanilla:** Play the AI change animation on the canvas (by @ChristopherVR) ([97cc0b9](https://github.com/ChristopherVR/pptx-viewer/commit/97cc0b924fd7ba920672904955be631d1fadf28b))
- **angular:** Play the AI change animation on the canvas (by @ChristopherVR) ([02b8c94](https://github.com/ChristopherVR/pptx-viewer/commit/02b8c94179b69d829dd5f0c2ff79881273df094b))
- **shared:** Interpret DiagramML layout for common SmartArt algorithms ([#94](https://github.com/ChristopherVR/pptx-viewer/issues/94)) (by @ChristopherVR) ([cc14c64](https://github.com/ChristopherVR/pptx-viewer/commit/cc14c64b6086f52c592af4ebb35946cbb1f703d0))
- **shared:** Interpret composite/conn/sp/tx SmartArt algorithms with forEach/choose/constr ([#94](https://github.com/ChristopherVR/pptx-viewer/issues/94)) (by @ChristopherVR) ([e7c415a](https://github.com/ChristopherVR/pptx-viewer/commit/e7c415a284ceea58ce1d96edb93b34b0f9eb4287))
- **shared:** Animate p15 cinematic slide transitions (cube, flip, page curl, origami) (by @ChristopherVR) ([bd36b2a](https://github.com/ChristopherVR/pptx-viewer/commit/bd36b2a026dba5e476f94c6bfe83bb107ba2eb11))
- **shared:** Render all-caps, per-paragraph spacing, run props, and script bullet numbering (by @ChristopherVR) ([3b8784a](https://github.com/ChristopherVR/pptx-viewer/commit/3b8784aa7632c450b9ed2ec63a8a323d8812d969))
- **shared:** Render pie-of-pie, 3D chart depth, and pie label leader lines (by @ChristopherVR) ([5714146](https://github.com/ChristopherVR/pptx-viewer/commit/5714146927fac04f00c64b2b1aa7b5a5c42d0822))
- **shared:** Paint effect fill-overlay colour and feather soft edges (by @ChristopherVR) ([f5fefa4](https://github.com/ChristopherVR/pptx-viewer/commit/f5fefa4b3c01d5c6a90b4575b7436d6b76f4c77b))
- **shared:** Apply blip tile-flip and sp3d extrusion/contour colours (by @ChristopherVR) ([2500d7f](https://github.com/ChristopherVR/pptx-viewer/commit/2500d7f5433ea3ff079d5eb84d102fe835949d6a))
- **shared:** Render compound outlines, preset connector dashes/arrows, per-subpath custom geometry (by @ChristopherVR) ([2199391](https://github.com/ChristopherVR/pptx-viewer/commit/2199391e4dc9e03c6cf016db1268d6b05190e4fe))
- **core:** Render table cell3D bevel, style diagonals, fontRef idx, and anchorCtr/horzOverflow (by @ChristopherVR) ([7be772c](https://github.com/ChristopherVR/pptx-viewer/commit/7be772cd07a170835f0944fa3d9576f02112188e))
- **core:** Warn on signature strip, render ActiveX/legacy-VML, parse ink pressure and app.xml fields (by @ChristopherVR) ([282f25f](https://github.com/ChristopherVR/pptx-viewer/commit/282f25f915f93cbe1d61dad603bc275c27a79dbb))
- **vue:** Consume per-paragraph spacing, effect overlays, table diagonals, connector arrow sizing (by @ChristopherVR) ([084bba7](https://github.com/ChristopherVR/pptx-viewer/commit/084bba70d2b99615b9471efb05b565cecc38f494))
- **svelte:** Consume per-paragraph spacing, effect overlays, table diagonals, connector arrow sizing (by @ChristopherVR) ([43da741](https://github.com/ChristopherVR/pptx-viewer/commit/43da74123251d465c7119992a522f27af7dfc6e3))
- **vanilla:** Consume per-paragraph spacing, effect overlays, table diagonals, real connector dashes/arrows (by @ChristopherVR) ([f9a2f08](https://github.com/ChristopherVR/pptx-viewer/commit/f9a2f08f0fb4ff19206f1f28bad8c15fd85478d7))
- **angular:** Consume per-paragraph spacing, effect overlays, table diagonals, connector arrow sizing (by @ChristopherVR) ([eccc873](https://github.com/ChristopherVR/pptx-viewer/commit/eccc87328daedc2af680c414278dfa90943ef75a))
- **react:** Port table cell3D/diagonals/fontRef/anchorCtr to react helpers; wire blur-grow overflow and 3D fill fallback (by @ChristopherVR) ([83711c5](https://github.com/ChristopherVR/pptx-viewer/commit/83711c5859dce808d0339435a234c623a9bd1a52))
- **core:** Load chart c:userShapes overlay and honor dispBlanksAs on line charts (by @ChristopherVR) ([ca2200a](https://github.com/ChristopherVR/pptx-viewer/commit/ca2200adaceedd1596130fda717dff0f4ebf72a0))
- **react:** Render real tab stops (align + leaders) and text-body rotation (by @ChristopherVR) ([e5a4bbb](https://github.com/ChristopherVR/pptx-viewer/commit/e5a4bbb793e04c393cb60baac424480549be5d87))
- **react:** Render per-subpath custom geometry and stroke-only presets (by @ChristopherVR) ([066bfa5](https://github.com/ChristopherVR/pptx-viewer/commit/066bfa5cbebd85535949cf65c10add4073695d01))
- **react:** Paint effect fill-overlay layer and feather soft edges at binding parity (by @ChristopherVR) ([83c8798](https://github.com/ChristopherVR/pptx-viewer/commit/83c8798bfe89240fcf4ed7f370fe07b82c0dcbbb))
- **core:** Upgrade emf-converter to 2.0.0 (breaking) (by @ChristopherVR) ([effa4e5](https://github.com/ChristopherVR/pptx-viewer/commit/effa4e5338b2b01796a3671f505bcb4563de74cc))
- **shared:** Model staged builds and color-animation targets on the timeline state (by @ChristopherVR) ([5ca5d5d](https://github.com/ChristopherVR/pptx-viewer/commit/5ca5d5da2c04624b7413061bf8f22043bc0ec8ef))
- **react:** Recolor SVG fill/stroke under p:animClr via inherit cascade (by @ChristopherVR) ([ddd3272](https://github.com/ChristopherVR/pptx-viewer/commit/ddd327271f589b4c1cdb772558bb18a91fa4cfe7))
- **react:** Play staged chart and SmartArt builds (bldChart/bldDgm/bldOleChart) (by @ChristopherVR) ([258d2de](https://github.com/ChristopherVR/pptx-viewer/commit/258d2de394e74c32eef14100d6faef64f3b54e9b))
- **vue:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) (by @ChristopherVR) ([445f9a4](https://github.com/ChristopherVR/pptx-viewer/commit/445f9a47913f94de9c97a11a8cad38c8d88d56d9))
- **angular:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) (by @ChristopherVR) ([93fe175](https://github.com/ChristopherVR/pptx-viewer/commit/93fe1754bd9b299c15a99c5a75aa9073361bbfe5))
- **svelte:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) (by @ChristopherVR) ([965a59b](https://github.com/ChristopherVR/pptx-viewer/commit/965a59b7a6e66f27084215f2ac078151745eb7e3))
- **vanilla:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) (by @ChristopherVR) ([ff23964](https://github.com/ChristopherVR/pptx-viewer/commit/ff239641167ecb0dec49c34531710faada3a84cd))

### Bug Fixes

- **svelte:** Bring viewer chrome to React parity (by @ChristopherVR) ([b544895](https://github.com/ChristopherVR/pptx-viewer/commit/b544895c36e9f4b547404ed35feea4054b644ddd))
- **react:** Pass table and field context to static thumbnail renderer (by @ChristopherVR) ([1738a02](https://github.com/ChristopherVR/pptx-viewer/commit/1738a02a0d9e351156dfe6f747bf580ba5ce2914))
- **react:** Drop dangling thumbnail-element-renderers barrel export (by @ChristopherVR) ([c1a0383](https://github.com/ChristopherVR/pptx-viewer/commit/c1a0383e82a1dcf21c251dc51d3afd649ba49b0a))
- **angular:** Bring viewer chrome to React parity (by @ChristopherVR) ([373da74](https://github.com/ChristopherVR/pptx-viewer/commit/373da74221785fd7cf2e3c2e6302d761150f6350))
- **vue:** Bring viewer chrome to React parity (by @ChristopherVR) ([a9e1364](https://github.com/ChristopherVR/pptx-viewer/commit/a9e1364933acb04efb02a682635cb796d74efbfb))
- **react:** Edit presentation print settings via typed printProperties (by @ChristopherVR) ([a1a9ed0](https://github.com/ChristopherVR/pptx-viewer/commit/a1a9ed05fcd68cce0d8c4eb5a391e1456224e655))
- **vue:** Edit presentation print settings via typed printProperties (by @ChristopherVR) ([bf45f78](https://github.com/ChristopherVR/pptx-viewer/commit/bf45f78e5be0103252574bdf9e1ffef8edcff5cf))
- **angular:** Edit presentation print settings via typed printProperties (by @ChristopherVR) ([a379b71](https://github.com/ChristopherVR/pptx-viewer/commit/a379b71ac202e50a549f1db54622d5ba46e9bebb))
- **svelte:** Edit presentation print settings via typed printProperties (by @ChristopherVR) ([7b087c9](https://github.com/ChristopherVR/pptx-viewer/commit/7b087c99cfa158c97f1288493c8260653f741be1))
- **vanilla:** Bring viewer chrome to React parity (by @ChristopherVR) ([cdcef34](https://github.com/ChristopherVR/pptx-viewer/commit/cdcef34066a7cd608c52c9d6d4a388f3bdf050da))
- **vanilla:** Edit presentation print settings via typed printProperties (by @ChristopherVR) ([af3605b](https://github.com/ChristopherVR/pptx-viewer/commit/af3605b6553376c180e05c1f1184635b717f8ff8))
- **core:** Update print-properties coverage anchor to renamed test (by @ChristopherVR) ([3018357](https://github.com/ChristopherVR/pptx-viewer/commit/3018357e4f7c997b74cb0e41648c1643c76b2d98))
- **ci:** Populate github release notes with real per-release changes (by @ChristopherVR) ([96ca9f5](https://github.com/ChristopherVR/pptx-viewer/commit/96ca9f50a3aae74110ce0677b9abff19bae85799))
- **shared:** Propagate in-place collab asset swaps to peers (by @ChristopherVR) ([f3138ac](https://github.com/ChristopherVR/pptx-viewer/commit/f3138acd70ddccf9b2f1800b2b8ed1ad8e6d887c))
- **shared:** Add broadcaster auto-follow policy helper (by @ChristopherVR) ([8502485](https://github.com/ChristopherVR/pptx-viewer/commit/8502485f881e473920590de14a13e1fc062c0df5))
- **react:** Keep collab sync alive in backgrounded tabs and on restart (by @ChristopherVR) ([bb2109a](https://github.com/ChristopherVR/pptx-viewer/commit/bb2109a9a400258e0200bcdf5503f40795c6891e))
- **react:** Route broadcaster auto-follow through shared policy (by @ChristopherVR) ([6a4a4cd](https://github.com/ChristopherVR/pptx-viewer/commit/6a4a4cd013f0bd03759dc08157b662f4973c7dad))
- **vue:** Adopt shared doc on late join and gate broadcaster follow (by @ChristopherVR) ([75623c1](https://github.com/ChristopherVR/pptx-viewer/commit/75623c1dbaf3a579b77be4550ca2c29608cd0e17))
- **angular:** Route broadcaster auto-follow through shared policy (by @ChristopherVR) ([83139ce](https://github.com/ChristopherVR/pptx-viewer/commit/83139ce3bab9320521758e37611cd8317c2bdf72))
- **react:** Stop ai theme colour change from hanging the renderer (by @ChristopherVR) ([390b702](https://github.com/ChristopherVR/pptx-viewer/commit/390b702af942448ef1ca8722e2e85e9d601a0aca))
- **shared:** Execute AI tool calls once in model mode (by @ChristopherVR) ([57c8afb](https://github.com/ChristopherVR/pptx-viewer/commit/57c8afb360d2dea1e74a74944bb0e2cbf98f2b99))
- **react:** Show a friendly short label on ai focus chips (by @ChristopherVR) ([f60dfe9](https://github.com/ChristopherVR/pptx-viewer/commit/f60dfe9e2f870a364022de5e521e63024932f4a3))
- **shared:** Drop stale rawXml when merging tables (by @ChristopherVR) ([5553146](https://github.com/ChristopherVR/pptx-viewer/commit/5553146fa1709a98a71740ee52d89748b540cee8))
- **react:** Drive AI live-focus nav from the message stream (by @ChristopherVR) ([a8890c9](https://github.com/ChristopherVR/pptx-viewer/commit/a8890c9ea692931010e945c6a266b12e0dd10f95))
- **ci:** Drop build-failed packages before committing version bumps (by @ChristopherVR) ([c02be55](https://github.com/ChristopherVR/pptx-viewer/commit/c02be55ee42ee509d5882be75768948346a91770))
- **tools:** Make convert_to_markdown browser-safe (lazy node:path) (by @ChristopherVR) ([98790dd](https://github.com/ChristopherVR/pptx-viewer/commit/98790dd102348c0a380ffc957616b0333a8ce1e4))
- **react:** Make the mobile AI panel a bottom sheet, not a full overlay (by @ChristopherVR) ([1b15ddc](https://github.com/ChristopherVR/pptx-viewer/commit/1b15ddc50ac612afcb8950b9fe0545bbe8ce7ad0))
- **vue:** Make the mobile AI panel a bottom sheet, not a full overlay (by @ChristopherVR) ([1f89071](https://github.com/ChristopherVR/pptx-viewer/commit/1f8907117e45f5a2d3a05782c7a332828ed69096))
- **svelte:** Make the mobile AI panel a bottom sheet, not a full overlay (by @ChristopherVR) ([3194d22](https://github.com/ChristopherVR/pptx-viewer/commit/3194d22bb614d7e29691c00f649483af8d68ea6c))
- **vanilla:** Make the mobile AI panel a bottom sheet instead of squeezing the canvas (by @ChristopherVR) ([8cf2995](https://github.com/ChristopherVR/pptx-viewer/commit/8cf2995dc586a04cf1e4a11369ae06d1df8841a1))
- **angular:** Make the mobile AI panel a bottom sheet, not a full overlay (by @ChristopherVR) ([c819bbe](https://github.com/ChristopherVR/pptx-viewer/commit/c819bbe2458bdca6869041549015058a26415841))
- **react:** Mobile AI entry point, taller AI sheet, responsive File view (by @ChristopherVR) ([cc56d23](https://github.com/ChristopherVR/pptx-viewer/commit/cc56d234f70b3e2d8bc1a72b4e172120bf3a8537))
- **vue:** Mobile AI entry point, taller AI sheet, responsive File view (by @ChristopherVR) ([666bd99](https://github.com/ChristopherVR/pptx-viewer/commit/666bd996b354e663d02c522ef2df31d6d61e13ef))
- **svelte:** Mobile AI entry point, taller AI sheet, responsive File view (by @ChristopherVR) ([8df8c6f](https://github.com/ChristopherVR/pptx-viewer/commit/8df8c6f40a79922669607cee6a3fe7ec8c0041d5))
- **vanilla:** Mobile AI entry point, taller AI sheet, responsive File view (by @ChristopherVR) ([4f29e4e](https://github.com/ChristopherVR/pptx-viewer/commit/4f29e4e59a307167b62f49c6b0e5ba2f04dceb4c))
- **angular:** Mobile AI entry point, taller AI sheet, responsive File view (by @ChristopherVR) ([e9aaecd](https://github.com/ChristopherVR/pptx-viewer/commit/e9aaecdeb5824fef68d83d366c2599a245c2eb16))
- **core:** Reconcile Split/RandomBars animation preset ids to spec (#99, #81) (by @ChristopherVR) ([110a88e](https://github.com/ChristopherVR/pptx-viewer/commit/110a88ef82f1ebbbf14e234002eaa779c6794a26))
- **shared:** Inherit group fill into a:grpFill children across bindings ([#97](https://github.com/ChristopherVR/pptx-viewer/issues/97)) (by @ChristopherVR) ([454ddf3](https://github.com/ChristopherVR/pptx-viewer/commit/454ddf3a3d4e0836fe2957c83860ba5ad932fd5b))
- **core:** Play p:cmd media commands and evaluate preset avLst formulas ([#98](https://github.com/ChristopherVR/pptx-viewer/issues/98)) (by @ChristopherVR) ([fe6b56b](https://github.com/ChristopherVR/pptx-viewer/commit/fe6b56b2f305fd0a35062aca8d5b6e770f499ec0))
- **shared:** Play unmapped emphasis, curved motion paths, directional effects, valid color-animation CSS (by @ChristopherVR) ([3d1f5b4](https://github.com/ChristopherVR/pptx-viewer/commit/3d1f5b4c7ea7572418f3059b7ec47dd93bfee508))
- **core:** Scale heart preset control points into element space (was a degenerate line) (by @ChristopherVR) ([03d9628](https://github.com/ChristopherVR/pptx-viewer/commit/03d962834419f2b149ef74587438e758b1fa38f6))
- **build:** Restore pptx-viewer-shared/ai vitest alias after main merge (by @ChristopherVR) ([f878be8](https://github.com/ChristopherVR/pptx-viewer/commit/f878be8dc5b4735081690b691ca30bf3b0264559))
- **react:** Surface animClr fill/stroke targets during playback (were dropped after seed) (by @ChristopherVR) ([db0cf72](https://github.com/ChristopherVR/pptx-viewer/commit/db0cf726cad97436eed57a99fcdc6b76c42f629b))
- **svelte:** Route slideshow click/hover to interactive and hover animation triggers (by @ChristopherVR) ([5d09c85](https://github.com/ChristopherVR/pptx-viewer/commit/5d09c854fe7ea49a6bda28f779409b368b4b4968))
- **core:** Parse animClr target attribute from p:attrName text (was dropped by object-only ensureArray) (by @ChristopherVR) ([20a6095](https://github.com/ChristopherVR/pptx-viewer/commit/20a609513dd3073b8c10d3f85a986172a77877d9))
- **e2e:** Re-query the animClr shape inside the poll (Vanilla replaces its wrapper) (by @ChristopherVR) ([e9a970e](https://github.com/ChristopherVR/pptx-viewer/commit/e9a970ef6841220f78274860107c7b7fa4776ccf))

### Other

- Bring animClr / staged-build playback work from main into feature/v2 (by @ChristopherVR) ([2b64b0c](https://github.com/ChristopherVR/pptx-viewer/commit/2b64b0c3780c6e718c9988311ce39559d6d3e99f))
- Bring animClr e2e coverage from main into feature/v2 (by @ChristopherVR) ([4319df2](https://github.com/ChristopherVR/pptx-viewer/commit/4319df2775b2d99fb09d196edee6d50d9dd6ceea))

### Refactor

- **vue:** Remove deprecated CROP_SIDES constant (by @ChristopherVR) ([b9911b1](https://github.com/ChristopherVR/pptx-viewer/commit/b9911b1de96e15794ea47767c1b936be257409ff))
- **tools:** Remove deprecated runMutatingTool alias (by @ChristopherVR) ([3db1d50](https://github.com/ChristopherVR/pptx-viewer/commit/3db1d5080772a99972261817cb98c2b371f2128d))
- **shared:** Extract audience-content-store from bindings (by @ChristopherVR) ([aec2bb7](https://github.com/ChristopherVR/pptx-viewer/commit/aec2bb7928a516d3cf7aa407b329e0c542e1dd40))
- **shared:** Extract theme-gallery presets from vue/angular (by @ChristopherVR) ([2011839](https://github.com/ChristopherVR/pptx-viewer/commit/2011839bc3a54e8356eec861cc3188d0e1e4f2cf))
- **shared:** Extract eyedropper colour sampler from bindings (by @ChristopherVR) ([a19009d](https://github.com/ChristopherVR/pptx-viewer/commit/a19009da338a3d5311de19b9524cf5728cbf9568))
- **shared:** Extract share-form helpers from bindings (by @ChristopherVR) ([a014e42](https://github.com/ChristopherVR/pptx-viewer/commit/a014e427130292584e4a1e6976560bf7dbd10d4d))
- **shared:** Extract framework-agnostic PresentationAnimationController; React consumes it (by @ChristopherVR) ([5133861](https://github.com/ChristopherVR/pptx-viewer/commit/5133861233792ecabc6f7affb47f61d33c1018c2))

### Documentation

- **svelte:** Graduate smartArt3D prop from experimental to stable (by @ChristopherVR) ([6d47eb9](https://github.com/ChristopherVR/pptx-viewer/commit/6d47eb992c42e1a16279983e5846db321a0df10a))
- Adopt stable-vs-internals contract and internals subpath naming (by @ChristopherVR) ([8f17e8b](https://github.com/ChristopherVR/pptx-viewer/commit/8f17e8b3cd5f2980abe41ea5b6690cff1d5b1587))
- Add AI assistant guide (by @ChristopherVR) ([a6239fb](https://github.com/ChristopherVR/pptx-viewer/commit/a6239fbac8b68b3d6f769fffda2ba1c95172a46b))
- Friendly 2.0.0 changelog for root and packages (by @ChristopherVR) ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))
- Note cinematic transitions, sp3d, reflection, soft-edge, and warp render approximations (by @ChristopherVR) ([affe3ba](https://github.com/ChristopherVR/pptx-viewer/commit/affe3ba33d636b6fc60290cf7d7478b35ea68c44))
- **changelog:** Fold full change list into the 2.0.0 release notes (by @ChristopherVR) ([f26e2d6](https://github.com/ChristopherVR/pptx-viewer/commit/f26e2d6a78ace4ddf4583c17fa70cd1a16ee6e9c))

### Testing

- **react:** Verify thumbnail renders layout-inherited colour + content (by @ChristopherVR) ([49bf023](https://github.com/ChristopherVR/pptx-viewer/commit/49bf023e232ff7fb9bd3a09a2afe58f2e663fb0a))
- **shared:** Ai config, proposals, registry, context and vanilla chat (by @ChristopherVR) ([9895aca](https://github.com/ChristopherVR/pptx-viewer/commit/9895aca9e7942a55c665915aebd910a30b47b21b))
- **vanilla:** Ai panel gating and proposals (by @ChristopherVR) ([f7613fd](https://github.com/ChristopherVR/pptx-viewer/commit/f7613fdca28b0cb84c7ddaeb96e49dc27a49b3e8))
- **react:** Ai panel gating and proposals (by @ChristopherVR) ([59e35e0](https://github.com/ChristopherVR/pptx-viewer/commit/59e35e082cfed944f756a5d2fb74c593e0592da4))
- **angular:** Ai panel gating and proposals (by @ChristopherVR) ([60c078f](https://github.com/ChristopherVR/pptx-viewer/commit/60c078fc2290549974eb5feed6c0b0c44ea32830))
- **vue:** Ai panel gating and proposals (by @ChristopherVR) ([5e69d09](https://github.com/ChristopherVR/pptx-viewer/commit/5e69d09a9f0e5fd47c82d6ec7df7a92a13920035))
- **svelte:** Ai panel gating and proposals (by @ChristopherVR) ([8f329d2](https://github.com/ChristopherVR/pptx-viewer/commit/8f329d2dc7006caea77f4f23d9aaa84256365d31))
- **shared:** End-to-end ai tool-call to proposal flow (by @ChristopherVR) ([578277d](https://github.com/ChristopherVR/pptx-viewer/commit/578277df7b7b9a48bd682e4dc86bc136244dcc19))
- **react:** Ai panel proposal accept mutates the deck (by @ChristopherVR) ([0cfa627](https://github.com/ChristopherVR/pptx-viewer/commit/0cfa627d5bc250ac8228b6ebba10e95d10db6099))
- **shared:** Opt-in live gpt-4o-mini ai integration test (by @ChristopherVR) ([48622f1](https://github.com/ChristopherVR/pptx-viewer/commit/48622f135a5f2ee4c28d97d08478d3c203745f47))
- **shared:** Live table-merge via gpt-4o-mini (by @ChristopherVR) ([f323c9b](https://github.com/ChristopherVR/pptx-viewer/commit/f323c9bb18e84396616e1c8467eb4b72aea66da1))
- **shared:** Guard shape clip-path helpers against render loops (by @ChristopherVR) ([4e5fb4c](https://github.com/ChristopherVR/pptx-viewer/commit/4e5fb4c3f2810a22abdae1f5b351a977b86e3db0))
- **react:** Guard sample-deck shape/table render termination (by @ChristopherVR) ([dde980d](https://github.com/ChristopherVR/pptx-viewer/commit/dde980da1473ff236cd4b7e11f9b617246fa4d3f))
- **react:** Guard merge_tables renders 10 rows for real tables (by @ChristopherVR) ([3503ece](https://github.com/ChristopherVR/pptx-viewer/commit/3503ecee0386824b7df5cfe9406779a16ee26d7d))
- **vue:** Align proposal card test with friendlier labels (by @ChristopherVR) ([15c807b](https://github.com/ChristopherVR/pptx-viewer/commit/15c807b36fd9e214cc15296f331ff759566d5bd6))
- **svelte:** Stub anchor click in AI log-export test (by @ChristopherVR) ([b999401](https://github.com/ChristopherVR/pptx-viewer/commit/b99940189443b71fd43934803045c0e4d2bb0a76))
- **vanilla:** Align AI tool fixtures with MCP-backed tool names (by @ChristopherVR) ([ee028a6](https://github.com/ChristopherVR/pptx-viewer/commit/ee028a6ab85f9da962baaff5c95f12849db45df3))
- **svelte:** Align AI tool fixtures with MCP-backed tool names (by @ChristopherVR) ([5971e19](https://github.com/ChristopherVR/pptx-viewer/commit/5971e19ff3333cf6cb05e054325ca721bd477706))
- **vue:** Align AI tool fixtures with MCP-backed tool names (by @ChristopherVR) ([066dbc3](https://github.com/ChristopherVR/pptx-viewer/commit/066dbc36152f2fad677e80cb278b1d181ed6ebbf))
- **angular:** Align AI tool fixtures with MCP-backed tool names (by @ChristopherVR) ([834e598](https://github.com/ChristopherVR/pptx-viewer/commit/834e598e54ae8ce0d54091ea2bfba7958c442d00))
- **react:** Align AI tool fixtures with MCP-backed tool names (by @ChristopherVR) ([a41be75](https://github.com/ChristopherVR/pptx-viewer/commit/a41be7585e0533f33af18d985bdc0867bbab0ca0))
- **core:** Cover chart userShapes parser and blank-display resolution (by @ChristopherVR) ([e9df1b3](https://github.com/ChristopherVR/pptx-viewer/commit/e9df1b3ea3610fb0d6dac7d7a9bd762b936cf5f5))
- **e2e:** Verify staged builds + animClr playback across all five bindings (by @ChristopherVR) ([788d3e3](https://github.com/ChristopherVR/pptx-viewer/commit/788d3e3cadd23c866202aa54d19bbef448153352))
- **react:** Terminate the scripted transport after the first turn (by @ChristopherVR) ([d30b87b](https://github.com/ChristopherVR/pptx-viewer/commit/d30b87bbc128adf337f34fd46b24a23de363d867))

### Build & CI

- **shared:** Keep the ai SDK external across bindings (by @ChristopherVR) ([fa5e6b7](https://github.com/ChristopherVR/pptx-viewer/commit/fa5e6b77e6586764d9e7717439f574291810e93b))
- Pin Vue/Angular/Svelte to exact TypeScript 6.0.3 (by @ChristopherVR) ([3d80082](https://github.com/ChristopherVR/pptx-viewer/commit/3d8008282231e1ee4bc11300757d1cc35e8dc174))

### Styling

- **shared:** Trim ai schemas to the per-file size budget (by @ChristopherVR) ([9346eda](https://github.com/ChristopherVR/pptx-viewer/commit/9346eda8f28de702fd87165610ec38d94eaa4052))

### Dependencies

- **deps:** Lock pptx-viewer-mcp and zod for the AI tool layer (by @ChristopherVR) ([6e805d2](https://github.com/ChristopherVR/pptx-viewer/commit/6e805d2a09159cab279c76998af16d91279bb43f))
- **deps:** Sync lockfile after main merge (by @ChristopherVR) ([a537528](https://github.com/ChristopherVR/pptx-viewer/commit/a5375280297ad45fc9d21fda528b6d330072bf45))
- **deps:** Update dependencies to latest (by @ChristopherVR) ([bea8494](https://github.com/ChristopherVR/pptx-viewer/commit/bea8494ab7210838c5eac8b271da589859451de3))
- **deps:** Sync bun.lock with the pinned typescript 6.0.3 ranges (by @ChristopherVR) ([08595c7](https://github.com/ChristopherVR/pptx-viewer/commit/08595c7131bd3b4b3a6c1d7179ccc8dc3da2a99e))

### Chores

- **e2e:** Re-sync generated fixtures to the current serialization (by @ChristopherVR) ([5d6db0a](https://github.com/ChristopherVR/pptx-viewer/commit/5d6db0a9344cf5de1844e8baac054e5cbac7025b))

## 2.0.0

pptx-viewer V2 is a big one. The headline is a brand-new in-viewer AI
assistant that can read and edit your deck for you, available across every
binding (React, Vue, Angular, Svelte, and Vanilla). Alongside it, V2 brings
the five bindings to full UI parity, sharpens OpenXML fidelity in the core,
and cleans up the public API surface. That API cleanup is why 2.0.0 is a
breaking release; see "Breaking changes and migration" below.

### AI assistant (new)

Meet your deck's new co-pilot: a chat panel that lives right inside the
viewer and can actually read and edit the presentation you are looking at.

- Chat with your deck. Ask questions about slides or tell the assistant to
  make changes in plain language ("add a title to slide 3", "make this box
  blue", "merge these two tables").
- Around 30+ built-in tools let the assistant read the outline, inspect
  elements, and edit content: add, update, and remove elements, recolour and
  restyle, insert charts and SmartArt, and merge tables.
- Staged proposals, always in your control. Edits arrive as a "Suggested
  change" card you Apply or Discard (Apply all for a batch); nothing touches
  your deck until you say so, and each change lands as a single undoable step.
- Pick-an-element focus mode. Point at a slide element and the assistant
  scopes its work to it, so "fix this" or "merge these" just works without
  restating anything.
- Live "collaborator" presence. Watch the assistant work: it navigates to the
  slide it is touching and pulses an animated highlight around the element in
  real time, with colour edits tweening as they apply.
- Chat history that persists. Conversations are saved in your browser
  (IndexedDB first, with a localStorage fallback), auto-titled, and resumable
  from a Chats menu. History is per-deck and private to your browser.
- Friendly, non-technical UI. Tool activity reads as plain language ("Looked
  at slide 5", "Merged two tables"); raw tool names and element ids stay
  tucked behind an optional Details disclosure.
- Bring your own key, any provider. The assistant is provider-agnostic via the
  Vercel AI SDK (`ai`), which is an optional peer dependency. Wire it to your
  own backend route or an in-process model with a declarative connection
  config, plus write-policy and tool allow/deny controls.
- AI log export. A new AI section in File > Options lets you download a
  detailed JSON or Markdown transcript of stored chats for debugging.
- Fully translated (English, French, Spanish, German).

Note: the assistant ships across all five bindings. The round-3 polish
(pick-to-focus, the live presence highlight, the friendlier cards, and the
in-Options log export) landed in React first and is being ported to the
other bindings.

### UI parity across all five bindings

- React, Vue, Angular, Svelte, and Vanilla now share the same viewer chrome:
  footer, toolbar, ribbon, and surrounding UI are brought to React parity.
- A lot of previously per-binding logic (the share form, the eyedropper colour
  sampler, theme-gallery presets, the audience-content store, and preview
  composition) moved into shared helpers, so the bindings behave consistently
  and stay in sync.

### OpenXML fidelity

- Spec-exact arrow geometry. Curved arrows (right, left, up, down) and bent
  arrows (bentArrow, bentUpArrow, uturnArrow) are now transcribed verbatim
  from the ECMA-376 / ISO-IEC 29500 preset shape definitions, so they respond
  correctly to any adjustment handles instead of approximating.
- ActiveX controls round-trip. Control edits (rename, retarget, add, remove,
  reorder) now serialize from a typed model instead of surviving only as
  raw XML.
- Chart manual-layout extensions are typed and preserved, so editing or
  re-saving a chart with a manual-layout extension list no longer drops it.
- Table-merge fidelity. Merging tables loaded from a real .pptx now renders
  every row correctly; a stale `rawXml` on the merged table was previously
  masking the second table's rows.

### Collaboration

- Real-time sync keeps working in backgrounded tabs and survives restarts.
- Broadcaster auto-follow is routed through a shared policy across React, Vue,
  and Angular; late joiners adopt the shared doc correctly, and in-place asset
  swaps propagate to peers.

### Under the hood

- GitHub release notes now carry the real per-release changes instead of an
  empty pruned-history footer.

### Breaking changes and migration

V2 stabilizes the public API, which is why it is a major release. If you only
import from each package's stable root (or `/viewer`) export, you likely have
nothing to change. The breaking bits:

- Internal building blocks moved to an `/internals` subpath, and the old
  `*-unstable` subpaths are gone:
  - `pptx-react-viewer/hooks-unstable` becomes `pptx-react-viewer/internals`
  - `pptx-vue-viewer/composables-unstable` becomes `pptx-vue-viewer/internals`
  - Angular internal services are now exposed via `pptx-angular-viewer/internals`

  The `/internals` surface is explicitly not covered by semver; prefer the
  stable root and `/viewer` exports.

- Deprecated print fields removed (core).
  `PptxPresentationProperties.printSlidesPerPage`, `.printFrameSlides`, and
  `.printColorMode` are gone. Use the typed `printProperties.printWhat`,
  `.frameSlides`, and `.colorMode` instead.
- Other removed deprecated members:
  - `CROP_SIDES` (Vue `useImageEditing`): use the `useCropSides()` composable.
  - `runMutatingTool` (pptx-viewer-mcp): use `runMcpTool`.
  - The `DIGITAL_SIGNATURE_ORIGIN_REL_TYPE` re-export from
    `signature-detection`: import it from `signature-constants` (still
    re-exported from the `core/utils` barrel).
- `smartArt3D` graduated from experimental to stable. No code change is
  needed; the prop is simply supported now.

Vue also gains granular collaboration composables (`useYjsProvider`,
`usePresenceTracking`, `useCollaborativeState`, `useCollaborativeHistory`) to
match React and Angular; `useCollaboration` stays as the convenience wrapper.
`useCollaborationWiring` and `useToolbarVisibility` are no longer root
exports; import them from `pptx-vue-viewer/internals`.

### Dependencies and toolchain

- **`emf-converter` upgraded to `2.0.0` (major).** `pptx-viewer-core` now
  depends on `emf-converter@^2.0.0` (was `^1.6.0`). This is a breaking major
  bump of the EMF/WMF metafile converter. If you install `emf-converter`
  directly, move your dependency to `^2.0.0`; when you only consume it
  transitively through `pptx-viewer-core`, the new version is pulled in
  automatically.
- **All other dependencies refreshed to their latest versions** (React 19.2.8,
  Angular 22.0.8, Svelte 5.56.7, `html2canvas-pro` 2.3.1, the `@ai-sdk/*`
  adapters, and the build/lint tooling).
- **TypeScript is on 7 wherever the toolchain supports it** - `pptx-viewer-core`,
  `pptx-viewer-shared`, `pptx-react-viewer`, `pptx-vanilla-viewer`,
  `pptx-viewer-mcp`, the CLI, and the locales package build and type-check on
  TypeScript 7. The **Vue, Angular, and Svelte bindings remain pinned to
  TypeScript 6.0.3**: their type-check / build toolchains (`vue-tsc`,
  `@angular/compiler-cli` / `ng-packagr`, and `svelte-check`) still crash on
  TypeScript 7 as of their latest releases (`vue-tsc@3.3.8`,
  `@angular/compiler-cli@22.0.8`, `svelte-check@4.7.3`). These three bindings
  will move to TypeScript 7 once their upstream tools ship TS7 support; this is
  an upstream tooling limitation, not a limitation of the bindings themselves.

### Full change list

Every change merged since the last release (`pptx-viewer-core@1.6.10` and its sibling
packages), grouped by commit type. The sections above narrate the headline work; this is
the complete log.

#### Features

- **react:** Rename hooks-unstable subpath to internals ([03fc39c](https://github.com/ChristopherVR/pptx-viewer/commit/03fc39c574a3a411f9b28b62d3a79f2699ad839e))
- **shared:** BuildPreviewElements preview composition helper ([0d6d1b3](https://github.com/ChristopherVR/pptx-viewer/commit/0d6d1b3e1f58a7f30d377ad48655459ab7d37999))
- **vue:** Rename unstable subpath to internals and unify collab API ([8bcf4e7](https://github.com/ChristopherVR/pptx-viewer/commit/8bcf4e7dbea249b98a746f857830f1243a8bcdb6))
- **shared:** Ai config, loader and bridge contracts ([1c40e28](https://github.com/ChristopherVR/pptx-viewer/commit/1c40e28b1661895e2993b01c11bea6262459cb88))
- **angular:** Move internal building blocks off the package root ([fd64790](https://github.com/ChristopherVR/pptx-viewer/commit/fd64790ac37070e751e873b831c66e8de9bce90b))
- **shared:** Ai tool schemas, proposal store and deck context ([d1d6d60](https://github.com/ChristopherVR/pptx-viewer/commit/d1d6d60e3ff6e4fda8b27290ab31d32ee348e3f1))
- **core:** Drop deprecated presentation print aliases and signature re-export ([9c4cef0](https://github.com/ChristopherVR/pptx-viewer/commit/9c4cef0eb96c496cb677d9b21e8273c328ebcd03))
- **shared:** Add typed print-settings helpers for handout slides-per-page ([716dfe8](https://github.com/ChristopherVR/pptx-viewer/commit/716dfe81dc32f7ae8d3245d7374ac8b7a23df98c))
- **shared:** Ai chat session, vanilla adapter and server helpers ([9986fcf](https://github.com/ChristopherVR/pptx-viewer/commit/9986fcf6cabc4e0a2cf0bc6c66987847bc1d7e2f))
- **core:** Typed serialization for activex controls ([c49670d](https://github.com/ChristopherVR/pptx-viewer/commit/c49670da27e58b606e899c042671677f5d887ac1))
- **core:** Honor adjustments with exact bent-arrow geometry ([0c8728a](https://github.com/ChristopherVR/pptx-viewer/commit/0c8728a6564313fc20621ae8230b11c7132ca5f0))
- **shared:** Add ai assistant i18n keys ([0d78063](https://github.com/ChristopherVR/pptx-viewer/commit/0d780634e8cab46a41ed8423ad6df95781e16808))
- **vanilla:** Ai bridge over the viewer controller ([a031301](https://github.com/ChristopherVR/pptx-viewer/commit/a031301511bfb13762b49a70541fdeb2183dd497))
- **vanilla:** Ai chat panel dom and styles ([58473c9](https://github.com/ChristopherVR/pptx-viewer/commit/58473c923be7ec3190ef4b4f43eea929db3fb555))
- **vanilla:** Wire ai config into demo ([9ab2c2d](https://github.com/ChristopherVR/pptx-viewer/commit/9ab2c2d16cca553a0164c411c887c8c2cd6723cb))
- **react:** Add ai bridge and chat session hooks ([9a153a7](https://github.com/ChristopherVR/pptx-viewer/commit/9a153a752c47c5e2c140bf58de2984682bcc39ee))
- **react:** Add ai chat panel and toolbar toggle ([376a17f](https://github.com/ChristopherVR/pptx-viewer/commit/376a17fd6ffb4fa224b980d8fb255e8731a593b9))
- **react:** Wire ai config into the demo ([3c23672](https://github.com/ChristopherVR/pptx-viewer/commit/3c23672360bd982deff5696b6698319d73e7480c))
- **shared:** Export ai element-update and panel transcript helpers ([15472e3](https://github.com/ChristopherVR/pptx-viewer/commit/15472e3afc8bb8c5ec495aa8b79d4674b7bea31a))
- **locales:** Translate ai assistant strings for fr, es and de ([3467221](https://github.com/ChristopherVR/pptx-viewer/commit/3467221ba9ea7cd2e72e35efc87c334d7451e176))
- **core:** Spec-exact curved arrow geometry ([903d0a7](https://github.com/ChristopherVR/pptx-viewer/commit/903d0a7fdafa9c29e9e6976ba00fafb025ef9aee))
- **core:** Type chart manual-layout extension list ([2f1f5df](https://github.com/ChristopherVR/pptx-viewer/commit/2f1f5df37886d37e3a7c216959ec78a3cc8f9f7b))
- **angular:** Ai bridge and chat service ([90bf211](https://github.com/ChristopherVR/pptx-viewer/commit/90bf2113493e4c31aee55acaf775c49cd29e7bdb))
- **angular:** Ai chat panel and toolbar toggle ([23ddf25](https://github.com/ChristopherVR/pptx-viewer/commit/23ddf25373e40024fb27b3aec78103a5e9badc4b))
- **angular:** Wire ai config into demo ([4fd50e7](https://github.com/ChristopherVR/pptx-viewer/commit/4fd50e7aba0f3f32f93e461309cbce48bfb4977f))
- **vue:** Ai bridge and chat session composables ([7143ee7](https://github.com/ChristopherVR/pptx-viewer/commit/7143ee767e90acb15813802aecb29afb413bf096))
- **vue:** Ai chat panel and toolbar toggle ([c711d57](https://github.com/ChristopherVR/pptx-viewer/commit/c711d57593d355ffdb556d9201a717367e72bc87))
- **vue:** Ai bridge and chat session composables ([0f5cfd3](https://github.com/ChristopherVR/pptx-viewer/commit/0f5cfd3b35df3ef90cc5057b268a7f70dd44ab9f))
- **vue:** Wire ai config into demo ([27290e0](https://github.com/ChristopherVR/pptx-viewer/commit/27290e0cfd28b63b9044e650176c7c4258afbb06))
- **svelte:** Ai chat panel and toolbar toggle ([a569bee](https://github.com/ChristopherVR/pptx-viewer/commit/a569bee394738190d09abfeb785b5f3427ac85f0))
- **svelte:** Wire ai config into demo ([cbd34df](https://github.com/ChristopherVR/pptx-viewer/commit/cbd34df0b930947335769ccb156edfc5d8d9234d))
- **shared:** Indexeddb-first ai chat history store ([88920f2](https://github.com/ChristopherVR/pptx-viewer/commit/88920f20eb00e72b84efa9ef2cb500dfd6d20db4))
- **shared:** Focused-target context for the ai assistant ([530e8d6](https://github.com/ChristopherVR/pptx-viewer/commit/530e8d6b7e2a98dc8442dc07fbc650fae1d1b507))
- **shared:** Table-merge helper and merge_tables ai tool ([2e4098d](https://github.com/ChristopherVR/pptx-viewer/commit/2e4098d5d3e027d75f35be6197e88e182f4c2704))
- **shared:** Apply AI theme edits immediately with undo snapshot ([a02893b](https://github.com/ChristopherVR/pptx-viewer/commit/a02893b8108dbaebaaa7520c53d0cccaba436e10))
- **shared:** Add AI assistant round-2 i18n keys (en) ([98157c3](https://github.com/ChristopherVR/pptx-viewer/commit/98157c36491f5a60440bfcd324c248475fbac21e))
- **react:** AI assistant round-2 (focus, context, history, merge, fixes) ([ae429ff](https://github.com/ChristopherVR/pptx-viewer/commit/ae429ffc6672a13d439aa5a2632becc08c30fe62))
- **shared:** Let the ai insert charts and smartart ([e22e595](https://github.com/ChristopherVR/pptx-viewer/commit/e22e595acee83f8a3248b2a7007b7d3f5e768578))
- **react:** Ai settings section with detailed chat log export ([713e4ba](https://github.com/ChristopherVR/pptx-viewer/commit/713e4bae8fc484234b90ef890d5779fcbb148914))
- **shared:** Human-friendly ai tool activity labels ([ca19c78](https://github.com/ChristopherVR/pptx-viewer/commit/ca19c78fa24ff12aa31bc04adde3a24ed0471a28))
- **react:** Pick-to-focus mode with animated element highlight ([ebfc997](https://github.com/ChristopherVR/pptx-viewer/commit/ebfc99786f6b26e05b08f0ab7686beabecfa6200))
- **react:** Friendlier ai proposal and message cards ([29dc064](https://github.com/ChristopherVR/pptx-viewer/commit/29dc06402ea879f4d86d41c4227560ba286acd51))
- **locales:** Translate new ai assistant strings for fr, es and de ([67c7543](https://github.com/ChristopherVR/pptx-viewer/commit/67c7543232d5bf04bb9ab7cfef358336f77a82b6))
- **svelte:** Friendly AI tool + proposal cards ([e869a45](https://github.com/ChristopherVR/pptx-viewer/commit/e869a4501553c439f2b98ff859ba73a2eecea94d))
- **vanilla:** Friendly AI tool-call and proposal cards ([a52d119](https://github.com/ChristopherVR/pptx-viewer/commit/a52d1196ce31106bab8b7b9f2eb01a63744a27cd))
- **svelte:** AI pick mode, focus bar, live canvas presence ([dbdd8dc](https://github.com/ChristopherVR/pptx-viewer/commit/dbdd8dc37aeac0497a81960c15d20f154d0881cb))
- **svelte:** AI settings chat-log export + transcript persistence ([3976231](https://github.com/ChristopherVR/pptx-viewer/commit/39762314d270c3cd6f16080fcc3d2279f04bfbeb))
- **angular:** Friendlier AI tool-call and proposal cards ([40b071d](https://github.com/ChristopherVR/pptx-viewer/commit/40b071d2aa4b70c1a34d1fd41270cad922fa8b8f))
- **angular:** AI focus scope, pick mode, live canvas presence ([2f81a25](https://github.com/ChristopherVR/pptx-viewer/commit/2f81a2534621eadf2350c09b6c4a28fbd9669001))
- **angular:** AI chat-log export in the Settings dialog ([660b672](https://github.com/ChristopherVR/pptx-viewer/commit/660b672b1a697c2ca15fe5162148858ac6e10e64))
- **vanilla:** AI pick mode, live canvas presence, click-to-ask, log export ([a678d39](https://github.com/ChristopherVR/pptx-viewer/commit/a678d394cb2f823081b871858a3b1fabfbc9b110))
- **vue:** Friendlier ai activity and proposal cards ([89e1f7a](https://github.com/ChristopherVR/pptx-viewer/commit/89e1f7af2f3a4dd36a2c154d41b75609b8fd8dce))
- **vue:** Ai pick mode, canvas highlight and live presence ([c830e8a](https://github.com/ChristopherVR/pptx-viewer/commit/c830e8a7ac67b88ef3e63dccb48e05adbf774e49))
- **vue:** Ai click-to-ask context menu entries ([8b8e9b5](https://github.com/ChristopherVR/pptx-viewer/commit/8b8e9b5e1969ac5f3b92aace000821fa0d315ba9))
- **vue:** Ai settings chat-log export ([09f654d](https://github.com/ChristopherVR/pptx-viewer/commit/09f654d67014a9a9238298ef3c3be7588251402c))
- **vue:** Wire ai focus, picks and canvas presence into viewer ([eed7af3](https://github.com/ChristopherVR/pptx-viewer/commit/eed7af3b0935cb6a55e49257186ffd9453cc6114))
- **shared:** Rebuild AI assistant tools on pptx-viewer-mcp ([da1c31e](https://github.com/ChristopherVR/pptx-viewer/commit/da1c31ee88c0b60a82628003c8a1b16245f028ed))
- **shared:** Route apply_layout to slides and add deck-data AI seam ([d1d9143](https://github.com/ChristopherVR/pptx-viewer/commit/d1d91432b22f56c254d69e3725c9c585d01a149a))
- **react:** Implement the AI getDeckData/applyDeckData bridge seam ([6324ee9](https://github.com/ChristopherVR/pptx-viewer/commit/6324ee93376442c5ccbc0ec53f89b8c0f8f63573))
- **svelte:** Implement the AI getDeckData/applyDeckData bridge seam ([4e66cf3](https://github.com/ChristopherVR/pptx-viewer/commit/4e66cf3607f1a36e8379e0c5df6978f0d248d8dc))
- **vue:** Implement the AI getDeckData/applyDeckData bridge seam ([8670f9e](https://github.com/ChristopherVR/pptx-viewer/commit/8670f9e6f764752fd735f767369fb9aca902326c))
- **angular:** Implement the AI getDeckData/applyDeckData bridge seam ([51887b7](https://github.com/ChristopherVR/pptx-viewer/commit/51887b70c2c6a444c027e245cf3f67fbc7334d89))
- **vanilla:** Implement the AI getDeckData/applyDeckData bridge seam ([5e00c19](https://github.com/ChristopherVR/pptx-viewer/commit/5e00c199d8c7c1c72bfa15cfb9720cc4f42207fb))
- **shared:** Animate AI edits on the canvas (change animator) ([9208cc8](https://github.com/ChristopherVR/pptx-viewer/commit/9208cc881ff215dfa873e70085fb502744445012))
- **vue:** Play the AI change animation on the canvas ([aa7b899](https://github.com/ChristopherVR/pptx-viewer/commit/aa7b899f4ca30261dab8f74fd943aff8d19955a8))
- **svelte:** Play the AI change animation on the canvas ([6d5b8f2](https://github.com/ChristopherVR/pptx-viewer/commit/6d5b8f2c0240fa4cf9ca8991c36d714819c86f9e))
- **vanilla:** Play the AI change animation on the canvas ([97cc0b9](https://github.com/ChristopherVR/pptx-viewer/commit/97cc0b924fd7ba920672904955be631d1fadf28b))
- **angular:** Play the AI change animation on the canvas ([02b8c94](https://github.com/ChristopherVR/pptx-viewer/commit/02b8c94179b69d829dd5f0c2ff79881273df094b))
- **shared:** Interpret DiagramML layout for common SmartArt algorithms ([#94](https://github.com/ChristopherVR/pptx-viewer/issues/94)) ([cc14c64](https://github.com/ChristopherVR/pptx-viewer/commit/cc14c64b6086f52c592af4ebb35946cbb1f703d0))
- **shared:** Interpret composite/conn/sp/tx SmartArt algorithms with forEach/choose/constr ([#94](https://github.com/ChristopherVR/pptx-viewer/issues/94)) ([e7c415a](https://github.com/ChristopherVR/pptx-viewer/commit/e7c415a284ceea58ce1d96edb93b34b0f9eb4287))
- **shared:** Animate p15 cinematic slide transitions (cube, flip, page curl, origami) ([bd36b2a](https://github.com/ChristopherVR/pptx-viewer/commit/bd36b2a026dba5e476f94c6bfe83bb107ba2eb11))
- **shared:** Render all-caps, per-paragraph spacing, run props, and script bullet numbering ([3b8784a](https://github.com/ChristopherVR/pptx-viewer/commit/3b8784aa7632c450b9ed2ec63a8a323d8812d969))
- **shared:** Render pie-of-pie, 3D chart depth, and pie label leader lines ([5714146](https://github.com/ChristopherVR/pptx-viewer/commit/5714146927fac04f00c64b2b1aa7b5a5c42d0822))
- **shared:** Paint effect fill-overlay colour and feather soft edges ([f5fefa4](https://github.com/ChristopherVR/pptx-viewer/commit/f5fefa4b3c01d5c6a90b4575b7436d6b76f4c77b))
- **shared:** Apply blip tile-flip and sp3d extrusion/contour colours ([2500d7f](https://github.com/ChristopherVR/pptx-viewer/commit/2500d7f5433ea3ff079d5eb84d102fe835949d6a))
- **shared:** Render compound outlines, preset connector dashes/arrows, per-subpath custom geometry ([2199391](https://github.com/ChristopherVR/pptx-viewer/commit/2199391e4dc9e03c6cf016db1268d6b05190e4fe))
- **core:** Render table cell3D bevel, style diagonals, fontRef idx, and anchorCtr/horzOverflow ([7be772c](https://github.com/ChristopherVR/pptx-viewer/commit/7be772cd07a170835f0944fa3d9576f02112188e))
- **core:** Warn on signature strip, render ActiveX/legacy-VML, parse ink pressure and app.xml fields ([282f25f](https://github.com/ChristopherVR/pptx-viewer/commit/282f25f915f93cbe1d61dad603bc275c27a79dbb))
- **vue:** Consume per-paragraph spacing, effect overlays, table diagonals, connector arrow sizing ([084bba7](https://github.com/ChristopherVR/pptx-viewer/commit/084bba70d2b99615b9471efb05b565cecc38f494))
- **svelte:** Consume per-paragraph spacing, effect overlays, table diagonals, connector arrow sizing ([43da741](https://github.com/ChristopherVR/pptx-viewer/commit/43da74123251d465c7119992a522f27af7dfc6e3))
- **vanilla:** Consume per-paragraph spacing, effect overlays, table diagonals, real connector dashes/arrows ([f9a2f08](https://github.com/ChristopherVR/pptx-viewer/commit/f9a2f08f0fb4ff19206f1f28bad8c15fd85478d7))
- **angular:** Consume per-paragraph spacing, effect overlays, table diagonals, connector arrow sizing ([eccc873](https://github.com/ChristopherVR/pptx-viewer/commit/eccc87328daedc2af680c414278dfa90943ef75a))
- **react:** Port table cell3D/diagonals/fontRef/anchorCtr to react helpers; wire blur-grow overflow and 3D fill fallback ([83711c5](https://github.com/ChristopherVR/pptx-viewer/commit/83711c5859dce808d0339435a234c623a9bd1a52))
- **core:** Load chart c:userShapes overlay and honor dispBlanksAs on line charts ([ca2200a](https://github.com/ChristopherVR/pptx-viewer/commit/ca2200adaceedd1596130fda717dff0f4ebf72a0))
- **react:** Render real tab stops (align + leaders) and text-body rotation ([e5a4bbb](https://github.com/ChristopherVR/pptx-viewer/commit/e5a4bbb793e04c393cb60baac424480549be5d87))
- **react:** Render per-subpath custom geometry and stroke-only presets ([066bfa5](https://github.com/ChristopherVR/pptx-viewer/commit/066bfa5cbebd85535949cf65c10add4073695d01))
- **react:** Paint effect fill-overlay layer and feather soft edges at binding parity ([83c8798](https://github.com/ChristopherVR/pptx-viewer/commit/83c8798bfe89240fcf4ed7f370fe07b82c0dcbbb))
- **core:** Upgrade emf-converter to 2.0.0 (breaking) ([effa4e5](https://github.com/ChristopherVR/pptx-viewer/commit/effa4e5338b2b01796a3671f505bcb4563de74cc))
- **shared:** Model staged builds and color-animation targets on the timeline state ([5ca5d5d](https://github.com/ChristopherVR/pptx-viewer/commit/5ca5d5da2c04624b7413061bf8f22043bc0ec8ef))
- **react:** Recolor SVG fill/stroke under p:animClr via inherit cascade ([ddd3272](https://github.com/ChristopherVR/pptx-viewer/commit/ddd327271f589b4c1cdb772558bb18a91fa4cfe7))
- **react:** Play staged chart and SmartArt builds (bldChart/bldDgm/bldOleChart) ([258d2de](https://github.com/ChristopherVR/pptx-viewer/commit/258d2de394e74c32eef14100d6faef64f3b54e9b))
- **vue:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) ([445f9a4](https://github.com/ChristopherVR/pptx-viewer/commit/445f9a47913f94de9c97a11a8cad38c8d88d56d9))
- **angular:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) ([93fe175](https://github.com/ChristopherVR/pptx-viewer/commit/93fe1754bd9b299c15a99c5a75aa9073361bbfe5))
- **svelte:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) ([965a59b](https://github.com/ChristopherVR/pptx-viewer/commit/965a59b7a6e66f27084215f2ac078151745eb7e3))
- **vanilla:** Migrate slideshow playback to shared native-timing engine (staged builds + animClr) ([ff23964](https://github.com/ChristopherVR/pptx-viewer/commit/ff239641167ecb0dec49c34531710faada3a84cd))

#### Bug Fixes

- **svelte:** Bring viewer chrome to React parity ([b544895](https://github.com/ChristopherVR/pptx-viewer/commit/b544895c36e9f4b547404ed35feea4054b644ddd))
- **react:** Pass table and field context to static thumbnail renderer ([1738a02](https://github.com/ChristopherVR/pptx-viewer/commit/1738a02a0d9e351156dfe6f747bf580ba5ce2914))
- **react:** Drop dangling thumbnail-element-renderers barrel export ([c1a0383](https://github.com/ChristopherVR/pptx-viewer/commit/c1a0383e82a1dcf21c251dc51d3afd649ba49b0a))
- **angular:** Bring viewer chrome to React parity ([373da74](https://github.com/ChristopherVR/pptx-viewer/commit/373da74221785fd7cf2e3c2e6302d761150f6350))
- **vue:** Bring viewer chrome to React parity ([a9e1364](https://github.com/ChristopherVR/pptx-viewer/commit/a9e1364933acb04efb02a682635cb796d74efbfb))
- **react:** Edit presentation print settings via typed printProperties ([a1a9ed0](https://github.com/ChristopherVR/pptx-viewer/commit/a1a9ed05fcd68cce0d8c4eb5a391e1456224e655))
- **vue:** Edit presentation print settings via typed printProperties ([bf45f78](https://github.com/ChristopherVR/pptx-viewer/commit/bf45f78e5be0103252574bdf9e1ffef8edcff5cf))
- **angular:** Edit presentation print settings via typed printProperties ([a379b71](https://github.com/ChristopherVR/pptx-viewer/commit/a379b71ac202e50a549f1db54622d5ba46e9bebb))
- **svelte:** Edit presentation print settings via typed printProperties ([7b087c9](https://github.com/ChristopherVR/pptx-viewer/commit/7b087c99cfa158c97f1288493c8260653f741be1))
- **vanilla:** Bring viewer chrome to React parity ([cdcef34](https://github.com/ChristopherVR/pptx-viewer/commit/cdcef34066a7cd608c52c9d6d4a388f3bdf050da))
- **vanilla:** Edit presentation print settings via typed printProperties ([af3605b](https://github.com/ChristopherVR/pptx-viewer/commit/af3605b6553376c180e05c1f1184635b717f8ff8))
- **core:** Update print-properties coverage anchor to renamed test ([3018357](https://github.com/ChristopherVR/pptx-viewer/commit/3018357e4f7c997b74cb0e41648c1643c76b2d98))
- **ci:** Populate github release notes with real per-release changes ([96ca9f5](https://github.com/ChristopherVR/pptx-viewer/commit/96ca9f50a3aae74110ce0677b9abff19bae85799))
- **shared:** Propagate in-place collab asset swaps to peers ([f3138ac](https://github.com/ChristopherVR/pptx-viewer/commit/f3138acd70ddccf9b2f1800b2b8ed1ad8e6d887c))
- **shared:** Add broadcaster auto-follow policy helper ([8502485](https://github.com/ChristopherVR/pptx-viewer/commit/8502485f881e473920590de14a13e1fc062c0df5))
- **react:** Keep collab sync alive in backgrounded tabs and on restart ([bb2109a](https://github.com/ChristopherVR/pptx-viewer/commit/bb2109a9a400258e0200bcdf5503f40795c6891e))
- **react:** Route broadcaster auto-follow through shared policy ([6a4a4cd](https://github.com/ChristopherVR/pptx-viewer/commit/6a4a4cd013f0bd03759dc08157b662f4973c7dad))
- **vue:** Adopt shared doc on late join and gate broadcaster follow ([75623c1](https://github.com/ChristopherVR/pptx-viewer/commit/75623c1dbaf3a579b77be4550ca2c29608cd0e17))
- **angular:** Route broadcaster auto-follow through shared policy ([83139ce](https://github.com/ChristopherVR/pptx-viewer/commit/83139ce3bab9320521758e37611cd8317c2bdf72))
- **react:** Stop ai theme colour change from hanging the renderer ([390b702](https://github.com/ChristopherVR/pptx-viewer/commit/390b702af942448ef1ca8722e2e85e9d601a0aca))
- **shared:** Execute AI tool calls once in model mode ([57c8afb](https://github.com/ChristopherVR/pptx-viewer/commit/57c8afb360d2dea1e74a74944bb0e2cbf98f2b99))
- **react:** Show a friendly short label on ai focus chips ([f60dfe9](https://github.com/ChristopherVR/pptx-viewer/commit/f60dfe9e2f870a364022de5e521e63024932f4a3))
- **shared:** Drop stale rawXml when merging tables ([5553146](https://github.com/ChristopherVR/pptx-viewer/commit/5553146fa1709a98a71740ee52d89748b540cee8))
- **react:** Drive AI live-focus nav from the message stream ([a8890c9](https://github.com/ChristopherVR/pptx-viewer/commit/a8890c9ea692931010e945c6a266b12e0dd10f95))
- **ci:** Drop build-failed packages before committing version bumps ([c02be55](https://github.com/ChristopherVR/pptx-viewer/commit/c02be55ee42ee509d5882be75768948346a91770))
- **tools:** Make convert_to_markdown browser-safe (lazy node:path) ([98790dd](https://github.com/ChristopherVR/pptx-viewer/commit/98790dd102348c0a380ffc957616b0333a8ce1e4))
- **react:** Make the mobile AI panel a bottom sheet, not a full overlay ([1b15ddc](https://github.com/ChristopherVR/pptx-viewer/commit/1b15ddc50ac612afcb8950b9fe0545bbe8ce7ad0))
- **vue:** Make the mobile AI panel a bottom sheet, not a full overlay ([1f89071](https://github.com/ChristopherVR/pptx-viewer/commit/1f8907117e45f5a2d3a05782c7a332828ed69096))
- **svelte:** Make the mobile AI panel a bottom sheet, not a full overlay ([3194d22](https://github.com/ChristopherVR/pptx-viewer/commit/3194d22bb614d7e29691c00f649483af8d68ea6c))
- **vanilla:** Make the mobile AI panel a bottom sheet instead of squeezing the canvas ([8cf2995](https://github.com/ChristopherVR/pptx-viewer/commit/8cf2995dc586a04cf1e4a11369ae06d1df8841a1))
- **angular:** Make the mobile AI panel a bottom sheet, not a full overlay ([c819bbe](https://github.com/ChristopherVR/pptx-viewer/commit/c819bbe2458bdca6869041549015058a26415841))
- **react:** Mobile AI entry point, taller AI sheet, responsive File view ([cc56d23](https://github.com/ChristopherVR/pptx-viewer/commit/cc56d234f70b3e2d8bc1a72b4e172120bf3a8537))
- **vue:** Mobile AI entry point, taller AI sheet, responsive File view ([666bd99](https://github.com/ChristopherVR/pptx-viewer/commit/666bd996b354e663d02c522ef2df31d6d61e13ef))
- **svelte:** Mobile AI entry point, taller AI sheet, responsive File view ([8df8c6f](https://github.com/ChristopherVR/pptx-viewer/commit/8df8c6f40a79922669607cee6a3fe7ec8c0041d5))
- **vanilla:** Mobile AI entry point, taller AI sheet, responsive File view ([4f29e4e](https://github.com/ChristopherVR/pptx-viewer/commit/4f29e4e59a307167b62f49c6b0e5ba2f04dceb4c))
- **angular:** Mobile AI entry point, taller AI sheet, responsive File view ([e9aaecd](https://github.com/ChristopherVR/pptx-viewer/commit/e9aaecdeb5824fef68d83d366c2599a245c2eb16))
- **core:** Reconcile Split/RandomBars animation preset ids to spec (#99, #81) ([110a88e](https://github.com/ChristopherVR/pptx-viewer/commit/110a88ef82f1ebbbf14e234002eaa779c6794a26))
- **shared:** Inherit group fill into a:grpFill children across bindings ([#97](https://github.com/ChristopherVR/pptx-viewer/issues/97)) ([454ddf3](https://github.com/ChristopherVR/pptx-viewer/commit/454ddf3a3d4e0836fe2957c83860ba5ad932fd5b))
- **core:** Play p:cmd media commands and evaluate preset avLst formulas ([#98](https://github.com/ChristopherVR/pptx-viewer/issues/98)) ([fe6b56b](https://github.com/ChristopherVR/pptx-viewer/commit/fe6b56b2f305fd0a35062aca8d5b6e770f499ec0))
- **shared:** Play unmapped emphasis, curved motion paths, directional effects, valid color-animation CSS ([3d1f5b4](https://github.com/ChristopherVR/pptx-viewer/commit/3d1f5b4c7ea7572418f3059b7ec47dd93bfee508))
- **core:** Scale heart preset control points into element space (was a degenerate line) ([03d9628](https://github.com/ChristopherVR/pptx-viewer/commit/03d962834419f2b149ef74587438e758b1fa38f6))
- **build:** Restore pptx-viewer-shared/ai vitest alias after main merge ([f878be8](https://github.com/ChristopherVR/pptx-viewer/commit/f878be8dc5b4735081690b691ca30bf3b0264559))
- **react:** Surface animClr fill/stroke targets during playback (were dropped after seed) ([db0cf72](https://github.com/ChristopherVR/pptx-viewer/commit/db0cf726cad97436eed57a99fcdc6b76c42f629b))
- **svelte:** Route slideshow click/hover to interactive and hover animation triggers ([5d09c85](https://github.com/ChristopherVR/pptx-viewer/commit/5d09c854fe7ea49a6bda28f779409b368b4b4968))
- **core:** Parse animClr target attribute from p:attrName text (was dropped by object-only ensureArray) ([20a6095](https://github.com/ChristopherVR/pptx-viewer/commit/20a609513dd3073b8c10d3f85a986172a77877d9))

#### Refactor

- **vue:** Remove deprecated CROP_SIDES constant ([b9911b1](https://github.com/ChristopherVR/pptx-viewer/commit/b9911b1de96e15794ea47767c1b936be257409ff))
- **tools:** Remove deprecated runMutatingTool alias ([3db1d50](https://github.com/ChristopherVR/pptx-viewer/commit/3db1d5080772a99972261817cb98c2b371f2128d))
- **shared:** Extract audience-content-store from bindings ([aec2bb7](https://github.com/ChristopherVR/pptx-viewer/commit/aec2bb7928a516d3cf7aa407b329e0c542e1dd40))
- **shared:** Extract theme-gallery presets from vue/angular ([2011839](https://github.com/ChristopherVR/pptx-viewer/commit/2011839bc3a54e8356eec861cc3188d0e1e4f2cf))
- **shared:** Extract eyedropper colour sampler from bindings ([a19009d](https://github.com/ChristopherVR/pptx-viewer/commit/a19009da338a3d5311de19b9524cf5728cbf9568))
- **shared:** Extract share-form helpers from bindings ([a014e42](https://github.com/ChristopherVR/pptx-viewer/commit/a014e427130292584e4a1e6976560bf7dbd10d4d))
- **shared:** Extract framework-agnostic PresentationAnimationController; React consumes it ([5133861](https://github.com/ChristopherVR/pptx-viewer/commit/5133861233792ecabc6f7affb47f61d33c1018c2))

#### Documentation

- **svelte:** Graduate smartArt3D prop from experimental to stable ([6d47eb9](https://github.com/ChristopherVR/pptx-viewer/commit/6d47eb992c42e1a16279983e5846db321a0df10a))
- Adopt stable-vs-internals contract and internals subpath naming ([8f17e8b](https://github.com/ChristopherVR/pptx-viewer/commit/8f17e8b3cd5f2980abe41ea5b6690cff1d5b1587))
- Add AI assistant guide ([a6239fb](https://github.com/ChristopherVR/pptx-viewer/commit/a6239fbac8b68b3d6f769fffda2ba1c95172a46b))
- Friendly 2.0.0 changelog for root and packages ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))
- Note cinematic transitions, sp3d, reflection, soft-edge, and warp render approximations ([affe3ba](https://github.com/ChristopherVR/pptx-viewer/commit/affe3ba33d636b6fc60290cf7d7478b35ea68c44))

#### Testing

- **react:** Verify thumbnail renders layout-inherited colour + content ([49bf023](https://github.com/ChristopherVR/pptx-viewer/commit/49bf023e232ff7fb9bd3a09a2afe58f2e663fb0a))
- **shared:** Ai config, proposals, registry, context and vanilla chat ([9895aca](https://github.com/ChristopherVR/pptx-viewer/commit/9895aca9e7942a55c665915aebd910a30b47b21b))
- **vanilla:** Ai panel gating and proposals ([f7613fd](https://github.com/ChristopherVR/pptx-viewer/commit/f7613fdca28b0cb84c7ddaeb96e49dc27a49b3e8))
- **react:** Ai panel gating and proposals ([59e35e0](https://github.com/ChristopherVR/pptx-viewer/commit/59e35e082cfed944f756a5d2fb74c593e0592da4))
- **angular:** Ai panel gating and proposals ([60c078f](https://github.com/ChristopherVR/pptx-viewer/commit/60c078fc2290549974eb5feed6c0b0c44ea32830))
- **vue:** Ai panel gating and proposals ([5e69d09](https://github.com/ChristopherVR/pptx-viewer/commit/5e69d09a9f0e5fd47c82d6ec7df7a92a13920035))
- **svelte:** Ai panel gating and proposals ([8f329d2](https://github.com/ChristopherVR/pptx-viewer/commit/8f329d2dc7006caea77f4f23d9aaa84256365d31))
- **shared:** End-to-end ai tool-call to proposal flow ([578277d](https://github.com/ChristopherVR/pptx-viewer/commit/578277df7b7b9a48bd682e4dc86bc136244dcc19))
- **react:** Ai panel proposal accept mutates the deck ([0cfa627](https://github.com/ChristopherVR/pptx-viewer/commit/0cfa627d5bc250ac8228b6ebba10e95d10db6099))
- **shared:** Opt-in live gpt-4o-mini ai integration test ([48622f1](https://github.com/ChristopherVR/pptx-viewer/commit/48622f135a5f2ee4c28d97d08478d3c203745f47))
- **shared:** Live table-merge via gpt-4o-mini ([f323c9b](https://github.com/ChristopherVR/pptx-viewer/commit/f323c9bb18e84396616e1c8467eb4b72aea66da1))
- **shared:** Guard shape clip-path helpers against render loops ([4e5fb4c](https://github.com/ChristopherVR/pptx-viewer/commit/4e5fb4c3f2810a22abdae1f5b351a977b86e3db0))
- **react:** Guard sample-deck shape/table render termination ([dde980d](https://github.com/ChristopherVR/pptx-viewer/commit/dde980da1473ff236cd4b7e11f9b617246fa4d3f))
- **react:** Guard merge_tables renders 10 rows for real tables ([3503ece](https://github.com/ChristopherVR/pptx-viewer/commit/3503ecee0386824b7df5cfe9406779a16ee26d7d))
- **vue:** Align proposal card test with friendlier labels ([15c807b](https://github.com/ChristopherVR/pptx-viewer/commit/15c807b36fd9e214cc15296f331ff759566d5bd6))
- **svelte:** Stub anchor click in AI log-export test ([b999401](https://github.com/ChristopherVR/pptx-viewer/commit/b99940189443b71fd43934803045c0e4d2bb0a76))
- **vanilla:** Align AI tool fixtures with MCP-backed tool names ([ee028a6](https://github.com/ChristopherVR/pptx-viewer/commit/ee028a6ab85f9da962baaff5c95f12849db45df3))
- **svelte:** Align AI tool fixtures with MCP-backed tool names ([5971e19](https://github.com/ChristopherVR/pptx-viewer/commit/5971e19ff3333cf6cb05e054325ca721bd477706))
- **vue:** Align AI tool fixtures with MCP-backed tool names ([066dbc3](https://github.com/ChristopherVR/pptx-viewer/commit/066dbc36152f2fad677e80cb278b1d181ed6ebbf))
- **angular:** Align AI tool fixtures with MCP-backed tool names ([834e598](https://github.com/ChristopherVR/pptx-viewer/commit/834e598e54ae8ce0d54091ea2bfba7958c442d00))
- **react:** Align AI tool fixtures with MCP-backed tool names ([a41be75](https://github.com/ChristopherVR/pptx-viewer/commit/a41be7585e0533f33af18d985bdc0867bbab0ca0))
- **core:** Cover chart userShapes parser and blank-display resolution ([e9df1b3](https://github.com/ChristopherVR/pptx-viewer/commit/e9df1b3ea3610fb0d6dac7d7a9bd762b936cf5f5))

#### Build & CI

- **shared:** Keep the ai SDK external across bindings ([fa5e6b7](https://github.com/ChristopherVR/pptx-viewer/commit/fa5e6b77e6586764d9e7717439f574291810e93b))
- Pin Vue/Angular/Svelte to exact TypeScript 6.0.3 ([3d80082](https://github.com/ChristopherVR/pptx-viewer/commit/3d8008282231e1ee4bc11300757d1cc35e8dc174))

#### Styling

- **shared:** Trim ai schemas to the per-file size budget ([9346eda](https://github.com/ChristopherVR/pptx-viewer/commit/9346eda8f28de702fd87165610ec38d94eaa4052))

#### Dependencies

- **deps:** Lock pptx-viewer-mcp and zod for the AI tool layer ([6e805d2](https://github.com/ChristopherVR/pptx-viewer/commit/6e805d2a09159cab279c76998af16d91279bb43f))
- **deps:** Sync lockfile after main merge ([a537528](https://github.com/ChristopherVR/pptx-viewer/commit/a5375280297ad45fc9d21fda528b6d330072bf45))
- **deps:** Update dependencies to latest ([bea8494](https://github.com/ChristopherVR/pptx-viewer/commit/bea8494ab7210838c5eac8b271da589859451de3))

## 2026-07-21

_Releases: pptx-svelte-viewer@1.39.0_

## 2026-07-21

_Releases: pptx-svelte-viewer@1.38.0_

## 2026-07-21

_Releases: pptx-svelte-viewer@1.37.0_

## 2026-07-21

_Releases: pptx-svelte-viewer@1.36.0_

## 2026-07-21

_Releases: pptx-svelte-viewer@1.35.0_

## 2026-07-21

_Releases: pptx-svelte-viewer@1.34.0_

## 2026-07-20

_Releases: pptx-svelte-viewer@1.33.0_

## 2026-07-20

_Releases: pptx-svelte-viewer@1.32.0_

## 2026-07-20

_Releases: pptx-svelte-viewer@1.31.0_

## 2026-07-20

_Releases: pptx-svelte-viewer@1.30.0_

## 2026-07-20

_Releases: pptx-svelte-viewer@1.29.0_

## 2026-07-20

_Releases: pptx-svelte-viewer@1.28.0_

## 2026-07-20

_Releases: pptx-svelte-viewer@1.27.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.26.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.25.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.24.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.23.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.22.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.21.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.20.0_

## 2026-07-19

_Releases: pptx-svelte-viewer@1.19.0_

## 2026-07-19

_Releases: pptx-viewer-core@1.6.10, pptx-react-viewer@1.25.5, pptx-vue-viewer@1.24.5, pptx-angular-viewer@1.31.5, pptx-vanilla-viewer@0.17.5, pptx-svelte-viewer@1.18.0_

### Bug Fixes

- **core:** Preserve rich cell text, per-paragraph pPr and font fidelity (#68, #69, #83, #84, #85) (by @ChristopherVR) ([4d61e0e](https://github.com/ChristopherVR/pptx-viewer/commit/4d61e0ee4210bbe2897d58e3376539f1ea708a35))
- **shared:** Route exotic transitions to faithful p14 keyframes ([#80](https://github.com/ChristopherVR/pptx-viewer/issues/80)) (by @ChristopherVR) ([80b972d](https://github.com/ChristopherVR/pptx-viewer/commit/80b972d7a59bbb77fc8d80ae86bf6f97eb80a8b7))
- **shared:** Keep unmapped animation presets from stranding elements ([#81](https://github.com/ChristopherVR/pptx-viewer/issues/81)) (by @ChristopherVR) ([caf4e5e](https://github.com/ChristopherVR/pptx-viewer/commit/caf4e5e78db3fd2800cf6d1ae45e1a8248679435))
- **react:** Enforce transition advanceOnClick in presentation mode ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([1f4d9b3](https://github.com/ChristopherVR/pptx-viewer/commit/1f4d9b3d36b6a8776178fb497337a2e22c685eda))
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

## 2026-07-19

_Releases: pptx-viewer-core@1.6.9, pptx-react-viewer@1.25.4, pptx-vue-viewer@1.24.4, pptx-angular-viewer@1.31.4, pptx-vanilla-viewer@0.17.4, pptx-svelte-viewer@1.17.0_

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

## 2026-07-19

_Releases: pptx-viewer-core@1.6.8, pptx-react-viewer@1.25.3, pptx-vue-viewer@1.24.3, pptx-angular-viewer@1.31.3, pptx-vanilla-viewer@0.17.3, pptx-svelte-viewer@1.16.0_

### Bug Fixes

- **core:** Themed background text, colour and geometry fidelity (by @ChristopherVR) ([a8fc2be](https://github.com/ChristopherVR/pptx-viewer/commit/a8fc2bea2407f70bc3df4008be5c152d107cc3eb))
- **shared:** Render freeform fills via clip-path and correct flip/rotate order (by @ChristopherVR) ([7122f43](https://github.com/ChristopherVR/pptx-viewer/commit/7122f43c7ff9bae5bf0278d2753a6209bc1821af))
- **react:** Paint freeform fills only via the vector path and rotate-first (by @ChristopherVR) ([e95c6ab](https://github.com/ChristopherVR/pptx-viewer/commit/e95c6ab0764fd53ef1b177c7c151942154439c62))

## 2026-07-19

_Releases: pptx-viewer-core@1.6.7, pptx-react-viewer@1.25.2, pptx-vue-viewer@1.24.2, pptx-angular-viewer@1.31.2, pptx-vanilla-viewer@0.17.2, pptx-svelte-viewer@1.15.0_

### Bug Fixes

- **core:** Stop truncating interleaved custom-geometry paths ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([9bbac7d](https://github.com/ChristopherVR/pptx-viewer/commit/9bbac7d024fbad8ccd476f7e2a5d993ce1ad2b1b))

### Performance

- **react:** Memoize the static group-child renderer (by @ChristopherVR) ([678c474](https://github.com/ChristopherVR/pptx-viewer/commit/678c47470d1b8129ddf9188a38fa17e6b3dd1246))
- **core:** Cache layout/master XML during background resolution (by @ChristopherVR) ([9eea305](https://github.com/ChristopherVR/pptx-viewer/commit/9eea3057d62825f2c6355cf9891123a77df0c8fb))

## 2026-07-18

_Releases: pptx-viewer-core@1.6.6, pptx-react-viewer@1.25.1, pptx-vue-viewer@1.24.1, pptx-angular-viewer@1.31.1, pptx-vanilla-viewer@0.17.1, pptx-svelte-viewer@1.14.0_

### Bug Fixes

- **core:** Load themed backgrounds and inherited placeholders ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([bed627b](https://github.com/ChristopherVR/pptx-viewer/commit/bed627bc4e2abb5c897e7e9b49fb27735f5e01a1))
- **react:** Render themed background group children on the slide canvas (by @ChristopherVR) ([ca154f1](https://github.com/ChristopherVR/pptx-viewer/commit/ca154f1e2e6a080442a8fbc8f51bbd6325a2a3a6))

## 2026-07-18

_Releases: pptx-svelte-viewer@1.13.0_

## 2026-07-18

_Releases: pptx-react-viewer@1.25.0, pptx-vue-viewer@1.24.0, pptx-angular-viewer@1.31.0, pptx-vanilla-viewer@0.17.0, pptx-svelte-viewer@1.12.0_

### Features

- **shared:** PowerPoint File > Options parity model (by @ChristopherVR) ([b1f041d](https://github.com/ChristopherVR/pptx-viewer/commit/b1f041d2396520e3d04c30172a4842f725c7c655))
- **locales:** Translate File > Options strings (fr, es, de) (by @ChristopherVR) ([a5d6bbd](https://github.com/ChristopherVR/pptx-viewer/commit/a5d6bbdca4716b42ff0c214a1ffa83b9d047b4f9))
- **react:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([0de245f](https://github.com/ChristopherVR/pptx-viewer/commit/0de245f244c408930780d306ad711883d44d39e8))
- **vue:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([3fe2b3f](https://github.com/ChristopherVR/pptx-viewer/commit/3fe2b3f512998449e97d35e80a8687451232a0b5))
- **angular:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([8635ad6](https://github.com/ChristopherVR/pptx-viewer/commit/8635ad677ac1c224850af65a0b5110cd7cd2fd7e))
- **svelte:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([00a2221](https://github.com/ChristopherVR/pptx-viewer/commit/00a222106f73ea45a77d7ff43e1f77d2bceed993))
- **vanilla:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([81ba347](https://github.com/ChristopherVR/pptx-viewer/commit/81ba34734ef9d3df45ebe8f1deb03ae0058700b0))

## 2026-07-18

_Releases: pptx-svelte-viewer@1.11.0_

## 2026-07-18

_Releases: pptx-svelte-viewer@1.10.0_

## 2026-07-18

_Releases: pptx-svelte-viewer@1.9.0_

## 2026-07-18

_Releases: pptx-svelte-viewer@1.8.0_

## 2026-07-18

_Releases: pptx-svelte-viewer@1.7.0_

## 2026-07-18

_Releases: pptx-viewer-core@1.6.5, pptx-react-viewer@1.24.1, pptx-vue-viewer@1.23.2, pptx-angular-viewer@1.30.1, pptx-vanilla-viewer@0.16.1, pptx-svelte-viewer@1.6.0, pptx-viewer-mcp@1.3.2, @christophervr/pptx-viewer@1.5.5_

### Features

- **demos:** Auto-load a bundled sample deck via ?sample=1 (by @ChristopherVR) ([928ff80](https://github.com/ChristopherVR/pptx-viewer/commit/928ff802886c725ab8cb92f354d6bb70c5f98799))

### Bug Fixes

- **react:** Re-adopt collab doc slides after a local content load (by @ChristopherVR) ([4c604bd](https://github.com/ChristopherVR/pptx-viewer/commit/4c604bdb277668155da85d7d667699abaaf3b13d))
- **shared:** Keep literal newline text runs in the collab text codec (by @ChristopherVR) ([866d513](https://github.com/ChristopherVR/pptx-viewer/commit/866d513e398b8ec694aa02904b413db05ca1c382))
- **vue:** Re-adopt collab doc slides after a local content load (by @ChristopherVR) ([a44b1a8](https://github.com/ChristopherVR/pptx-viewer/commit/a44b1a84a9af6e9ae319c335e56260da8862cede))
- **angular:** Re-adopt collab doc slides after a local content load (by @ChristopherVR) ([c72ce6b](https://github.com/ChristopherVR/pptx-viewer/commit/c72ce6bff749c2f1879a8967c036756e549d0a5c))
- **svelte:** Re-adopt collab doc slides after a local content load (by @ChristopherVR) ([03d269f](https://github.com/ChristopherVR/pptx-viewer/commit/03d269fcc57186611e418879ff850482ed3d091f))
- **vanilla:** Re-adopt collab doc slides after a local content load (by @ChristopherVR) ([b02ac4d](https://github.com/ChristopherVR/pptx-viewer/commit/b02ac4d633f5c908278e995cf834d6aa50d34d80))

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))
- Embed live framework demos with a collaboration mode on the landing page (by @ChristopherVR) ([ea5e727](https://github.com/ChristopherVR/pptx-viewer/commit/ea5e7270aa4aa95ef5fbbcc82cbf90b79373aaf6))

## 2026-07-18

_Releases: pptx-viewer-core@1.6.4, pptx-react-viewer@1.24.0, pptx-vue-viewer@1.23.1, pptx-angular-viewer@1.30.0, pptx-vanilla-viewer@0.16.0, pptx-svelte-viewer@1.5.0_

### Features

- **angular:** Promote RibbonComponent for independent composition (by @ChristopherVR) ([00ab33e](https://github.com/ChristopherVR/pptx-viewer/commit/00ab33e515857cd60a5aef01537c1024297e08e5))
- **vanilla:** Export createRibbon for independent composition (by @ChristopherVR) ([521d494](https://github.com/ChristopherVR/pptx-viewer/commit/521d4943e2d457d87e5305c15090928212c58a3c))
- **react:** Export Toolbar/SlideCanvas + useViewerBuildingBlocks hook (by @ChristopherVR) ([37220c3](https://github.com/ChristopherVR/pptx-viewer/commit/37220c3afa1f7eaf62ec9eaa6fca72ee6ab19d7d))
- **svelte:** Export Ribbon/ViewerToolbar + createViewerState factory (by @ChristopherVR) ([8a16608](https://github.com/ChristopherVR/pptx-viewer/commit/8a1660818a586d6b25f0c6c7ab418efd59cd45f6))

### Bug Fixes

- **core:** Preserve OMML sibling order through parse, save, and markdown (by @ChristopherVR) ([54e5de5](https://github.com/ChristopherVR/pptx-viewer/commit/54e5de5b4c0bc1509e80bf632a8d3c2a5c24be38))
- **react:** Make useViewerBuildingBlocks test poll a wall-clock deadline (by @ChristopherVR) ([e57e00d](https://github.com/ChristopherVR/pptx-viewer/commit/e57e00dd1185f7614514f95845cfd69a11347677))
- **core:** Resolve ReDoS and prototype pollution in OMML sibling-order scan (by @ChristopherVR) ([2eef210](https://github.com/ChristopherVR/pptx-viewer/commit/2eef210de3c5a366be8721e420aaac6a5643b0af))

### Refactor

- **shared:** Emit core's ordered-key convention for interleaved OMML (by @ChristopherVR) ([81db024](https://github.com/ChristopherVR/pptx-viewer/commit/81db024967197fbc1ee65b27a00419613637f5f2))

### Build & CI

- **release:** Keep only the latest github release per package (by @ChristopherVR) ([3dcd838](https://github.com/ChristopherVR/pptx-viewer/commit/3dcd838c5f05ee75e3485b096376c7dbea02500c))
- Fix oxfmt quoting in prune-releases workflow (by @ChristopherVR) ([a95adad](https://github.com/ChristopherVR/pptx-viewer/commit/a95adadcb5c332c2b924807be6b03f8e8752bd9e))

## 2026-07-18

_Releases: pptx-viewer-core@1.6.3, pptx-react-viewer@1.23.0, pptx-vue-viewer@1.23.0, pptx-angular-viewer@1.29.0, pptx-vanilla-viewer@0.15.0, pptx-svelte-viewer@1.4.0_

### Features

- **shared:** Shared equation template catalogue for the editor dialogs (by @ChristopherVR) ([9828ff9](https://github.com/ChristopherVR/pptx-viewer/commit/9828ff98316b541f9702e15c11b06fa19cb62d26))
- **svelte:** React-parity modal equation editor dialog (by @ChristopherVR) ([d52f341](https://github.com/ChristopherVR/pptx-viewer/commit/d52f3410d6d8bd99f548fd30a4e5b0dfdb22bfd0))
- **vanilla:** React-parity modal equation editor dialog with styles (by @ChristopherVR) ([a872715](https://github.com/ChristopherVR/pptx-viewer/commit/a87271553635eb83b6aa91ad11a506dc313fd4e3))
- **vue:** Export RibbonToolbar for independent composition (by @ChristopherVR) ([00a57ca](https://github.com/ChristopherVR/pptx-viewer/commit/00a57ca4f96339edc1b79d544f71330558f2ceff))

### Bug Fixes

- **shared:** Emit inspector accent and border theme tokens (by @ChristopherVR) ([cf3e12e](https://github.com/ChristopherVR/pptx-viewer/commit/cf3e12e907be9c90872120dc03ee8d840253e6b4))
- **react:** Scrollable ribbon, escaped popups, and toolbar chrome fixes (by @ChristopherVR) ([266433b](https://github.com/ChristopherVR/pptx-viewer/commit/266433bbc1e9e0b31384776bfbb0b1a7e28513a4))
- **vue:** Stop pinning the demo theme so the appearance picker works (by @ChristopherVR) ([635c496](https://github.com/ChristopherVR/pptx-viewer/commit/635c4969d0336cd597abc5f9ae1adeacbff90160))
- **svelte:** Top-bar cog, add-slide rail button, and inspector parity (by @ChristopherVR) ([b4cf8de](https://github.com/ChristopherVR/pptx-viewer/commit/b4cf8de4dd333e99d39ac12a3f1a87086bc7052c))
- **angular:** Themeable chrome, settings cog, and ribbon polish (by @ChristopherVR) ([8960219](https://github.com/ChristopherVR/pptx-viewer/commit/8960219fbfb33562e6ed1c94380d17cdd23eb63c))
- **vanilla:** Settings cog icon, themed collab dialogs, add-slide button (by @ChristopherVR) ([034e57b](https://github.com/ChristopherVR/pptx-viewer/commit/034e57bfc32bb92b8d2b8240b165f47d495a9216))
- **shared:** Preserve operator order in LaTeX to OMML conversion (by @ChristopherVR) ([0357d90](https://github.com/ChristopherVR/pptx-viewer/commit/0357d904155ebf8cb60513b52c57fc9266bf2496))
- **vue:** Make viewer chrome fully theme-var driven; dock notes bar (by @ChristopherVR) ([5923a65](https://github.com/ChristopherVR/pptx-viewer/commit/5923a65f0c884d36565b978ca8825e998e3bf850))
- **angular:** Themeable chrome, root-theme demo, ribbon + thumbnail parity (by @ChristopherVR) ([295221e](https://github.com/ChristopherVR/pptx-viewer/commit/295221e88a20fc6cd9b7c36aa5f893722c498856))
- **vanilla:** Align chrome parity nits with the React reference (by @ChristopherVR) ([b84be6f](https://github.com/ChristopherVR/pptx-viewer/commit/b84be6fdd08d6c3c0fb4cc4f789638b921a09f33))
- **svelte:** Light-theme chrome parity, overflow menu, ribbon scroll (by @ChristopherVR) ([c04e912](https://github.com/ChristopherVR/pptx-viewer/commit/c04e9125c1d5271115b78d30cd7aa0ee4fd62d61))

### Refactor

- **react:** Consume the shared equation template catalogue (by @ChristopherVR) ([4c1b7cc](https://github.com/ChristopherVR/pptx-viewer/commit/4c1b7cce62868b7da49a36bc0660d48d5329d4fd))
- **vue:** Consume the shared equation template catalogue (by @ChristopherVR) ([4b9cf5b](https://github.com/ChristopherVR/pptx-viewer/commit/4b9cf5b1abca7db522535bfaac9b0a1d97835861))
- **angular:** Consume the shared equation template catalogue (by @ChristopherVR) ([37ebda3](https://github.com/ChristopherVR/pptx-viewer/commit/37ebda35af129ad014064f23d681b5913b6d68ba))

### Testing

- **e2e:** Make generated fixtures deterministic to stop git churn (by @ChristopherVR) ([aea5d49](https://github.com/ChristopherVR/pptx-viewer/commit/aea5d49775548107f185c0431721f095bec9877f))

### Dependencies

- **deps:** Sync bun.lock with current manifests (by @ChristopherVR) ([6c19a9c](https://github.com/ChristopherVR/pptx-viewer/commit/6c19a9c1af80525aaac79b7154b11a30f6e2df2a))
- **deps:** Update dependencies to latest and migrate core/shared/locales to TypeScript 7 (by @ChristopherVR) ([cc72948](https://github.com/ChristopherVR/pptx-viewer/commit/cc729482cc5ae4ae56e1219f290c2953ec83c12a))

### Chores

- Add project verify skill for live demo verification (by @ChristopherVR) ([9e6366b](https://github.com/ChristopherVR/pptx-viewer/commit/9e6366b73b4b10610146d17d4c21a75be5d4585f))

## 2026-07-18

_Releases: pptx-react-viewer@1.22.2, pptx-vue-viewer@1.22.1, pptx-angular-viewer@1.28.1, pptx-vanilla-viewer@0.14.0, pptx-svelte-viewer@1.3.0_

### Features

- **svelte:** Docked per-element animation panel at React parity (by @ChristopherVR) ([65a9e50](https://github.com/ChristopherVR/pptx-viewer/commit/65a9e5063719e20cb408e970c5b48e7ea20e546e))
- **vanilla:** Docked animation panel and threaded comment editing (by @ChristopherVR) ([b497528](https://github.com/ChristopherVR/pptx-viewer/commit/b49752886321e7d0b9b806291d533c3e10ca9d1b))

### Bug Fixes

- **react:** Persist tag edits on save (by @ChristopherVR) ([43e541b](https://github.com/ChristopherVR/pptx-viewer/commit/43e541bf41e91a9108748080954efefb4cff0a73))
- **angular:** Make Home-tab Drawing shape insert actually insert (by @ChristopherVR) ([2e51ec7](https://github.com/ChristopherVR/pptx-viewer/commit/2e51ec73dc27975a146f3d0885d05a5e5b47c7c0))
- **svelte:** Ship jszip and fast-xml-parser as real dependencies (by @ChristopherVR) ([20d8cf2](https://github.com/ChristopherVR/pptx-viewer/commit/20d8cf2de4ff94de2598143bfc9a8aa1c9d26f71))
- **vanilla:** Ship jszip and fast-xml-parser as real dependencies (by @ChristopherVR) ([786186d](https://github.com/ChristopherVR/pptx-viewer/commit/786186db8a0cdc8acf2cb4988a25865388b7a5af))
- **angular:** Persist Info-dialog document-property edits on save (by @ChristopherVR) ([8d9b3a7](https://github.com/ChristopherVR/pptx-viewer/commit/8d9b3a740a60bfe697b482f6bca2be91b14659b1))
- **react:** Expose Templates On/Off state on the View-tab toggle (by @ChristopherVR) ([dc7cddf](https://github.com/ChristopherVR/pptx-viewer/commit/dc7cddf162fa0359680195ff4341c53e043e500b))
- **svelte:** Stop aria-hiding non-interactive slide stages (by @ChristopherVR) ([d7678d6](https://github.com/ChristopherVR/pptx-viewer/commit/d7678d64729ec7174f9b82b0ff7a646ac6981502))
- **vue:** Single slide region and marker-free static stages (by @ChristopherVR) ([fa3b635](https://github.com/ChristopherVR/pptx-viewer/commit/fa3b635c2027eed8810164889243af39aa3625df))
- **angular:** Start the format pane closed on mobile (by @ChristopherVR) ([906bb98](https://github.com/ChristopherVR/pptx-viewer/commit/906bb982ad87e3b4e87737142debd45991a9402c))
- **vanilla:** Present-mode thumbnail hiding and touch inline editing (by @ChristopherVR) ([42a941b](https://github.com/ChristopherVR/pptx-viewer/commit/42a941b959821006d347b50588c45e3a184a1e2c))
- **angular:** Stop undo from wiping the history via the deck-seed effect (by @ChristopherVR) ([a3c2ec0](https://github.com/ChristopherVR/pptx-viewer/commit/a3c2ec05c431e0851513ecf8144dd64f8f1dbc64))
- **svelte:** Let the Slide Master button expose its visible name (by @ChristopherVR) ([b077aac](https://github.com/ChristopherVR/pptx-viewer/commit/b077aacc9eb113cdc7dc03700e0d0efd83f827d4))

### Documentation

- **site:** Rebuild landing page with install picker, quickstart, and FAQ (by @ChristopherVR) ([053bd4d](https://github.com/ChristopherVR/pptx-viewer/commit/053bd4d40279692a1f71e02b4aeb6d4816fcb946))
- Single-command install for svelte and vanilla bindings (by @ChristopherVR) ([2e3dfe0](https://github.com/ChristopherVR/pptx-viewer/commit/2e3dfe01366dc2cfd5958f3161baade2e71c84cf))
- Restyle documentation pages, deepen reference content, add screenshots (by @ChristopherVR) ([ab04926](https://github.com/ChristopherVR/pptx-viewer/commit/ab049268c6eaa7a5baae9dbe1643e50e2aa0d684))
- Plain-spoken tone, goal-based navigation hub, deeper user and API guides (by @ChristopherVR) ([d6b6aa4](https://github.com/ChristopherVR/pptx-viewer/commit/d6b6aa4329a66b7b281d1a1920afcead7be88c64))

### Testing

- **e2e:** Align ribbon parity spec with backstage File and tall View tab (by @ChristopherVR) ([665dcf3](https://github.com/ChristopherVR/pptx-viewer/commit/665dcf321924169d91c628c27b960e091e39bdba))
- **e2e:** Drive the backstage Save flow through a shared exact helper (by @ChristopherVR) ([fa72b10](https://github.com/ChristopherVR/pptx-viewer/commit/fa72b10e0928fa6a842202d3869694aae583a4ba))

### Build & CI

- Build pptx-viewer-locales in the foundation step (by @ChristopherVR) ([9a7d617](https://github.com/ChristopherVR/pptx-viewer/commit/9a7d61755176658107d88ab94899e359a895b61c))

## 2026-07-18

_Releases: pptx-react-viewer@1.22.1, pptx-vue-viewer@1.22.0, pptx-angular-viewer@1.28.0, pptx-vanilla-viewer@0.13.0, pptx-svelte-viewer@1.2.0_

### Features

- **angular:** Tabbed default inspector at React parity (by @ChristopherVR) ([a415ed6](https://github.com/ChristopherVR/pptx-viewer/commit/a415ed6f50ce4eff01cf04f121412852a4acf5b7))
- **vue:** Tabbed default inspector at React parity (by @ChristopherVR) ([c057f5c](https://github.com/ChristopherVR/pptx-viewer/commit/c057f5c24e4fae931d9f5b50a97e1fd917090490))
- **svelte:** Ribbon and chrome parity with React (by @ChristopherVR) ([41b5bf1](https://github.com/ChristopherVR/pptx-viewer/commit/41b5bf100afb99b58a7db3d2d0b26ccc77d413fc))
- **vanilla:** Ribbon and chrome parity with React (by @ChristopherVR) ([c385ee9](https://github.com/ChristopherVR/pptx-viewer/commit/c385ee9a83f6d2228767bb489b97bf57d404aef5))
- **vue:** Port React TagsSection with tag persistence on save (by @ChristopherVR) ([cd110c4](https://github.com/ChristopherVR/pptx-viewer/commit/cd110c478c662fd722cf706c394b0bcc0897eaf4))
- **angular:** Persistent inspector tabs, docProps save, Home Arrange group (by @ChristopherVR) ([40606e5](https://github.com/ChristopherVR/pptx-viewer/commit/40606e5ca8bc521a6fdd73c86c6a76a11f7b4b56))
- **svelte:** Full React-parity Properties sections in the inspector (by @ChristopherVR) ([2afd746](https://github.com/ChristopherVR/pptx-viewer/commit/2afd74633dadb0634db3b19fb42864394cd00c21))
- **vanilla:** Full React-parity Properties sections in the inspector (by @ChristopherVR) ([c8ef0c0](https://github.com/ChristopherVR/pptx-viewer/commit/c8ef0c021237a3a130e4c192ee07b19ee9500916))

### Bug Fixes

- **angular:** Restore horizontal ribbon layout and dedup Home font/paragraph groups (by @ChristopherVR) ([fd7e1d2](https://github.com/ChristopherVR/pptx-viewer/commit/fd7e1d20f7e93e56354e6b955714e3879fe3d4d4))
- **vue:** Show "All saved" for settled autosave state like React (by @ChristopherVR) ([b154e59](https://github.com/ChristopherVR/pptx-viewer/commit/b154e59ea8153ea2d6fafd0fe34fd47b750fb772))
- **react:** Stop the 24px tap-target floor from ballooning small controls (by @ChristopherVR) ([1d068f8](https://github.com/ChristopherVR/pptx-viewer/commit/1d068f83049825ffad45f834f039f6e1450eeec5))
- **vue:** Stop the 24px tap-target floor from ballooning small controls (by @ChristopherVR) ([f8a0ed8](https://github.com/ChristopherVR/pptx-viewer/commit/f8a0ed8ed796f1cd1e92bd143e951bb609137fbd))
- **angular:** Stop the 24px tap-target floor from ballooning small controls (by @ChristopherVR) ([c6b2e7f](https://github.com/ChristopherVR/pptx-viewer/commit/c6b2e7fe277950ef6fe7022dd76c4f19d5eb8a24))
- **vanilla:** Stop the 24px tap-target floor from ballooning small controls (by @ChristopherVR) ([297e3cf](https://github.com/ChristopherVR/pptx-viewer/commit/297e3cfffd603165b3079b9444320369a11fb7b3))

## 2026-07-17

_Releases: pptx-react-viewer@1.22.0, pptx-vue-viewer@1.21.0, pptx-angular-viewer@1.27.0, pptx-vanilla-viewer@0.12.0, pptx-svelte-viewer@1.1.0_

### Features

- **react:** Add theme/language switching and a real Account page (by @ChristopherVR) ([f2b4d8b](https://github.com/ChristopherVR/pptx-viewer/commit/f2b4d8b209a26b21aa71a5e28eb4066d9bbf9500))
- **vue:** Add theme/language switching and a real Account page (by @ChristopherVR) ([234dd01](https://github.com/ChristopherVR/pptx-viewer/commit/234dd01e997c88eeeb20a9187dff8268a2f56693))
- **angular:** Add theme/language switching and a real Account page (by @ChristopherVR) ([b33cdb9](https://github.com/ChristopherVR/pptx-viewer/commit/b33cdb92e44b149f73319945aa230068d35370cb))
- **vanilla:** Persist theme/language switching and add a real Account page (by @ChristopherVR) ([c6959e0](https://github.com/ChristopherVR/pptx-viewer/commit/c6959e094a2d3ba044ecac6cced6076394ab40de))
- **svelte:** Add theme/language switching and a real Account page (by @ChristopherVR) ([499fef4](https://github.com/ChristopherVR/pptx-viewer/commit/499fef497be18a8137ed3956e5dce2186ad31411))

### Other

- Integrate React theme/language switching and Account page (by @ChristopherVR) ([2fb0854](https://github.com/ChristopherVR/pptx-viewer/commit/2fb0854ed4f4505dbb22889aa6c4e5d3c2540094))
- Integrate Vue theme/language switching and Account page (by @ChristopherVR) ([0f8915a](https://github.com/ChristopherVR/pptx-viewer/commit/0f8915af7c7a70b610128c7c931c0750504010bc))
- Integrate Angular theme/language switching and Account page (by @ChristopherVR) ([2683183](https://github.com/ChristopherVR/pptx-viewer/commit/2683183be0508b4f5322e1909cfc762e6f7a82cc))
- Integrate Vanilla theme/language persistence and Account page (by @ChristopherVR) ([d86984f](https://github.com/ChristopherVR/pptx-viewer/commit/d86984fdd63c3305c3f3f4654b7be0d719514896))
- Integrate Svelte theme/language switching and Account page (by @ChristopherVR) ([2f1488e](https://github.com/ChristopherVR/pptx-viewer/commit/2f1488e435497e967bf2fe268d7495778957245b))

### Documentation

- Document theme/language switching and Account sign-in wiring (by @ChristopherVR) ([f883eff](https://github.com/ChristopherVR/pptx-viewer/commit/f883eff0ae285b580cb7cad1091e29fc60ab14ab))

## 2026-07-17

_Releases: pptx-react-viewer@1.21.0, pptx-angular-viewer@1.26.0, pptx-vanilla-viewer@0.11.0_

### Features

- **react:** Add hiddenActions prop to hide individual toolbar/ribbon actions (by @ChristopherVR) ([3eaabcd](https://github.com/ChristopherVR/pptx-viewer/commit/3eaabcd208793c5a53f2c45b1b9fd948830e75ea))
- **vanilla:** Add hiddenActions option to hide individual toolbar/ribbon actions (by @ChristopherVR) ([2c6af54](https://github.com/ChristopherVR/pptx-viewer/commit/2c6af54d21ed93fa6b8151d7c5812cf37a3a8885))
- **angular:** Add hiddenActions input to hide individual toolbar/ribbon actions (by @ChristopherVR) ([61eb995](https://github.com/ChristopherVR/pptx-viewer/commit/61eb995be25b317f2172a5983b83575deaefc16c))

### Other

- Integrate release version bumps (by @ChristopherVR) ([4b3893f](https://github.com/ChristopherVR/pptx-viewer/commit/4b3893f4158803cc5533beb266ffdc8c776177cb))

## 2026-07-17

_Releases: pptx-angular-viewer@1.25.0_

## 2026-07-17

_Releases: pptx-angular-viewer@1.24.0_

## 2026-07-17

_Releases: pptx-viewer-core@1.6.2, pptx-react-viewer@1.20.0, pptx-vue-viewer@1.20.0, pptx-angular-viewer@1.23.0, pptx-vanilla-viewer@0.10.0, pptx-svelte-viewer@1.0.0_

### Features

- **shared:** Add theme/locale catalogs, viewer prefs storage, and account model (by @ChristopherVR) ([9b9ad18](https://github.com/ChristopherVR/pptx-viewer/commit/9b9ad1888507dc879693f5d9b844ddcaabad909a))
- **svelte:** Add hiddenActions prop to hide individual toolbar/ribbon actions (by @ChristopherVR) ([dbc6a7d](https://github.com/ChristopherVR/pptx-viewer/commit/dbc6a7d4c9480de00d269697820092de426f600e))
- **vue:** Add hiddenActions prop to hide individual toolbar/ribbon actions (by @ChristopherVR) ([2e917df](https://github.com/ChristopherVR/pptx-viewer/commit/2e917df9f2703fe5e56de0015b20744697092ff7))

### Bug Fixes

- **svelte:** Ship extracted stylesheet instead of runtime-injected CSS (by @ChristopherVR) ([80270a1](https://github.com/ChristopherVR/pptx-viewer/commit/80270a17e39ed6a8d06189fa21c99a56ccb88490))
- **shared:** Add missing toolbar-actions module (by @ChristopherVR) ([21144f5](https://github.com/ChristopherVR/pptx-viewer/commit/21144f525fcd4aff77ec42dc98cdd599c98cddf9))
- **angular:** Resolve pptx-viewer-shared imports via the vendored copy (by @ChristopherVR) ([f8a67c5](https://github.com/ChristopherVR/pptx-viewer/commit/f8a67c5f22dc5e89e08915d2d19eca98dc07c73c))

### Styling

- Fix oxfmt formatting drift blocking CI (by @ChristopherVR) ([4f26420](https://github.com/ChristopherVR/pptx-viewer/commit/4f26420ce8db8eae9176f315a6450d843054e2a6))

## 2026-07-17

_Releases: pptx-angular-viewer@1.22.0_

## 2026-07-17

_Releases: pptx-viewer-core@1.6.1, pptx-react-viewer@1.19.1, pptx-vue-viewer@1.19.1, pptx-angular-viewer@1.21.0, pptx-vanilla-viewer@0.9.1, pptx-svelte-viewer@0.9.1, pptx-viewer-mcp@1.3.1, @christophervr/pptx-viewer@1.5.4_

### Bug Fixes

- **shared:** Close XSS/injection gaps flagged by code scanning (by @ChristopherVR) ([9671a8f](https://github.com/ChristopherVR/pptx-viewer/commit/9671a8fa2df0de2de8feb77ed1e6ac23be497dd4))

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## 2026-07-17

_Releases: pptx-angular-viewer@1.20.0_

## 2026-07-17

_Releases: pptx-viewer-core@1.6.0, pptx-react-viewer@1.19.0, pptx-vue-viewer@1.19.0, pptx-angular-viewer@1.19.0, pptx-vanilla-viewer@0.9.0, pptx-svelte-viewer@0.9.0_

### Features

- **angular:** Copy slides as images (by @ChristopherVR) ([579b699](https://github.com/ChristopherVR/pptx-viewer/commit/579b6998de9d3538f710b1da1da8e149e9e0f66e))
- **core:** Preserve DrawingML image color effects (by @ChristopherVR) ([5ed726d](https://github.com/ChristopherVR/pptx-viewer/commit/5ed726d401a5a4e399854b77af63032287204ad1))
- **core:** Model PresentationML view geometry (by @ChristopherVR) ([3b07978](https://github.com/ChristopherVR/pptx-viewer/commit/3b07978204770e51d0470e624dbb0073844587e7))
- **core:** Round-trip ChartML markers and data points (by @ChristopherVR) ([ae8edc5](https://github.com/ChristopherVR/pptx-viewer/commit/ae8edc5514fb6ce1974bd912aa6d59a2844c4f22))
- **angular:** Save slideshow formats (by @ChristopherVR) ([d2e03eb](https://github.com/ChristopherVR/pptx-viewer/commit/d2e03ebe50a7a798942911997b78b10418dbae85))
- **shared:** Build package sharing readmes (by @ChristopherVR) ([01a9bd6](https://github.com/ChristopherVR/pptx-viewer/commit/01a9bd67d7ad7dbf406011a98308368425ff901b))
- **angular:** Package presentations for sharing (by @ChristopherVR) ([ea72c80](https://github.com/ChristopherVR/pptx-viewer/commit/ea72c802202780549f7807c89754b792ac92d89a))
- **vanilla:** Copy slides as images (by @ChristopherVR) ([81e8dab](https://github.com/ChristopherVR/pptx-viewer/commit/81e8dab342f0b2763865009655e32e81399f552e))
- **vanilla:** Save slideshow formats (by @ChristopherVR) ([6bad85c](https://github.com/ChristopherVR/pptx-viewer/commit/6bad85c2264e431561b445b902bddd4254a442a3))
- **vanilla:** Package presentations for sharing (by @ChristopherVR) ([b6001c1](https://github.com/ChristopherVR/pptx-viewer/commit/b6001c18cc7bbde7a2679f77229e425e54e7345e))
- **svelte:** Copy slides as images (by @ChristopherVR) ([5bccc6b](https://github.com/ChristopherVR/pptx-viewer/commit/5bccc6b8f0f0b5a011d6454c8be434875c4b4297))
- **svelte:** Save slideshow formats (by @ChristopherVR) ([f27c7ee](https://github.com/ChristopherVR/pptx-viewer/commit/f27c7ee3658c7c19e8f214f0d9a17cf0726a7eeb))
- **svelte:** Package presentations for sharing (by @ChristopherVR) ([d490436](https://github.com/ChristopherVR/pptx-viewer/commit/d4904367717bc96350119e3cbe574af47046ed73))
- **vue:** Expose collaboration building blocks (by @ChristopherVR) ([4679574](https://github.com/ChristopherVR/pptx-viewer/commit/46795744d9f9d704a0c5772b48f89963848c0e4d))
- **svelte:** Edit SmartArt nodes on canvas (by @ChristopherVR) ([304d9c2](https://github.com/ChristopherVR/pptx-viewer/commit/304d9c2da58430d58831d80289b12a25558c37b6))
- **core:** Add DiagramML definition headers (by @ChristopherVR) ([314f9fa](https://github.com/ChristopherVR/pptx-viewer/commit/314f9fa1b1545ad423b1c5d40032b8b26e1fadc4))
- **core:** Complete DrawingML alpha effects (by @ChristopherVR) ([3a402f4](https://github.com/ChristopherVR/pptx-viewer/commit/3a402f479d0014610baa66d9c9c2d52426a383b7))
- **core:** Add ChartML print settings (by @ChristopherVR) ([f519b19](https://github.com/ChristopherVR/pptx-viewer/commit/f519b19cc75eeca4ec54384d8678918c9c764501))
- **vanilla:** Edit SmartArt nodes on canvas (by @ChristopherVR) ([ad79e23](https://github.com/ChristopherVR/pptx-viewer/commit/ad79e2342146fcbbd4ff6c0c65b33386e679819f))
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
- **svelte:** Manage slide sections (by @ChristopherVR) ([15f1581](https://github.com/ChristopherVR/pptx-viewer/commit/15f15818d4c6c8a1a86ff1da78a4f47d0191922a))
- **core:** Edit DiagramML layout control flow (by @ChristopherVR) ([74fb263](https://github.com/ChristopherVR/pptx-viewer/commit/74fb263fcb1059f570d1163b014d57d849c8415d))
- **core:** Complete PresentationML kinsoku (by @ChristopherVR) ([9cc5604](https://github.com/ChristopherVR/pptx-viewer/commit/9cc5604030c03544505077bf75adf7803f147d9f))
- **core:** Edit ChartML pivot formats (by @ChristopherVR) ([87a646a](https://github.com/ChristopherVR/pptx-viewer/commit/87a646a2551099bb8f71e9b2e474375438e6d37f))
- **angular:** Manage slide sections (by @ChristopherVR) ([3fc7b8c](https://github.com/ChristopherVR/pptx-viewer/commit/3fc7b8cd2e70adc3248ddf58aa595880a84be53f))
- **vanilla:** Manage slide sections (by @ChristopherVR) ([da5e500](https://github.com/ChristopherVR/pptx-viewer/commit/da5e500172c3003b705cff599ae51779e081dcbb))
- **svelte:** Move slides between sections (by @ChristopherVR) ([6625519](https://github.com/ChristopherVR/pptx-viewer/commit/6625519c3fd305e01656ca53b63ab14eaa840386))
- **angular:** Move slides between sections (by @ChristopherVR) ([7e49822](https://github.com/ChristopherVR/pptx-viewer/commit/7e4982227961b191727fbd529dc9e37969d11088))
- **vanilla:** Move slides between sections (by @ChristopherVR) ([9cee695](https://github.com/ChristopherVR/pptx-viewer/commit/9cee69551f9bb91d55b4f2d6bdc0162939b47bb8))
- **shared:** Compute live document statistics (by @ChristopherVR) ([13159a2](https://github.com/ChristopherVR/pptx-viewer/commit/13159a29a72bed8105dee689af07b41cd70d3e3c))
- **core:** Export rich elements as SVG (by @ChristopherVR) ([508fc6c](https://github.com/ChristopherVR/pptx-viewer/commit/508fc6cbd074dec5d7a0655b0c700ea6a95cd058))
- **svelte:** Edit document properties (by @ChristopherVR) ([47fe556](https://github.com/ChristopherVR/pptx-viewer/commit/47fe5564c62b203028e476751bc32393a9ec012c))
- **core:** Persist chart palette and axis positions (by @ChristopherVR) ([69b05bd](https://github.com/ChristopherVR/pptx-viewer/commit/69b05bdc3cf86c883d16c4f1b9ddef1563ad99e7))
- **vanilla:** Persist document properties (by @ChristopherVR) ([9e78c78](https://github.com/ChristopherVR/pptx-viewer/commit/9e78c78ce2da7d7383a442a4cda6a9ce267fb817))
- **vanilla:** Add document properties dialog (by @ChristopherVR) ([99b0f9e](https://github.com/ChristopherVR/pptx-viewer/commit/99b0f9e531d1cd704ef69b02df96951cceba33cb))
- **vanilla:** Expose document properties editor (by @ChristopherVR) ([ea2e296](https://github.com/ChristopherVR/pptx-viewer/commit/ea2e296b5e2431b55ccbcae6e073fa76b3f2399b))
- **shared:** Resolve image source effects (by @ChristopherVR) ([7400764](https://github.com/ChristopherVR/pptx-viewer/commit/74007645ae432d7e2b3cd8394fd04f6dde9cce61))
- **vanilla:** Open properties from File tab (by @ChristopherVR) ([404affe](https://github.com/ChristopherVR/pptx-viewer/commit/404affe4ba4e2bc6e325d43c8687e6d312ad1020))
- **svelte:** Retain file info metadata (by @ChristopherVR) ([b29b1b7](https://github.com/ChristopherVR/pptx-viewer/commit/b29b1b7f8f96c37043db766c49339a2980a2bcbc))
- **svelte:** Add embed fonts panel (by @ChristopherVR) ([0471ef6](https://github.com/ChristopherVR/pptx-viewer/commit/0471ef614bd7563eaaa50b80117ef7c07c4fd9d9))
- **vanilla:** Add vector SVG export and printing (by @ChristopherVR) ([5a4db85](https://github.com/ChristopherVR/pptx-viewer/commit/5a4db85e82ddeaba71828c60b15de3b652bef6ba))
- **svelte:** Add File Info security dialogs (by @ChristopherVR) ([b2532d8](https://github.com/ChristopherVR/pptx-viewer/commit/b2532d82f6589c68b9d863fd881278dc590de3d2))
- **svelte:** Add vector SVG export and printing (by @ChristopherVR) ([5df4ff8](https://github.com/ChristopherVR/pptx-viewer/commit/5df4ff82b3dbfe11ef208b49f09f54d9bea8966a))
- **svelte:** Wire File Info parity actions (by @ChristopherVR) ([2176554](https://github.com/ChristopherVR/pptx-viewer/commit/21765545e55f11d0bfe06510683ef3ae4f7411be))
- **angular:** Add vector SVG export and printing (by @ChristopherVR) ([5ca1670](https://github.com/ChristopherVR/pptx-viewer/commit/5ca1670cb35d1857e107ac874a61920662e4908c))
- **vanilla:** Retain file info metadata (by @ChristopherVR) ([12e6045](https://github.com/ChristopherVR/pptx-viewer/commit/12e60454262b8890191cd0ab1992fbbf76a24757))
- **vue:** Add vector SVG export and printing (by @ChristopherVR) ([e75d4ec](https://github.com/ChristopherVR/pptx-viewer/commit/e75d4ec366a149c06b9a7b1ca090d4efe859dae1))
- **vanilla:** Add File Info dialogs (by @ChristopherVR) ([d47965b](https://github.com/ChristopherVR/pptx-viewer/commit/d47965b75419a0df3bc80d97d5244d11126dfbb7))
- **vanilla:** Wire File Info parity actions (by @ChristopherVR) ([80872a4](https://github.com/ChristopherVR/pptx-viewer/commit/80872a4322a3b9c0cd49977085a305e1ebd80b94))
- **svelte:** Add recovery and signature surfaces (by @ChristopherVR) ([51a42f1](https://github.com/ChristopherVR/pptx-viewer/commit/51a42f199616415906c0c053b920c430f8d876f7))
- **svelte:** Wire recovery history workflows (by @ChristopherVR) ([e77e10d](https://github.com/ChristopherVR/pptx-viewer/commit/e77e10d2f4f4ce6591a07034e1d89b0feb468fcf))
- **vanilla:** Add recovery and signature surfaces (by @ChristopherVR) ([9bafe18](https://github.com/ChristopherVR/pptx-viewer/commit/9bafe18f7d883fda1ee2f39353a6dc27f7e38fa6))
- **vanilla:** Wire recovery history workflows (by @ChristopherVR) ([895e2fd](https://github.com/ChristopherVR/pptx-viewer/commit/895e2fdde9d6cbe1d85c723adfd1f40d2f871a90))
- **angular:** Add live viewer settings (by @ChristopherVR) ([f9078fb](https://github.com/ChristopherVR/pptx-viewer/commit/f9078fba9da07956f7bb902d4a1ef0ae13617fc1))
- **vue:** Apply live viewer settings (by @ChristopherVR) ([d7c2bb6](https://github.com/ChristopherVR/pptx-viewer/commit/d7c2bb6c9c28e18941ec1dbb6de43c0c04d90a66))
- **core:** Render funnel charts in SVG exports (by @ChristopherVR) ([efb6c36](https://github.com/ChristopherVR/pptx-viewer/commit/efb6c368fc6640a918cc6bbdc016b98c87e241ff))
- **vanilla:** Add parity workflow surfaces (by @ChristopherVR) ([7570d66](https://github.com/ChristopherVR/pptx-viewer/commit/7570d665c152ac295bda607c91117eca57ca2001))
- **core:** Author SDK funnel ChartEx parts (by @ChristopherVR) ([73265f4](https://github.com/ChristopherVR/pptx-viewer/commit/73265f4737f2f74705be380a2772586fd46557c0))
- **core:** Author SDK waterfall ChartEx parts (by @ChristopherVR) ([e5ff15b](https://github.com/ChristopherVR/pptx-viewer/commit/e5ff15b7aeab2c9b059963ae36aafd1b457ffe67))
- **shared:** Render chart axis tick formatting (by @ChristopherVR) ([5c22a9b](https://github.com/ChristopherVR/pptx-viewer/commit/5c22a9b4c96f3cb3d24c750dd4dab115ef42fb2b))
- **core:** Author SDK treemap ChartEx parts (by @ChristopherVR) ([9264fad](https://github.com/ChristopherVR/pptx-viewer/commit/9264fad20c51725136722369aef7393f334d1832))
- **svelte:** Add advanced parity workflows (by @ChristopherVR) ([ea9b352](https://github.com/ChristopherVR/pptx-viewer/commit/ea9b352ef4899adb3e930fcb78f674959c209d77))
- **core:** Round-trip sunburst hierarchy (by @ChristopherVR) ([3cc868e](https://github.com/ChristopherVR/pptx-viewer/commit/3cc868ea721d78f8ac48365e6a9cb4cb1abfe57c))
- **angular:** Add deep inspector authoring (by @ChristopherVR) ([f04baf3](https://github.com/ChristopherVR/pptx-viewer/commit/f04baf397b43936a9d39dc5761f637cf09e15f78))
- **vue:** Add action settings inspector (by @ChristopherVR) ([7a35918](https://github.com/ChristopherVR/pptx-viewer/commit/7a35918e8cdf6208b11135db6d12d323ae3be5b2))
- **vanilla:** Wire parity workflows (by @ChristopherVR) ([c801b1f](https://github.com/ChristopherVR/pptx-viewer/commit/c801b1f2fd0ea1616b23987be4226f9b715fa3a4))
- **bindings:** Wire deep inspector panels (by @ChristopherVR) ([1ce5e9b](https://github.com/ChristopherVR/pptx-viewer/commit/1ce5e9b5f6e58d437190609aed7775495d725c38))
- **core:** Round-trip PowerPoint slide Zoom (by @ChristopherVR) ([624c853](https://github.com/ChristopherVR/pptx-viewer/commit/624c853b6450f6c0f8b16d8789104ba6f2cc76e2))
- **core:** Author SDK box-whisker ChartEx parts (by @ChristopherVR) ([202496f](https://github.com/ChristopherVR/pptx-viewer/commit/202496f894d094535f8ca6fa9cad303c00f13a7c))
- **shared:** Render ChartEx sunburst hierarchy (by @ChristopherVR) ([0507e6f](https://github.com/ChristopherVR/pptx-viewer/commit/0507e6f98084ed566287fdc4e7e0ec5ded0629a6))
- **react:** Wire header and footer editor (by @ChristopherVR) ([81794db](https://github.com/ChristopherVR/pptx-viewer/commit/81794dbb27640a313e1daab376f574ae5ea69b92))
- **svelte:** Add advanced inspector authoring (by @ChristopherVR) ([2a333a2](https://github.com/ChristopherVR/pptx-viewer/commit/2a333a2bfd1b39c92208fa4cde2a2261ad27d2a4))
- **vanilla:** Add advanced inspector authoring (by @ChristopherVR) ([887be1c](https://github.com/ChristopherVR/pptx-viewer/commit/887be1c2565c1c017c144c4921a3254714b163de))
- **core:** Author histogram and Pareto ChartEx parts (by @ChristopherVR) ([b8d779c](https://github.com/ChristopherVR/pptx-viewer/commit/b8d779cd0923ceeeb39c0848cec25cd52223d5e3))
- **core:** Round-trip PowerPoint section Zoom (by @ChristopherVR) ([67a162f](https://github.com/ChristopherVR/pptx-viewer/commit/67a162f63f1b244a9fbf23621c9e7194b1538031))
- **vue:** Expose header and footer editor (by @ChristopherVR) ([bc80f9d](https://github.com/ChristopherVR/pptx-viewer/commit/bc80f9dc66845f8fb90dfa89db959bdfeaf975bc))
- **svelte:** Wire full parity workflows (by @ChristopherVR) ([08dc3c4](https://github.com/ChristopherVR/pptx-viewer/commit/08dc3c41ba51119d46043f249bad388f7383e062))
- **shared:** Add media trim timeline helpers (by @ChristopherVR) ([c8cc257](https://github.com/ChristopherVR/pptx-viewer/commit/c8cc2570f2466e026221596e3e8f09126864d35a))
- **angular:** Complete media and header footer parity (by @ChristopherVR) ([7367237](https://github.com/ChristopherVR/pptx-viewer/commit/73672373472257fd1ff455b1dd36f543559b31d6))
- **shared:** Render ChartEx distribution options (by @ChristopherVR) ([f0d2c22](https://github.com/ChristopherVR/pptx-viewer/commit/f0d2c222cc3193ecdff51d934117ccb1be50bde4))
- **vanilla:** Add theme and animation authoring (by @ChristopherVR) ([5af7e02](https://github.com/ChristopherVR/pptx-viewer/commit/5af7e02a89b934a5160bcf53fbda6d9564d8b4c9))
- **file:** Use Lucide icons in Svelte and Vanilla (by @ChristopherVR) ([a956f1b](https://github.com/ChristopherVR/pptx-viewer/commit/a956f1ba7c05c949db517184cd0413cc0271b8dc))
- **vanilla:** Complete chart and media inspectors (by @ChristopherVR) ([acbdcf5](https://github.com/ChristopherVR/pptx-viewer/commit/acbdcf533a8eeef3da4b4d787bea13a9b01bc3b5))
- **core:** Author SDK region-map ChartEx parts (by @ChristopherVR) ([9d0c676](https://github.com/ChristopherVR/pptx-viewer/commit/9d0c676231f91e967e89eb82fbae472b23172113))
- **angular:** Complete element inspector authoring (by @ChristopherVR) ([1a8ddea](https://github.com/ChristopherVR/pptx-viewer/commit/1a8ddea0dc9d8d6bd017a4139ebde17f721e35ed))
- **shared:** Render Summary Zoom section tiles (by @ChristopherVR) ([5266e10](https://github.com/ChristopherVR/pptx-viewer/commit/5266e10e28d611c99701c3e734ff9f22746aba42))
- **vanilla:** Add text and table cell authoring (by @ChristopherVR) ([69a0a6d](https://github.com/ChristopherVR/pptx-viewer/commit/69a0a6d6ff2d5882e41c34d988e83dd8080fec15))
- **svelte:** Render Summary Zoom section tiles (by @ChristopherVR) ([8d64e5d](https://github.com/ChristopherVR/pptx-viewer/commit/8d64e5dccc6ded241d4cefec437dc5c90c115215))
- **core:** Round-trip PowerPoint Summary Zoom (by @ChristopherVR) ([27c5671](https://github.com/ChristopherVR/pptx-viewer/commit/27c5671d6593d439f624cfbe2c9b37373fd6ec16))
- **angular:** Finish element inspector parity (by @ChristopherVR) ([b2cdece](https://github.com/ChristopherVR/pptx-viewer/commit/b2cdece85f9c827550d050ef00a5b4b7a807c47f))
- **shared:** Honor category axis ordering and ticks (by @ChristopherVR) ([45f7c1f](https://github.com/ChristopherVR/pptx-viewer/commit/45f7c1f13f2f92e07e3085fc060314b64060dd64))
- **core:** Author embedded 3D models (by @ChristopherVR) ([7189466](https://github.com/ChristopherVR/pptx-viewer/commit/7189466b8c86692c651a8eebc382d42ad8df56f1))
- **vue:** Preview relationship backed media (by @ChristopherVR) ([e37a7f9](https://github.com/ChristopherVR/pptx-viewer/commit/e37a7f9e4681a5d3318cdf05ef1046236fb034ec))
- **core:** Preserve ChartEx waterfall layout semantics (by @ChristopherVR) ([10feb1b](https://github.com/ChristopherVR/pptx-viewer/commit/10feb1bb15a5288d6607508a45ba030888d36adc))
- **vue:** Wire media inspector sources (by @ChristopherVR) ([fb67f2f](https://github.com/ChristopherVR/pptx-viewer/commit/fb67f2fc81995fdcae6c26fed8ee2f236e0ebff5))
- **core:** Author InkML content parts (by @ChristopherVR) ([b8df789](https://github.com/ChristopherVR/pptx-viewer/commit/b8df789682e6ca28e15e3a8732d550c016239b2a))
- **angular:** Complete animation timeline parity (by @ChristopherVR) ([a87590f](https://github.com/ChristopherVR/pptx-viewer/commit/a87590fdda0d3e92c4e930b25de4fef847eabb6d))
- **shared:** Render semantic Pareto charts (by @ChristopherVR) ([6fc6a5e](https://github.com/ChristopherVR/pptx-viewer/commit/6fc6a5e4b0b86601a198661e5e276573370d3414))
- **core:** Author user-defined tag parts (by @ChristopherVR) ([245dc7c](https://github.com/ChristopherVR/pptx-viewer/commit/245dc7cb9db4e69cb4b37c4d4e989ed6f0d8e2c8))
- **core:** Preserve classic date axis semantics (by @ChristopherVR) ([f9391cd](https://github.com/ChristopherVR/pptx-viewer/commit/f9391cde53a10058601d9a4a8205ea636f6a43c9))
- **vanilla:** Complete advanced authoring parity (by @ChristopherVR) ([32614bd](https://github.com/ChristopherVR/pptx-viewer/commit/32614bd0690ab98cbafb09bfd9c9d2417b6e8d8b))
- **vanilla:** Wire advanced authoring callbacks (by @ChristopherVR) ([10d0b8d](https://github.com/ChristopherVR/pptx-viewer/commit/10d0b8de517949a21ce473315f895790c3d233bd))
- **core:** Author customer data parts (by @ChristopherVR) ([8d99be8](https://github.com/ChristopherVR/pptx-viewer/commit/8d99be831377d08cde510603ae8c9b00c0985169))
- **vanilla:** Expose view parity handlers (by @ChristopherVR) ([03d870f](https://github.com/ChristopherVR/pptx-viewer/commit/03d870f48ea80d481c99a198bb72a1d69a82e833))
- **vue:** Complete animation authoring parity (by @ChristopherVR) ([644aa2b](https://github.com/ChristopherVR/pptx-viewer/commit/644aa2b9a49109aabdfaa8cab71e8e2b046230e4))
- **vue:** Persist animation timeline edits (by @ChristopherVR) ([f336634](https://github.com/ChristopherVR/pptx-viewer/commit/f336634ac3b0c674e501c1035a249c238a0055c9))
- **svelte:** Complete advanced authoring parity (by @ChristopherVR) ([f539750](https://github.com/ChristopherVR/pptx-viewer/commit/f539750d3916647a827cd113e70e721bdccac5c3))
- **shared:** Render continuous date axes (by @ChristopherVR) ([d644399](https://github.com/ChristopherVR/pptx-viewer/commit/d6443991467a45ea92f1b3947a9a0253faa471c6))
- **react:** Align backstage and ribbon with PowerPoint (by @ChristopherVR) ([aa9fc44](https://github.com/ChristopherVR/pptx-viewer/commit/aa9fc44e6dec40bd8e28bac5888a0abf01ac5602))
- **svelte:** Wire view and review parity state (by @ChristopherVR) ([a8ab345](https://github.com/ChristopherVR/pptx-viewer/commit/a8ab345c484fe35f132fbf201ecce11ffe838da3))
- **svelte:** Expose view and spell check controls (by @ChristopherVR) ([dd72aea](https://github.com/ChristopherVR/pptx-viewer/commit/dd72aea8f90268b117889cddf2c827a9729e889a))
- **shared:** Render slide background patterns (by @ChristopherVR) ([2794b71](https://github.com/ChristopherVR/pptx-viewer/commit/2794b71c0f90f38af6417790e57deaaf2d4fc010))
- **shared:** Resolve picture bullet markers (by @ChristopherVR) ([172a5c0](https://github.com/ChristopherVR/pptx-viewer/commit/172a5c0b25b33d99593fffd3ff4ef3c0dee3a371))
- **core:** Preserve chart axis crossing semantics (by @ChristopherVR) ([3fbcbc0](https://github.com/ChristopherVR/pptx-viewer/commit/3fbcbc01812272d2984f22986af81135d0d08fd6))
- **vue:** Add functional record commands (by @ChristopherVR) ([ab79910](https://github.com/ChristopherVR/pptx-viewer/commit/ab79910deaa31eaad751e943befd28eee6462d39))
- **vue:** Wire review and record commands (by @ChristopherVR) ([ee37e65](https://github.com/ChristopherVR/pptx-viewer/commit/ee37e657aa3b1d131c89da9aa5f6f10d349b0c73))
- **vue:** Render picture bullet markers (by @ChristopherVR) ([ea73fe6](https://github.com/ChristopherVR/pptx-viewer/commit/ea73fe6d415230b98b2ee7b82173c7f0d513fe79))
- **vanilla:** Complete review and record commands (by @ChristopherVR) ([112ace2](https://github.com/ChristopherVR/pptx-viewer/commit/112ace284e90e7339ec15eb939a7deef5fe58ebb))
- **vanilla:** Connect file and record parity actions (by @ChristopherVR) ([2a6472b](https://github.com/ChristopherVR/pptx-viewer/commit/2a6472b9692433e1ce93791f3a0fc6e728759722))
- **svelte:** Render picture bullet markers (by @ChristopherVR) ([672466c](https://github.com/ChristopherVR/pptx-viewer/commit/672466c7b731c738198994768cf5d5829d9205fe))
- **vanilla:** Render picture bullet markers (by @ChristopherVR) ([022bb0e](https://github.com/ChristopherVR/pptx-viewer/commit/022bb0ef05b532c0702f7dac44f71876e0529162))
- **angular:** Add functional review and record commands (by @ChristopherVR) ([a923428](https://github.com/ChristopherVR/pptx-viewer/commit/a92342801bf3ed4106b5921623da0dadd83bcb2a))
- **angular:** Connect ribbon parity controls (by @ChristopherVR) ([eb113db](https://github.com/ChristopherVR/pptx-viewer/commit/eb113db246b4e8992a13b61aa3c6b78445ec7df0))
- **angular:** Wire review and rehearsal controls (by @ChristopherVR) ([8c83d83](https://github.com/ChristopherVR/pptx-viewer/commit/8c83d83ca64e8ca564dae1a214271e8df979579b))
- **shared:** Render X-direction chart error bars (by @ChristopherVR) ([c3f825b](https://github.com/ChristopherVR/pptx-viewer/commit/c3f825bfb5e08b7ac81cd16d7e580312edfbc154))
- **angular:** Render picture bullet markers (by @ChristopherVR) ([bff084b](https://github.com/ChristopherVR/pptx-viewer/commit/bff084b3ca11c82ffaf4ee07728475a15042a6aa))
- **svelte:** Add review file and record commands (by @ChristopherVR) ([49a130e](https://github.com/ChristopherVR/pptx-viewer/commit/49a130ec0909511a8fbc26e66c1b8daa822f6bc6))
- **svelte:** Wire parity commands through viewer (by @ChristopherVR) ([1183740](https://github.com/ChristopherVR/pptx-viewer/commit/1183740bc1ed44080930bb6e3d51e045476c7ac3))
- **shared:** Render chart axis crossings (by @ChristopherVR) ([38a2591](https://github.com/ChristopherVR/pptx-viewer/commit/38a259176035e4a7b5de60980233798759e7f202))
- **core:** Preserve ChartEx hierarchy and geography (by @ChristopherVR) ([4b8e3ab](https://github.com/ChristopherVR/pptx-viewer/commit/4b8e3abde0f4747cdbd7347ff48cb2156b9a3110))
- **shared:** Render hierarchical ChartEx treemaps (by @ChristopherVR) ([999f8f9](https://github.com/ChristopherVR/pptx-viewer/commit/999f8f938125e99dab09a17b8c940a7c9cfe225b))
- **shared:** Render ChartEx geography options (by @ChristopherVR) ([c2edbd7](https://github.com/ChristopherVR/pptx-viewer/commit/c2edbd7ac5d843e5d8a5190284ce32e792d541dd))
- **shared:** Render multi-level chart axes (by @ChristopherVR) ([d5d7008](https://github.com/ChristopherVR/pptx-viewer/commit/d5d7008f64c555046030a556e4306e06673108d6))
- **vue:** Complete File backstage parity (by @ChristopherVR) ([57d3341](https://github.com/ChristopherVR/pptx-viewer/commit/57d3341a8310e229b533403f581e94334a66fd3d))
- **vanilla:** Complete slideshow and read-only parity (by @ChristopherVR) ([44bbaef](https://github.com/ChristopherVR/pptx-viewer/commit/44bbaef86f4a973a23a766dcfdea5f6462278bc6))

### Bug Fixes

- **vue:** Package presentations for sharing (by @ChristopherVR) ([d382fe5](https://github.com/ChristopherVR/pptx-viewer/commit/d382fe5097478e2dfd51e1512c8ad48969e94fb0))
- **svelte:** Skip unchanged SmartArt edits (by @ChristopherVR) ([a54a507](https://github.com/ChristopherVR/pptx-viewer/commit/a54a507a5980b244f659c5a0bd2ac4eef063b075))
- **core:** Validate DiagramML iterator bounds (by @ChristopherVR) ([cb375ce](https://github.com/ChristopherVR/pptx-viewer/commit/cb375ce5ac221e854d3a6c203788a6795a5d1881))
- **core:** Correct DrawingML custom dash stops (by @ChristopherVR) ([9b7bd11](https://github.com/ChristopherVR/pptx-viewer/commit/9b7bd11da4438ce24c7e76fb421d07fb0b720d74))
- **shared:** Render complete image colour effects (by @ChristopherVR) ([2dc9969](https://github.com/ChristopherVR/pptx-viewer/commit/2dc9969660bb0c999f9d33bc09899f63105c1d24))
- **core:** Export complete image colour effects (by @ChristopherVR) ([e1468d3](https://github.com/ChristopherVR/pptx-viewer/commit/e1468d316711b56fc883efddb0c14a957b6630ae))
- **viewer:** Restore thumbnail colours and suppress bullets (by @ChristopherVR) ([4563d2d](https://github.com/ChristopherVR/pptx-viewer/commit/4563d2d0a60ec70febbb5b26b438b9f2de6782b8))
- **svelte:** Render image source effects (by @ChristopherVR) ([9ed6fc7](https://github.com/ChristopherVR/pptx-viewer/commit/9ed6fc7dd6227198ffaff6c06b0ff02211524cda))
- **vanilla:** Render image source effects (by @ChristopherVR) ([1623e00](https://github.com/ChristopherVR/pptx-viewer/commit/1623e008945de6d4552037e313d32d75369b4e30))
- **angular:** Render complete image effects (by @ChristopherVR) ([7c34864](https://github.com/ChristopherVR/pptx-viewer/commit/7c34864ef96614f501c4ccac657ffe0c187f5c02))
- **vue:** Render image color wash (by @ChristopherVR) ([4624c64](https://github.com/ChristopherVR/pptx-viewer/commit/4624c64f1dc4f3f770beb829a45949167c27545e))
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
- **angular:** Load compiled demo locales (by @ChristopherVR) ([a48af0f](https://github.com/ChristopherVR/pptx-viewer/commit/a48af0f1d883fbb360e40844044d1fded63a4a48))
- **core:** Reconcile SmartArt legacy text edits (by @ChristopherVR) ([13253b5](https://github.com/ChristopherVR/pptx-viewer/commit/13253b5a5b2f46c105d72f8952355195bd12c07a))
- **core:** Project SmartArt rich text to shapes (by @ChristopherVR) ([5b106a6](https://github.com/ChristopherVR/pptx-viewer/commit/5b106a671c42ed3ae1f4b1068b571d9e95110b3c))
- **shared:** Keep chart helpers target portable (by @ChristopherVR) ([db9d675](https://github.com/ChristopherVR/pptx-viewer/commit/db9d67551dcdf7105658048f812ec11668429221))
- **core:** Resolve SmartArt run text styles (by @ChristopherVR) ([6737afd](https://github.com/ChristopherVR/pptx-viewer/commit/6737afd47a0e3e7a9800da422b0730f4273271d7))
- **vue:** Connect media sources to inspectors (by @ChristopherVR) ([51c3e83](https://github.com/ChristopherVR/pptx-viewer/commit/51c3e832b222d1cecd0cd0dfad973e56588a38f9))
- **core:** Evaluate SmartArt layout rules (by @ChristopherVR) ([4a918fd](https://github.com/ChristopherVR/pptx-viewer/commit/4a918fd1664143d4def19211b5b8df10a5f68470))
- **core:** Guard SmartArt text order annotation (by @ChristopherVR) ([44d7013](https://github.com/ChristopherVR/pptx-viewer/commit/44d70131f2ed1f2fb9d4d62217a483ce2059021b))
- **core:** Preserve chart series option shape (by @ChristopherVR) ([87c0df4](https://github.com/ChristopherVR/pptx-viewer/commit/87c0df4ad34efae05e7479f1a2ace834d355481c))
- **shared:** Sync InkML collaboration fields (by @ChristopherVR) ([f2929cb](https://github.com/ChristopherVR/pptx-viewer/commit/f2929cbf44f53fc60fff32b1d958a2346bcee6f2))
- **angular:** Keep parity bindings inside ribbon hosts (by @ChristopherVR) ([1a753ce](https://github.com/ChristopherVR/pptx-viewer/commit/1a753ce0d94651992a028efbf9c71b1c0f17d53e))
- **angular:** Finalize ribbon command placement (by @ChristopherVR) ([f54a7f5](https://github.com/ChristopherVR/pptx-viewer/commit/f54a7f54ff2ac59ea1c4ea63e90c63802d9e857e))
- **react:** Guard missing picture bullet metadata (by @ChristopherVR) ([7848015](https://github.com/ChristopherVR/pptx-viewer/commit/7848015571a1aa3a27134e7d852fc5de39cf6f10))
- **vanilla:** Narrow picture bullet source (by @ChristopherVR) ([f75654d](https://github.com/ChristopherVR/pptx-viewer/commit/f75654dffc0931e1c40d172d35b44602d83bfe91))
- **vue:** Expose zoom to fit across view menus (by @ChristopherVR) ([6c3fcd2](https://github.com/ChristopherVR/pptx-viewer/commit/6c3fcd2bc2da006e4eea9398f6ef10f4829be260))
- **vue:** Keep zoom binding inside view sections (by @ChristopherVR) ([08960ff](https://github.com/ChristopherVR/pptx-viewer/commit/08960ffb8e2420201d467bc37022961b0e19e486))
- **svelte:** Match read-only and options behavior (by @ChristopherVR) ([910ec52](https://github.com/ChristopherVR/pptx-viewer/commit/910ec52d3f7c72c8c6dbb850ae4b9ad4e17d0b3b))
- Typecheck issues and lint (by @ChristopherVR) ([406b264](https://github.com/ChristopherVR/pptx-viewer/commit/406b264c8d21b413f346f7a6ce885960df56a265))

### Performance

- **vue:** Virtualize large slide decks (by @ChristopherVR) ([946debe](https://github.com/ChristopherVR/pptx-viewer/commit/946debec6d46ab2e536e28f48b91a4d6a5603c8e))
- **svelte:** Virtualize large slide decks (by @ChristopherVR) ([ca6cbb1](https://github.com/ChristopherVR/pptx-viewer/commit/ca6cbb1c34b90dcc5e57c631230be01eeb6c1cea))
- **vanilla:** Virtualize large slide decks (by @ChristopherVR) ([bc5ed4f](https://github.com/ChristopherVR/pptx-viewer/commit/bc5ed4fe168b7baa7a2ed05d9adb089e5c3b9bf5))
- **angular:** Virtualize large slide decks (by @ChristopherVR) ([603974e](https://github.com/ChristopherVR/pptx-viewer/commit/603974ec880d21e3b3dc7652f848218bbcdf8b2f))

### Refactor

- **react:** Share package readme builder (by @ChristopherVR) ([f3cd7e2](https://github.com/ChristopherVR/pptx-viewer/commit/f3cd7e23099eaca34e43e1a076f3ff7ae4afc7ae))
- **core:** Name OpenXML coverage by capability (by @ChristopherVR) ([1e25a7f](https://github.com/ChristopherVR/pptx-viewer/commit/1e25a7fbb929092af4ce080a4ed19eab28e87472))
- **react:** Share thumbnail virtualization (by @ChristopherVR) ([eb1990b](https://github.com/ChristopherVR/pptx-viewer/commit/eb1990be66583cc65488df8dde684f0e959a4c8d))
- **core:** Keep chart protection codec internal (by @ChristopherVR) ([da3fcc1](https://github.com/ChristopherVR/pptx-viewer/commit/da3fcc1d82c0a0b0f36e9d4d581aea0509915be2))
- **shared:** Generalize section grouping (by @ChristopherVR) ([ffc7fec](https://github.com/ChristopherVR/pptx-viewer/commit/ffc7fecb7c2c9fdee6f571abc41d9660abda1353))
- **react:** Share section grouping (by @ChristopherVR) ([38ba683](https://github.com/ChristopherVR/pptx-viewer/commit/38ba683130fe60f82e4ea0ab322c93f307d8dd6e))
- **vue:** Share section grouping (by @ChristopherVR) ([43be0f0](https://github.com/ChristopherVR/pptx-viewer/commit/43be0f01b85406551bb7051dc60b9d0541c7561d))
- **vue:** Share document statistics (by @ChristopherVR) ([8febe01](https://github.com/ChristopherVR/pptx-viewer/commit/8febe013ceed26da769638f037ec55125fdede32))
- **shared:** Collect used presentation fonts (by @ChristopherVR) ([3d92599](https://github.com/ChristopherVR/pptx-viewer/commit/3d92599c04bb186d0dbba83cdc11d4401540c2f9))
- **react:** Share used font collection (by @ChristopherVR) ([ff48b72](https://github.com/ChristopherVR/pptx-viewer/commit/ff48b72e4bf13b15f02a6564ef1dc700bb0b2265))
- **vue:** Share used font collection (by @ChristopherVR) ([35ba700](https://github.com/ChristopherVR/pptx-viewer/commit/35ba7003f9a0291f47be1eb1baafd7c05b029485))
- **react:** Unify static element rendering (by @ChristopherVR) ([3894305](https://github.com/ChristopherVR/pptx-viewer/commit/38943053b1641db692d8e2d730876d00a23c5dae))
- **shared:** Scan browser font availability (by @ChristopherVR) ([cde4ef8](https://github.com/ChristopherVR/pptx-viewer/commit/cde4ef8c659a1ffca1e45023623a86ca7968acf9))
- **react:** Consume shared image effect definitions (by @ChristopherVR) ([5a28252](https://github.com/ChristopherVR/pptx-viewer/commit/5a28252baa9deade1d4b9d6e74798b8efe4ca418))
- **react:** Share font availability scan (by @ChristopherVR) ([102d7ac](https://github.com/ChristopherVR/pptx-viewer/commit/102d7acfd806bce00d5c55e9cfaa7424da381893))
- **vue:** Share font availability scan (by @ChristopherVR) ([d4d3e54](https://github.com/ChristopherVR/pptx-viewer/commit/d4d3e54d4dd2a0da50c6245c72a5a00e101de1ef))
- **shared:** Validate protection passwords (by @ChristopherVR) ([85690c9](https://github.com/ChristopherVR/pptx-viewer/commit/85690c900659491f7722372bba55d42cda9ea793))
- **shared:** Centralize viewer setup metadata (by @ChristopherVR) ([da95839](https://github.com/ChristopherVR/pptx-viewer/commit/da95839795cf6829682115fe4d90545059ee3cdf))
- **react:** Consume shared setup helpers (by @ChristopherVR) ([9605f2b](https://github.com/ChristopherVR/pptx-viewer/commit/9605f2baa33e3ef8300bad9e6c30ea2cd5203f61))
- **shared:** Centralize subtitle recognition helpers (by @ChristopherVR) ([ac211d7](https://github.com/ChristopherVR/pptx-viewer/commit/ac211d746ba957dfb0dab0a599dc56d96b2805f9))
- **react:** Use shared picture bullet model (by @ChristopherVR) ([453c9c9](https://github.com/ChristopherVR/pptx-viewer/commit/453c9c939c23241dbdb6fb0a96baf978e16cdf19))

### Documentation

- **vue:** Document stable collaboration exports (by @ChristopherVR) ([3081624](https://github.com/ChristopherVR/pptx-viewer/commit/30816244a9224c80ec58a28a8b6101dfed3cfb7c))

### Testing

- **core:** Record Wave 11 OpenXML coverage (by @ChristopherVR) ([54da8fa](https://github.com/ChristopherVR/pptx-viewer/commit/54da8fa3516af50f84dc41ffd5c3e268cb30ce16))
- **core:** Require evidence for OpenXML coverage (by @ChristopherVR) ([c1d27e0](https://github.com/ChristopherVR/pptx-viewer/commit/c1d27e0b9ab39f9ceba53332cfd48dbdafc340df))
- **core:** Record implemented OpenXML capabilities (by @ChristopherVR) ([a04f5ed](https://github.com/ChristopherVR/pptx-viewer/commit/a04f5ede9296a7cebff216941567186d93f15159))
- **core:** Record print protection and rule coverage (by @ChristopherVR) ([804c74e](https://github.com/ChristopherVR/pptx-viewer/commit/804c74eba4a7022af7ca228dacb186ae3d5bc645))
- **core:** Record font audio pivot and algorithm coverage (by @ChristopherVR) ([199a137](https://github.com/ChristopherVR/pptx-viewer/commit/199a13788111941105c0d56d33ebb48945daba3f))
- **core:** Record line layout and pivot coverage (by @ChristopherVR) ([f4e21db](https://github.com/ChristopherVR/pptx-viewer/commit/f4e21dbf637643f091b3a7f09c05dce30347f871))
- **core:** Assert structural chart SVG output (by @ChristopherVR) ([e52c3c7](https://github.com/ChristopherVR/pptx-viewer/commit/e52c3c77db03b72345acbb27be3f3a1f2eca5882))
- **react:** Assert exact bi-level and chart rendering (by @ChristopherVR) ([7b159eb](https://github.com/ChristopherVR/pptx-viewer/commit/7b159eb51f6547b370003534019152006a331aa1))
- **vanilla:** Assert vector print controller behavior (by @ChristopherVR) ([aea3353](https://github.com/ChristopherVR/pptx-viewer/commit/aea33538670dcfbf12a5f635984bc6aeb978b513))
- **core:** Assert typed authored ink reload (by @ChristopherVR) ([d12827f](https://github.com/ChristopherVR/pptx-viewer/commit/d12827ff92380b6ff592cf7e6cb4cb427a7b32c1))
- **vue:** Normalize media inspector suite (by @ChristopherVR) ([956aec9](https://github.com/ChristopherVR/pptx-viewer/commit/956aec9780c6f2428d1cbe9d2618ef631061bdbe))
- **vanilla:** Assert title bar save action (by @ChristopherVR) ([606c501](https://github.com/ChristopherVR/pptx-viewer/commit/606c501065a04fd4da55b52cef6f86d38f71a860))

### Styling

- **vue:** Format media source fallback (by @ChristopherVR) ([7d4db03](https://github.com/ChristopherVR/pptx-viewer/commit/7d4db03cfff9d0ea9f400b44e63971e420ba07ab))
- **svelte:** Format parity helpers (by @ChristopherVR) ([c260603](https://github.com/ChristopherVR/pptx-viewer/commit/c260603912c62ece3899d5afa140639cdbc1e024))
- **vanilla:** Normalize parity callback lines (by @ChristopherVR) ([667852a](https://github.com/ChristopherVR/pptx-viewer/commit/667852a1b2003af060a89e8c8c4e7fee9f033f2e))

### Chores

- **repo:** Capture pending workspace updates (by @ChristopherVR) ([5d274f1](https://github.com/ChristopherVR/pptx-viewer/commit/5d274f16627170790cba14b6ecc99496f90c7ab7))

## 2026-07-16

_Releases: pptx-svelte-viewer@0.8.1_

### Bug Fixes

- **e2e:** Relax media pause timing check (by @ChristopherVR) ([17e5116](https://github.com/ChristopherVR/pptx-viewer/commit/17e511652f6f5e6594bc6b9b2285ceb81fee47f9))

## 2026-07-16

_Releases: pptx-viewer-core@1.5.0, pptx-react-viewer@1.18.0, pptx-vue-viewer@1.18.0, pptx-angular-viewer@1.18.0, pptx-vanilla-viewer@0.8.0, pptx-svelte-viewer@0.8.0, pptx-viewer-mcp@1.3.0, @christophervr/pptx-viewer@1.5.3_

### Features

- **viewer:** Add cross-framework collaboration join flow (by @ChristopherVR) ([d828541](https://github.com/ChristopherVR/pptx-viewer/commit/d828541a8b33bc4938d4042b96433c6c97e5ae62))
- **core:** Support editable auxiliary master elements (by @ChristopherVR) ([fdb32c6](https://github.com/ChristopherVR/pptx-viewer/commit/fdb32c6589fb64fe19dad3c0864e2316eb7b0e34))
- **locales:** Add complete internal reference dictionaries (by @ChristopherVR) ([767cd50](https://github.com/ChristopherVR/pptx-viewer/commit/767cd50d9416f45187e55dd483308d3a58761265))
- **viewer:** Complete auxiliary master view parity (by @ChristopherVR) ([87bb0e8](https://github.com/ChristopherVR/pptx-viewer/commit/87bb0e8899d2d2558b55454f14a676f3baa22671))
- **present:** Add multi-screen presenter sessions (by @ChristopherVR) ([9608480](https://github.com/ChristopherVR/pptx-viewer/commit/9608480a9436852a7d7b395804b7f261b6be3eaa))
- **present:** Add synchronized presenter console (by @ChristopherVR) ([2522229](https://github.com/ChristopherVR/pptx-viewer/commit/2522229ff7f5696456855e484aab4143d958f455))
- **viewer:** Complete presenter parity and conformance (by @ChristopherVR) ([ac2be2f](https://github.com/ChristopherVR/pptx-viewer/commit/ac2be2fec909f07b3338b93091ca9f9f83e5051f))
- **core:** Preserve chart manual layouts (by @ChristopherVR) ([823a5d1](https://github.com/ChristopherVR/pptx-viewer/commit/823a5d13fff02aef63cadb26a8ba127be419b8d2))
- **angular:** Accept host font sources (by @ChristopherVR) ([59a0174](https://github.com/ChristopherVR/pptx-viewer/commit/59a01740577b5783e24eb9efea45f3137eece28b))
- **angular:** Add rehearsal and connector effects (by @ChristopherVR) ([1920bcd](https://github.com/ChristopherVR/pptx-viewer/commit/1920bcdd9f0ba1748f5d149de69bbd5359ec2ec0))
- **vue:** Add host fonts and ink replay (by @ChristopherVR) ([1930a9b](https://github.com/ChristopherVR/pptx-viewer/commit/1930a9bbdda586d1f5d93c3bb816422bf7a5f5a3))
- **viewer:** Deepen rendering and validation parity (by @ChristopherVR) ([39f7f27](https://github.com/ChristopherVR/pptx-viewer/commit/39f7f27f5bb1275e785a2a69db21eecba1520a61))
- **vanilla:** Implement canonical viewer api (by @ChristopherVR) ([75ee359](https://github.com/ChristopherVR/pptx-viewer/commit/75ee359dcaca7b6e040b18b3e1bdd8a39fa459e5))
- **vanilla:** Complete ribbon tab roster (by @ChristopherVR) ([c298a50](https://github.com/ChristopherVR/pptx-viewer/commit/c298a5014a03570fd139889ad66fb88ca14b06d0))
- **svelte:** Complete ribbon tab roster (by @ChristopherVR) ([2cd4fd6](https://github.com/ChristopherVR/pptx-viewer/commit/2cd4fd673e2d5db2c39d0a4ddd4b8a82a74f76f2))
- **core:** Expand OpenXML conformance coverage (by @ChristopherVR) ([4f8353a](https://github.com/ChristopherVR/pptx-viewer/commit/4f8353a4a68e7110c44f392e1dd8635c4b5b9d96))
- **core:** Extend OpenXML semantic parity (by @ChristopherVR) ([a214d59](https://github.com/ChristopherVR/pptx-viewer/commit/a214d59663119334c0b82893bb67067bf299ef95))
- **core:** Preserve advanced OpenXML structures (by @ChristopherVR) ([28aef73](https://github.com/ChristopherVR/pptx-viewer/commit/28aef7326c7d6652bb47cff126e817ff2c67f212))
- **core:** Round-trip modern OpenXML metadata (by @ChristopherVR) ([2fda235](https://github.com/ChristopherVR/pptx-viewer/commit/2fda2351d97971700d8800d4ae7efc4c2ecbdf1e))
- **vue:** Insert dynamic fields (by @ChristopherVR) ([6a98862](https://github.com/ChristopherVR/pptx-viewer/commit/6a98862c6d7541e8e8be2c6550b069b0f20d6fe5))
- **core:** Round-trip chart data tables (by @ChristopherVR) ([d8fbd72](https://github.com/ChristopherVR/pptx-viewer/commit/d8fbd7269809f346ca429d7c5005ad6fcace5d06))
- **svelte:** Activate zoom navigation (by @ChristopherVR) ([3a63a7c](https://github.com/ChristopherVR/pptx-viewer/commit/3a63a7c69dd1cfe6847acda7b0ae73a6fe6db411))
- **core:** Round-trip text body scene geometry (by @ChristopherVR) ([16c7acb](https://github.com/ChristopherVR/pptx-viewer/commit/16c7acb9a91550b75fc2b2a0687cd52d9f24dad2))
- **core:** Preserve slide transition sound actions (by @ChristopherVR) ([039efcc](https://github.com/ChristopherVR/pptx-viewer/commit/039efcc75b01a79dd6e2f9c2f3e1fa4724b620c4))
- **vue:** Launch presenter view from ribbon (by @ChristopherVR) ([a6505ce](https://github.com/ChristopherVR/pptx-viewer/commit/a6505ce0ad9f961705f7e283943117f9eda655dd))
- **vue:** Complete rehearsal timing flow (by @ChristopherVR) ([4234d9a](https://github.com/ChristopherVR/pptx-viewer/commit/4234d9aad8dc8891af970c5f52d39e31c01b691b))
- **vue:** Compare external presentations (by @ChristopherVR) ([8655285](https://github.com/ChristopherVR/pptx-viewer/commit/8655285539cb18b9c2ca9f2ecb48092b668e5ebc))
- **vue:** Wire ribbon eyedropper state (by @ChristopherVR) ([6f36a33](https://github.com/ChristopherVR/pptx-viewer/commit/6f36a33392fdb163061fef70b27f10944c4965c0))
- **core:** Round-trip chart display units (by @ChristopherVR) ([2d575dd](https://github.com/ChristopherVR/pptx-viewer/commit/2d575ddf04e7291dc335bdd010c90d7111254d9b))
- **core:** Round-trip SmartArt layout definitions (by @ChristopherVR) ([92f9091](https://github.com/ChristopherVR/pptx-viewer/commit/92f90917e71d9438f26149655163dbadb71ed1fa))
- **core:** Preserve secondary DrawingML effects (by @ChristopherVR) ([f9c1a3a](https://github.com/ChristopherVR/pptx-viewer/commit/f9c1a3a8ff06681c08ada5aef2d23464c9cfb3ae))
- **vanilla:** Activate zoom navigation (by @ChristopherVR) ([daf7927](https://github.com/ChristopherVR/pptx-viewer/commit/daf792716cea22ac8e14b25846d495b5b9118301))
- **angular:** Replay ink during presentation (by @ChristopherVR) ([f25aa7b](https://github.com/ChristopherVR/pptx-viewer/commit/f25aa7b95632e9891b9149b7e003dd500d24821d))
- **vanilla:** Replay content part ink (by @ChristopherVR) ([3aa41b2](https://github.com/ChristopherVR/pptx-viewer/commit/3aa41b2999f75f2f62c283d0bb3b44c15826c384))
- **svelte:** Replay content part ink (by @ChristopherVR) ([64f1eac](https://github.com/ChristopherVR/pptx-viewer/commit/64f1eac679cb76153185cb38bf48636b2a27f719))
- **core:** Round-trip effect DAG primitives (by @ChristopherVR) ([a3a62ef](https://github.com/ChristopherVR/pptx-viewer/commit/a3a62efc5b6b1bc9f0e26b04bac6eb395d0fac5a))
- **core:** Round-trip chart axis label controls (by @ChristopherVR) ([ee24d2d](https://github.com/ChristopherVR/pptx-viewer/commit/ee24d2da1f5929cba0bc4c950f7f49b880028f05))
- **core:** Round-trip SmartArt style definitions (by @ChristopherVR) ([c5a7c15](https://github.com/ChristopherVR/pptx-viewer/commit/c5a7c153af1985fd776f2a34d960544e897c3db4))

### Bug Fixes

- **theme:** Apply slide overrides immediately (by @ChristopherVR) ([e74b7bb](https://github.com/ChristopherVR/pptx-viewer/commit/e74b7bbe8d689bc883cc338500b0df61d13c7659))
- **smartart:** Preserve layouts in PowerPoint (by @ChristopherVR) ([47ab731](https://github.com/ChristopherVR/pptx-viewer/commit/47ab731b5fbd2a0194f42412e20e2d6206051952))
- **a11y:** Improve WCAG support across viewer bindings (by @ChristopherVR) ([543fb45](https://github.com/ChristopherVR/pptx-viewer/commit/543fb452af09ecf307386805a211a9bcd78861e7))
- **svelte:** Validate canonical viewer surface (by @ChristopherVR) ([76888e4](https://github.com/ChristopherVR/pptx-viewer/commit/76888e41427a6ca67517f81940881503bad8664a))
- **vanilla:** Register all element renderers (by @ChristopherVR) ([0947e1d](https://github.com/ChristopherVR/pptx-viewer/commit/0947e1db1a73af52c3df3dca09ac733d7659a4d9))
- **vue:** Type ink replay styles (by @ChristopherVR) ([be17fb2](https://github.com/ChristopherVR/pptx-viewer/commit/be17fb2f1214790d7aca2193f2cbf25270dbcf9f))
- **vue:** Default presenter session state (by @ChristopherVR) ([72ff1ab](https://github.com/ChristopherVR/pptx-viewer/commit/72ff1ab8571fef9317f295fe2e5b881352596977))
- **svelte:** Align review ribbon with react (by @ChristopherVR) ([0af7d45](https://github.com/ChristopherVR/pptx-viewer/commit/0af7d4590ba9f3f88f977e5e547f41ecd0678b57))
- **vue:** Enable presentation ink replay (by @ChristopherVR) ([d823bf0](https://github.com/ChristopherVR/pptx-viewer/commit/d823bf0dac44c6f7ce65ae2b8a0d2aee39d88b0c))
- **shared:** Accept nullable chart display metadata (by @ChristopherVR) ([2c05f6c](https://github.com/ChristopherVR/pptx-viewer/commit/2c05f6cc13d6190aaaaa394230d2c203691163f4))
- **core:** Validate preset shadow direction (by @ChristopherVR) ([7f66a84](https://github.com/ChristopherVR/pptx-viewer/commit/7f66a84f12a85b72d72279ec6ca5a0cc870d2ac5))
- **react:** Adapt shared slide background styles (by @ChristopherVR) ([54650b1](https://github.com/ChristopherVR/pptx-viewer/commit/54650b1c6f59f46193b1c890e44af367bf117719))
- **vue:** Match React zoom range (by @ChristopherVR) ([90ddf7b](https://github.com/ChristopherVR/pptx-viewer/commit/90ddf7b2daba5541ff134bc8cb6da84c819cb51a))
- **shared:** Sync expanded presentation fields (by @ChristopherVR) ([a323073](https://github.com/ChristopherVR/pptx-viewer/commit/a32307362ee221c6c1271b747cd6ac43603df22c))
- **demo-vanilla:** Map shared and locales specs to source for typecheck (by @ChristopherVR) ([93448b7](https://github.com/ChristopherVR/pptx-viewer/commit/93448b723a86f3df0be5469c90420e07f9fcce09))
- Numerous test and build issues (by @ChristopherVR) ([51698cf](https://github.com/ChristopherVR/pptx-viewer/commit/51698cfefd71903126721682ea953b94ea2facda))

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

### Testing

- **viewer:** Stabilize parity validation (by @ChristopherVR) ([7f118f1](https://github.com/ChristopherVR/pptx-viewer/commit/7f118f100e7516211908d466d6f0bd05a0d7a602))
- **vanilla:** Lock multi-select arrange parity (by @ChristopherVR) ([3906067](https://github.com/ChristopherVR/pptx-viewer/commit/390606722033d0cf93e213512fb338b33b284028))
- **core:** Record Wave 8 OpenXML coverage (by @ChristopherVR) ([50d26ef](https://github.com/ChristopherVR/pptx-viewer/commit/50d26ef841659ea1a59f8acc53ce1ffaa7edb322))
- **core:** Record Wave 9 OpenXML coverage (by @ChristopherVR) ([b0f50dd](https://github.com/ChristopherVR/pptx-viewer/commit/b0f50ddc7f14059eef9ad8299d4784443985bd97))
- **core:** Cover preset shadow angle bounds (by @ChristopherVR) ([eba9fde](https://github.com/ChristopherVR/pptx-viewer/commit/eba9fdea00552f9ce4e8754b25f9dbe7f4507b0a))
- **core:** Record Wave 10 OpenXML coverage (by @ChristopherVR) ([54b7517](https://github.com/ChristopherVR/pptx-viewer/commit/54b7517871542e8b6ba830ffe7a36375c2fe5e9d))

## 2026-07-15

_Releases: pptx-react-viewer@1.17.1, pptx-vue-viewer@1.17.1, pptx-angular-viewer@1.17.1, pptx-vanilla-viewer@0.7.0, pptx-svelte-viewer@0.7.0_

### Features

- **viewer:** Complete shared e2e parity (by @ChristopherVR) ([170bc74](https://github.com/ChristopherVR/pptx-viewer/commit/170bc74f21dc1c4c5a1d7c5583cf5c8656a312d3))

### Bug Fixes

- **viewer:** Align inspector and status chrome (by @ChristopherVR) ([0a4b38a](https://github.com/ChristopherVR/pptx-viewer/commit/0a4b38a851f42ec7dbc18b097904bfaa4e95a67c))
- **viewer:** Align responsive mobile chrome (by @ChristopherVR) ([547f98c](https://github.com/ChristopherVR/pptx-viewer/commit/547f98cb37705aff9c36a6098f7cb6986101992f))

### Testing

- **viewer:** Enforce framework-neutral e2e parity (by @ChristopherVR) ([7389c7e](https://github.com/ChristopherVR/pptx-viewer/commit/7389c7e7586e7ce926400a096945b7e51448f709))

## 2026-07-13

_Releases: pptx-viewer-core@1.4.0, pptx-react-viewer@1.17.0, pptx-vue-viewer@1.17.0, pptx-angular-viewer@1.17.0, pptx-vanilla-viewer@0.6.0, pptx-svelte-viewer@0.6.0, pptx-viewer-mcp@1.2.2, @christophervr/pptx-viewer@1.5.2_

### Features

- **vanilla:** Add editor status bar (by @ChristopherVR) ([1332c48](https://github.com/ChristopherVR/pptx-viewer/commit/1332c48a6eae2a77bd4d626c305407041149a13b))
- **vanilla:** Add title bar (by @ChristopherVR) ([f5f3db6](https://github.com/ChristopherVR/pptx-viewer/commit/f5f3db6dd4437c51b440d55658f2ee2cb7e6a07d))
- **svelte:** Add desktop title bar (by @ChristopherVR) ([d150f49](https://github.com/ChristopherVR/pptx-viewer/commit/d150f49e38194524bc2cecfbc294febbaca0c215))
- **svelte:** Add desktop status bar (by @ChristopherVR) ([d02ec0e](https://github.com/ChristopherVR/pptx-viewer/commit/d02ec0e386c8db732b89e3f85076eaa0248d66f8))
- **vanilla:** Toggle autosave at runtime (by @ChristopherVR) ([734b280](https://github.com/ChristopherVR/pptx-viewer/commit/734b280427685726aae0d282441f9797f65b6bcd))
- **svelte:** Add slide show ribbon tab (by @ChristopherVR) ([6c12617](https://github.com/ChristopherVR/pptx-viewer/commit/6c1261746efad713b5739bb93f3277f7bbeb2f46))
- **vanilla:** Add slide show ribbon tab (by @ChristopherVR) ([c47a75f](https://github.com/ChristopherVR/pptx-viewer/commit/c47a75f6dcd566251eac294c71f8f321c9e696e2))
- **vanilla:** Add responsive mobile chrome (by @ChristopherVR) ([8d385e5](https://github.com/ChristopherVR/pptx-viewer/commit/8d385e536aba2fee1baacfdeddd606220b5282ff))
- **svelte:** Add responsive mobile chrome (by @ChristopherVR) ([eb826f1](https://github.com/ChristopherVR/pptx-viewer/commit/eb826f1efe9867254ac84e0993213dd2a585abfa))
- **vanilla:** Add touch navigation gestures (by @ChristopherVR) ([3bf3886](https://github.com/ChristopherVR/pptx-viewer/commit/3bf3886769fe7beafe238cca2a4298c0552da968))
- **svelte:** Add element context menu (by @ChristopherVR) ([d49bfe6](https://github.com/ChristopherVR/pptx-viewer/commit/d49bfe692970a65659ffff0d2d8032b8696217b9))
- **vanilla:** Add rich speaker notes (by @ChristopherVR) ([df91ab5](https://github.com/ChristopherVR/pptx-viewer/commit/df91ab58f963441abc506f7a937294b44824caea))
- **svelte:** Add rich speaker notes (by @ChristopherVR) ([02dbbcf](https://github.com/ChristopherVR/pptx-viewer/commit/02dbbcff7459dfe3b552333c5ceea090115ffdcc))
- **vanilla:** Add accessibility checker (by @ChristopherVR) ([1d60a42](https://github.com/ChristopherVR/pptx-viewer/commit/1d60a42d879e231ca112d02a5af76dc63cd67888))
- **svelte:** Reorder slides from thumbnails (by @ChristopherVR) ([3b14756](https://github.com/ChristopherVR/pptx-viewer/commit/3b14756f5b6f3b3b27001de1fe8b0c58792b6466))
- **vanilla:** Expand rich notes commands (by @ChristopherVR) ([1f1a92d](https://github.com/ChristopherVR/pptx-viewer/commit/1f1a92deee5d3b393834cf8cf6ea865869059d43))
- **svelte:** Add review comments panel (by @ChristopherVR) ([2ccba69](https://github.com/ChristopherVR/pptx-viewer/commit/2ccba691c08d4ee1e6e59cc056063e1a20759b06))
- **shared:** Add host-provided font sources (by @ChristopherVR) ([542e2d9](https://github.com/ChristopherVR/pptx-viewer/commit/542e2d9e7f77e390b1b20cde325d3dd9241c85a2))
- **bindings:** Close svelte and vanilla parity gaps (by @ChristopherVR) ([9cb9d7e](https://github.com/ChristopherVR/pptx-viewer/commit/9cb9d7e53bf1dcda3b051b0ba5737e17115be4c4))
- **react:** Accept host-provided fonts (by @ChristopherVR) ([fa2d325](https://github.com/ChristopherVR/pptx-viewer/commit/fa2d3252c45e94d502f5deb1c2d03c7c156d8f43))
- **bindings:** Deepen editing and qa parity (by @ChristopherVR) ([58eb87a](https://github.com/ChristopherVR/pptx-viewer/commit/58eb87ae2dc32ba699ee2d01e2dc9bc21f1d925b))
- **bindings:** Close structured editing gaps (by @ChristopherVR) ([7f61b91](https://github.com/ChristopherVR/pptx-viewer/commit/7f61b91749ad3e5832c930e11c9d4407c4a4758e))
- **bindings:** Further gap improvements for VanillaJS and Svelte (by @ChristopherVR) ([3a5d7a1](https://github.com/ChristopherVR/pptx-viewer/commit/3a5d7a1c9df614451d205d1db3be61a1e2b5c588))

### Bug Fixes

- **core:** Preserve real-world presentation text (by @ChristopherVR) ([a721ff0](https://github.com/ChristopherVR/pptx-viewer/commit/a721ff0eb44025f17989ae1b83518d748a7c0602))
- **core:** Preserve default paragraph colors (by @ChristopherVR) ([49c442b](https://github.com/ChristopherVR/pptx-viewer/commit/49c442bcbf1219170267326b8d6e353ae00ca6c6))
- **core:** Inherit placeholder transforms without borders (by @ChristopherVR) ([e1fa611](https://github.com/ChristopherVR/pptx-viewer/commit/e1fa6118a518cc0bb44699f2a89bc1c588cb6151))
- **core:** Inherit presentation placeholder styles (by @ChristopherVR) ([96ac79e](https://github.com/ChristopherVR/pptx-viewer/commit/96ac79edef9c8e7ee9605d4f6913c5ad56e12fc9))
- **shared:** Unify slide background rendering (by @ChristopherVR) ([0dfb067](https://github.com/ChristopherVR/pptx-viewer/commit/0dfb067740e4ca814c4d192b51237dbab47d634b))
- **shared:** Preserve equation display formatting (by @ChristopherVR) ([115e6d9](https://github.com/ChristopherVR/pptx-viewer/commit/115e6d90955c42979eb1eb1c223414cdc226e88f))
- **core:** Use condensed fallback for Oswald (by @ChristopherVR) ([5e01dbc](https://github.com/ChristopherVR/pptx-viewer/commit/5e01dbcd35857b72757caba5332bf3a5c9548172))
- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Documentation

- Refresh vanilla and svelte parity tracker (by @ChristopherVR) ([c3106e2](https://github.com/ChristopherVR/pptx-viewer/commit/c3106e235915e7be6705921aba7af7c5c1fa47d7))

### Testing

- **vanilla:** Cover slide show ribbon tab (by @ChristopherVR) ([11d1181](https://github.com/ChristopherVR/pptx-viewer/commit/11d11812e52574f9d3fb34a719b6613d413bbedf))
- **svelte:** Cover slide show ribbon tab (by @ChristopherVR) ([83e44eb](https://github.com/ChristopherVR/pptx-viewer/commit/83e44ebf2966f0f6ac0595bbe878516416dbeb6b))

### Styling

- Format files after dependency merges (by @ChristopherVR) ([08cbcb2](https://github.com/ChristopherVR/pptx-viewer/commit/08cbcb2305034bc132a3152849e1e4d4e0d21e13))

### Dependencies

- **deps:** Update framer-motion to 12.42.2 (by @dependabot[bot]) ([cbc2a6b](https://github.com/ChristopherVR/pptx-viewer/commit/cbc2a6b43a5286e7ea8e994b2d22ec3bcdcbf74d))
- **deps:** Update html2canvas-pro to 2.2.3 (by @dependabot[bot]) ([0fe015b](https://github.com/ChristopherVR/pptx-viewer/commit/0fe015b83722534f14864b2054ce6561b09386ca))
- **deps:** Update angular compiler to 22.0.6 (by @dependabot[bot]) ([3990f82](https://github.com/ChristopherVR/pptx-viewer/commit/3990f821128012438f9e72337b293fce7110d0fc))
- **deps:** Update fast-xml-parser to 5.10.0 (by @dependabot[bot]) ([6080273](https://github.com/ChristopherVR/pptx-viewer/commit/6080273f6a6f603d10d69a71d54faad1e6d9bf05))
- **deps:** Update angular vite plugin to 2.6.3 (by @dependabot[bot]) ([f3c664e](https://github.com/ChristopherVR/pptx-viewer/commit/f3c664e28425ff0059073b3119f215e981f56d00))
- **deps:** Update terser to 5.49.0 (by @dependabot[bot]) ([0d8b25e](https://github.com/ChristopherVR/pptx-viewer/commit/0d8b25e304e7528614ab048d07cd011eb742c2c9))
- **deps:** Update dompurify to 3.4.12 (by @dependabot[bot]) ([00a6ca4](https://github.com/ChristopherVR/pptx-viewer/commit/00a6ca49609d5a0e922a9e20447460b11ec690ba))
- **deps:** Update api-extractor to 7.58.9 (by @dependabot[bot]) ([0225e1f](https://github.com/ChristopherVR/pptx-viewer/commit/0225e1f2281358643a6325018a9750676990c604))
- **deps:** Update minor and patch dependencies (by @dependabot[bot]) ([5cd81fb](https://github.com/ChristopherVR/pptx-viewer/commit/5cd81fb0c8708e53990ac4858660d0b6a4b17a7a))
- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## 2026-07-13

_Releases: pptx-viewer-core@1.3.1, pptx-react-viewer@1.16.2, pptx-vue-viewer@1.16.1, pptx-angular-viewer@1.16.1, pptx-vanilla-viewer@0.5.1, pptx-svelte-viewer@0.5.1_

### Bug Fixes

- **core:** Open Office-encrypted pptx files (by @ChristopherVR) ([51aa670](https://github.com/ChristopherVR/pptx-viewer/commit/51aa670e8ca78d78323f55766b1a4c0e8b366c00))

## 2026-07-12

_Releases: pptx-react-viewer@1.16.1, @christophervr/pptx-viewer@1.5.1_

### Bug Fixes

- **svelte:** Raise smart-art-3d-view's flushMount tick budget to de-flake CI (by @ChristopherVR) ([cefb575](https://github.com/ChristopherVR/pptx-viewer/commit/cefb57565eba8c3465d2d331179c11ae364affce))
- **react:** Stop unmounting measured container on mid-session reload (by @ChristopherVR) ([052f182](https://github.com/ChristopherVR/pptx-viewer/commit/052f18207148f01cadd5e82bb07ea1b182790368))
- **e2e:** Tighten addGifImage locator to avoid inspector background input (by @ChristopherVR) ([561feb2](https://github.com/ChristopherVR/pptx-viewer/commit/561feb27d6c5e8008ad98c83d6f5bc706217811e))
- **cli:** Fix Angular Node.js preflight, vanilla three dep, collab packages prompt (by @ChristopherVR) ([8e41cea](https://github.com/ChristopherVR/pptx-viewer/commit/8e41cea107925c61a6ec94480a71fc91df31e4d9))

### Chores

- Bun.lock bumped (by @ChristopherVR) ([c017dbb](https://github.com/ChristopherVR/pptx-viewer/commit/c017dbb3fdae734299875b813ea6abe1d28a91db))

## 2026-07-11

_Releases: pptx-viewer-core@1.3.0, pptx-react-viewer@1.16.0, pptx-vue-viewer@1.16.0, pptx-angular-viewer@1.16.0, pptx-vanilla-viewer@0.5.0, pptx-svelte-viewer@0.5.0, pptx-viewer-mcp@1.2.1_

### Features

- **core:** Add canonical collaboration field-schema (by @ChristopherVR) ([cc78c1e](https://github.com/ChristopherVR/pptx-viewer/commit/cc78c1ed352fac3f69180ec2846d1df3e1dbd377))
- **vanilla:** Full collaboration presence + UI (Share/Broadcast/cursors) (by @ChristopherVR) ([5cc6c89](https://github.com/ChristopherVR/pptx-viewer/commit/5cc6c898c53aa6b4d8e111c9ad25e6b963e3a797))
- **svelte:** Full collaboration presence + UI (Share/Broadcast/cursors) (by @ChristopherVR) ([b5dda6e](https://github.com/ChristopherVR/pptx-viewer/commit/b5dda6ef8319ec9059e2730bc578f9f347c89cf4))
- **svelte:** Add ink-stroke editing state (EditorInkController) (by @ChristopherVR) ([9f8d2ec](https://github.com/ChristopherVR/pptx-viewer/commit/9f8d2ec0d1d705ff4ccf23d2eb30e9668b79b134))
- **svelte:** Wire pen/highlighter/eraser pointer gestures on the stage (by @ChristopherVR) ([25540a6](https://github.com/ChristopherVR/pptx-viewer/commit/25540a6d4c5b1da751c3f379c4f747cc5178cad9))
- **svelte:** Add the Draw ribbon tab (by @ChristopherVR) ([90bb39b](https://github.com/ChristopherVR/pptx-viewer/commit/90bb39b44c134062ffa46d0fd69a3cb6b075a6e2))
- **vanilla:** Add Draw ribbon tab shell with tool/colour/width controls (by @ChristopherVR) ([353191b](https://github.com/ChristopherVR/pptx-viewer/commit/353191b1f206bc06808e5d93b48f87ac032d9c2a))
- **vanilla:** Add history-integrated ink stroke commit/erase actions (by @ChristopherVR) ([29aaab5](https://github.com/ChristopherVR/pptx-viewer/commit/29aaab53d323ccfb9bb35c640ebfb7c5bb9793f9))
- **vanilla:** Wire pen/highlighter/eraser pointer gestures on the stage (by @ChristopherVR) ([360596a](https://github.com/ChristopherVR/pptx-viewer/commit/360596a34bc262db1893e424a20d2e5a34186c69))
- **shared:** Add the office colour swatch catalogue (by @ChristopherVR) ([41135a0](https://github.com/ChristopherVR/pptx-viewer/commit/41135a0f8687550cb17ded1451fa8f361fc975b1))

### Bug Fixes

- **shared:** Close CRDT allowlist data-loss gaps, add binary asset map (by @ChristopherVR) ([60ad222](https://github.com/ChristopherVR/pptx-viewer/commit/60ad2226bc4f3450c2992362e9fcceaac77f2ccf))
- **tools:** Derive codec field lists from the canonical core schema (by @ChristopherVR) ([d594bd1](https://github.com/ChristopherVR/pptx-viewer/commit/d594bd14f46a61257e7d73cb707c7b540225e3ff))
- **react:** Adopt the shared sync gate, re-arm on reconnect (by @ChristopherVR) ([9c6e15c](https://github.com/ChristopherVR/pptx-viewer/commit/9c6e15cbbd48188c913438760576f8fd1a5ec377))
- **angular:** Fix dev-mode collaboration import failure, re-arm gate (by @ChristopherVR) ([6ede10f](https://github.com/ChristopherVR/pptx-viewer/commit/6ede10f936ed97f9bbe123ce45de15a9793bab32))
- **svelte:** Keep zoom/fullscreen/notes controls always visible in the ribbon (by @ChristopherVR) ([00fd396](https://github.com/ChristopherVR/pptx-viewer/commit/00fd396057c9c992b6b54272d2a2b4072faa5c93))

### Refactor

- **vue:** Re-arm sync gate on reconnect, dedupe onto shared modules (by @ChristopherVR) ([b11ace7](https://github.com/ChristopherVR/pptx-viewer/commit/b11ace7a876f5be46f7171f0bc8d669c0b5f4565))

### Chores

- **demos:** Wire the new Share/Broadcast dialog UI into vanilla+svelte (by @ChristopherVR) ([03973cc](https://github.com/ChristopherVR/pptx-viewer/commit/03973cc49b681cbd434d40041ba2edc13d4475b7))
- Ignore collab-server.example.mjs's local Y.Doc snapshot dir (by @ChristopherVR) ([0e27b58](https://github.com/ChristopherVR/pptx-viewer/commit/0e27b5800e5ce9bdf90440c51f941cce7214a594))

## 2026-07-11

_Releases: pptx-react-viewer@1.15.0, pptx-vue-viewer@1.15.0, pptx-angular-viewer@1.15.0, pptx-vanilla-viewer@0.4.0, pptx-svelte-viewer@0.4.0_

### Features

- **vanilla:** Insert media, chart, equation, smartart, action button, field (by @ChristopherVR) ([7e70a21](https://github.com/ChristopherVR/pptx-viewer/commit/7e70a21fbc489e915c83c13528ac492ba5bd83ff))
- **svelte:** Add chart insert to the Insert tab (by @ChristopherVR) ([b4dbbc3](https://github.com/ChristopherVR/pptx-viewer/commit/b4dbbc3c3fffb455d1853d3e05fac9c4b2e92600))
- **svelte:** Add equation insert to the Insert tab (by @ChristopherVR) ([5d8a5fd](https://github.com/ChristopherVR/pptx-viewer/commit/5d8a5fdc5422642c50c072dcf441e221a0392b64))
- **svelte:** Add SmartArt insert to the Insert tab (by @ChristopherVR) ([6a5a12e](https://github.com/ChristopherVR/pptx-viewer/commit/6a5a12e2dd47c030eb60f59c75534e0f2be13f24))
- **svelte:** Add media insert factory for the Insert tab (by @ChristopherVR) ([3fe31b7](https://github.com/ChristopherVR/pptx-viewer/commit/3fe31b7570091644f03be2ffe1efaae18b997588))
- **svelte:** Add action button insert to the Insert tab (by @ChristopherVR) ([22136ca](https://github.com/ChristopherVR/pptx-viewer/commit/22136ca4499a383b98d6dd147a812d6a42e07086))
- **svelte:** Add field insert to the Insert tab (by @ChristopherVR) ([e8c4f7f](https://github.com/ChristopherVR/pptx-viewer/commit/e8c4f7fe7c3fe908f705e6a29eee31c3431353af))
- **svelte:** Wire the new Insert actions into the ribbon (by @ChristopherVR) ([105a338](https://github.com/ChristopherVR/pptx-viewer/commit/105a338b600f8ad265a2f4f513c37f75c8ea228d))
- **vanilla:** Add Design, Transitions, and Animations ribbon tabs (by @ChristopherVR) ([5c2058e](https://github.com/ChristopherVR/pptx-viewer/commit/5c2058ea6e5281c122019ff174fd2b98065d9cf0))
- **svelte:** Add slide-background/transition/animation editor actions (by @ChristopherVR) ([f032a47](https://github.com/ChristopherVR/pptx-viewer/commit/f032a4773e2b7d43a66121c12bfadffdbeccb687))
- **svelte:** Add Design, Transitions, and Animations ribbon tabs (by @ChristopherVR) ([86caaec](https://github.com/ChristopherVR/pptx-viewer/commit/86caaec25cdb9753fc76ca205f806daf903c6075))
- **shared:** Add text wrap/autofit, image adjustments, and table inspector helpers (by @ChristopherVR) ([54b2eda](https://github.com/ChristopherVR/pptx-viewer/commit/54b2eda35254bc75257932568442396a5f343708))
- **vanilla:** Element-type-aware property inspector panels (by @ChristopherVR) ([5bd1fb4](https://github.com/ChristopherVR/pptx-viewer/commit/5bd1fb4837a17d7125e05e111328220ab0eb3659))
- **svelte:** Add fill/stroke opacity and gradient to the inspector (by @ChristopherVR) ([34cb1ab](https://github.com/ChristopherVR/pptx-viewer/commit/34cb1ab62c4cef0739a1da9fc5e156b64f0b288b))
- **svelte:** Add text properties to the inspector panel (by @ChristopherVR) ([7d8819b](https://github.com/ChristopherVR/pptx-viewer/commit/7d8819b57b9adadf094c4225f71551c0a05e975e))
- **svelte:** Add image adjustment and crop controls to the inspector (by @ChristopherVR) ([fbe0f85](https://github.com/ChristopherVR/pptx-viewer/commit/fbe0f8531b8701592f6d9083c3e4cb2efbecb5f2))
- **svelte:** Add table properties to the inspector panel (by @ChristopherVR) ([d87360f](https://github.com/ChristopherVR/pptx-viewer/commit/d87360f15a58561e180a24a99c509078a76d2abf))

### Documentation

- **shared:** Add i18n keys for the vanilla Design tab theme gallery (by @ChristopherVR) ([593ea23](https://github.com/ChristopherVR/pptx-viewer/commit/593ea230e61f606056ffc013e2fdb82bea70738b))

## 2026-07-11

_Releases: pptx-react-viewer@1.14.1, pptx-vue-viewer@1.14.1, pptx-angular-viewer@1.14.1, pptx-vanilla-viewer@0.3.0, pptx-svelte-viewer@0.3.0_

### Features

- **vanilla:** Add tabbed ribbon shell with File/Home/Insert/View tabs (by @ChristopherVR) ([43594c6](https://github.com/ChristopherVR/pptx-viewer/commit/43594c6b675a067748714a4b0ce3f30a2e57e909))
- **vanilla:** Wire Ctrl+C/X/V clipboard shortcuts into the editor keyboard (by @ChristopherVR) ([423b3e3](https://github.com/ChristopherVR/pptx-viewer/commit/423b3e32d7877ebc9d8a465f07b2af992ce65ca0))
- **svelte:** Add ribbon editor logic (clipboard, slides, arrange, text/paragraph, find-replace) (by @ChristopherVR) ([12d53da](https://github.com/ChristopherVR/pptx-viewer/commit/12d53da5984957d473c7ee47327b5957747c6c5d))
- **svelte:** Add tabbed ribbon shell with File/Home/Insert/View tabs (by @ChristopherVR) ([4f391ab](https://github.com/ChristopherVR/pptx-viewer/commit/4f391ab80092b5562d0bd584664bd3acca3ce1f9))

### Bug Fixes

- **shared,react,vue,angular:** Make the Aa Change Case dropdown actually rewrite text (by @ChristopherVR) ([d84fd78](https://github.com/ChristopherVR/pptx-viewer/commit/d84fd788097253cf8b9281eca35af35caad20dce))
- **react,vue,angular:** Drop stray space when splitting a wrapped line (by @ChristopherVR) ([1a43c81](https://github.com/ChristopherVR/pptx-viewer/commit/1a43c810fd43cf57d3691c124568e73f31fd7b0a))
- **angular:** Resolve change-case helpers via the vendored shared source (by @ChristopherVR) ([6cfe41e](https://github.com/ChristopherVR/pptx-viewer/commit/6cfe41e0d348e3e9dff3a1ecc7bbb57902547683))
- **svelte:** Prune the selection on undo/redo so ribbon buttons re-disable (by @ChristopherVR) ([7539b70](https://github.com/ChristopherVR/pptx-viewer/commit/7539b70ad5ac18be028bd1fa39c1438469038002))

### Refactor

- **shared:** Extract clipboard, shape-preset, and text-format catalogs from react (by @ChristopherVR) ([b9d7cc9](https://github.com/ChristopherVR/pptx-viewer/commit/b9d7cc9b061b8c9dcaad91038136349c9360080d))
- **shared:** Dedupe change-case logic against text-case-transform (by @ChristopherVR) ([d007c07](https://github.com/ChristopherVR/pptx-viewer/commit/d007c070fb5bf8573bd8ac6dbeae160b46fc2dde))
- **svelte:** Multi-element selection state (by @ChristopherVR) ([a259d5d](https://github.com/ChristopherVR/pptx-viewer/commit/a259d5df7a37f90c3baf3952b280b48c3d739dae))
- **vanilla:** Move ribbon primary/nav row CSS out of css.ts (by @ChristopherVR) ([477ddd8](https://github.com/ChristopherVR/pptx-viewer/commit/477ddd8c2c49d1754058914f4fb46d63afe8d728))

### Testing

- **vanilla:** Cover the ribbon tab registry, insert grid, and clipboard group (by @ChristopherVR) ([cee383f](https://github.com/ChristopherVR/pptx-viewer/commit/cee383fc4bc8c55832c2fb9a6ad56db24bf3cf7b))

## 2026-07-11

_Releases: pptx-react-viewer@1.14.0, pptx-vue-viewer@1.14.0, pptx-angular-viewer@1.14.0, pptx-vanilla-viewer@0.2.0, pptx-svelte-viewer@0.2.0_

### Features

- **svelte:** Editing chrome - format toolbar, inspector, insert, z-order (by @ChristopherVR) ([a674804](https://github.com/ChristopherVR/pptx-viewer/commit/a6748040c630363e1b159ec300692f8a53d0a6c5))
- **vanilla:** Editing chrome - format toolbar, inspector, insert, z-order (by @ChristopherVR) ([bb7ea83](https://github.com/ChristopherVR/pptx-viewer/commit/bb7ea839d033a77192fe81c8519d34dde3b8b1f4))
- **svelte:** Collaboration and autosave (by @ChristopherVR) ([240bc2c](https://github.com/ChristopherVR/pptx-viewer/commit/240bc2cb5f1547fcc3a25eeb71b8bf23a5eb73ec))
- **vanilla:** Collaboration and autosave (by @ChristopherVR) ([2c507e2](https://github.com/ChristopherVR/pptx-viewer/commit/2c507e2ea9297d2dd7f6b13131c99e2039947a8b))
- **vanilla:** Animation and slide-transition playback in presentation mode (by @ChristopherVR) ([110834f](https://github.com/ChristopherVR/pptx-viewer/commit/110834f0987b6d6c2d0df52faac593edbd34f58f))
- **svelte:** Animation and slide-transition playback in presentation mode (by @ChristopherVR) ([9cbcbfa](https://github.com/ChristopherVR/pptx-viewer/commit/9cbcbfae923f18c23ab285dc57c7093c7cbb389d))
- **shared:** Per-frame delay overrides in the gif encoder (by @ChristopherVR) ([2d21100](https://github.com/ChristopherVR/pptx-viewer/commit/2d2110090f9f83ce1a124cd772fcd00faf53368d))
- **vanilla:** Gif, video, and print export (by @ChristopherVR) ([6a30ea3](https://github.com/ChristopherVR/pptx-viewer/commit/6a30ea3a53d9a358eebe87cb4469dedaa2328d74))
- **svelte:** Gif, video, and print export with export menu UI (by @ChristopherVR) ([d0b80ad](https://github.com/ChristopherVR/pptx-viewer/commit/d0b80ada4770497bcb5c78c8095839740d7d8e2f))

### Bug Fixes

- **vue:** Export toVueI18nSyntax; convert demo fr/es/de dictionaries (by @ChristopherVR) ([b3c974a](https://github.com/ChristopherVR/pptx-viewer/commit/b3c974a6733eaf2255aab1a9604a6200b56f3cc3))

### Chores

- Sync bun.lock with released package versions (by @ChristopherVR) ([6d31448](https://github.com/ChristopherVR/pptx-viewer/commit/6d31448ac60f4812e0625f21e0732b4e2c4236c6))
- Sync bun.lock with 0.1.3 release versions (by @ChristopherVR) ([909019e](https://github.com/ChristopherVR/pptx-viewer/commit/909019e3cc1e805757a974ebd95aee519b74af33))

## 2026-07-11

_Releases: pptx-vanilla-viewer@0.1.3, pptx-svelte-viewer@0.1.3, @christophervr/pptx-viewer@1.5.0_

### Features

- **cli:** Add svelte and vanilla js install/scaffold targets (by @ChristopherVR) ([768aafe](https://github.com/ChristopherVR/pptx-viewer/commit/768aafe14f57b75cc3d91a00c62be261c4044789))

### Documentation

- Present svelte and vanilla bindings at parity, slow hero gif (by @ChristopherVR) ([34d07d7](https://github.com/ChristopherVR/pptx-viewer/commit/34d07d7bf133601393d90f5b8890f20544443c48))
- **svelte:** Restyle readme to match the established binding readmes (by @ChristopherVR) ([5328bc8](https://github.com/ChristopherVR/pptx-viewer/commit/5328bc808b20b782c8234b9c859d3932fb41cfe4))
- **vanilla:** Restyle readme to match the established binding readmes (by @ChristopherVR) ([275dc2d](https://github.com/ChristopherVR/pptx-viewer/commit/275dc2df23b081d3a7f93f718ffd09f8cb61c85c))
- Point the landing hero at the interactive installer (by @ChristopherVR) ([614a574](https://github.com/ChristopherVR/pptx-viewer/commit/614a5741644f489f53f4685a0661c6c37e8b9ac9))

### Chores

- Removed incorrect pptx screenshots (by @ChristopherVR) ([f6937ca](https://github.com/ChristopherVR/pptx-viewer/commit/f6937cad46507f12c721d25f006c92f88b459869))

## 2026-07-10

_Releases: pptx-vanilla-viewer@0.1.2, pptx-svelte-viewer@0.1.2_

### Features

- **vanilla:** Add pptx-vanilla-viewer zero-framework binding (viewer core) (by @ChristopherVR) ([e5374a6](https://github.com/ChristopherVR/pptx-viewer/commit/e5374a66522daf27606c7f0d3d93a50d9da43146))
- **svelte:** Add pptx-svelte-viewer Svelte 5 binding (viewer) (by @ChristopherVR) ([d5c9164](https://github.com/ChristopherVR/pptx-viewer/commit/d5c916428ffa4c469ec9c79150d60f7aa6c9f560))
- **vanilla:** Add Vite demo app for pptx-vanilla-viewer (by @ChristopherVR) ([7a8980f](https://github.com/ChristopherVR/pptx-viewer/commit/7a8980f8c38bec442383c84b5bd3a98338f6db30))
- **svelte:** Add Vite demo app for pptx-svelte-viewer (by @ChristopherVR) ([16a52b3](https://github.com/ChristopherVR/pptx-viewer/commit/16a52b3ac609121610ebde377827733ad852c3b3))
- **vanilla:** Render table, chart, smartArt, media, ink, and ole elements (by @ChristopherVR) ([c5845df](https://github.com/ChristopherVR/pptx-viewer/commit/c5845dfc3043571c2041bbc66b3dc5703a1d2eba))
- **vanilla:** Re-export shared i18n helpers and TranslationKey type (by @ChristopherVR) ([60760c2](https://github.com/ChristopherVR/pptx-viewer/commit/60760c2692437f7b51f060d2c52996887a9006fb))
- **vanilla:** Demo UI parity with the Vue demo shell (by @ChristopherVR) ([0792f93](https://github.com/ChristopherVR/pptx-viewer/commit/0792f9330305b35b54a6a2b8d255b9b458ee8894))
- **svelte:** Demo UI parity with the Vue demo shell (by @ChristopherVR) ([a0fa493](https://github.com/ChristopherVR/pptx-viewer/commit/a0fa49368cf0780b6e1ce38c18762e6d5c803e43))
- **svelte:** Render table, chart, smartArt, media, ink, and ole elements (by @ChristopherVR) ([5077d82](https://github.com/ChristopherVR/pptx-viewer/commit/5077d827002f8dbbfd92f66ecebb13cafcf86537))
- **vanilla:** Editor infrastructure -- select, drag, resize, inline-text, undo/redo (by @ChristopherVR) ([ce093f6](https://github.com/ChristopherVR/pptx-viewer/commit/ce093f6faa6b31a7fae283c62b0470fb7a270ec9))
- **demo:** Replace Load sample deck with Create New Presentation; enable editing (by @ChristopherVR) ([86410ce](https://github.com/ChristopherVR/pptx-viewer/commit/86410ced92b4d184489f36c32c47732f20c3b0ea))
- **svelte:** Render contentPart, zoom, and model3d elements (by @ChristopherVR) ([872ad53](https://github.com/ChristopherVR/pptx-viewer/commit/872ad53157d4543ada58dc493eae5764810c5705))
- **vanilla,svelte:** Opt-in 3D SmartArt renderer (by @ChristopherVR) ([15337c9](https://github.com/ChristopherVR/pptx-viewer/commit/15337c9bc1a31ad614a4aca88be3e71ba848413f))
- **vanilla,svelte:** Presentation-mode media autoplay (by @ChristopherVR) ([fa52b6a](https://github.com/ChristopherVR/pptx-viewer/commit/fa52b6a6a40fef097140ffeae669146e53742014))
- **vanilla,svelte:** Plain-text speaker-notes panel (by @ChristopherVR) ([db7cf5d](https://github.com/ChristopherVR/pptx-viewer/commit/db7cf5da1ab065f503b097056e923c0f186491ce))
- **vanilla:** PNG and PDF export (by @ChristopherVR) ([a314688](https://github.com/ChristopherVR/pptx-viewer/commit/a3146882c706e6591b30176fbd06f62c001fd31f))
- **svelte:** Editing infrastructure (selection, move/resize/rotate, inline text, undo/redo, save) (by @ChristopherVR) ([bd5050c](https://github.com/ChristopherVR/pptx-viewer/commit/bd5050c4f37ce995df818af616fa52c01761b41d))
- **svelte:** PNG and PDF export (by @ChristopherVR) ([b1c273e](https://github.com/ChristopherVR/pptx-viewer/commit/b1c273e634904f66c91ec7c035c879423fd39372))

### Bug Fixes

- **vanilla:** Serve demo sample deck from committed e2e fixtures (by @ChristopherVR) ([ee32bb2](https://github.com/ChristopherVR/pptx-viewer/commit/ee32bb21ee1159202242eea6e85b1b8b4307a38b))
- **vanilla:** Stop file-input click bubbling back into the dropzone (by @ChristopherVR) ([6a69431](https://github.com/ChristopherVR/pptx-viewer/commit/6a694311cf86b4c31c264f02cde0ae44641790ec))
- **vanilla:** Wire EditorController into PptxViewer (by @ChristopherVR) ([bdcb63d](https://github.com/ChristopherVR/pptx-viewer/commit/bdcb63dee9303ec2bebd584893adef566368dbc7))
- **demo-vanilla:** Clear the notes panel from floating demo chrome (by @ChristopherVR) ([5306a3c](https://github.com/ChristopherVR/pptx-viewer/commit/5306a3c5b20b1b62b1f3079d1acf957cd383468a))

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([0ecd3d9](https://github.com/ChristopherVR/pptx-viewer/commit/0ecd3d935f97c78e8b0a62bebc8bf610c42414ab))

### Documentation

- Add Code of Conduct, refresh stale test-count claims in README (by @ChristopherVR) ([34e05fb](https://github.com/ChristopherVR/pptx-viewer/commit/34e05fbc4f892c900aa513c7299e3e93a15def35))
- Add PORTING.md tracking vanilla/svelte binding parity gaps (by @ChristopherVR) ([c246fad](https://github.com/ChristopherVR/pptx-viewer/commit/c246fad08d6da3cd3128b2952a63ecde282c1d68))
- Document vanilla and svelte bindings across site, landing, and README (by @ChristopherVR) ([ba283dd](https://github.com/ChristopherVR/pptx-viewer/commit/ba283ddb6eb63606c47ea49c644b1d085b9db7d0))
- Add npm badges for pptx-vanilla-viewer and pptx-svelte-viewer (by @ChristopherVR) ([551bd4e](https://github.com/ChristopherVR/pptx-viewer/commit/551bd4ef495afa7a1095efd138e25a7bc442d809))
- Correct stale vanilla/svelte docs and add both bindings to core guide (by @ChristopherVR) ([6815740](https://github.com/ChristopherVR/pptx-viewer/commit/6815740f71f85d3876e548d177bb2e709f1b91d1))
- Document Vanilla and Svelte i18n wiring, refresh PORTING.md (by @ChristopherVR) ([e29f96b](https://github.com/ChristopherVR/pptx-viewer/commit/e29f96bbae6fc00172e25950678725a89aea7e6a))
- Refresh PORTING.md for this session's parity work (by @ChristopherVR) ([0283d34](https://github.com/ChristopherVR/pptx-viewer/commit/0283d347a8590c1bf92a12f6f63d3d4fb9d92127))

### Testing

- **e2e:** Add vanilla/svelte basics spec, fix vanilla resize-handle CSS bug (by @ChristopherVR) ([e6dcd30](https://github.com/ChristopherVR/pptx-viewer/commit/e6dcd303c147a327461721ae710fed83aa974160))

### Build & CI

- Wire vanilla and svelte bindings into workspace tooling (by @ChristopherVR) ([d99f5c0](https://github.com/ChristopherVR/pptx-viewer/commit/d99f5c08193730f766c3abb116578c9ca6f8663e))
- Publish pptx-vanilla-viewer and pptx-svelte-viewer from the release pipeline (by @ChristopherVR) ([50dd90a](https://github.com/ChristopherVR/pptx-viewer/commit/50dd90aa3a7a707d9c56d3755098b431c37457b5))

### Chores

- Bump vanilla + svelte to 0.1.1; clarify view-only in READMEs (by @ChristopherVR) ([0bc44ab](https://github.com/ChristopherVR/pptx-viewer/commit/0bc44ab3b083c7d8aeed51197584f8eee04fc9ee))

## 2026-07-10

_Releases: pptx-viewer-core@1.2.8, pptx-react-viewer@1.13.1, pptx-vue-viewer@1.13.1, pptx-angular-viewer@1.13.2_

### Bug Fixes

- **react:** Fix Turbopack minification collision, cut bundle size (by @al3xius) ([2d15c45](https://github.com/ChristopherVR/pptx-viewer/commit/2d15c45c9415e3024fc5205346d3eeb86e161a96))
- **core:** Preserve whitespace-only run text on load (by @ChristopherVR) ([b83bdbc](https://github.com/ChristopherVR/pptx-viewer/commit/b83bdbc76be729f65af42f271402bffe95505cb0))
- **shared:** Sanitize print-document/SVG assembly with DOMPurify (by @ChristopherVR) ([84527b6](https://github.com/ChristopherVR/pptx-viewer/commit/84527b63350643d0a78b37d7ea55238fe4a8fa72))
- **angular:** Match ribbon content row height to React/Vue (by @ChristopherVR) ([18433c4](https://github.com/ChristopherVR/pptx-viewer/commit/18433c4560b0c08246f1aa9672fb5bc19dbd81a5))

### Reverts

- Exclude unrelated tsup.config.ts change from the CodeQL print-sanitization commit (by @ChristopherVR) ([bdc44d3](https://github.com/ChristopherVR/pptx-viewer/commit/bdc44d32330f3a9769f300c5be1676bba789d12b))

### Chores

- Doc updates (by @ChristopherVR) ([d520c23](https://github.com/ChristopherVR/pptx-viewer/commit/d520c236bc11e7bcf2364df11e63b9e21de2b8ea))

## 2026-07-09

_Releases: pptx-viewer-core@1.2.7, pptx-react-viewer@1.13.0, pptx-vue-viewer@1.13.0, pptx-angular-viewer@1.13.1_

### Features

- Updated default theme on demo sites (by @ChristopherVR) ([51b6f1b](https://github.com/ChristopherVR/pptx-viewer/commit/51b6f1b11acb0d75284eac7db697c450b50ce0df))
- Addressing CodeQL issues (by @ChristopherVR) ([ec1be4f](https://github.com/ChristopherVR/pptx-viewer/commit/ec1be4fc01b1b6804055b7948728fd60348e0110))

### Bug Fixes

- **core:** Close residual ReDoS/path-traversal gaps from the last CodeQL pass (by @ChristopherVR) ([9b17db9](https://github.com/ChristopherVR/pptx-viewer/commit/9b17db9067fac5f1b230d6fcc50fa9f8936d96ae))
- **shared:** Harden print-document HTML assembly against injection (by @ChristopherVR) ([e6add81](https://github.com/ChristopherVR/pptx-viewer/commit/e6add81b93dd71d42c2ef54e459fcc0629a17fa8))

## 2026-07-09

_Releases: pptx-viewer-core@1.2.6, pptx-react-viewer@1.12.0, pptx-vue-viewer@1.12.0, pptx-angular-viewer@1.13.0_

### Features

- **react:** Expose internal hooks via pptx-react-viewer/hooks-unstable (by @ChristopherVR) ([5ca17af](https://github.com/ChristopherVR/pptx-viewer/commit/5ca17af262dc69cf94ccde8c5e75a5f1114aeee5))
- **vue:** Expose internal composables via pptx-vue-viewer/composables-unstable (by @ChristopherVR) ([7f9d507](https://github.com/ChristopherVR/pptx-viewer/commit/7f9d5079aeae4fdd72a8a3bcf3defb901a366204))
- **angular:** Expose internal services via the public API surface (by @ChristopherVR) ([0793002](https://github.com/ChristopherVR/pptx-viewer/commit/07930029161a2cfc3219d9007410358832af162b))
- **shared:** Anchor chart value drags at the data point''s current value (by @ChristopherVR) ([e910070](https://github.com/ChristopherVR/pptx-viewer/commit/e9100708840f14c9a7f848b62ee316c52cfa3c59))
- **react:** Direct on-canvas chart editing (by @ChristopherVR) ([f0d4988](https://github.com/ChristopherVR/pptx-viewer/commit/f0d49887bae16c1b70a7b3b95662a188e311ad4a))
- **angular:** Direct on-canvas chart editing (by @ChristopherVR) ([bc90ad6](https://github.com/ChristopherVR/pptx-viewer/commit/bc90ad689a49c2e46e036b8edac6b5ea430b8528))
- **vue:** Direct on-canvas chart editing (by @ChristopherVR) ([358a2ae](https://github.com/ChristopherVR/pptx-viewer/commit/358a2ae9206437711edfe14ccf2f246a8782fc05))
- **demos:** Default all three demos to the vermilion dark preset (by @ChristopherVR) ([89befee](https://github.com/ChristopherVR/pptx-viewer/commit/89befeec2f55c60c1bc4c98c0bbc649ecc32d5a8))

### Bug Fixes

- **core:** Resolve CodeQL security findings across parsing/signing/templating (by @ChristopherVR) ([ec299c8](https://github.com/ChristopherVR/pptx-viewer/commit/ec299c815c6815a26ace0d85ebfe5a191a1ba5ab))
- **shared:** Resolve CodeQL ReDoS, XSS, and insecure-randomness findings (by @ChristopherVR) ([7e7b1c4](https://github.com/ChristopherVR/pptx-viewer/commit/7e7b1c49b43fc9bc823830a97fa9bc8093f9510b))
- **react:** Use crypto-strong randomness for presenter sessions; retest BroadcastChannel sync (by @ChristopherVR) ([478dfcf](https://github.com/ChristopherVR/pptx-viewer/commit/478dfcfc54e059ba3e82eeb4fb1a1347197d2f38))
- **react:** Make content-only edits undoable via the pointer-commit nonce (by @ChristopherVR) ([be1a975](https://github.com/ChristopherVR/pptx-viewer/commit/be1a97569dc12396ebad3a648900794c6132e12d))
- **angular:** Use crypto-strong randomness for session IDs and field GUIDs (by @ChristopherVR) ([afb26bb](https://github.com/ChristopherVR/pptx-viewer/commit/afb26bb14679ea410138581408101df136b4b8b7))
- **demos:** Use crypto-strong randomness for room/cursor id generation (by @ChristopherVR) ([e89f48a](https://github.com/ChristopherVR/pptx-viewer/commit/e89f48a55722385789c1853173ba607f9f17b1c3))
- **shared:** Add i18n keys for hardcoded UI text across bindings (by @ChristopherVR) ([6d17eb8](https://github.com/ChristopherVR/pptx-viewer/commit/6d17eb8b7298c0727f249ae863c7906258417acf))
- **react:** Route hardcoded UI text through i18n (by @ChristopherVR) ([62d5679](https://github.com/ChristopherVR/pptx-viewer/commit/62d567921c168bedd145f35a7ea7f440b10a5649))
- **vue:** Route hardcoded UI text through i18n (by @ChristopherVR) ([35216da](https://github.com/ChristopherVR/pptx-viewer/commit/35216daff3dc4bc24bc0c5021108dddb2f44e04d))
- **angular:** Route hardcoded UI text through i18n (by @ChristopherVR) ([ffface5](https://github.com/ChristopherVR/pptx-viewer/commit/ffface5ad67e86eef821b0f981110e970ad444d1))
- **angular:** Commit template-mode chart and SmartArt edits instead of no-op (by @ChristopherVR) ([dadb0d8](https://github.com/ChristopherVR/pptx-viewer/commit/dadb0d85f6396d6c1d9aa91c7baf18b8b09a62b3))

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([c4a7e32](https://github.com/ChristopherVR/pptx-viewer/commit/c4a7e3223fa179f9239b1bc856e574011d4ca2c1))
- Reconcile with origin/main before push (by @ChristopherVR) ([ef5fc85](https://github.com/ChristopherVR/pptx-viewer/commit/ef5fc85dca2e20ff3e105d622594e0f65d010fb0))
- Reconcile with origin/main before push (by @ChristopherVR) ([030b28b](https://github.com/ChristopherVR/pptx-viewer/commit/030b28bb21697ed681e4e59aa40db29f4b4a18d0))

### Documentation

- Wire Vue and Angular sections into VitePress nav and sidebar (by @ChristopherVR) ([7acb5b6](https://github.com/ChristopherVR/pptx-viewer/commit/7acb5b6aad0107281f4ba6825affb46fd14aa982))
- Replace the chart-editing limitation with on-canvas editing guidance (by @ChristopherVR) ([72a2f76](https://github.com/ChristopherVR/pptx-viewer/commit/72a2f76309236926837290f21185c7b6e88d00b3))
- Add SECURITY.md vulnerability reporting policy (by @ChristopherVR) ([41b7db0](https://github.com/ChristopherVR/pptx-viewer/commit/41b7db0bd6c8755528b5c5019366a01d3c0dd801))

## 2026-07-09

_Releases: pptx-react-viewer@1.11.0, pptx-vue-viewer@1.11.0, pptx-angular-viewer@1.12.0_

### Features

- **shared:** Chart interaction model for direct on-canvas editing (by @ChristopherVR) ([90753e2](https://github.com/ChristopherVR/pptx-viewer/commit/90753e28dc2188550b4069214c5cf90df06adddc))
- **shared:** Add vermilion light/dark theme presets to all bindings (by @ChristopherVR) ([1b6e816](https://github.com/ChristopherVR/pptx-viewer/commit/1b6e8161679a3f984cbfedb09ece0c8c01570c0a))

### Bug Fixes

- **vue:** Name mobile bottom bar and stop tablet viewport collapse (by @ChristopherVR) ([2f0d7ab](https://github.com/ChristopherVR/pptx-viewer/commit/2f0d7abf03671c8d06dedafab6eaae39f311bdd2))
- **vue:** Emit SmartArt canvas layout data-testid on the main canvas (by @ChristopherVR) ([5f24e12](https://github.com/ChristopherVR/pptx-viewer/commit/5f24e12cfdc8d51dd7ebd1781fbd8a8a840d36fa))
- **react,angular:** Make inspector default-open/closeable state consistent (by @ChristopherVR) ([dbfd959](https://github.com/ChristopherVR/pptx-viewer/commit/dbfd959fa273ea74e7e92a0393178ab5ae703396))
- **docs:** Stop the SPA router from intercepting the demo links (by @ChristopherVR) ([44637fb](https://github.com/ChristopherVR/pptx-viewer/commit/44637fbe49dd8138c89ece22bd6c1078d57a53d4))
- **react:** Render real chart previews in sidebar thumbnails (by @ChristopherVR) ([c3788cf](https://github.com/ChristopherVR/pptx-viewer/commit/c3788cf6c569a93bd036ecf968fa38d0872b72f5))

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([10acef8](https://github.com/ChristopherVR/pptx-viewer/commit/10acef81a7f5d79e778e4e4464d956cc84682f7c))
- Reconcile with origin/main before push (by @ChristopherVR) ([6afd435](https://github.com/ChristopherVR/pptx-viewer/commit/6afd4353efa08f46a4d1571e1e42c13bd2a14df4))

### Documentation

- Localize the landing page, rework copy, drop the marquee (by @ChristopherVR) ([3783503](https://github.com/ChristopherVR/pptx-viewer/commit/3783503d2a75c204191258232a9b0aa854744e0f))

### Testing

- **e2e:** Keep openInspector from closing Vue's already-open inspector (by @ChristopherVR) ([de4b8d6](https://github.com/ChristopherVR/pptx-viewer/commit/de4b8d651b6187275eadf562fc9a2384598d6eb8))

## 2026-07-09

_Releases: pptx-viewer-core@1.2.5, pptx-react-viewer@1.10.2, pptx-vue-viewer@1.10.2, pptx-angular-viewer@1.11.1_

### Bug Fixes

- **angular:** Use real Fullscreen API in presentation mode (by @ChristopherVR) ([ad28f35](https://github.com/ChristopherVR/pptx-viewer/commit/ad28f35dd64dd6d5a043983edecb9c3b433af840))
- **core:** Parse real PowerPoint OLE/media/transition AlternateContent envelopes (by @ChristopherVR) ([ff1409f](https://github.com/ChristopherVR/pptx-viewer/commit/ff1409fcf7daa69a2a7c3f4b3f40f5e50187b444))
- **react:** Add dialog aria semantics to equation editor (by @ChristopherVR) ([6da3d9e](https://github.com/ChristopherVR/pptx-viewer/commit/6da3d9e08d590c4760e37a351cfdc6049a399c4d))
- **angular:** Persist template element edits through save (by @ChristopherVR) ([f57556a](https://github.com/ChristopherVR/pptx-viewer/commit/f57556a1fa53d49ae386b481a97abfaa71786b81))
- **vue:** Resolve inherited master/layout slide background (by @ChristopherVR) ([6d8a0c5](https://github.com/ChristopherVR/pptx-viewer/commit/6d8a0c5dd20aa18ab38f824a582a22bd865f42fd))
- **react:** Gate template element interactivity on editTemplateMode (by @ChristopherVR) ([92ff0b7](https://github.com/ChristopherVR/pptx-viewer/commit/92ff0b77c2f252f34979687b0ca3b56b605ac708))
- **vue:** Support re-editing an existing equation (by @ChristopherVR) ([0dba8c9](https://github.com/ChristopherVR/pptx-viewer/commit/0dba8c937e31df169151912221dfe6ef25bb419e))
- **react:** Avoid remounting editor tree when collaboration toggles (by @ChristopherVR) ([22e2d98](https://github.com/ChristopherVR/pptx-viewer/commit/22e2d98ffa743c107ba94019653fa7915138f054))
- **react:** Actually play slide transitions in presentation mode (by @ChristopherVR) ([b8d7c58](https://github.com/ChristopherVR/pptx-viewer/commit/b8d7c58cf6150d5df2f112f9cc38fb95d9b3f718))
- **core:** Resolve OLE preview image on load (by @ChristopherVR) ([ac3a6eb](https://github.com/ChristopherVR/pptx-viewer/commit/ac3a6ebda5bdbb62e84cc61a003c3aa5036f24ab))
- **shared:** Open OLE embedded file via object URL (by @ChristopherVR) ([f95179f](https://github.com/ChristopherVR/pptx-viewer/commit/f95179fcef1a45ec1c72df05f545c62040163321))
- **shared:** Add presentation media autoplay helper (by @ChristopherVR) ([0b6042e](https://github.com/ChristopherVR/pptx-viewer/commit/0b6042e43769acc55875361842aca7403e18b1a3))
- **react:** Autoplay present-mode media inserted without autoPlay flag (by @ChristopherVR) ([6f449f0](https://github.com/ChristopherVR/pptx-viewer/commit/6f449f0e005b06165fe874e32b0949d4a6ffee02))
- **vue:** Autoplay media on the live presentation stage (by @ChristopherVR) ([f4b64a3](https://github.com/ChristopherVR/pptx-viewer/commit/f4b64a361f7f48e4de4a4a32e323e1a23268934c))
- **angular:** Autoplay present-mode media and show live edits in slideshow (by @ChristopherVR) ([6deff51](https://github.com/ChristopherVR/pptx-viewer/commit/6deff51c9fbca25adae8f8b4fa5a5e73f68a9b3c))
- **core:** Preserve animation-to-shape linkage across save/reload (by @ChristopherVR) ([aa23f7d](https://github.com/ChristopherVR/pptx-viewer/commit/aa23f7dcd7a0f90e9c6a9750bd72413561a1feac))
- **angular:** Show editable notes surface in mobile bottom-bar sheet (by @ChristopherVR) ([f6f19ab](https://github.com/ChristopherVR/pptx-viewer/commit/f6f19ab204b09b59fd79f718ddceb27037adb07f))
- **vue:** Show editable notes surface in mobile bottom-bar sheet (by @ChristopherVR) ([6f68e30](https://github.com/ChristopherVR/pptx-viewer/commit/6f68e3005e8d67866b2b3f9d2b706329a3a0f359))

### Other

- Angular fullscreen API fix (by @ChristopherVR) ([7c9694e](https://github.com/ChristopherVR/pptx-viewer/commit/7c9694e9fc68dd0759b9fb542470d90c32e28ab2))
- Collaboration e2e coverage (by @ChristopherVR) ([b223895](https://github.com/ChristopherVR/pptx-viewer/commit/b223895bfcb48a70b546689ec83bab007d3b169f))
- Real-world corpus + round-trip harness (+ 3 fidelity bug fixes) (by @ChristopherVR) ([473f74a](https://github.com/ChristopherVR/pptx-viewer/commit/473f74a2e7563efd86eeac1b58d7703db0623f0f))
- Equation editing e2e coverage + dialog aria fix (by @ChristopherVR) ([2f54e08](https://github.com/ChristopherVR/pptx-viewer/commit/2f54e0820ab8bc21d7e7bab97a43b1abbe62d7ad))
- 3D SmartArt e2e coverage (by @ChristopherVR) ([908a681](https://github.com/ChristopherVR/pptx-viewer/commit/908a681143670a1632e11ecce558afce0d87feb8))
- Animations and transitions e2e coverage (by @ChristopherVR) ([39890ab](https://github.com/ChristopherVR/pptx-viewer/commit/39890aba00a08d4a3d556b302d1f26a0649f65a0))
- Media playback e2e coverage (by @ChristopherVR) ([24ceba7](https://github.com/ChristopherVR/pptx-viewer/commit/24ceba72adb5ec88f3f359e6391a2b0f19ae2923))
- Template/master element editing e2e coverage (by @ChristopherVR) ([0e6937d](https://github.com/ChristopherVR/pptx-viewer/commit/0e6937d1cfd2f3ad774627f54ea5359c4827d2d8))
- Wire e2e suite into CI + fix stale e2e spec bugs (by @ChristopherVR) ([cbef754](https://github.com/ChristopherVR/pptx-viewer/commit/cbef7545282d930511ae6cf4d58f3f2427364e6a))
- OLE and ink e2e coverage (by @ChristopherVR) ([e8a568e](https://github.com/ChristopherVR/pptx-viewer/commit/e8a568ea973fd456bfc338f590304623ebc2bb00))
- Angular SmartArt data-testid parity fix (by @ChristopherVR) ([e11cef7](https://github.com/ChristopherVR/pptx-viewer/commit/e11cef7089fc9a1ca9cf7c0cf06e15ed8a37d215))
- Fix Angular save dropping template element edits (by @ChristopherVR) ([0c01723](https://github.com/ChristopherVR/pptx-viewer/commit/0c017231f2c6a26e247c9341e254f0c79a2d9041))
- Fix Vue slide background inheritance + gradient/pattern gap (by @ChristopherVR) ([874d014](https://github.com/ChristopherVR/pptx-viewer/commit/874d01437bd80d1d08275b3970c3e5e0d509f660))
- Fix React template element interactivity gating (by @ChristopherVR) ([cf26286](https://github.com/ChristopherVR/pptx-viewer/commit/cf262862da2470b3f726f7e891ebeffbb26eee4c))
- Support re-editing an existing equation in Vue (by @ChristopherVR) ([dd877a2](https://github.com/ChristopherVR/pptx-viewer/commit/dd877a2fc9929ccca89eb92e5fbd44b72de8cbe3))
- Fix mobile-breakpoint e2e locator + lock in touch-desktop regression test (by @ChristopherVR) ([0bc8021](https://github.com/ChristopherVR/pptx-viewer/commit/0bc8021ff79066955f74fe4ec90468ffb3e56415))
- Fix React collaboration toggle remounting editor tree (by @ChristopherVR) ([764d200](https://github.com/ChristopherVR/pptx-viewer/commit/764d200073579a965510a640f938754c533d1dda))
- Wire real slide transitions into React presentation mode (by @ChristopherVR) ([7f82089](https://github.com/ChristopherVR/pptx-viewer/commit/7f82089c66e3ca30cfde2cd7023e2668048d59ac))
- Fix OLE preview image resolution and Open no-op (by @ChristopherVR) ([160adb8](https://github.com/ChristopherVR/pptx-viewer/commit/160adb803c637aa8d87968b231bddf1b795d22e0))
- Fix media autoplay in Present mode + Angular live-slides overlay bug (by @ChristopherVR) ([986929b](https://github.com/ChristopherVR/pptx-viewer/commit/986929be90db00596edebfd7df6fe07f8b33024d))
- Preserve animation-to-shape linkage across save/reload (by @ChristopherVR) ([dd187b8](https://github.com/ChristopherVR/pptx-viewer/commit/dd187b86dc362585f97c702bd52c82c05f887f32))
- Reconcile with origin/main before push (by @ChristopherVR) ([b8c46bc](https://github.com/ChristopherVR/pptx-viewer/commit/b8c46bc3622e301d3365f5c489144e5aa5401782))
- Reconcile with origin/main before push (by @ChristopherVR) ([c69b979](https://github.com/ChristopherVR/pptx-viewer/commit/c69b9792c33f8a42cb11b045c5da0b9f97885979))
- Reconcile with origin/main before push (by @ChristopherVR) ([39bd286](https://github.com/ChristopherVR/pptx-viewer/commit/39bd2869ab3418c7d974ec79c028c93aa3b552f7))

### Documentation

- Rebuild the landing page as a custom presentation-themed home (by @ChristopherVR) ([2c29ae4](https://github.com/ChristopherVR/pptx-viewer/commit/2c29ae4d0441e71c3360405947a4d0a729176ee7))
- Hero shows the real viewer; drop presenter bar and slide numbers (by @ChristopherVR) ([4ac343c](https://github.com/ChristopherVR/pptx-viewer/commit/4ac343c064f93fe05693b614289ce15e639d98c8))

### Testing

- **e2e:** Add basic collaboration sync coverage (by @ChristopherVR) ([7b02146](https://github.com/ChristopherVR/pptx-viewer/commit/7b0214689f18b84a5e0601697c1a96d6c0c40995))
- **core:** Add real-world .pptx corpus and round-trip diff harness (by @ChristopherVR) ([bba3eff](https://github.com/ChristopherVR/pptx-viewer/commit/bba3effd75772c1770bb319cee338b979c2eed72))
- **e2e:** Add equation editing coverage (by @ChristopherVR) ([d8527a2](https://github.com/ChristopherVR/pptx-viewer/commit/d8527a274b28331d5fc181459e7a4a8754c7d007))
- **e2e:** Add 3D SmartArt coverage (by @ChristopherVR) ([a9aad41](https://github.com/ChristopherVR/pptx-viewer/commit/a9aad410abe07c10c755d1cf090b3ed8290e83de))
- **e2e:** Add transitions and animations playback coverage (by @ChristopherVR) ([a4a1803](https://github.com/ChristopherVR/pptx-viewer/commit/a4a180337e66a6fac9173e0b5d981f6fe4cce02d))
- **e2e:** Add media playback coverage (by @ChristopherVR) ([c16ff01](https://github.com/ChristopherVR/pptx-viewer/commit/c16ff01c8409e12eb7a495e84ca80a78380dfd70))
- **e2e:** Add template/master element editing coverage (by @ChristopherVR) ([3bae7f4](https://github.com/ChristopherVR/pptx-viewer/commit/3bae7f48f0dcc49d49f796c7ebf7a3a60bf99964))
- **e2e:** Add OLE and ink coverage (by @ChristopherVR) ([c63e7d8](https://github.com/ChristopherVR/pptx-viewer/commit/c63e7d818cd1ff61b354893fd11555685cd4ce34))
- **angular:** Add data-testid parity to SmartArt renderer (by @ChristopherVR) ([bc8fc6f](https://github.com/ChristopherVR/pptx-viewer/commit/bc8fc6f5f8cbd9b90e735f5a63e5f1c2fdf88fd6))
- **e2e:** Match desktop toolbar name exactly in breakpoint spec (by @ChristopherVR) ([4ffe87e](https://github.com/ChristopherVR/pptx-viewer/commit/4ffe87e3382425b0639768ad53023d5563ac41f2))
- **shared:** Lock in that touch-capable desktops stay desktop (by @ChristopherVR) ([33d16b6](https://github.com/ChristopherVR/pptx-viewer/commit/33d16b6553d02ecaa35c1cdc837ba5facd108b34))
- **e2e:** Assert OLE preview render and object-URL open (by @ChristopherVR) ([7e9e738](https://github.com/ChristopherVR/pptx-viewer/commit/7e9e7380788d37c288005f22e9c250517d668c53))
- **e2e:** Assert present-mode media autoplay across bindings (by @ChristopherVR) ([0f21d9f](https://github.com/ChristopherVR/pptx-viewer/commit/0f21d9f0958580a0bbccf46945283191f1e3270d))
- **e2e:** Drop animation-target workaround from transitions fixture (by @ChristopherVR) ([4751685](https://github.com/ChristopherVR/pptx-viewer/commit/4751685757b429d289c394e002eaab27ab2f5f10))
- **e2e:** Scope save-corruption-repro to react (by @ChristopherVR) ([302a956](https://github.com/ChristopherVR/pptx-viewer/commit/302a9569a350fbaf794e67f0421810dd59456dbe))

### Build & CI

- Run e2e suite in CI (by @ChristopherVR) ([f834433](https://github.com/ChristopherVR/pptx-viewer/commit/f83443395660d015057121467317b18907d697ac))

### Styling

- Fix formatting in e2e/global-setup.ts (by @ChristopherVR) ([57f799c](https://github.com/ChristopherVR/pptx-viewer/commit/57f799c7875403fd3020d6da54789ee9ffe11c30))

## 2026-07-09

_Releases: pptx-viewer-core@1.2.4, pptx-react-viewer@1.10.1, pptx-vue-viewer@1.10.1, pptx-angular-viewer@1.11.0_

### Features

- **angular:** Use lucide SVG icons and scrollable ribbon tabs (by @ChristopherVR) ([5a2e9aa](https://github.com/ChristopherVR/pptx-viewer/commit/5a2e9aaf07550f7dd1a6528dd3ce2bf8e5487da8))

### Bug Fixes

- **demos:** Trust any wss:// server for collab auto-connect (by @ChristopherVR) ([a662a84](https://github.com/ChristopherVR/pptx-viewer/commit/a662a845c931838a29b7caa77d2ea7816a0b0f82))
- **core:** Preserve SmartArt node geometry when round-tripping (by @ChristopherVR) ([cc5bd78](https://github.com/ChristopherVR/pptx-viewer/commit/cc5bd789e59d3cc772c9600512377317cad05772))

## 2026-07-08

_Releases: pptx-react-viewer@1.10.0, pptx-vue-viewer@1.10.0, pptx-angular-viewer@1.10.0_

### Features

- **shared:** Add smartart preset data builder (by @ChristopherVR) ([872b0ff](https://github.com/ChristopherVR/pptx-viewer/commit/872b0ff274950ab50193456e4398b9ef2f112fdd))

### Bug Fixes

- **vue:** Theme-aware backgrounds and larger slide thumbnails (by @ChristopherVR) ([142e125](https://github.com/ChristopherVR/pptx-viewer/commit/142e1258452dd91831b07b52d824dd7544af8caa))
- **vue:** Always show the speaker-notes footer strip (by @ChristopherVR) ([6b50f3b](https://github.com/ChristopherVR/pptx-viewer/commit/6b50f3b3fde2faf6163070c6454081e8aed05f28))
- **angular:** Always show the speaker-notes footer strip (by @ChristopherVR) ([43274fa](https://github.com/ChristopherVR/pptx-viewer/commit/43274fa97649335bcca4775c1bf44d34fffa0df7))
- **react:** True-to-layout smartart previews and styled insert tables (by @ChristopherVR) ([dc1edde](https://github.com/ChristopherVR/pptx-viewer/commit/dc1eddea5ffd1c6b7da72968ecea9e405ee4adcf))
- **vue:** Live smartart gallery previews and styled insert tables (by @ChristopherVR) ([7c7a687](https://github.com/ChristopherVR/pptx-viewer/commit/7c7a68799ee379473d8992a9bcc90db52f4df26f))
- **angular:** Live smartart gallery previews via the real renderer (by @ChristopherVR) ([147c788](https://github.com/ChristopherVR/pptx-viewer/commit/147c788df835336c316ac0efde82cb84b4dd7315))

### Testing

- **vue:** Align NotesPanel spec with controlled expanded prop (by @ChristopherVR) ([c215056](https://github.com/ChristopherVR/pptx-viewer/commit/c215056ac54cfc1d2e9095be21ddd9b72b2867fd))

## 2026-07-08

_Releases: pptx-viewer-core@1.2.3, pptx-react-viewer@1.9.1, pptx-vue-viewer@1.9.1, pptx-angular-viewer@1.9.1_

### Bug Fixes

- **shared:** Wire command search dispatch in TitleBar across all bindings (by @ChristopherVR) ([a85c3b8](https://github.com/ChristopherVR/pptx-viewer/commit/a85c3b83569719583ed6d3fd340e24abf61caed3))
- **core:** Preserve SmartArt layout when editing text or colour (by @ChristopherVR) ([7812b91](https://github.com/ChristopherVR/pptx-viewer/commit/7812b915e8c8eabe3fb8f7e6f445e5cab53ac5f0))
- **core:** Update content types after slide processing to include new media (by @ChristopherVR) ([e96ed45](https://github.com/ChristopherVR/pptx-viewer/commit/e96ed453c01412888920fa13be8fac69b5f08dda))
- **react:** Render SmartArt shapes in slide thumbnail previews (by @ChristopherVR) ([1031d6c](https://github.com/ChristopherVR/pptx-viewer/commit/1031d6c26da5ebabaea16b145d21ef98e26c8d7c))
- **react:** Use layout-appropriate shapes in SmartArt thumbnail fallback (by @ChristopherVR) ([9c2a93d](https://github.com/ChristopherVR/pptx-viewer/commit/9c2a93de774e97fc65ba53df9183abe75f651952))
- **react:** Pass default chart type to handleAddChart call (by @ChristopherVR) ([2491664](https://github.com/ChristopherVR/pptx-viewer/commit/24916640f167adf4afb93c4618b947c9efe9907a))

### Documentation

- **core:** Remove explicit jszip/fast-xml-parser mention from install section (by @ChristopherVR) ([6b72906](https://github.com/ChristopherVR/pptx-viewer/commit/6b72906c08447ba38a704ff4572c89d7cad7e60c))

### Chores

- Added missing e2e fixtures (by @ChristopherVR) ([67ec580](https://github.com/ChristopherVR/pptx-viewer/commit/67ec58013bdad85f3799c8f59c1de6f3f1828d59))

## 2026-07-07

_Releases: pptx-react-viewer@1.9.0, pptx-vue-viewer@1.9.0, pptx-angular-viewer@1.9.0_

### Features

- **shared:** Ribbon parity with PowerPoint - localize all tabs, add command search, advance slide controls (by @ChristopherVR) ([6bd1e5a](https://github.com/ChristopherVR/pptx-viewer/commit/6bd1e5ad16c079fd994080888119fe2e027c9a5c))
- **shared:** Add Review tab Language and Accessibility buttons across all frameworks (by @ChristopherVR) ([2dfd7bf](https://github.com/ChristopherVR/pptx-viewer/commit/2dfd7bf17d4583fa591246b77e178951b795aa32))

## 2026-07-07

_Releases: pptx-react-viewer@1.8.0, pptx-vue-viewer@1.8.0, pptx-angular-viewer@1.8.0, @christophervr/pptx-viewer@1.4.2_

### Features

- **shared:** Autosave disabled status with reason, recovery helpers (by @ChristopherVR) ([8ccc7eb](https://github.com/ChristopherVR/pptx-viewer/commit/8ccc7ebd451a8101c6e045708ee7c3a1cb006e1d))

### Bug Fixes

- CLI interactive installation (by @ChristopherVR) ([7b0f649](https://github.com/ChristopherVR/pptx-viewer/commit/7b0f649caa2a2f7bdea949f2583f6c86ff218cc5))

## 2026-07-07

_Releases: pptx-viewer-core@1.2.2, pptx-react-viewer@1.7.2, pptx-vue-viewer@1.7.2, pptx-angular-viewer@1.7.2_

### Bug Fixes

- **react:** Commit table cell edit on unmount for mobile tap-away (by @ChristopherVR) ([e58cb2e](https://github.com/ChristopherVR/pptx-viewer/commit/e58cb2ee23e8b3e824d199a7a0331d882421e349))
- **core:** Handle absolute relationship target paths in layout/master resolution (by @ChristopherVR) ([5ea40c2](https://github.com/ChristopherVR/pptx-viewer/commit/5ea40c22eca8420aa872b0ea923770085df72a0e))
- **react:** Stop text boxes clipping their own glyphs (by @adamschoenemann) ([0de4340](https://github.com/ChristopherVR/pptx-viewer/commit/0de4340551163b02338bfb9aa5a4e3b82ff401b6))
- **vue:** Stop text boxes clipping their own glyphs (by @adamschoenemann) ([bfb01b9](https://github.com/ChristopherVR/pptx-viewer/commit/bfb01b91b7564885b2c3cb29da7e71befeb57158))
- **angular:** Stop text boxes clipping their own glyphs (by @adamschoenemann) ([67df04b](https://github.com/ChristopherVR/pptx-viewer/commit/67df04b4494289dfaa72f80ae32b025a928cb1b9))

### Testing

- **e2e:** Cover text-box glyph clipping across bindings (by @adamschoenemann) ([6f999ed](https://github.com/ChristopherVR/pptx-viewer/commit/6f999ed9e982224d40ef7a0e23326144b7416855))
- **core:** Add e2e test for absolute-path relationship targets (by @ChristopherVR) ([39670de](https://github.com/ChristopherVR/pptx-viewer/commit/39670de025ddb4f6d9195661e293b92d4c27380d))

### Chores

- Added fixtures (by @ChristopherVR) ([d6c8d18](https://github.com/ChristopherVR/pptx-viewer/commit/d6c8d1820a86b0cc58260382cb3bae8195bfd67e))

## 2026-07-06

_Releases: pptx-viewer-core@1.2.1, pptx-react-viewer@1.7.1, pptx-vue-viewer@1.7.1, pptx-angular-viewer@1.7.1, pptx-viewer-mcp@1.2.0_

### Features

- **tools:** Add 26 new MCP tools expanding coverage to 51 total (by @ChristopherVR) ([c784579](https://github.com/ChristopherVR/pptx-viewer/commit/c784579cf91431eac28bb40c874b4e2cbb6d7a20))

### Bug Fixes

- **vue:** Mobile table cell edit lost on tap-away (by @ChristopherVR) ([27c9f0c](https://github.com/ChristopherVR/pptx-viewer/commit/27c9f0cc69e8df04a6ab2f00edd22cdfeb419930))
- **vue,react:** Resolve lint warnings and TableRenderer interactive-prop default (by @ChristopherVR) ([6a69635](https://github.com/ChristopherVR/pptx-viewer/commit/6a69635214f389dea16ceafe37b10cfcbb236540))
- **core:** Cast xmldom Element to Node for xml-crypto canonicalization (by @ChristopherVR) ([8fbd97e](https://github.com/ChristopherVR/pptx-viewer/commit/8fbd97eb1221f66650a7bcb45e089ee08034439f))
- **core:** Cast xmldom Element to Node at all canonicalization call sites (by @ChristopherVR) ([5f0fa32](https://github.com/ChristopherVR/pptx-viewer/commit/5f0fa325b57931a43fecd9d3de2d17b406a509f1))
- **core:** Replace standard DOM types with structural interfaces in signature-node (by @ChristopherVR) ([febe7bd](https://github.com/ChristopherVR/pptx-viewer/commit/febe7bd5b392c7b972a8588891ddf56fc7181d61))

### Documentation

- Remove Contributing navbar button and pages (by @ChristopherVR) ([21e4639](https://github.com/ChristopherVR/pptx-viewer/commit/21e46392c4543b8fd811beff5c221067cd5b2a3c))
- Rework architecture, introduction, and limitations pages (by @ChristopherVR) ([51b2459](https://github.com/ChristopherVR/pptx-viewer/commit/51b24598a105e748290279e869ddc33869dfbf15))
- Add screenshots and GIFs to user guide (by @ChristopherVR) ([a136fa5](https://github.com/ChristopherVR/pptx-viewer/commit/a136fa57b090a32fa28acdce4961c6caa9f20367))

### Dependencies

- **deps:** Update tailwindcss to ^4.3.2 and @angular/common to ^22.0.5 (by @ChristopherVR) ([ae1b615](https://github.com/ChristopherVR/pptx-viewer/commit/ae1b615b3632a8dc3bcd9a201fbab583648da97c))

### Chores

- Bump (by @ChristopherVR) ([1a9ecfa](https://github.com/ChristopherVR/pptx-viewer/commit/1a9ecfafaa5f470146340de26303a6bf36a0b634))

## 2026-07-05

_Releases: pptx-react-viewer@1.7.0, pptx-vue-viewer@1.7.0, pptx-angular-viewer@1.7.0, @christophervr/pptx-viewer@1.4.1_

### Features

- **react,vue:** Add editing section, paragraph dropdowns, text shadow to toolbar (by @ChristopherVR) ([13232d0](https://github.com/ChristopherVR/pptx-viewer/commit/13232d00a00029d95087b30bf1d82be142e9a0eb))
- **vue,angular:** Add line spacing, text direction, columns, and editing controls (by @ChristopherVR) ([71e1c69](https://github.com/ChristopherVR/pptx-viewer/commit/71e1c69c4e3dca22329fb4125da67373e0851efe))
- **react,vue,angular:** Remove Text and Arrange tabs, merge into Home (by @ChristopherVR) ([6183ff3](https://github.com/ChristopherVR/pptx-viewer/commit/6183ff3a4c50e31b5d267eb31de8aab9da068aff))
- **react,vue,angular:** Add Drawing group, Slides controls, and Record tab (by @ChristopherVR) ([8b68ba7](https://github.com/ChristopherVR/pptx-viewer/commit/8b68ba78599c3c3ded50ab99ab2bbcf38991caf2))

### Bug Fixes

- **react:** Mobile sheet hidden on landscape phones, isMobile desync (by @ChristopherVR) ([f4d0a3e](https://github.com/ChristopherVR/pptx-viewer/commit/f4d0a3e7c259b96290430851db514ed588ae5e13))
- **cli:** Scaffold i18n setup, suppress scaffolder output, auto-run dev (by @ChristopherVR) ([d99b463](https://github.com/ChristopherVR/pptx-viewer/commit/d99b463ccbf39d05f47c044af7053c53f400b2d9))
- **vue:** UseIsMobile container ref resolved too early, missed late mount (by @ChristopherVR) ([e81999a](https://github.com/ChristopherVR/pptx-viewer/commit/e81999aeacf362602698d33797e5e2c6670014af))

## 2026-07-05

_Releases: pptx-viewer-core@1.2.0, pptx-react-viewer@1.6.0, pptx-vue-viewer@1.6.0, pptx-angular-viewer@1.6.0, @christophervr/pptx-viewer@1.4.0_

### Features

- **core,cli:** Add react, angular, vue to npm keywords (by @ChristopherVR) ([528ec61](https://github.com/ChristopherVR/pptx-viewer/commit/528ec6182bb77c07444dd0e93560b65e604b9524))
- **docs,demos:** Add i18n language selector with French, Spanish, and German (by @ChristopherVR) ([a61316d](https://github.com/ChristopherVR/pptx-viewer/commit/a61316d8317dea35ba93ccf92717c68bddca3361))
- **shared:** Progressive imperative API for all viewer bindings (by @ChristopherVR) ([877339d](https://github.com/ChristopherVR/pptx-viewer/commit/877339d05b486d697f2d04d01b3fd954e3c54746))

### Bug Fixes

- Release plan incorrectly pumping every 1 hour (by @ChristopherVR) ([b21e8e5](https://github.com/ChristopherVR/pptx-viewer/commit/b21e8e5dfe74488a3c5ef77f27cadc883c80e722))
- Release plan incorrectly pumping every 1 hour (by @ChristopherVR) ([de5c3a5](https://github.com/ChristopherVR/pptx-viewer/commit/de5c3a5c5ce06c8405cb6d241d7ddb4370f6532c))
- **ci:** Add retry, timeout, and strip source maps for Pages deploy (by @ChristopherVR) ([4a27b1f](https://github.com/ChristopherVR/pptx-viewer/commit/4a27b1f349454ab650227b5fb5c1a8aa4fd99943))

## 2026-07-04

_Releases: pptx-react-viewer@1.5.3, pptx-vue-viewer@1.5.3, pptx-angular-viewer@1.5.3_

## 2026-07-04

_Releases: pptx-react-viewer@1.5.2, pptx-vue-viewer@1.5.2, pptx-angular-viewer@1.5.2_

## 2026-07-04

_Releases: pptx-react-viewer@1.5.1, pptx-vue-viewer@1.5.1, pptx-angular-viewer@1.5.1_

## 2026-07-04

_Releases: pptx-react-viewer@1.5.0, pptx-vue-viewer@1.5.0, pptx-angular-viewer@1.5.0_

## 2026-07-04

_Releases: pptx-react-viewer@1.4.0, pptx-vue-viewer@1.4.0, pptx-angular-viewer@1.4.0_

### Features

- Reworking the UI to align more on MS powerpoint UI (by @ChristopherVR) ([39386c0](https://github.com/ChristopherVR/pptx-viewer/commit/39386c0c8ff93b185352d8e5b9f17ec6b8cd7d45))

## 2026-07-04

_Releases: pptx-viewer-core@1.1.48, pptx-react-viewer@1.3.1, pptx-vue-viewer@1.3.1, pptx-angular-viewer@1.3.1_

### Bug Fixes

- **core:** Fabricate diagram parts so inserted SmartArt survives save (by @ChristopherVR) ([0d1341f](https://github.com/ChristopherVR/pptx-viewer/commit/0d1341fd4402518c51b3ed1e301aa4115a9af3b4))
- **shared:** Preserve equation and field metadata in remapTextToSegments (by @ChristopherVR) ([9675d18](https://github.com/ChristopherVR/pptx-viewer/commit/9675d18a652f1c87cc65b40bf7150251fc945587))
- **react:** Route equations to the equation dialog on click-to-edit (by @ChristopherVR) ([fe56623](https://github.com/ChristopherVR/pptx-viewer/commit/fe56623134575e1a2bd5112158e083ffde7b7bb7))
- **vue:** Block inline text editing on equation elements (by @ChristopherVR) ([4b52d06](https://github.com/ChristopherVR/pptx-viewer/commit/4b52d069dec95c228691f84b0292eed957d46e1c))

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
