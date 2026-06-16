<script setup lang="ts">
import type { PptxAction, PptxElement } from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';

/**
 * HyperlinkDialog — set or clear an element's click hyperlink.
 *
 * Mirrors the React app's hyperlink editing, which stores the link on the
 * element-level `actionClick` field (a `PptxAction`). The core type for that
 * field is:
 *
 * ```ts
 * interface PptxAction {
 *   url?: string;      // resolved external URL / file path
 *   tooltip?: string;  // hover tooltip text
 *   action?: string;   // OOXML ppaction verb (slide jumps etc.) — preserved
 *   // …rId, soundRId, targetSlideIndex, highlightClick
 * }
 * ```
 *
 * This dialog edits the simple URL + tooltip pair (the common case). It reads
 * the element's current `actionClick.url` / `actionClick.tooltip`, lets the
 * user change or clear them, and emits a `save` patch shaped as
 * `{ actionClick: PptxAction | undefined }`:
 *  - **Set:** `{ actionClick: { url, tooltip, action } }` (any preexisting
 *    `action` verb on the element is preserved so slide-jump links survive).
 *  - **Clear:** `{ actionClick: undefined }`.
 *
 * Apply the patch with the editor's element-update op, e.g.
 * `ops.updateElement(element.id, patch)`.
 *
 * Note: PowerPoint can also place hyperlinks on individual text runs
 * (`TextSegment.hyperlink: string` + `TextSegment.hyperlinkTooltip: string`).
 * This dialog deliberately targets the element-level `actionClick` to match the
 * React implementation; a run-level editor would instead emit a patch updating
 * `textSegments[].hyperlink`.
 */
const props = defineProps<{
	/** Whether the dialog is open. */
	open: boolean;
	/** The element whose hyperlink is being edited, or `null`. */
	element: PptxElement | null;
}>();

const emit = defineEmits<{
	/** Emitted when the user applies a change. Payload is a merge patch. */
	(e: 'save', patch: Partial<PptxElement>): void;
	/** Emitted when the dialog should close without saving. */
	(e: 'close'): void;
}>();

const url = ref('');
const tooltip = ref('');

/** Whether the current element already has a hyperlink set. */
const hasExistingLink = computed(() => Boolean(props.element?.actionClick?.url));

/**
 * Re-seed the local form from the element each time the dialog opens (or the
 * target element changes while open).
 */
watch(
	[() => props.open, () => props.element],
	([isOpen]) => {
		if (isOpen) {
			url.value = props.element?.actionClick?.url ?? '';
			tooltip.value = props.element?.actionClick?.tooltip ?? '';
		}
	},
	{ immediate: true },
);

function close(): void {
	emit('close');
}

function save(): void {
	if (!props.element) {
		close();
		return;
	}
	const trimmedUrl = url.value.trim();
	const trimmedTooltip = tooltip.value.trim();

	if (trimmedUrl === '') {
		// Empty URL → clear the hyperlink entirely.
		emit('save', { actionClick: undefined });
		close();
		return;
	}

	// Preserve any existing OOXML action verb (e.g. slide-jump) on the element.
	const existing = props.element.actionClick;
	const actionClick: PptxAction = {
		...existing,
		url: trimmedUrl,
		tooltip: trimmedTooltip === '' ? undefined : trimmedTooltip,
	};
	emit('save', { actionClick });
	close();
}

function clear(): void {
	url.value = '';
	tooltip.value = '';
	emit('save', { actionClick: undefined });
	close();
}
</script>

<template>
	<ModalDialog :open="open" title="Hyperlink" @close="close">
		<div class="pptx-vue-hyperlink-form flex min-w-[280px] flex-col gap-3">
			<label class="pptx-vue-hyperlink-field flex flex-col gap-1">
				<span class="pptx-vue-hyperlink-label text-xs font-medium text-muted-foreground">
					Address
				</span>
				<input
					v-model="url"
					type="url"
					class="pptx-vue-hyperlink-input w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
					placeholder="https://example.com"
					@keydown.enter.prevent="save"
				/>
			</label>

			<label class="pptx-vue-hyperlink-field flex flex-col gap-1">
				<span class="pptx-vue-hyperlink-label text-xs font-medium text-muted-foreground">
					Tooltip
				</span>
				<input
					v-model="tooltip"
					type="text"
					class="pptx-vue-hyperlink-input w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
					placeholder="Shown on hover (optional)"
					@keydown.enter.prevent="save"
				/>
			</label>
		</div>

		<template #footer>
			<button
				v-if="hasExistingLink"
				type="button"
				class="pptx-vue-hyperlink-btn pptx-vue-hyperlink-btn--ghost mr-auto rounded border border-transparent px-3 py-1.5 text-xs text-destructive hover:bg-muted"
				@click="clear"
			>
				Remove link
			</button>
			<button
				type="button"
				class="pptx-vue-hyperlink-btn pptx-vue-hyperlink-btn--secondary rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
				@click="close"
			>
				Cancel
			</button>
			<button
				type="button"
				class="pptx-vue-hyperlink-btn pptx-vue-hyperlink-btn--primary rounded border border-transparent bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90"
				@click="save"
			>
				Apply
			</button>
		</template>
	</ModalDialog>
</template>
