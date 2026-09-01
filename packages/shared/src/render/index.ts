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
export * from './hollow-shape-hit-test';
export * from './shape-geometry';
export * from './wheel-intent';
export * from './shape-geometry-cascade';
export * from './fill-style';
// `a:gradFill/a:path@type="rect"`: nested-rectangle SVG data-URI approximation
// (PowerPoint's own rect path gradient has square corners, which no native
// CSS/SVG radial gradient can express), consumed by `fill-style`'s
// `buildRectPathGradient`.
export * from './path-gradient-rect';
// `a:gradFill` → SVG paint server, for the freeform (`a:custGeom`) shapes that
// are painted as a real `<path>` and so cannot take a CSS gradient.
export * from './svg-gradient-paint';
// Stroked SVG outlines: a gradient line (`a:ln/a:gradFill`), which a CSS border
// cannot express, and a stroke-only ("open") preset such as `line` or `arc`,
// which has no box to put a border on.
export * from './stroke-outline';
export * from './stroke-only-preset';
export * from './stroke-paint';
// Pure per-sub-path paint decision (fill colour adjustment for lighten/darken/
// none, and the stroke opt-out), shared by custom geometry AND multi-sub-path
// preset shapes. The mechanism behind `subpath-fill-overlay`.
export * from './vector-subpath-paint';
// Per-sub-path FILL overlay: which elements need layered SVG paths instead of
// one merged clip-path + flat background (a multi-sub-path preset shading/
// bevel, or custom geometry with structured per-sub-path fill modes), and the
// paints to render. `suppressesCssFill` is consumed by `getComputedFillStyle`.
export * from './subpath-fill-overlay';
// The whole `a:ln` -> CSS decision (border width/style/colour, compound lines,
// line join / cap / miter limit) as one descriptor, so no binding re-derives it.
export * from './stroke-style';
// `a:blipFill/a:tile`: scale, offset, alignment and mirror-flip of a tiled
// picture, which four of five bindings used to render as one stretched copy.
export * from './image-tiling';
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
// Per-run per-script (`a:ea`/`a:cs`/`a:sym`) font fallback, folded into
// `ParagraphRun.scriptRuns` by `paragraph-run-build`. React's own copy
// (`text-segment-render.tsx`) is gone; all five bindings render the same
// descriptor now.
export * from './text-script-fonts';
export * from './visual-effects';
export * from './reflection';
export * from './image-effects';
export * from './image-background-removal';
export * from './image-effect-filter-values';
export * from './image-fill-overlay';
export * from './text-warp';
export * from './omml-to-mathml';
export * from './latex-to-omml';
export * from './equation-templates';
// LaTeX -> OMML -> sanitised MathML, the pipeline every binding's equation
// editor drives its live preview and insert payload from.
export * from './equation-compile';
export * from './chart-helpers';
export * from './chart-area-fill';
export * from './chart-font';
export * from './chart-number-format';
export * from './chart-trendlines';
export * from './chart-axis';
export * from './chart-palette';
export * from './chart-datapoint-style';
export * from './chart-sparkline';
// Legend swatch/label placement (horizontal row vs. vertical stack), shared by
// every binding's chart projector so `LEGEND_ITEM_WIDTH` and the placement
// formula are fixed once instead of five times.
export * from './chart-legend-layout';
// Pure option lists + chart-type capability Sets for the chart inspector
// controls (type/grouping/legend/axis/data-label/trendline/error-bar/marker/
// gridline/combo selectors), shared by every binding's chart editor.
export * from './chart-editor-options';
// Per-type default categories/series/categoryLevels for the six ChartEx kinds
// (histogram, funnel, treemap, sunburst, boxWhisker, regionMap) an insert
// needs to actually look like that chart type.
export * from './chart-ex-insert-defaults';
// Wire-token -> i18n key lookups, so a control can spell an OOXML enum without
// its option set being dictated by a shared catalogue.
export * from './schema-label-keys';
export * from './chart-schema-label-keys';
export * from './fill-pattern-label-keys';
export * from './slide-transition-label-keys';
// Guarded add/remove/edit operations behind the chart inspector's data grid
// (auto-naming, last-series/category protection, non-numeric cell rejection).
export * from './chart-data-grid-ops';
// What a data label SAYS: the c:showVal / c:showCatName / c:showSerName /
// c:showPercent / c:separator cascade (per-point -> series -> chart-type).
export * from './chart-data-label-text';
// Direct on-canvas chart editing, framework-neutral half: the value-drag state
// machine, the hit-target stylesheet and the selected-part highlight.
export * from './chart-canvas-drag';
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
	computeScatterXDomain,
	computeBubbleRadius,
	radarAngle,
	computeRadarPoints,
	radarRingPoints,
	resolveChartKind,
	chartPreserveAspectRatio,
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
	ScatterXDomain,
	RadarPoint,
	SupportedChartKind,
	PlotLayoutOptions,
} from './chart-view-model';
// `c:manualLayout` (CT_ManualLayout) conversion: the pure edge / factor
// fraction-to-pixel resolver the chart engine uses to honour a hand-placed
// title, plot area or legend, plus the title / legend post-pass.
export * from './chart-manual-layout';
export { withManualLayouts } from './chart-view-model-manual';
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
	computeLinearRegression,
	fitPolynomial,
	computeRSquared,
} from './chart-overlays';
export type { LinearFit } from './chart-overlays';
export {
	computeDataTablePrimitives,
	DATA_TABLE_ROW_H,
	DATA_TABLE_HEADER_H,
	DATA_TABLE_KEY_W,
	DATA_TABLE_PADDING,
} from './chart-data-table-render';
export { applyLegendEntryOverrides } from './chart-legend-entries';
export * from './animation-css';
// Editor element-animation preset model — distinct from the native OOXML
// `p:timing` timeline below. `animation-authoring` holds the immutable
// slide-`animations[]` patch builders + value-only option catalogs for the
// authoring panel; `animation-playback` holds the pure click-group / reveal /
// pending-style maths that drives the editor preview. Both build on
// `animation-css` for the preset → CSS keyframe mapping. The stateful hooks /
// services / RAF loops stay in each binding.
export * from './animation-authoring';
// Merges `animations[]` with the deck's own read-only effect anchors into one
// draggable timeline, so drag-to-reorder can target the FULL sequence
// (editor-authored AND deck-native effects), not just the editor's own.
export * from './animation-timeline-rows';
// Effect sound picker (`p:stSnd`) and "after animation" (dim/hide) authoring
// controls: same immutable-patch-builder shape as `animation-authoring`,
// split into their own modules since they're optional add-on rows the panel
// only shows once an effect exists, not part of the core preset/timing form.
export * from './animation-sound-authoring';
export * from './animation-after-effect-authoring';
// Naming layer over both preset vocabularies (editor `PptxAnimationPreset`
// tokens and core's OOXML preset catalogue), so no timeline prints a wire id.
export * from './animation-preset-labels';
export * from './animation-playback';
// Native-animation (OOXML `p:timing` tree) timeline engine — preset tables,
// keyframe definitions, colour interpolation, dynamic/static keyframe
// generation, sequencing, click-group timeline + stateful playback controller,
// and editor preview descriptors. Pure maths; the RAF playback loop, DOM style
// injection, audio playback, and file reading stay in each binding.
export * from './animation-timeline-types';
export * from './animation-presets';
// `p:animEffect/@filter` fallback resolution, consulted by `resolveEffect`
// only when `presetId` is absent/unmapped (see `animation-timeline-helpers`).
export * from './animation-filter-effects';
// CSS `mask` reveal states for the wipe / peek / blinds / split / box family.
// A mask composites with the element's own geometry `clip-path`, which a
// `clip-path` keyframe would replace (flooding a thin shape's bounding box).
export * from './animation-mask-reveal';
export * from './animation-keyframes';
export * from './animation-color';
export * from './animation-color-base-style';
// Staged-build (p:bldChart / p:bldDgm) mode resolution + time->progress helpers
// consumed by staged chart / SmartArt reveal renderers.
export * from './animation-build';
// Staged chart / SmartArt reveal projection: trim chart data / count revealed
// diagram nodes for the current build progress.
export * from './chart-build';
export * from './diagram-build';
export * from './animation-timeline-helpers';
// Absolute `p:animRot`/`p:animScale` `from`/`to` keyframes, plus `p:tavLst`
// opacity and colour ramps for a generic `p:anim` node (attributed via
// `PptxNativeAnimation.attrName`), consumed by `animation-timeline-helpers`
// / `animation-timeline-builder` as the sibling of their relative-`@by` and
// canned-static keyframe paths respectively.
export * from './animation-timeline-absolute';
// `@fill` / `@repeatDur` / `@spd` timing decisions consumed by the timeline
// builder and (for `holdEndState`) by each binding's cleanup-timer step.
export * from './animation-fill-repeat';
// Compound / simultaneous OOXML start+end condition evaluation (p:stCondLst /
// p:endCondLst OR-sets), consumed by the sequencer + timeline builder.
export * from './animation-advanced-triggers';
export * from './animation-timeline-text-build';
// `p:bldP/@bldLvl` paragraph grouping for a by-paragraph text build, consumed
// by `animation-timeline-text-build`.
export * from './animation-timeline-build-level';
// `p:txEl` (pRg/charRg) text-level target scoping, consumed by
// `presentation-animation-controller`.
export * from './animation-timeline-text-range';
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
// steps: `-commands` recognises/parses them, `-playback` drives the resolved
// `HTMLMediaElement`. Only the target lookup stays per binding (React resolves
// through its element registry; the rest query the stage by `data-element-id`).
export * from './animation-media-commands';
export * from './animation-media-playback';
export * from './animation-preview';
// Motion-path authoring (`p:animMotion`): the Lines/Arcs/Turns/Shapes/Loops
// preset catalogue, the slide-space geometry the canvas overlay draws and drags,
// and the slide-`animations[]` patch builders + preview descriptor. The gallery,
// the overlay view and the `<style>` injection stay in each binding.
export * from './motion-path-presets';
export * from './motion-path-geometry';
export * from './motion-path-authoring';
// `visual-3d` is the public surface; it re-exports the symbols from its sibling
// modules (`visual-3d-camera`, `visual-3d-materials`, `visual-3d-extrusion`,
// `visual-3d-color`, `visual-3d-constants`), so they are NOT flattened here to
// avoid duplicate-export conflicts.
export * from './visual-3d';
export * from './table-style';
// PowerPoint's 74 built-in table styles, keyed by GUID. They are absent from a
// deck's `ppt/tableStyles.xml` by design, so without this catalogue every table
// using a gallery style resolved to nothing and painted a hardcoded blue.
export * from './table-style-builtins';
// The three-layer `<td>` cascade (inherited base -> table-style band -> explicit
// cell style -> text-colour floor). It was composed by hand in all five
// bindings; React had lost the band layer on programmatic tables and Angular the
// colour floor, so both are decided here now.
export * from './table-cell-css';
// Whether a canvas press extends the table CELL range or falls through to the
// element selection. Vue let a Shift-click fall through, which toggled the table
// out of the selection and wiped the range anchor, so block merge was
// unreachable there however correct its range maths was.
export * from './table-cell-pointer';
export * from './table-merge';
export * from './table-layout';
// Immutable single-cell text edit (`setCellText`) for inline cell editing,
// shared by every binding's table renderer.
export * from './table-cell-edit';
// Inspector table data grid: normalised render model (`buildTableDataGrid`) plus
// element-level row/column operations, so all five bindings edit cell text from
// the sidebar through one implementation.
export * from './table-data-grid';
export * from './table-data-grid-ops';
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
// Authored `p:gridSpacing` (EMU, from `viewProperties`) -> CSS pixel step,
// used by snap-to-grid and the grid overlay in every binding.
export * from './grid-spacing';
// `a:spLocks` enforcement: one predicate deciding whether a select / move /
// resize / rotate / text-edit / adjust gesture may proceed on an element, so a
// locked shape behaves the same in all five bindings (it used to be honoured in
// React alone, while Vue and Angular shipped a Lock button that locked nothing).
export * from './element-locks';
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
// Legacy PowerPoint 97-2003 `shadeToTitle` background hint: shades a slide's
// gradient background toward its title placeholder's text colour.
export * from './background-shade-to-title';
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
// Slide template gallery: catalogue of pre-designed starter slides (title,
// agenda, comparison, ...) built as theme-aware PptxSlide content. Single
// source of truth for every binding's New Slide template gallery and its
// live-rendered previews.
export * from './slide-templates';
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
// Ribbon Bullets / Numbering toggle: authors real `bulletInfo`, not `listType`.
export * from './bullet-toggle';
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
// (text body scene perspective/rotation). Each binding casts the neutral
// record to its own style type; React keeps the JSX (SVG filters).
export * from './text-style-helpers';
// Line-height resolution: PowerPoint's single-spacing pitch, proportional
// (`a:spcPct`) / exact (`a:spcPts`) modes, `compatLnSpc`'s legacy model.
export * from './text-line-height';
// `a:pPr/@fontAlgn` (font alignment within a line) -> CSS `vertical-align`.
export * from './text-font-alignment';
// This paragraph's own kinsoku / font-alignment / tab-default override,
// falling back to the text body's when the paragraph authors none.
export * from './paragraph-geometry-overrides';
// The ONE text-body (block) style builder all five bindings render text with:
// colour, font declaration, decorations, insets, `wrap="none"` and autofit.
// Replaced React's `getTextStyleForElement` plus four drifting copies of it.
export * from './text-block-style';
// The `a:bodyPr` LAYOUT decisions the block builder folds in: columns
// (`@numCol`/`@spcCol`), `tab-size`, `@anchor` / `@anchorCtr`, the kinsoku
// rules and `@vertOverflow`. All five used to reach React only.
export * from './text-body-layout';
// The preset / `a:custGeom` text rectangle (`a:rect`) as body padding, so text
// in a chevron, callout or arrow sits inside the geometry rather than its box.
export * from './text-body-rect';
export * from './text-decoration';
export * from './text-paragraph-style';
export * from './text-field-substitution';
// Assembly of that substitution context from deck header/footer settings,
// custom document properties and the slide being painted, so every binding
// resolves field runs from the same inputs (and a thumbnail can re-point the
// deck context at its own slide).
export * from './field-context';
export * from './text-fill';
export * from './text-effects';
export * from './text-effects-3d';
// Per-run text-effect composer: folds fill + shadow + filter chain
// (glow/inner-shadow/blur/HSL) + alpha opacity + reflection into ONE neutral
// CSS record (no-op `{}` for plain runs), mirroring React's per-run span style.
export * from './text-run-effects';
// Per-run inline-style builder (Vue / Angular / Svelte / Vanilla run spans).
export * from './text-run-style';
// Hollow/outline-only text fill decision, split out of `text-run-style`.
export * from './text-run-hollow';
// Per-run letter-spacing + metric-tracking split helpers, split out of
// `text-run-style`.
export * from './text-run-spacing';
// Nested-span decoration repeat + underline-variant CSS, split out of
// `text-run-style`.
export * from './text-run-decoration';
// Per-run advance-width compensation that makes the browser break lines where
// PowerPoint breaks them. React layers it into its own span style.
export * from './text-metric-tracking';
// MathML/SVG sanitisation (DOMPurify wrapper, non-DOM fallback) for equation
// rendering. React + Vue consume it; Angular uses its own DomSanitizer.
export * from './mathml-sanitize';
// Per-run hyperlink + inline-equation descriptors carried on `ParagraphRun`,
// so every binding renders a link and an inline `m:oMath` from the same model.
export * from './text-run-meta';
// `a:ruby` phonetic guides (furigana / pinyin) as a run field, so all five
// bindings render the annotation React alone used to.
export * from './text-run-ruby';
// `ParagraphRun` / `RenderParagraph`: the descriptor types `buildParagraphs`
// (below) returns, split into their own module so every binding's shared
// import of them resolves here directly rather than through a re-export shim.
export * from './paragraph-types';
export * from './text-paragraphs';
// Per-paragraph spacing resolver (`a:spcBef`/`a:spcAft`/`a:lnSpc`), consumed by
// `buildParagraphs` and exported directly rather than via a `./text-paragraphs`
// re-export shim.
export * from './paragraph-spacing';
export * from './paragraph-strut';
// `a:spAutoFit` editor-time shape resize: the pure height decision plus the
// one shared DOM measurement (clone-to-height:auto) every binding's inline
// text editor commit handler calls, so typing into an autofit box grows or
// shrinks the box exactly once, not five slightly different ways.
export * from './shape-autofit-resize';
export * from './morph-plan';
export * from './text-advanced';
export * from './text-theme';
export * from './kinsoku-styles';
export * from './tab-leader';
// Measured tab-stop layout (per-stop alignment + leader glyphs), folded into
// `ParagraphRun.tabLines` by `paragraph-run-build`. Extracted from React's
// private `text-tab-layout.tsx`; the JSX-only piece (`renderTabbedLine`) stays
// there, thin over these.
export * from './text-tab-layout';
export * from './text-tab-run-build';
export * from './inline-selection-utils';
export * from './inline-caret';
export * from './text-case-transform';
export * from './linked-text-box-overflow';
export * from './connector-router';
export * from './connector-reroute';
// Authoring the other half of the same contract: what a drag between two
// connection sites should produce (`a:stCxn`/`a:endCxn` bindings, span-chosen
// preset), resolved through the SAME site list the reroute uses so a new
// connector cannot be drawn to a point the first shape move disagrees with.
export * from './connector-authoring';
// Attaching / detaching an existing connector's ends on canvas (the endpoint
// handles PowerPoint shows on a selected connector).
export * from './connector-endpoints';
// Pointer-anchored overlay placement (context menus): clamp against BOTH edges,
// not just the low one. Svelte clamped only the low edge, so a menu opened near
// the bottom of the window rendered below the fold and could not be clicked.
export * from './flyout-position';
export * from './connector-style';
// Connector SVG-geometry builder: from a connector `PptxElement`, derive stroke
// style, flip-adjusted endpoints, bent/curved path data (with optional A*
// obstacle routing), and arrow `<marker>` shapes. Re-uses `connectorKind` from
// `connector-style`. The `<svg>`/`<path>` emission stays in each binding.
// `connector-elbow-geometry` (orientation-aware bentConnector3/4/5 +
// curvedConnector3/4/5 bend-point / smooth-curve formulas) is a satellite of
// this module, like `connector-hit-target`/`connector-markers`/`connector-dash`:
// its two public entry points (`connectorAdjustmentFraction`,
// `connectorBendFraction`) are re-exported by `connector-path` itself rather
// than star-exported here too, to avoid a duplicate-export ambiguity.
export * from './connector-path';
// The inspector's six connector arrowhead dropdowns (`a:headEnd`/`a:tailEnd`
// type + `@w` + `@len`), described once so no binding restates the option
// order, the fallbacks or the caption keys in a private table of its own.
export * from './connector-arrow-controls';
export * from './format-painter';
export * from './remap-text';
export * from './shape-adjustment';
export * from './shape-adjustment-handles';
export * from './shape-adjustment-model';
export * from './shape-adjustment-probe';
export * from './shape-adjustment-solver';
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
// Memoising awareness -> presence/cursor projection: returns the previous
// result by identity when an awareness event carries no visible change.
export * from './collaboration-presence-projector';
// Share dialog "active session" view-model: connected-users list (initials,
// colour, avatar, slide number) built from the presence projection above plus
// the local user's own name/colour. Only React had this feature before.
export * from './collaboration-active-session';
export * from './collaboration-sync';
// One-way broadcast auto-follow policy (only a local `viewer` follows the
// session `owner`), shared by every binding so the rule cannot drift.
export * from './collaboration-broadcast-follow';
// Granular local -> Y.Doc reconciliation (per-slide/element/field diffing,
// origin-tagged transactions). Prefer over writeSlidesToYDoc for live editing.
export * from './collaboration-reconcile';
// Live ("interim") patch channel: writes mid-gesture geometry and mid-edit text
// straight into the element's Y.Map, throttled and origin-tagged, so remote
// peers see a drag/resize/typing before the local gesture commits to state.
export * from './collaboration-live-patch';
// Character-level in-place Y.Text merging (minimal text diff + attribute-run
// reconcile) so concurrent edits to the same text element converge.
export * from './collaboration-text-merge';
// First-write gate: block local doc writes until the provider's initial sync
// (or a grace period) so late joiners never seed placeholder content.
export * from './collaboration-sync-gate';
// Whether a freshly loaded deck yields to the room: only a bootstrap load does,
// or opening a file mid-session silently loses it (issue: vanilla + room).
export * from './collaboration-load-origin';
// Document-teardown listeners (pagehide / beforeunload / host postMessage) so a
// peer whose document is destroyed (tab close, navigation, or an embedding page
// removing the viewer iframe) leaves the room instead of lingering as a ghost
// collaborator until the awareness timeout.
export * from './collaboration-teardown';
// Synchronous "I am leaving" BroadcastChannel announcement: a provider destroyed
// inside `pagehide` cannot get its awareness removal out (y-webrtc broadcasts it
// a microtask later, after the frame's channels are dead), so peers drop the
// departed client from this instead of waiting out the awareness timeout.
export * from './collaboration-departure';
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
// Group decomposition so a `!!`-named shape matches across a grouping boundary.
export * from './morph-flatten';
// One merged z-order over both slides, so the transition overlay knows which
// arriving shapes it would otherwise hide behind a ghost.
export * from './morph-overlay-order';
export * from './morph-text';
// "Same slot, new wording": the pair PowerPoint dissolves where it stands
// instead of interpolating a box it only re-fitted around the new text.
export * from './morph-text-slot';
// The two halves of such a dissolve, paired so the overlay can sum them inside
// an isolated group rather than stacking two fades (issue #161).
export * from './morph-crossfade-group';
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
// Picture source-crop (`a:srcRect`) morphing: PowerPoint's "Scale Height" /
// "Scale Width" is a crop inside an unchanged frame, so a rescaled picture is
// invisible to every other comparison in the engine (issue #148).
export * from './morph-image-crop';
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
// Inspector-side option catalogues for the transition section: the type list,
// the orientation-vs-direction rule, and the arrow-grid tables.
export * from './slide-transition-options';
export * from './slide-transition-edits';
// What the Transitions ribbon's Sound picker shows and what picking a file
// (or clearing one) writes; packages/core embeds the picked file on save.
export * from './slide-transition-sound';
// Ribbon-side decision functions: what a Transitions-tab commit writes, what
// the Slide Show tab's Options checkboxes mean, and the three Home commands
// (Reset / Shape Fill / Shape Outline) that shipped inert in two bindings.
export * from './ribbon-transitions';
export * from './ribbon-slide-show-options';
export * from './ribbon-home-commands';
// Transitions > Preview: replays the slide's transition on the editing stage,
// which is the one thing that button does in every binding.
export * from './transition-preview';
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
// SmartArt node-count bounds: the soft per-layout min/max table (venn/matrix/
// pyramid/funnel/target/gear/cycle/default) plus canAddTopLevelNode /
// canRemoveTopLevelNode / describeSmartArtBounds, so the text-pane Add /
// Remove affordances agree across all bindings instead of each hand-porting
// the same table.
export * from './smartart-node-limits';
// SmartArt text-pane keyboard/reorder handlers: pure Enter/Backspace/Tab/
// move-up/move-down decision functions for the inspector text pane, plus the
// "connections beyond the editable parent/child tree" classifier. Every
// function delegates to the core editing ops; each binding's own
// `smartart-node-pane-handlers.ts` is a thin re-export of this module.
export * from './smartart-node-pane-handlers';
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
// Pure raycast-hit -> (row, col) grid cell -> hover-tooltip text mapping the
// interactive scene uses to give the WebGL mesh the same native hover tooltip
// every other chart kind's SVG mark gets via `buildMarkTooltip`.
export * from './surface-chart-3d-hit-test';
// Adapts a chart element's `PptxChartData` into the flat typed-array grid
// `mountSurfaceChart3D` needs, sharing `computeValueRange` + `surfaceColor`
// with the 2D SVG fallback so both presentations agree on the same values.
export * from './surface-chart-3d-data';
// Generalised camera/grid/label geometry for an interactive 3D CARTESIAN
// chart scene (category x depth/series x value axes), shared by bar3D today
// and intended for line3D/area3D to reuse unchanged.
export * from './cartesian-chart-3d-geom';
// Vanilla three.js 3D bar-chart scene controller: one real `THREE.BoxGeometry`
// mesh per data point (clustered = each series its own depth plane; stacked/
// percentStacked = coplanar, stacked in Y), authored wall/floor panels, a
// `c:view3D`-driven perspective camera, OrbitControls, and a RAF loop. Like
// `surface-chart-3d-scene`, `three` is dynamically imported and optional,
// resolving to a no-op sentinel so the chart falls back to the flat 2D
// oblique-projection bar3D renderer when it is missing.
export * from './bar-chart-3d-scene';
// Pure raycast-hit (series, category, value) -> hover-tooltip text mapping
// the bar3D scene uses to give each box mesh the same native hover tooltip
// every other chart kind's SVG mark gets via `buildMarkTooltip`.
export * from './bar-chart-3d-hit-test';
// Box-mesh layout maths (clustered vs stacked/percentStacked) the bar3D data
// adapter below builds on; split out to its own module for reuse and to stay
// under the file-size cap.
export * from './bar-chart-3d-layout';
// Adapts a `bar3D` chart element's `PptxChartData` into the box-mesh layout
// `mountBarChart3D` needs, sharing colour/value-range resolution with the
// flat SVG oblique-projection engine so both presentations agree.
export * from './bar-chart-3d-data';
// Pure per-series depth-plane path layout shared by the interactive line3D
// and area3D true-3D scenes (each series gets its own Z plane, exactly like
// bar3D's clustered layout), plus the area3D ribbon-fill triangle builder.
export * from './cartesian-line-chart-3d-layout';
// Chart-type-agnostic point/series data-shaping shared by line3D and area3D
// (`line-chart-3d-data`/`area-chart-3d-data` below only differ in which
// `c:chartType` they gate on).
export * from './cartesian-line-chart-3d-data';
// `line3D` element-gate onto the shared cartesian line/area 3D data shaping.
export * from './line-chart-3d-data';
// `area3D` element-gate onto the shared cartesian line/area 3D data shaping.
export * from './area-chart-3d-data';
// Pure raycast-hit (series, category, value) -> hover-tooltip text mapping
// shared by the interactive line3D/area3D scenes, mirroring
// `bar-chart-3d-hit-test`'s pattern.
export * from './cartesian-chart-3d-hit-test';
// Vanilla three.js 3D line-chart scene controller: one `THREE.TubeGeometry`
// path per series (its own depth plane) plus per-vertex hover markers. Like
// `bar-chart-3d-scene`, `three` is dynamically imported and optional,
// resolving to a no-op sentinel so the chart falls back to the flat 2D
// oblique-projection line3D renderer when it is missing.
export * from './line-chart-3d-scene';
// Vanilla three.js 3D area-chart scene controller: identical to
// `line-chart-3d-scene` plus a translucent ribbon fill from each series' path
// down to its baseline. Falls back to the flat 2D oblique-projection area3D
// renderer when `three` is missing.
export * from './area-chart-3d-scene';
// Pure geometry for an interactive 3D `pie3D` chart scene: fixed disc radius,
// `c:view3D/@hPercent`-driven wedge thickness, and per-slice wedge angles
// (mirroring the flat engine's `computePieSlices` bookkeeping). Reuses
// `cartesian-chart-3d-geom`'s sphere camera placement rather than its
// grid-specific framing, since a pie has no category/series grid.
export * from './pie-chart-3d-geom';
// Vanilla three.js 3D pie-chart scene controller: one real
// `THREE.CylinderGeometry` wedge mesh per data point (a partial-arc cylinder,
// giving a flat top/bottom + curved rim + flat radial "cut" faces for free), a
// `c:view3D`-driven perspective camera, OrbitControls, and a RAF loop. Like
// `bar-chart-3d-scene`, `three` is dynamically imported and optional,
// resolving to a no-op sentinel so the chart falls back to the flat 2D
// oblique-projection pie3D renderer when it is missing.
export * from './pie-chart-3d-scene';
// Pure raycast-hit (point index, value) -> hover-tooltip text mapping the
// pie3D scene uses to give each wedge mesh the same native hover tooltip
// every other chart kind's SVG mark gets via `buildMarkTooltip`.
export * from './pie-chart-3d-hit-test';
// Adapts a `pie3D` chart element's `PptxChartData` into the wedge-mesh layout
// `mountPieChart3D` needs, sharing colour/explosion resolution with the flat
// SVG oblique-projection engine so both presentations agree.
export * from './pie-chart-3d-data';
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
	drawingShapeLabelColor,
	projectDrawingShapes,
	styleShadowFilter,
} from './smartart-drawing';
export type {
	RenderedShape,
	RenderedShapeKind,
	RenderedGradient,
	RenderedGradientStop,
	DrawingViewBox,
} from './smartart-drawing';
// SmartArt fallback-layout paint decisions: the label placement / colour and
// the connector stroke a binding should use once the descriptor's OPTIONAL
// fields have had their documented defaults applied. Pure; each binding maps
// the returned descriptor straight onto `<text>` / `<tspan>` / `<path>`.
export {
	smartArtConnectorPaint,
	smartArtNodeLabel,
	SMARTART_CONNECTOR_OPACITY,
	SMARTART_CONNECTOR_STROKE,
	SMARTART_CONNECTOR_WIDTH,
	SMARTART_LABEL_COLOR,
} from './smartart-node-label';
export type { SmartArtConnectorPaint, SmartArtNodeLabel } from './smartart-node-label';
// Centred multi-line SVG label layout (SmartArt nodes and cached shapes): each
// binding places one `<tspan>` per returned line and owns nothing else.
export { centeredSvgTextLines } from './svg-text-lines';
export type { SvgTextLine, CenteredSvgTextOptions } from './svg-text-lines';
// Word wrapping for targets with no text-measurement API (PDF streams, SVG).
export { wrapTextByEstimatedWidth } from './text-wrap-estimate';
export type { EstimatedWrapOptions } from './text-wrap-estimate';
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
// Pure Google Fonts webfont-fallback helpers: referenced-family collection,
// known-family selection, and CSS2 href building (the managed <link> id +
// injection stay per-binding).
export * from './google-webfonts';
// Pure slide text search: per-element/-slide text collection + case-insensitive
// substring search with match counts and context snippets.
export * from './slide-search';
// Custom shows: named slide-subset list type + immutable id/create helpers.
export * from './custom-shows';
// Design > Slide Size: the 16 ST_SlideSizeType presets with COM-confirmed EMU
// dimensions, the orientation swap, and the pixel-canvas <-> EMU decision that
// keeps a preset's exact dimensions through a save.
export * from './slide-size';
// Export-progress maths shared by every binding's export handlers: the
// `(current, total)` slide cursor → 0-100 percentage mapping (single-phase and
// two-phase capture+record), the "verb slide N of M" status label, and the
// cooperative-cancellation `AbortError` helpers. The stateful modal + the
// capture/encode loop that calls these stay in each binding.
export * from './export-progress';
// Which files the viewer can OPEN (`.pptx/.ppsx/.pptm/.potx/.ppt/.json`, the
// accept list and the matching drop-target predicate) and what a SAVED copy
// should be called. Read is a superset of write, so a deck opened as `.ppt` is
// offered back as `.pptx`. Imports nothing, so anything may depend on it.
export * from './presentation-file-kinds';
// Native file-open picker: framework-agnostic `<input type=file>` helper used
// by every binding's File > Open action to load another presentation.
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
// Session restore: remember the deck a host has open (per browser tab) so a
// page refresh reopens it instead of dropping the user back on the dropzone.
export * from './session-restore';
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
export * from './text-build-spans';
export * from './presenter-console';
export * from './presentation-print-settings';
export * from './presentation-session';
// The selectively-subscribable store the shared viewer state is built on.
export * from './viewer-store';
// The canvas zoom slice, first vertical slice on that runtime.
export * from './viewer-zoom-store';
// No-op-write guards for the hot state paths (presenter snapshot, presence
// list). Shared so a write that carries no new information is dropped once,
// rather than re-rendering each binding in turn (issue #145).
export * from './state-equality';
// Audience content store: IndexedDB presenter <-> audience deck handoff, plus
// the audience-tab hash detection helpers. Shared by every binding.
export * from './audience-content-store';
// Audience display policy: an audience tab is a mirror of the presenter's
// screen and must never fall back into the editor. Used by every exit path.
export * from './audience-display';
// EyeDropper colour sampler: native EyeDropper API plus an elementFromPoint /
// canvas DOM-sampling fallback for browsers without it.
export * from './eyedropper';
// Presentation toolbar: bottom-trigger-zone visibility math, auto-hide timing,
// pen/highlighter colour swatches, and slide-counter formatting.
export * from './presentation-toolbar';
// Show chrome inventory: which controls the slide-show toolbar carries, in what
// order, under which accessible names, and at what measurements. The content
// counterpart to `presentation-toolbar`'s behaviour, so no binding invents its
// own bar.
export * from './present-chrome';

