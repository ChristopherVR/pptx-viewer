import type { PptxElement } from 'pptx-viewer-core';
import {
	createInlineListSeed,
	initializeInlineListDom,
	inlineListBodyText,
	readEditableText,
	readListActivationSelection,
	restoreInlineListBodySelection,
} from 'pptx-viewer-shared';
import type { InlineListSeed } from 'pptx-viewer-shared';

/** One explicit plain-to-list command boundary, never an input-event rewrite. */
export function activateInlineTextList(
	surface: HTMLElement,
	element: PptxElement,
	attach: (root: HTMLElement, seed: InlineListSeed) => void,
): boolean | undefined {
	const seed = createInlineListSeed(element);
	if (!seed || !('textSegments' in element)) {
		return undefined;
	}
	const body = inlineListBodyText(element.textSegments);
	if (readEditableText(surface) !== body) {
		return false;
	}
	const selection = readListActivationSelection(surface, body);
	const root = surface.ownerDocument.createElement('div');
	root.dataset.pptxTextFlow = '';
	if (!initializeInlineListDom(root, seed)) {
		return false;
	}
	surface.replaceChildren(root);
	attach(root, seed);
	if (selection) {
		restoreInlineListBodySelection(seed, root, selection);
	}
	return true;
}
