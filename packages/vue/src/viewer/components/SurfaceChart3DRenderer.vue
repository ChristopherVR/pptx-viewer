<script setup lang="ts">
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel, TextStyleAnimationDescriptor } from 'pptx-viewer-shared';
import { buildSurfaceChart3DDataForElement } from 'pptx-viewer-shared';
import { computed, ref, toRef } from 'vue';

import { useSurfaceChart3dScene } from '../composables/useSurfaceChart3dScene';
import ChartEditOverlays from './chart/ChartEditOverlays.vue';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';
import Chart3DLoading from './Chart3DLoading.vue';

/**
 * SurfaceChart3DRenderer - Vue interactive 3D surface-chart view.
 *
 * When the chart resolves to a plottable grid (see
 * `buildSurfaceChart3DDataForElement`) and the optional `three` peer
 * dependency is installed, this mounts the shared, framework-agnostic
 * vanilla-three controller (`mountSurfaceChart3D` from `pptx-viewer-shared`)
 * into a container div for a camera-orbitable surface mesh (OrbitControls:
 * drag to rotate, scroll to zoom; click a facet to select it through the SAME
 * chart-part selection context the 2D SVG mark interaction uses, drag the
 * selected vertex to change its value). The mount lifecycle lives in
 * {@link useSurfaceChart3dScene}; this SFC stays thin presentation.
 *
 * Falls back to the plain SVG `ChartViewModelSvg` (rendered with the same
 * `viewModel`/`preserveAspectRatio` the parent `ChartRenderer` already built)
 * when there is no plottable grid, `three` is not installed, or the scene
 * fails to mount. Mirrors `Model3DRenderer.vue`'s poster-fallback shape.
 */
const props = defineProps<{
	element: PptxElement;
	/** The parent's already-built SVG view-model, used as the fallback render. */
	viewModel: ChartViewModel;
	preserveAspectRatio?: 'none' | 'xMidYMid meet';
	/**
	 * Active font-style emphasis override (Bold Flash, Bold Reveal, Underline,
	 * Change Font Style/Size), applied to the scene's own axis-label text via
	 * the mounted handle's `setTextStyle` (a DOM CSS override cannot reach a
	 * WebGL canvas).
	 */
	textStyle?: TextStyleAnimationDescriptor;
}>();

const options = computed(() =>
	buildSurfaceChart3DDataForElement(props.element, {
		width: props.element.width,
		height: props.element.height,
	}),
);

const chartData = computed<PptxChartData | undefined>(() =>
	props.element.type === 'chart' ? props.element.chartData : undefined,
);

const sceneContainer = ref<HTMLElement | null>(null);

const { mounted, loading, dragLabel } = useSurfaceChart3dScene({
	container: sceneContainer,
	options,
	elementId: () => props.element.id,
	chartData: () => chartData.value,
	textStyle: toRef(props, 'textStyle'),
});

/** Show the SVG fallback once loading has settled without a mounted scene. */
const showFallback = computed(() => !mounted.value && !loading.value);
/** Show the spinner while a mount attempt is still in flight. */
const showLoading = computed(() => !mounted.value && loading.value);
</script>

<template>
	<!--
		Always present so the scene can mount into it (v-show, not v-if, keeps
		the ref attached). Hidden while the loading spinner or SVG fallback is
		showing.
	-->
	<div
		v-show="mounted"
		ref="sceneContainer"
		class="pptx-vue-surface-chart-3d-scene"
		:style="{ width: `${element.width}px`, height: `${element.height}px` }"
	/>
	<Chart3DLoading v-if="showLoading" :width="element.width" :height="element.height" />
	<ChartViewModelSvg
		v-else-if="showFallback"
		:element-id="element.id"
		:vm="viewModel"
		:preserve-aspect-ratio="preserveAspectRatio"
	/>
	<!-- Mid-drag value badge for a live value drag on the selected vertex -->
	<ChartEditOverlays v-if="mounted" :drag-label="dragLabel" :title-draft="null" />
</template>

<style scoped>
.pptx-vue-surface-chart-3d-scene {
	will-change: transform;
}
</style>
