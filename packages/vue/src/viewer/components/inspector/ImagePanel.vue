<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * ImagePanel: inspector panel for image-like elements (`image` / `picture`).
 *
 * Uniform inspector contract:
 *  - Props: `{ element }`.
 *  - Emits `update` with a SHALLOW `Partial<PptxElement>` patch; the parent
 *    merges it via `ops.updateElement(id, patch)`. Nested objects (here
 *    `imageEffects`) are emitted as the FULL merged sub-object.
 *
 * Controls mirror the real core fields exactly:
 *  - Alt text  → `altText` (string) on `PptxImageProperties`.
 *  - Brightness / Contrast / Saturation → numeric fields on
 *    `PptxImageEffects` (`imageEffects`), each ranged -100..100.
 *  - Reset adjustments → clears the whole `imageEffects` container.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

/** Whether this element supports image inspection. */
const isImage = computed(() => isImageLikeElement(props.element));

/** Current alt text, if any. */
const altText = computed<string>(() => {
	const el = props.element;
	return 'altText' in el && typeof el.altText === 'string' ? el.altText : '';
});

/** Current image-effects container off the element (read by image-effects.ts). */
const effects = computed<PptxImageEffects | undefined>(() => {
	const el = props.element;
	return 'imageEffects' in el ? el.imageEffects : undefined;
});

const brightness = computed<number>(() => effects.value?.brightness ?? 0);
const contrast = computed<number>(() => effects.value?.contrast ?? 0);
const saturation = computed<number>(() => effects.value?.saturation ?? 0);

/** True when any adjustment is set; gates the reset button. */
const hasAdjustments = computed<boolean>(() => effects.value !== undefined);

// ── emitters ───────────────────────────────────────────────────────────────

function onAltInput(event: Event): void {
	const value = (event.target as HTMLInputElement).value;
	emit('update', { altText: value } as Partial<PptxElement>);
}

/** Emit the FULL merged `imageEffects` sub-object with one field patched. */
function commitEffect(patch: Partial<PptxImageEffects>): void {
	const merged: PptxImageEffects = { ...effects.value, ...patch };
	emit('update', { imageEffects: merged } as Partial<PptxElement>);
}

function onBrightness(event: Event): void {
	commitEffect({ brightness: Number((event.target as HTMLInputElement).value) });
}

function onContrast(event: Event): void {
	commitEffect({ contrast: Number((event.target as HTMLInputElement).value) });
}

function onSaturation(event: Event): void {
	commitEffect({ saturation: Number((event.target as HTMLInputElement).value) });
}

function onReset(): void {
	emit('update', { imageEffects: undefined } as Partial<PptxElement>);
}
</script>

<template>
	<div class="pptx-vue-image-panel flex flex-col gap-3 text-[11px]">
		<p v-if="!isImage" class="pptx-vue-image-panel__note text-muted-foreground">
			No image properties for this element.
		</p>

		<template v-else>
			<!-- Alt text -->
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

			<!-- Image adjustments -->
			<div class="pptx-vue-image-panel__section flex flex-col gap-2">
				<div class="pptx-vue-image-panel__section-head flex items-center justify-between">
					<span class="pptx-vue-image-panel__label font-semibold text-muted-foreground">
						Image adjustments
					</span>
					<button
						v-if="hasAdjustments"
						type="button"
						class="pptx-vue-image-panel__reset rounded border border-border bg-muted hover:bg-accent px-1.5 py-0.5 text-[10px] transition-colors"
						@click="onReset"
					>
						Reset adjustments
					</button>
				</div>

				<label
					class="pptx-vue-image-panel__slider grid grid-cols-[72px_1fr_36px] items-center gap-2"
				>
					<span class="pptx-vue-image-panel__slider-label text-muted-foreground">Brightness</span>
					<input
						type="range"
						class="w-full accent-primary"
						min="-100"
						max="100"
						step="1"
						:value="brightness"
						@input="onBrightness"
					/>
					<span class="pptx-vue-image-panel__value text-right tabular-nums text-muted-foreground">
						{{ brightness }}
					</span>
				</label>

				<label
					class="pptx-vue-image-panel__slider grid grid-cols-[72px_1fr_36px] items-center gap-2"
				>
					<span class="pptx-vue-image-panel__slider-label text-muted-foreground">Contrast</span>
					<input
						type="range"
						class="w-full accent-primary"
						min="-100"
						max="100"
						step="1"
						:value="contrast"
						@input="onContrast"
					/>
					<span class="pptx-vue-image-panel__value text-right tabular-nums text-muted-foreground">
						{{ contrast }}
					</span>
				</label>

				<label
					class="pptx-vue-image-panel__slider grid grid-cols-[72px_1fr_36px] items-center gap-2"
				>
					<span class="pptx-vue-image-panel__slider-label text-muted-foreground">Saturation</span>
					<input
						type="range"
						class="w-full accent-primary"
						min="-100"
						max="100"
						step="1"
						:value="saturation"
						@input="onSaturation"
					/>
					<span class="pptx-vue-image-panel__value text-right tabular-nums text-muted-foreground">
						{{ saturation }}
					</span>
				</label>
			</div>
		</template>
	</div>
</template>
