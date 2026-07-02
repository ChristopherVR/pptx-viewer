<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { computed } from 'vue';

import {
	CROP_SIDES,
	cropFractionToPercent,
	cropPercentToFraction,
} from '../../composables/useImageEditing';

/**
 * ImageCropSection: crop-inset sliders (left/top/right/bottom), a Reset Crop
 * action, and a "Replace Image" button. Crop fields are TOP-LEVEL element
 * fields (fractions 0..1), so patches are emitted as shallow element patches
 * (e.g. `{ cropLeft: 0.05 }`), not nested under `imageEffects`.
 *
 * Replace Image reads the chosen file as a data-URL and emits `{ imageData }`
 * so the swap happens entirely within the panel (no host wiring required).
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const sides = CROP_SIDES;

const cropPercents = computed<Record<string, number>>(() => {
	const el = props.element as unknown as Record<string, number | undefined>;
	const out: Record<string, number> = {};
	for (const side of sides) {
		out[side.key] = cropFractionToPercent(el[side.key]);
	}
	return out;
});

function onCrop(key: (typeof sides)[number]['key'], event: Event): void {
	const percent = Number((event.target as HTMLInputElement).value);
	emit('update', { [key]: cropPercentToFraction(percent) } as Partial<PptxElement>);
}

function onResetCrop(): void {
	emit('update', {
		cropLeft: 0,
		cropTop: 0,
		cropRight: 0,
		cropBottom: 0,
	} as Partial<PptxElement>);
}

function onReplaceImage(event: Event): void {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) {
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		if (typeof reader.result === 'string') {
			emit('update', { imageData: reader.result } as Partial<PptxElement>);
		}
	};
	reader.readAsDataURL(file);
}
</script>

<template>
	<div class="pptx-vue-image-crop flex flex-col gap-2 text-[11px]">
		<label
			class="pptx-vue-image-crop__replace w-full text-center rounded border border-border bg-muted hover:bg-accent px-2 py-1 cursor-pointer transition-colors"
		>
			Replace Image
			<input
				type="file"
				class="hidden"
				accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
				@change="onReplaceImage"
			/>
		</label>

		<label
			v-for="side in sides"
			:key="side.key"
			class="pptx-vue-image-crop__slider grid grid-cols-[72px_1fr_36px] items-center gap-2"
		>
			<span class="text-muted-foreground">{{ side.label }}</span>
			<input
				type="range"
				class="w-full accent-primary"
				min="0"
				max="80"
				step="1"
				:value="cropPercents[side.key]"
				@input="onCrop(side.key, $event)"
			/>
			<span class="text-right tabular-nums text-muted-foreground"
				>{{ cropPercents[side.key] }}%</span
			>
		</label>

		<button
			type="button"
			class="pptx-vue-image-crop__reset w-full rounded border border-border bg-muted hover:bg-accent px-2 py-1 transition-colors"
			@click="onResetCrop"
		>
			Reset Crop
		</button>
	</div>
</template>
