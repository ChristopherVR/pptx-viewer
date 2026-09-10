import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
/**
 * `SlideLayer` - a simplified, non-interactive slide render (like
 * `SlideThumbnail`), used by both the single-layer and multi-fragment
 * transition overlays. Split out of `PresentationTransitionOverlay.tsx` so
 * `FragmentedTransitionLayer.tsx` can reuse it without a circular import.
 */
import { visibleTemplateElements } from 'pptx-viewer-shared';
import React from 'react';

import type { CanvasSize } from '../types';
import { normalizeHexColor } from '../utils';
import { SlideBackgroundImageLayer } from './SlideBackgroundImageLayer';
import { StaticElementRenderer } from './StaticElementRenderer';

export interface SlideLayerProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
}

export function SlideLayer({
	slide,
	templateElements,
	canvasSize,
}: SlideLayerProps): React.ReactElement {
	const safeWidth = Math.max(canvasSize.width, 1);
	const safeHeight = Math.max(canvasSize.height, 1);
	const elements = [...visibleTemplateElements(slide, templateElements), ...slide.elements];

	return (
		<div
			className='relative overflow-hidden'
			style={{
				width: safeWidth,
				height: safeHeight,
				backgroundColor: slide.backgroundColor
					? normalizeHexColor(slide.backgroundColor, '#ffffff')
					: '#ffffff',
				backgroundImage: slide.backgroundImage
					? `url(${slide.backgroundImage})`
					: slide.backgroundGradient
						? slide.backgroundGradient
						: undefined,
				backgroundSize: slide.backgroundImage ? 'cover' : undefined,
				backgroundPosition: slide.backgroundImage ? 'center' : undefined,
			}}
		>
			<SlideBackgroundImageLayer slide={slide} />
			{elements.map((element, index) => (
				<StaticElementRenderer
					key={element.id}
					element={element}
					activeSlide={slide}
					allSlides={[slide]}
					zIndex={index}
				/>
			))}
		</div>
	);
}
