# Shared UI migration evidence

The migration uses shared logic, open-shadow views and CSS from
`pptx-viewer-shared`. Native adapters retain document mutations, history,
persistence and framework lifecycle. The contributor's 126 work units are an
inventory of surfaces, not 126 required public custom-element tags.

## Theme editor (#364)

The baseline was recorded on the issue before implementation. All screenshots
use the same sample deck, 1440 x 900 viewport and Design > Edit Theme entry.

| Binding | Baseline placement          | Before                                                         | Shared editor                                                |
| ------- | --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| React   | Right dock below the ribbon | [Before](/assets/ui-migration/theme-editor/react-before.png)   | [After](/assets/ui-migration/theme-editor/react-after.png)   |
| Vue     | Full-window fixed overlay   | [Before](/assets/ui-migration/theme-editor/vue-before.png)     | [After](/assets/ui-migration/theme-editor/vue-after.png)     |
| Angular | Centered gallery modal      | [Before](/assets/ui-migration/theme-editor/angular-before.png) | [After](/assets/ui-migration/theme-editor/angular-after.png) |
| Svelte  | Editor inside the ribbon    | [Before](/assets/ui-migration/theme-editor/svelte-before.png)  | [After](/assets/ui-migration/theme-editor/svelte-after.png)  |
| Vanilla | Right dock below the ribbon | [Before](/assets/ui-migration/theme-editor/vanilla-before.png) | [After](/assets/ui-migration/theme-editor/vanilla-after.png) |

The shared editor docks against the editor body, with a bottom sheet below
768px. Every binding offers the same ten presets, twelve colors, font fields,
preview, Apply, Reset and Close. Fields and presets update a local draft;
Apply sends one complete detached edit to the native host. Reset restores the
current host theme. Close and Escape discard the draft and restore opener
focus. Secondary inline placements use the same view without automatic focus.

The property/event/lifecycle contract is documented in
`packages/shared/src/web-components/README.md`. The neutral browser spec is
`e2e/theme-editor-migration.spec.ts`; it checks docking, focus, draft dismissal,
Reset, Apply, saved theme XML, narrow actions and forced colors. Adapter unit
tests cover native callbacks, disabled state and React 18/19 compatibility.

## Incremental ribbon rollout (#363)

The integrated Slide Show, Help and Record batches establish the command/group
contract and five-binding adapters. Future tab batches must record comparable
baselines before implementation, preserve public customization ids, replace
duplicate view/CSS and verify their own native actions. Generic buttons should
be extracted only when their contract differs from a ribbon command. The
milestone and focused tab issues carry the remaining inventory; slide-content
rendering remains a separate architecture decision.

