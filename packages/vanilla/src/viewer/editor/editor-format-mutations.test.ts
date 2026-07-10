import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	adjustFontSize,
	canFormatShape,
	canFormatText,
	patchShapeStyle,
	readTextFormatState,
	setFontSize,
	setTextColor,
	toggleTextProp,
} from './editor-format-mutations';

function textElement(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hi',
		textStyle: { fontSize: 18 },
		textSegments: [{ text: 'hi', style: { fontSize: 18 } }],
	} as PptxElement;
}

function tableElement(): PptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		tableData: { rows: [], columnWidths: [] },
	} as PptxElement;
}

function shapeElement(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#ffffff', strokeColor: '#000000', strokeWidth: 1 },
	} as PptxElement;
}

describe('editor-format-mutations text', () => {
	it('reports which elements can be text/shape formatted', () => {
		expect(canFormatText(textElement())).toBeTruthy();
		// Text boxes carry shape properties (fill/stroke of the box), so they
		// qualify for shape formatting too (matches core `hasShapeProperties`).
		expect(canFormatShape(textElement())).toBeTruthy();
		expect(canFormatShape(shapeElement())).toBeTruthy();
		expect(canFormatText(undefined)).toBeFalsy();
		expect(canFormatShape(tableElement())).toBeFalsy();
	});

	it('toggles bold on both the element style and every run', () => {
		const patch = toggleTextProp(textElement(), 'bold') as {
			textStyle: { bold?: boolean };
			textSegments: Array<{ style: { bold?: boolean } }>;
		};
		expect(patch.textStyle.bold).toBeTruthy();
		expect(patch.textSegments[0].style.bold).toBeTruthy();
	});

	it('reflects an already-bold element when toggling off', () => {
		const el = textElement() as PptxElement & { textStyle: { bold?: boolean } };
		el.textStyle.bold = true;
		const patch = toggleTextProp(el, 'bold') as { textStyle: { bold?: boolean } };
		expect(patch.textStyle.bold).toBeFalsy();
	});

	it('sets and steps the font size, clamped', () => {
		const set = setFontSize(textElement(), 40) as { textStyle: { fontSize?: number } };
		expect(set.textStyle.fontSize).toBe(40);
		const grown = adjustFontSize(textElement(), 4) as { textStyle: { fontSize?: number } };
		expect(grown.textStyle.fontSize).toBe(22);
		const clamped = setFontSize(textElement(), -100) as { textStyle: { fontSize?: number } };
		expect(clamped.textStyle.fontSize).toBe(1);
	});

	it('reads the effective format state', () => {
		const state = readTextFormatState(textElement());
		expect(state).toMatchObject({ bold: false, italic: false, underline: false, fontSize: 18 });
	});

	it('sets text colour on style + runs', () => {
		const patch = setTextColor(textElement(), '#ff0000') as {
			textStyle: { color?: string };
			textSegments: Array<{ style: { color?: string } }>;
		};
		expect(patch.textStyle.color).toBe('#ff0000');
		expect(patch.textSegments[0].style.color).toBe('#ff0000');
	});
});

describe('editor-format-mutations shape', () => {
	it('merges a fill/stroke patch onto the shape style', () => {
		const patch = patchShapeStyle(shapeElement(), {
			fillColor: '#123456',
			strokeWidth: 3,
		}) as { shapeStyle: { fillColor?: string; strokeColor?: string; strokeWidth?: number } };
		expect(patch.shapeStyle.fillColor).toBe('#123456');
		expect(patch.shapeStyle.strokeWidth).toBe(3);
		// Untouched properties survive the merge.
		expect(patch.shapeStyle.strokeColor).toBe('#000000');
	});

	it('is a no-op patch for a non-shape element (table)', () => {
		expect(patchShapeStyle(tableElement(), { fillColor: '#000000' })).toStrictEqual({});
	});
});
