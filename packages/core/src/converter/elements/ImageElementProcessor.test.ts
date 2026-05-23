import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { ImageElementProcessor } from './ImageElementProcessor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {
			saveImage: vi.fn(async () => './media/slide1-image-001.png'),
		} as unknown as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

function makeImageElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'image',
		id: 'img_1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		imagePath: 'ppt/media/image1.png',
		imageData: 'data:image/png;base64,iVBOR',
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('imageElementProcessor', () => {
	const processor = new ImageElementProcessor();

	it('reports supported types as image and picture', () => {
		expect(processor.supportedTypes).toStrictEqual(['image', 'picture']);
	});

	it('returns null for non-image element types', async () => {
		const el = {
			type: 'text',
			id: 'txt_1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('renders an image element with data URL', async () => {
		const ctx = makeCtx();
		const result = await processor.process(makeImageElement(), ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/png;base64,iVBOR',
			'slide1',
		);
		expect(result).toContain('<img src="./media/slide1-image-001.png"');
		expect(result).toContain('width="400"');
		expect(result).toContain('height="300"');
	});

	it('uses alt text when provided', async () => {
		const el = makeImageElement({ altText: 'A beautiful landscape' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('alt="A beautiful landscape"');
	});

	it('sanitises alt text with HTML entities', async () => {
		const el = makeImageElement({ altText: 'Image&#x20;with&#32;entities' });
		const result = await processor.process(el, makeCtx());
		// HTML entities should be replaced with spaces
		expect(result).toContain('alt="Image with entities"');
	});

	it('truncates long alt text', async () => {
		const longAlt = 'A'.repeat(200);
		const el = makeImageElement({ altText: longAlt });
		const result = await processor.process(el, makeCtx());
		// Alt text should be truncated with ellipsis
		expect(result).not.toContain(longAlt);
	});

	it('uses empty alt text when none provided', async () => {
		const el = makeImageElement({ altText: undefined });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('alt=""');
	});

	it('renders semantic mode with markdown image syntax', async () => {
		const el = makeImageElement({ altText: 'Photo' });
		const ctx = makeCtx({ semanticMode: true });
		const result = await processor.process(el, ctx);
		expect(result).toBe('![Photo](./media/slide1-image-001.png)');
	});

	it('uses layout scale responsive style', async () => {
		const el = makeImageElement({ altText: 'Photo' });
		const ctx = makeCtx({ layoutScale: 0.5 });
		const result = await processor.process(el, ctx);
		expect(result).toContain('style="max-width:100%;height:auto"');
		expect(result).not.toContain('width=');
	});

	it('scales down dimensions when width exceeds 600', async () => {
		const el = makeImageElement({ width: 1200, height: 800 });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('width="600"');
		expect(result).toContain('height="400"');
	});

	it('returns default dimensions for zero-sized element', async () => {
		const el = makeImageElement({ width: 0, height: 0 });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('width="100"');
		expect(result).toContain('height="100"');
	});

	it('extracts SVG data when imageData is not available', async () => {
		const el = makeImageElement({
			imageData: undefined,
			svgData: 'data:image/svg+xml;base64,SVGDATA',
		});
		const ctx = makeCtx();
		const result = await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/svg+xml;base64,SVGDATA',
			'slide1',
		);
		expect(result).toContain('<img src=');
	});

	it('returns error message when no extractable image data', async () => {
		const el = makeImageElement({
			imageData: undefined,
			svgData: undefined,
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Image extraction failed');
		expect(result).toContain('slide 1');
	});

	it('returns error when imageData does not start with data:', async () => {
		const el = makeImageElement({
			imageData: 'not-a-data-url',
			svgData: undefined,
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Image extraction failed');
	});

	it('processes picture element type', async () => {
		const el = makeImageElement({ type: 'picture' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('<img src=');
	});

	it('includes slide number in image prefix', async () => {
		const ctx = makeCtx({ slideNumber: 5 });
		await processor.process(makeImageElement(), ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(expect.any(String), 'slide5');
	});
});
