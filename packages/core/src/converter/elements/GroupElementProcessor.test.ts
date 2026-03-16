import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { GroupElementProcessor } from './GroupElementProcessor';

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

function makeGroupElement(
	children: PptxElement[] = [],
	overrides: Record<string, unknown> = {},
): PptxElement {
	return {
		type: 'group',
		id: 'grp_1',
		x: 0,
		y: 0,
		width: 500,
		height: 400,
		children,
		...overrides,
	} as unknown as PptxElement;
}

function makeChildElement(id: string): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: `Text ${id}`,
		textSegments: [],
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('groupElementProcessor', () => {
	const processor = new GroupElementProcessor();

	it('reports supported types as group', () => {
		expect(processor.supportedTypes).toStrictEqual(['group']);
	});

	it('returns null for non-group element', async () => {
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

	it('returns null when group has no children', async () => {
		const result = await processor.process(makeGroupElement([]), makeCtx());
		expect(result).toBeNull();
	});

	it('delegates to processElements and joins results', async () => {
		const children = [makeChildElement('c1'), makeChildElement('c2')];
		const ctx = makeCtx({
			processElements: vi.fn(async () => ['Content 1', 'Content 2']),
		});

		const result = await processor.process(makeGroupElement(children), ctx);
		expect(ctx.processElements).toHaveBeenCalledWith(children);
		expect(result).toBe('Content 1\n\nContent 2');
	});

	it('returns null when processElements returns empty array', async () => {
		const children = [makeChildElement('c1')];
		const ctx = makeCtx({
			processElements: vi.fn(async () => []),
		});

		const result = await processor.process(makeGroupElement(children), ctx);
		expect(result).toBeNull();
	});

	it('handles single child', async () => {
		const children = [makeChildElement('c1')];
		const ctx = makeCtx({
			processElements: vi.fn(async () => ['Only child']),
		});

		const result = await processor.process(makeGroupElement(children), ctx);
		expect(result).toBe('Only child');
	});

	it('handles multiple children with blank-line separation', async () => {
		const children = [makeChildElement('a'), makeChildElement('b'), makeChildElement('c')];
		const ctx = makeCtx({
			processElements: vi.fn(async () => ['A', 'B', 'C']),
		});

		const result = await processor.process(makeGroupElement(children), ctx);
		expect(result).toBe('A\n\nB\n\nC');
	});
});
