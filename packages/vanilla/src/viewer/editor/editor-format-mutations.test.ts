import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	adjustFontSize,
	canFormatShape,
	canFormatText,
	changeTextCase,
	clearFormatting,
	patchShapeStyle,
	readTextFormatState,
	setCharacterSpacing,
	setFontFamily,
	setFontSize,
	setTextColor,
	toggleTextProp,
	toggleTextShadow,
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

describe('editor-format-mutations extras', () => {
	it('toggles strikethrough alongside bold/italic/underline', () => {
		const patch = toggleTextProp(textElement(), 'strikethrough') as {
			textStyle: { strikethrough?: boolean };
		};
		expect(patch.textStyle.strikethrough).toBeTruthy();
	});

	it('sets font family element-wide', () => {
		const patch = setFontFamily(textElement(), 'Georgia') as { textStyle: { fontFamily?: string } };
		expect(patch.textStyle.fontFamily).toBe('Georgia');
	});

	it('sets character spacing', () => {
		const patch = setCharacterSpacing(textElement(), -75) as {
			textStyle: { characterSpacing?: number };
		};
		expect(patch.textStyle.characterSpacing).toBe(-75);
	});

	it('toggles a default text shadow on then off', () => {
		const on = toggleTextShadow(textElement()) as { textStyle: { textShadowColor?: string } };
		expect(on.textStyle.textShadowColor).toBe('#000000');

		const el = textElement() as PptxElement & { textStyle: { textShadowColor?: string } };
		el.textStyle.textShadowColor = '#000000';
		const off = toggleTextShadow(el) as { textStyle: { textShadowColor?: string } };
		expect(off.textStyle.textShadowColor).toBeUndefined();
	});

	it('rewrites run text per a change-case mode', () => {
		const el = textElement() as PptxElement & { textSegments: Array<{ text: string }> };
		el.textSegments[0].text = 'hello world';
		const patch = changeTextCase(el, 'upper') as { textSegments: Array<{ text: string }> };
		expect(patch.textSegments[0].text).toBe('HELLO WORLD');
	});

	it('reconciles against a live open inline editor before transforming case', () => {
		// The inline editor is uncontrolled: text typed since the edit session
		// began is not yet on `el.textSegments`. Regression: previously the case
		// transform ran against that stale snapshot, so anything typed since was
		// silently left untransformed once the session committed.
		const surface = document.createElement('div');
		surface.dataset.inlineEditor = '';
		surface.textContent = 'hello world, typed more';
		document.body.appendChild(surface);
		try {
			const el = textElement() as PptxElement & { textSegments: Array<{ text: string }> };
			el.textSegments[0].text = 'hello world'; // stale: missing ", typed more"
			const patch = changeTextCase(el, 'upper') as {
				textSegments: Array<{ text: string }>;
				text: string;
			};
			const combined = patch.textSegments.map((s) => s.text).join('');
			expect(combined).toBe('HELLO WORLD, TYPED MORE');
			expect(patch.text).toBe('HELLO WORLD, TYPED MORE');
		} finally {
			surface.remove();
		}
	});

	it('clears character formatting back to defaults', () => {
		const el = textElement() as PptxElement & {
			textStyle: { bold?: boolean; highlightColor?: string };
		};
		el.textStyle.bold = true;
		el.textStyle.highlightColor = '#ffff00';
		const patch = clearFormatting(el) as {
			textStyle: { bold?: boolean; highlightColor?: string };
		};
		expect(patch.textStyle.bold).toBeFalsy();
		expect(patch.textStyle.highlightColor).toBeUndefined();
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
