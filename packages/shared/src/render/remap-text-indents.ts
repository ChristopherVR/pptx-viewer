/**
 * Carry `PptxTextProperties.paragraphIndents` through an inline-edit commit.
 *
 * The renderer indexes that array by paragraph position, so after a paragraph
 * is split, inserted or deleted every later entry would apply to the wrong
 * paragraph. The same content-based pairing `remapTextToSegments` uses for
 * paragraph metadata decides which original entry each edited paragraph keeps.
 */
import type { TextSegment } from 'pptx-viewer-core';

import type { ParagraphIndent } from './bullet-list';
import { mapEditedParagraphs, splitOriginalParagraphs } from './remap-text-paragraph-match';

export type { ParagraphIndent } from './bullet-list';

/**
 * One indent entry per edited paragraph: a matched paragraph keeps the entry
 * of the original it was edited from; an inserted or split-off paragraph
 * inherits the entry of the paragraph it continues (its donor). Returns
 * `originalIndents` unchanged when there is nothing to remap.
 */
export function remapParagraphIndents(
	newText: string,
	originalSegments: readonly TextSegment[] | undefined,
	originalIndents: readonly ParagraphIndent[] | undefined,
): ParagraphIndent[] | undefined {
	if (!originalIndents || originalIndents.length === 0) {
		return originalIndents ? [...originalIndents] : undefined;
	}
	if (!originalSegments || originalSegments.length === 0) {
		return [...originalIndents];
	}
	const originals = splitOriginalParagraphs(originalSegments);
	const mappings = mapEditedParagraphs(newText.split('\n'), originals);
	return mappings.map((mapping) => {
		const source = mapping.kind === 'matched' ? mapping.original : mapping.donor;
		return originalIndents[source] ?? {};
	});
}
