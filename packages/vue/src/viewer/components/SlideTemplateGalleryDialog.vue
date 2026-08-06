<script setup lang="ts">
import { SLIDE_TEMPLATES } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';
import SlideTemplatePreview from './SlideTemplatePreview.vue';

/**
 * SlideTemplateGalleryDialog - the New Slide template gallery.
 *
 * Vue port of React's `SlideTemplateGalleryDialog.tsx`, built on
 * {@link ModalDialog}. Presents the shared slide-template catalogue as a grid
 * of live-rendered previews (`SlideTemplatePreview.vue`). Single click
 * selects, double click or the Insert button emits `insert` with the chosen
 * template id; the host routes the payload to its history-integrated insert
 * path.
 */
const props = defineProps<{
	/** Whether the dialog is open. */
	open: boolean;
	/** Optional deck scheme so previews show the deck's theme colours. */
	scheme?: Record<string, string>;
}>();

const emit = defineEmits<{
	/** Emitted with the chosen template id. */
	(e: 'insert', templateId: SlideTemplateId): void;
	/** Emitted when the dialog should close without inserting. */
	(e: 'close'): void;
}>();

const { t } = useI18n();

const selected = ref<SlideTemplateId | null>(null);

/** Re-seed the selection whenever the dialog (re)opens. */
watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			selected.value = null;
		}
	},
	{ immediate: true },
);

function select(id: SlideTemplateId): void {
	selected.value = id;
}

function insertTemplate(id: SlideTemplateId): void {
	emit('insert', id);
	emit('close');
}

function handleInsert(): void {
	if (selected.value) {
		insertTemplate(selected.value);
	}
}

function close(): void {
	emit('close');
}
</script>

<template>
	<ModalDialog :open="open" :title="t('pptx.slideTemplates.galleryTitle')" @close="close">
		<div class="pptx-vue-template-dialog flex max-h-[min(64vh,480px)] flex-col gap-2.5">
			<p class="pptx-vue-template-description text-[11px] text-muted-foreground">
				{{ t('pptx.slideTemplates.galleryDescription') }}
			</p>
			<div
				class="pptx-vue-template-gallery grid flex-1 grid-cols-3 gap-1 overflow-y-auto"
				role="listbox"
				:aria-label="t('pptx.slideTemplates.gallery')"
			>
				<button
					v-for="spec in SLIDE_TEMPLATES"
					:key="spec.id"
					type="button"
					role="option"
					:aria-selected="selected === spec.id"
					:aria-label="t(spec.nameKey)"
					:title="t(spec.descriptionKey)"
					class="pptx-vue-template-tile flex flex-col items-center gap-1 rounded border py-1 transition-colors"
					:class="
						selected === spec.id
							? 'pptx-vue-template-tile--active border-primary bg-primary/20'
							: 'border-border hover:border-border hover:bg-muted/50'
					"
					@click="select(spec.id)"
					@dblclick="insertTemplate(spec.id)"
				>
					<span class="pptx-vue-template-thumb flex items-center justify-center rounded bg-muted">
						<SlideTemplatePreview :template-id="spec.id" :scheme="props.scheme" />
					</span>
					<span
						class="pptx-vue-template-tile-label text-center text-[10px] leading-tight text-foreground"
					>
						{{ t(spec.nameKey) }}
					</span>
				</button>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-template-btn pptx-vue-template-btn--secondary rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
				@click="close"
			>
				{{ t('pptx.slideTemplates.cancel') }}
			</button>
			<button
				type="button"
				class="pptx-vue-template-btn pptx-vue-template-btn--primary rounded border border-transparent bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-45"
				:disabled="!selected"
				@click="handleInsert"
			>
				{{ t('pptx.slideTemplates.insert') }}
			</button>
		</template>
	</ModalDialog>
</template>
