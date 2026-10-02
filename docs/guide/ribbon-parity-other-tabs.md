# Ribbon parity with PowerPoint: Transitions, Animations, Slide Show, Record, Review, View and contextual tabs

This page records an audit of the ribbon against Microsoft PowerPoint (Microsoft 365,
current look) and what changed. It covers the Transitions, Animations, Slide Show,
Record, Review and View tabs and the contextual tabs (Picture Format, Shape Format,
Table Design, Chart Design, SmartArt Design). Home, Insert, Draw and Design are covered
by a separate change.

## Method

- Reference: PowerPoint was driven through COM and UI Automation on a throwaway
  presentation (one slide holding a shape, a table, a chart, a SmartArt graphic and a
  picture). Each tab was captured from the real window at a 1400 px logical width. Nothing
  was saved and PowerPoint was closed afterwards.
- Viewer: every binding was captured at 1400 x 800 on the sample decks the e2e suite uses.
  Screenshots live in `docs/public/assets/ribbon-parity/<tab>/` as
  `powerpoint.png`, `viewer-before-<binding>.png` and `viewer-after-<binding>.png`.
  All five bindings render these tabs through shared elements, so one fix lands in
  React, Vue, Angular, Svelte and Vanilla together; the screenshots are kept for every
  binding to prove it.
- The viewer keeps its dark theme and compact density (see `DESIGN.md`); the comparison is
  about structure, grouping, button size, icon placement and affordances, not palette.

Severity: **High** changes how the tab is used or what a user expects to find, **Medium**
is a clear visual or structural mismatch, **Low** is polish.

## Transitions

Evidence: `transitions/` (`powerpoint.png`, `viewer-before-react.png`, `viewer-after-react.png`,
`viewer-after-vanilla.png` and the other bindings).

| Gap | Severity | Status |
| --- | --- | --- |
| Gallery was nine text pills wrapped over two rows, PowerPoint shows one row of icon-over-label thumbnails | High | Fixed: one row of 58 px tiles with a motion thumbnail, selected tile outlined, chevron pages the strip |
| Effect Options was an unlabelled "Inspector" button at the far right | Medium | Fixed: a large "Effect Options" command with the drop-down chevron at the end of the Transition to This Slide group (still opens the Inspector, same `.inspector` hook) |
| Apply To All sat beside Sound and Duration instead of under them | Medium | Fixed: Sound, Duration and Apply To All form one three-row stack |
| Duration spinner only appeared on hover | Low | Fixed: spinner always visible |
| Preview was a small button, PowerPoint draws a large one | Low | Fixed: large command |
| Only nine transitions (PowerPoint lists about fifty) | Medium | Not fixed: the engine renders these nine in the quick strip; the Inspector Type select lists the full catalogue. Adding thumbnails for effects the playback layer cannot yet draw would misreport support |
| Sound field has no speaker glyph, Duration has no clock glyph | Low | Not fixed: cosmetic only, the labels already say Sound and Duration |

## Animations

Evidence: `animations/`.

| Gap | Severity | Status |
| --- | --- | --- |
| Effects were three captioned text columns inside a bordered box with a vertical scrollbar | High | Fixed: one row of icon-over-label tiles (entrance green, emphasis amber, exit red, motion path blue), a rule between families, chevron pages the strip, no scrollbar |
| Effect Options was in the Advanced group, PowerPoint puts it beside the gallery | Medium | Fixed: large command with chevron, id unchanged |
| Advanced Animation stacked Effect Options + Panel and Trigger + Painter in two 2-row columns | Medium | Fixed: Animation Pane, Trigger (chevron) and Animation Painter in one three-row stack, Add Animation (chevron) and Path Animation large |
| No Delay field and no Reorder Animation (Move Earlier / Later) | Medium | Not fixed: the viewer authors per-effect timing in the Animation Panel and has no ribbon-level reorder command; a disabled placeholder would add noise. Start and Duration stay as the existing honest disabled fields |
| Motion Paths is a second gallery, PowerPoint folds paths into the main gallery's expander | Low | Not fixed: kept as a separate gallery (ids and tests depend on it); it now uses the same tile look |
| No live preview of an effect on hover | Medium | Not fixed: needs a playback preview path outside the UI layer |

## Slide Show

Evidence: `slideshow/`.

