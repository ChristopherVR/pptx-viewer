<script setup lang="ts">
/**
 * The slide surface inside Reading View.
 *
 * Two boxes, deliberately: the outer one is the scaled footprint the letterbox
 * maths reserves in the window, the inner {@link SlideStage} paints at the deck's
 * natural canvas size and is scaled into it. Scaling rather than re-laying-out
 * is what keeps a reader's slide pixel-identical to the editor's, down to line
 * breaks; recomputing text at the reduced size would reflow it.
 *
 * Nothing here caps the element count the way the thumbnail surfaces do. A cap
 * is harmless on a postage stamp and fatal in the one view whose entire purpose
 * is reading the slide.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { READING_VIEW_STAGE_ATTR } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { CanvasSize } from '../../types';
import SlideStage from '../SlideStage.vue';

const props = defineProps<{
	slide: PptxSlide;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	/** Fit scale from the shared reading-view layout maths; 0 means "not measured yet". */
	scale: number;
}>();

/** Neutral marker `e2e/` addresses all five bindings through. */
const stageAttrs = { [READING_VIEW_STAGE_ATTR]: 'true' };

const boxStyle = computed<CSSProperties>(() => ({
	width: `${Math.max(props.canvasSize.width, 1) * props.scale}px`,
	height: `${Math.max(props.canvasSize.height, 1) * props.scale}px`,
}));
</script>

<template>
	<!-- Before the first layout pass there is no honest size to draw at. -->
	<div
		v-if="scale > 0"
		v-bind="stageAttrs"
		class="pptx-vue-reading-stage"
		aria-roledescription="slide"
		:style="boxStyle"
	>
		<SlideStage
			:slide="slide"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:scale="scale"
		/>
	</div>
</template>

<style scoped>
.pptx-vue-reading-stage {
	position: relative;
	overflow: hidden;
	background: #ffffff;
	box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.6);
}
</style>
