/**
 * Slide-background style resolution.
 *
 * Maps a `PptxSlide`'s background fields to a `[ngStyle]`-compatible map for
 * the slide stage. Mirrors the React `SlideCanvas` background handling and the
 * Vue port: the core parser resolves the theme/master chain onto the slide, so
 * here we only translate the already-resolved fields to CSS.
 *
 * Precedence (highest first): image fill → gradient → pattern → solid colour.
 * Pattern fills currently approximate to their background colour (the SVG
 * pattern preset renderer — `color-patterns.ts` in React — is a shared
 * extraction candidate; see PORTING.md).
 */
import type { PptxSlide } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';

/** Default slide stage colour when a slide carries no usable background. */
export const DEFAULT_SLIDE_BACKGROUND = '#ffffff';

/**
 * Build the background portion of the slide stage style from a slide's
 * resolved background fields. Returns only `background-*` properties so the
 * caller can spread it into the rest of the stage style.
 */
export function getSlideBackgroundStyle(slide: PptxSlide | undefined): StyleMap {
	const style: StyleMap = {};

	// Base solid colour. For pattern fills the parser leaves `backgroundColor`
	// set to the foreground colour, so prefer the pattern's `bgColor` as the
	// flat base (until the SVG pattern preset is ported).
	const pattern = slide?.backgroundPattern;
	const solid =
		slide?.backgroundColor && slide.backgroundColor !== 'transparent'
			? slide.backgroundColor
			: undefined;
	style['background-color'] = pattern?.bgColor ?? solid ?? DEFAULT_SLIDE_BACKGROUND;

	// Image fill takes precedence over a gradient; the gradient string from the
	// parser is already a complete `linear-gradient(...)` / `radial-gradient(...)`.
	if (slide?.backgroundImage) {
		style['background-image'] = `url(${slide.backgroundImage})`;
		style['background-size'] = '100% 100%';
		style['background-repeat'] = 'no-repeat';
	} else if (slide?.backgroundGradient) {
		style['background-image'] = slide.backgroundGradient;
	}

	return style;
}
