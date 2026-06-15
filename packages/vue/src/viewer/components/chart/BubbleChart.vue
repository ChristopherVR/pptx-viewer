<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { formatAxisValue, seriesColor, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * BubbleChart — Vue port of React `chart-scatter-bubble.tsx` bubble variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 * First two series provide X/Y positions; third series (if present) controls bubble size.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
}>();

const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);
const hasDataLabels = computed(() => Boolean(props.chartData.style?.hasDataLabels));

const maxX = computed(() => {
	const allX = props.chartData.series.flatMap((s) => s.values.map((_v, i) => i));
	return Math.max(1, ...allX);
});

const medianRadius = computed(
	() => Math.min(props.layout.plotWidth, props.layout.plotHeight) * 0.04,
);

const bubbleSizeSeries = computed(() =>
	props.chartData.series.length >= 3 ? props.chartData.series[2] : undefined,
);

const maxBubble = computed(() => {
	const bs = bubbleSizeSeries.value;
	return bs ? Math.max(1, ...bs.values.map(Math.abs)) : 1;
});

interface BubbleDot {
	cx: number;
	cy: number;
	r: number;
	fill: string;
	labelText?: string;
}

const bubbles = computed<BubbleDot[]>(() => {
	const l = props.layout;
	const range = props.range;
	const mx = maxX.value;
	const mr = medianRadius.value;
	const mb = maxBubble.value;
	const bs = bubbleSizeSeries.value;
	const out: BubbleDot[] = [];

	for (const [si, series] of props.chartData.series.slice(0, 2).entries()) {
		const fill = seriesColor(series, si, styleId.value, colorPalette.value);
		for (const [vi, val] of series.values.entries()) {
			const px = l.plotLeft + (mx > 0 ? vi / mx : 0) * l.plotWidth;
			const py = valueToY(val, range, l.plotTop, l.plotBottom);
			const bubbleVal = bs?.values[vi];
			const r = bubbleVal !== undefined ? mr * 0.5 + (Math.abs(bubbleVal) / mb) * mr * 1.5 : mr;
			out.push({
				cx: px,
				cy: py,
				r,
				fill,
				labelText: hasDataLabels.value ? formatAxisValue(val) : undefined,
			});
		}
	}
	return out;
});
</script>

<template>
	<g class="pptx-vue-bubble-chart">
		<circle
			v-for="(b, i) in bubbles"
			:key="`bubble-${i}`"
			:cx="b.cx"
			:cy="b.cy"
			:r="b.r"
			:fill="b.fill"
			opacity="0.6"
			:stroke="b.fill"
			stroke-width="1"
		/>
		<text
			v-for="(b, i) in bubbles.filter((bb) => bb.labelText !== undefined)"
			:key="`bubble-dl-${i}`"
			:x="b.cx"
			:y="b.cy - b.r - 2"
			text-anchor="middle"
			font-size="7"
			fill="#334155"
		>
			{{ b.labelText }}
		</text>
	</g>
</template>
