import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { flattenChartUserShapes, parseChartUserShapesDrawing } from './chart-user-shapes-parser';

const PREFIXES = ['cdr:', 'c:', 'a:', 'xdr:', ''];

function createXmlLookup() {
	return {
		getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined {
			if (!parent) {
				return undefined;
			}
			for (const prefix of PREFIXES) {
				const value = parent[`${prefix}${name}`];
				if (value !== undefined) {
					return Array.isArray(value) ? (value[0] as XmlObject) : (value as XmlObject);
				}
			}
			return undefined;
		},
		getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[] {
			if (!parent) {
				return [];
			}
			for (const prefix of PREFIXES) {
				const value = parent[`${prefix}${name}`];
				if (value !== undefined) {
					return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
				}
			}
			return [];
		},
		getScalarChildByLocalName(parent: XmlObject | undefined, name: string): unknown {
			if (!parent) {
				return undefined;
			}
			for (const prefix of PREFIXES) {
				const value = parent[`${prefix}${name}`];
				if (value === undefined) {
					continue;
				}
				if (value !== null && typeof value === 'object') {
					return (value as XmlObject)['#text'];
				}
				return value;
			}
			return undefined;
		},
	};
}

const colors = {
	parseColor(fillNode: XmlObject | undefined): string | undefined {
		if (!fillNode) {
			return undefined;
		}
		const srgb = fillNode['a:srgbClr'] as XmlObject | undefined;
		return srgb ? `#${srgb['@_val']}` : undefined;
	},
};

