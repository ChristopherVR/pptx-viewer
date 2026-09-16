import type { PicturePptxElement, PptxSlide } from 'pptx-viewer-core';
import React from 'react';

import { getImageEffectsFilter, getImageEffectsOpacity, getImageRenderStyle } from '../utils';
import { renderImg } from './elements/ImageRenderer';

/**
 * Paint a slide background image as an image layer instead of a CSS
 * `background-image`, so crop, tiling and blip effects survive rendering.
 *
 * `imageEffects` is passed through unmodified: `getImageEffectsFilter` /
 * `getImageEffectsOpacity` (shared) already guarantee an `alphaModFix` is
 * applied exactly once (as CSS `opacity`, never also folded into the
 * `imgalpha-<id>` SVG filter), so this no longer needs to strip it out itself.
 */
export function SlideBackgroundImageLayer({
	slide,
}: {
	slide: PptxSlide | undefined;
}): React.ReactElement | null {
	if (!slide?.backgroundImage) {
		return null;
	}

	const properties = slide.backgroundImageProperties ?? {};
	const idPart = String(slide.id || 'slide').replace(/[^A-Za-z0-9_-]/gu, '-');
	const backgroundElement: PicturePptxElement = {
		id: `slide-background-${idPart}`,
		type: 'picture',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		...properties,
		imageData: slide.backgroundImage,
	};

	return (
		<div
			aria-hidden='true'
			className='absolute inset-0 overflow-hidden pointer-events-none select-none'
			style={{ zIndex: 0 }}
		>
			{renderImg(
				backgroundElement,
				getImageRenderStyle(backgroundElement),
				getImageEffectsFilter(backgroundElement),
				'',
				getImageEffectsOpacity(backgroundElement),
			)}
		</div>
	);
}
