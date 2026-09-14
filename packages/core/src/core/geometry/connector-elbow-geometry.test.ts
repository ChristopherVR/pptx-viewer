import { describe, expect, it } from 'vitest';

import {
	elbowCurveSegments,
	elbowWaypoints,
	isHorizontalPrimaryAxis,
} from './connector-elbow-geometry';

describe('isHorizontalPrimaryAxis', () => {
	it('picks horizontal when the box is wider than it is tall (shapes side by side)', () => {
		expect(isHorizontalPrimaryAxis(200, 50)).toBeTruthy();
	});

	it('keeps the OOXML horizontal primary axis for a tall box', () => {
		expect(isHorizontalPrimaryAxis(50, 200)).toBeTruthy();
	});

	it('breaks an exact tie in favour of horizontal (historical default)', () => {
		expect(isHorizontalPrimaryAxis(100, 100)).toBeTruthy();
	});
});

describe('elbowWaypoints: OOXML preset axis', () => {
	it('a wide box (side-by-side shapes) bends around a VERTICAL mid-line', () => {
		const pts = elbowWaypoints(0, 0, 200, 50, 200, 50, 3, 0.5, 0.5, 0.5);
		expect(pts).toStrictEqual([
			[0, 0],
			[100, 0],
			[100, 50],
			[200, 50],
		]);
	});

	it('a tall box retains the horizontal-first preset path', () => {
		const pts = elbowWaypoints(0, 0, 50, 200, 50, 200, 3, 0.5, 0.5, 0.5);
		expect(pts).toStrictEqual([
			[0, 0],
			[25, 0],
			[25, 200],
			[50, 200],
		]);
	});

	it('honours a non-default adj1 along the x axis', () => {
		const horizontal = elbowWaypoints(0, 0, 200, 50, 200, 50, 3, 0.25, 0.5, 0.5);
		expect(horizontal[1]).toStrictEqual([50, 0]);
		expect(horizontal[2]).toStrictEqual([50, 50]);

		const vertical = elbowWaypoints(0, 0, 50, 200, 50, 200, 3, 0.25, 0.5, 0.5);
		expect(vertical[1]).toStrictEqual([12.5, 0]);
		expect(vertical[2]).toStrictEqual([12.5, 200]);
	});

	it('builds a 4-segment staircase (bentConnector4) through both adj1 and adj2, stacked box', () => {
		const pts = elbowWaypoints(0, 0, 100, 200, 100, 200, 4, 0.5, 0.5, 0.5);
		expect(pts).toStrictEqual([
			[0, 0],
			[50, 0],
			[50, 100],
			[100, 100],
			[100, 200],
		]);
	});

	it('builds a 5-segment staircase (bentConnector5) through adj1, adj2, adj3 independently, stacked box', () => {
		const pts = elbowWaypoints(0, 0, 100, 200, 100, 200, 5, 0.3, 0.4, 0.7);
		expect(pts).toStrictEqual([
			[0, 0],
			[30, 0],
			[30, 80],
			[70, 80],
			[70, 200],
			[100, 200],
		]);
	});

	it('bentConnector4/5 differ from bentConnector3 on the same stacked box', () => {
		const seg3 = elbowWaypoints(0, 0, 100, 200, 100, 200, 3, 0.5, 0.5, 0.5);
		const seg4 = elbowWaypoints(0, 0, 100, 200, 100, 200, 4, 0.5, 0.5, 0.5);
		const seg5 = elbowWaypoints(0, 0, 100, 200, 100, 200, 5, 0.5, 0.5, 0.5);
		expect(seg3).toHaveLength(4);
		expect(seg4).toHaveLength(5);
		expect(seg5).toHaveLength(6);
	});
});

describe('elbowCurveSegments: same orientation/segment logic, smooth instead of sharp', () => {
	it('renders a single smooth cubic for curvedConnector3, wide box (horizontal-primary)', () => {
		const segs = elbowCurveSegments(0, 0, 200, 50, 200, 50, 3, 0.5, 0.5, 0.5);
		expect(segs).toStrictEqual([
			{ control: [100, 0], end: [100, 25] },
			{ control: [100, 50], end: [200, 50] },
		]);
	});

	it('renders a horizontal-first smooth curve for curvedConnector3 on a tall box', () => {
		const segs = elbowCurveSegments(0, 0, 50, 200, 50, 200, 3, 0.5, 0.5, 0.5);
		expect(segs).toStrictEqual([
			{ control: [25, 0], end: [25, 100] },
			{ control: [25, 200], end: [50, 200] },
		]);
	});

	it('renders a differentiated 3-curve path for curvedConnector4, tall box', () => {
		const segs = elbowCurveSegments(0, 0, 100, 200, 100, 200, 4, 0.5, 0.5, 0.5);
		expect(segs).toStrictEqual([
			{ control: [50, 0], end: [50, 50] },
			{ control: [50, 100], end: [75, 100] },
			{ control: [100, 100], end: [100, 200] },
		]);
	});

	it('renders a differentiated 4-curve path for curvedConnector5, tall box', () => {
		const segs = elbowCurveSegments(0, 0, 100, 200, 100, 200, 5, 0.3, 0.4, 0.7);
		expect(segs).toStrictEqual([
			{ control: [30, 0], end: [30, 40] },
			{ control: [30, 80], end: [50, 80] },
			{ control: [70, 80], end: [70, 140] },
			{ control: [70, 200], end: [100, 200] },
		]);
	});
});
