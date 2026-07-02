<script setup lang="ts">
/**
 * MediaTrimTimeline: the draggable trim scrubber, ported from React's
 * `TrimTimeline`. Shows the trimmed region, a playhead, two drag handles, and
 * bookmark markers over a clip of `duration` seconds.
 *
 *  - Emits `trim-change` with `{ trimStartMs, trimEndMs }` while a handle drags.
 *  - Emits `seek` with a time in seconds when the bar (or a marker) is clicked.
 *
 * All state is derived from props; the parent owns trim + playhead values.
 */
import type { MediaBookmark } from 'pptx-viewer-core';
import { computed, onBeforeUnmount, ref } from 'vue';

import { clamp } from '../../composables/useMediaEditing';

const props = defineProps<{
	duration: number;
	trimStartMs: number;
	trimEndMs: number;
	currentTime: number;
	bookmarks: MediaBookmark[];
	canEdit: boolean;
}>();

const emit = defineEmits<{
	'trim-change': [payload: { trimStartMs: number; trimEndMs: number }];
	seek: [time: number];
}>();

const barRef = ref<HTMLDivElement | null>(null);
const dragging = ref<'start' | 'end' | null>(null);

const safeDuration = computed(() => (props.duration > 0 ? props.duration : 1));
const trimStartSec = computed(() => props.trimStartMs / 1000);
const trimEndSec = computed(() => (props.trimEndMs > 0 ? props.trimEndMs / 1000 : props.duration));

const startPct = computed(() => (trimStartSec.value / safeDuration.value) * 100);
const endPct = computed(() => (trimEndSec.value / safeDuration.value) * 100);
const playheadPct = computed(() => Math.min((props.currentTime / safeDuration.value) * 100, 100));

function timeFromPointer(clientX: number): number {
	const bar = barRef.value;
	if (!bar) {
		return 0;
	}
	const rect = bar.getBoundingClientRect();
	const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
	return ratio * safeDuration.value;
}

function onPointerMove(event: PointerEvent): void {
	if (!dragging.value) {
		return;
	}
	const t = timeFromPointer(event.clientX);
	if (dragging.value === 'start') {
		const newStart = Math.min(t, trimEndSec.value - 0.1);
		emit('trim-change', {
			trimStartMs: Math.max(0, newStart) * 1000,
			trimEndMs: props.trimEndMs,
		});
	} else {
		const newEnd = Math.max(t, trimStartSec.value + 0.1);
		emit('trim-change', {
			trimStartMs: props.trimStartMs,
			trimEndMs: Math.min(newEnd, props.duration) * 1000,
		});
	}
}

function stopDragging(): void {
	dragging.value = null;
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', stopDragging);
}

function startDragging(which: 'start' | 'end', event: PointerEvent): void {
	event.stopPropagation();
	if (!props.canEdit) {
		return;
	}
	dragging.value = which;
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', stopDragging);
}

function onBarClick(event: MouseEvent): void {
	emit('seek', timeFromPointer(event.clientX));
}

function markerPct(bmk: MediaBookmark): number {
	return (bmk.time / safeDuration.value) * 100;
}

function onMarkerClick(bmk: MediaBookmark, event: MouseEvent): void {
	event.stopPropagation();
	emit('seek', bmk.time);
}

onBeforeUnmount(stopDragging);
</script>

<template>
	<div class="pptx-vue-media-timeline space-y-1">
		<div class="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
			<span>{{ trimStartSec.toFixed(1) }}s</span>
			<span>{{ trimEndSec.toFixed(1) }}s</span>
		</div>
		<div
			ref="barRef"
			class="pptx-vue-media-timeline__bar relative h-5 rounded bg-muted cursor-pointer select-none"
			@click="onBarClick"
		>
			<div
				class="absolute top-0 bottom-0 bg-primary/30 rounded"
				:style="{ left: `${startPct}%`, width: `${endPct - startPct}%` }"
			/>
			<div
				class="absolute top-0 bottom-0 w-0.5 bg-white z-10"
				:style="{ left: `${playheadPct}%` }"
			/>
			<div
				v-if="canEdit"
				class="absolute top-0 bottom-0 w-2 bg-primary rounded-l cursor-ew-resize z-20 hover:bg-primary/80"
				:style="{ left: `calc(${startPct}% - 4px)` }"
				@pointerdown="startDragging('start', $event)"
			/>
			<div
				v-if="canEdit"
				class="absolute top-0 bottom-0 w-2 bg-primary rounded-r cursor-ew-resize z-20 hover:bg-primary/80"
				:style="{ left: `calc(${endPct}% - 4px)` }"
				@pointerdown="startDragging('end', $event)"
			/>
			<div
				v-for="bmk in bookmarks"
				:key="bmk.id"
				class="absolute top-0 bottom-0 w-1 bg-yellow-400/70 z-10 cursor-pointer"
				:style="{ left: `${markerPct(bmk)}%` }"
				:title="bmk.label"
				@click="onMarkerClick(bmk, $event)"
			/>
		</div>
	</div>
</template>
