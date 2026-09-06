/**
 * `animation-timeline-build-descriptors` - staged-build (`p:bldChart` /
 * `p:bldDgm`) reveal descriptor types, split out of `animation-timeline-types`
 * to keep that module under the file-size limit. Re-exported from
 * `animation-timeline-types` so existing imports are unaffected.
 *
 * @module render/animation-timeline-build-descriptors
 */

/**
 * Normalized staged-reveal mode for a chart graphic frame, derived from the
 * OOXML `a:bldChart/@bld` (or `p:bldOleChart/@bld`) token:
 *  - `asOne`      the whole chart appears at once (`allAtOnce`).
 *  - `bySeries`   one data series is revealed per stage (`series`).
 *  - `byCategory` one category is revealed per stage (`category`).
 *  - `byElement`  one series/category ELEMENT is revealed per stage
 *                 (`seriesElement` / `categoryElement`).
 */
export type ChartBuildMode = 'asOne' | 'bySeries' | 'byCategory' | 'byElement';

/**
 * Normalized staged-reveal mode for a SmartArt diagram, derived from the OOXML
 * `a:bldDgm/@bld` or `p:bldDgm/@bld` token:
 *  - `asOne`        the whole diagram appears at once (`whole` / `allAtOnce`).
 *  - `byOne`        one node is revealed per stage (`one`, and the assorted
 *                   `depthBy*` / `breadthBy*` / directional traversals).
 *  - `byLvl`        levels are revealed one element at a time (`lvlOne`).
 *  - `byLvlAtOnce`  a whole level is revealed per stage (`lvlAtOnce`).
 */
export type DiagramBuildMode = 'asOne' | 'byOne' | 'byLvl' | 'byLvlAtOnce';

/**
 * Static staged-build descriptor attached to a {@link import('./animation-timeline-step').TimelineStep}.
 * Carries only the graphic KIND + normalized MODE; the per-tick reveal
 * fraction is computed separately (see {@link ElementBuildState.progress})
 * because it is a function of playback time, not of the parsed animation.
 *
 * The chart variant's `animateBackground` mirrors `a:bldChart/@animBg`
 * (default `true`): whether the chart's background/axes/gridlines/legend
 * arrive WITH the first revealed stage (`true`, the default) or are shown
 * throughout regardless of build progress (`false`). See
 * `chart-reveal-descriptor`'s `resolveChartRevealDescriptor`.
 */
export type StepBuildDescriptor =
	| { kind: 'chart'; mode: ChartBuildMode; animateBackground?: boolean }
	| { kind: 'diagram'; mode: DiagramBuildMode };

/**
 * `p:spTgt/p:graphicEl` (CT_TLGraphicalObjectBuildElement, ECMA-376 S19.5.34)
 * index data carried by a {@link import('./animation-timeline-step').TimelineStep}'s
 * source animation target, when a deck authors one effect per chart
 * series/category/element instead of a single `p:bldGraphic` staged reveal.
 * Only `seriesIdx` set means "whole series"; only `categoryIdx` set means
 * "whole category"; both set means a single (series, category) cell. See
 * `chart-reveal-descriptor`.
 *
 * `id` is the diagram counterpart (`p:dgm/@id`): the SmartArt data-model point
 * id a per-node `p:bldDgm` effect reveals (matches `PptxSmartArtNode.id`).
 * `bldStep` doubles as the diagram build step (`sp` / `bg`) for a `dgm`-kind
 * target; see `diagram-reveal-descriptor`.
 */
export interface TimelineStepGraphicElement {
	seriesIdx?: number;
	categoryIdx?: number;
	id?: string;
	bldStep?: string;
}

/**
 * One authored `p:graphicEl` reveal unit resolved onto a chart, per
 * `TimelineStepGraphicElement`'s "both indices set" case: a single (series,
 * category) cell revealed by a `bldStep="seriesEl"`/`"categoryEl"` effect.
 */
export interface ChartRevealPoint {
	seriesIdx: number;
	categoryIdx: number;
}

/**
 * Playback-time chart reveal state derived from AUTHORED `p:graphicEl`
 * indices (see `chart-reveal-descriptor`'s `resolveChartRevealDescriptor`),
 * rather than from click-count/time progress. Present on
 * {@link import('./animation-timeline-group').ElementAnimationState.chartReveal}
 * only when every fired chart-build step for the element carried index data;
 * a renderer prefers this over the progress-based `build`/`ElementBuildState`
 * path when present, since it reflects the real authored reveal set (correct
 * even for a reversed-order or gapped chart build), and falls back to `build`
 * when absent.
 */
export interface ChartRevealDescriptor {
	/**
	 * Whether the chart's background/axes/gridlines/legend should currently be
	 * visible: always `true` when the chart's `animateBackground` is `false`
	 * ("shown throughout"), otherwise `true` from the first revealed stage
	 * onward.
	 */
	background: boolean;
	/** Whole series revealed by a `bldStep="series"` effect. */
	series: ReadonlySet<number>;
	/** Whole categories revealed by a `bldStep="category"` effect. */
	categories: ReadonlySet<number>;
	/** Individual cells revealed by a `bldStep="seriesEl"`/`"categoryEl"` effect. */
	points: readonly ChartRevealPoint[];
}

/**
 * Playback-time SmartArt diagram reveal state derived from AUTHORED
 * `p:graphicEl/p:dgm/@id` indices (see `diagram-reveal-descriptor`'s
 * `resolveDiagramRevealDescriptor`), rather than from click-count/time
 * progress. Present on
 * {@link import('./animation-timeline-group').ElementAnimationState.diagramReveal}
 * only when every fired diagram-build step for the element carried
 * `p:graphicEl` data. A SmartArt renderer prefers this over the
 * progress-based `build` / {@link ElementBuildState} path when present, since
 * it reflects the real authored reveal set (correct even for a
 * reversed-order or by-branch build), and falls back to `build` when absent.
 */
export interface DiagramRevealDescriptor {
	/**
	 * Whether the diagram's background/connector chrome should currently be
	 * visible: `true` once any node-revealing or background-revealing
	 * (`bldStep="bg"`) step has fired.
	 */
	background: boolean;
	/** Data-model point ids (`PptxSmartArtNode.id`) revealed so far. */
	nodeIds: ReadonlySet<string>;
}

/**
 * Playback-time staged-build state surfaced on
 * {@link import('./animation-timeline-group').ElementAnimationState}.
 * `progress` is the 0..1 fraction of the build revealed at the current
 * playback time; a consumer maps it to its own item COUNT (see
 * `revealedStageCount`).
 */
export type ElementBuildState =
	| { kind: 'chart'; mode: ChartBuildMode; progress: number }
	| { kind: 'diagram'; mode: DiagramBuildMode; progress: number };

/** Which shape paint property an active `p:animClr` color animation targets. */
export type ColorAnimationTarget = 'fill' | 'stroke';
