/**
 * Framework-agnostic rendering & editing helpers shared by the React, Vue, and
 * Angular `pptx-viewer` bindings. Pure TypeScript (no framework imports) — each
 * binding consumes one copy instead of duplicating it.
 *
 * - geometry:   `shape-geometry` (preset clip-path cascade over core).
 * - fills:      `fill-style` (image/gradient/pattern/solid → CSS).
 * - effects:    `visual-effects` (shadow/glow/reflection/DAG), `image-effects`.
 * - text:       `text-warp` (WordArt paths), `omml-to-mathml` (equations).
 * - charts:     `chart-helpers` (layout/palette/axis math), `chart-trendlines`
 *               (regression overlays).
 * - animation:  `animation-css` (preset → CSS keyframes).
 * - 3d:         `visual-3d` (scene3d/shape3d → CSS transform/shadow pieces).
 * - tables:     `table-style` (cell style + banding → CSS), `table-merge`
 *               (cell merge/split/selection rect math), `table-layout`
 *               (merge-aware row/column insert/delete over `PptxTableData`).
 * - editing:    `element-align` (align/distribute), `element-interaction`
 *               (drag/resize/rotate math).
 * - connectors: `connector-router` (orthogonal A* obstacle-avoiding routing +
 *               SVG path serialisation), `connector-reroute` (dynamic endpoint
 *               recalculation when connected shapes move + connection sites).
 */