// Blackboard mode: the z-index rule that keeps show ink above the blackout
// sheet, and the one-click "black screen + pen" toggle state used by the show
// toolbar's Blackboard action.
export * from './presentation-blackboard';
// Slide-show right-click menu: shared item structure (order/grouping/i18n
// keys) consumed by every binding's own thin context-menu component.
export * from './presentation-context-menu';
// Presenter-console inventory + geometry: which controls the presenter view
// carries, in what order, under which label keys, and at what measurements.
// The `present-chrome` counterpart for the console rather than the show bar.
export * from './presenter-chrome';
export * from './presenter-chrome-metrics';
// Presenter-view lifecycle: the one-shot latch that stops the audience popup's
// fullscreen bounce being mistaken for the presenter ending the show.
export * from './presenter-show-lifecycle';
// Slide-show keyboard map: PowerPoint's published shortcut set (navigation,
// slide-number jump, blank screens, pointer tools) as one shared mapping so no
// binding invents its own bindings.
export * from './anchored-popup-position';
export * from './presentation-keymap';
// PowerPoint's Reading View: the deck at full window size with the editor
// chrome reduced to a nav bar, deliberately NOT the fullscreen slide show.
export * from './reading-view';
// PowerPoint's Outline view: the deck as an editable indented text document,
// one row per (element, paragraph) pair. `outline-view` reads the deck,
// `outline-view-edit` turns a keystroke into a new deck.
export * from './outline-view';
export * from './outline-view-edit';
// Editor keyboard map: the editing shortcut set (clipboard, history, nudge,
// group, select-all, slide paging, help) as one shared mapping, so the five
// bindings cannot disagree about what Ctrl+D or an arrow key does.
export * from './editor-keymap';
// Slide-sorter keyboard map: the sorter overlay is a second editing surface
// with its own keys (slide clipboard, duplicate, delete, thumbnail zoom, and an
// Escape that collapses a multi-selection before it closes).
export * from './slide-sorter-keymap';
// Focus repair for bindings whose canvas gesture preventDefault()s the click,
// which would otherwise park focus on document.body and kill their keymap.
export * from './editor-keyboard-focus';
// What a Selection Pane rename commit means, including the empty commit that
// has to reach the file as `name=""` rather than as "no opinion".
export * from './selection-pane-rename';
// Context-menu target resolution, including the right-click that lands inside
// an inline text editor mounted as a sibling overlay of the element it edits.
export * from './context-menu-target';
// Canvas context-menu command set: ids, labels, order, separators and the rules
// deciding what is offered, so the five bindings render one menu, not five.
export * from './context-menu-commands';
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
// Whether an element is a control (click/hover action, text hyperlink, zoom
// tile). Drives the `role="button"` override above, so all five bindings agree.
export * from './element-actionability';
// On-canvas action affordances (amber "has action" badge + hover link tooltip):
// the show/hide rule, the fallback text chain, and the shared CSS, so all five
// bindings draw the same authoring chrome and never during a slide show.
export * from './element-action-affordance';
// The same affordances painted at a stage boundary, for the four bindings whose
// element renderer dispatches straight to a per-type component with no wrapper.
export * from './element-action-affordance-dom';
// Whether an element reaches the canvas at all: the Selection Pane's hide/show
// rule (`p:cNvPr/@hidden`), applied by every binding's element renderer.
export * from './element-visibility';
// Action Settings panel: the click/hover action-type catalogue + slide-number
// clamping shared by every binding's inspector.
export * from './element-action-options';
// Presentation `ppt/tags/*.xml` name/value metadata: flatten + immutable edits.
export * from './tag-collections';
export * from './element-accessibility-dom';
// Pointer-to-element hit-test: a click on a grouped child selects the GROUP
// (PowerPoint's rule), with the innermost id kept available for drill-in.
export * from './element-hit-test';
export * from './modal-focus';
// Freehand ink: points -> SVG path `d`, completed-stroke -> `InkPptxElement`.
export * from './ink-drawing';
// Ink rendering maths: SVG-path point extraction, pressure-sensitive circle
// generation (per-point pressure/width -> variable-width stroke), and replay
// (stroke-dashoffset reveal) animation styles. Pure; each binding renders the
// resulting circles/paths. React + Vue + Angular ink renderers consume this.
export * from './ink-rendering';
export * from './ink-tilt-nib';
// `p:contentPart` ink view model: per-stroke path/colour/width/opacity, the
// pressure-circle decision, and the element viewBox. One decision function for
// all five bindings (it used to be a Svelte-local module, while Vue and Angular
// had no contentPart renderer at all and painted the unsupported placeholder).
export * from './content-part-strokes';
// Draw-tab eraser hit-testing: which `ink`/`contentPart` element (top-most,
// tolerance radius) a point falls on. One decision function for all five
// bindings, which each duplicated the box+radius loop (and disagreed on the
// radius, and on whether a reloaded `contentPart` stroke was erasable at all).
export * from './ink-eraser-hit-test';
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
// Active-slide comment-array transforms (add/remove/toggle-resolved/reply).
export * from './comments-list';
// `@`-mention segmentation (display) + `@`-typeahead insertion (authoring)
// for a comment body. Bindings only map `CommentTextSegment[]` onto spans.
export * from './comment-mentions';
// Canvas comment-marker descriptors (numbered dots + "<author>: <text>"
// titles); each binding renders these inside its slide stage.
export * from './comment-markers';
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
// The one-call form every edit commit path uses: derives layout / palette /
// style from the updated data itself, so a binding cannot get them wrong or
// skip the reflow because the six-argument call looked like a chore.
export * from './smartart-reflow-element';

