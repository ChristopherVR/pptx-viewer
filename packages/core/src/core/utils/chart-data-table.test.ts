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
});
