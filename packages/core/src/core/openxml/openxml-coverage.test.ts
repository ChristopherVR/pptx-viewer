import { describe, expect, it } from 'vitest';

import {
	findOpenXmlCoverage,
	OPENXML_COVERAGE,
	OPENXML_SCHEMA_CONSTRUCT_IDS,
	OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS,
	OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS,
	summarizeOpenXmlCoverage,
} from './index';

describe('open XML schema coverage inventory', () => {
	it('contains unique named declarations from both conformance classes', () => {
		expect(OPENXML_SCHEMA_CONSTRUCT_IDS).toHaveLength(2238);
		expect(OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS).toHaveLength(2196);
		expect(OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS).toHaveLength(2238);
		expect(new Set(OPENXML_SCHEMA_CONSTRUCT_IDS).size).toBe(2238);
		expect(OPENXML_COVERAGE.filter((entry) => entry.conformance === 'transitional')).toHaveLength(
			42,
		);
		expect(OPENXML_COVERAGE.filter((entry) => entry.conformance === 'strict')).toHaveLength(0);
	});

	it('inventories vocabularies and expanded declaration kinds', () => {
		expect(
			Object.fromEntries(
				['presentation', 'drawing', 'chart', 'diagram'].map((vocabulary) => [
					vocabulary,
					OPENXML_COVERAGE.filter((entry) => entry.vocabulary === vocabulary).length,
				]),
			),
		).toStrictEqual({ presentation: 619, drawing: 889, chart: 461, diagram: 269 });
		expect(findOpenXmlCoverage('chart:simpleType:ST_BubbleScaleUInt')).toMatchObject({
			kind: 'simpleType',
			conformance: 'transitional',
		});
		expect(findOpenXmlCoverage('presentation:attribute:allowPng')).toMatchObject({
			kind: 'attribute',
			conformance: 'transitional',
		});
		expect(findOpenXmlCoverage('drawing:group:EG_FillProperties')).toMatchObject({
			kind: 'group',
			conformance: 'both',
		});
	});

	it('keeps unreviewed constructs unassessed and records tested overrides', () => {
		expect(findOpenXmlCoverage('diagram:complexType:CT_Algorithm')).toMatchObject({
			parse: 'unassessed',
			preserve: 'unassessed',
			edit: 'unassessed',
			serialize: 'unassessed',
		});
		expect(findOpenXmlCoverage('chart:complexType:CT_ManualLayout')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('chart:element:bubbleScale')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
	});

	it('summarizes every facet', () => {
		const summary = summarizeOpenXmlCoverage();
		expect(Object.values(summary).reduce((sum, count) => sum + count, 0)).toBe(
			OPENXML_COVERAGE.length * 4,
		);
	});
});
