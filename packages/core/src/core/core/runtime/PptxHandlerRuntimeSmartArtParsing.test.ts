import { describe, expect, it } from 'vitest';

import type { PptxSmartArtDrawingShape, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

class SmartArtDrawingShapeRuntime extends PptxHandlerRuntime {
	public parseShape(
		sp: Parameters<PptxHandlerRuntime['parseDrawingShape']>[0],
		index = 0,
		emuPerPx = 9525,
	): PptxSmartArtDrawingShape | null {
		return this.parseDrawingShape(sp, index, emuPerPx);
	}

	public connections(dataModel: XmlObject) {
		return this.parseSmartArtConnections(dataModel);
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

	it('preserves preset adjustments, flips, and independent text-frame geometry', () => {
		const shape = runtime.parseShape({
			'dsp:spPr': {
				'a:xfrm': {
					'@_flipH': '1',
					'a:off': { '@_x': '0', '@_y': '0' },
					'a:ext': { '@_cx': '762000', '@_cy': '381000' },
				},
				'a:prstGeom': {
					'@_prst': 'rightArrow',
					'a:avLst': {
						'a:gd': [
							{ '@_name': 'adj1', '@_fmla': 'val 40000' },
							{ '@_name': 'adj2', '@_fmla': 'val 70000' },
						],
					},
				},
			},
			'dsp:txXfrm': {
				'a:off': { '@_x': '95250', '@_y': '95250' },
				'a:ext': { '@_cx': '571500', '@_cy': '190500' },
			},
			'dsp:txBody': {
				'a:bodyPr': { '@_lIns': '95250', '@_rIns': '95250' },
				'a:p': {
					'a:r': {
						'a:rPr': { '@_sz': '1800', '@_b': '1', 'a:ea': { '@_typeface': '微软雅黑' } },
						'a:t': '测试文本',
					},
				},
			},
		});

		expect(shape).toMatchObject({
			flipHorizontal: true,
			fontFamily: '微软雅黑',
			fontSize: 24,
			fontWeight: 700,
			shapeAdjustments: { adj1: 40000, adj2: 70000 },
			shapeType: 'rightArrow',
			textFrameHeight: 20,
			textFrameWidth: 60,
			textFrameX: 10,
			textFrameY: 10,
			textInsetLeft: 10,
			textInsetRight: 10,
		});
	});
});

describe('parseSmartArtConnections', () => {
	it('builds the parent map only from parOf edges, ignoring a presOf sharing the same destId', () => {
		// `presOf`/`presParOf` connections live in the SAME id space as `parOf`
		// and can legitimately target a destId that also appears as a `parOf`
		// destination elsewhere (a presentation point reusing a content point's
		// id pattern in a hand-built or third-party file). Without the `@type`
		// filter this could silently overwrite the real parent/child edge.
		const dataModel: XmlObject = {
			'dgm:cxnLst': {
				'dgm:cxn': [
					{ '@_modelId': 'c1', '@_srcId': 'root', '@_destId': 'child', '@_srcOrd': '0' },
					{
						'@_modelId': 'c2',
						'@_type': 'presOf',
						'@_srcId': 'wrong-parent',
						'@_destId': 'child',
					},
				],
			},
		};
		const { parsedConnections, parentByNodeId } = runtime.connections(dataModel);
		expect(parsedConnections).toHaveLength(2);
		expect(parentByNodeId.get('child')).toBe('root');
	});

	it('treats an omitted @type as parOf (the ECMA-376 schema default)', () => {
		const dataModel: XmlObject = {
			'dgm:cxnLst': {
				'dgm:cxn': { '@_modelId': 'c1', '@_srcId': 'root', '@_destId': 'child' },
			},
		};
		const { parentByNodeId } = runtime.connections(dataModel);
		expect(parentByNodeId.get('child')).toBe('root');
	});
});
