import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'presentation:complexType:CT_Kinsoku',
		'presentation:element:kinsoku',
		'presentation:attribute:invalStChars',
		'presentation:attribute:invalEndChars',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed and validated East Asian line-break settings with ordered presentation edits.',
		evidence: [
			testEvidence('src/core/utils/activex-kinsoku-parser.test.ts', [
				'parses all attributes together',
				'rejects a new p:kinsoku without both required character lists',
				'preserves existing p:kinsoku attributes not in the kinsoku object',
			]),
			testEvidence('src/__tests__/integration/kinsoku-roundtrip.test.ts', [
				'loads an alternate prefix, edits values, and preserves unknown XML',
				'removes kinsoku without disturbing adjacent presentation children',
			]),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_DashStopList',
		'drawing:complexType:CT_DashStop',
		'drawing:element:custDash',
		'drawing:element:ds',
		'drawing:attribute:d',
		'drawing:attribute:sp',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Validated DrawingML custom dash percentages shared by shape and connector writers.',
		evidence: [
			testEvidence('src/core/utils/drawing-line-dash.test.ts', [
				'parses arbitrary prefixes and preserves dash-stop payloads',
				'round-trips unchanged XML and edits values without losing unknown data',
				'rejects invalid stops and removes arbitrary-prefixed dash choices',
				'inserts custom dash before line joins and extensions',
			]),
		],
	},
);

assign(
	[
		'chart:complexType:CT_PivotFmts',
		'chart:complexType:CT_PivotFmt',
		'chart:element:pivotFmts',
		'chart:element:pivotFmt',
		'chart:element:idx',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Pivot indexes are typed; DrawingML formatting children remain editable raw XML.',
		evidence: [
			testEvidence('src/core/utils/chart-pivot-formats.test.ts', [
				'parses, edits, serializes, and reparses typed pivot formats',
				'inserts in chart schema order and supports removal',
				'rejects invalid indexes and empty collections',
			]),
			testEvidence('src/__tests__/integration/chart-protection-roundtrip.test.ts', [
				'loads, edits, saves, and reloads pivot formats without losing extensions',
			]),
		],
	},
);

assign(
	[
		'diagram:complexType:CT_Choose',
		'diagram:complexType:CT_ForEach',
		'diagram:complexType:CT_Otherwise',
		'diagram:complexType:CT_When',
		'diagram:element:choose',
		'diagram:element:else',
		'diagram:element:forEach',
		'diagram:element:if',
		'diagram:attributeGroup:AG_IteratorAttributes',
		'diagram:attribute:arg',
		'diagram:attribute:axis',
		'diagram:attribute:cnt',
		'diagram:attribute:func',
		'diagram:attribute:hideLastTrans',
		'diagram:attribute:st',
		'diagram:attribute:step',
		'diagram:simpleType:ST_AxisTypes',
		'diagram:simpleType:ST_ElementTypes',
		'diagram:simpleType:ST_FunctionArgument',
		'diagram:simpleType:ST_FunctionOperator',
		'diagram:simpleType:ST_FunctionType',
		'diagram:simpleType:ST_FunctionValue',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Iterator and condition data is typed; nested layout actions and enum unions remain raw.',
		evidence: [
			testEvidence('src/core/utils/smartart-layout-definition.test.ts', [
				'parses CT_DiagramDefinition and recursive CT_LayoutNode with arbitrary prefixes',
				'surgically edits typed fields and preserves algorithms, unknown data, and extLst',
				'creates and removes typed forEach and choose branches',
				'rejects invalid required values and unsigned integer facets',
			]),
		],
	},
);

export const OPENXML_LINE_LAYOUT_AND_PIVOT_STRUCTURES_COVERAGE = overrides;
