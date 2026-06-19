import { describe, it, expect } from 'vitest';

import {
	routeConnector,
	routeOrthogonalConnector,
	waypointsToPathData,
	waypointsToPathD,
} from './connector-router';
import type { RouterPoint, RouterRect } from './connector-router-types';

// ==========================================================================
// waypointsToPathData (React-style, space-separated)
// ==========================================================================

describe('waypointsToPathData', () => {
	it('returns empty string for empty array', () => {
		expect(waypointsToPathData([])).toBe('');
	});

	it('returns m command for single point', () => {
		expect(waypointsToPathData([{ x: 10, y: 20 }])).toBe('M 10 20');
	});

	it('returns m + l commands for two points', () => {
		const result = waypointsToPathData([
			{ x: 0, y: 0 },
			{ x: 100, y: 50 },
		]);
		expect(result).toBe('M 0 0 L 100 50');
	});

	it('returns m + multiple l commands for a polyline', () => {
		const result = waypointsToPathData([
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
			{ x: 100, y: 50 },
		]);
		expect(result).toBe('M 0 0 L 50 0 L 50 50 L 100 50');
	});

	it('handles negative coordinates', () => {
		const result = waypointsToPathData([
			{ x: -10, y: -20 },
			{ x: 30, y: 40 },
		]);
		expect(result).toBe('M -10 -20 L 30 40');
	});

	it('handles floating point coordinates', () => {
		const result = waypointsToPathData([
			{ x: 1.5, y: 2.7 },
			{ x: 3.14, y: 4.28 },
		]);
		expect(result).toContain('M 1.5 2.7');
		expect(result).toContain('L 3.14 4.28');
	});
});

// ==========================================================================
// waypointsToPathD (Angular-style, comma-separated)
// ==========================================================================

describe('waypointsToPathD', () => {
	it('returns empty string for empty array', () => {
		expect(waypointsToPathD([])).toBe('');
	});

	it('returns m command for single point', () => {
		expect(waypointsToPathD([{ x: 10, y: 20 }])).toBe('M10,20');
	});

	it('returns m + l commands for a polyline', () => {
		const result = waypointsToPathD([
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
		]);
		expect(result).toBe('M0,0 L50,0 L50,50');
	});
});

// ==========================================================================
// routeConnector (React-style options object)
// ==========================================================================

describe('routeConnector', () => {
	const defaults = {
		canvasWidth: 1000,
		canvasHeight: 600,
	};

	it('returns direct path when no obstacles', () => {
		const start: RouterPoint = { x: 10, y: 50 };
		const end: RouterPoint = { x: 200, y: 50 };
		const result = routeConnector({ start, end, obstacles: [], ...defaults });
		expect(result).toStrictEqual([start, end]);
	});

	it('returns direct path when obstacle does not block the line', () => {
		const start: RouterPoint = { x: 10, y: 10 };
		const end: RouterPoint = { x: 200, y: 10 };
		const obstacles: RouterRect[] = [{ x: 50, y: 100, width: 50, height: 50 }];
		const result = routeConnector({ start, end, obstacles, ...defaults });
		expect(result).toStrictEqual([start, end]);
	});

	it('returns elbow path when direct is blocked but elbow is clear', () => {
		const start: RouterPoint = { x: 10, y: 50 };
		const end: RouterPoint = { x: 200, y: 150 };
		const obstacles: RouterRect[] = [{ x: 80, y: 80, width: 40, height: 40 }];
		const result = routeConnector({ start, end, obstacles, ...defaults });
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
	});

	it('routes around obstacle using a* when elbows are blocked', () => {
		const start: RouterPoint = { x: 10, y: 100 };
		const end: RouterPoint = { x: 300, y: 100 };
		const obstacles: RouterRect[] = [{ x: 100, y: 50, width: 100, height: 100 }];
		const result = routeConnector({ start, end, obstacles, ...defaults });
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
	});

	it('respects custom padding', () => {
		const start: RouterPoint = { x: 10, y: 50 };
		const end: RouterPoint = { x: 200, y: 50 };
		const obstacles: RouterRect[] = [{ x: 80, y: 30, width: 40, height: 40 }];
		const resultZero = routeConnector({ start, end, obstacles, padding: 0, ...defaults });
		expect(resultZero.length).toBeGreaterThanOrEqual(2);
		expect(resultZero[0]).toStrictEqual(start);
		expect(resultZero[resultZero.length - 1]).toStrictEqual(end);
	});

	it('routes around multiple obstacles', () => {
		const start: RouterPoint = { x: 10, y: 100 };
		const end: RouterPoint = { x: 500, y: 100 };
		const obstacles: RouterRect[] = [
			{ x: 100, y: 50, width: 80, height: 100 },
			{ x: 300, y: 50, width: 80, height: 100 },
		];
		const result = routeConnector({ start, end, obstacles, ...defaults });
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
	});

	it('handles horizontal path with no height difference', () => {
		const start: RouterPoint = { x: 0, y: 100 };
		const end: RouterPoint = { x: 500, y: 100 };
		const result = routeConnector({ start, end, obstacles: [], ...defaults });
		expect(result).toStrictEqual([start, end]);
	});

	it('handles vertical path with no width difference', () => {
		const start: RouterPoint = { x: 100, y: 0 };
		const end: RouterPoint = { x: 100, y: 300 };
		const result = routeConnector({ start, end, obstacles: [], ...defaults });
		expect(result).toStrictEqual([start, end]);
	});

	it('handles start and end at the same position', () => {
		const point: RouterPoint = { x: 50, y: 50 };
		const result = routeConnector({ start: point, end: point, obstacles: [], ...defaults });
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	it('handles points near canvas edges', () => {
		const start: RouterPoint = { x: 5, y: 5 };
		const end: RouterPoint = { x: 995, y: 595 };
		const result = routeConnector({ start, end, obstacles: [], ...defaults });
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
	});
});

// ==========================================================================
// routeOrthogonalConnector (Angular-style positional args)
// ==========================================================================

describe('routeOrthogonalConnector', () => {
	it('returns direct path when no obstacles (default canvas)', () => {
		const start: RouterPoint = { x: 0, y: 0 };
		const end: RouterPoint = { x: 100, y: 0 };
		expect(routeOrthogonalConnector(start, end, [])).toStrictEqual([start, end]);
	});

	it('routes around a blocking obstacle', () => {
		const start: RouterPoint = { x: 10, y: 100 };
		const end: RouterPoint = { x: 300, y: 100 };
		const obstacles: RouterRect[] = [{ x: 100, y: 50, width: 100, height: 100 }];
		const result = routeOrthogonalConnector(start, end, obstacles, {
			canvasWidth: 1000,
			canvasHeight: 600,
		});
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
	});
});
