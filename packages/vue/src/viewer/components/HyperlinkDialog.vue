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
		<div class="pptx-vue-hyperlink-form">
			<label class="pptx-vue-hyperlink-field">
				<span class="pptx-vue-hyperlink-label">Address</span>
				<input
					v-model="url"
					type="url"
					class="pptx-vue-hyperlink-input"
					placeholder="https://example.com"
					@keydown.enter.prevent="save"
				/>
			</label>

			<label class="pptx-vue-hyperlink-field">
				<span class="pptx-vue-hyperlink-label">Tooltip</span>
				<input
					v-model="tooltip"
					type="text"
					class="pptx-vue-hyperlink-input"
					placeholder="Shown on hover (optional)"
					@keydown.enter.prevent="save"
				/>
			</label>
		</div>

		<template #footer>
			<button
				v-if="hasExistingLink"
				type="button"
				class="pptx-vue-hyperlink-btn pptx-vue-hyperlink-btn--ghost"
				@click="clear"
			>
				Remove link
			</button>
			<button
				type="button"
				class="pptx-vue-hyperlink-btn pptx-vue-hyperlink-btn--secondary"
				@click="close"
			>
				Cancel
			</button>
			<button
				type="button"
				class="pptx-vue-hyperlink-btn pptx-vue-hyperlink-btn--primary"
				@click="save"
			>
				Apply
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-hyperlink-form {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-width: 280px;
}

.pptx-vue-hyperlink-field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.pptx-vue-hyperlink-label {
	font-size: 12px;
	font-weight: 500;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-hyperlink-input {
	width: 100%;
	padding: 6px 10px;
	font-size: 13px;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-background, #ffffff);
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	outline: none;
}

.pptx-vue-hyperlink-input:focus {
	border-color: var(--pptx-vue-primary, #2563eb);
	box-shadow: 0 0 0 1px var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-hyperlink-btn {
	padding: 6px 12px;
	font-size: 12px;
	border-radius: 4px;
	border: 1px solid transparent;
	cursor: pointer;
}

.pptx-vue-hyperlink-btn--primary {
	color: var(--pptx-vue-primary-foreground, #ffffff);
	background: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-hyperlink-btn--secondary {
	color: var(--pptx-vue-foreground, #111827);
	background: transparent;
	border-color: var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-hyperlink-btn--ghost {
	margin-right: auto;
	color: var(--pptx-vue-destructive, #dc2626);
	background: transparent;
}

.pptx-vue-hyperlink-btn--secondary:hover,
.pptx-vue-hyperlink-btn--ghost:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
}
</style>
