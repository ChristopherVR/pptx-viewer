import { describe, expect, it } from 'vitest';

import {
	CLOUD_CALLOUT_TAIL_COUNT,
	CLOUD_LOBE_COUNT,
	getCloudCalloutClipPath,
	getCloudClipPath,
} from './cloud-bezier-paths';
import { getCloudPathForRendering, getShapeClipPath } from './shape-geometry';

/** Count cubic-Bezier "C" commands in a path string. */
function countCubics(path: string): number {
	const matches = path.match(/C/g);
	return matches ? matches.length : 0;
}

describe('getCloudClipPath', () => {
	it('returns a path() expression with at least 8 cubic-Bezier curves', () => {
		const result = getCloudClipPath(100, 100);
		expect(result.startsWith("path('")).toBeTruthy();
		expect(result.endsWith("')")).toBeTruthy();
		expect(countCubics(result)).toBeGreaterThanOrEqual(8);
	});

	it('exposes 8 lobes via CLOUD_LOBE_COUNT', () => {
		expect(CLOUD_LOBE_COUNT).toBe(8);
	});

	it('emits 4 cubic-Bezier curves per lobe (32 total)', () => {
		const result = getCloudClipPath(100, 100);
		// 4 cubics per lobe * 8 lobes = 32
		expect(countCubics(result)).toBe(32);
	});

	it('produces deterministic output for fixed dimensions', () => {
		const a = getCloudClipPath(200, 150);
		const b = getCloudClipPath(200, 150);
		expect(a).toBe(b);
	});

	it('closes the path with Z', () => {
		const result = getCloudClipPath(120, 80);
		// Strip the trailing "')" from the path() wrapper before checking.
		const inner = result.slice("path('".length, -2);
		expect(inner.trimEnd().endsWith('Z')).toBeTruthy();
	});

	it('produces different paths for different aspect ratios', () => {
		const square = getCloudClipPath(100, 100);
		const wide = getCloudClipPath(200, 100);
		const tall = getCloudClipPath(100, 200);
		expect(square).not.toBe(wide);
		expect(square).not.toBe(tall);
		expect(wide).not.toBe(tall);
	});

	it('starts with an M command (moveto)', () => {
		const result = getCloudClipPath(100, 100);
		const inner = result.slice("path('".length, -2);
		expect(inner.startsWith('M')).toBeTruthy();
	});

	it('handles zero/negative dimensions gracefully (clamped to 1)', () => {
		expect(() => getCloudClipPath(0, 0)).not.toThrow();
		expect(() => getCloudClipPath(-10, -10)).not.toThrow();
	});

	it('coordinates scale with width', () => {
		const small = getCloudClipPath(100, 100);
		const large = getCloudClipPath(1000, 1000);
		// Larger box should contain larger coordinate values somewhere.
		const smallMaxNum = Math.max(...(small.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number));
		const largeMaxNum = Math.max(...(large.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number));
		expect(largeMaxNum).toBeGreaterThan(smallMaxNum);
	});
});

describe('getCloudCalloutClipPath', () => {
	it('returns a path() expression with at least 8 cubic-Bezier curves', () => {
		const result = getCloudCalloutClipPath(100, 100);
		expect(result.startsWith("path('")).toBeTruthy();
		expect(countCubics(result)).toBeGreaterThanOrEqual(8);
	});

	it('exposes 3 tail bumps via CLOUD_CALLOUT_TAIL_COUNT', () => {
		expect(CLOUD_CALLOUT_TAIL_COUNT).toBe(3);
	});

	it('includes additional cubic-Beziers for tail bumps beyond the body', () => {
		const body = getCloudClipPath(100, 100);
		const callout = getCloudCalloutClipPath(100, 100);
		// Body emits 32 cubics. Callout body (same lobes) emits 32 cubics +
		// 4 cubics per tail bump * 3 bumps = 44 cubics total.
		expect(countCubics(callout)).toBeGreaterThan(countCubics(body));
		expect(countCubics(callout)).toBe(32 + 4 * CLOUD_CALLOUT_TAIL_COUNT);
	});

	it('contains multiple subpaths (one M per tail bump plus the body)', () => {
		const result = getCloudCalloutClipPath(100, 100);
		const moveCount = (result.match(/M/g) ?? []).length;
		// 1 body + 3 tail bumps = 4 M commands
		expect(moveCount).toBe(1 + CLOUD_CALLOUT_TAIL_COUNT);
	});

	it('produces deterministic output for fixed dimensions', () => {
		const a = getCloudCalloutClipPath(200, 150);
		const b = getCloudCalloutClipPath(200, 150);
		expect(a).toBe(b);
	});

	it('closes the path with Z', () => {
		const result = getCloudCalloutClipPath(120, 80);
		const inner = result.slice("path('".length, -2);
		expect(inner.trimEnd().endsWith('Z')).toBeTruthy();
	});

	it('differs from the plain cloud path at identical dimensions', () => {
		const cloud = getCloudClipPath(100, 100);
		const callout = getCloudCalloutClipPath(100, 100);
		expect(cloud).not.toBe(callout);
	});
});

describe('getCloudPathForRendering', () => {
	it('returns the Bezier path for cloud', () => {
		const result = getCloudPathForRendering('cloud', 200, 100);
		expect(result).toBeDefined();
		expect(result).toBe(getCloudClipPath(200, 100));
	});

	it('returns the Bezier path for cloudCallout (case-insensitive)', () => {
		const result = getCloudPathForRendering('cloudCallout', 200, 100);
		expect(result).toBeDefined();
		expect(result).toBe(getCloudCalloutClipPath(200, 100));
	});

	it('returns undefined for non-cloud shapes', () => {
		expect(getCloudPathForRendering('rect', 100, 100)).toBeUndefined();
		expect(getCloudPathForRendering('star5', 100, 100)).toBeUndefined();
		expect(getCloudPathForRendering(undefined, 100, 100)).toBeUndefined();
	});

	it('does NOT replace the static polygon fallback in getShapeClipPath', () => {
		// Static lookup must still return the polygon for backward compat.
		const staticCloud = getShapeClipPath('cloud');
		expect(staticCloud).toBeDefined();
		expect(staticCloud!.startsWith('polygon(')).toBeTruthy();
		const staticCallout = getShapeClipPath('cloudCallout');
		expect(staticCallout).toBeDefined();
		expect(staticCallout!.startsWith('polygon(')).toBeTruthy();
	});
});
