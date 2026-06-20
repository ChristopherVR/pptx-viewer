/**
 * Canvas Export Utilities for the Angular viewer.
 *
 * Provides a safe wrapper around html2canvas that resolves modern CSS colour
 * functions (oklch, oklab, lch, lab, color()) into rgb()/hex before rendering,
 * then applies the full CSS preprocessing pipeline (backdrop-filter,
 * mix-blend-mode, 3D transforms, unsupported features).
 *
 * The pure colour-normalisation passes and the CSS preprocessing now live once
 * in `pptx-viewer-shared` (`export/canvas-color-fix`, `export/css-preprocessing`),
 * inlined here at build time via `../internal/shared-src`. Only the thin
 * `renderToCanvas` wrapper that imports `html2canvas-pro` stays local; `_testing`
 * is re-exported so the colocated unit tests keep their historical import path.
 */
import html2canvasPro from 'html2canvas-pro';
import type { Options as Html2CanvasOptions } from 'html2canvas-pro';

import {
	normalizeColorsForCapture,
	_testing,
} from '../internal/shared-src/export/canvas-color-fix';
import { preprocessCssForCapture } from '../internal/shared-src/export/css-preprocessing';

export { _testing };

/**
 * A drop-in replacement for `html2canvas(element, options)` that first
 * resolves any oklch / oklab / lch / lab / color() values in the cloned
 * DOM to rgb()/hex, preventing parse errors in html2canvas <= 1.x, then
 * applies the CSS preprocessing pipeline.
 *
 * Usage:
 * ```ts
 * import { renderToCanvas } from '../lib/canvas-export';
 * const canvas = await renderToCanvas(element, { scale: 2 });
 * ```
 */
export async function renderToCanvas(
	element: HTMLElement,
	options: Partial<Html2CanvasOptions> = {},
): Promise<HTMLCanvasElement> {
	const userOnClone = options.onclone;

	return html2canvasPro(element, {
		...options,
		onclone: async (doc: Document, clonedEl: HTMLElement) => {
			await normalizeColorsForCapture(doc, clonedEl);
			preprocessCssForCapture(clonedEl);

			if (typeof userOnClone === 'function') {
				userOnClone(doc, clonedEl);
			}
		},
	});
}
