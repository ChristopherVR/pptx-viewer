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

Home (#373) is delivered in group families, so the large tab
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

- Slides: the whole `home.slides` group as `pptx-ui-ribbon-home-slides` (split
  New Slide, Slide Templates, Layout, Reset, Section). The layout menus and the
  template dialog stay native and anchor to the shared wrappers.
- Drawing: the Shapes, Arrange, Shape Fill and Shape Outline triggers
  (`pptx-ui-ribbon-home-drawing`); their menus and colour popovers stay native.
  Quick Styles and Shape Effects were already shared galleries.
- Arrange: Align and Distribute, Flip, z-order and Duplicate/Delete as four
  strips (`pptx-ui-ribbon-home-arrange-*`).

Behaviour changes to know: popover triggers now carry `aria-haspopup` and
`aria-expanded`; Angular's layout, Fill and Outline popovers open on click
instead of hover; Angular Arrange and Svelte Fill/Outline/z-order now follow
read-only mode; the Fill/Outline colour bar under the icon is gone in the
bindings that had it; a customization of `home.arrange.align` also hides
Distribute (Angular already did, Vanilla and Svelte now do). Hosts keep their
own empty-deck and layout rules for New Slide/Reset/Section through
`slidesHomeControls` flags.

Still native: the layout galleries, Shapes/Arrange menus, colour popovers and the
template dialog (popovers that read deck data and run each binding's undo), the
second Format Painter, Group/Ungroup, Merge Shapes, Crop and outline width in
Arrange, and in Font/Paragraph the family and size selects, character spacing,
change case, colour pickers, Bullets/Numbering galleries, line spacing, text
direction, columns and the Select menu. See the shared README for the detail.

`e2e/ribbon-home-migration.spec.ts` covers ids, selection and clipboard gating,
real copy/paste/cut with undo and redo, the Format Painter, customization,
touch targets, theme tokens and forced colors across all five bindings.
Comparable screenshots are `<binding>-home.png` in the baseline and after
directories.

## Non-ribbon buttons (#386)

The audit below covers every non-ribbon button or icon-button family. It was
taken from the component inventory of the five bindings (React
`viewer/components`, Vue `viewer/components`, Angular `viewer/*.component.ts`,
Svelte `viewer/components`, Vanilla `viewer/ui`) and from reading the status bar,
read-only banner and paste options sources. Families other than the status bar
were classified from their file structure and the sources named in the table and
were not migrated, so "keep native" is a scheduling decision, not a claim that no
sharing is possible. Ribbon commands are out of scope: they already use
`pptx-ui-ribbon-command` (#363). A family only migrates when one shared element
can own its markup, gating and callbacks without changing behaviour.

| Family                                                       | Where it appears                                                                                                                     | Duplicated markup or behaviour | Decision                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Status bar (counter, save state, notes, view modes, zoom)    | React `StatusBar.tsx`, Vue `StatusBar.vue`, Angular `status-bar.component.ts`, Svelte `StatusBar.svelte`, Vanilla `ui/status-bar.ts` | Yes, five hand-built copies    | **Migrate (this change)**: `pptx-ui-status-bar`. Same labels, gating and callbacks; hosts only map state and intents.              |
| Read-only banner (Edit anyway, Dismiss, password prompt)     | `ReadOnlyBanner` in all five bindings                                                                                                | Yes                            | Keep native for now. It owns a password form with focus, error and busy states; migrate as its own element in a follow-up.         |
| Paste options toolbar                                        | `PasteOptionsToolbar` in all five bindings                                                                                           | Yes                            | Keep native for now. Anchored to a canvas element with capture-phase dismissal; needs a shared popup-anchoring contract first.     |
| Dialog footers (Cancel, OK, Apply, Close)                    | About 25 dialogs per binding, inside different modal shells (React `useModalFocus`, Vue `ModalDialog.vue`, others)                   | Yes, but per dialog            | Keep native. Footers are inseparable from each binding's focus trap and dismissal; a shared dialog shell contract must come first. |
| Context menus (canvas, slide, section, sorter, presentation) | React 12 files, Vue 5, Angular 10, Svelte 6, Vanilla 7                                                                               | Yes, but not identical         | Keep native. Menu contents, nesting, positioning and roving focus differ by binding. Follow-up: shared menu contract.              |
| Presentation toolbar and presenter console toolbar           | All five bindings                                                                                                                    | Partly                         | Keep native. Show-time overlay with auto-hide, touch and fullscreen coupling.                                                      |
| Mobile bottom bar and mobile top toolbar                     | React, Vue, Angular, Vanilla; Svelte has no separate bottom bar                                                                      | No, differs by binding         | Keep native: not identical across bindings.                                                                                        |
| File backstage navigation and cards                          | React, Angular, Svelte; Vue and Vanilla have no equivalent                                                                           | No, differs by binding         | Keep native: not present in all five bindings.                                                                                     |
| Slide rail (thumbnails, drag reorder, section rows)          | All five bindings                                                                                                                    | Partly                         | Keep native. Hosts slide-content rendering and drag state, which the issue excludes.                                               |
| Title bar and quick-access buttons                           | React `TitleBar.tsx`, Vue `TitleBar.vue`, Angular `title-bar.component.ts`, Svelte `TitleBar.svelte`, Vanilla `ui/title-bar.ts`      | Yes                            | **Migrate (#394)**: `pptx-ui-title-bar`. One order, tooltip rule and gating table; host-owned parts are slotted.                   |
| Inspector panel actions                                      | React about 119 files, Vue 94, Svelte 74, Vanilla 63, Angular fewer, larger components                                               | Per panel                      | Keep native. Panel-by-panel owners; the generic contracts are the ribbon command, shared checkbox and select where they apply.     |
| Compatibility toasts and collaboration status indicator      | All five bindings (the indicator is slotted into the status bar)                                                                     | Yes                            | Keep native; toast stacking and relay retry are host-owned. Follow-up.                                                             |
| Notes toolbar and notes panel buttons                        | React, Vue, Angular; Svelte and Vanilla inline                                                                                       | Yes, with divergent behaviour  | **Migrated in #395**: `pptx-ui-notes-toolbar`; see the Notes toolbar section below. The collapse header and editor stay native.    |

### Status bar (first batch)

`pptx-ui-status-bar` is one controlled shared view for the bottom row: the
"Slide n of m" counter, the language label, the save indicator, the Notes toggle,
the Normal, Slide Sorter and Slide Show buttons, and the zoom cluster (zoom out,
a percent readout that fits to window, zoom in). Hosts supply a
`StatusBarViewState` (translated through the host translator) and route one typed
`status-request` intent per activation to their native handlers. Notes expansion,
view switching, presentation, the slide sorter and zoom stay native in each
binding. A collaboration indicator is slotted through the named `collaboration`
slot. `resolveStatusBarSave` is the one save-indicator rule (autosave state, then
the dirty flag) and `statusBarViewMode` maps a viewer mode to the pressed button.
The property and event contract is in `packages/shared/src/web-components/README.md`.

Why this is not a ribbon command: the bar is one row with live readouts, a
slotted indicator and clusters whose visibility depends on three host actions
(`zoom`, `notes` and `fullscreen` in `hiddenActions`). Per-button ribbon commands
would leave the gating and layout duplicated five times.

Behaviour changed so all five bindings now agree:

- The Notes, Normal, Slide Sorter and Slide Show buttons expose `aria-pressed` in
  every binding. React, Vue and Angular previously had no pressed state, and
  Vanilla had it only on Notes.
- The percent readout is named "Zoom to fit" for assistive technology in all
  five. React, Vue and Angular exposed only a tooltip, so the visible `100%` was
  the accessible name.
- The save text uses one shared rule, including "Saved just now / n minutes ago".
  Svelte never showed the saved text, and Vanilla still shows its pushed label.
- React reads the viewer mode for Normal and Slide Show; Svelte and Angular also
  press Slide Sorter while the overlay is open. Vanilla does not track the sorter
  overlay (unchanged).
- Buttons are at least 24px square and grow to 44px on coarse pointers; the row
  keeps the shared 29px minimum height. Forced colors use system colors.
- React's zoom out and zoom in buttons were individually optional; they now show
  whenever the zoom cluster shows, and a missing callback is a no-op. The viewer
  always supplies all three.
- Up to 767px the element hides the language and save text. React, Vue and Angular
  omit the whole bar on phones, and Svelte and Vanilla hide the host with CSS;
  those remain host-owned and unchanged.

`e2e/status-bar-migration.spec.ts` covers the counter, names, pressed state, the
zoom effect on the stage, keyboard activation, the slide sorter, panel
customization, touch targets, theme tokens and forced colors on all five
bindings. `chrome-shell-parity.spec.ts` now measures the bar through its shadow
root. Adapter unit tests cover state mapping, intent routing, gating, slot
projection and callback replacement for each binding.

Not migrated, and to be split into owned follow-up issues before #386 closes:
read-only banner, paste options toolbar, dialog footers with a shared dialog
shell, context menus, presentation toolbars and compatibility toasts. This is why
the issue stays open.

## Control primitives and tokens (#342)

The original observations (doubled search border, uneven File navigation, native
select popups, mismatched checkbox accents) were fixed per surface in #346 to
#349. This pass makes that result structural: one shared primitive per control
kind, all reading one set of design tokens, with a cross-binding check that fails
when any surface drifts.

Tokens live in `packages/shared/src/web-components/control-tokens.ts` and are
read through `tok(name)`, which emits `var(--pptx-..., <default>)`. Defaults
resolve where they are used, so viewer-root themes still reach them. Any token
can be overridden by the host or a theme.

| Group      | Tokens                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Field      | `--pptx-field-border`, `-border-focus`, `-bg`, `-fg`, `-placeholder`, `-radius`, `-height` (28px), `-height-lg` (40px), `-padding-x` |
| Focus ring | `--pptx-focus-ring-color`, `-width` (2px), `-offset` (2px)                                                                           |
| Density    | `--pptx-space-1..4` (4, 8, 12, 16px), `--pptx-row-height` (28px), `--pptx-row-height-nav` (40px), `--pptx-touch-target` (44px)       |
| Checkbox   | `--pptx-checkbox-size` (16px), `-size-touch` (22px), `-radius`, `-border`, `-bg`, `-accent` (the theme primary), `-accent-fg`        |

| Kind     | Primitive          | Where native stays                                                                                                                                                                                                                                                                                      |
| -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search   | `pptx-ui-search`   | None. Title bar (28px) and File recent files (40px) are the two variants of one field.                                                                                                                                                                                                                  |
| Select   | `pptx-ui-select`   | Options, the Properties inspector and the ribbon use the app-owned listbox. Secondary dialogs (Print, Custom Shows, Hyperlink, Document Properties, Show Slides, Date/Time field, the animation timeline) keep a native `<select>` with the OS popup; only the closed control follows the field tokens. |
| Checkbox | `pptx-ui-checkbox` | Native `input[type=checkbox]` and radios remain in dialogs and panels; they take the same accent, size and focus ring from the host stylesheet, scoped to viewer chrome and dialogs.                                                                                                                    |

`pptx-ui-select` is a combobox/listbox with a popup placed against the trigger,
arrow, Home, End, typeahead, Enter, Space, Escape and Tab behaviour,
`aria-activedescendant`, 44px triggers on coarse pointers and forced-colors
styles. Escape while its popup is open closes only the popup: modal dialogs
(Svelte, Angular) used to close with it, which `activateModalFocus` now avoids.

Drift the new checks found and fixed: Vanilla's title-bar search was 24px with
a different background (every other binding is 28px) and, with Vanilla's File
search, showed no placeholder because the primitive had no `placeholder`
property; the Angular Options checkbox and the Angular, Svelte and Vanilla
Options panes sized their checkboxes 15px instead of 16px.

Evidence: `/assets/ui-migration/primitives-before/` and
`/assets/ui-migration/primitives-after/`, named `<binding>-titlebar`,
`-file-menu`, `-options` and `-inspector`. The unit checks are
`control-primitives.test.ts` (token coverage, search, checkbox and select
states) and `modal-focus.test.ts`; the browser contract is
`e2e/ui-primitives-consistency.spec.ts`, run in all five bindings alongside the
existing `search-field-focus`, `backstage-nav-spacing` and `web-controls` specs.

Still open: converting the secondary-dialog native selects to `pptx-ui-select`
needs per-binding adapters (about 35 sites) and is tracked with the remaining
dialog-body work; the dialog footers, menus, toasts, banners and toolbars belong
to #386.

## Notes toolbar (#395)

`pptx-ui-notes-toolbar` is one controlled shared view for the speaker-notes
formatting row: Bold, Italic, Underline, Strikethrough, Bullet list, Numbered
list, Increase indent, Decrease indent, Insert link, Print notes and the
Rich/Plain editor switch. It owns the buttons, their order, icons, labels,
enabled state, toolbar semantics with roving focus, touch targets, forced
colors and the hyperlink popover. Hosts keep the contenteditable editor, the
paragraph and inline edit commands, history and persistence, printing and the
collapse header, and route one typed `notes-request` intent per activation.
The property and event contract is in
`packages/shared/src/web-components/README.md`.

### Recorded differences before the change

| Area                | React                                                                               | Vue                                          | Angular                                  | Svelte                                         | Vanilla                                            |
| ------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Label keys          | `pptx.notes.*`                                                                      | `pptx.notesToolbar.*`                        | `pptx.notes.*`                           | Mixed `pptx.notes.*` and `pptx.notesToolbar.*` | `pptx.notes.*`                                     |
| Order               | Indent, Outdent                                                                     | Indent, Outdent                              | Indent, Outdent                          | Outdent, Indent                                | Indent, Outdent                                    |
| Plain mode          | Formatting buttons stay and do nothing                                              | Same                                         | Same                                     | All formatting buttons hidden                  | Formatting buttons stay and act on a hidden editor |
| Mode switch label   | "Plain editor" / "Rich editor"                                                      | "Plain" / "Rich"                             | "Plain editor" / "Rich editor"           | "Plain" / "Rich"                               | "Plain editor" / "Rich editor" with `aria-pressed` |
| Print gating        | Only when the host passes all slides                                                | Always                                       | Always                                   | Always                                         | Always                                             |
| Print route         | `NotesPrintDialog`                                                                  | Hidden iframe                                | Hidden iframe                            | Hidden iframe                                  | Hidden iframe                                      |
| Toolbar gating      | `canEdit`                                                                           | Panel only mounts when the host can edit     | Same as Vue                              | Hidden unless an `onupdate` handler exists     | Hidden unless `editable`                           |
| Link UI             | In-toolbar popover                                                                  | In-toolbar popover (own key set)             | In-toolbar popover (own key set)         | Two `window.prompt` calls                      | Two `window.prompt` calls                          |
| Icons               | Lucide components                                                                   | Lucide components                            | Inline SVG                               | Lucide components                              | Text glyphs                                        |
| Toolbar semantics   | Plain `div`                                                                         | Plain `div`                                  | `role="toolbar"`, no roving focus        | `aria-label` without a role                    | Plain `div`                                        |
| Touch targets       | About 24px                                                                          | About 24px                                   | About 24px                               | 24px                                           | 24px                                               |
| Default surface     | Rich only when the slide has notes; the choice was reset on every slide change      | Rich on desktop, plain on mobile; kept       | Same as Vue                              | Same as Vue                                    | Same as Vue                                        |
| Collapse and resize | Header button, `panelHeight` and a swipe-down mobile sheet                          | Header button with chevron, `MobileSheet`    | Header button with chevron, mobile sheet | Header button without chevron                  | Header button with a text chevron                  |
| Editor integration  | React state plus an effect that re-seeds the editor; paragraph edits use hook state | Shared `notes-editor` helpers, DOM re-seeded | Same as Vue                              | Same as Vue                                    | Same, but paragraph edits used the last blur state |

### Canonical set and decisions

- One key set, `pptx.notes.*` (Increase indent, Decrease indent, Bullet list,
  Plain editor, Rich editor, Insert link, Print notes) plus the existing
  `pptx.notesToolbar.ariaLabel` for the toolbar name and `pptx.common.cancel`.
  The Vue-only `pptx.notesToolbar.*` button keys are no longer read.
- One order: character formats, lists, Increase indent then Decrease indent,
  link, print, then the editor switch at the end of the row. Svelte followed the
  other order and now matches the other four.
- Formatting follows the editor: in the plain editor the formatting buttons and
  the link button are disabled, not hidden (Svelte used to hide them) and no
  longer silently inert. Print and the editor switch stay enabled. With no slide
  every button is disabled. The row is hidden when the host cannot edit.
- Print is shown whenever a slide exists. React keeps its all-slides dialog for
  the Print action; the other four keep printing the active slide through a
  hidden iframe, so the intent is the same but the output is not.
- The editor switch names the editor it switches to ("Plain editor" while rich
  is active). It is a plain button with no `aria-pressed`, so Vanilla's pressed
  state is gone.
- The link popover moves into the element, so Svelte and Vanilla stop using
  `window.prompt`. It is a non-modal dialog that places itself above the row (or
  below when there is no room), focuses the URL, keeps the selected text as the
  display text, refuses an empty URL, closes on Escape, Cancel or an outside
  press and returns focus to the Insert link button. Submitting restores the
  editor selection and emits one `link` intent with a normalised URL.
- Buttons prevent the default on `mousedown` so the editor selection survives a
  pointer press. Hosts focus the editor before running a command so the keyboard
  path works too.
- React's default surface is rich on desktop like the other bindings, and the
  choice is no longer reset by changing slide. Vanilla's list and indent
  commands read the live editor first, so text typed since the last blur is no
  longer lost.
- Rich formatting now persists in every binding. Vue and Angular committed the
  plain text only, so bold, lists and indents were lost on the next slide change
  and on save; they now commit the text with its segments in one history entry
  (Angular adds a `notesCommit` output next to `update`), flush on blur so a slide
  change cannot take the edit with it, and a plain edit or a cleared note drops
  the stale segments. React no longer keeps the previous slide's draft when you
  return to a slide whose notes equal the last text it saved.
- Icons are one inline SVG set. The row is a `role="toolbar"` with a single tab
  stop; Left, Right, Home and End move between enabled buttons, and those keys
  do not reach the slide shortcuts. Targets are 28px, 44px on coarse pointers,
  and forced colors use system colors.

Not changed on purpose: the collapse header, `panelHeight` and the mobile sheet
(React), the contenteditable editor and its history, the print dialog and iframe
routes, and the per-binding mobile placement. Each binding keeps its public
props, callbacks and test classes (`.pptx-vue-notes-toolbar`,
`.pptxv-notes-toolbar`, `.pptx-svelte-notes-toolbar`, `#slide-notes-content`).

| Binding | Before                                                          | After                                                         |
| ------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| React   | [Before](/assets/ui-migration/notes-toolbar/react-before.png)   | [After](/assets/ui-migration/notes-toolbar/react-after.png)   |
| Vue     | [Before](/assets/ui-migration/notes-toolbar/vue-before.png)     | [After](/assets/ui-migration/notes-toolbar/vue-after.png)     |
| Angular | [Before](/assets/ui-migration/notes-toolbar/angular-before.png) | [After](/assets/ui-migration/notes-toolbar/angular-after.png) |
| Svelte  | [Before](/assets/ui-migration/notes-toolbar/svelte-before.png)  | [After](/assets/ui-migration/notes-toolbar/svelte-after.png)  |
| Vanilla | [Before](/assets/ui-migration/notes-toolbar/vanilla-before.png) | [After](/assets/ui-migration/notes-toolbar/vanilla-after.png) |

`e2e/notes-toolbar-migration.spec.ts` covers the button order and names, real
Bold, bullet and indent edits that survive a slide change, the link popover with
no `window.prompt`, Escape and empty-URL handling, roving focus, the disabled
plain mode, Print, theme tokens, forced colors and 44px touch targets on all
five bindings; `mobile-notes.spec.ts` checks the default plain surface and its
touch targets. Adapter unit tests cover state mapping, intent routing, gating and
callback replacement in each binding.

## Slide rail, section and sorter actions (#397)

The rail itself (thumbnail rendering, virtualisation, drag state) stays native.
What was decided is which actions the rail, a section header and a sorter tile
expose, because the audit found a different product behind each in every
binding. Evidence recorded before the change:

- **Rail persistent row.** React, Svelte and Vanilla: an "Add Slide" footer.
  Vue: the footer on flat decks only (none on sectioned decks), and
  `SlidesPaneControls.vue` (Add, Duplicate, Delete) existed but was never
  mounted. Angular: the footer plus a hover toolbar on every thumbnail
  (Duplicate, Delete, Move up, Move down) and no drag reorder.
- **Section header.** React: a popup menu (`pptx.sections.*`) with inline rename.
  Vue: hover buttons (`pptx.sectionList.*`), a "+ Add section" button per group
  and inline rename. Angular, Svelte, Vanilla: hover buttons and a
  `window.prompt` rename.
- **Sorter tile menu.** React: Copy, Paste (with a clipboard), Duplicate, Hide
  and Show, Delete, with a count suffix. Vue, Angular, Svelte: Duplicate,
  Hide/Show, Delete (`pptx.slideMenu.*`). Vanilla: no menu, inline Duplicate,
  Hide/Show and Delete buttons per card.
- **Thumbnail menu on a sectioned rail.** Present in React, Angular, Svelte and
  Vanilla; absent in Vue (its section list had no right-click menu and no
  multi-select).

### Decision

PowerPoint is the reference: its slide pane has no per-thumbnail buttons and no
button strip, and its section header and sorter are right-click menus. So:

- **Rail.** One persistent action, **Add Slide** (`pptx.sections.addSlide`), in
  a pinned footer, in flat and sectioned decks. Everything else on a slide is on
  the thumbnail right-click menu (already shared in `slide-pane-context-menu.ts`)
  and the keyboard (Enter inserts after, Delete). Reordering is drag and drop in
  all five bindings (Angular gained it; its per-thumbnail Move up/down buttons
  are gone). Vue's sectioned rail gains the footer, the thumbnail menu and
  Ctrl/Shift multi-select, and the unmounted `SlidesPaneControls.vue` is deleted.
- **Section header.** A `role="menu"` popup on right-click or the keyboard
  context-menu key with Rename, Delete, Move Up, Move Down and Add Section After
  (React's list, which matches PowerPoint). Move Up is disabled on the first
  section and Move Down on the last. Rename is an inline text field in the header
  (Enter or blur commits a non-empty name, Escape cancels) in every binding; no
  binding opens `window.prompt`. Add Section After starts the new section at the
  slide following the section's last slide, clamped to the last slide. The hover
  buttons, Vue's per-group "+ Add section" button and the `pptx.sectionList.*`
  keys are no longer used by the rail; the label keys are `pptx.sections.*`
  everywhere.
- **Sorter tile.** A `role="menu"` popup on right-click with Copy, Paste (only
  after a Copy), Duplicate, Hide or Show, Delete. Hide and Show are one toggle
  entry like the rail menu (Show only when every selected slide is hidden);
  Delete is disabled when it would remove every slide; a multi-selection appends
  " (n)" to Copy, Duplicate, Hide/Show and Delete. The keys are
  `pptx.slideSorter.contextMenu.*`. Vanilla's inline per-card buttons are
  removed. Copy and Paste also answer Ctrl+C and Ctrl+V (the shared sorter
  keymap).

Shared logic lives in `pptx-viewer-shared`: `buildSectionContextMenuEntries` and
`sectionAddAfterSlideIndex` (`section-context-menu.ts`),
`buildSlideSorterContextMenuEntries`, `slideSorterContextMenuLabel`,
`slideSorterPasteIndexes` and `SLIDE_RAIL_FOOTER_ACTIONS`
(`slide-sorter-context-menu.ts`). Each binding renders the entries natively
(React and Vue reuse their menu components, Angular has
`pptx-section-context-menu`, Svelte `SectionContextMenu.svelte` and
`SlideSorterContextMenu.svelte`, Vanilla `section-context-menu.ts` and
`slide-sorter-context-menu.ts`); the menus join the shared context-menu element
when that lands.

Known limits, deliberately not changed here: only React's sorter has
multi-selection, zoom and a slide clipboard of more than one slide, so in the
other four bindings the sorter menu acts on one slide, and Paste (React's
long-standing behaviour, ported) inserts a copy after each copied slide rather
than at the pointer. Section colours, collapse and drag state stay native.

`e2e/slide-rail-menus-parity.spec.ts` drives all five bindings through the Add
Slide footer (flat and sectioned), the section menu (commands, role, no inline
buttons), inline rename without a prompt, Move Up/Down gating and reordering, and
the sorter menu (commands, Copy then Paste, Hide then Show).

## Inspector reset and clear actions (#398)

The inspector panels stay native (each commits through its own editor and
history API). What the audit found was a parity gap in six actions, recorded by
translation key before the change: Reset Picture (`image.resetImage`) was
missing its label and gating contract in Svelte (hard-coded English) and was
gated three different ways elsewhere; Reset Crop was missing in Svelte and
Vanilla; Reset trim in Angular, Svelte and Vanilla; Clear series colour in
Svelte and Vanilla; Clear Background in the Svelte and Vanilla inspectors (both
had it only on the Format Background ribbon dock).

`pptx-viewer-shared` now owns the contract in `inspector-reset-actions.ts`: the
label keys, the gating (`imageResetState`, `cropResetState`,
`mediaTrimResetState`, `seriesColorClearState`, `slideBackgroundClearState`) and
the exact patch each action applies (`imageResetPatch`, `cropResetPatch`,
`mediaTrimResetPatch`, `slideBackgroundClearPatch`). Canonical behaviour, which
changed some bindings:

- **Reset Picture** is shown for a picture and enabled only while the host can
  edit and an effect or a crop-to-shape override exists. It clears
  `imageEffects` and `cropShape` and keeps the crop (PowerPoint keeps it; Reset
  Crop owns that). Vue, Angular, Svelte and Vanilla used to clear the crop too;
  Vue hid the button until dirty and React never disabled it.
- **Reset Crop** is shown for a picture, enabled when editable and the picture
  is not `noCrop` locked, and zeroes the four insets. Added to Svelte and
  Vanilla.
- **Reset trim** is shown only for editable media that carries a trim. Added to
  Angular, Svelte and Vanilla.
- **Clear series colour** is shown per series only while editable and the series
  has its own colour. Added to Svelte and Vanilla (which has one series
  selector, so one button for the selected series). Every binding now exposes
  the action by an accessible name (React, Vue and Angular had only a title or a
  glyph). In Vanilla only the colour control writes a series colour now;
  editing the trendline or error bars used to stamp the swatch colour onto the
  series.
- **Clear Background** is shown when the slide has a colour, picture, gradient
  or pattern, enabled when editable, and clears all four (React, Vue and
  Angular skipped the pattern). Svelte and Vanilla gain a Background card in the
  no-selection inspector with the colour and this action, and the Svelte ribbon
  dock's clear button now says "Clear Background" instead of "Default".
- Each action is one undo step.

The labels are the existing keys, already translated in German, Spanish, French
and Simplified Chinese; no new key was needed. Svelte's Replace and Reset
Picture labels now use `pptx.image.replaceImage` and `pptx.image.resetImage`.

`e2e/inspector-reset-actions.spec.ts` (fixture `inspector-reset-actions.pptx`)
checks the five actions, their gating and undo on all five bindings.

### Title bar and quick access (#394)

`pptx-ui-title-bar` is one controlled shared view for the top chrome row and the
optional below-the-ribbon strip. Hosts supply a `TitleBarViewState` (built with
`buildTitleBarState`) and route typed `toggle-autosave`, `save`, `undo`, `redo`,
`quick-command` and `command-search` events to their native handlers. The
collaboration indicator and account parts are host-owned and slotted through the
named `collaboration` and `account` slots. The property, event and keyboard contract
is in `packages/shared/src/web-components/README.md`.

What the five bindings did before, as audited in this change:

| Aspect                 | React                                                         | Vue                          | Angular                                                | Svelte                                                   | Vanilla                                                          |
| ---------------------- | ------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Layout and tokens      | Tailwind `TITLE_BAR_CLASSES`                                  | Tailwind `TITLE_BAR_CLASSES` | Tailwind `TITLE_BAR_CLASSES`                           | Scoped CSS from `titleBarStyleAttr`; name max 200px      | CSS-in-TS from `TITLE_BAR_METRICS`; name max 180px, search 320px |
| Buttons present        | Save only when `onSave` is passed; Undo, Redo, extras         | Same as React                | Save always; Undo, Redo, extras                        | Save always; hand-drawn Save, Undo, Redo glyphs          | Every configured id in configured order, so no fixed trio        |
| Extras and tooltips    | Bare label, ignores `showCommandLabels`                       | ScreenTip resolver           | ScreenTip resolver; spellCheck drawn as a search glyph | Bare label; unknown icon falls back to Play              | ScreenTip resolver; spellCheck had no glyph; Undo no action text |
| AutoSave switch        | Always enabled                                                | Always enabled               | Always enabled                                         | Always enabled; disabled-by-host status keys unreachable | Inert when the host forbids autosave (only binding)              |
| Search field gate      | `mode` is edit or master                                      | `mode` is edit or master     | Editable                                               | Editable                                                 | Editable                                                         |
| Search results         | Shared filter, cap 8, category, "find in slides" row          | Same as React                | Own component, same rows                               | Same as React, 120ms blur grace                          | Local three-item list; no category, cap or fallback row          |
| User and presence area | None                                                          | None                         | None                                                   | None                                                     | AI toggle appended straight into the row                         |
| Collaboration slot     | None (the indicator lives in the status bar)                  | None                         | None                                                   | None                                                     | None                                                             |
| Window controls        | None (the viewer embeds in a host page; hosts own the window) | None                         | None                                                   | None                                                     | None                                                             |
| Below the ribbon       | `TitleBarQuickExtras`                                         | `TitleBarQuickAccess`        | `QuickAccessStripComponent`                            | `QuickAccessToolbar.svelte`                              | Relocates the live strip node                                    |
| Second separator       | When the strip is on                                          | When the strip is on         | Always                                                 | When the strip is on                                     | Hidden while the strip is docked below                           |
| Narrow widths          | Hidden under 768px; no wrapping or overflow handling          | Same                         | Same                                                   | Also hidden on landscape phones                          | Also hidden on landscape phones                                  |

Decisions now shared by all five:

- One order: Save, Undo, Redo, then the configured extras in File > Options order.
- One tooltip rule: `aria-label` is the label, `title` is `screenTip(...)`, and Undo
  and Redo name the pending action when known. Extras honour `showCommandLabels`.
- One gating table: AutoSave, strip, status and search show only while editing (edit
  or master mode with an editable deck). `showSave`, `showUndo` and `showRedo` hide
  single buttons. The second separator appears only when the strip has buttons.
- One icon set for every catalog command, including spellCheck, drawn from the
  shared trusted paths.
- One search dropdown: shared filter, at most eight rows, a category column, and a
  "Find in Slides" row where the host can search content. Arrow keys move through the
  results.
- The strip is a named toolbar with roving focus. Buttons are 44px on touch, and
  forced colors use system colors. The row hides under 768px in every binding.

Behaviour that changed:

- React and Vue previously showed the search box in any edit-mode view; it now needs
  an editable deck, as in the other three.
- The AutoSave switch is inert (disabled, with the "disabled by host" tooltip) in all five
  bindings when the host forbids autosave; before, only Vanilla did this.
- Vanilla now always shows Save, Undo and Redo first; a configured list that omitted
  them no longer hides them, which matches the other four. Its search box is now the
  shared one, lists the shared command catalogue, runs every id through the ribbon's own
  surfaces (SmartArt, Equation, Browse Themes and Slide Size open the matching ribbon
  control) and offers the "Find in Slides" row, which toggles the Find & Replace panel.
- The AI toggle is slotted into the `account` slot, and Vanilla's search box now shows
  its placeholder (it assigned a property the field never read, so it rendered empty).
- Hiding the `quickAccessToolbar` panel now removes Save, Undo and Redo too in React;
  before, only the extras were hidden there.

All five bindings now pass the pending Undo and Redo action to the tooltip (Vue, Svelte
and Vanilla gained the plumbing; no editing action in any binding records a label yet, so
today every tooltip reads plain "Undo" and "Redo"). Svelte also passes the autosave
disabled reason, so a host `autosave: false` or a missing file path shows the same status
text everywhere. `review.language` has no action in any binding.

`e2e/title-bar-migration.spec.ts` covers the names, order, AutoSave switch, roving
focus and tab order, search results, panel customization, narrow widths, theme
tokens, touch targets and forced colors on all five bindings.
`chrome-shell-parity.spec.ts` now measures the bar through its shadow root and compares
the command-search rows across bindings. Adapter
unit tests cover state mapping, event routing, gating, slots and the below-ribbon
placement for each binding. Before and after screenshots are in
`docs/public/assets/ui-migration/title-bar-before` and `title-bar-after`.
