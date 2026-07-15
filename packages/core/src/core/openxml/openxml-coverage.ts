import { OPENXML_WAVE5_COVERAGE_OVERRIDES } from './openxml-coverage-wave5';
import {
	OPENXML_SCHEMA_CONSTRUCT_IDS,
	OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS,
	OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS,
} from './schema-constructs.generated';

export type OpenXmlCoverageLevel =
	| 'native'
	| 'partial'
	| 'passthrough'
	| 'unsupported'
	| 'unassessed';

export interface OpenXmlConstructCoverage {
	id: string;
	vocabulary: 'presentation' | 'drawing' | 'chart' | 'diagram';
	kind: 'element' | 'complexType' | 'simpleType' | 'attribute' | 'group' | 'attributeGroup';
	name: string;
	conformance: 'strict' | 'transitional' | 'both';
	parse: OpenXmlCoverageLevel;
	preserve: OpenXmlCoverageLevel;
	edit: OpenXmlCoverageLevel;
	serialize: OpenXmlCoverageLevel;
	note?: string;
}

export type OpenXmlVocabulary = OpenXmlConstructCoverage['vocabulary'];

export interface OpenXmlCoverageSummary {
	constructs: number;
	facets: Record<OpenXmlCoverageLevel, number>;
}

export type OpenXmlCoverageFacets = Pick<
	OpenXmlConstructCoverage,
	'parse' | 'preserve' | 'edit' | 'serialize'
> & {
	note?: string;
};

const UNASSESSED: OpenXmlCoverageFacets = {
	parse: 'unassessed',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
};

/** Curated, test-backed overrides. Everything else remains explicitly unassessed. */
const COVERAGE_OVERRIDES: Record<string, OpenXmlCoverageFacets> = {
	...OPENXML_WAVE5_COVERAGE_OVERRIDES,
	'chart:complexType:CT_ManualLayout': {
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed title, plot-area, and legend manual layout support.',
	},
	'chart:complexType:CT_Layout': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Manual layout is typed; extension-list content is passthrough only.',
	},
	'chart:complexType:CT_BubbleChart': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Display options are typed; series and extensions have separate capability entries.',
	},
	'chart:complexType:CT_LegendEntry': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Index, delete, and common txPr defaults are typed; extensions remain passthrough.',
	},
	'chart:group:EG_LegendEntryData': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common text defaults are typed; the full DrawingML text body remains passthrough.',
	},
	'chart:complexType:CT_UpDownBars': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Gap width and common up/down bar shape properties are typed; extensions are passthrough.',
	},
	'chart:complexType:CT_UpDownBar': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common fill and line properties are typed; other DrawingML shape properties are passthrough.',
	},
};

for (const id of [
	'chart:complexType:CT_BubbleScale',
	'chart:complexType:CT_SizeRepresents',
	'chart:simpleType:ST_BubbleScale',
	'chart:simpleType:ST_BubbleScalePercent',
	'chart:simpleType:ST_BubbleScaleUInt',
	'chart:simpleType:ST_SizeRepresents',
	'chart:element:bubble3D',
	'chart:element:bubbleScale',
	'chart:element:showNegBubbles',
	'chart:element:sizeRepresents',
]) {
	COVERAGE_OVERRIDES[id] = {
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed classic bubble-chart option support.',
	};
}

const STRICT_IDS = new Set<string>(OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS);
const TRANSITIONAL_IDS = new Set<string>(OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS);

/**
 * Strict-schema inventory for PPTX-relevant PresentationML and DrawingML.
 * Entries are never inferred as supported: unreviewed constructs stay unassessed.
 */
export const OPENXML_COVERAGE: readonly OpenXmlConstructCoverage[] =
	OPENXML_SCHEMA_CONSTRUCT_IDS.map((id) => {
		const [vocabulary, kind, name] = id.split(':') as [
			OpenXmlConstructCoverage['vocabulary'],
			OpenXmlConstructCoverage['kind'],
			string,
		];
		const strict = STRICT_IDS.has(id);
		const transitional = TRANSITIONAL_IDS.has(id);
		const conformance = strict && transitional ? 'both' : strict ? 'strict' : 'transitional';
		return { id, vocabulary, kind, name, conformance, ...(COVERAGE_OVERRIDES[id] ?? UNASSESSED) };
	});

export function findOpenXmlCoverage(id: string): OpenXmlConstructCoverage | undefined {
	return OPENXML_COVERAGE.find((entry) => entry.id === id);
}

export function summarizeOpenXmlCoverage(): Record<OpenXmlCoverageLevel, number> {
	const result: Record<OpenXmlCoverageLevel, number> = {
		native: 0,
		partial: 0,
		passthrough: 0,
		unsupported: 0,
		unassessed: 0,
	};
	for (const entry of OPENXML_COVERAGE) {
		for (const facet of ['parse', 'preserve', 'edit', 'serialize'] as const) {
			result[entry[facet]] += 1;
		}
	}
	return result;
}

export function summarizeOpenXmlCoverageByVocabulary(): Record<
	OpenXmlVocabulary,
	OpenXmlCoverageSummary
> {
	const vocabularies: OpenXmlVocabulary[] = ['presentation', 'drawing', 'chart', 'diagram'];
	return Object.fromEntries(
		vocabularies.map((vocabulary) => {
			const entries = OPENXML_COVERAGE.filter((entry) => entry.vocabulary === vocabulary);
			const facets: Record<OpenXmlCoverageLevel, number> = {
				native: 0,
				partial: 0,
				passthrough: 0,
				unsupported: 0,
				unassessed: 0,
			};
			for (const entry of entries) {
				for (const facet of ['parse', 'preserve', 'edit', 'serialize'] as const) {
					facets[entry[facet]] += 1;
				}
			}
			return [vocabulary, { constructs: entries.length, facets }];
		}),
	) as Record<OpenXmlVocabulary, OpenXmlCoverageSummary>;
}

export function listUnassessedOpenXmlCoverage(
	vocabulary?: OpenXmlVocabulary,
): OpenXmlConstructCoverage[] {
	return OPENXML_COVERAGE.filter(
		(entry) =>
			(vocabulary === undefined || entry.vocabulary === vocabulary) &&
			(['parse', 'preserve', 'edit', 'serialize'] as const).some(
				(facet) => entry[facet] === 'unassessed',
			),
	);
}
