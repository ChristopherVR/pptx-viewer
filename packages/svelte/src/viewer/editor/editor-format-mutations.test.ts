import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	adjustFontSizePatch,
	fillOpacityOf,
	highlightColorOf,
	setFillColorPatch,
	setFillOpacityPatch,
	setFontSizePatch,
	setHighlightColorPatch,
	setSolidFillPatch,
	setStrokeColorPatch,
	setStrokeOpacityPatch,
	setStrokeWidthPatch,
	setTextColorPatch,
	strokeOpacityOf,
	strokeWidthOf,
	toggleTextFlagPatch,
} from './editor-format-mutations';

function textEl(over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: 'hi',
		textStyle: { fontSize: 18, color: '#111111' },
		...over,
	} as PptxElement;
}

function shapeEl(over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#ffffff', strokeColor: '#000000', strokeWidth: 1 },
		...over,
	} as PptxElement;
}

describe('text format patches', () => {
	it('toggles bold on/off preserving other text-style fields', () => {
		const on = toggleTextFlagPatch(textEl(), 'bold');
		expect(on.textStyle).toMatchObject({ bold: true, fontSize: 18, color: '#111111' });
		const off = toggleTextFlagPatch(textEl({ textStyle: { bold: true, fontSize: 18 } }), 'bold');
		expect(off.textStyle).toMatchObject({ bold: false });
	});

	it('toggles italic and underline', () => {
		expect(toggleTextFlagPatch(textEl(), 'italic').textStyle).toMatchObject({ italic: true });
		expect(toggleTextFlagPatch(textEl(), 'underline').textStyle).toMatchObject({
			underline: true,
		});
	});

	it('sets and adjusts font size (clamped)', () => {
		expect(setFontSizePatch(textEl(), 32).textStyle?.fontSize).toBeCloseTo(32 * (96 / 72));
		expect(setFontSizePatch(textEl(), 0).textStyle?.fontSize).toBeCloseTo(1 * (96 / 72));
		expect(adjustFontSizePatch(textEl(), 4).textStyle?.fontSize).toBeCloseTo(17.5 * (96 / 72));
		expect(adjustFontSizePatch(textEl(), -100).textStyle?.fontSize).toBeCloseTo(1 * (96 / 72));
	});

	it('sets text colour and highlight colour', () => {
		expect(setTextColorPatch(textEl(), '#ff0000').textStyle).toMatchObject({ color: '#ff0000' });
		const hl = setHighlightColorPatch(textEl(), '#ffff00');
		expect(hl.textStyle).toMatchObject({ highlightColor: '#ffff00', fontSize: 18 });
	});

	it('reads highlight colour with empty-string default', () => {
		expect(highlightColorOf(textEl())).toBe('');
		expect(highlightColorOf(textEl({ textStyle: { highlightColor: '#abcdef' } }))).toBe('#abcdef');
	});
});

describe('shape format patches', () => {
	it('sets fill and stroke colour preserving other shape-style fields', () => {
		expect(setFillColorPatch(shapeEl(), '#123456').shapeStyle).toMatchObject({
			fillColor: '#123456',
			strokeColor: '#000000',
		});
		expect(setStrokeColorPatch(shapeEl(), '#654321').shapeStyle).toMatchObject({
			strokeColor: '#654321',
			fillColor: '#ffffff',
		});
	});

	it('sets stroke width (clamped >= 0) and reads it back', () => {
		expect(setStrokeWidthPatch(shapeEl(), 4).shapeStyle).toMatchObject({ strokeWidth: 4 });
		expect(setStrokeWidthPatch(shapeEl(), -3).shapeStyle).toMatchObject({ strokeWidth: 0 });
		expect(strokeWidthOf(shapeEl({ shapeStyle: { strokeWidth: 7 } }))).toBe(7);
		expect(strokeWidthOf(shapeEl({ shapeStyle: {} }))).toBe(1);
	});

	it('sets fill/stroke opacity (clamped 0..1) preserving other shape-style fields and reads them back', () => {
		expect(setFillOpacityPatch(shapeEl(), 0.5).shapeStyle).toMatchObject({
			fillOpacity: 0.5,
			fillColor: '#ffffff',
		});
		expect(setFillOpacityPatch(shapeEl(), 4).shapeStyle).toMatchObject({ fillOpacity: 1 });
		expect(setFillOpacityPatch(shapeEl(), -1).shapeStyle).toMatchObject({ fillOpacity: 0 });
		expect(fillOpacityOf(shapeEl({ shapeStyle: { fillOpacity: 0.25 } }))).toBe(0.25);
		expect(fillOpacityOf(shapeEl({ shapeStyle: {} }))).toBe(1);

		expect(setStrokeOpacityPatch(shapeEl(), 0.75).shapeStyle).toMatchObject({
			strokeOpacity: 0.75,
			strokeColor: '#000000',
		});
		expect(setStrokeOpacityPatch(shapeEl(), 4).shapeStyle).toMatchObject({ strokeOpacity: 1 });
		expect(setStrokeOpacityPatch(shapeEl(), -1).shapeStyle).toMatchObject({ strokeOpacity: 0 });
		expect(strokeOpacityOf(shapeEl({ shapeStyle: { strokeOpacity: 0.6 } }))).toBe(0.6);
		expect(strokeOpacityOf(shapeEl({ shapeStyle: {} }))).toBe(1);
	});

	it('setSolidFillPatch sets fillColor and forces fillMode back to solid', () => {
		const gradientShape = shapeEl({
			shapeStyle: { fillMode: 'gradient', fillGradientAngle: 45, strokeColor: '#000000' },
		});
		const patch = setSolidFillPatch(gradientShape, '#ff00ff');
		expect(patch.shapeStyle).toMatchObject({
			fillColor: '#ff00ff',
			fillMode: 'solid',
			strokeColor: '#000000',
		});
	});
});
