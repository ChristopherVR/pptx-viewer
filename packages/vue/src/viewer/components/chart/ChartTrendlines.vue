<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, RenderableTrendline, ValueRange } from 'pptx-viewer-shared';
import { computeChartTrendlines } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ChartTrendlines: Vue port of the React `renderTrendlines`
 * (`viewer/utils/chart-trendlines.tsx`).
 *
 * Renders the per-series regression trendlines (linear / exponential /
 * logarithmic / power / polynomial / moving-average) as dashed SVG `<path>`
 * overlays, optionally annotated with the equation and/or R² value when the
 * trendline requests it. Emits a `<g>` group meant to sit on TOP of the plot
 * inside the parent chart `<svg>`.
 *
 * The regression maths lives in the framework-agnostic
 * `computeChartTrendlines` helper so React, Vue, and Angular share it.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
	/** 'bar' for bar/column/stacked plots, 'line' for line/area plots. */
	mode: 'line' | 'bar';
	styleId?: number;
	colorPalette?: string[];
}>();

const trendlines = computed<RenderableTrendline[]>(() =>
	computeChartTrendlines(
		props.chartData,
		props.layout,
		props.range,
		props.mode,
		props.styleId,
		props.colorPalette,
	),
);
</script>

<template>
	<g v-if="trendlines.length > 0" class="pptx-vue-chart-trendlines">
		<template v-for="(tl, i) in trendlines" :key="`trend-${i}`">
			<path
				:d="tl.pathData"
				fill="none"
				:stroke="tl.color"
				stroke-width="1.5"
				stroke-dasharray="6 3"
				opacity="0.8"
			/>
			<text
				v-if="tl.label"
				:x="tl.labelX"
				:y="tl.labelY"
				text-anchor="end"
				font-size="7"
				:fill="tl.color"
			>
				{{ tl.label }}
			</text>
		</template>
	</g>
</template>
