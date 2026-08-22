/**
 * @fileoverview Series colour extraction for area-fill vs line-drawn chart
 * families.
 *
 * A series' explicit colour lives at `c:ser/c:spPr/a:solidFill` for
 * area-filled types, but LINE (and scatter/radar/stock) series author it on
 * the outline: `c:ser/c:spPr/a:ln/a:solidFill`. The parser used to read only
 * the direct fill, so authored line colours were dropped and every renderer
 * fell back to its palette.
 *
 * Two layers are exercised:
 * - `buildChartSeries colour extraction`: pins the low-level extraction rule
 *   in isolation (given the container's actual chart type).
 * - `parseAllChartContainers colour extraction (full pipeline)`: this is the
 *   layer where the real regression lived. The isolated `buildChartSeries`
 *   tests above pass a chart type directly and always passed, even while the
 *   real load path (`parseAllChartContainers`) only forwarded a chart type to
 *   `buildChartSeries` for COMBO charts, silently dropping the colour of
 *   every plain (non-combo) line/scatter/radar/stock chart. These tests bind
 *   `parseAllChartContainers` itself (same technique as
 *   `PptxHandlerRuntimeChartChrome.test.ts`) so a regression in that wiring
 *   fails here even if the isolated helper still behaves correctly.
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
		containerChartType?: PptxChartType,
	) => PptxChartData['series'];

	const buildChartSeries = (
		(ChartParsingRuntime.prototype as unknown as Record<string, unknown>)
			.buildChartSeries as BuildChartSeries
	).bind(ctx as never) as BuildChartSeries;

	it('reads the direct spPr solidFill (bar/area style)', () => {
		const [series] = buildChartSeries(
			[
				{
					'c:val': VAL_NODE,
					'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } } },
				},
			],
			['a', 'b'],
			undefined,
			undefined,
			'bar',
		);
		expect(series.color).toBe('#4472C4');
	});

	it('falls back to the a:ln solidFill for a LINE series (keyed off containerChartType)', () => {
		// <c:ser><c:spPr><a:ln><a:solidFill><a:srgbClr val="ED7D31"/> - how a line
		// chart authors its series colour; there is no direct spPr fill. The real
		// (non-combo) load path never sets `seriesChartType` (3rd arg): the colour
		// read must key off `containerChartType` (5th arg), which is always
		// resolved regardless of combo status.
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
			undefined,
			undefined,
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
			undefined,
			undefined,
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
			undefined,
			undefined,
			'line',
		);
		expect(series.color).toBe('#70AD47');
	});

	it('leaves the colour undefined for a scatter series whose line is noFill', () => {
		const [series] = buildChartSeries(
			[{ 'c:yVal': VAL_NODE, 'c:spPr': { 'a:ln': { 'a:noFill': {} } } }],
			['a', 'b'],
			undefined,
			undefined,
			'scatter',
		);
		expect(series.color).toBeUndefined();
	});
});

describe('parseAllChartContainers colour extraction (full pipeline)', () => {
	// `parseAllChartContainers` is where the real bug lived: it only forwarded
	// a chart type into `buildChartSeries` when `chartLevelType === 'combo'`,
	// so a PLAIN line/scatter/radar/stock chart's `containerChartType` came
	// back `undefined` and `readsLineColor` was always false.
	const pipelineCtx = {
		xmlLookupService,
		compatibilityService: { getXmlLocalName: getLocalName },
		parseColor: parseColorStub,
		extractChartSeriesName: () => 'Revenue',
		extractChartPointValues: () => [1, 2, 3],
		extractChartCategoryValues: () => [] as string[],
		extractChartCategoryLevels: () => undefined,
		buildChartSeries: (ChartParsingRuntime.prototype as unknown as Record<string, unknown>)
			.buildChartSeries,
	};

	type ParseAllChartContainers = (
		plotArea: XmlObject,
		containerKeys: string[],
		chartLevelType: PptxChartType,
		axes: PptxChartData['axes'],
	) => { categories: string[]; categoryLevels?: string[][]; series: PptxChartData['series'] };

	const parseAllChartContainers = (
		(ChartParsingRuntime.prototype as unknown as Record<string, unknown>)
			.parseAllChartContainers as ParseAllChartContainers
	).bind(pipelineCtx as never) as ParseAllChartContainers;

	function lineFamilySeries(color: string): XmlObject {
		return {
			'c:val': VAL_NODE,
			'c:spPr': { 'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': color } } } },
		};
	}

	it('reads a PLAIN (non-combo) line chart series colour from a:ln/a:solidFill', () => {
		const plotArea: XmlObject = {
			'c:lineChart': { 'c:ser': [lineFamilySeries('ED7D31')] },
		};
		const { series } = parseAllChartContainers(plotArea, ['c:lineChart'], 'line', []);
		expect(series[0].color).toBe('#ED7D31');
		// Non-combo: no round-trip tag should be attached.
		expect(series[0].seriesChartType).toBeUndefined();
	});

	it('reads a PLAIN scatter chart series colour from a:ln/a:solidFill', () => {
		const plotArea: XmlObject = {
			'c:scatterChart': { 'c:ser': [lineFamilySeries('4472C4')] },
		};
		const { series } = parseAllChartContainers(plotArea, ['c:scatterChart'], 'scatter', []);
		expect(series[0].color).toBe('#4472C4');
	});

	it('reads a PLAIN radar chart series colour from a:ln/a:solidFill', () => {
		const plotArea: XmlObject = {
			'c:radarChart': { 'c:ser': [lineFamilySeries('70AD47')] },
		};
		const { series } = parseAllChartContainers(plotArea, ['c:radarChart'], 'radar', []);
		expect(series[0].color).toBe('#70AD47');
	});

	it('reads a PLAIN stock chart series colour from a:ln/a:solidFill', () => {
		const plotArea: XmlObject = {
			'c:stockChart': { 'c:ser': [lineFamilySeries('FFC000')] },
		};
		const { series } = parseAllChartContainers(plotArea, ['c:stockChart'], 'stock', []);
		expect(series[0].color).toBe('#FFC000');
	});

	it('still reads a direct solidFill for a plain bar chart (unaffected)', () => {
		const plotArea: XmlObject = {
			'c:barChart': {
				'c:ser': [
					{
						'c:val': VAL_NODE,
						'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } } },
					},
				],
			},
		};
		const { series } = parseAllChartContainers(plotArea, ['c:barChart'], 'bar', []);
		expect(series[0].color).toBe('#4472C4');
	});

	it('combo chart: bar container keeps direct fill, line container keeps a:ln fill, both tagged', () => {
		const plotArea: XmlObject = {
			'c:barChart': {
				'c:ser': [
					{
						'c:val': VAL_NODE,
						'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } } },
					},
				],
			},
			'c:lineChart': { 'c:ser': [lineFamilySeries('ED7D31')] },
		};
		const { series } = parseAllChartContainers(
			plotArea,
			['c:barChart', 'c:lineChart'],
			'combo',
			[],
		);
		expect(series).toHaveLength(2);
		expect(series[0].color).toBe('#4472C4');
		expect(series[0].seriesChartType).toBe('bar');
		expect(series[1].color).toBe('#ED7D31');
		expect(series[1].seriesChartType).toBe('line');
	});
});
