import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	autoFitModeOf,
	autoFitModePatch,
	textAdvancedStateOf,
	textWrapOf,
	textWrapPatch,
	vAlignPatch,
} from './text-advanced';

function textEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hi',
		...overrides,
	} as PptxElement;
}

function shapeNoText(): PptxElement {
	return { type: 'table', id: 'tbl1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

describe('vertical anchor (reused from TextAdvancedState)', () => {
	it('defaults to top', () => {
		expect(textAdvancedStateOf(textEl()).vAlign).toBe('top');
	});

	it('vAlignPatch merges vAlign into textStyle, preserving other fields', () => {
		const el = textEl({ textStyle: { fontSize: 24 } });
		const patch = vAlignPatch(el, 'middle');
		expect(patch).toStrictEqual({ textStyle: { fontSize: 24, vAlign: 'middle' } });
	});
});

describe('textWrapOf / textWrapPatch', () => {
	it('defaults to square (wrap on)', () => {
		expect(textWrapOf(textEl())).toBe('square');
	});

	it('reads an explicit textWrap value', () => {
		expect(textWrapOf(textEl({ textStyle: { textWrap: 'none' } }))).toBe('none');
	});

	it('defaults to square for elements without text properties', () => {
		expect(textWrapOf(shapeNoText())).toBe('square');
	});

	it('patches textWrap while preserving other textStyle fields', () => {
		const el = textEl({ textStyle: { bold: true } });
		expect(textWrapPatch(el, 'none')).toStrictEqual({
			textStyle: { bold: true, textWrap: 'none' },
		});
	});

	it('is a no-op patch target for elements without text properties (still returns a shallow textStyle)', () => {
		expect(textWrapPatch(shapeNoText(), 'none')).toStrictEqual({ textStyle: { textWrap: 'none' } });
	});
});

describe('autoFitModeOf / autoFitModePatch', () => {
	it('defaults to none', () => {
		expect(autoFitModeOf(textEl())).toBe('none');
	});

	it('reads an explicit autoFitMode value', () => {
		expect(autoFitModeOf(textEl({ textStyle: { autoFitMode: 'shrink' } }))).toBe('shrink');
	});

	it('patches autoFitMode and derives the legacy autoFit boolean', () => {
		const el = textEl({ textStyle: { fontFamily: 'Arial' } });
		expect(autoFitModePatch(el, 'normal')).toStrictEqual({
			textStyle: { fontFamily: 'Arial', autoFitMode: 'normal', autoFit: true },
		});
		expect(autoFitModePatch(el, 'none')).toStrictEqual({
			textStyle: { fontFamily: 'Arial', autoFitMode: 'none', autoFit: false },
		});
	});
});
