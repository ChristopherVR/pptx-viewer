<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
	clampNotesFontSize,
	formatElapsed,
	formatTime,
	notesSegmentsToSpans,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
} from '../composables/presenter-view-utils';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * PresenterView — split-screen presenter layout: current slide (left, 70%) plus
 * a control rail (right, 30%) with the wall-clock time, elapsed timer, prev/next
 * navigation, a next-slide preview, scalable speaker notes, and a 5-minute
 * timer progress bar. Vue port of the React `PresenterView`.
 *
 * Rendered as an absolute overlay by the host (`PresentationMode`). Keyboard
 * navigation is owned by the host; this component only emits navigation /
 * exit intents.
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

// -- Live clock -------------------------------------------------------------
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

const elapsed = computed(() =>
	props.presentationStartTime ? now.value - props.presentationStartTime : 0,
);

const clockText = computed(() => formatTime(new Date(now.value)));
const elapsedText = computed(() => formatElapsed(elapsed.value));

// -- Timer progress (5-minute segments) ------------------------------------
const TIMER_SEGMENT_MS = 5 * 60 * 1000;
const timerProgress = computed(() =>
	Math.min(100, ((elapsed.value % TIMER_SEGMENT_MS) / TIMER_SEGMENT_MS) * 100),
);
const timerSegment = computed(() => Math.floor(elapsed.value / TIMER_SEGMENT_MS));

// -- Notes font size --------------------------------------------------------
const notesFontSize = ref(NOTES_FONT_SIZE_DEFAULT);

function increaseNotesFontSize(): void {
	notesFontSize.value = clampNotesFontSize(notesFontSize.value + NOTES_FONT_SIZE_STEP);
}

function decreaseNotesFontSize(): void {
	notesFontSize.value = clampNotesFontSize(notesFontSize.value - NOTES_FONT_SIZE_STEP);
}

// -- Slide data -------------------------------------------------------------
const currentSlide = computed<PptxSlide | undefined>(() => props.slides[props.currentSlideIndex]);
const nextSlide = computed<PptxSlide | undefined>(() =>
	props.currentSlideIndex + 1 < props.slides.length
		? props.slides[props.currentSlideIndex + 1]
		: undefined,
);

const notesText = computed(() => currentSlide.value?.notes ?? '');
const notesSpans = computed(() => {
	const segments = currentSlide.value?.notesSegments;
	return segments && segments.length > 0 ? notesSegmentsToSpans(segments) : null;
});
const hasPlainNotes = computed(() => notesText.value.trim().length > 0);

const atFirst = computed(() => props.currentSlideIndex === 0);
const atLast = computed(() => props.currentSlideIndex >= props.slides.length - 1);

// -- Preview scaling (fit into a ~260px-wide rail panel) --------------------
const PREVIEW_WIDTH = 240;
const previewScale = computed(() =>
	props.canvasSize.width > 0 ? PREVIEW_WIDTH / props.canvasSize.width : 1,
);
const previewFrameStyle = computed(() => ({
	width: `${props.canvasSize.width * previewScale.value}px`,
	height: `${props.canvasSize.height * previewScale.value}px`,
}));

// -- Main-stage scaling: fit the slide into a notional area; the flex layout
// (70% width) plus overflow clipping handles the rest.
const MAIN_FIT_WIDTH = 760;
const MAIN_FIT_HEIGHT = 460;
const mainScale = computed(() => {
	const { width, height } = props.canvasSize;
	if (width <= 0 || height <= 0) {
		return 1;
	}
	return Math.min(MAIN_FIT_WIDTH / width, MAIN_FIT_HEIGHT / height);
});
const previewMainFrameStyle = computed(() => ({
	width: `${props.canvasSize.width * mainScale.value}px`,
	height: `${props.canvasSize.height * mainScale.value}px`,
}));
</script>

