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
	<div v-if="!currentSlide" class="pptx-vue-presenter pptx-vue-presenter--empty">
		No slides to present.
	</div>
	<div v-else class="pptx-vue-presenter">
		<div class="pptx-vue-presenter-body">
			<!-- Left: current slide -->
			<div class="pptx-vue-presenter-main">
				<div class="pptx-vue-presenter-stage" :style="previewMainFrameStyle">
					<SlideStage
						:slide="currentSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:scale="mainScale"
					/>
				</div>
				<div class="pptx-vue-presenter-slide-label">
					Slide {{ currentSlideIndex + 1 }} of {{ slides.length }}
				</div>
			</div>

			<!-- Right: controls -->
			<div class="pptx-vue-presenter-rail">
				<!-- Header: clock + elapsed + exit -->
				<div class="pptx-vue-presenter-header">
					<div class="pptx-vue-presenter-time">
						<span class="pptx-vue-presenter-label">Current time</span>
						<span class="pptx-vue-presenter-clock">{{ clockText }}</span>
					</div>
					<div class="pptx-vue-presenter-time pptx-vue-presenter-time--right">
						<span class="pptx-vue-presenter-label">Elapsed</span>
						<span class="pptx-vue-presenter-elapsed">{{ elapsedText }}</span>
					</div>
					<button
						type="button"
						class="pptx-vue-presenter-icon-btn"
						title="End presentation"
						aria-label="End presentation"
						@click="emit('exit')"
					>
						&times;
					</button>
				</div>

				<!-- Navigation -->
				<div class="pptx-vue-presenter-nav">
					<button
						type="button"
						class="pptx-vue-presenter-nav-btn"
						:disabled="atFirst"
						title="Previous slide"
						@click="emit('move', -1)"
					>
						‹ Prev
					</button>
					<span class="pptx-vue-presenter-counter">
						{{ currentSlideIndex + 1 }} / {{ slides.length }}
					</span>
					<button
						type="button"
						class="pptx-vue-presenter-nav-btn"
						:disabled="atLast"
						title="Next slide"
						@click="emit('move', 1)"
					>
						Next ›
					</button>
				</div>

				<!-- Next slide preview -->
				<div class="pptx-vue-presenter-section">
					<div class="pptx-vue-presenter-label">Next slide</div>
					<div v-if="nextSlide" class="pptx-vue-presenter-preview-frame" :style="previewFrameStyle">
						<SlideStage
							:slide="nextSlide"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="previewScale"
						/>
					</div>
					<div v-else class="pptx-vue-presenter-preview-empty">End of presentation</div>
				</div>

				<!-- Speaker notes -->
				<div class="pptx-vue-presenter-notes-section">
					<div class="pptx-vue-presenter-notes-head">
						<div class="pptx-vue-presenter-label">Speaker notes</div>
						<div class="pptx-vue-presenter-font-ctl">
							<button
								type="button"
								class="pptx-vue-presenter-font-btn"
								:disabled="notesFontSize <= NOTES_FONT_SIZE_MIN"
								title="Decrease font size"
								aria-label="Decrease font size"
								@click="decreaseNotesFontSize"
							>
								−
							</button>
							<span class="pptx-vue-presenter-font-val">{{ notesFontSize }}px</span>
							<button
								type="button"
								class="pptx-vue-presenter-font-btn"
								:disabled="notesFontSize >= NOTES_FONT_SIZE_MAX"
								title="Increase font size"
								aria-label="Increase font size"
								@click="increaseNotesFontSize"
							>
								+
							</button>
						</div>
					</div>
					<div class="pptx-vue-presenter-notes" :style="{ fontSize: `${notesFontSize}px` }">
						<template v-if="notesSpans">
							<template v-for="span in notesSpans" :key="span.key">
								<br v-if="span.kind === 'break'" />
								<span v-else :style="span.style">{{ span.text }}</span>
							</template>
						</template>
						<template v-else-if="hasPlainNotes">{{ notesText }}</template>
						<span v-else class="pptx-vue-presenter-notes-empty">No notes for this slide.</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Timer progress bar -->
		<div
			class="pptx-vue-presenter-progress"
			role="progressbar"
			:aria-valuenow="Math.round(timerProgress)"
			:aria-valuemin="0"
			:aria-valuemax="100"
			aria-label="Timer progress"
			:title="`${elapsedText} (segment ${timerSegment + 1})`"
		>
			<div class="pptx-vue-presenter-progress-fill" :style="{ width: `${timerProgress}%` }" />
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-presenter {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	background: var(--pptx-card, #111827);
	color: var(--pptx-foreground, #f3f4f6);
	font-family:
		system-ui,
		-apple-system,
		sans-serif;
}

.pptx-vue-presenter--empty {
	align-items: center;
	justify-content: center;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-vue-presenter-body {
	display: flex;
	flex: 1 1 auto;
	min-height: 0;
}

.pptx-vue-presenter-main {
	flex: 7 1 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: #000000;
	padding: 24px;
	min-width: 0;
	overflow: hidden;
}

.pptx-vue-presenter-stage {
	position: relative;
	overflow: hidden;
}

.pptx-vue-presenter-slide-label {
	margin-top: 12px;
	font-size: 12px;
	font-family: ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
	color: rgba(255, 255, 255, 0.5);
	user-select: none;
}

.pptx-vue-presenter-rail {
	flex: 3 1 0;
	display: flex;
	flex-direction: column;
	min-width: 260px;
	max-width: 440px;
	background: var(--pptx-background, #030712);
	border-left: 1px solid var(--pptx-border, #374151);
}

.pptx-vue-presenter-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-border, #374151);
}

.pptx-vue-presenter-time {
	display: flex;
	flex-direction: column;
}

.pptx-vue-presenter-time--right {
	align-items: flex-end;
}

.pptx-vue-presenter-label {
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-vue-presenter-clock,
.pptx-vue-presenter-elapsed {
	font-size: 18px;
	font-family: ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
}

.pptx-vue-presenter-elapsed {
	color: var(--pptx-primary, #6366f1);
}

.pptx-vue-presenter-icon-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: var(--pptx-muted-foreground, #9ca3af);
	font-size: 20px;
	line-height: 1;
	cursor: pointer;
}

.pptx-vue-presenter-icon-btn:hover {
	background: var(--pptx-accent, #1f2937);
	color: var(--pptx-foreground, #f3f4f6);
}

.pptx-vue-presenter-nav {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 16px;
	border-bottom: 1px solid var(--pptx-border, #374151);
}

.pptx-vue-presenter-nav-btn {
	padding: 6px 12px;
	border: none;
	border-radius: 6px;
	background: var(--pptx-muted, #1f2937);
	color: inherit;
	font-size: 12px;
	cursor: pointer;
}

.pptx-vue-presenter-nav-btn:hover:not(:disabled) {
	background: var(--pptx-accent, #374151);
}

.pptx-vue-presenter-nav-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.pptx-vue-presenter-counter {
	font-size: 14px;
	font-family: ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
}

.pptx-vue-presenter-section {
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-border, #374151);
}

.pptx-vue-presenter-preview-frame {
	position: relative;
	overflow: hidden;
	margin-top: 8px;
	border-radius: 4px;
	border: 1px solid var(--pptx-border, #374151);
}

.pptx-vue-presenter-preview-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 64px;
	margin-top: 8px;
	border-radius: 4px;
	border: 1px solid var(--pptx-border, #374151);
	background: var(--pptx-muted, #1f2937);
	font-size: 12px;
	font-style: italic;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-vue-presenter-notes-section {
	display: flex;
	flex-direction: column;
	flex: 1 1 auto;
	min-height: 0;
	padding: 12px 16px;
}

.pptx-vue-presenter-notes-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
}

.pptx-vue-presenter-font-ctl {
	display: flex;
	align-items: center;
	gap: 4px;
}

.pptx-vue-presenter-font-btn {
	width: 20px;
	height: 20px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-muted-foreground, #9ca3af);
	font-size: 14px;
	line-height: 1;
	cursor: pointer;
}

.pptx-vue-presenter-font-btn:hover:not(:disabled) {
	background: var(--pptx-accent, #374151);
	color: var(--pptx-foreground, #f3f4f6);
}

.pptx-vue-presenter-font-btn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.pptx-vue-presenter-font-val {
	min-width: 28px;
	text-align: center;
	font-size: 10px;
	font-family: ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-vue-presenter-notes {
	flex: 1 1 auto;
	overflow-y: auto;
	padding: 8px 12px;
	border-radius: 4px;
	border: 1px solid var(--pptx-border, #374151);
	background: var(--pptx-muted, #1f2937);
	white-space: pre-wrap;
	line-height: 1.6;
}

.pptx-vue-presenter-notes-empty {
	font-style: italic;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-vue-presenter-progress {
	flex-shrink: 0;
	height: 6px;
	width: 100%;
	background: var(--pptx-muted, #1f2937);
}

.pptx-vue-presenter-progress-fill {
	height: 100%;
	background: var(--pptx-primary, #6366f1);
	transition: width 1s linear;
}
</style>
