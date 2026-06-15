<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { formatAxisValue, seriesColor, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ChartChrome — Vue port of the React `chart-chrome.tsx` common chrome:
 * title, gridlines, value axis, zero line, category axis, and legend.
 *
 * Rendered inside the parent chart `<svg>` (so it emits a `<g>` group, not a
 * standalone svg). Secondary axes, display-unit labels, log-scale ticks, and
 * overlays (trendlines / error bars / drop / hi-low lines) are not ported —
 * see the `// TODO(vue):` markers in ChartRenderer.vue.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
	categories: ReadonlyArray<string>;
	/** 'bar' centres category labels in slots; 'line' anchors them at points. */
	categoryAxisStyle: 'bar' | 'line';
}>();

const style = computed(() => props.chartData.style);
const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);
const legendPos = computed(() => style.value?.legendPosition || 'b');

const GRID_STEPS = 4;

const gridlines = computed(() => {
	if (!style.value?.hasGridlines) {
		return [];
	}
	const out: Array<{ y: number }> = [];
	for (let i = 0; i <= GRID_STEPS; i++) {
		const val = props.range.min + (props.range.span * i) / GRID_STEPS;
		out.push({ y: valueToY(val, props.range, props.layout.plotTop, props.layout.plotBottom) });
	}
	return out;
});

const valueAxisLabels = computed(() => {
	const out: Array<{ y: number; text: string }> = [];
	for (let i = 0; i <= GRID_STEPS; i++) {
		const val = props.range.min + (props.range.span * i) / GRID_STEPS;
		out.push({
			y: valueToY(val, props.range, props.layout.plotTop, props.layout.plotBottom),
			text: formatAxisValue(val),
		});
	}
	return out;
});

const zeroLineY = computed(() => {
	if (props.range.min >= 0) {
		return null;
	}
	return valueToY(0, props.range, props.layout.plotTop, props.layout.plotBottom);
});

const categoryLabels = computed(() => {
	const count = props.categories.length;
	if (count === 0) {
		return [];
	}
	const { plotLeft, plotWidth, plotBottom } = props.layout;
	return props.categories.map((cat, i) => {
		let x: number;
		if (props.categoryAxisStyle === 'bar') {
			const slot = plotWidth / count;
			x = plotLeft + slot * i + slot / 2;
		} else {
			x = count > 1 ? plotLeft + (plotWidth * i) / (count - 1) : plotLeft + plotWidth / 2;
		}
		return { x, y: plotBottom + 14, text: cat };
	});
});

interface LegendItem {
	x: number;
	y: number;
	color: string;
	label: string;
}

const legend = computed<LegendItem[]>(() => {
	const series = props.chartData.series;
	if (!style.value?.hasLegend || series.length === 0) {
		return [];
	}
	const pos = legendPos.value;
	const items: LegendItem[] = [];

	if (pos === 'b' || pos === 't') {
		const y = pos === 'b' ? props.layout.svgHeight - 10 : props.layout.plotTop - 14;
		const charWidth = 6;
		const gap = 24;
		const totalWidth = series.reduce((w, s) => w + (s.name?.length ?? 4) * charWidth + gap, 0);
		let cx = (props.layout.svgWidth - totalWidth) / 2;
		series.forEach((s, i) => {
			items.push({
				x: cx,
				y,
				color: seriesColor(s, i, styleId.value, colorPalette.value),
				label: s.name || `Series ${i + 1}`,
			});
			cx += (s.name?.length ?? 4) * charWidth + gap;
		});
		return items;
	}

	const x = pos === 'r' ? props.layout.plotRight + 8 : 4;
	series.forEach((s, i) => {
		items.push({
			x,
			y: props.layout.plotTop + i * 16,
			color: seriesColor(s, i, styleId.value, colorPalette.value),
			label: s.name || `Series ${i + 1}`,
		});
	});
	return items;
});

const legendOrientation = computed<'horizontal' | 'vertical'>(() =>
	legendPos.value === 'b' || legendPos.value === 't' ? 'horizontal' : 'vertical',
);
</script>

<template>
	<g class="pptx-vue-chart-chrome">
		<!-- Title -->
		<text
			v-if="style?.hasTitle"
			:x="layout.svgWidth / 2"
			y="16"
			text-anchor="middle"
			font-size="12"
			font-weight="600"
			fill="#1e293b"
		>
			{{ chartData.title || 'Chart' }}
		</text>

		<!-- Gridlines -->
		<line
			v-for="(g, i) in gridlines"
			:key="`grid-${i}`"
			:x1="layout.plotLeft"
			:y1="g.y"
			:x2="layout.plotRight"
			:y2="g.y"
			stroke="#cbd5e1"
			stroke-width="0.7"
			stroke-dasharray="4 3"
		/>

		<!-- Value axis labels -->
		<text
			v-for="(l, i) in valueAxisLabels"
			:key="`vaxis-${i}`"
			:x="layout.plotLeft - 4"
			:y="l.y + 3"
			text-anchor="end"
			font-size="8"
			fill="#64748b"
		>
			{{ l.text }}
		</text>

		<!-- Zero line -->
		<line
			v-if="zeroLineY !== null"
			:x1="layout.plotLeft"
			:y1="zeroLineY"
			:x2="layout.plotRight"
			:y2="zeroLineY"
			stroke="#334155"
			stroke-width="1"
		/>

		<!-- Category axis labels -->
		<text
			v-for="(c, i) in categoryLabels"
			:key="`caxis-${i}`"
			:x="c.x"
			:y="c.y"
			text-anchor="middle"
			font-size="8"
			fill="#64748b"
		>
			{{ c.text }}
		</text>

		<!-- Legend -->
		<g v-if="legendOrientation === 'horizontal'">
			<template v-for="(item, i) in legend" :key="`leg-${i}`">
				<rect :x="item.x" :y="item.y - 5" width="10" height="10" rx="2" :fill="item.color" />
				<text :x="item.x + 14" :y="item.y + 4" font-size="9" fill="#475569">{{ item.label }}</text>
			</template>
		</g>
		<g v-else>
			<template v-for="(item, i) in legend" :key="`leg-${i}`">
				<rect :x="item.x" :y="item.y" width="10" height="10" rx="2" :fill="item.color" />
				<text :x="item.x + 14" :y="item.y + 8" font-size="9" fill="#475569">{{ item.label }}</text>
			</template>
		</g>
	</g>
</template>
