/**
 * DiagramML hierarchy interpreter vs. genuine PowerPoint output.
 *
 * `smartart-orgchart-hierarchy-roundtrip.test.ts` exercises `hierBranch` /
 * `orgChart` / `chMax` / `chPref` against HAND-BUILT typed fixtures (a
 * `PptxSmartArtLayoutDefinition` and `PptxSmartArtNode[]` written directly in
 * the test), because no genuine PowerPoint org chart existed anywhere in the
 * corpus. That left the interpreter's shape of these hints unverified against
 * real markup, which mattered: real PowerPoint scatters `presLayoutVars`
 * across MULTIPLE presentation-tree points (see `smartart-pres-layout-vars.ts`),
 * a shape no hand-built fixture reproduced.
 *
 * This suite loads the three genuine, COM-authored fixtures added alongside it
 * (`smartart-orgchart-hierbranch.pptx`, `smartart-orgchart-many.pptx`,
 * `smartart-orgchart-nested-hang.pptx`; see `fixtures/corpus/README.md`) and
 * checks three things:
 *
 *   1. `parseSmartArtPresLayoutVars` recovers the hint PowerPoint actually
 *      wrote (the `hierBranch` value behind each slide's
 *      `SmartArtNode.OrgChartLayout`, and the real `chPref=3` grouping
 *      threshold), not a value silently dropped by an incomplete scan.
 *   2. The DiagramML interpreter's own layout (`computeSmartArtElementsWithoutCache`,
 *      which never consults the cached drawing) agrees with the TOPOLOGY of
 *      PowerPoint's own cached `dsp:` drawing (also present on these
 *      fixtures, since the interpreter runs whether or not a cache exists):
 *      which nodes share a row, which form a hanging column, and how many
 *      columns/rows a `chPref`-grouped generation gets. Exact pixel
 *      coordinates are NOT compared for this part: the two layouts use
 *      unrelated box-sizing constants, and PowerPoint's own cached drawing
 *      additionally contains decorative connector rectangles (an artifact of
 *      the "Simple" quick style) that are not part of the data model and that
 *      this interpreter correctly does not fabricate.
 *   3. The `hierAlign`/`alignOff` root-box alignment offset (see
 *      `HIER_TAIL_OFFSET_RATIO`'s doc comment in `smartart-hierarchy-shared.ts`)
 *      is pinned to a NORMALISED position, not just topology: `(child.x -
 *      parent.x) / parent.width`, which cancels out the two interpreters'
 *      different absolute box-sizing constants. Computed off the RAW EMU
 *      offsets in the cached drawing's own XML, that ratio is exactly 0.25 in
 *      every sampled case (four `hierBranch` variants at generation 2, plus
 *      generation 3 in `smartart-orgchart-nested-hang.pptx`); `drawingShapes`
 *      (this suite's own read path, same as every binding's renderer) stores
 *      already-rounded-to-the-pixel EMU-derived coordinates, which reintroduces
 *      up to roughly one pixel of quantisation noise on a ~150px box (about
 *      0.007 of box width) purely from rounding two independent coordinates
 *      before dividing. `toBeCloseTo(cachedRatio, 1)` (0.05 tolerance) below
 *      is chosen comfortably above that measured noise floor while still
 *      catching a regression to the previous flush-with-parent (ratio 0) bug,
 *      which this tolerance would reject by more than 4x.
 *   4. In `smartart-orgchart-nested-hang.pptx`, Report B's own direct
 *      children (Team 1/2/3) reach `chPref=3` while Report B's own
 *      generation (Report A/B/C) is also exactly `chPref`-wide: genuine
 *      PowerPoint output fans Team 1/2/3 across Report A/B/C's own columns
 *      one generation down instead of hanging them in one narrow column
 *      under Report B. Unlike check 2 above, this one DOES compare
 *      near-exact positions (`toBeCloseTo(_, 0)` on each interpreter's own
 *      coordinates, not cross-interpreter): Team i's x is expected to
 *      coincide with Report i's x in both the cached drawing and this
 *      interpreter's own output. See `planFan`'s doc comment in
 *      `smartart-hierarchy-fan.ts`.
 */

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtDrawingShape } from '../../core/types';
import type { SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtElementsWithoutCache } from '../../core/utils';
import { readCorpusFixture } from './real-world-corpus-helpers';

