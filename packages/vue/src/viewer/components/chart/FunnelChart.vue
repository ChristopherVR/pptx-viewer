<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { computed } from 'vue';

import { buildVueChartViewModel } from './chart-view-model';
import ChartViewModelSvg from './ChartViewModelSvg.vue';

/**
 * FunnelChart: descending trapezoids.
 *
 * Geometry, layout and palette now flow through the framework-agnostic
 * `buildFunnelViewModel` engine in `pptx-viewer-shared` (dispatched by
 * `buildChartViewModel` on `chartType === 'funnel'`). Vue's style-id palette is
 * threaded in via `buildVueChartViewModel`, then the resulting view-model is
 * projected with the shared `ChartViewModelSvg` projector (mirroring React's
 * `renderFunnelChart`).
 */
const props = defineProps<{
	element: PptxElement;
}>();

const viewModel = computed<ChartViewModel>(() => buildVueChartViewModel(props.element));
</script>

<template>
	<ChartViewModelSvg :element-id="element.id" :vm="viewModel" preserve-aspect-ratio="none" />
</template>
