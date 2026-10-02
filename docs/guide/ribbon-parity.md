# Ribbon parity: Home, Insert, Draw and Design

This page records an audit of the Home, Insert, Draw and Design tabs against Microsoft PowerPoint
(Microsoft 365, Windows, 144 DPI, window 1440 CSS px wide) and what was changed. It does not claim
pixel parity: icons, tooltips and several galleries still differ, and the gap table says which.

Evidence lives in `/assets/ribbon-parity/<tab>/`:

- `powerpoint.png`: PowerPoint, captured from a throwaway presentation (nothing saved).
- `viewer-before-<binding>.png` and `viewer-after-<binding>.png`: all five bindings at 1440 px.
- `viewer-after-narrow-<binding>.png`: 1000 px, groups collapsed (React, Vue).

| Tab    | PowerPoint                                       | Before (React)                                            | After (React)                                            |
| ------ | ------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| Home   | ![](/assets/ribbon-parity/home/powerpoint.png)   | ![](/assets/ribbon-parity/home/viewer-before-react.png)   | ![](/assets/ribbon-parity/home/viewer-after-react.png)   |
| Insert | ![](/assets/ribbon-parity/insert/powerpoint.png) | ![](/assets/ribbon-parity/insert/viewer-before-react.png) | ![](/assets/ribbon-parity/insert/viewer-after-react.png) |
| Draw   | ![](/assets/ribbon-parity/draw/powerpoint.png)   | ![](/assets/ribbon-parity/draw/viewer-before-react.png)   | ![](/assets/ribbon-parity/draw/viewer-after-react.png)   |
| Design | ![](/assets/ribbon-parity/design/powerpoint.png) | ![](/assets/ribbon-parity/design/viewer-before-react.png) | ![](/assets/ribbon-parity/design/viewer-after-react.png) |

## How the fixes are shared

Everything visual is one change reaching all five bindings, because every binding already emits the same
`data-ribbon-group`, `data-ribbon-control` and `data-pptx-chrome` hooks:

- `packages/shared/src/render/editor-chrome/` (`controls-css`, `home-layout-css`, `font-picker-css`,
  `cluster-css`, `ribbon-collapse-css`): flat Office buttons, small rows (22-24px) and large tiles (66px),
  two-row Font and Paragraph via `order` plus a zero-height line break, stacked Editing and Drawing
  columns, group shells that stretch the ribbon with an inset hairline and an 11px caption. The ribbon
  content row is 92px (was 82px).
- `ribbon-group` (shared element): hairline separator, 11px caption, optional launcher, collapsed face.
  `ribbon-command`: 32px glyph over a caption, `dropdown` chevron, `tall` icon-only tiles (Draw).
- Home families (`ribbon-home-families.ts`): `large` and `stack` flags and visible captions.
- Insert view: large commands, Shapes and Chart as gallery menus, SmartArt before Chart.
- `attachRibbonOverflow(content, { launchers })` (`ribbon-overflow.ts`, `ribbon-launchers.ts`): see below.

Binding edits are small: one Font group (family and size moved into the Font group), caption and row hooks,
Drawing before Editing, the overflow hookup (React ref callback, Vue function ref, Angular
`[pptxRibbonOverflow]`, Svelte `use:ribbonOverflow`, Vanilla per pane) and the Design commands no longer
`compact`.

### Narrow windows

Below the width a tab needs, groups collapse right to left into one button (glyph, caption, chevron) whose
commands open in a popup (Escape, outside press and a plain command close it; controls with their own menu
keep it open). Only `home.*`, `insert.*`, `draw.*` and `design.*` groups collapse (`COLLAPSING_GROUPS` in
`ribbon-overflow.ts`); the other tabs still scroll. The mobile layout (under 768px) is unchanged.

### Dialog launchers

Font, Paragraph and Drawing show the corner launcher glyph. The viewer has no modal Font or Paragraph
dialogs, so each opens the Properties pane and says so in its tooltip. Clipboard has no equivalent pane.