async function loadOrgChart(fileName: string, slideIndex = 0): Promise<SmartArtPptxElement> {
	const handler = new PptxHandler();
	const { slides } = await handler.load(readCorpusFixture(fileName));
	const element = slides[slideIndex].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	if (!element) {
		throw new Error(`${fileName} slide ${slideIndex + 1}: no SmartArt element`);
	}
	return element;
}

function byText(shapes: PptxSmartArtDrawingShape[], text: string): PptxSmartArtDrawingShape {
	const found = shapes.find((s) => s.text === text);
	if (!found) {
		throw new Error(`no cached drawing shape with text "${text}"`);
	}
	return found;
}

/**
 * Normalised horizontal offset of `child` from `parent`, as a fraction of
 * `parent`'s own width: cancels out the interpreter-vs-PowerPoint difference
 * in absolute box-sizing constants, so the SAME ratio is comparable across
 * both. See the module doc comment.
 */
function offsetRatio(parent: { x: number; width: number }, child: { x: number }): number {
	return (child.x - parent.x) / parent.width;
}

function interpretedByText(
	element: SmartArtPptxElement,
): (text: string) => { x: number; y: number; width: number; height: number } {
	const rendered = computeSmartArtElementsWithoutCache(element.smartArtData!, {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
	});
	const shapes = (rendered ?? []).filter(
		(el): el is Extract<(typeof rendered)[number], { type: 'shape' }> => el.type === 'shape',
	);
	return (text: string) => {
		const found = shapes.find((s) => s.text === text);
		if (!found) {
			throw new Error(`no interpreted shape with text "${text}"`);
		}
		return found;
	};
}