<template>
	<div
		v-if="!currentSlide"
		class="pptx-vue-presenter pptx-vue-presenter--empty absolute inset-0 z-50 flex items-center justify-center bg-card text-muted-foreground"
	>
		No slides to present.
	</div>
	<div
		v-else
		class="pptx-vue-presenter absolute inset-0 z-50 flex flex-col bg-card text-foreground"
	>
		<div class="pptx-vue-presenter-body flex flex-1 min-h-0">
			<!-- Left: current slide -->
			<div
				class="pptx-vue-presenter-main flex flex-[7] min-w-0 flex-col items-center justify-center overflow-hidden bg-black p-6"
			>
				<div
					class="pptx-vue-presenter-stage relative overflow-hidden"
					:style="previewMainFrameStyle"
				>
					<SlideStage
						:slide="currentSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:scale="mainScale"
					/>
				</div>
				<div
					class="pptx-vue-presenter-slide-label mt-3 select-none font-mono text-xs tabular-nums text-white/50"
				>
					Slide {{ currentSlideIndex + 1 }} of {{ slides.length }}
				</div>
			</div>

			<!-- Right: controls -->
			<div
				class="pptx-vue-presenter-rail flex flex-[3] min-w-[260px] max-w-[440px] flex-col border-l border-border bg-background"
			>
				<!-- Header: clock + elapsed + exit -->
				<div
					class="pptx-vue-presenter-header flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3"
				>
					<div class="pptx-vue-presenter-time flex flex-col">
						<span
							class="pptx-vue-presenter-label text-[10px] uppercase tracking-wider text-muted-foreground"
							>Current time</span
						>
						<span class="pptx-vue-presenter-clock font-mono text-lg tabular-nums text-foreground">{{
							clockText
						}}</span>
					</div>
					<div
						class="pptx-vue-presenter-time pptx-vue-presenter-time--right flex flex-col items-end"
					>
						<span
							class="pptx-vue-presenter-label text-[10px] uppercase tracking-wider text-muted-foreground"
							>Elapsed</span
						>
						<span class="pptx-vue-presenter-elapsed font-mono text-lg tabular-nums text-primary">{{
							elapsedText
						}}</span>
					</div>
					<button
						type="button"
						class="pptx-vue-presenter-icon-btn flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						title="End presentation"
						aria-label="End presentation"
						@click="emit('exit')"
					>
						&times;
					</button>
				</div>

				<!-- Navigation -->
				<div
					class="pptx-vue-presenter-nav flex items-center justify-between border-b border-border/60 px-4 py-2"
				>
					<button
						type="button"
						class="pptx-vue-presenter-nav-btn inline-flex items-center gap-1.5 rounded bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
						:disabled="atFirst"
						title="Previous slide"
						@click="emit('move', -1)"
					>
						‹ Prev
					</button>
					<span class="pptx-vue-presenter-counter font-mono text-sm tabular-nums text-foreground">
						{{ currentSlideIndex + 1 }} / {{ slides.length }}
					</span>
					<button
						type="button"
						class="pptx-vue-presenter-nav-btn inline-flex items-center gap-1.5 rounded bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
						:disabled="atLast"
						title="Next slide"
						@click="emit('move', 1)"
					>
						Next ›
					</button>
				</div>

				<!-- Next slide preview -->
				<div class="pptx-vue-presenter-section border-b border-border/60 px-4 py-3">
					<div
						class="pptx-vue-presenter-label mb-2 text-[10px] uppercase tracking-wider text-muted-foreground"
					>
						Next slide
					</div>
					<div
						v-if="nextSlide"
						class="pptx-vue-presenter-preview-frame relative mt-2 overflow-hidden rounded border border-border/30"
						:style="previewFrameStyle"
					>
						<SlideStage
							:slide="nextSlide"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="previewScale"
						/>
					</div>
					<div
						v-else
						class="pptx-vue-presenter-preview-empty mt-2 flex h-16 items-center justify-center rounded border border-border/30 bg-muted/40 text-xs italic text-muted-foreground"
					>
						End of presentation
					</div>
				</div>

				<!-- Speaker notes -->
				<div class="pptx-vue-presenter-notes-section flex flex-1 min-h-0 flex-col px-4 py-3">
					<div class="pptx-vue-presenter-notes-head mb-2 flex items-center justify-between">
						<div
							class="pptx-vue-presenter-label text-[10px] uppercase tracking-wider text-muted-foreground"
						>
							Speaker notes
						</div>
						<div class="pptx-vue-presenter-font-ctl flex items-center gap-1">
							<button
								type="button"
								class="pptx-vue-presenter-font-btn rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
								:disabled="notesFontSize <= NOTES_FONT_SIZE_MIN"
								title="Decrease font size"
								aria-label="Decrease font size"
								@click="decreaseNotesFontSize"
							>
								−
							</button>
							<span
								class="pptx-vue-presenter-font-val min-w-[28px] select-none text-center font-mono text-[10px] tabular-nums text-muted-foreground"
								>{{ notesFontSize }}px</span
							>
							<button
								type="button"
								class="pptx-vue-presenter-font-btn rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
								:disabled="notesFontSize >= NOTES_FONT_SIZE_MAX"
								title="Increase font size"
								aria-label="Increase font size"
								@click="increaseNotesFontSize"
							>
								+
							</button>
						</div>
					</div>
					<div
						class="pptx-vue-presenter-notes flex-1 overflow-y-auto whitespace-pre-wrap rounded border border-border/30 bg-muted/40 px-3 py-2 leading-relaxed text-foreground"
						:style="{ fontSize: `${notesFontSize}px` }"
					>
						<template v-if="notesSpans">
							<template v-for="span in notesSpans" :key="span.key">
								<br v-if="span.kind === 'break'" />
								<span v-else :style="span.style">{{ span.text }}</span>
							</template>
						</template>
						<template v-else-if="hasPlainNotes">{{ notesText }}</template>
						<span v-else class="pptx-vue-presenter-notes-empty italic text-muted-foreground"
							>No notes for this slide.</span
						>
					</div>
				</div>
			</div>
		</div>

		<!-- Timer progress bar -->
		<div
			class="pptx-vue-presenter-progress h-1.5 w-full flex-shrink-0 bg-muted/60"
			role="progressbar"
			:aria-valuenow="Math.round(timerProgress)"
			:aria-valuemin="0"
			:aria-valuemax="100"
			aria-label="Timer progress"
			:title="`${elapsedText} (segment ${timerSegment + 1})`"
		>
			<div
				class="pptx-vue-presenter-progress-fill h-full bg-primary transition-[width] duration-1000 ease-linear"
				:style="{ width: `${timerProgress}%` }"
			/>
		</div>
	</div>
</template>
