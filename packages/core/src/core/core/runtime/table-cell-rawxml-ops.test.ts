/**
 * Table-cell raw-XML edits against markup a real deck actually contains.
 *
 * The fixtures go through `XMLParser` deliberately: `<a:pPr/>`, `<a:rPr/>` and
 * `<a:p/>` are all legal, all common, and all materialise as the empty STRING.
 * Object literals cannot express that, so a test written from literals proves
 * nothing about the paths that broke here.
 */
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { PptxElement, XmlObject } from '../../types';
import { updateCellTextInRawXml, updateCellTextStyleInRawXml } from './table-cell-rawxml-ops';
import { ensureArray } from './table-structural-helpers';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
});
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** Wrap cell markup in the graphic-frame envelope `getTblFromRawXml` walks. */
function tableElement(cellsXml: string): PptxElement {
	const parsed = parser.parse(
		`<f><a:graphic><a:graphicData><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="100"/></a:tblGrid>` +
			`<a:tr h="100">${cellsXml}</a:tr></a:tbl></a:graphicData></a:graphic></f>`,
	) as Record<string, XmlObject>;
	return {
		id: 'e1',
		type: 'table',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		rawXml: parsed['f'],
	} as unknown as PptxElement;
}

function cellOf(rawXml: XmlObject): XmlObject {
	const graphic = rawXml['a:graphic'] as XmlObject;
	const data = graphic['a:graphicData'] as XmlObject;
	const table = data['a:tbl'] as XmlObject;
	const row = table['a:tr'] as XmlObject;
	return row['a:tc'] as XmlObject;
}

function paragraphsOf(rawXml: XmlObject): XmlObject[] {
	const txBody = cellOf(rawXml)['a:txBody'] as XmlObject;
	return ensureArray(txBody['a:p'] as XmlObject | XmlObject[] | undefined);
}

describe('updateCellTextStyleInRawXml with bare properties elements', () => {
	const bareProps =
		'<a:tc><a:txBody><a:bodyPr/><a:p><a:pPr/><a:r><a:rPr/><a:t>hi</a:t></a:r></a:p></a:txBody></a:tc>';

	it('aligns a cell whose <a:pPr/> is bare instead of throwing', () => {
		const element = tableElement(bareProps);
		let result: XmlObject | undefined;
		expect(() => {
			result = updateCellTextStyleInRawXml(element, 0, 0, { align: 'center' });
		}).not.toThrow();
		const pPr = paragraphsOf(result as XmlObject)[0]['a:pPr'] as XmlObject;
		expect(pPr['@_algn']).toBe('ctr');
	});

	it('bolds a run whose <a:rPr/> is bare instead of throwing', () => {
		const element = tableElement(bareProps);
		let result: XmlObject | undefined;
		expect(() => {
			result = updateCellTextStyleInRawXml(element, 0, 0, { bold: true });
		}).not.toThrow();
		const run = paragraphsOf(result as XmlObject)[0]['a:r'] as XmlObject;
		expect((run['a:rPr'] as XmlObject)['@_b']).toBe('1');
	});

	it('leaves the run text intact while healing its properties', () => {
		const result = updateCellTextStyleInRawXml(tableElement(bareProps), 0, 0, {
			bold: true,
		}) as XmlObject;
		const run = paragraphsOf(result)[0]['a:r'] as XmlObject;
		expect(run['a:t']).toBe('hi');
	});

	it('creates a missing <a:rPr> ahead of <a:t>, as CT_RegularTextRun requires', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>hi</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextStyleInRawXml(element, 0, 0, { italic: true }) as XmlObject;
		const run = paragraphsOf(result)[0]['a:r'] as XmlObject;
		expect(Object.keys(run)).toStrictEqual(['a:rPr', 'a:t']);
	});

	it('creates a missing <a:pPr> ahead of the runs, as CT_TextParagraph requires', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>hi</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextStyleInRawXml(element, 0, 0, { align: 'right' }) as XmlObject;
		expect(Object.keys(paragraphsOf(result)[0])).toStrictEqual(['a:pPr', 'a:r']);
	});

	it('styles an empty paragraph through its bare <a:endParaRPr/>', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:endParaRPr/></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextStyleInRawXml(element, 0, 0, { bold: true }) as XmlObject;
		const endParaRPr = paragraphsOf(result)[0]['a:endParaRPr'] as XmlObject;
		expect(endParaRPr['@_b']).toBe('1');
	});

	it('aligns a cell holding nothing but a lone <a:p/>', () => {
		const element = tableElement('<a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody></a:tc>');
		let result: XmlObject | undefined;
		expect(() => {
			result = updateCellTextStyleInRawXml(element, 0, 0, { align: 'justify' });
		}).not.toThrow();
		const paragraphs = paragraphsOf(result as XmlObject);
		expect(paragraphs).toHaveLength(1);
		expect((paragraphs[0]['a:pPr'] as XmlObject)['@_algn']).toBe('just');
	});
});

describe('updateCellTextInRawXml emits CT_TextBody in schema order', () => {
	it('puts a:bodyPr and a:lstStyle before a:p', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>old</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextInRawXml(element, 0, 0, 'new') as XmlObject;
		const txBody = cellOf(result)['a:txBody'] as XmlObject;
		expect(Object.keys(txBody)).toStrictEqual(['a:bodyPr', 'a:lstStyle', 'a:p']);
		expect(builder.build({ 'a:txBody': txBody })).toContain(
			'<a:bodyPr></a:bodyPr><a:lstStyle></a:lstStyle><a:p>',
		);
	});

	it('keeps a preserved bare <a:pPr/> and puts it ahead of the run', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:pPr/><a:r><a:t>old</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextInRawXml(element, 0, 0, 'new') as XmlObject;
		const paragraph = paragraphsOf(result)[0];
		expect(Object.keys(paragraph)).toStrictEqual(['a:pPr', 'a:r']);
		expect((paragraph['a:r'] as XmlObject)['a:t']).toBe('new');
	});

	it('puts run properties ahead of the text', () => {
		const element = tableElement(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en"/><a:t>old</a:t></a:r></a:p></a:txBody></a:tc>',
		);
		const result = updateCellTextInRawXml(element, 0, 0, 'new') as XmlObject;
		const run = paragraphsOf(result)[0]['a:r'] as XmlObject;
		expect(Object.keys(run)).toStrictEqual(['a:rPr', 'a:t']);
	});
});

describe('ensureArray', () => {
	it('reports one paragraph for a lone <a:p/>, not zero', () => {
		const body = (parser.parse('<t><a:bodyPr/><a:p/></t>') as Record<string, XmlObject>)['t'];
		expect(ensureArray(body['a:p'] as XmlObject | XmlObject[] | undefined)).toHaveLength(1);
	});

	it('still treats undefined and null as absent', () => {
		expect(ensureArray(undefined)).toStrictEqual([]);
		expect(ensureArray(null)).toStrictEqual([]);
	});
});
