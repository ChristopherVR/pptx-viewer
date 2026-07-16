/**
 * Slide-background style resolution.
 *
 * Maps a `PptxSlide`'s already-resolved background fields to a neutral CSS map
 * for the slide stage. The core parser resolves the theme/master chain onto the
 * slide, so here we only translate the resolved fields to CSS. Pure TypeScript
 * shared by the React, Vue, and Angular bindings (each casts the map to its
 * framework's CSS type).
 *
 * Precedence (highest first): image fill -> gradient -> pattern -> solid colour.
 */
import type { PptxSlide } from 'pptx-viewer-core';

import type { CssStyleMap } from './element-style-transform';
import { getPatternSvg } from './fill-style';

/** Default slide stage colour when a slide carries no usable background. */
export const DEFAULT_SLIDE_BACKGROUND = '#ffffff';

/**
 * Build the background portion of the slide stage style from a slide's
 * resolved background fields. Returns only `background-*` properties so the
 * caller can spread it into the rest of the stage style.
 */
export function getSlideBackgroundStyle(slide: PptxSlide | undefined): CssStyleMap {
	const style: CssStyleMap = {};

	// Base solid colour. For pattern fills the parser leaves `backgroundColor`
	// set to the foreground colour, so prefer the pattern's `bgColor` as the
	// flat fallback beneath the SVG tile.
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
	} else if (pattern) {
		const svg = getPatternSvg(
			pattern.preset,
			pattern.fgColor ?? solid ?? '#000000',
			pattern.bgColor ?? DEFAULT_SLIDE_BACKGROUND,
		);
		if (svg) {
			style['background-image'] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
			style['background-repeat'] = 'repeat';
		}
	}

	return style;
}
