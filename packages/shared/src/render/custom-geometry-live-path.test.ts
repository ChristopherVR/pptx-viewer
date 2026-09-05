import type { CustomGeometryRawData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveLiveCustomGeometryPath } from './custom-geometry-live-path';

/**
 * Same freeform fixture as core's `custom-geometry-live-eval.test.ts`:
 * `moveTo(0,0) -> lnTo(x1,0) -> lnTo(x1,100) -> close`, where
 * `x1 = w * adj1 / 100000` and `adj1` defaults to `25000` (x1 = 50 on a
 * 200-wide path box).
 */
function rawData(): CustomGeometryRawData {
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

function freeformElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'el1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeType: 'custom',
		pathData: 'M 0 0 L 50 0 L 50 100 Z',
		pathWidth: 200,
		pathHeight: 100,
		customGeometryRawData: rawData(),
		...overrides,
	} as PptxElement;
}

describe('resolveLiveCustomGeometryPath', () => {
	it('returns undefined for an element with no custom geometry', () => {
		const el = { id: 'el1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(resolveLiveCustomGeometryPath(el)).toBeUndefined();
	});

	it('returns the static pathData when there is no in-progress shapeAdjustments override', () => {
		const result = resolveLiveCustomGeometryPath(freeformElement());
		expect(result).toStrictEqual({
			pathData: 'M 0 0 L 50 0 L 50 100 Z',
			pathWidth: 200,
			pathHeight: 100,
		});
	});

	it('re-evaluates the outline live against shapeAdjustments (the drag-in-progress case)', () => {
		const el = freeformElement({ shapeAdjustments: { adj1: 75000 } });
		const result = resolveLiveCustomGeometryPath(el);
		// The static `pathData` (frozen at adj1 = 25000, x1 = 50) must NOT win:
		// this is exactly the "commits on release, not live" regression.
		expect(result?.pathData).toBe('M 0 0 L 150 0 L 150 100 Z');
	});

	it('falls back to the static pathData when raw geometry XML did not survive parse', () => {
		const el = freeformElement({
			shapeAdjustments: { adj1: 75000 },
			customGeometryRawData: undefined,
		});
		const result = resolveLiveCustomGeometryPath(el);
		expect(result?.pathData).toBe('M 0 0 L 50 0 L 50 100 Z');
	});
});
