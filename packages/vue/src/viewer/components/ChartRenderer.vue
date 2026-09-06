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

import { useBarFacePictureSampleVersion } from '../composables/bar-face-picture-sample-version';
import { useChart3DSceneSelection } from '../composables/chart-3d-scene-selection';
import { useChartCanvasInteraction } from '../composables/chart-canvas-interaction';
import { getContainerStyle } from '../composables/element-style';
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
	/**
	 * Scoped `!important` CSS override for an active font-style emphasis effect
	 * (Bold Flash, Bold Reveal, Underline, Change Font Style/Size), built by the
	 * parent `ElementRenderer` (`buildTextStyleOverrideCss`) so a chart
	 * title/label/legend animates the same way a shape's text does.
	 */
	textStyleOverrideCss?: string;
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
 * Opt-in interactive 3D scenes (real box/wedge/tube-path/ribbon/surface
 * meshes, camera orbit/zoom via OrbitControls, plus on-canvas part
 * click/drag; see `useChart3DSceneSelection`). Marks are not
 * selectable/draggable for surface/pie: a mesh facet or wedge has no single
 * vertical value axis to drag against.
 */
const { showSurface3D, showBar3D, showLine3D, showArea3D, showPie3D } = useChart3DSceneSelection({
	chartKind: () => chartKind.value,
	chartType: () => chartType.value,
});

const placeholderLabel = computed(() =>
	chartPlaceholderLabel(chartType.value, (key, params) => t(key, params ?? {})),
);

// An untargeted bar3D extrusion face whose fill is picture-only samples a
// colour from the picture ASYNCHRONOUSLY (see `chart-bar3d-face-picture-
// sample.ts`'s module doc for the COM-verified ground truth this
// reproduces); the shared view-model builder only ever sees whatever is
// already cached, so `viewModel` below reads this to rebuild once one lands.
const barFacePictureSampleVersion = useBarFacePictureSampleVersion();

/**
 * Shared view-model, with Vue's palette threaded in. Built from
 * `revealedElement` so an in-flight value drag previews live.
 */
const viewModel = computed<ChartViewModel | undefined>(() => {
	// Referenced so this computed re-derives once a bar3D face-picture colour
	// sample resolves (the shared sample cache is a plain module-level cache,
	// not a Vue ref, so Vue would otherwise never know to re-run this).
	void barFacePictureSampleVersion.value;
	return isPlaceholder.value ? undefined : buildVueChartViewModel(revealedElement.value);
});

/**
 * Aspect-ratio policy, decided by shared rather than by a local kind chain.
 * Vue's own chain had drifted: it letterboxed sunburst, which the other four
 * bindings stretch.
 */
const aspectRatio = computed(() => chartPreserveAspectRatio(chartKind.value));

/**
 * Active text-style emphasis override, threaded into the 3D chart renderers'
 * own `textStyle` prop: they apply it via their mounted handle's
 * `setTextStyle` (a DOM CSS override, i.e. `textStyleOverrideCss` above,
 * cannot reach a WebGL canvas). Pie3D draws no axis labels, so it does not
 * take this prop.
 */
const textStyle = computed(() => props.animationState?.textStyle);
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
		<!--
			`<style>` is a forbidden side-effect tag in an SFC template, so the
			override is rendered through the dynamic `<component :is>` escape
			hatch instead (see `ElementRenderer.vue`).
		-->
		<component :is="'style'" v-if="textStyleOverrideCss">{{ textStyleOverrideCss }}</component>
		<!-- Labelled placeholder for chart types the engine does not support -->
		<div v-if="isPlaceholder" class="pptx-vue-placeholder pptx-vue-chart-placeholder">
			{{ placeholderLabel }}
		</div>

		<!-- Opt-in interactive 3D surface scene, falling back to the SVG below -->
		<SurfaceChart3DRenderer
			v-else-if="showSurface3D && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
			:text-style="textStyle"
		/>

		<!-- Opt-in interactive 3D bar scene, falling back to the SVG below -->
		<Bar3DChartRenderer
			v-else-if="showBar3D && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
			:text-style="textStyle"
		/>

		<!-- Opt-in interactive 3D line scene, falling back to the SVG below -->
		<Line3DChartRenderer
			v-else-if="showLine3D && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
			:text-style="textStyle"
		/>

		<!-- Opt-in interactive 3D area scene, falling back to the SVG below -->
		<Area3DChartRenderer
			v-else-if="showArea3D && viewModel"
			:element="revealedElement"
			:view-model="viewModel"
			:preserve-aspect-ratio="aspectRatio"
			:text-style="textStyle"
		/>

		<!-- Opt-in interactive 3D pie scene, falling back to the SVG below -->
		<PieChart3DRenderer
			v-else-if="showPie3D && viewModel"
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
