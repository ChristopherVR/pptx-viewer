<script setup lang="ts">
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * TextPanel — typography inspector for the Vue `pptx-vue-viewer` editor.
 *
 * Exposes character/paragraph formatting (`fontFamily`, `fontSize`, `bold`,
 * `italic`, `underline`, `strikethrough`, `color`, `align`, `vAlign`) read from
 * `element.textStyle`. Each control emits a SHALLOW `update` patch carrying the
 * FULL merged `textStyle` sub-object so the parent can forward it verbatim to
 * `ops.updateElement(id, patch)`.
 *
 * Only text-bearing elements (`hasTextProperties`) expose editable controls;
 * other element types show a muted note instead.
 */
type AlignValue = NonNullable<TextStyle['align']>;
type VAlignValue = NonNullable<TextStyle['vAlign']>;

const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const FONT_OPTIONS: ReadonlyArray<string> = [
	'Arial',
	'Calibri',
	'Cambria',
	'Georgia',
	'Times New Roman',
	'Trebuchet MS',
	'Verdana',
];

const ALIGN_OPTIONS: ReadonlyArray<{ value: AlignValue; label: string }> = [
	{ value: 'left', label: 'Left' },
	{ value: 'center', label: 'Center' },
	{ value: 'right', label: 'Right' },
	{ value: 'justify', label: 'Justify' },
];

const VALIGN_OPTIONS: ReadonlyArray<{ value: VAlignValue; label: string }> = [
	{ value: 'top', label: 'Top' },
	{ value: 'middle', label: 'Middle' },
	{ value: 'bottom', label: 'Bottom' },
];

const TOGGLES: ReadonlyArray<{
	key: 'bold' | 'italic' | 'underline' | 'strikethrough';
	label: string;
}> = [
	{ key: 'bold', label: 'B' },
	{ key: 'italic', label: 'I' },
	{ key: 'underline', label: 'U' },
	{ key: 'strikethrough', label: 'S' },
];

const applicable = computed(() => hasTextProperties(props.element));

const textStyle = computed<TextStyle | undefined>(() =>
	hasTextProperties(props.element) ? props.element.textStyle : undefined,
);

const fontFamily = computed<string>(() => textStyle.value?.fontFamily ?? '');
const fontSize = computed<number>(() => textStyle.value?.fontSize ?? 18);
const color = computed<string>(() => textStyle.value?.color ?? '#000000');
const align = computed<AlignValue | undefined>(() => textStyle.value?.align);
const vAlign = computed<VAlignValue | undefined>(() => textStyle.value?.vAlign);

function patchTextStyle(next: Partial<TextStyle>): void {
	emit('update', { textStyle: { ...textStyle.value, ...next } } as Partial<PptxElement>);
}

function onFontFamily(event: Event): void {
	const value = (event.target as HTMLSelectElement).value;
	patchTextStyle({ fontFamily: value.length > 0 ? value : undefined });
}

function onFontSize(event: Event): void {
	const raw = Number.parseFloat((event.target as HTMLInputElement).value);
	patchTextStyle({ fontSize: Number.isFinite(raw) ? Math.max(1, raw) : 1 });
}

function onColor(event: Event): void {
	patchTextStyle({ color: (event.target as HTMLInputElement).value });
}

function toggle(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
	patchTextStyle({ [key]: !textStyle.value?.[key] });
}

function isActive(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): boolean {
	return Boolean(textStyle.value?.[key]);
}

function setAlign(value: AlignValue): void {
	patchTextStyle({ align: value });
}

function setVAlign(value: VAlignValue): void {
	patchTextStyle({ vAlign: value });
}
</script>

