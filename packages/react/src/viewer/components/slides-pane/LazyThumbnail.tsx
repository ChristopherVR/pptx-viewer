import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
/**
 * LazyThumbnail: Defers rendering of a SlideThumbnail until its
 * container enters (or is near) the viewport.
 *
 * Uses IntersectionObserver with a generous rootMargin so thumbnails
 * are rendered slightly before they scroll into view, preventing
 * visible pop-in during normal scrolling.
 *
 * Once a thumbnail has been rendered, it stays rendered (no unloading)
 * to avoid re-creating expensive DOM subtrees when the user scrolls back.
 */
import React, { useEffect, useRef, useState } from 'react';

import { SLIDE_NAV_THUMBNAIL_WIDTH } from '../../constants';
import type { CanvasSize } from '../../types';
import type { TableStyleContext } from '../../utils/table-band-style';
import type { FieldSubstitutionContext } from '../../utils/text-field-substitution';
import { SlideThumbnail } from '../SlideThumbnail';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LazyThumbnailProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	/** Pre-computed preview height so the placeholder matches exactly. */
	previewHeight: number;
	/** Presentation-wide field context (date/header/footer/custom props). */
	fieldContext?: FieldSubstitutionContext;
	/** Theme + table style map for resolving table band/header colours. */
	tableStyleContext?: TableStyleContext;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LazyThumbnailInner({
	slide,
	templateElements,
	canvasSize,
	previewHeight,
	fieldContext,
	tableStyleContext,
}: LazyThumbnailProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}

		// If IntersectionObserver isn't available, render immediately
		if (typeof IntersectionObserver === 'undefined') {
			setIsVisible(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					setIsVisible(true);
					// Once visible, stop observing; we don't unload thumbnails
					observer.disconnect();
				}
			},
			{
				// Pre-render thumbnails 200px before they enter the viewport
				rootMargin: '200px 0px',
			},
		);

		observer.observe(el);

		return () => {
			observer.disconnect();
		};
	}, []);

	return (
		<div ref={containerRef}>
			{isVisible ? (
				<SlideThumbnail
					slide={slide}
					templateElements={templateElements}
					canvasSize={canvasSize}
					fieldContext={fieldContext}
					tableStyleContext={tableStyleContext}
				/>
			) : (
				<div
					className='relative w-full overflow-hidden rounded border border-border bg-muted/30 animate-pulse'
					style={{
						height: previewHeight,
						minWidth: SLIDE_NAV_THUMBNAIL_WIDTH,
					}}
				/>
			)}
		</div>
	);
}

export const LazyThumbnail = React.memo(LazyThumbnailInner);
