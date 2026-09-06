<script setup lang="ts">
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { buildPieChart3DDataForElement } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

import { usePieChart3dScene } from '../composables/usePieChart3dScene';
import ChartEditOverlays from './chart/ChartEditOverlays.vue';
import ChartViewModelSvg from './chart/ChartViewModelSvg.vue';
import Chart3DLoading from './Chart3DLoading.vue';

/**
 * PieChart3DRenderer - Vue interactive 3D pie-chart view.
 *
 * When the chart resolves to a plottable wedge-mesh layout (see
 * `buildPieChart3DDataForElement`) and the optional `three` peer dependency
 * is installed, this mounts the shared, framework-agnostic vanilla-three
 * controller (`mountPieChart3D` from `pptx-viewer-shared`) into a container
 * div for a camera-orbitable set of real 3D wedge meshes (OrbitControls: drag
 * to rotate, scroll to zoom; click a wedge to select it, drag a wedge to
 * change its value). The mount lifecycle, including the bridge to the SAME
 * chart-part selection + commit path the 2D SVG mark interaction uses, lives
 * in {@link usePieChart3dScene}; this SFC stays thin presentation. Mirrors
 * `Bar3DChartRenderer.vue` exactly.
 *
 * Falls back to the plain SVG `ChartViewModelSvg` (rendered with the same
 * `viewModel`/`preserveAspectRatio` the parent `ChartRenderer` already built,
 * i.e. the flat oblique-projection pie3D illusion) when there is no
 * plottable series, `three` is not installed, or the scene fails to mount.
 *
 * Dragging a wedge sweeps its trailing edge around the pie's centre,
 * renormalising every other slice's angle live, exactly like the flat SVG
 * pie/doughnut's own on-canvas editing. Pie3D draws no axis labels, so unlike
 * its bar/line/area/surface siblings it carries no text-style emphasis
 * wiring.
 */
const props = defineProps<{
	element: PptxElement;
	/** The parent's already-built SVG view-model, used as the fallback render. */
	viewModel: ChartViewModel;
	preserveAspectRatio?: 'none' | 'xMidYMid meet';
}>();

const options = computed(() =>
	buildPieChart3DDataForElement(props.element, {
		width: props.element.width,
		height: props.element.height,
	}),
);

const chartData = computed<PptxChartData | undefined>(() =>
	props.element.type === 'chart' ? props.element.chartData : undefined,
);

const sceneContainer = ref<HTMLElement | null>(null);

const { mounted, loading, dragLabel } = usePieChart3dScene({
	container: sceneContainer,
	options,
	elementId: () => props.element.id,
	chartData: () => chartData.value,
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
		class="pptx-vue-pie-chart-3d-scene"
		:style="{ width: `${element.width}px`, height: `${element.height}px` }"
	/>
	<Chart3DLoading v-if="showLoading" :width="element.width" :height="element.height" />
	<ChartViewModelSvg
		v-else-if="showFallback"
		:element-id="element.id"
		:vm="viewModel"
		:preserve-aspect-ratio="preserveAspectRatio"
	/>
	<!-- Mid-drag value badge for a live value drag on a wedge mesh -->
	<ChartEditOverlays v-if="mounted" :drag-label="dragLabel" :title-draft="null" />
</template>

<style scoped>
.pptx-vue-pie-chart-3d-scene {
	will-change: transform;
}
</style>
