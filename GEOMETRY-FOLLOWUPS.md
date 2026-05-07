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
