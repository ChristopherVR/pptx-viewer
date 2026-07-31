import type { PptxCustomProperty, PptxHeaderFooter, PptxSlide } from 'pptx-viewer-core';
import { deriveSlideTitle } from 'pptx-viewer-core';

import type { FieldSubstitutionContext } from './text-field-substitution';

/**
 * Assembly of the OOXML field-substitution context from the pieces every
 * binding already holds (deck header/footer settings, custom document
 * properties, the slide being rendered).
 *
 * Every binding built this by hand: React in `ViewerCanvasArea`, Vue in
 * `composables/field-context.ts`, Angular in `FieldContextService`, Vanilla in
 * `render-field-context.ts`. The assembly is pure data plumbing with no
 * framework concern, so it lives here and each binding keeps only its reactive
 * wiring (provide/inject, signals, runes context).
 */

/** Deck-level and slide-level inputs a field context is assembled from. */
export interface FieldContextSources {
	/** Deck header/footer settings; supplies date, footer and header text. */
	headerFooter?: PptxHeaderFooter;
	/** Custom document properties, for `docproperty.<name>` field runs. */
	customProperties?: readonly PptxCustomProperty[];
	/** The slide being rendered; supplies its number and title. */
	slide?: PptxSlide;
	/** Locale for `currentdate` / `currenttime` fields (browser default when unset). */
	locale?: string;
}

/**
 * Extract the slide-title text from a slide's title / centre-title placeholder,
 * for `slidetitle` field runs.
 *
 * Delegates to core's `deriveSlideTitle` (the same resolution `docProps/app.xml`
 * is written from) rather than scanning for a `placeholderType` property: a
 * parsed deck does not carry that property at all (only the markdown converter
 * and hand-built test fixtures set one), the placeholder type lives in the
 * preserved `p:nvSpPr > p:nvPr > p:ph/@type` raw XML, and a title's text may sit
 * in `textSegments` instead of `text`. A property-only scan therefore resolved
 * nothing on a real deck and left the authored literal ("Title") on screen.
 *
 * Normalised to `undefined` for "no title", since an empty string would suppress
 * the substitution fallback and blank the field instead.
 */
export function resolveSlideTitle(slide: PptxSlide | undefined): string | undefined {
	if (!slide) {
		return undefined;
	}
	return deriveSlideTitle(slide) || undefined;
}

/**
 * Build the full field-substitution context handed to `buildParagraphs`, so
 * slide-number / date / header / footer / title / document-property runs render
 * as display text instead of their raw authored placeholder ("Slide #").
 */
export function buildFieldSubstitutionContext(
	sources: FieldContextSources,
): FieldSubstitutionContext {
	const hf = sources.headerFooter;
	return {
		slideNumber: sources.slide?.slideNumber,
		dateTimeText: hf?.dateTimeText,
		dateFormat: hf?.dateFormat,
		footerText: hf?.footerText,
		headerText: hf?.headerText,
		slideTitle: resolveSlideTitle(sources.slide),
		customProperties: (sources.customProperties ?? []).map((p) => ({
			name: p.name,
			value: String(p.value),
		})),
		...(sources.locale === undefined ? {} : { locale: sources.locale }),
	};
}

/**
 * Re-point a deck-wide context at one specific slide.
 *
 * The date / header / footer / document-property fields are presentation-wide,
 * but the slide number and slide title are per-slide, so a surface that renders
 * a slide other than the active one (thumbnail rail, presenter preview, export)
 * must resolve those from the slide it is actually painting. Returns
 * `undefined` for a missing base so callers stay allocation-free and keep the
 * "no context means no substitution" behaviour.
 */
export function deriveSlideFieldContext(
	base: FieldSubstitutionContext | undefined,
	slide: PptxSlide | undefined,
): FieldSubstitutionContext | undefined {
	if (!base) {
		return undefined;
	}
	return {
		...base,
		slideNumber: slide?.slideNumber,
		slideTitle: resolveSlideTitle(slide),
	};
}
