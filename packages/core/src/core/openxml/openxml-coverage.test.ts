import { describe, expect, it } from 'vitest';

import {
	findOpenXmlCoverage,
	listUnassessedOpenXmlCoverage,
	OPENXML_COVERAGE,
	OPENXML_SCHEMA_CONSTRUCT_IDS,
	OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS,
	OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS,
	summarizeOpenXmlCoverage,
	summarizeOpenXmlCoverageByVocabulary,
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
		expect(findOpenXmlCoverage('chart:complexType:CT_LegendEntry')).toMatchObject({
			parse: 'partial',
			preserve: 'passthrough',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('chart:complexType:CT_UpDownBars')).toMatchObject({
			parse: 'partial',
			preserve: 'passthrough',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('drawing:complexType:CT_SRgbColor')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('drawing:group:EG_ColorChoice')).toMatchObject({
			parse: 'partial',
			preserve: 'passthrough',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('presentation:complexType:CT_CustomShow')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('diagram:complexType:CT_RelIds')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('chart:complexType:CT_DLbls')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('chart:element:dLblPos')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('presentation:complexType:CT_Comment')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('chart:complexType:CT_TrendlineLbl')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('drawing:complexType:CT_GradientFillProperties')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('diagram:complexType:CT_DataModel')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('drawing:complexType:CT_OuterShadowEffect')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('presentation:complexType:CT_SlideTransition')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('drawing:complexType:CT_Scene3D')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('chart:complexType:CT_DTable')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('chart:complexType:CT_DispUnitsLbl')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('drawing:complexType:CT_ReflectionEffect')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('diagram:complexType:CT_DiagramDefinition')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('drawing:complexType:CT_EffectContainer')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
		expect(findOpenXmlCoverage('chart:simpleType:ST_TickMark')).toMatchObject({
			parse: 'native',
			preserve: 'native',
			edit: 'native',
			serialize: 'native',
		});
		expect(findOpenXmlCoverage('diagram:complexType:CT_StyleDefinition')).toMatchObject({
			parse: 'partial',
			preserve: 'native',
			edit: 'partial',
			serialize: 'partial',
		});
	});

	it('summarizes every facet', () => {
		const summary = summarizeOpenXmlCoverage();
		expect(Object.values(summary).reduce((sum, count) => sum + count, 0)).toBe(
			OPENXML_COVERAGE.length * 4,
		);
	});

	it('reports the remaining gaps by vocabulary without losing assessed work', () => {
		const summary = summarizeOpenXmlCoverageByVocabulary();
		expect(summary.presentation).toMatchObject({ constructs: 619 });
		expect(summary.drawing).toMatchObject({ constructs: 889 });
		expect(summary.chart).toMatchObject({ constructs: 461 });
		expect(summary.diagram).toMatchObject({ constructs: 269 });
		expect(
			Object.values(summary).reduce(
				(total, entry) =>
					total + Object.values(entry.facets).reduce((sum, count) => sum + count, 0),
				0,
			),
		).toBe(OPENXML_COVERAGE.length * 4);
		expect(listUnassessedOpenXmlCoverage('chart')).toHaveLength(379);
		expect(listUnassessedOpenXmlCoverage('presentation')).toHaveLength(598);
		expect(listUnassessedOpenXmlCoverage('drawing')).toHaveLength(842);
		expect(listUnassessedOpenXmlCoverage('diagram')).toHaveLength(217);
	});

	it('keeps assessed capabilities documented and monotonic', () => {
		const assessed = OPENXML_COVERAGE.filter((entry) =>
			(['parse', 'preserve', 'edit', 'serialize'] as const).some(
				(facet) => entry[facet] !== 'unassessed',
			),
		);
		expect(assessed.length).toBeGreaterThanOrEqual(17);
		expect(assessed.every((entry) => Boolean(entry.note))).toBeTruthy();
	});
});
