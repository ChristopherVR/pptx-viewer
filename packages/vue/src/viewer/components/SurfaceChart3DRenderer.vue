<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { buildSurfaceChart3DDataForElement } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

import { useSurfaceChart3dScene } from '../composables/useSurfaceChart3dScene';
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
 * drag to rotate, scroll to zoom). The mount lifecycle lives in
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
}>();

const options = computed(() =>
	buildSurfaceChart3DDataForElement(props.element, {
		width: props.element.width,
		height: props.element.height,
	}),
);

const sceneContainer = ref<HTMLElement | null>(null);

const { mounted, loading } = useSurfaceChart3dScene({
	container: sceneContainer,
	options,
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
</template>

<style scoped>
.pptx-vue-surface-chart-3d-scene {
	will-change: transform;
}
</style>
