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

type Facets = Pick<OpenXmlConstructCoverage, 'parse' | 'preserve' | 'edit' | 'serialize'> & {
	note?: string;
};

const UNASSESSED: Facets = {
	parse: 'unassessed',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
};

/** Curated, test-backed overrides. Everything else remains explicitly unassessed. */
const COVERAGE_OVERRIDES: Record<string, Facets> = {
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
