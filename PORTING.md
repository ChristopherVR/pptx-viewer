# Porting status: pptx-vanilla-viewer and pptx-svelte-viewer

Tracks what the two newest bindings still need to reach parity with the
established React / Vue / Angular bindings. Scope note: both shipped as a
**viewer-only first milestone**; the mature bindings are full viewer+editor
components. This file is the working checklist for closing that gap. Remove
it once both bindings reach parity (the Vue port's tracker was removed the
same way).

## Snapshot

| Capability                          | React/Vue/Angular | Vanilla             | Svelte             |
| ----------------------------------- | ----------------- | ------------------- | ------------------ |
| Load + slide stage + navigation     | yes               | yes                 | yes                |
| Thumbnails / toolbar / fullscreen   | yes               | yes                 | yes                |
| Theme system (ViewerTheme, presets) | yes               | yes                 | yes                |
| text/shape/image/group/connector    | yes               | yes                 | yes                |
| table                               | yes               | yes                 | placeholder        |
| chart                               | yes               | yes                 | placeholder        |
| smartArt (2D)                       | yes               | yes                 | placeholder        |
| media (video/audio)                 | yes               | yes                 | placeholder        |
| ink                                 | yes               | yes                 | placeholder        |
| ole                                 | yes               | yes                 | placeholder        |
| contentPart / zoom / model3d        | yes               | placeholder         | placeholder        |
| 3D SmartArt (opt-in smartArt3D)     | yes               | no                  | no                 |
| Animations / transitions playback   | yes               | no                  | no                 |
| Presentation-mode media autoplay    | yes               | no                  | no                 |
| Notes panel                         | yes               | no                  | no                 |
| Export (PNG/PDF/GIF/video/print)    | yes               | no                  | no                 |
| Editing (full editor)               | yes               | no                  | no                 |
| Collaboration                       | yes               | no                  | no                 |
| i18n locale registration            | yes               | partial (overrides) | partial (register) |
| e2e specs in the Playwright harness | yes               | no                  | no                 |

## Svelte: next up (port from vanilla, logic already in shared)

The vanilla binding already consumes every shared helper these need; the
Svelte port is mostly thin SFCs over the same calls (see
`packages/vanilla/src/viewer/render/elements/` for the reference wiring).

- [ ] `table` renderer (shared: `getTableCellBandStyle`, `cellStyleToCss`, `getDiagonalBorders`, ...)
- [ ] `chart` renderer (shared: `buildChartViewModel`, `resolveChartKind`, `getChartStylePalette`)
- [ ] `smartArt` 2D renderer (shared: `projectDrawingShapes`, `computeSmartArtLayout`, `buildSmartArtA11y`)
- [ ] `media` renderer (native `<video>`/`<audio>` + poster + fallback)
- [ ] `ink` renderer (shared: `extractPathPoints`, pressure helpers)
- [ ] `ole` renderer (shared: `resolveOleType`, `formatBytes`, download/open affordances)

## Both bindings

Rendering fidelity (gaps also noted in renderer JSDoc):

- [ ] WordArt warp, OMML/LaTeX equations, duotone image filter defs on shapes
- [ ] 3D extrusion side panels; connector labels; line shadow/glow effects
- [ ] Theme colour scheme / `tableStyleMap` threading into the render context
      (table banding currently uses the shared hardcoded fallbacks)
- [ ] `contentPart`, `zoom`, `model3d` renderers (model3d: shared `mountModel3D`
      in `render/model3d-scene.ts` is framework-free and ready to mount)
- [ ] 3D SmartArt via `pptx-viewer-shared/smartart-3d` behind an opt-in flag
- [ ] Ink replay animation and highlighter/eraser blend modes
- [ ] Per-node SmartArt a11y labels (needs Vue's node-order helpers promoted
      into shared first)

Viewer features:

- [ ] Animations / transitions playback (shared: `animation-timeline-*`,
      `animation-playback`, `animation-css`)
- [ ] Presentation-mode media autoplay (shared: `startMediaAutoplay`)
- [ ] Notes panel (shared: `render/notes`)
- [ ] Export: PNG/PDF/GIF/video and print (shared: `export/` has all the maths;
      needs per-binding capture + download wiring)
- [ ] Accessibility pass (shared: `accessibility.ts`, `accessibility-issues.ts`)
- [ ] Mobile / touch interaction parity

i18n:

- [ ] Locale dictionary registration parity: vanilla accepts per-locale
      `messages` overrides and `pptx-svelte-viewer/i18n` exposes
      `registerTranslations`, but neither ships non-English dictionaries nor
      documents the workflow; vanilla `setLocale` rebuilds chrome wholesale

Editing (the big one, sequence like the Vue/Angular ports):

- [ ] Selection / move / resize / rotate interactions
- [ ] Text inline editing
- [ ] Ribbon / toolbar editing chrome, inspectors, dialogs
- [ ] History (undo/redo), autosave (shared: `autosave-store`)
- [ ] Save / download round-trip via `PptxHandler.save`
- [ ] Template (master/layout) editing via `editTemplateMode`
- [ ] Collaboration (shared CRDT reconcile + transports)

Tooling / QA:

- [ ] e2e specs for both demos wired into `playwright.config` projects and CI
- [ ] Docs-site guides kept in sync as features land
- [ ] Vanilla ships styles via an injected style tag + `getViewerCss()`; decide
      whether to also emit a static `dist/styles.css` for CSP-strict hosts
