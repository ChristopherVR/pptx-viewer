import { Injectable, computed, inject } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { FieldSubstitutionContext } from '../internal/shared';
import { LoadContentService } from './load-content.service';

/**
 * `FieldContextService`: viewer-scoped source of the OOXML field-substitution
 * context (slide number, date/time, header/footer, slide title, custom doc
 * properties) used by the element text renderers.
 *
 * Mirrors the React `fieldContext` built in `ViewerCanvasArea` and the Vue
 * `FieldContextKey` provide/inject. The deck-level parts (header/footer text +
 * format, custom properties) come from {@link LoadContentService}; the
 * per-slide parts (slide number + title) are folded in by the slide canvas,
 * which knows which slide it renders, via {@link forSlide}.
 *
 * Provided alongside `LoadContentService` in the viewer subtree, so renderers
 * used outside the viewer (thumbnails, export) that inject it `optional` simply
 * fall back to no substitution.
 */
@Injectable()
export class FieldContextService {
	private readonly load = inject(LoadContentService);

	/** Deck-level field context (header/footer + custom properties); slide parts unset. */
	readonly deckContext = computed<FieldSubstitutionContext>(() => {
		const hf = this.load.headerFooter();
		return {
			dateTimeText: hf?.dateTimeText,
			dateFormat: hf?.dateFormat,
			footerText: hf?.footerText,
			headerText: hf?.headerText,
			customProperties: this.load.customProperties().map((p) => ({
				name: p.name,
				value: p.value,
			})),
		};
	});

	/**
	 * Build the full field context for a specific slide, folding the slide's
	 * number and title (from the first title / centre-title placeholder) into the
	 * deck-level context.
	 */
	forSlide(slide: PptxSlide | undefined): FieldSubstitutionContext {
		return {
			...this.deckContext(),
			slideNumber: slide?.slideNumber,
			slideTitle: resolveSlideTitle(slide),
		};
	}
}

/**
 * Extract the slide-title text from the first title / centre-title placeholder
 * element on a slide, mirroring React's `ViewerCanvasArea` title scan. The
 * `placeholderType` discriminant is not a typed field on `PptxElement`, so it
 * is read via a narrow cast.
 */
export function resolveSlideTitle(slide: PptxSlide | undefined): string | undefined {
	if (!slide) {
		return undefined;
	}
	for (const el of slide.elements) {
		const phType = (el as { placeholderType?: string }).placeholderType;
		if (phType === 'title' || phType === 'ctrTitle') {
			const txt = (el as { text?: string }).text;
			if (txt) {
				return txt;
			}
		}
	}
	return undefined;
}
