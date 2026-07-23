<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next';
import type { PptxCustomProperty } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

/** Available custom-property VT type options (text / number / date / yes-no). */
const CUSTOM_PROPERTY_TYPES: Array<{ value: string; labelKey: string }> = [
	{ value: 'lpwstr', labelKey: 'pptx.documentProperties.custom.typeText' },
	{ value: 'i4', labelKey: 'pptx.documentProperties.custom.typeNumber' },
	{ value: 'filetime', labelKey: 'pptx.documentProperties.custom.typeDate' },
	{ value: 'bool', labelKey: 'pptx.documentProperties.custom.typeYesNo' },
];

/**
 * DocumentPropertiesCustomTab: add/remove/edit user-defined custom properties.
 *
 * Vue counterpart of React's `DocumentPropertiesCustomTab`. Renders an editable
 * grid of name/value/type rows. Boolean-typed properties render a yes/no
 * dropdown; numeric types use a `number` input. The parent owns the draft
 * array; every mutation emits the full updated list.
 */
const props = defineProps<{
	/** Current draft list of custom properties. */
	customProperties: PptxCustomProperty[];
}>();

const emit = defineEmits<{
	/** Fired with the full updated list on any add/remove/edit. */
	(e: 'update', next: PptxCustomProperty[]): void;
}>();

const { t } = useI18n();

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
			{{ t('pptx.documentProperties.custom.description') }}
		</p>

		<div
			class="pptx-vue-docprops-custom-head grid grid-cols-[1fr_1fr_100px_32px] items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground"
		>
			<span>{{ t('pptx.documentProperties.custom.name') }}</span>
			<span>{{ t('pptx.documentProperties.custom.value') }}</span>
			<span>{{ t('pptx.documentProperties.custom.type') }}</span>
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
					:placeholder="t('pptx.documentProperties.custom.namePlaceholder')"
					:value="prop.name"
					@input="onNameInput(index, $event)"
				/>
				<select
					v-if="prop.type === 'bool'"
					class="pptx-vue-docprops-custom-input w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					:value="prop.value"
					@change="onValueInput(index, $event)"
				>
					<option value="true">{{ t('pptx.documentProperties.custom.yes') }}</option>
					<option value="false">{{ t('pptx.documentProperties.custom.no') }}</option>
				</select>
				<input
					v-else
					:type="valueInputType(prop.type)"
					class="pptx-vue-docprops-custom-input w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					:placeholder="t('pptx.documentProperties.custom.valuePlaceholder')"
					:value="prop.value"
					@input="onValueInput(index, $event)"
				/>
				<select
					class="pptx-vue-docprops-custom-input w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					:value="prop.type"
					@change="onTypeInput(index, $event)"
				>
					<option v-for="opt in CUSTOM_PROPERTY_TYPES" :key="opt.value" :value="opt.value">
						{{ t(opt.labelKey) }}
					</option>
				</select>
				<button
					type="button"
					class="pptx-vue-docprops-custom-delete inline-flex h-6 w-6 items-center justify-center rounded p-0 text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400"
					:aria-label="t('pptx.documentProperties.custom.deleteProperty')"
					@click="handleDelete(index)"
				>
					<Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</div>
		</div>

		<p
			v-if="customProperties.length === 0"
			class="pptx-vue-docprops-custom-empty py-4 text-center text-xs text-muted-foreground/60"
		>
			{{ t('pptx.documentProperties.custom.empty') }}
		</p>

		<button
			type="button"
			class="pptx-vue-docprops-custom-add inline-flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
			@click="handleAdd"
		>
			<Plus class="h-3.5 w-3.5" aria-hidden="true" />
			{{ t('pptx.documentProperties.custom.addProperty') }}
		</button>
	</div>
</template>
