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
