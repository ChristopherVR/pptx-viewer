import { describe, it, expect } from 'vitest';

import {
	chartContainerLocalNameToType,
	isChartTypeContainerLocalName,
} from './chart-container-type-map';

describe('chartContainerLocalNameToType', () => {
	it('maps each known container local name to its chart type', () => {
		expect(chartContainerLocalNameToType('barChart')).toBe('bar');
		expect(chartContainerLocalNameToType('lineChart')).toBe('line');
		expect(chartContainerLocalNameToType('areaChart')).toBe('area');
		expect(chartContainerLocalNameToType('pieChart')).toBe('pie');
		expect(chartContainerLocalNameToType('doughnutChart')).toBe('doughnut');
		expect(chartContainerLocalNameToType('scatterChart')).toBe('scatter');
		expect(chartContainerLocalNameToType('bubbleChart')).toBe('bubble');
		expect(chartContainerLocalNameToType('radarChart')).toBe('radar');
		expect(chartContainerLocalNameToType('bar3DChart')).toBe('bar3D');
		expect(chartContainerLocalNameToType('surface3DChart')).toBe('surface');
	});

	it('returns undefined for unrecognised names', () => {
		expect(chartContainerLocalNameToType('catAx')).toBeUndefined();
		expect(chartContainerLocalNameToType('plotAreaRegion')).toBeUndefined();
		expect(chartContainerLocalNameToType('')).toBeUndefined();
	});
});

describe('isChartTypeContainerLocalName', () => {
	it('is true for chart-type containers', () => {
		expect(isChartTypeContainerLocalName('barChart')).toBeTruthy();
		expect(isChartTypeContainerLocalName('lineChart')).toBeTruthy();
	});

	it('is false for non-container names', () => {
		expect(isChartTypeContainerLocalName('valAx')).toBeFalsy();
		expect(isChartTypeContainerLocalName('ser')).toBeFalsy();
	});
});
