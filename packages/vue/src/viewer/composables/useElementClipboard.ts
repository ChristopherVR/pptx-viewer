/**
 * useElementClipboard: the in-memory single-element copy / cut / paste buffer.
 *
 * Deliberately NOT the system clipboard: PowerPoint pastes a shape with all its
 * OOXML fidelity intact, which a text/image clipboard round-trip would flatten.
 * The pasted copy is offset by 16px so it does not land exactly on top of its
 * original, matching the other bindings.
 */
import { cloneElement, createEditorId } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

/** px offset applied to a pasted copy so it is visibly distinct from its source. */
const PASTE_OFFSET = 16;

export interface UseElementClipboardOptions {
	/** Resolve an element on the active slide (slide content only, not template). */
	findSlideElement: (id: string) => PptxElement | undefined;
	addElement: (element: PptxElement) => void;
	removeElement: (id: string) => void;
	selectedElementIds: Ref<string[]>;
}

export interface UseElementClipboardResult {
	clipboard: Ref<PptxElement | null>;
	hasClipboard: ComputedRef<boolean>;
	copyElement: (id: string) => void;
	cutElement: (id: string) => void;
	pasteElement: () => void;
}

export function useElementClipboard(
	options: UseElementClipboardOptions,
): UseElementClipboardResult {
	const clipboard = ref<PptxElement | null>(null);
	const hasClipboard = computed(() => clipboard.value !== null);

	function copyElement(id: string): void {
		const el = options.findSlideElement(id);
		if (el) {
			clipboard.value = cloneElement(el);
		}
	}

	function cutElement(id: string): void {
		copyElement(id);
		options.removeElement(id);
		options.selectedElementIds.value = options.selectedElementIds.value.filter((x) => x !== id);
	}

	function pasteElement(): void {
		if (!clipboard.value) {
			return;
		}
		const copy = cloneElement(clipboard.value);
		copy.id = createEditorId('el');
		copy.x = (copy.x ?? 0) + PASTE_OFFSET;
		copy.y = (copy.y ?? 0) + PASTE_OFFSET;
		options.addElement(copy);
		options.selectedElementIds.value = [copy.id];
	}

	return { clipboard, hasClipboard, copyElement, cutElement, pasteElement };
}
