import { describe, expect, it } from 'vitest';

import type { CustomGeometryRawData } from '../types';
import {
	evaluateCustomGeometryPathData,
	evaluateCustomGeometryPaths,
} from './custom-geometry-live-eval';

/**
 * A freeform whose `a:ahXY` handle drags `adj1`, which a `a:gdLst` guide
 * (`x1`) turns into a vertex x-coordinate: `moveTo(0,0) -> lnTo(x1,0) ->
 * lnTo(x1,100) -> close`. At the authored `adj1 = 25000` (25%), `x1 = 50`
 * (25% of the 200-wide path box); dragging the handle to `adj1 = 75000`
 * should move that vertex to `x1 = 150` WITHOUT any save/reload, which is
 * exactly the "commits on release, not live" gap this module closes.
 */
function freeformRawData(): CustomGeometryRawData {
	return {
		avLstXml: { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
		gdLstXml: { 'a:gd': { '@_name': 'x1', '@_fmla': '*/ w adj1 100000' } },
		pathLstXml: {
			'a:path': {
				'@_w': '200',
				'@_h': '100',
				'a:moveTo': { 'a:pt': { '@_x': '0', '@_y': '0' } },
				'a:lnTo': [
					{ 'a:pt': { '@_x': 'x1', '@_y': '0' } },
					{ 'a:pt': { '@_x': 'x1', '@_y': '100' } },
				],
				'a:close': {},
			},
		},
	};
}

describe('evaluateCustomGeometryPathData', () => {
	it('evaluates the outline at the a:avLst default when no override is given', () => {
		const result = evaluateCustomGeometryPathData(freeformRawData(), 200, 100, undefined);
		expect(result?.pathData).toBe('M 0 0 L 50 0 L 50 100 Z');
	});

	it('re-evaluates the outline live against an in-progress shapeAdjustments override', () => {
		const result = evaluateCustomGeometryPathData(freeformRawData(), 200, 100, { adj1: 75000 });
		expect(result?.pathData).toBe('M 0 0 L 150 0 L 150 100 Z');
	});

	it('returns undefined when rawData has no preserved a:pathLst (older parse)', () => {
		const rawData: CustomGeometryRawData = { avLstXml: { 'a:gd': { '@_name': 'adj1' } } };
		expect(evaluateCustomGeometryPathData(rawData, 200, 100, { adj1: 1 })).toBeUndefined();
	});

	it('returns undefined for a non-positive coordinate-space dimension', () => {
		expect(evaluateCustomGeometryPathData(freeformRawData(), 0, 100, undefined)).toBeUndefined();
	});
});

describe('evaluateCustomGeometryPaths', () => {
	it('re-evaluates structured per-sub-path segments against an override', () => {
		const paths = evaluateCustomGeometryPaths(freeformRawData(), 200, 100, { adj1: 75000 });
		expect(paths).toHaveLength(1);
		expect(paths?.[0].segments).toStrictEqual([
			{ type: 'moveTo', pt: { x: 0, y: 0 } },
			{ type: 'lineTo', pt: { x: 150, y: 0 } },
			{ type: 'lineTo', pt: { x: 150, y: 100 } },
			{ type: 'close' },
		]);
	});

	it('matches a fresh parse when no override is given', () => {
		const withOverride = evaluateCustomGeometryPaths(freeformRawData(), 200, 100, { adj1: 25000 });
		const withoutOverride = evaluateCustomGeometryPaths(freeformRawData(), 200, 100, undefined);
		expect(withOverride).toStrictEqual(withoutOverride);
	});
});
