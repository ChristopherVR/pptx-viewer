<script setup lang="ts">
/**
 * PowerPoint's Reading View.
 *
 * The deck at full window size with the editor chrome reduced to a nav bar.
 * This is NOT the slide show: no Fullscreen API, no pointer tools, no presenter
 * console, no blackout. The reader gets the slide, a counter and three controls,
 * and Escape puts them back in the editor on the slide they stopped at. See
 * `render/reading-view` in `pptx-viewer-shared` for why the two views are kept
 * apart rather than sharing the presentation session.
 *
 * `position: fixed` fills the browser window without requesting fullscreen,
 * matching both PowerPoint's behaviour and the reference binding.
 */
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next';
import type { PptxSlide } from 'pptx-viewer-core';
import {
	canGoNext,
	canGoPrevious,
	formatSlideCounter,
	READING_VIEW_ATTR,
	READING_VIEW_COUNTER_ATTR,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useReadingView } from '../composables/useReadingView';
import type { CanvasSize } from '../types';
import ReadingViewStage from './reading-view/ReadingViewStage.vue';

const props = defineProps<{
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	/** Slide the editor is on; where the reader starts. */
	activeSlideIndex: number;
}>();

const emit = defineEmits<{
	/** Carries the slide the reader ended on, so the editor lands there. */
	exit: [slideIndex: number];
}>();

const { t } = useI18n();

const { state, viewportRef, scale, run } = useReadingView({
	slideCount: () => props.slides.length,
	canvasSize: () => props.canvasSize,
	initialSlideIndex: () => props.activeSlideIndex,
	onExit: (slideIndex) => emit('exit', slideIndex),
});

/** Neutral markers `e2e/` addresses all five bindings through. */
const rootAttrs = { [READING_VIEW_ATTR]: 'true' };
const counterAttrs = { [READING_VIEW_COUNTER_ATTR]: 'true' };

const slide = computed(() => props.slides[state.value.slideIndex]);
const counter = computed(() => formatSlideCounter(state.value.slideIndex, props.slides.length));
const previousDisabled = computed(() => !canGoPrevious(state.value));
const nextDisabled = computed(() => !canGoNext(state.value, props.slides.length));
</script>

<template>
	<div
		v-if="state.open && slide"
		v-bind="rootAttrs"
		class="pptx-vue-reading-view"
		role="region"
		:aria-label="t('pptx.view.readingView')"
	>
		<div ref="viewportRef" class="pptx-vue-reading-viewport">
			<ReadingViewStage
				:slide="slide"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:scale="scale"
			/>
		</div>

		<div class="pptx-vue-reading-bar">
			<button
				type="button"
				class="pptx-vue-reading-control"
				:aria-label="t('pptx.common.previous')"
				:title="t('pptx.common.previous')"
				:disabled="previousDisabled"
				@click="run({ command: 'previous' })"
			>
				<ChevronLeft :size="16" aria-hidden="true" />
			</button>
			<span v-bind="counterAttrs" class="pptx-vue-reading-counter">{{ counter }}</span>
			<button
				type="button"
				class="pptx-vue-reading-control"
				:aria-label="t('pptx.common.next')"
				:title="t('pptx.common.next')"
				:disabled="nextDisabled"
				@click="run({ command: 'next' })"
			>
				<ChevronRight :size="16" aria-hidden="true" />
			</button>
			<button
				type="button"
				class="pptx-vue-reading-control"
				:aria-label="t('pptx.statusBar.normalView')"
				:title="t('pptx.statusBar.normalView')"
				@click="run({ command: 'exit' })"
			>
				<X :size="16" aria-hidden="true" />
			</button>
		</div>
	</div>
</template>

<style scoped>
/* Fills the window, not the screen: Reading View never asks for fullscreen. */
.pptx-vue-reading-view {
	position: fixed;
	inset: 0;
	z-index: 1300;
	display: flex;
	flex-direction: column;
	background: #171717;
}

.pptx-vue-reading-viewport {
	display: flex;
	flex: 1 1 auto;
	min-height: 0;
	align-items: center;
	justify-content: center;
}

.pptx-vue-reading-bar {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	padding: 0.5rem 1rem;
	border-top: 1px solid rgb(255 255 255 / 0.1);
}

.pptx-vue-reading-control {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	padding: 0;
	color: rgb(255 255 255 / 0.8);
	background: transparent;
	border: 0;
	border-radius: 0.25rem;
	cursor: pointer;
}

.pptx-vue-reading-control:hover:not(:disabled) {
	color: #ffffff;
	background: rgb(255 255 255 / 0.15);
}

.pptx-vue-reading-control:disabled {
	opacity: 0.3;
	cursor: default;
}

.pptx-vue-reading-counter {
	min-width: 4rem;
	text-align: center;
	font-size: 0.75rem;
	font-variant-numeric: tabular-nums;
	color: rgb(255 255 255 / 0.7);
}
</style>
