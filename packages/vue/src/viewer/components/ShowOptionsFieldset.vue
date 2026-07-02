<script setup lang="ts">
import type { PptxPresentationProperties } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

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

const { t } = useI18n();

function checked(e: Event): boolean {
	return (e.target as HTMLInputElement).checked;
}
</script>

<template>
	<fieldset class="space-y-1.5">
		<legend class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.slideShow.showOptions') }}
		</legend>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="Boolean(draft.loopContinuously)"
				@change="emit('update', { loopContinuously: checked($event) })"
			/>
			<span>{{ t('pptx.slideShow.loopContinuously') }}</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="draft.showWithNarration === false"
				@change="emit('update', { showWithNarration: !checked($event) })"
			/>
			<span>{{ t('pptx.slideShow.showWithoutNarration') }}</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="draft.showWithAnimation === false"
				@change="emit('update', { showWithAnimation: !checked($event) })"
			/>
			<span>{{ t('pptx.slideShow.showWithoutAnimation') }}</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				class="accent-primary"
				:checked="Boolean(draft.showSubtitles)"
				@change="emit('update', { showSubtitles: checked($event) })"
			/>
			<span>{{ t('pptx.slideShow.showSubtitles') }}</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2 pt-1">
			<span class="text-muted-foreground">{{ t('pptx.slideShow.penColor') }}</span>
			<input
				type="color"
				class="h-6 w-8 cursor-pointer rounded border border-border bg-muted"
				:value="draft.penColor ?? '#ff0000'"
				@input="emit('update', { penColor: ($event.target as HTMLInputElement).value })"
			/>
		</label>
	</fieldset>
</template>
