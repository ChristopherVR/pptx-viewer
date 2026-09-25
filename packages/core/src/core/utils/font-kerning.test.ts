/**
 * The Aptos table against PowerPoint's own COM `TextRange.BoundWidth`
 * (anchored between two 'x' glyphs, so the anchors' own extent cancels).
 * Every expectation below is a number PowerPoint reported, not one derived
 * from the table under test.
 */

import { describe, expect, it } from 'vitest';

import { FONT_ADVANCE_TABLES } from './font-advance-widths.generated';
import { decodeKerningPairs } from './font-kerning';
import { measureTextWidth } from './smartart-text-wrap-fit';

const PX_PER_PT = 96 / 72;
const aptos = FONT_ADVANCE_TABLES.Aptos;

/** Measured the way the COM numbers were: between two 'x' anchors, net of 'xx'. */
function widthPt(text: string, sizePt: number): number {
	const px = sizePt * PX_PER_PT;
	return (measureTextWidth(`x${text}x`, px, aptos) - measureTextWidth('xx', px, aptos)) / PX_PER_PT;
}

describe('decodeKerningPairs', () => {
	it('splits each token into its two-character pair and value', () => {
		expect(decodeKerningPairs("To-80.1 AV-37.6 \\'-1 ")).toStrictEqual({
			To: -80.1,
			AV: -37.6,
			"\\'": -1,
		});
	});
});

describe('aptos widths match COM BoundWidth', () => {
	it.each([
		['than the others', 20, 130.68],
		['Node Two has a longer label', 20, 240.58],
		['Node Five', 20, 84.945],
		['To', 20, 18.705],
		['Node Two has a longer label', 37, 443.945],
		['Branch A Grandchild with long text', 37, 545.185],
	])('%s at %dpt is %dpt wide (kerned)', (text, size, com) => {
		expect(Math.abs(widthPt(text, size) - com)).toBeLessThan(0.25);
	});

	it('does not kern below 12pt', () => {
		// COM at 11pt: "To" 11.375, "Node Five" 47.125.
		expect(Math.abs(widthPt('To', 11) - 11.375)).toBeLessThan(0.2);
		expect(Math.abs(widthPt('Node Five', 11) - 47.125)).toBeLessThan(0.2);
	});
});
