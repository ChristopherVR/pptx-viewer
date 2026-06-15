<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout } from 'pptx-viewer-shared';
import { formatAxisValue, seriesColor } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * RadarChart — Vue port of React `chart-radar.tsx`.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	categories: ReadonlyArray<string>;
}>();

const style = computed(() => props.chartData.style);
const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);

const cx = computed(() => props.layout.plotLeft + props.layout.plotWidth / 2);
const cy = computed(() => props.layout.plotTop + props.layout.plotHeight / 2);
const radius = computed(() => Math.min(props.layout.plotWidth, props.layout.plotHeight) / 2 - 4);

const catCount = computed(() => Math.max(props.categories.length, 1));
const maxVal = computed(() =>
	Math.max(1, ...props.chartData.series.flatMap((s) => s.values.map(Math.abs))),
);

const RING_COUNT = 4;

interface RingPolygon {
	points: string;
	dashed: boolean;
}

const rings = computed<RingPolygon[]>(() => {
	const out: RingPolygon[] = [];
	const count = catCount.value;
	for (let r = 1; r <= RING_COUNT; r++) {
		const rr = (radius.value * r) / RING_COUNT;
		const pts = Array.from({ length: count }, (_, i) => {
			const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
			return `${cx.value + rr * Math.cos(angle)},${cy.value + rr * Math.sin(angle)}`;
		}).join(' ');
		out.push({ points: pts, dashed: r < RING_COUNT });
	}
	return out;
});

interface Spoke {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

const spokes = computed<Spoke[]>(() => {
	const count = catCount.value;
	return Array.from({ length: count }, (_, i) => {
		const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
		return {
			x1: cx.value,
			y1: cy.value,
			x2: cx.value + radius.value * Math.cos(angle),
			y2: cy.value + radius.value * Math.sin(angle),
		};
	});
});

interface CatLabel {
	x: number;
	y: number;
	text: string;
}

const catLabels = computed<CatLabel[]>(() => {
	const count = catCount.value;
	const labelR = radius.value + 10;
	return props.categories.map((cat, i) => {
		const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
		return {
			x: cx.value + labelR * Math.cos(angle),
			y: cy.value + labelR * Math.sin(angle),
			text: cat,
		};
	});
});

interface SeriesPolygon {
	points: string;
	color: string;
	dots: Array<{ x: number; y: number }>;
	labels: Array<{ x: number; y: number; text: string }>;
}

const seriesPolygons = computed<SeriesPolygon[]>(() => {
	const count = catCount.value;
	const r = radius.value;
	const max = maxVal.value;
	const hasLabels = Boolean(style.value?.hasDataLabels);

	return props.chartData.series.map((series, si) => {
		const color = seriesColor(series, si, styleId.value, colorPalette.value);
		const pts = series.values
			.slice(0, count)
			.map((val, vi) => {
				const angle = (Math.PI * 2 * vi) / count - Math.PI / 2;
				const rr = (Math.abs(val) / max) * r;
				return `${cx.value + rr * Math.cos(angle)},${cy.value + rr * Math.sin(angle)}`;
			})
			.join(' ');

		const dots = series.values.slice(0, count).map((val, vi) => {
			const angle = (Math.PI * 2 * vi) / count - Math.PI / 2;
			const rr = (Math.abs(val) / max) * r;
			return { x: cx.value + rr * Math.cos(angle), y: cy.value + rr * Math.sin(angle) };
		});

		const labels = hasLabels
			? series.values.slice(0, count).map((val, vi) => {
					const angle = (Math.PI * 2 * vi) / count - Math.PI / 2;
					const rr = (Math.abs(val) / max) * r;
					return {
						x: cx.value + rr * Math.cos(angle),
						y: cy.value + rr * Math.sin(angle) - 8,
						text: formatAxisValue(val),
					};
				})
			: [];

		return { points: pts, color, dots, labels };
	});
});
</script>

<template>
	<g class="pptx-vue-radar-chart">
		<!-- Ring gridlines -->
		<polygon
			v-for="(ring, ri) in rings"
			:key="`radar-ring-${ri}`"
			:points="ring.points"
			fill="none"
			stroke="#cbd5e1"
			stroke-width="0.5"
			:stroke-dasharray="ring.dashed ? '3 2' : '0'"
		/>
		<!-- Spokes -->
		<line
			v-for="(spoke, si) in spokes"
			:key="`radar-spoke-${si}`"
			:x1="spoke.x1"
			:y1="spoke.y1"
			:x2="spoke.x2"
			:y2="spoke.y2"
			stroke="#94a3b8"
			stroke-width="0.5"
		/>
		<!-- Category labels -->
		<text
			v-for="(cat, ci) in catLabels"
			:key="`radar-cat-${ci}`"
			:x="cat.x"
			:y="cat.y"
			text-anchor="middle"
			dominant-baseline="central"
			font-size="8"
			fill="#64748b"
		>
			{{ cat.text }}
		</text>
		<!-- Series polygons + dots -->
		<g v-for="(s, si) in seriesPolygons" :key="`radar-s-${si}`">
			<polygon
				:points="s.points"
				:fill="s.color"
				opacity="0.2"
				:stroke="s.color"
				stroke-width="1.5"
			/>
			<circle
				v-for="(dot, di) in s.dots"
				:key="`radar-dot-${si}-${di}`"
				:cx="dot.x"
				:cy="dot.y"
				r="3"
				:fill="s.color"
			/>
			<text
				v-for="(lbl, li) in s.labels"
				:key="`radar-dl-${si}-${li}`"
				:x="lbl.x"
				:y="lbl.y"
				text-anchor="middle"
				font-size="7"
				fill="#334155"
			>
				{{ lbl.text }}
			</text>
		</g>
	</g>
</template>
