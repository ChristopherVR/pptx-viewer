import { describe, it, expect } from 'vitest';

import type { PptxChartSeries, XmlObject } from '../types';
import {
	applyComboSeriesTypesToXml,
	consolidateComboContainersInXml,
} from './chart-combo-serializer';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function plotArea(): XmlObject {
	return {
		'c:layout': {},
		'c:barChart': {
			'c:grouping': { '@_val': 'clustered' },
			'c:ser': [
				{ 'c:idx': { '@_val': '0' }, 'c:tx': { 'c:v': 'A' } },
				{ 'c:idx': { '@_val': '1' }, 'c:tx': { 'c:v': 'B' } },
			],
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		},
		'c:catAx': { 'c:axId': { '@_val': '1' } },
		'c:valAx': { 'c:axId': { '@_val': '2' } },
	};
}

const series = (types: (string | undefined)[]): PptxChartSeries[] =>
	types.map((t, i) => ({
		name: `S${i}`,
		values: [],
		seriesChartType: t as PptxChartSeries['seriesChartType'],
	}));

describe('applyComboSeriesTypesToXml', () => {
	it('no-ops when all series resolve to the same type', () => {
		const pa = plotArea();
		const did = applyComboSeriesTypesToXml(
			pa,
			'c:barChart',
			series([undefined, undefined]),
			'bar',
			getLocalName,
		);
		expect(did).toBeFalsy();
		expect(pa['c:barChart']).toBeDefined();
		expect(pa['c:lineChart']).toBeUndefined();
	});

	it('splits into bar + line containers, preserving axes', () => {
		const pa = plotArea();
		const did = applyComboSeriesTypesToXml(
			pa,
			'c:barChart',
			series([undefined, 'line']),
			'bar',
			getLocalName,
		);
		expect(did).toBeTruthy();
		const bar = pa['c:barChart'] as XmlObject;
		const line = pa['c:lineChart'] as XmlObject;
		expect(bar).toBeDefined();
		expect(line).toBeDefined();
		// Series partitioned by type.
		expect((bar['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'A' });
		expect((line['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'B' });
		// Shared children (grouping, axId) cloned into both.
		expect(bar['c:grouping']).toBeDefined();
		expect(line['c:grouping']).toBeDefined();
		// Axes preserved.
		expect(pa['c:catAx']).toBeDefined();
		expect(pa['c:valAx']).toBeDefined();
	});

	it('keeps containers in plotArea position (before axes)', () => {
		const pa = plotArea();
		applyComboSeriesTypesToXml(pa, 'c:barChart', series([undefined, 'line']), 'bar', getLocalName);
		const keys = Object.keys(pa).map(getLocalName);
		expect(keys.indexOf('barChart')).toBeLessThan(keys.indexOf('catAx'));
		expect(keys.indexOf('lineChart')).toBeLessThan(keys.indexOf('catAx'));
	});
});

/** A combo plotArea with two chart-type containers, each holding one series. */
function comboPlotArea(): XmlObject {
	return {
		'c:layout': {},
		'c:barChart': {
			'c:grouping': { '@_val': 'clustered' },
			'c:ser': { 'c:idx': { '@_val': '0' }, 'c:tx': { 'c:v': 'A' } },
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		},
		'c:lineChart': {
			'c:grouping': { '@_val': 'standard' },
			'c:ser': { 'c:idx': { '@_val': '1' }, 'c:tx': { 'c:v': 'B' } },
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		},
		'c:catAx': { 'c:axId': { '@_val': '1' } },
		'c:valAx': { 'c:axId': { '@_val': '2' } },
	};
}

describe('consolidateComboContainersInXml', () => {
	it('returns the single container key and leaves it untouched', () => {
		const pa = plotArea();
		const key = consolidateComboContainersInXml(pa, getLocalName);
		expect(key).toBe('c:barChart');
		expect(Object.keys(pa).filter((k) => getLocalName(k).endsWith('Chart'))).toHaveLength(1);
	});

	it('returns undefined when no chart-type container exists', () => {
		const pa: XmlObject = { 'c:layout': {}, 'c:catAx': {} };
		expect(consolidateComboContainersInXml(pa, getLocalName)).toBeUndefined();
	});

	it('merges multiple containers into the first, concatenating series', () => {
		const pa = comboPlotArea();
		const key = consolidateComboContainersInXml(pa, getLocalName);
		expect(key).toBe('c:barChart');
		// The line container is gone.
		expect(pa['c:lineChart']).toBeUndefined();
		// The bar container now carries both series in document order.
		const sers = pa['c:barChart'] as XmlObject;
		const list = sers['c:ser'] as XmlObject[];
		expect(Array.isArray(list)).toBeTruthy();
		expect(list).toHaveLength(2);
		expect((list[0]['c:tx'] as XmlObject)['c:v']).toBe('A');
		expect((list[1]['c:tx'] as XmlObject)['c:v']).toBe('B');
		// Axes preserved.
		expect(pa['c:catAx']).toBeDefined();
		expect(pa['c:valAx']).toBeDefined();
	});

	it('round-trips: consolidate then re-split restores per-type containers', () => {
		const pa = comboPlotArea();
		const key = consolidateComboContainersInXml(pa, getLocalName)!;
		const did = applyComboSeriesTypesToXml(
			pa,
			key,
			series([undefined, 'line']),
			'bar',
			getLocalName,
		);
		expect(did).toBeTruthy();
		const bar = pa['c:barChart'] as XmlObject;
		const line = pa['c:lineChart'] as XmlObject;
		expect((bar['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'A' });
		expect((line['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'B' });
	});
});
