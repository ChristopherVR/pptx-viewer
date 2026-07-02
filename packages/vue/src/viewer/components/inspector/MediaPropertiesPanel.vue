<script setup lang="ts">
/**
 * MediaPropertiesPanel: inspector panel for `media` (audio/video) elements,
 * ported from React's `MediaPropertiesPanel`. Composes an optional live preview
 * (only when the element carries an embedded `mediaData` data-URL), the trim
 * timeline scrubber, mm:ss trim inputs, playback options, and bookmarks.
 *
 * Uniform inspector contract:
 *  - Props: `{ element, canEdit }`.
 *  - Emits `update` with a SHALLOW `Partial<PptxElement>` patch of the exact
 *    core field(s) touched; the host merges it via `ops.updateElement`.
 *
 * Media data URLs resolved from `mediaPath` live on `PowerPointViewer` (owned by
 * another agent); to avoid editing it, the preview degrades gracefully: it only
 * renders when the element already embeds `mediaData`, and the timeline falls
 * back to `metadata.duration` when no live media element is mounted.
 */
import type { MediaPptxElement, PptxElement } from 'pptx-viewer-core';
import { computed, ref } from 'vue';

import {
	clamp,
	formatTime,
	mmSsToMs,
	msToMmSs,
	trimmedDurationLabel,
	validateTrimRange,
} from '../../composables/useMediaEditing';
import MediaBookmarks from './MediaBookmarks.vue';
import MediaPlaybackOptions from './MediaPlaybackOptions.vue';
import MediaTrimTimeline from './MediaTrimTimeline.vue';

