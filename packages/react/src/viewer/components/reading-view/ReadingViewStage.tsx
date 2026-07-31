/**
 * The slide surface inside Reading View.
 *
 * Deliberately not `ScaledSlidePreview`: that component caps itself at 80
 * elements because it draws postage-stamp previews where the 81st shape is
 * invisible anyway. Reading View is the deck at full window size, so a cap
 * would silently delete content from the one view whose entire purpose is
 * reading it. Everything else (static renderers, background handling) is the
 * same machinery the presenter previews use.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { READING_VIEW_STAGE_ATTR } from 'pptx-viewer-shared';
import React from 'react';

import type { CanvasSize } from '../../types';
import { normalizeHexColor } from '../../utils';
import { StaticElementRenderer } from '../StaticElementRenderer';

export interface ReadingViewStageProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	/** Fit scale from the shared reading-view layout maths. */
	scale: number;
}

export function ReadingViewStage({
	slide,
	templateElements,
	canvasSize,
	scale,
}: ReadingViewStageProps): React.ReactElement | null {
	if (scale <= 0) {
		// Before the first layout pass there is no honest size to draw at.
		return null;
	}
	const width = Math.max(canvasSize.width, 1);
	const height = Math.max(canvasSize.height, 1);
	const elements = [...templateElements, ...slide.elements];

	return (
		<div
			{...{ [READING_VIEW_STAGE_ATTR]: 'true' }}
			aria-roledescription='slide'
			className='relative overflow-hidden bg-white shadow-2xl'
			style={{ width: width * scale, height: height * scale }}
		>
			{slide.backgroundColor && slide.backgroundColor !== 'transparent' && (
				<div
					className='absolute inset-0'
					style={{ backgroundColor: normalizeHexColor(slide.backgroundColor, '#ffffff') }}
				/>
			)}
			{slide.backgroundImage && (
				<img
					src={slide.backgroundImage}
					alt=''
					className='absolute inset-0 h-full w-full object-cover'
					draggable={false}
				/>
			)}
			{slide.backgroundGradient && (
				<div className='absolute inset-0' style={{ backgroundImage: slide.backgroundGradient }} />
			)}
			<div
				className='absolute left-0 top-0 origin-top-left'
				style={{ width, height, transform: `scale(${scale})` }}
			>
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
		</div>
	);
}
