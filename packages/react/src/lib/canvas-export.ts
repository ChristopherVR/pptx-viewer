import type { Options as Html2CanvasOptions } from 'html2canvas-pro';
/**
 * Canvas Export Utilities
 *
 * Provides a safe wrapper around html2canvas that resolves modern CSS colour
 * functions (oklch, oklab, lch, lab, color()) into rgb()/hex before rendering,
 * then applies the full CSS preprocessing pipeline (backdrop-filter,
 * mix-blend-mode, 3D transforms, unsupported features).
 *
 * The pure colour-normalisation passes (blob -> data URL conversion, oklch ->
 * sRGB conversion, stylesheet patching) now live once in `pptx-viewer-shared`
 * (`export/canvas-color-fix`); only the thin `renderToCanvas` wrapper that
 * imports `html2canvas-pro` stays here. `_testing` is re-exported so the
 * colocated unit tests keep their historical import path.
 */
import { normalizeColorsForCapture, preprocessCssForCapture, _testing } from 'pptx-viewer-shared';

export { _testing };

/**
 * A drop-in replacement for `html2canvas(element, options)` that first
 * resolves any oklch / oklab / lch / lab / color() values in the cloned
 * DOM to rgb()/hex, preventing parse errors in html2canvas <= 1.x.
 *
 * Three-pronged approach:
 * 1. Patch `<style>` elements to replace oklch in CSS custom properties.
 * 2. Resolve `:root` / `<body>` inline custom properties.
 * 3. Walk every element and convert computed colour values to sRGB.
 *
 * Usage:
 * ```ts
 * import { renderToCanvas } from "../lib/canvas-export";
 * const canvas = await renderToCanvas(element, { scale: 2 });
 * ```
 */
export async function renderToCanvas(
	element: HTMLElement,
	options: Partial<Html2CanvasOptions> = {},
): Promise<HTMLCanvasElement> {
	const userOnClone = options.onclone;
	const { default: html2canvasPro } = await import('html2canvas-pro');

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
