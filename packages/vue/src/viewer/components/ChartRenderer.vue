<script setup lang="ts">
import type { PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import type {
	ChartViewModel,
	ElementAnimationState,
	PlotLayout,
	ValueRange,
} from 'pptx-viewer-shared';
import {
	applyChartBuildReveal,
	chartAreaFill,
	chartPlaceholderLabel,
	computeLayout,
	computeValueRange,
	resolveCategoryLabels,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useChartCanvasInteraction } from '../composables/chart-canvas-interaction';
import { getContainerStyle } from '../composables/element-style';
import BoxWhiskerChart from './chart/BoxWhiskerChart.vue';
import { resolveRenderKind, SHARED_VIEW_MODEL_KINDS } from './chart/chart-render-kind';
import type { RenderKind } from './chart/chart-render-kind';
import { buildVueChartViewModel } from './chart/chart-view-model';
import ChartChrome from './chart/ChartChrome.vue';
import ChartEditOverlays from './chart/ChartEditOverlays.vue';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';
import ComboChart from './chart/ComboChart.vue';
import FunnelChart from './chart/FunnelChart.vue';
import HistogramChart from './chart/HistogramChart.vue';
import RegionMapChart from './chart/RegionMapChart.vue';
import StockChart from './chart/StockChart.vue';
import SunburstChart from './chart/SunburstChart.vue';
import SurfaceChart from './chart/SurfaceChart.vue';
import TreemapChart from './chart/TreemapChart.vue';
import WaterfallChart from './chart/WaterfallChart.vue';

/**
 * ChartRenderer: Vue port of the React chart renderer (`viewer/utils/chart.tsx`
 * and friends). Renders a PPTX chart element as an inline SVG.
 *
 * Chart types via the shared `buildChartViewModel` engine (`ChartViewModelSvg`):
 *   - bar / column (clustered, stacked, percentStacked)
 *   - line / line3D, area / area3D, scatter, bubble
 *   - pie / doughnut / pie3D, radar
 *   These honour secondary value axes, log / display-unit axes, and trendline /
 *   error-bar / axis-title / data-table overlays inside the shared engine.
 *
 * Chart types still on bespoke Vue components:
 *   - waterfall / combo / stock  - axis `<svg>` + `ChartChrome` + own component
 *   - funnel / sunburst          - own no-axis components
 *   - treemap / surface          - own SVG mesh / rectangles
 *   - histogram / boxWhisker     - own shared-backed components
 *   - regionMap                  - choropleth map (`RegionMapChart.vue`)
 */
const props = defineProps<{
	element: PptxElement;
	zIndex: number;
	mediaDataUrls?: Map<string, string>;
	/** True only on the primary editable canvas: enables direct chart editing. */
	interactive?: boolean;
	/** Emit the data-pptx-element marker even when not interactive (template layer). */
	marked?: boolean;
	/**
	 * Native-animation playback state. When it carries a staged chart build
	 * (`build.kind === 'chart'`) the chart reveals its series / categories / cells
	 * progressively via the shared `applyChartBuildReveal`.
	 */
	animationState?: ElementAnimationState;
}>();

const { t } = useI18n();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

// ── Direct on-canvas editing ─────────────────────────────────────
// Active only when the chart is selected + editable (gated inside the
// composable via the injected chart-canvas-edit context). During a value
// drag `renderedElement` carries the local preview chart data; the edit is
// committed once on release through the normal element-update path.
const rootEl = ref<HTMLElement | null>(null);
const {
	interactiveClass,
	renderedElement,
	dragLabel,
	titleDraft,
	onPointerdown,
	onPointermove,
	onPointerup,
	onDblclick,
	setTitleDraft,
	commitTitle,
	cancelTitle,
} = useChartCanvasInteraction({
	element: () => props.element,
	interactive: () => props.interactive === true,
	rootEl,
	buildViewModel: buildVueChartViewModel,
});

/** Staged chart-build descriptor, when an active native animation reveals one. */
const chartBuild = computed(() => {
	const build = props.animationState?.build;
	return build?.kind === 'chart' ? build : undefined;
});

/**
 * The chart element with its data trimmed to the stages revealed at the current
 * build progress (drag preview wins first). Whole-chart / no-build renders return
 * the element unchanged. Mirrors React's `ChartElementView` `renderedElement`.
 */
const revealedElement = computed<PptxElement>(() => {
	const el = renderedElement.value;
	const build = chartBuild.value;
	if (!build || el.type !== 'chart' || !el.chartData) {
		return el;
	}
	const revealed = applyChartBuildReveal(el.chartData, build);
	return revealed === el.chartData ? el : { ...el, chartData: revealed };
});

/** Narrowed chart data, or undefined when the element is not a chart / empty. */
const chartData = computed<PptxChartData | undefined>(() => {
	const el = revealedElement.value;
	if (el.type !== 'chart') {
		return undefined;
	}
	const data = el.chartData;
	if (!data || data.series.length === 0) {
		return undefined;
	}
	return data;
});

const chartType = computed<PptxChartType>(() => chartData.value?.chartType ?? 'bar');

const categoryLabels = computed<string[]>(() =>
	chartData.value ? resolveCategoryLabels(chartData.value) : [],
);

/** Which renderer to dispatch to (pure dispatch table in `chart-render-kind`). */
const renderKind = computed<RenderKind>(() => resolveRenderKind(chartData.value));

const isPlaceholder = computed(() => renderKind.value === 'placeholder');

const placeholderLabel = computed(() =>
	chartPlaceholderLabel(chartType.value, (key, params) => t(key, params ?? {})),
);

// ── Shared layout ────────────────────────────────────────────────

const style = computed(() => chartData.value?.style);
const legendPos = computed(() => style.value?.legendPosition || 'b');

/**
 * Chart-area background. `undefined` when the deck declares `<a:noFill/>` on
 * `c:chartSpace`, in which case no rect is painted at all.
 */
const areaFill = computed(() => chartAreaFill(chartData.value));

/** Plot layout for axis-based charts (combo / stock / waterfall / surface). */
const layout = computed<PlotLayout>(() =>
	computeLayout(props.element.width, props.element.height, style.value, true, legendPos.value),
);

/** Radar / sunburst / treemap / funnel use a no-axis layout. */
const noAxisLayout = computed<PlotLayout>(() =>
	computeLayout(props.element.width, props.element.height, style.value, false, legendPos.value),
);

const svgWidth = computed(() => layout.value.svgWidth);
const svgHeight = computed(() => layout.value.svgHeight);

/** Value range for the bespoke combo / stock / waterfall / surface overlays. */
const barRange = computed<ValueRange>(() =>
	chartData.value ? computeValueRange(chartData.value.series) : { min: 0, max: 1, span: 1 },
);

// ── Shared view-model engine (pie / doughnut / radar + cartesian) ─
//
// Pie / doughnut, radar, and the whole cartesian family (bar / column / line /
// area / scatter / bubble, including clustered / stacked / percentStacked and
// log / display-unit / secondary value axes plus trendline / error-bar /
// axis-title / data-table overlays) are fully covered by the framework-agnostic
// `buildChartViewModel` engine in pptx-viewer-shared. Vue projects its
// view-model through `ChartViewModelSvg.vue` (mirroring React's
// `renderChartViewModel`), so React / Vue / Angular share one geometry / layout
// engine. Vue's style-id palette is threaded in via `buildVueChartViewModel`,
// so only colour stays Vue-specific, not geometry.

/** Render kinds projected through the shared view-model engine. */
const usesSharedViewModel = computed(() => SHARED_VIEW_MODEL_KINDS.has(renderKind.value));

/**
 * Shared view-model for the kinds above, with Vue's palette threaded in.
 * Built from `renderedElement` so an in-flight value drag previews live.
 */
const sharedViewModel = computed<ChartViewModel | undefined>(() =>
	usesSharedViewModel.value ? buildVueChartViewModel(revealedElement.value) : undefined,
);

/** Pie / doughnut / radar keep their square `xMidYMid meet` aspect ratio. */
const sharedAspectRatio = computed<'none' | 'xMidYMid meet'>(() =>
	renderKind.value === 'pie' || renderKind.value === 'radar' ? 'xMidYMid meet' : 'none',
);
</script>

<template>
	<div
		ref="rootEl"
		class="pptx-vue-element pptx-vue-chart"
		:class="interactiveClass"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive || marked ? 'true' : undefined"
		@pointerdown="onPointerdown"
		@pointermove="onPointermove"
		@pointerup="onPointerup"
		@dblclick="onDblclick"
	>
		<!-- Labelled placeholder for unsupported / deferred chart types -->
		<div v-if="isPlaceholder" class="pptx-vue-placeholder pptx-vue-chart-placeholder">
			{{ placeholderLabel }}
		</div>

		<!-- Shared view-model engine: pie / doughnut / radar + the cartesian
		     family (bar / column / line / area / scatter / bubble, incl.
		     clustered / stacked / percentStacked, secondary / log /
		     display-unit axes, and trendline / error-bar / axis-title /
		     data-table overlays). Pie / radar keep a square aspect ratio. -->
		<ChartViewModelSvg
			v-else-if="usesSharedViewModel && sharedViewModel"
			:element-id="element.id"
			:vm="sharedViewModel"
			:preserve-aspect-ratio="sharedAspectRatio"
		/>

		<!-- Sunburst: concentric rings (no axes), shared view-model engine -->
		<SunburstChart v-else-if="renderKind === 'sunburst'" :element="revealedElement" />

		<!-- Treemap: hierarchical rectangles (no axes) -->
		<svg
			v-else-if="renderKind === 'treemap'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${noAxisLayout.svgWidth} ${noAxisLayout.svgHeight}`"
			preserveAspectRatio="none"
		>
			<rect
				v-if="areaFill"
				:x="0"
				:y="0"
				:width="noAxisLayout.svgWidth"
				:height="noAxisLayout.svgHeight"
				:fill="areaFill"
			/>
			<text
				v-if="style?.hasTitle"
				:x="noAxisLayout.svgWidth / 2"
				y="14"
				text-anchor="middle"
				font-size="12"
				font-weight="600"
				fill="#1e293b"
			>
				{{ chartData?.title || 'Chart' }}
			</text>
			<TreemapChart
				v-if="chartData"
				:chart-data="chartData"
				:layout="noAxisLayout"
				:categories="categoryLabels"
			/>
		</svg>

		<!-- Funnel: descending trapezoids (no axes), shared view-model engine -->
		<FunnelChart v-else-if="renderKind === 'funnel'" :element="revealedElement" />

		<!-- Histogram: contiguous bars, shared view-model engine -->
		<HistogramChart v-else-if="renderKind === 'histogram'" :element="revealedElement" />

		<!-- Box-and-whisker: shared view-model engine -->
		<BoxWhiskerChart v-else-if="renderKind === 'boxWhisker'" :element="revealedElement" />

		<!-- Surface: isometric 2.5D mesh (own SVG, no axis chrome) -->
		<svg
			v-else-if="renderKind === 'surface'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${svgWidth} ${svgHeight}`"
			preserveAspectRatio="none"
		>
			<rect v-if="areaFill" :x="0" :y="0" :width="svgWidth" :height="svgHeight" :fill="areaFill" />
			<text
				v-if="style?.hasTitle"
				:x="svgWidth / 2"
				y="14"
				text-anchor="middle"
				font-size="12"
				font-weight="600"
				fill="#1e293b"
			>
				{{ chartData?.title || 'Chart' }}
			</text>
			<SurfaceChart
				v-if="chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
				:categories="categoryLabels"
			/>
		</svg>

		<!-- Region map: choropleth world map (no axes; component draws its own bg) -->
		<svg
			v-else-if="renderKind === 'regionMap'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${noAxisLayout.svgWidth} ${noAxisLayout.svgHeight}`"
			preserveAspectRatio="xMidYMid meet"
		>
			<RegionMapChart
				v-if="chartData"
				:chart-data="chartData"
				:layout="noAxisLayout"
				:categories="categoryLabels"
			/>
		</svg>

		<!-- Bespoke axis-based charts the shared engine does not yet cover:
		     waterfall / combo / stock. Chrome (gridlines / axes / category
		     labels / legend) is drawn by ChartChrome around the plot. -->
		<svg
			v-else
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${svgWidth} ${svgHeight}`"
			preserveAspectRatio="none"
		>
			<rect v-if="areaFill" :x="0" :y="0" :width="svgWidth" :height="svgHeight" :fill="areaFill" />

			<ChartChrome
				v-if="chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
				:categories="categoryLabels"
				category-axis-style="bar"
			/>

			<!-- Waterfall -->
			<WaterfallChart
				v-if="renderKind === 'waterfall' && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
				:categories="categoryLabels"
			/>

			<!-- Combo (column + line) -->
			<ComboChart
				v-else-if="renderKind === 'combo' && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
				:categories="categoryLabels"
			/>

			<!-- Stock (OHLC candlestick) -->
			<StockChart
				v-else-if="renderKind === 'stock' && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
				:categories="categoryLabels"
			/>
		</svg>

		<!-- Drag value badge + inline title editor (direct on-canvas editing) -->
		<ChartEditOverlays
			:drag-label="dragLabel"
			:title-draft="titleDraft"
			@title-input="setTitleDraft"
			@title-commit="commitTitle"
			@title-cancel="cancelTitle"
		/>
	</div>
</template>

<style scoped>
.pptx-vue-chart {
	pointer-events: none;
}

/* On the editable canvas the chart opts back into pointer events so it can be
   click-selected like any other element (mirrors the SmartArt editable opt-in);
   thumbnails / export / presentation stay click-transparent. */
.pptx-vue-chart.pptx-vue-chart-selectable {
	pointer-events: auto;
}

.pptx-vue-chart-svg {
	width: 100%;
	height: 100%;
	display: block;
}

.pptx-vue-chart-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	font-size: 11px;
	color: #475569;
	background: #f1f5f9;
	border: 1px dashed #cbd5e1;
	box-sizing: border-box;
}
</style>
