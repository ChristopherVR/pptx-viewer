# Porting status: pptx-vanilla-viewer and pptx-svelte-viewer

Tracks what the two newest bindings still need to reach parity with the
established React / Vue / Angular bindings. Scope note: both shipped as a
**viewer-only first milestone**; both have since gained a first editing pass
(selection, move/resize/rotate, inline text, undo/redo, save/download) plus
PNG/PDF export, a plain-text speaker-notes panel, opt-in 3D SmartArt, and
presentation-mode media autoplay. Both bindings now also have desktop and
responsive mobile chrome, ribbon/inspector editing surfaces, autosave,
collaboration, and presentation playback. This file tracks the remaining
depth gaps against the mature bindings. Remove it once both bindings reach
parity (the Vue port's tracker was removed the same way).

## Snapshot

| Capability                             | React/Vue/Angular   | Vanilla              | Svelte               |
| -------------------------------------- | ------------------- | -------------------- | -------------------- |
| Load + slide stage + navigation        | yes                 | yes                  | yes                  |
| Thumbnails / toolbar / fullscreen      | yes                 | yes                  | yes                  |
| Theme system (ViewerTheme, presets)    | yes                 | yes                  | yes                  |
| text/shape/image/group/connector       | yes                 | yes                  | yes                  |
| table                                  | yes                 | yes                  | yes                  |
| chart                                  | yes                 | yes                  | yes                  |
| smartArt (2D)                          | yes                 | yes                  | yes                  |
| media (video/audio)                    | yes                 | yes                  | yes                  |
| ink                                    | yes                 | yes                  | yes                  |
| ole                                    | yes                 | yes                  | yes                  |
| contentPart / zoom / model3d           | yes                 | yes                  | yes                  |
| 3D SmartArt (opt-in smartArt3D)        | yes                 | yes                  | yes                  |
| Presentation-mode media autoplay       | yes                 | yes                  | yes                  |
| Notes panel                            | yes (rich editor)   | partial (plain text) | partial (plain text) |
| Editing (selection/move/resize/etc.)   | yes (full ribbon)   | partial (see below)  | partial (see below)  |
| Export                                 | PNG/PDF/GIF/video   | yes                  | yes                  |
| i18n locale registration               | yes                 | yes (see below)      | yes (see below)      |
| e2e coverage in the Playwright harness | full ~20-file suite | dedicated smoke spec | dedicated smoke spec |
| Animations / transitions playback      | yes                 | yes                  | yes                  |
| Ribbon / inspector / dialogs chrome    | yes                 | yes                  | yes                  |
| Autosave                               | yes                 | yes                  | yes                  |
| Template (master/layout) editing       | yes                 | no                   | no                   |
| Collaboration                          | yes                 | yes                  | yes                  |

Both bindings' "partial" editing: click-to-select, drag-to-move (with snap
guides), resize (8 handles, Shift = aspect-lock), rotate, double-click
inline text editing, undo/redo (100-entry history), delete, duplicate
(`Ctrl/Cmd+D`), and save/download round-trip are all implemented (see
`packages/vanilla/src/viewer/editor/` and `packages/svelte/src/viewer/editor/`).
The main remaining editing gaps are template (master/layout) editing, the
broader React review and accessibility surfaces, and richer notes editing.

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
- [x] Export: PNG, PDF, GIF, video, and print, through the shared export
      pipeline.
  - [ ] Handout / notes-page PDF export (shared `export/handout-layout`,
        `notes-page-layout`, `pdf-notes-*` have the maths)
- [x] Animations / transitions playback (shared: `animation-timeline-*`,
      `animation-playback`, `animation-css`)
- [ ] Accessibility pass (shared: `accessibility.ts`, `accessibility-issues.ts`)
- [x] Responsive mobile chrome (compact navigation, zoom, notes, and
      presentation controls)
- [ ] Advanced touch interaction parity (React's mobile sheet and gesture
      affordances)

i18n: mechanism is at parity (not a gap) - vanilla accepts per-locale
`messages` overrides and `pptx-svelte-viewer/i18n` exposes
`registerTranslations`, both documented in `docs/guide/localization.md`
alongside React/Vue/Angular (with dedicated Vanilla/Svelte sections), and
both demos ship working French/Spanish/German pickers. What remains is real
but lower priority:

- [ ] Key coverage: the demo dictionaries cover ~325 `pptx.*` keys vs Vue's
      ~969; uncovered keys fall back to English gracefully, but full parity
      needs translating the remaining ~644 keys per language (mechanical
      translation work, good first-timer contribution)

Editing (the big one, sequence like the Vue/Angular ports):

Vanilla (`packages/vanilla/src/viewer/editor/`) and Svelte
(`packages/svelte/src/viewer/editor/`, runes-based `EditorState`/
`EditorController`), both at the same feature stage:

- [x] Selection / move / resize / rotate interactions
- [x] Text inline editing
- [x] History (undo/redo)
- [x] Save / download round-trip via `PptxHandler.save`
- [x] Ribbon / toolbar editing chrome, inspectors, and core dialogs
- [x] Autosave (shared: `autosave-store`)
- [ ] Add-new-element and z-order/group operations
- [ ] Template (master/layout) editing via `editTemplateMode`
- [x] Collaboration (shared CRDT reconcile + transports)

Tooling / QA:

- [x] e2e: both demos wired into `playwright.config.ts` as `vanilla`/`svelte`
      projects and the CI `e2e` job matrix, running a dedicated
      `e2e/vanilla-svelte-basics.spec.ts` (load, navigate, zoom, notes,
      select/move/resize, undo/redo, save-as-download, smartArt3D opt-in).
      The full ~20-file shared spec set is deliberately NOT run against them:
      most of it still needs incremental enablement against the newer bindings
      as DOM contracts are normalized.
- [ ] Docs-site guides kept in sync as features land
- [ ] Vanilla ships styles via an injected style tag + `getViewerCss()`; decide
      whether to also emit a static `dist/styles.css` for CSP-strict hosts
