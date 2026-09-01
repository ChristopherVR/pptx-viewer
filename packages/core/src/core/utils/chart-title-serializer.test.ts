import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartTitleToXml } from './chart-title-serializer';

const local = (key: string) => key.replace(/^[^:]+:/u, '');

function chartWithoutTitle(): XmlObject {
	return {
		'c:autoTitleDeleted': { '@_val': '1' },
		'c:plotArea': { 'c:barChart': {} },
		'c:legend': { 'c:legendPos': { '@_val': 'r' } },
	};
}

describe('applyChartTitleToXml', () => {
	it('inserts a c:title first and flips autoTitleDeleted to 0 when a title is added', () => {
		const chart = chartWithoutTitle();
		expect(applyChartTitleToXml(chart, { title: 'Hello' }, local)).toBeTruthy();
		expect(Object.keys(chart)).toStrictEqual([
			'c:title',
			'c:autoTitleDeleted',
			'c:plotArea',
			'c:legend',
		]);
		expect(chart['c:title']).toStrictEqual({
			'c:tx': {
				'c:rich': {
					'a:bodyPr': {},
					'a:lstStyle': {},
					'a:p': { 'a:r': { 'a:t': 'Hello' } },
				},
			},
			'c:overlay': { '@_val': '0' },
		});
		expect(chart['c:autoTitleDeleted']).toStrictEqual({ '@_val': '0' });
	});

	it('inserts autoTitleDeleted right after the title when the chart had neither', () => {
		const chart: XmlObject = { 'c:plotArea': {} };
		applyChartTitleToXml(chart, { title: 'T' }, local);
		expect(Object.keys(chart)).toStrictEqual(['c:title', 'c:autoTitleDeleted', 'c:plotArea']);
	});

	it('rewrites the first run of an existing title, keeping its other children', () => {
		const chart: XmlObject = {
			'c:title': {
				'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'Old' } } } },
				'c:layout': {},
				'c:overlay': { '@_val': '1' },
			},
			'c:autoTitleDeleted': { '@_val': '0' },
			'c:plotArea': {},
		};
		applyChartTitleToXml(chart, { title: 'New', hasTitle: true }, local);
		const title = chart['c:title'] as XmlObject;
		expect(JSON.stringify(title)).toContain('"a:t":"New"');
		expect(title['c:layout']).toStrictEqual({});
		expect(title['c:overlay']).toStrictEqual({ '@_val': '1' });
	});

	it('gives an auto title (no tx) explicit text', () => {
		const chart: XmlObject = {
			'c:title': { 'c:overlay': { '@_val': '0' } },
			'c:plotArea': {},
		};
		applyChartTitleToXml(chart, { title: 'Explicit' }, local);
		expect(Object.keys(chart['c:title'] as XmlObject)).toStrictEqual(['c:tx', 'c:overlay']);
	});

	it('removes the title and sets autoTitleDeleted=1 when hasTitle is false', () => {
		const chart: XmlObject = {
			'c:title': { 'c:tx': {} },
			'c:autoTitleDeleted': { '@_val': '0' },
			'c:plotArea': {},
		};
		expect(applyChartTitleToXml(chart, { title: 'x', hasTitle: false }, local)).toBeFalsy();
		expect(chart['c:title']).toBeUndefined();
		expect(chart['c:autoTitleDeleted']).toStrictEqual({ '@_val': '1' });
	});

	it('treats an empty title without an explicit hasTitle as removal', () => {
		const chart: XmlObject = { 'c:title': { 'c:tx': {} }, 'c:plotArea': {} };
		applyChartTitleToXml(chart, { title: '' }, local);
		expect(chart['c:title']).toBeUndefined();
		expect(Object.keys(chart)).toStrictEqual(['c:autoTitleDeleted', 'c:plotArea']);
	});

	it('leaves the tree untouched when the model says nothing about the title', () => {
		const chart = chartWithoutTitle();
		const before = JSON.stringify(chart);
		applyChartTitleToXml(chart, {}, local);
		expect(JSON.stringify(chart)).toBe(before);
	});

	it('writes a ChartEx title without the 2006-only children', () => {
		const chart: XmlObject = { 'cx:plotArea': {} };
		applyChartTitleToXml(chart, { title: 'Funnel' }, local, { prefix: 'cx' });
		expect(Object.keys(chart)).toStrictEqual(['cx:title', 'cx:plotArea']);
		expect(chart['cx:title']).toStrictEqual({
			'cx:tx': { 'cx:rich': { 'a:p': { 'a:r': { 'a:t': 'Funnel' } } } },
		});
	});

	it('handles namespace-stripped keys and xml:space text nodes', () => {
		const chart: XmlObject = {
			title: { tx: { rich: { p: { r: { t: { '#text': 'Old', '@_xml:space': 'preserve' } } } } } },
			plotArea: {},
		};
		applyChartTitleToXml(chart, { title: 'New' }, local);
		const run = (
			(((chart['title'] as XmlObject)['tx'] as XmlObject)['rich'] as XmlObject)['p'] as XmlObject
		)['r'] as XmlObject;
		expect(run['t']).toStrictEqual({ '#text': 'New', '@_xml:space': 'preserve' });
	});
});
