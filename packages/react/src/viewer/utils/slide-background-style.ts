import type { PptxSlide } from 'pptx-viewer-core';
import { getSlideBackgroundStyle } from 'pptx-viewer-shared';
import type { CSSProperties } from 'react';

/** Adapt the framework-neutral kebab-case slide background map for React. */
export function getReactSlideBackgroundStyle(slide: PptxSlide | undefined): CSSProperties {
	const style = getSlideBackgroundStyle(slide);
	return {
		backgroundColor: style['background-color'] as CSSProperties['backgroundColor'],
		backgroundImage: style['background-image'] as CSSProperties['backgroundImage'],
		backgroundSize: style['background-size'] as CSSProperties['backgroundSize'],
		backgroundRepeat: style['background-repeat'] as CSSProperties['backgroundRepeat'],
	};
}
