/**
 * Blip `a:fillOverlay` compositing: an SVG `feFlood`/`feBlend`/`feComposite`
 * chain that paints the overlay's resolved colour over an image, using the
 * authored blend mode, clipped to the image's own alpha so transparent PNG
 * regions never pick up a colour bleed.
 *
 * Split out of `image-effects.ts` (already at the file-size ceiling) so the
 * fill-overlay compositing stays a focused, independently testable module;
 * `image-effects.ts` only wires the two exports below into its existing
 * `getImageFilterCss` / `getImageSvgFilters` aggregate functions.
 *
 * `PptxImageEffects.fillOverlay.resolvedColor` (set by core only for a plain
 * `a:solidFill` overlay - the common "picture colour overlay" case) is the
 * only shape this module can composite; a gradient/pattern/picture overlay
 * fill has no resolved colour and is skipped here (its raw XML still
 * round-trips losslessly via `fillRawXml`).
 *
 * @module render/image-fill-overlay
 */
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

/** Stable SVG filter ID for a blip fill-overlay effect on an element. */
export function getImageFillOverlayFilterId(elementId: string): string {
	return `imgoverlay-${elementId}`;
}

/** Map an OOXML `a:fillOverlay/@blend` token to an SVG `feBlend` `mode`. */
function toFeBlendMode(blend: NonNullable<PptxImageEffects['fillOverlay']>['blend']): string {
	switch (blend) {
		case 'mult':
			return 'multiply';
		case 'screen':
			return 'screen';
		case 'darken':
			return 'darken';
		case 'lighten':
			return 'lighten';
		default:
			return 'normal';
	}
}

/** Get an element's image effects, or `undefined` for a non-image element. */
function getEffects(element: PptxElement): PptxImageEffects | undefined {
	return isImageLikeElement(element) ? element.imageEffects : undefined;
}

/**
 * Whether an element has a fill-overlay effect this module can composite
 * (i.e. core resolved the overlay to a plain colour from `a:solidFill`).
 */
export function hasImageFillOverlayEffect(element: PptxElement): boolean {
	return Boolean(getEffects(element)?.fillOverlay?.resolvedColor);
}

/**
 * Build the inner `<filter>` markup compositing a fill-overlay colour over an
 * image: flood the overlay colour, blend it with the source using the
 * authored mode, then clip the result to the source's own alpha so
 * transparent regions are never painted.
 *
 * @returns The markup, or `undefined` when there is no resolved overlay colour.
 */
function buildImageFillOverlayFilterMarkup(effects: PptxImageEffects): string | undefined {
	const overlay = effects.fillOverlay;
	if (!overlay?.resolvedColor) {
		return undefined;
	}
	const opacity = typeof overlay.resolvedOpacity === 'number' ? overlay.resolvedOpacity : 1;
	const mode = toFeBlendMode(overlay.blend);
	return (
		`<feFlood flood-color="${overlay.resolvedColor}" flood-opacity="${opacity}" result="fillOverlayFlood"/>` +
		`<feBlend in="fillOverlayFlood" in2="SourceGraphic" mode="${mode}" result="fillOverlayBlended"/>` +
		'<feComposite in="fillOverlayBlended" in2="SourceGraphic" operator="in"/>'
	);
}

/**
 * Fill-overlay SVG filter for an image element.
 *
 * @returns The filter `id`, its `cssReference` (`url(#id)`), and the inner
 *          `filterMarkup`, or `undefined` when there is no resolved overlay
 *          colour to composite.
 */
export function getImageFillOverlayFilter(
	element: PptxElement,
	elementId: string = isImageLikeElement(element) ? element.id : '',
): { id: string; cssReference: string; filterMarkup: string } | undefined {
	const effects = getEffects(element);
	if (!effects) {
		return undefined;
	}
	const markup = buildImageFillOverlayFilterMarkup(effects);
	if (!markup) {
		return undefined;
	}
	const id = getImageFillOverlayFilterId(elementId);
	return { id, cssReference: `url(#${id})`, filterMarkup: markup };
}
