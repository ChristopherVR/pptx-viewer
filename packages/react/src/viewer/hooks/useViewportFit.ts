import { calculateViewportFit, resolveViewportFitOptions } from 'pptx-viewer-shared';
import type { ViewportFitOptions } from 'pptx-viewer-shared';
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import type { CanvasSize } from '../types';

const DEFAULT_FIT = { fitPadding: { horizontal: 4, vertical: 16 }, maxFitScale: 1 };

/** Keep measured fit and available selection area on the same host layout policy. */
export function useViewportFit(
	canvasSize: CanvasSize,
	viewportRef: RefObject<HTMLDivElement | null>,
	options: ViewportFitOptions,
) {
	const [editorDimensions, setEditorDimensions] = useState<CanvasSize | null>(null);
	const { fitPadding, maxFitScale } = resolveViewportFitOptions(options, DEFAULT_FIT);
	const { horizontal, vertical } = fitPadding;
	const effectiveEditorDimensions = editorDimensions ?? canvasSize;
	const { scale: fitScale } = calculateViewportFit({
		viewportWidth: effectiveEditorDimensions.width,
		viewportHeight: effectiveEditorDimensions.height,
		canvasWidth: canvasSize.width,
		canvasHeight: canvasSize.height,
		maxFitScale,
	});

	// Preserve the stock decorative allowance unless the host supplies one.
	// Rulers and the host's actual toolbar/sidebar footprint are separate layout.
	useEffect(() => {
		let observer: ResizeObserver | null = null;
		let raf = 0;
		const measure = (element: HTMLElement) => {
			const { availableWidth: width, availableHeight: height } = calculateViewportFit({
				viewportWidth: element.clientWidth,
				viewportHeight: element.clientHeight,
				canvasWidth: canvasSize.width,
				canvasHeight: canvasSize.height,
				fitPadding: { horizontal, vertical },
			});
			// A hidden or not-yet-sized viewport must not reset a valid measurement.
			if (width > 0 && height > 0) {
				setEditorDimensions({ width, height });
			}
		};
		const attach = () => {
			const element = viewportRef.current;
			if (!element) {
				raf = requestAnimationFrame(attach);
				return;
			}
			observer = new ResizeObserver(() => measure(element));
			observer.observe(element);
			measure(element);
		};
		attach();
		return () => {
			cancelAnimationFrame(raf);
			observer?.disconnect();
		};
	}, [viewportRef, canvasSize.width, canvasSize.height, horizontal, vertical]);

	return { editorDimensions, setEditorDimensions, effectiveEditorDimensions, fitScale };
}
