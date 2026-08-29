import type { PicturePptxElement, PptxImageEffects, PptxSlide } from 'pptx-viewer-core';
import React from 'react';

import { getImageEffectsFilter, getImageRenderStyle } from '../utils';
import { renderImg } from './elements/ImageRenderer';

/**
 * Paint a slide background image as an image layer instead of a CSS
 * `background-image`, so crop, tiling and blip effects survive rendering.
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
	const originalEffects = properties.imageEffects;
	const renderEffects: PptxImageEffects | undefined = originalEffects
		? { ...originalEffects }
		: undefined;
	// The simple multiplier is applied as opacity on the image node. Leaving it
	// in the SVG-effect pipeline as well would halve the alpha twice.
	if (renderEffects) {
		delete renderEffects.alphaModFix;
		delete renderEffects.alphaModFixRawXml;
	}

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
		imageEffects: renderEffects,
	};
	const opacity =
		typeof originalEffects?.alphaModFix === 'number'
			? Math.max(0, Math.min(1, originalEffects.alphaModFix / 100))
			: undefined;

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
				opacity,
			)}
		</div>
	);
}