<template>
	<div class="pptx-vue-text-panel">
		<h3 class="pptx-vue-text-title">Text</h3>

		<p v-if="!applicable" class="pptx-vue-text-muted">This element has no text properties.</p>

		<div v-else class="pptx-vue-text-fields">
			<label class="pptx-vue-text-field">
				<span class="pptx-vue-text-label">Font</span>
				<select class="pptx-vue-text-input" :value="fontFamily" @change="onFontFamily">
					<option value="">Default</option>
					<option v-for="font in FONT_OPTIONS" :key="font" :value="font">
						{{ font }}
					</option>
					<option v-if="fontFamily && !FONT_OPTIONS.includes(fontFamily)" :value="fontFamily">
						{{ fontFamily }}
					</option>
				</select>
			</label>

			<div class="pptx-vue-text-row">
				<label class="pptx-vue-text-field">
					<span class="pptx-vue-text-label">Size (pt)</span>
					<input
						type="number"
						class="pptx-vue-text-input"
						min="1"
						step="1"
						:value="fontSize"
						@input="onFontSize"
					/>
				</label>
				<label class="pptx-vue-text-field">
					<span class="pptx-vue-text-label">Color</span>
					<input type="color" class="pptx-vue-text-color" :value="color" @input="onColor" />
				</label>
			</div>

			<div class="pptx-vue-text-field">
				<span class="pptx-vue-text-label">Style</span>
				<div class="pptx-vue-text-toggles">
					<button
						v-for="t in TOGGLES"
						:key="t.key"
						type="button"
						class="pptx-vue-text-toggle"
						:class="{ 'pptx-vue-text-toggle-active': isActive(t.key) }"
						:aria-pressed="isActive(t.key)"
						:title="t.key"
						@click="toggle(t.key)"
					>
						{{ t.label }}
					</button>
				</div>
			</div>

			<div class="pptx-vue-text-field">
				<span class="pptx-vue-text-label">Horizontal Align</span>
				<div class="pptx-vue-text-toggles">
					<button
						v-for="opt in ALIGN_OPTIONS"
						:key="opt.value"
						type="button"
						class="pptx-vue-text-toggle"
						:class="{ 'pptx-vue-text-toggle-active': align === opt.value }"
						:aria-pressed="align === opt.value"
						:title="opt.value"
						@click="setAlign(opt.value)"
					>
						{{ opt.label }}
					</button>
				</div>
			</div>

			<div class="pptx-vue-text-field">
				<span class="pptx-vue-text-label">Vertical Align</span>
				<div class="pptx-vue-text-toggles">
					<button
						v-for="opt in VALIGN_OPTIONS"
						:key="opt.value"
						type="button"
						class="pptx-vue-text-toggle"
						:class="{ 'pptx-vue-text-toggle-active': vAlign === opt.value }"
						:aria-pressed="vAlign === opt.value"
						:title="opt.value"
						@click="setVAlign(opt.value)"
					>
						{{ opt.label }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-text-panel {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 0.5rem;
}

.pptx-vue-text-title {
	margin: 0;
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	opacity: 0.7;
}

.pptx-vue-text-muted {
	margin: 0;
	font-size: 0.75rem;
	opacity: 0.6;
}

.pptx-vue-text-fields {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.pptx-vue-text-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.5rem;
}

.pptx-vue-text-field {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.pptx-vue-text-label {
	font-size: 0.7rem;
	opacity: 0.7;
}

.pptx-vue-text-input,
.pptx-vue-text-color {
	width: 100%;
	box-sizing: border-box;
	font: inherit;
	padding: 0.25rem 0.4rem;
	border: 1px solid rgba(0, 0, 0, 0.2);
	border-radius: 0.25rem;
	background: transparent;
}

.pptx-vue-text-color {
	height: 2rem;
	padding: 0.1rem;
}

.pptx-vue-text-toggles {
	display: flex;
	flex-wrap: wrap;
	gap: 0.25rem;
}

.pptx-vue-text-toggle {
	min-width: 2rem;
	padding: 0.25rem 0.5rem;
	font: inherit;
	cursor: pointer;
	border: 1px solid rgba(0, 0, 0, 0.2);
	border-radius: 0.25rem;
	background: transparent;
}

.pptx-vue-text-toggle-active {
	background: rgba(59, 130, 246, 0.2);
	border-color: rgba(59, 130, 246, 0.6);
	font-weight: 600;
}
</style>
