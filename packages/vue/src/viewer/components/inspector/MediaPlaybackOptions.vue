<script setup lang="ts">
/**
 * MediaPlaybackOptions: the "Playback" card of the media inspector, ported from
 * React's `MediaPlaybackBookmarks` (playback half). Exposes volume, speed,
 * fade in/out, loop, start trigger (auto-play), play-across-slides (audio),
 * full-screen, and hide-when-not-playing.
 *
 * Emits `update` with a SHALLOW `Partial<PptxElement>` patch of the exact core
 * field(s) touched, matching the sibling inspector-panel contract.
 */
import type { MediaPptxElement, PptxElement } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	element: MediaPptxElement;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const volumePercent = computed(() => Math.round((props.element.volume ?? 1) * 100));
const playbackSpeed = computed(() => props.element.playbackSpeed ?? 1);
const fadeIn = computed(() => props.element.fadeInDuration ?? 0);
const fadeOut = computed(() => props.element.fadeOutDuration ?? 0);
const isAudio = computed(() => props.element.mediaType === 'audio');

function patch(next: Partial<PptxElement>): void {
	emit('update', next);
}

function onVolume(event: Event): void {
	patch({ volume: Number((event.target as HTMLInputElement).value) / 100 } as Partial<PptxElement>);
}

function onSpeed(event: Event): void {
	patch({
		playbackSpeed: Number((event.target as HTMLSelectElement).value),
	} as Partial<PptxElement>);
}

function onFadeIn(event: Event): void {
	patch({
		fadeInDuration: Number((event.target as HTMLInputElement).value) || undefined,
	} as Partial<PptxElement>);
}

function onFadeOut(event: Event): void {
	patch({
		fadeOutDuration: Number((event.target as HTMLInputElement).value) || undefined,
	} as Partial<PptxElement>);
}

function onLoop(event: Event): void {
	patch({ loop: (event.target as HTMLInputElement).checked || undefined } as Partial<PptxElement>);
}

function onStartTrigger(event: Event): void {
	patch({
		autoPlay: (event.target as HTMLSelectElement).value === 'auto' || undefined,
	} as Partial<PptxElement>);
}

function onPlayAcross(event: Event): void {
	const checked = (event.target as HTMLInputElement).checked;
	patch({
		playAcrossSlides: checked || undefined,
		...(checked ? { autoPlay: true } : {}),
	} as Partial<PptxElement>);
}

function onFullScreen(event: Event): void {
	patch({
		fullScreen: (event.target as HTMLInputElement).checked || undefined,
	} as Partial<PptxElement>);
}

function onHideWhenNotPlaying(event: Event): void {
	patch({
		hideWhenNotPlaying: (event.target as HTMLInputElement).checked || undefined,
	} as Partial<PptxElement>);
}

const CARD = 'pptx-vue-media-card rounded border border-border bg-card p-2 space-y-2';
const HEADING = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const ROW = 'flex items-center justify-between gap-2';
const LABEL = 'text-[11px] text-muted-foreground';
const INPUT = 'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full text-[11px]';
</script>

<template>
	<div :class="CARD">
		<div :class="HEADING">{{ t('pptx.media.playback') }}</div>

		<label :class="ROW">
			<span :class="LABEL">{{ t('pptx.media.volume') }}</span>
			<div class="flex items-center gap-1 flex-1 max-w-[140px]">
				<input
					type="range"
					class="flex-1 accent-primary"
					min="0"
					max="100"
					step="1"
					:disabled="!canEdit"
					:value="volumePercent"
					@input="onVolume"
				/>
				<span class="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
					{{ volumePercent }}%
				</span>
			</div>
		</label>

		<label :class="ROW">
			<span :class="LABEL">{{ t('pptx.media.speed') }}</span>
			<select
				:aria-label="t('pptx.media.speed')"
				:class="[INPUT, 'max-w-[100px]']"
				:disabled="!canEdit"
				:value="playbackSpeed"
				@change="onSpeed"
			>
				<option v-for="opt in SPEED_OPTIONS" :key="opt" :value="opt">{{ opt }}x</option>
			</select>
		</label>

		<div class="grid grid-cols-2 gap-1.5">
			<label class="flex flex-col gap-0.5">
				<span :class="LABEL">{{ t('pptx.media.fadeIn') }}</span>
				<input
					type="number"
					min="0"
					step="0.1"
					:class="INPUT"
					:disabled="!canEdit"
					:value="fadeIn"
					@input="onFadeIn"
				/>
			</label>
			<label class="flex flex-col gap-0.5">
				<span :class="LABEL">{{ t('pptx.media.fadeOut') }}</span>
				<input
					type="number"
					min="0"
					step="0.1"
					:class="INPUT"
					:disabled="!canEdit"
					:value="fadeOut"
					@input="onFadeOut"
				/>
			</label>
		</div>

		<label :class="ROW">
			<span :class="LABEL">{{ t('pptx.media.loop') }}</span>
			<input
				type="checkbox"
				:disabled="!canEdit"
				:checked="Boolean(element.loop)"
				@change="onLoop"
			/>
		</label>

		<label :class="ROW">
			<span :class="LABEL">{{ t('pptx.media.startTrigger') }}</span>
			<select
				:aria-label="t('pptx.media.startTrigger')"
				class="text-[11px] bg-transparent border border-border rounded px-1 py-0.5"
				:disabled="!canEdit"
				:value="element.autoPlay ? 'auto' : 'onClick'"
				@change="onStartTrigger"
			>
				<option value="onClick">{{ t('pptx.media.startOnClick') }}</option>
				<option value="auto">{{ t('pptx.media.startAutomatically') }}</option>
			</select>
		</label>

		<label v-if="isAudio" :class="ROW">
			<span :class="LABEL">{{ t('pptx.media.playAcrossSlides') }}</span>
			<input
				type="checkbox"
				:disabled="!canEdit"
				:checked="Boolean(element.playAcrossSlides)"
				@change="onPlayAcross"
			/>
		</label>

		<label :class="ROW">
			<span :class="LABEL">{{ t('pptx.media.fullScreen') }}</span>
			<input
				type="checkbox"
				:disabled="!canEdit"
				:checked="Boolean(element.fullScreen)"
				@change="onFullScreen"
			/>
		</label>

		<label :class="ROW">
			<span :class="LABEL">{{ t('pptx.media.hideWhenNotPlaying') }}</span>
			<input
				type="checkbox"
				:disabled="!canEdit"
				:checked="Boolean(element.hideWhenNotPlaying)"
				@change="onHideWhenNotPlaying"
			/>
		</label>
	</div>
</template>
