import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseChartUserShapesDrawing } from './chart-user-shapes-parser';

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
	it('flattens a grpSp anchor into one entry per grouped sp/cxnSp/pic child', () => {
		const xml = createXmlLookup();
		const drawing: XmlObject = {
			'c:userShapes': {
				'cdr:relSizeAnchor': {
					'cdr:from': { 'cdr:x': 0.1, 'cdr:y': 0.1 },
					'cdr:to': { 'cdr:x': 0.4, 'cdr:y': 0.4 },
					'cdr:grpSp': {
						'cdr:sp': [
							{ 'cdr:spPr': { 'a:prstGeom': { '@_prst': 'rect' } } },
							{ 'cdr:spPr': { 'a:prstGeom': { '@_prst': 'ellipse' } } },
						],
						'cdr:cxnSp': { 'cdr:spPr': { 'a:ln': { '@_w': '12700' } } },
					},
				},
			},
		};
		const shapes = parseChartUserShapesDrawing(drawing, xml, colors);
		expect(shapes).toHaveLength(3);
		expect(shapes!.map((s) => s.kind)).toStrictEqual(['sp', 'sp', 'cxnSp']);
		expect(shapes!.map((s) => s.prst)).toStrictEqual(['rect', 'ellipse', undefined]);
		// Every flattened child reuses the anchor's own bounding box.
		for (const shape of shapes!) {
			expect(shape.from).toStrictEqual({ x: 0.1, y: 0.1 });
			expect(shape.to).toStrictEqual({ x: 0.4, y: 0.4 });
		}
	});

	it('registers a bare placeholder for a graphicFrame anchor instead of dropping it', () => {
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
			},
		]);
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
