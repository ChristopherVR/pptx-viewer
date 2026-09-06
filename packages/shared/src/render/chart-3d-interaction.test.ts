import { describe, expect, it } from 'vitest';

import {
	calibrateChart3DValueAxis,
	chart3DHitToPartRef,
	chart3DMarkMatchesPart,
	chart3DPointerDeltaToValueDelta,
} from './chart-3d-interaction';

describe('chart3DHitToPartRef', () => {
	it('maps a hit to a dataPoint ChartPartRef', () => {
		expect(chart3DHitToPartRef({ seriesIndex: 1, pointIndex: 2 })).toStrictEqual({
			role: 'dataPoint',
			seriesIndex: 1,
			pointIndex: 2,
		});
	});

	it('maps a missing hit to null', () => {
		expect(chart3DHitToPartRef(null)).toBeNull();
		expect(chart3DHitToPartRef(undefined)).toBeNull();
	});
});

describe('chart3DMarkMatchesPart', () => {
	const mark = { seriesIndex: 1, pointIndex: 2 };

	it('matches the same dataPoint part', () => {
		expect(
			chart3DMarkMatchesPart(mark, { role: 'dataPoint', seriesIndex: 1, pointIndex: 2 }),
		).toBeTruthy();
	});

	it('does not match a different point, series, or role', () => {
		expect(
			chart3DMarkMatchesPart(mark, { role: 'dataPoint', seriesIndex: 1, pointIndex: 3 }),
		).toBeFalsy();
		expect(
			chart3DMarkMatchesPart(mark, { role: 'dataPoint', seriesIndex: 0, pointIndex: 2 }),
		).toBeFalsy();
		expect(chart3DMarkMatchesPart(mark, { role: 'series', seriesIndex: 1 })).toBeFalsy();
	});

	it('does not match null/undefined', () => {
		expect(chart3DMarkMatchesPart(mark, null)).toBeFalsy();
		expect(chart3DMarkMatchesPart(mark, undefined)).toBeFalsy();
	});
});

describe('calibrateChart3DValueAxis', () => {
	it('calibrates a vertical axis (value grows upward on screen)', () => {
		// value 0 at screen (100, 200); value 10 at screen (100, 100): 10px per unit, up.
		const calib = calibrateChart3DValueAxis({ x: 100, y: 200 }, 0, { x: 100, y: 100 }, 10);
		expect(calib).not.toBeNull();
		expect(calib!.pixelsPerUnit).toBeCloseTo(10, 10);
		expect(calib!.directionScreen.x).toBeCloseTo(0, 10);
		expect(calib!.directionScreen.y).toBeCloseTo(-1, 10);
	});

	it('is order-independent: swapping the two calibration points gives the same delta mapping', () => {
		const forward = calibrateChart3DValueAxis({ x: 100, y: 200 }, 0, { x: 100, y: 100 }, 10);
		const backward = calibrateChart3DValueAxis({ x: 100, y: 100 }, 10, { x: 100, y: 200 }, 0);
		expect(forward).not.toBeNull();
		expect(backward).not.toBeNull();
		const delta = { x: 3, y: -20 };
		expect(chart3DPointerDeltaToValueDelta(forward!, delta)).toBeCloseTo(
			chart3DPointerDeltaToValueDelta(backward!, delta),
			10,
		);
	});

	it('returns null when the two values coincide', () => {
		expect(calibrateChart3DValueAxis({ x: 0, y: 0 }, 5, { x: 10, y: 10 }, 5)).toBeNull();
	});

	it('returns null when the two screen points coincide (camera looking down the axis)', () => {
		expect(calibrateChart3DValueAxis({ x: 50, y: 50 }, 0, { x: 50, y: 50 }, 10)).toBeNull();
	});

	it('returns null for a non-finite value span', () => {
		expect(calibrateChart3DValueAxis({ x: 0, y: 0 }, Number.NaN, { x: 10, y: 10 }, 5)).toBeNull();
	});
});

describe('chart3DPointerDeltaToValueDelta', () => {
	it('converts a screen-space pointer delta into a value delta along the calibrated axis', () => {
		const calib = calibrateChart3DValueAxis({ x: 100, y: 200 }, 0, { x: 100, y: 100 }, 10);
		// Moving the pointer 20px up (dy = -20) should increase the value by 2.
		expect(chart3DPointerDeltaToValueDelta(calib!, { x: 0, y: -20 })).toBeCloseTo(2, 10);
		// Moving down decreases it.
		expect(chart3DPointerDeltaToValueDelta(calib!, { x: 0, y: 20 })).toBeCloseTo(-2, 10);
		// Purely horizontal movement (perpendicular to the axis) contributes nothing.
		expect(chart3DPointerDeltaToValueDelta(calib!, { x: 50, y: 0 })).toBeCloseTo(0, 10);
	});

	it('projects an oblique pointer delta onto a diagonal screen-space axis', () => {
		// Axis runs from (0,0) at value 0 to (30, -40) at value 5 -> direction (0.6, -0.8), 10px/unit.
		const calib = calibrateChart3DValueAxis({ x: 0, y: 0 }, 0, { x: 30, y: -40 }, 5);
		expect(calib!.pixelsPerUnit).toBeCloseTo(10, 10);
		// Moving exactly along the axis direction by 10px should be +1 unit.
		expect(chart3DPointerDeltaToValueDelta(calib!, { x: 6, y: -8 })).toBeCloseTo(1, 10);
	});
});
