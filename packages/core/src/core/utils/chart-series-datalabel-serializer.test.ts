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

	it('writes a per-label c:spPr override (fill + line)', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(
			ser,
			labels([
				{
					idx: 0,
					spPr: { fillColor: '#112233', strokeColor: '#445566', strokeWidth: 1 },
				},
			]),
			getLocalName,
		);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		const spPr = dLbl['c:spPr'] as XmlObject;
		expect(((spPr['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('112233');
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(Math.round(1 * 12700)));
		expect(((ln['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('445566');
	});

	it('writes a per-label c:txPr override (previously parsed but never serialized)', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(
			ser,
			labels([{ idx: 0, txPr: { fontSize: 14, bold: true, color: '#FF00FF' } }]),
			getLocalName,
		);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		const txPr = dLbl['c:txPr'] as XmlObject;
		const defRPr = ((txPr['a:p'] as XmlObject)['a:pPr'] as XmlObject)['a:defRPr'] as XmlObject;
		expect(defRPr['@_sz']).toBe('1400');
		expect(defRPr['@_b']).toBe('1');
		expect(((defRPr['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe(
			'FF00FF',
		);
	});

	it('does not treat a label carrying only spPr/txPr as a delete override', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(
			ser,
			labels([{ idx: 0, spPr: { fillColor: '#000000' } }]),
			getLocalName,
		);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect('c:delete' in dLbl).toBeFalsy();
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

	it('writes separator and leader-line settings in schema order', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(
			ser,
			[{ idx: 0, showVal: true, separator: ' / ', showLeaderLines: true }],
			getLocalName,
		);
		const node = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect(node['c:separator']).toBe(' / ');
		expect(node['c:showLeaderLines']).toStrictEqual({ '@_val': '1' });
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('separator')).toBeLessThan(keys.indexOf('showLeaderLines'));
	});

	it('preserves unknown children and extLst while editing a label', () => {
		const ser = seriesNode();
		ser['c:dLbls'] = {
			'c:dLbl': {
				'c:idx': { '@_val': '0' },
				'c:showVal': { '@_val': '0' },
				'cx:futureLabel': { '@_mode': 'keep' },
				'c:extLst': { 'c:ext': { '@_uri': 'labels' } },
			},
		};
		applySeriesDataLabelsToXml(ser, [{ idx: 0, showVal: true }], getLocalName);
		const node = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect(node['cx:futureLabel']).toStrictEqual({ '@_mode': 'keep' });
		expect(node['c:extLst']).toStrictEqual({ 'c:ext': { '@_uri': 'labels' } });
		expect((node['c:showVal'] as XmlObject)['@_val']).toBe('1');
		expect(Object.keys(node).at(-1)).toBe('c:extLst');
	});

	// C2-G16: c:dLbl/c:numFmt (per-point number format override).
	it('writes a per-point numberFormat as c:numFmt (C2-G16)', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(ser, [{ idx: 0, showVal: true, numberFormat: '0%' }], getLocalName);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect(dLbl['c:numFmt']).toStrictEqual({ '@_formatCode': '0%', '@_sourceLinked': '0' });
	});

	it('replaces an existing per-point c:numFmt rather than duplicating it', () => {
		const ser = seriesNode();
		ser['c:dLbls'] = {
			'c:dLbl': {
				'c:idx': { '@_val': '0' },
				'c:numFmt': { '@_formatCode': '0.0', '@_sourceLinked': '0' },
				'c:showVal': { '@_val': '1' },
			},
		};
		applySeriesDataLabelsToXml(
			ser,
			[{ idx: 0, showVal: true, numberFormat: '$#,##0' }],
			getLocalName,
		);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect(dLbl['c:numFmt']).toStrictEqual({ '@_formatCode': '$#,##0', '@_sourceLinked': '0' });
		expect(Object.keys(dLbl).filter((k) => getLocalName(k) === 'numFmt')).toHaveLength(1);
	});

	it('still preserves an existing per-point c:numFmt when numberFormat is not set', () => {
		const ser = seriesNode();
		ser['c:dLbls'] = {
			'c:dLbl': {
				'c:idx': { '@_val': '0' },
				'c:numFmt': { '@_formatCode': '0.0', '@_sourceLinked': '0' },
				'c:showVal': { '@_val': '0' },
			},
		};
		applySeriesDataLabelsToXml(ser, [{ idx: 0, showVal: true }], getLocalName);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect(dLbl['c:numFmt']).toStrictEqual({ '@_formatCode': '0.0', '@_sourceLinked': '0' });
	});

	// C2-G15: c:dLbl/c:layout/c:manualLayout (a dragged data-label position).
	it('writes a per-point manual layout as c:layout/c:manualLayout (C2-G15)', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(
			ser,
			[{ idx: 0, showVal: true, layout: { x: 0.1, y: 0.2 } }],
			getLocalName,
		);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		const manual = (dLbl['c:layout'] as XmlObject)['c:manualLayout'] as XmlObject;
		expect((manual['c:x'] as XmlObject)['@_val']).toBe('0.1');
		expect((manual['c:y'] as XmlObject)['@_val']).toBe('0.2');
	});

	it('does not treat a layout-only label (no show flags) as a delete override', () => {
		const ser = seriesNode();
		applySeriesDataLabelsToXml(ser, [{ idx: 0, layout: { x: 0.1, y: 0.2 } }], getLocalName);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect(dLbl['c:delete']).toBeUndefined();
		expect(dLbl['c:layout']).toBeDefined();
	});

	it('removes an existing manual layout when the model sets layout to null', () => {
		const ser = seriesNode();
		ser['c:dLbls'] = {
			'c:dLbl': {
				'c:idx': { '@_val': '0' },
				'c:layout': { 'c:manualLayout': { 'c:x': { '@_val': '0.1' } } },
				'c:showVal': { '@_val': '1' },
			},
		};
		applySeriesDataLabelsToXml(ser, [{ idx: 0, showVal: true, layout: null }], getLocalName);
		const dLbl = (ser['c:dLbls'] as XmlObject)['c:dLbl'] as XmlObject;
		expect(dLbl['c:layout']).toBeUndefined();
	});

	it('validates idx and dLblPos before serialization', () => {
		expect(() => applySeriesDataLabelsToXml(seriesNode(), [{ idx: -1 }], getLocalName)).toThrow(
			RangeError,
		);
		expect(() =>
			applySeriesDataLabelsToXml(
				seriesNode(),
				[{ idx: 0, position: 'sideways' as never }],
				getLocalName,
			),
		).toThrow(/Invalid data label position/u);
	});
});
