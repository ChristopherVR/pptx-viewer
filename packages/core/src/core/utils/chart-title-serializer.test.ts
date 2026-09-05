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

	describe('titleRuns (multi-run rich text)', () => {
		it('writes one run per titleRuns entry, each with its own rPr', () => {
			const chart = chartWithoutTitle();
			applyChartTitleToXml(
				chart,
				{
					// `title` matches `titleRuns[0].text`, the flat first-run-only
					// convention the parser always produces.
					title: 'Bold',
					titleRuns: [
						{ text: 'Bold', bold: true, color: '#FF0000', fontSize: 18 },
						{ text: 'Plain' },
					],
				},
				local,
			);
			const rich = (((chart['c:title'] as XmlObject)['c:tx'] as XmlObject)['c:rich'] as XmlObject)[
				'a:p'
			] as XmlObject;
			const runs = rich['a:r'] as XmlObject[];
			expect(runs).toHaveLength(2);
			expect(runs[0]).toStrictEqual({
				'a:rPr': {
					'@_b': '1',
					'@_sz': '1800',
					'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
				},
				'a:t': 'Bold',
			});
			expect(runs[1]).toStrictEqual({ 'a:t': 'Plain' });
		});

		it('replaces an existing rich body wholesale rather than patching only the first run', () => {
			const chart: XmlObject = {
				'c:title': {
					'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': 'Old' } } } },
					'c:overlay': { '@_val': '0' },
				},
				'c:autoTitleDeleted': { '@_val': '0' },
				'c:plotArea': {},
			};
			applyChartTitleToXml(chart, { title: 'A', titleRuns: [{ text: 'A' }, { text: 'B' }] }, local);
			const rich = (((chart['c:title'] as XmlObject)['c:tx'] as XmlObject)['c:rich'] as XmlObject)[
				'a:p'
			] as XmlObject;
			expect(rich['a:r']).toStrictEqual([{ 'a:t': 'A' }, { 'a:t': 'B' }]);
		});

		it('ignores titleRuns for a ChartEx (cx) title', () => {
			const chart: XmlObject = { 'cx:plotArea': {} };
			applyChartTitleToXml(
				chart,
				{ title: 'Funnel', titleRuns: [{ text: 'Fun' }, { text: 'nel' }] },
				local,
				{ prefix: 'cx' },
			);
			expect(chart['cx:title']).toStrictEqual({
				'cx:tx': { 'cx:rich': { 'a:p': { 'a:r': { 'a:t': 'Funnel' } } } },
			});
		});

		it('leaves an untouched title (matching run texts) byte-structurally alone, preserving a:schemeClr', () => {
			// Regression: rebuilding from PptxChartTitleRun's narrow shape always
			// emits a literal a:srgbClr, which would silently downgrade an
			// authored theme colour on every save even when nothing changed.
			const chart: XmlObject = {
				'c:title': {
					'c:tx': {
						'c:rich': {
							'a:p': {
								'a:r': [
									{
										'a:rPr': { 'a:solidFill': { 'a:schemeClr': { '@_val': 'accent2' } } },
										'a:t': 'Q4',
									},
									{ 'a:t': ' Sales' },
								],
							},
						},
					},
					'c:overlay': { '@_val': '0' },
				},
				'c:autoTitleDeleted': { '@_val': '0' },
				'c:plotArea': {},
			};
			const before = JSON.stringify(chart['c:title']);
			applyChartTitleToXml(
				chart,
				{ title: 'Q4', titleRuns: [{ text: 'Q4' }, { text: ' Sales' }] },
				local,
			);
			expect(JSON.stringify(chart['c:title'])).toBe(before);
		});

		it('falls back to the flat title when it has diverged from the (stale) titleRuns text', () => {
			// Simulates a caller that edited `title` directly without touching
			// `titleRuns`, the exact shape every pre-existing chart-title
			// consumer's edit takes: the stale runs must NOT win.
			const chart: XmlObject = {
				'c:title': {
					'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': 'Before' } } } },
					'c:overlay': { '@_val': '0' },
				},
				'c:autoTitleDeleted': { '@_val': '0' },
				'c:plotArea': {},
			};
			applyChartTitleToXml(chart, { title: 'After', titleRuns: [{ text: 'Before' }] }, local);
			const rich = (((chart['c:title'] as XmlObject)['c:tx'] as XmlObject)['c:rich'] as XmlObject)[
				'a:p'
			] as XmlObject;
			expect(rich['a:r']).toStrictEqual({ 'a:t': 'After' });
		});
	});
});
