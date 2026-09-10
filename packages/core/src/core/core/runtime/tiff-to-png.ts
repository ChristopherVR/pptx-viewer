/**
 * Decode the first page of a TIFF into a browser-renderable PNG.
 *
 * Split out of `PptxHandlerRuntimeMediaData.ts` (kept it over the repo's
 * ~300-LOC guidance) as a standalone, `this`-free function.
 *
 * Chromium, Firefox, and most WebKit builds do not decode TIFF files in an
 * `<img>`, while PowerPoint presentations can legally embed `.tif` / `.tiff`
 * picture parts. Keep the decoder browser-only so Node consumers without a
 * canvas implementation retain the existing raw-data fallback.
 *
 * @module runtime/tiff-to-png
 */

export async function decodeTiffToPngBlob(bytes: ArrayBuffer): Promise<Blob | undefined> {
	if (typeof document === 'undefined') {
		return undefined;
	}

	const imported = await import('utif');
	const decoder = ('default' in imported ? imported.default : imported) as typeof import('utif');
	const page = decoder.decode(bytes)[0];
	if (!page) {
		return undefined;
	}
	decoder.decodeImage(bytes, page);

	const width = Number(page.width);
	const height = Number(page.height);
	if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
		return undefined;
	}

	const rgba = new Uint8ClampedArray(decoder.toRGBA8(page));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) {
		return undefined;
	}
	const imageData = context.createImageData(width, height);
	imageData.data.set(rgba);
	context.putImageData(imageData, 0, 0);

	return await new Promise<Blob | undefined>((resolve) => {
		canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/png');
	});
}