// Inspector preset catalogues (framework-free pure data): artistic image-effect
// presets, text-warp gallery presets + preview-path generator, shape quick-style
// gallery, and 3D-text bevel/material option lists. Each binding's inspector
// gallery consumes these instead of duplicating the data.
// Presentation-mode media autoplay: a shared `.play()` helper (trim-start seek
// + swallowed autoplay-blocked rejection) each binding calls when present mode
// makes a media element's slide the live surface.
export * from './media-playback';
// Cross-slide ("play across slides") audio survives slide unmount via the
// document-level persistent-audio manager, and a running show pauses its
// media + auto-advance while the tab is hidden.
export * from './media-persistent-audio';
export * from './presentation-visibility';
export * from './media-trim-timeline';
export * from './summary-zoom';

export * from './image-artistic-presets';
export * from './text-warp-presets';
export * from './shape-quick-styles';
export * from './text-3d-presets';
export * from './text-3d-fields';
export * from './theme-editor-presets';

// Element clipboard: in-memory copy/cut payload builders + paste cloning
// (fresh template-aware ids + cascade offset) and the marked, versioned JSON
// string codec (binary-safe) for round-tripping elements through the system
// clipboard. Each binding's cut/copy/paste handlers are thin wrappers on this.
export * from './element-clipboard';
export * from './header-footer-dialog';
export * from './media-file-type';
export * from './template-background-rows';
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
// Home-tab font dropdown grouping (theme / embedded / custom / all) and the
// theme-aware default family shown when the selection overrides nothing.
export * from './font-catalog';
// The File > Fonts "Embed fonts in the file" toggle: whether it can do
// anything on this deck, which position describes reality, and the
// `PptxHandlerSaveOptions` slice its position implies.
export * from './font-embedding';
// Opt-in custom font registration for File > Options: filename -> family and
// weight/style axes, plus the FontFace hand-off.
export * from './custom-fonts';
// New Slide / Layout gallery thumbnail geometry: fit scale, inner surface
// size, and placeholder outlines with scale-compensated border widths.
export * from './layout-preview';
// Which layouts the New Slide / Layout menus offer: master scoping and
// duplicate-name collapsing, plus the active-entry test.
export * from './layout-gallery';
// Canonical "Office Standard Colors" 10-swatch catalogue for font-colour /
// highlight-colour (and future fill/line-colour) pickers, shared by every
// binding instead of each hardcoding its own copy.
export * from './color-swatches';

