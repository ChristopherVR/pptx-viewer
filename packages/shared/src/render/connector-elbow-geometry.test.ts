import { describe, expect, it } from 'vitest';

import {
	connectorAdjustmentFraction,
	connectorBendFraction,
	curvedElbowPathD,
	elbowSegmentCount,
	elbowWaypoints,
	isHorizontalPrimary,
} from './connector-elbow-geometry';

describe('isHorizontalPrimary', () => {
	it('picks horizontal when shapes sit side by side (dx dominates)', () => {
		expect(isHorizontalPrimary(0, 0, 200, 50)).toBeTruthy();
	});

	it('picks vertical when shapes are stacked (dy dominates)', () => {
		expect(isHorizontalPrimary(0, 0, 50, 200)).toBeFalsy();
	});

	it('breaks an exact tie in favour of horizontal (historical default)', () => {
		expect(isHorizontalPrimary(0, 0, 100, 100)).toBeTruthy();
	});
});

describe('elbowSegmentCount', () => {
	it('maps bentConnector4 / curvedConnector4 to 4 segments', () => {
		expect(elbowSegmentCount('bentconnector4')).toBe(4);
		expect(elbowSegmentCount('curvedconnector4')).toBe(4);
	});

	it('maps bentConnector5 / curvedConnector5 to 5 segments', () => {
		expect(elbowSegmentCount('bentconnector5')).toBe(5);
		expect(elbowSegmentCount('curvedconnector5')).toBe(5);
	});

	it('falls back to 3 (the Z-shape) for bentConnector3 and any unrecognised suffix', () => {
		expect(elbowSegmentCount('bentconnector3')).toBe(3);
		expect(elbowSegmentCount('bentconnector')).toBe(3);
	});
});

describe('connectorAdjustmentFraction / connectorBendFraction', () => {
	it('defaults to 0.5 with no adjustments', () => {
		expect(connectorBendFraction({ shapeAdjustments: {} } as never)).toBe(0.5);
		expect(connectorAdjustmentFraction({ shapeAdjustments: {} } as never, 'adj2')).toBe(0.5);
	});

	it('reads adj2/adj3 independently of adj1', () => {
		const el = { shapeAdjustments: { adj1: 10000, adj2: 60000, adj3: 90000 } } as never;
		expect(connectorAdjustmentFraction(el, 'adj1')).toBeCloseTo(0.1, 5);
		expect(connectorAdjustmentFraction(el, 'adj2')).toBeCloseTo(0.6, 5);
		expect(connectorAdjustmentFraction(el, 'adj3')).toBeCloseTo(0.9, 5);
	});

	it('clamps out-of-range fractions', () => {
		const el = { shapeAdjustments: { adj1: 250000 } } as never;
		expect(connectorBendFraction(el)).toBe(1);
	});
});

