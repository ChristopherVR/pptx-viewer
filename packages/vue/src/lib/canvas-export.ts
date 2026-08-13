import type { Options as Html2CanvasOptions } from 'html2canvas-pro';
import { normalizeColorsForCapture, preprocessCssForCapture } from 'pptx-viewer-shared';

/**
 * A drop-in wrapper around `html2canvas-pro` that first normalises modern CSS
 * colour functions (oklch/oklab/lch/lab/color()) to sRGB and applies the shared
 * CSS-preprocessing pass (backdrop-filter, mix-blend-mode, 3D transforms,
 * unsupported features) to the cloned capture document.
 *
 * Vue was the one binding without this wrapper. `useExportWiring` called
 * `html2canvas(stageEl, ...)` directly, so neither pass ran and Vue's PNG / PDF
 * / GIF / WebM output was captured from a document React, Angular, Svelte and
 * Vanilla all preprocess first. That is not a cosmetic difference: the colour
 * normalisation exists because html2canvas cannot parse `oklch()`, which the
 * viewer's own theme tokens are authored in.
 *
 * The pure colour/CSS passes live once in `pptx-viewer-shared`; only this thin
 * html2canvas-pro glue is per-binding, and `html2canvas-pro` is imported
 * dynamically so it stays out of the main bundle until export is used.
 *
 * @example
 * ```ts
 * import { renderToCanvas } from 'pptx-vue-viewer';
 * const canvas = await renderToCanvas(element, { scale: 2 });
 * ```
 */
export async function renderToCanvas(
	element: HTMLElement,
	options: Partial<Html2CanvasOptions> = {},
): Promise<HTMLCanvasElement> {
	const { default: html2canvas } = await import('html2canvas-pro');
	const userOnClone = options.onclone;

	return html2canvas(element, {
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
