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

	it('round-trips a rotated and flipped top-level sp', () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.05, y: 0.05 },
				to: { x: 0.3, y: 0.2 },
				prst: 'rect',
				rotation: 30,
				flipV: true,
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toStrictEqual(shapes);
	});

	it('round-trips a rotated cxnSp with no flip attributes when unset', () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'cxnSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 0.2, y: 0.2 },
				rotation: 45,
				stroke: '#000000',
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const anchor = (built['c:userShapes'] as XmlObject)['cdr:relSizeAnchor'] as XmlObject;
		const xfrm = ((anchor['cdr:cxnSp'] as XmlObject)['cdr:spPr'] as XmlObject)[
			'a:xfrm'
		] as XmlObject;
		expect(xfrm['@_flipH']).toBeUndefined();
		expect(xfrm['@_flipV']).toBeUndefined();
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toStrictEqual(shapes);
	});

	it("round-trips a group's own rotation/flip alongside its children", () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.4, y: 0.4 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
					rotation: 15,
					flipH: true,
				},
				children: [
					{
						kind: 'sp',
						off: { x: 0, y: 0 },
						ext: { cx: 500000, cy: 1000000 },
						prst: 'rect',
						rotation: 7.5,
					},
				],
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		// Not toStrictEqual: a freshly rebuilt (no source `rawXml`) grpSp gets
		// its OWN verbatim rawXml attached on reparse, same as the sibling
		// "rebuilds a grpSp from its typed transform/children" test below.
		expect(reparsed).toHaveLength(1);
		const group = reparsed![0];
		expect(group.transform).toStrictEqual(shapes[0]!.transform);
		expect(group.children).toStrictEqual(shapes[0]!.children);
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

	// W4-D: a pic/graphicFrame anchor carrying rawXml re-emits verbatim
	// instead of downgrading to a lossy rectangle placeholder, even when the
	// overlay array around it is edited (this is the exact scenario the row
	// documented: "if the overlay array is edited at all it is re-emitted as
	// a plain fill/stroke rectangle").
	it('re-emits a pic overlay verbatim from rawXml, unchanged by an edit elsewhere in the array', () => {
		const xml = createXmlLookup();
		const picRawXml: XmlObject = {
			'cdr:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } },
		};
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'pic',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.3, y: 0.3 },
				rawXml: picRawXml,
			},
			// A sibling `sp` being added/edited is what forces the whole array
			// to be re-serialized; the pic above must survive it unchanged.
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.5, y: 0.5 },
				to: { x: 0.7, y: 0.7 },
				prst: 'ellipse',
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toStrictEqual(shapes);
	});

	it('re-emits a graphicFrame overlay verbatim from rawXml', () => {
		const xml = createXmlLookup();
		const graphicFrameRawXml: XmlObject = { '@_name': 'Nested Table' };
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'graphicFrame',
				anchor: 'abs',
				from: { x: 0.2, y: 0.2 },
				ext: { cx: 100000, cy: 50000 },
				rawXml: graphicFrameRawXml,
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toStrictEqual(shapes);
	});

	// W2-F: alt text is the one `pic` field the minimal editor can change
	// without touching the rest of the verbatim node (the blip, etc).
	it('patches only the alt text onto a rawXml pic, leaving the rest verbatim', () => {
		const xml = createXmlLookup();
		const picRawXml: XmlObject = {
			'cdr:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } },
		};
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'pic',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.3, y: 0.3 },
				rawXml: picRawXml,
				altText: 'A photo of the podium',
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		expect(reparsed).toHaveLength(1);
		expect(reparsed![0].kind).toBe('pic');
		expect(reparsed![0].altText).toBe('A photo of the podium');
		expect(reparsed![0].rawXml).toStrictEqual({
			...picRawXml,
			'cdr:nvPicPr': { 'cdr:cNvPr': { '@_descr': 'A photo of the podium' } },
		});
	});

	// W2-F: a grouped pic/graphicFrame child's position/size lives inside its
	// own `a:xfrm`, baked into `rawXml`; editing the typed `off`/`ext` (what
	// the inspector's controls change) must actually move the shape on save,
	// not silently re-emit the stale pre-edit position.
	it("patches a grouped pic child's own xfrm from its edited off/ext", () => {
		const xml = createXmlLookup();
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
				},
				children: [
					{
						kind: 'pic',
						// Edited: moved/resized from wherever the source had it.
						off: { x: 200000, y: 300000 },
						ext: { cx: 400000, cy: 500000 },
						rawXml: {
							'cdr:spPr': {
								'a:xfrm': {
									'a:off': { '@_x': '0', '@_y': '0' },
									'a:ext': { '@_cx': '100000', '@_cy': '100000' },
								},
							},
							'cdr:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } },
						},
						altText: 'Podium photo',
					},
				],
			},
		];
		const built = buildChartUserShapesDrawingXml(shapes);
		const reparsed = parseChartUserShapesDrawing(built, xml, colors);
		const child = reparsed![0].children![0];
		expect(child.kind).toBe('pic');
		expect(child.off).toStrictEqual({ x: 200000, y: 300000 });
		expect(child.ext).toStrictEqual({ cx: 400000, cy: 500000 });
		expect(child.altText).toBe('Podium photo');
		// The blip content is untouched.
		expect((child.rawXml as XmlObject)['cdr:blipFill']).toStrictEqual({
			'a:blip': { '@_r:embed': 'rId1' },
		});
	});

	it('falls back to a placeholder rectangle for a rawXml-less pic (no source markup to fall back to)', () => {
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

	// W5-I: a grpSp anchor's own transform + children round-trip.
	describe('grpSp anchors', () => {
		it('re-emits an untouched grpSp verbatim from rawXml (byte-identical passthrough)', () => {
			const xml = createXmlLookup();
			const groupRawXml: XmlObject = {
				'cdr:grpSpPr': {
					'a:xfrm': {
						'a:off': { '@_x': '0', '@_y': '0' },
						'a:ext': { '@_cx': '1000000', '@_cy': '1000000' },
						'a:chOff': { '@_x': '0', '@_y': '0' },
						'a:chExt': { '@_cx': '1000000', '@_cy': '1000000' },
					},
				},
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
			const shapes: PptxChartUserShape[] = [
				{
					kind: 'grpSp',
					anchor: 'rel',
					from: { x: 0.1, y: 0.1 },
					to: { x: 0.4, y: 0.4 },
					transform: {
						off: { x: 0, y: 0 },
						ext: { cx: 1000000, cy: 1000000 },
						chOff: { x: 0, y: 0 },
						chExt: { cx: 1000000, cy: 1000000 },
					},
					children: [
						{
							kind: 'sp',
							off: { x: 0, y: 0 },
							ext: { cx: 1000000, cy: 1000000 },
							prst: 'rect',
						},
					],
					rawXml: groupRawXml,
				},
				// A sibling edit forces the whole array to be re-serialized; the
				// untouched group above must survive it byte-identical.
				{
					kind: 'sp',
					anchor: 'rel',
					from: { x: 0.5, y: 0.5 },
					to: { x: 0.7, y: 0.7 },
					prst: 'ellipse',
				},
			];
			const built = buildChartUserShapesDrawingXml(shapes);
			const reparsed = parseChartUserShapesDrawing(built, xml, colors);
			expect(reparsed).toStrictEqual(shapes);
		});

		it('rebuilds a grpSp from its typed transform/children once rawXml is cleared (an SDK edit)', () => {
			const xml = createXmlLookup();
			const shapes: PptxChartUserShape[] = [
				{
					kind: 'grpSp',
					anchor: 'rel',
					from: { x: 0.1, y: 0.1 },
					to: { x: 0.4, y: 0.4 },
					transform: {
						off: { x: 0, y: 0 },
						ext: { cx: 1000000, cy: 1000000 },
						chOff: { x: 0, y: 0 },
						chExt: { cx: 1000000, cy: 1000000 },
					},
					children: [
						{
							kind: 'sp',
							off: { x: 0, y: 0 },
							ext: { cx: 500000, cy: 1000000 },
							prst: 'rect',
							fill: '#FF0000',
						},
						{
							kind: 'cxnSp',
							off: { x: 500000, y: 0 },
							ext: { cx: 500000, cy: 1000000 },
							stroke: '#0000FF',
							strokeWidth: 1,
						},
					],
					// No rawXml: either freshly authored, or cleared by an SDK edit.
				},
			];
			const built = buildChartUserShapesDrawingXml(shapes);
			const reparsed = parseChartUserShapesDrawing(built, xml, colors);
			expect(reparsed).toHaveLength(1);
			const group = reparsed![0];
			expect(group.kind).toBe('grpSp');
			expect(group.transform).toStrictEqual(shapes[0].transform);
			expect(group.children).toHaveLength(2);
			expect(group.children![0]).toMatchObject({
				kind: 'sp',
				off: { x: 0, y: 0 },
				ext: { cx: 500000, cy: 1000000 },
				prst: 'rect',
				fill: '#FF0000',
			});
			expect(group.children![1]).toMatchObject({
				kind: 'cxnSp',
				off: { x: 500000, y: 0 },
				ext: { cx: 500000, cy: 1000000 },
				stroke: '#0000FF',
				strokeWidth: 1,
			});
			// The rebuild produces its OWN rawXml on reparse (any grpSp found on
			// disk gets one, see the parser's doc); a second untouched save must
			// still be able to reuse it, which the round-trip above covers.
			expect(group.rawXml).toBeDefined();
		});

		it('rebuilds a nested grpSp (a group inside a group)', () => {
			const xml = createXmlLookup();
			const shapes: PptxChartUserShape[] = [
				{
					kind: 'grpSp',
					anchor: 'rel',
					from: { x: 0, y: 0 },
					to: { x: 1, y: 1 },
					transform: {
						off: { x: 0, y: 0 },
						ext: { cx: 1000000, cy: 1000000 },
						chOff: { x: 0, y: 0 },
						chExt: { cx: 1000000, cy: 1000000 },
					},
					children: [
						{
							kind: 'grpSp',
							off: { x: 0, y: 0 },
							ext: { cx: 500000, cy: 1000000 },
							transform: {
								off: { x: 0, y: 0 },
								ext: { cx: 500000, cy: 1000000 },
								chOff: { x: 0, y: 0 },
								chExt: { cx: 500000, cy: 1000000 },
							},
							children: [
								{
									kind: 'sp',
									off: { x: 0, y: 0 },
									ext: { cx: 500000, cy: 1000000 },
									prst: 'triangle',
								},
							],
						},
					],
				},
			];
			const built = buildChartUserShapesDrawingXml(shapes);
			const reparsed = parseChartUserShapesDrawing(built, xml, colors);
			const outer = reparsed![0];
			expect(outer.children).toHaveLength(1);
			const nested = outer.children![0];
			expect(nested.kind).toBe('grpSp');
			expect(nested.transform).toStrictEqual(shapes[0].children![0].transform);
			expect(nested.children).toHaveLength(1);
			expect(nested.children![0]).toMatchObject({ kind: 'sp', prst: 'triangle' });
		});
	});
});
