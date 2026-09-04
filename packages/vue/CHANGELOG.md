# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.
A release listed with no entries carried no Conventional Commit in this package's
scope: scripts/release-plan.mjs re-releases a package whenever any of its files
change, not only on conventional ones.

## [3.5.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.5.4) - 2026-09-04

### Bug Fixes

- **shared,vanilla:** Continue appended numbered paragraphs ([#211](https://github.com/ChristopherVR/pptx-viewer/issues/211)) (by @Sudhansh6) ([1c3a8c5](https://github.com/ChristopherVR/pptx-viewer/commit/1c3a8c5d9511b482b6903a6895ac68aa84b9d577))

## [3.5.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.5.3) - 2026-09-03

### Bug Fixes

- **core:** Preserve fractional table font sizes ([#210](https://github.com/ChristopherVR/pptx-viewer/issues/210)) (by @Sudhansh6) ([3f0c1ba](https://github.com/ChristopherVR/pptx-viewer/commit/3f0c1ba908692715a9c9d745ee58fae4c30d893d))

## [3.5.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.5.2) - 2026-09-03

### Bug Fixes

- Use point units in font-size controls ([#205](https://github.com/ChristopherVR/pptx-viewer/issues/205)) (by @Sudhansh6) ([65031d4](https://github.com/ChristopherVR/pptx-viewer/commit/65031d4c92e5c9520a3188986ed7ba7c21af856e))
- **react,shared:** Toggle shortcuts from selected text ([#207](https://github.com/ChristopherVR/pptx-viewer/issues/207)) (by @Sudhansh6) ([a9d294c](https://github.com/ChristopherVR/pptx-viewer/commit/a9d294c4ebe34f5c03b511f57a7608e7656c5bbb))
- Preserve table-cell font sizes across renderers ([#208](https://github.com/ChristopherVR/pptx-viewer/issues/208)) (by @Sudhansh6) ([8c2d97d](https://github.com/ChristopherVR/pptx-viewer/commit/8c2d97d81fdaa3781ebd95bdf0fb04af79d42b84))

## [3.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.5.1) - 2026-09-03

### Bug Fixes

- **core,shared:** Preserve numbered text through edits ([#204](https://github.com/ChristopherVR/pptx-viewer/issues/204)) (by @Sudhansh6) ([9b5e9aa](https://github.com/ChristopherVR/pptx-viewer/commit/9b5e9aa2829cbaaa8a1bac643136fde62b6d634d))
- **shared:** Preserve paragraph metadata through text edits ([#206](https://github.com/ChristopherVR/pptx-viewer/issues/206)) (by @Sudhansh6) ([f49cbb7](https://github.com/ChristopherVR/pptx-viewer/commit/f49cbb77cb6afe6ee035fde11a7a5927ca972d91))

## [3.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.5.0) - 2026-09-02

### Features

- Add a Hide Background Graphics toggle to the background inspector (by @ChristopherVR) ([108da7d](https://github.com/ChristopherVR/pptx-viewer/commit/108da7dd6efa3e1f2496918546bf8926fdcb7f6f))

### Bug Fixes

- **core:** Preserve custom-geometry command order through placeholder merges (by @ChristopherVR) ([29af002](https://github.com/ChristopherVR/pptx-viewer/commit/29af002ba54e514aa0dd4a2b80dedf3ea6d92b3f))
- **core:** Regenerate slide background when an image is explicitly cleared (by @ChristopherVR) ([c43e1ea](https://github.com/ChristopherVR/pptx-viewer/commit/c43e1ea3bd48a970422fb40cd867deeefc38aed7))
- Recolour template-layer shapes on a live theme colour-scheme edit (by @ChristopherVR) ([34c3935](https://github.com/ChristopherVR/pptx-viewer/commit/34c3935daa5e3e6a18c3b2871fb25fe7e2c80bfa))
- Keep resize/rotate handles visible while inline-editing text (by @ChristopherVR) ([3074929](https://github.com/ChristopherVR/pptx-viewer/commit/307492907f567485283ce6f29cf257c3d254bd04))
- Apply text formatting to live inline-edit text, not a stale snapshot (by @ChristopherVR) ([7815cc2](https://github.com/ChristopherVR/pptx-viewer/commit/7815cc22bf1e1074a985c0bb951a2c772ab4709a))
- **core:** Round-trip Hide Background Graphics (@showMasterSp) on save (by @ChristopherVR) ([75ac54f](https://github.com/ChristopherVR/pptx-viewer/commit/75ac54f9f4bc46ce5f11cb44a5ecbc3ce9369dab))

## [3.4.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.4.1) - 2026-09-02

### Bug Fixes

- **shared:** Map the wipe direction by travel and feather its edge (by @nikko82) ([7f26a8b](https://github.com/ChristopherVR/pptx-viewer/commit/7f26a8b9871c015f45f90fc2eac646a1e7d6aad1))

## [3.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.4.0) - 2026-09-02

### Features

- **shared:** Animate morph stacking, flips, and crop reveal like PowerPoint (by @nikko82) ([a9bba84](https://github.com/ChristopherVR/pptx-viewer/commit/a9bba842827274a9dc7cdb0b8934fe7509b560e6))
- **shared:** Minimum-cost media pairing and named text twins for morphs (by @nikko82) ([3abda95](https://github.com/ChristopherVR/pptx-viewer/commit/3abda95e72133e1fe886f2bc98d76a5c23a645c6))
- **shared:** Step an inert stacking-swap counterpart together with the mover (by @nikko82) ([e4f9438](https://github.com/ChristopherVR/pptx-viewer/commit/e4f9438771bcec15c78ebba5eb3b4e2c173152e0))
- **react,vue,angular,svelte,vanilla:** Replay the leaving slide's transition on backward steps (by @nikko82) ([e23838e](https://github.com/ChristopherVR/pptx-viewer/commit/e23838ebc6253c413fe87cd75e96244311349214))
- **shared:** I18n keys for the wave-4 parity UI (by @ChristopherVR) ([6cc9a86](https://github.com/ChristopherVR/pptx-viewer/commit/6cc9a8646c3f6174ec70928e00137412fea1778a))
- **core:** Master/layout CRUD, legacy comment threading, extended ppaction verbs (by @ChristopherVR) ([033b024](https://github.com/ChristopherVR/pptx-viewer/commit/033b024a70d041cf884aafb47dbc35e9d2ed10f6))
- **shared:** Master-view CRUD, recent colours, action options, handout-master print chrome (by @ChristopherVR) ([3cc928f](https://github.com/ChristopherVR/pptx-viewer/commit/3cc928fea1e07293ca24faabcf6058b0c43713b2))
- **vue:** Wave-4 parity UI (chart subtypes, read-only banner, compat toasts, rescale, sldRg) (by @ChristopherVR) ([58ac9f4](https://github.com/ChristopherVR/pptx-viewer/commit/58ac9f4b0f642fe089e82300c4a5fe53eb687df2))
- **shared:** Show entry slide, compat toast placement, master-view failure copy (by @ChristopherVR) ([79a42ba](https://github.com/ChristopherVR/pptx-viewer/commit/79a42ba93d0fd76d4fb509710c14eae22609c5de))
- **vue:** Wave-4 show entry, custom-show actions, master CRUD, mentions (by @ChristopherVR) ([e04c12f](https://github.com/ChristopherVR/pptx-viewer/commit/e04c12f6a2d5c0aec4bf3dd2531614b8f91bcee9))
- **shared:** Resolve OLE action verbs against the clicked element (by @ChristopherVR) ([680c70c](https://github.com/ChristopherVR/pptx-viewer/commit/680c70c7d4cbb1f37d0c132b99544309e3563629))
- **vue:** Recent-colours row under every picker and OLE verb actions (by @ChristopherVR) ([a8bb0fb](https://github.com/ChristopherVR/pptx-viewer/commit/a8bb0fb792bcf091d990cce82992348af3f4f9c7))
- **shared:** Map F5 and Shift+F5 to the start-show actions (by @ChristopherVR) ([94852ed](https://github.com/ChristopherVR/pptx-viewer/commit/94852edbe44a6fb712e15dd8892ff4dcd1e9e7b0))
- **vue:** Start the slide show on F5 and Shift+F5 (by @ChristopherVR) ([4de964c](https://github.com/ChristopherVR/pptx-viewer/commit/4de964c355a42a2ebe6bcffa82a2eae30fcdc482))

### Bug Fixes

- **shared:** Play an un-authored morph at PowerPoint's 0.5s fallback (by @nikko82) ([0a70ef2](https://github.com/ChristopherVR/pptx-viewer/commit/0a70ef2db656e830ad429e9fd0a6efeb43ff7bde))
- **shared:** Close the open code-scanning findings at their root (by @ChristopherVR) ([455f853](https://github.com/ChristopherVR/pptx-viewer/commit/455f853f028ba1cb4142285558bbeef715d130d7))
- **shared:** Write morph stacking-order journeys in the stage's z space (by @ChristopherVR) ([867b05b](https://github.com/ChristopherVR/pptx-viewer/commit/867b05b4e9bfea62361e7d1361ae4cb84787c191))
- **shared:** Take the nearest named text twin and drop its dead name veto (by @ChristopherVR) ([c6e8062](https://github.com/ChristopherVR/pptx-viewer/commit/c6e8062919e9b9ccc1d1b18c4504270fd8138f51))
- **shared:** Sample the morph crop track from the one easing definition (by @ChristopherVR) ([349e8bd](https://github.com/ChristopherVR/pptx-viewer/commit/349e8bd5eb1908077f3693e6ee4573cf88ad253c))

### Refactor

- **vue:** Route ppaction://media through the shared media toggle (by @ChristopherVR) ([4b4a50d](https://github.com/ChristopherVR/pptx-viewer/commit/4b4a50d6451c3c136f6408d82ef3ff63ee5454e3))

### Testing

- **shared:** Cover the morph media assignment solver (by @ChristopherVR) ([cbf671f](https://github.com/ChristopherVR/pptx-viewer/commit/cbf671f7a7a2037006f19ddaabc502211069ded5))

## [3.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.3.0) - 2026-09-02

### Features

- **vue:** Gradient and pattern fill panels, full effects panel, crop to shape and loop-continuously (by @ChristopherVR) ([9da1c43](https://github.com/ChristopherVR/pptx-viewer/commit/9da1c43eb9eccc19344e6b9fe8594ec502d50274))
- **shared:** Add the pptx.effects.rotateWithShape key and export DEFAULT_FONT_SIZE (by @ChristopherVR) ([2021a28](https://github.com/ChristopherVR/pptx-viewer/commit/2021a28c4442b5769f3faaed1cb7abc27b7316a3))

### Bug Fixes

- **vue:** Z-order, collab colours, gridlines toggle, font-size default and open arrowheads (by @ChristopherVR) ([7423d7e](https://github.com/ChristopherVR/pptx-viewer/commit/7423d7e52b532f9c78cf5707ec78fdb3b5bb02e9))
- **vue:** Localise the outer-shadow "Rotate with Shape" label (by @ChristopherVR) ([1910fa6](https://github.com/ChristopherVR/pptx-viewer/commit/1910fa6b0e273c9df2aba3228af85b4b805c3f50))
- **shared:** Stop eaLnBrk splitting Latin words mid-word (by @ChristopherVR) ([c3eedb9](https://github.com/ChristopherVR/pptx-viewer/commit/c3eedb9e7adaccfcd5fc954518d554218f1050e2))
- **vue:** Show the placeholder prompt on empty inherited placeholders (by @ChristopherVR) ([bc1b76f](https://github.com/ChristopherVR/pptx-viewer/commit/bc1b76f2714f8bd97995bf9a37b3347c596b455a))
- **shared:** Resolve Google webfonts from a bundled catalogue instead of probing the API (by @ChristopherVR) ([43bda70](https://github.com/ChristopherVR/pptx-viewer/commit/43bda70309f0e9b2cd80dc3ae2ec5cdecda41548))

### Refactor

- **vue:** Repoint onto the wave-2 shared modules (by @ChristopherVR) ([3b5cf0a](https://github.com/ChristopherVR/pptx-viewer/commit/3b5cf0a79befebcfd29b7e007425b441d7998891))
- **shared:** Make editor-geometry nudge helpers alias editor-keymap (by @ChristopherVR) ([87cf256](https://github.com/ChristopherVR/pptx-viewer/commit/87cf256d9bf0565dd6b70e264c6a558416d31ef5))

### Testing

- **vue:** Stub the network in the webfont tests, not probe responses (by @ChristopherVR) ([cc78554](https://github.com/ChristopherVR/pptx-viewer/commit/cc7855484b443ec573d832b9ab723ebff795d97e))

## [3.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.2.0) - 2026-09-02

### Features

- **core:** Parse and save bar3D shape, radar style and surface wireframe (by @ChristopherVR) ([1f46205](https://github.com/ChristopherVR/pptx-viewer/commit/1f46205a1f1280df55baf990a3ed496e308233a2))
- **shared:** Google fonts webfont fallback for referenced families (by @nikko82) ([49571a5](https://github.com/ChristopherVR/pptx-viewer/commit/49571a5d192d54f992dd34cfdf3b60d8780c79ad))
- **vue:** Load google-hosted webfonts for missing families (by @nikko82) ([8b2815a](https://github.com/ChristopherVR/pptx-viewer/commit/8b2815a5731da4b9136613d6337fd8970053e21d))
- **shared:** Morph matching heuristics for media, twins, and group twins (by @nikko82) ([d5ba90b](https://github.com/ChristopherVR/pptx-viewer/commit/d5ba90b2bbc4ed8866e2367bb7751c00a3cc9f8f))

### Bug Fixes

- **core:** Close OpenXML round-trip gaps in charts, pictures, tables, text and structure (by @ChristopherVR) ([9780265](https://github.com/ChristopherVR/pptx-viewer/commit/9780265ead99aba7f9e3fde80c0527eaed4f8d17))
- **shared:** Equation reverse conversion, chart manual layout and editor decision helpers (by @ChristopherVR) ([bffc2b3](https://github.com/ChristopherVR/pptx-viewer/commit/bffc2b380f125787cd39b20096127ab4eb9d6bbf))
- **shared:** Stop the webfont resolver dropping families the injected stylesheet satisfied (by @ChristopherVR) ([25a9a78](https://github.com/ChristopherVR/pptx-viewer/commit/25a9a781ade7bb3f2dc79847f2ade3284237b7c5))
- **core:** Write gridline elements on generated chart axes (by @ChristopherVR) ([0d03c1a](https://github.com/ChristopherVR/pptx-viewer/commit/0d03c1a17c29499e234cc7e836a55e2d29bd2716))
- **shared:** Honour c:majorGridlines when drawing value-axis gridlines (by @ChristopherVR) ([8b9dd88](https://github.com/ChristopherVR/pptx-viewer/commit/8b9dd88cbe32f873ed8246903105aba0a7ad7e3b))
- **core:** Snapshot baked-in a14 corrections next to the live values (by @ChristopherVR) ([9e6cc01](https://github.com/ChristopherVR/pptx-viewer/commit/9e6cc01181e481d6e3132cc086c6f85c1c80fd44))
- **shared:** Stop re-applying a14 corrections PowerPoint already baked in (by @ChristopherVR) ([52766e7](https://github.com/ChristopherVR/pptx-viewer/commit/52766e78250805a4a03353dc22b1ed637f0c750f))

### Refactor

- **shared:** Extract binding-duplicated engines, option lists and parity descriptors (by @ChristopherVR) ([b0acb02](https://github.com/ChristopherVR/pptx-viewer/commit/b0acb02210b17266f44eed013c2d801d3992257e))

### Testing

- **e2e:** Pin the webfont fallback probe across the five bindings (by @nikko82) ([aabb9dd](https://github.com/ChristopherVR/pptx-viewer/commit/aabb9dd226fc08df63f270aef080936d9f602268))

## [3.1.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.1.5) - 2026-09-01

### Bug Fixes

- **vue:** Stop the Tailwind CLI build step from deleting every scoped SFC style (by @ChristopherVR) ([cc5e2eb](https://github.com/ChristopherVR/pptx-viewer/commit/cc5e2eb1064c362d2fc00e3c47b0cf3a99f47cf1))

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#186](https://github.com/ChristopherVR/pptx-viewer/issues/186)) (by @dependabot[bot]) ([effb251](https://github.com/ChristopherVR/pptx-viewer/commit/effb2510e3a6cf633ceb3dd0c1234bb0998c275c))
- **deps-dev:** Bump happy-dom from 20.12.0 to 20.11.12 ([#187](https://github.com/ChristopherVR/pptx-viewer/issues/187)) (by @dependabot[bot]) ([f386308](https://github.com/ChristopherVR/pptx-viewer/commit/f386308f2a1fd66c7a080628e4ce91b33247f685))

## [3.1.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.1.4) - 2026-08-29

### Bug Fixes

- **animation:** Preserve authored PowerPoint playback and rendering ([#185](https://github.com/ChristopherVR/pptx-viewer/issues/185)) (by @primerch) ([628be23](https://github.com/ChristopherVR/pptx-viewer/commit/628be23999fb116d11cde2a5f62aac941416a1f5))

## [3.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.1.3) - 2026-08-29

### Bug Fixes

- Vertically center the slide canvas to match svelte (by @ChristopherVR) ([c5ff901](https://github.com/ChristopherVR/pptx-viewer/commit/c5ff90100af8d5d70119a82aaea50fe56fbee0a6))
- **ui:** Stop resize/rotate handles rendering behind their own element (by @ChristopherVR) ([1eefded](https://github.com/ChristopherVR/pptx-viewer/commit/1eefded8efb893f9eb9ee19c4f85c64fde94f86b))
- **ui:** Stop ribbon Insert/Animation/View tab content stretching and clipping (by @ChristopherVR) ([9487346](https://github.com/ChristopherVR/pptx-viewer/commit/9487346f32b7ec51a2180305643d960e1e7b65cb))
- **print:** Stop print opening a blank tab and doing nothing (by @ChristopherVR) ([6616f81](https://github.com/ChristopherVR/pptx-viewer/commit/6616f81003354b57b3b56e7de957d4044616b811))
- **ui:** Stop connector-endpoint detach breaking on Vue and Svelte (by @ChristopherVR) ([7fe9401](https://github.com/ChristopherVR/pptx-viewer/commit/7fe9401e6d6ea48ccfa69ae8b0c9bf9f35b88f97))

## [3.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.1.2) - 2026-08-28

### Bug Fixes

- **ui:** Stop ribbon action buttons from stretching to fill the row height (by @ChristopherVR) ([d53ce5b](https://github.com/ChristopherVR/pptx-viewer/commit/d53ce5b4b00e5cfaab70d8a230f37d3f0c241a96))
- **core:** Reindex chart data-point overrides after removing a category (by @ChristopherVR) ([7bd64f8](https://github.com/ChristopherVR/pptx-viewer/commit/7bd64f821d66d1bc7b3f91f46a3e262eda1072ee))
- **shared:** Repair print, drop Package for Sharing, wire Options behavior (by @ChristopherVR) ([bcc2ac7](https://github.com/ChristopherVR/pptx-viewer/commit/bcc2ac7420b50f69d7217f3b9915f0b3e0698640))
- **vue:** Repair print, drop Package for Sharing, wire Options behavior (by @ChristopherVR) ([1b01af0](https://github.com/ChristopherVR/pptx-viewer/commit/1b01af0f0a99fd0f482e2918cd0e15b777d654a5))
- **vue:** Use the canonical Protected View i18n keys in the banner (by @ChristopherVR) ([e84718b](https://github.com/ChristopherVR/pptx-viewer/commit/e84718b70637749c300938807b5e2f910d42ec55))
- **vue:** Stop MobileToolbar rendering alongside the desktop ribbon (by @ChristopherVR) ([9885f93](https://github.com/ChristopherVR/pptx-viewer/commit/9885f93d18f38b144b3646cd06c4b72885b90059))

### Security

- **shared:** Drop duplicate Protected View banner strings (by @ChristopherVR) ([1c35863](https://github.com/ChristopherVR/pptx-viewer/commit/1c358639246cc7fe058e2afe6f95cf52893dfff7))

## [3.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.1.1) - 2026-08-28

### Bug Fixes

- **charts:** Offer 3-D chart types in the type-change dropdown (by @ChristopherVR) ([4e960f7](https://github.com/ChristopherVR/pptx-viewer/commit/4e960f7d25fa53149de667171f4e0fe4a168499c))
- **charts:** Stop 3-D charts from flashing their 2D rendering (by @ChristopherVR) ([18802e0](https://github.com/ChristopherVR/pptx-viewer/commit/18802e041d7293f99b10b860ba793c79eed82b67))

## [3.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.1.0) - 2026-08-28

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

## [3.0.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.0.3) - 2026-08-26

### Bug Fixes

- Stop duplicate inline-edit text render and fix ribbon popup clipping (by @ChristopherVR) ([f084c64](https://github.com/ChristopherVR/pptx-viewer/commit/f084c64c6bb69135b60f083200180933a7f770f7))
- Derive mobile chrome from the browser viewport, not the container (by @ChristopherVR) ([29e5ea1](https://github.com/ChristopherVR/pptx-viewer/commit/29e5ea17b87411fa2058e2d0a25a2323ce6a1133))

### Dependencies

- **deps:** Update fast-xml-parser requirement from ^5.10.1 to ^5.11.0 ([#177](https://github.com/ChristopherVR/pptx-viewer/issues/177)) (by @dependabot[bot]) ([a876e0f](https://github.com/ChristopherVR/pptx-viewer/commit/a876e0f5fd07fd2e7063619882313cc23c4a0162))
- **deps:** Update dompurify requirement from ^3.4.13 to ^3.4.14 ([#173](https://github.com/ChristopherVR/pptx-viewer/issues/173)) (by @dependabot[bot]) ([19afbe1](https://github.com/ChristopherVR/pptx-viewer/commit/19afbe117520bbdeb2c8e930332ae5133df21c30))

## [3.0.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.0.2) - 2026-08-22

### Bug Fixes

- **shared,angular:** Stop the stroke overlay inventing outlines, and finish the Angular whitespace fix (by @ChristopherVR) ([20d4d17](https://github.com/ChristopherVR/pptx-viewer/commit/20d4d177fee97b5f4452a0da739fd51ebaa9e183))

## [3.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.0.1) - 2026-08-22

### Bug Fixes

- **core:** Spell the SmartArt role sentinel as a unicode escape (by @ChristopherVR) ([a2d4993](https://github.com/ChristopherVR/pptx-viewer/commit/a2d4993390bcdc28a3b24c1bf501c64f638f68d9))

## [3.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@3.0.0) - 2026-08-22

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
- **vue:** Consume the shared render decisions for the OpenXML fidelity fixes (by @ChristopherVR) ([f0085f4](https://github.com/ChristopherVR/pptx-viewer/commit/f0085f4535b2a4bd4497c539b5659be346a16bd6))
- **core,shared:** Honour cTn timing attributes, after-animation and effect sound (by @ChristopherVR) ([07ee51f](https://github.com/ChristopherVR/pptx-viewer/commit/07ee51f8b11431153e9ce2553c4c11a51e15316e))
- **core:** Close slide-structure, notes-style and DrawingML parse gaps (by @ChristopherVR) ([ee1dbcd](https://github.com/ChristopherVR/pptx-viewer/commit/ee1dbcd3278e2bde7b066c4085a82f56cc818f6a))
- **shared:** Render data tables, legend entries, image overlays and 3D text (by @ChristopherVR) ([ecec502](https://github.com/ChristopherVR/pptx-viewer/commit/ecec502e205f06c1bb7dec042f7693ac4fd8a74e))
- **vue:** Consume the shared decisions for the second parity wave (by @ChristopherVR) ([983bbaa](https://github.com/ChristopherVR/pptx-viewer/commit/983bbaa19c68600c83bddcfdc5aabd264ab21908))

### Refactor

- **shared:** Split oversized text modules and add the circle-in keyframe (by @ChristopherVR) ([1c0797f](https://github.com/ChristopherVR/pptx-viewer/commit/1c0797f7d5468dca16f6cb53c1ad413db4fc29e0))

### Documentation

- **core:** Record audited OpenXML construct coverage in the manifest (by @ChristopherVR) ([812fe61](https://github.com/ChristopherVR/pptx-viewer/commit/812fe61e66687a48c2cd19eeb0c502767c25e3c1))

### Testing

- **core:** Evidence previously unverified OpenXML constructs, and record what is not implemented (by @ChristopherVR) ([4dc6028](https://github.com/ChristopherVR/pptx-viewer/commit/4dc602876bd49cdb03b084f9f4fa2268aa01f22f))

### Chores

- **core:** Complete barrel and runtime wiring for the preceding two changes (by @ChristopherVR) ([115379e](https://github.com/ChristopherVR/pptx-viewer/commit/115379e9a757b029fbc0cbb74ae51628f7fb3e27))

## [2.23.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.23.0) - 2026-08-21

### Features

- **shared,react:** Wire interactive 3D surface chart scene (opt-in) (by @ChristopherVR) ([78587a4](https://github.com/ChristopherVR/pptx-viewer/commit/78587a4b2b34f745bd71a29d8952621eec31d3b9))
- **vue:** Wire interactive 3D surface chart scene (opt-in) (by @ChristopherVR) ([3597bec](https://github.com/ChristopherVR/pptx-viewer/commit/3597becbf5e2fe491df0bf36719511c3d8b093f6))

### Bug Fixes

- **shared:** Compute elbow/curved connector routing from actual shape geometry (by @ChristopherVR) ([eecc519](https://github.com/ChristopherVR/pptx-viewer/commit/eecc519961d0a825f550c5d1b6c41f55b1d101ae))
- **core,vue:** Compute elbow/curved connector routing from actual shape geometry (by @ChristopherVR) ([f2882a1](https://github.com/ChristopherVR/pptx-viewer/commit/f2882a11d16253683c82b04463442f6e80b7d507))

### Documentation

- **core:** Correct stale OLE and SmartArt capability text (by @ChristopherVR) ([0c7e68d](https://github.com/ChristopherVR/pptx-viewer/commit/0c7e68d66cf27fdc35f31d9fa06faab0d287a16c))
- **core:** Certify DrawingML line/stroke properties in the OpenXML coverage manifest (by @ChristopherVR) ([caa2570](https://github.com/ChristopherVR/pptx-viewer/commit/caa2570d508b4904d8f541a392933da7be50dc32))

## [2.22.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.22.1) - 2026-08-21

### Bug Fixes

- **core:** Restore mc:AlternateContent envelope on passthrough template save (by @ChristopherVR) ([1659244](https://github.com/ChristopherVR/pptx-viewer/commit/165924427f0a2e1f834e1b24d7237a1c0125d8f6))
- **core:** Stop baking theme effectRef into a literal effectLst on save (by @ChristopherVR) ([59a5566](https://github.com/ChristopherVR/pptx-viewer/commit/59a5566aef9304d4f2a31c6b4e2f95f86841dd8f))
- **core:** Read line-family chart series colors on any chart, not just combo (by @ChristopherVR) ([e62dfcf](https://github.com/ChristopherVR/pptx-viewer/commit/e62dfcf2a6850a86944730f752b321c08b44e477))
- **core:** Write line-family chart series colors into a:ln, not a corrupting spPr (by @ChristopherVR) ([5b54357](https://github.com/ChristopherVR/pptx-viewer/commit/5b54357646ca63723944bbf44f8ac7c23912e035))

## [2.22.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.22.0) - 2026-08-21

### Features

- **shared:** Add header-footer dialog draft helpers (by @ChristopherVR) ([0f640c8](https://github.com/ChristopherVR/pptx-viewer/commit/0f640c887c4d6447d2a6cbba2754049cec69e121))
- **shared:** Add classifyMediaType, the audio/video MIME classifier (by @ChristopherVR) ([56520a1](https://github.com/ChristopherVR/pptx-viewer/commit/56520a1138f342b2e4e33ff5bbedb64f5a8ca9e4))
- **shared:** Add resolveTemplateBackgroundRows for the template background card (by @ChristopherVR) ([67d327d](https://github.com/ChristopherVR/pptx-viewer/commit/67d327d737a06b7ca737feffb01d9afe637c108f))
- **vue:** Port master/layout background editing to the inspector (by @ChristopherVR) ([43cf4c4](https://github.com/ChristopherVR/pptx-viewer/commit/43cf4c44fe5aa56a06b5719b3b77fb20295205d5))
- **shared:** Add patchChartData, the type-aware chart data patcher (by @ChristopherVR) ([5309296](https://github.com/ChristopherVR/pptx-viewer/commit/5309296df312affd6c9f9994cc7e4612310d8119))
- **shared:** Add pptx.group.childCount/groupedElement i18n keys (by @ChristopherVR) ([f5557e1](https://github.com/ChristopherVR/pptx-viewer/commit/f5557e1ac1ef74af4306cf81cd2c08c8b61dd960))
- **vue:** Add the missing group/OLE element info cards (by @ChristopherVR) ([e117a6c](https://github.com/ChristopherVR/pptx-viewer/commit/e117a6c9bf20975f10a8f4237cfa0434fdaafd60))
- **vue:** Add the missing transition click-to-play preview thumbnail (by @ChristopherVR) ([2e3c502](https://github.com/ChristopherVR/pptx-viewer/commit/2e3c5022914b4bc8a61cf7a1d9838ccc5edcec4d))

### Bug Fixes

- **vue:** Stop closing Header & Footer dialog on every field edit (by @ChristopherVR) ([b41d0d0](https://github.com/ChristopherVR/pptx-viewer/commit/b41d0d042ec76658ef2e1e0aee5625d5773fe1b8))
- **shared:** Sanitize every download filename, not just callers that remember to (by @ChristopherVR) ([7bdf73b](https://github.com/ChristopherVR/pptx-viewer/commit/7bdf73be98ae30b4664067a52b1611878d7d97b3))
- **vue:** Route paste through the shared clipboard codec (by @ChristopherVR) ([587967d](https://github.com/ChristopherVR/pptx-viewer/commit/587967daec29b9775b00fe493f42361927e010f5))
- **shared:** Floor animation timeline bar width to a visible minimum (by @ChristopherVR) ([918ac2f](https://github.com/ChristopherVR/pptx-viewer/commit/918ac2f5a50d11fb1ad7e015956794f9cd44dfee))
- **vue:** Repoint chart data-grid ops onto shared, fixing a locale bug (by @ChristopherVR) ([a2248c3](https://github.com/ChristopherVR/pptx-viewer/commit/a2248c370852c922769a250f349a3a486b2dc85b))
- **vue:** Stop the sorter's context menu closing itself on open (by @ChristopherVR) ([6576b72](https://github.com/ChristopherVR/pptx-viewer/commit/6576b72d493d19a1917dc57a473af5421990e43e))

### Refactor

- **react,vue,svelte,vanilla:** Repoint media-type check onto shared (by @ChristopherVR) ([bb8e95c](https://github.com/ChristopherVR/pptx-viewer/commit/bb8e95c810e2fd709e12f21d5b073b179e1dbf52))
- **vue:** Repoint chart type-change patch onto shared patchChartData (by @ChristopherVR) ([9bb70cc](https://github.com/ChristopherVR/pptx-viewer/commit/9bb70cca3189f30fef495c2afca4285b3d65fe89))

### Documentation

- **vue,angular:** Fix stale comments claiming already-shipped features (by @ChristopherVR) ([e365950](https://github.com/ChristopherVR/pptx-viewer/commit/e365950cf3c49199575ffdafd0337b1f1b2593d8))

## [2.21.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.21.6) - 2026-08-21

### Bug Fixes

- **core:** Parse full custom geometry on pictures, not just path data (by @ChristopherVR) ([b6cbef6](https://github.com/ChristopherVR/pptx-viewer/commit/b6cbef64296fade4b1a0c77c32847e68ea0a18c5))

## [2.21.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.21.5) - 2026-08-21

### Bug Fixes

- **vue:** Remove duplicate touch double-tap tracker in table cells (by @ChristopherVR) ([c378a29](https://github.com/ChristopherVR/pptx-viewer/commit/c378a297b68f773da684dd946501550cf8a3ba01))

## [2.21.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.21.4) - 2026-08-20

### Bug Fixes

- **core:** Correct EOT header parsing for version 0x00020001 containers (by @ChristopherVR) ([e43720e](https://github.com/ChristopherVR/pptx-viewer/commit/e43720ed176c62e0779ddb6fd3fdffc08ba19bbd))
- **core:** Size table graphic frames from their grid extent (by @ChristopherVR) ([6d75c18](https://github.com/ChristopherVR/pptx-viewer/commit/6d75c18072cc0bb305b6550767dab780314d8dee))
- **core:** Accept Strict-OOXML lexical percentages in table style tint/shade (by @ChristopherVR) ([8fa8111](https://github.com/ChristopherVR/pptx-viewer/commit/8fa81117e68a9033c37ddd4cf61703100234171c))
- **core:** Stabilize Strict-conformance resaves (by @ChristopherVR) ([3c43f51](https://github.com/ChristopherVR/pptx-viewer/commit/3c43f5164d1e13edbc3d6e5450e66fd08664d108))
- **core:** Correct the Strict custom/extended-properties namespace mapping (by @ChristopherVR) ([d5001f9](https://github.com/ChristopherVR/pptx-viewer/commit/d5001f9f4b977fd0a76d31c0fef534ff1a53bea3))
- **core:** Stop a paragraph's alignment from leaking onto later paragraphs (by @ChristopherVR) ([c18b1e7](https://github.com/ChristopherVR/pptx-viewer/commit/c18b1e7161b4d6e5983c1542cbd2c7fe03081037))
- **core:** Keep SmartArt cached line-preset shapes with zero width or height (by @ChristopherVR) ([41e3059](https://github.com/ChristopherVR/pptx-viewer/commit/41e30596c4072295b6af3c50439c3966acae2b71))
- **shared:** Apply autofit shrink-to-fit scale/reduction to paragraph struts (by @ChristopherVR) ([4c1d5c8](https://github.com/ChristopherVR/pptx-viewer/commit/4c1d5c8f4c54ee8200d61c58027284b32e5f8f2c))

## [2.21.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.21.3) - 2026-08-20

### Bug Fixes

- **ci:** Resolve oxlint errors and warnings blocking CI lint job (by @ChristopherVR) ([a2031be](https://github.com/ChristopherVR/pptx-viewer/commit/a2031bedb27a4d1bf7c0cf754ce6b81a241972e5))

## [2.21.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.21.2) - 2026-08-20

### Bug Fixes

- **shared:** Describe stripped invisible characters by code point, not literally (by @ChristopherVR) ([9ddca51](https://github.com/ChristopherVR/pptx-viewer/commit/9ddca51028e7bba92a9433513dea0c5320415bdb))

## [2.21.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.21.1) - 2026-08-20

### Bug Fixes

- **mobile:** Repoint react/vue/angular mobile sheet toggling onto shared (by @ChristopherVR) ([d8e6228](https://github.com/ChristopherVR/pptx-viewer/commit/d8e62280d49f1b7cdaa3e5034e2134c7380e5063))
- **shared:** Repoint options numeric-control clamp onto shared helper (by @ChristopherVR) ([138dfe5](https://github.com/ChristopherVR/pptx-viewer/commit/138dfe5d6cc780915ab8d9ca591f75c698b35f22))

### Refactor

- **react,vue,angular:** Repoint chart value-drag onto shared engine (by @ChristopherVR) ([1d5fd6a](https://github.com/ChristopherVR/pptx-viewer/commit/1d5fd6af4a8847168674b50e9039d6ba96926f43))
- **shared,react,vue,vanilla:** Repoint comment mutations onto shared comments-list (by @ChristopherVR) ([0eb28dc](https://github.com/ChristopherVR/pptx-viewer/commit/0eb28dc5d714ebe695c8b23c6b09aefc6b99ac0d))
- **react,vue:** Repoint SmartArt chrome style onto shared buildChromeStyle (by @ChristopherVR) ([2a9602f](https://github.com/ChristopherVR/pptx-viewer/commit/2a9602f8ee7f930c4d950f19ba616196bc9d9cb7))

## [2.21.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.21.0) - 2026-08-20

### Features

- **shared:** Add hover tooltips to every chart mark, not just the region map (by @ChristopherVR) ([4ca29f5](https://github.com/ChristopherVR/pptx-viewer/commit/4ca29f590b1d1154b1034b7c5aeaa469610353d5))

### Bug Fixes

- **vue:** Use shared per-occurrence find/replace engine (by @ChristopherVR) ([81f197d](https://github.com/ChristopherVR/pptx-viewer/commit/81f197ddf54ac54e559b3053be1c7deea43dfbd9))
- **vue:** Disable mobile bottom bar tabs with no slides loaded (by @ChristopherVR) ([967f9b3](https://github.com/ChristopherVR/pptx-viewer/commit/967f9b3d3a8991a203f093fe33fa8fda42543e49))
- **angular:** Wire Home ribbon Reset/Fill/Outline through shared commands (by @ChristopherVR) ([c06b894](https://github.com/ChristopherVR/pptx-viewer/commit/c06b8947fae4888b0db69f37c043bfe9e83dd66d))
- **vue:** Clamp animation duration/delay/repeat via shared setters (by @ChristopherVR) ([595f9c5](https://github.com/ChristopherVR/pptx-viewer/commit/595f9c57001df657f73edd12bf2fb99db2cba941))
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

## [2.20.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.7) - 2026-08-19

### Bug Fixes

- **core:** Correct OOXML a:tint colour math (ECMA-376 20.1.2.3.32) (by @ChristopherVR) ([7cf29f3](https://github.com/ChristopherVR/pptx-viewer/commit/7cf29f321994b7e9df8fe11d821a2c2fe686e1cd))
- **shared:** Stretch uncropped pictures to fill their frame (by @ChristopherVR) ([ff2fee3](https://github.com/ChristopherVR/pptx-viewer/commit/ff2fee3b3bba88e9a4d50a0735e9558c65e8041e))
- **core:** Don't clone an arbitrary slide onto a new blank slide (by @ChristopherVR) ([1bd1bd6](https://github.com/ChristopherVR/pptx-viewer/commit/1bd1bd6be1aa657b89ef5782e5d3c466686102c4))
- **core:** Don't bind special placeholders to untyped ones by idx alone (by @ChristopherVR) ([d92eb11](https://github.com/ChristopherVR/pptx-viewer/commit/d92eb11095ee390a596126acc59c8dd9cc18f8a8))
- **core:** Resolve layout-switch geometry from the master when omitted (by @ChristopherVR) ([a09aa5a](https://github.com/ChristopherVR/pptx-viewer/commit/a09aa5a306e160954bbc09052444ad22ab4385a1))
- **core:** Reverse the GUID-derived XOR key for font de/obfuscation (by @ChristopherVR) ([7733edf](https://github.com/ChristopherVR/pptx-viewer/commit/7733edf62f9f9a307c470dd93cfba36c8dbb9339))
- **core:** Drop untouched placeholder prompts on repeated layout switch (by @ChristopherVR) ([8842223](https://github.com/ChristopherVR/pptx-viewer/commit/884222317ad7da002e28e6272257bb4563b89fb2))
- **security:** Resolve code-scanning ReDoS and comment-sanitization alerts (by @ChristopherVR) ([e58e3f5](https://github.com/ChristopherVR/pptx-viewer/commit/e58e3f540e4e34c3617d32efdeea4ace6899e2bf))

## [2.20.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.6) - 2026-08-19

### Bug Fixes

- **shared:** Add collaboration-active-session connected-users view-model (by @ChristopherVR) ([7add165](https://github.com/ChristopherVR/pptx-viewer/commit/7add165d14ae855889bd9aedac13e859b86d2274))
- **vue:** Mobile Comments/Notes double header, Share dialog user list (by @ChristopherVR) ([9091398](https://github.com/ChristopherVR/pptx-viewer/commit/90913981aab89a608b38416ec4e22a5d429990c4))

## [2.20.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.5) - 2026-08-19

### Dependencies

- **deps:** Update y-websocket requirement from ^3.0.0 to ^3.1.0 ([#169](https://github.com/ChristopherVR/pptx-viewer/issues/169)) (by @dependabot[bot]) ([7e9c5a5](https://github.com/ChristopherVR/pptx-viewer/commit/7e9c5a51a7cb46df36223df4f91f192200562871))
- **deps:** Bump @ai-sdk/vue from 4.0.66 to 4.0.65 ([#163](https://github.com/ChristopherVR/pptx-viewer/issues/163)) (by @dependabot[bot]) ([996f840](https://github.com/ChristopherVR/pptx-viewer/commit/996f84080e06cace9c945c27d293e8305a60999d))

### Chores

- **deps-dev:** Bump jsdom from 29.1.1 to 30.0.1 ([#171](https://github.com/ChristopherVR/pptx-viewer/issues/171)) (by @dependabot[bot]) ([cfe38c9](https://github.com/ChristopherVR/pptx-viewer/commit/cfe38c9e848bd509e59dfbbb6898aac13ce69b7e))
- **deps-dev:** Update vite requirement from ^8.2.0 to ^8.2.1 ([#165](https://github.com/ChristopherVR/pptx-viewer/issues/165)) (by @dependabot[bot]) ([a059a9e](https://github.com/ChristopherVR/pptx-viewer/commit/a059a9ecbd374279864c42d45c249bcb5c0ecc6b))
- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#162](https://github.com/ChristopherVR/pptx-viewer/issues/162)) (by @dependabot[bot]) ([2645f25](https://github.com/ChristopherVR/pptx-viewer/commit/2645f258a35282b61960c30649f216e583879f12))

## [2.20.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.4) - 2026-08-14

### Bug Fixes

- **vanilla:** Repair the properties panel, inline editor, mobile chrome and show performance (by @ChristopherVR) ([47265ef](https://github.com/ChristopherVR/pptx-viewer/commit/47265efba9459359695bdcd74038b8b6d0787d0f))

## [2.20.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.3) - 2026-08-14

### Bug Fixes

- **shared:** Run an in-place morph dissolve on the wrapper, not the element (by @ChristopherVR) ([d46d2ee](https://github.com/ChristopherVR/pptx-viewer/commit/d46d2eea5aeced925f1b51b4be2758f2b634ea3e))

## [2.20.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.2) - 2026-08-14

### Bug Fixes

- **shared:** Sum a morph cross-dissolve instead of stacking two fades (by @ChristopherVR) ([86a9e7a](https://github.com/ChristopherVR/pptx-viewer/commit/86a9e7a2ab851d7b0005ab2d1c2267f668b308a8))

### Testing

- Mask the fields that legitimately move, and size two waits for CI (by @ChristopherVR) ([68bae19](https://github.com/ChristopherVR/pptx-viewer/commit/68bae19fe8cb3e283e2c87a90d31946c48be5e3a))

## [2.20.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.1) - 2026-08-14

### Bug Fixes

- Repair five regressions this review introduced (by @ChristopherVR) ([952063b](https://github.com/ChristopherVR/pptx-viewer/commit/952063b7c1a198aed9acc0696b2b326deba35e95))

## [2.20.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.20.0) - 2026-08-13

### Features

- **shared:** Take the last six chart kinds and the autosave policy (by @ChristopherVR) ([efe8438](https://github.com/ChristopherVR/pptx-viewer/commit/efe84381688dfb5f2a44a2990e76aa09b65e5fba))

### Bug Fixes

- **core:** Repair the XML plumbing four separate defects were hiding behind (by @ChristopherVR) ([8beb664](https://github.com/ChristopherVR/pptx-viewer/commit/8beb66410975d492118120515bbae6cd070ef792))
- **bindings:** Stop read-only surfaces clobbering live state (by @ChristopherVR) ([e820984](https://github.com/ChristopherVR/pptx-viewer/commit/e8209842fad62819df1530944124f0bfc33e32ec))

## [2.19.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.19.0) - 2026-08-13

### Bug Fixes

- **core:** Stop save rewriting what the author never wrote (by @ChristopherVR) ([6fb2767](https://github.com/ChristopherVR/pptx-viewer/commit/6fb2767583de0e82747c3700e3311869dd693a1d))

## [2.18.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.18.0) - 2026-08-13

### Features

- **shared:** Own the decisions the bindings were each making themselves (by @ChristopherVR) ([5421272](https://github.com/ChristopherVR/pptx-viewer/commit/5421272a531536ab3b494e5df91068c98326e6ed))
- **shared:** Model hyperlinks and equations, and own the group rules (by @ChristopherVR) ([a6bf4c1](https://github.com/ChristopherVR/pptx-viewer/commit/a6bf4c15ab3b49a44a2d24e2122ddbe3cdd3b8ed))

### Bug Fixes

- **core:** Repair save-pipeline corruption found by the OpenXML parity audit (by @ChristopherVR) ([554006e](https://github.com/ChristopherVR/pptx-viewer/commit/554006e004b6212f5561eb19954bbcff17bbdf7f))
- **vue:** Make the controls that render actually do something (by @ChristopherVR) ([11686f0](https://github.com/ChristopherVR/pptx-viewer/commit/11686f0d9bfbc1af4f0a0e82ab941ae89bd5ff7f))
- **vue:** Thread the ribbon props the toolbar sections require (by @ChristopherVR) ([c86209e](https://github.com/ChristopherVR/pptx-viewer/commit/c86209ebc260db27d3448e3028734dea27dac8ff))
- **vue:** Complete the custom-fonts wiring through the settings dialog (by @ChristopherVR) ([5e6d71a](https://github.com/ChristopherVR/pptx-viewer/commit/5e6d71a59eaa0305fbc797d5cb09b67620ecaa05))
- **vue:** Drop a duplicated SettingsCustomFontsSection import (by @ChristopherVR) ([e136ad0](https://github.com/ChristopherVR/pptx-viewer/commit/e136ad078b9fbac487a8c8c0e43053c048c3f299))
- **core:** Close the round-trip defects the corpus harness exposed (by @ChristopherVR) ([2011c66](https://github.com/ChristopherVR/pptx-viewer/commit/2011c664049bfd580801529c3337ba65bd8d3f13))
- **vue:** Autosave template edits and render SmartArt labels (by @ChristopherVR) ([1e45359](https://github.com/ChristopherVR/pptx-viewer/commit/1e453591b171c6e165b13502f7cf6325cb4e9d5e))

## [2.17.9](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.9) - 2026-08-11

### Bug Fixes

- **shared:** Keep a morph pair travelling when its outline is tweened too (by @ChristopherVR) ([0316cf7](https://github.com/ChristopherVR/pptx-viewer/commit/0316cf7b058bc49b247250d9e188822fdd4ef11f))
- **shared:** Dissolve a re-fitted morph paragraph in place instead of stretching it (by @ChristopherVR) ([975c6f6](https://github.com/ChristopherVR/pptx-viewer/commit/975c6f600a836081ec0f30c99fffb9aabbaaa598))

## [2.17.8](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.8) - 2026-08-11

### Bug Fixes

- **shared:** Stop Vue and Angular writing an inline pointer-events lock during a show (by @ChristopherVR) ([4cb649a](https://github.com/ChristopherVR/pptx-viewer/commit/4cb649a53f5903557ef2f93c190fe6ddd538599e))

## [2.17.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.7) - 2026-08-11

### Bug Fixes

- **vue:** Swap inherited layout artwork when a slide's layout changes (by @ChristopherVR) ([1e927ce](https://github.com/ChristopherVR/pptx-viewer/commit/1e927ce2f079c1e84659791fa62f47b9e2e0ad45))

### Refactor

- **shared:** One paragraph-spacing resolver, and delete four more binding copies (by @ChristopherVR) ([65f8268](https://github.com/ChristopherVR/pptx-viewer/commit/65f8268df08021c1985dc86d93d3338c96b792c8))
- **shared:** Give the cached-SmartArt projection the whole decision, and React's table styling too (by @ChristopherVR) ([411148f](https://github.com/ChristopherVR/pptx-viewer/commit/411148f44630a65b1cd6e90a2954a53a24f110a5))
- **shared:** Move find/replace and per-cell table CSS off their React copies (by @ChristopherVR) ([5b81728](https://github.com/ChristopherVR/pptx-viewer/commit/5b81728891f3e8cea1c2def2aed2d8b23e338081))
- **vue:** Take the comment id from shared (by @ChristopherVR) ([b8d2950](https://github.com/ChristopherVR/pptx-viewer/commit/b8d2950edc73e5ac6691a0164825d9f2ff58ac39))

## [2.17.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.6) - 2026-08-10

### Bug Fixes

- **shared:** Render cached SmartArt shapes and transparent table headers as authored (by @ChristopherVR) ([24ec6b4](https://github.com/ChristopherVR/pptx-viewer/commit/24ec6b4f2079b55f02aa5559bfa3c3f1eae67652))
- **react:** Connect the Home tab's Layout control to the slide it acts on (by @ChristopherVR) ([6cb76bb](https://github.com/ChristopherVR/pptx-viewer/commit/6cb76bb27caaf486c280f432f9476f2365eb46ca))

## [2.17.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.5) - 2026-08-10

### Bug Fixes

- **core:** Read placeholder, list and percentage values as authored (by @ChristopherVR) ([dc2d679](https://github.com/ChristopherVR/pptx-viewer/commit/dc2d679d48d3be854743d3a09bd2e20c5dc5331f))
- **shared:** Paint an inert morph ghost statically so it stops jittering (by @ChristopherVR) ([ce3be84](https://github.com/ChristopherVR/pptx-viewer/commit/ce3be8487d3530425afb3b455e1671b6c54ae61c))

## [2.17.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.4) - 2026-08-10

### Bug Fixes

- **shared:** Crossfade morph wording instead of fading it out then in (by @ChristopherVR) ([50984f1](https://github.com/ChristopherVR/pptx-viewer/commit/50984f141acc601d35aad19883b6fb1f8e0b79c2))

## [2.17.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.3) - 2026-08-10

### Dependencies

- **deps:** Update dompurify requirement from ^3.4.12 to ^3.4.13 ([#151](https://github.com/ChristopherVR/pptx-viewer/issues/151)) (by @dependabot[bot]) ([7b975ff](https://github.com/ChristopherVR/pptx-viewer/commit/7b975ff73403916341fd8a6192fb6fd6c88fdc17))
- **deps:** Update yjs requirement from ^13.6.31 to ^13.6.32 ([#152](https://github.com/ChristopherVR/pptx-viewer/issues/152)) (by @dependabot[bot]) ([456fdb8](https://github.com/ChristopherVR/pptx-viewer/commit/456fdb8493487ab3e346714755239a90698f6b4d))
- **deps:** Bump @ai-sdk/vue from 4.0.58 to 4.0.56 ([#154](https://github.com/ChristopherVR/pptx-viewer/issues/154)) (by @dependabot[bot]) ([684248e](https://github.com/ChristopherVR/pptx-viewer/commit/684248efdd237f2236da6e8bb6cc1b5531992d47))
- **deps:** Update vue-tsc requirement from ^3.3.8 to ^3.3.9 ([#159](https://github.com/ChristopherVR/pptx-viewer/issues/159)) (by @dependabot[bot]) ([665ef13](https://github.com/ChristopherVR/pptx-viewer/commit/665ef139ab96a1c84815343c84bb53912b1b21d2))

### Chores

- **deps-dev:** Bump the minor-and-patch group with 2 updates ([#150](https://github.com/ChristopherVR/pptx-viewer/issues/150)) (by @dependabot[bot]) ([ab75bf1](https://github.com/ChristopherVR/pptx-viewer/commit/ab75bf10a96bb2a0da6e963a5b6b8634e4f73d5b))

## [2.17.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.2) - 2026-08-08

### Bug Fixes

- Dissolve a morph's arriving shapes over the ghost that hid them (by @ChristopherVR) ([89536a3](https://github.com/ChristopherVR/pptx-viewer/commit/89536a36c3e38c3bc8b1219f702dee39e1526fcb))
- Dissolve a morph's centre panel the way PowerPoint measurably does (by @ChristopherVR) ([8c03a9a](https://github.com/ChristopherVR/pptx-viewer/commit/8c03a9a4db720dc4c6883ecd5778749e9148f3af))
- **shared:** Measure per word, and never measure a glyph in isolation (by @ChristopherVR) ([a92004b](https://github.com/ChristopherVR/pptx-viewer/commit/a92004bd554a66e5a0812d5bd20b3df1fff94379))

## [2.17.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.1) - 2026-08-07

### Bug Fixes

- **shared:** Morph a picture's scale, which OOXML stores as a source crop (by @ChristopherVR) ([e2743c7](https://github.com/ChristopherVR/pptx-viewer/commit/e2743c7509090272f4d7bed6df506402de8f6a91))
- **shared:** A still of a slide paints no media chrome (by @ChristopherVR) ([d99e6fd](https://github.com/ChristopherVR/pptx-viewer/commit/d99e6fda7de360e1b1c3f16c578119f8ce5b5d5a))
- **vue:** Route the media fallback through the shared surface rule (by @ChristopherVR) ([9eec996](https://github.com/ChristopherVR/pptx-viewer/commit/9eec9969af543a1e66c35cfb2ced38b0821cac5a))
- **shared:** Measure each run's PowerPoint width instead of guessing one (by @ChristopherVR) ([920d1f3](https://github.com/ChristopherVR/pptx-viewer/commit/920d1f38129886f834fcfe42681339e8251f6814))
- **shared:** A media fallback says WHICH badge, not just "a badge" (by @ChristopherVR) ([1cbe78f](https://github.com/ChristopherVR/pptx-viewer/commit/1cbe78f85985ca87a834380932d845303250606d))
- **vue:** Mark missing media as not found, not as playable (by @ChristopherVR) ([1931659](https://github.com/ChristopherVR/pptx-viewer/commit/1931659c14d28a17424dbccd513afb92c4fa9cdd))

### Styling

- **shared:** Escape the measurement cache separator (by @ChristopherVR) ([944b312](https://github.com/ChristopherVR/pptx-viewer/commit/944b312abee48c351b84e39c794027a18ec2d758))

## [2.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.17.0) - 2026-08-07

### Features

- Navigate a running slide show on the wheel in every binding (by @ChristopherVR) ([91a19e9](https://github.com/ChristopherVR/pptx-viewer/commit/91a19e96df9d19862b92c3f89ca55acbfbde3111))

## [2.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.16.0) - 2026-08-07

### Features

- **shared:** Map wheel gestures to PowerPoint's intents (by @ChristopherVR) ([1cc7797](https://github.com/ChristopherVR/pptx-viewer/commit/1cc779799cf5b6ffa94c39199c71b563e21afa82))

### Refactor

- Route four bindings through the shared geometry cascade (by @ChristopherVR) ([859ca12](https://github.com/ChristopherVR/pptx-viewer/commit/859ca12b37efcf98e7614b2c2109f3bf1d9c0f72))

## [2.15.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.15.3) - 2026-08-07

### Bug Fixes

- **shared:** Stop category-axis labels crowding the plot (by @ChristopherVR) ([b511ac4](https://github.com/ChristopherVR/pptx-viewer/commit/b511ac44bb53ed2ca20932801c805ea7f0a2fcd1))
- Let clicks fall through an unfilled shape's interior (by @ChristopherVR) ([7e17f9d](https://github.com/ChristopherVR/pptx-viewer/commit/7e17f9ddacd058d9b5c13f1060f58621faeb9908))
- Hollow-shape click-through in the remaining four bindings (by @ChristopherVR) ([fee05ad](https://github.com/ChristopherVR/pptx-viewer/commit/fee05ad5463de9949f289d3aac889794bc7d834a))

### Refactor

- **shared:** Single-source the shape geometry cascade (by @ChristopherVR) ([396e4a2](https://github.com/ChristopherVR/pptx-viewer/commit/396e4a28299168af0564364e9b0be7413b2c8ce8))

## [2.15.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.15.2) - 2026-08-07

### Bug Fixes

- **core:** Measure parallelogram skew against the short side, not the width (by @ChristopherVR) ([fea647f](https://github.com/ChristopherVR/pptx-viewer/commit/fea647f94633e6e919a1c59bda7a71cda8b1b677))
- **core:** Bulge the teardrop preset's point outwards, not inwards (by @ChristopherVR) ([0b23bc4](https://github.com/ChristopherVR/pptx-viewer/commit/0b23bc4b6ecde5f82f7cebb0601859edbf1ab399))
- Render ellipses as ellipses, not pills (by @ChristopherVR) ([b6d2598](https://github.com/ChristopherVR/pptx-viewer/commit/b6d2598fb58f8fc81fbef463c728d87a78c129b4))
- Stop slicing overflowing text with an identity rect clip-path (by @ChristopherVR) ([7393111](https://github.com/ChristopherVR/pptx-viewer/commit/73931118e9e29bf16d1ffccb6f01d68a02091463))

## [2.15.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.15.1) - 2026-08-07

### Bug Fixes

- **core:** Recognize nodeType="afterEffect" when parsing animation triggers (by @ChristopherVR) ([554c077](https://github.com/ChristopherVR/pptx-viewer/commit/554c077b6d0960c5777163a83afe27ee9795b8c2))

## [2.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.15.0) - 2026-08-07

### Features

- **shared:** Remember the open deck so a refresh reopens it (by @ChristopherVR) ([abbe3bd](https://github.com/ChristopherVR/pptx-viewer/commit/abbe3bd15318dd2b7b470eb69b51468d5b9ed26a))

### Bug Fixes

- **shared:** Make Set Up Slide Show's Manual advance mode actually work (by @ChristopherVR) ([c308423](https://github.com/ChristopherVR/pptx-viewer/commit/c3084238158b582b149fcc74903045f4145a0981))

## [2.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.14.0) - 2026-08-07

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
- **vue:** Reach the AI assistant on mobile and scale resize handles (by @ChristopherVR) ([f2795d5](https://github.com/ChristopherVR/pptx-viewer/commit/f2795d5190bb310ca4ad8ea5c6dfe546b088eb4e))
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

## [2.13.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.13.2) - 2026-08-05

### Bug Fixes

- **core:** Resolve styled full font names and add condensed fallbacks (by @ChristopherVR) ([26b1f74](https://github.com/ChristopherVR/pptx-viewer/commit/26b1f745929fe33cda2044dc4a24ff4edbbab0d5))
- **shared:** Draw chart text at point size and scale chart SVGs 1:1 (by @ChristopherVR) ([da333f9](https://github.com/ChristopherVR/pptx-viewer/commit/da333f933eeba0af226ca1894639696350e23cfb))
- **shared:** Suspend the show on window blur, not only tab-hide (by @ChristopherVR) ([4a2c254](https://github.com/ChristopherVR/pptx-viewer/commit/4a2c254350554c189a53a0284aeb72e84b724740))
- **shared:** Fold the origami transition like a sheet of paper (by @ChristopherVR) ([f0f9fc2](https://github.com/ChristopherVR/pptx-viewer/commit/f0f9fc2710a4c1a3760729cfddca0afc7f66c70d))
- **shared:** Cover the fillRect placement fields in the collab schema (by @ChristopherVR) ([d455ed7](https://github.com/ChristopherVR/pptx-viewer/commit/d455ed72b254633d34e08d7694069e6c0d9f5615))

## [2.13.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.13.1) - 2026-08-05

### Dependencies

- **deps:** Bump ai from 7.0.48 to 7.0.44 ([#134](https://github.com/ChristopherVR/pptx-viewer/issues/134)) (by @dependabot[bot]) ([08a13e0](https://github.com/ChristopherVR/pptx-viewer/commit/08a13e076caa6d97e22bd706e57657407aef1dd8))

### Chores

- **deps-dev:** Update vite requirement from ^8.1.5 to ^8.2.0 ([#135](https://github.com/ChristopherVR/pptx-viewer/issues/135)) (by @dependabot[bot]) ([1e7e296](https://github.com/ChristopherVR/pptx-viewer/commit/1e7e2965eff8635dfa8b94fa196b89ed1d0fd0c7))

## [2.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.13.0) - 2026-08-01

### Features

- Fixed graphs and arrows shapes (by @ChristopherVR) ([94813f5](https://github.com/ChristopherVR/pptx-viewer/commit/94813f52a75fb3b42f72e7c33be41393b794cf82))

## [2.12.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.12.1) - 2026-08-01

### Bug Fixes

- Make an inspector edit exactly one undo step, in every binding (by @ChristopherVR) ([48733d4](https://github.com/ChristopherVR/pptx-viewer/commit/48733d4a9dbe8d7887b0a103cc7cb1e90882464b))
- Let the presenter finish the show, and keep scrubbers out of its panes (by @ChristopherVR) ([c7c12bc](https://github.com/ChristopherVR/pptx-viewer/commit/c7c12bc053548c8e94d3da385461d6569a1695a0))

### Refactor

- **vue:** Drop the orphaned useSelection composable (by @ChristopherVR) ([f5f31f3](https://github.com/ChristopherVR/pptx-viewer/commit/f5f31f3710bbf26e0dd60e0c68a852b033ee8e22))
- **shared:** Split arrow markers and dash patterns out of connector-path (by @ChristopherVR) ([53d47d1](https://github.com/ChristopherVR/pptx-viewer/commit/53d47d1d529fe17f165a16ec9de7b7f29b17845c))

## [2.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.12.0) - 2026-08-01

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

### Refactor

- **vue:** Decompose the two largest view-layer files (by @ChristopherVR) ([0bd2568](https://github.com/ChristopherVR/pptx-viewer/commit/0bd25680a428a47eecba38c4f50839c7a93eba80))

## [2.11.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.11.1) - 2026-07-31

### Bug Fixes

- **shared:** Stop a morph gliding one text box into an unrelated one (by @ChristopherVR) ([bc4789f](https://github.com/ChristopherVR/pptx-viewer/commit/bc4789fef0dbcaf8d524b19f99fac15847597ad0))
- **shared:** Stop a morph double-painting unchanged shapes, and dissolve text (by @ChristopherVR) ([d4b3952](https://github.com/ChristopherVR/pptx-viewer/commit/d4b3952757d719b2c7e1b4be307b14a15c56f73a))
- Stop showing users raw OOXML tokens, and make Vanilla's point index work (by @ChristopherVR) ([33d63ce](https://github.com/ChristopherVR/pptx-viewer/commit/33d63cec94a22ddf7cc0b57ddaa61ddb43eaedd3))
- Skip hidden slides in the show, and honour endWithBlackSlide (by @ChristopherVR) ([2a9ef49](https://github.com/ChristopherVR/pptx-viewer/commit/2a9ef49f97f976eb088a2fcc092b56a54b112fa3))

## [2.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.11.0) - 2026-07-31

### Features

- **shared:** Outline view, motion-path authoring, and chart marker resolution (by @ChristopherVR) ([e6a3621](https://github.com/ChristopherVR/pptx-viewer/commit/e6a362195b811231c76a24eb94de8e95795716f8))
- Outline view, motion-path authoring and the missing chart controls (by @ChristopherVR) ([278de2f](https://github.com/ChristopherVR/pptx-viewer/commit/278de2f5754f2b8bb19722460e047deb4cd72fbb))

### Bug Fixes

- **core:** Stop dropping a:pPr/@lvl when a paragraph's runs share one style (by @ChristopherVR) ([03aa4ed](https://github.com/ChristopherVR/pptx-viewer/commit/03aa4edeea15336b032227601cc57fb65d378b1c))

## [2.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.10.0) - 2026-07-31

### Features

- **shared:** Own the equation, media, reading-view and table-grid logic (by @ChristopherVR) ([c33af39](https://github.com/ChristopherVR/pptx-viewer/commit/c33af39d2157fdb8610c104a8a3e54fa8ae7c672))
- Wire reading view, the shared equation pipeline and a table data grid (by @ChristopherVR) ([b731b52](https://github.com/ChristopherVR/pptx-viewer/commit/b731b52f926737f0ccef95247f20db217cee1fb5))

### Bug Fixes

- **shared:** Resolve linked text-box chains inside groups (by @ChristopherVR) ([5e09586](https://github.com/ChristopherVR/pptx-viewer/commit/5e0958689a591f839ccfdf20bb3ae174af00030a))

## [2.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.9.0) - 2026-07-31

### Features

- **shared:** Give every referenced translation key a real entry (by @ChristopherVR) ([8ff4461](https://github.com/ChristopherVR/pptx-viewer/commit/8ff4461d0376408330ef5ce875b4aa7a13d0614f))
- **shared:** Own the logic five bindings had each hand-ported (by @ChristopherVR) ([60b9b0d](https://github.com/ChristopherVR/pptx-viewer/commit/60b9b0d06d60d674835ef23166ca9c46c1b191ba))
- **vue:** Close the ribbon, context-menu and field-context gaps (by @ChristopherVR) ([8273f08](https://github.com/ChristopherVR/pptx-viewer/commit/8273f089a2646f266ed3f176bc8ce7a20fa71b30))
- **core:** Model a gradient / pattern outline in structured form (by @ChristopherVR) ([69322c9](https://github.com/ChristopherVR/pptx-viewer/commit/69322c94ab40e37f19a1789c3149b5dd5d71498c))
- **shared:** Stroke a gradient outline as SVG instead of a flat border (by @ChristopherVR) ([fc72324](https://github.com/ChristopherVR/pptx-viewer/commit/fc723241643cdc18bb6ad0c113ca08763c9426ad))
- **vue:** Paint a gradient outline with a stroked SVG path (by @ChristopherVR) ([33d8b10](https://github.com/ChristopherVR/pptx-viewer/commit/33d8b1000664c94a82fbb590cba0226c53931b9b))
- **shared:** Stroke a patterned outline with a real pattern tile (by @ChristopherVR) ([9d8c3bd](https://github.com/ChristopherVR/pptx-viewer/commit/9d8c3bdfbd40e78d0fc66d9325efedb0bc9a3ea4))
- **vue:** Stroke a patterned outline, not its bare foreground (by @ChristopherVR) ([72e2a4c](https://github.com/ChristopherVR/pptx-viewer/commit/72e2a4cfcaab5e05b950582b12d811c47b57f83f))
- **shared:** Translate the File backstage and merge the stray key namespaces (by @ChristopherVR) ([e56aa6d](https://github.com/ChristopherVR/pptx-viewer/commit/e56aa6d3f00e4cbd23983036a195cba3c2d6bf6b))

### Bug Fixes

- **shared:** Honour authored preset adjustments and emit parseable gradient CSS (by @ChristopherVR) ([dbf5640](https://github.com/ChristopherVR/pptx-viewer/commit/dbf5640fb532082ca96d6a7dc8b439e07dd34a80))
- **vue:** Apply the gradient tile background-position (by @ChristopherVR) ([eafb597](https://github.com/ChristopherVR/pptx-viewer/commit/eafb597f7b69b638ef028dfeb707c43d39292ca7))
- **core:** Honour a preset path's own coordinate space, and repair hexagon (by @ChristopherVR) ([8e4a91d](https://github.com/ChristopherVR/pptx-viewer/commit/8e4a91d76a2bdd3ba3369ed541bc262d2a9c06f4))
- **core:** Rebuild flowChartTerminator from its spec Beziers (by @ChristopherVR) ([0e81403](https://github.com/ChristopherVR/pptx-viewer/commit/0e8140381fe6af3719a52dcc1b39f16609b5faf0))
- **core:** Keep an inline field in the position it was authored in (by @ChristopherVR) ([beb2067](https://github.com/ChristopherVR/pptx-viewer/commit/beb2067fc11ae709a26b4f9e6714fa557375ec85))
- **core:** Rebuild sun as a disc plus eight detached rays (by @ChristopherVR) ([cd2fcd4](https://github.com/ChristopherVR/pptx-viewer/commit/cd2fcd4baec66f040671aea332d1bcd2250a2e7f))
- **core:** Round-trip the Selection Pane hide toggle (by @ChristopherVR) ([14bdb23](https://github.com/ChristopherVR/pptx-viewer/commit/14bdb23d8c2840cc93d8a891c31ac9e8ffdf44cf))
- **shared:** Resolve a click on a group's child to the group (by @ChristopherVR) ([88ef671](https://github.com/ChristopherVR/pptx-viewer/commit/88ef671c4af065c0e21327ceec5840a2de4d4516))
- **shared:** Flow linked text-box overflow in every binding (by @ChristopherVR) ([abe1bb0](https://github.com/ChristopherVR/pptx-viewer/commit/abe1bb0702315c8a65582f1d64f62c6679298143))

### Testing

- **core:** Pin issue #132 fill and adjustment parsing against the reporter deck (by @ChristopherVR) ([06cd312](https://github.com/ChristopherVR/pptx-viewer/commit/06cd31287bcbd3895a834bed9f89af443526dca2))

## [2.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.8.0) - 2026-07-31

### Features

- **shared:** Decide which slide-show clicks are a PowerPoint advance (by @ChristopherVR) ([12ab5c8](https://github.com/ChristopherVR/pptx-viewer/commit/12ab5c82f08083e725eae332ee19b03b5021ce79))

### Bug Fixes

- **vue:** Advance the slide show on a slide's authored timing (by @ChristopherVR) ([781d0d1](https://github.com/ChristopherVR/pptx-viewer/commit/781d0d1bce1e6761f9429ee30fc1126a29c211f4))
- **vue:** Paint a video's poster frame and hide its transport in a show (by @ChristopherVR) ([59c2852](https://github.com/ChristopherVR/pptx-viewer/commit/59c285287d990cd9254d8ac4929706568bd02f49))

## [2.7.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.7.1) - 2026-07-31

### Bug Fixes

- **shared:** Match PowerPoint's morph dissolve windows and half-turn direction (by @ChristopherVR) ([661c250](https://github.com/ChristopherVR/pptx-viewer/commit/661c250ff429f0d8ea2f0bb5e2992a7d57af0353))
- **shared:** Stop morph pairing a shape with the group that wraps it (by @ChristopherVR) ([d240498](https://github.com/ChristopherVR/pptx-viewer/commit/d240498388734b5e81b238036856d891f86f2570))
- **core:** Stop an interactive sequence adding a phantom click step (by @ChristopherVR) ([65a4738](https://github.com/ChristopherVR/pptx-viewer/commit/65a4738a6eb8fd0b34999c52dd7e1244c5f0e6b5))
- **vue:** Make the slide show's transitions visible on a large display (by @ChristopherVR) ([8c6acd9](https://github.com/ChristopherVR/pptx-viewer/commit/8c6acd9bb9226b9522161bfe00fdb44f4c6bba20))
- **shared:** Resolve the timed slide auto-advance delay (by @ChristopherVR) ([beba8cc](https://github.com/ChristopherVR/pptx-viewer/commit/beba8ccb834f1eb04db305d68ac31d40beda4232))

### Refactor

- **shared:** Break the morph-matching <-> morph-flatten import cycle (by @ChristopherVR) ([92223c5](https://github.com/ChristopherVR/pptx-viewer/commit/92223c542d357d2831b4b3641180fec20c264dc1))

## [2.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.7.0) - 2026-07-31

### Features

- **shared:** Morph a !!-named shape across a grouping boundary (by @ChristopherVR) ([c74847d](https://github.com/ChristopherVR/pptx-viewer/commit/c74847dd53ef3344c4624c036a2f806ea62794c1))

### Bug Fixes

- **shared:** Morph rotates the short way round, like PowerPoint (by @ChristopherVR) ([255d0b5](https://github.com/ChristopherVR/pptx-viewer/commit/255d0b5541bdf12d66ab773090fee179072eb852))
- **shared:** Honour the legacy spd speed, including for morph (by @ChristopherVR) ([ab796b9](https://github.com/ChristopherVR/pptx-viewer/commit/ab796b94e27fa8addbad5f70578b4c9a591c1b11))
- **shared:** Keep a morphing object solid instead of dipping to the background (by @ChristopherVR) ([5f2b518](https://github.com/ChristopherVR/pptx-viewer/commit/5f2b518d39c16eeb207f70ea1df2583405022611))

## [2.6.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.6.6) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph id-pairing shapes whose creationId GUIDs differ (by @ChristopherVR) ([b9afc84](https://github.com/ChristopherVR/pptx-viewer/commit/b9afc844f0cab88ed44b25236f21b4628f1309a6))

### Testing

- **vue:** Expect PowerPoint's 1.2 default line-height (by @ChristopherVR) ([1023888](https://github.com/ChristopherVR/pptx-viewer/commit/10238888c51cfc7a9739df2cc56bae24c59249cb))

## [2.6.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.6.5) - 2026-07-30

### Bug Fixes

- **core:** Stamp the endParaRPr size on an empty paragraph's separator (by @ChristopherVR) ([2b18374](https://github.com/ChristopherVR/pptx-viewer/commit/2b1837473bdde04bc41f9593f444a096dd4196b8))
- **shared:** PowerPoint-exact line height, blank-line strut, marker indent reset (by @ChristopherVR) ([7f7181b](https://github.com/ChristopherVR/pptx-viewer/commit/7f7181b2d4ec36f990b157964c2aa648d291b20f))

## [2.6.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.6.4) - 2026-07-30

### Bug Fixes

- **shared:** Restate the static transform in every morph keyframe (by @ChristopherVR) ([075a645](https://github.com/ChristopherVR/pptx-viewer/commit/075a6454fe4a5a17e79e2b2adb213ea2e21ccfb0))

## [2.6.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.6.3) - 2026-07-30

### Bug Fixes

- **shared:** Stop morph pairing nearby shapes of very different sizes; 2s default (by @ChristopherVR) ([3d49c67](https://github.com/ChristopherVR/pptx-viewer/commit/3d49c672089ae26008f24f8cce7160ef22709507))

## [2.6.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.6.2) - 2026-07-30

### Bug Fixes

- **shared:** Crossfade a morph pair whose GROUP children changed (by @ChristopherVR) ([7492f26](https://github.com/ChristopherVR/pptx-viewer/commit/7492f26a236659f2c15a99c36a92023f7da6cbbc))

## [2.6.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.6.1) - 2026-07-29

### Bug Fixes

- **core:** Keep grouped text at its authored point size (by @ChristopherVR) ([56f676a](https://github.com/ChristopherVR/pptx-viewer/commit/56f676a850a510fa405361d58c849e4a7adb3bea))
- **shared:** Keep authored blank lines and give the bullet its hanging box (by @ChristopherVR) ([0a8de56](https://github.com/ChristopherVR/pptx-viewer/commit/0a8de560f117fdaeb06374e61e49a2cf4e1372b7))
- **shared:** Make morph animate a near-duplicate slide pair (by @ChristopherVR) ([e73ade7](https://github.com/ChristopherVR/pptx-viewer/commit/e73ade737892f3b46a79eb183370a86e3f8b59fe))
- **vue:** Render authored blank lines and drop the bullet spacer (by @ChristopherVR) ([1e4d270](https://github.com/ChristopherVR/pptx-viewer/commit/1e4d2700d8a46568a0e61d2e9a27c38c5c6ffb4b))

## [2.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.6.0) - 2026-07-27

### Features

- **shared:** Morph transition render plan and paragraph strut basis (by @ChristopherVR) ([94cfddd](https://github.com/ChristopherVR/pptx-viewer/commit/94cfddd2afc9ab20f294f6aa08ddf95fff7f5213))

### Bug Fixes

- **core:** Parse morph, fontRef text colour, and unsized bullets correctly (by @ChristopherVR) ([7607996](https://github.com/ChristopherVR/pptx-viewer/commit/7607996123e493ed1f33a6891e444f3b02bb2ed9))
- **vue:** Play morph transitions and re-base paragraph line boxes (by @ChristopherVR) ([99df808](https://github.com/ChristopherVR/pptx-viewer/commit/99df808add09864870fa97db76ce224fa8a8831f))

## [2.5.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.5.3) - 2026-07-27

### Dependencies

- **deps:** Update emf-converter requirement from ^2.0.0 to ^2.0.2 ([#122](https://github.com/ChristopherVR/pptx-viewer/issues/122)) (by @dependabot[bot]) ([423034a](https://github.com/ChristopherVR/pptx-viewer/commit/423034ad1e6d48dbb75be17e1915c917c912517b))
- **deps:** Update html2canvas-pro requirement from ^2.3.1 to ^2.3.2 ([#124](https://github.com/ChristopherVR/pptx-viewer/issues/124)) (by @dependabot[bot]) ([6ad6bce](https://github.com/ChristopherVR/pptx-viewer/commit/6ad6bceecf88670f33e2544dbeb1a98c8b1bf9f6))

## [2.5.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.5.2) - 2026-07-27

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## [2.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.5.1) - 2026-07-26

### Testing

- **e2e:** Cover remote presence geometry in every binding (by @ChristopherVR) ([adb9b3c](https://github.com/ChristopherVR/pptx-viewer/commit/adb9b3c180d3f7fce1bd175dfc0b29d385937a51))

## [2.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.5.0) - 2026-07-26

### Features

- **shared:** Lock the audience display out of edit mode (by @ChristopherVR) ([79dc876](https://github.com/ChristopherVR/pptx-viewer/commit/79dc8768ff599e662c4291861b340c2939001f84))
- **shared:** Seed a slide as fully built, and keep audience input inert (by @ChristopherVR) ([6acdf5e](https://github.com/ChristopherVR/pptx-viewer/commit/6acdf5e02c6d727828433ba067942e72d6547922))

### Bug Fixes

- **core:** Keep the click step's own start conditions (by @ChristopherVR) ([755a4b2](https://github.com/ChristopherVR/pptx-viewer/commit/755a4b2e38dff73c9c460a5318c1fce913880328))
- **shared:** Play a slide's opening build without a click (by @ChristopherVR) ([9d0ecec](https://github.com/ChristopherVR/pptx-viewer/commit/9d0ecec007d1f7ef48ecbd97429b55073352a487))
- **vue:** Never show the editor in an audience display (by @ChristopherVR) ([dc1e2ee](https://github.com/ChristopherVR/pptx-viewer/commit/dc1e2ee6a1505c8505d28d196488fe140951c4ff))
- **core:** Paint useBgFill shapes with the slide background (by @ChristopherVR) ([f819817](https://github.com/ChristopherVR/pptx-viewer/commit/f81981744c637368d1ef0d87b1ba884e634c938a))
- **shared:** Ripple a by-paragraph build that also iterates (by @ChristopherVR) ([73238d5](https://github.com/ChristopherVR/pptx-viewer/commit/73238d590217f8c61e86c9f065d19436dd6b699b))
- **vue:** Hold back on a back step, ignore audience input (by @ChristopherVR) ([45c82cf](https://github.com/ChristopherVR/pptx-viewer/commit/45c82cf28df3413dd90d5bc3533bbd8ada95af6d))

## [2.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.4.0) - 2026-07-25

### Dependencies

- **deps:** Update ai requirement from ^7.0.35 to ^7.0.37 ([#115](https://github.com/ChristopherVR/pptx-viewer/issues/115)) (by @dependabot[bot]) ([71d200d](https://github.com/ChristopherVR/pptx-viewer/commit/71d200d5aa0627c90fb2c8bfc0c50ee4b132a7d8))

### Chores

- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))
- **deps-dev:** Update happy-dom requirement from ^20.11.0 to ^20.11.1 ([#116](https://github.com/ChristopherVR/pptx-viewer/issues/116)) (by @dependabot[bot]) ([0a2f499](https://github.com/ChristopherVR/pptx-viewer/commit/0a2f4990ae3caa60de537c9e0ea38ca8d796fd56))

## [2.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.3.0) - 2026-07-25

### Features

- **shared:** Rule for advancing a show from the presenter slide pane (by @ChristopherVR) ([ee2d0f5](https://github.com/ChristopherVR/pptx-viewer/commit/ee2d0f584dd042eeee89c57ec3c33335208bde28))

### Bug Fixes

- **core:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([eebf128](https://github.com/ChristopherVR/pptx-viewer/commit/eebf128df224247eb06ea1731c9418fcc36189f9))
- **shared:** Rotate OOXML gradient angles into CSS space (by @ChristopherVR) ([406d78b](https://github.com/ChristopherVR/pptx-viewer/commit/406d78b2471ec171fe5cbd8b2ef6abb3216c3c3b))
- **shared:** Parse playFrom media commands in linear time (by @ChristopherVR) ([60820b1](https://github.com/ChristopherVR/pptx-viewer/commit/60820b10ebf641ec2adf6c6d1089fe9f2bc4e490))
- **core:** Honour a:noFill and stop painting hidden fills/lines (by @ChristopherVR) ([ae13541](https://github.com/ChristopherVR/pptx-viewer/commit/ae1354188b1c5d2bd5843dc36a7c438ba1d83c00))

## [2.2.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.2.2) - 2026-07-24

### Bug Fixes

- **core:** Preserve native bullets and boundary spaces ([#107](https://github.com/ChristopherVR/pptx-viewer/issues/107)) ([7ed0971](https://github.com/ChristopherVR/pptx-viewer/commit/7ed09718d2fc439b129ee5ed23c8f5c41fe399ba))

## [2.2.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.2.1) - 2026-07-24

### Bug Fixes

- **vue:** Rebuild the mobile bottom bar as React's five-tab nav (by @ChristopherVR) ([5c704ed](https://github.com/ChristopherVR/pptx-viewer/commit/5c704ed201bd58d9855da74c0cc6d3c1c0dc65f3))

## [2.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.2.0) - 2026-07-24

### Features

- **shared:** Powerpoint-accurate slide-show keyboard map (by @ChristopherVR) ([fdf55d4](https://github.com/ChristopherVR/pptx-viewer/commit/fdf55d45779e090c36aa994cdc17fae8f01df79b))
- **vue:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([4ff2da9](https://github.com/ChristopherVR/pptx-viewer/commit/4ff2da98c0e58cb4edbc2ef60cacc2ffc71ede20))
- **vanilla:** Follow PowerPoint's slide-show shortcuts (by @ChristopherVR) ([629903c](https://github.com/ChristopherVR/pptx-viewer/commit/629903c8c1ecab33e5dde40ffef42a88e8bde94e))
- **react:** Give the slide-show menu PowerPoint's full command set (by @ChristopherVR) ([33c826d](https://github.com/ChristopherVR/pptx-viewer/commit/33c826d887c69e5103b0f0148e9ee1b1c17b16b0))
- **locales:** Translate the new slide-show menu commands (by @ChristopherVR) ([21952d7](https://github.com/ChristopherVR/pptx-viewer/commit/21952d7b7e948724bebe91fd46466861b78dffbd))

## [2.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.1.0) - 2026-07-23

### Features

- **shared:** Live-patch channel for interim collaboration state (by @ChristopherVR) ([efdcc1e](https://github.com/ChristopherVR/pptx-viewer/commit/efdcc1e13ef824f6b26f3c92ba199e0da732b164))
- **shared:** Make a departing collaborator actually leave the room (by @ChristopherVR) ([6af3d8c](https://github.com/ChristopherVR/pptx-viewer/commit/6af3d8ce9933946a5420f1a21c8de55cf7da3548))

### Bug Fixes

- **vue:** Render the mobile bottom bar with lucide icons (by @ChristopherVR) ([341cdb4](https://github.com/ChristopherVR/pptx-viewer/commit/341cdb4df8ea56655c738b187c4d716bd91da533))
- **vue:** Draw toolbar and backstage icons with lucide (by @ChristopherVR) ([0ca967a](https://github.com/ChristopherVR/pptx-viewer/commit/0ca967a6209b22574f4b1d6643d8a3f1570ed738))
- **vue:** Draw presentation-mode icons with lucide (by @ChristopherVR) ([a6cf141](https://github.com/ChristopherVR/pptx-viewer/commit/a6cf141dee00055271d8c50eb06abaf215b1a26a))
- **vue:** Draw panel and inspector icons with lucide (by @ChristopherVR) ([860a057](https://github.com/ChristopherVR/pptx-viewer/commit/860a057f7f1ec9c5880d01647d895238eb8736b2))
- **vue:** Publish inline-editor typing to peers before commit (by @ChristopherVR) ([4aafe84](https://github.com/ChristopherVR/pptx-viewer/commit/4aafe84f1b3c6ecd24c83922258bb0a7a900f525))
- **vue:** Leave the collab room when the document is destroyed (by @ChristopherVR) ([aa12464](https://github.com/ChristopherVR/pptx-viewer/commit/aa12464f629f73073370376e25d460c3846b408f))

### Other

- Vue icon-parity sweep (glyphs to lucide-vue-next) (by @ChristopherVR) ([577b1c5](https://github.com/ChristopherVR/pptx-viewer/commit/577b1c51f0baa4b6573ec7ca22ff5ce3c17eb851))
- Live collaboration preview for drag/resize geometry and inline typing (by @ChristopherVR) ([26a7069](https://github.com/ChristopherVR/pptx-viewer/commit/26a706931be405a8605138a756f7e3c84622f0ca))
- Peers leave the room synchronously on frame teardown (no ghost collaborators) (by @ChristopherVR) ([ae9acad](https://github.com/ChristopherVR/pptx-viewer/commit/ae9acad9cfe65ee8dfa6a9676152b6c1abab5b0f))

### Refactor

- **shared:** Split the live-patch module and escape its NUL key separator (by @ChristopherVR) ([6362b22](https://github.com/ChristopherVR/pptx-viewer/commit/6362b22135da6b7503113799f2631f8085ea49c5))

## [2.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.0.1) - 2026-07-23

### Bug Fixes

- **vue:** Stop double-applying zoom to remote cursor/selection overlays (by @ChristopherVR) ([1ca4e67](https://github.com/ChristopherVR/pptx-viewer/commit/1ca4e6773766b2506b7614b2b853689ece0d2b62))

## [2.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@2.0.0) - 2026-07-23

### Features

- **vue:** Rename unstable subpath to internals and unify collab API (by @ChristopherVR) ([8bcf4e7](https://github.com/ChristopherVR/pptx-viewer/commit/8bcf4e7dbea249b98a746f857830f1243a8bcdb6))
- **shared:** Ai config, loader and bridge contracts (by @ChristopherVR) ([1c40e28](https://github.com/ChristopherVR/pptx-viewer/commit/1c40e28b1661895e2993b01c11bea6262459cb88))
- **vue:** Ai bridge and chat session composables (by @ChristopherVR) ([7143ee7](https://github.com/ChristopherVR/pptx-viewer/commit/7143ee767e90acb15813802aecb29afb413bf096))
- **shared:** Indexeddb-first ai chat history store (by @ChristopherVR) ([88920f2](https://github.com/ChristopherVR/pptx-viewer/commit/88920f20eb00e72b84efa9ef2cb500dfd6d20db4))
- **shared:** Rebuild AI assistant tools on pptx-viewer-mcp (by @ChristopherVR) ([da1c31e](https://github.com/ChristopherVR/pptx-viewer/commit/da1c31ee88c0b60a82628003c8a1b16245f028ed))
- **core:** Upgrade emf-converter to 2.0.0 (breaking) (by @ChristopherVR) ([effa4e5](https://github.com/ChristopherVR/pptx-viewer/commit/effa4e5338b2b01796a3671f505bcb4563de74cc))

### Bug Fixes

- **build:** Restore pptx-viewer-shared/ai vitest alias after main merge (by @ChristopherVR) ([f878be8](https://github.com/ChristopherVR/pptx-viewer/commit/f878be8dc5b4735081690b691ca30bf3b0264559))

### Documentation

- Friendly 2.0.0 changelog for root and packages (by @ChristopherVR) ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))

### Testing

- **shared:** Opt-in live gpt-4o-mini ai integration test (by @ChristopherVR) ([48622f1](https://github.com/ChristopherVR/pptx-viewer/commit/48622f135a5f2ee4c28d97d08478d3c203745f47))

### Build & CI

- **shared:** Keep the ai SDK external across bindings (by @ChristopherVR) ([fa5e6b7](https://github.com/ChristopherVR/pptx-viewer/commit/fa5e6b77e6586764d9e7717439f574291810e93b))
- Pin Vue/Angular/Svelte to exact TypeScript 6.0.3 (by @ChristopherVR) ([3d80082](https://github.com/ChristopherVR/pptx-viewer/commit/3d8008282231e1ee4bc11300757d1cc35e8dc174))

## [1.24.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.24.5) - 2026-07-19

### Bug Fixes

- **shared:** Enforce transition advanceOnClick in Vue/Angular/Svelte/Vanilla ([#82](https://github.com/ChristopherVR/pptx-viewer/issues/82)) (by @ChristopherVR) ([66d489b](https://github.com/ChristopherVR/pptx-viewer/commit/66d489b41d899e09d856d004d49d1eb17258d457))

## [1.24.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.24.4) - 2026-07-19

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

## [1.24.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.24.3) - 2026-07-19

### Bug Fixes

- **core:** Themed background text, colour and geometry fidelity (by @ChristopherVR) ([a8fc2be](https://github.com/ChristopherVR/pptx-viewer/commit/a8fc2bea2407f70bc3df4008be5c152d107cc3eb))
- **shared:** Render freeform fills via clip-path and correct flip/rotate order (by @ChristopherVR) ([7122f43](https://github.com/ChristopherVR/pptx-viewer/commit/7122f43c7ff9bae5bf0278d2753a6209bc1821af))

## [1.24.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.24.2) - 2026-07-19

### Bug Fixes

- **core:** Stop truncating interleaved custom-geometry paths ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([9bbac7d](https://github.com/ChristopherVR/pptx-viewer/commit/9bbac7d024fbad8ccd476f7e2a5d993ce1ad2b1b))

### Performance

- **core:** Cache layout/master XML during background resolution (by @ChristopherVR) ([9eea305](https://github.com/ChristopherVR/pptx-viewer/commit/9eea3057d62825f2c6355cf9891123a77df0c8fb))

## [1.24.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.24.1) - 2026-07-18

### Bug Fixes

- **core:** Load themed backgrounds and inherited placeholders ([#66](https://github.com/ChristopherVR/pptx-viewer/issues/66)) (by @ChristopherVR) ([bed627b](https://github.com/ChristopherVR/pptx-viewer/commit/bed627bc4e2abb5c897e7e9b49fb27735f5e01a1))

## [1.24.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.24.0) - 2026-07-18

### Features

- **shared:** PowerPoint File > Options parity model (by @ChristopherVR) ([b1f041d](https://github.com/ChristopherVR/pptx-viewer/commit/b1f041d2396520e3d04c30172a4842f725c7c655))
- **vue:** PowerPoint-style File > Options dialog (by @ChristopherVR) ([3fe2b3f](https://github.com/ChristopherVR/pptx-viewer/commit/3fe2b3f512998449e97d35e80a8687451232a0b5))

## [1.23.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.23.2) - 2026-07-18

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.23.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.23.1) - 2026-07-18

### Bug Fixes

- **core:** Preserve OMML sibling order through parse, save, and markdown (by @ChristopherVR) ([54e5de5](https://github.com/ChristopherVR/pptx-viewer/commit/54e5de5b4c0bc1509e80bf632a8d3c2a5c24be38))
- **core:** Resolve ReDoS and prototype pollution in OMML sibling-order scan (by @ChristopherVR) ([2eef210](https://github.com/ChristopherVR/pptx-viewer/commit/2eef210de3c5a366be8721e420aaac6a5643b0af))

### Refactor

- **shared:** Emit core's ordered-key convention for interleaved OMML (by @ChristopherVR) ([81db024](https://github.com/ChristopherVR/pptx-viewer/commit/81db024967197fbc1ee65b27a00419613637f5f2))

## [1.23.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.23.0) - 2026-07-18

### Features

- **vue:** Export RibbonToolbar for independent composition (by @ChristopherVR) ([00a57ca](https://github.com/ChristopherVR/pptx-viewer/commit/00a57ca4f96339edc1b79d544f71330558f2ceff))

### Dependencies

- **deps:** Update dependencies to latest and migrate core/shared/locales to TypeScript 7 (by @ChristopherVR) ([cc72948](https://github.com/ChristopherVR/pptx-viewer/commit/cc729482cc5ae4ae56e1219f290c2953ec83c12a))

## [1.22.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.22.1) - 2026-07-18

### Bug Fixes

- **vue:** Single slide region and marker-free static stages (by @ChristopherVR) ([fa3b635](https://github.com/ChristopherVR/pptx-viewer/commit/fa3b635c2027eed8810164889243af39aa3625df))

## [1.22.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.22.0) - 2026-07-18

### Features

- **vue:** Tabbed default inspector at React parity (by @ChristopherVR) ([c057f5c](https://github.com/ChristopherVR/pptx-viewer/commit/c057f5c24e4fae931d9f5b50a97e1fd917090490))
- **vue:** Port React TagsSection with tag persistence on save (by @ChristopherVR) ([cd110c4](https://github.com/ChristopherVR/pptx-viewer/commit/cd110c478c662fd722cf706c394b0bcc0897eaf4))

### Bug Fixes

- **vue:** Show "All saved" for settled autosave state like React (by @ChristopherVR) ([b154e59](https://github.com/ChristopherVR/pptx-viewer/commit/b154e59ea8153ea2d6fafd0fe34fd47b750fb772))
- **vue:** Stop the 24px tap-target floor from ballooning small controls (by @ChristopherVR) ([f8a0ed8](https://github.com/ChristopherVR/pptx-viewer/commit/f8a0ed8ed796f1cd1e92bd143e951bb609137fbd))

## [1.21.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.21.0) - 2026-07-17

### Features

- **vue:** Add theme/language switching and a real Account page (by @ChristopherVR) ([234dd01](https://github.com/ChristopherVR/pptx-viewer/commit/234dd01e997c88eeeb20a9187dff8268a2f56693))

### Other

- Integrate release version bumps (by @ChristopherVR) ([4b3893f](https://github.com/ChristopherVR/pptx-viewer/commit/4b3893f4158803cc5533beb266ffdc8c776177cb))
- Integrate Vue theme/language switching and Account page (by @ChristopherVR) ([0f8915a](https://github.com/ChristopherVR/pptx-viewer/commit/0f8915af7c7a70b610128c7c931c0750504010bc))

## [1.20.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.20.0) - 2026-07-17

### Features

- **vue:** Add hiddenActions prop to hide individual toolbar/ribbon actions (by @ChristopherVR) ([2e917df](https://github.com/ChristopherVR/pptx-viewer/commit/2e917df9f2703fe5e56de0015b20744697092ff7))

## [1.19.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.19.1) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.19.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.19.0) - 2026-07-17

### Features

- **core:** Preserve DrawingML image color effects (by @ChristopherVR) ([5ed726d](https://github.com/ChristopherVR/pptx-viewer/commit/5ed726d401a5a4e399854b77af63032287204ad1))
- **core:** Model PresentationML view geometry (by @ChristopherVR) ([3b07978](https://github.com/ChristopherVR/pptx-viewer/commit/3b07978204770e51d0470e624dbb0073844587e7))
- **core:** Round-trip ChartML markers and data points (by @ChristopherVR) ([ae8edc5](https://github.com/ChristopherVR/pptx-viewer/commit/ae8edc5514fb6ce1974bd912aa6d59a2844c4f22))
- **shared:** Build package sharing readmes (by @ChristopherVR) ([01a9bd6](https://github.com/ChristopherVR/pptx-viewer/commit/01a9bd67d7ad7dbf406011a98308368425ff901b))
- **vue:** Expose collaboration building blocks (by @ChristopherVR) ([4679574](https://github.com/ChristopherVR/pptx-viewer/commit/46795744d9f9d704a0c5772b48f89963848c0e4d))
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
- **shared:** Compute live document statistics (by @ChristopherVR) ([13159a2](https://github.com/ChristopherVR/pptx-viewer/commit/13159a29a72bed8105dee689af07b41cd70d3e3c))
- **core:** Export rich elements as SVG (by @ChristopherVR) ([508fc6c](https://github.com/ChristopherVR/pptx-viewer/commit/508fc6cbd074dec5d7a0655b0c700ea6a95cd058))
- **core:** Persist chart palette and axis positions (by @ChristopherVR) ([69b05bd](https://github.com/ChristopherVR/pptx-viewer/commit/69b05bdc3cf86c883d16c4f1b9ddef1563ad99e7))
- **shared:** Resolve image source effects (by @ChristopherVR) ([7400764](https://github.com/ChristopherVR/pptx-viewer/commit/74007645ae432d7e2b3cd8394fd04f6dde9cce61))
- **vue:** Add vector SVG export and printing (by @ChristopherVR) ([e75d4ec](https://github.com/ChristopherVR/pptx-viewer/commit/e75d4ec366a149c06b9a7b1ca090d4efe859dae1))
- **vue:** Apply live viewer settings (by @ChristopherVR) ([d7c2bb6](https://github.com/ChristopherVR/pptx-viewer/commit/d7c2bb6c9c28e18941ec1dbb6de43c0c04d90a66))
- **core:** Render funnel charts in SVG exports (by @ChristopherVR) ([efb6c36](https://github.com/ChristopherVR/pptx-viewer/commit/efb6c368fc6640a918cc6bbdc016b98c87e241ff))
- **core:** Author SDK funnel ChartEx parts (by @ChristopherVR) ([73265f4](https://github.com/ChristopherVR/pptx-viewer/commit/73265f4737f2f74705be380a2772586fd46557c0))
- **core:** Author SDK waterfall ChartEx parts (by @ChristopherVR) ([e5ff15b](https://github.com/ChristopherVR/pptx-viewer/commit/e5ff15b7aeab2c9b059963ae36aafd1b457ffe67))
- **shared:** Render chart axis tick formatting (by @ChristopherVR) ([5c22a9b](https://github.com/ChristopherVR/pptx-viewer/commit/5c22a9b4c96f3cb3d24c750dd4dab115ef42fb2b))
- **core:** Author SDK treemap ChartEx parts (by @ChristopherVR) ([9264fad](https://github.com/ChristopherVR/pptx-viewer/commit/9264fad20c51725136722369aef7393f334d1832))
- **core:** Round-trip sunburst hierarchy (by @ChristopherVR) ([3cc868e](https://github.com/ChristopherVR/pptx-viewer/commit/3cc868ea721d78f8ac48365e6a9cb4cb1abfe57c))
- **vue:** Add action settings inspector (by @ChristopherVR) ([7a35918](https://github.com/ChristopherVR/pptx-viewer/commit/7a35918e8cdf6208b11135db6d12d323ae3be5b2))
- **bindings:** Wire deep inspector panels (by @ChristopherVR) ([1ce5e9b](https://github.com/ChristopherVR/pptx-viewer/commit/1ce5e9b5f6e58d437190609aed7775495d725c38))
- **core:** Round-trip PowerPoint slide Zoom (by @ChristopherVR) ([624c853](https://github.com/ChristopherVR/pptx-viewer/commit/624c853b6450f6c0f8b16d8789104ba6f2cc76e2))
- **core:** Author SDK box-whisker ChartEx parts (by @ChristopherVR) ([202496f](https://github.com/ChristopherVR/pptx-viewer/commit/202496f894d094535f8ca6fa9cad303c00f13a7c))
- **shared:** Render ChartEx sunburst hierarchy (by @ChristopherVR) ([0507e6f](https://github.com/ChristopherVR/pptx-viewer/commit/0507e6f98084ed566287fdc4e7e0ec5ded0629a6))
- **core:** Author histogram and Pareto ChartEx parts (by @ChristopherVR) ([b8d779c](https://github.com/ChristopherVR/pptx-viewer/commit/b8d779cd0923ceeeb39c0848cec25cd52223d5e3))
- **core:** Round-trip PowerPoint section Zoom (by @ChristopherVR) ([67a162f](https://github.com/ChristopherVR/pptx-viewer/commit/67a162f63f1b244a9fbf23621c9e7194b1538031))
- **vue:** Expose header and footer editor (by @ChristopherVR) ([bc80f9d](https://github.com/ChristopherVR/pptx-viewer/commit/bc80f9dc66845f8fb90dfa89db959bdfeaf975bc))
- **shared:** Add media trim timeline helpers (by @ChristopherVR) ([c8cc257](https://github.com/ChristopherVR/pptx-viewer/commit/c8cc2570f2466e026221596e3e8f09126864d35a))
- **shared:** Render ChartEx distribution options (by @ChristopherVR) ([f0d2c22](https://github.com/ChristopherVR/pptx-viewer/commit/f0d2c222cc3193ecdff51d934117ccb1be50bde4))
- **core:** Author SDK region-map ChartEx parts (by @ChristopherVR) ([9d0c676](https://github.com/ChristopherVR/pptx-viewer/commit/9d0c676231f91e967e89eb82fbae472b23172113))
- **shared:** Render Summary Zoom section tiles (by @ChristopherVR) ([5266e10](https://github.com/ChristopherVR/pptx-viewer/commit/5266e10e28d611c99701c3e734ff9f22746aba42))
- **core:** Round-trip PowerPoint Summary Zoom (by @ChristopherVR) ([27c5671](https://github.com/ChristopherVR/pptx-viewer/commit/27c5671d6593d439f624cfbe2c9b37373fd6ec16))
- **shared:** Honor category axis ordering and ticks (by @ChristopherVR) ([45f7c1f](https://github.com/ChristopherVR/pptx-viewer/commit/45f7c1f13f2f92e07e3085fc060314b64060dd64))
- **core:** Author embedded 3D models (by @ChristopherVR) ([7189466](https://github.com/ChristopherVR/pptx-viewer/commit/7189466b8c86692c651a8eebc382d42ad8df56f1))
- **vue:** Preview relationship backed media (by @ChristopherVR) ([e37a7f9](https://github.com/ChristopherVR/pptx-viewer/commit/e37a7f9e4681a5d3318cdf05ef1046236fb034ec))
- **core:** Preserve ChartEx waterfall layout semantics (by @ChristopherVR) ([10feb1b](https://github.com/ChristopherVR/pptx-viewer/commit/10feb1bb15a5288d6607508a45ba030888d36adc))
- **vue:** Wire media inspector sources (by @ChristopherVR) ([fb67f2f](https://github.com/ChristopherVR/pptx-viewer/commit/fb67f2fc81995fdcae6c26fed8ee2f236e0ebff5))
- **core:** Author InkML content parts (by @ChristopherVR) ([b8df789](https://github.com/ChristopherVR/pptx-viewer/commit/b8df789682e6ca28e15e3a8732d550c016239b2a))
- **shared:** Render semantic Pareto charts (by @ChristopherVR) ([6fc6a5e](https://github.com/ChristopherVR/pptx-viewer/commit/6fc6a5e4b0b86601a198661e5e276573370d3414))
- **core:** Author user-defined tag parts (by @ChristopherVR) ([245dc7c](https://github.com/ChristopherVR/pptx-viewer/commit/245dc7cb9db4e69cb4b37c4d4e989ed6f0d8e2c8))
- **core:** Preserve classic date axis semantics (by @ChristopherVR) ([f9391cd](https://github.com/ChristopherVR/pptx-viewer/commit/f9391cde53a10058601d9a4a8205ea636f6a43c9))
- **core:** Author customer data parts (by @ChristopherVR) ([8d99be8](https://github.com/ChristopherVR/pptx-viewer/commit/8d99be831377d08cde510603ae8c9b00c0985169))
- **vue:** Complete animation authoring parity (by @ChristopherVR) ([644aa2b](https://github.com/ChristopherVR/pptx-viewer/commit/644aa2b9a49109aabdfaa8cab71e8e2b046230e4))
- **vue:** Persist animation timeline edits (by @ChristopherVR) ([f336634](https://github.com/ChristopherVR/pptx-viewer/commit/f336634ac3b0c674e501c1035a249c238a0055c9))
- **shared:** Render continuous date axes (by @ChristopherVR) ([d644399](https://github.com/ChristopherVR/pptx-viewer/commit/d6443991467a45ea92f1b3947a9a0253faa471c6))
- **shared:** Render slide background patterns (by @ChristopherVR) ([2794b71](https://github.com/ChristopherVR/pptx-viewer/commit/2794b71c0f90f38af6417790e57deaaf2d4fc010))
- **shared:** Resolve picture bullet markers (by @ChristopherVR) ([172a5c0](https://github.com/ChristopherVR/pptx-viewer/commit/172a5c0b25b33d99593fffd3ff4ef3c0dee3a371))
- **core:** Preserve chart axis crossing semantics (by @ChristopherVR) ([3fbcbc0](https://github.com/ChristopherVR/pptx-viewer/commit/3fbcbc01812272d2984f22986af81135d0d08fd6))
- **vue:** Add functional record commands (by @ChristopherVR) ([ab79910](https://github.com/ChristopherVR/pptx-viewer/commit/ab79910deaa31eaad751e943befd28eee6462d39))
- **vue:** Wire review and record commands (by @ChristopherVR) ([ee37e65](https://github.com/ChristopherVR/pptx-viewer/commit/ee37e657aa3b1d131c89da9aa5f6f10d349b0c73))
- **vue:** Render picture bullet markers (by @ChristopherVR) ([ea73fe6](https://github.com/ChristopherVR/pptx-viewer/commit/ea73fe6d415230b98b2ee7b82173c7f0d513fe79))
- **shared:** Render X-direction chart error bars (by @ChristopherVR) ([c3f825b](https://github.com/ChristopherVR/pptx-viewer/commit/c3f825bfb5e08b7ac81cd16d7e580312edfbc154))
- **shared:** Render chart axis crossings (by @ChristopherVR) ([38a2591](https://github.com/ChristopherVR/pptx-viewer/commit/38a259176035e4a7b5de60980233798759e7f202))
- **core:** Preserve ChartEx hierarchy and geography (by @ChristopherVR) ([4b8e3ab](https://github.com/ChristopherVR/pptx-viewer/commit/4b8e3abde0f4747cdbd7347ff48cb2156b9a3110))
- **shared:** Render hierarchical ChartEx treemaps (by @ChristopherVR) ([999f8f9](https://github.com/ChristopherVR/pptx-viewer/commit/999f8f938125e99dab09a17b8c940a7c9cfe225b))
- **shared:** Render ChartEx geography options (by @ChristopherVR) ([c2edbd7](https://github.com/ChristopherVR/pptx-viewer/commit/c2edbd7ac5d843e5d8a5190284ce32e792d541dd))
- **shared:** Render multi-level chart axes (by @ChristopherVR) ([d5d7008](https://github.com/ChristopherVR/pptx-viewer/commit/d5d7008f64c555046030a556e4306e06673108d6))
- **vue:** Complete File backstage parity (by @ChristopherVR) ([57d3341](https://github.com/ChristopherVR/pptx-viewer/commit/57d3341a8310e229b533403f581e94334a66fd3d))

### Bug Fixes

- **vue:** Package presentations for sharing (by @ChristopherVR) ([d382fe5](https://github.com/ChristopherVR/pptx-viewer/commit/d382fe5097478e2dfd51e1512c8ad48969e94fb0))
- **core:** Validate DiagramML iterator bounds (by @ChristopherVR) ([cb375ce](https://github.com/ChristopherVR/pptx-viewer/commit/cb375ce5ac221e854d3a6c203788a6795a5d1881))
- **core:** Correct DrawingML custom dash stops (by @ChristopherVR) ([9b7bd11](https://github.com/ChristopherVR/pptx-viewer/commit/9b7bd11da4438ce24c7e76fb421d07fb0b720d74))
- **shared:** Render complete image colour effects (by @ChristopherVR) ([2dc9969](https://github.com/ChristopherVR/pptx-viewer/commit/2dc9969660bb0c999f9d33bc09899f63105c1d24))
- **core:** Export complete image colour effects (by @ChristopherVR) ([e1468d3](https://github.com/ChristopherVR/pptx-viewer/commit/e1468d316711b56fc883efddb0c14a957b6630ae))
- **viewer:** Restore thumbnail colours and suppress bullets (by @ChristopherVR) ([4563d2d](https://github.com/ChristopherVR/pptx-viewer/commit/4563d2d0a60ec70febbb5b26b438b9f2de6782b8))
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
- **core:** Reconcile SmartArt legacy text edits (by @ChristopherVR) ([13253b5](https://github.com/ChristopherVR/pptx-viewer/commit/13253b5a5b2f46c105d72f8952355195bd12c07a))
- **core:** Project SmartArt rich text to shapes (by @ChristopherVR) ([5b106a6](https://github.com/ChristopherVR/pptx-viewer/commit/5b106a671c42ed3ae1f4b1068b571d9e95110b3c))
- **shared:** Keep chart helpers target portable (by @ChristopherVR) ([db9d675](https://github.com/ChristopherVR/pptx-viewer/commit/db9d67551dcdf7105658048f812ec11668429221))
- **core:** Resolve SmartArt run text styles (by @ChristopherVR) ([6737afd](https://github.com/ChristopherVR/pptx-viewer/commit/6737afd47a0e3e7a9800da422b0730f4273271d7))
- **vue:** Connect media sources to inspectors (by @ChristopherVR) ([51c3e83](https://github.com/ChristopherVR/pptx-viewer/commit/51c3e832b222d1cecd0cd0dfad973e56588a38f9))
- **core:** Evaluate SmartArt layout rules (by @ChristopherVR) ([4a918fd](https://github.com/ChristopherVR/pptx-viewer/commit/4a918fd1664143d4def19211b5b8df10a5f68470))
- **core:** Guard SmartArt text order annotation (by @ChristopherVR) ([44d7013](https://github.com/ChristopherVR/pptx-viewer/commit/44d70131f2ed1f2fb9d4d62217a483ce2059021b))
- **core:** Preserve chart series option shape (by @ChristopherVR) ([87c0df4](https://github.com/ChristopherVR/pptx-viewer/commit/87c0df4ad34efae05e7479f1a2ace834d355481c))
- **shared:** Sync InkML collaboration fields (by @ChristopherVR) ([f2929cb](https://github.com/ChristopherVR/pptx-viewer/commit/f2929cbf44f53fc60fff32b1d958a2346bcee6f2))
- **vue:** Expose zoom to fit across view menus (by @ChristopherVR) ([6c3fcd2](https://github.com/ChristopherVR/pptx-viewer/commit/6c3fcd2bc2da006e4eea9398f6ef10f4829be260))
- **vue:** Keep zoom binding inside view sections (by @ChristopherVR) ([08960ff](https://github.com/ChristopherVR/pptx-viewer/commit/08960ffb8e2420201d467bc37022961b0e19e486))
- Typecheck issues and lint (by @ChristopherVR) ([406b264](https://github.com/ChristopherVR/pptx-viewer/commit/406b264c8d21b413f346f7a6ce885960df56a265))

### Performance

- **vue:** Virtualize large slide decks (by @ChristopherVR) ([946debe](https://github.com/ChristopherVR/pptx-viewer/commit/946debec6d46ab2e536e28f48b91a4d6a5603c8e))

### Refactor

- **core:** Name OpenXML coverage by capability (by @ChristopherVR) ([1e25a7f](https://github.com/ChristopherVR/pptx-viewer/commit/1e25a7fbb929092af4ce080a4ed19eab28e87472))
- **core:** Keep chart protection codec internal (by @ChristopherVR) ([da3fcc1](https://github.com/ChristopherVR/pptx-viewer/commit/da3fcc1d82c0a0b0f36e9d4d581aea0509915be2))
- **shared:** Generalize section grouping (by @ChristopherVR) ([ffc7fec](https://github.com/ChristopherVR/pptx-viewer/commit/ffc7fecb7c2c9fdee6f571abc41d9660abda1353))
- **vue:** Share section grouping (by @ChristopherVR) ([43be0f0](https://github.com/ChristopherVR/pptx-viewer/commit/43be0f01b85406551bb7051dc60b9d0541c7561d))
- **vue:** Share document statistics (by @ChristopherVR) ([8febe01](https://github.com/ChristopherVR/pptx-viewer/commit/8febe013ceed26da769638f037ec55125fdede32))
- **shared:** Collect used presentation fonts (by @ChristopherVR) ([3d92599](https://github.com/ChristopherVR/pptx-viewer/commit/3d92599c04bb186d0dbba83cdc11d4401540c2f9))
- **vue:** Share used font collection (by @ChristopherVR) ([35ba700](https://github.com/ChristopherVR/pptx-viewer/commit/35ba7003f9a0291f47be1eb1baafd7c05b029485))
- **shared:** Scan browser font availability (by @ChristopherVR) ([cde4ef8](https://github.com/ChristopherVR/pptx-viewer/commit/cde4ef8c659a1ffca1e45023623a86ca7968acf9))
- **vue:** Share font availability scan (by @ChristopherVR) ([d4d3e54](https://github.com/ChristopherVR/pptx-viewer/commit/d4d3e54d4dd2a0da50c6245c72a5a00e101de1ef))
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
- **vue:** Normalize media inspector suite (by @ChristopherVR) ([956aec9](https://github.com/ChristopherVR/pptx-viewer/commit/956aec9780c6f2428d1cbe9d2618ef631061bdbe))

### Styling

- **vue:** Format media source fallback (by @ChristopherVR) ([7d4db03](https://github.com/ChristopherVR/pptx-viewer/commit/7d4db03cfff9d0ea9f400b44e63971e420ba07ab))

### Chores

- **repo:** Capture pending workspace updates (by @ChristopherVR) ([5d274f1](https://github.com/ChristopherVR/pptx-viewer/commit/5d274f16627170790cba14b6ecc99496f90c7ab7))

## [1.18.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.18.0) - 2026-07-16

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

## [1.17.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.17.1) - 2026-07-15

### Testing

- **viewer:** Enforce framework-neutral e2e parity (by @ChristopherVR) ([7389c7e](https://github.com/ChristopherVR/pptx-viewer/commit/7389c7e7586e7ce926400a096945b7e51448f709))

## [1.17.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.17.0) - 2026-07-13

### Bug Fixes

- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Dependencies

- **deps:** Update html2canvas-pro to 2.2.3 (by @dependabot[bot]) ([0fe015b](https://github.com/ChristopherVR/pptx-viewer/commit/0fe015b83722534f14864b2054ce6561b09386ca))
- **deps:** Update fast-xml-parser to 5.10.0 (by @dependabot[bot]) ([6080273](https://github.com/ChristopherVR/pptx-viewer/commit/6080273f6a6f603d10d69a71d54faad1e6d9bf05))
- **deps:** Update terser to 5.49.0 (by @dependabot[bot]) ([0d8b25e](https://github.com/ChristopherVR/pptx-viewer/commit/0d8b25e304e7528614ab048d07cd011eb742c2c9))
- **deps:** Update dompurify to 3.4.12 (by @dependabot[bot]) ([00a6ca4](https://github.com/ChristopherVR/pptx-viewer/commit/00a6ca49609d5a0e922a9e20447460b11ec690ba))
- **deps:** Update minor and patch dependencies (by @dependabot[bot]) ([5cd81fb](https://github.com/ChristopherVR/pptx-viewer/commit/5cd81fb0c8708e53990ac4858660d0b6a4b17a7a))
- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## [1.16.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.16.1) - 2026-07-13

### Bug Fixes

- **core:** Open Office-encrypted pptx files (by @ChristopherVR) ([51aa670](https://github.com/ChristopherVR/pptx-viewer/commit/51aa670e8ca78d78323f55766b1a4c0e8b366c00))

## [1.16.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.16.0) - 2026-07-11

### Features

- **core:** Add canonical collaboration field-schema (by @ChristopherVR) ([cc78c1e](https://github.com/ChristopherVR/pptx-viewer/commit/cc78c1ed352fac3f69180ec2846d1df3e1dbd377))
- **shared:** Add the office colour swatch catalogue (by @ChristopherVR) ([41135a0](https://github.com/ChristopherVR/pptx-viewer/commit/41135a0f8687550cb17ded1451fa8f361fc975b1))

### Bug Fixes

- **shared:** Close CRDT allowlist data-loss gaps, add binary asset map (by @ChristopherVR) ([60ad222](https://github.com/ChristopherVR/pptx-viewer/commit/60ad2226bc4f3450c2992362e9fcceaac77f2ccf))

### Refactor

- **vue:** Re-arm sync gate on reconnect, dedupe onto shared modules (by @ChristopherVR) ([b11ace7](https://github.com/ChristopherVR/pptx-viewer/commit/b11ace7a876f5be46f7171f0bc8d669c0b5f4565))

## [1.15.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.15.0) - 2026-07-11

### Features

- **shared:** Add text wrap/autofit, image adjustments, and table inspector helpers (by @ChristopherVR) ([54b2eda](https://github.com/ChristopherVR/pptx-viewer/commit/54b2eda35254bc75257932568442396a5f343708))

### Documentation

- **shared:** Add i18n keys for the vanilla Design tab theme gallery (by @ChristopherVR) ([593ea23](https://github.com/ChristopherVR/pptx-viewer/commit/593ea230e61f606056ffc013e2fdb82bea70738b))

## [1.14.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.14.1) - 2026-07-11

### Bug Fixes

- **shared,react,vue,angular:** Make the Aa Change Case dropdown actually rewrite text (by @ChristopherVR) ([d84fd78](https://github.com/ChristopherVR/pptx-viewer/commit/d84fd788097253cf8b9281eca35af35caad20dce))
- **react,vue,angular:** Drop stray space when splitting a wrapped line (by @ChristopherVR) ([1a43c81](https://github.com/ChristopherVR/pptx-viewer/commit/1a43c810fd43cf57d3691c124568e73f31fd7b0a))

### Refactor

- **shared:** Extract clipboard, shape-preset, and text-format catalogs from react (by @ChristopherVR) ([b9d7cc9](https://github.com/ChristopherVR/pptx-viewer/commit/b9d7cc9b061b8c9dcaad91038136349c9360080d))
- **shared:** Dedupe change-case logic against text-case-transform (by @ChristopherVR) ([d007c07](https://github.com/ChristopherVR/pptx-viewer/commit/d007c070fb5bf8573bd8ac6dbeae160b46fc2dde))

## [1.14.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.14.0) - 2026-07-11

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([0ecd3d9](https://github.com/ChristopherVR/pptx-viewer/commit/0ecd3d935f97c78e8b0a62bebc8bf610c42414ab))

## [1.13.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.13.1) - 2026-07-10

### Bug Fixes

- **shared:** Sanitize print-document/SVG assembly with DOMPurify (by @ChristopherVR) ([84527b6](https://github.com/ChristopherVR/pptx-viewer/commit/84527b63350643d0a78b37d7ea55238fe4a8fa72))

## [1.13.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.13.0) - 2026-07-09

### Features

- Addressing CodeQL issues (by @ChristopherVR) ([ec1be4f](https://github.com/ChristopherVR/pptx-viewer/commit/ec1be4fc01b1b6804055b7948728fd60348e0110))

### Bug Fixes

- **core:** Close residual ReDoS/path-traversal gaps from the last CodeQL pass (by @ChristopherVR) ([9b17db9](https://github.com/ChristopherVR/pptx-viewer/commit/9b17db9067fac5f1b230d6fcc50fa9f8936d96ae))
- **shared:** Harden print-document HTML assembly against injection (by @ChristopherVR) ([e6add81](https://github.com/ChristopherVR/pptx-viewer/commit/e6add81b93dd71d42c2ef54e459fcc0629a17fa8))

## [1.12.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.12.0) - 2026-07-09

### Features

- **vue:** Expose internal composables via pptx-vue-viewer/composables-unstable (by @ChristopherVR) ([7f9d507](https://github.com/ChristopherVR/pptx-viewer/commit/7f9d5079aeae4fdd72a8a3bcf3defb901a366204))

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([c4a7e32](https://github.com/ChristopherVR/pptx-viewer/commit/c4a7e3223fa179f9239b1bc856e574011d4ca2c1))
- Reconcile with origin/main before push (by @ChristopherVR) ([ef5fc85](https://github.com/ChristopherVR/pptx-viewer/commit/ef5fc85dca2e20ff3e105d622594e0f65d010fb0))
- Reconcile with origin/main before push (by @ChristopherVR) ([030b28b](https://github.com/ChristopherVR/pptx-viewer/commit/030b28bb21697ed681e4e59aa40db29f4b4a18d0))

## [1.11.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.11.0) - 2026-07-09

### Features

- **shared:** Add vermilion light/dark theme presets to all bindings (by @ChristopherVR) ([1b6e816](https://github.com/ChristopherVR/pptx-viewer/commit/1b6e8161679a3f984cbfedb09ece0c8c01570c0a))

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([10acef8](https://github.com/ChristopherVR/pptx-viewer/commit/10acef81a7f5d79e778e4e4464d956cc84682f7c))

## [1.10.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.10.2) - 2026-07-09

### Other

- Reconcile with origin/main before push (by @ChristopherVR) ([b8c46bc](https://github.com/ChristopherVR/pptx-viewer/commit/b8c46bc3622e301d3365f5c489144e5aa5401782))

## [1.10.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.10.1) - 2026-07-09

### Bug Fixes

- **core:** Preserve SmartArt node geometry when round-tripping (by @ChristopherVR) ([cc5bd78](https://github.com/ChristopherVR/pptx-viewer/commit/cc5bd789e59d3cc772c9600512377317cad05772))

## [1.10.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.10.0) - 2026-07-08

### Features

- **shared:** Add smartart preset data builder (by @ChristopherVR) ([872b0ff](https://github.com/ChristopherVR/pptx-viewer/commit/872b0ff274950ab50193456e4398b9ef2f112fdd))

### Bug Fixes

- **vue:** Theme-aware backgrounds and larger slide thumbnails (by @ChristopherVR) ([142e125](https://github.com/ChristopherVR/pptx-viewer/commit/142e1258452dd91831b07b52d824dd7544af8caa))
- **vue:** Always show the speaker-notes footer strip (by @ChristopherVR) ([6b50f3b](https://github.com/ChristopherVR/pptx-viewer/commit/6b50f3b3fde2faf6163070c6454081e8aed05f28))
- **vue:** Live smartart gallery previews and styled insert tables (by @ChristopherVR) ([7c7a687](https://github.com/ChristopherVR/pptx-viewer/commit/7c7a68799ee379473d8992a9bcc90db52f4df26f))

### Testing

- **vue:** Align NotesPanel spec with controlled expanded prop (by @ChristopherVR) ([c215056](https://github.com/ChristopherVR/pptx-viewer/commit/c215056ac54cfc1d2e9095be21ddd9b72b2867fd))

## [1.9.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.9.1) - 2026-07-08

### Documentation

- **core:** Remove explicit jszip/fast-xml-parser mention from install section (by @ChristopherVR) ([6b72906](https://github.com/ChristopherVR/pptx-viewer/commit/6b72906c08447ba38a704ff4572c89d7cad7e60c))

## [1.9.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.9.0) - 2026-07-07

### Features

- **shared:** Ribbon parity with PowerPoint - localize all tabs, add command search, advance slide controls (by @ChristopherVR) ([6bd1e5a](https://github.com/ChristopherVR/pptx-viewer/commit/6bd1e5ad16c079fd994080888119fe2e027c9a5c))
- **shared:** Add Review tab Language and Accessibility buttons across all frameworks (by @ChristopherVR) ([2dfd7bf](https://github.com/ChristopherVR/pptx-viewer/commit/2dfd7bf17d4583fa591246b77e178951b795aa32))

## [1.8.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.8.0) - 2026-07-07

### Features

- **shared:** Autosave disabled status with reason, recovery helpers (by @ChristopherVR) ([8ccc7eb](https://github.com/ChristopherVR/pptx-viewer/commit/8ccc7ebd451a8101c6e045708ee7c3a1cb006e1d))

## [1.7.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.7.2) - 2026-07-07

### Bug Fixes

- **vue:** Stop text boxes clipping their own glyphs ([bfb01b9](https://github.com/ChristopherVR/pptx-viewer/commit/bfb01b91b7564885b2c3cb29da7e71befeb57158))
- **core:** Handle absolute relationship target paths in layout/master resolution (by @ChristopherVR) ([5ea40c2](https://github.com/ChristopherVR/pptx-viewer/commit/5ea40c22eca8420aa872b0ea923770085df72a0e))

## [1.7.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.7.1) - 2026-07-06

### Dependencies

- **deps:** Update tailwindcss to ^4.3.2 and @angular/common to ^22.0.5 (by @ChristopherVR) ([ae1b615](https://github.com/ChristopherVR/pptx-viewer/commit/ae1b615b3632a8dc3bcd9a201fbab583648da97c))

## [1.7.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.7.0) - 2026-07-05

### Features

- **react,vue:** Add editing section, paragraph dropdowns, text shadow to toolbar (by @ChristopherVR) ([13232d0](https://github.com/ChristopherVR/pptx-viewer/commit/13232d00a00029d95087b30bf1d82be142e9a0eb))
- **vue,angular:** Add line spacing, text direction, columns, and editing controls (by @ChristopherVR) ([71e1c69](https://github.com/ChristopherVR/pptx-viewer/commit/71e1c69c4e3dca22329fb4125da67373e0851efe))
- **react,vue,angular:** Remove Text and Arrange tabs, merge into Home (by @ChristopherVR) ([6183ff3](https://github.com/ChristopherVR/pptx-viewer/commit/6183ff3a4c50e31b5d267eb31de8aab9da068aff))
- **react,vue,angular:** Add Drawing group, Slides controls, and Record tab (by @ChristopherVR) ([8b68ba7](https://github.com/ChristopherVR/pptx-viewer/commit/8b68ba78599c3c3ded50ab99ab2bbcf38991caf2))

### Bug Fixes

- **vue:** UseIsMobile container ref resolved too early, missed late mount (by @ChristopherVR) ([e81999a](https://github.com/ChristopherVR/pptx-viewer/commit/e81999aeacf362602698d33797e5e2c6670014af))

## [1.6.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.6.0) - 2026-07-05

### Features

- **core,cli:** Add react, angular, vue to npm keywords (by @ChristopherVR) ([528ec61](https://github.com/ChristopherVR/pptx-viewer/commit/528ec6182bb77c07444dd0e93560b65e604b9524))
- **shared:** Progressive imperative API for all viewer bindings (by @ChristopherVR) ([877339d](https://github.com/ChristopherVR/pptx-viewer/commit/877339d05b486d697f2d04d01b3fd954e3c54746))

## [1.5.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.5.3) - 2026-07-04

## [1.5.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.5.2) - 2026-07-04

## [1.5.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.5.1) - 2026-07-04

## [1.5.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.5.0) - 2026-07-04

## [1.4.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.4.0) - 2026-07-04

### Features

- Reworking the UI to align more on MS powerpoint UI (by @ChristopherVR) ([39386c0](https://github.com/ChristopherVR/pptx-viewer/commit/39386c0c8ff93b185352d8e5b9f17ec6b8cd7d45))

## [1.3.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.3.1) - 2026-07-04

### Bug Fixes

- **core:** Fabricate diagram parts so inserted SmartArt survives save (by @ChristopherVR) ([0d1341f](https://github.com/ChristopherVR/pptx-viewer/commit/0d1341fd4402518c51b3ed1e301aa4115a9af3b4))
- **shared:** Preserve equation and field metadata in remapTextToSegments (by @ChristopherVR) ([9675d18](https://github.com/ChristopherVR/pptx-viewer/commit/9675d18a652f1c87cc65b40bf7150251fc945587))
- **vue:** Block inline text editing on equation elements (by @ChristopherVR) ([4b52d06](https://github.com/ChristopherVR/pptx-viewer/commit/4b52d069dec95c228691f84b0292eed957d46e1c))

## [1.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.3.0) - 2026-07-04

## [1.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.2.0) - 2026-07-04

### Features

- **shared:** Add i18n keys for ribbon, shortcuts panel, and text formatting (by @ChristopherVR) ([6e97c3b](https://github.com/ChristopherVR/pptx-viewer/commit/6e97c3bc158e43fda5faba9bc9a9d661d0a71994))

### Bug Fixes

- **vue:** Mount the version-history and compare panels (by @ChristopherVR) ([064ff67](https://github.com/ChristopherVR/pptx-viewer/commit/064ff672337dd3d261589c7d3a44acb727500622))
- **vue:** Fix SmartArt colour-scoping, hover popover, and dead Insert SmartArt wiring (by @ChristopherVR) ([51167ce](https://github.com/ChristopherVR/pptx-viewer/commit/51167ce1ef5c994bd687101860460b1ee65c6063))
- **vue:** Repair merge corruption in PowerPointViewer.vue, wire up Insert Equation (by @ChristopherVR) ([e3e780b](https://github.com/ChristopherVR/pptx-viewer/commit/e3e780b2a9a88fd9cc5c12c6d59826bfa9a94c1a))

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
- **vue:** Route ribbon/toolbar/shortcut labels through i18n (by @ChristopherVR) ([7d391a4](https://github.com/ChristopherVR/pptx-viewer/commit/7d391a4c532ca82c389989756de9c0685fe19847))

## [1.1.89](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.89) - 2026-07-03

### Documentation

- Remove completed ROADMAP and PORTING trackers, scrub stale references (by @ChristopherVR) ([8a745a1](https://github.com/ChristopherVR/pptx-viewer/commit/8a745a1d2a1ee3932503d37dd022494ab9cfcc4b))

## [1.1.85](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.85) - 2026-07-03

### Testing

- **vue:** Install a real vue-i18n instance globally for component tests (by @ChristopherVR) ([47edca1](https://github.com/ChristopherVR/pptx-viewer/commit/47edca1d9060ef30899970038510c278716fe23a))

## [1.1.83](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.83) - 2026-07-03

### Features

- **vue:** Interoperable presence schema, webrtc transport, granular sync (by @ChristopherVR) ([9b53df5](https://github.com/ChristopherVR/pptx-viewer/commit/9b53df5e9487c5fbb16e78f40f5e746752eb4574))

### Dependencies

- **deps:** Declare yjs, y-websocket, and y-webrtc across bindings (by @ChristopherVR) ([27a2849](https://github.com/ChristopherVR/pptx-viewer/commit/27a2849da755a0902296dcd59557c1329a1cbadf))

## [1.1.81](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.81) - 2026-07-03

### Features

- Document localization and add demo language pickers (by @ChristopherVR) ([a07ad82](https://github.com/ChristopherVR/pptx-viewer/commit/a07ad8279e906590e0392d19cd1637855012a80e))

## [1.1.80](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.80) - 2026-07-02

### Features

- **shared:** Add canonical i18n translation dictionary (by @ChristopherVR) ([429e386](https://github.com/ChristopherVR/pptx-viewer/commit/429e386c7245fc5cf526ac72481fd5ab23b3e09d))

### Bug Fixes

- **react:** Expose i18n dictionary via pptx-react-viewer, not the private shared package (by @ChristopherVR) ([09f49fe](https://github.com/ChristopherVR/pptx-viewer/commit/09f49fe68aa27d3305294f5896d5f53d3b52a160))
- **vue:** Expose i18n dictionary via pptx-vue-viewer, not the private shared package (by @ChristopherVR) ([8577907](https://github.com/ChristopherVR/pptx-viewer/commit/8577907cf63af3190853b31e7810f477f394fad2))

## [1.1.76](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.76) - 2026-07-02

### Bug Fixes

- **core:** Correct install docs and drop the retired @christophervr/pptx-viewer alias (by @ChristopherVR) ([6544b4e](https://github.com/ChristopherVR/pptx-viewer/commit/6544b4eaf086945ecd8a18b877de5a483032aa14))
- **core,angular:** Revert xmldom to 0.8.x and fix shared import specifiers (by @ChristopherVR) ([29eda31](https://github.com/ChristopherVR/pptx-viewer/commit/29eda3119836559b63bc08733dd9dd6398a69c8d))

## [1.1.73](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.73) - 2026-06-27

### Bug Fixes

- Missing document links (by @ChristopherVR) ([f52bd6f](https://github.com/ChristopherVR/pptx-viewer/commit/f52bd6fd2fc4f564f018ecf5e84e64d24c8fd240))

## [1.1.60](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.60) - 2026-06-25

### Other

- **smartart:** Snapshot in-progress SmartArt session work (by @ChristopherVR) ([0cac22f](https://github.com/ChristopherVR/pptx-viewer/commit/0cac22f5b1a0ecc33960f4712ff2ef691beb3f65))

## [1.1.54](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.54) - 2026-06-25

### Refactor

- **shared:** Extract text-rendering pure logic (line-height, warp, effects) (by @ChristopherVR) ([11c8d22](https://github.com/ChristopherVR/pptx-viewer/commit/11c8d22e9910dda9c8dfa18e0f6d7683577c7b9f))

## [1.1.33](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-vue-viewer@1.1.33) - 2026-06-21

### Dependencies

- **deps:** Update dependencies within semver ranges (by @ChristopherVR) ([d472b58](https://github.com/ChristopherVR/pptx-viewer/commit/d472b58dfd47628b5c682bd5f4dc2014ec29b421))

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
- **vue:** Export to PNG/PDF + image & table inspector panels (by @ChristopherVR) ([6e8ca87](https://github.com/ChristopherVR/pptx-viewer/commit/6e8ca8779ee138dba2f17176b8ffffbf837f0110))
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
- **core:** Consume emf-converter and mtx-decompressor from npm (by @ChristopherVR) ([2f6013d](https://github.com/ChristopherVR/pptx-viewer/commit/2f6013d5b8fab0aef5b32901841d94c0fa886f24))
- **vue:** Remove em-dashes from code comments and prose (by @ChristopherVR) ([e306df9](https://github.com/ChristopherVR/pptx-viewer/commit/e306df9ed3d8ee65cc6de6f94ace8789682aa0bb))

### Documentation

- Restructure root README, elevate limitations, fix outdated claims (by @ChristopherVR) ([86dcda9](https://github.com/ChristopherVR/pptx-viewer/commit/86dcda9b5e3129f2223341337055778db574e985))
- Rewrite limitations with technical explanations and remove inaccurate claims (by @ChristopherVR) ([ac4bc84](https://github.com/ChristopherVR/pptx-viewer/commit/ac4bc84ed9bd03f62e3ae29c35baf3f444a3c0bf))
- **readme:** Npm-friendly READMEs — hero image, capabilities & install first (by @ChristopherVR) ([c843d19](https://github.com/ChristopherVR/pptx-viewer/commit/c843d1934b846f901bba92e63d2b01f9479594d0))
- Streamline npm READMEs and add badges, screenshots, demo links (by @ChristopherVR) ([92e980d](https://github.com/ChristopherVR/pptx-viewer/commit/92e980d434900abd223c4d70c6cae19a623f9ca8))
- **vue,angular:** Point Try-demo links at per-framework demos (by @ChristopherVR) ([b5e6915](https://github.com/ChristopherVR/pptx-viewer/commit/b5e6915c416075f4f50630d76dfedbc324cde03e))
- Remove em-dashes and clarify demo link in viewer packages (by @ChristopherVR) ([f52afff](https://github.com/ChristopherVR/pptx-viewer/commit/f52afffd935016b747116a9909c523021b492225))

### Build & CI

- **react,vue:** Self-contained, minified, precompressed dist + vue CI (by @ChristopherVR) ([aa28df9](https://github.com/ChristopherVR/pptx-viewer/commit/aa28df916eee064ac502c01be3445e8c84ad37f6))
- **vue:** Adopt Tailwind 4 pipeline for chrome visual parity with React (by @ChristopherVR) ([451dacc](https://github.com/ChristopherVR/pptx-viewer/commit/451dacc831d41e620749f8403a2183d4e8b853df))
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
