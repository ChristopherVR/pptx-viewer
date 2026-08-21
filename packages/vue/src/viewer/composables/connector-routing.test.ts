import type { PptxElementWithShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	connectorNeedsPath,
	getCompoundLineOffsets,
	getCompoundLineWidths,
	getConnectorPathGeometry,
} from './connector-routing';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeConnector(
	overrides: Partial<{
		shapeType: string;
		width: number;
		height: number;
		flipHorizontal: boolean;
		flipVertical: boolean;
		shapeAdjustments: Record<string, number>;
	}> = {},
): PptxElementWithShapeStyle {
	return {
		type: 'connector',
		id: 'test-cxn',
		x: 0,
		y: 0,
		width: overrides.width ?? 200,
		height: overrides.height ?? 100,
		shapeType: overrides.shapeType,
		flipHorizontal: overrides.flipHorizontal,
		flipVertical: overrides.flipVertical,
		shapeAdjustments: overrides.shapeAdjustments,
		shapeStyle: {},
	} as unknown as PptxElementWithShapeStyle;
}

// ── connectorNeedsPath ────────────────────────────────────────────────────────

describe('connectorNeedsPath', () => {
	it('returns false for straight connectors', () => {
		expect(connectorNeedsPath('straightConnector1')).toBeFalsy();
		expect(connectorNeedsPath('line')).toBeFalsy();
		expect(connectorNeedsPath(undefined)).toBeFalsy();
	});

	it('returns true for bentConnector* variants', () => {
		expect(connectorNeedsPath('bentConnector2')).toBeTruthy();
		expect(connectorNeedsPath('bentConnector3')).toBeTruthy();
		expect(connectorNeedsPath('bentConnector4')).toBeTruthy();
		expect(connectorNeedsPath('bentConnector5')).toBeTruthy();
	});

	it('returns true for curvedConnector* variants', () => {
		expect(connectorNeedsPath('curvedConnector2')).toBeTruthy();
		expect(connectorNeedsPath('curvedConnector3')).toBeTruthy();
		expect(connectorNeedsPath('curvedConnector4')).toBeTruthy();
		expect(connectorNeedsPath('curvedConnector5')).toBeTruthy();
	});

	it('is case-insensitive', () => {
		expect(connectorNeedsPath('BentConnector3')).toBeTruthy();
		expect(connectorNeedsPath('CURVEDCONNECTOR2')).toBeTruthy();
	});
});

// ── getConnectorPathGeometry: straight ──────────────────────────────────────

describe('getConnectorPathGeometry: straight / default', () => {
	it('produces a straight M…L path from (0,0) to (W,H)', () => {
		const geo = getConnectorPathGeometry(makeConnector({ width: 100, height: 50 }));
		expect(geo.pathData).toBe('M 0 0 L 100 50');
		expect(geo.startX).toBe(0);
		expect(geo.startY).toBe(0);
		expect(geo.endX).toBe(100);
		expect(geo.endY).toBe(50);
	});

	it('mirrors start/end when flipHorizontal is set', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ width: 100, height: 50, flipHorizontal: true }),
		);
		expect(geo.startX).toBe(100);
		expect(geo.endX).toBe(0);
		// Path should start at (W,0) and end at (0,H)
		expect(geo.pathData).toMatch(/^M 100 0/u);
		expect(geo.pathData).toMatch(/L 0 50$/u);
	});
});

// ── getConnectorPathGeometry: bentConnector2 ─────────────────────────────────

describe('getConnectorPathGeometry: bentConnector2', () => {
	it('produces an L-shaped (3 point) path', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector2', width: 200, height: 100 }),
		);
		// M start L corner L end: 3 segments
		const segments = geo.pathData.match(/[ML]/gu) ?? [];
		expect(segments).toHaveLength(3);
		expect(geo.pathData).toMatch(/^M /u);
	});

	it('is not a single straight line', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector2', width: 200, height: 100 }),
		);
		// A straight line would be "M x1 y1 L x2 y2": only 2 L/M commands total
		const segments = geo.pathData.match(/[ML]/gu) ?? [];
		expect(segments.length).toBeGreaterThan(2);
	});
});

// ── getConnectorPathGeometry: bentConnector3 ─────────────────────────────────

describe('getConnectorPathGeometry: bentConnector3', () => {
	it('produces a 4-point Z-shaped path (default adj)', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector3', width: 200, height: 100 }),
		);
		// M + 3×L = 4 command tokens
		const segments = geo.pathData.match(/[ML]/gu) ?? [];
		expect(segments).toHaveLength(4);
	});

	it('honours adj1 for the mid-bend X position', () => {
		// adj1 = 25000 → 25% of width (200) = 50
		const geo = getConnectorPathGeometry(
			makeConnector({
				shapeType: 'bentConnector3',
				width: 200,
				height: 100,
				shapeAdjustments: { adj1: 25000 },
			}),
		);
		// Second segment should have x ≈ 50
		expect(geo.pathData).toContain('50');
	});

	it('path d string contains no curved commands (C/Q/A)', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector3', width: 200, height: 100 }),
		);
		expect(geo.pathData).not.toMatch(/[CQA]/u);
	});

	it('bends around a horizontal mid-line (not vertical) when the shapes are stacked', () => {
		// A connector between vertically-stacked shapes is taller than it is
		// wide. Before the fix, this still bent around a vertical mid-line at
		// `width * adj1` ('M 0 0 L 25 0 L 25 200 L 50 200'), so the connector
		// visually exited sideways even though the boxes it joins sit one above
		// the other. The fix picks the bend axis from whichever of width/height
		// dominates, so a tall box now routes V-H-V around a horizontal
		// mid-line at `height * adj1` instead.
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector3', width: 50, height: 200 }),
		);
		expect(geo.pathData).toBe('M 0 0 L 0 100 L 50 100 L 50 200');
	});
});

