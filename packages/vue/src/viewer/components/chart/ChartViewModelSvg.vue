<script setup lang="ts">
import type {
	ChartViewModel,
	SvgCircle,
	SvgLine,
	SvgPath,
	SvgPolygon,
	SvgPolyline,
	SvgPrimitive,
	SvgRect,
	SvgText,
} from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ChartViewModelSvg: Vue projector for the framework-agnostic chart view-model
 * engine. Maps a shared `ChartViewModel` (a list of pure `SvgPrimitive`
 * descriptors plus chrome) to Vue template SVG, mirroring React's
 * `renderChartViewModel` in `chart-view-model-render.tsx`.
 *
 * Used for the chart kinds the shared engine fully covers (pie / doughnut /
 * radar). Richer Vue renderers (bar / line / area / combo / stock / surface /
 * region map / box-whisker / histogram / sunburst / funnel, plus log/secondary
 * axes and interactive overlays) stay on their bespoke Vue components.
 *
 * `preserveAspectRatio` defaults to `none` (cartesian charts stretch to fill
 * the element box). Square chart kinds (pie / doughnut / radar) pass
 * `xMidYMid meet` so they stay circular regardless of the element's aspect.
 */
const props = withDefaults(
	defineProps<{
		elementId: string;
		vm: ChartViewModel;
		preserveAspectRatio?: 'none' | 'xMidYMid meet';
	}>(),
	{ preserveAspectRatio: 'none' },
);

const LEGEND_ITEM_WIDTH = 80;

const isVerticalLegend = computed(() => props.vm.legendAnchor === 'start');

function isRect(p: SvgPrimitive): p is SvgRect {
	return p.kind === 'rect';
}
function isPath(p: SvgPrimitive): p is SvgPath {
	return p.kind === 'path';
}
function isPolyline(p: SvgPrimitive): p is SvgPolyline {
	return p.kind === 'polyline';
}
function isCircle(p: SvgPrimitive): p is SvgCircle {
	return p.kind === 'circle';
}
function isLine(p: SvgPrimitive): p is SvgLine {
	return p.kind === 'line';
}
function isPolygon(p: SvgPrimitive): p is SvgPolygon {
	return p.kind === 'polygon';
}
function isText(p: SvgPrimitive): p is SvgText {
	return p.kind === 'text';
}

interface LegendLayout {
	x: number;
	y: number;
	color: string;
	label: string;
}

const legendItems = computed<LegendLayout[]>(() => {
	const vm = props.vm;
	return vm.legend.map((entry, i) => {
		const x = isVerticalLegend.value
			? vm.legendX
			: vm.legendX - (vm.legend.length * LEGEND_ITEM_WIDTH) / 2 + i * LEGEND_ITEM_WIDTH;
		const y = isVerticalLegend.value ? vm.legendY + i * 14 : vm.legendY;
		return { x, y, color: entry.color, label: entry.label };
	});
});
</script>

