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
- `c:view3D/@rAngAx="1"` (every bar3D variant) is an oblique projection: front
  faces are the plain 2D bar layout, extruded along a fixed depth vector.
  `rAngAx="0"` (line, area, pie, surface) is a real perspective box with
  floor/wall gridlines. Pie defaults are rotX 30 / rotY 0, everything else
  15 / 20.
- Face shading is flat in chart space, measured on accent1: front 1.0x, top
  0.75x, right side 0.64x (`render/chart-3d-shading.ts`).
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

| Area                                                                                | State                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<pptx-three-view>` host, one shared WebGL context, sizing, fallback, events        | Done, unit tested (`three-view/*.test.ts`)                                                                                                                                                   |
| All five bindings on the element                                                    | Done, per-binding `three-view` tests; verified in every demo with the charts deck                                                                                                            |
| Export snapshot (foreignObject path) + shadow-DOM-aware chart part lookup           | Done (`three-view/export-snapshot.ts`, `render/chart-event-target.ts`)                                                                                                                       |
| Export via the html2canvas-pro raster path (PNG/GIF/video)                          | Not verified; likely needs `snapshotThreeViewsIntoClone` too                                                                                                                                 |
| Oblique bar3D scene (clustered / stacked / percentStacked box columns)              | Done: boxes on the 2D layout, SVG chrome overlay, hover tooltip, click-to-select, drag-to-value (`chart-3d-oblique-interaction.ts`)                                                          |
| Every other 3D chart (standard / horizontal / round bars, line, area, pie, surface) | Rendered by the pre-element perspective scenes, now hosted on the shared renderer (`chart-3d-hosted-stage.ts`) with their interaction intact. Same look as before: NOT PowerPoint parity yet |
| Auto chart title (`c:title` without text)                                           | Done for every chart family (`chart-auto-title.ts`); the 2D title band is fixed at 20px, so an 18pt title is clipped at the top in 2D and 3D alike                                           |
| Core: SmartArt `scene3d`/`sp3d`/text 3D + quick-style whole-diagram camera          | Parsed and tested against the ground-truth deck                                                                                                                                              |
| Core: writing those fields back after a SmartArt drawing edit                       | Missing: an edited 3D-styled SmartArt loses them on save (unedited decks round-trip untouched)                                                                                               |
| SmartArt scene: flat styles (Simple Fill .. Intense)                                | Done, near pixel parity on all 8 layouts, built from the cached drawing                                                                                                                      |
| SmartArt scene: bevel and scene styles                                              | Not done: rendered flat as a stopgap                                                                                                                                                         |
| SmartArt inline node editing over the scene                                         | React, Vue, Angular. Svelte and Vanilla never had it on the 3D path (pre-existing gap)                                                                                                       |
| e2e                                                                                 | Existing 3D specs locate the canvas through Playwright's shadow-piercing selectors; no 17-chart smoke spec yet                                                                               |

## Next steps

In priority order:

1. Charts: move each perspective chart onto PowerPoint's own model (the
   oblique scene covers slides 1-3): `standard` rows and horizontal bars
   (slides 4-6), round shapes (7-9), then line ribbons, area slabs, pie tilt /
   explosion and surface bands (10-17). The perspective family needs the plot
   rect, which `ChartViewModel` does not expose yet (derive it from
   `vm.gridlines`, or thread `PlotLayout` through). Replace the matching
   `perspective` scene as each lands.
2. 2D chart title layout: size the title band from the title font instead of
   a fixed 20px.
3. SmartArt: bevel styles (reuse `visual-3d-bevel-lighting*.ts`,
   `visual-3d-materials.ts`), then scene styles (camera from
   `quickStyle.scene3d` via `visual-3d-camera*.ts`). Working rule: shape has
   `scene3d` -> bevel path; only `shape3d` -> scene path; neither -> flat.
4. Add the 17-chart WebGL-context smoke spec and verify the html2canvas
   raster export path.
5. Core: serialise SmartArt `scene3d`/`shape3d`/`text3d` in the fabrication
   writer.
