# Design, Review and contextual ribbon evidence

These captures use the same fixtures, selections and 1440 x 900 viewport as
`../ribbon-baseline/`. The baseline commit is recorded in that directory.
All five bindings use shared command/group and gallery views.

Validation on 2026-10-01:

- `bun run build` and `bun run typecheck`: passed.
- `bun run fmt:check`, changed-file `oxlint --deny-warnings`,
  `bun run e2e:contract` and React 18 public typechecking: passed.
- Core full suite: 954 files passed, one skipped; 15,324 tests passed,
  231 skipped. Covers actual SmartArt quick-style save/reload.
- React 18 and React 19 focused command/gallery/Review suites: 155 tests
  passed on each version.
- Shared web controls and customization: 62 tests passed. Gallery and section
  tests cover controlled state, focus, disabled intents, remounts and independent
  instances. Shared descriptor/style/color regressions also passed.
- Vue Review and toolbar-gallery adapters: 10 tests passed; Angular Review:
  two tests passed; Svelte Review: five tests passed; Vanilla Review and ribbon:
  31 tests passed. Design and contextual gallery adapter regressions also passed.
- `bunx playwright test e2e/ribbon-contextual-migration.spec.ts
e2e/ribbon-gallery-migration.spec.ts e2e/ribbon-review-migration.spec.ts
--workers=2`: 45 tests passed across all five bindings, including actual
  chart/SmartArt edits, save/reload, native comments/language actions, customization,
  keyboard focus, narrow layouts, 44px touch targets and forced colors.

The broader UI migration remains open. These results cover the completed
Design, Review and contextual families; they do not claim completion of Home,
Insert, Animations or the non-ribbon inventory.

## Draw (#375)

The five `*-draw.png` captures use the baseline deck and viewport, with Pen,
red and width 16 selected. Native gesture rendering and save behavior remain
outside the shared controlled view.

- Root build and typecheck, React 18 public typecheck: passed.
- React 18 and React 19 Draw/toolbar/constants suites: 161 tests each.
- Vue Draw: four tests; Angular Draw: four tests; Svelte Draw: four tests;
  Vanilla Draw/ribbon/recent-color suites: 37 tests passed.
- Shared Draw state/view: five tests; shared web-control regressions passed.
- Draw neutral browser suite: 15 tests across all five bindings passed.
  Existing highlighter and live-tilt suites: 20 tests passed.
- Changed-file formatting/lint and neutral test contract: passed.

## View (#380)

The five `*-view.png` captures use the baseline deck and viewport on the View
tab. Native view switching, preference persistence, EyeDropper and template
editing remain outside the shared controlled view.

- Root build and typecheck: passed (0 errors).
- Shared View state/view: eight tests; shared web-control suite passed.
- React 18 and React 19 toolbar/View suites passed; Vue, Svelte, Angular and
  Vanilla ribbon suites passed.
- View neutral browser suite: 30 tests across all five bindings passed.
- Changed-file formatting/lint and neutral test contract: passed.

## Transitions (#377)

The five `*-transitions.png` captures use the baseline deck and viewport on the
Transitions tab with the default (None) preset. Slide mutation, history,
persistence, the stage preview replay and audio playback remain outside the
shared controlled view.

- Root build and typecheck (0 errors): passed.
- Shared Transitions state/view: ten tests; the full shared suite passed.
- React 18 and React 19, Vue, Svelte, Angular and Vanilla full unit suites
  passed with the shared view mounted in each adapter.
- Transitions neutral browser suite: 30 tests across all five bindings passed,
  including a stock-sound save and reload. Existing `ribbon-control-effects`,
  `effect-sound-gallery`, Draw and View suites also passed.
- `ribbon-compact-layout.spec.ts` Design cases fail in all bindings on the
  integration baseline before this change (Browse Themes centering) and are
  unrelated to Transitions.

## Animations (#378)

The five `*-animations.png` captures use the baseline deck and viewport on the
Animations tab (no selection, so authoring controls are disabled as in the
baseline). Native effect edits, the Animation Pane/inspector, the Svelte and
Vanilla play-order timeline, Preview playback, history and persistence remain
outside the shared controlled view.

- Root build and typecheck (0 errors), React 18 public typecheck: passed.
- Shared Animations state/view: nine tests; shared suite passed.
- React 18 and React 19 full suites: 7,491 tests each; Vue 3,159; Svelte 2,025;
  Angular 4,038; Vanilla 2,103 tests passed.
- Animations neutral browser suite: 35 tests across all five bindings passed
  (ids, a real gallery effect, undo, redo with save/reload and Preview on the
  saved deck, a motion path in the saved XML, customization, touch targets,
  focus, theme tokens and forced colors).
- Existing animation, ribbon parity, inventory, web-control, Draw and View
  specs: 160 tests passed.

## Insert (#374)

The five `*-insert.png` captures use the baseline deck and viewport on the
Insert tab; the matching "before" captures are `../ribbon-baseline/<binding>-insert.png`.
Native document insertion, file pickers, the SmartArt/equation/hyperlink/Header
& Footer dialogs and history remain outside the shared controlled view.

- Root build and typecheck: passed.
- Shared Insert state/view: 11 tests; shared, locales, React, Vue, Svelte,
  Angular and Vanilla unit suites: passed (counts in the commit message).
- Insert neutral browser suite: 35 tests across all five bindings passed
  (real text box/shape/table insertion, undo/redo, save/reload, menus,
  Freeform pressed state, native dialogs and file chooser, customization,
  touch targets, theme tokens, forced colors). Existing equation, media,
  SmartArt, edit-points, save-corruption and compact-layout Insert checks passed.
- Changed-file formatting/lint and neutral test contract: passed.

## Home (#373, partial)

The five `*-home.png` captures use the baseline deck, viewport and Home tab
(no selection). Clipboard, Font characters, Paragraph indent/alignment and
Editing Find/Replace are shared; Slides, Drawing and Arrange stay native (see
`docs/guide/ui-migration.md`), so this does not complete #373.

- Typecheck (0 errors) and build: passed.
- Full unit suites: shared 10,978; React 7,496 (React 18 and 19); Vue 3,168;
  Svelte 2,029; Angular 4,044 (2 pre-existing chart-data-helpers failures on
  the base); Vanilla 2,105 tests passed.
- Home neutral browser suite across all five bindings plus 16 related ribbon,
  keyboard, Draw, View and text specs: 580 passed; only the known Design cases
  of `ribbon-compact-layout.spec.ts` fail.
