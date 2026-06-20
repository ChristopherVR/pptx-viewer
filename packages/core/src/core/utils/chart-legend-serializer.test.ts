import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartLegendToXml } from './chart-legend-serializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip a `c:`-style prefix to the local name, mirroring the runtime resolver. */
const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

/** A chart root with a plot area and an existing legend at position `r`. */
function chartRootWithLegend(pos = 'r'): XmlObject {
	return {
		'c:plotArea': { 'c:barChart': {} },
		'c:legend': {
			'c:legendPos': { '@_val': pos },
			'c:overlay': { '@_val': '0' },
		},
		'c:plotVisOnly': { '@_val': '1' },
	};
}

/** A chart root with a plot area but no legend. */
function chartRootNoLegend(): XmlObject {
	return {
		'c:plotArea': { 'c:barChart': {} },
		'c:plotVisOnly': { '@_val': '1' },
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyChartLegendToXml', () => {
	it('updates the position of an existing legend', () => {
		const root = chartRootWithLegend('r');
		applyChartLegendToXml(root, { hasLegend: true, legendPosition: 'l' }, getLocalName);
		expect((root['c:legend'] as XmlObject)['c:legendPos']).toStrictEqual({ '@_val': 'l' });
	});

	it('preserves other legend children when updating position', () => {
		const root = chartRootWithLegend('b');
		applyChartLegendToXml(root, { hasLegend: true, legendPosition: 't' }, getLocalName);
		expect((root['c:legend'] as XmlObject)['c:overlay']).toStrictEqual({ '@_val': '0' });
	});

	it('removes the legend when hasLegend is false', () => {
		const root = chartRootWithLegend('r');
		applyChartLegendToXml(root, { hasLegend: false }, getLocalName);
		expect('c:legend' in root).toBeFalsy();
		// Other nodes are untouched.
		expect('c:plotArea' in root).toBeTruthy();
		expect('c:plotVisOnly' in root).toBeTruthy();
	});

	it('is a no-op when hasLegend is undefined (untouched passthrough)', () => {
		const root = chartRootWithLegend('tr');
		const before = JSON.stringify(root);
		applyChartLegendToXml(root, { legendPosition: 'l' }, getLocalName);
		expect(JSON.stringify(root)).toBe(before);
	});

	it('inserts a new legend after the plot area when none exists', () => {
		const root = chartRootNoLegend();
		applyChartLegendToXml(root, { hasLegend: true, legendPosition: 'b' }, getLocalName);
		expect((root['c:legend'] as XmlObject)['c:legendPos']).toStrictEqual({ '@_val': 'b' });
		// Schema order: plotArea, legend, plotVisOnly.
		const keys = Object.keys(root).map(getLocalName);
		expect(keys.indexOf('legend')).toBeGreaterThan(keys.indexOf('plotArea'));
		expect(keys.indexOf('legend')).toBeLessThan(keys.indexOf('plotVisOnly'));
	});

	it('defaults a newly inserted legend to the right when no position is given', () => {
		const root = chartRootNoLegend();
		applyChartLegendToXml(root, { hasLegend: true }, getLocalName);
		expect((root['c:legend'] as XmlObject)['c:legendPos']).toStrictEqual({ '@_val': 'r' });
	});

	it('adds legendPos as the first child of a legend that lacks one', () => {
		const root: XmlObject = {
			'c:plotArea': {},
			'c:legend': { 'c:overlay': { '@_val': '0' } },
		};
		applyChartLegendToXml(root, { hasLegend: true, legendPosition: 'l' }, getLocalName);
		const legendKeys = Object.keys(root['c:legend'] as XmlObject).map(getLocalName);
		expect(legendKeys[0]).toBe('legendPos');
		expect((root['c:legend'] as XmlObject)['c:legendPos']).toStrictEqual({ '@_val': 'l' });
	});

	it('removing an already-absent legend is a no-op', () => {
		const root = chartRootNoLegend();
		const before = JSON.stringify(root);
		applyChartLegendToXml(root, { hasLegend: false }, getLocalName);
		expect(JSON.stringify(root)).toBe(before);
	});

	it('works with namespace-stripped keys', () => {
		const root: XmlObject = {
			plotArea: {},
			plotVisOnly: { '@_val': '1' },
		};
		applyChartLegendToXml(root, { hasLegend: true, legendPosition: 't' }, getLocalName);
		expect((root['c:legend'] as XmlObject)['c:legendPos']).toStrictEqual({ '@_val': 't' });
	});
});
