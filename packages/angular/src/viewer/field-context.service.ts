import { Injectable, computed, inject } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { FieldSubstitutionContext } from '../internal/shared';
import { buildFieldSubstitutionContext, resolveSlideTitle } from '../internal/shared';
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
 *
 * The assembly itself (including the slide-title resolution, which used to be a
 * local `placeholderType` scan here and so never resolved a title on a real
 * `.pptx`) lives in `pptx-viewer-shared`, so all five bindings build the same
 * context; this service is only the signals adapter.
 */
@Injectable()
export class FieldContextService {
	private readonly load = inject(LoadContentService);

	/** Deck-level field context (header/footer + custom properties); slide parts unset. */
	readonly deckContext = computed<FieldSubstitutionContext>(() =>
		buildFieldSubstitutionContext({
			headerFooter: this.load.headerFooter(),
			customProperties: this.load.customProperties(),
		}),
	);

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
