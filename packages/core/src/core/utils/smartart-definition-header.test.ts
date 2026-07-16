import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { PptxSmartArtDefinitionHeaderList, XmlObject } from '../types';
import {
	SMART_ART_DEFINITION_PARTS,
	parseSmartArtDefinitionHeaderList,
	serializeSmartArtDefinitionHeaderList,
	validateSmartArtDefinitionHeaderList,
} from './smartart-definition-header';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });

describe('diagramML definition header lists', () => {
	it.each([
		['layout', 'layoutDefHdrLst', 'layoutDefHdr', 'defStyle="urn:style/default"'],
		['style', 'styleDefHdrLst', 'styleDefHdr', ''],
		['color', 'colorsDefHdrLst', 'colorsDefHdr', ''],
	] as const)(
		'parses and serializes the %s family prefix-independently',
		(kind, root, header, extra) => {
			const xml = `<x:${root} xmlns:x="urn:dgm" vendor="keep"><x:${header} uniqueId="urn:${kind}" minVer="12" resId="7" ${extra} custom="yes"><x:title val="Original" lang="en-US" foreign="title"/><x:desc val="Description"/><x:catLst foreign="list"><x:cat type="urn:category" pri="42" foreign="cat"/></x:catLst><x:vendorChild val="keep"/><x:extLst><x:ext uri="keep"/></x:extLst></x:${header}></x:${root}>`;
			const list = parseSmartArtDefinitionHeaderList(parser.parse(xml) as XmlObject);

			expect(list.kind).toBe(kind);
			expect(list.headers[0]).toMatchObject({
				uniqueId: `urn:${kind}`,
				minimumVersion: '12',
				resourceId: 7,
				titles: [{ value: 'Original', language: 'en-US' }],
				descriptions: [{ value: 'Description' }],
				categories: [{ type: 'urn:category', priority: 42 }],
			});
			list.headers[0].titles[0].value = 'Edited';
			list.headers[0].categories![0].priority = 99;
			const serialized = builder.build(serializeSmartArtDefinitionHeaderList(list));

			expect(serialized).toContain(`<x:${root}`);
			expect(serialized).toContain('val="Edited"');
			expect(serialized).toContain('pri="99"');
			expect(serialized).toContain('foreign="title"');
			expect(serialized).toContain('foreign="cat"');
			expect(serialized).toContain('<x:vendorChild val="keep"');
			expect(serialized).toContain('<x:ext uri="keep"');
			expect(serialized.indexOf('<x:title')).toBeLessThan(serialized.indexOf('<x:desc'));
			expect(serialized.indexOf('<x:desc')).toBeLessThan(serialized.indexOf('<x:catLst'));
			expect(serialized.indexOf('<x:catLst')).toBeLessThan(serialized.indexOf('<x:extLst'));
			const reparsed = parseSmartArtDefinitionHeaderList(parser.parse(serialized) as XmlObject);
			expect(reparsed.headers[0].titles[0].value).toBe('Edited');
			expect(reparsed.headers[0].categories![0].priority).toBe(99);
		},
	);

	it('validates required members and XML Schema integer ranges', () => {
		const list: PptxSmartArtDefinitionHeaderList = {
			kind: 'style',
			headers: [
				{
					uniqueId: '',
					defaultStyle: 'not-allowed',
					resourceId: 2147483648,
					titles: [],
					descriptions: [{ value: '' }],
					categories: [{ type: '', priority: -1 }],
				},
			],
		};
		expect(validateSmartArtDefinitionHeaderList(list)).toStrictEqual([
			'headers[0].uniqueId is required',
			'headers[0].titles requires at least one title',
			'headers[0].descriptions[0].value is required',
			'headers[0].resourceId must be a signed 32-bit integer',
			'headers[0].categories[0].type is required',
			'headers[0].categories[0].priority must be an unsigned 32-bit integer',
			'headers[0].defaultStyle is only valid for layout headers',
		]);
	});

	it('creates a namespace-complete standalone header catalog', () => {
		const xml = builder.build(
			serializeSmartArtDefinitionHeaderList({
				kind: 'layout',
				headers: [
					{
						uniqueId: 'urn:new-layout',
						titles: [{ value: 'New' }],
						descriptions: [{ value: 'Created by SDK' }],
					},
				],
			}),
		);
		expect(xml).toContain(
			'<dgm:layoutDefHdrLst xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">',
		);
		expect(
			validateSmartArtDefinitionHeaderList(parseSmartArtDefinitionHeaderList(parser.parse(xml))),
		).toStrictEqual([]);
	});

	it('exposes the normative OPC metadata for each definition part', () => {
		expect(SMART_ART_DEFINITION_PARTS.layout).toMatchObject({
			contentType: 'application/vnd.openxmlformats-officedocument.drawingml.diagramLayout+xml',
			relationshipType:
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout',
			rootElement: 'layoutDef',
		});
		expect(SMART_ART_DEFINITION_PARTS.style.targetName).toBe('quickStyle');
		expect(SMART_ART_DEFINITION_PARTS.color.rootElement).toBe('colorsDef');
	});
});
