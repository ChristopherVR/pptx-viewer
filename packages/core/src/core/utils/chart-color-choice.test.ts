import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartAxisDisplayUnitsToXml } from './chart-axis-dispunits-serializer';
import { applyChartAxisTitleStyleToXml } from './chart-axis-title-serializer';
import { applySeriesDataPointsToXml } from './chart-datapoint-serializer';
import { applySeriesErrBarsToXml } from './chart-errbars-serializer';
import { applyChartLegendToXml } from './chart-legend-serializer';
import { applySeriesMarkerToXml } from './chart-marker-serializer';
import { applySeriesTrendlinesToXml } from './chart-trendline-serializer';
import { applyChartUpDownBars } from './chart-up-down-bars';

/**
 * Every per-feature chart serializer must keep an authored theme colour.
 *
 * `PptxChartData` carries RESOLVED hex values, so writing one back
 * unconditionally replaced `<a:schemeClr val="accent1"><a:lumMod val="75000"/>`
 * with `<a:srgbClr val="0C7E81"/>` and cut the chart off from the theme. On
 * `issue-132-hr-deck.pptx` that was five literals per chart, on three charts
 * nobody had touched.
 *
 * These drive the REAL serializers. Each is asserted in BOTH directions: the
 * authored node survives when the model still holds the colour it resolves to,
 * and is replaced the moment the model says something else.
 */

const local = (key: string): string => key.replace(/^.*:/u, '');

/** The authored node and the colour it resolves to through the theme. */
const THEMED: XmlObject = {
	'a:schemeClr': { '@_val': 'accent1', 'a:lumMod': { '@_val': '75000' } },
};
const RESOLVED = '#0C7E81';
const resolveColor = (node: XmlObject): string | undefined =>
	node['a:schemeClr'] !== undefined ? RESOLVED : undefined;

/** The colour choice sitting inside `node`, as a tag name. */
function choiceOf(node: XmlObject | undefined): string | undefined {
	return node ? Object.keys(node).find((key) => key.endsWith('Clr')) : undefined;
}

