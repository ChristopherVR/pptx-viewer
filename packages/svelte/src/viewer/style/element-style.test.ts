import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getShapeFillStrokeStyle } from './element-style';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('getShapeFillStrokeStyle: custom-geometry live reshape', () => {
	it('reshapes a freeform clip-path LIVE from shapeAdjustments, not the frozen pathData', () => {
		// `x1 = w * adj1 / 100000`; pathData was frozen at the authored default
		// (adj1 = 25000, x1 = 50) but shapeAdjustments already carries an
		// in-progress drag (adj1 = 75000, x1 = 150) - limitations.md's "a:custGeom
		// adjustment-handle drag: Commits on release, not live".
		const rawData = {
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
		const style = getShapeFillStrokeStyle(
			shape({
				shapeType: 'custom',
				pathData: 'M 0 0 L 50 0 L 50 100 Z',
				pathWidth: 200,
				pathHeight: 100,
				customGeometryRawData: rawData,
				shapeAdjustments: { adj1: 75000 },
			} as Partial<PptxElement>),
		);
		expect(style.clipPath).toBe("path('M 0 0 L 150 0 L 150 100 Z')");
	});
});
