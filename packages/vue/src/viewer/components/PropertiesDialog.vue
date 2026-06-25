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
 * PropertiesDialog - view and edit document core metadata.
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
		<div class="pptx-vue-props-form flex flex-col gap-3">
			<div class="pptx-vue-props-field flex flex-col gap-1.5">
				<label for="pptx-vue-props-title" class="pptx-vue-props-label text-xs text-foreground">
					Title
				</label>
				<input
					id="pptx-vue-props-title"
					v-model="title"
					type="text"
					class="pptx-vue-props-input w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				/>
			</div>

			<div class="pptx-vue-props-field flex flex-col gap-1.5">
				<label for="pptx-vue-props-creator" class="pptx-vue-props-label text-xs text-foreground">
					Author
				</label>
				<input
					id="pptx-vue-props-creator"
					v-model="creator"
					type="text"
					class="pptx-vue-props-input w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				/>
			</div>

			<div class="pptx-vue-props-field flex flex-col gap-1.5">
				<label for="pptx-vue-props-subject" class="pptx-vue-props-label text-xs text-foreground">
					Subject
				</label>
				<input
					id="pptx-vue-props-subject"
					v-model="subject"
					type="text"
					class="pptx-vue-props-input w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				/>
			</div>

			<div class="pptx-vue-props-field flex flex-col gap-1.5">
				<label for="pptx-vue-props-keywords" class="pptx-vue-props-label text-xs text-foreground">
					Keywords
				</label>
				<input
					id="pptx-vue-props-keywords"
					v-model="keywords"
					type="text"
					class="pptx-vue-props-input w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				/>
			</div>

			<div class="pptx-vue-props-meta flex flex-col gap-1.5 border-t border-border pt-2">
				<div class="pptx-vue-props-meta-row flex justify-between text-xs">
					<span class="pptx-vue-props-meta-label text-muted-foreground">Created</span>
					<span class="pptx-vue-props-meta-value text-foreground">
						{{ formatDate(properties.created) }}
					</span>
				</div>
				<div class="pptx-vue-props-meta-row flex justify-between text-xs">
					<span class="pptx-vue-props-meta-label text-muted-foreground">Modified</span>
					<span class="pptx-vue-props-meta-value text-foreground">
						{{ formatDate(properties.modified) }}
					</span>
				</div>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-props-btn rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
				@click="emit('close')"
			>
				Cancel
			</button>
			<button
				type="button"
				class="pptx-vue-props-btn pptx-vue-props-btn-primary rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/80"
				@click="handleSave"
			>
				Save
			</button>
		</template>
	</ModalDialog>
</template>
