import type { PptxSlide } from 'pptx-viewer-core';
import type { SlideBackgroundSize } from 'pptx-viewer-shared';
import { getSlideBackgroundStyle } from 'pptx-viewer-shared';
import type { CSSProperties } from 'react';

/**
 * Adapt the framework-neutral kebab-case slide background map for React.
 *
 * `slideSize` (the deck's authored px size) is only needed to anchor a
 * `shadeToTitle` gradient on its title placeholder; omitting it keeps the
 * plain authored gradient (see `getSlideBackgroundStyle`).
 */
export function getReactSlideBackgroundStyle(
	slide: PptxSlide | undefined,
	slideSize?: SlideBackgroundSize,
): CSSProperties {
	const style = getSlideBackgroundStyle(slide, slideSize);
	return {
		backgroundColor: style['background-color'] as CSSProperties['backgroundColor'],
		backgroundImage: slide?.backgroundImage
			? undefined
			: (style['background-image'] as CSSProperties['backgroundImage']),
		backgroundSize: style['background-size'] as CSSProperties['backgroundSize'],
		backgroundRepeat: style['background-repeat'] as CSSProperties['backgroundRepeat'],
	};
}
