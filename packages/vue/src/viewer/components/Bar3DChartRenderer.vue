<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { buildBarChart3DDataForElement } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

import { useBarChart3dScene } from '../composables/useBarChart3dScene';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';
import Chart3DLoading from './Chart3DLoading.vue';

/**
 * Bar3DChartRenderer - Vue interactive 3D bar-chart view.
 *
 * When the chart resolves to a plottable box-mesh layout (see
 * `buildBarChart3DDataForElement`) and the optional `three` peer dependency
 * is installed, this mounts the shared, framework-agnostic vanilla-three
 * controller (`mountBarChart3D` from `pptx-viewer-shared`) into a container
 * div for a camera-orbitable set of real 3D box meshes (OrbitControls: drag
 * to rotate, scroll to zoom). The mount lifecycle lives in
 * {@link useBarChart3dScene}; this SFC stays thin presentation. Mirrors
 * `SurfaceChart3DRenderer.vue` exactly.
 *
 * Falls back to the plain SVG `ChartViewModelSvg` (rendered with the same
 * `viewModel`/`preserveAspectRatio` the parent `ChartRenderer` already built,
 * i.e. the flat oblique-projection bar3D illusion) when there is no
 * plottable grid, `three` is not installed, or the scene fails to mount.
 */
const props = defineProps<{
	element: PptxElement;
	/** The parent's already-built SVG view-model, used as the fallback render. */
	viewModel: ChartViewModel;
	preserveAspectRatio?: 'none' | 'xMidYMid meet';
}>();

const options = computed(() =>
	buildBarChart3DDataForElement(props.element, {
		width: props.element.width,
		height: props.element.height,
	}),
);

const sceneContainer = ref<HTMLElement | null>(null);

const { mounted, loading } = useBarChart3dScene({
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
		class="pptx-vue-bar-chart-3d-scene"
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
.pptx-vue-bar-chart-3d-scene {
	will-change: transform;
}
</style>
