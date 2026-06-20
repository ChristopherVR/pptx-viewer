<script setup lang="ts">
import type { PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel, PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { computeLayout, computeValueRange, resolveCategoryLabels } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import BoxWhiskerChart from './chart/BoxWhiskerChart.vue';
import { buildVueChartViewModel } from './chart/chart-view-model';
import ChartChrome from './chart/ChartChrome.vue';
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
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

/** Narrowed chart data, or undefined when the element is not a chart / empty. */
const chartData = computed<PptxChartData | undefined>(() => {
	if (props.element.type !== 'chart') {
		return undefined;
	}
	const data = props.element.chartData;
	if (!data || data.series.length === 0) {
		return undefined;
	}
	return data;
});

const chartType = computed<PptxChartType>(() => chartData.value?.chartType ?? 'bar');

const categoryLabels = computed<string[]>(() =>
	chartData.value ? resolveCategoryLabels(chartData.value) : [],
);

/** Which renderer to dispatch to. 'placeholder' covers the remaining deferred types. */
type RenderKind =
	| 'bar'
	| 'stackedBar'
	| 'line'
	| 'area'
	| 'pie'
	| 'radar'
	| 'scatter'
	| 'bubble'
	| 'waterfall'
	| 'funnel'
	| 'treemap'
	| 'sunburst'
	| 'combo'
	| 'stock'
	| 'histogram'
	| 'boxWhisker'
	| 'surface'
	| 'regionMap'
	| 'placeholder';

const renderKind = computed<RenderKind>(() => {
	const data = chartData.value;
	if (!data) {
		return 'placeholder';
	}
	const t = chartType.value;
	if (t === 'pie' || t === 'doughnut' || t === 'pie3D') {
		return 'pie';
	}
	if (t === 'area' || t === 'area3D') {
		return 'area';
	}
	if (t === 'line' || t === 'line3D') {
		return 'line';
	}
	if (t === 'bar' && (data.grouping === 'stacked' || data.grouping === 'percentStacked')) {
		return 'stackedBar';
	}
	if (t === 'bar' || t === 'bar3D') {
		return 'bar';
	}
	if (t === 'radar') {
		return 'radar';
	}
	if (t === 'scatter') {
		return 'scatter';
	}
	if (t === 'bubble') {
		return 'bubble';
	}
	if (t === 'waterfall') {
		return 'waterfall';
	}
	if (t === 'funnel') {
		return 'funnel';
	}
	if (t === 'treemap') {
		return 'treemap';
	}
	if (t === 'sunburst') {
		return 'sunburst';
	}
	if (t === 'combo') {
		return 'combo';
	}
	if (t === 'stock') {
		return 'stock';
	}
	if (t === 'histogram') {
		return 'histogram';
	}
	if (t === 'boxWhisker') {
		return 'boxWhisker';
	}
	if (t === 'surface') {
		return 'surface';
	}
	if (t === 'regionMap') {
		return 'regionMap';
	}
	return 'placeholder';
});

const isPlaceholder = computed(() => renderKind.value === 'placeholder');

const placeholderLabel = computed(() => `Chart: ${chartType.value}`);

// ── Shared layout ────────────────────────────────────────────────

const style = computed(() => chartData.value?.style);
const legendPos = computed(() => style.value?.legendPosition || 'b');

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
const usesSharedViewModel = computed(
	() =>
		renderKind.value === 'pie' ||
		renderKind.value === 'radar' ||
		renderKind.value === 'bar' ||
		renderKind.value === 'stackedBar' ||
		renderKind.value === 'line' ||
		renderKind.value === 'area' ||
		renderKind.value === 'scatter' ||
		renderKind.value === 'bubble',
);

/** Shared view-model for the kinds above, with Vue's palette threaded in. */
const sharedViewModel = computed<ChartViewModel | undefined>(() =>
	usesSharedViewModel.value ? buildVueChartViewModel(props.element) : undefined,
);

/** Pie / doughnut / radar keep their square `xMidYMid meet` aspect ratio. */
const sharedAspectRatio = computed<'none' | 'xMidYMid meet'>(() =>
	renderKind.value === 'pie' || renderKind.value === 'radar' ? 'xMidYMid meet' : 'none',
);
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-chart"
		:style="containerStyle"
		:data-element-id="element.id"
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
		<SunburstChart v-else-if="renderKind === 'sunburst'" :element="element" />

		<!-- Treemap: hierarchical rectangles (no axes) -->
		<svg
			v-else-if="renderKind === 'treemap'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${noAxisLayout.svgWidth} ${noAxisLayout.svgHeight}`"
			preserveAspectRatio="none"
		>
			<rect
				:x="0"
				:y="0"
				:width="noAxisLayout.svgWidth"
				:height="noAxisLayout.svgHeight"
				fill="#0f172a11"
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
		<FunnelChart v-else-if="renderKind === 'funnel'" :element="element" />

		<!-- Histogram: contiguous bars, shared view-model engine -->
		<HistogramChart v-else-if="renderKind === 'histogram'" :element="element" />

		<!-- Box-and-whisker: shared view-model engine -->
		<BoxWhiskerChart v-else-if="renderKind === 'boxWhisker'" :element="element" />

		<!-- Surface: isometric 2.5D mesh (own SVG, no axis chrome) -->
		<svg
			v-else-if="renderKind === 'surface'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${svgWidth} ${svgHeight}`"
			preserveAspectRatio="none"
		>
			<rect :x="0" :y="0" :width="svgWidth" :height="svgHeight" fill="#0f172a11" />
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
			<rect :x="0" :y="0" :width="svgWidth" :height="svgHeight" fill="#0f172a11" />

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
	</div>
</template>

<style scoped>
.pptx-vue-chart {
	pointer-events: none;
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
