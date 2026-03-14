import { describe, it, expect } from 'vitest';
import { InkElementProcessor } from './elements/InkElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement } from '../core';
import { MediaContext } from './media-context';

function makeContext(): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: true,
		processElements: async () => [],
	};
}

function makeInkElement(
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type: 'ink',
		id: 'ink_1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		inkPaths: ['M0 0 L100 100'],
		...overrides,
	} as unknown as PptxElement;
}

describe('InkElementProcessor', () => {
	const processor = new InkElementProcessor();

	// ── Type guard ──────────────────────────────────────────────────

	it('should report supportedTypes as ["ink"]', () => {
		expect(processor.supportedTypes).toEqual(['ink']);
	});

	it('should return null for non-ink elements', async () => {
		const ctx = makeContext();
		const element = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	// ── Stroke count ────────────────────────────────────────────────

	it('should render singular "stroke" for single path', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0 L100 100'],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('1 stroke');
		expect(result).not.toContain('1 strokes');
	});

	it('should render plural "strokes" for multiple paths', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0 L100 100', 'M50 50 L200 200', 'M10 10 L30 30'],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('3 strokes');
	});

	it('should render zero strokes for empty paths array', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: [],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('0 strokes');
	});

	// ── Colors ──────────────────────────────────────────────────────

	it('should include unique colors when 4 or fewer', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0', 'M1 1'],
			inkColors: ['#FF0000', '#0000FF'],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('colors #FF0000, #0000FF');
	});

	it('should deduplicate colors', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0', 'M1 1', 'M2 2'],
			inkColors: ['#FF0000', '#FF0000', '#0000FF'],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('colors #FF0000, #0000FF');
	});

	it('should show count instead of listing when more than 4 unique colors', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0', 'M1 1', 'M2 2', 'M3 3', 'M4 4'],
			inkColors: ['#AA0000', '#BB0000', '#CC0000', '#DD0000', '#EE0000'],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('5 colors');
		expect(result).not.toContain('#AA0000');
	});

	it('should not include colors when inkColors is not provided', async () => {
		const ctx = makeContext();
		const element = makeInkElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('colors');
	});

	it('should not include colors when inkColors array is empty', async () => {
		const ctx = makeContext();
		const element = makeInkElement({ inkColors: [] });
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('colors');
	});

	// ── Tool type ───────────────────────────────────────────────────

	it('should show pen tool type', async () => {
		const ctx = makeContext();
		const element = makeInkElement({ inkTool: 'pen' });
		const result = await processor.process(element, ctx);
		expect(result).toContain('tool pen');
	});

	it('should show highlighter tool type', async () => {
		const ctx = makeContext();
		const element = makeInkElement({ inkTool: 'highlighter' });
		const result = await processor.process(element, ctx);
		expect(result).toContain('tool highlighter');
	});

	it('should show eraser tool type', async () => {
		const ctx = makeContext();
		const element = makeInkElement({ inkTool: 'eraser' });
		const result = await processor.process(element, ctx);
		expect(result).toContain('tool eraser');
	});

	it('should not include tool when inkTool is not set', async () => {
		const ctx = makeContext();
		const element = makeInkElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('tool');
	});

	// ── Opacity ─────────────────────────────────────────────────────

	it('should show average opacity as percentage', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0', 'M1 1'],
			inkOpacities: [0.5, 0.7],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('opacity 60%');
	});

	it('should handle full opacity', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0'],
			inkOpacities: [1.0],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('opacity 100%');
	});

	it('should handle zero opacity', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0'],
			inkOpacities: [0],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('opacity 0%');
	});

	it('should not include opacity when inkOpacities is not provided', async () => {
		const ctx = makeContext();
		const element = makeInkElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('opacity');
	});

	// ── Output structure ────────────────────────────────────────────

	it('should wrap output in italic markers with Ink Drawing label', async () => {
		const ctx = makeContext();
		const element = makeInkElement();
		const result = await processor.process(element, ctx);
		expect(result).toMatch(/^\*\[Ink Drawing: .+\]\*$/);
	});

	it('should separate details with pipe separator', async () => {
		const ctx = makeContext();
		const element = makeInkElement({
			inkPaths: ['M0 0', 'M1 1'],
			inkColors: ['#FF0000'],
			inkTool: 'pen',
			inkOpacities: [0.8, 0.8],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('|');
		// Verify all details are present
		expect(result).toContain('2 strokes');
		expect(result).toContain('colors #FF0000');
		expect(result).toContain('tool pen');
		expect(result).toContain('opacity 80%');
	});
});
