import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyBubbleChartOptions, parseBubbleChartOptions } from './chart-bubble-options';
import { buildChartSpaceXml } from './chart-xml-generator';

const localName = (key: string) => key.replace(/^.*:/u, '');

describe('classic bubble chart options', () => {
	it('parses Strict and Transitional values plus defaults', () => {
		expect(
			parseBubbleChartOptions(
				{
					'c:bubble3D': {},
					'c:bubbleScale': { '@_val': '125%' },
					'c:showNegBubbles': { '@_val': '0' },
					'c:sizeRepresents': {},
				},
				localName,
			),
		).toStrictEqual({
			bubble3D: true,
			bubbleScale: 125,
			showNegativeBubbles: false,
			sizeRepresents: 'area',
		});
		expect(
			parseBubbleChartOptions({ 'c:bubbleScale': { '@_val': '240' } }, localName),
		).toStrictEqual({ bubbleScale: 240 });
	});

	it('preserves unknown attributes and follows CT_BubbleChart order', () => {
		const container: XmlObject = {
			'c:varyColors': {},
			'c:ser': [],
			'c:bubbleScale': { '@_vendor': 'retained' },
			'c:axId': [],
			'c:extLst': {},
		};
		applyBubbleChartOptions(
			container,
			{ bubble3D: false, bubbleScale: 175, showNegativeBubbles: true, sizeRepresents: 'w' },
			localName,
		);
		expect((container['c:bubbleScale'] as XmlObject)['@_vendor']).toBe('retained');
		expect(Object.keys(container)).toStrictEqual([
			'c:varyColors',
			'c:ser',
			'c:bubble3D',
			'c:bubbleScale',
			'c:showNegBubbles',
			'c:sizeRepresents',
			'c:axId',
			'c:extLst',
		]);
	});

	it('rejects an out-of-range scale', () => {
		expect(() => applyBubbleChartOptions({}, { bubbleScale: 301 }, localName)).toThrow(
			/between 0 and 300/u,
		);
	});

	it('emits options for a generated bubble chart', () => {
		const tree = buildChartSpaceXml({
			chartType: 'bubble',
			categories: ['1'],
			series: [{ name: 'S', values: [2] }],
			bubbleOptions: { bubbleScale: 120, showNegativeBubbles: false, sizeRepresents: 'area' },
		});
		const chart = (tree['c:chartSpace'] as XmlObject)['c:chart'] as XmlObject;
		const bubble = (chart['c:plotArea'] as XmlObject)['c:bubbleChart'] as XmlObject;
		expect(parseBubbleChartOptions(bubble, localName)).toStrictEqual({
			bubbleScale: 120,
			showNegativeBubbles: false,
			sizeRepresents: 'area',
		});
	});
});