<template>
	<svg
		class="pptx-vue-chart-svg"
		:viewBox="`0 0 ${vm.svgWidth} ${vm.svgHeight}`"
		:preserveAspectRatio="preserveAspectRatio"
	>
		<rect :x="0" :y="0" :width="vm.svgWidth" :height="vm.svgHeight" fill="#0f172a11" />

		<text
			v-if="vm.title"
			:x="vm.titleX"
			:y="vm.titleY"
			text-anchor="middle"
			font-size="12"
			font-weight="600"
			fill="#1e293b"
		>
			{{ vm.title }}
		</text>

		<line
			v-for="(gl, i) in vm.gridlines"
			:key="`${elementId}-gl-${i}`"
			:x1="gl.x1"
			:y1="gl.y1"
			:x2="gl.x2"
			:y2="gl.y2"
			:stroke="gl.stroke"
			:stroke-width="gl.strokeWidth"
		/>

		<text
			v-for="(lbl, i) in vm.axisLabels"
			:key="`${elementId}-al-${i}`"
			:x="lbl.x"
			:y="lbl.y"
			:text-anchor="lbl.textAnchor"
			:font-size="lbl.fontSize"
			:fill="lbl.fill"
			:font-weight="lbl.fontWeight ?? 'normal'"
			:dominant-baseline="lbl.dominantBaseline"
		>
			{{ lbl.text }}
		</text>

		<line
			v-if="vm.zeroLine"
			:x1="vm.zeroLine.x1"
			:y1="vm.zeroLine.y1"
			:x2="vm.zeroLine.x2"
			:y2="vm.zeroLine.y2"
			:stroke="vm.zeroLine.stroke"
			:stroke-width="vm.zeroLine.strokeWidth"
		/>

		<text
			v-for="(lbl, i) in vm.categoryLabels"
			:key="`${elementId}-cl-${i}`"
			:x="lbl.x"
			:y="lbl.y"
			:text-anchor="lbl.textAnchor"
			:font-size="lbl.fontSize"
			:fill="lbl.fill"
			:font-weight="lbl.fontWeight ?? 'normal'"
			:dominant-baseline="lbl.dominantBaseline"
		>
			{{ lbl.text }}
		</text>

		<template v-for="(prim, i) in vm.primitives" :key="`${elementId}-p-${i}`">
			<rect
				v-if="isRect(prim)"
				:x="prim.x"
				:y="prim.y"
				:width="prim.w"
				:height="prim.h"
				:fill="prim.fill"
				:rx="prim.rx ?? 0"
				:opacity="prim.opacity ?? 1"
			/>
			<path
				v-else-if="isPath(prim)"
				:d="prim.d"
				:fill="prim.fill"
				:stroke="prim.stroke ?? 'none'"
				:stroke-width="prim.strokeWidth ?? 0"
				:fill-opacity="prim.opacity ?? 1"
			/>
			<polyline
				v-else-if="isPolyline(prim)"
				:points="prim.points"
				:stroke="prim.stroke"
				:stroke-width="prim.strokeWidth"
				:fill="prim.fill"
				:opacity="prim.opacity ?? 1"
			/>
			<circle
				v-else-if="isCircle(prim)"
				:cx="prim.cx"
				:cy="prim.cy"
				:r="prim.r"
				:fill="prim.fill"
				:opacity="prim.opacity ?? 1"
			/>
			<line
				v-else-if="isLine(prim)"
				:x1="prim.x1"
				:y1="prim.y1"
				:x2="prim.x2"
				:y2="prim.y2"
				:stroke="prim.stroke"
				:stroke-width="prim.strokeWidth"
				:stroke-dasharray="prim.dashArray"
				:opacity="prim.opacity ?? 1"
			/>
			<polygon
				v-else-if="isPolygon(prim)"
				:points="prim.points"
				:fill="prim.fill"
				:stroke="prim.stroke"
				:stroke-width="prim.strokeWidth"
				:opacity="prim.opacity ?? 1"
				:stroke-dasharray="prim.dashArray"
			/>
			<text
				v-else-if="isText(prim)"
				:x="prim.x"
				:y="prim.y"
				:text-anchor="prim.textAnchor"
				:font-size="prim.fontSize"
				:fill="prim.fill"
				:font-weight="prim.fontWeight ?? 'normal'"
				:dominant-baseline="prim.dominantBaseline"
				:opacity="prim.opacity ?? 1"
				:transform="prim.transform"
			>
				{{ prim.text }}
			</text>
		</template>

		<text
			v-for="(dl, i) in vm.dataLabels"
			:key="`${elementId}-dl-${i}`"
			:x="dl.x"
			:y="dl.y"
			:text-anchor="dl.textAnchor"
			:font-size="dl.fontSize"
			:fill="dl.fill"
			:font-weight="dl.fontWeight ?? 'normal'"
			:dominant-baseline="dl.dominantBaseline"
		>
			{{ dl.text }}
		</text>

		<g
			v-for="(entry, i) in legendItems"
			:key="`${elementId}-lg-${i}`"
			:transform="`translate(${entry.x.toFixed(1)},${entry.y.toFixed(1)})`"
		>
			<rect :x="0" :y="-7" width="10" height="10" rx="2" :fill="entry.color" />
			<text :x="13" :y="3" font-size="9" fill="#475569">{{ entry.label }}</text>
		</g>
	</svg>
</template>

<style scoped>
.pptx-vue-chart-svg {
	width: 100%;
	height: 100%;
	display: block;
}
</style>
