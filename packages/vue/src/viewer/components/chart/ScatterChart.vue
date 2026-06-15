<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { formatAxisValue, seriesColor, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ScatterChart — Vue port of React `chart-scatter-bubble.tsx` scatter variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
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

interface ScatterDot {
	cx: number;
	cy: number;
	fill: string;
	labelText?: string;
}

const dots = computed<ScatterDot[]>(() => {
	const l = props.layout;
	const range = props.range;
	const mx = maxX.value;
	const out: ScatterDot[] = [];

	for (const [si, series] of props.chartData.series.entries()) {
		const fill = seriesColor(series, si, styleId.value, colorPalette.value);
		for (const [vi, val] of series.values.entries()) {
			const px = l.plotLeft + (mx > 0 ? vi / mx : 0) * l.plotWidth;
			const py = valueToY(val, range, l.plotTop, l.plotBottom);
			out.push({
				cx: px,
				cy: py,
				fill,
				labelText: hasDataLabels.value ? formatAxisValue(val) : undefined,
			});
		}
	}
	return out;
});
</script>

<template>
	<g class="pptx-vue-scatter-chart">
		<circle
			v-for="(dot, i) in dots"
			:key="`scatter-dot-${i}`"
			:cx="dot.cx"
			:cy="dot.cy"
			r="4"
			:fill="dot.fill"
			opacity="0.85"
		/>
		<text
			v-for="(dot, i) in dots.filter((d) => d.labelText !== undefined)"
			:key="`scatter-dl-${i}`"
			:x="dot.cx"
			:y="dot.cy - 6"
			text-anchor="middle"
			font-size="7"
			fill="#334155"
		>
			{{ dot.labelText }}
		</text>
	</g>
</template>
