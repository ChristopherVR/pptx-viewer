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
import { useChartCanvasInteraction } from '../composables/chart-canvas-interaction';
import { useElementHitTargetStyle } from '../composables/element-hit-target';
import { getContainerStyle } from '../composables/element-style';
import { useChart3DView } from '../composables/use-chart-3d-view';
import { buildVueChartViewModel } from './chart/chart-view-model';
import ChartEditOverlays from './chart/ChartEditOverlays.vue';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';
import ThreeView from './ThreeView';

/**
 * ChartRenderer: a chart element as inline SVG.
 *
 * EVERY chart kind is projected from the framework-agnostic `buildChartViewModel`
 * engine in `pptx-viewer-shared` through `ChartViewModelSvg`. This component
 * decides nothing about geometry; it resolves the palette (via
 * `buildVueChartViewModel`), applies any staged animation reveal, and asks
 * shared which aspect-ratio policy the kind wants. All kinds render through
 * this single shared engine (no bespoke per-kind Vue components), so
 * `data-chart-part` mark selection and the value maths stay identical across
 * every chart kind and every binding.
 */
const props = defineProps<{
	element: PptxElement;
	zIndex: number;
	mediaDataUrls?: Map<string, string>;
	/** True only on the primary editable canvas: enables direct chart editing. */
	interactive?: boolean;
	/** Emit the data-pptx-element marker even when not interactive (template layer). */
	marked?: boolean;
	/** True only on the live presentation stage; see `hitTargetStyle`. */
	presenting?: boolean;
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

/** Degenerate-size hit-target overlay; see `ElementRenderer`'s doc comment (issue #285). */
const hitTargetStyle = useElementHitTargetStyle(
	() => props.element,
	() => props.interactive,
	() => props.presenting,
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

/** Chart data trimmed to the revealed build stage (drag preview wins first). */
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
 * Opt-in 3D scene (`<pptx-three-view>`): `threeD.spec` is `null` unless the
 * host opted this raw `c:chartType` into 3D (see `resolveChartThreeViewSpec`).
 * Built from the COMMITTED element, not the drag preview, so a value drag on
 * a 3D mark never remounts the scene under the pointer.
 */
const threeD = useChart3DView(
	() => props.element,
	() => props.interactive === true,
);
const threeSpec = threeD.spec;

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

/** Aspect-ratio policy, decided by shared so it cannot drift per binding. */
const aspectRatio = computed(() => chartPreserveAspectRatio(chartKind.value));

/**
 * Active text-style emphasis, threaded into the 3D scene's own `textStyle`:
 * the DOM CSS override above cannot reach a WebGL canvas.
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
		<!-- Interaction-only hit-target for a degenerate chart; see `hitTargetStyle`. -->
		<div
			v-if="hitTargetStyle"
			aria-hidden="true"
			data-pptx-hit-target="true"
			:style="hitTargetStyle"
		/>
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

		<!-- Opt-in 3D scene; the shared SVG render is its fallback while it loads or if it fails -->
		<ThreeView
			v-else-if="threeSpec && viewModel"
			:spec="threeSpec"
			:interactive="threeD.interactive.value"
			:selected-part="threeD.selectedPart.value"
			:text-style="textStyle"
			@select="threeD.onSelect"
			@drag="threeD.onDrag"
		>
			<ChartViewModelSvg
				:element-id="element.id"
				:vm="viewModel"
				:preserve-aspect-ratio="aspectRatio"
			/>
		</ThreeView>

		<!-- Every supported kind: the shared view-model engine, projected as SVG -->
		<ChartViewModelSvg
			v-else-if="viewModel"
			:element-id="element.id"
			:vm="viewModel"
			:preserve-aspect-ratio="aspectRatio"
		/>

		<!-- Drag value badge + inline title editor (direct on-canvas editing) -->
		<ChartEditOverlays
			:drag-label="dragLabel ?? threeD.dragLabel.value"
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
