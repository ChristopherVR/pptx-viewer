<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * ArrangePanel — position, size, rotation and flip controls.
 *
 * Applicable to every element (all carry `x`/`y`/`width`/`height`/`rotation`
 * and the flip flags). Emits SHALLOW patches that the parent merges onto the
 * element via `ops.updateElement(id, patch)`.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const x = computed(() => Math.round(props.element.x ?? 0));
const y = computed(() => Math.round(props.element.y ?? 0));
const width = computed(() => Math.round(props.element.width ?? 0));
const height = computed(() => Math.round(props.element.height ?? 0));
const rotation = computed(() => Math.round(props.element.rotation ?? 0));
const flipHorizontal = computed(() => Boolean(props.element.flipHorizontal));
const flipVertical = computed(() => Boolean(props.element.flipVertical));

const MIN_SIZE = 1;

function toNumber(value: string): number | undefined {
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

function onPos(field: 'x' | 'y', value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emit('update', { [field]: n } as Partial<PptxElement>);
}

function onSize(field: 'width' | 'height', value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emit('update', { [field]: Math.max(n, MIN_SIZE) } as Partial<PptxElement>);
}

function onRotation(value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emit('update', { rotation: n });
}

function onFlipHorizontal(checked: boolean): void {
	emit('update', { flipHorizontal: checked });
}

function onFlipVertical(checked: boolean): void {
	emit('update', { flipVertical: checked });
}
</script>

<template>
	<div class="pptx-vue-arrange">
		<div class="pptx-vue-arrange-grid">
			<label class="pptx-vue-arrange-field">
				<span class="pptx-vue-arrange-label">X</span>
				<input
					type="number"
					class="pptx-vue-arrange-input"
					:value="x"
					@input="onPos('x', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-arrange-field">
				<span class="pptx-vue-arrange-label">Y</span>
				<input
					type="number"
					class="pptx-vue-arrange-input"
					:value="y"
					@input="onPos('y', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-arrange-field">
				<span class="pptx-vue-arrange-label">Width</span>
				<input
					type="number"
					class="pptx-vue-arrange-input"
					:min="MIN_SIZE"
					:value="width"
					@input="onSize('width', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-arrange-field">
				<span class="pptx-vue-arrange-label">Height</span>
				<input
					type="number"
					class="pptx-vue-arrange-input"
					:min="MIN_SIZE"
					:value="height"
					@input="onSize('height', ($event.target as HTMLInputElement).value)"
				/>
			</label>
		</div>

		<label class="pptx-vue-arrange-field">
			<span class="pptx-vue-arrange-label">Rotation</span>
			<input
				type="number"
				class="pptx-vue-arrange-input"
				:value="rotation"
				@input="onRotation(($event.target as HTMLInputElement).value)"
			/>
		</label>

		<div class="pptx-vue-arrange-flips">
			<label class="pptx-vue-arrange-check">
				<input
					type="checkbox"
					:checked="flipHorizontal"
					@change="onFlipHorizontal(($event.target as HTMLInputElement).checked)"
				/>
				Flip Horizontally
			</label>
			<label class="pptx-vue-arrange-check">
				<input
					type="checkbox"
					:checked="flipVertical"
					@change="onFlipVertical(($event.target as HTMLInputElement).checked)"
				/>
				Flip Vertically
			</label>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-arrange {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	font-size: 0.75rem;
}

.pptx-vue-arrange-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.5rem;
}

.pptx-vue-arrange-field {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.pptx-vue-arrange-label {
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-arrange-input {
	border: 1px solid var(--pptx-vue-border, #d1d5db);
	border-radius: 0.25rem;
	padding: 0.25rem 0.5rem;
	background: var(--pptx-vue-muted, #f3f4f6);
	color: inherit;
}

.pptx-vue-arrange-flips {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.5rem;
}

.pptx-vue-arrange-check {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
}
</style>
