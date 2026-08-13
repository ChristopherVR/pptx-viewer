<script setup lang="ts">
/**
 * PresenterView - PowerPoint's presenter console: the control strip across the
 * top, the current slide (left, 70%), a rail (right, 30%) with clock, timer,
 * navigation, next-slide preview and speaker notes, the "all slides" navigator
 * and the 5-minute timer progress bar.
 *
 * The strip used to render ONLY in the empty-deck branch below, so with a real
 * deck the Vue console had no timer, no zoom, no annotation tools, no blackout,
 * no captions and no End button at all. It is now the first child of both
 * branches, as in React.
 *
 * Rendered as an absolute overlay by the host (`PresentationMode`). Keyboard
 * navigation is owned by the host; this component only emits intents.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	createInitialPresentationSnapshot,
	PRESENTER_CONSOLE_CLASSES,
	PRESENTER_RAIL_LABEL_KEYS,
	presenterPaneAdvancesOnClick,
	stepPresenterZoom,
} from 'pptx-viewer-shared';
import type { PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePresenterClock } from '../composables/usePresenterClock';
import type { CanvasSize } from '../types';
import PresenterControlStrip from './PresenterControlStrip.vue';
import PresenterNotesRail from './PresenterNotesRail.vue';
import PresenterSlideGrid from './PresenterSlideGrid.vue';
import PresenterStagePane from './PresenterStagePane.vue';

const props = withDefaults(
	defineProps<{
		slides: PptxSlide[];
		currentSlideIndex: number;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		/** Timestamp (ms) the presentation started, or `null`. */
		presentationStartTime: number | null;
		audienceOpen?: boolean;
		snapshot?: PresentationSnapshot;
		/** Membership of the running custom show, for the next-slide preview. */
		activeCustomShow?: { slideRIds: string[] } | null;
	}>(),
	{
		snapshot: () => createInitialPresentationSnapshot(),
	},
);

const emit = defineEmits<{
	(e: 'move', direction: 1 | -1): void;
	(e: 'exit' | 'open-audience' | 'close-audience' | 'swap-displays'): void;
	(e: 'navigate', index: number): void;
	(e: 'update-snapshot', patch: Partial<PresentationSnapshot>): void;
}>();

const { t } = useI18n();
const classes = PRESENTER_CONSOLE_CLASSES;
const railKeys = PRESENTER_RAIL_LABEL_KEYS;
const showSlides = ref(false);

const { clockText, elapsedText, progress } = usePresenterClock(() => props.presentationStartTime);

/**
 * Clicking the current-slide pane advances the show, the way PowerPoint's
 * presenter console does. A drawing tool owns the pointer instead, so clicking
 * then annotates rather than jumping the deck.
 */
const paneAdvancesOnClick = computed(() =>
	presenterPaneAdvancesOnClick(props.snapshot.pointer?.tool),
);

function update(patch: Partial<PresentationSnapshot>): void {
	emit('update-snapshot', patch);
}
function setTool(tool: PresentationPointerTool): void {
	update({
		pointer: { ...(props.snapshot.pointer ?? { x: 0.5, y: 0.5, color: '#ef4444' }), tool },
	});
}
function zoom(direction: -1 | 1): void {
	update({
		zoom: stepPresenterZoom(
			props.snapshot.zoom ?? { scale: 1, originX: 0.5, originY: 0.5 },
			direction,
		),
	});
}
function toggleAudience(): void {
	emit(props.audienceOpen === true ? 'close-audience' : 'open-audience');
}

const currentSlide = computed<PptxSlide | undefined>(() => props.slides[props.currentSlideIndex]);
const timerTitle = computed(() =>
	t('pptx.presenter.timerTitle', {
		elapsed: elapsedText.value,
		segment: progress.value.segment + 1,
	}),
);
</script>

<template>
	<div
		class="pptx-vue-presenter"
		:class="[classes.root, { 'pptx-vue-presenter--empty': !currentSlide }]"
	>
		<PresenterControlStrip
			:snapshot="snapshot"
			:audience-open="Boolean(audienceOpen)"
			@timer="update({ paused: !snapshot.paused })"
			@reset-timer="update({ paused: false, elapsedMs: 0 })"
			@slides="showSlides = true"
			@zoom="zoom"
			@reset-zoom="update({ zoom: { scale: 1, originX: 0.5, originY: 0.5 } })"
			@blackout="(value) => update({ blackout: value })"
			@tool="setTool"
			@subtitles="update({ subtitlesVisible: !snapshot.subtitlesVisible })"
			@audience="toggleAudience"
			@swap-displays="emit('swap-displays')"
			@exit="emit('exit')"
		/>

		<div
			v-if="!currentSlide"
			class="pptx-vue-presenter-empty-body flex flex-1 items-center justify-center bg-card text-muted-foreground"
		>
			{{ t(railKeys.noSlides) }}
		</div>

		<template v-else>
			<div class="pptx-vue-presenter-body" :class="classes.body">
				<PresenterStagePane
					:slide="currentSlide"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:slide-number="currentSlideIndex + 1"
					:slide-count="slides.length"
					:zoom="snapshot.zoom"
					:advances-on-click="paneAdvancesOnClick"
					@advance="emit('move', 1)"
				/>
				<PresenterNotesRail
					:slides="slides"
					:current-slide-index="currentSlideIndex"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:clock-text="clockText"
					:elapsed-text="elapsedText"
					:audience-open="Boolean(audienceOpen)"
					:active-custom-show="activeCustomShow"
					@move="(direction) => emit('move', direction)"
					@audience="toggleAudience"
					@exit="emit('exit')"
				/>
			</div>

			<PresenterSlideGrid
				v-if="showSlides"
				:slides="slides"
				:current="currentSlideIndex"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				@select="
					(index) => {
						emit('navigate', index);
						showSlides = false;
					}
				"
				@close="showSlides = false"
			/>

			<!-- Timer progress bar -->
			<div
				class="pptx-vue-presenter-progress"
				:class="classes.progressTrack"
				role="progressbar"
				:aria-valuenow="Math.round(progress.percent)"
				:aria-valuemin="0"
				:aria-valuemax="100"
				:aria-label="t(railKeys.timerProgress)"
				:title="timerTitle"
			>
				<div
					class="pptx-vue-presenter-progress-fill"
					:class="classes.progressFill"
					:style="{ width: `${progress.percent}%` }"
				/>
			</div>
		</template>
	</div>
</template>
