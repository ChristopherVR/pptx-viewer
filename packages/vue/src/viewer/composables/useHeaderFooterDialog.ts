import type { PptxHeaderFooter } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref } from 'vue';

export interface UseHeaderFooterDialogInput {
	headerFooter: Ref<PptxHeaderFooter | undefined>;
}

export interface UseHeaderFooterDialogResult {
	showHeaderFooter: Ref<boolean>;
	onHeaderFooterUpdate: (next: PptxHeaderFooter) => void;
}

/**
 * useHeaderFooterDialog: Insert ▸ Header & Footer dialog. Extracted verbatim
 * from `PowerPointViewer.vue`.
 */
export function useHeaderFooterDialog(
	input: UseHeaderFooterDialogInput,
): UseHeaderFooterDialogResult {
	const { headerFooter } = input;

	const showHeaderFooter = ref(false);
	function onHeaderFooterUpdate(next: PptxHeaderFooter): void {
		headerFooter.value = next;
		showHeaderFooter.value = false;
	}

	return { showHeaderFooter, onHeaderFooterUpdate };
}