describe('smartArt hierarchy interpreter vs. genuine PowerPoint org charts', () => {
	const HIER_BRANCH_SLIDES: Array<{ slide: number; branch: string | undefined }> = [
		{ slide: 0, branch: undefined }, // Standard: no explicit override.
		{ slide: 1, branch: 'hang' }, // Both Hanging.
		{ slide: 2, branch: 'l' }, // Left Hanging.
		{ slide: 3, branch: 'r' }, // Right Hanging.
	];

	describe.each(HIER_BRANCH_SLIDES)(
		'smartart-orgchart-hierbranch.pptx slide $slide',
		({ slide, branch }) => {
			it(`parses the genuine hierBranch hint (${branch ?? 'Standard -> init tail'})`, async () => {
				const element = await loadOrgChart('smartart-orgchart-hierbranch.pptx', slide);
				const resolved = element.smartArtData!.presLayoutVars?.hierarchyBranch;
				if (branch === undefined) {
					// "Standard" carries no override on hierRoot1 itself, but the
					// deeper generations still default to a hanging tail (see the
					// module doc comment on smartart-pres-layout-vars.ts), which
					// this interpreter models as 'init'.
					expect(resolved).toBe('init');
				} else {
					expect(resolved).toBe(branch);
				}
				// Every slide sets orgChart mode and the real chPref=3 threshold,
				// wherever hierBranch resolved to.
				expect(element.smartArtData!.presLayoutVars?.orgChart).toBeTruthy();
			});

			it('agrees with the cached drawing on topology: fanned reports, hanging grandchildren, close assistant', async () => {
				const element = await loadOrgChart('smartart-orgchart-hierbranch.pptx', slide);
				const cached = element.smartArtData!.drawingShapes!;
				const interpreted = interpretedByText(element);

				// Ground truth (PowerPoint's own cached dsp: drawing): Report
				// One/Two/Three share one row; Analyst One sits above Analyst Two
				// in a hanging column under Report One; the assistant sits closer
				// to the manager (vertically) than the report row does.
				const cManager = byText(cached, 'Manager');
				const cR1 = byText(cached, 'Report One');
				const cR2 = byText(cached, 'Report Two');
				const cR3 = byText(cached, 'Report Three');
				const cA1 = byText(cached, 'Analyst One');
				const cA2 = byText(cached, 'Analyst Two');
				const cAsst = byText(cached, 'Assistant');
				expect(cR1.y).toBeCloseTo(cR2.y, 0);
				expect(cR2.y).toBeCloseTo(cR3.y, 0);
				expect(cA1.x).toBeCloseTo(cA2.x, 0);
				expect(cA1.y).toBeLessThan(cA2.y);
				expect(cAsst.y - cManager.y).toBeLessThan(cR1.y - cManager.y);

				const iManager = interpreted('Manager');
				const iR1 = interpreted('Report One');
				const iR2 = interpreted('Report Two');
				const iR3 = interpreted('Report Three');
				const iA1 = interpreted('Analyst One');
				const iA2 = interpreted('Analyst Two');
				const iAsst = interpreted('Assistant');
				expect(iR1.y).toBeCloseTo(iR2.y, 0);
				expect(iR2.y).toBeCloseTo(iR3.y, 0);
				expect(iA1.x).toBeCloseTo(iA2.x, 0);
				expect(iA1.y).toBeLessThan(iA2.y);
				expect(iAsst.y - iManager.y).toBeLessThan(iR1.y - iManager.y);
			});

			it('models the hierAlign/alignOff root-box offset: Report One -> Analyst One matches PowerPoint within 0.05 of box width', async () => {
				const element = await loadOrgChart('smartart-orgchart-hierbranch.pptx', slide);
				const cached = element.smartArtData!.drawingShapes!;
				const interpreted = interpretedByText(element);

				const cachedRatio = offsetRatio(
					byText(cached, 'Report One'),
					byText(cached, 'Analyst One'),
				);
				const interpretedRatio = offsetRatio(interpreted('Report One'), interpreted('Analyst One'));
				// Ground truth measured directly off the cached drawing's raw EMU
				// offsets: 0.25 in every sampled hierBranch variant (see
				// HIER_TAIL_OFFSET_RATIO's doc comment). `cachedRatio` itself only
				// approximates that (pixel-rounding noise in `drawingShapes` - see
				// the module doc comment), so it is checked against 0.25 with the
				// same tolerance as the interpreter comparison, not exactly. Before
				// this offset was modelled, the interpreted ratio was 0 (Analyst One
				// rendered flush with Report One) - over 4x outside this tolerance.
				expect(cachedRatio).toBeCloseTo(0.25, 1);
				expect(interpretedRatio).toBeCloseTo(cachedRatio, 1);
			});
		},
	);

	describe('smartart-orgchart-nested-hang.pptx (hierAlign/alignOff at generation 3; chMax cannot recurse below generation 1)', () => {
		const SLIDES: Array<{ slide: number; branch: string }> = [
			{ slide: 0, branch: 'init' }, // Standard.
			{ slide: 1, branch: 'hang' }, // Both Hanging.
		];

		describe.each(SLIDES)('slide $slide ($branch)', ({ slide, branch }) => {
			it('parses the genuine hierBranch hint', async () => {
				const element = await loadOrgChart('smartart-orgchart-nested-hang.pptx', slide);
				expect(element.smartArtData!.presLayoutVars?.hierarchyBranch).toBe(branch);
			});

			it('models the hierAlign/alignOff offset one generation deeper (Team One -> Team Four) within 0.05 of box width', async () => {
				const element = await loadOrgChart('smartart-orgchart-nested-hang.pptx', slide);
				const cached = element.smartArtData!.drawingShapes!;
				const interpreted = interpretedByText(element);

				const cachedRatio = offsetRatio(byText(cached, 'Team 1'), byText(cached, 'Team 4'));
				const interpretedRatio = offsetRatio(interpreted('Team 1'), interpreted('Team 4'));
				expect(cachedRatio).toBeCloseTo(0.25, 1);
				expect(interpretedRatio).toBeCloseTo(cachedRatio, 1);
			});

			it("fans Team 1/2/3 across Report A/B/C's own columns (chPref reached) instead of a narrow hanging column", async () => {
				// Report B's 3 direct children (Team 1/2/3) reach chPref=3, and
				// Report B's own generation (Report A/B/C) is also exactly
				// chPref=3 wide: genuine PowerPoint output does NOT hang Team
				// 1/2/3 in one indented column under Report B here. It reuses
				// Report A/B/C's own x-columns one generation down (Team 1 under
				// Report A's column, Team 2 under Report B's, Team 3 under
				// Report C's) - see `planFan`'s doc comment in
				// `smartart-hierarchy-fan.ts`.
				const element = await loadOrgChart('smartart-orgchart-nested-hang.pptx', slide);
				const cached = element.smartArtData!.drawingShapes!;
				const interpreted = interpretedByText(element);

				const cReportA = byText(cached, 'Report A');
				const cReportB = byText(cached, 'Report B');
				const cReportC = byText(cached, 'Report C');
				const cTeam1 = byText(cached, 'Team 1');
				const cTeam2 = byText(cached, 'Team 2');
				const cTeam3 = byText(cached, 'Team 3');
				expect(cTeam1.x).toBeCloseTo(cReportA.x, 0);
				expect(cTeam2.x).toBeCloseTo(cReportB.x, 0);
				expect(cTeam3.x).toBeCloseTo(cReportC.x, 0);
				expect(cTeam1.y).toBeCloseTo(cTeam2.y, 0);
				expect(cTeam2.y).toBeCloseTo(cTeam3.y, 0);
				expect(cTeam1.y).toBeGreaterThan(cReportA.y);

				const iReportA = interpreted('Report A');
				const iReportB = interpreted('Report B');
				const iReportC = interpreted('Report C');
				const iTeam1 = interpreted('Team 1');
				const iTeam2 = interpreted('Team 2');
				const iTeam3 = interpreted('Team 3');
				expect(iTeam1.x).toBeCloseTo(iReportA.x, 0);
				expect(iTeam2.x).toBeCloseTo(iReportB.x, 0);
				expect(iTeam3.x).toBeCloseTo(iReportC.x, 0);
				expect(iTeam1.y).toBeCloseTo(iTeam2.y, 0);
				expect(iTeam2.y).toBeCloseTo(iTeam3.y, 0);
				expect(iTeam1.y).toBeGreaterThan(iReportA.y);
			});

			it('keeps Team Four and Team Five (both children of Team One) in ONE shared column, even for "hang"', async () => {
				// The "Both Hanging" name suggests per-sibling alternation, but
				// genuine PowerPoint output refutes that here: see the doc comment
				// on `placeHangingTree` in smartart-hierarchy-hanging.ts.
				const element = await loadOrgChart('smartart-orgchart-nested-hang.pptx', slide);
				const cached = element.smartArtData!.drawingShapes!;
				const interpreted = interpretedByText(element);

				expect(byText(cached, 'Team 4').x).toBeCloseTo(byText(cached, 'Team 5').x, 0);
				expect(interpreted('Team 4').x).toBeCloseTo(interpreted('Team 5').x, 0);
				expect(byText(cached, 'Team 4').y).toBeLessThan(byText(cached, 'Team 5').y);
				expect(interpreted('Team 4').y).toBeLessThan(interpreted('Team 5').y);
			});
		});

		it('cannot exceed chPref=3 direct children below the manager: AddNode() cascades into a 3rd generation instead', async () => {
			// Report B was given 5 children via AddNode(); PowerPoint's own
			// layoutDef has no group-wrapper slot template past generation 1 (see
			// fixtures/corpus/README.md), so the 4th/5th calls nested under the
			// 3rd child (Team One) rather than becoming Report B's 4th/5th direct
			// children. This is the answer to "grouping deeper than one chMax
			// level": it does not occur in genuine org-chart output, so there is
			// no deeper-grouping behaviour for the interpreter to model.
			const element = await loadOrgChart('smartart-orgchart-nested-hang.pptx', 0);
			const cached = element.smartArtData!.drawingShapes!;
			const team1 = byText(cached, 'Team 1');
			const team4 = byText(cached, 'Team 4');
			const team5 = byText(cached, 'Team 5');
			// Team Four/Five sit BELOW Team One, at Team One's own generation
			// band's offset (not a 4th/5th fanned sibling of Report B's row).
			expect(team4.y).toBeGreaterThan(team1.y);
			expect(team5.y).toBeGreaterThan(team4.y);
		});
	});

	describe('smartart-orgchart-many.pptx (chPref=3 column grouping)', () => {
		it('parses the genuine chPref=3 threshold from the rootText1 presentation point', async () => {
			const element = await loadOrgChart('smartart-orgchart-many.pptx');
			expect(element.smartArtData!.presLayoutVars?.childPreferred).toBe(3);
		});

		it('agrees with the cached drawing: 6 reports group into two columns of three, not one fanned row', async () => {
			const element = await loadOrgChart('smartart-orgchart-many.pptx');
			const cached = element.smartArtData!.drawingShapes!;
			const cReports = Array.from({ length: 6 }, (_, i) => byText(cached, `Report ${i + 1}`));
			const cXs = new Set(cReports.map((s) => Math.round(s.x)));
			const cYs = new Set(cReports.map((s) => Math.round(s.y)));
			expect(cXs.size).toBe(2);
			expect(cYs.size).toBe(3);

			const interpreted = interpretedByText(element);
			const iReports = Array.from({ length: 6 }, (_, i) => interpreted(`Report ${i + 1}`));
			const iXs = new Set(iReports.map((s) => Math.round(s.x)));
			const iYs = new Set(iReports.map((s) => Math.round(s.y)));
			expect(iXs.size).toBe(2);
			expect(iYs.size).toBe(3);
		});
	});

	describe('smartart-orgchart-fan-variants.pptx (manager row not exactly chPref wide)', () => {
		// One config per slide: `sharedRow` is every text that shares CEO's own
		// row (row-fan groups fully, plus each leaf-only column's first member);
		// `stacks` is each leaf-only column's remaining members, expected at the
		// SAME x as their group's row-anchor and at strictly increasing y. See
		// `smartart-hierarchy-wrapped-groups.ts`'s doc comment for the row-vs-
		// column rule this pins down, and `fixtures/corpus/README.md` for how
		// each slide's tree was authored.
		const SLIDES: Array<{
			slide: number;
			label: string;
			sharedRow: string[];
			stacks: Array<{ anchor: string; below: string[] }>;
		}> = [
			{ slide: 0, label: 'row2-first', sharedRow: ['M1', 'M1R1', 'M1R2', 'M2'], stacks: [] },
			{
				// M2's own real children (M2R2/M2R3) hang via the pre-existing 0.25
				// tail-offset mechanism (see HIER_TAIL_OFFSET_RATIO), NOT the
				// wrap-group column stack this suite is pinning down here: there is
				// only ONE group ([M1, M2, M2R1]), and it fans as a row because M2
				// has its own ordinary children.
				slide: 1,
				label: 'row2-last',
				sharedRow: ['M1', 'M2', 'M2R1'],
				stacks: [],
			},
			{
				slide: 2,
				label: 'row2-both',
				sharedRow: ['M1', 'M1R1', 'M1R2', 'M2', 'M2R1', 'M2R2'],
				stacks: [],
			},
			{
				slide: 3,
				label: 'row4-pos1',
				sharedRow: ['M1', 'M1R1', 'M1R2', 'M2'],
				stacks: [{ anchor: 'M2', below: ['M3', 'M4'] }],
			},
			{
				slide: 4,
				label: 'row4-pos2',
				sharedRow: ['M1', 'M2', 'M2R1', 'M3'],
				stacks: [{ anchor: 'M3', below: ['M4'] }],
			},
			{ slide: 5, label: 'row4-pos3', sharedRow: ['M1', 'M2', 'M3', 'M4'], stacks: [] },
			{
				slide: 6,
				label: 'row4-pos4',
				sharedRow: ['M1', 'M4', 'M4R1', 'M4R2'],
				stacks: [{ anchor: 'M1', below: ['M2', 'M3'] }],
			},
			{
				slide: 7,
				label: 'row4-two-edges',
				sharedRow: ['M1', 'M1R1', 'M1R2', 'M2', 'M3', 'M4'],
				stacks: [],
			},
			{
				slide: 8,
				label: 'row5-first',
				sharedRow: ['M1', 'M1R1', 'M1R2', 'M2', 'M5'],
				stacks: [{ anchor: 'M2', below: ['M3', 'M4'] }],
			},
			{
				slide: 9,
				label: 'row5-mid',
				sharedRow: ['M1', 'M2', 'M3', 'M4'],
				stacks: [{ anchor: 'M4', below: ['M5'] }],
			},
			{
				slide: 10,
				label: 'row5-last',
				sharedRow: ['M1', 'M4', 'M5', 'M5R1'],
				stacks: [{ anchor: 'M1', below: ['M2', 'M3'] }],
			},
		];

		describe.each(SLIDES)('slide $slide ($label)', ({ slide, sharedRow, stacks }) => {
			it("shares CEO's row: every listed node at the same y, each its own x", async () => {
				const element = await loadOrgChart('smartart-orgchart-fan-variants.pptx', slide);
				const cached = element.smartArtData!.drawingShapes!;
				const cRow = sharedRow.map((t) => byText(cached, t));
				for (let i = 1; i < cRow.length; i++) {
					expect(cRow[i].y).toBeCloseTo(cRow[0].y, 0);
				}
				expect(new Set(cRow.map((s) => Math.round(s.x))).size).toBe(cRow.length);

				const interpreted = interpretedByText(element);
				const iRow = sharedRow.map((t) => interpreted(t));
				for (let i = 1; i < iRow.length; i++) {
					expect(iRow[i].y).toBeCloseTo(iRow[0].y, 0);
				}
				expect(new Set(iRow.map((s) => Math.round(s.x))).size).toBe(iRow.length);
			});

			it('stacks each leaf-only group below its row anchor: same x, strictly increasing y', async () => {
				const element = await loadOrgChart('smartart-orgchart-fan-variants.pptx', slide);
				const cached = element.smartArtData!.drawingShapes!;
				const interpreted = interpretedByText(element);

				for (const { anchor, below } of stacks) {
					const cAnchor = byText(cached, anchor);
					let cPrevY = cAnchor.y;
					for (const text of below) {
						const c = byText(cached, text);
						expect(c.x).toBeCloseTo(cAnchor.x, 0);
						expect(c.y).toBeGreaterThan(cPrevY);
						cPrevY = c.y;
					}

					const iAnchor = interpreted(anchor);
					let iPrevY = iAnchor.y;
					for (const text of below) {
						const i = interpreted(text);
						expect(i.x).toBeCloseTo(iAnchor.x, 0);
						expect(i.y).toBeGreaterThan(iPrevY);
						iPrevY = i.y;
					}
				}
			});
		});
	});
});
