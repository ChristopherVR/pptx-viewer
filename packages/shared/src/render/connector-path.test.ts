import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildConnectorGeometry,
	buildDashArray,
	connectorHitStrokeWidth,
	markerPath,
} from './connector-path';

describe('buildDashArray', () => {
	it('returns undefined for solid / missing dashes', () => {
		expect(buildDashArray('solid', 2)).toBeUndefined();
		expect(buildDashArray(undefined, 2)).toBeUndefined();
	});

	it('produces a distinct pattern per preset (not a single 3w/w approximation)', () => {
		// Aligned with the shape/border `getSvgStrokeDasharray` output.
		expect(buildDashArray('dot', 2)).toBe('2 4');
		expect(buildDashArray('sysDot', 2)).toBe('2 4');
		expect(buildDashArray('dash', 2)).toBe('8 4');
		expect(buildDashArray('lgDash', 4)).toBe('28 10');
	});

	it('emits multi-part patterns for dash-dot families', () => {
		expect(buildDashArray('dashDot', 2)).toBe('8 4 2 4');
		expect(buildDashArray('lgDashDotDot', 2)).toBe('14 5 2 4 2 4');
	});

	it('honours custDash segments (percent-of-width, 1000ths of a percent)', () => {
		const segments = [
			{ dash: 400, space: 300 },
			{ dash: 100, space: 300 },
		];
		// custDash implies the custom family even without a prstDash token.
		expect(buildDashArray(undefined, 2, segments)).toBe('0.8 0.6 0.2 0.6');
	});

	it('clamps sub-1px stroke widths to 1 before scaling', () => {
		expect(buildDashArray('dot', 0)).toBe('1 2');
	});
});

describe('markerPath', () => {
	it('defaults to a med-sized (4x4) marker box', () => {
		const m = markerPath('triangle');
		expect(m.shape).toBe('path');
		expect(m.d).toBe('M0 0 L10 5 L0 10 Z');
		expect(m.markerWidth).toBe(4);
		expect(m.markerHeight).toBe(4);
	});

	it('scales markerWidth by @len and markerHeight by @w', () => {
		const lg = markerPath('triangle', 'lg', 'lg');
		expect(lg.markerWidth).toBe(6);
		expect(lg.markerHeight).toBe(6);

		// arrowWidth=sm (height), arrowLength=med (width)
		const mixed = markerPath('oval', 'sm', 'med');
		expect(mixed.shape).toBe('circle');
		expect(mixed.markerWidth).toBe(4);
		expect(mixed.markerHeight).toBeCloseTo(2.4, 5);
	});

	it('keeps the historical shape/d for each arrow type', () => {
		expect(markerPath('diamond').d).toBe('M5 0 L10 5 L5 10 L0 5 Z');
		expect(markerPath('stealth').d).toBe('M0 0 L10 5 L0 10 L3 5 Z');
		expect(markerPath('oval').shape).toBe('circle');
	});
});

describe('connector pointer hit target', () => {
	it('never offers a target narrower than a finger', () => {
		expect(connectorHitStrokeWidth(0)).toBe(14);
		expect(connectorHitStrokeWidth(2)).toBe(14);
	});

	it('scales with a thick line so the target stays proportional', () => {
		expect(connectorHitStrokeWidth(6)).toBe(18);
		expect(connectorHitStrokeWidth(10)).toBe(30);
	});

	it('follows the endpoints of a straight connector, which has no path', () => {
		const geo = buildConnectorGeometry(
			{ id: 'c1', type: 'connector', x: 0, y: 0, width: 100, height: 50 } as PptxElement,
			3,
		);
		expect(geo.pathD).toBeUndefined();
		expect(geo.hitPathD).toBe('M0,0 L100,50');
		expect(geo.hitStrokeWidth).toBe(14);
	});

	it('follows the routed path when the connector bends', () => {
		const geo = buildConnectorGeometry(
			{
				id: 'c2',
				type: 'connector',
				shapeType: 'bentConnector3',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				shapeStyle: { strokeWidth: 8 },
			} as PptxElement,
			3,
		);
		expect(geo.hitPathD).toBe(geo.pathD);
		expect(geo.hitStrokeWidth).toBe(24);
	});
});
