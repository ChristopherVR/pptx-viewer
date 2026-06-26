<script setup lang="ts">
import { Lock, LockOpen } from 'lucide-vue-next';
import type { PptxElement, PptxShapeLocks } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * ArrangePanel: position, size, rotation, flip controls and element lock toggle.
 *
 * Applicable to every element (all carry `x`/`y`/`width`/`height`/`rotation`
 * and the flip flags). Emits SHALLOW patches that the parent merges onto the
 * element via `ops.updateElement(id, patch)`.
 */
const props = defineProps<{
	element: PptxElement;
	canEdit?: boolean;
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

const isLocked = computed(
	() => Boolean(props.element.locks?.noMove) || Boolean(props.element.locks?.noSelect),
);

function toggleLock(): void {
	if (!props.canEdit) return;
	if (isLocked.value) {
		emit('update', { locks: undefined } as Partial<PptxElement>);
	} else {
		const locks: PptxShapeLocks = { noMove: true, noResize: true, noSelect: true };
		emit('update', { locks } as Partial<PptxElement>);
	}
}

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
	<div class="pptx-vue-arrange flex flex-col gap-2 text-xs">
		<div class="flex items-center justify-between">
			<span class="text-muted-foreground font-medium">Position &amp; Size</span>
			<button
				type="button"
				:disabled="!props.canEdit"
				:title="isLocked ? 'Unlock element' : 'Lock element'"
				:aria-pressed="isLocked"
				class="p-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
				@click="toggleLock"
			>
				<Lock v-if="isLocked" class="w-3.5 h-3.5 text-amber-400" />
				<LockOpen v-else class="w-3.5 h-3.5 text-muted-foreground" />
			</button>
		</div>
		<div class="pptx-vue-arrange-grid grid grid-cols-2 gap-2">
			<label class="pptx-vue-arrange-field flex flex-col gap-1">
				<span class="pptx-vue-arrange-label text-muted-foreground">X</span>
				<input
					type="number"
					class="pptx-vue-arrange-input bg-muted border border-border rounded px-2 py-1"
					:value="x"
					@input="onPos('x', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-arrange-field flex flex-col gap-1">
				<span class="pptx-vue-arrange-label text-muted-foreground">Y</span>
				<input
					type="number"
					class="pptx-vue-arrange-input bg-muted border border-border rounded px-2 py-1"
					:value="y"
					@input="onPos('y', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-arrange-field flex flex-col gap-1">
				<span class="pptx-vue-arrange-label text-muted-foreground">Width</span>
				<input
					type="number"
					class="pptx-vue-arrange-input bg-muted border border-border rounded px-2 py-1"
					:min="MIN_SIZE"
					:value="width"
					@input="onSize('width', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-arrange-field flex flex-col gap-1">
				<span class="pptx-vue-arrange-label text-muted-foreground">Height</span>
				<input
					type="number"
					class="pptx-vue-arrange-input bg-muted border border-border rounded px-2 py-1"
					:min="MIN_SIZE"
					:value="height"
					@input="onSize('height', ($event.target as HTMLInputElement).value)"
				/>
			</label>
		</div>

		<label class="pptx-vue-arrange-field flex flex-col gap-1">
			<span class="pptx-vue-arrange-label text-muted-foreground">Rotation</span>
			<input
				type="number"
				class="pptx-vue-arrange-input bg-muted border border-border rounded px-2 py-1"
				:value="rotation"
				@input="onRotation(($event.target as HTMLInputElement).value)"
			/>
		</label>

		<div class="pptx-vue-arrange-flips grid grid-cols-2 gap-2">
			<label class="pptx-vue-arrange-check inline-flex items-center gap-2 text-foreground">
				<input
					type="checkbox"
					:checked="flipHorizontal"
					@change="onFlipHorizontal(($event.target as HTMLInputElement).checked)"
				/>
				Flip Horizontally
			</label>
			<label class="pptx-vue-arrange-check inline-flex items-center gap-2 text-foreground">
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
