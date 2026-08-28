<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { buildLineChart3DDataForElement } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

import { useLineChart3dScene } from '../composables/useLineChart3dScene';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';
import Chart3DLoading from './Chart3DLoading.vue';

/**
 * Line3DChartRenderer - Vue interactive 3D line-chart view.
 *
 * When the chart resolves to a plottable per-series path layout (see
 * `buildLineChart3DDataForElement`) and the optional `three` peer dependency
 * is installed, this mounts the shared, framework-agnostic vanilla-three
 * controller (`mountLineChart3D` from `pptx-viewer-shared`) into a container
 * div for a camera-orbitable set of real 3D tube-path meshes (OrbitControls:
 * drag to rotate, scroll to zoom). The mount lifecycle lives in
 * {@link useLineChart3dScene}; this SFC stays thin presentation. Mirrors
 * `Bar3DChartRenderer.vue` exactly.
 *
 * Falls back to the plain SVG `ChartViewModelSvg` (rendered with the same
 * `viewModel`/`preserveAspectRatio` the parent `ChartRenderer` already built,
 * i.e. the flat oblique-projection line3D illusion) when there is no
 * plottable grid, `three` is not installed, or the scene fails to mount.
 */
const props = defineProps<{
	element: PptxElement;
	/** The parent's already-built SVG view-model, used as the fallback render. */
	viewModel: ChartViewModel;
	preserveAspectRatio?: 'none' | 'xMidYMid meet';
}>();

const options = computed(() =>
	buildLineChart3DDataForElement(props.element, {
		width: props.element.width,
		height: props.element.height,
	}),
);

const sceneContainer = ref<HTMLElement | null>(null);

const { mounted, loading } = useLineChart3dScene({
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
		class="pptx-vue-line-chart-3d-scene"
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
.pptx-vue-line-chart-3d-scene {
	will-change: transform;
}
</style>
