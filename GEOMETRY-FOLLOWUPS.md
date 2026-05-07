# Preset-shape geometry — outstanding work

Tracks remaining inaccuracies in `packages/core/src/core/geometry/preset-clip-paths-*.ts`
after the targeted accuracy pass that fixed action buttons, curved/circular arrows,
cloud, smileyFace, swooshArrow, wedgeEllipseCallout, flowChartConnector, and
flowChartMagneticTape.

Full ECMA-376-faithful evaluation of the 187-entry `ST_ShapeType` enumeration
(with adjustment values, guides and arrow paths) is a multi-week project and is
intentionally NOT in scope here. The items below are the realistic next steps.

## High-impact follow-ups

### 1. Action-button glyph overlays

The 14 `actionButton*` presets now render as rounded-rectangle bodies, but the
inner glyph (home, help, sound, movie, "back", arrow, etc.) is still missing.
These need a lightweight icon overlay in
`packages/react/src/viewer/components/elements/`, NOT another clip-path.
Without the glyph, every action button looks identical.

### 2. Line-callout leader lines

`callout1/2/3`, `borderCallout1/2/3`, `accentCallout1/2/3`, and the three
`accentBorderCallout*` variants all clip to a plain rectangle. Per ECMA-376
Section 20.1.10.56 this is the spec-correct _body_ geometry — the leader
line is part of the shape's outline path, not its fill geometry. To draw the
leader correctly we need an SVG-overlay leader that reads the callout's
adjustment values (`adj1`..`adj4`). Until that lands the callouts render as
silent rectangles with a missing pointer line.

### 3. Adjustable shape parameters

Many of the new polygon approximations are static — they don't honour
`avLst` adjustment values from the source PPTX. Adjusters that visibly
affect geometry on the cohort fixed here:

- `circularArrow` / `leftCircularArrow` / `leftRightCircularArrow` — start
  angle, sweep, head size, and band thickness are all `adj*` driven.
- `swooshArrow` — head/tail thickness adjuster.
- `curvedRightArrow` / `curvedLeftArrow` / `curvedUpArrow` /
  `curvedDownArrow` — radius/thickness adjusters.
- `wedgeEllipseCallout`, `cloudCallout` — pointer position adjuster.

The current static polygons render at the "default" adjustment value.

### 4. SVG `path()` for the cloud/cloudCallout

The current 32-segment polygon approximations of `cloud` and `cloudCallout`
look passable but lose definition at large render sizes. Modern browsers
(Chrome 109+, Safari 15.4+, Firefox 105+) support `clip-path: path('M…')`
with viewport-relative coordinates via `view-box(...)` (which still has
patchy support). When browser support is sufficient the cloud outline
should be migrated to a true Bezier path so the bumps stay smooth.

## Lower-priority polish

- `pieWedge` clip-path is approximate; the spec describes a 90° pie sector.
- `arc` is a polygon; could become a proper sliver curve via path().
- `donut` and `noSmoking` are full circles — the inner ring/diagonal stripe
  is currently rendered via shape outline, not as part of the clip path
  (this is fine for now but worth noting).
- `flowChartSummingJunction`, `flowChartOr` — the inner cross/lines are
  drawn from the outline, not the geometry. Out of scope for clip-paths.

## Categorical reminder

These ~30 shapes were the "worst offenders" in the audit. About 150
other entries in `PRESET_SHAPE_CLIP_PATHS` have hand-authored polygons and
look correct at default adjustment values. The remaining preset names
that the audit flagged as "passable but not perfect" are not enumerated
here because they no longer render as plain rectangles or generic
ellipses.

## Truly out-of-scope (multi-week projects)

### Spec-correct geometry evaluator

ECMA-376 ships canonical pathLst data + guide formulas for all 187
ST_ShapeType values via Microsoft's `presetShapeDefinitions.xml`. A full
parity implementation would:

1. Embed (or generate at build time) the 187-entry preset table with
   `avLst`, `gdLst`, `pathLst`, and connection sites.
2. Wire `shapeAdjustments` through `getShapeClipPath` so each shape
   evaluates its formulas with the actual adjusters from the source PPTX.
3. Emit the result as either a `polygon()` approximation or a
   `path()` clip-path (modern browsers only).
4. Update the 11+ shapes whose visual silhouette depends on the adjusters
   (`circularArrow*`, `swooshArrow`, `curved*Arrow`, `wedgeEllipseCallout`,
   `cloudCallout`, `pie`, `arc`, `donut`, `blockArc`, the wedge callouts).

The guide-formula evaluator already exists (`packages/core/src/core/geometry/guide-formula-eval.ts`,
17/17 ops) and the `shapeAdjustments` field is already typed on
`PptxShapeProperties`. The missing piece is the preset table + the
adjustment-aware clip-path API.

### Image-effects rendering in the React viewer

The SVG converter now applies `imageEffects` via an SVG `<filter>` chain
(`packages/core/src/converter/svg-image-effects.ts`). Bringing the same
support into the React viewer (`packages/react/src/viewer/components/elements/`)
requires either:

- Reusing the same SVG filter strings under a portal/`<defs>` block, or
- A separate Canvas2D / WebGL rendering path for the image element.

The data-layer parity is complete (all blip primitives parse and
round-trip), so this is a renderer-only project.

### Action-button glyph overlays

`actionButton*` shapes now render as rounded rectangles. The interior
glyph (home, help, sound, movie, back, info) needs a small icon overlay
in the React renderer. Not a clip-path problem.

### Line-callout leader lines

`callout1/2/3`, `borderCallout1/2/3`, `accentCallout1/2/3`,
`accentBorderCallout1/2/3` body geometry is correctly rectangular per
spec. The leader line is part of the shape's outline (drawn through
custom geometry pathLst with `stroke` segments and no `fill`). Renderer
needs to interpret the outline path to draw the leader.
