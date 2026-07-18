import { OPENXML_CHART_DISPLAY_EFFECTS_AND_DIAGRAM_LAYOUTS_COVERAGE } from './openxml-coverage-chart-display-effects-and-diagram-layouts';
import { OPENXML_COLORS_SHOWS_AND_LABELS_COVERAGE } from './openxml-coverage-colors-shows-and-labels';
import { OPENXML_COMMENTS_ANALYSIS_AND_FILLS_COVERAGE } from './openxml-coverage-comments-analysis-and-fills';
import { OPENXML_DIAGRAM_DATA_AND_EFFECTS_COVERAGE } from './openxml-coverage-diagram-data-and-effects';
import { OPENXML_EFFECT_DAGS_AXIS_LABELS_AND_DIAGRAM_STYLES_COVERAGE } from './openxml-coverage-effect-dags-axis-labels-and-diagram-styles';
import { testEvidence } from './openxml-coverage-evidence';
import { OPENXML_FONTS_AUDIO_PIVOTS_AND_ALGORITHMS_COVERAGE } from './openxml-coverage-fonts-audio-pivots-and-algorithms';
import { OPENXML_LINE_LAYOUT_AND_PIVOT_STRUCTURES_COVERAGE } from './openxml-coverage-line-layout-and-pivot-structures';
import { OPENXML_TRANSITIONS_SCENES_AND_CHART_TABLES_COVERAGE } from './openxml-coverage-transitions-scenes-and-chart-tables';
import { OPENXML_VIEW_IMAGE_AND_CHART_POINT_FORMATTING_COVERAGE } from './openxml-coverage-view-image-and-chart-point-formatting';
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

export type OpenXmlCoverageFacet = 'parse' | 'preserve' | 'edit' | 'serialize';

export interface OpenXmlCoverageEvidence {
	/** Test file relative to packages/core. */
	test: string;
	/** Exact test-name fragments that must remain present in the referenced file. */
	anchors: readonly string[];
	/** Coverage facets exercised by the referenced scenarios. */
	facets: readonly OpenXmlCoverageFacet[];
}

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
	evidence: readonly OpenXmlCoverageEvidence[];
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
	evidence: readonly OpenXmlCoverageEvidence[];
};

const UNASSESSED: OpenXmlCoverageFacets = {
	parse: 'unassessed',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	evidence: [],
};

/**
 * Curated capability declarations. These summarize separately implemented and tested behavior;
 * they are not generated from test execution. Everything else remains explicitly unassessed.
 */
