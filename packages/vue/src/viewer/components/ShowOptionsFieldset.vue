<script setup lang="ts">
import type { PptxPresentationProperties } from 'pptx-viewer-core';

/**
 * ShowOptionsFieldset: slide-show option toggles (loop, narration, animation,
 * subtitles) plus the annotation pen colour. Vue port of the React
 * `ShowOptionsFieldset.tsx`, extended with the pen-colour control the React
 * dialog stores on `penColor`.
 */
const props = defineProps<{
	draft: PptxPresentationProperties;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxPresentationProperties>];
}>();

function checked(e: Event): boolean {
	return (e.target as HTMLInputElement).checked;
}
</script>

<template>
	<fieldset class="space-y-1.5">
		<legend class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
			Show options
		</legend>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="Boolean(draft.loopContinuously)"
				@change="emit('update', { loopContinuously: checked($event) })"
			/>
			<span>Loop continuously until 'Esc'</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="draft.showWithNarration === false"
				@change="emit('update', { showWithNarration: !checked($event) })"
			/>
			<span>Show without narration</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="draft.showWithAnimation === false"
				@change="emit('update', { showWithAnimation: !checked($event) })"
			/>
			<span>Show without animation</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="Boolean(draft.showSubtitles)"
				@change="emit('update', { showSubtitles: checked($event) })"
			/>
			<span>Show subtitles / captions</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2 pt-1">
			<span class="text-muted-foreground">Pen color</span>
			<input
				type="color"
				class="h-6 w-8 cursor-pointer rounded border border-border bg-muted"
				:value="draft.penColor ?? '#ff0000'"
				@input="emit('update', { penColor: ($event.target as HTMLInputElement).value })"
			/>
		</label>
	</fieldset>
</template>
