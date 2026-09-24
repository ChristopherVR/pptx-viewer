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
- `chartType: 'surface'` covers both `c:surfaceChart` and `c:surface3DChart`;
  treat it as 3D iff `chartData.view3D` is present (not yet verified against a
  2D top-view surface fixture).
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

Work in progress on the local integration branch `three-d-parity` (not pushed,
not on `main`). As of 2026-09-24:

| Area                                                                               | State                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `<pptx-three-view>` host, one shared WebGL context, sizing, fallback, events       | Done, unit tested (`three-view/*.test.ts`)                                                                                                |
| Export snapshot (foreignObject path) + shadow-DOM-aware chart part lookup          | Done (`three-view/export-snapshot.ts`, `render/chart-event-target.ts`)                                                                    |
| Export via the html2canvas-pro raster path (PNG/GIF/video)                         | Not verified; likely needs `snapshotThreeViewsIntoClone` too                                                                              |
| Core: SmartArt `scene3d`/`sp3d`/text 3D + quick-style whole-diagram camera         | Parsed and tested against the ground-truth deck                                                                                           |
| Core: writing those fields back after a SmartArt drawing edit                      | Missing: an edited 3D-styled SmartArt loses them on save (unedited decks round-trip untouched)                                            |
| SmartArt scene: flat styles (Simple Fill .. Intense)                               | Done, near pixel parity on all 8 layouts, built from the cached drawing                                                                   |
| SmartArt scene: bevel styles (Polished, Inset, Cartoon, Powder)                    | Not done: rendered flat as a stopgap                                                                                                      |
| SmartArt scene: scene styles (Brick, Flat, Metallic, Sunset, Bird's Eye)           | Not done: rendered flat as a stopgap (no whole-diagram camera yet)                                                                        |
| Chart spec + projection + shading maths + SVG chrome overlay                       | Done for bar3D box shapes, clustered / stacked / percentStacked                                                                           |
| Chart scene, slide 1 (3-D clustered column)                                        | Mounts; two open issues: the chart title is missing from the overlay, and box placement against the chrome still needs checking on screen |
| Chart scene, other 16 slides                                                       | Not done: standard grouping, horizontal bars, round shapes, and the whole perspective family (line, area, pie, surface)                   |
| Chart interaction (hover, select, drag, `setSelectedPart`, orbit) in the new scene | Not wired yet                                                                                                                             |
| React binding on `<pptx-three-view>`                                               | Done (-2.7k lines; per-kind wrappers deleted, one flags context)                                                                          |
| Vue, Angular, Svelte, Vanilla bindings                                             | Not migrated: still on the legacy per-kind scenes                                                                                         |
| e2e retargeting + 17-chart WebGL-context smoke spec                                | Not done                                                                                                                                  |

The legacy scene modules (`mountBarChart3D`, `mountPieChart3D`, ..., the
`pptx-viewer-shared/smartart-3d` subpath) stay until the four remaining
bindings are migrated; delete them then.

## Next steps

In priority order. Rule 1 applies: the branch must not merge to `main` until
all five bindings are on the element.

1. Charts, slide 1: root-cause the missing title (write a vitest against the
   real fixture bytes; check `vm.title` for this deck) and verify box placement
   with `?onion=1`. Add a unit test for the oblique shear matrix.
2. Charts: lift the `standard` / horizontal / round-shape gates (slides 2-9),
   then build the perspective family (slides 10-17: floor/wall grid, ribbons
   for line, slabs for area, pie tilt/explosion, surface bands). The
   perspective family needs the plot rect, which `ChartViewModel` does not
   expose yet (derive it from `vm.gridlines`, or thread `PlotLayout` through).
3. Charts: wire interaction through the existing pure helpers
   (`chart-3d-interaction.ts`, `chart-3d-pointer-interaction.ts`,
   `*-hit-test.ts`) and `ctx.emit`.
4. SmartArt: bevel styles (reuse `visual-3d-bevel-lighting*.ts`,
   `visual-3d-materials.ts`), then scene styles (camera from
   `quickStyle.scene3d` via `visual-3d-camera*.ts`). Working rule: shape has
   `scene3d` -> bevel path; only `shape3d` -> scene path; neither -> flat.
5. Migrate Vue, Svelte, Vanilla, Angular to the element (React is the
   reference: `ThreeView.tsx`, `use-chart-3d-view.ts`, `SmartArt3DView.tsx`,
   `rendering-3d-flags-context.ts`). Decide the `interactive` policy for all
   five: React now uses `canEdit` for both charts and SmartArt.
6. Retarget the 3D e2e specs to `pptx-three-view`, add the 17-chart smoke
   spec, verify the raster export path, then delete the legacy scenes.
7. Core: serialise SmartArt `scene3d`/`shape3d`/`text3d` in the fabrication
   writer.
