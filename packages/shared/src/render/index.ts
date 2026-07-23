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
// `a:grpFill` inheritance: pull a group's fill + resolve a grpFill child's paint.
export * from './group-fill';
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
export * from './image-effect-filter-values';
export * from './text-warp';
export * from './omml-to-mathml';
export * from './latex-to-omml';
export * from './equation-templates';
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
	ChartPartRef,
	ChartValueDrag,
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
// Direct on-canvas chart editing: data-attribute hit-testing bridge,
// drag-to-value inversion, and immutable chart-data edit helpers.
export {
	CHART_PART_ATTR,
	CHART_PART_SERIES_ATTR,
	CHART_PART_POINT_ATTR,
	chartPartToAttrs,
	chartPartFromElement,
	findChartPartTarget,
	isSameChartPart,
	valueFromY,
	roundDragValue,
	dragValueForPart,
	dragAnchorViewY,
	withChartPointValue,
	withChartTitle,
} from './chart-interaction';
export type { ChartPartElement } from './chart-interaction';
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
	computeHierarchicalSunburstArcs,
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
	buildRegionMapEntries,
	formatRegionMapValue,
	resolveRegionEntityCode,
	shouldRenderRegionLabel,
} from './chart-region-map-data';
export type { RegionMapEntry } from './chart-region-map-data';
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
// Staged-build (p:bldChart / p:bldDgm) mode resolution + time->progress helpers
// consumed by staged chart / SmartArt reveal renderers.
export * from './animation-build';
// Staged chart / SmartArt reveal projection: trim chart data / count revealed
// diagram nodes for the current build progress.
export * from './chart-build';
export * from './diagram-build';
export * from './animation-timeline-helpers';
// Compound / simultaneous OOXML start+end condition evaluation (p:stCondLst /
// p:endCondLst OR-sets), consumed by the sequencer + timeline builder.
export * from './animation-advanced-triggers';
export * from './animation-timeline-text-build';
export * from './animation-effects';
export * from './animation-sequencer';
export * from './animation-timeline-builder';
export * from './animation-timeline-engine';
// Framework-agnostic presentation-mode element-animation controller: wraps the
// TimelineEngine (with text-build expansion) and caches keyframes CSS + trigger
// shape ids + the tracked element id list, exposing advance/reset/computeStates
// + the pure `collectBuildStepIds` staged-build probe. The clock (RAF/timers),
// DOM injection, and step application stay in each binding.
export * from './presentation-animation-controller';
// OOXML `p:cmd` media playback commands (play/pause/seek) surfaced on timeline
// steps; the DOM `HTMLMediaElement` control stays in each binding.
export * from './animation-media-commands';
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
// Cursor-anchored cell merge/split helpers (`computeMergeCellRight` /
// `computeMergeCellDown` / `computeSplitCell`): merge the neighbour to the
// right/below the cursor cell, or split the merged cell under it. Complements
// the selection-rect operations in `table-merge`.
export * from './table-cell-merge';
// Table quick-style preset catalogue (`TABLE_STYLE_PRESETS` + `TableStylePreset`)
// for the table properties panel.
export * from './table-style-presets';
// Advanced (gradient/pattern) cell-fill inspector option lists + shared class
// tokens (`FILL_MODE_OPTIONS` / `GRADIENT_TYPE_OPTIONS` / `PATTERN_OPTIONS`).
export * from './table-advanced-fill';
// Table drag-resize geometry: column-boundary positions, two-column width
// redistribution (clamped + renormalised), and row-height clamping. Each binding
// keeps its own drag overlay component.
export * from './table-resize';
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
export * from './selection-transform';
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
// Section CRUD: pure immutable transforms over the sections + slides arrays
// (add/rename/delete/move section, move-slides-to-section) + GUID-like section
// id + OOXML slide-id resolution. Each binding wires its reactive state through
// these.
export * from './section-operations';
// Slide CRUD factories: blank-slide builder + `slide-<ts>-<rand>` id helper
// (with optional id override). Each binding's slide-management layer calls these.
export * from './slide-operations';
// OLE download/open helpers: file-size formatting + browser-openable MIME check
// for the binding OLE renderers' download/open actions.
export * from './ole-actions';
// OLE type-resolution helpers: resolve an OlePptxElement to a narrowed
// application type + per-type brand colour / label / aria label / badge text /
// display name / placeholder box style. The icon/badge JSX stays per binding.
export * from './ole-renderer-helpers';
// Editor snap geometry: snap-to-shape (siblings + guides → snap lines, React/Vue
// model), snap-to-box (closest-per-axis span guides, Angular model), grid
// snapping. Pure maths; the pointer/drag driver stays in each binding.
export * from './snap-guides';
// Ruler tick generation + constants (View ▸ Ruler). Pure; each binding renders.
export * from './ruler';
export * from './bullet-autonum';
export * from './bullet-list';
// Rich speaker-notes editor: segment/paragraph maths, contentEditable HTML
// serialise/parse, caret-aware toolbar commands, and the print-notes document
// builder. The view layer (contentEditable + textarea fallback) stays per
// binding; `escapeHtml` is not re-exported (see notes/index.ts).
export * from './notes';
// Text CSS-builder helpers (framework-agnostic, neutral CSS records/strings):
// `text-style-helpers` (line-height + vertical writing-mode + auto-fit scale),
// `text-decoration` (16 OOXML underline styles -> text-decoration), `text-
// paragraph-style` (per-paragraph BiDi + text-align resolution), `text-field-
// substitution` (slide-number/date/header-footer/docproperty field text), and
// the text-effect builders `text-fill` (gradient/pattern background-clip:text),
// `text-effects` (shadow/glow/blur/HSL/reflection/alpha), `text-effects-3d`
// (extrusion/bevel text-shadow stack + scene perspective). Each binding casts
// the neutral record to its own style type; React keeps the JSX (SVG filters).
export * from './text-style-helpers';
export * from './text-decoration';
export * from './text-paragraph-style';
export * from './text-field-substitution';
export * from './text-fill';
export * from './text-effects';
export * from './text-effects-3d';
// Per-run text-effect composer: folds fill + shadow (incl. 3D) + filter chain
// (glow/inner-shadow/blur/HSL) + alpha opacity + reflection into ONE neutral
// CSS record (no-op `{}` for plain runs), mirroring React's per-run span style.
export * from './text-run-effects';
// MathML/SVG sanitisation (DOMPurify wrapper, non-DOM fallback) for equation
// rendering. React + Vue consume it; Angular uses its own DomSanitizer.
export * from './mathml-sanitize';
export * from './text-paragraphs';
export * from './text-advanced';
export * from './text-theme';
export * from './kinsoku-styles';
export * from './tab-leader';
export * from './inline-selection-utils';
export * from './text-case-transform';
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
// Throttled local-presence publisher, shared by every binding's collaboration
// layer (writes the same nested `presence` awareness field they all read).
export * from './collaboration-presence-publisher';
export * from './collaboration-sync';
// One-way broadcast auto-follow policy (only a local `viewer` follows the
// session `owner`), shared by every binding so the rule cannot drift.
export * from './collaboration-broadcast-follow';
// Granular local -> Y.Doc reconciliation (per-slide/element/field diffing,
// origin-tagged transactions). Prefer over writeSlidesToYDoc for live editing.
export * from './collaboration-reconcile';
// Character-level in-place Y.Text merging (minimal text diff + attribute-run
// reconcile) so concurrent edits to the same text element converge.
export * from './collaboration-text-merge';
// First-write gate: block local doc writes until the provider's initial sync
// (or a grace period) so late joiners never seed placeholder content.
export * from './collaboration-sync-gate';
// Elected-writer (role 'owner') debounced PPTX write-back, shared by
// Vue/Svelte/Vanilla (Angular keeps its own DI-style class).
export * from './collaboration-writeback';
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
// Mobile viewport: breakpoint constants + the pure `isMobileViewport` /
// `isTabletViewport` predicates and `detectTouchDevice` / `detectOrientation`
// probes behind each binding's `useIsMobile`. The reactive wiring stays per
// binding; the thresholds and DOM probes are shared so all three switch chrome
// identically.
export * from './mobile-viewport';
// Format helpers: framework-agnostic date / timestamp display formatters for
// the document-properties and version-history panels.
export * from './format-helpers';
// Cryptographically strong random-id helpers (`secureRandomUuid` /
// `secureRandomToken`): prefer `crypto.randomUUID()`, fall back to
// `crypto.getRandomValues` rather than `Math.random()`. Used anywhere a value
// gates something security-sensitive (session nonces, room codes, GUIDs).
export * from './secure-random';
// Broadcast helpers: room-id generation, start-form validation, and the
// viewer-link builder for the one-way broadcast (presenter -> viewers) session.
export * from './broadcast-helpers';
export * from './share-session';
// Share dialog form: field seeding, validity, and CollaborationConfig assembly
// sugar over the neutral session builders. Shared by every binding.
export * from './share-form';
// Presenter view: notes font-size clamp + step constants, clock/elapsed-time
// formatting, and rich-text notes -> framework-agnostic `NotesSpan[]` render
// spec. Each binding renders the spec into its own nodes.
export * from './presenter-view';
export * from './presenter-console';
export * from './presentation-print-settings';
export * from './presentation-session';
// Audience content store: IndexedDB presenter <-> audience deck handoff, plus
// the audience-tab hash detection helpers. Shared by every binding.
export * from './audience-content-store';
// EyeDropper colour sampler: native EyeDropper API plus an elementFromPoint /
// canvas DOM-sampling fallback for browsers without it.
export * from './eyedropper';
// Presentation toolbar: bottom-trigger-zone visibility math, auto-hide timing,
// pen/highlighter colour swatches, and slide-counter formatting.
export * from './presentation-toolbar';
// Insert > Action: OOXML built-in action-button catalogue + element factory
// (labelled nav buttons carrying an `actionClick` slide jump).
export * from './action-buttons';
// SmartArt insert-gallery catalogue: preset entries (layout/label/category/
// default node texts) + the sidebar category list.
export * from './smart-art-presets';
// SmartArt preset data builder: the node tree / PptxSmartArtData a preset
// inserts, shared by insert handlers and dialog previews so they never drift.
export * from './smart-art-preset-data';
// Draggable alignment guides (View > H/V Guides): persistent guide-list CRUD
// (`Guide` carries an `id`). Distinct from `snap-guides` drag-time snapping.
export * from './alignment-guides';
// Canvas/pixel image effects: chroma-key colour change (`<a:clrChange>`) +
// duotone luminance mapping (`<a:duotone>`). Distinct from the SVG-`<filter>`
// duotone descriptor in `image-effects`; this is the canvas pixel path with
// caches + duotone presets. Each binding draws onto its own `<canvas>`.
export * from './image-color-change';
export * from './image-source-effects';
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
export * from './element-accessibility-dom';
export * from './modal-focus';
// Freehand ink: points -> SVG path `d`, completed-stroke -> `InkPptxElement`.
export * from './ink-drawing';
// Ink rendering maths: SVG-path point extraction, pressure-sensitive circle
// generation (per-point pressure/width -> variable-width stroke), and replay
// (stroke-dashoffset reveal) animation styles. Pure; each binding renders the
// resulting circles/paths. React + Vue + Angular ink renderers consume this.
export * from './ink-rendering';
// Mobile chrome sheet state machine + bottom-bar action descriptors.
export * from './mobile-chrome';
// Gradient-picker editor model: read `GradientState` off an element + build
// fillMode='gradient' shapeStyle merge patches (add/remove/update stops).
export * from './gradient-picker';
// Image-adjustments editor model: brightness/contrast/saturation state +
// merge patches, plus the four crop-inset (left/top/right/bottom) reader +
// clamped patch builder. Used by the image inspector panel.
export * from './image-adjustments';
// Table-level inspector model: header-row / banded-rows / banded-columns
// toggle state + merge patches, plus a uniform default-cell-padding patch
// builder (this binding has no per-cell selection model; see module docs).
export * from './table-inspector';
// Active-slide comment-array transforms (add/remove/toggle-resolved).
export * from './comments-list';
// Touch-gesture state machine: pinch-to-zoom (two-finger distance ratio),
// single-finger horizontal swipe, and long-press recognition driven purely by
// DOM `TouchEvent`-shaped objects. Each binding owns the listener attach/detach
// lifecycle; the recogniser and its pure helpers (getTouchDistance/clampScale)
// are shared here.
export * from './touch-gestures';
// Always-available presentation controls on coarse-pointer devices: shared
// previous/next boundary state and counter text for every binding.
export * from './presentation-touch-controls';
export * from './sheet-dismiss';
// Insert-chart factory: a sensible DEFAULT new `ChartPptxElement` (three sample
// categories, one "Series 1", legend on, default position) plus the chart-type
// list shown in the insert dropdown. The single source of truth every binding's
// "Insert > Chart" toolbar action calls; wraps core's `createChartElement`.
export * from './insert-chart';