describe('parseChartUserShapesDrawing', () => {
	it('returns undefined for missing/empty drawings', () => {
		const xml = createXmlLookup();
		expect(parseChartUserShapesDrawing(undefined, xml, colors)).toBeUndefined();
		expect(parseChartUserShapesDrawing({ 'c:userShapes': {} }, xml, colors)).toBeUndefined();
	});

	it('parses a relSizeAnchor sp with fill, geometry and text', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.2 },
					'cdr:to': { 'cdr:x': 0.5, 'cdr:y': 0.6 },
					'cdr:sp': {
						'cdr:spPr': {
							'a:prstGeom': { '@_prst': 'roundRect' },
							'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
							'a:ln': { '@_w': '12700', 'a:solidFill': { 'a:srgbClr': { '@_val': '00FF00' } } },
						},
						'cdr:txBody': {
							'a:p': {
								'a:pPr': { '@_algn': 'ctr' },
								'a:r': { 'a:rPr': { '@_sz': '1400', '@_b': '1' }, 'a:t': 'Note' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		expect(shapes).toHaveLength(1);
		const shape = shapes![0];
		expect(shape.kind).toBe('sp');
		expect(shape.anchor).toBe('rel');
		expect(shape.from).toStrictEqual({ x: 0.1, y: 0.2 });
		expect(shape.to).toStrictEqual({ x: 0.5, y: 0.6 });
		expect(shape.prst).toBe('roundRect');
		expect(shape.fill).toBe('#FF0000');
		expect(shape.stroke).toBe('#00FF00');
		expect(shape.strokeWidth).toBe(1);
		expect(shape.paragraphs).toStrictEqual([
			{ text: 'Note', align: 'ctr', fontSize: 14, bold: true },
		]);
	});

	it('parses an absSizeAnchor with an EMU extent and a connector', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:absSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.25, 'cdr:y': 0.25 },
					'cdr:ext': { '@_cx': '914400', '@_cy': '457200' },
					'cdr:cxnSp': {
						'cdr:spPr': {
							'a:ln': { '@_w': '19050', 'a:solidFill': { 'a:srgbClr': { '@_val': '0000FF' } } },
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		expect(shapes).toHaveLength(1);
		const shape = shapes![0];
		expect(shape.kind).toBe('cxnSp');
		expect(shape.anchor).toBe('abs');
		expect(shape.from).toStrictEqual({ x: 0.25, y: 0.25 });
		expect(shape.ext).toStrictEqual({ cx: 914400, cy: 457200 });
		expect(shape.stroke).toBe('#0000FF');
		expect(shape.strokeWidth).toBe(1.5);
		expect(shape.paragraphs).toBeUndefined();
	});

	// C2-G10 (parse half): grpSp/graphicFrame anchors used to be silently
	// dropped (parseAnchorShape only recognised sp/cxnSp/pic), and a fill was
	// only ever read from a:solidFill.
	//
	// W5-I: a grpSp anchor used to be flattened at parse time (every grouped
	// child reusing the anchor's own bounding box, losing the group's own
	// chOff/chExt transform). It now parses into ONE `grpSp` entry carrying
	// the group's own transform and its children, nested arbitrarily;
	// `flattenChartUserShapes` (tested below) projects that into positioned
	// leaves for renderers that only want a flat list.
	it('parses a grpSp anchor into a single entry with its own transform and children', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.1 },
					'cdr:to': { 'cdr:x': 0.4, 'cdr:y': 0.4 },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
							},
						},
						'cdr:sp': [
							{
								'cdr:spPr': {
									'a:xfrm': {
										'a:off': { '@_x': '0', '@_y': '0' },
										'a:ext': { '@_cx': '500000', '@_cy': '1000000' },
									},
									'a:prstGeom': { '@_prst': 'rect' },
								},
							},
							{
								'cdr:spPr': {
									'a:xfrm': {
										'a:off': { '@_x': '500000', '@_y': '0' },
										'a:ext': { '@_cx': '500000', '@_cy': '1000000' },
									},
									'a:prstGeom': { '@_prst': 'ellipse' },
								},
							},
						],
						'cdr:cxnSp': {
							'cdr:spPr': {
								'a:xfrm': {
									'a:off': { '@_x': '0', '@_y': '0' },
									'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								},
								'a:ln': { '@_w': '12700' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		expect(shapes).toHaveLength(1);
		const shape = shapes![0];
		expect(shape.kind).toBe('grpSp');
		expect(shape.anchor).toBe('rel');
		expect(shape.from).toStrictEqual({ x: 0.1, y: 0.1 });
		expect(shape.to).toStrictEqual({ x: 0.4, y: 0.4 });
		expect(shape.transform).toStrictEqual({
			off: { x: 0, y: 0 },
			ext: { cx: 1000000, cy: 1000000 },
			chOff: { x: 0, y: 0 },
			chExt: { cx: 1000000, cy: 1000000 },
		});
		expect(shape.children).toHaveLength(3);
		expect(shape.children!.map((c) => c.kind)).toStrictEqual(['sp', 'sp', 'cxnSp']);
		expect(shape.children!.map((c) => c.prst)).toStrictEqual(['rect', 'ellipse', undefined]);
		expect(shape.children![0].off).toStrictEqual({ x: 0, y: 0 });
		expect(shape.children![0].ext).toStrictEqual({ cx: 500000, cy: 1000000 });
		expect(shape.children![1].off).toStrictEqual({ x: 500000, y: 0 });
		expect(shape.rawXml).toBeDefined();
	});

	it('parses a grpSp nested inside another grpSp, recursively', () => {
		const xml = createXmlLookup();
		const innerGroup: XmlObject = {
			'cdr:grpSpPr': {
				'a:xfrm': {
					'a:off': { '@_x': '0', '@_y': '0' },
					'a:ext': { '@_cx': '500000', '@_cy': '1000000' },
					'a:chOff': { '@_x': '0', '@_y': '0' },
					'a:chExt': { '@_cx': '500000', '@_cy': '1000000' },
				},
			},
			'cdr:sp': {
				'cdr:spPr': {
					'a:xfrm': {
						'a:off': { '@_x': '0', '@_y': '0' },
						'a:ext': { '@_cx': '500000', '@_cy': '1000000' },
					},
					'a:prstGeom': { '@_prst': 'triangle' },
				},
			},
		};
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0, 'cdr:y': 0 },
					'cdr:to': { 'cdr:x': 1, 'cdr:y': 1 },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
							},
						},
						'cdr:grpSp': innerGroup,
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const outer = shapes![0];
		expect(outer.children).toHaveLength(1);
		const nested = outer.children![0];
		expect(nested.kind).toBe('grpSp');
		expect(nested.transform).toStrictEqual({
			off: { x: 0, y: 0 },
			ext: { cx: 500000, cy: 1000000 },
			chOff: { x: 0, y: 0 },
			chExt: { cx: 500000, cy: 1000000 },
		});
		expect(nested.children).toHaveLength(1);
		expect(nested.children![0].kind).toBe('sp');
		expect(nested.children![0].prst).toBe('triangle');
		expect(nested.rawXml).toBeDefined();
	});

	it('flattenChartUserShapes applies the group transform to leaf positions', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.1 },
					'cdr:to': { 'cdr:x': 0.4, 'cdr:y': 0.4 },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
							},
						},
						'cdr:sp': [
							{
								'cdr:spPr': {
									'a:xfrm': {
										'a:off': { '@_x': '0', '@_y': '0' },
										'a:ext': { '@_cx': '500000', '@_cy': '1000000' },
									},
									'a:prstGeom': { '@_prst': 'rect' },
								},
							},
							{
								'cdr:spPr': {
									'a:xfrm': {
										'a:off': { '@_x': '500000', '@_y': '0' },
										'a:ext': { '@_cx': '500000', '@_cy': '1000000' },
									},
									'a:prstGeom': { '@_prst': 'ellipse' },
								},
							},
						],
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const flattened = flattenChartUserShapes(shapes);
		expect(flattened).toHaveLength(2);
		expect(flattened.every((leaf) => leaf.kind !== 'grpSp')).toBeTruthy();
		expect(flattened[0]).toMatchObject({
			kind: 'sp',
			anchor: 'rel',
			from: { x: 0.1, y: 0.1 },
			to: { x: 0.25, y: 0.4 },
			prst: 'rect',
		});
		expect(flattened[1]).toMatchObject({
			kind: 'sp',
			anchor: 'rel',
			from: { x: 0.25, y: 0.1 },
			to: { x: 0.4, y: 0.4 },
			prst: 'ellipse',
		});
	});

	// W2-F: a grpSp inside an absSizeAnchor used to keep the anchor's own
	// `from` unshifted for every child (size was exact, position was not).
	// With a non-identity chOff/chExt, the child's fractional offset within
	// the group must convert to an exact EMU position delta, not vanish.
	it('flattenChartUserShapes resolves an exact position for an absSizeAnchor group child with non-identity chOff/chExt', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:absSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.2, 'cdr:y': 0.3 },
					'cdr:ext': { '@_cx': '1000000', '@_cy': '2000000' },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '2000000' },
								'a:chOff': { '@_x': '1000', '@_y': '2000' },
								'a:chExt': { '@_cx': '10000', '@_cy': '20000' },
							},
						},
						'cdr:sp': {
							'cdr:spPr': {
								'a:xfrm': {
									'a:off': { '@_x': '3500', '@_y': '7000' },
									'a:ext': { '@_cx': '2500', '@_cy': '5000' },
								},
								'a:prstGeom': { '@_prst': 'rect' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const flattened = flattenChartUserShapes(shapes);
		expect(flattened).toHaveLength(1);
		// fraction: x=(3500-1000)/10000=0.25, y=(7000-2000)/20000=0.25,
		// w=2500/10000=0.25, h=5000/20000=0.25
		expect(flattened[0]).toMatchObject({
			kind: 'sp',
			anchor: 'abs',
			from: { x: 0.2, y: 0.3 },
			ext: { cx: 250000, cy: 500000 },
			absGroupOffsetEmu: { x: 250000, y: 500000 },
		});
	});

	// W5-AE: with the chart's own EMU box known, the SAME offset above folds
	// directly into `from` as an exact further chart fraction instead of being
	// carried separately (this is a pure re-derivation of the identical EMU
	// delta, not new ground truth: `from.x + offsetEmu.x / chartBox.width`
	// is algebraically the same absolute pixel position `chart-user-shape-
	// overlay.ts`'s old `shapeBox` computed from `absGroupOffsetEmu`).
	it('flattenChartUserShapes folds an absSizeAnchor group child offset into `from` when given the chart box, instead of a separate absGroupOffsetEmu', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:absSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.2, 'cdr:y': 0.3 },
					'cdr:ext': { '@_cx': '1000000', '@_cy': '2000000' },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '2000000' },
								'a:chOff': { '@_x': '1000', '@_y': '2000' },
								'a:chExt': { '@_cx': '10000', '@_cy': '20000' },
							},
						},
						'cdr:sp': {
							'cdr:spPr': {
								'a:xfrm': {
									'a:off': { '@_x': '3500', '@_y': '7000' },
									'a:ext': { '@_cx': '2500', '@_cy': '5000' },
								},
								'a:prstGeom': { '@_prst': 'rect' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		// Chart box in EMU, e.g. an 840x420px chart (EMU_PER_PIXEL = 9525).
		const chartBox = { width: 840 * 9525, height: 420 * 9525 };
		const flattened = flattenChartUserShapes(shapes, chartBox);
		expect(flattened).toHaveLength(1);
		// Same offset as the chartBox-less case above (250000, 500000 EMU),
		// now expressed as a further fraction of the chart: x += 250000/(840*9525),
		// y += 500000/(420*9525).
		expect(flattened[0]).toMatchObject({
			kind: 'sp',
			anchor: 'abs',
			ext: { cx: 250000, cy: 500000 },
		});
		expect(flattened[0].from.x).toBeCloseTo(0.2 + 250000 / chartBox.width, 9);
		expect(flattened[0].from.y).toBeCloseTo(0.3 + 500000 / chartBox.height, 9);
		expect(flattened[0].absGroupOffsetEmu).toBeUndefined();
	});

	it('parses a leaf shape and a group own rotation/flip from a:xfrm attributes', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': [
					{
						'cdr:from': { 'cdr:x': 0, 'cdr:y': 0 },
						'cdr:to': { 'cdr:x': 0.2, 'cdr:y': 0.2 },
						'cdr:sp': {
							'cdr:spPr': {
								// PowerPoint (COM-verified): rot/flipV alongside an
								// off/ext unrelated to the anchor's own from/to.
								'a:xfrm': {
									'@_rot': '1800000',
									'@_flipV': '1',
									'a:off': { '@_x': '254000', '@_y': '254000' },
									'a:ext': { '@_cx': '1270000', '@_cy': '635000' },
								},
								'a:prstGeom': { '@_prst': 'rect' },
							},
						},
					},
					{
						'cdr:from': { 'cdr:x': 0.3, 'cdr:y': 0.3 },
						'cdr:to': { 'cdr:x': 0.5, 'cdr:y': 0.5 },
						'cdr:grpSp': {
							'cdr:grpSpPr': {
								'a:xfrm': {
									'@_rot': '900000',
									'@_flipH': '1',
									'a:off': { '@_x': '0', '@_y': '0' },
									'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
									'a:chOff': { '@_x': '0', '@_y': '0' },
									'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
								},
							},
						},
					},
				],
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors)!;
		expect(shapes[0].rotation).toBe(30);
		expect(shapes[0].flipV).toBeTruthy();
		expect(shapes[0].flipH).toBeUndefined();
		expect(shapes[1].transform!.rotation).toBe(15);
		expect(shapes[1].transform!.flipH).toBeTruthy();
	});

	it("flattenChartUserShapes composes a group's own rotation onto a leaf that fully occupies its box", () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.1 },
					'cdr:to': { 'cdr:x': 0.4, 'cdr:y': 0.4 },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'@_rot': '900000', // 15deg
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
							},
						},
						'cdr:sp': {
							'cdr:spPr': {
								'a:xfrm': {
									'@_rot': '450000', // 7.5deg
									'a:off': { '@_x': '0', '@_y': '0' },
									'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								},
								'a:prstGeom': { '@_prst': 'rect' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const [leaf] = flattenChartUserShapes(shapes);
		// The child fully occupies the group's own box, so its centre coincides
		// with the rotation pivot: rotation composes (7.5 + 15 = 22.5) but the
		// box position/size is unaffected.
		expect(leaf!.rotation).toBe(22.5);
		expect(leaf!.from).toStrictEqual({ x: 0.1, y: 0.1 });
		expect(leaf!.to).toStrictEqual({ x: 0.4, y: 0.4 });
	});

	it("flattenChartUserShapes rotates an off-centre leaf's position about the group's own centre", () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0, 'cdr:y': 0 },
					'cdr:to': { 'cdr:x': 1, 'cdr:y': 1 },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'@_rot': '5400000', // 90deg: exact trig, no float noise
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
							},
						},
						// The top-LEFT quarter of the group's own box.
						'cdr:sp': {
							'cdr:spPr': {
								'a:xfrm': {
									'a:off': { '@_x': '0', '@_y': '0' },
									'a:ext': { '@_cx': '500000', '@_cy': '500000' },
								},
								'a:prstGeom': { '@_prst': 'rect' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const [leaf] = flattenChartUserShapes(shapes);
		// The child has no rotation of its own, so the leaf's composed rotation
		// is exactly the group's own 90deg.
		expect(leaf!.rotation).toBe(90);
		// A 90deg clockwise spin carries the top-left quarter into the
		// top-right quarter (same convention as `getElementOrientationMatrix`
		// in `element-style-transform.ts`).
		expect(leaf!.from!.x).toBeCloseTo(0.5, 9);
		expect(leaf!.from!.y).toBeCloseTo(0, 9);
		expect(leaf!.to!.x).toBeCloseTo(1, 9);
		expect(leaf!.to!.y).toBeCloseTo(0.5, 9);
	});

	it('flattenChartUserShapes composes flip through nested groups by XOR', () => {
		const xml = createXmlLookup();
		const innerGroup: XmlObject = {
			'cdr:grpSpPr': {
				'a:xfrm': {
					'@_flipH': '1',
					'a:off': { '@_x': '0', '@_y': '0' },
					'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
					'a:chOff': { '@_x': '0', '@_y': '0' },
					'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
				},
			},
			'cdr:sp': {
				'cdr:spPr': {
					'a:xfrm': {
						'@_flipH': '1',
						'a:off': { '@_x': '0', '@_y': '0' },
						'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
					},
					'a:prstGeom': { '@_prst': 'rect' },
				},
			},
		};
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0, 'cdr:y': 0 },
					'cdr:to': { 'cdr:x': 1, 'cdr:y': 1 },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'@_flipH': '1',
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
							},
						},
						'cdr:grpSp': innerGroup,
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const [leaf] = flattenChartUserShapes(shapes);
		// Three flips (leaf, inner group, outer group) compose to one: odd count = flipped.
		expect(leaf!.flipH).toBeTruthy();
	});

	// COM ground truth for these two: `Chart.Shapes` / `GroupItems` report a
	// chart-anchored group's and its children's REAL absolute Left/Top/Width/
	// Height/Rotation directly (verified via a scratch fixture + PowerShell
	// COM automation), which is how the anisotropic-rotation composition bug
	// this fix addresses was found and measured (see
	// `applyGroupRigidTransform`'s doc for which `ext` governs at which
	// level). Expected numbers below are hand-derived from that same COM
	// output (an unrotated control run pins the anchor's own baseline
	// Left/Top so the rotated run's delta can be checked independently).
	it("flattenChartUserShapes uses an absSizeAnchor's OWN ext as a top-level group's real aspect for rotation, not grpSpPr's differently-shaped ext", () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:absSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.1 },
					// The anchor's OWN ext: SQUARE (1:1). COM: the rotated group's
					// real Width/Height matched this, not grpSpPr's ext below.
					'cdr:ext': { '@_cx': '3000000', '@_cy': '3000000' },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'@_rot': '600000', // 10deg
								'a:off': { '@_x': '0', '@_y': '0' },
								// Deliberately DIFFERENT aspect (2:1) from the anchor's ext,
								// to prove this value is NOT what real PowerPoint rotates.
								'a:ext': { '@_cx': '2000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '2000000', '@_cy': '1000000' },
							},
						},
						// Left half of the group's child space.
						'cdr:sp': {
							'cdr:spPr': {
								'a:xfrm': {
									'a:off': { '@_x': '0', '@_y': '0' },
									'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								},
								'a:prstGeom': { '@_prst': 'rect' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const [leaf] = flattenChartUserShapes(shapes);
		expect(leaf!.ext!.cx).toBeCloseTo(1500000, -1);
		expect(leaf!.ext!.cy).toBeCloseTo(3000000, -1);
		// COM: rotated Left=63.89717pt vs an unrotated baseline of 63pt, and
		// rotated Top=21.2452pt vs an unrotated baseline of 31.5pt: deltas of
		// 0.897pt/-10.255pt = 11394/-130236 EMU (1pt = 12700 EMU).
		expect(leaf!.absGroupOffsetEmu!.x).toBeCloseTo(11394, -1);
		expect(leaf!.absGroupOffsetEmu!.y).toBeCloseTo(-130236, -1);
	});

	it("flattenChartUserShapes uses a NESTED grpSp's own declared ext as its real aspect for rotation (unlike the outermost level)", () => {
		const xml = createXmlLookup();
		const nestedGroup: XmlObject = {
			'cdr:grpSpPr': {
				'a:xfrm': {
					'@_rot': '600000', // 10deg
					'a:off': { '@_x': '500000', '@_y': '1000000' },
					'a:ext': { '@_cx': '2000000', '@_cy': '1000000' }, // 2:1: this group's real box
					'a:chOff': { '@_x': '0', '@_y': '0' },
					'a:chExt': { '@_cx': '2000000', '@_cy': '1000000' },
				},
			},
			// Left half of the nested group's own child space.
			'cdr:sp': {
				'cdr:spPr': {
					'a:xfrm': {
						'a:off': { '@_x': '0', '@_y': '0' },
						'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
					},
					'a:prstGeom': { '@_prst': 'rect' },
				},
			},
		};
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:absSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.1 },
					'cdr:ext': { '@_cx': '3000000', '@_cy': '3000000' },
					'cdr:grpSp': {
						// Outer group is an IDENTITY transform, isolating the nested
						// group's own rotation/aspect.
						'cdr:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '3000000', '@_cy': '3000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '3000000', '@_cy': '3000000' },
							},
						},
						'cdr:grpSp': nestedGroup,
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		const [leaf] = flattenChartUserShapes(shapes);
		// COM: Left=102.9682pt, Top=103.4036pt (both relative to an anchor
		// baseline of Left=63pt/Top=31.5pt, same chart as the previous case),
		// Width=Height=78.74016pt.
		expect(leaf!.ext!.cx).toBeCloseTo(1000000, -1);
		expect(leaf!.ext!.cy).toBeCloseTo(1000000, -1);
		expect(leaf!.absGroupOffsetEmu!.x).toBeCloseTo(507598, -1);
		expect(leaf!.absGroupOffsetEmu!.y).toBeCloseTo(913177, -1);
	});

	// W5-AE COM ground truth: a chart graphicFrame of 840x420px (630x315pt, a
	// 2:1 real box) with a relSizeAnchor from (0.1,0.1) to (0.6,0.6) - a SQUARE
	// 0.5x0.5 fraction span, but the chart's own box makes its REAL box
	// 315x157.5pt, also 2:1 - wrapping a `grpSp` rotated 20deg around a child
	// occupying the group's own LEFT HALF (off-centre). Two runs (rot=0deg
	// baseline, rot=20deg) isolate the rotation's delta from the anchor's own
	// slide-relative offset, the same technique the absSizeAnchor cases above
	// use. COM (`Chart.Shapes(1).GroupItems(1)`): baseline Left=63pt/Top=31.5pt
	// (matches the 0.1 anchor fraction exactly), rotated Left=67.74921pt/
	// Top=4.565906pt. Using the chart's real 2:1 aspect (not isotropic 1:1)
	// reproduces that rotated position to within COM's own display rounding;
	// see this test's assertions for the derivation.
	it("flattenChartUserShapes uses the chart's own box as a top-level relSizeAnchor group's real aspect for rotation, when given one", () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.1 },
					'cdr:to': { 'cdr:x': 0.6, 'cdr:y': 0.6 },
					'cdr:grpSp': {
						'cdr:grpSpPr': {
							'a:xfrm': {
								'@_rot': '1200000', // 20deg
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
							},
						},
						// Left half of the group's own child space.
						'cdr:sp': {
							'cdr:spPr': {
								'a:xfrm': {
									'a:off': { '@_x': '0', '@_y': '0' },
									'a:ext': { '@_cx': '500000', '@_cy': '1000000' },
								},
								'a:prstGeom': { '@_prst': 'rect' },
							},
						},
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);

		// Without a chartBox: unchanged isotropic (1:1) fallback.
		const isotropic = flattenChartUserShapes(shapes)[0]!;
		expect(isotropic.rotation).toBe(20);

		// With the chart's real 840x420px (2:1) box (unit is irrelevant to this
		// rotation-aspect case, only the ratio matters; pixels used here).
		const [leaf] = flattenChartUserShapes(shapes, { width: 840, height: 420 });
		expect(leaf!.rotation).toBe(20);
		// COM (converted from points to a chart fraction, chart = 630x315pt):
		// from.x = 67.74921 / 630, from.y = 4.565906 / 315,
		// to = from + (157.5 / 630, 157.5 / 315) (the child's own unrotated
		// 157.5x157.5pt box size, unaffected by rotation).
		expect(leaf!.from.x).toBeCloseTo(67.74921 / 630, 3);
		expect(leaf!.from.y).toBeCloseTo(4.565906 / 315, 3);
		expect(leaf!.to!.x).toBeCloseTo((67.74921 + 157.5) / 630, 3);
		expect(leaf!.to!.y).toBeCloseTo((4.565906 + 157.5) / 315, 3);
		// The isotropic (chartBox-less) fallback lands somewhere measurably
		// different on the Y axis (its X axis happens to coincide here, since
		// this leaf's own offset from the group's centre is purely horizontal
		// and rotation's contribution to the ROTATED x-component does not
		// depend on the aspect ratio when the pre-rotation y-offset is zero;
		// its contribution to y DOES, which is what this asserts), confirming
		// the aspect correction actually changes the result rather than being
		// a no-op for this off-centre, rotated case.
		expect(isotropic.from.y).not.toBeCloseTo(leaf!.from.y, 2);
	});

	it('flattenChartUserShapes passes non-group shapes through unchanged', () => {
		const shape = {
			kind: 'sp' as const,
			anchor: 'rel' as const,
			from: { x: 0, y: 0 },
			to: { x: 0.2, y: 0.2 },
			prst: 'rect',
		};
		expect(flattenChartUserShapes([shape])).toStrictEqual([shape]);
		expect(flattenChartUserShapes(undefined)).toStrictEqual([]);
	});

	it('registers a placeholder carrying rawXml for a graphicFrame anchor instead of dropping it', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:absSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.2, 'cdr:y': 0.2 },
					'cdr:ext': { '@_cx': '100000', '@_cy': '50000' },
					'cdr:graphicFrame': { '@_name': 'Nested Chart' },
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		expect(shapes).toStrictEqual([
			{
				kind: 'graphicFrame',
				anchor: 'abs',
				from: { x: 0.2, y: 0.2 },
				ext: { cx: 100000, cy: 50000 },
				rawXml: { '@_name': 'Nested Chart' },
			},
		]);
	});

	// W4-D: a `pic` anchor keeps its verbatim source node as `rawXml` (the
	// blip reference has no typed representation), so the serializer can
	// re-emit it unchanged instead of a lossy rectangle placeholder.
	it('keeps a pic anchor child as rawXml alongside its resolved visuals', () => {
		const xml = createXmlLookup();
		const picNode: XmlObject = {
			'cdr:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } },
			'cdr:spPr': {
				'a:prstGeom': { '@_prst': 'rect' },
				'a:ln': { '@_w': '9525', 'a:solidFill': { 'a:srgbClr': { '@_val': '000000' } } },
			},
		};
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.05, 'cdr:y': 0.05 },
					'cdr:to': { 'cdr:x': 0.3, 'cdr:y': 0.3 },
					'cdr:pic': picNode,
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		expect(shapes).toHaveLength(1);
		const shape = shapes![0];
		expect(shape.kind).toBe('pic');
		expect(shape.stroke).toBe('#000000');
		expect(shape.rawXml).toStrictEqual(picNode);
		expect(shape.rawXml).not.toBe(picNode); // cloned, not shared by reference
	});

	it('resolves a gradient fill from its first stop when there is no solid fill', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0, 'cdr:y': 0 },
					'cdr:to': { 'cdr:x': 1, 'cdr:y': 1 },
					'cdr:sp': {
						'cdr:spPr': {
							'a:gradFill': {
								'a:gsLst': {
									'a:gs': [
										{ '@_pos': '0', 'a:srgbClr': { '@_val': 'AABBCC' } },
										{ '@_pos': '100000', 'a:srgbClr': { '@_val': '112233' } },
									],
								},
							},
						},
					},
				},
			},
		};
		const [shape] = parseChartUserShapesDrawing(drawing, xml, colors)!;
		expect(shape.fill).toBe('#AABBCC');
	});

	it('resolves a pattern fill from its foreground colour', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0, 'cdr:y': 0 },
					'cdr:to': { 'cdr:x': 1, 'cdr:y': 1 },
					'cdr:sp': {
						'cdr:spPr': {
							'a:pattFill': {
								'@_prst': 'pct50',
								'a:fgClr': { 'a:srgbClr': { '@_val': '654321' } },
								'a:bgClr': { 'a:srgbClr': { '@_val': 'FFFFFF' } },
							},
						},
					},
				},
			},
		};
		const [shape] = parseChartUserShapesDrawing(drawing, xml, colors)!;
		expect(shape.fill).toBe('#654321');
	});
});
