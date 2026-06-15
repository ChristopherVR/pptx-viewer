<script setup lang="ts">
import type { PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import {
	computeLayout,
	computeValueRange,
	formatAxisValue,
	paletteColor,
	resolveCategoryLabels,
	seriesColor,
	valueToY,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import BoxWhiskerChart from './chart/BoxWhiskerChart.vue';
import BubbleChart from './chart/BubbleChart.vue';
import ChartChrome from './chart/ChartChrome.vue';
import ChartTrendlines from './chart/ChartTrendlines.vue';
import ComboChart from './chart/ComboChart.vue';
import FunnelChart from './chart/FunnelChart.vue';
import HistogramChart from './chart/HistogramChart.vue';
import RadarChart from './chart/RadarChart.vue';
import RegionMapChart from './chart/RegionMapChart.vue';
import ScatterChart from './chart/ScatterChart.vue';
import StockChart from './chart/StockChart.vue';
import SunburstChart from './chart/SunburstChart.vue';
import SurfaceChart from './chart/SurfaceChart.vue';
import TreemapChart from './chart/TreemapChart.vue';
import WaterfallChart from './chart/WaterfallChart.vue';

/**
 * ChartRenderer — Vue port of the React chart renderer (`viewer/utils/chart.tsx`
 * and friends). Renders a PPTX chart element as an inline SVG.
 *
 * Implemented chart types:
 *   - bar / column (clustered)        — React `chart-bar.tsx`
 *   - stacked + 100%-stacked bar      — React `chart-stacked-bar.tsx`
 *   - line / line3D                   — React `chart-area-line.tsx`
 *   - area / area3D                   — React `chart-area-line.tsx`
 *   - pie / doughnut / pie3D          — React `chart-pie.tsx`
 *   - radar                           — React `chart-radar.tsx`
 *   - scatter                         — React `chart-scatter-bubble.tsx`
 *   - bubble                          — React `chart-scatter-bubble.tsx`
 *   - waterfall                       — React `chart-waterfall-combo.tsx`
 *   - funnel                          — React `chart-sunburst-funnel.tsx`
 *   - treemap                         — React `chart-surface-treemap.tsx`
 *   - sunburst                        — React `chart-sunburst-funnel.tsx`
 *   - combo (column+line)             — React `chart-waterfall-combo.tsx`
 *   - stock (HLC / OHLC)              — React `chart-stock.tsx`
 *   - histogram                       — React `chart-bar.tsx`
 *   - boxWhisker                      — React `chart-bar.tsx`
 *   - surface                         — isometric SVG mesh (`SurfaceChart.vue`)
 *   - regionMap                       — choropleth map (`RegionMapChart.vue`)
 *   - trendlines (regression overlays) — React `chart-trendlines.tsx`
 *   - chrome (title, axes, gridlines, legend, data labels) — `chart-chrome.tsx`
 *
 * Remaining TODOs:
 *   // TODO(vue): port secondary axes (right-hand value axis for series on a
 *   //   second axisId) + data tables. Log/display-unit value axes are also not
 *   //   yet honoured — the value axis is always linear.
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
const styleId = computed(() => chartData.value?.style?.styleId);
const colorPalette = computed(() => chartData.value?.colorPalette);
const legendPos = computed(() => style.value?.legendPosition || 'b');
const hasDataLabels = computed(() => Boolean(style.value?.hasDataLabels));

/** Plot layout for axis-based charts (bar/line/area/stacked and most exotic types). */
const layout = computed<PlotLayout>(() =>
	computeLayout(props.element.width, props.element.height, style.value, true, legendPos.value),
);

/** Radar / sunburst / treemap / funnel use a no-axis layout. */
const noAxisLayout = computed<PlotLayout>(() =>
	computeLayout(props.element.width, props.element.height, style.value, false, legendPos.value),
);

const svgWidth = computed(() => layout.value.svgWidth);
const svgHeight = computed(() => layout.value.svgHeight);

const categoryAxisStyle = computed<'bar' | 'line'>(() =>
	renderKind.value === 'line' || renderKind.value === 'area' ? 'line' : 'bar',
);

// ── Bar (clustered) ──────────────────────────────────────────────

interface BarRect {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	labelX?: number;
	labelY?: number;
	labelText?: string;
}

const barRange = computed<ValueRange>(() =>
	chartData.value ? computeValueRange(chartData.value.series) : { min: 0, max: 1, span: 1 },
);

const barRects = computed<BarRect[]>(() => {
	const data = chartData.value;
	if (!data || renderKind.value !== 'bar') {
		return [];
	}
	const l = layout.value;
	const range = barRange.value;
	const catCount = Math.max(categoryLabels.value.length, 1);
	const seriesCount = data.series.length;
	const barGroupWidth = l.plotWidth / catCount;
	const singleBarWidth = (barGroupWidth * 0.7) / Math.max(seriesCount, 1);
	const groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;

	const out: BarRect[] = [];
	for (let ci = 0; ci < catCount; ci++) {
		data.series.forEach((series, si) => {
			const val = series.values[ci] ?? 0;
			const x = l.plotLeft + barGroupWidth * ci + groupOffset + singleBarWidth * si;
			const zeroY = valueToY(0, range, l.plotTop, l.plotBottom);
			const valY = valueToY(val, range, l.plotTop, l.plotBottom);
			const y = Math.min(zeroY, valY);
			const h = Math.max(Math.abs(zeroY - valY), 1);
			out.push({
				x,
				y,
				width: singleBarWidth,
				height: h,
				fill: seriesColor(series, si, styleId.value, colorPalette.value),
				labelX: hasDataLabels.value ? x + singleBarWidth / 2 : undefined,
				labelY: hasDataLabels.value ? (val >= 0 ? y - 4 : y + h + 10) : undefined,
				labelText: hasDataLabels.value ? formatAxisValue(val) : undefined,
			});
		});
	}
	return out;
});

// ── Stacked bar ──────────────────────────────────────────────────

interface StackRect {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	labelX?: number;
	labelY?: number;
	labelText?: string;
}

const isPercentStacked = computed(() => chartData.value?.grouping === 'percentStacked');

const stackRange = computed<ValueRange>(() => {
	const data = chartData.value;
	if (!data || renderKind.value !== 'stackedBar') {
		return { min: 0, max: 1, span: 1 };
	}
	const catCount = Math.max(categoryLabels.value.length, 1);
	let stackMax = 0;
	let stackMin = 0;
	if (isPercentStacked.value) {
		stackMax = 100;
		stackMin = 0;
	} else {
		for (let ci = 0; ci < catCount; ci++) {
			let posSum = 0;
			let negSum = 0;
			data.series.forEach((s) => {
				const v = s.values[ci] ?? 0;
				if (v >= 0) {
					posSum += v;
				} else {
					negSum += v;
				}
			});
			stackMax = Math.max(stackMax, posSum);
			stackMin = Math.min(stackMin, negSum);
		}
	}
	const min = Math.min(stackMin, 0);
	const max = Math.max(stackMax, 0);
	return { min, max, span: Math.max(max - min, 1) };
});

const stackRects = computed<StackRect[]>(() => {
	const data = chartData.value;
	if (!data || renderKind.value !== 'stackedBar') {
		return [];
	}
	const l = layout.value;
	const range = stackRange.value;
	const catCount = Math.max(categoryLabels.value.length, 1);
	const barGroupWidth = l.plotWidth / catCount;
	const barWidth = barGroupWidth * 0.6;
	const barOffset = (barGroupWidth - barWidth) / 2;
	const percent = isPercentStacked.value;

	const out: StackRect[] = [];
	for (let ci = 0; ci < catCount; ci++) {
		let posRunning = 0;
		let negRunning = 0;
		const catTotal = data.series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0) || 1;

		data.series.forEach((series, si) => {
			const rawVal = series.values[ci] ?? 0;
			const val = percent ? (catTotal > 0 ? (rawVal / catTotal) * 100 : 0) : rawVal;
			const isNeg = val < 0;
			const base = isNeg ? negRunning : posRunning;
			const top = base + val;

			const x = l.plotLeft + barGroupWidth * ci + barOffset;
			const baseY = valueToY(base, range, l.plotTop, l.plotBottom);
			const topY = valueToY(top, range, l.plotTop, l.plotBottom);
			const y = Math.min(baseY, topY);
			const h = Math.max(Math.abs(baseY - topY), 0.5);

			out.push({
				x,
				y,
				width: barWidth,
				height: h,
				fill: seriesColor(series, si, styleId.value, colorPalette.value),
				labelX: hasDataLabels.value && Math.abs(val) > 0 ? x + barWidth / 2 : undefined,
				labelY: hasDataLabels.value && Math.abs(val) > 0 ? y + h / 2 + 3 : undefined,
				labelText:
					hasDataLabels.value && Math.abs(val) > 0
						? percent
							? `${Math.round(val)}%`
							: formatAxisValue(val)
						: undefined,
			});

			if (isNeg) {
				negRunning += val;
			} else {
				posRunning += val;
			}
		});
	}
	return out;
});

// ── Line / Area ──────────────────────────────────────────────────

interface SeriesPoint {
	x: number;
	y: number;
	value: number;
}

interface LineSeries {
	color: string;
	points: SeriesPoint[];
	polylinePoints: string;
	areaPolygonPoints?: string;
}

const lineRange = computed<ValueRange>(() =>
	chartData.value ? computeValueRange(chartData.value.series) : { min: 0, max: 1, span: 1 },
);

const lineSeries = computed<LineSeries[]>(() => {
	const data = chartData.value;
	if (!data || (renderKind.value !== 'line' && renderKind.value !== 'area')) {
		return [];
	}
	const l = layout.value;
	const range = lineRange.value;
	const catCount = Math.max(categoryLabels.value.length, 2);
	const baselineY = valueToY(0, range, l.plotTop, l.plotBottom);
	const isArea = renderKind.value === 'area';

	const out: LineSeries[] = [];
	data.series.forEach((series, si) => {
		if (series.values.length === 0) {
			return;
		}
		const points = series.values.map((value, vi) => {
			const nx = catCount > 1 ? vi / (catCount - 1) : 0;
			const x = l.plotLeft + l.plotWidth * nx;
			const y = valueToY(value, range, l.plotTop, l.plotBottom);
			return { x, y, value };
		});
		const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
		const color = seriesColor(series, si, styleId.value, colorPalette.value);
		const last = points[points.length - 1];
		out.push({
			color,
			points,
			polylinePoints,
			areaPolygonPoints: isArea
				? `${l.plotLeft},${baselineY} ${polylinePoints} ${last.x},${baselineY}`
				: undefined,
		});
	});
	return out;
});

// ── Pie / Doughnut ───────────────────────────────────────────────

interface PieSlice {
	d: string;
	fill: string;
	labelX?: number;
	labelY?: number;
	labelText?: string;
}

interface PieLegendItem {
	x: number;
	y: number;
	color: string;
	label: string;
}

/** Pie charts use a square viewBox sized to the smaller element dimension. */
const pieSize = computed(() => Math.min(props.element.width, props.element.height));

const pieGeometry = computed(() => {
	const data = chartData.value;
	const size = pieSize.value;
	const titleOffset = style.value?.hasTitle ? 20 : 0;
	const legendOffset = style.value?.hasLegend ? 20 : 0;
	const cx = size / 2;
	const cy = titleOffset + (size - titleOffset - legendOffset) / 2;
	const outerR = (size - titleOffset - legendOffset) * 0.42;
	const innerR = chartType.value === 'doughnut' ? outerR * 0.55 : 0;
	const values = data?.series[0]?.values ?? [];
	const total = values.reduce((sum, v) => sum + Math.abs(v), 0) || 1;
	return { size, titleOffset, legendOffset, cx, cy, outerR, innerR, values, total };
});

const pieSlices = computed<PieSlice[]>(() => {
	const data = chartData.value;
	if (!data || renderKind.value !== 'pie') {
		return [];
	}
	const { cx, cy, outerR, innerR, values, total } = pieGeometry.value;
	const seriesColorOverride = data.series[0]?.color;
	let cumulativeAngle = -Math.PI / 2;

	return values.map((val, i) => {
		const sliceAngle = (Math.abs(val) / total) * Math.PI * 2;
		const startAngle = cumulativeAngle;
		cumulativeAngle += sliceAngle;
		const endAngle = cumulativeAngle;
		const largeArc = sliceAngle > Math.PI ? 1 : 0;
		const x1 = cx + outerR * Math.cos(startAngle);
		const y1 = cy + outerR * Math.sin(startAngle);
		const x2 = cx + outerR * Math.cos(endAngle);
		const y2 = cy + outerR * Math.sin(endAngle);
		const ix1 = cx + innerR * Math.cos(startAngle);
		const iy1 = cy + innerR * Math.sin(startAngle);
		const ix2 = cx + innerR * Math.cos(endAngle);
		const iy2 = cy + innerR * Math.sin(endAngle);

		const d =
			innerR > 0
				? `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc} 0 ${ix1},${iy1} Z`
				: `M${cx},${cy} L${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} Z`;

		let labelX: number | undefined;
		let labelY: number | undefined;
		let labelText: string | undefined;
		if (hasDataLabels.value) {
			const midAngle = startAngle + sliceAngle / 2;
			const labelR = outerR * 0.7;
			labelX = cx + labelR * Math.cos(midAngle);
			labelY = cy + labelR * Math.sin(midAngle);
			labelText = formatAxisValue(val);
		}

		return {
			d,
			fill: seriesColorOverride || paletteColor(i, styleId.value, colorPalette.value),
			labelX,
			labelY,
			labelText,
		};
	});
});

const pieLegend = computed<PieLegendItem[]>(() => {
	if (renderKind.value !== 'pie' || !style.value?.hasLegend || categoryLabels.value.length === 0) {
		return [];
	}
	const { size } = pieGeometry.value;
	const ly = legendPos.value === 't' ? (style.value?.hasTitle ? 24 : 6) : size - 10;
	const charW = 6;
	const gapW = 20;
	const totalW = categoryLabels.value.reduce((w, c) => w + c.length * charW + gapW, 0);
	let sx = (size - totalW) / 2;
	const out: PieLegendItem[] = [];
	categoryLabels.value.forEach((cat, i) => {
		out.push({
			x: sx,
			y: ly,
			color: paletteColor(i, styleId.value, colorPalette.value),
			label: cat,
		});
		sx += cat.length * charW + gapW;
	});
	return out;
});

// ── Trendlines (regression overlays) ─────────────────────────────

/** Whether trendline overlays apply to the active (axis-based) render kind. */
const showTrendlines = computed(
	() =>
		renderKind.value === 'bar' ||
		renderKind.value === 'stackedBar' ||
		renderKind.value === 'line' ||
		renderKind.value === 'area',
);

/** The value range the active axis plot is drawn against. */
const trendlineRange = computed<ValueRange>(() => {
	if (renderKind.value === 'stackedBar') {
		return stackRange.value;
	}
	if (renderKind.value === 'line' || renderKind.value === 'area') {
		return lineRange.value;
	}
	return barRange.value;
});

/** Bar-mode plots centre on category slots; line/area anchor at points. */
const trendlineMode = computed<'line' | 'bar'>(() =>
	renderKind.value === 'line' || renderKind.value === 'area' ? 'line' : 'bar',
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

		<!-- Pie / doughnut: square viewBox -->
		<svg
			v-else-if="renderKind === 'pie'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${pieGeometry.size} ${pieGeometry.size}`"
			preserveAspectRatio="xMidYMid meet"
		>
			<text
				v-if="style?.hasTitle"
				:x="pieGeometry.size / 2"
				y="14"
				text-anchor="middle"
				font-size="12"
				font-weight="600"
				fill="#1e293b"
			>
				{{ chartData?.title || 'Chart' }}
			</text>
			<path
				v-for="(slice, i) in pieSlices"
				:key="`slice-${i}`"
				:d="slice.d"
				:fill="slice.fill"
				stroke="white"
				stroke-width="1.5"
			/>
			<text
				v-for="(slice, i) in pieSlices.filter((s) => s.labelText !== undefined)"
				:key="`slice-dl-${i}`"
				:x="slice.labelX"
				:y="slice.labelY"
				text-anchor="middle"
				dominant-baseline="central"
				font-size="8"
				font-weight="600"
				fill="#fff"
			>
				{{ slice.labelText }}
			</text>
			<template v-for="(item, i) in pieLegend" :key="`pie-leg-${i}`">
				<rect :x="item.x" :y="item.y - 5" width="10" height="10" rx="2" :fill="item.color" />
				<text :x="item.x + 14" :y="item.y + 4" font-size="9" fill="#475569">{{ item.label }}</text>
			</template>
		</svg>

		<!-- Radar: spider-web layout (no axes) -->
		<svg
			v-else-if="renderKind === 'radar'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${noAxisLayout.svgWidth} ${noAxisLayout.svgHeight}`"
			preserveAspectRatio="xMidYMid meet"
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
			<RadarChart
				v-if="chartData"
				:chart-data="chartData"
				:layout="noAxisLayout"
				:categories="categoryLabels"
			/>
		</svg>

		<!-- Sunburst: concentric rings (no axes) -->
		<svg
			v-else-if="renderKind === 'sunburst'"
			class="pptx-vue-chart-svg"
			:viewBox="`0 0 ${noAxisLayout.svgWidth} ${noAxisLayout.svgHeight}`"
			preserveAspectRatio="xMidYMid meet"
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
			<SunburstChart v-if="chartData" :chart-data="chartData" :layout="noAxisLayout" />
		</svg>

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

		<!-- Funnel: descending trapezoids (no axes) -->
		<svg
			v-else-if="renderKind === 'funnel'"
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
			<FunnelChart
				v-if="chartData"
				:chart-data="chartData"
				:layout="noAxisLayout"
				:categories="categoryLabels"
			/>
		</svg>

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

		<!-- Axis-based charts: bar / stacked / line / area / scatter / bubble /
		     waterfall / combo / stock / histogram / boxWhisker -->
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
				:range="
					renderKind === 'stackedBar'
						? stackRange
						: renderKind === 'line' || renderKind === 'area'
							? lineRange
							: barRange
				"
				:categories="categoryLabels"
				:category-axis-style="categoryAxisStyle"
			/>

			<!-- Clustered bars -->
			<template v-if="renderKind === 'bar'">
				<rect
					v-for="(b, i) in barRects"
					:key="`bar-${i}`"
					:x="b.x"
					:y="b.y"
					:width="b.width"
					:height="b.height"
					:fill="b.fill"
					rx="1"
				/>
				<text
					v-for="(b, i) in barRects.filter((r) => r.labelText !== undefined)"
					:key="`bar-dl-${i}`"
					:x="b.labelX"
					:y="b.labelY"
					text-anchor="middle"
					font-size="7"
					fill="#334155"
				>
					{{ b.labelText }}
				</text>
			</template>

			<!-- Stacked bars -->
			<template v-else-if="renderKind === 'stackedBar'">
				<rect
					v-for="(b, i) in stackRects"
					:key="`sbar-${i}`"
					:x="b.x"
					:y="b.y"
					:width="b.width"
					:height="b.height"
					:fill="b.fill"
				/>
				<text
					v-for="(b, i) in stackRects.filter((r) => r.labelText !== undefined)"
					:key="`sbar-dl-${i}`"
					:x="b.labelX"
					:y="b.labelY"
					text-anchor="middle"
					font-size="7"
					font-weight="600"
					fill="#fff"
				>
					{{ b.labelText }}
				</text>
			</template>

			<!-- Area -->
			<template v-else-if="renderKind === 'area'">
				<g v-for="(s, si) in lineSeries" :key="`area-${si}`">
					<polygon :points="s.areaPolygonPoints" :fill="s.color" opacity="0.25" />
					<polyline fill="none" :stroke="s.color" stroke-width="2" :points="s.polylinePoints" />
				</g>
				<template v-if="hasDataLabels">
					<template v-for="(s, si) in lineSeries" :key="`area-dlg-${si}`">
						<text
							v-for="(p, vi) in s.points"
							:key="`area-dl-${si}-${vi}`"
							:x="p.x"
							:y="p.y - 6"
							text-anchor="middle"
							font-size="7"
							fill="#334155"
						>
							{{ formatAxisValue(p.value) }}
						</text>
					</template>
				</template>
			</template>

			<!-- Line -->
			<template v-else-if="renderKind === 'line'">
				<g v-for="(s, si) in lineSeries" :key="`line-${si}`">
					<polyline fill="none" :stroke="s.color" stroke-width="2.4" :points="s.polylinePoints" />
					<circle
						v-for="(p, vi) in s.points"
						:key="`line-dot-${si}-${vi}`"
						:cx="p.x"
						:cy="p.y"
						r="2.5"
						:fill="s.color"
					/>
					<template v-if="hasDataLabels">
						<text
							v-for="(p, vi) in s.points"
							:key="`line-dl-${si}-${vi}`"
							:x="p.x"
							:y="p.y - 7"
							text-anchor="middle"
							font-size="7"
							fill="#334155"
						>
							{{ formatAxisValue(p.value) }}
						</text>
					</template>
				</g>
			</template>

			<!-- Scatter -->
			<ScatterChart
				v-else-if="renderKind === 'scatter' && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
			/>

			<!-- Bubble -->
			<BubbleChart
				v-else-if="renderKind === 'bubble' && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
			/>

			<!-- Waterfall -->
			<WaterfallChart
				v-else-if="renderKind === 'waterfall' && chartData"
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

			<!-- Histogram -->
			<HistogramChart
				v-else-if="renderKind === 'histogram' && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
				:categories="categoryLabels"
			/>

			<!-- Box-and-whisker -->
			<BoxWhiskerChart
				v-else-if="renderKind === 'boxWhisker' && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="barRange"
				:categories="categoryLabels"
			/>

			<!-- Trendline overlays (drawn on top of bar / stacked / line / area). -->
			<ChartTrendlines
				v-if="showTrendlines && chartData"
				:chart-data="chartData"
				:layout="layout"
				:range="trendlineRange"
				:mode="trendlineMode"
				:style-id="styleId"
				:color-palette="colorPalette"
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
