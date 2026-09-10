import { describe, expect, it } from 'vitest';

import { DEFAULT_FONT_ADVANCE_TABLE } from './font-advance-widths.generated';
import { descendantIndentPt, itemFits } from './smartart-layout-item-font-tier-fit';

// Corpus-derived (round 16): scanned every folded `lin`/`snake` gallery
// fixture's cached `drawing1.xml` for the descendant (`lvl="1"`) paragraph's
// `a:pPr marL`. These pairs are a representative sample of the 30+ distinct
// fixtures checked, spanning several layout families, all reproduced
// EXACTLY by the step function - see `descendantIndentPt`'s own doc comment.
describe('descendantIndentPt', () => {
	it('reproduces the cached marL (in points) for the 7 named COM fixtures and other sampled corpus rows', () => {
		const pairs: Array<[descendantSizePt: number, indentPt: number]> = [
			[19, 13.5], // basic-process--hier5.pptx / vertical-process--hier5.pptx
			[15, 9.0], // basic-process--hier8.pptx
			[37, 22.5], // basic-block-list--hier5.pptx
			[29, 22.5], // basic-block-list--hier8.pptx
			[9, 4.5], // alternating-picture-circles--hier5.pptx
			[20, 18.0], // multidirectional-cycle--hier5.pptx
			[26, 18.0], // basic-venn--hier5.pptx
			[31, 22.5], // closed-chevron-process--hier5.pptx
			[40, 22.5], // vertical-equation--hier5.pptx
		];
		for (const [descendantSizePt, indentPt] of pairs) {
			expect(descendantIndentPt(descendantSizePt)).toBeCloseTo(indentPt, 5);
		}
	});

	it('is a step function with boundaries at exactly descendant size 11/15/19/27 (zero contradictions across the corpus scan)', () => {
		expect(descendantIndentPt(11)).toBeCloseTo(4.5, 5);
		expect(descendantIndentPt(12)).toBeCloseTo(9.0, 5);
		expect(descendantIndentPt(15)).toBeCloseTo(9.0, 5);
		expect(descendantIndentPt(16)).toBeCloseTo(13.5, 5);
		expect(descendantIndentPt(19)).toBeCloseTo(13.5, 5);
		expect(descendantIndentPt(20)).toBeCloseTo(18.0, 5);
		expect(descendantIndentPt(27)).toBeCloseTo(18.0, 5);
		expect(descendantIndentPt(28)).toBeCloseTo(22.5, 5);
	});

	it('extrapolates beyond the sampled 40pt ceiling by continuing the last measured tier width, never shrinking', () => {
		expect(descendantIndentPt(41)).toBeCloseTo(27.0, 5);
		expect(descendantIndentPt(53)).toBeCloseTo(27.0, 5);
		expect(descendantIndentPt(54)).toBeCloseTo(31.5, 5);
	});
});

describe('itemFits', () => {
	const table = DEFAULT_FONT_ADVANCE_TABLE;

	it("wraps a folded descendant's text at the NARROWER indented column, not the item's full width (round 16: fixes round 15's regression by keeping line count self-consistent with the height budget)", () => {
		// A descendant whose text wraps to the SAME line count whether or not
		// the indent narrows its column must still fit - this is the exact
		// shape of `basic-block-list--hier5.pptx`'s/`vertical-process--
		// hier5.pptx`'s previously-regressed descendant texts (round 15).
		const item = {
			rootText: 'Node One',
			descendantTexts: ['Short line'],
			width: 0,
			height: 0,
		};
		const availWidthPx = 300;
		const availHeightPx = 200;
		const rootPx = 24;
		const descendantPx = 19; // falls in the [16,19] tier -> 13.5pt indent
		expect(
			itemFits(item, availWidthPx, availHeightPx, rootPx, descendantPx, table, 0.9),
		).toBeTruthy();
	});

	it('rejects a candidate outright when a single descendant word cannot fit even the narrower indented column', () => {
		const item = {
			rootText: 'Node One',
			descendantTexts: ['Supercalifragilisticexpialidocious'],
			width: 0,
			height: 0,
		};
		// A narrow column where the one long word cannot fit under the indent.
		const availWidthPx = 40;
		const availHeightPx = 500;
		expect(itemFits(item, availWidthPx, availHeightPx, 24, 19, table, 0.9)).toBeFalsy();
	});

	it('a non-folded item (no descendantTexts) is unaffected by the indent column', () => {
		const item = { rootText: 'Node Three', descendantTexts: [], width: 0, height: 0 };
		expect(itemFits(item, 300, 200, 24, 19, table, 0.9)).toBeTruthy();
	});

	it("separateDescendantBox: true skips the root paragraph's own trailing spcAft, letting a candidate that only just overflows WITH it fit (round 23, \"Vertical Bullet List\"'s parentText/childText - childText is a SEPARATE rendered box, never a paragraph physically stacked below parentText's own)", () => {
		const item = {
			rootText: 'Node One',
			descendantTexts: ['Node Two has a longer label'],
			width: 0,
			height: 0,
		};
		const rootPx = 61.33; // 46pt, "Vertical Bullet List"--hier5.pptx's own cached parentText size
		const descendantPx = 48; // 36pt, cached childText size
		const availWidthPx = 800;
		// Chosen so the WITHOUT-spcAft root block plus the descendant block just
		// fits, but the WITH-spcAft version (root's own extra 35% term) does not
		// - the exact boundary this flag moves.
		const availHeightPx = 120;
		expect(
			itemFits(item, availWidthPx, availHeightPx, rootPx, descendantPx, table, 0.9),
		).toBeFalsy();
		expect(
			itemFits(
				{ ...item, separateDescendantBox: true },
				availWidthPx,
				availHeightPx,
				rootPx,
				descendantPx,
				table,
				0.9,
			),
		).toBeTruthy();
	});
});
