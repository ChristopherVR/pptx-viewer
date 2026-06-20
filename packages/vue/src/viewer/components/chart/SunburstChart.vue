<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { computed } from 'vue';

import { buildVueChartViewModel } from './chart-view-model';
import ChartViewModelSvg from './ChartViewModelSvg.vue';

/**
 * SunburstChart: concentric arc rings, one ring per series, with outer rings
 * fading in opacity (rendered via the shared projector's path `fill-opacity`).
 *
 * Geometry, layout and palette now flow through the framework-agnostic
 * `buildSunburstViewModel` engine in `pptx-viewer-shared` (dispatched by
 * `buildChartViewModel` on `chartType === 'sunburst'`). Vue's style-id palette is
 * threaded in via `buildVueChartViewModel`, then the resulting view-model is
 * projected with the shared `ChartViewModelSvg` projector (mirroring React's
 * `renderSunburstChart`).
 */
const props = defineProps<{
	element: PptxElement;
}>();

const viewModel = computed<ChartViewModel>(() => buildVueChartViewModel(props.element));
</script>

<template>
	<ChartViewModelSvg
		:element-id="element.id"
		:vm="viewModel"
		preserve-aspect-ratio="xMidYMid meet"
	/>
</template>
