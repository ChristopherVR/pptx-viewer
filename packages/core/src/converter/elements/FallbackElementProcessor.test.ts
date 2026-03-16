import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { FallbackElementProcessor } from './FallbackElementProcessor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {
			saveImage: vi.fn(async () => './media/slide1-zoom-image-001.png'),
		} as unknown as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fallbackElementProcessor', () => {
	const processor = new FallbackElementProcessor();

	it('reports supported types as zoom, contentPart, unknown', () => {
		expect(processor.supportedTypes).toStrictEqual(['zoom', 'contentPart', 'unknown']);
	});

	it('returns null for unsupported element type', async () => {
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

	describe('zoom elements', () => {
		it('renders slide zoom', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_1',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'slide',
				targetSlideIndex: 4,
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toContain('*[Zoom to Slide 5]*');
		});

		it('renders section zoom with section ID', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_2',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'section',
				targetSlideIndex: 2,
				targetSectionId: 'sec_intro',
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toContain('*[Zoom to Section sec_intro (Slide 3)]*');
		});

		it('renders section zoom without section ID', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_3',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'section',
				targetSlideIndex: 0,
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toContain('*[Zoom to Section (Slide 1)]*');
		});

		it('extracts zoom preview from imageData', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_4',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'slide',
				targetSlideIndex: 0,
				imageData: 'data:image/png;base64,zoompreview',
			} as unknown as PptxElement;
			const ctx = makeCtx();
			const result = await processor.process(el, ctx);
			expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
				'data:image/png;base64,zoompreview',
				'slide1-zoom',
			);
			expect(result).toContain('![Zoom preview slide 1]');
		});

		it('uses altText for zoom preview when available', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_5',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'slide',
				targetSlideIndex: 3,
				imageData: 'data:image/png;base64,data',
				altText: 'Overview slide',
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toContain('![Overview slide]');
		});

		it('extracts zoom preview from svgData', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_6',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'slide',
				targetSlideIndex: 1,
				svgData: 'data:image/svg+xml;base64,svgdata',
			} as unknown as PptxElement;
			const ctx = makeCtx();
			await processor.process(el, ctx);
			expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
				'data:image/svg+xml;base64,svgdata',
				'slide1-zoom',
			);
		});

		it('does not extract image when no data URL', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_7',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'slide',
				targetSlideIndex: 0,
				imageData: undefined,
			} as unknown as PptxElement;
			const ctx = makeCtx();
			const result = await processor.process(el, ctx);
			expect(ctx.mediaContext.saveImage).not.toHaveBeenCalled();
			expect(result).toBe('*[Zoom to Slide 1]*');
		});

		it('handles image extraction error gracefully', async () => {
			const el = {
				type: 'zoom',
				id: 'zm_8',
				x: 0,
				y: 0,
				width: 200,
				height: 120,
				zoomType: 'slide',
				targetSlideIndex: 0,
				imageData: 'data:image/png;base64,bad',
			} as unknown as PptxElement;
			const ctx = makeCtx({
				mediaContext: {
					saveImage: vi.fn(async () => {
						throw new Error('Failed');
					}),
				} as unknown as MediaContext,
			});
			const result = await processor.process(el, ctx);
			expect(result).toBe('*[Zoom to Slide 1]*');
		});
	});

	describe('contentPart elements', () => {
		it('renders content part with no ink strokes', async () => {
			const el = {
				type: 'contentPart',
				id: 'cp_1',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toBe('*[Content Part]*');
		});

		it('renders content part with ink strokes', async () => {
			const el = {
				type: 'contentPart',
				id: 'cp_2',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				inkStrokes: [
					{ path: 'M 0 0', color: '#000', width: 1, opacity: 1 },
					{ path: 'M 1 1', color: '#F00', width: 2, opacity: 0.5 },
				],
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toBe('*[Ink Content: 2 strokes]*');
		});

		it('renders singular stroke label', async () => {
			const el = {
				type: 'contentPart',
				id: 'cp_3',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				inkStrokes: [{ path: 'M 0 0', color: '#000', width: 1, opacity: 1 }],
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toBe('*[Ink Content: 1 stroke]*');
		});

		it('renders content part with empty ink strokes array', async () => {
			const el = {
				type: 'contentPart',
				id: 'cp_4',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				inkStrokes: [],
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toBe('*[Content Part]*');
		});
	});

	describe('unknown elements', () => {
		it('renders unsupported element marker', async () => {
			const el = {
				type: 'unknown',
				id: 'unk_1',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
			} as unknown as PptxElement;
			const result = await processor.process(el, makeCtx());
			expect(result).toBe('*[Unsupported Element]*');
		});
	});
});
