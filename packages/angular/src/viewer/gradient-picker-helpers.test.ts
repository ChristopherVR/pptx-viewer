/**
 * gradient-picker-helpers.test.ts: Unit tests for gradient-picker-helpers.ts.
 *
 * All tests are pure (no TestBed / DOM). They drive the helper functions
 * directly against synthetic PptxElement stubs.
 */

import { describe, expect, it } from 'vitest';

import {
	addGradientStopPatch,
	gradientStateFromStyle,
	gradientStateOf,
	gradientStatePatch,
	hasGradientFill,
	removeGradientStopPatch,
	updateGradientStopPatch,
} from './gradient-picker-helpers';
import type { GradientState } from './gradient-picker-helpers';

// ── Helpers to build minimal PptxElements ────────────────────────────────────

function makeShape(shapeStyle: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'el-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
	};
}

function makeText(): Record<string, unknown> {
	return { id: 'el-2', type: 'text', x: 0, y: 0, width: 100, height: 100 };
}

// Cast helpers: we pass unknown elements; the helpers do runtime narrowing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asEl = (x: unknown): any => x;

// ── gradientStateFromStyle ────────────────────────────────────────────────────

describe('gradientStateFromStyle', () => {
	it('returns defaults when style is undefined', () => {
		const state = gradientStateFromStyle(undefined);
		expect(state.type).toBe('linear');
		expect(state.angle).toBe(90);
		expect(state.stops).toHaveLength(2);
	});

	it('reads type and angle from style', () => {
		const state = gradientStateFromStyle({
			fillGradientType: 'radial',
			fillGradientAngle: 45,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(state.type).toBe('radial');
		expect(state.angle).toBe(45);
	});

	it('sorts stops by position ascending', () => {
		const state = gradientStateFromStyle({
			fillGradientStops: [
				{ color: '#ffffff', position: 100 },
				{ color: '#000000', position: 0 },
			],
		});
		expect(state.stops[0].position).toBe(0);
		expect(state.stops[1].position).toBe(100);
	});

	it('falls back to two default stops when fewer than two are provided', () => {
		const state = gradientStateFromStyle({
			fillGradientStops: [{ color: '#aabbcc', position: 50 }],
		});
		expect(state.stops).toHaveLength(2);
	});

	it('clamps stop positions to 0-100', () => {
		const state = gradientStateFromStyle({
			fillGradientStops: [
				{ color: '#ff0000', position: -10 },
				{ color: '#00ff00', position: 200 },
			],
		});
		expect(state.stops[0].position).toBe(0);
		expect(state.stops[1].position).toBe(100);
	});
});

// ── gradientStateOf ───────────────────────────────────────────────────────────

describe('gradientStateOf', () => {
	it('returns defaults for non-shape elements', () => {
		const state = gradientStateOf(asEl(makeText()));
		expect(state.type).toBe('linear');
		expect(state.stops).toHaveLength(2);
	});

	it('reads state from shape shapeStyle', () => {
		const el = makeShape({
			fillMode: 'gradient',
			fillGradientType: 'linear',
			fillGradientAngle: 135,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#00ff00', position: 100 },
			],
		});
		const state = gradientStateOf(asEl(el));
		expect(state.angle).toBe(135);
		expect(state.stops[0].color).toBe('#ff0000');
	});
});

// ── hasGradientFill ───────────────────────────────────────────────────────────

describe('hasGradientFill', () => {
	it('returns false for non-shape elements', () => {
		expect(hasGradientFill(asEl(makeText()))).toBeFalsy();
	});

	it('returns false when fillMode is not gradient', () => {
		expect(hasGradientFill(asEl(makeShape({ fillMode: 'solid' })))).toBeFalsy();
	});

	it('returns true when fillMode is gradient', () => {
		expect(hasGradientFill(asEl(makeShape({ fillMode: 'gradient' })))).toBeTruthy();
	});
});

// ── gradientStatePatch ────────────────────────────────────────────────────────

describe('gradientStatePatch', () => {
	it('produces a patch with fillMode gradient', () => {
		const el = makeShape({ fillColor: '#ff0000', fillMode: 'solid' });
		const state: GradientState = {
			type: 'linear',
			angle: 90,
			stops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#ffffff', position: 100 },
			],
		};
		const patch = gradientStatePatch(asEl(el), state);
		expect((patch as Record<string, unknown>)['shapeStyle']).toBeDefined();
		const ss = (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
		expect(ss['fillMode']).toBe('gradient');
		expect(ss['fillGradientAngle']).toBe(90);
		expect(ss['fillColor']).toBe('#ff0000'); // existing field preserved
	});

	it('preserves unrelated shapeStyle fields', () => {
		const el = makeShape({ strokeColor: '#000000', fillMode: 'solid' });
		const state: GradientState = {
			type: 'radial',
			angle: 0,
			stops: [
				{ color: '#aabbcc', position: 0 },
				{ color: '#ddeeff', position: 100 },
			],
		};
		const patch = gradientStatePatch(asEl(el), state);
		const ss = (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
		expect(ss['strokeColor']).toBe('#000000');
	});
});

// ── addGradientStopPatch ──────────────────────────────────────────────────────

describe('addGradientStopPatch', () => {
	it('adds a new stop to the gradient', () => {
		const el = makeShape({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const patch = addGradientStopPatch(asEl(el), '#00ff00', 50);
		const ss = (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
		const stops = ss['fillGradientStops'] as Array<unknown>;
		expect(stops).toHaveLength(3);
	});

	it('clamps stop position to 0-100', () => {
		const el = makeShape({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#000000', position: 0 },
				{ color: '#ffffff', position: 100 },
			],
		});
		const patch = addGradientStopPatch(asEl(el), '#aabbcc', 150);
		const ss = (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
		const stops = ss['fillGradientStops'] as Array<{ position: number }>;
		expect(stops.some((s) => s.position === 100)).toBeTruthy();
	});
});

// ── removeGradientStopPatch ───────────────────────────────────────────────────

describe('removeGradientStopPatch', () => {
	it('returns null when only 2 stops remain', () => {
		const el = makeShape({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(removeGradientStopPatch(asEl(el), 0)).toBeNull();
	});

	it('removes the stop at the given index when 3+ stops exist', () => {
		const el = makeShape({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#00ff00', position: 50 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const patch = removeGradientStopPatch(asEl(el), 1);
		expect(patch).not.toBeNull();
		const ss = (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
		const stops = ss['fillGradientStops'] as Array<{ color: string }>;
		expect(stops).toHaveLength(2);
		expect(stops.some((s) => s.color === '#00ff00')).toBeFalsy();
	});
});

// ── updateGradientStopPatch ───────────────────────────────────────────────────

describe('updateGradientStopPatch', () => {
	it('updates the color of the stop at index', () => {
		const el = makeShape({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const patch = updateGradientStopPatch(asEl(el), 0, { color: '#aabbcc' });
		const ss = (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
		const stops = ss['fillGradientStops'] as Array<{ color: string; position: number }>;
		const first = stops.find((s) => s.position === 0);
		expect(first?.color).toBe('#aabbcc');
	});

	it('re-sorts stops after a position change', () => {
		const el = makeShape({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const patch = updateGradientStopPatch(asEl(el), 0, { position: 80 });
		const ss = (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
		const stops = ss['fillGradientStops'] as Array<{ position: number }>;
		// After re-sort, the stop that was at 0 is now at 80, so first stop should be the 100 one
		expect(stops[0].position).toBeLessThanOrEqual(stops[1].position);
	});
});
