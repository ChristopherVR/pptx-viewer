import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getUnrotatedShapeConnectionSites } from './connector-sites';

function makeShape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('getUnrotatedShapeConnectionSites', () => {
	it('falls back to the generic 4-cardinal box (top, left, bottom, right, the ECMA-376 rect order) when the shape has no shapeType at all', () => {
		const sites = getUnrotatedShapeConnectionSites(makeShape());
		expect(sites).toStrictEqual([
			{ x: 100, y: 0, index: 0 }, // top
			{ x: 0, y: 50, index: 1 }, // left
			{ x: 100, y: 100, index: 2 }, // bottom
			{ x: 200, y: 50, index: 3 }, // right
		]);
	});

	it('resolves a non-rectangular preset (triangle) to its real ECMA cxnLst sites, not the bounding-box fallback', () => {
		// adj defaults to 50000 -> a=50000 -> x1 = w*a/200000 = 200*50000/200000 = 50
		const sites = getUnrotatedShapeConnectionSites(
			makeShape({ shapeType: 'triangle' } as Partial<PptxElement>),
		);
		// index 0 is the apex (x1, t): x1=50, distinct from the cardinal hc=100.
		expect(sites[0]).toStrictEqual({ x: 50, y: 0, index: 0 });
	});

	it('threads shapeAdjustments through so the preset site reflects a non-default adj value', () => {
		const shape = makeShape({
			shapeType: 'triangle',
			shapeAdjustments: { adj: 0 },
		} as Partial<PptxElement>);
		const sites = getUnrotatedShapeConnectionSites(shape);
		// a=0 -> x1=0: the apex collapses onto the left edge.
		expect(sites[0]).toStrictEqual({ x: 0, y: 0, index: 0 });
	});

	it('prefers an authored a:custGeom/a:cxnLst over the preset table even when shapeType is also set', () => {
		const shape = makeShape({
			shapeType: 'triangle',
			customGeometryConnectionSites: [{ posX: '10', posY: '20', ang: '0' }],
		} as Partial<PptxElement>);
		const sites = getUnrotatedShapeConnectionSites(shape);
		expect(sites).toStrictEqual([{ x: 10, y: 20, index: 0 }]);
	});

	it('falls back to the generic 4-cardinal box for a preset with no transcribed cxnLst', () => {
		const sites = getUnrotatedShapeConnectionSites(
			makeShape({ shapeType: 'wedgeRoundRectCallout' } as Partial<PptxElement>),
		);
		expect(sites).toStrictEqual([
			{ x: 100, y: 0, index: 0 }, // top
			{ x: 0, y: 50, index: 1 }, // left
			{ x: 100, y: 100, index: 2 }, // bottom
			{ x: 200, y: 50, index: 3 }, // right
		]);
	});
});
