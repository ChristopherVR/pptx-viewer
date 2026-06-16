<script setup lang="ts">
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * FillPanel — shape fill controls (mode, solid colour, opacity).
 *
 * Only meaningful for shape-like elements (`hasShapeProperties`). When the
 * element has no shape properties a muted "No fill options" note is shown.
 *
 * Emits the FULL merged `shapeStyle` sub-object as a shallow patch:
 * `{ shapeStyle: { ...current, fillMode, fillColor, fillOpacity } }`.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

type FillMode = 'none' | 'solid' | 'gradient';

const applicable = computed(() => hasShapeProperties(props.element));

const currentStyle = computed<ShapeStyle>(() =>
	hasShapeProperties(props.element) ? (props.element.shapeStyle ?? {}) : {},
);

const fillMode = computed<FillMode>(() => {
	const mode = currentStyle.value.fillMode;
	return mode === 'gradient' || mode === 'none' ? mode : 'solid';
});

const fillColor = computed(() => currentStyle.value.fillColor ?? '#ffffff');

const fillOpacityPercent = computed(() => {
	const raw = currentStyle.value.fillOpacity ?? 1;
	return Math.round(raw * 100);
});

function patchStyle(patch: Partial<ShapeStyle>): void {
	emit('update', {
		shapeStyle: { ...currentStyle.value, ...patch },
	} as Partial<PptxElement>);
}

function onMode(value: string): void {
	patchStyle({ fillMode: value as FillMode });
}

function onColor(value: string): void {
	patchStyle({ fillColor: value });
}

function onOpacity(value: string): void {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return;
	}
	const clamped = Math.min(100, Math.max(0, n));
	patchStyle({ fillOpacity: clamped / 100 });
}
</script>

<template>
	<div class="pptx-vue-fill flex flex-col gap-2 text-xs">
		<p v-if="!applicable" class="pptx-vue-fill-note text-muted-foreground italic">
			No fill options
		</p>

		<template v-else>
			<label class="pptx-vue-fill-field flex flex-col gap-1">
				<span class="pptx-vue-fill-label text-muted-foreground">Fill</span>
				<select
					class="pptx-vue-fill-select bg-muted border border-border rounded px-2 py-1"
					:value="fillMode"
					@change="onMode(($event.target as HTMLSelectElement).value)"
				>
					<option value="none">None</option>
					<option value="solid">Solid</option>
					<option value="gradient">Gradient</option>
				</select>
			</label>

			<label v-if="fillMode === 'solid'" class="pptx-vue-fill-field flex flex-col gap-1">
				<span class="pptx-vue-fill-label text-muted-foreground">Color</span>
				<input
					type="color"
					class="pptx-vue-fill-color w-full h-8 p-0 bg-muted border border-border rounded"
					:value="fillColor"
					@input="onColor(($event.target as HTMLInputElement).value)"
				/>
			</label>

			<label v-if="fillMode === 'solid'" class="pptx-vue-fill-field flex flex-col gap-1">
				<span class="pptx-vue-fill-label text-muted-foreground"
					>Opacity ({{ fillOpacityPercent }}%)</span
				>
				<input
					type="range"
					class="pptx-vue-fill-range w-full accent-primary"
					min="0"
					max="100"
					:value="fillOpacityPercent"
					@input="onOpacity(($event.target as HTMLInputElement).value)"
				/>
			</label>
		</template>
	</div>
</template>
