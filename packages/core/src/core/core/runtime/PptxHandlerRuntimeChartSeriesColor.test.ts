/**
 * @fileoverview `buildChartSeries` colour extraction.
 *
 * A series' explicit colour lives at `c:ser/c:spPr/a:solidFill` for
 * area-filled types, but LINE (and scatter/radar/stock) series author it on
 * the outline: `c:ser/c:spPr/a:ln/a:solidFill`. The parser used to read only
 * the direct fill, so authored line colours were dropped and every renderer
 * fell back to its palette. These tests bind the protected `buildChartSeries`
 * (same technique as `PptxHandlerRuntimeChartChrome.test.ts`) onto a minimal
 * `this` and pin both extraction paths.
 */
import { describe, expect, it } from 'vitest';

import { PptxXmlLookupService } from '../../services/PptxXmlLookupService';
import type { PptxChartData, PptxChartType, XmlObject } from '../../types';
import { PptxHandlerRuntime as ChartParsingRuntime } from './PptxHandlerRuntimeChartParsing';

const xmlLookupService = new PptxXmlLookupService();

function getLocalName(qualifiedName: string): string {
	const colonIndex = qualifiedName.lastIndexOf(':');
	return colonIndex >= 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}

/** Minimal `parseColor`: resolve a solidFill node's `a:srgbClr/@val`. */
function parseColorStub(node: XmlObject | undefined): string | undefined {
	if (!node) {
		return undefined;
	}
	const srgb = node['a:srgbClr'] as XmlObject | undefined;
	const val = srgb?.['@_val'];
	return typeof val === 'string' && val.length > 0 ? `#${val}` : undefined;
}

const ctx = {
	xmlLookupService,
	compatibilityService: { getXmlLocalName: getLocalName },
	parseColor: parseColorStub,
	extractChartSeriesName: () => 'Revenue',
	extractChartPointValues: () => [1, 2, 3],
};

type BuildChartSeries = (
	seriesList: XmlObject[],
	categories: string[],
	seriesChartType?: PptxChartType,
	axisId?: number,
) => PptxChartData['series'];

const buildChartSeries = (
	(ChartParsingRuntime.prototype as unknown as Record<string, unknown>)
		.buildChartSeries as BuildChartSeries
).bind(ctx as never) as BuildChartSeries;

const VAL_NODE = {
	'c:numRef': {
		'c:numCache': {
			'c:pt': [
				{ '@_idx': '0', 'c:v': '1' },
				{ '@_idx': '1', 'c:v': '2' },
			],
		},
	},
};

describe('buildChartSeries colour extraction', () => {
	it('reads the direct spPr solidFill (bar/area style)', () => {
		const [series] = buildChartSeries(
			[
				{
					'c:val': VAL_NODE,
					'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } } },
				},
			],
			['a', 'b'],
			'bar',
		);
		expect(series.color).toBe('#4472C4');
	});

	it('falls back to the a:ln solidFill for a LINE series', () => {
		// <c:ser><c:spPr><a:ln><a:solidFill><a:srgbClr val="ED7D31"/> - how a line
		// chart authors its series colour; there is no direct spPr fill.
		const [series] = buildChartSeries(
			[
				{
					'c:val': VAL_NODE,
					'c:spPr': {
						'a:ln': { '@_w': '28575', 'a:solidFill': { 'a:srgbClr': { '@_val': 'ED7D31' } } },
					},
				},
			],
			['a', 'b'],
			'line',
		);
		expect(series.color).toBe('#ED7D31');
	});

	it('does NOT take an outline colour as the fill of a bar series', () => {
		const [series] = buildChartSeries(
			[
				{
					'c:val': VAL_NODE,
					'c:spPr': { 'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'ED7D31' } } } },
				},
			],
			['a', 'b'],
			'bar',
		);
		expect(series.color).toBeUndefined();
	});

	it('the direct fill wins over the outline for a line series carrying both', () => {
		const [series] = buildChartSeries(
			[
				{
					'c:val': VAL_NODE,
					'c:spPr': {
						'a:solidFill': { 'a:srgbClr': { '@_val': '70AD47' } },
						'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'ED7D31' } } },
					},
				},
			],
			['a', 'b'],
			'line',
		);
		expect(series.color).toBe('#70AD47');
	});

	it('leaves the colour undefined for a scatter series whose line is noFill', () => {
		const [series] = buildChartSeries(
			[{ 'c:yVal': VAL_NODE, 'c:spPr': { 'a:ln': { 'a:noFill': {} } } }],
			['a', 'b'],
			'scatter',
		);
		expect(series.color).toBeUndefined();
	});
});
