/**
 * Unit tests for connector rendering logic.
 *
 * The Angular compiler (TestBed) requires `@analogjs/vite-plugin-angular` which
 * is a follow-up (see PORTING.md). These tests exercise the pure helpers in
 * `connector-path.ts` directly — no TestBed, no DOM — mirroring the coverage
 * of the Vue `ConnectorRenderer.test.ts`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildConnectorGeometry,
	buildConnectorPathD,
	buildDashArray,
	buildWrapperStyle,
	connectorBendFraction,
	connectorKind,
	markerPath,
	normalizeArrow,
} from './connector-path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connector(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'connector',
		id: 'cxn 1',
		x: 10,
		y: 20,
		width: 200,
		height: 0,
		shapeStyle: { strokeColor: '#ff0000', strokeWidth: 3 },
		...overrides,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// normalizeArrow
// ---------------------------------------------------------------------------

describe('normalizeArrow', () => {
	it('returns undefined for "none"', () => {
		expect(normalizeArrow('none')).toBeUndefined();
	});

	it('returns undefined for undefined input', () => {
		expect(normalizeArrow(undefined)).toBeUndefined();
	});

	it('passes through valid arrow types', () => {
		expect(normalizeArrow('triangle')).toBe('triangle');
		expect(normalizeArrow('diamond')).toBe('diamond');
		expect(normalizeArrow('oval')).toBe('oval');
		expect(normalizeArrow('stealth')).toBe('stealth');
		expect(normalizeArrow('arrow')).toBe('arrow');
	});
});

// ---------------------------------------------------------------------------
// markerPath
// ---------------------------------------------------------------------------

describe('markerPath', () => {
	it('returns a circle shape for "oval"', () => {
		expect(markerPath('oval').shape).toBe('circle');
	});

	it('returns a diamond path for "diamond"', () => {
		const m = markerPath('diamond');
		expect(m.shape).toBe('path');
		expect(m.d).toBe('M5 0 L10 5 L5 10 L0 5 Z');
	});

	it('returns a stealth path for "stealth"', () => {
		const m = markerPath('stealth');
		expect(m.shape).toBe('path');
		expect(m.d).toBe('M0 0 L10 5 L0 10 L3 5 Z');
	});

	it('returns the triangle/fallback path for "triangle"', () => {
		const m = markerPath('triangle');
		expect(m.shape).toBe('path');
		expect(m.d).toBe('M0 0 L10 5 L0 10 Z');
	});

	it('uses the triangle/fallback path for "arrow"', () => {
		expect(markerPath('arrow').shape).toBe('path');
	});
});

// ---------------------------------------------------------------------------
// buildDashArray
// ---------------------------------------------------------------------------

describe('buildDashArray', () => {
	it('returns undefined for "solid"', () => {
		expect(buildDashArray('solid', 2)).toBeUndefined();
	});

	it('returns undefined for undefined dash', () => {
		expect(buildDashArray(undefined, 2)).toBeUndefined();
	});

	it('returns a short dash for "dot"', () => {
		expect(buildDashArray('dot', 2)).toBe('2 2');
	});

	it('returns a short dash for "sysDot"', () => {
		expect(buildDashArray('sysDot', 2)).toBe('2 2');
	});

	it('returns a long dash for other types', () => {
		expect(buildDashArray('dash', 2)).toBe('6 2');
		expect(buildDashArray('lgDash', 4)).toBe('12 4');
	});

	it('clamps minimum stroke width to 1 for the dash calculation', () => {
		// strokeWidth of 0 → effective w is 1 → '1 1' for dot
		expect(buildDashArray('dot', 0)).toBe('1 1');
	});
});

// ---------------------------------------------------------------------------
// buildWrapperStyle
// ---------------------------------------------------------------------------

describe('buildWrapperStyle', () => {
	it('includes position and size', () => {
		const style = buildWrapperStyle(connector({ x: 10, y: 20, width: 200, height: 80 }), 0);
		expect(style).toContain('left:10px');
		expect(style).toContain('top:20px');
		expect(style).toContain('width:200px');
		expect(style).toContain('height:80px');
		expect(style).toContain('position:absolute');
	});

	it('includes the z-index', () => {
		const style = buildWrapperStyle(connector(), 7);
		expect(style).toContain('z-index:7');
	});

	it('adds rotation transform', () => {
		const style = buildWrapperStyle(connector({ rotation: 45 }), 0);
		expect(style).toContain('rotate(45deg)');
	});

	it('omits transform when there is no rotation', () => {
		const style = buildWrapperStyle(connector(), 0);
		expect(style).not.toContain('transform');
	});

	it('adds opacity', () => {
		const style = buildWrapperStyle(connector({ opacity: 0.5 }), 0);
		expect(style).toContain('opacity:0.5');
	});

	it('adds display:none for hidden elements', () => {
		const style = buildWrapperStyle(connector({ hidden: true }), 0);
		expect(style).toContain('display:none');
	});
});

// ---------------------------------------------------------------------------
// buildConnectorGeometry — integration / mirrors Vue test coverage
// ---------------------------------------------------------------------------

describe('buildConnectorGeometry', () => {
	it('reads stroke colour and width from shapeStyle', () => {
		const geo = buildConnectorGeometry(connector(), 0);
		expect(geo.strokeColor).toBe('#ff0000');
		expect(geo.strokeWidth).toBe(3);
	});

	it('falls back to DEFAULT_STROKE_COLOR when no shapeStyle', () => {
		const geo = buildConnectorGeometry(connector({ shapeStyle: undefined }), 0);
		expect(geo.strokeColor).toBeTypeOf('string');
		expect(geo.strokeColor.length).toBeGreaterThan(0);
		expect(geo.strokeColor).not.toBe('#ff0000');
	});

	it('clamps strokeWidth to 0 minimum', () => {
		const geo = buildConnectorGeometry(connector({ shapeStyle: { strokeWidth: -5 } }), 0);
		expect(geo.strokeWidth).toBe(0);
	});

	it('clamps svgW and svgH to at least 1', () => {
		const geo = buildConnectorGeometry(connector({ width: 0, height: 0 }), 0);
		expect(geo.svgW).toBe(1);
		expect(geo.svgH).toBe(1);
	});

	it('computes endpoints for a plain (non-flipped) connector', () => {
		const geo = buildConnectorGeometry(connector({ width: 100, height: 40 }), 0);
		expect(geo.x1).toBe(0);
		expect(geo.y1).toBe(0);
		expect(geo.x2).toBe(100);
		expect(geo.y2).toBe(40);
	});

	it('mirrors x endpoints when flipHorizontal is true', () => {
		const geo = buildConnectorGeometry(
			connector({ width: 100, height: 40, flipHorizontal: true }),
			0,
		);
		expect(geo.x1).toBe(100);
		expect(geo.x2).toBe(0);
	});

	it('mirrors y endpoints when flipVertical is true', () => {
		const geo = buildConnectorGeometry(
			connector({ width: 100, height: 40, flipVertical: true }),
			0,
		);
		expect(geo.y1).toBe(40);
		expect(geo.y2).toBe(0);
	});

	it('sanitises the element id for marker ids', () => {
		const geo = buildConnectorGeometry(connector({ id: 'cxn 1' }), 0);
		expect(geo.startMarkerId).toBe('cxn_1-start');
		expect(geo.endMarkerId).toBe('cxn_1-end');
	});

	it('returns null markers when no arrows are set', () => {
		const geo = buildConnectorGeometry(connector(), 0);
		expect(geo.startMarker).toBeNull();
		expect(geo.endMarker).toBeNull();
		expect(geo.startMarkerRef).toBeNull();
		expect(geo.endMarkerRef).toBeNull();
	});

	it('produces an end marker and url ref when connectorEndArrow is "triangle"', () => {
		const geo = buildConnectorGeometry(
			connector({ shapeStyle: { connectorEndArrow: 'triangle' } }),
			0,
		);
		expect(geo.endMarker).not.toBeNull();
		expect(geo.endMarker!.shape).toBe('path');
		expect(geo.endMarkerRef).toContain('url(#');
		// id is sanitised from the element id ("cxn 1" → "cxn_1")
		expect(geo.endMarkerId).toBe('cxn_1-end');
		expect(geo.endMarkerRef).toContain('cxn_1-end');
	});

	it('omits markers when arrows are "none"', () => {
		const geo = buildConnectorGeometry(
			connector({
				shapeStyle: { connectorStartArrow: 'none', connectorEndArrow: 'none' },
			}),
			0,
		);
		expect(geo.startMarker).toBeNull();
		expect(geo.endMarker).toBeNull();
	});

	it('leaves pathD undefined for a straight connector (renders a <line>)', () => {
		const geo = buildConnectorGeometry(connector({ shapeType: 'straightConnector1' }), 0);
		expect(geo.pathD).toBeUndefined();
	});

	it('produces an elbow path for a bent connector', () => {
		const geo = buildConnectorGeometry(
			connector({ shapeType: 'bentConnector3', width: 200, height: 100 }),
			0,
		);
		expect(geo.pathD).toBeDefined();
		// Multi-segment elbow: starts with a move and has at least two line-tos.
		expect(geo.pathD!.startsWith('M')).toBeTruthy();
		expect((geo.pathD!.match(/L/gu) ?? []).length).toBeGreaterThanOrEqual(2);
	});

	it('produces a Bézier path for a curved connector', () => {
		const geo = buildConnectorGeometry(
			connector({ shapeType: 'curvedConnector3', width: 200, height: 100 }),
			0,
		);
		expect(geo.pathD).toBeDefined();
		expect(geo.pathD).toContain('C');
	});
});

// ---------------------------------------------------------------------------
// connectorKind
// ---------------------------------------------------------------------------

describe('connectorKind', () => {
	it('classifies bent connectors (case-insensitive)', () => {
		expect(connectorKind('bentConnector3')).toBe('bent');
		expect(connectorKind('BENTCONNECTOR2')).toBe('bent');
	});

	it('classifies curved connectors', () => {
		expect(connectorKind('curvedConnector4')).toBe('curved');
	});

	it('falls back to straight for straight/unknown/undefined', () => {
		expect(connectorKind('straightConnector1')).toBe('straight');
		expect(connectorKind('line')).toBe('straight');
		expect(connectorKind(undefined)).toBe('straight');
	});
});

// ---------------------------------------------------------------------------
// connectorBendFraction
// ---------------------------------------------------------------------------

describe('connectorBendFraction', () => {
	it('defaults to 0.5 with no adjustments', () => {
		expect(connectorBendFraction(connector())).toBe(0.5);
	});

	it('normalises an OOXML 1000ths-of-a-percent adjustment to 0..1', () => {
		const el = connector({ shapeAdjustments: { adj1: 25000 } } as Partial<PptxElement>);
		expect(connectorBendFraction(el)).toBeCloseTo(0.25, 5);
	});

	it('clamps out-of-range fractions', () => {
		const el = connector({ shapeAdjustments: { adj1: 250000 } } as Partial<PptxElement>);
		expect(connectorBendFraction(el)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// buildConnectorPathD
// ---------------------------------------------------------------------------

describe('buildConnectorPathD', () => {
	it('returns undefined for straight connectors', () => {
		expect(buildConnectorPathD('straightConnector1', 0, 0, 100, 50, 0.5)).toBeUndefined();
		expect(buildConnectorPathD(undefined, 0, 0, 100, 50, 0.5)).toBeUndefined();
	});

	it('builds a single L-bend for bentConnector2', () => {
		expect(buildConnectorPathD('bentConnector2', 0, 0, 100, 50, 0.5)).toBe('M0,0 L100,0 L100,50');
	});

	it('routes through the mid-axis for bentConnector3', () => {
		expect(buildConnectorPathD('bentConnector3', 0, 0, 100, 50, 0.5)).toBe(
			'M0,0 L50,0 L50,50 L100,50',
		);
	});

	it('honours the bend fraction for the elbow x-position', () => {
		expect(buildConnectorPathD('bentConnector3', 0, 0, 100, 50, 0.25)).toBe(
			'M0,0 L25,0 L25,50 L100,50',
		);
	});

	it('builds a quadratic Bézier for curvedConnector2', () => {
		expect(buildConnectorPathD('curvedConnector2', 0, 0, 100, 50, 0.5)).toBe('M0,0 Q100,0 100,50');
	});

	it('builds a cubic Bézier for curvedConnector3', () => {
		expect(buildConnectorPathD('curvedConnector3', 0, 0, 100, 50, 0.5)).toBe(
			'M0,0 C50,0 50,50 100,50',
		);
	});

	it('mirrors the path when endpoints are flipped', () => {
		// Flipped horizontally: x1=100, x2=0.
		expect(buildConnectorPathD('bentConnector3', 100, 0, 0, 50, 0.5)).toBe(
			'M100,0 L50,0 L50,50 L0,50',
		);
	});
});
