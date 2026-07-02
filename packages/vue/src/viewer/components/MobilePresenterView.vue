<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import {
	formatMobileElapsed,
	isFirstSlide,
	isLastSlide,
	mobileElapsedSince,
	mobileNextThumbSize,
	mobileSlideCounter,
} from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { notesSegmentsToSpans } from '../composables/presenter-view-utils';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * MobilePresenterView - single-column phone layout for presenter/speaker view.
 *
 * Shown instead of the desktop split-screen `PresenterView` when the speaker
 * enters presenter mode on a small screen (the host `PresentationMode` branches
 * on `useIsMobile`). The desktop layout is left unchanged; only the layout
 * differs. Pure geometry / labels / time formatting come from
 * `pptx-viewer-shared` (`presenter-mobile`).
 *
 * Top to bottom: header (elapsed timer + counter + exit), the current slide
 * large, a small next-slide thumbnail, scrollable speaker notes, and prev/next
 * controls; all offset by the device safe-area insets.
 */
const props = defineProps<{
	slides: PptxSlide[];
	currentSlideIndex: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	/** Timestamp (ms) the presentation started, or `null`. */
	presentationStartTime: number | null;
}>();

const emit = defineEmits<{
	(e: 'move', direction: 1 | -1): void;
	(e: 'exit'): void;
}>();

const { t } = useI18n();

// -- Live elapsed timer (1 Hz tick) -----------------------------------------
const now = ref(Date.now());
let clockId: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
	clockId = setInterval(() => {
		now.value = Date.now();
	}, 1000);
});

onBeforeUnmount(() => {
	if (clockId !== null) {
		clearInterval(clockId);
		clockId = null;
	}
});

const elapsedText = computed(() =>
	formatMobileElapsed(mobileElapsedSince(props.presentationStartTime, now.value)),
);

// -- Slide data -------------------------------------------------------------
const currentSlide = computed<PptxSlide | undefined>(() => props.slides[props.currentSlideIndex]);
const nextSlide = computed<PptxSlide | undefined>(() =>
	props.currentSlideIndex + 1 < props.slides.length
		? props.slides[props.currentSlideIndex + 1]
		: undefined,
);

const counterText = computed(() =>
	mobileSlideCounter(props.currentSlideIndex, props.slides.length),
);
const atFirst = computed(() => isFirstSlide(props.currentSlideIndex));
const atLast = computed(() => isLastSlide(props.currentSlideIndex, props.slides.length));

const notesText = computed(() => currentSlide.value?.notes ?? '');
const notesSpans = computed(() => {
	const segments = currentSlide.value?.notesSegments;
	return segments && segments.length > 0 ? notesSegmentsToSpans(segments) : null;
});
const hasPlainNotes = computed(() => notesText.value.trim().length > 0);

// -- Main-stage scaling: fit the slide into the column width (a notional box;
// the flex layout + overflow clipping handle the rest).
const MAIN_FIT_WIDTH = 640;
const mainScale = computed(() => {
	const { width } = props.canvasSize;
	return width > 0 ? MAIN_FIT_WIDTH / width : 1;
});
const mainFrameStyle = computed(() => ({
	width: `${props.canvasSize.width * mainScale.value}px`,
	height: `${props.canvasSize.height * mainScale.value}px`,
}));

// -- Next-slide thumbnail geometry (shared) ---------------------------------
const thumb = computed(() => mobileNextThumbSize(props.canvasSize.width, props.canvasSize.height));
const thumbFrameStyle = computed(() => ({
	width: `${thumb.value.width}px`,
	height: `${thumb.value.height}px`,
}));
</script>

