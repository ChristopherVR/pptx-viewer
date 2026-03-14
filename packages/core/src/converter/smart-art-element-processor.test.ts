import { describe, it, expect } from 'vitest';
import { SmartArtElementProcessor } from './elements/SmartArtElementProcessor';
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

function makeSmartArtElement(
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa_1',
		x: 0,
		y: 0,
		width: 600,
		height: 400,
		...overrides,
	} as unknown as PptxElement;
}

describe('SmartArtElementProcessor', () => {
	const processor = new SmartArtElementProcessor();

	// ── Type guard ──────────────────────────────────────────────────

	it('should report supportedTypes as ["smartArt"]', () => {
		expect(processor.supportedTypes).toEqual(['smartArt']);
	});

	it('should return null for non-smartArt elements', async () => {
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

	// ── Empty / missing data ────────────────────────────────────────

	it('should return "no nodes" when smartArtData is undefined', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({ smartArtData: undefined });
		const result = await processor.process(element, ctx);
		expect(result).toBe('*[SmartArt: no nodes]*');
	});

	it('should return "no nodes" when nodes array is empty', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: { nodes: [] },
		});
		const result = await processor.process(element, ctx);
		expect(result).toBe('*[SmartArt: no nodes]*');
	});

	// ── Process layout (ordered) ────────────────────────────────────

	it('should render process layout as ordered list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'process',
				nodes: [
					{ id: 'n1', text: 'Step 1' },
					{ id: 'n2', text: 'Step 2' },
					{ id: 'n3', text: 'Step 3' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: process]*');
		expect(result).toContain('1. Step 1');
		expect(result).toContain('2. Step 2');
		expect(result).toContain('3. Step 3');
	});

	it('should render cycle layout as ordered list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'cycle',
				nodes: [
					{ id: 'n1', text: 'Phase A' },
					{ id: 'n2', text: 'Phase B' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: cycle]*');
		expect(result).toContain('1. Phase A');
		expect(result).toContain('2. Phase B');
	});

	it('should render timeline layout as ordered list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'timeline',
				nodes: [
					{ id: 'n1', text: '2020' },
					{ id: 'n2', text: '2021' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: timeline]*');
		expect(result).toContain('1. 2020');
		expect(result).toContain('2. 2021');
	});

	// ── Hierarchy layout (nested) ───────────────────────────────────

	it('should render hierarchy layout as nested list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'hierarchy',
				nodes: [
					{
						id: 'n1',
						text: 'CEO',
						children: [
							{ id: 'n2', text: 'VP Engineering', children: [] },
							{ id: 'n3', text: 'VP Sales', children: [] },
						],
					},
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: hierarchy]*');
		expect(result).toContain('- CEO');
		expect(result).toContain('  - VP Engineering');
		expect(result).toContain('  - VP Sales');
	});

	it('should render pyramid layout as nested list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'pyramid',
				nodes: [
					{ id: 'n1', text: 'Top' },
					{ id: 'n2', text: 'Middle' },
					{ id: 'n3', text: 'Base' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: pyramid]*');
		expect(result).toContain('- Top');
		expect(result).toContain('- Middle');
		expect(result).toContain('- Base');
	});

	it('should render deeply nested hierarchy', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'hierarchy',
				nodes: [
					{
						id: 'n1',
						text: 'Root',
						children: [
							{
								id: 'n2',
								text: 'Child',
								children: [
									{ id: 'n3', text: 'Grandchild', children: [] },
								],
							},
						],
					},
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('- Root');
		expect(result).toContain('  - Child');
		expect(result).toContain('    - Grandchild');
	});

	// ── List layout (bullet) ────────────────────────────────────────

	it('should render list layout as bullet list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'list',
				nodes: [
					{ id: 'n1', text: 'Item A' },
					{ id: 'n2', text: 'Item B' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('- Item A');
		expect(result).toContain('- Item B');
	});

	it('should render matrix layout as bullet list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'matrix',
				nodes: [
					{ id: 'n1', text: 'Quadrant 1' },
					{ id: 'n2', text: 'Quadrant 2' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: matrix]*');
		expect(result).toContain('- Quadrant 1');
		expect(result).toContain('- Quadrant 2');
	});

	// ── Relationship layout ─────────────────────────────────────────

	it('should render relationship layout with arrow separators', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'relationship',
				nodes: [
					{ id: 'n1', text: 'Cause' },
					{ id: 'n2', text: 'Effect' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Cause -> Effect');
	});

	it('should render single-node relationship as plain text', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'relationship',
				nodes: [{ id: 'n1', text: 'Alone' }],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Alone');
		expect(result).not.toContain('->');
	});

	it('should render empty text relationship nodes as fallback', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'relationship',
				nodes: [
					{ id: 'n1', text: '' },
					{ id: 'n2', text: '' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('SmartArt relationship');
	});

	// ── Unknown / fallback layout ───────────────────────────────────

	it('should render unknown layout type as bullet list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'custom_type',
				nodes: [
					{ id: 'n1', text: 'First' },
					{ id: 'n2', text: 'Second' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: custom_type]*');
		expect(result).toContain('- First');
		expect(result).toContain('- Second');
	});

	it('should use "unknown" when resolvedLayoutType is not set', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				nodes: [{ id: 'n1', text: 'Content' }],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('*[SmartArt: unknown]*');
	});

	// ── Parent ID-based tree resolution ─────────────────────────────

	it('should resolve tree from parentId references', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'hierarchy',
				nodes: [
					{ id: 'root', text: 'Root' },
					{ id: 'child1', text: 'Child 1', parentId: 'root' },
					{ id: 'child2', text: 'Child 2', parentId: 'root' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('- Root');
		expect(result).toContain('  - Child 1');
		expect(result).toContain('  - Child 2');
	});

	// ── Whitespace trimming ─────────────────────────────────────────

	it('should trim whitespace from node text', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'list',
				nodes: [
					{ id: 'n1', text: '  Padded item  ' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('- Padded item');
		expect(result).not.toContain('  Padded item  ');
	});

	it('should skip empty text nodes in ordered list', async () => {
		const ctx = makeContext();
		const element = makeSmartArtElement({
			smartArtData: {
				resolvedLayoutType: 'process',
				nodes: [
					{ id: 'n1', text: 'Step 1' },
					{ id: 'n2', text: '   ' },
					{ id: 'n3', text: 'Step 3' },
				],
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('1. Step 1');
		expect(result).toContain('2. Step 3');
		expect(result).not.toContain('3.');
	});
});
