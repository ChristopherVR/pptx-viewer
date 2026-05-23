/**
 * Tests for connector flipH/flipV routing (G-H3).
 *
 * The visual end-points of a bent connector depend on which corner the
 * start sits at. These tests exercise the flip-aware routing by checking
 * the start/end fields and verifying the path data starts from the
 * expected corner.
 */
import { describe, expect, it } from 'vitest';

import type { PptxElementWithShapeStyle } from '../types';
import { getConnectorPathGeometry } from './connector-geometry';

function makeConnector(overrides: Partial<PptxElementWithShapeStyle>): PptxElementWithShapeStyle {
	return {
		id: 'c1',
		type: 'connector',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'bentConnector3',
		...overrides,
	} as PptxElementWithShapeStyle;
}

describe('connector flipH/flipV routing (G-H3)', () => {
	it('default routing: start (0,0) → end (W,H)', () => {
		const geo = getConnectorPathGeometry(makeConnector({ shapeType: 'bentConnector3' }));
		expect(geo.startX).toBe(0);
		expect(geo.startY).toBe(0);
		expect(geo.endX).toBe(100);
		expect(geo.endY).toBe(50);
		expect(geo.pathData.startsWith('M 0 0')).toBeTruthy();
	});

	it('flipH: start (W,0) → end (0,H)', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector3', flipHorizontal: true }),
		);
		expect(geo.startX).toBe(100);
		expect(geo.startY).toBe(0);
		expect(geo.endX).toBe(0);
		expect(geo.endY).toBe(50);
		expect(geo.pathData.startsWith('M 100 0')).toBeTruthy();
	});

	it('flipV: start (0,H) → end (W,0)', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'bentConnector2', flipVertical: true }),
		);
		expect(geo.startX).toBe(0);
		expect(geo.startY).toBe(50);
		expect(geo.endX).toBe(100);
		expect(geo.endY).toBe(0);
		expect(geo.pathData.startsWith('M 0 50')).toBeTruthy();
	});

	it('flipH+flipV: start (W,H) → end (0,0)', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({
				shapeType: 'straightConnector1',
				flipHorizontal: true,
				flipVertical: true,
			}),
		);
		expect(geo.startX).toBe(100);
		expect(geo.startY).toBe(50);
		expect(geo.endX).toBe(0);
		expect(geo.endY).toBe(0);
		expect(geo.pathData).toBe('M 100 50 L 0 0');
	});

	it('curvedConnector2 flips routing', () => {
		const geo = getConnectorPathGeometry(
			makeConnector({ shapeType: 'curvedConnector2', flipHorizontal: true }),
		);
		expect(geo.startX).toBe(100);
		expect(geo.endX).toBe(0);
		expect(geo.pathData.startsWith('M 100 0')).toBeTruthy();
	});
});
