<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * ImagePanel — inspector panel for image-like elements (`image` / `picture`).
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

/** True when any adjustment is set — gates the reset button. */
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
	<div class="pptx-vue-image-panel">
		<p v-if="!isImage" class="pptx-vue-image-panel__note">No image properties for this element.</p>

		<template v-else>
			<!-- Alt text -->
			<label class="pptx-vue-image-panel__field">
				<span class="pptx-vue-image-panel__label">Alt text</span>
				<input
					type="text"
					class="pptx-vue-image-panel__input"
					:value="altText"
					placeholder="Describe this image"
					@input="onAltInput"
				/>
			</label>

			<!-- Image adjustments -->
			<div class="pptx-vue-image-panel__section">
				<div class="pptx-vue-image-panel__section-head">
					<span class="pptx-vue-image-panel__label">Image adjustments</span>
					<button
						v-if="hasAdjustments"
						type="button"
						class="pptx-vue-image-panel__reset"
						@click="onReset"
					>
						Reset adjustments
					</button>
				</div>

				<label class="pptx-vue-image-panel__slider">
					<span class="pptx-vue-image-panel__slider-label">Brightness</span>
					<input
						type="range"
						min="-100"
						max="100"
						step="1"
						:value="brightness"
						@input="onBrightness"
					/>
					<span class="pptx-vue-image-panel__value">{{ brightness }}</span>
				</label>

				<label class="pptx-vue-image-panel__slider">
					<span class="pptx-vue-image-panel__slider-label">Contrast</span>
					<input type="range" min="-100" max="100" step="1" :value="contrast" @input="onContrast" />
					<span class="pptx-vue-image-panel__value">{{ contrast }}</span>
				</label>

				<label class="pptx-vue-image-panel__slider">
					<span class="pptx-vue-image-panel__slider-label">Saturation</span>
					<input
						type="range"
						min="-100"
						max="100"
						step="1"
						:value="saturation"
						@input="onSaturation"
					/>
					<span class="pptx-vue-image-panel__value">{{ saturation }}</span>
				</label>
			</div>
		</template>
	</div>
</template>

<style scoped>
.pptx-vue-image-panel {
	display: flex;
	flex-direction: column;
	gap: 12px;
	font-size: 11px;
}

.pptx-vue-image-panel__note {
	margin: 0;
	color: var(--pptx-vue-muted, #888);
}

.pptx-vue-image-panel__field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.pptx-vue-image-panel__label {
	font-weight: 600;
	color: var(--pptx-vue-muted, #666);
}

.pptx-vue-image-panel__input {
	width: 100%;
	box-sizing: border-box;
	padding: 4px 6px;
	font-size: 11px;
	border: 1px solid var(--pptx-vue-border, #ccc);
	border-radius: 4px;
	background: var(--pptx-vue-input-bg, #fff);
	color: inherit;
}

.pptx-vue-image-panel__section {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.pptx-vue-image-panel__section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.pptx-vue-image-panel__reset {
	padding: 2px 6px;
	font-size: 10px;
	border: 1px solid var(--pptx-vue-border, #ccc);
	border-radius: 4px;
	background: var(--pptx-vue-muted-bg, #f3f3f3);
	color: inherit;
	cursor: pointer;
}

.pptx-vue-image-panel__reset:hover {
	background: var(--pptx-vue-accent-bg, #e8e8e8);
}

.pptx-vue-image-panel__slider {
	display: grid;
	grid-template-columns: 72px 1fr 36px;
	align-items: center;
	gap: 8px;
}

.pptx-vue-image-panel__slider-label {
	color: var(--pptx-vue-muted, #666);
}

.pptx-vue-image-panel__slider input[type='range'] {
	width: 100%;
}

.pptx-vue-image-panel__value {
	text-align: right;
	font-variant-numeric: tabular-nums;
	color: var(--pptx-vue-muted, #666);
}
</style>
