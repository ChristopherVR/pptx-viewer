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
			// Substituted, not bare: the metric-compatible fallbacks are what keep a
			// binding matching the React reference on a machine without the authored
			// font. See the note in `text-run-style.ts`.
			fontFamily: '"Arial", "Liberation Sans", "Helvetica", sans-serif',
			fontSize: '18px',
			color: '#123456',
			fontWeight: 'bold',
			fontStyle: 'italic',
			textDecoration: 'underline line-through',
		});
	});
});

describe('buildParagraphs autofit + bullet typeface', () => {
	it("scales every authored run size by the body's normAutofit font scale", () => {
		const paras = buildParagraphs(
			textEl([{ text: 'Title', style: { fontSize: 53.33 } }], {
				textStyle: { fontSize: 53.33, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.7 },
			}),
		);
		expect(paras[0].runs[0].style.fontSize).toBe(`${53.33 * 0.7}px`);
	});

	it('leaves run sizes alone when the body does not shrink its text', () => {
		const paras = buildParagraphs(
			textEl([{ text: 'Title', style: { fontSize: 40 } }], { textStyle: { fontSize: 40 } }),
		);
		expect(paras[0].runs[0].style.fontSize).toBe('40px');
	});

	it("paints a bullet with no buFont in the paragraph's own typeface", () => {
		const paras = buildParagraphs(
			textEl([
				{ text: '• ', style: { fontFamily: 'Arial', fontSize: 18 }, bulletInfo: { char: '•' } },
				{ text: 'Bulleted item', style: { fontFamily: 'Arial', fontSize: 18 } },
			]),
		);
		expect(paras[0].bulletStyle.fontFamily).toBe(
			'"Arial", "Liberation Sans", "Helvetica", sans-serif',
		);
	});

	it("takes the marker's weight from its own segment, not the bold body", () => {
		// A bold heading whose core-inserted marker segment is regular: the marker
		// must not inherit the body's 700, or it paints (and measures) heavier
		// than the same marker in React.
		const paras = buildParagraphs(
			textEl(
				[
					{ text: '§ ', style: { fontSize: 14 }, bulletInfo: { char: '§' } },
					{ text: 'Heading', style: { fontSize: 14, bold: true } },
				],
				{ textStyle: { fontSize: 14, bold: true } },
			),
		);
		expect(paras[0].bulletStyle.fontWeight).toBe(400);
		expect(paras[0].bulletStyle.fontStyle).toBe('normal');
	});

	it('shrinks the bullet marker with the body autofit scale', () => {
		const paras = buildParagraphs(
			textEl(
				[
					{ text: '• ', style: { fontSize: 20 }, bulletInfo: { char: '•' } },
					{ text: 'Item', style: { fontSize: 20 } },
				],
				{
					textStyle: { fontSize: 20, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.5 },
				},
			),
		);
		expect(paras[0].bulletStyle.fontSize).toBe('10px');
	});

	it("scales the paragraph's own strut font size by the autofit font scale", () => {
		const paras = buildParagraphs(
			textEl([{ text: 'Title', style: { fontSize: 40 } }], {
				textStyle: { fontSize: 16, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.8 },
			}),
		);
		// Run authored at 40px, body default 16px, autofit shrinks by 0.8:
		// the strut has to re-base to the SHRUNK run size (32px), not the
		// unshrunk authored one, or the paragraph's line box stays sized for
		// text that no longer renders that large.
		expect(paras[0].strutFontSizePx).toBe(32);
	});

	it('reduces the paragraph line-height by the autofit lnSpcReduction', () => {
		const paras = buildParagraphs(
			textEl(
				[
					{
						text: 'Item',
						style: { fontSize: 20 },
						paragraphProperties: { lineSpacing: 1.5 },
					},
				],
				{
					textStyle: {
						fontSize: 20,
						autoFit: true,
						autoFitMode: 'normal',
						autoFitFontScale: 0.8,
						autoFitLineSpacingReduction: 0.2,
					},
				},
			),
		);
		// 1.5 * 1.2 pitch = 1.8, reduced by 20% -> 1.44. Without the reduction
		// reaching the per-paragraph resolver this stays at 1.8, silently
		// defeating PowerPoint's shrink-to-fit line-spacing reduction.
		expect(paras[0].lineHeight).toBeCloseTo(1.44, 10);
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
		expect(paras[0]).toMatchObject({ spaceBeforePx: 12, spaceAfterPx: 6 });
		expect(paras[0].lineHeight).toBeCloseTo(1.8, 10);
		// Exact points win over a proportional multiplier, in px (18pt at 96dpi).
		expect(paras[1].lineHeight).toBe('24px');
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
