import type { PptxChartRegionMapOptions } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildRegionMapEntries,
	formatRegionMapValue,
	resolveRegionEntityCode,
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
