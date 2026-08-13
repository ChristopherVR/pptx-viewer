/**
 * Regression tests for the `a:bodyPr` text-body features that used to render in
 * React ONLY (multi-column bodies, tab stops, `@rot`) or in no binding at all
 * (`@anchorCtr`, `@vertOverflow`, the geometry text rectangle `a:rect`).
 *
 * They assert through this binding's own adapter, not through shared, because
 * the defect they cover was exactly that shared had no branch for any of them
 * and this adapter is all the binding contributes.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getTextBlockStyle } from './element-style';

function textShape(overrides: Partial<PptxElement>): PptxElement {
	return {
		id: 't1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: 'hello',
		textStyle: {},
		...overrides,
	} as PptxElement;
}

describe('vue text-body features', () => {
	it('lays a `numCol` body out in columns instead of one flex column', () => {
		const style = getTextBlockStyle(
			textShape({ textStyle: { columnCount: 2, columnSpacing: 16 } } as Partial<PptxElement>),
		);
		expect(style.display).toBe('block');
		expect(style.columnCount).toBe(2);
		expect(style.columnGap).toBe('16px');
	});

	it('advances a tab by `defTabSz` rather than the browser default', () => {
		const style = getTextBlockStyle(
			textShape({ textStyle: { defaultTabSize: 48 } } as Partial<PptxElement>),
		);
		expect(style.tabSize).toBe('48px');
	});

	it('centres the text bounding box for `anchorCtr`', () => {
		const style = getTextBlockStyle(
			textShape({ textStyle: { anchorCenter: true } } as Partial<PptxElement>),
		);
		expect(style.alignItems).toBe('center');
	});

	it('clips a `vertOverflow="clip"` body instead of letting it spill', () => {
		const style = getTextBlockStyle(
			textShape({ textStyle: { vertOverflow: 'clip' } } as Partial<PptxElement>),
		);
		expect(style.overflow).toBe('hidden');
	});

	it('rotates the body for `a:bodyPr/@rot`', () => {
		const style = getTextBlockStyle(
			textShape({ textStyle: { textBodyRotation: 45 } } as Partial<PptxElement>),
		);
		expect(style.transform).toBe('rotate(45deg)');
	});

	// A chevron's `a:rect` at the default adjustment is `l = dx`, `r = w - dx`
	// with `dx = min(w,h) * 50000 / 100000` = 50px on a 200x100 box, so the text
	// sits between the two arrow points instead of over them.
	it('insets text into the geometry text rectangle of a chevron', () => {
		const chevron = getTextBlockStyle(textShape({ shapeType: 'chevron' } as Partial<PptxElement>));
		const plain = getTextBlockStyle(textShape({ shapeType: 'rect' } as Partial<PptxElement>));
		expect(Number.parseFloat(String(plain.paddingLeft))).toBeCloseTo(9.6, 1);
		expect(Number.parseFloat(String(chevron.paddingLeft))).toBeCloseTo(59.6, 1);
		expect(Number.parseFloat(String(chevron.paddingRight))).toBeCloseTo(59.6, 1);
	});
});
