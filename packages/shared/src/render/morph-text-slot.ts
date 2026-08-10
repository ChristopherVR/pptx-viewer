/**
 * Whether a matched pair is a text box whose WORDS were replaced without it
 * leaving its slot - the case PowerPoint dissolves in place rather than moving.
 *
 * @module render/morph-text-slot
 */
import type { PptxElement } from 'pptx-viewer-core';

import { boxOverlapRatio } from './morph-flatten';

/**
 * Fraction of the union the two boxes must share to count as the same slot.
 * The same threshold `morph-flatten` uses to decide two group children are the
 * same object, and for the same reason.
 */
const SAME_SLOT_OVERLAP = 0.5;

/** An element's own words, whitespace-normalised. */
function ownText(element: PptxElement): string {
	return ((element as { text?: string }).text ?? '').replace(/\s+/gu, ' ').trim();
}

/**
 * Whether a matched pair of TEXT BOXES holds different wording in the same slot.
 *
 * Such a pair is animated as a pure dissolve: no translation, no scale, each
 * half painted at its own geometry with complementary opacity. Everywhere else
 * a matched pair interpolates its whole box, which is right for a shape - but a
 * text box's box is a container that PowerPoint re-fits around whatever it now
 * says, and its glyphs are laid out inside that box rather than scaled with it.
 * Interpolating it therefore stretches the wording by the amount the WORDS
 * changed length, which is never something PowerPoint shows.
 *
 * Measured on PowerPoint 16's own render (`CreateVideo`, 62.5fps):
 *
 *   - A text box whose wording changed while its box doubled in width dissolves
 *     glyph over glyph with the type at a constant size, still on its left
 *     margin: the box grew, the text did not.
 *   - The wheel deck's centre paragraphs (issue #160) re-fit by 11px and 12px
 *     between topic slides. Every frame of PowerPoint's transition is a blend of
 *     the two end states with a residual under 1.1/255, which no scaling or
 *     shifting of either half could produce.
 *   - A text box that genuinely MOVES (460px, wording changed too) travels the
 *     whole way while its glyphs cross-dissolve, so distance has to keep the
 *     interpolation. Hence the slot test rather than a blanket rule.
 *
 * @param fromElement - The outgoing half of the pair.
 * @param toElement - The incoming half.
 * @returns True when the pair should dissolve where it stands.
 */
export function morphTextReplacedInSlot(fromElement: PptxElement, toElement: PptxElement): boolean {
	if (fromElement.type !== 'text' || toElement.type !== 'text') {
		return false;
	}
	const from = ownText(fromElement);
	const to = ownText(toElement);
	if (from === '' || to === '' || from === to) {
		return false;
	}
	return boxOverlapRatio(fromElement, toElement) >= SAME_SLOT_OVERLAP;
}
