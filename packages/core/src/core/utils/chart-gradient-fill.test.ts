import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseChartGradientFill } from './chart-gradient-fill';
import type { ChartGradientCodec } from './chart-gradient-fill';

const lookup = {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) =>
		(parent?.[`a:${name}`] as XmlObject | undefined) ?? undefined,
};

function codec(type: 'linear' | 'radial'): ChartGradientCodec {
	return {
		extractGradientStops: () => [
			{ color: '#595959', position: 0 },
			{ color: '#262626', position: 100, opacity: 0.5 },
		],
		extractGradientType: () => type,
		extractGradientAngle: () => 90,
		extractGradientFocalPoint: () => ({ x: 0.5, y: 0.5 }),
	};
}

describe('parseChartGradientFill (COM: charts-com.pptx slide 23)', () => {
	it('parses a linear series gradient with its angle', () => {
		expect(parseChartGradientFill({ 'a:gradFill': {} }, lookup, codec('linear'))).toStrictEqual({
			type: 'linear',
			angle: 90,
			stops: [
				{ color: '#595959', position: 0 },
				{ color: '#262626', position: 100, opacity: 0.5 },
			],
		});
	});

	it('parses a radial chart-area gradient with its focal point', () => {
		expect(parseChartGradientFill({ 'a:gradFill': {} }, lookup, codec('radial'))).toMatchObject({
			type: 'radial',
			focalPoint: { x: 0.5, y: 0.5 },
		});
	});

	it('returns undefined without a gradient', () => {
		expect(parseChartGradientFill({ 'a:solidFill': {} }, lookup, codec('linear'))).toBeUndefined();
		expect(parseChartGradientFill(undefined, lookup, codec('linear'))).toBeUndefined();
	});
});
