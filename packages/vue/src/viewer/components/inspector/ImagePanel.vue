<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import { computed } from 'vue';

import { getImageEffects, mergeEffectsPatch } from '../../composables/useImageEditing';
import ArtisticEffectsGallery from './ArtisticEffectsGallery.vue';
import ColorChangeSection from './ColorChangeSection.vue';
import ColorWashSection from './ColorWashSection.vue';
import DuotonePanel from './DuotonePanel.vue';
import ImageAdjustmentsPanel from './ImageAdjustmentsPanel.vue';
import ImageCropSection from './ImageCropSection.vue';

/**
 * ImagePanel: inspector panel for image-like elements (`image` / `picture`),
 * at parity with React's ImagePropertiesPanel. This SFC stays thin: alt text +
 * grayscale toggle + full Reset Picture live here, while every other concern is
 * a focused sub-panel (adjustments, crop/replace, artistic effects, recolour,
 * colour wash, duotone). Each sub-panel emits a shallow `Partial<PptxElement>`
 * patch (nested `imageEffects` emitted whole) which this panel relays upward;
 * the host merges it via `ops.updateElement(id, patch)`.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const isImage = computed(() => isImageLikeElement(props.element));

const altText = computed<string>(() => {
	const el = props.element;
	return 'altText' in el && typeof el.altText === 'string' ? el.altText : '';
});

const effects = computed<PptxImageEffects | undefined>(() => getImageEffects(props.element));

/** Displayable source for the artistic-effect thumbnails (embedded data URL). */
const imgSrc = computed<string | undefined>(() => {
	const el = props.element as unknown as { imageData?: string };
	return typeof el.imageData === 'string' ? el.imageData : undefined;
});

const grayscale = computed<boolean>(() => Boolean(effects.value?.grayscale));

/** True when any effect or crop is set; gates the Reset Picture button. */
const isDirty = computed<boolean>(() => {
	if (effects.value !== undefined) {
		return true;
	}
	const el = props.element as unknown as Record<string, number | undefined>;
	return Boolean(el.cropLeft || el.cropTop || el.cropRight || el.cropBottom);
});

function relay(patch: Partial<PptxElement>): void {
	emit('update', patch);
}

function onAltInput(event: Event): void {
	emit('update', { altText: (event.target as HTMLInputElement).value } as Partial<PptxElement>);
}

function onGrayscale(event: Event): void {
	const on = (event.target as HTMLInputElement).checked;
	emit('update', mergeEffectsPatch(effects.value, { grayscale: on ? true : undefined }));
}

/** Clear every adjustment, effect, and crop back to the picture's default. */
function onResetPicture(): void {
	emit('update', {
		imageEffects: undefined,
		cropLeft: 0,
		cropTop: 0,
		cropRight: 0,
		cropBottom: 0,
	} as Partial<PptxElement>);
}
</script>

<template>
	<div class="pptx-vue-image-panel flex flex-col gap-3 text-[11px]">
		<p v-if="!isImage" class="pptx-vue-image-panel__note text-muted-foreground">
			No image properties for this element.
		</p>

		<template v-else>
			<label class="pptx-vue-image-panel__field flex flex-col gap-1">
				<span class="pptx-vue-image-panel__label font-semibold text-muted-foreground"
					>Alt text</span
				>
				<input
					type="text"
					class="pptx-vue-image-panel__input w-full bg-muted border border-border rounded px-1.5 py-1 text-[11px]"
					:value="altText"
					placeholder="Describe this image"
					@input="onAltInput"
				/>
			</label>

			<ImageCropSection :element="element" @update="relay" />

			<ImageAdjustmentsPanel :fx="effects" @update="relay" />

			<label class="pptx-vue-image-panel__field flex items-center justify-between gap-2">
				<span class="font-semibold text-muted-foreground">Grayscale</span>
				<input
					class="pptx-vue-image-panel__grayscale"
					type="checkbox"
					:checked="grayscale"
					@change="onGrayscale"
				/>
			</label>

			<ArtisticEffectsGallery :img-src="imgSrc" :fx="effects" @update="relay" />

			<ColorChangeSection :fx="effects" @update="relay" />

			<ColorWashSection :fx="effects" @update="relay" />

			<DuotonePanel :fx="effects" @update="relay" />

			<button
				v-if="isDirty"
				type="button"
				class="pptx-vue-image-panel__reset-picture w-full rounded border border-border bg-muted hover:bg-accent px-2 py-1 transition-colors"
				@click="onResetPicture"
			>
				Reset Picture
			</button>
		</template>
	</div>
</template>
