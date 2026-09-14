/**
 * Selection-scoped Bullets / Numbering: PowerPoint applies the ribbon's list
 * buttons to the paragraphs the text selection intersects, and to the whole
 * body when the shape (not a text range) is selected.
 *
 * `toggleSelectionBullets` is the one decision every binding's Bullets /
 * Numbering click routes through: it rewrites only the in-scope paragraphs
 * via the existing paragraph-range setter and remaps the inline selection over the
 * marker segments it inserted or removed, so the binding can restore the
 * caret exactly where the user had it.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { BulletParagraph, ElementBulletKind, ParagraphBulletKind } from './bullet-toggle';
import {
	paragraphsBulletKind,
	resolveBulletSegments,
	splitBulletParagraphs,
} from './bullet-toggle';
import type { InlineTextSelection } from './inline-selection-utils';
import { applyListStyleUpdate } from './text-list-style-update';

/** What a selection-scoped bullet edit hands back to the binding. */
export interface BulletToggleResult {
	/** The element patch to apply through the binding's update-element operation. */
	patch: Partial<PptxElement>;
	/** The selection remapped onto the new segments; `null` when there was none. */
	newSelection: InlineTextSelection | null;
}

/** Whether `paragraph` holds a segment the selection covers (all of them when there is no selection). */
function inScope(paragraph: BulletParagraph, selection: InlineTextSelection | null): boolean {
	if (!selection) {
		return true;
	}
	return paragraph.indices.some(
		(index) =>
			index >= selection.startSegIdx &&
			(index < selection.endSegIdx ||
				(index === selection.endSegIdx &&
					(selection.endOffset > 0 || selection.startSegIdx === selection.endSegIdx))),
	);
}

/**
 * The list state the ribbon buttons should show for the current selection:
 * the kind shared by the paragraphs it intersects (every paragraph when there
 * is none), `'mixed'` when they disagree.
 *
 * @param segments - A fresher copy of the element's segments (a live inline
 *   edit); defaults to the element's own.
 */
export function selectionBulletKind(
	element: PptxElement,
	selection: InlineTextSelection | null,
	segments?: readonly TextSegment[],
): ElementBulletKind {
	const paragraphs = splitBulletParagraphs(resolveBulletSegments(element, segments));
	return paragraphsBulletKind(paragraphs.filter((paragraph) => inScope(paragraph, selection)));
}

/**
 * Set every paragraph the selection intersects to `kind` (every paragraph
 * when there is no selection), returning the element patch and the selection
 * remapped onto the rewritten segments. Numbered paragraphs are counted
 * consecutively so the renderer shows "1. 2. 3.".
 */
export function setSelectionBullets(
	element: PptxElement,
	kind: ParagraphBulletKind,
	selection: InlineTextSelection | null,
	segments?: readonly TextSegment[],
): BulletToggleResult {
	if (!hasTextProperties(element)) {
		return { patch: {}, newSelection: selection };
	}
	const source = resolveBulletSegments(element, segments);
	const result = applyListStyleUpdate(
		{ ...element, textSegments: source },
		{ listType: kind },
		selection,
	);
	return { patch: result.patch, newSelection: result.selection };
}

/**
 * The ribbon button behaviour: pressing Bullets (or Numbering) when every
 * in-scope paragraph is already that kind turns them off; otherwise (none, the
 * other kind, or mixed) it applies that kind to all of them.
 */
export function toggleSelectionBullets(
	element: PptxElement,
	kind: Exclude<ParagraphBulletKind, 'none'>,
	selection: InlineTextSelection | null,
	segments?: readonly TextSegment[],
): BulletToggleResult {
	const current = selectionBulletKind(element, selection, segments);
	return setSelectionBullets(element, current === kind ? 'none' : kind, selection, segments);
}
