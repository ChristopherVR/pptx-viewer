<script setup lang="ts">
import type { PptxCoreProperties } from 'pptx-viewer-core';
import { ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';

/**
 * Subset of {@link PptxCoreProperties} surfaced by the Properties dialog. It
 * is exactly the core-properties shape, narrowed to the fields the editor
 * shows: editable metadata (title/creator/subject/keywords) and read-only
 * timestamps (created/modified).
 */
export type DocumentProperties = Pick<
	PptxCoreProperties,
	'title' | 'creator' | 'subject' | 'keywords' | 'created' | 'modified'
>;

/**
 * PropertiesDialog — view and edit document core metadata.
 *
 * Editable: title, author (`creator`), subject, keywords. Read-only:
 * `created` / `modified` timestamps. Edits are held in a local draft and only
 * committed via the `save` emit, which carries a `Partial<PptxCoreProperties>`
 * of the changed fields.
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Current document metadata. */
	properties: DocumentProperties;
}>();

const emit = defineEmits<{
	/** Fired with the edited fields when the user saves. */
	(e: 'save', properties: Partial<PptxCoreProperties>): void;
	/** Fired when the dialog is dismissed. */
	(e: 'close'): void;
}>();

const title = ref('');
const creator = ref('');
const subject = ref('');
const keywords = ref('');

function seedFromProps(): void {
	title.value = props.properties.title ?? '';
	creator.value = props.properties.creator ?? '';
	subject.value = props.properties.subject ?? '';
	keywords.value = props.properties.keywords ?? '';
}

// Re-seed the draft whenever the dialog (re)opens or the source changes.
watch(
	() => props.open,
	(open) => {
		if (open) {
			seedFromProps();
		}
	},
	{ immediate: true },
);

function formatDate(value: string | undefined): string {
	if (!value) {
		return '—';
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function handleSave(): void {
	const next: Partial<PptxCoreProperties> = {};
	if (title.value !== (props.properties.title ?? '')) {
		next.title = title.value;
	}
	if (creator.value !== (props.properties.creator ?? '')) {
		next.creator = creator.value;
	}
	if (subject.value !== (props.properties.subject ?? '')) {
		next.subject = subject.value;
	}
	if (keywords.value !== (props.properties.keywords ?? '')) {
		next.keywords = keywords.value;
	}
	emit('save', next);
}
</script>

<template>
	<ModalDialog :open="open" title="Document properties" @close="emit('close')">
		<div class="pptx-vue-props-form">
			<div class="pptx-vue-props-field">
				<label for="pptx-vue-props-title" class="pptx-vue-props-label">Title</label>
				<input id="pptx-vue-props-title" v-model="title" type="text" class="pptx-vue-props-input" />
			</div>

			<div class="pptx-vue-props-field">
				<label for="pptx-vue-props-creator" class="pptx-vue-props-label">Author</label>
				<input
					id="pptx-vue-props-creator"
					v-model="creator"
					type="text"
					class="pptx-vue-props-input"
				/>
			</div>

			<div class="pptx-vue-props-field">
				<label for="pptx-vue-props-subject" class="pptx-vue-props-label">Subject</label>
				<input
					id="pptx-vue-props-subject"
					v-model="subject"
					type="text"
					class="pptx-vue-props-input"
				/>
			</div>

			<div class="pptx-vue-props-field">
				<label for="pptx-vue-props-keywords" class="pptx-vue-props-label">Keywords</label>
				<input
					id="pptx-vue-props-keywords"
					v-model="keywords"
					type="text"
					class="pptx-vue-props-input"
				/>
			</div>

			<div class="pptx-vue-props-meta">
				<div class="pptx-vue-props-meta-row">
					<span class="pptx-vue-props-meta-label">Created</span>
					<span class="pptx-vue-props-meta-value">{{ formatDate(properties.created) }}</span>
				</div>
				<div class="pptx-vue-props-meta-row">
					<span class="pptx-vue-props-meta-label">Modified</span>
					<span class="pptx-vue-props-meta-value">{{ formatDate(properties.modified) }}</span>
				</div>
			</div>
		</div>

		<template #footer>
			<button type="button" class="pptx-vue-props-btn" @click="emit('close')">Cancel</button>
			<button
				type="button"
				class="pptx-vue-props-btn pptx-vue-props-btn-primary"
				@click="handleSave"
			>
				Save
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-props-form {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.pptx-vue-props-field {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.pptx-vue-props-label {
	font-size: 0.75rem;
	font-weight: 500;
	color: var(--pptx-foreground, #e5e5e5);
}

.pptx-vue-props-input {
	width: 100%;
	padding: 0.375rem 0.75rem;
	border-radius: 0.375rem;
	border: 1px solid var(--pptx-border, #2a2a2a);
	background: var(--pptx-background, #111);
	color: var(--pptx-foreground, #e5e5e5);
	font-size: 0.8125rem;
}

.pptx-vue-props-input:focus {
	outline: none;
	border-color: var(--pptx-primary, #6366f1);
	box-shadow: 0 0 0 1px var(--pptx-primary, #6366f1);
}

.pptx-vue-props-meta {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	padding-top: 0.5rem;
	border-top: 1px solid var(--pptx-border, #2a2a2a);
}

.pptx-vue-props-meta-row {
	display: flex;
	justify-content: space-between;
	font-size: 0.75rem;
}

.pptx-vue-props-meta-label {
	color: var(--pptx-muted-foreground, #9a9a9a);
}

.pptx-vue-props-meta-value {
	color: var(--pptx-foreground, #e5e5e5);
}

.pptx-vue-props-btn {
	padding: 0.375rem 0.75rem;
	border: none;
	border-radius: 0.375rem;
	background: var(--pptx-muted, #2a2a2a);
	color: var(--pptx-foreground, #e5e5e5);
	font-size: 0.75rem;
	cursor: pointer;
}

.pptx-vue-props-btn-primary {
	background: var(--pptx-primary, #6366f1);
	color: var(--pptx-primary-foreground, #fff);
}
</style>
