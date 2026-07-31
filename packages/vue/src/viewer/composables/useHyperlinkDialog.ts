/**
 * useHyperlinkDialog: Insert > Link / context-menu "Hyperlink" dialog state.
 *
 * The dialog is opened from two places that name their target differently: the
 * context menu already knows the element id, while the ribbon only knows
 * "whatever is selected". Both routes are here so the ribbon cannot drift into
 * opening the dialog on a stale target.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { ComputedRef, Ref } from 'vue';
import { ref } from 'vue';

export interface UseHyperlinkDialogOptions {
	/** Resolve an element on the active slide (slide content, not the template layer). */
	findSlideElement: (id: string) => PptxElement | undefined;
	selectedElementIds: Ref<string[]> | ComputedRef<string[]>;
	updateElement: (id: string, patch: Partial<PptxElement>) => void;
}

export interface UseHyperlinkDialogResult {
	hyperlinkOpen: Ref<boolean>;
	hyperlinkTarget: Ref<PptxElement | null>;
	openHyperlinkDialog: (id: string) => void;
	/** Insert > Link: resolve the target the same way the context menu does. */
	openHyperlinkForSelection: () => void;
	onHyperlinkSave: (patch: Partial<PptxElement>) => void;
}

export function useHyperlinkDialog(options: UseHyperlinkDialogOptions): UseHyperlinkDialogResult {
	const hyperlinkOpen = ref(false);
	const hyperlinkTarget = ref<PptxElement | null>(null);

	function openHyperlinkDialog(id: string): void {
		const el = options.findSlideElement(id);
		if (el) {
			hyperlinkTarget.value = el;
			hyperlinkOpen.value = true;
		}
	}

	function openHyperlinkForSelection(): void {
		const id = options.selectedElementIds.value[0];
		if (id !== undefined) {
			openHyperlinkDialog(id);
		}
	}

	function onHyperlinkSave(patch: Partial<PptxElement>): void {
		if (hyperlinkTarget.value) {
			options.updateElement(hyperlinkTarget.value.id, patch);
		}
		hyperlinkOpen.value = false;
	}

	return {
		hyperlinkOpen,
		hyperlinkTarget,
		openHyperlinkDialog,
		openHyperlinkForSelection,
		onHyperlinkSave,
	};
}
