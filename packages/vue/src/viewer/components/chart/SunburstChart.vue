<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout } from 'pptx-viewer-shared';
import { paletteColor } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * SunburstChart: Vue port of React `chart-sunburst-funnel.tsx` sunburst variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 * Draws concentric arc rings, one per series.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
}>();

const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);

const cx = computed(() => props.layout.plotLeft + props.layout.plotWidth / 2);
const cy = computed(() => props.layout.plotTop + props.layout.plotHeight / 2);
const maxR = computed(() => Math.min(props.layout.plotWidth, props.layout.plotHeight) / 2 - 4);

const seriesCount = computed(() => Math.max(props.chartData.series.length, 1));
const ringWidth = computed(() => maxR.value / (seriesCount.value + 0.5));

interface ArcPath {
	d: string;
	fill: string;
	opacity: number;
}

const arcs = computed<ArcPath[]>(() => {
	const out: ArcPath[] = [];
	const rw = ringWidth.value;

	for (const [si, series] of props.chartData.series.entries()) {
		const iR = rw * (si + 0.5);
		const oR = rw * (si + 1.5);
		const total = series.values.reduce((s, v) => s + Math.abs(v), 0) || 1;
		let startAngle = -Math.PI / 2;

		for (const [vi, val] of series.values.entries()) {
			const sweep = (Math.abs(val) / total) * Math.PI * 2;
			const endAngle = startAngle + sweep;
			const largeArc = sweep > Math.PI ? 1 : 0;

			const x1 = cx.value + oR * Math.cos(startAngle);
			const y1 = cy.value + oR * Math.sin(startAngle);
			const x2 = cx.value + oR * Math.cos(endAngle);
			const y2 = cy.value + oR * Math.sin(endAngle);
			const x3 = cx.value + iR * Math.cos(endAngle);
			const y3 = cy.value + iR * Math.sin(endAngle);
			const x4 = cx.value + iR * Math.cos(startAngle);
			const y4 = cy.value + iR * Math.sin(startAngle);

			out.push({
				d: `M ${x1} ${y1} A ${oR} ${oR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${iR} ${iR} 0 ${largeArc} 0 ${x4} ${y4} Z`,
				fill: paletteColor(vi, styleId.value, colorPalette.value),
				opacity: Math.max(0.1, 0.9 - si * 0.1),
			});

			startAngle = endAngle;
		}
	}
	return out;
});
</script>

<template>
	<g class="pptx-vue-sunburst-chart">
		<path
			v-for="(arc, i) in arcs"
			:key="`sb-${i}`"
			:d="arc.d"
			:fill="arc.fill"
			stroke="#fff"
			stroke-width="1"
			:opacity="arc.opacity"
		/>
	</g>
</template>
