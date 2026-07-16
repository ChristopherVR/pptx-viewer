import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderToCanvas } from '../lib/canvas-export';
import { ExportService } from './export.service';

vi.mock(import('../lib/canvas-export'), () => ({
	renderToCanvas: vi.fn(),
}));

describe('copyElementAsPng', () => {
	const write = vi.fn();
	const png = new Blob(['png'], { type: 'image/png' });
	const clipboardItem = vi.fn(function (this: { data: Record<string, Blob> }, data) {
		this.data = data;
	});

	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(globalThis, 'ClipboardItem', {
			configurable: true,
			value: clipboardItem,
		});
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { write },
		});
	});

	it('copies the rendered slide as an image/png clipboard item', async () => {
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(png));
		vi.mocked(renderToCanvas).mockResolvedValue(canvas);

		await new ExportService().copyElementAsPng(document.createElement('div'));

		expect(renderToCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), { scale: 2 });
		expect(clipboardItem).toHaveBeenCalledWith({ 'image/png': png });
		expect(write).toHaveBeenCalledWith([expect.objectContaining({ data: { 'image/png': png } })]);
	});

	it('reports when the image clipboard API is unavailable', async () => {
		Object.defineProperty(globalThis, 'ClipboardItem', {
			configurable: true,
			value: undefined,
		});

		await expect(
			new ExportService().copyElementAsPng(document.createElement('div')),
		).rejects.toThrow('Image clipboard is unavailable');
	});
});

describe('savePresentation', () => {
	it.each([
		['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
		['ppsx', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
		['pptm', 'application/vnd.ms-powerpoint.presentation.macroenabled.12'],
	] as const)('uses the %s package MIME type', (format, expectedType) => {
		const createObjectUrl = vi.fn(() => 'blob:presentation');
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: createObjectUrl,
		});
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);

		new ExportService().savePresentation(new Uint8Array([1, 2, 3]), `deck.${format}`, format);

		expect(createObjectUrl).toHaveBeenCalledWith(expect.objectContaining({ type: expectedType }));
	});
});
