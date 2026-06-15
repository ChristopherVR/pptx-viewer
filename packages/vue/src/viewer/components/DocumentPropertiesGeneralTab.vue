<script setup lang="ts">
import type { PptxCoreProperties } from 'pptx-viewer-core';

/**
 * Editable core-property keys surfaced on the General tab. `manager` and
 * `company` live on `PptxAppProperties`, not `PptxCoreProperties`, so they are
 * handled by their own model props below.
 */
export type GeneralCoreKey =
	| 'title'
	| 'subject'
	| 'creator'
	| 'keywords'
	| 'description'
	| 'category';

interface GeneralField {
	key: GeneralCoreKey;
	label: string;
	multiline?: boolean;
}

const CORE_FIELDS: GeneralField[] = [
	{ key: 'title', label: 'Title' },
	{ key: 'subject', label: 'Subject' },
	{ key: 'creator', label: 'Author' },
	{ key: 'keywords', label: 'Keywords' },
	{ key: 'description', label: 'Comments', multiline: true },
	{ key: 'category', label: 'Category' },
];

/**
 * DocumentPropertiesGeneralTab — the editable metadata tab.
 *
 * Edits the core-property fields (title/subject/author/keywords/comments/
 * category) plus the app-level manager/company. The parent owns the draft
 * state; this tab is a controlled form that emits granular field updates.
 */
const props = defineProps<{
	/** Draft core properties (controlled by the parent dialog). */
	core: PptxCoreProperties;
	/** Draft manager (app property). */
	manager: string;
	/** Draft company (app property). */
	company: string;
}>();

const emit = defineEmits<{
	/** Fired when a core-property field changes. */
	(e: 'update-core', key: GeneralCoreKey, value: string): void;
	/** Fired when the manager or company field changes. */
	(e: 'update-manager' | 'update-company', value: string): void;
}>();

function coreValue(key: GeneralCoreKey): string {
	return props.core[key] ?? '';
}

function onCoreInput(key: GeneralCoreKey, event: Event): void {
	const target = event.target as HTMLInputElement | HTMLTextAreaElement;
	emit('update-core', key, target.value);
}

function onManagerInput(event: Event): void {
	emit('update-manager', (event.target as HTMLInputElement).value);
}

function onCompanyInput(event: Event): void {
	emit('update-company', (event.target as HTMLInputElement).value);
}
</script>

<template>
	<div class="pptx-vue-docprops-general">
		<div v-for="field in CORE_FIELDS" :key="field.key" class="pptx-vue-docprops-field">
			<label :for="`pptx-vue-docprops-${field.key}`" class="pptx-vue-docprops-label">
				{{ field.label }}
			</label>
			<textarea
				v-if="field.multiline"
				:id="`pptx-vue-docprops-${field.key}`"
				class="pptx-vue-docprops-input pptx-vue-docprops-textarea"
				rows="3"
				:value="coreValue(field.key)"
				@input="onCoreInput(field.key, $event)"
			/>
			<input
				v-else
				:id="`pptx-vue-docprops-${field.key}`"
				type="text"
				class="pptx-vue-docprops-input"
				:value="coreValue(field.key)"
				@input="onCoreInput(field.key, $event)"
			/>
		</div>

		<div class="pptx-vue-docprops-field">
			<label for="pptx-vue-docprops-manager" class="pptx-vue-docprops-label">Manager</label>
			<input
				id="pptx-vue-docprops-manager"
				type="text"
				class="pptx-vue-docprops-input"
				:value="manager"
				@input="onManagerInput"
			/>
		</div>

		<div class="pptx-vue-docprops-field">
			<label for="pptx-vue-docprops-company" class="pptx-vue-docprops-label">Company</label>
			<input
				id="pptx-vue-docprops-company"
				type="text"
				class="pptx-vue-docprops-input"
				:value="company"
				@input="onCompanyInput"
			/>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-docprops-general {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.pptx-vue-docprops-field {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.pptx-vue-docprops-label {
	font-size: 0.75rem;
	font-weight: 500;
	color: var(--pptx-vue-foreground, #e5e5e5);
}

.pptx-vue-docprops-input {
	width: 100%;
	padding: 0.375rem 0.75rem;
	border-radius: 0.375rem;
	border: 1px solid var(--pptx-vue-border, #2a2a2a);
	background: var(--pptx-vue-muted, #1a1a1a);
	color: var(--pptx-vue-foreground, #e5e5e5);
	font-size: 0.8125rem;
}

.pptx-vue-docprops-input:focus {
	outline: none;
	border-color: var(--pptx-vue-primary, #6366f1);
	box-shadow: 0 0 0 1px var(--pptx-vue-primary, #6366f1);
}

.pptx-vue-docprops-textarea {
	resize: vertical;
	font-family: inherit;
}
</style>
