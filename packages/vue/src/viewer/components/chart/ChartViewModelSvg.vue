<script setup lang="ts">
import { chartPartToAttrs, computeChartLegendLayout } from 'pptx-viewer-shared';
import type {
	ChartPartRef,
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
 * Used for the chart kinds the shared engine fully covers: pie / doughnut /
 * radar and the cartesian family (bar / column / line / area / scatter / bubble,
 * including clustered / stacked / percentStacked and log / display-unit /
 * secondary value axes plus trendline / error-bar / axis-title / data-table
 * overlays). The remaining bespoke Vue renderers (combo / stock / surface /
 * region map / box-whisker / histogram / sunburst / funnel) stay on their own
 * components.
 *
 * `preserveAspectRatio` defaults to `none` (cartesian charts stretch to fill
 * the element box). Square chart kinds (pie / doughnut / radar) pass
 * `xMidYMid meet` so they stay circular regardless of the element's aspect.
 *
 * Secondary value axis: `secondaryGridlines` / `secondaryAxisLabels` render as
 * dashed right-side gridlines + right-anchored labels. Overlays (trendlines /
 * error bars / axis titles) and the data-table block are already appended to
 * `vm.primitives` by the shared cartesian builder, so they flow through the
 * `vm.primitives` switch; `vm.overlays` / `vm.dataTable` are surfaced on the
 * view-model only for projectors that want to segregate them.
 */
const props = withDefaults(
	defineProps<{
		elementId: string;
		vm: ChartViewModel;
		preserveAspectRatio?: 'none' | 'xMidYMid meet';
	}>(),
	{ preserveAspectRatio: 'none' },
);

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

/**
 * `data-chart-*` hit-testing attributes for a tagged data-mark primitive.
 * Always emitted (they are inert without pointer events); the chart canvas
 * interaction layer activates them in edit mode via CSS + event delegation.
 */
function partAttrs(part: ChartPartRef | undefined): Record<string, string> {
	return part ? chartPartToAttrs(part) : {};
}

const legendItems = computed(() => computeChartLegendLayout(props.vm));
</script>

<template>
	<svg
		class="pptx-vue-chart-svg"
		:viewBox="`0 0 ${vm.svgWidth} ${vm.svgHeight}`"
		:preserveAspectRatio="preserveAspectRatio"
	>
		<defs v-if="vm.defs && vm.defs.length > 0">
			<pattern
				v-for="(def, i) in vm.defs"
				:key="`${elementId}-def-${i}`"
				:id="def.id"
				:patternUnits="def.patternUnits"
				:x="def.x"
				:y="def.y"
				:width="def.width"
				:height="def.height"
			>
				<image
					:href="def.href"
					:x="0"
					:y="0"
					:width="def.width"
					:height="def.height"
					:preserveAspectRatio="def.preserveAspectRatio"
				/>
			</pattern>
		</defs>

		<rect
			v-if="vm.areaFill"
			:x="0"
			:y="0"
			:width="vm.svgWidth"
			:height="vm.svgHeight"
			:rx="vm.areaRadius"
			:fill="vm.areaFill"
		/>

		<text
			v-if="vm.title"
			:x="vm.titleX"
			:y="vm.titleY"
			text-anchor="middle"
			:font-size="vm.titleStyle?.fontSize ?? 12"
			:font-weight="vm.titleStyle?.fontWeight ?? 600"
			:font-family="vm.titleStyle?.fontFamily"
			:fill="vm.titleStyle?.fill ?? '#1e293b'"
			data-chart-part="title"
		>
			<template v-if="vm.titleRunSpans && vm.titleRunSpans.length > 0">
				<tspan
					v-for="(run, i) in vm.titleRunSpans"
					:key="`${elementId}-title-run-${i}`"
					:font-size="run.fontSize"
					:font-weight="run.fontWeight"
					:font-style="run.fontStyle"
					:font-family="run.fontFamily"
					:fill="run.fill"
				>
					{{ run.text }}
				</tspan>
			</template>
			<template v-else>{{ vm.title }}</template>
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

		<line
			v-for="(gl, i) in vm.secondaryGridlines ?? []"
			:key="`${elementId}-sgl-${i}`"
			:x1="gl.x1"
			:y1="gl.y1"
			:x2="gl.x2"
			:y2="gl.y2"
			:stroke="gl.stroke"
			:stroke-width="gl.strokeWidth"
			:stroke-dasharray="gl.dashArray"
			:opacity="gl.opacity ?? 1"
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
			:opacity="lbl.opacity ?? 1"
			:transform="lbl.transform"
		>
			{{ lbl.text }}
		</text>

		<text
			v-for="(lbl, i) in vm.secondaryAxisLabels ?? []"
			:key="`${elementId}-sal-${i}`"
			:x="lbl.x"
			:y="lbl.y"
			:text-anchor="lbl.textAnchor"
			:font-size="lbl.fontSize"
			:fill="lbl.fill"
			:font-weight="lbl.fontWeight ?? 'normal'"
			:dominant-baseline="lbl.dominantBaseline"
			:opacity="lbl.opacity ?? 1"
			:transform="lbl.transform"
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
				v-bind="partAttrs(prim.part)"
			>
				<title v-if="prim.title !== undefined">{{ prim.title }}</title>
			</rect>
			<path
				v-else-if="isPath(prim)"
				:d="prim.d"
				:fill="prim.fill"
				:stroke="prim.stroke ?? 'none'"
				:stroke-width="prim.strokeWidth ?? 0"
				:fill-opacity="prim.opacity ?? 1"
				v-bind="partAttrs(prim.part)"
			>
				<title v-if="prim.title !== undefined">{{ prim.title }}</title>
			</path>
			<polyline
				v-else-if="isPolyline(prim)"
				:points="prim.points"
				:stroke="prim.stroke"
				:stroke-width="prim.strokeWidth"
				:fill="prim.fill"
				:opacity="prim.opacity ?? 1"
				v-bind="partAttrs(prim.part)"
			>
				<title v-if="prim.title !== undefined">{{ prim.title }}</title>
			</polyline>
			<circle
				v-else-if="isCircle(prim)"
				:cx="prim.cx"
				:cy="prim.cy"
				:r="prim.r"
				:fill="prim.fill"
				:opacity="prim.opacity ?? 1"
				v-bind="partAttrs(prim.part)"
			>
				<title v-if="prim.title !== undefined">{{ prim.title }}</title>
			</circle>
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
				:transform="prim.transform"
			>
				<title v-if="prim.title !== undefined">{{ prim.title }}</title>
			</line>
			<polygon
				v-else-if="isPolygon(prim)"
				:points="prim.points"
				:fill="prim.fill"
				:stroke="prim.stroke"
				:stroke-width="prim.strokeWidth"
				:opacity="prim.opacity ?? 1"
				:stroke-dasharray="prim.dashArray"
				:transform="prim.transform"
				v-bind="partAttrs(prim.part)"
			>
				<title v-if="prim.title !== undefined">{{ prim.title }}</title>
			</polygon>
			<text
				v-else-if="isText(prim)"
				:x="prim.x"
				:y="prim.y"
				:text-anchor="prim.textAnchor"
				:font-size="prim.fontSize"
				:fill="prim.fill"
				:font-weight="prim.fontWeight ?? 'normal'"
				:font-style="prim.fontStyle ?? 'normal'"
				:font-family="prim.fontFamily"
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
			<text
				:x="13"
				:y="3"
				:font-size="entry.fontSize"
				:fill="entry.fill"
				:font-weight="entry.fontWeight"
				:font-style="entry.fontStyle"
				:font-family="entry.fontFamily"
			>
				{{ entry.label }}
			</text>
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
