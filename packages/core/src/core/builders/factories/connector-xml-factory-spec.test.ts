import { describe, it, expect } from 'vitest';
import { ConnectorXmlFactory } from './ConnectorXmlFactory';
import type { PptxBuilderFactoryContext } from './types';
import type { ConnectorPptxElement, XmlObject } from '../../types';

const EMU_PER_PX = 9525;

function createMockContext(
	overrides?: Partial<PptxBuilderFactoryContext>
): PptxBuilderFactoryContext {
	let nextId = 10;
	return {
		emuPerPx: EMU_PER_PX,
		getNextId: () => nextId++,
		normalizePresetGeometry: (shapeType) => shapeType || 'rect',
		toDrawingTextVerticalAlign: () => undefined,
		...overrides,
	};
}

function createConnectorElement(
	overrides: Partial<ConnectorPptxElement> = {}
): ConnectorPptxElement {
	return {
		type: 'connector',
		id: 'cxn_1',
		x: 100,
		y: 200,
		width: 300,
		height: 0,
		...overrides,
	} as ConnectorPptxElement;
}

describe('ConnectorXmlFactory', () => {
	it('should produce p:nvCxnSpPr, p:spPr nodes', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement(),
		});
		expect(result['p:nvCxnSpPr']).toBeDefined();
		expect(result['p:spPr']).toBeDefined();
	});

	it('should default to straightConnector1 for line shapeType', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({ shapeType: 'line' } as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('straightConnector1');
	});

	it('should normalize bent/curved connector geometry', () => {
		const factory = new ConnectorXmlFactory(
			createMockContext({
				normalizePresetGeometry: (s) => s || 'rect',
			})
		);
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeType: 'bentConnector3',
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('bentConnector3');
	});

	it('should convert position and size to EMU', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				x: 100,
				y: 200,
				width: 300,
				height: 50,
			}),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		const off = xfrm['a:off'] as XmlObject;
		const ext = xfrm['a:ext'] as XmlObject;
		expect(off['@_x']).toBe(String(Math.round(100 * EMU_PER_PX)));
		expect(off['@_y']).toBe(String(Math.round(200 * EMU_PER_PX)));
		expect(ext['@_cx']).toBe(String(Math.round(300 * EMU_PER_PX)));
		expect(ext['@_cy']).toBe(String(Math.round(50 * EMU_PER_PX)));
	});

	it('should set triangle arrow head type on a:headEnd', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					connectorStartArrow: 'triangle',
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		const headEnd = ln['a:headEnd'] as XmlObject;
		expect(headEnd['@_type']).toBe('triangle');
	});

	it('should set stealth arrow on tail end', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					connectorEndArrow: 'stealth',
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		const tailEnd = ln['a:tailEnd'] as XmlObject;
		expect(tailEnd['@_type']).toBe('stealth');
	});

	it('should not emit a:headEnd when connectorStartArrow is "none"', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					connectorStartArrow: 'none',
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:headEnd']).toBeUndefined();
	});

	it('should set both diamond head and oval tail arrows', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					connectorStartArrow: 'diamond',
					connectorEndArrow: 'oval',
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect((ln['a:headEnd'] as XmlObject)['@_type']).toBe('diamond');
		expect((ln['a:tailEnd'] as XmlObject)['@_type']).toBe('oval');
	});

	it('should set preset dash pattern', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					strokeDash: 'dash',
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		const prstDash = ln['a:prstDash'] as XmlObject;
		expect(prstDash['@_val']).toBe('dash');
	});

	it('should set custom dash segments', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					strokeDash: 'custom',
					customDashSegments: [
						{ dash: 200000, space: 100000 },
						{ dash: 100000, space: 100000 },
					],
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:custDash']).toBeDefined();
		const custDash = ln['a:custDash'] as XmlObject;
		const ds = custDash['a:ds'] as XmlObject[];
		expect(ds).toHaveLength(2);
		expect(ds[0]['@_d']).toBe('200000');
		expect(ds[0]['@_sp']).toBe('100000');
	});

	it('should set connection points for stCxn and endCxn', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					connectorStartConnection: {
						shapeId: 'shape_2',
						connectionSiteIndex: 3,
					},
					connectorEndConnection: {
						shapeId: 'shape_3',
						connectionSiteIndex: 1,
					},
				},
			} as any),
		});
		const nvCxnSpPr = result['p:nvCxnSpPr'] as XmlObject;
		const cNvCxnSpPr = nvCxnSpPr['p:cNvCxnSpPr'] as XmlObject;
		const stCxn = cNvCxnSpPr['a:stCxn'] as XmlObject;
		const endCxn = cNvCxnSpPr['a:endCxn'] as XmlObject;
		expect(stCxn['@_id']).toBe('shape_2');
		expect(stCxn['@_idx']).toBe('3');
		expect(endCxn['@_id']).toBe('shape_3');
		expect(endCxn['@_idx']).toBe('1');
	});

	it('should set line width in EMU', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					strokeColor: '#FF0000',
					strokeWidth: 3,
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(Math.round(3 * EMU_PER_PX)));
		// Verify solid fill color
		const solidFill = ln['a:solidFill'] as XmlObject;
		const srgbClr = solidFill['a:srgbClr'] as XmlObject;
		expect(srgbClr['@_val']).toBe('FF0000');
	});

	it('should use noFill when stroke is transparent', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				shapeStyle: {
					strokeColor: 'transparent',
					strokeWidth: 2,
				},
			} as any),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:noFill']).toEqual({});
		expect(ln['a:solidFill']).toBeUndefined();
	});

	it('should set rotation, flipH, flipV on a:xfrm', () => {
		const factory = new ConnectorXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createConnectorElement({
				rotation: 90,
				flipHorizontal: true,
				flipVertical: true,
			}),
		});
		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		// rotation = 90 * 60000 = 5400000
		expect(xfrm['@_rot']).toBe(String(Math.round(90 * 60000)));
		expect(xfrm['@_flipH']).toBe('1');
		expect(xfrm['@_flipV']).toBe('1');
	});
});