const props = defineProps<{
	element: PptxElement;
	canEdit?: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const media = computed<MediaPptxElement | null>(() =>
	props.element.type === 'media' ? props.element : null,
);
const canEdit = computed(() => props.canEdit ?? true);

const mediaRef = ref<HTMLMediaElement | null>(null);
const currentTime = ref(0);
const liveDuration = ref(0);
const isPlaying = ref(false);

/** Playable source: only the element's own embedded data-URL (no path map). */
const previewSrc = computed(() => media.value?.mediaData);
const isVideo = computed(() => media.value?.mediaType === 'video');
const bookmarks = computed(() => media.value?.bookmarks ?? []);

/** Duration in seconds: live media element if mounted, else stored metadata. */
const duration = computed(() =>
	liveDuration.value > 0 ? liveDuration.value : (media.value?.metadata?.duration ?? 0),
);
const durationMs = computed(() => duration.value * 1000);

const trimStartMs = computed(() => media.value?.trimStartMs ?? 0);
const trimEndMs = computed(() => media.value?.trimEndMs ?? 0);
const hasTrim = computed(() => trimStartMs.value > 0 || trimEndMs.value > 0);
const trimmedLabel = computed(() =>
	trimmedDurationLabel(trimStartMs.value, trimEndMs.value, durationMs.value),
);
const trimError = computed(() =>
	validateTrimRange(trimStartMs.value, trimEndMs.value, durationMs.value),
);

function onTimeUpdate(): void {
	if (mediaRef.value) {
		currentTime.value = mediaRef.value.currentTime;
	}
}

function onDurationChange(): void {
	const el = mediaRef.value;
	if (el && Number.isFinite(el.duration)) {
		liveDuration.value = el.duration;
	}
}

function togglePlay(): void {
	const el = mediaRef.value;
	if (!el) {
		return;
	}
	if (el.paused) {
		void el.play();
	} else {
		el.pause();
	}
}

function seekTo(time: number): void {
	currentTime.value = time;
	if (mediaRef.value) {
		mediaRef.value.currentTime = time;
	}
}

function emitTrim(trimStart: number, trimEnd: number): void {
	emit('update', { trimStartMs: trimStart, trimEndMs: trimEnd } as Partial<PptxElement>);
}

function onTimelineTrim(payload: { trimStartMs: number; trimEndMs: number }): void {
	emitTrim(payload.trimStartMs, payload.trimEndMs);
}

function commitTrimStart(event: Event): void {
	const parsed = mmSsToMs((event.target as HTMLInputElement).value);
	if (parsed === undefined) {
		return;
	}
	const max = durationMs.value > 0 ? durationMs.value : parsed;
	emit('update', { trimStartMs: clamp(parsed, 0, max) } as Partial<PptxElement>);
}

function commitTrimEnd(event: Event): void {
	const parsed = mmSsToMs((event.target as HTMLInputElement).value);
	if (parsed === undefined) {
		return;
	}
	const max = durationMs.value > 0 ? durationMs.value : parsed;
	emit('update', { trimEndMs: clamp(parsed, 0, max) } as Partial<PptxElement>);
}

function resetTrim(): void {
	emit('update', { trimStartMs: 0, trimEndMs: 0 } as Partial<PptxElement>);
}

function relay(patch: Partial<PptxElement>): void {
	emit('update', patch);
}

const CARD = 'pptx-vue-media-card rounded border border-border bg-card p-2 space-y-2';
const HEADING = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const ROW = 'flex items-center justify-between gap-2';
const LABEL = 'text-[11px] text-muted-foreground';
const INPUT =
	'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full text-[11px] tabular-nums';
const BTN = 'rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors';
</script>

<template>
	<div v-if="media" class="pptx-vue-media-panel space-y-3">
		<div :class="CARD">
			<div :class="HEADING">Media</div>
			<div class="text-[11px] text-muted-foreground">
				{{ isVideo ? 'Video clip' : 'Audio clip' }}
			</div>

			<div v-if="previewSrc" class="space-y-1">
				<video
					v-if="isVideo"
					ref="mediaRef"
					class="w-full rounded bg-black max-h-32 object-contain"
					:src="previewSrc"
					preload="metadata"
					@timeupdate="onTimeUpdate"
					@durationchange="onDurationChange"
					@loadedmetadata="onDurationChange"
					@play="isPlaying = true"
					@pause="isPlaying = false"
					@ended="isPlaying = false"
				/>
				<audio
					v-else
					ref="mediaRef"
					class="w-full"
					:src="previewSrc"
					preload="metadata"
					@timeupdate="onTimeUpdate"
					@durationchange="onDurationChange"
					@loadedmetadata="onDurationChange"
					@play="isPlaying = true"
					@pause="isPlaying = false"
					@ended="isPlaying = false"
				/>
				<div class="flex items-center gap-1">
					<button
						type="button"
						:class="BTN"
						:title="isPlaying ? 'Pause' : 'Play'"
						@click="togglePlay"
					>
						{{ isPlaying ? 'Pause' : 'Play' }}
					</button>
					<span class="text-[10px] text-muted-foreground tabular-nums">
						{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
					</span>
				</div>
			</div>

			<MediaTrimTimeline
				v-if="duration > 0"
				:duration="duration"
				:trim-start-ms="trimStartMs"
				:trim-end-ms="trimEndMs"
				:current-time="currentTime"
				:bookmarks="bookmarks"
				:can-edit="canEdit"
				@trim-change="onTimelineTrim"
				@seek="seekTo"
			/>
		</div>

		<div :class="CARD">
			<div :class="HEADING">Trim</div>
			<div class="grid grid-cols-2 gap-1.5">
				<label class="flex flex-col gap-0.5">
					<span :class="LABEL">Start (mm:ss)</span>
					<input
						type="text"
						:class="INPUT"
						placeholder="00:00"
						:disabled="!canEdit"
						:value="msToMmSs(trimStartMs)"
						@change="commitTrimStart"
					/>
				</label>
				<label class="flex flex-col gap-0.5">
					<span :class="LABEL">End (mm:ss)</span>
					<input
						type="text"
						:class="INPUT"
						placeholder="00:00"
						:disabled="!canEdit"
						:value="msToMmSs(trimEndMs)"
						@change="commitTrimEnd"
					/>
				</label>
			</div>
			<div :class="ROW">
				<span :class="LABEL">Trimmed duration</span>
				<span class="text-[11px] tabular-nums font-medium">{{ trimmedLabel }}</span>
			</div>
			<div v-if="trimError" class="text-[10px] text-red-400">{{ trimError }}</div>
			<button
				v-if="canEdit && hasTrim"
				type="button"
				:class="[BTN, 'w-full text-center']"
				@click="resetTrim"
			>
				Reset trim
			</button>
		</div>

		<MediaPlaybackOptions :element="media" :can-edit="canEdit" @update="relay" />

		<MediaBookmarks
			:bookmarks="bookmarks"
			:can-edit="canEdit"
			:current-time="currentTime"
			@update="relay"
			@seek="seekTo"
		/>
	</div>
</template>
