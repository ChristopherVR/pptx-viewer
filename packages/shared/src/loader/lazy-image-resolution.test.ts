import type {
	ParsedTableStyleMap,
	PptxElement,
	PptxSlide,
	TablePptxElement,
	TextPptxElement,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	resolveTableCellImageUrls,
	resolveTableStyleImageUrls,
	resolveTextFillBlipUrls,
} from './lazy-image-resolution';

function makeTable(id: string, backgroundImageFillPath?: string): TablePptxElement {
	return {
		id,
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			rows: [
				{
					cells: [
						{
							text: 'a',
							style: backgroundImageFillPath
								? { fillMode: 'image', backgroundImageFillPath }
								: undefined,
						},
					],
				},
			],
			columnWidths: [1],
		},
	};
}

describe('resolveTableCellImageUrls', () => {
	it('returns the same slides reference when nothing needs resolving', async () => {
		const slides = [{ id: 'slide-1', elements: [makeTable('t1')] }] as PptxSlide[];
		const result = await resolveTableCellImageUrls(slides, async () => undefined);
		expect(result).toBe(slides);
	});

	it('resolves via the getImageData callback and patches the slide immutably', async () => {
		const table = makeTable('t1', 'ppt/media/cell1.png');
		const slides = [{ id: 'slide-1', elements: [table] }] as PptxSlide[];
		const calls: string[] = [];

		const result = await resolveTableCellImageUrls(slides, async (path) => {
			calls.push(path);
			return path === 'ppt/media/cell1.png' ? 'blob:resolved-cell1' : undefined;
		});

		expect(calls).toStrictEqual(['ppt/media/cell1.png']);
		expect(result).not.toBe(slides);
		const patchedTable = result[0]!.elements[0] as TablePptxElement;
		expect(patchedTable.tableData?.rows[0]!.cells[0]!.style?.backgroundImageFillData).toBe(
			'blob:resolved-cell1',
		);
	});

	it('swallows a getImageData rejection and leaves the slide unpatched', async () => {
		const table = makeTable('t1', 'ppt/media/cell1.png');
		const slides = [{ id: 'slide-1', elements: [table] }] as PptxSlide[];

		const result = await resolveTableCellImageUrls(slides, async () => {
			throw new Error('network error');
		});

		expect(result).toBe(slides);
	});
});

describe('resolveTableStyleImageUrls', () => {
	it('returns the input map unchanged when there is nothing to resolve', async () => {
		const map = undefined;
		await expect(resolveTableStyleImageUrls(map, async () => undefined)).resolves.toBe(map);
	});

	it('resolves and patches a whole-table-style fill', async () => {
		const tableStyleMap: ParsedTableStyleMap = {
			'style-1': {
				wholeTblFill: { image: { path: 'ppt/media/style1.png' } },
			},
		} as unknown as ParsedTableStyleMap;

		const result = await resolveTableStyleImageUrls(tableStyleMap, async (path) =>
			path === 'ppt/media/style1.png' ? 'blob:resolved-style1' : undefined,
		);

		expect(result).not.toBe(tableStyleMap);
		const entry = result!['style-1'] as unknown as {
			wholeTblFill: { image: { data?: string } };
		};
		expect(entry.wholeTblFill.image.data).toBe('blob:resolved-style1');
	});
});

function makeTextElement(id: string, textFillBlipUrl?: string): TextPptxElement {
	return {
		id,
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		textSegments: [{ text: 'PICTURE FILL', style: textFillBlipUrl ? { textFillBlipUrl } : {} }],
	} as unknown as TextPptxElement;
}

describe('resolveTextFillBlipUrls (audit-text slide 13 regression)', () => {
	it('returns the same slides reference when nothing needs resolving', async () => {
		const slides = [{ id: 'slide-1', elements: [makeTextElement('el1')] }] as PptxSlide[];
		const result = await resolveTextFillBlipUrls(slides, async () => undefined);
		expect(result).toBe(slides);
	});

	it('resolves via the getImageData callback and patches the run immutably', async () => {
		const element = makeTextElement('el1', 'ppt/media/image1.png');
		const slides = [{ id: 'slide-1', elements: [element] }] as PptxSlide[];
		const calls: string[] = [];

		const result = await resolveTextFillBlipUrls(slides, async (path) => {
			calls.push(path);
			return path === 'ppt/media/image1.png' ? 'blob:resolved-image1' : undefined;
		});

		expect(calls).toStrictEqual(['ppt/media/image1.png']);
		expect(result).not.toBe(slides);
		const patched = result[0]!.elements[0] as TextPptxElement;
		expect(patched.textSegments?.[0]?.style?.textFillBlipUrl).toBe('blob:resolved-image1');
		// The original slide/element are untouched (immutable patch).
		expect(element.textSegments?.[0]?.style?.textFillBlipUrl).toBe('ppt/media/image1.png');
	});

	it('resolves a run nested inside a group', async () => {
		const child = makeTextElement('el1', 'ppt/media/image1.png');
		const group = {
			id: 'grp1',
			type: 'group',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			children: [child],
		} as unknown as PptxElement;
		const slides = [{ id: 'slide-1', elements: [group] }] as PptxSlide[];

		const result = await resolveTextFillBlipUrls(slides, async () => 'blob:resolved-image1');

		const patchedGroup = result[0]!.elements[0] as unknown as { children: PptxElement[] };
		const patchedChild = patchedGroup.children[0] as TextPptxElement;
		expect(patchedChild.textSegments?.[0]?.style?.textFillBlipUrl).toBe('blob:resolved-image1');
	});

	it('swallows a getImageData rejection and leaves the slide unpatched', async () => {
		const element = makeTextElement('el1', 'ppt/media/image1.png');
		const slides = [{ id: 'slide-1', elements: [element] }] as PptxSlide[];

		const result = await resolveTextFillBlipUrls(slides, async () => {
			throw new Error('network error');
		});

		expect(result).toBe(slides);
	});
});
