# Porting status: pptx-vanilla-viewer and pptx-svelte-viewer

Tracks the final depth work for the two newest bindings against the
established React / Vue / Angular bindings. Scope note: both shipped as a
**viewer-only first milestone**; both have since gained complete editing,
export, rich speaker-notes, opt-in 3D SmartArt, responsive chrome, autosave,
collaboration, and presentation-playback surfaces. Both now run the complete product
E2E suite used by every maintained binding. This file tracks only the remaining
master-canvas and localization depth gaps. Remove it once those are complete
(the Vue port's tracker was removed the same way).

## Snapshot

| Capability                             | React/Vue/Angular       | Vanilla             | Svelte              |
| -------------------------------------- | ----------------------- | ------------------- | ------------------- |
| Load + slide stage + navigation        | yes                     | yes                 | yes                 |
| Thumbnails / toolbar / fullscreen      | yes                     | yes                 | yes                 |
| Theme system (ViewerTheme, presets)    | yes                     | yes                 | yes                 |
| text/shape/image/group/connector       | yes                     | yes                 | yes                 |
| table                                  | yes                     | yes                 | yes                 |
| chart                                  | yes                     | yes                 | yes                 |
| smartArt (2D)                          | yes                     | yes                 | yes                 |
| media (video/audio)                    | yes                     | yes                 | yes                 |
| ink                                    | yes                     | yes                 | yes                 |
| ole                                    | yes                     | yes                 | yes                 |
| contentPart / zoom / model3d           | yes                     | yes                 | yes                 |
| 3D SmartArt (opt-in smartArt3D)        | yes                     | yes                 | yes                 |
| Presentation-mode media autoplay       | yes                     | yes                 | yes                 |
| Notes panel                            | yes (rich editor)       | yes (rich editor)   | yes (rich editor)   |
| Editing (selection/move/resize/etc.)   | yes (full ribbon)       | yes (full ribbon)   | yes (full ribbon)   |
| Export                                 | PNG/PDF/GIF/video/print | same                | same                |
| i18n locale registration               | yes                     | yes (see below)     | yes (see below)     |
| e2e coverage in the Playwright harness | 26 specs / 95 tests     | 26 specs / 95 tests | 26 specs / 95 tests |
| Animations / transitions playback      | yes                     | yes                 | yes                 |
| Ribbon / inspector / dialogs chrome    | yes                     | yes                 | yes                 |
| Autosave                               | yes                     | yes                 | yes                 |
| Template (master/layout) editing       | yes                     | yes                 | yes                 |
| Collaboration                          | yes                     | yes                 | yes                 |

Both bindings now provide selection, multi-selection, move/resize/rotate,
inline text and rich notes editing, insertion, z-order, group/ungroup,
undo/redo, save/download, accessibility review, autosave, and collaboration.
Inherited layout/master elements are partitioned from slide-owned content,
gated behind template-editing mode, history tracked, and merged back on save.
Both bindings also expose dedicated slide-master/layout thumbnail navigation
and editable canvases. Master/layout mutations participate in undo/redo,
autosave, and `PptxHandler.save(..., { slideMasters })` persistence. Notes and
handout master canvases are not yet exposed.

## Both bindings

Rendering fidelity (gaps also noted in renderer JSDoc):

- [x] WordArt warp, sanitized OMML/MathML equations, and shape/image duotone filters
- [x] 3D extrusion side panels, connector labels, and line shadow/glow effects
- [x] Theme colour scheme / `tableStyleMap` threading and theme-aware table bands
- [x] Presentation ink replay and highlighter multiply blending
  - Pressure-circle strokes stay static, matching React's path-only replay.
  - Persisted eraser strokes have no cross-element masking semantics; the
    editor eraser deletes complete ink elements.
- [x] Per-node SmartArt accessibility labels and SVG titles

Viewer features:

- [x] 3D SmartArt via `pptx-viewer-shared/smartart-3d` behind an opt-in
      `smartArt3D` flag (both bindings; eager mount, falls back to the SVG
      renderer when `three` is unavailable or the WebGL mount fails)
- [x] Presentation-mode media autoplay (shared: `startMediaAutoplay`,
      threaded from the Fullscreen API through to the media renderer)
- [x] Rich notes editor with bold/italic/lists/hyperlinks and plain-text fallback
- [x] Export: PNG, PDF, GIF, video, and print, through the shared export
      pipeline.
  - [x] Handout / notes-page output through the shared print/export layouts
- [x] Animations / transitions playback (shared: `animation-timeline-*`,
      `animation-playback`, `animation-css`)
- [x] Accessibility semantics, checker panel, and issue navigation
- [x] Responsive mobile chrome (compact navigation, zoom, notes, and
      presentation controls)
- [x] Advanced touch interaction parity (persistent presentation controls plus
      slide-up menu/slides/insert/format/comments sheets with backdrop and
      swipe dismissal; shared gesture state keeps both bindings consistent)

i18n: mechanism is at parity (not a gap) - vanilla accepts per-locale
`messages` overrides and `pptx-svelte-viewer/i18n` exposes
`registerTranslations`, both documented in `docs/guide/localization.md`
alongside React/Vue/Angular (with dedicated Vanilla/Svelte sections), and
both demos ship working French/Spanish/German pickers. What remains is real
but lower priority:

- [ ] Key coverage: every established binding currently shares the same 335
      French, 332 Spanish, and 332 German translated overrides. The canonical
      English dictionary contains 2,362 keys, so roughly 2,030 translations per
      language still need new translation content; there is no fuller in-repo
      locale source to synchronize. Uncovered keys fall back to English.

Editing:

Vanilla (`packages/vanilla/src/viewer/editor/`) and Svelte
(`packages/svelte/src/viewer/editor/`, runes-based `EditorState`/
`EditorController`), both at the same feature stage:

- [x] Selection / move / resize / rotate interactions
- [x] Text inline editing
- [x] History (undo/redo)
- [x] Save / download round-trip via `PptxHandler.save`
- [x] Ribbon / toolbar editing chrome, inspectors, and core dialogs
- [x] Autosave (shared: `autosave-store`)
- [x] Add-new-element and z-order/group operations
- [x] Current-slide inherited template editing plus dedicated slide-master and
      layout workspaces, with history, autosave, and save persistence
- [x] Marquee/additive selection, collective multi-element move/resize/nudge,
      and align/distribute controls
- [x] Format Painter with one-shot application, cancellation, and undo
- [x] Comment add/edit/delete/resolve/reopen in both bindings
- [x] Inline table-cell editing with keyboard and outside-pointer commit
- [x] Existing-equation reopen/update with undo support
- [x] Collaboration (shared CRDT reconcile + transports)

Tooling / QA:

- [x] e2e: React, Vue, Angular, Vanilla, and Svelte run the identical 26-spec,
      95-test product suite through `playwright.config.ts`: 475 verified project
      executions in total. Coverage includes load/navigation/zoom/notes,
      selection and transforms, inline and table-cell editing, responsive
      toolbar and inspector behavior, mobile flows, Format Painter, template
      editing, animations, charts, SmartArt, media, collaboration,
      text/relationship rendering, OLE preview, and ink save/reload.
      Documentation capture specs are intentionally separate: `capture-*.spec.ts`
      run only through `playwright.capture.config.ts` and are not part of the
      26-spec product matrix.
- [x] Docs-site and package guides kept in sync with the completed surfaces
- [x] Vanilla emits `dist/styles.css` and exports `pptx-vanilla-viewer/styles.css`
      for CSP-strict hosts, while retaining injection and `getViewerCss()`

## Remaining depth and QA work

- [ ] Expose notes-master and handout-master navigation/editing canvases; slide
      masters and layouts are complete. Core currently loads the master types,
      backgrounds, placeholders, headers/footers, and colour maps, but does not
      populate or serialize their element collections. Editable canvases need
      that core parse/save support first.
- [ ] Expand the French/Spanish/German demo dictionaries beyond their current
      high-visibility-key coverage; English fallback is complete.
