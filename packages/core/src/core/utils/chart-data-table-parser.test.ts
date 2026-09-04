import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseDataTable } from './chart-data-table-parser';

/**
 * Build a simple XML lookup that stores children as direct properties
 * using the local name as key (matching the real interface).
 */
function createXmlLookup() {
	return {
		getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined {
			if (!parent) {
				return undefined;
			}
			for (const prefix of ['c:', 'a:', '']) {
				const key = `${prefix}${name}`;
				if (parent[key] !== undefined) {
					return parent[key] as XmlObject;
				}
			}
			return undefined;
		},
		getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[] {
			if (!parent) {
				return [];
			}
			for (const prefix of ['c:', 'a:', '']) {
				const child = parent[`${prefix}${name}`];
				if (child !== undefined) {
					return Array.isArray(child) ? child : [child as XmlObject];
				}
			}
			return [];
		},
	};
}

function createColorParser() {
	return {
		parseColor(fillNode: XmlObject | undefined): string | undefined {
			if (!fillNode) {
				return undefined;
			}
			const srgb = fillNode['a:srgbClr'] as XmlObject | undefined;
			return srgb ? `#${srgb['@_val']}` : undefined;
		},
	};
}

const xmlLookup = createXmlLookup();
const colorParser = createColorParser();

describe('parseDataTable', () => {
	it('returns undefined when no dTable exists', () => {
		expect(parseDataTable({}, xmlLookup)).toBeUndefined();
	});

	it('parses data table with all borders and keys shown', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:showHorzBorder': { '@_val': '1' },
				'c:showVertBorder': { '@_val': '1' },
				'c:showOutline': { '@_val': '1' },
				'c:showKeys': { '@_val': '1' },
			},
		};
		expect(parseDataTable(plotArea, xmlLookup)).toStrictEqual({
			showHorzBorder: true,
			showVertBorder: true,
			showOutline: true,
			showKeys: true,
		});
	});

	it('returns an empty model when dTable exists but has no properties', () => {
		expect(parseDataTable({ 'c:dTable': {} }, xmlLookup)).toStrictEqual({});
	});

	it('parses partial data table properties', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:showHorzBorder': { '@_val': '1' },
				'c:showKeys': { '@_val': '1' },
			},
		};
		const result = parseDataTable(plotArea, xmlLookup);
		expect(result!.showHorzBorder).toBeTruthy();
		expect(result!.showKeys).toBeTruthy();
	});

	it('accepts all xsd:boolean lexical forms and the default true attribute value', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:showHorzBorder': { '@_val': 'false' },
				'c:showVertBorder': { '@_val': '0' },
				'c:showOutline': { '@_val': 'true' },
				'c:showKeys': {},
			},
		};
		expect(parseDataTable(plotArea, xmlLookup)).toStrictEqual({
			showHorzBorder: false,
			showVertBorder: false,
			showOutline: true,
			showKeys: true,
		});
	});

	it('does not coerce an invalid CT_Boolean lexical value', () => {
		const plotArea: XmlObject = { 'c:dTable': { 'c:showKeys': { '@_val': 'yes' } } };
		expect(parseDataTable(plotArea, xmlLookup)).toStrictEqual({});
	});

	it('does not parse spPr/txPr when no colour parser is supplied', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:spPr': {
					'a:ln': { '@_w': '12700', 'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } } },
				},
				'c:txPr': { 'a:p': { 'a:pPr': { 'a:defRPr': { '@_sz': '1200' } } } },
			},
		};
		expect(parseDataTable(plotArea, xmlLookup)).toStrictEqual({});
	});

	it('parses spPr border colour/width when a colour parser is supplied', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:spPr': {
					'a:ln': {
						'@_w': '12700',
						'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
					},
				},
			},
		};
		const result = parseDataTable(plotArea, xmlLookup, colorParser);
		expect(result?.spPr).toStrictEqual({ strokeColor: '#FF0000', strokeWidth: 1 });
	});

	it('parses spPr fill colour', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'EEEEEE' } } },
			},
		};
		const result = parseDataTable(plotArea, xmlLookup, colorParser);
		expect(result?.spPr).toStrictEqual({ fillColor: '#EEEEEE' });
	});

	it('parses txPr cell-text defaults (size/bold/italic/font/colour)', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:txPr': {
					'a:p': {
						'a:pPr': {
							'a:defRPr': {
								'@_sz': '900',
								'@_b': '1',
								'@_i': '1',
								'a:latin': { '@_typeface': 'Calibri' },
								'a:solidFill': { 'a:srgbClr': { '@_val': '334455' } },
							},
						},
					},
				},
			},
		};
		const result = parseDataTable(plotArea, xmlLookup, colorParser);
		expect(result?.txPr).toStrictEqual({
			fontSize: 9,
			bold: true,
			italic: true,
			fontFamily: 'Calibri',
			color: '#334455',
		});
	});

	it('resolves a theme-font placeholder typeface (+mn-lt) via resolveTypeface', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:txPr': {
					'a:p': { 'a:pPr': { 'a:defRPr': { 'a:latin': { '@_typeface': '+mn-lt' } } } },
				},
			},
		};
		const resolveTypeface = (raw: string) => (raw === '+mn-lt' ? 'Bahnschrift' : raw);
		const result = parseDataTable(plotArea, xmlLookup, colorParser, resolveTypeface);
		expect(result?.txPr).toStrictEqual({ fontFamily: 'Bahnschrift' });
	});

	it('omits txPr when the defRPr carries none of the recognised attributes', () => {
		const plotArea: XmlObject = {
			'c:dTable': { 'c:txPr': { 'a:p': { 'a:pPr': { 'a:defRPr': {} } } } },
		};
		const result = parseDataTable(plotArea, xmlLookup, colorParser);
		expect(result?.txPr).toBeUndefined();
	});
});
