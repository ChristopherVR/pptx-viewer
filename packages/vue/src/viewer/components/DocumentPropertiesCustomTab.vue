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
	<div class="pptx-vue-docprops-custom flex flex-col gap-3">
		<p class="pptx-vue-docprops-custom-desc text-xs text-muted-foreground">
			Custom properties let you store additional metadata with the presentation.
		</p>

		<div
			class="pptx-vue-docprops-custom-head grid grid-cols-[1fr_1fr_100px_32px] items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground"
		>
			<span>Name</span>
			<span>Value</span>
			<span>Type</span>
			<span />
		</div>

		<div class="pptx-vue-docprops-custom-rows flex max-h-[240px] flex-col gap-1 overflow-y-auto">
			<div
				v-for="(prop, index) in customProperties"
				:key="`custom-prop-${index}`"
				class="pptx-vue-docprops-custom-row grid grid-cols-[1fr_1fr_100px_32px] items-center gap-1"
			>
				<input
					type="text"
					class="pptx-vue-docprops-custom-input w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					placeholder="Name"
					:value="prop.name"
					@input="onNameInput(index, $event)"
				/>
				<select
					v-if="prop.type === 'bool'"
					class="pptx-vue-docprops-custom-input w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					:value="prop.value"
					@change="onValueInput(index, $event)"
				>
					<option value="true">Yes</option>
					<option value="false">No</option>
				</select>
				<input
					v-else
					:type="valueInputType(prop.type)"
					class="pptx-vue-docprops-custom-input w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					placeholder="Value"
					:value="prop.value"
					@input="onValueInput(index, $event)"
				/>
				<select
					class="pptx-vue-docprops-custom-input w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					:value="prop.type"
					@change="onTypeInput(index, $event)"
				>
					<option v-for="opt in CUSTOM_PROPERTY_TYPES" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
				<button
					type="button"
					class="pptx-vue-docprops-custom-delete inline-flex h-6 w-6 items-center justify-center rounded p-0 text-base leading-none text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400"
					aria-label="Delete property"
					@click="handleDelete(index)"
				>
					&times;
				</button>
			</div>
		</div>

		<p
			v-if="customProperties.length === 0"
			class="pptx-vue-docprops-custom-empty py-4 text-center text-xs text-muted-foreground/60"
		>
			No custom properties yet.
		</p>

		<button
			type="button"
			class="pptx-vue-docprops-custom-add inline-flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
			@click="handleAdd"
		>
			+ Add property
		</button>
	</div>
</template>
