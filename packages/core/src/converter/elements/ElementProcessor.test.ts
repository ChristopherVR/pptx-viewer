import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import { ElementProcessorRegistry } from './ElementProcessor';
import type { ElementProcessor, ElementProcessorContext } from './ElementProcessor';

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

function makeElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'el_1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'Hello',
		textSegments: [],
		...overrides,
	} as unknown as PptxElement;
}

function makeDummyProcessor(
	types: readonly PptxElement['type'][],
	result: string | null = 'processed',
): ElementProcessor {
	return {
		supportedTypes: types,
		process: vi.fn(async () => result),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('elementProcessorRegistry', () => {
	describe('register / getProcessor', () => {
		it('registers and retrieves a processor for a single type', () => {
			const registry = new ElementProcessorRegistry();
			const proc = makeDummyProcessor(['text']);
			registry.register(proc);
			expect(registry.getProcessor('text')).toBe(proc);
		});

		it('registers a processor for multiple types', () => {
			const registry = new ElementProcessorRegistry();
			const proc = makeDummyProcessor(['text', 'shape', 'connector']);
			registry.register(proc);
			expect(registry.getProcessor('text')).toBe(proc);
			expect(registry.getProcessor('shape')).toBe(proc);
			expect(registry.getProcessor('connector')).toBe(proc);
		});

		it('returns null for unregistered types', () => {
			const registry = new ElementProcessorRegistry();
			expect(registry.getProcessor('chart')).toBeNull();
		});

		it('overwrites previous registration for the same type', () => {
			const registry = new ElementProcessorRegistry();
			const proc1 = makeDummyProcessor(['text'], 'first');
			const proc2 = makeDummyProcessor(['text'], 'second');
			registry.register(proc1);
			registry.register(proc2);
			expect(registry.getProcessor('text')).toBe(proc2);
		});
	});

	describe('processElement', () => {
		it('returns null when no processor is registered', async () => {
			const registry = new ElementProcessorRegistry();
			const el = makeElement({ type: 'chart' } as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toBeNull();
		});

		it('delegates to the registered processor', async () => {
			const registry = new ElementProcessorRegistry();
			const proc = makeDummyProcessor(['text'], 'some output');
			registry.register(proc);

			const el = makeElement();
			const ctx = makeCtx();
			const result = await registry.processElement(el, ctx);
			expect(result).toBe('some output');
			expect(proc.process).toHaveBeenCalledWith(el, ctx);
		});

		it('returns null when processor returns null', async () => {
			const registry = new ElementProcessorRegistry();
			const proc = makeDummyProcessor(['text'], null);
			registry.register(proc);

			const result = await registry.processElement(makeElement(), makeCtx());
			expect(result).toBeNull();
		});

		it('prepends hidden marker for hidden elements', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({ hidden: true } as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toContain('*[Hidden]*');
			expect(result).toContain('content');
		});

		it('appends click action URL annotation', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({
				actionClick: {
					url: 'https://example.com',
				},
			} as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toContain('[https://example.com](https://example.com)');
		});

		it('uses tooltip text when available for click action URL', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({
				actionClick: {
					url: 'https://example.com',
					tooltip: 'Click here',
				},
			} as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toContain('[Click here](https://example.com)');
		});

		it('appends slide jump annotation for targetSlideIndex', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({
				actionClick: {
					targetSlideIndex: 4,
				},
			} as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toContain('*Jump to slide 5*');
		});

		it('appends generic action annotation', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({
				actionClick: {
					action: 'ppaction://hlinkshowjump?jump=lastslide',
				},
			} as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toContain('*ppaction://hlinkshowjump?jump=lastslide*');
		});

		it('appends hover action annotation', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({
				actionHover: {
					url: 'https://hover.example.com',
				},
			} as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toContain('[https://hover.example.com](https://hover.example.com)');
		});

		it('appends both click and hover annotations', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({
				actionClick: { url: 'https://click.example.com' },
				actionHover: { url: 'https://hover.example.com' },
			} as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toContain('click.example.com');
			expect(result).toContain('hover.example.com');
		});

		it('does not append action annotation when action is empty', async () => {
			const registry = new ElementProcessorRegistry();
			registry.register(makeDummyProcessor(['text'], 'content'));

			const el = makeElement({
				actionClick: {},
			} as Partial<PptxElement>);
			const result = await registry.processElement(el, makeCtx());
			expect(result).toBe('content');
		});
	});
});
