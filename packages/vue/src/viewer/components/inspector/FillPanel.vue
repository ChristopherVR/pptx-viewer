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
	<div class="pptx-vue-fill">
		<p v-if="!applicable" class="pptx-vue-fill-note">No fill options</p>

		<template v-else>
			<label class="pptx-vue-fill-field">
				<span class="pptx-vue-fill-label">Fill</span>
				<select
					class="pptx-vue-fill-select"
					:value="fillMode"
					@change="onMode(($event.target as HTMLSelectElement).value)"
				>
					<option value="none">None</option>
					<option value="solid">Solid</option>
					<option value="gradient">Gradient</option>
				</select>
			</label>

			<label v-if="fillMode === 'solid'" class="pptx-vue-fill-field">
				<span class="pptx-vue-fill-label">Color</span>
				<input
					type="color"
					class="pptx-vue-fill-color"
					:value="fillColor"
					@input="onColor(($event.target as HTMLInputElement).value)"
				/>
			</label>

			<label v-if="fillMode === 'solid'" class="pptx-vue-fill-field">
				<span class="pptx-vue-fill-label">Opacity ({{ fillOpacityPercent }}%)</span>
				<input
					type="range"
					class="pptx-vue-fill-range"
					min="0"
					max="100"
					:value="fillOpacityPercent"
					@input="onOpacity(($event.target as HTMLInputElement).value)"
				/>
			</label>
		</template>
	</div>
</template>

<style scoped>
.pptx-vue-fill {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	font-size: 0.75rem;
}

.pptx-vue-fill-note {
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-style: italic;
}

.pptx-vue-fill-field {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.pptx-vue-fill-label {
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-fill-select {
	border: 1px solid var(--pptx-vue-border, #d1d5db);
	border-radius: 0.25rem;
	padding: 0.25rem 0.5rem;
	background: var(--pptx-vue-muted, #f3f4f6);
	color: inherit;
}

.pptx-vue-fill-color {
	width: 100%;
	height: 2rem;
	padding: 0;
	border: 1px solid var(--pptx-vue-border, #d1d5db);
	border-radius: 0.25rem;
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-fill-range {
	width: 100%;
}
</style>
