import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartProtection, parseChartProtection } from './chart-protection';
import { buildChartSpaceXml } from './chart-xml-generator';

const localName = (key: string): string => key.replace(/^.*:/u, '');

describe('classic ChartML protection', () => {
	it('parses prefixed CT_Boolean values and the omitted-val true default', () => {
		const chartSpace: XmlObject = {
			'x:protection': {
				'x:chartObject': {},
				'x:data': { '@_val': 'false' },
				'x:formatting': { '@_val': '0' },
				'x:selection': { '@_val': 'true' },
				'x:userInterface': { '@_val': '1' },
			},
		};

		const parsed = parseChartProtection(chartSpace, localName);

		expect(parsed).toMatchObject({
			chartObject: true,
			data: false,
			formatting: false,
			selection: true,
			userInterface: true,
		});
	});

	it('preserves invalid lexical values as raw XML instead of inventing a typed value', () => {
		const parsed = parseChartProtection(
			{ 'c:protection': { 'c:data': { '@_val': 'TRUE', '@_vendor': 'kept' } } },
			localName,
		)!;

		expect(parsed.data).toBeUndefined();
		expect(parsed.rawXml).toStrictEqual({
			'c:data': { '@_val': 'TRUE', '@_vendor': 'kept' },
		});
	});

	it('edits and orders known children while preserving foreign markup', () => {
		const chartSpace: XmlObject = {
			'x:protection': {
				'@_vendor': 'root',
				'x:userInterface': { '@_val': '0' },
				'v:future': { '@_mode': 'keep' },
				'x:data': { '@_val': '1', '@_vendor': 'leaf', 'v:detail': {} },
			},
			'x:chart': {},
		};
		const parsed = parseChartProtection(chartSpace, localName)!;
		parsed.chartObject = true;
		parsed.data = false;
		parsed.formatting = true;

		applyChartProtection(chartSpace, parsed, localName);

		const protection = chartSpace['x:protection'] as XmlObject;
		expect(Object.keys(protection).map(localName)).toStrictEqual([
			'@_vendor',
			'chartObject',
			'data',
			'formatting',
			'userInterface',
			'future',
		]);
		expect(protection['x:data']).toStrictEqual({
			'@_val': '0',
			'@_vendor': 'leaf',
			'v:detail': {},
		});
		expect(protection['v:future']).toStrictEqual({ '@_mode': 'keep' });
	});

	it('removes individual settings and the protection container explicitly', () => {
		const chartSpace: XmlObject = {
			'c:protection': { 'c:chartObject': {}, 'c:data': { '@_val': '0' } },
			'c:chart': {},
		};
		applyChartProtection(chartSpace, { chartObject: null }, localName);
		expect(chartSpace['c:protection']).toStrictEqual({ 'c:data': { '@_val': '0' } });

		applyChartProtection(chartSpace, null, localName);
		expect(chartSpace).toStrictEqual({ 'c:chart': {} });
	});

	it('does not parse or emit classic protection in a cx chart space', () => {
		const chartSpace: XmlObject = {
			'@_xmlns:cx': 'http://schemas.microsoft.com/office/drawing/2014/chartex',
			'cx:chart': {},
		};
		expect(parseChartProtection(chartSpace, localName)).toBeUndefined();

		applyChartProtection(chartSpace, { data: true }, localName);
		expect(chartSpace).toStrictEqual({
			'@_xmlns:cx': 'http://schemas.microsoft.com/office/drawing/2014/chartex',
			'cx:chart': {},
		});
	});

	it('inserts protection before chart when generating a new chart part', () => {
		const tree = buildChartSpaceXml({
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
			protection: { chartObject: true, selection: false },
		});
		const chartSpace = tree['c:chartSpace'] as XmlObject;

		expect(Object.keys(chartSpace).map(localName)).toStrictEqual([
			'c',
			'a',
			'r',
			'protection',
			'chart',
		]);
		expect(chartSpace['c:protection']).toStrictEqual({
			'c:chartObject': { '@_val': '1' },
			'c:selection': { '@_val': '0' },
		});
	});
});
