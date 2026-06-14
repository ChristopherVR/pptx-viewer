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
	buildDashArray,
	buildWrapperStyle,
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
});
