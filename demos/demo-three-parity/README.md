# 3D parity harness and programme status

`bun run demo:three-parity` (port 4178) shows every slide of a PowerPoint
ground-truth deck next to our `<pptx-three-view>` rendering of it, on a
CSS-scaled slide stage (so zoom-aware sizing is exercised too).

Query params: `deck=charts|smartart`, `only=1,5,9`, `onion=1` (50% ground-truth
overlay for pixel comparison), `w=900` (cell width), `interactive=1` (orbit /
select). Pass `--port` to `npx vite` to run several copies side by side.

## Ground truth

`e2e/fixtures/three-d-parity/`:

- `three-d-charts.pptx`: 17 slides, one PowerPoint-default 3D chart each
  (3-D clustered/stacked/100%/standard column, clustered/stacked bar,
  cylinder/cone/pyramid, line, area x3, pie, exploded pie, surface,
  wireframe surface). Manifest `three-d-charts.tsv`.
- `three-d-smartart.pptx`: 112 slides, 8 layouts (Basic Block List, Basic
  Process, Basic Cycle, Organization Chart, Basic Pyramid, Basic Venn, Basic
  Chevron Process, Basic Radial) x all 14 quick styles. Slide `n` = layout
  `floor((n-1)/14)`, style `((n-1)%14)+1`.
- `gt/*.webp`: PowerPoint's own COM slide export at 960x540 (all chart slides;
  SmartArt styles 1, 6, 7, 8, 10, 12, 13, 14 per layout).

Regenerate with `scripts/make-three-d-parity-charts.ps1` /
`scripts/make-three-d-parity-smartart.ps1` (needs local PowerPoint + Excel).

## Architecture

- `packages/shared/src/three-view/`: `<pptx-three-view>` custom element
  (the pattern of PR #352, shared web components). It owns lazy `three`
  loading, zoom-aware sizing, visibility, disposal, a slotted 2D fallback and
  select/drag/state events. A single page-wide `WebGLRenderer`
  (`renderer-host.ts`) draws every view on demand and copies the pixels to
  each view's own 2D canvas. Before this, every chart/SmartArt (slide and
  thumbnail) had its own WebGL context, so decks with more than ~16 of them
  blanked the main slide.
- Scene modules plug in through `scene-registry.ts`:
  `render/chart-3d-view-scene.ts` (charts) and `smartart-3d/view-scene.ts`
  (SmartArt). They take `three` from the mount context and never import it at
  runtime: shared is bundled with `splitting: false`, so anything reachable
  from the main barrel ends up in `dist/index.mjs`
  (`three-view/no-runtime-three-import.test.ts` guards this).
- Spec builders every binding calls: `buildChart3DSpecForElement(element)`,
  `buildSmartArt3DSpecForElement(element, { spatial? })`.

## Findings that drive the design

- PowerPoint 3D charts keep their title, legend, axes and data labels; only
  walls, gridlines and marks are 3D. The new chart view draws the chrome as SVG
  in the element's overlay (`render/chart-view-model-dom.ts`, extracted from
  the vanilla binding) and the marks in WebGL.
- `c:view3D/@rAngAx="1"` (every bar3D variant) is an oblique projection: the
  plot is a real `W x H x D` box whose front plane is drawn flat and whose
  depth shears up-right by `(sin rotY, sin rotX)`. A bar's depth equals its
  width; each depth row is `barWidth * (1 + gapDepth/100)` deep. The value
  axis has no headroom, labels sit off the box's FRONT edges, and gridlines
  run on the back wall plus the side wall (columns) or floor (horizontal
  bars). The box size and position are calibrated against `gt/chart-01..06`
  (`render/chart-3d-oblique-layout.ts`). `rAngAx="0"` (line, area, pie,
  surface) is a real perspective box with
  floor/wall gridlines. Pie defaults are rotX 30 / rotY 0, everything else
  15 / 20.
- Core used to fold `c:grouping val="standard"` into `clustered`; it now keeps
  `groupingStandard` so the layout (and a save round-trip) can tell them apart.
- Face shading is flat in chart space, measured on accent1: front 1.0x, top
  0.75x, right side 0.64x (`render/chart-3d-shading.ts`). One quadratic form
  in the surface normal, `cx nx^2 + cy ny^2 + cz nz^2`, reproduces that table
  and, with per-shape coefficients, PowerPoint's cylinder, cone and pyramid
  shading; round surfaces are shaded relative to the oblique view direction.
  A round shape is inscribed in the box bar's footprint, a pyramid fills it.
- 3-D Line is a flat ribbon per series, 3-D Area a solid slab, clustered bars
  sit side by side on one depth plane, standard puts each series on its own row.
