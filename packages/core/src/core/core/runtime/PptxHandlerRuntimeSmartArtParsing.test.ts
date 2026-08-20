import { describe, expect, it } from 'vitest';

import type { PptxSmartArtDrawingShape } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

class SmartArtDrawingShapeRuntime extends PptxHandlerRuntime {
	public parseShape(
		sp: Parameters<PptxHandlerRuntime['parseDrawingShape']>[0],
		index = 0,
		emuPerPx = 9525,
	): PptxSmartArtDrawingShape | null {
		return this.parseDrawingShape(sp, index, emuPerPx);
	}
}

const runtime = new SmartArtDrawingShapeRuntime();

function lineShapeXml(cx: string, cy: string) {
	return {
		'p:spPr': {
			'a:xfrm': {
				'a:off': { '@_x': '914400', '@_y': '914400' },
				'a:ext': { '@_cx': cx, '@_cy': cy },
			},
			'a:prstGeom': { '@_prst': 'line' },
		},
	};
}

describe('parseDrawingShape', () => {
	it('keeps a zero-height cached "line" preset shape (SmartArt Timeline rails/stems)', () => {
		const shape = runtime.parseShape(lineShapeXml('1828800', '0'));
		expect(shape).not.toBeNull();
		expect(shape!.shapeType).toBe('line');
		expect(shape!.height).toBe(0);
	});

	it('keeps a zero-width cached "line" preset shape', () => {
		const shape = runtime.parseShape(lineShapeXml('0', '914400'));
		expect(shape).not.toBeNull();
		expect(shape!.shapeType).toBe('line');
		expect(shape!.width).toBe(0);
	});

	it('still drops a zero-size non-line shape (stale/degenerate frame extent)', () => {
		const shape = runtime.parseShape({
			'p:spPr': {
				'a:xfrm': {
					'a:off': { '@_x': '0', '@_y': '0' },
					'a:ext': { '@_cx': '0', '@_cy': '0' },
				},
				'a:prstGeom': { '@_prst': 'rect' },
			},
		});
		expect(shape).toBeNull();
	});

	it('keeps a normally-sized rect shape', () => {
		const shape = runtime.parseShape({
			'p:spPr': {
				'a:xfrm': {
					'a:off': { '@_x': '0', '@_y': '0' },
					'a:ext': { '@_cx': '914400', '@_cy': '914400' },
				},
				'a:prstGeom': { '@_prst': 'rect' },
			},
		});
		expect(shape).not.toBeNull();
		expect(shape!.shapeType).toBe('rect');
	});
});
