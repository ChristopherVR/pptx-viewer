/**
 * Draw one already-assembled `foreignObject` SVG string (see
 * `render/foreign-object-svg-document.ts`) onto a canvas via an `Image`
 * element. This is the actual "browser rasterises the foreignObject" step:
 * loading the self-contained SVG as an image and drawing it lets the
 * browser's real layout/paint engine produce the pixels, which is what
 * preserves `backdrop-filter`, CSS custom properties and 3D transforms that
 * html2canvas's own renderer cannot.
 *
 * Every image reference inside the SVG must already be a `data:` URI
 * ({@link embedImagesOnClone} in the document builder) for this to succeed:
 * an SVG image that itself references a live cross-origin URL taints the
 * canvas, so this module verifies the draw actually produced readable pixels
 * (a 1x1 `getImageData` probe) and throws a typed error the caller can catch
 * to fall back, rather than silently shipping a blank/erroring export.
 *
 * The SVG is handed to the `Image` as a `data:` URL, never a `blob:` object
 * URL: measured in Chromium (`e2e/export-raster-fidelity.spec.ts`'s
 * diagnosis, 2026-09), the very same `foreignObject` markup with zero
 * external references draws CLEAN from a `data:` URL but TAINTS the canvas
 * when loaded through `URL.createObjectURL`, which silently pushed every
 * export onto the html2canvas fallback. This is the same reason
 * `html-to-image`/`dom-to-image` use `data:` URLs.
 */

/** Thrown when the canvas could not be read back after drawing (taint, or a load failure). */
export class ForeignObjectRasterError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = 'ForeignObjectRasterError';
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = (event) =>
			reject(new ForeignObjectRasterError('SVG image failed to load', event));
		img.src = src;
	});
}

/** The `data:` URL prefix every foreignObject raster image is loaded from. */
export const FOREIGN_OBJECT_SVG_DATA_URL_PREFIX = 'data:image/svg+xml;charset=utf-8,';

/** Encode one wrapped SVG string as the `data:` URL an `Image` can load. */
export function foreignObjectSvgToDataUrl(svg: string): string {
	return `${FOREIGN_OBJECT_SVG_DATA_URL_PREFIX}${encodeURIComponent(svg)}`;
}

/**
 * Rasterise one wrapped SVG string (a single export tile, or the whole
 * slide for the non-tiled case) onto a new canvas sized `outputWidth` x
 * `outputHeight` (the SVG's own `width`/`height` attributes, set by
 * `wrapForeignObjectSvg`, should already match).
 *
 * @throws {ForeignObjectRasterError} if the image fails to load, no 2D
 *   context is available, or the resulting canvas cannot be read back
 *   (tainted by an un-embeddable cross-origin resource).
 */
export async function rasterizeForeignObjectSvg(
	svg: string,
	outputWidth: number,
	outputHeight: number,
	backgroundColor?: string,
): Promise<HTMLCanvasElement> {
	const img = await loadImage(foreignObjectSvgToDataUrl(svg));

	const canvas = document.createElement('canvas');
	canvas.width = outputWidth;
	canvas.height = outputHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new ForeignObjectRasterError('2D canvas context unavailable');
	}
	if (backgroundColor) {
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, outputWidth, outputHeight);
	}
	ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

	try {
		ctx.getImageData(0, 0, 1, 1);
	} catch (cause) {
		throw new ForeignObjectRasterError(
			'Canvas tainted by an un-embedded cross-origin resource',
			cause,
		);
	}

	return canvas;
}
