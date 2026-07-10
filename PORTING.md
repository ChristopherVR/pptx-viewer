# Porting status: pptx-vanilla-viewer and pptx-svelte-viewer

Tracks what the two newest bindings still need to reach parity with the
established React / Vue / Angular bindings. Scope note: both shipped as a
**viewer-only first milestone**; Vanilla has since gained a first editing
pass (selection, move/resize/rotate, inline text, undo/redo, save/download -
see the Snapshot table below), Svelte remains viewer-only. The mature
bindings are full viewer+editor components; this file is the working
checklist for closing the remaining gap. Remove it once both bindings reach
parity (the Vue port's tracker was removed the same way).

## Snapshot

| Capability                          | React/Vue/Angular | Vanilla              | Svelte               |
| ----------------------------------- | ----------------- | -------------------- | -------------------- |
| Load + slide stage + navigation     | yes               | yes                  | yes                  |
| Thumbnails / toolbar / fullscreen   | yes               | yes                  | yes                  |
| Theme system (ViewerTheme, presets) | yes               | yes                  | yes                  |
| text/shape/image/group/connector    | yes               | yes                  | yes                  |
| table                               | yes               | yes                  | yes                  |
| chart                               | yes               | yes                  | yes                  |
| smartArt (2D)                       | yes               | yes                  | yes                  |
| media (video/audio)                 | yes               | yes                  | yes                  |
| ink                                 | yes               | yes                  | yes                  |
| ole                                 | yes               | yes                  | yes                  |
| contentPart / zoom / model3d        | yes               | yes                  | yes                  |
| 3D SmartArt (opt-in smartArt3D)     | yes               | yes                  | yes                  |
| Animations / transitions playback   | yes               | no                   | no                   |
| Presentation-mode media autoplay    | yes               | yes                  | yes                  |
| Notes panel                         | yes (rich editor) | partial (plain text) | partial (plain text) |
| Export (PNG/PDF/GIF/video/print)    | yes               | no                   | no                   |
| Editing (full editor)               | yes               | partial (see below)  | no                   |
| Collaboration                       | yes               | no                   | no                   |
| i18n locale registration            | yes               | yes (see below)      | yes (see below)      |
| e2e specs in the Playwright harness | yes               | no                   | no                   |

Vanilla's "partial" editing: click-to-select, drag-to-move (with snap
guides), resize (8 handles, Shift = aspect-lock), rotate, double-click
inline text editing, undo/redo (100-entry history), delete, duplicate
(`Ctrl/Cmd+D`), and save/download round-trip are all implemented (see
`packages/vanilla/src/viewer/editor/`). Missing: a property/inspector
panel, add-new-element, z-order/group operations, template (master/layout)
editing, autosave, and collaboration.

## Svelte element renderers: done (port from vanilla is complete)

The Svelte port now has dedicated renderers for every element type the
other bindings support, including `contentPart` / `zoom` / `model3d` - see
`packages/svelte/src/viewer/components/ElementRenderer.svelte`.

## Both bindings

Rendering fidelity (gaps also noted in renderer JSDoc):

- [ ] WordArt warp, OMML/LaTeX equations, duotone image filter defs on shapes
- [ ] 3D extrusion side panels; connector labels; line shadow/glow effects
- [ ] Theme colour scheme / `tableStyleMap` threading into the render context
      (table banding currently uses the shared hardcoded fallbacks)
- [ ] Ink replay animation and highlighter/eraser blend modes (NOT actually a
      vanilla/svelte-specific gap: Vue's own `InkRenderer.vue` doesn't have
      this either, only React does via its animation-playback hooks; low
      priority, no simple cross-binding reference to port from)
- [ ] Per-node SmartArt a11y labels (needs Vue's node-order helpers promoted
      into shared first)

Viewer features:

- [x] 3D SmartArt via `pptx-viewer-shared/smartart-3d` behind an opt-in
      `smartArt3D` flag (both bindings; eager mount, falls back to the SVG
      renderer when `three` is unavailable or the WebGL mount fails)
- [x] Presentation-mode media autoplay (shared: `startMediaAutoplay`,
      threaded from the Fullscreen API through to the media renderer)
- [x] Notes panel, plain-text surface only (shared: `render/notes`); the rich
      contentEditable toolbar (bold/italic/lists/hyperlinks) that Vue/React
      have is still not ported - out of scope for a first pass
- [ ] Animations / transitions playback (shared: `animation-timeline-*`,
      `animation-playback`, `animation-css`)
- [ ] Export: PNG/PDF/GIF/video and print (shared: `export/` has all the maths;
      needs per-binding capture + download wiring)
- [ ] Accessibility pass (shared: `accessibility.ts`, `accessibility-issues.ts`)
- [ ] Mobile / touch interaction parity

i18n: mechanism is at parity (not a gap) - vanilla accepts per-locale
`messages` overrides and `pptx-svelte-viewer/i18n` exposes
`registerTranslations`, both documented in `docs/guide/localization.md`
alongside React/Vue/Angular, and both demos ship working French/Spanish/German
pickers. What remains is real but lower priority:

- [ ] Key coverage: the demo dictionaries cover ~325 `pptx.*` keys vs Vue's
      ~969; uncovered keys fall back to English gracefully, but full parity
      needs translating the remaining ~644 keys per language (mechanical
      translation work, good first-timer contribution)

Editing (the big one, sequence like the Vue/Angular ports):

Vanilla (`packages/vanilla/src/viewer/editor/`):

- [x] Selection / move / resize / rotate interactions
- [x] Text inline editing
- [x] History (undo/redo)
- [x] Save / download round-trip via `PptxHandler.save` (toolbar Save button
      calls `downloadPptx()`)
- [ ] Ribbon / toolbar editing chrome, inspectors, dialogs (still just
      Save/Undo/Redo buttons - no property panel)
- [ ] Autosave (shared: `autosave-store`)
- [ ] Add-new-element and z-order/group operations
- [ ] Template (master/layout) editing via `editTemplateMode`
- [ ] Collaboration (shared CRDT reconcile + transports)

Svelte: none of the above yet - not started.

Tooling / QA:

- [ ] e2e specs for both demos wired into `playwright.config` projects and CI
- [ ] Docs-site guides kept in sync as features land
- [ ] Vanilla ships styles via an injected style tag + `getViewerCss()`; decide
      whether to also emit a static `dist/styles.css` for CSP-strict hosts