## Gap table

Severity: H = obvious at a glance, M = noticeable, L = detail.

### Home

| Gap vs PowerPoint                                                               | Sev | Status      | Notes / next step                                                                                                                                                         |
| ------------------------------------------------------------------------------- | --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single 28px row of icon buttons on muted pills; ribbon 82px                     | H   | Fixed       | Flat buttons, hover/pressed/focus states, 92px row                                                                                                                        |
| Paste small and icon-only                                                       | H   | Fixed       | Large Paste (no caret: Paste has no menu here)                                                                                                                            |
| Cut, Copy, Format Painter icon-only in a strip                                  | H   | Fixed       | Labelled three-row stack                                                                                                                                                  |
| New Slide small split; Layout, Reset, Section small                             | H   | Fixed       | Large tiles; New Slide has the Office split (glyph over a menu strip)                                                                                                     |
| Font split into two groups with two captions                                    | H   | Fixed       | One group: family, size, grow, shrink, clear above B I U shadow strike spacing case highlight colour                                                                      |
| Font colour bar beside the glyph                                                | M   | Fixed       | Bar under the glyph                                                                                                                                                       |
| Paragraph one row                                                               | H   | Fixed       | Row 1 lists, indents, line spacing; row 2 alignment, direction, columns                                                                                                   |
| Paragraph: Text Direction, Align Text, Convert to SmartArt as a labelled column | M   | Not fixed   | Align Text and Convert to SmartArt do not exist; Text Direction is an icon in row 2                                                                                       |
| Editing before Drawing                                                          | M   | Fixed       | Drawing, then Editing (all five bindings)                                                                                                                                 |
| Find, Replace, Select icon-only in a row                                        | M   | Fixed       | Labelled stack (Select now has a caption in all bindings)                                                                                                                 |
| Drawing: inline Shapes gallery, scroll arrows, Quick Styles gallery             | H   | Not fixed   | Shapes and Quick Styles are large tiles that open menus. Needs an inline shape-tile strip with scroll and expand; reuse `ribbon-gallery` `mode=inline` with shape presets |
| Shape Fill, Outline, Effects as a stacked column with colour bar                | M   | Fixed       | Column of labelled rows; no colour bar under the glyph yet                                                                                                                |
| Group captions 9px, full-height separators                                      | M   | Fixed       | 11px captions, inset hairlines                                                                                                                                            |
| Dialog launchers                                                                | M   | Partly      | Font, Paragraph, Drawing open Properties; none for Clipboard (needs a clipboard pane)                                                                                     |
| Collapse to dropdowns when narrow, with Office priorities                       | H   | Partly      | Right-to-left collapse with popups. Office first shrinks large tiles to small ones and uses a per-group priority table                                                    |
| Arrange extras (align, flip, order, crop, merge) group                          | L   | Kept        | Viewer-specific, rightmost, collapses first                                                                                                                               |
| Rich ScreenTips (title, description, shortcut)                                  | M   | Not fixed   | Native `title` only; needs a shared ScreenTip component and copy                                                                                                          |
| Icon style (Fluent colour glyphs)                                               | M   | Not fixed   | Lucide outline glyphs with the accent colour; a style decision                                                                                                            |
| Light Office theme                                                              | L   | Not changed | Themes are the viewer's own presets                                                                                                                                       |

### Insert

