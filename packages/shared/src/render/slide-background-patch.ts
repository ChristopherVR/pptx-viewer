/**
 * Slide-background patch builders for the Format Background controls.
 *
 * The stage paints a slide's background facets with a fixed precedence (image
 * over gradient over pattern over solid colour, see `slide-background.ts`).
 * PowerPoint's Format Background pane is exclusive: choosing a solid fill
 * REPLACES a picture or gradient fill, and choosing a picture replaces the
 * gradient. The panels used to patch a single facet, so picking a colour on a
 * slide that carried a picture background changed nothing visible (the
 * picture stayed on top) and the deck saved with both, which PowerPoint then
 * rendered the same way.
 *
 * Pure decision functions: each returns the `PptxSlide` patch a binding hands
 * to its slide-update operation.
 */
import type { PptxSlide } from 'pptx-viewer-core';

/** Fields a background choice replaces. */
export type SlideBackgroundPatch = Pick<
	PptxSlide,
	'backgroundColor' | 'backgroundImage' | 'backgroundGradient' | 'backgroundPattern'
>;

/**
 * Solid fill: the colour becomes the whole background, so the picture,
 * gradient and pattern layers that would paint over it are cleared.
 */
export function solidBackgroundPatch(hex: string): SlideBackgroundPatch {
	return {
		backgroundColor: hex,
		backgroundImage: undefined,
		backgroundGradient: undefined,
		backgroundPattern: undefined,
	};
}

/**
 * Picture fill: the image replaces a gradient or pattern. The solid colour is
 * kept underneath as the fallback the stage shows while the picture loads and
 * the colour that returns when the picture is removed again.
 */
export function imageBackgroundPatch(
	dataUrl: string,
): Omit<SlideBackgroundPatch, 'backgroundColor'> {
	return {
		backgroundImage: dataUrl,
		backgroundGradient: undefined,
		backgroundPattern: undefined,
	};
}

/** Remove every slide-level facet so the slide inherits its layout background again. */
export function clearBackgroundPatch(): SlideBackgroundPatch {
	return {
		backgroundColor: undefined,
		backgroundImage: undefined,
		backgroundGradient: undefined,
		backgroundPattern: undefined,
	};
}
