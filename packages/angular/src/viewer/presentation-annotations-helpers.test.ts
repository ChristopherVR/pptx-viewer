/**
 * presentation-annotations-helpers.test.ts — unit tests for the pure annotation
 * geometry helpers. No TestBed, no DOM.
 *
 * Ported from React:
 *   packages/react/src/viewer/hooks/usePresentationAnnotations.ts
 */

import { describe, expect, it } from 'vitest';

import {
	ERASER_RADIUS,
	HIGHLIGHTER_OPACITY,
	HIGHLIGHTER_WIDTH,
	PEN_WIDTH,
	buildPathD,
	cursorForTool,
	eraseAtPoint,
	laserDotOpacity,
	nextStrokeId,
	resetStrokeIdCounter,
	smoothPoints,
	strokeHitsEraser,
} from './presentation-annotations-helpers';
import type { AnnotationPoint, AnnotationStroke } from './presentation-annotations-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pt(x: number, y: number): AnnotationPoint {
	return { x, y };
}

function stroke(
	id: string,
	points: AnnotationPoint[],
	overrides: Partial<AnnotationStroke> = {},
): AnnotationStroke {
	return {
		id,
		points,
		color: '#ff0000',
		width: PEN_WIDTH,
		opacity: 1,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Constants sanity check
// ---------------------------------------------------------------------------

describe('constants', () => {
	it('pen width is positive', () => {
		expect(PEN_WIDTH).toBeGreaterThan(0);
	});
	it('highlighter width is wider than pen', () => {
		expect(HIGHLIGHTER_WIDTH).toBeGreaterThan(PEN_WIDTH);
	});
	it('highlighter opacity is between 0 and 1 exclusive', () => {
		expect(HIGHLIGHTER_OPACITY).toBeGreaterThan(0);
		expect(HIGHLIGHTER_OPACITY).toBeLessThan(1);
	});
	it('eraser radius is positive', () => {
		expect(ERASER_RADIUS).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// nextStrokeId
// ---------------------------------------------------------------------------

describe('nextStrokeId', () => {
	it('returns a string prefixed with stroke-', () => {
		resetStrokeIdCounter();
		const id = nextStrokeId();
		expect(id.startsWith('stroke-')).toBeTruthy();
	});

	it('increments on each call', () => {
		resetStrokeIdCounter();
		const a = nextStrokeId();
		const b = nextStrokeId();
		const numA = parseInt(a.split('-')[1], 10);
		const numB = parseInt(b.split('-')[1], 10);
		expect(numB - numA).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// buildPathD
// ---------------------------------------------------------------------------

describe('buildPathD', () => {
	it('returns empty string for empty array', () => {
		expect(buildPathD([])).toBe('');
	});

	it('returns a Move-only path for a single point', () => {
		expect(buildPathD([pt(5, 10)])).toBe('M 5 10');
	});

	it('builds M + L chain for multiple points', () => {
		const result = buildPathD([pt(0, 0), pt(10, 5), pt(20, 0)]);
		expect(result).toBe('M 0 0 L 10 5 L 20 0');
	});

	it('preserves fractional coordinates', () => {
		const result = buildPathD([pt(1.5, 2.25), pt(3.75, 4.125)]);
		expect(result).toBe('M 1.5 2.25 L 3.75 4.125');
	});
});

// ---------------------------------------------------------------------------
// smoothPoints
// ---------------------------------------------------------------------------

describe('smoothPoints', () => {
	it('returns the original array unchanged for 0 or 1 points', () => {
		expect(smoothPoints([])).toStrictEqual([]);
		expect(smoothPoints([pt(1, 2)])).toStrictEqual([pt(1, 2)]);
	});

	it('returns the original array unchanged for 2 points', () => {
		const two = [pt(0, 0), pt(10, 10)];
		expect(smoothPoints(two)).toStrictEqual(two);
	});

	it('preserves first and last point exactly', () => {
		const pts = [pt(0, 0), pt(5, 100), pt(10, 50), pt(20, 200), pt(30, 30)];
		const smoothed = smoothPoints(pts, 2);
		expect(smoothed[0]).toStrictEqual(pt(0, 0));
		expect(smoothed[smoothed.length - 1]).toStrictEqual(pt(30, 30));
	});

	it('averages middle points within the window', () => {
		// Three collinear points: middle stays at (5,5).
		const pts = [pt(0, 0), pt(5, 5), pt(10, 10)];
		const smoothed = smoothPoints(pts, 1);
		expect(smoothed[1].x).toBeCloseTo(5);
		expect(smoothed[1].y).toBeCloseTo(5);
	});

	it('is a no-op when window is 0', () => {
		const pts = [pt(0, 0), pt(50, 100), pt(10, 5)];
		expect(smoothPoints(pts, 0)).toStrictEqual(pts);
	});
});

// ---------------------------------------------------------------------------
// strokeHitsEraser
// ---------------------------------------------------------------------------

describe('strokeHitsEraser', () => {
	const s = stroke('s1', [pt(10, 10), pt(20, 20), pt(30, 30)]);

	it('returns true when eraser centre is within radius of a point', () => {
		expect(strokeHitsEraser(s, 10, 10, 5)).toBeTruthy();
	});

	it('returns true when eraser overlaps any intermediate point', () => {
		expect(strokeHitsEraser(s, 21, 21, 5)).toBeTruthy();
	});

	it('returns false when eraser is far from all points', () => {
		expect(strokeHitsEraser(s, 100, 100, 5)).toBeFalsy();
	});

	it('returns false for stroke with no points', () => {
		expect(strokeHitsEraser(stroke('s2', []), 0, 0, 100)).toBeFalsy();
	});

	it('boundary: excludes a point exactly at radius (strict <)', () => {
		// distance = 5, radius = 5 → not hit (strict <)
		expect(strokeHitsEraser(stroke('s3', [pt(5, 0)]), 0, 0, 5)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// eraseAtPoint
// ---------------------------------------------------------------------------

describe('eraseAtPoint', () => {
	const strokes = [
		stroke('a', [pt(0, 0), pt(5, 5)]),
		stroke('b', [pt(100, 100), pt(110, 110)]),
		stroke('c', [pt(3, 3)]),
	];

	it('removes strokes that hit the eraser', () => {
		const result = eraseAtPoint(strokes, 0, 0, 10);
		const ids = result.map((s) => s.id);
		// 'a' and 'c' are within 10px of (0,0)
		expect(ids).not.toContain('a');
		expect(ids).not.toContain('c');
		expect(ids).toContain('b');
	});

	it('returns all strokes when eraser misses everything', () => {
		const result = eraseAtPoint(strokes, 500, 500, 5);
		expect(result).toHaveLength(3);
	});

	it('returns empty array when all strokes are erased', () => {
		const result = eraseAtPoint(strokes, 2, 2, 200);
		expect(result).toHaveLength(0);
	});

	it('does not mutate the input array', () => {
		const original = [...strokes];
		eraseAtPoint(strokes, 0, 0, 10);
		expect(strokes).toHaveLength(original.length);
	});
});

// ---------------------------------------------------------------------------
// laserDotOpacity
// ---------------------------------------------------------------------------

describe('laserDotOpacity', () => {
	it('returns 1 (fully opaque) at ratio 0', () => {
		expect(laserDotOpacity(0)).toBeCloseTo(1);
	});

	it('returns 0 (fully transparent) at ratio 1', () => {
		expect(laserDotOpacity(1)).toBeCloseTo(0);
	});

	it('is monotonically decreasing', () => {
		const values = [0, 0.25, 0.5, 0.75, 1].map(laserDotOpacity);
		for (let i = 1; i < values.length; i++) {
			expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
		}
	});

	it('clamps ratio below 0 to 0', () => {
		expect(laserDotOpacity(-5)).toBeCloseTo(1);
	});

	it('clamps ratio above 1 to 1', () => {
		expect(laserDotOpacity(5)).toBeCloseTo(0);
	});

	it('midpoint ratio produces value in (0, 1)', () => {
		const v = laserDotOpacity(0.5);
		expect(v).toBeGreaterThan(0);
		expect(v).toBeLessThan(1);
	});
});

// ---------------------------------------------------------------------------
// cursorForTool
// ---------------------------------------------------------------------------

describe('cursorForTool', () => {
	it('returns none for laser (hides the native cursor)', () => {
		expect(cursorForTool('laser')).toBe('none');
	});

	it('returns crosshair for pen', () => {
		expect(cursorForTool('pen')).toBe('crosshair');
	});

	it('returns crosshair for highlighter', () => {
		expect(cursorForTool('highlighter')).toBe('crosshair');
	});

	it('returns crosshair for eraser', () => {
		expect(cursorForTool('eraser')).toBe('crosshair');
	});

	it('returns default for none', () => {
		expect(cursorForTool('none')).toBe('default');
	});
});
