import { useEffect, useRef, useState } from 'react';

import type { CanvasSize } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresenterSlideFrameProps {
	canvasSize: CanvasSize;
	/** Presenter-console zoom (1 = fit). Applied on top of the fitted size. */
	zoomScale?: number;
	/** Zoom focal point as 0..1 fractions of the slide. */
	zoomOriginX?: number;
	zoomOriginY?: number;
	/** Ink-capture handlers spread onto the framed box. */
	inkProps?: React.HTMLAttributes<HTMLDivElement>;
	children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sizes the presenter console's current-slide box to fit its pane.
 *
 * The framed content (`ScaledSlidePreview`) is width-driven: it measures its
 * own parent and derives a scale from it. That only works when the parent has a
 * definite width, so this resolves one explicitly rather than leaving the box to
 * shrink-wrap. Centring the slide with `align-items: center` and no width made
 * the parent shrink-to-fit, the child's `width: 100%` resolve against an
 * indefinite containing block, and the whole preview collapse to zero width -
 * a black pane with a one-pixel sliver where the current slide should be.
 *
 * Fits on BOTH axes so a short, wide pane letterboxes instead of overflowing.
 */
export function PresenterSlideFrame({
	canvasSize,
	zoomScale = 1,
	zoomOriginX = 0.5,
	zoomOriginY = 0.5,
	inkProps,
	children,
}: PresenterSlideFrameProps) {
	const paneRef = useRef<HTMLDivElement>(null);
	const [pane, setPane] = useState<CanvasSize | null>(null);

	useEffect(() => {
		const el = paneRef.current;
		if (!el) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect && rect.width > 0 && rect.height > 0) {
				setPane({ width: rect.width, height: rect.height });
			}
		});
		observer.observe(el);
		const initial = el.getBoundingClientRect();
		if (initial.width > 0 && initial.height > 0) {
			setPane({ width: initial.width, height: initial.height });
		}
		return () => {
			observer.disconnect();
		};
	}, []);

	const safeWidth = Math.max(canvasSize.width, 1);
	const safeHeight = Math.max(canvasSize.height, 1);
	// Contain-fit the slide, then hand the resulting width to the child, whose
	// own measurement turns it into a render scale.
	const fittedWidth = pane
		? Math.max(1, Math.min(pane.width, (pane.height * safeWidth) / safeHeight))
		: 0;

	return (
		<div ref={paneRef} className='flex min-h-0 w-full flex-1 items-center justify-center'>
			<div
				className='relative transition-transform duration-200'
				style={{
					width: fittedWidth || undefined,
					transform: `scale(${zoomScale})`,
					transformOrigin: `${zoomOriginX * 100}% ${zoomOriginY * 100}%`,
					touchAction: 'none',
				}}
				{...inkProps}
			>
				{fittedWidth > 0 && children}
			</div>
		</div>
	);
}