describe('elbowWaypoints: orientation adapts to where the shapes actually are', () => {
	it('side-by-side shapes (width > height) bend around a VERTICAL mid-line', () => {
		// Two shapes roughly level with each other, far apart horizontally.
		const pts = elbowWaypoints(0, 0, 200, 50, 3, 0.5, 0.5, 0.5);
		expect(pts).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 50 },
			{ x: 200, y: 50 },
		]);
	});

	it('stacked shapes (height > width) bend around a HORIZONTAL mid-line instead', () => {
		// Same connector, transposed: this is the bug the fix targets. The old
		// implementation always produced a vertical mid-axis (`x=25`) regardless
		// of the connector being far taller than it is wide; the fix recognises
		// the dominant axis is now y and bends around a horizontal mid-line.
		const pts = elbowWaypoints(0, 0, 50, 200, 3, 0.5, 0.5, 0.5);
		expect(pts).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 0, y: 100 },
			{ x: 50, y: 100 },
			{ x: 50, y: 200 },
		]);
	});

	it('honours a non-default adj1 along whichever axis is primary', () => {
		const horizontal = elbowWaypoints(0, 0, 200, 50, 3, 0.25, 0.5, 0.5);
		expect(horizontal[1]).toStrictEqual({ x: 50, y: 0 });
		expect(horizontal[2]).toStrictEqual({ x: 50, y: 50 });

		const vertical = elbowWaypoints(0, 0, 50, 200, 3, 0.25, 0.5, 0.5);
		expect(vertical[1]).toStrictEqual({ x: 0, y: 50 });
		expect(vertical[2]).toStrictEqual({ x: 50, y: 50 });
	});

	it('mirrors correctly when the connector is flip-adjusted (start at the far corner)', () => {
		const pts = elbowWaypoints(100, 0, 0, 50, 3, 0.5, 0.5, 0.5);
		expect(pts).toStrictEqual([
			{ x: 100, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
			{ x: 0, y: 50 },
		]);
	});

	it('degenerates to a straight vertical run when endpoints share x (overlap on x)', () => {
		const pts = elbowWaypoints(50, 0, 50, 100, 3, 0.5, 0.5, 0.5);
		for (const p of pts) {
			expect(p.x).toBe(50);
		}
		expect(pts[0]).toStrictEqual({ x: 50, y: 0 });
		expect(pts[pts.length - 1]).toStrictEqual({ x: 50, y: 100 });
	});

	it('degenerates to a straight horizontal run when endpoints share y (overlap on y)', () => {
		const pts = elbowWaypoints(0, 50, 100, 50, 3, 0.5, 0.5, 0.5);
		for (const p of pts) {
			expect(p.y).toBe(50);
		}
		expect(pts[0]).toStrictEqual({ x: 0, y: 50 });
		expect(pts[pts.length - 1]).toStrictEqual({ x: 100, y: 50 });
	});

	it('builds a 4-segment staircase (bentConnector4) through both adj1 and adj2', () => {
		const pts = elbowWaypoints(0, 0, 200, 100, 4, 0.5, 0.5, 0.5);
		expect(pts).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 50 },
			{ x: 200, y: 50 },
			{ x: 200, y: 100 },
		]);
	});

	it('builds a 5-segment staircase (bentConnector5) through adj1, adj2 and adj3 independently', () => {
		const pts = elbowWaypoints(0, 0, 200, 100, 5, 0.25, 0.5, 0.75);
		expect(pts).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
			{ x: 150, y: 50 },
			{ x: 150, y: 100 },
			{ x: 200, y: 100 },
		]);
	});

	it('bentConnector4 and bentConnector5 differ from bentConnector3 on the same box (no longer collapse to one shape)', () => {
		const seg3 = elbowWaypoints(0, 0, 200, 100, 3, 0.5, 0.5, 0.5);
		const seg4 = elbowWaypoints(0, 0, 200, 100, 4, 0.5, 0.5, 0.5);
		const seg5 = elbowWaypoints(0, 0, 200, 100, 5, 0.5, 0.5, 0.5);
		expect(seg3).toHaveLength(4);
		expect(seg4).toHaveLength(5);
		expect(seg5).toHaveLength(6);
		expect(seg3).not.toStrictEqual(seg4.slice(0, 4));
	});
});

describe('curvedElbowPathD: same orientation/segment logic, smooth instead of sharp', () => {
	it('renders a single smooth cubic for curvedConnector3, horizontal-primary', () => {
		expect(curvedElbowPathD(0, 0, 200, 50, 3, 0.5, 0.5, 0.5)).toBe('M0,0 C100,0 100,50 200,50');
	});

	it('renders a single smooth cubic for curvedConnector3, vertical-primary (transposed)', () => {
		expect(curvedElbowPathD(0, 0, 50, 200, 3, 0.5, 0.5, 0.5)).toBe('M0,0 C0,100 50,100 50,200');
	});

	it('renders a differentiated 3-curve path for curvedConnector4 (adj1 + adj2)', () => {
		expect(curvedElbowPathD(0, 0, 200, 100, 4, 0.5, 0.5, 0.5)).toBe(
			'M0,0 C100,0 100,0 100,25 C100,50 100,50 150,50 C200,50 200,50 200,100',
		);
	});

	it('renders a differentiated 4-curve path for curvedConnector5 (adj1 + adj2 + adj3)', () => {
		expect(curvedElbowPathD(0, 0, 200, 100, 5, 0.25, 0.5, 0.75)).toBe(
			'M0,0 C50,0 50,0 50,25 C50,50 50,50 100,50 C150,50 150,50 150,75 C150,100 150,100 200,100',
		);
	});
});
