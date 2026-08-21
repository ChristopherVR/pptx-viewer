/**
 * useElementClipboard: the in-memory single-element copy / cut / paste buffer.
 *
 * Deliberately NOT the system clipboard: PowerPoint pastes a shape with all its
 * OOXML fidelity intact, which a text/image clipboard round-trip would flatten.
 * Cloning, descendant re-id and the paste cascade offset go through the shared
 * clipboard codec so this matches paste/duplicate/ungroup everywhere else.
 */
import { cloneElement } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { cloneElementForPaste, isTemplateElementId } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, shallowRef } from 'vue';

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
	// shallowRef: a deep-reactive ref() wraps an assigned object in a Proxy,
	// which structuredClone (used by cloneElementForPaste) cannot clone. The
	// clipboard buffer is never rendered field-by-field, so it does not need
	// Vue's deep reactivity.
	const clipboard = shallowRef<PptxElement | null>(null);
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
		const copy = cloneElementForPaste(clipboard.value, {
			intoTemplate: isTemplateElementId(clipboard.value.id),
		});
		options.addElement(copy);
		options.selectedElementIds.value = [copy.id];
	}

	return { clipboard, hasClipboard, copyElement, cutElement, pasteElement };
}
