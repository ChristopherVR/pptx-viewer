<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { formatAxisValue, paletteColor, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * HistogramChart: Vue port of React `chart-bar.tsx` histogram variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 * Contiguous bars with no gaps, from a single series.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
	categories: ReadonlyArray<string>;
}>();

const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);
const hasDataLabels = computed(() => Boolean(props.chartData.style?.hasDataLabels));

interface HistBar {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	labelX?: number;
	labelY?: number;
	labelText?: string;
}

const histBars = computed<HistBar[]>(() => {
	const values = props.chartData.series[0]?.values ?? [];
	const catCount = Math.max(props.categories.length, values.length, 1);
	const l = props.layout;
	const range = props.range;
	const barWidth = l.plotWidth / catCount;
	const seriesColor = props.chartData.series[0]?.color;
	const showLabels = hasDataLabels.value;

	return values.map((val, i) => {
		const x = l.plotLeft + barWidth * i;
		const zeroY = valueToY(0, range, l.plotTop, l.plotBottom);
		const valY = valueToY(val, range, l.plotTop, l.plotBottom);
		const y = Math.min(zeroY, valY);
		const h = Math.max(Math.abs(zeroY - valY), 1);
		const fill = seriesColor ?? paletteColor(i, styleId.value, colorPalette.value);
		return {
			x,
			y,
			width: Math.max(barWidth - 0.5, 1),
			height: h,
			fill,
			labelX: showLabels ? x + barWidth / 2 : undefined,
			labelY: showLabels ? y - 4 : undefined,
			labelText: showLabels ? formatAxisValue(val) : undefined,
		};
	});
});
</script>

<template>
	<g class="pptx-vue-histogram-chart">
		<rect
			v-for="(b, i) in histBars"
			:key="`hist-${i}`"
			:x="b.x"
			:y="b.y"
			:width="b.width"
			:height="b.height"
			:fill="b.fill"
			stroke="#fff"
			stroke-width="0.5"
			opacity="0.85"
		/>
		<text
			v-for="(b, i) in histBars.filter((bb) => bb.labelText !== undefined)"
			:key="`hist-dl-${i}`"
			:x="b.labelX"
			:y="b.labelY"
			text-anchor="middle"
			font-size="7"
			fill="#334155"
		>
			{{ b.labelText }}
		</text>
	</g>
</template>
