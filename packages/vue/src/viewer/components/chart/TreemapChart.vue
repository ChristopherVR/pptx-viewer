<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout } from 'pptx-viewer-shared';
import { paletteColor } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * TreemapChart — Vue port of React `chart-surface-treemap.tsx` treemap variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 * Uses a greedy horizontal/vertical cut layout.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	categories: ReadonlyArray<string>;
}>();

const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);

interface TreemapCell {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	labelText: string;
	fontSize: number;
	showLabel: boolean;
}

const cells = computed<TreemapCell[]>(() => {
	const allValues = props.chartData.series.flatMap((s) => s.values);
	const totalAbs = allValues.reduce((sum, v) => sum + Math.abs(v), 0) || 1;
	const l = props.layout;

	// Sort by descending value, keeping original index for palette/label lookup
	const items = allValues
		.map((v, i) => ({ value: Math.abs(v), index: i }))
		.sort((a, b) => b.value - a.value);

	const out: TreemapCell[] = [];
	let curX = l.plotLeft;
	let curY = l.plotTop;
	let remainW = l.plotWidth;
	let remainH = l.plotHeight;
	let remainTotal = totalAbs;

	for (const item of items) {
		const fraction = remainTotal > 0 ? item.value / remainTotal : 0;
		const useWidth = remainW >= remainH;
		const w = useWidth ? remainW * fraction : remainW;
		const h = useWidth ? remainH : remainH * fraction;
		const cellW = Math.max(w - 1, 1);
		const cellH = Math.max(h - 1, 1);
		const label = props.categories[item.index] ?? `${item.index + 1}`;

		out.push({
			x: curX,
			y: curY,
			width: cellW,
			height: cellH,
			fill: paletteColor(item.index, styleId.value, colorPalette.value),
			labelText: label,
			fontSize: Math.min(10, cellH * 0.3),
			showLabel: cellW > 30 && cellH > 14,
		});

		if (useWidth) {
			curX += w;
			remainW -= w;
		} else {
			curY += h;
			remainH -= h;
		}
		remainTotal -= item.value;
	}

	return out;
});
</script>

<template>
	<g class="pptx-vue-treemap-chart">
		<rect
			v-for="(cell, i) in cells"
			:key="`tm-${i}`"
			:x="cell.x"
			:y="cell.y"
			:width="cell.width"
			:height="cell.height"
			:fill="cell.fill"
			rx="2"
			opacity="0.85"
		/>
		<text
			v-for="(cell, i) in cells.filter((c) => c.showLabel)"
			:key="`tm-lbl-${i}`"
			:x="cell.x + cell.width / 2"
			:y="cell.y + cell.height / 2 + 4"
			text-anchor="middle"
			:font-size="cell.fontSize"
			fill="#fff"
			font-weight="600"
		>
			{{ cell.labelText }}
		</text>
	</g>
</template>
