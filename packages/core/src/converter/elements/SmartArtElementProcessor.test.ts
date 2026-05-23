import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { SmartArtElementProcessor } from './SmartArtElementProcessor';

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

function makeSmartArtElement(
	smartArtData: Record<string, unknown> | undefined,
	overrides: Record<string, unknown> = {},
): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa_1',
		x: 0,
		y: 0,
		width: 600,
		height: 400,
		smartArtData,
		...overrides,
	} as unknown as PptxElement;
}

function makeNode(
	id: string,
	text: string,
	parentId?: string,
	children?: Array<{ id: string; text: string }>,
) {
	return {
		id,
		text,
		parentId,
		children: children?.map((c) => ({ id: c.id, text: c.text, children: [] })),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('smartArtElementProcessor', () => {
	const processor = new SmartArtElementProcessor();

	it('reports supported types as smartArt', () => {
		expect(processor.supportedTypes).toStrictEqual(['smartArt']);
	});

	it('returns null for non-smartArt element', async () => {
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

	it('returns placeholder when smartArtData is undefined', async () => {
		const result = await processor.process(makeSmartArtElement(undefined), makeCtx());
		expect(result).toBe('*[SmartArt: no nodes]*');
	});

	it('returns placeholder when nodes array is empty', async () => {
		const result = await processor.process(makeSmartArtElement({ nodes: [] }), makeCtx());
		expect(result).toBe('*[SmartArt: no nodes]*');
	});

	it('renders bullet list for unknown layout type', async () => {
		const smartArtData = {
			resolvedLayoutType: 'customLayout',
			nodes: [makeNode('1', 'Item A'), makeNode('2', 'Item B')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('*[SmartArt: customLayout]*');
		expect(result).toContain('- Item A');
		expect(result).toContain('- Item B');
	});

	it('renders bullet list for "list" layout', async () => {
		const smartArtData = {
			resolvedLayoutType: 'list',
			nodes: [makeNode('1', 'First'), makeNode('2', 'Second')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('- First');
		expect(result).toContain('- Second');
	});

	it('renders ordered sequence for "process" layout', async () => {
		const smartArtData = {
			resolvedLayoutType: 'process',
			nodes: [makeNode('1', 'Step 1'), makeNode('2', 'Step 2'), makeNode('3', 'Step 3')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('1. Step 1');
		expect(result).toContain('2. Step 2');
		expect(result).toContain('3. Step 3');
	});

	it('renders ordered sequence for "cycle" layout', async () => {
		const smartArtData = {
			resolvedLayoutType: 'cycle',
			nodes: [makeNode('1', 'Phase A'), makeNode('2', 'Phase B')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('1. Phase A');
		expect(result).toContain('2. Phase B');
	});

	it('renders ordered sequence for "timeline" layout', async () => {
		const smartArtData = {
			resolvedLayoutType: 'timeline',
			nodes: [makeNode('1', '2020'), makeNode('2', '2021')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('1. 2020');
		expect(result).toContain('2. 2021');
	});

	it('renders nested list for "hierarchy" layout', async () => {
		const smartArtData = {
			resolvedLayoutType: 'hierarchy',
			nodes: [
				makeNode('1', 'CEO', undefined, [
					{ id: '2', text: 'VP Sales' },
					{ id: '3', text: 'VP Engineering' },
				]),
			],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('- CEO');
		expect(result).toContain('  - VP Sales');
		expect(result).toContain('  - VP Engineering');
	});

	it('renders nested list for "pyramid" layout', async () => {
		const smartArtData = {
			resolvedLayoutType: 'pyramid',
			nodes: [makeNode('1', 'Top', undefined, [{ id: '2', text: 'Middle' }])],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('- Top');
		expect(result).toContain('  - Middle');
	});

	it('renders relationship text with arrows', async () => {
		const smartArtData = {
			resolvedLayoutType: 'relationship',
			nodes: [makeNode('1', 'Cause'), makeNode('2', 'Effect')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('Cause -> Effect');
	});

	it('renders single relationship node without arrow', async () => {
		const smartArtData = {
			resolvedLayoutType: 'relationship',
			nodes: [makeNode('1', 'Only one')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('Only one');
		expect(result).not.toContain('->');
	});

	it('renders relationship placeholder when no text nodes', async () => {
		const smartArtData = {
			resolvedLayoutType: 'relationship',
			nodes: [makeNode('1', '  ')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('*[SmartArt relationship]*');
	});

	it('uses "unknown" when resolvedLayoutType is not set', async () => {
		const smartArtData = {
			nodes: [makeNode('1', 'Node')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('*[SmartArt: unknown]*');
	});

	it('resolves parent-child hierarchy from parentId', async () => {
		const smartArtData = {
			resolvedLayoutType: 'hierarchy',
			nodes: [
				{ id: '1', text: 'Root' },
				{ id: '2', text: 'Child', parentId: '1' },
			],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('- Root');
		expect(result).toContain('  - Child');
	});

	it('filters out empty text nodes in bullet list', async () => {
		const smartArtData = {
			resolvedLayoutType: 'list',
			nodes: [makeNode('1', 'Visible'), makeNode('2', ''), makeNode('3', '  ')],
		};
		const result = await processor.process(makeSmartArtElement(smartArtData), makeCtx());
		expect(result).toContain('- Visible');
		expect(result).not.toContain('- \n');
	});
});
