import { describe, it, expect } from 'vitest';
import {
	createTemplateShapeRawXml,
	createTemplateConnectorRawXml,
} from './xml-shape';
import type {
	PptxElementWithText,
	ConnectorPptxElement,
	XmlObject,
} from 'pptx-viewer-core';

const EMU_PER_PX = 9525;

function makeTextElement(overrides: Partial<PptxElementWithText> = {}): PptxElementWithText {
	return {
		id: 'el1',
		type: 'text',
		x: 100,
		y: 200,
		width: 300,
		height: 50,
		text: 'Hello World',
		shapeType: 'rect',
		...overrides,
	} as PptxElementWithText;
}

function makeShapeElement(overrides: Partial<PptxElementWithText> = {}): PptxElementWithText {
	return {
		id: 'el2',
		type: 'shape',
		x: 50,
		y: 100,
		width: 200,
		height: 150,
		text: '',
		shapeType: 'rect',
		...overrides,
	} as PptxElementWithText;
}

function makeConnector(overrides: Partial<ConnectorPptxElement> = {}): ConnectorPptxElement {
	return {
		id: 'conn1',
		type: 'connector',
		x: 10,
		y: 20,
		width: 100,
		height: 0,
		shapeType: 'connector',
		shapeStyle: {
			strokeColor: '#FF0000',
			strokeWidth: 2,
		},
		...overrides,
	} as ConnectorPptxElement;
}

describe('createTemplateShapeRawXml', () => {
	it('should create XML with correct position in EMU', () => {
		const element = makeTextElement({ x: 100, y: 200 });
		const xml = createTemplateShapeRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		const off = xfrm['a:off'] as XmlObject;
		expect(off['@_x']).toBe(String(Math.round(100 * EMU_PER_PX)));
		expect(off['@_y']).toBe(String(Math.round(200 * EMU_PER_PX)));
	});

	it('should create XML with correct size in EMU', () => {
		const element = makeTextElement({ width: 300, height: 50 });
		const xml = createTemplateShapeRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		const ext = xfrm['a:ext'] as XmlObject;
		expect(ext['@_cx']).toBe(String(Math.round(300 * EMU_PER_PX)));
		expect(ext['@_cy']).toBe(String(Math.round(50 * EMU_PER_PX)));
	});

	it('should set txBox to "1" for text elements', () => {
		const element = makeTextElement();
		const xml = createTemplateShapeRawXml(element);
		const nvSpPr = xml['p:nvSpPr'] as XmlObject;
		const cNvSpPr = nvSpPr['p:cNvSpPr'] as XmlObject;
		expect(cNvSpPr['@_txBox']).toBe('1');
	});

	it('should set txBox to "0" for shape elements', () => {
		const element = makeShapeElement();
		const xml = createTemplateShapeRawXml(element);
		const nvSpPr = xml['p:nvSpPr'] as XmlObject;
		const cNvSpPr = nvSpPr['p:cNvSpPr'] as XmlObject;
		expect(cNvSpPr['@_txBox']).toBe('0');
	});

	it('should set geometry to the element shapeType', () => {
		const element = makeShapeElement({ shapeType: 'ellipse' });
		const xml = createTemplateShapeRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('ellipse');
	});

	it('should convert "cylinder" shapeType to "can"', () => {
		const element = makeShapeElement({ shapeType: 'cylinder' });
		const xml = createTemplateShapeRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('can');
	});

	it('should default to "rect" when shapeType is undefined', () => {
		const element = makeShapeElement({ shapeType: undefined });
		const xml = createTemplateShapeRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('rect');
	});

	it('should include text content in the body', () => {
		const element = makeTextElement({ text: 'My Text' });
		const xml = createTemplateShapeRawXml(element);
		const txBody = xml['p:txBody'] as XmlObject;
		const paragraphs = txBody['a:p'] as XmlObject[];
		const run = paragraphs[0]['a:r'] as XmlObject;
		expect(run['a:t']).toBe('My Text');
	});

	it('should set flipH when flipHorizontal is true', () => {
		const element = makeShapeElement({ flipHorizontal: true } as any);
		const xml = createTemplateShapeRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		expect(xfrm['@_flipH']).toBe('1');
	});

	it('should include shape adjustments when provided', () => {
		const element = makeShapeElement({
			shapeAdjustments: { adj1: 50000, adj2: 25000 },
		} as any);
		const xml = createTemplateShapeRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		const avLst = prstGeom['a:avLst'] as XmlObject;
		const gds = avLst['a:gd'] as XmlObject[];
		expect(gds).toHaveLength(2);
		expect(gds[0]['@_name']).toBe('adj1');
		expect(gds[0]['@_fmla']).toBe('val 50000');
	});
});

describe('createTemplateConnectorRawXml', () => {
	it('should create connector XML with correct position', () => {
		const element = makeConnector({ x: 10, y: 20 });
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		const off = xfrm['a:off'] as XmlObject;
		expect(off['@_x']).toBe(String(Math.round(10 * EMU_PER_PX)));
		expect(off['@_y']).toBe(String(Math.round(20 * EMU_PER_PX)));
	});

	it('should default to straightConnector1 geometry for "connector" shapeType', () => {
		const element = makeConnector({ shapeType: 'connector' });
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('straightConnector1');
	});

	it('should use custom shapeType when not "connector"', () => {
		const element = makeConnector({ shapeType: 'bentConnector3' } as any);
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('bentConnector3');
	});

	it('should include stroke width in line node', () => {
		const element = makeConnector({
			shapeStyle: { strokeColor: '#000000', strokeWidth: 3 },
		} as any);
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(Math.round(3 * EMU_PER_PX)));
	});

	it('should include stroke color in line node', () => {
		const element = makeConnector({
			shapeStyle: { strokeColor: '#FF0000', strokeWidth: 1 },
		} as any);
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		const solidFill = ln['a:solidFill'] as XmlObject;
		const clr = solidFill['a:srgbClr'] as XmlObject;
		expect(clr['@_val']).toBe('FF0000');
	});

	it('should include headEnd when connectorStartArrow is set', () => {
		const element = makeConnector({
			shapeStyle: {
				strokeColor: '#000',
				strokeWidth: 1,
				connectorStartArrow: 'triangle',
			},
		} as any);
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		const headEnd = ln['a:headEnd'] as XmlObject;
		expect(headEnd['@_type']).toBe('triangle');
	});

	it('should include tailEnd when connectorEndArrow is set', () => {
		const element = makeConnector({
			shapeStyle: {
				strokeColor: '#000',
				strokeWidth: 1,
				connectorEndArrow: 'arrow',
			},
		} as any);
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		const tailEnd = ln['a:tailEnd'] as XmlObject;
		expect(tailEnd['@_type']).toBe('arrow');
	});

	it('should enforce minimum stroke width of 1', () => {
		const element = makeConnector({
			shapeStyle: { strokeColor: '#000', strokeWidth: 0 },
		} as any);
		const xml = createTemplateConnectorRawXml(element);
		const spPr = xml['p:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect(Number(ln['@_w'])).toBeGreaterThanOrEqual(EMU_PER_PX);
	});
});
