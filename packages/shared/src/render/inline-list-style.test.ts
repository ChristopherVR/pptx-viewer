import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildInlineListStylePatch } from './inline-list-style';

const element: PptxElement = {
	id: 'text',
	type: 'text',
	x: 0,
	y: 0,
	width: 200,
	height: 100,
	text: 'Body',
	textStyle: { fontSize: 20 },
	textSegments: [
		{
			text: 'Body',
			style: { italic: true },
			bulletInfo: { char: '◆' },
			paragraphLevel: 1,
			paragraphProperties: { spaceAfter: 12 },
			endParaRunProperties: { '@_sz': '2400' },
		},
	],
};

describe('current list style patch', () => {
	it('keeps paragraph metadata on a selected run split without changing other characters', () => {
		const before = structuredClone(element);
		const patch = buildInlineListStylePatch(
			element,
			{ bold: true },
			{ startSegIdx: 0, startOffset: 1, endSegIdx: 0, endOffset: 3 },
		);
		expect(patch?.textSegments?.map((segment) => [segment.text, segment.style.bold])).toStrictEqual(
			[
				['B', undefined],
				['od', true],
				['y', undefined],
			],
		);
		expect(patch?.textSegments?.[0]).toMatchObject({
			paragraphLevel: 1,
			paragraphProperties: { spaceAfter: 12 },
			endParaRunProperties: { '@_sz': '2400' },
		});
		expect(patch?.textStyle).toBeUndefined();
		expect(element).toStrictEqual(before);
	});

	it('combines explicit list and character formatting on the current body', () => {
		const patch = buildInlineListStylePatch(element, { listType: 'numbered', bold: true }, null);
		expect(patch?.textSegments?.some((segment) => segment.bulletInfo?.autoNumType)).toBeTruthy();
		expect(patch?.textSegments?.find((segment) => segment.text === 'Body')?.style).toMatchObject({
			italic: true,
			bold: true,
		});
	});

	it('formats an empty insertion hint independently of its marker display style', () => {
		const empty = {
			...element,
			text: '',
			textSegments: [
				{
					text: '◆ ',
					style: { fontSize: 12 },
					bulletInfo: { char: '◆' },
					paragraphInsertionStyle: { fontSize: 30, italic: true },
				},
			],
		};
		const patch = buildInlineListStylePatch(empty, { fontSize: 40, bold: true }, null);
		expect(patch?.textSegments?.[0].paragraphInsertionStyle).toMatchObject({
			fontSize: 40,
			italic: true,
			bold: true,
		});
		expect(patch?.textSegments?.[0].style.fontSize).toBe(12);
	});

	it('leaves unsupported non-text elements alone', () => {
		expect(
			buildInlineListStylePatch(
				{ id: 'group', type: 'group', x: 0, y: 0, width: 100, height: 100 },
				{ bold: true },
				null,
			),
		).toBeUndefined();
	});
});
