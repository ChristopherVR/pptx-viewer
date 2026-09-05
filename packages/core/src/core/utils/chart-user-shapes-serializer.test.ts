import { describe, it, expect } from 'vitest';

import type { PptxChartUserShape, XmlObject } from '../types';
import { parseChartUserShapesDrawing } from './chart-user-shapes-parser';
import { buildChartUserShapesDrawingXml } from './chart-user-shapes-serializer';

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

describe('buildChartUserShapesDrawingXml', () => {
	it('round-trips a relSizeAnchor text box through parse -> serialize -> parse', () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.2 },
				to: { x: 0.5, y: 0.6 },
				prst: 'rect',
				fill: '#FF0000',
				stroke: '#00FF00',
				strokeWidth: 1,
				paragraphs: [{ text: 'Note', align: 'ctr', fontSize: 14, bold: true }],
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toStrictEqual(shapes);
	});

	it('round-trips an absSizeAnchor connector', () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'cxnSp',
				anchor: 'abs',
				from: { x: 0.25, y: 0.25 },
				ext: { cx: 914400, cy: 457200 },
				stroke: '#0000FF',
				strokeWidth: 1.5,
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toStrictEqual(shapes);
	});

	it('round-trips multiple mixed-anchor shapes, keeping rel anchors before abs', () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{ kind: 'sp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 0.2, y: 0.2 }, prst: 'ellipse' },
			{
				kind: 'sp',
				anchor: 'abs',
				from: { x: 0.6, y: 0.6 },
				ext: { cx: 100000, cy: 50000 },
				prst: 'rect',
				fill: '#123456',
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toStrictEqual(shapes);
	});

	it('emits no anchors for an empty shape list', () => {
		const built = buildChartUserShapesDrawingXml([]);
		expect(built['c:userShapes']).toBeDefined();
		const root = built['c:userShapes'] as XmlObject;
		expect(root['cdr:relSizeAnchor']).toBeUndefined();
		expect(root['cdr:absSizeAnchor']).toBeUndefined();
	});

	it('serializes a pic overlay as a fill-only placeholder rectangle (no text, no picture ref)', () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'pic',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.3, y: 0.3 },
				fill: '#AAAAAA',
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		// Fidelity note: a `pic` overlay has no reconstructable picture
		// reference in the flattened render model, so re-serializing it
		// downgrades `kind` to a plain `sp` placeholder carrying only fill.
		expect(reparsed).toStrictEqual([
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.3, y: 0.3 },
				prst: 'rect',
				fill: '#AAAAAA',
			},
		]);
	});
});
