/**
 * Regression tests for the `a:bodyPr` text-body features that used to render in
 * React ONLY (multi-column bodies, tab stops, `@rot`) or in no binding at all
 * (`@anchorCtr`, `@vertOverflow`, the geometry text rectangle `a:rect`).
 *
 * React is the binding that composes the body BOX and the body TYPOGRAPHY as two
 * layers (`getTextLayoutStyle` under `getTextStyleForElement`), so the
 * assertions below are split across both, which is also what proves the shared
 * decisions reach React and not only the four that fold them into one style.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { getTextBodyRotationTransform } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { getTextLayoutStyle } from './text-layout';
import { getTextStyleForElement } from './text-utils';

function textShape(overrides: Record<string, unknown>): PptxElement {
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
	} as unknown as PptxElement;
}

describe('react text-body features', () => {
	it('lays a `numCol` body out in columns instead of one flex column', () => {
		const style = getTextLayoutStyle(
			textShape({ textStyle: { columnCount: 2, columnSpacing: 16 } }),
		);
		expect(style.display).toBe('block');
		expect(style.columnCount).toBe(2);
		expect(style.columnGap).toBe('16px');
	});

	it('advances a tab by `defTabSz` rather than the browser default', () => {
		expect(getTextLayoutStyle(textShape({ textStyle: { defaultTabSize: 48 } })).tabSize).toBe(
			'48px',
		);
	});

	it('centres the text bounding box for `anchorCtr`', () => {
		expect(getTextLayoutStyle(textShape({ textStyle: { anchorCenter: true } })).alignItems).toBe(
			'center',
		);
	});

	it('clips a `vertOverflow="clip"` body instead of letting it spill', () => {
		expect(
			getTextStyleForElement(textShape({ textStyle: { vertOverflow: 'clip' } }), '#000').overflow,
		).toBe('hidden');
	});

	it('rotates the body for `a:bodyPr/@rot`', () => {
		expect(getTextBodyRotationTransform(textShape({ textStyle: { textBodyRotation: 45 } }))).toBe(
			'rotate(45deg)',
		);
	});

	// A chevron's `a:rect` at the default adjustment is `l = dx`, `r = w - dx`
	// with `dx = min(w,h) * 50000 / 100000` = 50px on a 200x100 box, so the text
	// sits between the two arrow points instead of over them.
	it('insets text into the geometry text rectangle of a chevron', () => {
		const chevron = getTextStyleForElement(textShape({ shapeType: 'chevron' }), '#000');
		const plain = getTextStyleForElement(textShape({ shapeType: 'rect' }), '#000');
		expect(plain.paddingLeft).toBeCloseTo(9.6, 1);
		expect(chevron.paddingLeft).toBeCloseTo(59.6, 1);
		expect(chevron.paddingRight).toBeCloseTo(59.6, 1);
	});
});
