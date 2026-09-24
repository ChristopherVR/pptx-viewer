// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import * as downloadHelpers from './download-helpers';
import * as rasterResultModule from './raster-result-to-blob';
import * as rasterizeElementModule from './rasterize-element';
import {
	elementPictureFilename,
	rasterizeElementToDataUrl,
	saveElementAsPicture,
} from './save-element-as-picture';

describe('elementPictureFilename', () => {
	it('uses the element name when present', () => {
		expect(elementPictureFilename('My Shape', 'Shape')).toBe('My Shape.png');
	});

	it('falls back to the translated label when the element has no name', () => {
		expect(elementPictureFilename(undefined, 'Shape')).toBe('Shape.png');
		expect(elementPictureFilename('   ', 'Picture')).toBe('Picture.png');
	});

	it('sanitizes the resulting file name', () => {
		expect(elementPictureFilename('a/b:c', 'Shape')).toBe('a_b_c.png');
	});
});

describe('saveElementAsPicture', () => {
	it('rasterises the node and downloads the resulting PNG blob', async () => {
		const fakeResult = {
			kind: 'canvas',
			canvas: {},
			strategy: 'foreignObject',
			width: 10,
			height: 10,
		};
		const rasterizeSpy = vi
			.spyOn(rasterizeElementModule, 'rasterizeElement')
			.mockResolvedValue(fakeResult as never);
		const fakeBlob = new Blob(['x'], { type: 'image/png' });
		const blobSpy = vi
			.spyOn(rasterResultModule, 'rasterResultToPngBlob')
			.mockResolvedValue(fakeBlob);
		const downloadSpy = vi.spyOn(downloadHelpers, 'downloadBlob').mockReturnValue(undefined);

		const node = document.createElement('div');
		const html2canvasFallback = vi.fn();
		await saveElementAsPicture(node, 100, 50, document, 'Shape 1.png', { html2canvasFallback });

		expect(rasterizeSpy).toHaveBeenCalledWith(node, 100, 50, document, { html2canvasFallback });
		expect(blobSpy).toHaveBeenCalledWith(fakeResult);
		expect(downloadSpy).toHaveBeenCalledWith(fakeBlob, 'Shape 1.png');
	});
});

describe('rasterizeElementToDataUrl', () => {
	it('rasterises the node and returns a PNG data URL instead of downloading', async () => {
		const fakeResult = {
			kind: 'canvas',
			canvas: {},
			strategy: 'foreignObject',
			width: 10,
			height: 10,
		};
		vi.spyOn(rasterizeElementModule, 'rasterizeElement').mockResolvedValue(fakeResult as never);
		const dataUrlSpy = vi
			.spyOn(rasterResultModule, 'rasterResultToPngDataUrl')
			.mockResolvedValue('data:image/png;base64,abc');

		const node = document.createElement('div');
		const result = await rasterizeElementToDataUrl(node, 100, 50, document, {
			html2canvasFallback: vi.fn(),
		});

		expect(dataUrlSpy).toHaveBeenCalledWith(fakeResult);
		expect(result).toBe('data:image/png;base64,abc');
	});
});
