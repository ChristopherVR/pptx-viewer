<script setup lang="ts">
/**
 * MediaBookmarks: the "Bookmarks" card of the media inspector, ported from the
 * bookmarks half of React's `MediaPlaybackBookmarks`. Lists bookmarks sorted by
 * time (seek on click, remove on hover) and adds a new bookmark at the current
 * playhead time.
 *
 * Emits `update` with a SHALLOW `{ bookmarks }` patch, and `seek` when a
 * bookmark row is clicked.
 */
import type { MediaBookmark, PptxElement } from 'pptx-viewer-core';
import { ref } from 'vue';

import { formatTime, generateBookmarkId, sortBookmarks } from '../../composables/useMediaEditing';

const props = defineProps<{
	bookmarks: MediaBookmark[];
	canEdit: boolean;
	currentTime: number;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
	seek: [time: number];
}>();

const newLabel = ref('');

function addBookmark(): void {
	const label = newLabel.value.trim() || `Bookmark ${props.bookmarks.length + 1}`;
	const next: MediaBookmark = {
		id: generateBookmarkId(),
		time: props.currentTime,
		label,
	};
	emit('update', { bookmarks: [...props.bookmarks, next] } as Partial<PptxElement>);
	newLabel.value = '';
}

function removeBookmark(id: string): void {
	emit('update', {
		bookmarks: props.bookmarks.filter((b) => b.id !== id),
	} as Partial<PptxElement>);
}

function onSeek(time: number): void {
	emit('seek', time);
}

const CARD = 'pptx-vue-media-card rounded border border-border bg-card p-2 space-y-2';
const HEADING = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const INPUT = 'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full text-[11px]';
const BTN = 'rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors';
</script>

<template>
	<div :class="CARD">
		<div :class="HEADING">Bookmarks</div>

		<div v-if="bookmarks.length > 0" class="space-y-1 max-h-32 overflow-y-auto">
			<div
				v-for="bmk in sortBookmarks(bookmarks)"
				:key="bmk.id"
				class="flex items-center gap-1 text-[11px] group"
			>
				<button
					type="button"
					class="text-primary hover:text-primary/80 truncate flex-1 text-left"
					title="Seek to bookmark"
					@click="onSeek(bmk.time)"
				>
					{{ bmk.label }}
				</button>
				<span class="text-muted-foreground tabular-nums text-[10px]">
					{{ formatTime(bmk.time) }}
				</span>
				<button
					v-if="canEdit"
					type="button"
					class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
					title="Remove"
					@click="removeBookmark(bmk.id)"
				>
					&times;
				</button>
			</div>
		</div>

		<div v-if="canEdit" class="flex items-center gap-1">
			<input
				type="text"
				:class="INPUT"
				placeholder="Bookmark label"
				:value="newLabel"
				@input="newLabel = ($event.target as HTMLInputElement).value"
				@keydown.enter.prevent="addBookmark"
			/>
			<button type="button" :class="BTN" title="Add bookmark" @click="addBookmark">+</button>
		</div>
	</div>
</template>
