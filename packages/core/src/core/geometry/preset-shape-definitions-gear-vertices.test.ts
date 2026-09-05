import { describe, expect, it } from 'vitest';

import { evaluateGuides } from './guide-formula-api';
import { gear6 } from './preset-shape-definitions-gear6';
import { gear9 } from './preset-shape-definitions-gear9';

/**
 * Pins the evaluated coordinates of the first tooth's four silhouette
 * vertices (A/B/C/D: tip-left, tip-right, root-shoulder, root-fillet-start)
 * plus the derived root-circle radii (`rw`/`rh`), tooth-depth (`th`) and
 * flank offset (`lFD`) for `gear6`/`gear9` at their spec defaults on a
 * 400x400 box.
 *
 * These numbers were cross-checked 2026-09-05 against real PowerPoint via
 * COM (`Shapes.AddShape(msoShapeGear6/9)`, solid black fill, no line,
 * `Slide.Export("PNG", 800, 800)` with the slide sized to exactly the
 * shape's own 400x400pt box so the export is not auto-cropped): rasterising
 * this repo's `evaluatePresetShape` output on the same 800x800 canvas and
 * diffing against the COM PNG gave an XOR pixel mismatch of <=0.07% of the
 * canvas for every sampled adjustment (defaults plus two other legal values
 * each of adj1 and adj2), far under the 1% acceptance bar - i.e. no real
 * transcription gap exists (see W5-H gear measurement notes). This test
 * exists to pin that already-correct state so a future edit to the gdLst
 * cannot silently drift back toward the earlier (disproven) ~8% gap.
 */
function evalVerts(
	def: { avLst?: Record<string, number>; gdLst?: Array<{ name: string; formula: string }> },
	w: number,
	h: number,
): Record<string, number> {
	const adjMap = new Map(Object.entries(def.avLst ?? {}));
	const vars = evaluateGuides(def.gdLst ?? [], { w, h }, adjMap);
	const wanted = ['xA1', 'yA1', 'xB1', 'yB1', 'xC1', 'yC1', 'xD1', 'yD1', 'rw', 'rh', 'th', 'lFD'];
	const out: Record<string, number> = {};
	for (const key of wanted) {
		out[key] = vars.get(key) ?? Number.NaN;
	}
	return out;
}

describe('gear6 / gear9 preset geometry: COM-verified vertex pins', () => {
	it('gear6 default adjustments (adj1=15000, adj2=3526) at 400x400', () => {
		const v = evalVerts(gear6, 400, 400);
		expect(v.xA1).toBeCloseTo(299.298796, 4);
		expect(v.yA1).toBeCloseTo(101.309833, 4);
		expect(v.xB1).toBeCloseTo(358.31232, 4);
		expect(v.yB1).toBeCloseTo(83.524255, 4);
		expect(v.xC1).toBeCloseTo(380.027114, 4);
		expect(v.yC1).toBeCloseTo(121.135381, 4);
		expect(v.xD1).toBeCloseTo(335.11759, 4);
		expect(v.yD1).toBeCloseTo(163.349804, 4);
		expect(v.rw).toBe(140);
		expect(v.rh).toBe(140);
		expect(v.th).toBe(60);
		expect(v.lFD).toBeCloseTo(14.104, 4);
	});

	it('gear9 default adjustments (adj1=10000, adj2=1763) at 400x400', () => {
		const v = evalVerts(gear9, 400, 400);
		expect(v.xA1).toBeCloseTo(283.921712, 4);
		expect(v.yA1).toBeCloseTo(63.775383, 4);
		expect(v.xB1).toBeCloseTo(315.035362, 4);
		expect(v.yB1).toBeCloseTo(37.666544, 4);
		expect(v.xC1).toBeCloseTo(339.891565, 4);
		expect(v.yC1).toBeCloseTo(58.523375, 4);
		expect(v.xD1).toBeCloseTo(319.582206, 4);
		expect(v.yD1).toBeCloseTo(93.698091, 4);
		expect(v.rw).toBe(160);
		expect(v.rh).toBe(160);
		expect(v.th).toBe(40);
		expect(v.lFD).toBeCloseTo(7.052, 4);
	});
});
