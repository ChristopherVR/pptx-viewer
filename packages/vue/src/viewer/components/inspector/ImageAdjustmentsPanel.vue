<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { computed } from 'vue';

import { mergeEffectsPatch } from '../../composables/useImageEditing';

/**
 * ImageAdjustmentsPanel: brightness / contrast / saturation sliders plus the
 * alpha (transparency) and bi-level (1-bit threshold) adjustments. Emits the
 * FULL merged `imageEffects` sub-object per change, exactly like ImagePanel.
 *
 * `alphaModFix` is stored as opacity (100 = fully opaque); PowerPoint's UI
 * shows it inverted as "Transparency", so we present `100 - alphaModFix`.
 */
const props = defineProps<{
	fx: PptxImageEffects | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const brightness = computed<number>(() => props.fx?.brightness ?? 0);
const contrast = computed<number>(() => props.fx?.contrast ?? 0);
const saturation = computed<number>(() => props.fx?.saturation ?? 0);

const transparency = computed<number>(() => 100 - (props.fx?.alphaModFix ?? 100));
const biLevel = computed<number>(() => props.fx?.biLevel ?? 0);

const hasThreshold = computed<boolean>(
	() => props.fx?.alphaModFix !== undefined || props.fx?.biLevel !== undefined,
);

function commit(patch: Partial<PptxImageEffects>): void {
	emit('update', mergeEffectsPatch(props.fx, patch));
}

function onBrightness(event: Event): void {
	commit({ brightness: Number((event.target as HTMLInputElement).value) });
}
function onContrast(event: Event): void {
	commit({ contrast: Number((event.target as HTMLInputElement).value) });
}
function onSaturation(event: Event): void {
	commit({ saturation: Number((event.target as HTMLInputElement).value) });
}
function onTransparency(event: Event): void {
	commit({ alphaModFix: 100 - Number((event.target as HTMLInputElement).value) });
}
function onBiLevel(event: Event): void {
	commit({ biLevel: Number((event.target as HTMLInputElement).value) });
}
function onResetThreshold(): void {
	commit({ alphaModFix: undefined, biLevel: undefined });
}
</script>

<template>
	<div class="pptx-vue-image-adjust flex flex-col gap-2 text-[11px]">
		<label class="pptx-vue-image-adjust__slider grid grid-cols-[72px_1fr_36px] items-center gap-2">
			<span class="text-muted-foreground">Brightness</span>
			<input
				type="range"
				class="w-full accent-primary"
				min="-100"
				max="100"
				step="1"
				:value="brightness"
				@input="onBrightness"
			/>
			<span class="text-right tabular-nums text-muted-foreground">{{ brightness }}</span>
		</label>

		<label class="pptx-vue-image-adjust__slider grid grid-cols-[72px_1fr_36px] items-center gap-2">
			<span class="text-muted-foreground">Contrast</span>
			<input
				type="range"
				class="w-full accent-primary"
				min="-100"
				max="100"
				step="1"
				:value="contrast"
				@input="onContrast"
			/>
			<span class="text-right tabular-nums text-muted-foreground">{{ contrast }}</span>
		</label>

		<label class="pptx-vue-image-adjust__slider grid grid-cols-[72px_1fr_36px] items-center gap-2">
			<span class="text-muted-foreground">Saturation</span>
			<input
				type="range"
				class="w-full accent-primary"
				min="-100"
				max="100"
				step="1"
				:value="saturation"
				@input="onSaturation"
			/>
			<span class="text-right tabular-nums text-muted-foreground">{{ saturation }}</span>
		</label>

		<div class="pptx-vue-image-adjust__head flex items-center justify-between pt-1">
			<span class="font-semibold text-muted-foreground">Transparency and threshold</span>
			<button
				v-if="hasThreshold"
				type="button"
				class="pptx-vue-image-adjust__reset rounded border border-border bg-muted hover:bg-accent px-1.5 py-0.5 text-[10px] transition-colors"
				@click="onResetThreshold"
			>
				Reset
			</button>
		</div>

		<label class="pptx-vue-image-adjust__slider grid grid-cols-[72px_1fr_36px] items-center gap-2">
			<span class="text-muted-foreground">Transparency</span>
			<input
				type="range"
				class="w-full accent-primary"
				min="0"
				max="100"
				step="1"
				:value="transparency"
				@input="onTransparency"
			/>
			<span class="text-right tabular-nums text-muted-foreground">{{ transparency }}%</span>
		</label>

		<label class="pptx-vue-image-adjust__slider grid grid-cols-[72px_1fr_36px] items-center gap-2">
			<span class="text-muted-foreground">Bi-level</span>
			<input
				type="range"
				class="w-full accent-primary"
				min="0"
				max="100"
				step="1"
				:value="biLevel"
				@input="onBiLevel"
			/>
			<span class="text-right tabular-nums text-muted-foreground">{{ biLevel }}</span>
		</label>
	</div>
</template>
