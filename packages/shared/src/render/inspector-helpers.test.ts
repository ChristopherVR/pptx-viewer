import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { fontSizeOf, textFontSizePatch } from './inspector-helpers';

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