| Gap | Severity | Status |
| --- | --- | --- |
| Custom show lived in the Present group, PowerPoint puts "Custom Slide Show" in Start Slide Show | Medium | Fixed: moved (its id already said `startSlideShow`), renamed "Custom Slide Show", drop-down chevron |
| "Using timings, if present" | Low | Fixed: now "Use Timings" |
| Option checkboxes sit in their own "Options" group, PowerPoint places them inside Set Up | Low | Not fixed: the options row is a separate shared element with its own customization group id; merging would rename a public group id |
| Monitors group (Monitor select, Use Presenter View checkbox) is missing; Presenter View is a large button in a "Present" group | Medium | Not fixed: the viewer has no multi-monitor model. Presenter View keeps its button |
| Broadcast and Rehearse with Coach appear although PowerPoint 365 no longer shows them | Low | Kept: Broadcast is a working feature; Coach is a disabled, honestly labelled placeholder |

## Record

Evidence: `record/`.

| Gap | Severity | Status |
| --- | --- | --- |
| Every command was a small icon-beside-label row, PowerPoint uses large buttons | High | Fixed in all five bindings (they each forced `compact`) |
| Group names "Camera" and "Manage" | Low | Fixed: "Cameo" and "Edit" |
| No chevron on Cameo, Clear Recording, Reset to Cameo | Low | Fixed |
| Preview, Screen Recording, Audio, Save as Show, Export to Video are missing | Medium | Not fixed: the viewer records through the existing rehearsal flow only; unbacked disabled buttons were not added |

## Review

Evidence: `review/`.

| Gap | Severity | Status |
| --- | --- | --- |
| Comments group: one large button next to a 2 x 2 grid of small ones | High | Fixed: New Comment, Delete, Previous, Next and Show Comments are all large, in PowerPoint's order |
| "Comments" label on the new-comment button | Medium | Fixed: "New Comment" (new locale key in all four dictionaries) |
| No chevrons on Check Accessibility, Language, Show Comments, Hide Ink | Medium | Fixed: shared set of menu commands draws the chevron |
| Activity group (Mark All as Read, Show Changes) is named Changes and holds Compare | Low | Kept: the viewer's Compare is a real feature, the name is existing customization vocabulary |
| Protect group (Always Open Read-Only, Restrict Permission) is not in PowerPoint's Review tab | Low | Kept as disabled, honestly labelled placeholders |
| OneNote Linked Notes group is missing | Low | Not fixed: no OneNote integration |

## View

Evidence: `view/`.

| Gap | Severity | Status |
| --- | --- | --- |
| Show group was a six-row column of controls, the tab was about 50 percent taller than every other tab | High | Fixed: three columns of three rows |
| Color/Grayscale group (Color, Grayscale, Black and White) | Medium | Not fixed: the renderer has no grayscale mode; adding buttons would claim a view it cannot show |
| Window group (New Window, Arrange All, Cascade, Move Split, Switch Windows) | Low | Not applicable to an embeddable web component |
| Macros shares the Window group, PowerPoint gives it its own group | Low | Not fixed: would change a public group id |
| Notes and Ruler/Gridlines/Guides labels differ ("Rulers", "Grid") | Low | Not fixed: these strings are shared with other UI and localized |

## Contextual tabs

Evidence: `shape-format/`, `picture-format/`, `table-design/`, `chart-design/`, `smartart-design/`
(the `powerpoint.png` files also show Table Layout, Chart Format and SmartArt Format in
`table-layout/`, `chart-format/` and `smartart-format/`).

