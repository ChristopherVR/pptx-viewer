import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import {
	chartContainerAllows,
	chartContainerHasAxes,
	chartTypeToContainerLocalName,
	isKnownChartContainer,
	normalizeChartContainerChildren,
	orderChartContainerChildren,
	reconcileChartPlotAreaAxes,
	renameXmlKeyInPlace,
} from './chart-container-schema';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

const locals = (obj: XmlObject): string[] => Object.keys(obj).map(getLocalName);

describe('chartTypeToContainerLocalName', () => {
	it('maps every classic chart type, including the ones the combo split used to miss', () => {
		expect(chartTypeToContainerLocalName('stock')).toBe('stockChart');
		expect(chartTypeToContainerLocalName('ofPie')).toBe('ofPieChart');
		expect(chartTypeToContainerLocalName('surface')).toBe('surfaceChart');
		expect(chartTypeToContainerLocalName('bar3D')).toBe('bar3DChart');
		expect(chartTypeToContainerLocalName('line3D')).toBe('line3DChart');
		expect(chartTypeToContainerLocalName('pie3D')).toBe('pie3DChart');
		expect(chartTypeToContainerLocalName('area3D')).toBe('area3DChart');
	});

	it('returns undefined for chartex kinds and the synthetic types', () => {
		for (const t of ['waterfall', 'funnel', 'treemap', 'sunburst', 'combo', 'unknown'] as const) {
			expect(chartTypeToContainerLocalName(t)).toBeUndefined();
		}
	});
});

describe('content model queries', () => {
	it('knows which containers carry axes', () => {
		expect(chartContainerHasAxes('barChart')).toBeTruthy();
		expect(chartContainerHasAxes('lineChart')).toBeTruthy();
		expect(chartContainerHasAxes('pieChart')).toBeFalsy();
		expect(chartContainerHasAxes('doughnutChart')).toBeFalsy();
		expect(chartContainerHasAxes('ofPieChart')).toBeFalsy();
	});

	it('rejects bar-only children on a line container and vice versa', () => {
		expect(chartContainerAllows('lineChart', 'barDir')).toBeFalsy();
		expect(chartContainerAllows('lineChart', 'gapWidth')).toBeFalsy();
		expect(chartContainerAllows('lineChart', 'overlap')).toBeFalsy();
		expect(chartContainerAllows('lineChart', 'marker')).toBeTruthy();
		expect(chartContainerAllows('barChart', 'marker')).toBeFalsy();
		expect(chartContainerAllows('pieChart', 'axId')).toBeFalsy();
	});

	it('flags unmodelled container names', () => {
		expect(isKnownChartContainer('barChart')).toBeTruthy();
		expect(isKnownChartContainer('funnelChart')).toBeFalsy();
	});
});

describe('normalizeChartContainerChildren', () => {
	it('strips bar-only children when a bar container becomes a pie container', () => {
		const container: XmlObject = {
			'c:barDir': { '@_val': 'col' },
			'c:grouping': { '@_val': 'clustered' },
			'c:varyColors': { '@_val': '0' },
			'c:ser': {},
			'c:dLbls': {},
			'c:gapWidth': { '@_val': '182' },
			'c:overlap': { '@_val': '-27' },
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		};
		normalizeChartContainerChildren(container, 'pieChart', getLocalName);
		expect(locals(container)).toStrictEqual(['varyColors', 'ser', 'dLbls']);
	});

	it('adds the required leading child a container cannot omit', () => {
		const container: XmlObject = { 'c:ser': {} };
		normalizeChartContainerChildren(container, 'barChart', getLocalName);
		expect(container['c:barDir']).toStrictEqual({ '@_val': 'col' });
	});

	it('demotes a clustered grouping for non-bar containers only', () => {
		const line: XmlObject = { 'c:grouping': { '@_val': 'clustered' }, 'c:ser': {} };
		normalizeChartContainerChildren(line, 'lineChart', getLocalName);
		expect(line['c:grouping']).toStrictEqual({ '@_val': 'standard' });

		const bar: XmlObject = {
			'c:barDir': { '@_val': 'col' },
			'c:grouping': { '@_val': 'clustered' },
		};
		normalizeChartContainerChildren(bar, 'barChart', getLocalName);
		expect(bar['c:grouping']).toStrictEqual({ '@_val': 'clustered' });
	});

	it('leaves an unmodelled container alone', () => {
		const container: XmlObject = { 'c:anything': {} };
		normalizeChartContainerChildren(container, 'funnelChart', getLocalName);
		expect(container['c:anything']).toBeDefined();
	});
});

describe('orderChartContainerChildren', () => {
	it('puts c:ser back before c:axId', () => {
		const container: XmlObject = {
			'c:barDir': {},
			'c:gapWidth': {},
			'c:axId': [],
			'c:ser': {},
			'c:grouping': {},
		};
		orderChartContainerChildren(container, 'barChart', getLocalName);
		expect(locals(container)).toStrictEqual(['barDir', 'grouping', 'ser', 'gapWidth', 'axId']);
	});

	it('bails out when the container holds a child it does not model', () => {
		const container: XmlObject = {
			'c:axId': [],
			'mc:AlternateContent': {},
			'c:ser': {},
		};
		orderChartContainerChildren(container, 'barChart', getLocalName);
		expect(locals(container)).toStrictEqual(['axId', 'AlternateContent', 'ser']);
	});
});

describe('renameXmlKeyInPlace', () => {
	it('keeps the renamed key in its original position', () => {
		const plotArea: XmlObject = {
			'c:layout': {},
			'c:barChart': {},
			'c:catAx': {},
			'c:valAx': {},
		};
		renameXmlKeyInPlace(plotArea, 'c:barChart', 'c:pieChart');
		expect(Object.keys(plotArea)).toStrictEqual(['c:layout', 'c:pieChart', 'c:catAx', 'c:valAx']);
	});
});

describe('reconcileChartPlotAreaAxes', () => {
	it('drops axes no chart group references any more', () => {
		const plotArea: XmlObject = {
			'c:layout': {},
			'c:pieChart': { 'c:ser': {} },
			'c:catAx': { 'c:axId': { '@_val': '1' } },
			'c:valAx': { 'c:axId': { '@_val': '2' } },
		};
		expect(reconcileChartPlotAreaAxes(plotArea, getLocalName)).toBe(2);
		expect(plotArea['c:catAx']).toBeUndefined();
		expect(plotArea['c:valAx']).toBeUndefined();
	});

	it('keeps referenced axes and drops only the orphans', () => {
		const plotArea: XmlObject = {
			'c:barChart': { 'c:axId': [{ '@_val': '1' }, { '@_val': '2' }] },
			'c:catAx': [{ 'c:axId': { '@_val': '1' } }, { 'c:axId': { '@_val': '3' } }],
			'c:valAx': { 'c:axId': { '@_val': '2' } },
		};
		expect(reconcileChartPlotAreaAxes(plotArea, getLocalName)).toBe(1);
		expect(plotArea['c:catAx']).toStrictEqual({ 'c:axId': { '@_val': '1' } });
		expect(plotArea['c:valAx']).toBeDefined();
	});
});
