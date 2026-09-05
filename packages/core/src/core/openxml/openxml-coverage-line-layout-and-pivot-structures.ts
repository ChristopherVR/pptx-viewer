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
		note: "Pivot indexes are typed. Since wave 4 (W4-D), each entry's DrawingML formatting children are ALSO independently modeled fields, not only editable raw XML: spPr (fill/stroke colour, stroke width, dash style), txPr (paragraph defRPr font family/size/bold/italic/colour), and marker (symbol/size/spPr), via chart-pivot-format-fields.ts's parseTypedShapeProps/parseTypedTextStyle/parseTypedMarker, each with a lossless fallback to its raw *Xml sibling (markerXml/txPrXml/shapePropertiesXml) for whatever the typed projection does not cover. A literal a:srgbClr always resolves to a typed colour; since wave 5 (W5-E) an a:schemeClr theme reference (with its lumMod/lumOff/tint/shade modifiers) resolves too whenever the caller supplies a ChartColorParser (the runtime hands in its theme-aware parseColor, so a loaded deck gets themed hex values), while a caller without one still sees the theme reference only through the raw XML fallback; a typed edit that does not touch the colour leaves the authored schemeClr fill in place rather than baking the resolved hex. A typed field is compared against what would parse back off the existing node before deciding to rewrite it, so an untouched entry survives byte-for-byte and only a genuine typed edit forces a rebuild (resolveSpPrOverride/resolveTxPrOverride/resolveMarkerOverride), with an explicit raw override still winning when the typed field itself is untouched.",
		evidence: [
			testEvidence('src/core/utils/chart-pivot-formats.test.ts', [
				'parses, edits, serializes, and reparses typed pivot formats',
				'inserts in chart schema order and supports removal',
				'rejects invalid indexes and empty collections',
				'parses spPr/marker into typed fields alongside their raw XML',
				'leaves an unedited entry byte-equivalent (typed fields unchanged is not an edit signal)',
				'merges a typed shapeProperties edit onto the existing spPr, preserving unmodeled children',
				'creates a fresh txPr from a typed textStyle when none is authored',
				'rebuilds marker from a typed edit even when markerXml is stale',
				'lets an explicit raw override win when the typed field is untouched',
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
		note: "Iterator and condition data is typed; nested layout actions and enum unions remain raw. All 8 documented ST_FunctionType/ST_FunctionValue values (cnt, var, pos, revPos, posEven, posOdd, depth, maxDepth) are implemented in the layout interpreter's dgm:if evaluator; since wave 2 (W2-E), the real discoverArrangement call site also supplies a visited dgm:choose node's sibling position, sibling count, depth, and the tree's max depth (core/utils/smartart-layout-interpreter-tree-location.ts, walkWithTreeLocation/treeMaxDepth), so pos/revPos/posEven/posOdd/depth/maxDepth are actually decidable in production, not just cnt/var as before. This is an interpreter-reachability improvement with no facet of its own in this manifest, which continues to grade only how the choose/forEach/if XML itself is typed.",
		evidence: [
			testEvidence('src/core/utils/smartart-layout-definition.test.ts', [
				'parses CT_DiagramDefinition and recursive CT_LayoutNode with arbitrary prefixes',
				'surgically edits typed fields and preserves algorithms, unknown data, and extLst',
				'creates and removes typed forEach and choose branches',
				'rejects invalid required values and unsigned integer facets',
			]),
			testEvidence(
				'src/core/utils/smartart-layout-interpreter-model.test.ts',
				[
					"decides a choose branch from the declaring node's own sibling position",
					'decides func="revPos" from the sibling count and position',
					'decides func="depth" from the declaring node\\\'s distance from the root',
					'decides func="maxDepth" from the whole tree\\\'s deepest node',
				],
				['parse', 'edit'],
			),
		],
	},
);

export const OPENXML_LINE_LAYOUT_AND_PIVOT_STRUCTURES_COVERAGE = overrides;
