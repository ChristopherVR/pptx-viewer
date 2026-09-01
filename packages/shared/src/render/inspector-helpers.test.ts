import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { fontSizeOf } from './inspector-helpers';

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
	it('returns the element textStyle.fontSize when set', () => {
		expect(fontSizeOf(textElement(24))).toBe(24);
	});

	it('falls back to 18 (PowerPoint default text style) when unset', () => {
		expect(fontSizeOf(textElement(undefined))).toBe(18);
	});

	it('falls back to 18 for elements with no text properties at all', () => {
		expect(fontSizeOf(shapeElement())).toBe(18);
	});

	it('prefers the deck presentation default over the 18pt last resort', () => {
		expect(
			fontSizeOf(textElement(undefined), { type: 'body', levelStyles: { 0: { fontSize: 24 } } }),
		).toBe(24);
	});

	it('ignores the presentation default when the element sets its own size', () => {
		expect(
			fontSizeOf(textElement(30), { type: 'body', levelStyles: { 0: { fontSize: 24 } } }),
		).toBe(30);
	});

	it('falls back to 18 when the presentation default has no level-0 font size', () => {
		expect(fontSizeOf(textElement(undefined), { type: 'body', levelStyles: {} })).toBe(18);
	});
});
