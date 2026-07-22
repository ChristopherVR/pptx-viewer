/**
 * Tests for `aink:ink` per-point pressure decoding.
 *
 * `decodeAinkInk` historically read only the default brush colour/size, so
 * `aink:trace` strokes rendered at a constant width even when the payload
 * carried per-point pressure (the optional third `x,y,pressure` component,
 * as `p:contentPart` InkML uses). The decoder now surfaces those pressures on
 * `inkPointPressures` for variable-width rendering.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { decodeAinkInk, parseAinkTracePressures } from './PptxGraphicFrameParser';

describe('parseAinkTracePressures', () => {
	it('reads the third comma-separated component as clamped pressure', () => {
		expect(parseAinkTracePressures('10,20,0.2 30,40,0.9 50,60,1.5')).toStrictEqual([0.2, 0.9, 1]);
	});

	it('returns an empty array when no point carries pressure', () => {
		expect(parseAinkTracePressures('10,20 30,40')).toStrictEqual([]);
	});

	it('fills unknown pressures with 0.5 when at least one point has pressure', () => {
		expect(parseAinkTracePressures('10,20 30,40,0.8')).toStrictEqual([0.5, 0.8]);
	});
});

describe('decodeAinkInk pressure', () => {
	it('exposes per-trace pressure arrays aligned to inkPaths', () => {
		const inkRoot: XmlObject = {
			'aink:inkBrush': { '@_brushColor': 'CC3300', '@_brushSize': '4' },
			'aink:trace': [{ '#text': '10,10,0.3 20,20,0.7 30,30,1' }, { '#text': '40,40 50,50' }],
		};

		const decoded = decodeAinkInk(inkRoot);

		expect(decoded.inkPaths).toHaveLength(2);
		expect(decoded.inkPointPressures[0]).toStrictEqual([0.3, 0.7, 1]);
		// Second trace has no pressure component.
		expect(decoded.inkPointPressures[1]).toStrictEqual([]);
	});
});