const COVERAGE_OVERRIDES: Record<string, OpenXmlCoverageFacets> = {
	...OPENXML_COLORS_SHOWS_AND_LABELS_COVERAGE,
	...OPENXML_COMMENTS_ANALYSIS_AND_FILLS_COVERAGE,
	...OPENXML_DIAGRAM_DATA_AND_EFFECTS_COVERAGE,
	...OPENXML_TRANSITIONS_SCENES_AND_CHART_TABLES_COVERAGE,
	...OPENXML_CHART_DISPLAY_EFFECTS_AND_DIAGRAM_LAYOUTS_COVERAGE,
	...OPENXML_EFFECT_DAGS_AXIS_LABELS_AND_DIAGRAM_STYLES_COVERAGE,
	...OPENXML_VIEW_IMAGE_AND_CHART_POINT_FORMATTING_COVERAGE,
	...OPENXML_FONTS_AUDIO_PIVOTS_AND_ALGORITHMS_COVERAGE,
	...OPENXML_LINE_LAYOUT_AND_PIVOT_STRUCTURES_COVERAGE,
	'chart:complexType:CT_ManualLayout': {
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed title, plot-area, and legend manual layout support.',
		evidence: [
			testEvidence(
				'src/core/utils/chart-axis-parser.test.ts',
				['parses display-unit label text, manual layout, and shape properties'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-axis-dispunits-serializer.test.ts',
				['edits label text, layout, and shape properties in schema order'],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
	'chart:complexType:CT_Layout': {
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Manual layout and its CT_ManualLayout extension list round-trip through the typed model (the extLst is captured on parse and re-emitted as the trailing child on a dirty write, so an edit no longer drops it). The layout wrapper is retained verbatim.',
		evidence: [
			testEvidence(
				'src/core/utils/chart-axis-parser.test.ts',
				['parses display-unit label text, manual layout, and shape properties'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-layout.test.ts',
				['parses the typed manual-layout fields'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-layout.test.ts',
				['round-trips the manual layout extension list through the typed model'],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
	'chart:complexType:CT_BubbleChart': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Display options are typed; series and extensions have separate capability entries.',
		evidence: [
			testEvidence('src/core/utils/chart-bubble-options.test.ts', [
				'parses Strict and Transitional values plus defaults',
				'preserves unknown attributes and follows CT_BubbleChart order',
			]),
		],
	},
	'chart:complexType:CT_LegendEntry': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Index, delete, and common txPr defaults are typed; extensions remain passthrough.',
		evidence: [
			testEvidence('src/core/utils/chart-legend-entry.test.ts', [
				'parses delete values and the CT_Boolean default',
				'edits an entry while preserving its extension list',
			]),
		],
	},
	'chart:group:EG_LegendEntryData': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common text defaults are typed; the full DrawingML text body remains passthrough.',
		evidence: [
			testEvidence('src/core/utils/chart-legend-entry.test.ts', [
				'parses common DrawingML text defaults',
				'adds a hidden entry to a newly created legend',
			]),
		],
	},
	'chart:complexType:CT_UpDownBars': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Gap width and common up/down bar shape properties are typed; extensions are passthrough.',
		evidence: [
			testEvidence('src/core/utils/chart-up-down-bars.test.ts', [
				'parses gap width and both shape-property branches',
				'updates formatting while preserving unsupported children',
			]),
		],
	},
	'chart:complexType:CT_UpDownBar': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common fill and line properties are typed; other DrawingML shape properties are passthrough.',
		evidence: [
			testEvidence('src/core/utils/chart-up-down-bars.test.ts', [
				'updates formatting while preserving unsupported children',
				'emits up/down bars for a generated line chart',
			]),
		],
	},
	'presentation:complexType:CT_ControlList': {
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'The `p:controls` container round-trips: controls can be parsed, added, removed, and reordered.',
		evidence: [
			testEvidence('src/core/utils/activex-serializer.test.ts', [
				'round-trips typed ActiveX controls through parse and serialize',
				'drops the controls container when no controls remain',
				'keeps the controls container ahead of the extension list',
			]),
		],
	},
	'presentation:element:controls': {
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'The `p:controls` container round-trips: controls can be parsed, added, removed, and reordered.',
		evidence: [
			testEvidence('src/core/utils/activex-serializer.test.ts', [
				'round-trips typed ActiveX controls through parse and serialize',
				'drops the controls container when no controls remain',
			]),
		],
	},
	'presentation:complexType:CT_Control': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'The r:id, name, and spid attributes are typed and editable; the placeholder pic and extLst children are preserved as passthrough. Not rendered by any binding.',
		evidence: [
			testEvidence('src/core/utils/activex-serializer.test.ts', [
				'round-trips typed ActiveX controls through parse and serialize',
				'preserves the placeholder pic child during a typed write',
				'serializes edited control attributes back into the slide',
			]),
		],
	},
	'presentation:element:control': {
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'The r:id, name, and spid attributes are typed and editable; the placeholder pic and extLst children are preserved as passthrough. Not rendered by any binding.',
		evidence: [
			testEvidence('src/core/utils/activex-serializer.test.ts', [
				'preserves the placeholder pic child during a typed write',
				'serializes edited control attributes back into the slide',
				'emits a bare control node when only a relationship id is known',
			]),
		],
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
		evidence: [
			testEvidence('src/core/utils/chart-bubble-options.test.ts', [
				'parses Strict and Transitional values plus defaults',
				'preserves unknown attributes and follows CT_BubbleChart order',
				'rejects an out-of-range scale',
				'emits options for a generated bubble chart',
			]),
		],
	};
}

const STRICT_IDS = new Set<string>(OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS);
const TRANSITIONAL_IDS = new Set<string>(OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS);
const SCHEMA_IDS = new Set<string>(OPENXML_SCHEMA_CONSTRUCT_IDS);

for (const id of Object.keys(COVERAGE_OVERRIDES)) {
	if (!SCHEMA_IDS.has(id)) {
		throw new Error(`OpenXML coverage override does not match the schema inventory: ${id}`);
	}
}

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
