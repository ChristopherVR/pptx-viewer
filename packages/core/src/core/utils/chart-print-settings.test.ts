import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartPrintSettings, parseChartPrintSettings } from './chart-print-settings';

const localName = (key: string): string => key.split(':').at(-1)!.replace(/^@_/, '');

describe('chartML print settings', () => {
	it('parses all CT_PrintSettings members independently of namespace prefix', () => {
		const chartSpace: XmlObject = {
			'x:printSettings': {
				'@_vendor:flag': 'keep',
				'x:headerFooter': {
					'@_alignWithMargins': '0',
					'@_differentOddEven': 'true',
					'x:oddHeader': { '#text': '&LQuarterly' },
					'x:firstFooter': { '#text': 'First page' },
				},
				'x:pageMargins': {
					'@_l': '0.7',
					'@_r': '0.8',
					'@_t': '0.9',
					'@_b': '1',
					'@_header': '0.3',
					'@_footer': '0.4',
					'@_vendor:unit': 'in',
				},
				'x:pageSetup': {
					'@_paperSize': '9',
					'@_firstPageNumber': '2',
					'@_orientation': 'landscape',
					'@_blackAndWhite': '1',
					'@_draft': 'false',
					'@_useFirstPageNumber': '1',
					'@_horizontalDpi': '600',
					'@_verticalDpi': '300',
					'@_copies': '2',
				},
				'x:legacyDrawingHF': { '@_rel:id': 'rIdHeader' },
				'vendor:extension': { '@_value': 'untouched' },
			},
		};

		const parsed = parseChartPrintSettings(chartSpace, localName)!;
		expect(parsed.headerFooter).toMatchObject({
			oddHeader: '&LQuarterly',
			firstFooter: 'First page',
			alignWithMargins: false,
			differentOddEven: true,
		});
		expect(parsed.pageMargins).toMatchObject({
			left: 0.7,
			right: 0.8,
			top: 0.9,
			bottom: 1,
			header: 0.3,
			footer: 0.4,
		});
		expect(parsed.pageSetup).toMatchObject({
			paperSize: 9,
			firstPageNumber: 2,
			orientation: 'landscape',
			blackAndWhite: true,
			draft: false,
			useFirstPageNumber: true,
			horizontalDpi: 600,
			verticalDpi: 300,
			copies: 2,
		});
		expect(parsed.legacyDrawingHeaderFooterRelationshipId).toBe('rIdHeader');
		expect((parsed.rawXml as XmlObject)['vendor:extension']).toStrictEqual({
			'@_value': 'untouched',
		});

		parsed.headerFooter!.evenHeader = 'Even pages';
		applyChartPrintSettings(chartSpace, parsed, localName);
		const header = (chartSpace['x:printSettings'] as XmlObject)['x:headerFooter'] as XmlObject;
		expect(header['x:evenHeader']).toStrictEqual({ '#text': 'Even pages' });
		expect(Object.keys(header).some((key) => key.startsWith('c:'))).toBeFalsy();
	});

	it('applies edits in schema order while preserving foreign content', () => {
		const chartSpace: XmlObject = {
			'c:chart': {},
			'c:printSettings': {
				'c:pageSetup': { '@_orientation': 'portrait', '@_vendor:mode': 'keep' },
				'c:headerFooter': { 'c:oddHeader': { '#text': 'Old' }, '@_vendor:hf': 'keep' },
				'vendor:extension': { '#text': 'keep' },
			},
			'c:userShapes': { '@_r:id': 'rIdShapes' },
			'c:extLst': { 'c:ext': {} },
		};
		const parsed = parseChartPrintSettings(chartSpace, localName)!;
		parsed.headerFooter!.oddHeader = 'New';
		parsed.headerFooter!.evenFooter = 'Even';
		parsed.pageMargins = { left: 1, right: 2, top: 3, bottom: 4, header: 0.5, footer: 0.6 };
		parsed.pageSetup!.orientation = 'landscape';
		parsed.pageSetup!.copies = 4;

		applyChartPrintSettings(chartSpace, parsed, localName);
		const print = chartSpace['c:printSettings'] as XmlObject;
		expect(Object.keys(print).map(localName)).toStrictEqual([
			'headerFooter',
			'pageMargins',
			'pageSetup',
			'extension',
		]);
		expect((print['c:headerFooter'] as XmlObject)['@_vendor:hf']).toBe('keep');
		expect((print['c:pageSetup'] as XmlObject)['@_vendor:mode']).toBe('keep');
		expect((print['c:pageSetup'] as XmlObject)['@_copies']).toBe('4');
		expect(print['vendor:extension']).toStrictEqual({ '#text': 'keep' });
		expect(Object.keys(chartSpace).map(localName)).toStrictEqual([
			'chart',
			'printSettings',
			'userShapes',
			'extLst',
		]);
	});

	it('validates schema numeric ranges and enum values on serialization', () => {
		const chartSpace: XmlObject = {};
		expect(() =>
			applyChartPrintSettings(chartSpace, { pageSetup: { copies: -1 } }, localName),
		).toThrow(/copies/);
		expect(() =>
			applyChartPrintSettings(
				chartSpace,
				{
					pageSetup: { orientation: 'sideways' as 'portrait' },
				},
				localName,
			),
		).toThrow(/orientation/);
		expect(() =>
			applyChartPrintSettings(
				chartSpace,
				{
					pageMargins: { left: 1, right: 1, top: 1, bottom: 1, header: Number.NaN, footer: 1 },
				},
				localName,
			),
		).toThrow(/finite/);
	});

	it('removes the whole container explicitly', () => {
		const chartSpace: XmlObject = { 'z:printSettings': { 'z:pageSetup': {} }, 'z:extLst': {} };
		applyChartPrintSettings(chartSpace, null, localName);
		expect(chartSpace).toStrictEqual({ 'z:extLst': {} });
	});

	it('removes individual optional print children', () => {
		const chartSpace: XmlObject = {
			'c:printSettings': {
				'c:headerFooter': {},
				'c:legacyDrawingHF': { '@_r:id': 'rId1' },
			},
		};
		applyChartPrintSettings(
			chartSpace,
			{ headerFooter: null, legacyDrawingHeaderFooterRelationshipId: null },
			localName,
		);
		expect(chartSpace).toStrictEqual({ 'c:printSettings': {} });
	});
});