| Gap vs PowerPoint                                                                                                                                | Sev | Status    | Notes / next step                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --------- | --------------------------------------------------------------------------------------------------- |
| Compact 24px rows                                                                                                                                | H   | Fixed     | Large 66px tiles, chevron under dropdown commands                                                   |
| Shape and Chart pickers were native selects beside a button                                                                                      | H   | Fixed     | Shapes (8-column glyph grid) and Chart (list) galleries; a pick stages then inserts, as Office does |
| Chart before SmartArt                                                                                                                            | L   | Fixed     | SmartArt, then Chart                                                                                |
| Missing groups: Slides (New Slide), Camera, Comments                                                                                             | M   | Not fixed | Cameo and Comment inserts do not exist; New Slide lives on Home                                     |
| Missing commands: Screenshot, Photo Album, Icons, 3D Models, Zoom, WordArt, Date and Time, Slide Number, Object, Symbol, Audio, Screen Recording | M   | Not fixed | No insert flows yet. Date/Time and Slide Number exist under the Field menu                          |
| Labels: Pictures (viewer: Image), Link (Hyperlink), Video and Audio (Media)                                                                      | L   | Not fixed | Translation keys in five locales; change together with the locales tests                            |
| Freeform: Shape and Curve stack (not in Office)                                                                                                  | L   | Kept      | Viewer-specific                                                                                     |

### Draw

| Gap vs PowerPoint                                                | Sev | Status    | Notes / next step                                                          |
| ---------------------------------------------------------------- | --- | --------- | -------------------------------------------------------------------------- |
| Tools were 28px icon buttons                                     | H   | Fixed     | Tall icon-only tiles with an active highlight                              |
| Colour and width controls cramped                                | M   | Fixed     | Colour swatch tile with chevron, width slider and presets beside the tools |
| Pen presets with colour tips, Add pen, Lasso                     | H   | Not fixed | Needs pen preset state and a lasso tool in the ink engine                  |
| Undo/Redo, Ruler, Ink to Shape/Math, Ink Replay, Ink Help groups | M   | Not fixed | Features absent                                                            |

### Design

| Gap vs PowerPoint                                               | Sev | Status    | Notes / next step                                                                                     |
| --------------------------------------------------------------- | --- | --------- | ----------------------------------------------------------------------------------------------------- |
| Compact commands                                                | H   | Fixed     | Large Browse Themes, Edit Theme, Slide Size, Format Background                                        |
| Variants Colors and Fonts as bordered pills in a row            | M   | Fixed     | Borderless small dropdowns stacked in a column                                                        |
| Inline theme gallery (thumbnails, scroll, more)                 | H   | Not fixed | Browse Themes opens a panel. Needs shared theme tiles; `ThemeGallery` data lives in the React binding |
| Variants gallery, Effects and Background Styles menus, Designer | M   | Not fixed | Features absent                                                                                       |

## Tests

- `e2e/ribbon-parity-home-insert.spec.ts` (all five bindings): group order and captions per tab, large and
  small command structure, two-row Font and Paragraph, 11px captions, Insert galleries, Draw tiles,
  Design stacking. Home runs at 1920px because the Home groups collapse below that.
- Unit: `ribbon-overflow.test.ts`, group, command and Home view tests in `packages/shared`, plus each
  binding's Insert and Font tests.
- Updated specs that encoded the old look: `editor-first-screen-parity`, `ribbon-compact-layout`,
  `ribbon-insert-migration`, `insert-chart-bar-category-labels`, `ribbon-home-migration` and
  `ribbon-control-effects` (viewport).

## Gotchas for the next pass

- The shared `ribbon-command` must not have instance fields named like its attributes (`label`): React 19
  assigns `element.label = ...` when the property exists and silently breaks the element.
- The viewer's baseline `button { min-height: 24px }` outranks 22px rows in Svelte; the Home rules repeat
  `[data-pptx-chrome]` on the content hook to win.
- React reads shared from `dist`, Angular from its built `dist` plus `inline-shared`: rebuild
  (`bun run --filter pptx-viewer-shared build`, `bun run --filter pptx-angular-viewer build`), then restart
  the Angular demo after clearing `demos/demo-angular/node_modules/.vite`.
- Collapse is opt-in per group id prefix; extend `COLLAPSING_GROUPS` when the other tabs get their pass, and
  update `ribbon-compact-layout` for Transitions.
