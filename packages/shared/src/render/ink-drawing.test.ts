import { describe, expect, it } from 'vitest';

import {
	DEFAULT_POINTER_PRESSURE,
	pointFromPointerEvent,
	pointsToSvgPathD,
	strokeToInkElement,
} from './ink-drawing';

describe('pointsToSvgPathD', () => {
	it('returns an empty string for no points', () => {
		expect(pointsToSvgPathD([])).toBe('');
	});

	it('builds an M/L path from the given points', () => {
		expect(
			pointsToSvgPathD([
				{ x: 0, y: 0 },
				{ x: 10, y: 5 },
				{ x: 20, y: 0 },
			]),
		).toBe('M 0 0 L 10 5 L 20 0');
	});
});

describe('strokeToInkElement', () => {
	it('returns null for fewer than 2 points (a tap)', () => {
		expect(
			strokeToInkElement({ points: [{ x: 0, y: 0 }], color: '#000', width: 3, tool: 'pen' }),
		).toBeNull();
	});

	it('omits inkPointPressures when every point reports the mouse default (no real pressure data)', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0, pressure: DEFAULT_POINTER_PRESSURE },
				{ x: 10, y: 5, pressure: DEFAULT_POINTER_PRESSURE },
				{ x: 20, y: 0, pressure: DEFAULT_POINTER_PRESSURE },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink).not.toBeNull();
		expect(ink?.inkPointPressures).toBeUndefined();
	});

	it('omits inkPointPressures when points carry no pressure field at all (older callers)', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 5 },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink?.inkPointPressures).toBeUndefined();
	});

	it('authors a per-point inkPointPressures channel when pressure genuinely varies (stylus)', () => {
		const pressures = [0.2, 0.5, 0.9, 0.4];
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0, pressure: pressures[0] },
				{ x: 10, y: 5, pressure: pressures[1] },
				{ x: 20, y: 0, pressure: pressures[2] },
				{ x: 30, y: 5, pressure: pressures[3] },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink?.inkPointPressures).toStrictEqual([pressures]);
	});

	it('matches React: one inkPointPressures entry per inkPaths entry (a single freshly drawn stroke)', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0, pressure: 0.1 },
				{ x: 5, y: 5, pressure: 0.9 },
			],
			color: '#f00',
			width: 4,
			tool: 'highlighter',
		});
		expect(ink?.inkPaths).toHaveLength(1);
		expect(ink?.inkPointPressures).toHaveLength(1);
		expect(ink?.inkPointPressures?.[0]).toHaveLength(ink?.inkPaths.length ? 2 : 0);
		expect(ink?.inkOpacities).toStrictEqual([0.4]);
		expect(ink?.inkTool).toBe('highlighter');
	});

	it('a near-uniform reading within the 0.01 epsilon is still treated as no real pressure', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0, pressure: 0.5 },
				{ x: 10, y: 5, pressure: 0.505 },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink?.inkPointPressures).toBeUndefined();
	});

	it('omits inkPointTiltX/Y when every point reports a flat (0, 0) tilt (mouse / no tilt sensor)', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0, tiltX: 0, tiltY: 0 },
				{ x: 10, y: 5, tiltX: 0, tiltY: 0 },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink?.inkPointTiltX).toBeUndefined();
		expect(ink?.inkPointTiltY).toBeUndefined();
	});

	it('omits inkPointTiltX/Y when points carry no tilt field at all (older callers, other bindings)', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 5 },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink?.inkPointTiltX).toBeUndefined();
		expect(ink?.inkPointTiltY).toBeUndefined();
	});

	it('authors inkPointTiltX/Y (raw degrees) when any point reports a genuinely non-zero tilt', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0, tiltX: 0, tiltY: 0 },
				{ x: 10, y: 5, tiltX: 30, tiltY: -15 },
				{ x: 20, y: 0, tiltX: 0, tiltY: 0 },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink?.inkPointTiltX).toStrictEqual([[0, 30, 0]]);
		expect(ink?.inkPointTiltY).toStrictEqual([[0, -15, 0]]);
	});

	it('unlike pressure, a CONSTANT non-zero tilt across every point still authors the channel (flat is the no-tilt baseline, not uniformity)', () => {
		const ink = strokeToInkElement({
			points: [
				{ x: 0, y: 0, tiltX: 10, tiltY: 10 },
				{ x: 10, y: 5, tiltX: 10, tiltY: 10 },
			],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(ink?.inkPointTiltX).toStrictEqual([[10, 10]]);
		expect(ink?.inkPointTiltY).toStrictEqual([[10, 10]]);
	});
});

describe('pointFromPointerEvent', () => {
	it('attaches pressure and tilt from the event onto an already stage-mapped position', () => {
		expect(pointFromPointerEvent(12, 34, { pressure: 0.7, tiltX: 20, tiltY: -5 })).toStrictEqual({
			x: 12,
			y: 34,
			pressure: 0.7,
			tiltX: 20,
			tiltY: -5,
		});
	});

	it('carries through undefined pressure/tilt fields verbatim (a mouse event has neither)', () => {
		expect(pointFromPointerEvent(1, 2, {})).toStrictEqual({
			x: 1,
			y: 2,
			pressure: undefined,
			tiltX: undefined,
			tiltY: undefined,
		});
	});
});
