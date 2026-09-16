import { createImageElement } from 'pptx-viewer-core';
import type { ImagePptxElement } from 'pptx-viewer-core';

import type { CanvasSize } from '../types';

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * Decode a local image File/Blob into a centred element, fitting the slide
 * without upscaling. Dimensions are slide pixels; image bytes are preserved.
 *
 * Resolves null for unsupported/unreadable images, invalid bounds, cancellation,
 * or unavailable browser APIs. Importing this module is safe outside a browser.
 * No slide, selection, history, clipboard, or network state is changed. The
 * caller must still validate its document/slide destination before committing.
 */
export function createImageElementFromFile(
	file: Blob,
	canvasSize: CanvasSize,
	signal?: AbortSignal,
): Promise<ImagePptxElement | null> {
	const { width: canvasWidth, height: canvasHeight } = canvasSize;
	if (
		!file.type.startsWith('image/') ||
		file.size === 0 ||
		!isPositiveFinite(canvasWidth) ||
		!isPositiveFinite(canvasHeight) ||
		signal?.aborted ||
		typeof FileReader === 'undefined' ||
		typeof Image === 'undefined'
	) {
		return Promise.resolve(null);
	}

	return new Promise((resolve) => {
		let reader: FileReader | undefined;
		let image: HTMLImageElement | undefined;
		let settled = false;

		const finish = (element: ImagePptxElement | null): void => {
			if (settled) {
				return;
			}
			settled = true;
			signal?.removeEventListener('abort', abort);
			if (reader) {
				reader.onload = reader.onerror = reader.onabort = null;
				if (reader.readyState === 1) {
					reader.abort();
				}
			}
			if (image) {
				image.onload = image.onerror = null;
				image.removeAttribute('src');
			}
			resolve(element);
		};
		const abort = (): void => finish(null);

		try {
			reader = new FileReader();
			reader.onerror = reader.onabort = abort;
			reader.onload = () => {
				const dataUrl = reader?.result;
				if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
					finish(null);
					return;
				}
				try {
					image = new Image();
					image.onerror = abort;
					image.onload = () => {
						const naturalWidth = image!.naturalWidth;
						const naturalHeight = image!.naturalHeight;
						if (!isPositiveFinite(naturalWidth) || !isPositiveFinite(naturalHeight)) {
							finish(null);
							return;
						}
						const scale = Math.min(1, canvasWidth / naturalWidth, canvasHeight / naturalHeight);
						const width = naturalWidth * scale;
						const height = naturalHeight * scale;
						if (!isPositiveFinite(width) || !isPositiveFinite(height)) {
							finish(null);
							return;
						}
						finish(
							createImageElement(dataUrl, {
								x: (canvasWidth - width) / 2,
								y: (canvasHeight - height) / 2,
								width,
								height,
							}),
						);
					};
					image.src = dataUrl;
				} catch {
					finish(null);
				}
			};
			signal?.addEventListener('abort', abort, { once: true });
			reader.readAsDataURL(file);
		} catch {
			finish(null);
		}
	});
}
