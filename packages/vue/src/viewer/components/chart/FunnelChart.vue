<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout } from 'pptx-viewer-shared';
import { formatAxisValue, paletteColor } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * FunnelChart — Vue port of React `chart-sunburst-funnel.tsx` funnel variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	categories: ReadonlyArray<string>;
}>();

const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);

interface FunnelSegment {
	d: string;
	fill: string;
	labelX: number;
	labelY: number;
	labelText: string;
	fontSize: number;
}

const segments = computed<FunnelSegment[]>(() => {
	const values = props.chartData.series[0]?.values ?? [];
	const count = values.length;
	if (count === 0) {
		return [];
	}
	const l = props.layout;
	const maxVal = Math.max(...values.map(Math.abs), 1);
	const segH = l.plotHeight / Math.max(count, 1);
	const centerX = l.plotLeft + l.plotWidth / 2;
	const out: FunnelSegment[] = [];

	for (const [i, val] of values.entries()) {
		const topW = (Math.abs(val) / maxVal) * l.plotWidth;
		const nextVal = i + 1 < count ? Math.abs(values[i + 1]) : Math.abs(val) * 0.3;
		const botW = (nextVal / maxVal) * l.plotWidth;
		const y = l.plotTop + i * segH;

		const d = [
			`M ${centerX - topW / 2} ${y}`,
			`L ${centerX + topW / 2} ${y}`,
			`L ${centerX + botW / 2} ${y + segH}`,
			`L ${centerX - botW / 2} ${y + segH}`,
			'Z',
		].join(' ');

		const labelText = props.categories[i] ?? formatAxisValue(val);
		out.push({
			d,
			fill: paletteColor(i, styleId.value, colorPalette.value),
			labelX: centerX,
			labelY: y + segH / 2 + 4,
			labelText,
			fontSize: Math.min(10, segH * 0.4),
		});
	}
	return out;
});
</script>

<template>
	<g class="pptx-vue-funnel-chart">
		<path
			v-for="(seg, i) in segments"
			:key="`fn-${i}`"
			:d="seg.d"
			:fill="seg.fill"
			stroke="#fff"
			stroke-width="1"
			opacity="0.85"
		/>
		<text
			v-for="(seg, i) in segments"
			:key="`fn-lbl-${i}`"
			:x="seg.labelX"
			:y="seg.labelY"
			text-anchor="middle"
			:font-size="seg.fontSize"
			fill="#fff"
			font-weight="600"
		>
			{{ seg.labelText }}
		</text>
	</g>
</template>
