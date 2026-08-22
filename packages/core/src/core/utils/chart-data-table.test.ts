import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartDataTable } from './chart-data-table';

const localName = (key: string) => key.replace(/^.*:/u, '');

describe('applyChartDataTable', () => {
	it('does not change source XML for an undefined model value', () => {
		const plotArea: XmlObject = {
			'c:dTable': { 'c:showKeys': { '@_val': '1' }, 'c:extLst': { marker: true } },
		};
		const before = structuredClone(plotArea);
		applyChartDataTable(plotArea, undefined, localName);
		expect(plotArea).toStrictEqual(before);
	});

	it('creates all flags in CT_DTable schema order and writes false explicitly', () => {
		const plotArea: XmlObject = {
			'c:barChart': {},
			'c:catAx': {},
			'c:valAx': {},
			'c:spPr': {},
			'c:extLst': {},
		};
		applyChartDataTable(
			plotArea,
			{
				showHorzBorder: true,
				showVertBorder: false,
				showOutline: true,
				showKeys: false,
			},
			localName,
		);
		const table = plotArea['c:dTable'] as XmlObject;
		expect(Object.keys(table)).toStrictEqual([
			'c:showHorzBorder',
			'c:showVertBorder',
			'c:showOutline',
			'c:showKeys',
		]);
		expect(table['c:showVertBorder']).toStrictEqual({ '@_val': '0' });
		const plotNames = Object.keys(plotArea).map(localName);
		expect(plotNames.indexOf('dTable')).toBeGreaterThan(plotNames.indexOf('valAx'));
		expect(plotNames.indexOf('dTable')).toBeLessThan(plotNames.indexOf('spPr'));
	});

	it('patches dirty source XML while preserving styling, extensions, and unknown children', () => {
		const plotArea: XmlObject = {
			'x:dTable': {
				'x:showKeys': { '@_val': '0' },
				'a:spPr': { 'a:solidFill': { 'a:schemeClr': { '@_val': 'accent1' } } },
				'a:txPr': { marker: 'text-style' },
				'x:futureOption': { '@_val': 'keep' },
				'x:extLst': { marker: 'extension' },
			},
		};
		applyChartDataTable(plotArea, { showKeys: true, showOutline: false }, localName);
		const table = plotArea['x:dTable'] as XmlObject;
		expect(table['x:showKeys']).toStrictEqual({ '@_val': '1' });
		expect(table['c:showOutline']).toStrictEqual({ '@_val': '0' });
		expect(table['a:spPr']).toBeDefined();
		expect(table['a:txPr']).toStrictEqual({ marker: 'text-style' });
		expect(table['x:futureOption']).toStrictEqual({ '@_val': 'keep' });
		expect(table['x:extLst']).toStrictEqual({ marker: 'extension' });
		const names = Object.keys(table).map(localName);
		expect(names.indexOf('showOutline')).toBeLessThan(names.indexOf('spPr'));
	});

	it('removes an existing table when explicitly set to null', () => {
		const plotArea: XmlObject = { 'c:dTable': { 'c:showKeys': { '@_val': '1' } } };
		applyChartDataTable(plotArea, null, localName);
		expect(plotArea['c:dTable']).toBeUndefined();
	});

	it('writes spPr fill and stroke onto a fresh table', () => {
		const plotArea: XmlObject = {};
		applyChartDataTable(
			plotArea,
			{ showKeys: true, spPr: { fillColor: '#112233', strokeColor: '#445566', strokeWidth: 1.5 } },
			localName,
		);
		const table = plotArea['c:dTable'] as XmlObject;
		const spPr = table['c:spPr'] as XmlObject;
		expect(spPr['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': '112233' } });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe('19050');
		expect(ln['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': '445566' } });
		const names = Object.keys(table).map(localName);
		expect(names.indexOf('showKeys')).toBeLessThan(names.indexOf('spPr'));
	});

	it('merges spPr fields into an authored node without clobbering unmodelled children', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:spPr': {
					'a:xfrm': { marker: 'preserved' },
					'a:solidFill': { 'a:srgbClr': { '@_val': 'AAAAAA' } },
				},
			},
		};
		applyChartDataTable(plotArea, { spPr: { strokeColor: '#000000', strokeWidth: 1 } }, localName);
		const spPr = (plotArea['c:dTable'] as XmlObject)['c:spPr'] as XmlObject;
		expect(spPr['a:xfrm']).toStrictEqual({ marker: 'preserved' });
		expect(spPr['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': 'AAAAAA' } });
		expect((spPr['a:ln'] as XmlObject)['a:solidFill']).toStrictEqual({
			'a:srgbClr': { '@_val': '000000' },
		});
	});

	it('writes txPr defRPr text styling onto a fresh table', () => {
		const plotArea: XmlObject = {};
		applyChartDataTable(
			plotArea,
			{ txPr: { fontSize: 12, bold: true, color: '#FF0000', fontFamily: 'Calibri' } },
			localName,
		);
		const table = plotArea['c:dTable'] as XmlObject;
		const txPr = table['c:txPr'] as XmlObject;
		const defRPr = ((txPr['a:p'] as XmlObject)['a:pPr'] as XmlObject)['a:defRPr'] as XmlObject;
		expect(defRPr['@_sz']).toBe('1200');
		expect(defRPr['@_b']).toBe('1');
		expect(defRPr['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
		expect((defRPr['a:latin'] as XmlObject)['@_typeface']).toBe('Calibri');
	});

	it('does not touch spPr or txPr when the model omits them', () => {
		const plotArea: XmlObject = {
			'c:dTable': {
				'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'AAAAAA' } } },
				'c:txPr': { marker: 'unchanged' },
			},
		};
		const before = structuredClone(plotArea);
		applyChartDataTable(plotArea, { showKeys: true }, localName);
		expect((plotArea['c:dTable'] as XmlObject)['c:spPr']).toStrictEqual(
			(before['c:dTable'] as XmlObject)['c:spPr'],
		);
		expect((plotArea['c:dTable'] as XmlObject)['c:txPr']).toStrictEqual(
			(before['c:dTable'] as XmlObject)['c:txPr'],
		);
	});
});
