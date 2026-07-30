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
	it('projects resolved picture bullets into the binding-neutral paragraph model', () => {
		const paragraphs = buildParagraphs(
			textEl([
				{
					text: 'Picture item',
					style: { fontSize: 20 },
					bulletInfo: { imageDataUrl: 'data:image/png;base64,abc', sizePercent: 80 },
				},
			]),
		);

		expect(paragraphs[0]).toMatchObject({
			bulletMarker: undefined,
			bulletPicture: {
				src: 'data:image/png;base64,abc',
				sizePx: 16,
				fallbackMarker: '•',
				accessibleLabel: 'Bullet',
			},
		});
	});

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

	it('projects per-paragraph line-height + space before/after from pPr', () => {
		const paras = buildParagraphs(
			textEl([
				{
					text: 'Prop spacing',
					style: {},
					paragraphProperties: {
						lineSpacing: 1.5,
						paragraphSpacingBefore: 12,
						paragraphSpacingAfter: 6,
					},
				},
				{ text: '\n', style: {} },
				{
					text: 'Exact spacing',
					style: {},
					paragraphProperties: { lineSpacingExactPt: 18 },
				},
			]),
		);
		expect(paras[0]).toMatchObject({ lineHeight: 1.5, spaceBeforePx: 12, spaceAfterPx: 6 });
		// Exact points win over a proportional multiplier and emit a pt string.
		expect(paras[1].lineHeight).toBe('18pt');
		expect(paras[1].spaceBeforePx).toBeUndefined();
	});

	it('leaves spacing undefined when a paragraph has no pPr overrides', () => {
		const paras = buildParagraphs(textEl([{ text: 'plain', style: {} }]));
		expect(paras[0].lineHeight).toBeUndefined();
		expect(paras[0].spaceBeforePx).toBeUndefined();
		expect(paras[0].spaceAfterPx).toBeUndefined();
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

	it('keeps an authored blank line between two paragraphs (issue #131)', () => {
		// `Heading` / blank / `Body` is how the reporter's deck spaces a heading
		// away from the bullet list beneath it. Dropping the blank paragraph
		// collapsed the gap entirely.
		const paras = buildParagraphs(
			textEl([
				{ text: 'Heading', style: {} },
				{ text: '\n', style: {} },
				{ text: '\n', style: {} },
				{ text: 'Body', style: {} },
			]),
		);
		expect(paras).toHaveLength(3);
		expect(paras[1].isEmpty).toBeTruthy();
		expect(paras[1].runs).toHaveLength(0);
		expect(paras.map((p) => p.isEmpty ?? false)).toStrictEqual([false, true, false]);
	});

	it('sizes a blank line from its terminator (endParaRPr) style, not the body default', () => {
		// Core stamps the `a:endParaRPr sz` on the separator that closes an
		// EMPTY paragraph: PowerPoint sizes the blank line like a caret on it
		// (issue #131 follow-up: a 10pt blank line rendered on the 10.5pt body
		// strut, and the error accumulated down the panel).
		const paras = buildParagraphs(
			textEl(
				[
					{ text: 'Heading', style: { fontSize: 14 } },
					{ text: '\n', style: { fontSize: 14 } },
					// terminator of the EMPTY paragraph, carrying the endParaRPr size
					{ text: '\n', style: { fontSize: 13.333 } },
					{ text: 'Body', style: { fontSize: 14 } },
				],
				{ textStyle: { fontSize: 14 } },
			),
		);
		expect(paras).toHaveLength(3);
		expect(paras[1].isEmpty).toBeTruthy();
		expect(paras[1].strutFontSizePx).toBeCloseTo(13.333, 3);
		// A blank line whose terminator matches the body default needs no strut.
		expect(paras[0].strutFontSizePx).toBeUndefined();
	});

	it('drops blank paragraphs that trail the last content', () => {
		const paras = buildParagraphs(
			textEl([
				{ text: 'Body', style: {} },
				{ text: '\n', style: {} },
				{ text: '\n', style: {} },
			]),
		);
		expect(paras).toHaveLength(1);
		expect(paras[0].runs.map((r) => r.text)).toStrictEqual(['Body']);
	});

	it('substitutes field-run text when a fieldContext is supplied', () => {
		const paras = buildParagraphs(
			textEl([
				{ text: 'Page ', style: {} },
				{ text: '0', style: {}, fieldType: 'slidenum' },
			]),
			{ slideNumber: 7 },
		);
		expect(paras[0].runs.map((r) => r.text)).toStrictEqual(['Page ', '7']);
	});

	it('leaves runs unchanged when no fieldContext is supplied', () => {
		const segments: TextSegment[] = [
			{ text: 'Page ', style: {} },
			{ text: '0', style: {}, fieldType: 'slidenum' },
		];
		expect(buildParagraphs(textEl(segments))).toStrictEqual(
			buildParagraphs(textEl(segments), undefined),
		);
		expect(buildParagraphs(textEl(segments))[0].runs.map((r) => r.text)).toStrictEqual([
			'Page ',
			'0',
		]);
	});
});