// ── getConnectorPathGeometry: bentConnector4 ─────────────────────────────────

describe('getConnectorPathGeometry: bentConnector4', () => {
	it('produces a 5-point path', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector4', width: 200, height: 100 }),
		);
		const segments = geo.pathData.match(/[ML]/gu) ?? [];
		expect(segments).toHaveLength(5);
	});
});

// ── getConnectorPathGeometry: bentConnector5 ─────────────────────────────────

describe('getConnectorPathGeometry: bentConnector5', () => {
	it('produces a 6-point path', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector5', width: 200, height: 100 }),
		);
		const segments = geo.pathData.match(/[ML]/gu) ?? [];
		expect(segments).toHaveLength(6);
	});
});

// ── getConnectorPathGeometry: curvedConnector2 ───────────────────────────────

describe('getConnectorPathGeometry: curvedConnector2', () => {
	it('produces a quadratic Bezier (Q command)', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'curvedConnector2', width: 200, height: 100 }),
		);
		expect(geo.pathData).toMatch(/Q/u);
		expect(geo.pathData).not.toMatch(/L/u);
	});
});

// ── getConnectorPathGeometry: curvedConnector3 ───────────────────────────────

describe('getConnectorPathGeometry: curvedConnector3', () => {
	it('produces cubic Bezier curves (C command, no L)', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'curvedConnector3', width: 200, height: 100 }),
		);
		expect(geo.pathData).toMatch(/C/u);
		expect(geo.pathData).not.toMatch(/\bL\b/u);
	});

	it('path starts at (0,0) and ends at (W,H) by default', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'curvedConnector3', width: 200, height: 100 }),
		);
		expect(geo.startX).toBe(0);
		expect(geo.startY).toBe(0);
		expect(geo.endX).toBe(200);
		expect(geo.endY).toBe(100);
	});
});

// ── getConnectorPathGeometry: curvedConnector4 & 5 ──────────────────────────

describe('getConnectorPathGeometry: curvedConnector4', () => {
	it('produces multiple cubic Bezier segments', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'curvedConnector4', width: 200, height: 100 }),
		);
		const cCount = (geo.pathData.match(/C/gu) ?? []).length;
		expect(cCount).toBeGreaterThanOrEqual(2);
	});
});

describe('getConnectorPathGeometry: curvedConnector5', () => {
	it('produces multiple cubic Bezier segments', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'curvedConnector5', width: 200, height: 100 }),
		);
		const cCount = (geo.pathData.match(/C/gu) ?? []).length;
		expect(cCount).toBeGreaterThanOrEqual(3);
	});
});

// ── getCompoundLineOffsets ────────────────────────────────────────────────────

describe('getCompoundLineOffsets', () => {
	it('returns [0] for single / undefined compound line', () => {
		expect(getCompoundLineOffsets(undefined, 2)).toStrictEqual([0]);
		expect(getCompoundLineOffsets('sng', 2)).toStrictEqual([0]);
	});

	it('returns 2 offsets for dbl, symmetric around centre', () => {
		const offsets = getCompoundLineOffsets('dbl', 4);
		expect(offsets).toHaveLength(2);
		expect(offsets[0]).toBeLessThan(0);
		expect(offsets[1]).toBeGreaterThan(0);
		expect(Math.abs(offsets[0]!)).toBeCloseTo(Math.abs(offsets[1]!));
	});

	it('returns 2 offsets for thickThin and thinThick', () => {
		expect(getCompoundLineOffsets('thickThin', 4)).toHaveLength(2);
		expect(getCompoundLineOffsets('thinThick', 4)).toHaveLength(2);
	});

	it('returns 3 offsets for tri', () => {
		const offsets = getCompoundLineOffsets('tri', 4);
		expect(offsets).toHaveLength(3);
		expect(offsets[1]).toBe(0); // centre line
	});

	it('uses a minimum gap of 1.5 regardless of thin strokeWidth', () => {
		const offsets = getCompoundLineOffsets('dbl', 0.1);
		expect(Math.abs(offsets[0]!)).toBeGreaterThanOrEqual(1.5);
	});
});

// ── getCompoundLineWidths ─────────────────────────────────────────────────────

describe('getCompoundLineWidths', () => {
	it('returns [base] for single / undefined compound line', () => {
		expect(getCompoundLineWidths(undefined, 4)).toStrictEqual([4]);
		expect(getCompoundLineWidths('sng', 4)).toStrictEqual([4]);
	});

	it('returns 2 widths summing to base for dbl', () => {
		const widths = getCompoundLineWidths('dbl', 4);
		expect(widths).toHaveLength(2);
		const sum = widths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(4);
	});

	it('returns 2 widths for thickThin and thinThick, first > second for thickThin', () => {
		const tt = getCompoundLineWidths('thickThin', 10);
		expect(tt[0]!).toBeGreaterThan(tt[1]!);
		const tn = getCompoundLineWidths('thinThick', 10);
		expect(tn[0]!).toBeLessThan(tn[1]!);
	});

	it('returns 3 widths for tri', () => {
		expect(getCompoundLineWidths('tri', 4)).toHaveLength(3);
	});

	it('enforces minimum base of 1 when strokeWidth is 0', () => {
		const widths = getCompoundLineWidths('sng', 0);
		expect(widths[0]).toBe(1);
	});
});
