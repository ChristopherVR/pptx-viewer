# Preset-shape geometry — outstanding work

Tracks remaining inaccuracies in `packages/core/src/core/geometry/preset-clip-paths-*.ts`
after the targeted accuracy pass that fixed action buttons, curved/circular arrows,
cloud, smileyFace, swooshArrow, wedgeEllipseCallout, flowChartConnector, and
flowChartMagneticTape.

Full ECMA-376-faithful evaluation of the 187-entry `ST_ShapeType` enumeration
(with adjustment values, guides and arrow paths) is a multi-week project and is
intentionally NOT in scope here. The items below are the realistic next steps.

## High-impact follow-ups

### 1. Action-button glyph overlays — DONE (commit `ec0053d`)

The 14 `actionButton*` presets now render their inner glyph (home, help,
sound, movie, info, back/forward, beginning/end, return, document) via
`ActionButtonGlyphOverlay`. `actionButtonBlank` correctly renders no
glyph. The icon paths come from `ACTION_BUTTON_PRESETS` so the slide
renderer and toolbar's "Insert Action Button" picker stay in sync.

### 2. Line-callout leader lines — DONE

`vector-shape-renderer.tsx` already calls `getCalloutLeaderLineGeometry`
for callout1/2/3 + border + accent variants and draws the leader as
an SVG polyline overlay. Leader-line geometry (`callout-geometry.ts`)
honours the 2-4 adjustment-pair sets per shape complexity tier. The
GEOMETRY-FOLLOWUPS comment about "missing pointer line" predates that
implementation.

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

### Image-effects rendering — DONE in both renderers

- SVG converter: commit `db0c7cd` (`svg-image-effects.ts` builds SVG
  filter chain from `PptxImageEffects`).
- React viewer: commit `a41df2a` (`renderImageAlphaSvgFilter` plus
  filter-url append in `getImageEffectsFilter`).

Both renderers now translate alphaInv/Ceiling/Floor/Mod/Repl/BiLevel,
alphaModFix, biLevel, lum, hsl(sat,lum), tint, and clrRepl into SVG
`<filter>` primitives. CSS-expressible effects (brightness/contrast/
saturate/hueRotate/grayscale) keep their CSS-filter path.

### Action-button glyph overlays — DONE (commit `ec0053d`)

See "High-impact follow-ups #1" above.

### Line-callout leader lines — DONE

See "High-impact follow-ups #2" above.
