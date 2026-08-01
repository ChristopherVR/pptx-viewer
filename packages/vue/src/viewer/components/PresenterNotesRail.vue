<script setup lang="ts">
/**
 * PresenterNotesRail - the right-hand 30% of the presenter console: wall clock,
 * elapsed timer, audience/exit buttons, prev/next navigation, the next-slide
 * preview and the scalable speaker notes.
 *
 * Split out of `PresenterView.vue`, which had grown past the repo's 300-line
 * ceiling. Every string here now resolves through the canonical
 * `pptx.presenter.*` keys (via the shared rail inventory); the rail previously
 * reached into `pptx.presenterView.*`, `pptx.mpresenter.*`, `pptx.mobileBar.*`
 * and `pptx.statusBar.*` for text that already had a canonical equivalent,
 * which is how four near-duplicate namespaces came to describe one console.
 */
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-vue-next';
import type { PptxSlide } from 'pptx-viewer-core';
import {
	nextPresentedSlide,
	PRESENTER_CONSOLE_CLASSES,
	PRESENTER_RAIL_LABEL_KEYS,
	presenterNextDisabled,
	presenterPrevDisabled,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { PRESENTER_RAIL_CONTROL_LABEL_KEYS } from '../composables/presenter-console';
import {
	clampNotesFontSize,
	notesSegmentsToSpans,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
} from '../composables/presenter-view-utils';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

const props = defineProps<{
	slides: PptxSlide[];
	currentSlideIndex: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	clockText: string;
	elapsedText: string;
	audienceOpen: boolean;
}>();

const emit = defineEmits<{
	(e: 'move', direction: 1 | -1): void;
	(e: 'exit' | 'audience'): void;
}>();

const { t } = useI18n();
const railKeys = PRESENTER_RAIL_LABEL_KEYS;
const controlKeys = PRESENTER_RAIL_CONTROL_LABEL_KEYS;
const classes = PRESENTER_CONSOLE_CLASSES;

const currentSlide = computed<PptxSlide | undefined>(() => props.slides[props.currentSlideIndex]);
/**
 * The next slide the SHOW will present, not simply `index + 1`: hidden slides
 * are skipped and custom-show membership is honoured, so the preview matches
 * what the audience is about to see.
 */
const nextSlide = computed<PptxSlide | undefined>(() =>
	nextPresentedSlide(props.slides, props.currentSlideIndex),
);

const notesText = computed(() => currentSlide.value?.notes ?? '');
const notesSpans = computed(() => {
	const segments = currentSlide.value?.notesSegments;
	return segments && segments.length > 0 ? notesSegmentsToSpans(segments) : null;
});
const hasPlainNotes = computed(() => notesText.value.trim().length > 0);

const notesFontSize = ref(NOTES_FONT_SIZE_DEFAULT);
function stepNotesFontSize(direction: 1 | -1): void {
	notesFontSize.value = clampNotesFontSize(notesFontSize.value + direction * NOTES_FONT_SIZE_STEP);
}

// Fit the next-slide preview into the rail panel.
const PREVIEW_WIDTH = 240;
const previewScale = computed(() =>
	props.canvasSize.width > 0 ? PREVIEW_WIDTH / props.canvasSize.width : 1,
);
const previewFrameStyle = computed(() => ({
	width: `${props.canvasSize.width * previewScale.value}px`,
	height: `${props.canvasSize.height * previewScale.value}px`,
}));
</script>

<template>
	<div class="pptx-vue-presenter-rail" :class="classes.rail">
		<!-- Header: clock + elapsed + audience/exit -->
		<div
			class="pptx-vue-presenter-header flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3"
		>
			<div class="pptx-vue-presenter-time flex flex-col">
				<span class="pptx-vue-presenter-label" :class="classes.railHeading">{{
					t(railKeys.currentTime)
				}}</span>
				<span class="pptx-vue-presenter-clock font-mono text-lg tabular-nums text-foreground">{{
					clockText
				}}</span>
			</div>
			<div class="pptx-vue-presenter-time pptx-vue-presenter-time--right flex flex-col items-end">
				<span class="pptx-vue-presenter-label" :class="classes.railHeading">{{
					t(railKeys.elapsed)
				}}</span>
				<span class="pptx-vue-presenter-elapsed font-mono text-lg tabular-nums text-primary">{{
					elapsedText
				}}</span>
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="pptx-vue-presenter-audience-btn flex h-7 items-center justify-center rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					:title="
						audienceOpen
							? t('pptx.presenter.closeAudienceWindow')
							: t('pptx.presenter.openAudienceWindow')
					"
					@click="emit('audience')"
				>
					{{
						audienceOpen
							? t('pptx.presenter.closeAudienceWindow')
							: t('pptx.presenter.openAudienceWindow')
					}}
				</button>
				<button
					type="button"
					class="pptx-vue-presenter-icon-btn flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					:title="t('pptx.presenter.endPresentation')"
					:aria-label="t('pptx.presenter.endPresentation')"
					@click="emit('exit')"
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
		</div>

		<!-- Navigation. Next stays live on the last slide: PowerPoint's console
		     advances from there to the end-of-show screen and then out of the
		     show, so disabling it stranded the presenter with no way to finish
		     and left the audience display open. -->
		<div
			class="pptx-vue-presenter-nav flex items-center justify-between border-b border-border/60 px-4 py-2"
		>
			<button
				type="button"
				class="pptx-vue-presenter-nav-btn inline-flex items-center gap-1.5 rounded bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
				data-pptx-presenter-control="prev"
				:disabled="presenterPrevDisabled(currentSlideIndex)"
				:title="t(controlKeys.prev)"
				:aria-label="t(controlKeys.prev)"
				@click="emit('move', -1)"
			>
				<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				{{ t(controlKeys.prev) }}
			</button>
			<span class="pptx-vue-presenter-counter font-mono text-sm tabular-nums text-foreground">
				{{ currentSlideIndex + 1 }} / {{ slides.length }}
			</span>
			<button
				type="button"
				class="pptx-vue-presenter-nav-btn inline-flex items-center gap-1.5 rounded bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
				data-pptx-presenter-control="next"
				:disabled="presenterNextDisabled()"
				:title="t(controlKeys.next)"
				:aria-label="t(controlKeys.next)"
				@click="emit('move', 1)"
			>
				{{ t(controlKeys.next) }}
				<ChevronRight class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>

		<!-- Next slide preview -->
		<div
			class="pptx-vue-presenter-section border-b border-border/60 px-4 py-3"
			data-pptx-presenter-next-preview
		>
			<div class="pptx-vue-presenter-label mb-2" :class="classes.railHeading">
				{{ t(railKeys.nextSlidePreview) }}
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
				{{ t(railKeys.endOfPresentation) }}
			</div>
		</div>

		<!-- Speaker notes -->
		<div
			class="pptx-vue-presenter-notes-section flex flex-1 min-h-0 flex-col px-4 py-3"
			data-pptx-presenter-notes
		>
			<div class="pptx-vue-presenter-notes-head mb-2 flex items-center justify-between">
				<div class="pptx-vue-presenter-label" :class="classes.railHeading">
					{{ t(railKeys.speakerNotes) }}
				</div>
				<div class="pptx-vue-presenter-font-ctl flex items-center gap-1">
					<button
						type="button"
						class="pptx-vue-presenter-font-btn rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
						data-pptx-presenter-control="notes-font-decrease"
						:disabled="notesFontSize <= NOTES_FONT_SIZE_MIN"
						:title="t(controlKeys['notes-font-decrease'])"
						:aria-label="t(controlKeys['notes-font-decrease'])"
						@click="stepNotesFontSize(-1)"
					>
						<Minus class="h-3.5 w-3.5" aria-hidden="true" />
					</button>
					<span
						class="pptx-vue-presenter-font-val min-w-[28px] select-none text-center font-mono text-[10px] tabular-nums text-muted-foreground"
						>{{ notesFontSize }}px</span
					>
					<button
						type="button"
						class="pptx-vue-presenter-font-btn rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
						data-pptx-presenter-control="notes-font-increase"
						:disabled="notesFontSize >= NOTES_FONT_SIZE_MAX"
						:title="t(controlKeys['notes-font-increase'])"
						:aria-label="t(controlKeys['notes-font-increase'])"
						@click="stepNotesFontSize(1)"
					>
						<Plus class="h-3.5 w-3.5" aria-hidden="true" />
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
				<span v-else class="pptx-vue-presenter-notes-empty italic text-muted-foreground">{{
					t(railKeys.noNotes)
				}}</span>
			</div>
		</div>
	</div>
</template>
