<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { formatAxisValue, seriesColor, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ComboChart: Vue port of React `chart-waterfall-combo.tsx` combo variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 * First series renders as bars; remaining series render as lines with dots.
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

const catCount = computed(() => Math.max(props.categories.length, 1));

// ── Bar series (first series) ─────────────────────────────────────

interface ComboBar {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	labelX?: number;
	labelY?: number;
	labelText?: string;
}

const comboBars = computed<ComboBar[]>(() => {
	const barSeries = props.chartData.series[0];
	if (!barSeries) {
		return [];
	}
	const l = props.layout;
	const range = props.range;
	const count = catCount.value;
	const barGroupWidth = l.plotWidth / count;
	const barWidth = barGroupWidth * 0.5;
	const barOffset = (barGroupWidth - barWidth) / 2;
	const fill = seriesColor(barSeries, 0, styleId.value, colorPalette.value);

	return barSeries.values.map((val, vi) => {
		const x = l.plotLeft + barGroupWidth * vi + barOffset;
		const zeroY = valueToY(0, range, l.plotTop, l.plotBottom);
		const valY = valueToY(val, range, l.plotTop, l.plotBottom);
		const y = Math.min(zeroY, valY);
		const h = Math.max(Math.abs(zeroY - valY), 1);
		return {
			x,
			y,
			width: barWidth,
			height: h,
			fill,
			labelX: hasDataLabels.value ? x + barWidth / 2 : undefined,
			labelY: hasDataLabels.value ? (val >= 0 ? y - 4 : y + h + 10) : undefined,
			labelText: hasDataLabels.value ? formatAxisValue(val) : undefined,
		};
	});
});

// ── Line series (all series after first) ─────────────────────────

interface ComboLineSeries {
	color: string;
	points: Array<{ x: number; y: number; val: number }>;
	polylinePoints: string;
}

const comboLines = computed<ComboLineSeries[]>(() => {
	const l = props.layout;
	const range = props.range;
	const count = catCount.value;
	const barGroupWidth = l.plotWidth / count;

	return props.chartData.series.slice(1).map((series, si) => {
		const seriesIdx = si + 1;
		const color = seriesColor(series, seriesIdx, styleId.value, colorPalette.value);
		const points = series.values.map((val, vi) => ({
			x: l.plotLeft + barGroupWidth * vi + barGroupWidth / 2,
			y: valueToY(val, range, l.plotTop, l.plotBottom),
			val,
		}));
		return {
			color,
			points,
			polylinePoints: points.map((p) => `${p.x},${p.y}`).join(' '),
		};
	});
});
</script>

<template>
	<g class="pptx-vue-combo-chart">
		<!-- Bar series -->
		<rect
			v-for="(b, i) in comboBars"
			:key="`combo-bar-${i}`"
			:x="b.x"
			:y="b.y"
			:width="b.width"
			:height="b.height"
			:fill="b.fill"
			rx="1"
		/>
		<text
			v-for="(b, i) in comboBars.filter((bb) => bb.labelText !== undefined)"
			:key="`combo-bar-dl-${i}`"
			:x="b.labelX"
			:y="b.labelY"
			text-anchor="middle"
			font-size="7"
			fill="#334155"
		>
			{{ b.labelText }}
		</text>

		<!-- Line series -->
		<g v-for="(s, si) in comboLines" :key="`combo-line-${si}`">
			<polyline fill="none" :stroke="s.color" stroke-width="2.4" :points="s.polylinePoints" />
			<circle
				v-for="(p, pi) in s.points"
				:key="`combo-dot-${si}-${pi}`"
				:cx="p.x"
				:cy="p.y"
				r="2.5"
				:fill="s.color"
			/>
			<template v-if="hasDataLabels">
				<text
					v-for="(p, pi) in s.points"
					:key="`combo-line-dl-${si}-${pi}`"
					:x="p.x"
					:y="p.y - 7"
					text-anchor="middle"
					font-size="7"
					fill="#334155"
				>
					{{ formatAxisValue(p.val) }}
				</text>
			</template>
		</g>
	</g>
</template>
