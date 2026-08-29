import * as UTIF from 'utif';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { decodeTiffToPngBlob } from './PptxHandlerRuntimeMediaData';

describe('decodeTiffToPngBlob', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('decodes an embedded TIFF into a PNG blob for browser image elements', async () => {
		const sourceRgba = new Uint8Array([17, 34, 51, 255]);
		const tiff = UTIF.encodeImage(sourceRgba, 1, 1);
		const outputPixels = new Uint8ClampedArray(4);
		const putImageData = vi.fn();
		const toBlob = vi.fn((callback: BlobCallback, mimeType?: string) => {
			callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: mimeType }));
		});
		const canvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({
				createImageData: vi.fn(() => ({ data: outputPixels })),
				putImageData,
			})),
			toBlob,
		};
		vi.stubGlobal('document', {
			createElement: vi.fn((tagName: string) => {
				expect(tagName).toBe('canvas');
				return canvas;
			}),
		});

		const png = await decodeTiffToPngBlob(tiff);

		expect(canvas.width).toBe(1);
		expect(canvas.height).toBe(1);
		expect(Array.from(outputPixels)).toStrictEqual(Array.from(sourceRgba));
		expect(putImageData).toHaveBeenCalledOnce();
		expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
		expect(png).toBeInstanceOf(Blob);
		expect(png?.type).toBe('image/png');
	});

	it('leaves TIFF bytes untouched when no browser canvas exists', async () => {
		vi.stubGlobal('document', undefined);

		await expect(decodeTiffToPngBlob(new ArrayBuffer(0))).resolves.toBeUndefined();
	});
});
