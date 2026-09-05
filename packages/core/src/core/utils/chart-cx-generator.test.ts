import { describe, expect, it } from 'vitest';

import type { PptxChartData, PptxChartType } from '../types';
import { buildChartExSpaceXml, canGenerateChartEx } from './chart-cx-generator';

describe('canGenerateChartEx', () => {
	it('covers every supported generated ChartEx chart type', () => {
		const chartExTypes: PptxChartType[] = [
			'funnel',
			'waterfall',
			'treemap',
			'sunburst',
			'boxWhisker',
			'histogram',
			'regionMap',
		];
		for (const chartType of chartExTypes) {
			const chartData: PptxChartData = { chartType, categories: [], series: [] };
			expect(canGenerateChartEx(chartData)).toBeTruthy();
		}
	});

	it('does not route classic charts through the ChartEx writer', () => {
		const chartData: PptxChartData = { chartType: 'bar', categories: [], series: [] };
		expect(canGenerateChartEx(chartData)).toBeFalsy();
	});
});

// A full regenerate (a ChartEx type change `chartExLayoutChanged` routes
// through `buildChartExSpaceXml`) used to silently drop `c:userShapes`: the
// typed model has no representation for the separate drawing-overlay part,
// so a chart-type change alone deleted the deck's only reference to it.
describe('buildChartExSpaceXml: c:userShapes overlay reference (full-regenerate branch)', () => {
	it('re-emits the preserved c:userShapes reference when userShapesXml is set', () => {
		const chartData: PptxChartData = {
			chartType: 'funnel',
			categories: ['A', 'B'],
			series: [{ name: 'S', values: [1, 2] }],
			userShapesXml: { '@_r:id': 'rId3' },
		};
		const xml = buildChartExSpaceXml(chartData) as Record<string, Record<string, unknown>>;
		const chartSpace = xml['cx:chartSpace'];
		expect(chartSpace['c:userShapes']).toStrictEqual({ '@_r:id': 'rId3' });
		expect(chartSpace['@_xmlns:c']).toBe('http://schemas.openxmlformats.org/drawingml/2006/chart');
	});

	it('omits c:userShapes (and the xmlns:c declaration) when the chart never had an overlay', () => {
		const chartData: PptxChartData = {
			chartType: 'funnel',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
		};
		const xml = buildChartExSpaceXml(chartData) as Record<string, Record<string, unknown>>;
		const chartSpace = xml['cx:chartSpace'];
		expect(chartSpace['c:userShapes']).toBeUndefined();
		expect(chartSpace['@_xmlns:c']).toBeUndefined();
	});
});
