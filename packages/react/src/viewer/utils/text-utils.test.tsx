/**
 * Text-body style regressions for issue #131.
 *
 * The element-level `paragraphIndent` / `paragraphMarginLeft` pair is a
 * fallback for single-level text. Applying it on the text body ON TOP of the
 * per-paragraph indents `renderTextSegments` already emits double-counted the
 * indent, and because a hanging indent is negative it dragged every first line
 * back out through the shape's own `lIns` padding - a panel authored with a
 * 0.2" inset rendered flush against its border.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getTextStyleForElement } from './text-utils';

function textEl(extra: Record<string, unknown>): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		text: 'x',
		...extra,
	} as unknown as PptxElement;
}

describe('getTextStyleForElement body insets vs paragraph indents', () => {
	it('keeps the authored lIns/rIns padding as the text-body padding', () => {
		const style = getTextStyleForElement(
			textEl({ textStyle: { bodyInsetLeft: 18.9, bodyInsetRight: 18.9 } }),
			'#000000',
		);
		expect(style.paddingLeft).toBeCloseTo(18.9, 5);
		expect(style.paddingRight).toBeCloseTo(18.9, 5);
	});

	it('drops the element-level indent when per-paragraph indents exist', () => {
		const style = getTextStyleForElement(
			textEl({
				textStyle: {
					bodyInsetLeft: 18.9,
					paragraphIndent: -18,
					paragraphMarginLeft: 18,
				},
				paragraphIndents: [{ marginLeft: 18, indent: -18 }],
			}),
			'#000000',
		);
		// A -18px text-indent here would pull each first line back out of the
		// 18.9px padding, i.e. flush against the shape border.
		expect(style.textIndent).toBe(0);
		expect(style.paddingLeft).toBeCloseTo(18.9, 5);
	});

	it('still applies the element-level indent for single-level text', () => {
		const style = getTextStyleForElement(
			textEl({
				textStyle: { bodyInsetLeft: 7, paragraphIndent: -12, paragraphMarginLeft: 24 },
			}),
			'#000000',
		);
		expect(style.textIndent).toBe(-12);
		expect(style.paddingLeft).toBeCloseTo(31, 5);
	});
});
