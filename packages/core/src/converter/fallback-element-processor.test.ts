import { describe, it, expect } from 'vitest';
import { FallbackElementProcessor } from './elements/FallbackElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement } from '../core';
import { MediaContext } from './media-context';

function makeContext(
	overrides: Partial<ElementProcessorContext> = {}
): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: true,
		processElements: async () => [],
		...overrides,
	};
}

describe('FallbackElementProcessor', () => {
	const processor = new FallbackElementProcessor();

	// ── Supported types ─────────────────────────────────────────────

	it('should report supportedTypes as ["zoom", "contentPart", "unknown"]', () => {
		expect(processor.supportedTypes).toEqual([
			'zoom',
			'contentPart',
			'unknown',
		]);
	});

	// ── Non-supported type ──────────────────────────────────────────

	it('should return null for shape element type', async () => {
		const ctx = makeContext();
		const element = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should return null for text element type', async () => {
		const ctx = makeContext();
		const element = {
			type: 'text',
			id: 't1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	// ── Zoom: slide type ────────────────────────────────────────────

	it('should render slide zoom with correct target slide number (1-indexed)', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm1',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 0,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Zoom to Slide 1');
	});

	it('should render slide zoom for slide index 4 as Slide 5', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm2',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 4,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Zoom to Slide 5');
	});

	// ── Zoom: section type ──────────────────────────────────────────

	it('should render section zoom with section ID and slide number', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm3',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'section',
			targetSlideIndex: 2,
			targetSectionId: 'sec_intro',
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Zoom to Section sec_intro (Slide 3)');
	});

	it('should render section zoom without section ID', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm4',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'section',
			targetSlideIndex: 5,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Zoom to Section (Slide 6)');
		expect(result).not.toContain('undefined');
	});

	// ── Zoom: with image ────────────────────────────────────────────

	it('should include zoom preview image when imageData is a data URL', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm5',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 0,
			imageData:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('./media/');
		expect(result).toContain('Zoom preview slide 1');
	});

	it('should include zoom preview image from svgData when imageData is absent', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm6',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 1,
			svgData: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('./media/');
	});

	it('should use custom altText for zoom preview image', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm7',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 0,
			imageData:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
			altText: 'Custom zoom preview',
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Custom zoom preview');
	});

	it('should not include preview image when data is not a data URL', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm8',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 0,
			imageData: '/images/zoom.png',
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('./media/');
	});

	// ── ContentPart: with strokes ───────────────────────────────────

	it('should render contentPart with ink strokes count', async () => {
		const ctx = makeContext();
		const element = {
			type: 'contentPart',
			id: 'cp1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkStrokes: [
				{ path: 'M0 0', color: '#000', width: 1, opacity: 1 },
				{ path: 'M1 1', color: '#000', width: 1, opacity: 1 },
			],
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Ink Content: 2 strokes');
	});

	it('should render singular stroke for contentPart with one stroke', async () => {
		const ctx = makeContext();
		const element = {
			type: 'contentPart',
			id: 'cp2',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkStrokes: [
				{ path: 'M0 0', color: '#000', width: 1, opacity: 1 },
			],
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toContain('Ink Content: 1 stroke');
		expect(result).not.toContain('1 strokes');
	});

	// ── ContentPart: without strokes ────────────────────────────────

	it('should render contentPart without strokes as generic label', async () => {
		const ctx = makeContext();
		const element = {
			type: 'contentPart',
			id: 'cp3',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBe('*[Content Part]*');
	});

	it('should render contentPart with empty strokes array as generic label', async () => {
		const ctx = makeContext();
		const element = {
			type: 'contentPart',
			id: 'cp4',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkStrokes: [],
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBe('*[Content Part]*');
	});

	// ── Unknown element ─────────────────────────────────────────────

	it('should render unknown element type as Unsupported Element', async () => {
		const ctx = makeContext();
		const element = {
			type: 'unknown',
			id: 'u1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBe('*[Unsupported Element]*');
	});

	// ── Output structure ────────────────────────────────────────────

	it('should wrap zoom output in italic markers', async () => {
		const ctx = makeContext();
		const element = {
			type: 'zoom',
			id: 'zm9',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			zoomType: 'slide',
			targetSlideIndex: 0,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toMatch(/^\*\[Zoom to Slide 1\]\*$/);
	});

	it('should wrap contentPart strokes output in italic markers', async () => {
		const ctx = makeContext();
		const element = {
			type: 'contentPart',
			id: 'cp5',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkStrokes: [
				{ path: 'M0 0', color: '#000', width: 1, opacity: 1 },
				{ path: 'M1 1', color: '#000', width: 1, opacity: 1 },
				{ path: 'M2 2', color: '#000', width: 1, opacity: 1 },
			],
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toMatch(/^\*\[Ink Content: 3 strokes\]\*$/);
	});
});
