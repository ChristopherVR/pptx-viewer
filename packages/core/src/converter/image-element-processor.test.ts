import { describe, it, expect, vi } from 'vitest';
import { ImageElementProcessor } from './elements/ImageElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement, ImagePptxElement, PicturePptxElement } from '../core';
import { MediaContext } from './media-context';

// Minimal valid PNG data URL (1x1 pixel transparent PNG)
const TINY_PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==';

function makeContext(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: false,
		processElements: async () => [],
		...overrides,
	};
}

function makeImageElement(
	overrides: Partial<ImagePptxElement> = {}
): ImagePptxElement {
	return {
		type: 'image',
		id: 'img_1',
		x: 100,
		y: 200,
		width: 400,
		height: 300,
		imageData: TINY_PNG_DATA_URL,
		altText: 'Test image',
		...overrides,
	} as ImagePptxElement;
}

describe('ImageElementProcessor', () => {
	const processor = new ImageElementProcessor();

	it('should support image and picture types', () => {
		expect(processor.supportedTypes).toContain('image');
		expect(processor.supportedTypes).toContain('picture');
	});

	it('should render image as HTML img tag in default mode', async () => {
		const ctx = makeContext();
		const element = makeImageElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('<img src="');
		expect(result).toContain('alt="Test image"');
		expect(result).toContain('width="400"');
		expect(result).toContain('height="300"');
	});

	it('should render image as markdown syntax in semantic mode', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeImageElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toMatch(/!\[Test image\]\(.+\)/);
	});

	it('should save image to media context and use resulting path', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeImageElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('./media/');
	});

	it('should render image with max-width style when layoutScale is set', async () => {
		const ctx = makeContext({ layoutScale: 0.5 });
		const element = makeImageElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('max-width:100%');
		expect(result).toContain('height:auto');
	});

	it('should handle missing imageData gracefully', async () => {
		const ctx = makeContext();
		// Suppress console.error for this test
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const element = makeImageElement({
			imageData: undefined,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Image extraction failed');
		spy.mockRestore();
	});

	it('should use svgData when imageData is not available', async () => {
		const ctx = makeContext({ semanticMode: true });
		const svgDataUrl = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
		const element = makeImageElement({
			imageData: undefined,
			svgData: svgDataUrl,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('./media/');
		expect(result).toMatch(/!\[.*\]\(.+\)/);
	});

	it('should sanitize alt text by removing HTML entities', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeImageElement({
			altText: 'Image&#x20;with&#xA0;entities &amp; more',
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// The alt text should have entities replaced with spaces
		expect(result).not.toContain('&#x20;');
		expect(result).not.toContain('&#xA0;');
	});

	it('should truncate very long alt text', async () => {
		const ctx = makeContext({ semanticMode: true });
		const longAlt = 'A'.repeat(200);
		const element = makeImageElement({
			altText: longAlt,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		// Alt text should be truncated to 100 chars max
		// The final result includes the truncation ellipsis
		const match = result!.match(/!\[([^\]]*)\]/);
		expect(match).not.toBeNull();
		expect(match![1].length).toBeLessThanOrEqual(101); // 100 chars + potential ellipsis character
	});

	it('should handle empty alt text', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element = makeImageElement({
			altText: undefined,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('![]');
	});

	it('should return null for non-image element types', async () => {
		const ctx = makeContext();
		const element = {
			type: 'text',
			id: 'txt_1',
			x: 0, y: 0, width: 100, height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should scale down large images to max display width of 600', async () => {
		const ctx = makeContext();
		const element = makeImageElement({
			width: 1200,
			height: 900,
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('width="600"');
		expect(result).toContain('height="450"');
	});

	it('should handle picture type element identically to image', async () => {
		const ctx = makeContext({ semanticMode: true });
		const element: PicturePptxElement = {
			type: 'picture',
			id: 'pic_1',
			x: 0, y: 0,
			width: 200, height: 150,
			imageData: TINY_PNG_DATA_URL,
			altText: 'A picture',
		} as PicturePptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toMatch(/!\[A picture\]\(.+\)/);
	});
});
