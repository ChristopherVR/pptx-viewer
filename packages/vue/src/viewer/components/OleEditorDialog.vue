<script setup lang="ts">
/**
 * "Edit content" dialog for an embedded OLE object: a spreadsheet grid,
 * document paragraph list, or nested-deck slide title list depending on
 * the payload kind (`buildOleEditDialogDescriptor`), plus a Replace File
 * action always available regardless of kind.
 *
 * Vue port of React's `OleEditorDialog.tsx`. Every edit commits through the
 * same core `ole-edit-api.ts` functions every other binding calls, and the
 * same `update` patch event every other inspector field already emits, so
 * undo/history/collaboration sync works exactly like a typed-field edit.
 */
import type {
	OleNestedDeckSlideDetail,
	OlePptxElement,
	OleSheetGrid,
	PptxElement,
} from 'pptx-viewer-core';
import {
	applyOleDocumentParagraphEdit,
	applyOleNestedDeckElementTextEdit,
	applyOleSheetCellEdit,
	getOleDocumentParagraphs,
	getOleNestedDeckDetail,
	getOleSheetGrid,
	replaceOleFile,
} from 'pptx-viewer-core';
import { buildOleContentUpdatePatch, buildOleEditDialogDescriptor } from 'pptx-viewer-shared';
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';
import OleDeckEditor from './OleDeckEditor.vue';
import OleDocumentEditor from './OleDocumentEditor.vue';
import OleSheetGridEditor from './OleSheetGridEditor.vue';

const props = defineProps<{
	/** Whether the dialog is open. */
	open: boolean;
	/** The OLE element being edited. */
	element: OlePptxElement;
}>();

const emit = defineEmits<{
	(e: 'update', patch: Partial<PptxElement>): void;
	(e: 'close'): void;
}>();

const { t } = useI18n();

const descriptor = computed(() => buildOleEditDialogDescriptor(props.element));

const grid = ref<OleSheetGrid | undefined>(undefined);
const paragraphs = ref<string[] | undefined>(undefined);
const deckSlides = ref<OleNestedDeckSlideDetail[] | undefined>(undefined);
const loading = ref(false);
const saveError = ref(false);
const fileInput = useTemplateRef<HTMLInputElement>('fileInput');

// The edit handlers below settle after their own awaits (a re-encode or a
// full deck save/load round-trip), which can outlive the component if it is
// unmounted first. Guard every post-await write with this so a late
// resolution never touches state of a component that is gone.
let active = true;
onUnmounted(() => {
	active = false;
});

function close(): void {
	emit('close');
}

/** Re-fetch the content-tab data whenever the dialog opens or the target element changes. */
watch(
	[() => props.open, () => props.element],
	async ([isOpen, element]) => {
		const tab = buildOleEditDialogDescriptor(element).contentTab;
		if (!isOpen || !tab) {
			return;
		}
		loading.value = true;
		const kind = tab.kind;
		if (kind === 'sheet') {
			grid.value = await getOleSheetGrid(element);
		} else if (kind === 'document') {
			paragraphs.value = await getOleDocumentParagraphs(element);
		} else if (kind === 'deck') {
			deckSlides.value = await getOleNestedDeckDetail(element);
		}
		loading.value = false;
	},
	{ immediate: true },
);

function commit(updated: OlePptxElement): void {
	if (!updated.oleContentDirty) {
		return;
	}
	emit('update', buildOleContentUpdatePatch(updated) as Partial<PptxElement>);
}

async function handleCellEdit(row: number, col: number, value: string): Promise<void> {
	try {
		const updated = await applyOleSheetCellEdit(props.element, { row, col, value });
		commit(updated);
		const refreshed = await getOleSheetGrid(updated);
		if (active) {
			grid.value = refreshed;
		}
	} catch {
		if (active) {
			saveError.value = true;
		}
	}
}

async function handleParagraphEdit(index: number, text: string): Promise<void> {
	try {
		const updated = await applyOleDocumentParagraphEdit(props.element, index, text);
		commit(updated);
		const refreshed = await getOleDocumentParagraphs(updated);
		if (active) {
			paragraphs.value = refreshed;
		}
	} catch {
		if (active) {
			saveError.value = true;
		}
	}
}

async function handleDeckElementEdit(
	slideIndex: number,
	elementId: string,
	text: string,
): Promise<void> {
	try {
		const updated = await applyOleNestedDeckElementTextEdit(
			props.element,
			slideIndex,
			elementId,
			text,
		);
		commit(updated);
		const refreshed = await getOleNestedDeckDetail(updated);
		if (active) {
			deckSlides.value = refreshed;
		}
	} catch {
		if (active) {
			saveError.value = true;
		}
	}
}

async function handleReplaceFile(file: File): Promise<void> {
	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const updated = await replaceOleFile(props.element, bytes, file.name);
		commit(updated);
		if (active) {
			close();
		}
	} catch {
		if (active) {
			saveError.value = true;
		}
	}
}

function onFileChange(event: Event): void {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (file) {
		void handleReplaceFile(file);
	}
}
</script>

<template>
	<ModalDialog :open="props.open" :title="t(descriptor.titleKey)" @close="close">
		<div class="flex w-[min(90vw,520px)] flex-col gap-3 text-sm">
			<p v-if="loading" class="text-xs text-muted-foreground">
				{{ t('pptx.ole.editDialog.loading') }}
			</p>
			<p v-if="saveError" class="text-xs text-destructive">
				{{ t('pptx.ole.editDialog.saveError') }}
			</p>

			<template v-if="!loading">
				<OleSheetGridEditor
					v-if="descriptor.contentTab?.kind === 'sheet'"
					:grid="grid"
					@cell-edit="handleCellEdit"
				/>
				<OleDocumentEditor
					v-else-if="descriptor.contentTab?.kind === 'document'"
					:paragraphs="paragraphs"
					@edit="handleParagraphEdit"
				/>
				<OleDeckEditor
					v-else-if="descriptor.contentTab?.kind === 'deck'"
					:slides="deckSlides"
					@edit="handleDeckElementEdit"
				/>
				<p v-else class="text-xs text-muted-foreground">
					{{ t('pptx.ole.editDialog.unsupported') }}
				</p>
			</template>
		</div>

		<template #footer>
			<input ref="fileInput" type="file" class="hidden" @change="onFileChange" />
			<button
				type="button"
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
				@click="fileInput?.click()"
			>
				{{ t('pptx.ole.editDialog.replaceFile') }}
			</button>
			<button
				type="button"
				class="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/80"
				@click="close"
			>
				{{ t('pptx.ole.editDialog.save') }}
			</button>
		</template>
	</ModalDialog>
</template>
