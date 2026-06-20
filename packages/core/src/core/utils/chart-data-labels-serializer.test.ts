import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartDataLabelsToXml } from './chart-data-labels-serializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

/** A plot area with one bar chart (one series), no data labels. */
function plotAreaWithBar(): XmlObject {
	return {
		'c:barChart': {
			'c:barDir': { '@_val': 'col' },
			'c:ser': { 'c:idx': { '@_val': '0' } },
			'c:axId': { '@_val': '1' },
		},
	};
}

function bar(plotArea: XmlObject): XmlObject {
	return plotArea['c:barChart'] as XmlObject;
}

function dLblsOf(plotArea: XmlObject): XmlObject {
	return bar(plotArea)['c:dLbls'] as XmlObject;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyChartDataLabelsToXml', () => {
	it('is a no-op when hasDataLabels is undefined', () => {
		const pa = plotAreaWithBar();
		const before = JSON.stringify(pa);
		applyChartDataLabelsToXml(pa, { dataLabels: { showValue: true } }, getLocalName);
		expect(JSON.stringify(pa)).toBe(before);
	});

	it('inserts dLbls defaulting to showVal when enabled with no content flags', () => {
		const pa = plotAreaWithBar();
		applyChartDataLabelsToXml(pa, { hasDataLabels: true }, getLocalName);
		expect(dLblsOf(pa)['c:showVal']).toStrictEqual({ '@_val': '1' });
		expect(dLblsOf(pa)['c:showCatName']).toStrictEqual({ '@_val': '0' });
	});

	it('inserts dLbls after the last series and before axId (schema order)', () => {
		const pa = plotAreaWithBar();
		applyChartDataLabelsToXml(pa, { hasDataLabels: true }, getLocalName);
		const keys = Object.keys(bar(pa)).map(getLocalName);
		expect(keys.indexOf('dLbls')).toBeGreaterThan(keys.indexOf('ser'));
		expect(keys.indexOf('dLbls')).toBeLessThan(keys.indexOf('axId'));
	});

	it('writes the requested content flags', () => {
		const pa = plotAreaWithBar();
		applyChartDataLabelsToXml(
			pa,
			{ hasDataLabels: true, dataLabels: { showCategory: true, showPercent: true } },
			getLocalName,
		);
		const d = dLblsOf(pa);
		expect(d['c:showCatName']).toStrictEqual({ '@_val': '1' });
		expect(d['c:showPercent']).toStrictEqual({ '@_val': '1' });
		expect(d['c:showVal']).toStrictEqual({ '@_val': '0' });
	});

	it('writes dLblPos before the show flags when a position is set', () => {
		const pa = plotAreaWithBar();
		applyChartDataLabelsToXml(
			pa,
			{ hasDataLabels: true, dataLabels: { showValue: true, position: 'outEnd' } },
			getLocalName,
		);
		const d = dLblsOf(pa);
		expect(d['c:dLblPos']).toStrictEqual({ '@_val': 'outEnd' });
		const keys = Object.keys(d).map(getLocalName);
		expect(keys.indexOf('dLblPos')).toBeLessThan(keys.indexOf('showVal'));
	});

	it('disables labels via <c:delete> when hasDataLabels is false', () => {
		const pa = plotAreaWithBar();
		applyChartDataLabelsToXml(pa, { hasDataLabels: true }, getLocalName);
		applyChartDataLabelsToXml(pa, { hasDataLabels: false }, getLocalName);
		expect(dLblsOf(pa)).toStrictEqual({ 'c:delete': { '@_val': '1' } });
	});

	it('preserves numFmt/spPr/txPr on an existing dLbls when updating', () => {
		const pa = plotAreaWithBar();
		bar(pa)['c:dLbls'] = {
			'c:numFmt': { '@_formatCode': '0.0', '@_sourceLinked': '0' },
			'c:txPr': { marker: true },
			'c:showVal': { '@_val': '1' },
		};
		applyChartDataLabelsToXml(
			pa,
			{ hasDataLabels: true, dataLabels: { showCategory: true } },
			getLocalName,
		);
		const d = dLblsOf(pa);
		expect(d['c:numFmt']).toStrictEqual({ '@_formatCode': '0.0', '@_sourceLinked': '0' });
		expect(d['c:txPr']).toStrictEqual({ marker: true });
		expect(d['c:showCatName']).toStrictEqual({ '@_val': '1' });
	});

	it('applies to every chart-type container (combo charts)', () => {
		const pa: XmlObject = {
			'c:barChart': { 'c:ser': {}, 'c:axId': { '@_val': '1' } },
			'c:lineChart': { 'c:ser': {}, 'c:axId': { '@_val': '1' } },
		};
		applyChartDataLabelsToXml(pa, { hasDataLabels: true }, getLocalName);
		expect((pa['c:barChart'] as XmlObject)['c:dLbls']).toBeDefined();
		expect((pa['c:lineChart'] as XmlObject)['c:dLbls']).toBeDefined();
	});

	it('works with namespace-stripped keys', () => {
		const pa: XmlObject = { barChart: { ser: {}, axId: { '@_val': '1' } } };
		applyChartDataLabelsToXml(pa, { hasDataLabels: true }, getLocalName);
		expect((pa.barChart as XmlObject)['c:dLbls']).toBeDefined();
	});
});