The completed foundation issues are #346 (search), #347 (File spacing), #348
(checkboxes) and #349 (app-owned selects). Slide Show (#360/#361), the lifecycle
contract (#362), Help (#366), Record (#367) and Subtitle Settings (#365) are
integrated. Theme-editor parity is delivered in #364. These completion records
do not claim that the remaining UI inventory has already migrated.

| Planned family                               | Issue | Owner         |
| -------------------------------------------- | ----- | ------------- |
| Remaining Home controls                      | #373  | ChristopherVR |
| Insert                                       | #374  | ChristopherVR |
| Insert (delivered, see below)                | #374  | ChristopherVR |
| Transitions                                  | #377  | ChristopherVR |
| Animations                                   | #378  | ChristopherVR |
| Distinct non-ribbon buttons and icon-buttons | #386  | ChristopherVR |

These are native children of #363 in the Thin UI adapters milestone. Each has
its own baseline, shared/native boundary and validation requirements. Their
`ui:planned` status means implementation is still outstanding; contributors
should claim a bounded family before starting to avoid overlapping changes.

## Design, Review and contextual galleries

Design (#376), Review (#379), Shape Format (#381), Picture Format (#382),
Table Design (#383), Chart Design (#384) and SmartArt Design (#385) now use
shared groups, commands and gallery views in all five bindings. The main UI
rework tracker (#342) remains open for the remaining families above.

Design command metadata controls availability and open state. Review uses
seven canonical groups and a keyed section view that preserves command focus
when native state changes. Gallery descriptors supply previews and selection;
the shared view owns popup placement, keyboard navigation, dismissal, touch
targets and forced-color styling. Native hosts still own document edits,
history, selection, comments, dialogs and saving. The property/event contract
is in `packages/shared/src/web-components/README.md`.

Comparable screenshots use the same decks and 1440 x 900 viewport. Baseline
files are in `/assets/ui-migration/ribbon-baseline/`; completed views are in
`/assets/ui-migration/ribbon-after/`. Filenames combine the binding and tab,
for example `react-review.png` and `vue-shapeFormat.png`.

Neutral browser coverage is in `ribbon-contextual-migration.spec.ts`,
`ribbon-gallery-migration.spec.ts` and `ribbon-review-migration.spec.ts`.
It exercises actual chart and SmartArt style/color edits through save and
reload, Review spelling/language/comments actions, customization, focus,
narrow layouts, touch targets and forced colors. Save/reload checks also
identified and fixed missing SmartArt quick-style intensity serialization,
SmartArt color-definition updates and chart gallery selection reconstruction.

## Draw

Draw (#375) uses one controlled shared view for Select, Pen, Highlighter,
Eraser, Freeform, color and width. Native hosts own pointer gestures, ink
creation, erasure, history and recent-color persistence. Live custom-color
input updates the tool; a committed choice also updates native recent colors.
All five bindings offer the same width range (1 to 16) and presets.

The view preserves public customization ids and focused tool buttons during
state updates. The color palette clamps to the viewport, closes on outside
pointer or Escape, and restores opener focus on Escape. Read-only hosts
disable drawing intents. Theme tokens, forced colors and coarse-pointer
targets follow the shared control contract. Comparable screenshots are
`<binding>-draw.png` in the baseline and after directories.

`e2e/ribbon-draw-migration.spec.ts` covers keyboard tool activation, native
ink creation, undo/redo, InkML save/reload, customization, tokens, touch
targets and dismissal. Saved InkML verifies width and color; rendered paths
or pressure circles verify the reloaded stroke. Existing highlighter and
tilt specs separately cover variable geometry.

## View

View (#380) uses one controlled shared view, `pptx-ui-ribbon-view`, for the
Presentation Views, Master Views, Show, Zoom and Window groups. It owns the
group markup, icons, labels, pressed/checked and disabled state. Hosts supply
viewer options and route typed `view-request` intents (command, option or
guide) to native handlers. Persisted viewer options (rulers, grid, guides,
snapping), view switching (Normal, Slide Sorter, Outline, Reading, Slide
Master), the browser EyeDropper and its selection patch, template-element
editing and the editor history stay native in each binding.

All five bindings now share one control set: Rulers, Grid, Guides and Snap to
Grid are checkbox rows; Selection, Eyedropper, Snap to Shape, H/V Guide and
the template toggle are commands with pressed state. Public customization ids
are unchanged, including the single `view.show.addGuide` id that wraps both
guide buttons. Hosts without Selection Pane or Eyedropper wiring hide those
commands; hosts that hide the `zoom` action drop the Zoom group from the DOM.
Slide Master, Eyedropper and template editing are disabled when read-only.
Handout Master, Notes Master, Zoom and Macros remain disabled placeholders.

Boundary: the full-window Outline, Reading and Slide Sorter views are native
overlays and are not part of this change. Eyedropper active state is only
reflected where the host exposes it (React, Vue and Angular).
`e2e/ribbon-view-migration.spec.ts` covers ids, keyboard and pointer toggles,
native ruler effects, Outline/Normal switching, template state, preference
persistence, customization, touch targets, theme tokens and forced colors.
Comparable screenshots are `<binding>-view.png` in the baseline and after
directories.

## Transitions

Transitions (#377) uses one controlled shared view, `pptx-ui-ribbon-transitions`,
for the Preview, Transition to This Slide and Timing groups: the preset gallery,
Duration, Sound (None, 19 stock sounds, Other Sound...), Apply to All, Advance
Slide (On Mouse Click and After) and the Inspector toggle. Hosts derive the
state from the active slide through the shared `readRibbonTransitionDraft` and
route typed `transitions-request` intents. Slide mutation, undo history,
persistence, the stage transition preview replay, audio playback, the sound
file read into the save pipeline and the inspector pane stay native.

Parity fixes: every binding now shows the same controls with pressed state on
the active preset and gates edits when read-only (Angular previously never
did). Duration commits live while the After time commits on blur or Enter:
React and Vue used to commit the time per keystroke, and Vanilla and Angular
committed Duration only on blur. Public customization ids are unchanged. The
Effect Options catalogue id still has no control in any binding. Boundary:
the Vanilla and Angular hosts do not track inspector open state, so their
Inspector command never shows as pressed.

`e2e/ribbon-transitions-migration.spec.ts` covers ids, keyboard activation,
applying a preset, duration, a timed advance and a stock sound to the deck,
undo/redo, save and reload, Apply to All across slides, the stage Preview,
customization, touch targets, theme tokens, focus and forced colors.
`ribbon-control-effects.spec.ts`, `ribbon-compact-layout.spec.ts` and
`effect-sound-gallery.spec.ts` cover the same controls from earlier work.
Comparable screenshots are `<binding>-transitions.png` in the baseline and
after directories.

## Animations

Animations (#378) uses one controlled shared view, `pptx-ui-ribbon-animations`,
for the Preview, Animation, Motion Paths, Advanced Animation and Timing groups.
It owns the group markup, the always-visible entrance/emphasis/exit and
motion-path galleries, icons, labels, pressed and disabled state. Hosts supply
the selection, edit permission, Animation Pane state and a translator, and route
typed `animations-request` intents (`add` or `command`) to native handlers.

Native hosts keep every effect edit (adding, removing and reordering effects,
triggers, timing, direction and repeat), the animation play-order timeline with
drag reordering in Svelte and Vanilla, the Animation Pane/inspector lifecycle,
in-canvas Preview playback, document history and persistence. All five bindings
now share one control set: Exit Effects carries the catalogue's
`animations.advancedAnimation.addAnimation` id everywhere, the Animation Pane
shows its pressed state when the inspector is open, and the Angular Effect
Options and Trigger commands open the Animation Panel like the other bindings.
Animation Painter and the Timing Start/Duration fields remain disabled
placeholders; Vanilla's panel commands still toggle the inspector.

Public customization ids are unchanged. Boundary: the Svelte and Vanilla
play-order timeline rows and the inspector Animation panel are native and not
part of this change. `e2e/ribbon-animations-migration.spec.ts` covers ids, a real
effect added through the gallery, the deck-level animation pane, undo/redo,
save and reload, customization, touch targets, focus, theme tokens and forced
colors. Comparable screenshots are `<binding>-animations.png` in the baseline
and after directories.

## Insert

Insert (#374) uses one controlled shared view, `pptx-ui-ribbon-insert`, for the
Tables, Images, Illustrations (Shapes, Freeform tools, Chart, SmartArt), Links
(Link, Action), Text (Text Box, Field, Header & Footer), Symbols (Equation) and
Media groups. It owns the markup, icons, labels, pickers, pressed Freeform
state and disabled/read-only gating; hosts supply viewer state and route typed
`insert-request` intents (command, shapeType/shape, chartType/chart, freeform,
actionButton, field) to native handlers.

Native in every binding: document mutation, undo/history and persistence, the
image/media file pickers, the SmartArt gallery, equation editor, hyperlink and
Header & Footer dialogs, Freeform arming and the canvas overlay, and (React,
Vue, Angular) the Date/Time format picker. Public customization ids are
unchanged; Header & Footer still has none.

Parity gaps fixed before migrating: Angular's Insert controls were never
disabled in a read-only deck and its Link ignored the selection state; Svelte
and Vanilla used native selects or popups for Action and Field while React, Vue
and Angular used hover-only popups. All five now share click and keyboard menus.
The Shape button's glyph follows the staged preset in every binding. Svelte and
Vanilla still insert the current date directly for the Date/Time field (no
format picker), as before. Group order now follows PowerPoint (Text Box moved
into the Text group) and each group has a caption (new `pptx.insert.group*` keys in
English, German, Spanish, French and Simplified Chinese).

`e2e/ribbon-insert-migration.spec.ts` covers ids, keyboard and pointer
insertion of a text box, shape and table with undo/redo and a save/reload round
trip, the Chart/Action/Field menus, Freeform pressed state, Link selection
gating, the native SmartArt/Equation dialogs and image file chooser,
customization, touch targets, theme tokens and forced colors. Comparable
screenshots are `<binding>-insert.png` in the baseline and after directories.

## Home

Home (#373) is delivered in group families, one commit each, so the large tab
stays reviewable. PR #359 had already moved the Home icon artwork
(`RIBBON_CONTROL_ICONS`), the catalogue ids and the editor-chrome layout CSS
into shared code; the markup, gating and callbacks of every group were still
duplicated per binding. Each family below now uses one controlled shared view,
`pptx-ui-ribbon-home-<family>`, that renders the buttons, icons, labels,
pressed and disabled state, and emits one typed `home-request` intent with the
public control id. Hosts keep every document mutation, history entry,
persistence and native popup. Public customization ids are unchanged.

- Clipboard: Paste, Cut, Copy and Format Painter (the whole `home.clipboard`
  group). Gating is now identical in all five bindings; Angular's Format
  Painter previously stayed live in a read-only viewer and now follows the
  other four. The React and Vue "copied/cut" green flash was cosmetic and is not
  carried over.

- Font: the character strip in `home.font` (Bold, Italic, Underline,
  Strikethrough, Text Shadow, Increase and Decrease Font Size, Clear
  Formatting) with pressed state for the toggles. The family and size
  selectors, character spacing, change case and the colour pickers stay native:
  they are app-owned selects and popovers that read the deck's theme fonts,
  embedded fonts and recent colours. How each binding computes the toggle and
  size-step edits is unchanged (React reads the run-level tri-state at click
  time; the size ladder differs between bindings). React's Font buttons now
  disable for non-text selections like the other four.

- Paragraph: Decrease and Increase Indent and the four alignments in
  `home.paragraph`, with alignment reflected as pressed when the viewer can
  read an explicit alignment. The Bullets and Numbering toggles (with their
  library galleries), line spacing, text direction and columns stay native.
  Angular's indent and alignment buttons now follow read-only mode like the
  other bindings.
- Editing: Find and Replace in `home.editing` (both open the host's find
  panel; Svelte mirrors an open panel as pressed). The Select menu and Select All
  stay native.

Boundary: Slides, Drawing and Arrange are not migrated in this change. They are
labelled split buttons, galleries, dialogs and colour pickers anchored natively
by each binding, with different labels, order and gating per binding, so
sharing them would change behaviour. They remain open under #373 as the next
Home batches (see the shared README for the detail); the issue is not complete.

`e2e/ribbon-home-migration.spec.ts` covers ids, selection and clipboard gating,
real copy/paste/cut with undo and redo, the Format Painter, customization,
touch targets, theme tokens and forced colors across all five bindings.
Comparable screenshots are `<binding>-home.png` in the baseline and after
directories.

## Non-ribbon families (#386)

The first pass at #386 classified twelve non-ribbon families from the file
inventory and migrated only the status bar. This pass read the sources of all
five bindings for every family before deciding. A family migrated when its markup,
gating and callbacks were the same across the bindings, or differed only in drift
that could be normalised without changing what a user can do (the same rule the
status bar used). A family stayed native only with file evidence that the
bindings implement different features, and each of those has a focused follow-up
issue. Ribbon commands are out of scope (#363); the File backstage belongs to #342.

| Family                                           | What the five sources show                                                                                                                                                                                                                                                                                                                                                                                     | Decision                                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status bar                                       | Five hand-built copies of the counter, save state, notes toggle, view buttons and zoom cluster.                                                                                                                                                                                                                                                                                                                | **Migrated** in #390 as `pptx-ui-status-bar`.                                                                                                                              |
| Read-only banner                                 | Same message, Edit anyway, Dismiss and password form in all five (`ReadOnlyBanner.tsx`, `ReadOnlyBanner.vue`, `readonly-banner.component.ts`, `ReadOnlyBanner.svelte`, `ui/read-only-banner.ts`). Drift: React and Vanilla had no "Read-only recommended" title, Vanilla used a close glyph, the role was `alert` in one binding and `status` in three, and only React focused the password input.             | **Migrated**: `pptx-ui-read-only-banner`.                                                                                                                                  |
| Paste options toolbar                            | Same four-format strip, canvas-anchored measurement and window-level dismissal in all five (`PasteOptionsToolbar.tsx/.vue/.svelte`, `paste-options-toolbar.component.ts`, `ui/paste-options-toolbar.ts`). Drift: a press on the strip could dismiss it before its click landed, and choosing a format closed it in only three.                                                                                 | **Migrated**: `pptx-ui-paste-options`. The host still measures the pasted element.                                                                                         |
| Compatibility toasts                             | Same state (toasts, insets) and callbacks (dismiss one, dismiss all) in all five. Drift: Vue and Svelte capped the stack at five with a "+N" count, the other three showed everything, and markup and icons differed.                                                                                                                                                                                          | **Migrated**: `pptx-ui-compat-toasts`, which caps at five and positions itself with `compatToastStackStyle`.                                                               |
| Dialog footers                                   | Every dialog hand-builds its footer inside its own modal shell (React `useModalFocus`, Vue `ModalDialog.vue`, Angular `modal-dialog.component.ts`, Svelte `collab/components/ModalDialog.svelte`, Vanilla `parity-dialog-shell.ts`). The button rows are the same shape in all five.                                                                                                                           | **Migrated** as `pptx-ui-dialog-footer` (not a shell), adopted by Paste Special, Keep Annotations, autosave recovery and the signed-deck warning. The rest follow in #396. |
| Mobile bottom bar and top toolbar                | Same five slots and disabled rule (`buildBarActions`) and the same toolbar order (`MobileBottomBar.tsx/.vue`, `mobile-bottom-bar.component.ts`, `MobileActionSheets.svelte`, `ui/mobile-action-sheets.ts`; `MobileToolbar.tsx/.vue`, `mobile-toolbar.component.ts`, `MobileChrome.svelte`, `ui/mobile-toolbar.ts`). Drift: label keys, the comment badge, the open-sheet pill, edit-only gating, AI and Share. | **Migrated**: `pptx-ui-mobile-bar` and `pptx-ui-mobile-toolbar`.                                                                                                           |
| Presentation toolbar and presenter console strip | Both already render from shared inventories (`PRESENT_TOOLBAR_CONTROLS`, `PRESENTER_CONSOLE_CONTROLS`) with identical ids, order and label keys, but each binding re-implemented the markup, the palettes, the timer and the slot-state rule. Drift: right-click palettes only in React and Vue, `aria-pressed` only in Svelte and Vanilla, Zoom in active only in React, Vue and Angular.                     | **Migrated**: `pptx-ui-present-toolbar` and `pptx-ui-presenter-console`. Auto-hide, annotations and console snapshot patching stay native.                                 |
| Context menus                                    | Entry lists are already shared; the rendering is hand-built per menu in each binding (React `ContextMenu.tsx`, Vue `ContextMenu.vue`, Angular `editor-context-menu.component.ts`, Svelte `ElementContextMenu.svelte`, Vanilla `ui/element-context-menu.ts`, plus canvas, thumbnail and presentation menus). No binding implements arrow keys, typeahead or nesting.                                            | Not migrated in this change (about 20 adapters and 40 test files). Concrete scope in #393.                                                                                 |
| Title bar and quick access                       | Same slot order, and `pptx-ui-search` is already shared. Real drift: Vanilla renders quick-access commands in catalog order while the others hardcode Save, Undo and Redo first; tooltips, icons, Save gating and search gating differ; Svelte never passes `disabledReason`.                                                                                                                                  | Keep native until the drift is decided; the list and the plan are in #394.                                                                                                 |
| Notes toolbar and panel buttons                  | Same button set, different contracts: Vue uses another i18n namespace, Svelte hides formatting in plain mode and orders Indent differently, the link UI is a popover in three bindings and `window.prompt` in two, and Print is a dialog in React and an iframe elsewhere.                                                                                                                                     | Keep native until the contracts are unified; plan in #395.                                                                                                                 |
| Slide rail actions                               | Different features: React has an Add Slide footer, Vue a Duplicate/Add/Delete row, Angular per-thumbnail move buttons and Svelte section-header buttons; the section menu is a popup only in React; the sorter menu has five entries in React, three in Vue, Angular and Svelte, and none in Vanilla. The rest of the rail is virtualisation, drag reorder and slide-content rendering, which #386 excludes.   | Keep native. A product decision is needed first (#397).                                                                                                                    |
| Inspector panel actions                          | About 170 React, 144 Vue, 124 Svelte and 96 Vanilla panel files that each commit through binding-specific editor and history APIs with debounced inputs; the leaf controls are already the shared select and checkbox. Svelte and Vanilla also lack several Reset and Clear actions the others have (`image.resetCrop`, `media.resetTrim`, `chart.clearSeriesColor`, `slideBackground.clearBackground`).       | Keep native; the parity gaps are tracked in #398.                                                                                                                          |
| File backstage                                   | Owned by the #342 primitives work.                                                                                                                                                                                                                                                                                                                                                                             | Not touched here.                                                                                                                                                          |

### What the new elements own

The eight new elements are in `packages/shared/src/web-components/`; their typed
`state`, events and behaviour are in that directory's README. They follow the
existing pattern: an open shadow root, a structured `state` property, bubbling
composed events and no events for programmatic updates. Adapters keep each
binding's public props, callbacks, ids and test hooks (`pptx-readonly-*`,
`pptx-compat-*`, `data-pptx-paste-options`, `data-pptx-present-toolbar`,
`data-pptx-present-control`, `data-pptx-presenter-control`).

Behaviour that changed so the five bindings now agree:

- Read-only banner: every binding shows "Read-only recommended: message" with a
  lock and `role="status"`, and focuses the password input when the prompt opens.
- Paste options: a press inside the strip no longer dismisses it before the click
  lands, and choosing a format always closes it. Escape inside the strip dismisses.
- Compatibility toasts: all five cap the stack at five with a "+N" count and always
  offer "Dismiss all".
- Dialog footers: Cancel and the primary action are one component, and the
  signed-deck confirmation uses the warning variant everywhere.
  `activateModalFocus` now walks open shadow roots, so a trapped dialog still tabs
  through its footer.
- Mobile bars: one label key set (Angular used two other keys for Insert and
  Format), the comment badge and open-sheet pill in every binding, edit-only slots
  disabled in view mode in every binding, and a tapped slot keeps its pressed
  colour because hover only applies on hovering devices.
- Presentation toolbar: every toggle exposes `aria-pressed`, right-clicking Pen or
  Highlighter opens its palette in every binding, and controls grow to 44px on
  coarse pointers. The presenter-view toggle is omitted when a host cannot open one.
- Presenter console: Zoom in reads active while zoomed past 100% in every binding,
  and one rule (`presenterConsoleViewState`, `presenterConsoleAction`) replaces five
  copies of the slot-state logic. The Vue and Angular helper modules that held those
  copies are removed.

Not shared on purpose: the show toolbar's auto-hide wrapper and annotation model,
presenter snapshot patching, every dialog shell and modal focus trap, the mobile
sheets, and every document mutation.

### Validation

Typecheck, `oxlint --deny-warnings` and `oxfmt` pass on every changed file. Unit
suites for shared and all five bindings pass (counts in the pull request). Adapter
tests cover state mapping, intent routing, gating and callback replacement for every
migrated family in every binding; shared tests cover the elements, their styles
(44px targets, forced colors, tokens), the shadow-aware focus trap and the
slot-state rules.

`e2e/chrome-controls-migration.spec.ts` runs on all five bindings and covers the
read-only banner (names, password focus, wrong and correct password, 44px), the
compatibility toasts (dismiss one and all, tokens, forced colors, 44px), the paste
options strip (four formats, choose, dismiss by key), the dialog footer (keyboard
cancel and OK, tokens, forced colors), the mobile bars (names, order, 44px, notes
toggle, tokens) and the slide-show toolbar (navigation, tool pressed state, palette
pick, End). `present-chrome-parity`, `presenter-view-parity`, `paste-special`,
`modify-password-*`, `compat-toast-clears-chrome`, `autosave-recovery-*`,
`mobile-audit`, `mobile-notes`, `keyboard-shortcuts` and the other show specs pass;
two probes (`present-chrome-parity`, `presenter-view-parity`) now read controls
through open shadow roots.

Before and after screenshots for the status bar and each migrated family are in
`docs/public/assets/ui-migration/non-ribbon-families/` (see its README for the decks,
viewports and commits).
