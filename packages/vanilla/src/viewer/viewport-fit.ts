import { calculateViewportFit, resolveViewportFitOptions } from 'pptx-viewer-shared';
import type { CanvasSize, ViewportFitOptions } from 'pptx-viewer-shared';

const DEFAULT_FIT = { fitPadding: 16, maxFitScale: null };

/** Apply explicit host padding to both the CSS box and its fit measurement. */
export function fitViewerViewport(
	viewport: HTMLElement,
	canvasSize: CanvasSize,
	options: ViewportFitOptions,
	presenting: boolean,
): number {
	const policy = presenting ? { fitPadding: 0, maxFitScale: null } : options;
	if (options.fitPadding !== undefined) {
		const { horizontal, vertical } = resolveViewportFitOptions(policy, DEFAULT_FIT).fitPadding;
		viewport.style.padding = `${vertical}px ${horizontal}px`;
	}
	return calculateViewportFit(
		{
			viewportWidth: viewport.clientWidth,
			viewportHeight: viewport.clientHeight,
			canvasWidth: Math.max(canvasSize.width, 1),
			canvasHeight: Math.max(canvasSize.height, 1),
			...policy,
		},
		DEFAULT_FIT,
	).scale;
}
