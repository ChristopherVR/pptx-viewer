<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * SlideCanvas — Vue port of the React `SlideCanvas.tsx` (viewer-first subset).
 *
 * Centres a {@link SlideStage} in a scrollable viewport with a drop shadow.
 * The React version additionally layered in rulers, grid, guides, marquee/
 * selection, connector-creation, drawing, and collaboration overlays — all
 * tracked in PORTING.md.
 */
const props = defineProps<{
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	zoom?: number;
}>();

const scale = computed(() => props.zoom ?? 1);

const wrapperStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width * scale.value}px`,
	height: `${props.canvasSize.height * scale.value}px`,
	position: 'relative',
	margin: '1rem auto',
	boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
}));
</script>

<template>
	<div class="pptx-vue-canvas-viewport">
		<div class="pptx-vue-canvas-wrapper" :style="wrapperStyle">
			<SlideStage
				:slide="slide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
			/>
		</div>
	</div>
</template>
