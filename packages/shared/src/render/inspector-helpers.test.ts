import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyStyleToSelectedSegments } from './inline-selection-utils';
import {
	fontSizeOf,
	shapeStylePatch,
	textFontSizePatch,
	textStylePatch,
} from './inspector-helpers';
import { remapTextToSegments } from './remap-text';

function textElement(fontSize?: number): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		textStyle: fontSize === undefined ? undefined : { fontSize },
	} as PptxElement;
}

function shapeElement(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeType: 'rect',
	} as PptxElement;
}

describe('fontSizeOf', () => {
	it('returns the element model size in points when set', () => {
		expect(fontSizeOf(textElement(24))).toBe(18);
		expect(fontSizeOf(textElement(48.1 * (96 / 72)))).toBe(48.1);
	});

	it('falls back to 18 (PowerPoint default text style) when unset', () => {
		expect(fontSizeOf(textElement(undefined))).toBe(18);
	});

	it('falls back to 18 for elements with no text properties at all', () => {
		expect(fontSizeOf(shapeElement())).toBe(18);
	});

	it('prefers the deck presentation default over the 18pt last resort', () => {
		expect(
			fontSizeOf(textElement(undefined), {
				type: 'body',
				levelStyles: { 0: { fontSize: 32 } },
			}),
		).toBe(24);
	});

	it('ignores the presentation default when the element sets its own size', () => {
		expect(
			fontSizeOf(textElement(40), { type: 'body', levelStyles: { 0: { fontSize: 24 } } }),
		).toBe(30);
	});

	it('falls back to 18 when the presentation default has no level-0 font size', () => {
		expect(fontSizeOf(textElement(undefined), { type: 'body', levelStyles: {} })).toBe(18);
	});
});

describe('textFontSizePatch', () => {
	it('updates future body formatting without restyling an explicit custom marker', () => {
		const source: TextSegment = {
			text: '◆ ',
			style: { fontFamily: 'Wingdings', color: '#FF0000' },
			bulletInfo: { char: '◆' },
			paragraphInsertionStyle: {
				fontSize: 40,
				bold: true,
				fontFamily: 'Courier New',
				color: '#007000',
			},
		};
		const element = { ...textElement(), textSegments: [source] } as PptxElement;
		const updates = { fontSize: 24, bold: false, fontFamily: 'Arial', color: '#000000' };
		const patch = textStylePatch(element, updates) as { textSegments: TextSegment[] };
		expect(patch.textSegments[0].style).toStrictEqual(source.style);
		expect(remapTextToSegments('Typed', patch.textSegments, {}).at(-1)?.style).toMatchObject(
			updates,
		);
		expect(source.paragraphInsertionStyle?.bold).toBeTruthy();
	});

	it.each(['', '◆ '])(
		'updates insertion formatting only on the selected runless carrier %j',
		(text) => {
			const hint = { fontSize: 40, bold: true };
			const segments: TextSegment[] = [
				{
					text,
					style: { fontFamily: 'Wingdings', color: '#FF0000' },
					...(text ? { bulletInfo: { char: '◆' } } : {}),
					paragraphInsertionStyle: hint,
				},
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: '', style: {}, paragraphInsertionStyle: hint },
			];
			const styled = applyStyleToSelectedSegments(
				segments,
				{ startSegIdx: 0, startOffset: 0, endSegIdx: 0, endOffset: 0 },
				{ bold: false },
			);
			expect(styled.newSegments[0].paragraphInsertionStyle?.bold).toBeFalsy();
			expect(styled.newSegments.at(-1)?.paragraphInsertionStyle?.bold).toBeTruthy();
			expect(styled.newSegments).toHaveLength(3);
			expect(styled.newSegments[0].text).toBe(text);
			expect(styled.newSegments[0].style).toStrictEqual(segments[0].style);
			expect(
				remapTextToSegments('Typed\n', styled.newSegments, {}).find(
					(segment) => segment.text === 'Typed',
				)?.style.bold,
			).toBeFalsy();
		},
	);

	it('updates the element style and every ordinary text run', () => {
		const element = textElement(16) as Extract<PptxElement, { textStyle?: unknown }>;
		(element as { textSegments?: unknown }).textSegments = [
			{ text: 'First', style: { fontSize: 12, bold: true } },
			{ text: 'Second', style: { fontSize: 20, italic: true } },
		];
		const patch = textFontSizePatch(element, 24);
		expect(patch.textStyle).toMatchObject({ fontSize: 24 });
		expect(patch.textSegments).toStrictEqual([
			{ text: 'First', style: { fontSize: 24, bold: true } },
			{ text: 'Second', style: { fontSize: 24, italic: true } },
		]);
	});
});

describe('shapeStylePatch / textStylePatch theme colour refs (W3-G2)', () => {
	it('carries a fillColorRef/strokeColorRef through the shapeStyle patch', () => {
		const element = shapeElement();
		const patch = shapeStylePatch(element, {
			fillColor: '#4472c4',
			fillColorRef: { scheme: 'accent1' },
		});
		expect(patch.shapeStyle).toMatchObject({
			fillColor: '#4472c4',
			fillColorRef: { scheme: 'accent1' },
		});
	});

	it('explicitly clearing a ref (undefined) overrides a previously-stored one', () => {
		const element = {
			...shapeElement(),
			shapeStyle: { fillColor: '#4472c4', fillColorRef: { scheme: 'accent1' } },
		} as PptxElement;
		const patch = shapeStylePatch(element, { fillColor: '#ff0000', fillColorRef: undefined });
		expect(patch.shapeStyle).toMatchObject({ fillColor: '#ff0000', fillColorRef: undefined });
	});

	it('carries a colorRef through the textStyle patch', () => {
		const element = textElement(16);
		const patch = textStylePatch(element, { color: '#ed7d31', colorRef: { scheme: 'accent2' } });
		expect(patch.textStyle).toMatchObject({ color: '#ed7d31', colorRef: { scheme: 'accent2' } });
	});
});
