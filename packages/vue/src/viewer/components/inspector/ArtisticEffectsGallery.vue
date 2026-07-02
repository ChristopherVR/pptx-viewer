<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { ARTISTIC_EFFECTS } from 'pptx-viewer-shared';

import { humanizeEffectLabel, mergeEffectsPatch } from '../../composables/useImageEditing';

/**
 * ArtisticEffectsGallery: a 4-column grid over the shared ARTISTIC_EFFECTS
 * catalogue. Each cell previews the effect as a live CSS filter over the image
 * and, on click, sets `imageEffects.artisticEffect` (or clears it for "none").
 * Emits the FULL merged `imageEffects` sub-object like every other sub-panel.
 */
const props = defineProps<{
	imgSrc: string | undefined;
	fx: PptxImageEffects | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const effects = ARTISTIC_EFFECTS;

function isActive(effectName: string): boolean {
	return effectName === 'none'
		? !props.fx?.artisticEffect
		: props.fx?.artisticEffect === effectName;
}

function thumbStyle(cssFilter: string): Record<string, string> {
	const style: Record<string, string> = {
		backgroundSize: 'cover',
		backgroundPosition: 'center',
	};
	if (props.imgSrc) {
		style.backgroundImage = `url(${props.imgSrc})`;
	}
	if (cssFilter) {
		style.filter = cssFilter;
	}
	return style;
}

function onPick(effectName: string): void {
	const patch: Partial<PptxImageEffects> = {
		artisticEffect: effectName === 'none' ? undefined : effectName,
	};
	if (effectName === 'grayscale') {
		patch.grayscale = undefined;
	}
	emit('update', mergeEffectsPatch(props.fx, patch));
}
</script>

<template>
	<div class="pptx-vue-artistic flex flex-col gap-1 text-[11px]">
		<span class="text-muted-foreground">Artistic effects</span>
		<div class="pptx-vue-artistic__grid grid grid-cols-4 gap-1">
			<button
				v-for="[effectName, tKey, cssFilter] in effects"
				:key="effectName"
				type="button"
				class="pptx-vue-artistic__cell flex flex-col items-center gap-0.5 rounded border p-0.5 hover:bg-accent/50 transition-colors"
				:class="isActive(effectName) ? 'border-primary bg-primary/10' : 'border-border'"
				:title="humanizeEffectLabel(tKey)"
				@click="onPick(effectName)"
			>
				<div class="w-10 h-7 rounded overflow-hidden bg-muted" :style="thumbStyle(cssFilter)" />
				<span class="text-[8px] text-muted-foreground truncate w-full text-center">
					{{ humanizeEffectLabel(effectName) }}
				</span>
			</button>
		</div>
	</div>
</template>
