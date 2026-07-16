import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
/**
 * ScaledSlidePreview: renders a slide at any size by scaling the native
 * canvas dimensions into a container-determined bounding box.
 *
 * Used by PresenterView for current-slide and next-slide previews.
 */
import React, { useEffect, useRef, useState } from 'react';

import type { CanvasSize } from '../types';
import { normalizeHexColor } from '../utils';
import { StaticElementRenderer } from './StaticElementRenderer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScaledSlidePreviewProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ScaledSlidePreviewImpl({
	slide,
	templateElements,
	canvasSize,
	className,
}: ScaledSlidePreviewProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				setContainerWidth(entry.contentRect.width);
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const safeCanvasWidth = Math.max(canvasSize.width, 1);
	const safeCanvasHeight = Math.max(canvasSize.height, 1);
	const scale = containerWidth > 0 ? containerWidth / safeCanvasWidth : 0.2;
	const previewHeight = Math.max(40, Math.round(safeCanvasHeight * scale));
	const previewElements = [...templateElements, ...slide.elements].slice(0, 80);

	return (
		<div
			ref={containerRef}
			className={`relative w-full overflow-hidden rounded border border-border bg-white ${className ?? ''}`}
			style={{ height: previewHeight }}
		>
			{slide.backgroundColor && slide.backgroundColor !== 'transparent' && (
				<div
					className='absolute inset-0'
					style={{
						backgroundColor: normalizeHexColor(slide.backgroundColor, '#ffffff'),
					}}
				/>
			)}
			{slide.backgroundImage && (
				<img
					src={slide.backgroundImage}
					alt=''
					className='absolute inset-0 w-full h-full object-cover pointer-events-none'
					draggable={false}
				/>
			)}
			{slide.backgroundGradient && (
				<div className='absolute inset-0' style={{ backgroundImage: slide.backgroundGradient }} />
			)}
			<div
				className='absolute top-0 left-0 origin-top-left'
				style={{
					width: safeCanvasWidth,
					height: safeCanvasHeight,
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
				}}
			>
				{previewElements.map((element, index) => (
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

/**
 * Memo comparator: re-render only when slide identity, dirty/hidden state,
 * elements, template elements, canvas size, or className change.
 */
function arePropsEqual(prev: ScaledSlidePreviewProps, next: ScaledSlidePreviewProps): boolean {
	if (prev.slide.id !== next.slide.id) {
		return false;
	}
	if (prev.slide.isDirty !== next.slide.isDirty) {
		return false;
	}
	if (prev.slide.hidden !== next.slide.hidden) {
		return false;
	}
	if (prev.slide.elements !== next.slide.elements) {
		return false;
	}
	if (prev.slide.backgroundColor !== next.slide.backgroundColor) {
		return false;
	}
	if (prev.slide.backgroundImage !== next.slide.backgroundImage) {
		return false;
	}
	if (prev.slide.backgroundGradient !== next.slide.backgroundGradient) {
		return false;
	}
	if (prev.templateElements !== next.templateElements) {
		return false;
	}
	if (
		prev.canvasSize.width !== next.canvasSize.width ||
		prev.canvasSize.height !== next.canvasSize.height
	) {
		return false;
	}
	if (prev.className !== next.className) {
		return false;
	}
	return true;
}

export const ScaledSlidePreview = React.memo(ScaledSlidePreviewImpl, arePropsEqual);