<template>
	<div
		v-if="!currentSlide"
		class="pptx-vue-mpresenter pptx-vue-mpresenter--empty absolute inset-0 z-50 flex items-center justify-center bg-card text-muted-foreground"
	>
		{{ t('pptx.mpresenter.noSlides') }}
	</div>
	<div
		v-else
		class="pptx-vue-mpresenter absolute inset-0 z-50 flex flex-col bg-card text-foreground"
	>
		<!-- Header: elapsed + counter + exit -->
		<div
			class="pptx-vue-mpresenter-header flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2"
		>
			<div class="flex flex-col">
				<span class="text-[10px] uppercase tracking-wider text-muted-foreground">{{
					t('pptx.mpresenter.elapsed')
				}}</span>
				<span class="font-mono text-lg tabular-nums text-primary">{{ elapsedText }}</span>
			</div>
			<span class="font-mono text-sm tabular-nums text-foreground">{{ counterText }}</span>
			<button
				type="button"
				class="pptx-vue-mpresenter-exit flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				:title="t('pptx.presenter.endPresentation')"
				:aria-label="t('pptx.presenter.endPresentation')"
				@click="emit('exit')"
			>
				&times;
			</button>
		</div>

		<!-- Current slide (large) -->
		<div class="pptx-vue-mpresenter-main flex items-center justify-center bg-black px-3 py-3">
			<div class="relative overflow-hidden" :style="mainFrameStyle">
				<SlideStage
					:slide="currentSlide"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="mainScale"
				/>
			</div>
		</div>

		<!-- Next thumbnail -->
		<div
			class="pptx-vue-mpresenter-next flex items-center gap-3 border-b border-border/60 px-4 py-2"
		>
			<span class="whitespace-nowrap text-[10px] uppercase tracking-wider text-muted-foreground">{{
				t('pptx.mobileBar.nextSlide')
			}}</span>
			<div
				v-if="nextSlide"
				class="relative flex-shrink-0 overflow-hidden rounded border border-border/30"
				:style="thumbFrameStyle"
			>
				<SlideStage
					:slide="nextSlide"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="thumb.scale"
				/>
			</div>
			<div
				v-else
				class="flex h-12 flex-1 items-center justify-center rounded border border-border/30 bg-muted/40 text-[10px] italic text-muted-foreground"
			>
				{{ t('pptx.mpresenter.endOfPresentation') }}
			</div>
		</div>

		<!-- Speaker notes (scrollable) -->
		<div class="pptx-vue-mpresenter-notes flex flex-1 min-h-0 flex-col px-4 py-2">
			<div class="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
				{{ t('pptx.presenter.speakerNotes') }}
			</div>
			<div
				class="flex-1 overflow-y-auto whitespace-pre-wrap rounded border border-border/30 bg-muted/40 px-3 py-2 text-[15px] leading-relaxed text-foreground"
			>
				<template v-if="notesSpans">
					<template v-for="span in notesSpans" :key="span.key">
						<br v-if="span.kind === 'break'" />
						<span v-else :style="span.style">{{ span.text }}</span>
					</template>
				</template>
				<template v-else-if="hasPlainNotes">{{ notesText }}</template>
				<span v-else class="italic text-muted-foreground">{{ t('pptx.mpresenter.noNotes') }}</span>
			</div>
		</div>

		<!-- Prev / Next controls -->
		<div
			class="pptx-vue-mpresenter-ctl flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2"
		>
			<button
				type="button"
				class="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded bg-muted text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
				:disabled="atFirst"
				:title="t('pptx.mobileBar.previousSlide')"
				:aria-label="t('pptx.mobileBar.previousSlide')"
				@click="emit('move', -1)"
			>
				‹ {{ t('pptx.mpresenter.prev') }}
			</button>
			<button
				type="button"
				class="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded bg-muted text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
				:disabled="atLast"
				:title="t('pptx.mobileBar.nextSlide')"
				:aria-label="t('pptx.mobileBar.nextSlide')"
				@click="emit('move', 1)"
			>
				{{ t('pptx.mpresenter.next') }} ›
			</button>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-mpresenter {
	padding-top: env(safe-area-inset-top, 0px);
	padding-bottom: env(safe-area-inset-bottom, 0px);
	padding-left: env(safe-area-inset-left, 0px);
	padding-right: env(safe-area-inset-right, 0px);
}
</style>