| Gap | Severity | Status |
| --- | --- | --- |
| Drop-down galleries (Corrections, Color, Artistic Effects) were bordered pills in a row | Medium | Fixed: flat commands, several in a row stack in one column (the group measures its children, so every binding inherits it) |
| Inline galleries had a detached chevron button | Low | Fixed: strip and chevron form one framed gallery |
| SmartArt Design only had Change Colors and SmartArt Styles (reported by users as "can't change SmartArt colouring etc.") | High | Fixed: Create Graphic (Add Shape, Add Bullet work through the core node edits and undo; Promote, Demote, Move Up, Move Down, Text Pane and Right to Left are present but disabled with a tooltip: they need a selected node or engine support), a Layouts gallery (the 14 families the Inspector's switcher offers, same `switchSmartArtLayout`), Change Colors and SmartArt Styles, and Reset (Reset Graphic works: default colours and style; Convert is disabled, it needs slide-level element replacement) |
| SmartArt Format tab (Shapes, Shape Styles, WordArt Styles, Arrange, Size) | High | Not fixed: styling individual SmartArt nodes needs per-node formatting that the model does not expose; the whole-graphic galleries stay on SmartArt Design |
| The SmartArt tab does not switch itself on selection | Low | Kept: PowerPoint shows the coloured tab header without switching, and so does the viewer |
| Each tab only carries its galleries; PowerPoint also has Insert Shapes, Arrange, Size, Alt Text, Adjust / Shape Fill / Outline / Text commands | High | Not fixed: these are commands, not galleries. They need per-binding action plumbing (z-order, align, group, size, crop) through the host toolbar props; the Home tab owns the equivalents today. Tracked as the main remaining gap |
| Table Layout, Chart Format, SmartArt Format and Video/Audio Format tabs do not exist | High | Not fixed for the same reason: they are made of editing commands (insert row, merge, distribute, chart element formatting) that have no ribbon wiring yet |
| Gallery strips show six tiles, PowerPoint shows seven to ten | Low | Not fixed: `INLINE_GALLERY_TILE_COUNT` is part of the tested gallery contract |
| Contextual tabs are not highlighted with the red accent PowerPoint uses | Low | Not fixed: tab strip styling belongs to the shared ribbon chrome |

## Cross-cutting changes

- `pptx-ui-ribbon-command` accepts a `caret` attribute and draws the drop-down chevron after
  the last label line; a shared set (`RIBBON_MENU_COMMAND_IDS`) turns it on for the menu
  commands of Slide Show, Record and Review without per-binding wiring.
- `pptx-ui-ribbon-group` marks itself `data-stack` when its children are all small drop-down
  galleries or commands and lays them out in columns of three.
- `pptx-ui-ribbon-gallery` can draw a one-button command (`descriptor.command`): no panel,
  large or small, with a tooltip that says why it is disabled. SmartArt Create Graphic and
  Reset use it, so no binding needed a new component.
- Large buttons are now the default for Record in every binding.

## Not covered (needs a product decision)

Hover, pressed and disabled states, tooltips, focus rings and the narrow-width collapse
were compared and already behave like PowerPoint's (flat hover fill, accent-tinted pressed
state, dimmed disabled state, native `title` tooltips, 2 px focus ring). The collapse into
overflow is the viewer's own mobile sheet and is out of scope here.

## Tests

- `e2e/ribbon-parity-other-tabs.spec.ts` (runs on every binding project) asserts group
  names and order, large versus small commands, tile structure, the View Show grid and
  each contextual tab's appearance and groups for its object type.
- Unit tests: `ribbon-animations.test.ts`, `ribbon-transitions.test.ts` and the
  control-name tests were updated for the new structure and strings.

## Prioritised next steps (everything marked "Not fixed" above)

1. Contextual command groups (High): Insert Shapes, Arrange (Bring Forward, Send Backward,
   Selection Pane, Align, Group, Rotate), Size (Height, Width, Crop) and Alt Text on Shape
   Format and Picture Format. Reuse the one-button command entry that
   `pptx-ui-ribbon-gallery` now supports (`descriptor.command`) or the Home arrange strips;
   the per-binding work is wiring the existing z-order and size actions into the gallery
   context.
2. Table Layout, Chart Format, SmartArt Format and Video/Audio Format tabs (High): add them
   to `RIBBON_CONTEXTUAL_TABS` and `CONTEXTUAL_TAB_GROUPS` once their commands exist (insert
   row/column, merge, distribute for tables; chart element formatting; per-node SmartArt
   formatting).
3. SmartArt nodes (Medium): a ribbon-level selected-node concept would enable Promote,
   Demote, Move Up, Move Down and Text Pane, which are disabled with a tooltip today.
   Convert and Right to Left need engine support.
4. Transitions and Animations breadth (Medium): more transition thumbnails once playback
   supports them, Delay and Reorder Animation, hover preview.
5. Slide Show and Record (Medium): Monitors group, Screen Recording, Audio, Export, Preview
   once the viewer has a model for them.
6. View (Medium): Color/Grayscale needs a grayscale render mode.
7. Low polish: Gallery strip tile count (`INLINE_GALLERY_TILE_COUNT`), accent on the
   contextual tab header, merging the Slide Show options into the Set Up group.

## Gotchas for the next session

- Shared edits need `bun run build` in `packages/shared`, `bun run inline-shared` in
  `packages/angular` and `bun run --filter pptx-angular-viewer build` (plus locales) before
  Playwright, or the dist-freshness guard aborts the run.
- Binding unit tests that look for text pills or captions in the Animations gallery now use
  `button.preset` and the column `aria-label`.
- The vanilla `PptxViewer.test.ts` can crash a worker with an out-of-memory error under load;
  rerun it alone with `NODE_OPTIONS=--max-old-space-size=6144`.
