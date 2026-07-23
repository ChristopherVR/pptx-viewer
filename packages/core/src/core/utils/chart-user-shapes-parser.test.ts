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
});
