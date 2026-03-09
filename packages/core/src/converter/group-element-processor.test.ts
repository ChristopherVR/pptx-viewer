import { describe, it, expect } from 'vitest';
import { GroupElementProcessor } from './elements/GroupElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement, GroupPptxElement } from '../core';
import { MediaContext } from './media-context';

function makeContext(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: true,
		processElements: async (elements) => {
			// Default: return each element's text for testing
			return elements
				.filter((e) => 'text' in e && (e as Record<string, unknown>).text)
				.map((e) => (e as Record<string, unknown>).text as string);
		},
		...overrides,
	};
}

function makeGroupElement(children: PptxElement[]): GroupPptxElement {
	return {
		type: 'group',
		id: 'grp_1',
		x: 0,
		y: 0,
		width: 960,
		height: 540,
		children,
	} as GroupPptxElement;
}

function makeTextChild(
	id: string,
	text: string,
	x = 0,
	y = 0
): PptxElement {
	return {
		type: 'text',
		id,
		x,
		y,
		width: 200,
		height: 50,
		text,
		textSegments: [
			{ text, style: { fontSize: 14 } },
		],
	} as unknown as PptxElement;
}

describe('GroupElementProcessor', () => {
	const processor = new GroupElementProcessor();

	it('should support only the group type', () => {
		expect(processor.supportedTypes).toEqual(['group']);
	});

	it('should render children by delegating to processElements', async () => {
		const ctx = makeContext();
		const element = makeGroupElement([
			makeTextChild('txt_1', 'First child'),
			makeTextChild('txt_2', 'Second child'),
		]);
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('First child');
		expect(result).toContain('Second child');
	});

	it('should join child outputs with double newline', async () => {
		const ctx = makeContext();
		const element = makeGroupElement([
			makeTextChild('txt_1', 'Alpha'),
			makeTextChild('txt_2', 'Beta'),
		]);
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toBe('Alpha\n\nBeta');
	});

	it('should return null for group with no children', async () => {
		const ctx = makeContext();
		const element = makeGroupElement([]);
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should return null when all children produce empty output', async () => {
		const ctx = makeContext({
			processElements: async () => [],
		});
		const element = makeGroupElement([
			makeTextChild('txt_1', ''),
		]);
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should return null for non-group element type', async () => {
		const ctx = makeContext();
		const element = {
			type: 'text',
			id: 'txt_1',
			x: 0, y: 0, width: 100, height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should handle nested groups through processElements delegation', async () => {
		const innerGroup = makeGroupElement([
			makeTextChild('txt_inner', 'Nested content'),
		]);
		const outerGroup = makeGroupElement([innerGroup]);

		// processElements returns what it receives
		const ctx = makeContext({
			processElements: async (elements) => {
				const results: string[] = [];
				for (const el of elements) {
					if (el.type === 'group') {
						const g = el as GroupPptxElement;
						if (g.children.length > 0) {
							const childTexts = g.children
								.filter((c) => 'text' in c && (c as Record<string, unknown>).text)
								.map((c) => (c as Record<string, unknown>).text as string);
							if (childTexts.length > 0) {
								results.push(childTexts.join(', '));
							}
						}
					} else if ('text' in el && (el as Record<string, unknown>).text) {
						results.push((el as Record<string, unknown>).text as string);
					}
				}
				return results;
			},
		});

		const result = await processor.process(outerGroup, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Nested content');
	});

	it('should handle single child group', async () => {
		const ctx = makeContext();
		const element = makeGroupElement([
			makeTextChild('txt_1', 'Only child'),
		]);
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toBe('Only child');
	});

	it('should handle group with mixed element types', async () => {
		const children: PptxElement[] = [
			makeTextChild('txt_1', 'Text element'),
			{
				type: 'image',
				id: 'img_1',
				x: 0, y: 0, width: 100, height: 100,
				imageData: 'data:image/png;base64,abc',
			} as unknown as PptxElement,
		];

		const ctx = makeContext({
			processElements: async (elements) => {
				return elements.map((el) => {
					if (el.type === 'text') return 'Text rendered';
					if (el.type === 'image') return 'Image rendered';
					return '';
				}).filter(Boolean);
			},
		});

		const element = makeGroupElement(children);
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Text rendered');
		expect(result).toContain('Image rendered');
	});
});