// SmartArt reflow: convert algorithmic layout results back to PptxSmartArtDrawingShape[]
// so the drawing-shape renderer handles post-edit display and shapes round-trip through save.
export * from './smartart-reflow-to-shapes';

// Inspector preset catalogues (framework-free pure data): artistic image-effect
// presets, text-warp gallery presets + preview-path generator, shape quick-style
// gallery, and 3D-text bevel/material option lists. Each binding's inspector
// gallery consumes these instead of duplicating the data.
// Presentation-mode media autoplay: a shared `.play()` helper (trim-start seek
// + swallowed autoplay-blocked rejection) each binding calls when present mode
// makes a media element's slide the live surface.
export * from './media-playback';
export * from './media-trim-timeline';
export * from './summary-zoom';

export * from './image-artistic-presets';
export * from './text-warp-presets';
export * from './shape-quick-styles';
export * from './text-3d-presets';

// Element clipboard: in-memory copy/cut payload builders + paste cloning
// (fresh template-aware ids + cascade offset) and the marked, versioned JSON
// string codec (binary-safe) for round-tripping elements through the system
// clipboard. Each binding's cut/copy/paste handlers are thin wrappers on this.
export * from './element-clipboard';
export * from './template-editing';
// Ordered + capped element composition for slide previews / sidebar thumbnails,
// mirroring `buildSaveSlides` (template elements first, then slide-owned).
export * from './preview-elements';
// Insert > Shape picker catalogue: preset geometry types + labels/i18n keys +
// framework-neutral glyph descriptors; each binding maps glyphs to its icons.
export * from './shape-preset-catalog';
// Home-tab text formatting presets: font family/size dropdown lists,
// character/line-spacing presets, and the change-case options + transforms.
export * from './text-format-presets';
// Canonical "Office Standard Colors" 10-swatch catalogue for font-colour /
// highlight-colour (and future fill/line-colour) pickers, shared by every
// binding instead of each hardcoding its own copy.
export * from './color-swatches';

// PowerPoint-style title bar (AutoSave toggle + quick access + file name +
// search) and the shared IndexedDB autosave recovery store behind it. Pure
// logic + class tokens; each binding renders its own thin view from these.
export * from './title-bar';
export * from './command-search';
export * from './autosave-store';
export * from './backstage';
export * from './master-page-layout';
export * from './virtualized-list';
export * from './document-statistics';
export * from './used-fonts';
export * from './font-availability';
export * from './password-protection';
export * from './viewer-preferences';
export * from './presentation-setup';
export * from './presentation-subtitles';
export * from './account';
export * from './viewer-prefs-storage';
// Toolbar action / ribbon-tab visibility: the ToolbarActionId catalogue and
// TOOLBAR_TABS registry each binding's `hiddenActions` prop is built on.
export * from './toolbar-actions';
// File > Options parity: schema, store, persistence, and behavior helpers
// behind the PowerPoint-style Options dialog in every binding.
export * from './options';
