import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildParagraphs, segmentStyleToCss } from './text-paragraphs';

function textEl(segments: TextSegment[], extra: Record<string, unknown> = {}): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		textSegments: segments,
		...extra,
	} as unknown as PptxElement;
}

describe('segmentStyleToCss', () => {
	it('maps font/size(px)/colour/bold/italic/underline+strike', () => {
		const css = segmentStyleToCss({
			text: 'x',
			style: {
				fontFamily: 'Arial',
				fontSize: 18,
				color: '#123456',
				bold: true,
				italic: true,
				underline: true,
				strikethrough: true,
			},
		});
		expect(css).toMatchObject({
			fontFamily: 'Arial',
			fontSize: '18px',
			color: '#123456',
			fontWeight: 'bold',
			fontStyle: 'italic',
			textDecoration: 'underline line-through',
		});
	});
});

describe('buildParagraphs', () => {
	it('groups runs and splits on paragraph-break segments', () => {
		const paras = buildParagraphs(
			textEl([
				{ text: 'a', style: {} },
				{ text: '\n', style: {} },
				{ text: 'b', style: {} },
			]),
		);
		expect(paras).toHaveLength(2);
		expect(paras[0].runs[0].text).toBe('a');
		expect(paras[1].runs[0].text).toBe('b');
	});

	it('renders a character bullet from a dedicated marker segment and drops it from runs', () => {
		const paras = buildParagraphs(
			textEl([
				{ text: '•', style: {}, bulletInfo: { char: '•' } },
				{ text: 'Item', style: {} },
			]),
		);
		expect(paras[0].bulletMarker).toBe('•');
		expect(paras[0].runs.map((r) => r.text)).toStrictEqual(['Item']);
	});

	it('applies per-paragraph indent from paragraphIndents', () => {
		const paras = buildParagraphs(
			textEl([{ text: 'x', style: {} }], {
				paragraphIndents: { 0: { marginLeft: 40, indent: -20 } },
			}),
		);
		expect(paras[0].marginLeftPx).toBe(40);
		expect(paras[0].textIndentPx).toBe(-20);
	});

	it('suppresses the bullet on an empty paragraph', () => {
		const paras = buildParagraphs(textEl([{ text: '', style: {}, bulletInfo: { char: '•' } }]));
		expect(paras.every((p) => p.bulletMarker === undefined)).toBeTruthy();
	});
});
