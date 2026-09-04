/**
 * @fileoverview Regression coverage for chart-cx-update-series.ts, focused on
 * C2-G6: cx:valueColors/cx:valueColorPositions (color-by-value scales, now
 * parsed by chart-cx-value-colors.ts) must keep round-tripping untouched
 * through an in-place series edit, since this module has no model-driven
 * writer for them (they stay in AFTER_TX, preserve-only).
 */

import { describe, it, expect } from 'vitest';

import type { PptxChartSeries, XmlObject } from '../../types';
import { applySeriesColor, applySeriesName, applySeriesDataLabels } from './chart-cx-update-series';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function seriesNodeWithValueColors(): XmlObject {
	return {
		'cx:tx': { 'cx:txData': { 'cx:v': 'Original' } },
		'cx:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } } },
		'cx:valueColors': { 'cx:minColor': { 'a:srgbClr': { '@_val': '0000FF' } } },
		'cx:valueColorPositions': { 'cx:pos': { '@_type': 'min' } },
		'cx:dataId': { '@_val': '0' },
	};
}

describe('chart-cx-update-series preserves value-color scales (C2-G6)', () => {
	it('keeps cx:valueColors/cx:valueColorPositions untouched when the series name changes', () => {
		const node = seriesNodeWithValueColors();
		applySeriesName(node, 'Renamed', getLocalName);
		expect(node['cx:valueColors']).toStrictEqual({
			'cx:minColor': { 'a:srgbClr': { '@_val': '0000FF' } },
		});
		expect(node['cx:valueColorPositions']).toStrictEqual({ 'cx:pos': { '@_type': 'min' } });
	});

	it('keeps cx:valueColors/cx:valueColorPositions untouched when the series colour changes', () => {
		const node = seriesNodeWithValueColors();
		const series: PptxChartSeries = { name: 'Original', values: [1], color: '#FF0000' };
		applySeriesColor(node, series, getLocalName);
		expect(node['cx:valueColors']).toBeDefined();
		expect(node['cx:valueColorPositions']).toBeDefined();
	});

	it('keeps cx:valueColors/cx:valueColorPositions untouched when data labels are toggled', () => {
		const node = seriesNodeWithValueColors();
		applySeriesDataLabels(node, true, getLocalName);
		expect(node['cx:valueColors']).toBeDefined();
		expect(node['cx:valueColorPositions']).toBeDefined();
	});
});
