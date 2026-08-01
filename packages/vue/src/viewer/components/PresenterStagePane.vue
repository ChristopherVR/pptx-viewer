<script setup lang="ts">
/**
 * PresenterStagePane - the left 70% of the presenter console: the current
 * slide, scaled to fit and zoomable, plus PowerPoint's "Slide n of m" badge.
 *
 * Split out of `PresenterView.vue` to keep that file inside the repo's
 * 300-line ceiling once the control strip moved into it. Clicking the pane
 * advances the show (the way presenters actually drive a deck) unless a drawing
 * tool owns the pointer, in which case the host annotates instead.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { PRESENTER_CONSOLE_CLASSES, PRESENTER_RAIL_LABEL_KEYS } from 'pptx-viewer-shared';
import type { PresentationZoomState } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

const props = defineProps<{
	slide: PptxSlide;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	slideNumber: number;
	slideCount: number;
	zoom?: PresentationZoomState;
	advancesOnClick: boolean;
}>();

const emit = defineEmits<{ (e: 'advance'): void }>();

const { t } = useI18n();
const classes = PRESENTER_CONSOLE_CLASSES;

function onClick(): void {
	if (props.advancesOnClick) {
		emit('advance');
	}
}

// Fit the slide into a notional area; the flex layout (70% width) plus overflow
// clipping handles the rest.
const MAIN_FIT_WIDTH = 760;
const MAIN_FIT_HEIGHT = 460;
const mainScale = computed(() => {
	const { width, height } = props.canvasSize;
	if (width <= 0 || height <= 0) {
		return 1;
	}
	return Math.min(MAIN_FIT_WIDTH / width, MAIN_FIT_HEIGHT / height);
});
const frameStyle = computed(() => ({
	width: `${props.canvasSize.width * mainScale.value}px`,
	height: `${props.canvasSize.height * mainScale.value}px`,
	transform: `scale(${props.zoom?.scale ?? 1})`,
	transformOrigin: `${(props.zoom?.originX ?? 0.5) * 100}% ${(props.zoom?.originY ?? 0.5) * 100}%`,
}));
</script>

<template>
	<div
		role="presentation"
		data-pptx-presenter-slide
		class="pptx-vue-presenter-main"
		:class="[classes.main, { 'cursor-pointer': advancesOnClick }]"
		@click="onClick"
	>
		<div class="pptx-vue-presenter-stage relative overflow-hidden" :style="frameStyle">
			<SlideStage
				:slide="slide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="mainScale"
			/>
		</div>
		<div
			class="pptx-vue-presenter-slide-label mt-3 select-none font-mono text-xs tabular-nums text-white/50"
		>
			{{ t(PRESENTER_RAIL_LABEL_KEYS.slideLabel, { current: slideNumber, total: slideCount }) }}
		</div>
	</div>
</template>