// PowerPoint-style title bar (AutoSave toggle + quick access + file name +
// search) and the shared IndexedDB autosave recovery store behind it. Pure
// logic + class tokens; each binding renders its own thin view from these.
export * from './title-bar';
// The same chrome measurements as plain values, for the two bindings whose
// stylesheets cannot read a Tailwind class, plus the one zoom step all five
// share. Both exist so a hand-ported binding has something to derive from.
export * from './chrome-metrics';
export * from './zoom-step';
export * from './command-search';
export * from './autosave-store';
export * from './autosave-tick';
// Who wins when the host's `autosave` prop and the user's AutoSave toggle
// disagree (the prop is a ceiling, the toggle a preference inside it), plus the
// one cadence rule and the debounce cap that makes both engine shapes promise
// the same thing.
export * from './autosave-policy';
// "Is there a recoverable snapshot for this deck, and what should the prompt
// say?" One decision, five dialogs.
export * from './autosave-recovery';
export * from './backstage';
export * from './backstage-cards';
export * from './master-page-layout';
export * from './master-view';
export * from './master-view-editing';
export * from './virtualized-list';
export * from './document-statistics';
export * from './used-fonts';
export * from './font-availability';
export * from './password-protection';
// One decision for all five bindings: a captured password means the deck is
// serialised through `saveEncrypted` (OLE2 container), never `save` (ZIP).
export * from './deck-save-encryption';
export * from './viewer-preferences';
export * from './presentation-setup';
// PowerPoint's precedence for a click during a running show: an on-slide
// Action Setting first, then live content that owns its own click, then
// click-to-advance.
export * from './presentation-action';
// Only action shapes, media transport and links take the pointer while a show
// runs; the rest of the slide is scenery the click passes through.
export * from './presentation-hit-test';
export * from './presentation-show-order';
// The rail / sorter cue for a slide `presentation-show-order` will skip: the
// neutral marker attribute, the shared slash mark, and the description id that
// announces the state without touching the tile's accessible name.
export * from './hidden-slide-cue';
export * from './presentation-subtitles';
export * from './account';
export * from './viewer-prefs-storage';
// Toolbar action / ribbon-tab visibility: the ToolbarActionId catalogue and
// TOOLBAR_TABS registry each binding's `hiddenActions` prop is built on.
export * from './toolbar-actions';
// File > Options parity: schema, store, persistence, and behavior helpers
// behind the PowerPoint-style Options dialog in every binding.
export * from './options';

