<script setup lang="ts">
import type { PptxElement, ShapeStyle, StrokeDashType } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * StrokePanel — line/border inspector for the Vue `pptx-vue-viewer` editor.
 *
 * Exposes the three core stroke properties (`strokeColor`, `strokeWidth`,
 * `strokeDash`) read from `element.shapeStyle`. Each control emits a SHALLOW
 * `update` patch carrying the FULL merged `shapeStyle` sub-object so the parent
 * can forward it verbatim to `ops.updateElement(id, patch)`.
 *
 * Only shape-like elements (`hasShapeProperties`) expose editable controls;
 * other element types show a muted note instead.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const DASH_OPTIONS: ReadonlyArray<{ value: StrokeDashType; label: string }> = [
	{ value: 'solid', label: 'Solid' },
	{ value: 'dash', label: 'Dash' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'dashDot', label: 'Dash Dot' },
	{ value: 'sysDash', label: 'System Dash' },
	{ value: 'sysDot', label: 'System Dot' },
];

const applicable = computed(() => hasShapeProperties(props.element));

const shapeStyle = computed<ShapeStyle | undefined>(() =>
	hasShapeProperties(props.element) ? props.element.shapeStyle : undefined,
);

const strokeColor = computed<string>(() => shapeStyle.value?.strokeColor ?? '#000000');
const strokeWidth = computed<number>(() => shapeStyle.value?.strokeWidth ?? 1);
const strokeDash = computed<StrokeDashType>(() => shapeStyle.value?.strokeDash ?? 'solid');

function patchShapeStyle(next: Partial<ShapeStyle>): void {
	emit('update', { shapeStyle: { ...shapeStyle.value, ...next } } as Partial<PptxElement>);
}

function onColor(event: Event): void {
	patchShapeStyle({ strokeColor: (event.target as HTMLInputElement).value });
}

function onWidth(event: Event): void {
	const raw = Number.parseFloat((event.target as HTMLInputElement).value);
	patchShapeStyle({ strokeWidth: Number.isFinite(raw) ? Math.max(0, raw) : 0 });
}

function onDash(event: Event): void {
	patchShapeStyle({ strokeDash: (event.target as HTMLSelectElement).value as StrokeDashType });
}
</script>

<template>
	<div class="pptx-vue-stroke-panel">
		<h3 class="pptx-vue-stroke-title">Line</h3>

		<p v-if="!applicable" class="pptx-vue-stroke-muted">This element has no border properties.</p>

		<div v-else class="pptx-vue-stroke-fields">
			<label class="pptx-vue-stroke-field">
				<span class="pptx-vue-stroke-label">Color</span>
				<input type="color" class="pptx-vue-stroke-color" :value="strokeColor" @input="onColor" />
			</label>

			<label class="pptx-vue-stroke-field">
				<span class="pptx-vue-stroke-label">Width (px)</span>
				<input
					type="number"
					class="pptx-vue-stroke-input"
					min="0"
					step="0.5"
					:value="strokeWidth"
					@input="onWidth"
				/>
			</label>

			<label class="pptx-vue-stroke-field">
				<span class="pptx-vue-stroke-label">Dash</span>
				<select class="pptx-vue-stroke-input" :value="strokeDash" @change="onDash">
					<option v-for="opt in DASH_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-stroke-panel {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 0.5rem;
}

.pptx-vue-stroke-title {
	margin: 0;
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	opacity: 0.7;
}

.pptx-vue-stroke-muted {
	margin: 0;
	font-size: 0.75rem;
	opacity: 0.6;
}

.pptx-vue-stroke-fields {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.pptx-vue-stroke-field {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.pptx-vue-stroke-label {
	font-size: 0.7rem;
	opacity: 0.7;
}

.pptx-vue-stroke-input,
.pptx-vue-stroke-color {
	width: 100%;
	box-sizing: border-box;
	font: inherit;
	padding: 0.25rem 0.4rem;
	border: 1px solid rgba(0, 0, 0, 0.2);
	border-radius: 0.25rem;
	background: transparent;
}

.pptx-vue-stroke-color {
	height: 2rem;
	padding: 0.1rem;
}
</style>
