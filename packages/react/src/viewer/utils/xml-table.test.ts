import { describe, it, expect } from 'vitest';
import {
	createTableCellXml,
	createTableGraphicFrameRawXml,
	applyTableCellTextAndStyle,
} from './xml-table';
import type { PptxElement, XmlObject } from 'pptx-viewer-core';

describe('createTableCellXml', () => {
	it('should create cell XML with the given text', () => {
		const cell = createTableCellXml('Hello');
		const txBody = cell['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		expect(run['a:t']).toBe('Hello');
	});

	it('should set run properties with lang en-US', () => {
		const cell = createTableCellXml('test');
		const txBody = cell['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		const rPr = run['a:rPr'] as XmlObject;
		expect(rPr['@_lang']).toBe('en-US');
	});

	it('should set font size to 1800', () => {
		const cell = createTableCellXml('test');
		const txBody = cell['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		const rPr = run['a:rPr'] as XmlObject;
		expect(rPr['@_sz']).toBe('1800');
	});

	it('should include border line definitions', () => {
		const cell = createTableCellXml('test');
		const tcPr = cell['a:tcPr'] as XmlObject;
		expect(tcPr['a:lnL']).toBeDefined();
		expect(tcPr['a:lnR']).toBeDefined();
		expect(tcPr['a:lnT']).toBeDefined();
		expect(tcPr['a:lnB']).toBeDefined();
	});

	it('should set cell anchor to top', () => {
		const cell = createTableCellXml('test');
		const tcPr = cell['a:tcPr'] as XmlObject;
		expect(tcPr['@_anchor']).toBe('t');
	});

	it('should use D1D5DB color for borders', () => {
		const cell = createTableCellXml('test');
		const tcPr = cell['a:tcPr'] as XmlObject;
		const lnL = tcPr['a:lnL'] as XmlObject;
		const solidFill = lnL['a:solidFill'] as XmlObject;
		const clr = solidFill['a:srgbClr'] as XmlObject;
		expect(clr['@_val']).toBe('D1D5DB');
	});
});

describe('createTableGraphicFrameRawXml', () => {
	const baseElement: PptxElement = {
		id: 'table1',
		type: 'table',
		x: 100,
		y: 200,
		width: 400,
		height: 300,
	} as PptxElement;

	it('should create a graphic frame with correct position', () => {
		const xml = createTableGraphicFrameRawXml(baseElement, 3, 4);
		const xfrm = xml['p:xfrm'] as XmlObject;
		const off = xfrm['a:off'] as XmlObject;
		expect(off['@_x']).toBe(String(Math.round(100 * 9525)));
		expect(off['@_y']).toBe(String(Math.round(200 * 9525)));
	});

	it('should clamp row count to valid range', () => {
		const xml = createTableGraphicFrameRawXml(baseElement, 0, 2);
		const tbl = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)['a:tbl'] as XmlObject;
		const rows = tbl['a:tr'] as XmlObject[];
		expect(rows.length).toBeGreaterThanOrEqual(1); // MIN_TABLE_DIMENSION
	});

	it('should clamp column count to valid range', () => {
		const xml = createTableGraphicFrameRawXml(baseElement, 2, 0);
		const tbl = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)['a:tbl'] as XmlObject;
		const grid = tbl['a:tblGrid'] as XmlObject;
		const cols = grid['a:gridCol'] as XmlObject[];
		expect(cols.length).toBeGreaterThanOrEqual(1);
	});

	it('should create rows and columns matching given dimensions', () => {
		const xml = createTableGraphicFrameRawXml(baseElement, 3, 4);
		const tbl = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)['a:tbl'] as XmlObject;
		const rows = tbl['a:tr'] as XmlObject[];
		const grid = tbl['a:tblGrid'] as XmlObject;
		const cols = grid['a:gridCol'] as XmlObject[];
		expect(rows.length).toBe(3);
		expect(cols.length).toBe(4);
	});

	it('should set header text for first row cells', () => {
		const xml = createTableGraphicFrameRawXml(baseElement, 2, 3);
		const tbl = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)['a:tbl'] as XmlObject;
		const rows = tbl['a:tr'] as XmlObject[];
		const firstRowCells = rows[0]['a:tc'] as XmlObject[];
		const txBody = firstRowCells[0]['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		expect(run['a:t']).toBe('Header 1');
	});

	it('should set empty text for non-header rows', () => {
		const xml = createTableGraphicFrameRawXml(baseElement, 2, 2);
		const tbl = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)['a:tbl'] as XmlObject;
		const rows = tbl['a:tr'] as XmlObject[];
		const secondRowCells = rows[1]['a:tc'] as XmlObject[];
		const txBody = secondRowCells[0]['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		expect(run['a:t']).toBe('');
	});

	it('should include table URI in graphic data', () => {
		const xml = createTableGraphicFrameRawXml(baseElement, 2, 2);
		const graphicData = (xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject;
		expect(graphicData['@_uri']).toBe('http://schemas.openxmlformats.org/drawingml/2006/table');
	});

	it('should set flipH and flipV when element has those properties', () => {
		const flippedElement = {
			...baseElement,
			flipHorizontal: true,
			flipVertical: true,
		} as PptxElement;
		const xml = createTableGraphicFrameRawXml(flippedElement, 2, 2);
		const xfrm = xml['p:xfrm'] as XmlObject;
		expect(xfrm['@_flipH']).toBe('1');
		expect(xfrm['@_flipV']).toBe('1');
	});
});

describe('applyTableCellTextAndStyle', () => {
	it('should set the text in the cell XML', () => {
		const cellXml: XmlObject = { 'a:txBody': { 'a:bodyPr': {}, 'a:lstStyle': {}, 'a:p': {} } };
		applyTableCellTextAndStyle(cellXml, 'New text', {});
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		expect(run['a:t']).toBe('New text');
	});

	it('should set bold property', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Bold', { bold: true });
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		const rPr = run['a:rPr'] as XmlObject;
		expect(rPr['@_b']).toBe('1');
	});

	it('should set italic property', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Italic', { italic: true });
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		const rPr = run['a:rPr'] as XmlObject;
		expect(rPr['@_i']).toBe('1');
	});

	it('should set underline to "sng" when underline is true', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Underline', { underline: true });
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		const rPr = run['a:rPr'] as XmlObject;
		expect(rPr['@_u']).toBe('sng');
	});

	it('should set alignment to center', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Center', { align: 'center' });
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const pPr = para['a:pPr'] as XmlObject;
		expect(pPr['@_algn']).toBe('ctr');
	});

	it('should set alignment to right', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Right', { align: 'right' });
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const pPr = para['a:pPr'] as XmlObject;
		expect(pPr['@_algn']).toBe('r');
	});

	it('should set alignment to justify', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Justify', { align: 'justify' });
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const pPr = para['a:pPr'] as XmlObject;
		expect(pPr['@_algn']).toBe('just');
	});

	it('should default alignment to left', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Left', {});
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const pPr = para['a:pPr'] as XmlObject;
		expect(pPr['@_algn']).toBe('l');
	});

	it('should enforce minimum font size of 800 hundredths', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, 'Small', { fontSize: 1 });
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		const rPr = run['a:rPr'] as XmlObject;
		// fontSize=1, 1*75=75, max(800,75) = 800
		expect(rPr['@_sz']).toBe('800');
	});

	it('should handle empty/undefined text gracefully', () => {
		const cellXml: XmlObject = {};
		applyTableCellTextAndStyle(cellXml, '', {});
		const txBody = cellXml['a:txBody'] as XmlObject;
		const para = txBody['a:p'] as XmlObject;
		const run = para['a:r'] as XmlObject;
		expect(run['a:t']).toBe('');
	});
});
