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

| Area                                                                         | State                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<pptx-three-view>` host, one shared WebGL context, sizing, fallback, events | Done, unit tested (`three-view/*.test.ts`)                                                                                                                                                                                                                                                                                                                                     |
| All five bindings on the element                                             | Done, per-binding `three-view` tests; verified in every demo with the charts deck                                                                                                                                                                                                                                                                                              |
| Export snapshot (foreignObject path) + shadow-DOM-aware chart part lookup    | Done (`three-view/export-snapshot.ts`, `render/chart-event-target.ts`); the snapshot now also carries the view's DOM overlay (chart title, legend, axes, labels), which the clone used to drop                                                                                                                                                                                 |
| Export via the html2canvas-pro raster path (PNG/GIF/video)                   | Done: html2canvas-pro already cloned the open shadow root, so 3D views exported; every binding now runs the shared `prepareHtml2CanvasClone` (`export/html2canvas-clone.ts`: settle, snapshot, drop editor-only nodes, colour/CSS passes). `e2e/three-d-chart-export.spec.ts` checks both raster paths in all five                                                             |
| Oblique bar3D scene (every grouping, direction and `c:shape`)                | Done on PowerPoint's box model (slides 1-9): world-space layout, gridlines in WebGL, front-edge labels, cylinder/cone/pyramid (and `...ToMax`) meshes shaded per normal, hover tooltip, click-to-select, drag-to-value. Slide 1 lands within 3pt of PowerPoint; slide 4 (standard) is about 12% taller; round shapes sit ~3px right                                            |
| Perspective line3D / area3D (`rAngAx=0`)                                     | Done on PowerPoint's fitted camera (slides 10-13): pitched camera at 0.92 x rotX, distance framing the box diagonal in the `c:perspective` field of view, box one category slot deep per row, slabs and ribbons 0.4 of a row; gridlines in WebGL, labels in SVG, hover/select/drag. Corners within ~12pt; slide 11's box is taller than PowerPoint's (fixed 0.36 height ratio) |
| Every other 3D chart (pie, surface; bar3D without right-angle axes)          | Rendered by the pre-element perspective scenes, now hosted on the shared renderer (`chart-3d-hosted-stage.ts`) with their interaction intact. Same look as before: NOT PowerPoint parity yet                                                                                                                                                                                   |
| Auto chart title (`c:title` without text)                                    | Done for every chart family (`chart-auto-title.ts`); the title band is sized from the title font (`chart-title-band.ts`)                                                                                                                                                                                                                                                       |
| Core: SmartArt `scene3d`/`sp3d`/text 3D + quick-style whole-diagram camera   | Parsed and tested against the ground-truth deck                                                                                                                                                                                                                                                                                                                                |
| Core: writing those fields back after a SmartArt drawing edit                | Done for text and style edits (`smartart-fabrication-3d.ts`, round-trip test on the ground-truth deck). Structural edits (add/remove/reorder a node) rebuild shapes without the quick style's 3D and still lose it                                                                                                                                                             |
| SmartArt scene: flat styles (Simple Fill .. Intense)                         | Done, near pixel parity on all 8 layouts, built from the cached drawing                                                                                                                                                                                                                                                                                                        |
| SmartArt scene: bevel and scene styles                                       | Not done: rendered flat as a stopgap                                                                                                                                                                                                                                                                                                                                           |
| SmartArt inline node editing over the scene                                  | React, Vue, Angular. Svelte and Vanilla never had it on the 3D path (pre-existing gap)                                                                                                                                                                                                                                                                                         |
| e2e                                                                          | `e2e/three-d-charts-smoke.spec.ts` walks all 17 charts in every binding: each view reaches `ready`, paints, and the page keeps one shared WebGL context (no eviction warning, no context loss)                                                                                                                                                                                 |

## Next steps

In priority order:

1. Charts: every slide of the charts deck is on PowerPoint's model. Open
   deviations: slide 4 (standard) and slide 11 (area) are taller than
   PowerPoint's, the surface wireframe's lower layers are approximate, and a
   pie's exploded cut faces render darker. The hosted perspective scenes now
   serve only bar3D without right-angle axes and line/area with them.
2. SmartArt: bevel styles (reuse `visual-3d-bevel-lighting*.ts`,
   `visual-3d-materials.ts`), then scene styles (camera from
   `quickStyle.scene3d` via `visual-3d-camera*.ts`). Working rule: shape has
   `scene3d` -> bevel path; only `shape3d` -> scene path; neither -> flat.
3. Core: carry the quick style's 3D onto SmartArt shapes regenerated by a
   structural edit.
