import { describe, it, expect } from 'vitest';

import type { PptxChartDataLabel, XmlObject } from '../types';
import { applySeriesDataLabelsToXml } from './chart-series-datalabel-serializer';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

/** A series node with a c:val list and no dLbls. */
function seriesNode(): XmlObject {
	return {
		'c:idx': { '@_val': '0' },
		'c:order': { '@_val': '0' },
		'c:tx': { 'c:v': 'S1' },
		'c:cat': {},
		'c:val': {},
	};
}

const labels = (arr: PptxChartDataLabel[]): PptxChartDataLabel[] => arr;

describe('applySeriesDataLabelsToXml', () => {
	it('inserts a c:dLbls with one c:dLbl override before c:cat/c:val', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(
			ser,
			labels([{ idx: 1, showVal: true, position: 'outEnd' }]),
			getLocalName,
		);
		const dLbls = ser['c:dLbls'] as XmlObject;
		expect(dLbls).toBeDefined();
		const dLbl = dLbls['c:dLbl'] as XmlObject;
		expect((dLbl['c:idx'] as XmlObject)['@_val']).toBe('1');
		expect((dLbl['c:dLblPos'] as XmlObject)['@_val']).toBe('outEnd');
		expect((dLbl['c:showVal'] as XmlObject)['@_val']).toBe('1');
		// Inserted ahead of c:cat in schema order.
		const keys = Object.keys(ser).map(getLocalName);
		expect(keys.indexOf('dLbls')).toBeLessThan(keys.indexOf('cat'));
	});

	it('writes multiple overrides as a c:dLbl array sorted by idx', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(
			ser,
			labels([
				{ idx: 2, showVal: true },
				{ idx: 0, showCatName: true },
			]),
			getLocalName,
		);
		const dLbls = ser['c:dLbls'] as XmlObject;
		const arr = dLbls['c:dLbl'] as XmlObject[];
		expect(Array.isArray(arr)).toBeTruthy();
		expect((arr[0]['c:idx'] as XmlObject)['@_val']).toBe('0');
		expect((arr[1]['c:idx'] as XmlObject)['@_val']).toBe('2');
	});

	it('emits a delete override for a content-less label (suppress one point)', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(ser, labels([{ idx: 1 }]), getLocalName);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect((dLbl['c:delete'] as XmlObject)['@_val']).toBe('1');
		expect(dLbl['c:showVal']).toBeUndefined();
	});

	it('writes custom label text as a c:tx rich run', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(ser, labels([{ idx: 0, text: 'Peak' }]), getLocalName);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		const t = (((dLbl['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] as XmlObject)[
			'a:r'
		] as XmlObject;
		expect((t['a:t'] as string) ?? t['a:t']).toBe('Peak');
	});

	it('preserves group-level dLbls settings while reconciling c:dLbl', () => {
		const ser = seriesNode();
		ser['c:dLbls'] = {
			'c:dLbl': { 'c:idx': { '@_val': '0' }, 'c:showVal': { '@_val': '1' } },
			'c:showVal': { '@_val': '1' },
			'c:showPercent': { '@_val': '0' },
		};
		applySeriesDataLabelsToXml(ser, labels([{ idx: 0, showCatName: true }]), getLocalName);
		const dLbls = ser['c:dLbls'] as XmlObject;
		// Group settings preserved.
		expect((dLbls['c:showVal'] as XmlObject)['@_val']).toBe('1');
		expect((dLbls['c:showPercent'] as XmlObject)['@_val']).toBe('0');
		// dLbl rebuilt.
		const dLbl = dLbls['c:dLbl'] as XmlObject;
		expect((dLbl['c:showCatName'] as XmlObject)['@_val']).toBe('1');
		// c:dLbl comes before group settings.
		const keys = Object.keys(dLbls).map(getLocalName);
		expect(keys.indexOf('dLbl')).toBeLessThan(keys.indexOf('showVal'));
	});

	it('removes all c:dLbl overrides but keeps group settings when given []', () => {
		const ser = seriesNode();
		ser['c:dLbls'] = {
			'c:dLbl': { 'c:idx': { '@_val': '0' } },
			'c:showVal': { '@_val': '1' },
		};
		applySeriesDataLabelsToXml(ser, [], getLocalName);
		const dLbls = ser['c:dLbls'] as XmlObject;
		expect(dLbls['c:dLbl']).toBeUndefined();
		expect((dLbls['c:showVal'] as XmlObject)['@_val']).toBe('1');
	});

	it('drops an empty c:dLbls entirely when no overrides and no group settings', () => {
		const ser = seriesNode();
		ser['c:dLbls'] = { 'c:dLbl': { 'c:idx': { '@_val': '0' } } };
		applySeriesDataLabelsToXml(ser, [], getLocalName);
		expect(ser['c:dLbls']).toBeUndefined();
	});
});
