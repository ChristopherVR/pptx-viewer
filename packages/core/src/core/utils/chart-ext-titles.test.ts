import { describe, expect, it } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { XmlObject } from '../types';
import { parseFilteredTitles } from './chart-ext-titles';

const lookup = new PptxXmlLookupService();
const FILTER_EXT_URI = '{02D57815-91ED-43cb-92C2-25804820EDAC}';

describe('chart-ext-titles', () => {
	it('returns undefined when the container has no filter extension at all', () => {
		expect(parseFilteredTitles(undefined, lookup)).toBeUndefined();
		expect(parseFilteredTitles({}, lookup)).toBeUndefined();
	});

	it('parses c15:filteredSeriesTitle from a strRef cache', () => {
		const container: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': FILTER_EXT_URI,
					'c15:filteredSeriesTitle': {
						'c15:tx': {
							'c:strRef': {
								'c:f': 'Sheet1!$C$1',
								'c:strCache': {
									'c:ptCount': { '@_val': '1' },
									'c:pt': [{ '@_idx': '0', 'c:v': 'Series 3' }],
								},
							},
						},
					},
				},
			},
		};
		expect(parseFilteredTitles(container, lookup)).toStrictEqual({ seriesTitle: 'Series 3' });
	});

	it('parses c15:filteredSeriesTitle from a literal c15:v', () => {
		const container: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': FILTER_EXT_URI,
					'c15:filteredSeriesTitle': { 'c15:tx': { 'c15:v': 'Literal Title' } },
				},
			},
		};
		expect(parseFilteredTitles(container, lookup)).toStrictEqual({ seriesTitle: 'Literal Title' });
	});

	it('parses c15:filteredCategoryTitle from a strRef cache', () => {
		const container: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': FILTER_EXT_URI,
					'c15:filteredCategoryTitle': {
						'c15:cat': {
							'c:strRef': {
								'c:f': 'Sheet1!$A$2:$A$4',
								'c:strCache': {
									'c:ptCount': { '@_val': '3' },
									'c:pt': [
										{ '@_idx': '0', 'c:v': '1' },
										{ '@_idx': '1', 'c:v': '2' },
										{ '@_idx': '2', 'c:v': '3' },
									],
								},
							},
						},
					},
				},
			},
		};
		expect(parseFilteredTitles(container, lookup)).toStrictEqual({
			categoryTitle: ['1', '2', '3'],
		});
	});

	it('parses both extensions together when both are present', () => {
		const container: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': FILTER_EXT_URI,
					'c15:filteredSeriesTitle': { 'c15:tx': { 'c15:v': 'Series 3' } },
					'c15:filteredCategoryTitle': {
						'c15:cat': {
							'c:numRef': {
								'c:f': 'Sheet1!$A$2:$A$3',
								'c:numCache': {
									'c:ptCount': { '@_val': '2' },
									'c:pt': [
										{ '@_idx': '0', 'c:v': '1' },
										{ '@_idx': '1', 'c:v': '2' },
									],
								},
							},
						},
					},
				},
			},
		};
		expect(parseFilteredTitles(container, lookup)).toStrictEqual({
			seriesTitle: 'Series 3',
			categoryTitle: ['1', '2'],
		});
	});

	it('returns undefined when the filter extension exists but carries neither title', () => {
		const container: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': FILTER_EXT_URI,
					'c15:filteredBarSeries': { 'c15:ser': { 'c:idx': { '@_val': '1' } } },
				},
			},
		};
		expect(parseFilteredTitles(container, lookup)).toBeUndefined();
	});
});