export * from './shape-geometry';
export * from './fill-style';
// Stroke/dash normalisation, compound-line box-shadow + dasharray, element
// transform strings (flip/rotation/skew), and OOXML drawing-percent parsing.
export * from './element-style-transform';
// OOXML drawing-colour resolution: colour-choice parsing (srgb/scrgb/sys/scheme/
// hsl/preset), the 26 colour transforms via core, scheme inheritance, alpha.
export * from './drawing-color';
// Unicode script detection for font fallback (latin/eastAsia/complexScript/
// symbol classification + run segmentation + per-script font resolution).
export * from './unicode-script-detection';
export * from './visual-effects';
export * from './image-effects';
export * from './text-warp';
export * from './omml-to-mathml';
export * from './latex-to-omml';
export * from './chart-helpers';
export * from './chart-trendlines';
export * from './chart-axis';
export * from './chart-palette';
export * from './chart-datapoint-style';
export * from './chart-sparkline';
// Pure option lists + chart-type capability Sets for the chart inspector
// controls (type/grouping/legend/axis/data-label/trendline/error-bar/marker/
// gridline/combo selectors), shared by every binding's chart editor.
export * from './chart-editor-options';
// SVG-primitive chart engine. Its low-level helpers `ValueRange` / `PlotLayout`
// / `valueToY` / `formatAxisValue` / `computeValueRange` / `seriesColor` /
// `paletteColor` duplicate (with deliberately different signatures) the ones in
// `chart-helpers.ts`, so they are NOT re-exported through the barrel — import
// them from `chart-view-model` directly. The rest of the engine surface is
// safe to flatten here.
export {
	buildChartViewModel,
	buildFallbackViewModel,
	buildGridlinesAndLabels,
	buildZeroLine,
	buildCategoryLabels,
	buildLegend,
	computeStackedValueRange,
	computePlotLayout,
	computeBarRects,
	computeStackedBarRects,
	computeLinePoints,
	linePointsToSvgString,
	computePieSlicePath,
	computePieLayout,
	computePieSlices,
	computeScatterDots,
	computeBubbleRadius,
	radarAngle,
	computeRadarPoints,
	radarRingPoints,
	resolveChartKind,
	DEFAULT_PALETTE,
} from './chart-view-model';
export type {
	ChartViewModel,
	SvgRect,
	SvgPath,
	SvgPolyline,
	SvgCircle,
	SvgLine,
	SvgText,
	SvgPolygon,
	SvgAreaGradient,
	SvgPrimitive,
	LegendEntry,
	BarRect,
	LinePoint,
	PieSliceGeometry,
	ScatterDot,
	RadarPoint,
	SupportedChartKind,
	PlotLayoutOptions,
} from './chart-view-model';
// Enriched cartesian builder (log axis / display units / secondary value axis /
// percentStacked / overlays) + its value-axis gridline/label primitive builders.
export { buildCartesianViewModel } from './chart-cartesian';
export { buildPrimaryAxis, buildSecondaryAxis } from './chart-axis-render';
export { buildComboViewModel, buildStockViewModel } from './chart-combo-stock';
export { buildSurfaceViewModel, buildTreemapViewModel } from './chart-surface-treemap';
export {
	buildFunnelViewModel,
	buildSunburstViewModel,
	computeFunnelSegments,
	computeSunburstArcs,
} from './chart-funnel-sunburst';
export type { FunnelSegment, SunburstArc } from './chart-funnel-sunburst';
export {
	buildHistogramViewModel,
	buildBoxWhiskerViewModel,
	computeHistogramBars,
	computeBoxStats,
	computeBoxWhiskerGeometry,
} from './chart-distribution';
export type { HistogramBar, BoxStats, BoxWhiskerGeometry } from './chart-distribution';
export {
	buildWaterfallViewModel,
	buildRegionMapViewModel,
	resolveRegionCode,
	sequentialColorScale,
	normalizeValue,
} from './chart-waterfall-map';
export {
	computeTrendlinePrimitives,
	computeErrorBarPrimitives,
	computeAxisTitlePrimitives,
	computeDataTablePrimitives,
	computeLinearRegression,
	fitPolynomial,
	computeRSquared,
	DATA_TABLE_ROW_H,
	DATA_TABLE_HEADER_H,
	DATA_TABLE_KEY_W,
	DATA_TABLE_PADDING,
} from './chart-overlays';
export type { LinearFit } from './chart-overlays';
export * from './animation-css';
// Editor element-animation preset model — distinct from the native OOXML
// `p:timing` timeline below. `animation-authoring` holds the immutable
// slide-`animations[]` patch builders + value-only option catalogs for the
// authoring panel; `animation-playback` holds the pure click-group / reveal /
// pending-style maths that drives the editor preview. Both build on
// `animation-css` for the preset → CSS keyframe mapping. The stateful hooks /
// services / RAF loops stay in each binding.
export * from './animation-authoring';
export * from './animation-playback';
// Native-animation (OOXML `p:timing` tree) timeline engine — preset tables,
// keyframe definitions, colour interpolation, dynamic/static keyframe
// generation, sequencing, click-group timeline + stateful playback controller,
// and editor preview descriptors. Pure maths; the RAF playback loop, DOM style
// injection, audio playback, and file reading stay in each binding.
export * from './animation-timeline-types';
export * from './animation-presets';
export * from './animation-keyframes';
export * from './animation-color';
export * from './animation-timeline-helpers';
// Compound / simultaneous OOXML start+end condition evaluation (p:stCondLst /
// p:endCondLst OR-sets), consumed by the sequencer + timeline builder.
export * from './animation-advanced-triggers';
export * from './animation-timeline-text-build';
export * from './animation-effects';
export * from './animation-sequencer';
export * from './animation-timeline-builder';
export * from './animation-timeline-engine';
export * from './animation-preview';
// `visual-3d` is the public surface; it re-exports the symbols from its sibling
// modules (`visual-3d-camera`, `visual-3d-materials`, `visual-3d-extrusion`,
// `visual-3d-color`, `visual-3d-constants`), so they are NOT flattened here to
// avoid duplicate-export conflicts.
export * from './visual-3d';
export * from './table-style';
export * from './table-merge';
export * from './table-layout';
// Immutable single-cell text edit (`setCellText`) for inline cell editing,
// shared by every binding's table renderer.
export * from './table-cell-edit';
// Inline (on-canvas) SmartArt node text editing: node-text lookup, no-op commit
// detection, and overlay-editor rect projection. Pure; the text mutation itself
// stays in `pptx-viewer-core` (`updateSmartArtNodeText`).
export * from './smartart-inline-edit';
// Pure deep-clone builders for editor undo/redo (elements, slides, styles,
// chart/smartart data, history snapshots, raw XML). Each binding imports these.
export * from './clone';
// Element helpers: template-origin detection, inline-text eligibility, display
// labels, comment timestamp/marker positioning, connection-site geometry.
// (isConnectorOrLineElement stays per-binding: it needs the binding's
// shape-type classifier, not a core export.)
export * from './element';
export * from './element-align';
export * from './element-interaction';
// Element CSS-style builders: absolute container style (position/transform/
// opacity/z-index) + displayable image-source resolution, shared by every
// binding's element renderer. Each binding casts the neutral CSS map to its
// framework's style type.
export * from './element-style';
// Pure, immutable group/ungroup tree operations (union bbox, slide-absolute <->
// group-relative coordinate conversion) for the editor.
export * from './group-ops';
// Slide-background style cascade: resolved background fields -> CSS map
// (image -> gradient -> pattern -> solid colour precedence).
export * from './slide-background';
// Editor lifecycle foundation: `editor-insert` (pure factory functions that
// build new `PptxElement`s with `id: ''` for the caller to assign), `element-
// operations` (immutable array transforms: update/move/resize/delete/duplicate
// + z-order), and `editor-history` (generic `EditorHistory<T>` undo/redo
// command stack). Each binding wires these into its own editor state layer.
export * from './editor-insert';
export * from './element-operations';
export * from './editor-history';
// OLE download/open helpers: file-size formatting + browser-openable MIME check
// for the binding OLE renderers' download/open actions.
export * from './ole-actions';
// Editor snap geometry: snap-to-shape (siblings + guides → snap lines, React/Vue
// model), snap-to-box (closest-per-axis span guides, Angular model), grid
// snapping. Pure maths; the pointer/drag driver stays in each binding.
export * from './snap-guides';
// Ruler tick generation + constants (View ▸ Ruler). Pure; each binding renders.
export * from './ruler';
export * from './bullet-autonum';
export * from './bullet-list';
export * from './text-paragraphs';
export * from './text-advanced';
export * from './text-theme';
export * from './kinsoku-styles';
export * from './tab-leader';
export * from './inline-selection-utils';
export * from './linked-text-box-overflow';
export * from './connector-router';
export * from './connector-reroute';
export * from './connector-style';
// Connector SVG-geometry builder: from a connector `PptxElement`, derive stroke
// style, flip-adjusted endpoints, bent/curved path data (with optional A*
// obstacle routing), and arrow `<marker>` shapes. Re-uses `connectorKind` from
// `connector-style`. The `<svg>`/`<path>` emission stays in each binding.
export * from './connector-path';
export * from './format-painter';
export * from './remap-text';
export * from './shape-adjustment';
export * from './hyperlink-security';
// Real-time collaboration presence: pure validators + sanitisers for inbound
// Yjs awareness data (room id, username/colour/avatar, cursor clamping, stale
// drop), deterministic per-user colour, mixed-content (ws:// from https)
// detection, and the `RemoteCursor` projection. The stateful Yjs provider /
// awareness lifecycle stays in each binding.
export * from './collaboration-presence';
export * from './collaboration-sync';
export * from './slide-compare';
// Morph (PowerPoint Morph transition) — pure element-matching, SVG-path /
// colour interpolation, text tokenisation, and CSS keyframe generation. The
// DOM injection of the generated keyframes stays in each binding.
export * from './morph-types';
export * from './morph-color';
export * from './morph-svg-path';
export * from './morph-matching';
export * from './morph-text';
// Intelligent token-level text morph: LCS diff (shared/added/removed) + per-
// token slide/fade keyframe building, consumed by `morph-animation`.
export * from './morph-text-tokens';
// Shape-geometry morphing: resolve element outlines to polygons
// (`morph-geometry`), resample/align/interpolate them (`morph-geometry-interp`),
// and bake the outline tween into a `clip-path` keyframe animation
// (`morph-geometry-keyframes`) for shape-type changes between matched elements.
export * from './morph-geometry';
export * from './morph-geometry-interp';
export * from './morph-geometry-keyframes';
export * from './morph-animation';
// Slide-transition (slide-to-slide swap) CSS/keyframe generation — pure mapping
// from a `PptxSlideTransition` to the outgoing/incoming `animation` shorthands
// plus the `@keyframes` strings each binding injects once. Keyframe names use
// the `pptx-tr-*` family (distinct from element-animation `pptx-vue-*` and
// native-timeline `pptx-tl-*`). The DOM overlay + RAF/timer/sound playback
// driver stays in each binding. `p14-transition-*` adds faithful PowerPoint
// 2010 effect keyframes/resolver; the core resolver approximates the same
// exotic types with 2-D fallbacks.
export * from './slide-transition-types';
export * from './slide-transition-keyframes';
export * from './slide-transition-css';
export * from './p14-transition-keyframes';
export * from './p14-transition-css';
// SmartArt SVG-fallback layout engine — pure node geometry/positioning for the
// 10 layout families (list/process/cycle/hierarchy/matrix/radial/pyramid/venn/
// funnel/target), producing fully-styled `RenderedNode` / `RenderedConnector`
// view-models. `smartart-layout` re-exports the geometry types
// (`smartart-layout-types`), helpers, and per-family computers, so a single
// barrel entry exposes the whole surface. Each binding renders the view-models.
export * from './smartart-layout';
// Three.js SmartArt - pure model types, geometry/colour helpers, and the
// `buildSmartArt3DModel` converter that turns a 2D `SmartArtLayoutResult` into
// an extruded 3D model (meshes + connectors). No `three` import; the vanilla
// three scene builder that consumes this lives behind the `pptx-viewer-shared/
// smartart-3d` subpath so `three` stays an optional, lazily-loaded dependency.
export * from './smartart-3d-types';
export * from './smartart-3d-geom';
export * from './smartart-3d-model';
export * from './smartart-3d-spatial';
// SmartArt accessibility metadata: pure screen-reader description of the whole
// diagram, per-node ARIA labels, and the `SmartArtA11y` view-model each binding
// maps onto `role="img"` + `aria-label` + per-node `<title>`/`aria-label`.
export * from './smartart-accessibility';
// Vanilla three.js GLTF/GLB model scene controller: mounts an interactive 3D
// model into a container element (auto-centre/fit, lights, OrbitControls, RAF
// loop) and exposes resize()/dispose(). `three` is dynamically imported and
// optional; returns a no-op sentinel handle when it is not installed, so the
// barrel stays three-free and each binding (React interactive 3D) can mount it.
export * from './model3d-scene';
// Vanilla three.js 3D surface-chart scene controller + its pure geometry
// helpers: builds a colour-displaced surface mesh (optional wireframe), grid
// floor, lights, isometric camera, OrbitControls, RAF loop, and DOM-overlay
// axis labels re-projected each frame, exposing resize()/dispose(). Like
// `model3d-scene`, `three` is dynamically imported and optional; returns a
// no-op sentinel handle when it is missing so the chart falls back to 2D.
export * from './surface-chart-3d-geom';
export * from './surface-chart-3d-scene';
// SmartArt pre-computed drawing-shapes projection (the `smartArtData.
// drawingShapes` path the core engine extracts from `ppt/diagrams/drawing*.xml`,
// preferred over the SVG-fallback layout engine when present): palette
// resolution, chrome style, viewBox fitting, and `RenderedShape` projection.
// `DEFAULT_PALETTE` is re-exported as `SMARTART_DEFAULT_PALETTE` to avoid
// colliding with the chart palette of the same name.
export {
	PALETTES,
	DEFAULT_PALETTE as SMARTART_DEFAULT_PALETTE,
	paletteColour,
	resolvePalette,
	buildChromeStyle,
	computeDrawingViewBox,
	projectDrawingShapes,
	styleShadowFilter,
} from './smartart-drawing';
export type { RenderedShape, DrawingViewBox } from './smartart-drawing';
// Inspector panel: shapeStyle/textStyle value readers + shallow-merge patch
// builders (fill/stroke/colour/font-size/bold/italic/underline).
export * from './inspector-helpers';
// Effects panel: shadow/inner-shadow/glow/reflection/soft-edge state readers +
// enable/disable/update shapeStyle merge patch builders.
export * from './effects-helpers';
// Embedded-font @font-face assembly: URL/format validation, XOR de-obfuscation
// fallback, and the resolved-variant -> stylesheet/family-list build (the
// managed <style> id + object-URL minting stay per-binding).
export * from './embedded-fonts';
// Pure slide text search: per-element/-slide text collection + case-insensitive
// substring search with match counts and context snippets.
export * from './slide-search';
// Custom shows: named slide-subset list type + immutable id/create helpers.
export * from './custom-shows';
// Export-progress maths shared by every binding's export handlers: the
// `(current, total)` slide cursor → 0-100 percentage mapping (single-phase and
// two-phase capture+record), the "verb slide N of M" status label, and the
// cooperative-cancellation `AbortError` helpers. The stateful modal + the
// capture/encode loop that calls these stay in each binding.
export * from './export-progress';
// Native file-open picker — framework-agnostic `<input type=file>` helper +
// default `.pptx/.ppsx/.pptm/.potx` accept list, used by every binding's
// File ▸ Open action to load another presentation.
export * from './open-file-picker';
// Mobile-adapted presenter view: pure geometry (next-slide thumbnail scaling),
// slide-counter / first-last labels, and elapsed-time formatting for the
// single-column phone presenter layout. The desktop split-screen presenter
// keeps its own per-binding helpers; only the phone layout is shared here. Each
// binding renders these values into its own template / JSX.
export * from './presenter-mobile';
// Virtual-keyboard inset maths: from a VisualViewport snapshot, compute how many
// CSS pixels the on-screen keyboard covers, whether it counts as open, and how
// far to scroll the focused field into the area above the keyboard. Each binding
// wires the visualViewport resize listener; the maths is shared here.
export * from './mobile-keyboard';
// Presenter view: notes font-size clamp + step constants, clock/elapsed-time
// formatting, and rich-text notes -> framework-agnostic `NotesSpan[]` render
// spec. Each binding renders the spec into its own nodes.
export * from './presenter-view';
// Presentation toolbar: bottom-trigger-zone visibility math, auto-hide timing,
// pen/highlighter colour swatches, and slide-counter formatting.
export * from './presentation-toolbar';
// Insert > Action: OOXML built-in action-button catalogue + element factory
// (labelled nav buttons carrying an `actionClick` slide jump).
export * from './action-buttons';
// SmartArt insert-gallery catalogue: preset entries (layout/label/category/
// default node texts) + the sidebar category list.
export * from './smart-art-presets';
// Draggable alignment guides (View > H/V Guides): persistent guide-list CRUD
// (`Guide` carries an `id`). Distinct from `snap-guides` drag-time snapping.
export * from './alignment-guides';
// Canvas/pixel image effects: chroma-key colour change (`<a:clrChange>`) +
// duotone luminance mapping (`<a:duotone>`). Distinct from the SVG-`<filter>`
// duotone descriptor in `image-effects`; this is the canvas pixel path with
// caches + duotone presets. Each binding draws onto its own `<canvas>`.
export * from './image-color-change';
export * from './image-duotone-canvas';
// Hyperlink-edit dialog patch-builders: turn a URL+tooltip draft into an
// `{ actionClick }` element merge patch, reusing `hyperlink-security` guards.
export * from './hyperlink-dialog';
// Find & replace across slide text segments (immutable transforms).
export * from './find-replace';
// Accessibility issue aggregation over a slide array (mirrors core's
// `checkPresentation`) + severity grouping/labels for the panel.
export * from './accessibility-issues';
// Per-element accessibility: reading-order computation, ARIA role / label /
// role-description mapping, and reduced-motion detection. Each binding's element
// renderer applies these to its DOM nodes.
export * from './accessibility';
// Freehand ink: points -> SVG path `d`, completed-stroke -> `InkPptxElement`.
export * from './ink-drawing';
// Mobile chrome sheet state machine + bottom-bar action descriptors.
export * from './mobile-chrome';
// Gradient-picker editor model: read `GradientState` off an element + build
// fillMode='gradient' shapeStyle merge patches (add/remove/update stops).
export * from './gradient-picker';
// Active-slide comment-array transforms (add/remove/toggle-resolved).
export * from './comments-list';
// Touch-gesture state machine: pinch-to-zoom (two-finger distance ratio),
// single-finger horizontal swipe, and long-press recognition driven purely by
// DOM `TouchEvent`-shaped objects. Each binding owns the listener attach/detach
// lifecycle; the recogniser and its pure helpers (getTouchDistance/clampScale)
// are shared here.
export * from './touch-gestures';
// Insert-chart factory: a sensible DEFAULT new `ChartPptxElement` (three sample
// categories, one "Series 1", legend on, default position) plus the chart-type
// list shown in the insert dropdown. The single source of truth every binding's
// "Insert > Chart" toolbar action calls; wraps core's `createChartElement`.
export * from './insert-chart';
