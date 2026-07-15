import { OPENXML_SCHEMA_CONSTRUCT_IDS } from './schema-constructs.generated';

export type OpenXmlCoverageLevel =
	| 'native'
	| 'partial'
	| 'passthrough'
	| 'unsupported'
	| 'unassessed';

export interface OpenXmlConstructCoverage {
	id: string;
	vocabulary: 'presentation' | 'drawing' | 'chart' | 'diagram';
	kind: 'element' | 'complexType';
	name: string;
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
const COVERAGE_OVERRIDES: Readonly<Record<string, Facets>> = {
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
};

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
		return { id, vocabulary, kind, name, ...(COVERAGE_OVERRIDES[id] ?? UNASSESSED) };
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