- `chartType: 'surface'` covers both `c:surfaceChart` (PowerPoint draws a
  flat top view) and `c:surface3DChart`. The published `surfaceChart3D`
  opt-in has always meant every surface chart, so both get the 3D scene;
  showing a 2D surface as PowerPoint does would need its own flag.
- SmartArt scene-style cameras: the preset homographies fit a rotation plus
  a camera distance almost exactly, and that distance is absolute (a whole
  diagram foreshortens far more than a 2in shape under the same preset).
  The light rig is fixed to the diagram, not the camera: a face keeps its
  colour however far it is turned, times a per-rig tint (`morning` and
  `soft` darken it, measured in linear light).
- SmartArt quick styles: flat styles carry no shape 3D; bevel styles
  (Polished, Inset, Cartoon, Powder) put `a:scene3d` (orthographicFront) +
  `a:sp3d` bevels on each drawing shape; scene styles (Brick, Flat, Metallic,
  Sunset, Bird's Eye) keep ONE whole-diagram camera in the quick style part
  (`dgm:styleDef/dgm:scene3d`) and only `sp3d` on the shapes. Core now parses
  both (`PptxSmartArtDrawingShape.scene3d|shape3d|text3d`,
  `PptxSmartArtQuickStyle.scene3d`).
- The old "spatial" SmartArt arrangements (cycle carousel, receding
  hierarchy) are not something PowerPoint draws; they are opt-in only.

## Status

All five bindings (React, Vue, Angular, Svelte, Vanilla) render 3D charts and
3D SmartArt through `<pptx-three-view>`; the per-kind WebGL wrappers, their
per-binding flag contexts/services and the old
`pptx-viewer-shared/smartart-3d` scene runtime are gone. Each binding has one
thin wrapper (`ThreeView.tsx`, `ThreeView.ts`, `three-view.component.ts`,
`ThreeView.svelte`, `render/elements/three-view.ts`), one flags carrier, and
routes a 3D mark's select/drag through the shared `applyChart3DSelect` /
`applyChart3DDrag` onto the same selection and commit path as its 2D marks.
The scene is interactive only while the chart is selected and editable, the
same gate that arms the 2D marks.

| Area                                                                                              | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<pptx-three-view>` host, one shared WebGL context, sizing, fallback, events                      | Done, unit tested (`three-view/*.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| All five bindings on the element                                                                  | Done, per-binding `three-view` tests; verified in every demo with the charts deck                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Export snapshot (foreignObject path) + shadow-DOM-aware chart part lookup                         | Done (`three-view/export-snapshot.ts`, `render/chart-event-target.ts`); the snapshot now also carries the view's DOM overlay (chart title, legend, axes, labels), which the clone used to drop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Export via the html2canvas-pro raster path (PNG/GIF/video)                                        | Done: html2canvas-pro already cloned the open shadow root, so 3D views exported; every binding now runs the shared `prepareHtml2CanvasClone` (`export/html2canvas-clone.ts`: settle, snapshot, drop editor-only nodes, colour/CSS passes). `e2e/three-d-chart-export.spec.ts` checks both raster paths in all five                                                                                                                                                                                                                                                                                                                                                                                                   |
| Oblique bar3D scene (every grouping, direction and `c:shape`)                                     | Done on PowerPoint's box model (slides 1-9): world-space layout, gridlines in WebGL, front-edge labels, cylinder/cone/pyramid (and `...ToMax`) meshes shaded per normal, hover tooltip, click-to-select, drag-to-value. Slide 1 lands within 3pt of PowerPoint and slide 4 (standard) within 4pt; round shapes sit ~3px right                                                                                                                                                                                                                                                                                                                                                                                        |
| Perspective line3D / area3D (`rAngAx=0`)                                                          | Done on PowerPoint's fitted camera (slides 10-13): pitched camera at 0.92 x rotX, distance framing the box diagonal in the `c:perspective` field of view, box one category slot deep per row, slabs and ribbons 0.4 of a row; gridlines in WebGL, labels in SVG, hover/select/drag. Traced corners within ~6pt on slides 10-12 and 16 (box height follows depth, 0.208 x (width + depth), for multi-row boxes)                                                                                                                                                                                                                                                                                                       |
| Perspective surface3D (filled and wireframe)                                                      | Done on the same box (slides 16-17): value bands per major unit coloured from `c:bandFmts`, band legend, flat-shaded band triangles; the wireframe draws each band as its own clamped layer. The filled surface matches closely; the wireframe's lower layers are an approximation                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3-D Pie (plain and exploded)                                                                      | Done on the fitted camera (slides 14-15): pitch 0.91 x rotX, camera 1.38 box diagonals away, thickness 0.23 x radius, explosion shrinks the radius by 1 / (1 + explosion); rim shading fitted, white seams, hover/select/angular drag. About 3% wider than PowerPoint; cut faces lit by their own fitted rule                                                                                                                                                                                                                                                                                                                                                                                                        |
| bar3D without right-angle axes (columns)                                                          | On the perspective box (`chart-3d-persp-bars.ts`): clustered / stacked / 100% / standard, bar depth = bar width as with right-angle axes, hover/select/drag. No PowerPoint export of this setting in the deck, so unverified against ground truth; round `c:shape`s draw as boxes                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Every other 3D chart (horizontal bar3D without right-angle axes, line/area with right-angle axes) | Rendered by the pre-element perspective scenes, hosted on the shared renderer (`chart-3d-hosted-stage.ts`) with their interaction intact; not PowerPoint parity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Auto chart title (`c:title` without text)                                                         | Done for every chart family (`chart-auto-title.ts`); the title band is sized from the title font (`chart-title-band.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Core: SmartArt `scene3d`/`sp3d`/text 3D + quick-style whole-diagram camera                        | Parsed and tested against the ground-truth deck                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Core: writing those fields back after a SmartArt drawing edit                                     | Done for text and style edits (`smartart-fabrication-3d.ts`) and for structural edits (add/remove/reorder a node): regenerated shapes re-resolve the quick style's per-label `dgm:scene3d`/`dgm:sp3d`/`dgm:txPr` 3D by style label (`smartart-quick-style-3d.ts`), and the shared scene uses them before save too (`smartart-3d-regenerated-drawing.ts`). Round-trip tests on the ground-truth deck                                                                                                                                                                                                                                                                                                                  |
| SmartArt scene: flat styles (Simple Fill .. Intense)                                              | Done, near pixel parity, built from the cached drawing; framed to the diagram's own bounds (the old 6% margin shrank it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| SmartArt scene: bevel styles (Polished, Inset, Cartoon, Powder)                                   | Done: lit bevel solids per shape (`smartart-3d-solid-geometry.ts`, per-vertex shading `smartart-3d-lighting.ts`). Block List shape-region MAE vs gt 8-15 (0-255); edge highlight/shadow sides match, band widths and the Inset groove are approximate                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| SmartArt scene: scene styles (Brick, Flat, Metallic, Sunset, Bird's Eye)                          | Done: whole-diagram camera fitted from the COM homographies (`smartart-3d-scene-camera.ts`), extrusion, contour rims, rig face tints. Tilt/perspective match gt; Metallic's broad metal highlight is only partly reproduced (MAE 32); parts of a turned diagram that PowerPoint draws outside the element box are clipped                                                                                                                                                                                                                                                                                                                                                                                            |
| SmartArt flat path: Basic Pyramid tiers, Basic Venn transparency                                  | Done in core/shared, so 2D (all five bindings) and the 3D scene both get it. Core's `trapezoid` preset now follows ECMA-376 (top inset `ss * a / 100000`, `a` pinned to `50000 * w / ss`); it scaled the inset by the width, so the pyramid's `adj 95238` tiers came out as near-triangles. The drawing reader keeps a solid fill's `a:alpha` (`fillOpacity`), which the 2D SVG (`fill-opacity`), the label contrast, and the 3D flat and lit meshes use; a gradient whose stops share one alpha (Venn bevel styles) is transparent in 3D too. Harness MAE vs gt: slide 57 24.1 -> 5.5, 71 17.0 -> 2.9, 62-70 20-25 -> 7-10, 76/77/80 11-18 -> 8-12. `e2e/smartart-flat-parity.spec.ts` checks both in every binding |
| SmartArt inline node editing over the scene                                                       | React, Vue, Angular. Svelte and Vanilla never had it on the 3D path (pre-existing gap)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| e2e                                                                                               | `e2e/three-d-charts-smoke.spec.ts` walks all 17 charts in every binding: each view reaches `ready`, paints, and the page keeps one shared WebGL context (no eviction warning, no context loss)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Next steps

In priority order:

1. Charts: every slide of the charts deck is on PowerPoint's model, each
   traced corner within ~6pt. Open: the surface wireframe's lower layers are
   an approximation; horizontal bar3D without right-angle axes and line/area
   with them still use the hosted scenes (no ground truth in the deck for
   either).
2. SmartArt follow-ups: Metallic Scene's metal highlight (needs PowerPoint's
   multi-light rigs rather than one key + one specular light), label text
   extrusion (`text3d`, Bird's Eye), drawing a turned diagram past the element
   box, `fontRef` label colours (Metallic's black text; Basic Pyramid's labels,
   which PowerPoint draws black from the layout's `revTx` node while the cached
   drawing says `lt1`), and Cartoon's `clear` material (PowerPoint paints it
   almost white; we paint the plain 50% fill).
3. Core: a structurally regenerated SmartArt shape that presents no node
   (a layout's decorative / transition shape) takes the `node1` label's 3D;
   resolving its own `presStyleLbl` needs the layout interpreter to report it.
