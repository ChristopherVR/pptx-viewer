<script setup lang="ts">
import type { PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel, ElementAnimationState } from 'pptx-viewer-shared';
import {
	chartPlaceholderLabel,
	chartPreserveAspectRatio,
	resolveChartKind,
	resolveRevealedChartData,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAreaChart3D } from '../composables/area-chart-3d';
import { useBarChart3D } from '../composables/bar-chart-3d';
import { useChartCanvasInteraction } from '../composables/chart-canvas-interaction';
import { getContainerStyle } from '../composables/element-style';
import { useLineChart3D } from '../composables/line-chart-3d';
import { usePieChart3D } from '../composables/pie-chart-3d';
import { useSurfaceChart3D } from '../composables/surface-chart-3d';
import Area3DChartRenderer from './Area3DChartRenderer.vue';
import Bar3DChartRenderer from './Bar3DChartRenderer.vue';
import { buildVueChartViewModel } from './chart/chart-view-model';
import ChartEditOverlays from './chart/ChartEditOverlays.vue';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';
import Line3DChartRenderer from './Line3DChartRenderer.vue';
import PieChart3DRenderer from './PieChart3DRenderer.vue';
import SurfaceChart3DRenderer from './SurfaceChart3DRenderer.vue';

/**
 * ChartRenderer: a chart element as inline SVG.
 *
 * EVERY chart kind is projected from the framework-agnostic `buildChartViewModel`
 * engine in `pptx-viewer-shared` through `ChartViewModelSvg`. This component
 * decides nothing about geometry; it resolves the palette (via
 * `buildVueChartViewModel`), applies any staged animation reveal, and asks
 * shared which aspect-ratio policy the kind wants.
 *
 * Until this change, six kinds (waterfall / combo / stock / surface / treemap /
 * regionMap) were drawn by bespoke Vue components ported from a set of private
 * React renderers. They emitted no `data-chart-part` attributes, so on-canvas
 * mark selection silently did nothing for exactly those kinds while it worked
 * in Angular, Svelte and Vanilla; and two of them were plain wrong (the
 * waterfall scaled cumulative bars against the RAW value range, so its bars ran
 * off the top of the plot, and the treemap ignored ChartEx category levels so a
 * hierarchical treemap came out flat).
 */
const props = defineProps<{
	element: PptxElement;
	zIndex: number;
	mediaDataUrls?: Map<string, string>;
	/** True only on the primary editable canvas: enables direct chart editing. */
	interactive?: boolean;
	/** Emit the data-pptx-element marker even when not interactive (template layer). */
	marked?: boolean;
	/**
	 * Native-animation playback state. When it carries a staged chart build
	 * (`build.kind === 'chart'`, or the authored-index `chartReveal`) the chart
	 * reveals its series / categories / cells progressively via the shared
	 * `resolveRevealedChartData`.
	 */
	animationState?: ElementAnimationState;
}>();

const { t } = useI18n();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

// ── Direct on-canvas editing ─────────────────────────────────────
// Active only when the chart is selected + editable (gated inside the
// composable via the injected chart-canvas-edit context). During a value
// drag `renderedElement` carries the local preview chart data; the edit is
// committed once on release through the normal element-update path.
const rootEl = ref<HTMLElement | null>(null);
const {
	interactiveClass,
	renderedElement,
	dragLabel,
	titleDraft,
	onPointerdown,
	onPointermove,
	onPointerup,
	onDblclick,
	setTitleDraft,
	commitTitle,
	cancelTitle,
} = useChartCanvasInteraction({
	element: () => props.element,
	interactive: () => props.interactive === true,
	rootEl,
	buildViewModel: buildVueChartViewModel,
});

/**
 * The chart element with its data trimmed to the stages revealed at the current
 * build progress (drag preview wins first). Whole-chart / no-build renders return
 * the element unchanged. Mirrors React's `ChartElementView` `renderedElement`.
 */
const revealedElement = computed<PptxElement>(() => {
	const el = renderedElement.value;
	if (el.type !== 'chart' || !el.chartData) {
		return el;
	}
	const revealed = resolveRevealedChartData(el.chartData, props.animationState);
	return revealed === el.chartData ? el : { ...el, chartData: revealed };
});

/** Narrowed chart data, or undefined when the element is not a chart / empty. */
const chartData = computed<PptxChartData | undefined>(() => {
	const el = revealedElement.value;
	if (el.type !== 'chart') {
		return undefined;
	}
	const data = el.chartData;
	if (!data || data.series.length === 0) {
		return undefined;
	}
	return data;
});

const chartType = computed<PptxChartType>(() => chartData.value?.chartType ?? 'bar');

/** The shared engine's verdict on this chart's family. */
const chartKind = computed(() =>
	chartData.value ? resolveChartKind(chartType.value) : 'unsupported',
);

const isPlaceholder = computed(() => chartKind.value === 'unsupported');

/**
 * Opt-in interactive 3D surface scene (camera orbit/zoom via OrbitControls).
 * Marks are not selectable/draggable in this mode: a mesh facet has no 2D
 * screen geometry to hit-test against, so value-drag editing stays SVG-only.
 */
