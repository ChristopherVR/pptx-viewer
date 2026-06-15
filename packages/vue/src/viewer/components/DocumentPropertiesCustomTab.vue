<script setup lang="ts">
import type { PptxCustomProperty } from 'pptx-viewer-core';

/** Available custom-property VT type options (text / number / date / yes-no). */
const CUSTOM_PROPERTY_TYPES: Array<{ value: string; label: string }> = [
	{ value: 'lpwstr', label: 'Text' },
	{ value: 'i4', label: 'Number' },
	{ value: 'filetime', label: 'Date' },
	{ value: 'bool', label: 'Yes/No' },
];

/**
 * DocumentPropertiesCustomTab — add/remove/edit user-defined custom properties.
 *
 * Vue counterpart of React's `DocumentPropertiesCustomTab`. Renders an editable
 * grid of name/value/type rows. Boolean-typed properties render a yes/no
 * dropdown; numeric types use a `number` input. The parent owns the draft
 * array — every mutation emits the full updated list.
 */
const props = defineProps<{
	/** Current draft list of custom properties. */
	customProperties: PptxCustomProperty[];
}>();

const emit = defineEmits<{
	/** Fired with the full updated list on any add/remove/edit. */
	(e: 'update', next: PptxCustomProperty[]): void;
}>();

function handleAdd(): void {
	emit('update', [...props.customProperties, { name: '', value: '', type: 'lpwstr' }]);
}

function handleDelete(index: number): void {
	emit(
		'update',
		props.customProperties.filter((_, i) => i !== index),
	);
}

function patchAt(index: number, patch: Partial<PptxCustomProperty>): void {
	emit(
		'update',
		props.customProperties.map((prop, i) => (i === index ? { ...prop, ...patch } : prop)),
	);
}

function onNameInput(index: number, event: Event): void {
	patchAt(index, { name: (event.target as HTMLInputElement).value });
}

function onValueInput(index: number, event: Event): void {
	patchAt(index, { value: (event.target as HTMLInputElement | HTMLSelectElement).value });
}

function onTypeInput(index: number, event: Event): void {
	patchAt(index, { type: (event.target as HTMLSelectElement).value });
}

function valueInputType(type: string): string {
	return type === 'i4' ? 'number' : 'text';
}
</script>

<template>
	<div class="pptx-vue-docprops-custom">
		<p class="pptx-vue-docprops-custom-desc">
			Custom properties let you store additional metadata with the presentation.
		</p>

		<div class="pptx-vue-docprops-custom-head">
			<span>Name</span>
			<span>Value</span>
			<span>Type</span>
			<span />
		</div>

		<div class="pptx-vue-docprops-custom-rows">
			<div
				v-for="(prop, index) in customProperties"
				:key="`custom-prop-${index}`"
				class="pptx-vue-docprops-custom-row"
			>
				<input
					type="text"
					class="pptx-vue-docprops-custom-input"
					placeholder="Name"
					:value="prop.name"
					@input="onNameInput(index, $event)"
				/>
				<select
					v-if="prop.type === 'bool'"
					class="pptx-vue-docprops-custom-input"
					:value="prop.value"
					@change="onValueInput(index, $event)"
				>
					<option value="true">Yes</option>
					<option value="false">No</option>
				</select>
				<input
					v-else
					:type="valueInputType(prop.type)"
					class="pptx-vue-docprops-custom-input"
					placeholder="Value"
					:value="prop.value"
					@input="onValueInput(index, $event)"
				/>
				<select
					class="pptx-vue-docprops-custom-input"
					:value="prop.type"
					@change="onTypeInput(index, $event)"
				>
					<option v-for="opt in CUSTOM_PROPERTY_TYPES" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
				<button
					type="button"
					class="pptx-vue-docprops-custom-delete"
					aria-label="Delete property"
					@click="handleDelete(index)"
				>
					&times;
				</button>
			</div>
		</div>

		<p v-if="customProperties.length === 0" class="pptx-vue-docprops-custom-empty">
			No custom properties yet.
		</p>

		<button type="button" class="pptx-vue-docprops-custom-add" @click="handleAdd">
			+ Add property
		</button>
	</div>
</template>

<style scoped>
.pptx-vue-docprops-custom {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.pptx-vue-docprops-custom-desc {
	margin: 0;
	font-size: 0.75rem;
	color: var(--pptx-vue-muted-foreground, #9a9a9a);
}

.pptx-vue-docprops-custom-head,
.pptx-vue-docprops-custom-row {
	display: grid;
	grid-template-columns: 1fr 1fr 100px 28px;
	gap: 0.25rem;
	align-items: center;
}

.pptx-vue-docprops-custom-head {
	font-size: 0.6875rem;
	font-weight: 500;
	color: var(--pptx-vue-muted-foreground, #9a9a9a);
	padding: 0 0.25rem;
}

.pptx-vue-docprops-custom-rows {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	max-height: 240px;
	overflow-y: auto;
}

.pptx-vue-docprops-custom-input {
	width: 100%;
	padding: 0.25rem 0.5rem;
	border-radius: 0.25rem;
	border: 1px solid var(--pptx-vue-border, #2a2a2a);
	background: var(--pptx-vue-muted, #1a1a1a);
	color: var(--pptx-vue-foreground, #e5e5e5);
	font-size: 0.75rem;
}

.pptx-vue-docprops-custom-input:focus {
	outline: none;
	border-color: var(--pptx-vue-primary, #6366f1);
	box-shadow: 0 0 0 1px var(--pptx-vue-primary, #6366f1);
}

.pptx-vue-docprops-custom-delete {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	font-size: 16px;
	line-height: 1;
	color: var(--pptx-vue-muted-foreground, #9a9a9a);
	background: transparent;
	border: none;
	border-radius: 0.25rem;
	cursor: pointer;
}

.pptx-vue-docprops-custom-delete:hover {
	color: #f87171;
	background: rgba(248, 113, 113, 0.15);
}

.pptx-vue-docprops-custom-empty {
	margin: 0;
	padding: 1rem 0;
	text-align: center;
	font-size: 0.75rem;
	color: var(--pptx-vue-muted-foreground, #777);
}

.pptx-vue-docprops-custom-add {
	align-self: flex-start;
	padding: 0.375rem 0.625rem;
	border-radius: 0.375rem;
	border: 1px solid var(--pptx-vue-border, #2a2a2a);
	background: transparent;
	color: var(--pptx-vue-foreground, #e5e5e5);
	font-size: 0.75rem;
	cursor: pointer;
}

.pptx-vue-docprops-custom-add:hover {
	background: var(--pptx-vue-muted, #1a1a1a);
}
</style>
