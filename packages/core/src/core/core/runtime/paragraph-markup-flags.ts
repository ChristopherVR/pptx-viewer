import type { TextSegment, XmlObject } from '../../types';

/**
 * Markup-only facts about a parsed `a:p` that the typed text model has no
 * other way to express, stamped on the paragraph's first segment so a
 * rewritten slide gives back the markup it was loaded from:
 *
 * - `emptyParagraphPropertiesAuthored`: the paragraph wrote `<a:pPr/>`. An
 *   empty element and an absent one parse to the same (empty) paragraph
 *   properties, so without the flag the writer could only drop it.
 * - `bareParagraph`: the paragraph has no run content and no
 *   `a:endParaRPr`. The writer otherwise backfills an empty run or the
 *   `<a:endParaRPr lang="en-US"/>` stub PowerPoint writes for NEW blank lines.
 *
 * @module paragraph-markup-flags
 */

function isEmptyElement(node: unknown): boolean {
	// fast-xml-parser gives a childless, attribute-less element back as `''`.
	if (node === '') {
		return true;
	}
	return (
		typeof node === 'object' &&
		node !== null &&
		!Array.isArray(node) &&
		Object.keys(node as XmlObject).length === 0
	);
}

/**
 * Stamp the paragraph markup flags on `segment`, the first segment of `p`.
 *
 * @param segment First segment of the paragraph (mutated).
 * @param p The parsed `a:p` node.
 * @param hasContent Whether the paragraph holds any run, field, break or math.
 */
export function stampParagraphMarkupFlags(
	segment: TextSegment,
	p: XmlObject,
	hasContent: boolean,
): void {
	if (isEmptyElement(p['a:pPr'])) {
		segment.emptyParagraphPropertiesAuthored = true;
	}
	if (!hasContent && p['a:endParaRPr'] === undefined) {
		segment.bareParagraph = true;
	}
}