// small helper extractions (wave 2)
// OLE placeholder icon SVG-fragment primitives (rect/line/text builders +
// the per-type shape table), shared by every binding's OLE renderer.
// (`buildSmartArtPreviewElement` + its constants, and `buildQueryLinkUrl` /
// `buildShareUrl`, are new exports of the already-star-exported
// `preview-elements` / `broadcast-helpers` above; `modelDataToBlobUrl` /
// `DEFAULT_MODEL_MIME` likewise ride the existing `model3d-scene` export.)
export * from './ole-icon-primitives';
// The one `hexToRgbUnit` for render/'s SVG duotone `<filter>` builders.
export * from './color-units';
// Cross-slide ("play across slides") audio registration, split out of
// `media-playback.ts` purely to stay under the file-size cap.
export * from './cross-slide-audio';
// Presentation ink-annotation overlay pure helpers (stroke path + cursor).
export * from './annotation-overlay';

// editor + playback engines (wave 2)
// Click-group step application / staged-build RAF reveal / auto-advance chain
// that drives a running slide show, extracted from four near-identical
// per-binding copies (Vue/Angular/Svelte/Vanilla `*animation-playback-helpers`).
export * from './animation-playback-engine';
// Shift-to-lock-aspect resize + arrow-key nudge math for the editing overlay.
export * from './editor-geometry';
// Pure, immutable PptxSlide[] mutations (CRUD/z-order/notes) the editor
// composables/services commit through.
export * from './editor-mutations';
// Pointer move/resize/rotate gesture state machine for the editing overlay.
export * from './editor-gestures';
// Read a contenteditable inline-edit surface's plain text back out.
export * from './inline-text-extract';

