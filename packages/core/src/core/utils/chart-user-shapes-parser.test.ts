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
