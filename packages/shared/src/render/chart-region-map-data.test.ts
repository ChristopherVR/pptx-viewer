import type { PptxChartRegionMapOptions } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildRegionMapEntries,
	buildValueColorScale,
	formatRegionMapValue,
	lerpColor,
	resolveRegionEntityCode,
	resolveValueColorStops,
	shouldRenderRegionLabel,
} from './chart-region-map-data';

const codes: Record<string, string> = {
	au: 'AU',
	australia: 'AU',
	us: 'US',
	'united states': 'US',
};
const resolveCode = (value: string) => codes[value.trim().toLowerCase()];

describe('region map source data', () => {
	it('aligns categories, values and entity IDs by cx:pt source indexes', () => {
		const options: PptxChartRegionMapOptions = {
			entityIds: ['country:US', 'country:AU'],
			categorySourceIndices: [2, 7],
			valueSourceIndices: [7, 2],
			entityIdSourceIndices: [7, 2],
		};
		expect(
			buildRegionMapEntries(['Australia label', 'US label'], [95, 72], options, resolveCode),
		).toStrictEqual([
			{
				sourceIndex: 2,
				label: 'Australia label',
				value: 72,
				entityId: 'country:AU',
				code: 'AU',
			},
			{
				sourceIndex: 7,
				label: 'US label',
				value: 95,
				entityId: 'country:US',
				code: 'US',
			},
		]);
	});

	it('uses cached provider entity names when an ID has no geographic suffix', () => {
		const options: PptxChartRegionMapOptions = {
			geographyCache: {
				'@_provider': 'Bing',
				'cx:geoData': { '@_entityId': 'opaque-123', '@_entityName': 'Australia' },
			},
		};
		expect(resolveRegionEntityCode('opaque-123', options, resolveCode)).toBe('AU');
	});

	it('honors none, best-fit, and show-all label layouts', () => {
		expect(shouldRenderRegionLabel('none', 100, 100)).toBeFalsy();
		expect(shouldRenderRegionLabel('bestFitOnly', 12, 20)).toBeFalsy();
		expect(shouldRenderRegionLabel('bestFitOnly', 20, 12)).toBeTruthy();
		expect(shouldRenderRegionLabel('showAll', 2, 2)).toBeTruthy();
	});

	it('formats values with the authored geography culture', () => {
		expect(formatRegionMapValue(1234.5, 'de-DE')).toBe('1.234,5');
		expect(formatRegionMapValue(1234.5, 'not_a_culture')).toBe('1234.5');
	});
});

describe('cx:valueColors / cx:valueColorPositions', () => {
	it('returns undefined with no chart-authored value-color gradient', () => {
		expect(resolveValueColorStops(undefined, undefined, 0, 100)).toBeUndefined();
		expect(resolveValueColorStops(['#ffffff'], undefined, 0, 100)).toBeUndefined();
	});

	it('evenly spaces stops with no authored cx:colorPosition', () => {
		const stops = resolveValueColorStops(['#000000', '#ffffff'], undefined, 0, 100);
		expect(stops).toStrictEqual([
			{ color: '#000000', position: 0 },
			{ color: '#ffffff', position: 1 },
		]);
	});

	it('resolves min/max/number/percent cx:colorPosition kinds against the data range', () => {
		const stops = resolveValueColorStops(
			['#000000', '#808080', '#ffffff'],
			[{ kind: 'min' }, { kind: 'number', value: 50 }, { kind: 'percent', value: 100 }],
			0,
			100,
		);
		expect(stops).toStrictEqual([
			{ color: '#000000', position: 0 },
			{ color: '#808080', position: 0.5 },
			{ color: '#ffffff', position: 1 },
		]);
	});

	it('builds a scale that interpolates between the bracketing stops', () => {
		const scale = buildValueColorScale([
			{ color: '#000000', position: 0 },
			{ color: '#ffffff', position: 1 },
		]);
		expect(scale(0)).toBe('#000000');
		expect(scale(1)).toBe('#ffffff');
		expect(scale(0.5)).toBe(lerpColor('#000000', '#ffffff', 0.5));
	});

	it('clamps out-of-range t to the nearest stop', () => {
		const scale = buildValueColorScale([
			{ color: '#111111', position: 0.2 },
			{ color: '#eeeeee', position: 0.8 },
		]);
		expect(scale(-1)).toBe('#111111');
		expect(scale(2)).toBe('#eeeeee');
	});
});