describe('chart serializers preserve an authored theme colour', () => {
	it('data point: keeps a:schemeClr, and replaces it on an edit', () => {
		const series = (): XmlObject => ({
			'c:dPt': { 'c:idx': { '@_val': '0' }, 'c:spPr': { 'a:solidFill': { ...THEMED } } },
		});
		const kept = series();
		applySeriesDataPointsToXml(
			kept,
			[{ idx: 0, spPr: { fillColor: RESOLVED } }],
			local,
			resolveColor,
		);
		expect(choiceOf((kept['c:dPt'] as XmlObject)['c:spPr'] as XmlObject)).toBeUndefined();
		expect(
			choiceOf(((kept['c:dPt'] as XmlObject)['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject),
		).toBe('a:schemeClr');

		const edited = series();
		applySeriesDataPointsToXml(
			edited,
			[{ idx: 0, spPr: { fillColor: '#FF0000' } }],
			local,
			resolveColor,
		);
		expect(
			choiceOf(((edited['c:dPt'] as XmlObject)['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject),
		).toBe('a:srgbClr');
	});

	it('marker: keeps a:schemeClr on fill and line', () => {
		const series: XmlObject = {
			'c:marker': {
				'c:symbol': { '@_val': 'circle' },
				'c:spPr': { 'a:solidFill': { ...THEMED }, 'a:ln': { 'a:solidFill': { ...THEMED } } },
			},
		};
		applySeriesMarkerToXml(
			series,
			{ symbol: 'circle', spPr: { fillColor: RESOLVED, strokeColor: RESOLVED } },
			local,
			resolveColor,
		);
		const spPr = (series['c:marker'] as XmlObject)['c:spPr'] as XmlObject;
		expect(choiceOf(spPr['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
		expect(choiceOf((spPr['a:ln'] as XmlObject)['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
	});

	it('trendline: keeps a:schemeClr on the line', () => {
		const series: XmlObject = {
			'c:trendline': { 'c:spPr': { 'a:ln': { 'a:solidFill': { ...THEMED } } } },
		};
		applySeriesTrendlinesToXml(
			series,
			[{ trendlineType: 'linear', color: RESOLVED }],
			local,
			resolveColor,
		);
		const ln = ((series['c:trendline'] as XmlObject)['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(choiceOf(ln['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
	});

	it('error bars: keeps a:schemeClr on the line', () => {
		const series: XmlObject = {
			'c:errBars': { 'c:spPr': { 'a:ln': { 'a:solidFill': { ...THEMED } } } },
		};
		applySeriesErrBarsToXml(
			series,
			[{ direction: 'y', barType: 'both', valType: 'fixedVal', val: 1, color: RESOLVED }],
			local,
			resolveColor,
		);
		const ln = ((series['c:errBars'] as XmlObject)['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(choiceOf(ln['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
	});

	it('axis title: keeps a:schemeClr on the run defaults', () => {
		const axis: XmlObject = {
			'c:title': {
				'c:txPr': { 'a:p': { 'a:pPr': { 'a:defRPr': { 'a:solidFill': { ...THEMED } } } } },
			},
		};
		applyChartAxisTitleStyleToXml(axis, { fontColor: RESOLVED }, local, resolveColor);
		const defRPr = (((axis['c:title'] as XmlObject)['c:txPr'] as XmlObject)['a:p'] as XmlObject)[
			'a:pPr'
		] as XmlObject;
		expect(choiceOf((defRPr['a:defRPr'] as XmlObject)['a:solidFill'] as XmlObject)).toBe(
			'a:schemeClr',
		);
	});

	it('legend entry: keeps a:schemeClr on the run defaults', () => {
		const chart: XmlObject = {
			'c:legend': {
				'c:legendPos': { '@_val': 'r' },
				'c:legendEntry': {
					'c:idx': { '@_val': '0' },
					'c:txPr': { 'a:p': { 'a:pPr': { 'a:defRPr': { 'a:solidFill': { ...THEMED } } } } },
				},
			},
		};
		applyChartLegendToXml(
			chart,
			{ legendEntries: [{ index: 0, textStyle: { color: RESOLVED } }] },
			local,
			resolveColor,
		);
		const entries = (chart['c:legend'] as XmlObject)['c:legendEntry'];
		const entry = (Array.isArray(entries) ? entries[0] : entries) as XmlObject;
		const defRPr = ((entry['c:txPr'] as XmlObject)['a:p'] as XmlObject)['a:pPr'] as XmlObject;
		expect(choiceOf((defRPr['a:defRPr'] as XmlObject)['a:solidFill'] as XmlObject)).toBe(
			'a:schemeClr',
		);
	});

	it('display units label: keeps a:schemeClr on fill and line', () => {
		const axis: XmlObject = {
			'c:dispUnits': {
				'c:builtInUnit': { '@_val': 'thousands' },
				'c:dispUnitsLbl': {
					'c:spPr': { 'a:solidFill': { ...THEMED }, 'a:ln': { 'a:solidFill': { ...THEMED } } },
				},
			},
		};
		applyChartAxisDisplayUnitsToXml(
			axis,
			{
				displayUnits: 'thousands',
				displayUnitsLabel: { spPr: { fillColor: RESOLVED, strokeColor: RESOLVED } },
			},
			local,
			resolveColor,
		);
		const spPr = ((axis['c:dispUnits'] as XmlObject)['c:dispUnitsLbl'] as XmlObject)[
			'c:spPr'
		] as XmlObject;
		expect(choiceOf(spPr['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
		expect(choiceOf((spPr['a:ln'] as XmlObject)['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
	});

	it('up/down bars: keeps a:schemeClr on fill and line', () => {
		const container: XmlObject = {
			'c:upDownBars': {
				'c:upBars': {
					'c:spPr': { 'a:solidFill': { ...THEMED }, 'a:ln': { 'a:solidFill': { ...THEMED } } },
				},
			},
		};
		applyChartUpDownBars(
			container,
			{ upBars: { fillColor: RESOLVED, strokeColor: RESOLVED } },
			local,
			resolveColor,
		);
		const spPr = ((container['c:upDownBars'] as XmlObject)['c:upBars'] as XmlObject)[
			'c:spPr'
		] as XmlObject;
		expect(choiceOf(spPr['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
		expect(choiceOf((spPr['a:ln'] as XmlObject)['a:solidFill'] as XmlObject)).toBe('a:schemeClr');
	});

	it('writes a literal when no resolver is supplied (a fabricated chart)', () => {
		const series: XmlObject = {};
		applySeriesDataPointsToXml(series, [{ idx: 0, spPr: { fillColor: '#123456' } }], local);
		const spPr = (series['c:dPt'] as XmlObject)['c:spPr'] as XmlObject;
		expect(((spPr['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('123456');
	});
});