// inspector option lists (wave 2)
// Stroke/dash pattern picker: the 12 ST_PresetLineDashVal values.
export * from './stroke-dash-options';
// Compound-line / line-join / line-cap picker option lists.
export * from './stroke-line-style-options';
// Ribbon Arrange group shape-level extras gating (Group/Ungroup/stroke width).
export * from './arrange-extras';
// "Show Gridlines" checkbox: toggles the value axis's majorGridlines, not the
// dead style.hasGridlines field.
export * from './chart-gridlines-toggle';
// Series "use secondary axis" checkbox: axisId resolution against chartData.axes.
export * from './chart-secondary-axis';

// presentation parity descriptors (wave 2)
// Placeholder prompt text ("Click to add title"): edit-only, never Present/export/thumbnail.
export * from './placeholder-prompt';
// Slide-size Maximize/Ensure Fit rescale (x/y/width/height + font sizes).
export * from './slide-size-rescale';
// Write-protection recommendation (p:modifyVerifier / docProps _MarkAsFinal).
export * from './read-only-recommendation';
// getCompatibilityWarnings() -> toast descriptors, deduped by code.
export * from './compatibility-warning-toasts';
// Picture "Crop to Shape" clip-path (reuses the shared shape-geometry cascade).
export * from './crop-shape-clip';
// ActiveX control overlay geometry/label/fallback-image.
export * from './activex-overlay-view';
// a14 Corrections/Color panel CSS + SVG sharpen filter (sharpenSoften/brightnessContrast/colorTemperature/colorSaturation).
export * from './image-effect-corrections';

// chart subtypes (wave 2)
// bar3D column/bar shape geometry (box/cylinder/cone[ToMax]/pyramid[ToMax])
// for the interactive three.js bar3D scene.
export * from './bar-chart-3d-geometry';
// Inspector option lists + pure patch builders for bar3D shape, radar style,
// and surface wireframe.
export * from './chart-subtype-options';
