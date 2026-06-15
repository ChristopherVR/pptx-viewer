<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { formatAxisValue, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * WaterfallChart — Vue port of React `chart-waterfall-combo.tsx` waterfall variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
	categories: ReadonlyArray<string>;
}>();

const hasDataLabels = computed(() => Boolean(props.chartData.style?.hasDataLabels));

interface WaterfallBar {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	/** Connector: line from bottom-right of this bar to bottom-left of the next */
	connX1?: number;
	connY1?: number;
	connX2?: number;
	connY2?: number;
	labelX?: number;
	labelY?: number;
	labelText?: string;
}

const bars = computed<WaterfallBar[]>(() => {
	const values = props.chartData.series[0]?.values ?? [];
	const catCount = Math.max(props.categories.length, values.length, 1);
	const l = props.layout;
	const range = props.range;
	const barWidth = (l.plotWidth / catCount) * 0.6;
	const gap = (l.plotWidth / catCount) * 0.2;

	let runningTotal = 0;
	const out: WaterfallBar[] = [];

	for (const [i, val] of values.entries()) {
		const isLast = i === values.length - 1;
		const startVal = isLast ? 0 : runningTotal;
		const endVal = runningTotal + val;
		const barStartY = valueToY(startVal, range, l.plotTop, l.plotBottom);
		const barEndY = valueToY(endVal, range, l.plotTop, l.plotBottom);
		const x = l.plotLeft + (l.plotWidth / catCount) * i + gap;
		const y = Math.min(barStartY, barEndY);
		const h = Math.max(Math.abs(barEndY - barStartY), 1);
		const fill = isLast ? '#6366f1' : val >= 0 ? '#22c55e' : '#ef4444';

		let connX1: number | undefined;
		let connY1: number | undefined;
		let connX2: number | undefined;
		let connY2: number | undefined;

		if (!isLast && i < values.length - 1) {
			const nextX = l.plotLeft + (l.plotWidth / catCount) * (i + 1) + gap;
			connX1 = x + barWidth;
			connY1 = barEndY;
			connX2 = nextX;
			connY2 = barEndY;
		}

		out.push({
			x,
			y,
			width: barWidth,
			height: h,
			fill,
			connX1,
			connY1,
			connX2,
			connY2,
			labelX: hasDataLabels.value ? x + barWidth / 2 : undefined,
			labelY: hasDataLabels.value ? y - 4 : undefined,
			labelText: hasDataLabels.value ? formatAxisValue(isLast ? endVal : val) : undefined,
		});

		if (!isLast) {
			runningTotal += val;
		}
	}

	return out;
});
</script>

<template>
	<g class="pptx-vue-waterfall-chart">
		<rect
			v-for="(b, i) in bars"
			:key="`wf-bar-${i}`"
			:x="b.x"
			:y="b.y"
			:width="b.width"
			:height="b.height"
			:fill="b.fill"
			rx="1"
		/>
		<line
			v-for="(b, i) in bars.filter((bb) => bb.connX1 !== undefined)"
			:key="`wf-conn-${i}`"
			:x1="b.connX1"
			:y1="b.connY1"
			:x2="b.connX2"
			:y2="b.connY2"
			stroke="#94a3b8"
			stroke-width="0.8"
			stroke-dasharray="3 2"
		/>
		<text
			v-for="(b, i) in bars.filter((bb) => bb.labelText !== undefined)"
			:key="`wf-dl-${i}`"
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
