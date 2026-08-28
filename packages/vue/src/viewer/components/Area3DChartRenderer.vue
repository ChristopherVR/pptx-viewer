<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { buildAreaChart3DDataForElement } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

import { useAreaChart3dScene } from '../composables/useAreaChart3dScene';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';

/**
 * Area3DChartRenderer - Vue interactive 3D area-chart view.
 *
 * When the chart resolves to a plottable per-series path + ribbon layout (see
 * `buildAreaChart3DDataForElement`) and the optional `three` peer dependency
 * is installed, this mounts the shared, framework-agnostic vanilla-three
 * controller (`mountAreaChart3D` from `pptx-viewer-shared`) into a container
 * div for a camera-orbitable set of real 3D tube + ribbon meshes
 * (OrbitControls: drag to rotate, scroll to zoom). The mount lifecycle lives
 * in {@link useAreaChart3dScene}; this SFC stays thin presentation. Mirrors
 * `Bar3DChartRenderer.vue` / `Line3DChartRenderer.vue` exactly.
 *
 * Falls back to the plain SVG `ChartViewModelSvg` (rendered with the same
 * `viewModel`/`preserveAspectRatio` the parent `ChartRenderer` already built,
 * i.e. the flat oblique-projection area3D illusion) when there is no
 * plottable grid, `three` is not installed, or the scene fails to mount.
 */
const props = defineProps<{
	element: PptxElement;
	/** The parent's already-built SVG view-model, used as the fallback render. */
	viewModel: ChartViewModel;
	preserveAspectRatio?: 'none' | 'xMidYMid meet';
}>();

const options = computed(() =>
	buildAreaChart3DDataForElement(props.element, {
		width: props.element.width,
		height: props.element.height,
	}),
);

const sceneContainer = ref<HTMLElement | null>(null);

const { mounted } = useAreaChart3dScene({
	container: sceneContainer,
	options,
});

/** Show the SVG fallback whenever an interactive scene is not mounted. */
const showFallback = computed(() => !mounted.value);
</script>

<template>
	<!--
		Always present so the scene can mount into it (v-show, not v-if, keeps
		the ref attached). Hidden while the SVG fallback is showing.
	-->
	<div
		v-show="mounted"
		ref="sceneContainer"
		class="pptx-vue-area-chart-3d-scene"
		:style="{ width: `${element.width}px`, height: `${element.height}px` }"
	/>
	<ChartViewModelSvg
		v-if="showFallback"
		:element-id="element.id"
		:vm="viewModel"
		:preserve-aspect-ratio="preserveAspectRatio"
	/>
</template>

<style scoped>
.pptx-vue-area-chart-3d-scene {
	will-change: transform;
}
</style>