const use3D = useSurfaceChart3D();
const isSurfaceKind = computed(() => chartKind.value === 'surface');

/**
 * Opt-in interactive 3D bar scene (real box meshes, camera orbit/zoom via
 * OrbitControls). Same "marks are not selectable/draggable" caveat as the
 * surface scene above. Gated on the RAW chart type, not `chartKind`:
 * `resolveChartKind` folds `bar`/`bar3D` onto the same 'bar' kind, so a plain
 * 2D bar chart must never pick up the 3D scene.
 */
const use3DBar = useBarChart3D();
const isBar3DKind = computed(() => chartType.value === 'bar3D');

/**
 * Opt-in interactive 3D line/area scenes (tube path / ribbon meshes, camera
 * orbit/zoom via OrbitControls). Same "marks are not selectable/draggable"
 * caveat as the surface/bar scenes above.
 */
const use3DLine = useLineChart3D();
const isLine3DKind = computed(() => chartType.value === 'line3D');
const use3DArea = useAreaChart3D();
const isArea3DKind = computed(() => chartType.value === 'area3D');

/**
 * Opt-in interactive 3D pie scene (real wedge meshes, camera orbit/zoom via
 * OrbitControls). Same "marks are not selectable/draggable" caveat as the
 * surface/bar3D scenes above. Gated on the RAW chart type, not `chartKind`,
 * mirroring `isBar3DKind`: `resolveChartKind` folds `pie`/`doughnut`/`pie3D`
 * onto the same kind, so a plain 2D pie chart must never pick up the 3D scene.
 */
const use3DPie = usePieChart3D();
const isPie3DKind = computed(() => chartType.value === 'pie3D');

const placeholderLabel = computed(() =>
	chartPlaceholderLabel(chartType.value, (key, params) => t(key, params ?? {})),
);

/**
 * Shared view-model, with Vue's palette threaded in. Built from
 * `revealedElement` so an in-flight value drag previews live.
 */
const viewModel = computed<ChartViewModel | undefined>(() =>
	isPlaceholder.value ? undefined : buildVueChartViewModel(revealedElement.value),
);

/**
 * Aspect-ratio policy, decided by shared rather than by a local kind chain.
 * Vue's own chain had drifted: it letterboxed sunburst, which the other four
 * bindings stretch.
 */
const aspectRatio = computed(() => chartPreserveAspectRatio(chartKind.value));
</script>

<template>
	<div
		ref="rootEl"
		class="pptx-vue-element pptx-vue-chart"
		:class="interactiveClass"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive || marked ? 'true' : undefined"
		@pointerdown="onPointerdown"
		@pointermove="onPointermove"
		@pointerup="onPointerup"
		@dblclick="onDblclick"
	>
		<!-- Labelled placeholder for chart types the engine does not support -->
		<div v-if="isPlaceholder" class="pptx-vue-placeholder pptx-vue-chart-placeholder">
			{{ placeholderLabel }}
		</div>

		<!-- Opt-in interactive 3D surface scene, falling back to the SVG below -->
		<SurfaceChart3DRenderer
			v-else-if="use3D && isSurfaceKind && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
		/>

		<!-- Opt-in interactive 3D bar scene, falling back to the SVG below -->
		<Bar3DChartRenderer
			v-else-if="use3DBar && isBar3DKind && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
		/>

		<!-- Opt-in interactive 3D line scene, falling back to the SVG below -->
		<Line3DChartRenderer
			v-else-if="use3DLine && isLine3DKind && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
		/>

		<!-- Opt-in interactive 3D area scene, falling back to the SVG below -->
		<Area3DChartRenderer
			v-else-if="use3DArea && isArea3DKind && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
		/>

		<!-- Opt-in interactive 3D pie scene, falling back to the SVG below -->
		<PieChart3DRenderer
			v-else-if="use3DPie && isPie3DKind && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
		/>

		<!-- Every supported kind: the shared view-model engine, projected as SVG -->
		<ChartViewModelSvg
			v-else-if="viewModel"
			:element-id="element.id"
			:vm="viewModel"
			:preserve-aspect-ratio="aspectRatio"
		/>

		<!-- Drag value badge + inline title editor (direct on-canvas editing) -->
		<ChartEditOverlays
			:drag-label="dragLabel"
			:title-draft="titleDraft"
			@title-input="setTitleDraft"
			@title-commit="commitTitle"
			@title-cancel="cancelTitle"
		/>
	</div>
</template>

<style scoped>
.pptx-vue-chart {
	pointer-events: none;
}

/* On the editable canvas the chart opts back into pointer events so it can be
   click-selected like any other element (mirrors the SmartArt editable opt-in);
   thumbnails / export / presentation stay click-transparent. */
.pptx-vue-chart.pptx-vue-chart-selectable {
	pointer-events: auto;
}

.pptx-vue-chart-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	font-size: 11px;
	color: #475569;
	background: #f1f5f9;
	border: 1px dashed #cbd5e1;
	box-sizing: border-box;
}
</style>
