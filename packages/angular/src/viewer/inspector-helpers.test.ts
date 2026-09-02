/**
 * inspector-helpers.test.ts: Vitest unit tests for the pure inspector helpers.
 */

import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	fillColorOf,
	fontSizeOf,
	isBold,
	isItalic,
	isUnderline,
	shapeStylePatch,
	strokeColorOf,
	textColorOf,
	textStylePatch,
} from './inspector-helpers';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeText(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'txt_1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function makeShape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'shp_1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function makeTable(): PptxElement {
	return {
		type: 'table',
		id: 'tbl_1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
	};
}

// ── fillColorOf ──────────────────────────────────────────────────────────────

describe('fillColorOf', () => {
	it('returns default white when shapeStyle is absent', () => {
		const el = makeShape();
		expect(fillColorOf(el)).toBe('#ffffff');
	});

	it('returns default white when fillColor is absent from shapeStyle', () => {
		const el = makeShape({ shapeStyle: { strokeColor: '#ff0000' } } as Partial<PptxElement>);
		expect(fillColorOf(el)).toBe('#ffffff');
	});

	it('returns the authored fillColor when present', () => {
		const el = makeShape({ shapeStyle: { fillColor: '#aabbcc' } } as Partial<PptxElement>);
		expect(fillColorOf(el)).toBe('#aabbcc');
	});

	it('returns default white for element types without shapeStyle (table)', () => {
		expect(fillColorOf(makeTable())).toBe('#ffffff');
	});
});

// ── strokeColorOf ─────────────────────────────────────────────────────────────

describe('strokeColorOf', () => {
	it('returns default black when shapeStyle is absent', () => {
		expect(strokeColorOf(makeShape())).toBe('#000000');
	});

	it('returns authored strokeColor when present', () => {
		const el = makeShape({ shapeStyle: { strokeColor: '#123456' } } as Partial<PptxElement>);
		expect(strokeColorOf(el)).toBe('#123456');
	});

	it('returns default black for element types without shapeStyle', () => {
		expect(strokeColorOf(makeTable())).toBe('#000000');
	});
});

// ── textColorOf ──────────────────────────────────────────────────────────────

describe('textColorOf', () => {
	it('returns default black when textStyle is absent', () => {
		expect(textColorOf(makeText())).toBe('#000000');
	});

	it('returns authored color when present', () => {
		const el = makeText({ textStyle: { color: '#ff9900' } } as Partial<PptxElement>);
		expect(textColorOf(el)).toBe('#ff9900');
	});

	it('returns default black for element types without textStyle (table)', () => {
		expect(textColorOf(makeTable())).toBe('#000000');
	});
});

// ── fontSizeOf ────────────────────────────────────────────────────────────────

describe('fontSizeOf', () => {
	it('returns 18 as default when textStyle absent (matches PowerPoint own default text style)', () => {
		expect(fontSizeOf(makeText())).toBe(18);
	});

	it('returns authored fontSize when present', () => {
		const el = makeText({ textStyle: { fontSize: 24 } } as Partial<PptxElement>);
		expect(fontSizeOf(el)).toBe(24);
	});

	it('returns 18 for elements without text properties', () => {
		expect(fontSizeOf(makeTable())).toBe(18);
	});
});

// ── isBold / isItalic / isUnderline ──────────────────────────────────────────

describe('isBold', () => {
	it('returns false when textStyle absent', () => {
		expect(isBold(makeText())).toBeFalsy();
	});

	it('returns true when bold is set', () => {
		const el = makeText({ textStyle: { bold: true } } as Partial<PptxElement>);
		expect(isBold(el)).toBeTruthy();
	});
});

describe('isItalic', () => {
	it('returns false when textStyle absent', () => {
		expect(isItalic(makeText())).toBeFalsy();
	});

	it('returns true when italic is set', () => {
		const el = makeText({ textStyle: { italic: true } } as Partial<PptxElement>);
		expect(isItalic(el)).toBeTruthy();
	});
});

describe('isUnderline', () => {
	it('returns false when textStyle absent', () => {
		expect(isUnderline(makeText())).toBeFalsy();
	});

	it('returns true when underline is set', () => {
		const el = makeText({ textStyle: { underline: true } } as Partial<PptxElement>);
		expect(isUnderline(el)).toBeTruthy();
	});
});

// ── shapeStylePatch ───────────────────────────────────────────────────────────

describe('shapeStylePatch', () => {
	it('creates shapeStyle with given fillColor when no prior shapeStyle exists', () => {
		const patch = shapeStylePatch(makeShape(), { fillColor: '#ff0000' });
		expect(patch).toStrictEqual({ shapeStyle: { fillColor: '#ff0000' } });
	});

	it('merges into existing shapeStyle without dropping other fields', () => {
		const el = makeShape({
			shapeStyle: { strokeColor: '#333333', strokeWidth: 2 },
		} as Partial<PptxElement>);
		const patch = shapeStylePatch(el, { fillColor: '#00ff00' });
		expect(patch).toStrictEqual({
			shapeStyle: { strokeColor: '#333333', strokeWidth: 2, fillColor: '#00ff00' },
		});
	});

	it('can update fillColor and strokeColor simultaneously', () => {
		const el = makeShape({
			shapeStyle: { fillColor: '#aaaaaa' },
		} as Partial<PptxElement>);
		const patch = shapeStylePatch(el, { fillColor: '#111111', strokeColor: '#222222' });
		expect(patch).toStrictEqual({
			shapeStyle: { fillColor: '#111111', strokeColor: '#222222' },
		});
	});

	it('works for non-shape elements by building a shapeStyle from scratch', () => {
		const patch = shapeStylePatch(makeTable(), { fillColor: '#ff0000' });
		expect(patch).toStrictEqual({ shapeStyle: { fillColor: '#ff0000' } });
	});
});

// ── textStylePatch ────────────────────────────────────────────────────────────

describe('textStylePatch', () => {
	it('creates textStyle with given color when no prior textStyle exists', () => {
		const patch = textStylePatch(makeText(), { color: '#blue' });
		expect(patch).toStrictEqual({ textStyle: { color: '#blue' } });
	});

	it('merges into existing textStyle without dropping other fields', () => {
		const el = makeText({
			textStyle: { fontSize: 18, bold: true },
		} as Partial<PptxElement>);
		const patch = textStylePatch(el, { italic: true });
		expect(patch).toStrictEqual({
			textStyle: { fontSize: 18, bold: true, italic: true },
		});
	});

	it('overrides existing fields in textStyle correctly', () => {
		const el = makeText({
			textStyle: { fontSize: 14, color: '#000000' },
		} as Partial<PptxElement>);
		const patch = textStylePatch(el, { fontSize: 24, bold: true });
		expect(patch).toStrictEqual({
			textStyle: { fontSize: 24, color: '#000000', bold: true },
		});
	});

	it('works for elements without text properties by building textStyle from scratch', () => {
		const patch = textStylePatch(makeTable(), { color: '#ff0000', fontSize: 16 });
		expect(patch).toStrictEqual({ textStyle: { color: '#ff0000', fontSize: 16 } });
	});

	it('preserves type discriminant - patch does not include type field', () => {
		const patch = textStylePatch(makeText(), { bold: true });
		expect('type' in patch).toBeFalsy();
	});
});
