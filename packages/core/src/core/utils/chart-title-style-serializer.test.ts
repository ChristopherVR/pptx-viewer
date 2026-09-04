import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartTitleStyleToXml } from './chart-title-style-serializer';

const getLocalName = (key: string) => key.replace(/^[^:]+:/u, '');

function chartWithTitle(): XmlObject {
	return {
		'c:plotArea': {},
		'c:title': {
			'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': 'Revenue' } } } },
			'c:overlay': { '@_val': '0' },
		},
	};
}

describe('applyChartTitleStyleToXml', () => {
	it('writes font family/size/bold/colour into a rich title body (defRPr and every run rPr)', () => {
		const chart = chartWithTitle();
		applyChartTitleStyleToXml(
			chart,
			{ fontFamily: 'Calibri', fontSize: 18, fontBold: true, fontColor: '#FF0000' },
			getLocalName,
		);
		const title = chart['c:title'] as XmlObject;
		// PowerPoint renders a typed title from its rich body, so the edit must
		// land there: c:txPr would be ignored by PowerPoint.
		expect(title['c:txPr']).toBeUndefined();
		const p = ((title['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] as XmlObject;
		const defRPr = (p['a:pPr'] as XmlObject)['a:defRPr'] as XmlObject;
		const rPr = (p['a:r'] as XmlObject)['a:rPr'] as XmlObject;
		for (const props of [defRPr, rPr]) {
			expect(props['@_sz']).toBe('1800');
			expect(props['@_b']).toBe('1');
			expect((props['a:latin'] as XmlObject)['@_typeface']).toBe('Calibri');
			expect(((props['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe(
				'FF0000',
			);
		}
		expect((p['a:r'] as XmlObject)['a:t']).toBe('Revenue');
	});

	it('writes font family/size/bold/colour into the title txPr defRPr when there is no rich body', () => {
		const chart: XmlObject = {
			'c:plotArea': {},
			'c:title': { 'c:overlay': { '@_val': '0' } },
		};
		applyChartTitleStyleToXml(
			chart,
			{
				fontFamily: 'Calibri',
				fontSize: 18,
				fontBold: true,
				fontColor: '#FF0000',
			},
			getLocalName,
		);
		const title = chart['c:title'] as XmlObject;
		const txPr = title['c:txPr'] as XmlObject;
		const p = txPr['a:p'] as XmlObject;
		const defRPr = (p['a:pPr'] as XmlObject)['a:defRPr'] as XmlObject;
		expect(defRPr['@_sz']).toBe('1800');
		expect(defRPr['@_b']).toBe('1');
		expect((defRPr['a:latin'] as XmlObject)['@_typeface']).toBe('Calibri');
		const fill = defRPr['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('FF0000');
		// CT_Title order: tx, layout, overlay, spPr, txPr, extLst.
		expect(Object.keys(title).map(getLocalName)).toStrictEqual(['overlay', 'txPr']);
	});

	it('writes a solid fill / border into the title spPr', () => {
		const chart = chartWithTitle();
		applyChartTitleStyleToXml(
			chart,
			{ spPr: { fillColor: '#334455', strokeColor: '#000000', strokeWidth: 1 } },
			getLocalName,
		);
		const title = chart['c:title'] as XmlObject;
		const spPr = title['c:spPr'] as XmlObject;
		expect((spPr['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual({ '@_val': '334455' });
		expect((spPr['a:ln'] as XmlObject)['@_w']).toBe('12700');
	});

	it('removes an existing spPr when spPr is explicitly null', () => {
		const chart = chartWithTitle();
		(chart['c:title'] as XmlObject)['c:spPr'] = { 'a:noFill': {} };
		applyChartTitleStyleToXml(chart, { spPr: null }, getLocalName);
		expect((chart['c:title'] as XmlObject)['c:spPr']).toBeUndefined();
	});

	it('reassigning an existing txPr preserves its position among the title children', () => {
		const chart: XmlObject = {
			'c:title': {
				'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': 'Revenue' } } } },
				'c:txPr': { 'a:p': { 'a:pPr': { 'a:defRPr': { '@_sz': '1000' } } } },
				'c:overlay': { '@_val': '0' },
			},
		};
		applyChartTitleStyleToXml(chart, { fontSize: 14 }, getLocalName);
		const title = chart['c:title'] as XmlObject;
		expect(Object.keys(title).map(getLocalName)).toStrictEqual(['tx', 'txPr', 'overlay']);
	});

	it('no-ops when no style fields are provided', () => {
		const chart = chartWithTitle();
		const before = JSON.stringify(chart);
		applyChartTitleStyleToXml(chart, {}, getLocalName);
		expect(JSON.stringify(chart)).toBe(before);
	});

	it('no-ops when the chart has no title', () => {
		const chart: XmlObject = { 'c:plotArea': {} };
		applyChartTitleStyleToXml(chart, { fontSize: 10 }, getLocalName);
		expect(chart['c:title']).toBeUndefined();
	});
});
