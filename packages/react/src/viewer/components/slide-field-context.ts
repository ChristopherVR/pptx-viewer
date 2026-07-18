import type { PptxSlide } from 'pptx-viewer-core';

import type { FieldSubstitutionContext } from '../utils/text-field-substitution';

/**
 * Extract the title text from a slide's first title placeholder, mirroring the
 * canvas field context built in `useViewerBuildingBlocks-canvas-props`.
 */
function extractSlideTitle(slide: PptxSlide): string | undefined {
	for (const el of slide.elements) {
		const phType = (el as unknown as { placeholderType?: string }).placeholderType;
		if (phType === 'title' || phType === 'ctrTitle') {
			const txt = (el as unknown as { text?: string }).text;
			if (txt) {
				return txt;
			}
		}
	}
	return undefined;
}

/**
 * Specialise a presentation-wide field context for a single slide preview.
 *
 * The date/header/footer/custom-property fields are presentation-wide, but the
 * slide number and slide title are per-slide, so a thumbnail must resolve them
 * from its own slide rather than the active one. Returns `undefined` when no
 * base context is supplied so callers stay allocation-free.
 */
export function deriveSlideFieldContext(
	base: FieldSubstitutionContext | undefined,
	slide: PptxSlide,
): FieldSubstitutionContext | undefined {
	if (!base) {
		return undefined;
	}
	return {
		...base,
		slideNumber: slide.slideNumber,
		slideTitle: extractSlideTitle(slide),
	};
}
