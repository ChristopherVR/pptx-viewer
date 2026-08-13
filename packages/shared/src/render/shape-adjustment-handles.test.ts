/**
 * Adjust-handle derivation, asserted against REAL PowerPoint guide values.
 *
 * Two earlier defects this file exists to keep dead:
 *
 *  1. React treated the adjustment as a 0-1 fraction and clamped it with
 *     `Math.min(1, ...)`, collapsing a 16667 corner radius to a square corner,
 *     and six unit tests asserted that same wrong scale. Every number here is
 *     guide space: `roundRect`'s default really is 16667, its handle really
 *     does sit `ss * 16667 / 100000` px along the top edge, and `chevron`'s
 *     upper bound really is `100000 * w / ss`, not 50000.
 *  2. Shared compared `shapeType` RAW against `'roundrect'` while decks spell
 *     it `roundRect`, so every drag returned the start value. The fixtures here
 *     use the spelling PowerPoint writes.
 */
import { describe, expect, it } from 'vitest';

import { derivePresetAdjustmentHandles } from './shape-adjustment-handles';
import { solveShapeAdjustmentValue, solveShapeAdjustments } from './shape-adjustment-solver';

/** `roundRect` on a 200x100 box: ss = 100, so 1 px = 1000 guide units. */
const ROUND_RECT_BOX = { w: 200, h: 100 };

describe('derivePresetAdjustmentHandles', () => {
	it('places the roundRect handle where <ahXY><pos x="x1" y="t"/> says: ss * adj / 100000 along the TOP edge', () => {
		const [handle, ...rest] = derivePresetAdjustmentHandles(
			'roundRect',
			ROUND_RECT_BOX.w,
			ROUND_RECT_BOX.h,
			{ adj: 16667 },
		);
		expect(rest).toHaveLength(0);
		expect(handle.key).toBe('adj');
		// 100 * 16667 / 100000, NOT a normalised 0..1 fraction.
		expect(handle.x).toBeCloseTo(16.667, 3);
		expect(handle.y).toBeCloseTo(0, 6);
		expect(handle.value).toBe(16667);
	});

	it('accepts the OOXML spelling and an already-lowercased one alike', () => {
		expect(derivePresetAdjustmentHandles('roundRect', 200, 100, {})).toHaveLength(1);
		expect(derivePresetAdjustmentHandles('roundrect', 200, 100, {})).toHaveLength(1);
	});

	it('offers no handle for a preset with no adjustable parameter', () => {
		expect(derivePresetAdjustmentHandles('rect', 200, 100, {})).toStrictEqual([]);
		expect(derivePresetAdjustmentHandles('ellipse', 200, 100, {})).toStrictEqual([]);
		expect(derivePresetAdjustmentHandles(undefined, 200, 100, {})).toStrictEqual([]);
	});

	it('returns ONE handle per adjustable parameter, not just the first', () => {
		expect(
			derivePresetAdjustmentHandles('rightArrow', 240, 120, {}).map((h) => h.key),
		).toStrictEqual(['adj1', 'adj2']);
		expect(derivePresetAdjustmentHandles('quadArrow', 200, 200, {}).length).toBeGreaterThan(1);
		expect(derivePresetAdjustmentHandles('blockArc', 200, 200, {}).map((h) => h.key)).toStrictEqual(
			['adj1', 'adj2', 'adj3'],
		);
	});

	it("takes chevron's upper bound from its own maxAdj guide, not a flat 50000", () => {
		// maxAdj = */ 100000 w ss = 100000 * 200 / 100.
		const [handle] = derivePresetAdjustmentHandles('chevron', 200, 100, {});
		expect(handle.solvers[0].solver.max).toBeCloseTo(200000, 6);
		expect(handle.solvers[0].solver.min).toBe(0);
	});

	it('classifies pie/blockArc sweep guides as angular and blockArc thickness as linear', () => {
		const pie = derivePresetAdjustmentHandles('pie', 200, 200, {});
		expect(pie.map((h) => h.solvers[0].solver.kind)).toStrictEqual(['angular', 'angular']);
		// `adj3` reaches `cos` as argument 0 (a radius), not argument 1 (the
		// angle), so a naive "touches cos" test would wrongly call it angular.
		const blockArc = derivePresetAdjustmentHandles('blockArc', 200, 200, {});
		expect(blockArc.map((h) => h.solvers[0].solver.kind)).toStrictEqual([
			'angular',
			'angular',
			'linear',
		]);
	});

	it('binds a callout leader line to ONE handle driving both its guides', () => {
		const handles = derivePresetAdjustmentHandles('callout1', 240, 120, {});
		expect(handles).toHaveLength(2);
		expect(handles[0].solvers.map((s) => s.key)).toStrictEqual(['adj1', 'adj2']);
		expect(handles[1].solvers.map((s) => s.key)).toStrictEqual(['adj3', 'adj4']);
	});

	// Seven names in the geometry table are not `ST_ShapeType` values yet carry
	// their OWN entries, and `cylinder`'s geometry is not `can`'s: its handle
	// sits at (25, 0) where `can`'s sits at (0, 17.5) on the same box. Folding
	// the name before the lookup would therefore measure the diamond off a
	// geometry the canvas is not painting. The exact hit has to win.
	it('measures a non-ST_ShapeType preset off its OWN entry, not the name it folds to', () => {
		const [cylinder] = derivePresetAdjustmentHandles('cylinder', 200, 140, {});
		const [can] = derivePresetAdjustmentHandles('can', 200, 140, {});
		expect(cylinder).toBeDefined();
		expect(can).toBeDefined();
		expect([cylinder.x, cylinder.y]).not.toStrictEqual([can.x, can.y]);
	});

	it('still folds a UI alias and a deck casing onto the canonical preset', () => {
		expect(derivePresetAdjustmentHandles('rtArrow', 240, 120, {}).map((h) => h.key)).toStrictEqual([
			'adj1',
			'adj2',
		]);
		expect(
			derivePresetAdjustmentHandles('ROUNDRECT', 200, 100, {}).map((h) => h.key),
		).toStrictEqual(['adj']);
	});

	it('offers no handle where PowerPoint offers none', () => {
		// Action buttons adjust only their bevel depth.
		expect(derivePresetAdjustmentHandles('actionButtonHome', 120, 90, {})).toStrictEqual([]);
		// Bent/curved connectors are routed by `connector-geometry`, so a handle
		// derived from the preset table would sit off the drawn line.
		expect(derivePresetAdjustmentHandles('bentConnector3', 200, 120, {})).toStrictEqual([]);
	});

	it('covers the preset library broadly, not one shape', () => {
		const covered = [
			'chevron',
			'homePlate',
			'trapezoid',
			'parallelogram',
			'hexagon',
			'octagon',
			'star5',
			'star8',
			'can',
			'cube',
			'bevel',
			'donut',
			'noSmoking',
			'plus',
			'teardrop',
			'frame',
			'foldedCorner',
			'leftArrow',
			'upDownArrow',
			'leftRightArrow',
			'bentArrow',
			'ribbon',
			'sun',
			'smileyFace',
			'wedgeRectCallout',
			'borderCallout2',
			'round2DiagRect',
			'snip1Rect',
			'verticalScroll',
			'gear6',
			'arc',
			'chord',
			'circularArrow',
			'mathDivide',
			'corner',
			'diagStripe',
		];
		for (const preset of covered) {
			expect(
				derivePresetAdjustmentHandles(preset, 200, 140, {}).length,
				`${preset} must offer at least one adjust handle`,
			).toBeGreaterThan(0);
		}
	});

	it('tracks the value it is given, so the handle follows the shape it just changed', () => {
		const closed = derivePresetAdjustmentHandles('roundRect', 200, 100, { adj: 0 })[0];
		const open = derivePresetAdjustmentHandles('roundRect', 200, 100, { adj: 50000 })[0];
		expect(closed.x).toBeCloseTo(0, 6);
		expect(open.x).toBeCloseTo(50, 6);
	});
});

