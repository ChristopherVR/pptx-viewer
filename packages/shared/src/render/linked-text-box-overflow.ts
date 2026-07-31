/**
 * Linked text box overflow utilities.
 *
 * Wraps the core `getLinkedTextBoxSegments` function and provides helpers for
 * computing which text segments should render in each box of a linked text box
 * chain. Framework-agnostic.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties, getLinkedTextBoxSegments } from 'pptx-viewer-core';

/**
 * Determine whether an element participates in a linked text box chain.
 */
export function isLinkedTextBox(element: PptxElement): boolean {
	return hasTextProperties(element) && element.linkedTxbxId !== undefined;
}

/**
 * Determine whether an element is the head (seq 0) of a linked text box chain.
 */
export function isLinkedTextBoxHead(element: PptxElement): boolean {
	return (
		hasTextProperties(element) &&
		element.linkedTxbxId !== undefined &&
		(element.linkedTxbxSeq ?? 0) === 0
	);
}

/**
 * Compute the distributed text segments for a given element in a linked text
 * box chain.
 *
 * Returns the segments that this element should display after overflow
 * distribution, or `undefined` if the element is not part of a chain, is the
 * only member, or the caller has no sibling list to resolve the chain against.
 *
 * `slideElements` is nullable so every binding can call this unconditionally at
 * its text-render site: a surface that does not (yet) thread the sibling list
 * down, or renders an element outside any slide, degrades to the element's own
 * authored segments instead of forcing a guard into each view layer.
 */
export function getOverflowSegments(
	element: PptxElement,
	slideElements: readonly PptxElement[] | undefined,
): TextSegment[] | undefined {
	if (!slideElements || slideElements.length === 0) {
		return undefined;
	}
	return getLinkedTextBoxSegments(element, slideElements);
}

/**
 * Build a complete segment distribution map for all linked text box chains on a
 * slide.
 *
 * Returns a map from element ID to the text segments that element should
 * render. Elements not in any chain are not included.
 */
export function buildSlideOverflowMap(
	slideElements: readonly PptxElement[],
): Map<string, TextSegment[]> {
	const result = new Map<string, TextSegment[]>();

	if (!slideElements.some((el) => isLinkedTextBox(el))) {
		return result;
	}

	for (const el of slideElements) {
		if (!isLinkedTextBox(el)) {
			continue;
		}
		const segments = getLinkedTextBoxSegments(el, slideElements);
		if (segments !== undefined) {
			result.set(el.id, segments);
		}
	}

	return result;
}
