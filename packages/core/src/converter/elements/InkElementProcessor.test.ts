import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { InkElementProcessor } from './InkElementProcessor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {} as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

function makeInkElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'ink',
		id: 'ink_1',
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		inkPaths: ['M 0 0 L 100 100'],
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inkElementProcessor', () => {
	const processor = new InkElementProcessor();

	it('reports supported types as ink', () => {
		expect(processor.supportedTypes).toStrictEqual(['ink']);
	});

	it('returns null for non-ink element', async () => {
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

	it('renders single stroke', async () => {
		const result = await processor.process(makeInkElement(), makeCtx());
		expect(result).toBe('*[Ink Drawing: 1 stroke]*');
	});

	it('renders multiple strokes with plural', async () => {
		const el = makeInkElement({
			inkPaths: ['M 0 0', 'M 1 1', 'M 2 2'],
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toBe('*[Ink Drawing: 3 strokes]*');
	});

	it('includes color information when few unique colors', async () => {
		const el = makeInkElement({
			inkColors: ['#FF0000', '#00FF00', '#FF0000'],
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('colors #FF0000, #00FF00');
	});

	it('shows color count when many unique colors', async () => {
		const el = makeInkElement({
			inkColors: ['#111', '#222', '#333', '#444', '#555'],
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('5 colors');
	});

	it('includes tool type', async () => {
		const el = makeInkElement({ inkTool: 'highlighter' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('tool highlighter');
	});

	it('includes pen tool', async () => {
		const el = makeInkElement({ inkTool: 'pen' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('tool pen');
	});

	it('includes eraser tool', async () => {
		const el = makeInkElement({ inkTool: 'eraser' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('tool eraser');
	});

	it('computes and includes average opacity', async () => {
		const el = makeInkElement({
			inkOpacities: [0.5, 1.0, 0.5],
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('opacity 67%');
	});

	it('renders full opacity as 100%', async () => {
		const el = makeInkElement({
			inkOpacities: [1.0, 1.0],
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('opacity 100%');
	});

	it('combines all details with pipe separator', async () => {
		const el = makeInkElement({
			inkPaths: ['M 0 0', 'M 1 1'],
			inkColors: ['#FF0000'],
			inkTool: 'pen',
			inkOpacities: [0.8],
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('|');
		expect(result).toContain('2 strokes');
		expect(result).toContain('colors #FF0000');
		expect(result).toContain('tool pen');
		expect(result).toContain('opacity 80%');
	});
});