describe('solveShapeAdjustmentValue', () => {
	it("converts px travel into GUIDE units at the preset's own scale", () => {
		const [handle] = derivePresetAdjustmentHandles('roundRect', 200, 100, { adj: 16667 });
		const { solver } = handle.solvers[0];
		// ss = 100 px spans 100000 guide units, so +20 px = +20000 units.
		expect(solveShapeAdjustmentValue(solver, handle.x + 20, handle.y)).toBe(36667);
		expect(solveShapeAdjustmentValue(solver, handle.x - 10, handle.y)).toBe(6667);
	});

	it('clamps to the range the preset pins, in guide space', () => {
		const [handle] = derivePresetAdjustmentHandles('roundRect', 200, 100, { adj: 16667 });
		const { solver } = handle.solvers[0];
		expect(solveShapeAdjustmentValue(solver, handle.x + 500, handle.y)).toBe(50000);
		expect(solveShapeAdjustmentValue(solver, handle.x - 500, handle.y)).toBe(0);
	});

	it('ignores travel perpendicular to a handle that only slides one way', () => {
		const [handle] = derivePresetAdjustmentHandles('roundRect', 200, 100, { adj: 16667 });
		const { solver } = handle.solvers[0];
		expect(solveShapeAdjustmentValue(solver, handle.x, handle.y + 40)).toBe(16667);
	});

	it('sweeps an angular handle round the shape centre', () => {
		// pie adj2 defaults to 16200000 (270 degrees, straight up from centre).
		const handle = derivePresetAdjustmentHandles('pie', 200, 200, {})[1];
		const { solver } = handle.solvers[0];
		expect(solver.kind).toBe('angular');
		// Dragging to the 3 o'clock point is 0 degrees; a full turn wraps to 0.
		expect(solveShapeAdjustmentValue(solver, 200, 100)).toBe(0);
		// 90 degrees clockwise of the anchor is 6 o'clock = 5400000.
		expect(solveShapeAdjustmentValue(solver, 100, 200)).toBe(5400000);
	});
});

describe('solveShapeAdjustments', () => {
	it('writes every guide a merged callout handle drives', () => {
		const [handle] = derivePresetAdjustmentHandles('callout1', 240, 120, {});
		const patch = solveShapeAdjustments(handle.solvers, handle.x + 24, handle.y + 12);
		expect(Object.keys(patch).sort()).toStrictEqual(['adj1', 'adj2']);
		// h = 120 px spans 100000 units vertically, w = 240 px spans 100000
		// horizontally, so +12 px down is +10000 and +24 px right is +10000.
		expect(patch.adj1).toBe(28750);
		expect(patch.adj2).toBe(1667);
	});
});
