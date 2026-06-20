<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { formatAxisValue, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * StockChart: Vue port of React `chart-stock.tsx`.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 * Supports 3-series (H/L/C) and 4-series (O/H/L/C) OHLC candlestick charts.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
	categories: ReadonlyArray<string>;
}>();

const hasDataLabels = computed(() => Boolean(props.chartData.style?.hasDataLabels));

interface Candle {
	cx: number;
	/** Wick: top of wick (highY) */
	wickTop: number;
	/** Wick: bottom of wick (lowY) */
	wickBottom: number;
	/** Body top (min of openY, closeY) */
	bodyTop: number;
	bodyHeight: number;
	bodyWidth: number;
	bodyX: number;
	fill: string;
	stroke: string;
	labelText?: string;
	labelX?: number;
	labelY?: number;
}

const candles = computed<Candle[]>(() => {
	const series = props.chartData.series;
	const hasFour = series.length >= 4;
	const openSeries = hasFour ? series[0] : undefined;
	const highSeries = series[hasFour ? 1 : 0];
	const lowSeries = series[hasFour ? 2 : 1];
	const closeSeries = series[hasFour ? 3 : 2];

	if (!highSeries || !lowSeries || !closeSeries) {
		return [];
	}

	const l = props.layout;
	const range = props.range;
	const catCount = Math.max(props.categories.length, 1);
	const barGroupWidth = l.plotWidth / catCount;
	const candleWidth = barGroupWidth * 0.5;
	const showLabels = hasDataLabels.value;

	const out: Candle[] = [];
	for (let ci = 0; ci < catCount; ci++) {
		const high = highSeries.values[ci] ?? 0;
		const low = lowSeries.values[ci] ?? 0;
		const open = openSeries?.values[ci] ?? low;
		const close = closeSeries.values[ci] ?? high;
		const isUp = close >= open;

		const cx = l.plotLeft + barGroupWidth * ci + barGroupWidth / 2;
		const highY = valueToY(high, range, l.plotTop, l.plotBottom);
		const lowY = valueToY(low, range, l.plotTop, l.plotBottom);
		const openY = valueToY(open, range, l.plotTop, l.plotBottom);
		const closeY = valueToY(close, range, l.plotTop, l.plotBottom);

		out.push({
			cx,
			wickTop: highY,
			wickBottom: lowY,
			bodyTop: Math.min(openY, closeY),
			bodyHeight: Math.max(Math.abs(openY - closeY), 1),
			bodyWidth: candleWidth,
			bodyX: cx - candleWidth / 2,
			fill: isUp ? '#22c55e' : '#ef4444',
			stroke: isUp ? '#16a34a' : '#dc2626',
			labelText: showLabels ? formatAxisValue(close) : undefined,
			labelX: showLabels ? cx : undefined,
			labelY: showLabels ? highY - 4 : undefined,
		});
	}
	return out;
});
</script>

<template>
	<g class="pptx-vue-stock-chart">
		<template v-for="(c, i) in candles" :key="`stock-${i}`">
			<!-- Wick -->
			<line
				:x1="c.cx"
				:y1="c.wickTop"
				:x2="c.cx"
				:y2="c.wickBottom"
				stroke="#334155"
				stroke-width="1"
			/>
			<!-- Body -->
			<rect
				:x="c.bodyX"
				:y="c.bodyTop"
				:width="c.bodyWidth"
				:height="c.bodyHeight"
				:fill="c.fill"
				:stroke="c.stroke"
				stroke-width="0.5"
				rx="1"
			/>
			<!-- Data label -->
			<text
				v-if="c.labelText !== undefined"
				:x="c.labelX"
				:y="c.labelY"
				text-anchor="middle"
				font-size="7"
				fill="#334155"
			>
				{{ c.labelText }}
			</text>
		</template>
	</g>
</template>
