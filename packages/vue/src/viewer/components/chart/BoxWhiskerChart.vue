<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { computed } from 'vue';

import { buildVueChartViewModel } from './chart-view-model';
import ChartViewModelSvg from './ChartViewModelSvg.vue';

/**
 * BoxWhiskerChart: per category, the cross-series values form the five-number
 * summary (min / Q1 / median / Q3 / max), drawn as whisker lines + caps, an IQR
 * box and a median line.
 *
 * Geometry, layout and palette now flow through the framework-agnostic
 * `buildBoxWhiskerViewModel` engine in `pptx-viewer-shared` (dispatched by
 * `buildChartViewModel` on `chartType === 'boxWhisker'`). Vue's style-id palette
 * is threaded in via `buildVueChartViewModel`, then the resulting view-model is
 * projected with the shared `ChartViewModelSvg` projector (mirroring React's
 * `renderBoxWhiskerChart`).
 */
const props = defineProps<{
	element: PptxElement;
}>();

const viewModel = computed<ChartViewModel>(() => buildVueChartViewModel(props.element));
</script>

<template>
	<ChartViewModelSvg :element-id="element.id" :vm="viewModel" preserve-aspect-ratio="none" />
</template>
