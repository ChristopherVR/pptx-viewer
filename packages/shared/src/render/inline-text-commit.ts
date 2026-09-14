import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { reconcileInlineListSnapshot } from './inline-list-reconcile';
import type { InlineTextEditSnapshot } from './inline-list-types';
import { remapTextToSegments } from './remap-text';

/**
 * Reconcile a committed plain-text edit with an element's existing rich runs.
 *
 * Editor surfaces expose plain text, but the model still owns per-run styles,
 * bullets, fields and paragraph properties. An unchanged blur is not an edit;
 * a changed value is remapped onto the authored segments instead of flattening
 * them.
 */
export function buildInlineTextCommitPatch(
	element: PptxElement | undefined,
	text: string,
	snapshot?: InlineTextEditSnapshot,
): Partial<PptxElement> | undefined {
	if (!element || !hasTextProperties(element)) {
		return undefined;
	}
	const currentSnapshot =
		snapshot?.elementId === element.id && snapshot.textSegments
			? reconcileInlineListSnapshot(snapshot, text)
			: undefined;
	if (currentSnapshot?.textSegments) {
		// List semantics can change without changing the authored body. Conversely,
		// excluding display-only markers must not make an untouched blur dirty.
		if (JSON.stringify(currentSnapshot.textSegments) === JSON.stringify(element.textSegments)) {
			return undefined;
		}
		return { text, textSegments: currentSnapshot.textSegments } as Partial<PptxElement>;
	}
	const currentText = element.textSegments?.length
		? element.textSegments
				.map((segment) => (segment.isParagraphBreak || segment.isLineBreak ? '\n' : segment.text))
				.join('')
		: (element.text ?? '');
	if (currentText === text) {
		return undefined;
	}
	return {
		text,
		textSegments: remapTextToSegments(text, element.textSegments, element.textStyle),
	} as Partial<PptxElement>;
}
