import { describe, expect, it } from 'vitest';

import {
	parseEmbeddedFontList,
	serializeEmbeddedFontList,
	setEmbeddedFontList,
} from './embedded-font-list';

describe('embedded font list codec', () => {
	it('parses alternate prefixes and every embedded font variant', () => {
		const list = {
			'x:embeddedFont': {
				'x:font': { '@_typeface': 'Example', '@_panose': '020B0604020202020204' },
				'x:regular': { '@_r:id': 'rId10' },
				'x:bold': { '@_r:id': 'rId11' },
				'x:italic': { '@_r:id': 'rId12' },
				'x:boldItalic': { '@_r:id': 'rId13' },
			},
		};
		const parsed = parseEmbeddedFontList({
			'x:presentation': { 'x:embeddedFontLst': list },
		});

		expect(parsed?.fonts[0]).toMatchObject({
			font: { typeface: 'Example', panose: '020B0604020202020204' },
			regular: { relationshipId: 'rId10' },
			bold: { relationshipId: 'rId11' },
			italic: { relationshipId: 'rId12' },
			boldItalic: { relationshipId: 'rId13' },
		});
		expect(parsed?.rawXml).toBe(list);
	});

	it('edits and removes variants while retaining unknown XML in schema order', () => {
		const rawEntry = {
			'@_vendor': 'keep',
			'x:font': { '@_typeface': 'Old', '@_charset': '1', '@_vendor': 'font' },
			'x:regular': { '@_r:id': 'rId1', '@_vendor': 'variant' },
			'x:italic': { '@_r:id': 'rId2' },
			'x:future': { '@_val': 'keep' },
		};
		const serialized = serializeEmbeddedFontList({
			fonts: [
				{
					font: { typeface: 'New', charset: null, rawXml: rawEntry['x:font'] },
					regular: { relationshipId: 'rId3', rawXml: rawEntry['x:regular'] },
					bold: { relationshipId: 'rId4' },
					italic: null,
					rawXml: rawEntry,
				},
			],
			rawXml: { '@_vendor:list': 'keep', 'x:embeddedFont': rawEntry },
		});
		const entry = serialized['x:embeddedFont'] as unknown[];

		expect(Object.keys(entry[0] as object)).toStrictEqual([
			'@_vendor',
			'x:font',
			'x:regular',
			'p:bold',
			'x:future',
		]);
		expect(entry[0]).toMatchObject({
			'x:font': { '@_typeface': 'New', '@_vendor': 'font' },
			'x:regular': { '@_r:id': 'rId3', '@_vendor': 'variant' },
			'p:bold': { '@_r:id': 'rId4' },
			'x:future': { '@_val': 'keep' },
		});
		expect(serialized['@_vendor:list']).toBe('keep');
	});

	it('validates required entries, typefaces, and relationship identifiers', () => {
		expect(() => serializeEmbeddedFontList({ fonts: [] })).toThrow('at least one');
		expect(() =>
			serializeEmbeddedFontList({ fonts: [{ font: {}, regular: { relationshipId: 'rId1' } }] }),
		).toThrow('typeface');
		expect(() =>
			serializeEmbeddedFontList({
				fonts: [{ font: { typeface: 'Example' }, regular: { relationshipId: '' } }],
			}),
		).toThrow('non-empty r:id');
	});

	it('inserts the list at the CT_Presentation schema position and removes it', () => {
		const data = {
			'p:presentation': {
				'@_xmlns:p': 'urn:p',
				'p:notesSz': {},
				'p:custShowLst': {},
			},
		};
		setEmbeddedFontList(data, { 'p:embeddedFont': {} });
		expect(Object.keys(data['p:presentation'])).toStrictEqual([
			'@_xmlns:p',
			'p:notesSz',
			'p:embeddedFontLst',
			'p:custShowLst',
		]);
		setEmbeddedFontList(data, null);
		expect(data['p:presentation']).not.toHaveProperty('p:embeddedFontLst');
	});
});
