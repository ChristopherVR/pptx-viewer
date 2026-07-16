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
		'chart:complexType:CT_DispUnits',
		'chart:complexType:CT_DispUnitsLbl',
		'chart:element:dispUnits',
		'chart:element:dispUnitsLbl',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Display units and common label fields are typed; rich text and unmodeled formatting are preserved.',
		evidence: [
			testEvidence('src/core/utils/chart-axis-dispunits-serializer.test.ts', [
				'edits label text, layout, and shape properties in schema order',
				'retains extension and unmodeled XML during a dirty write',
			]),
		],
	},
);

assign(['chart:element:builtInUnit', 'chart:element:custUnit'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Typed and validated built-in or custom chart display units.',
	evidence: [
		testEvidence('src/core/utils/chart-axis-dispunits-serializer.test.ts', [
			'writes a built-in unit',
			'writes a custom unit divisor',
			'validates custom and built-in unit values',
		]),
	],
});

assign(
	[
		'drawing:complexType:CT_InnerShadowEffect',
		'drawing:complexType:CT_ReflectionEffect',
		'drawing:complexType:CT_SoftEdgesEffect',
		'drawing:element:innerShdw',
		'drawing:element:reflection',
		'drawing:element:softEdge',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common secondary-effect fields are typed with lossless color-transform and extension preservation.',
		evidence: [
			testEvidence('src/core/core/builders/effect-list-roundtrip.test.ts', [
				'extracts inner shadow, soft edge, and reflection independently of prefix',
				'surgically edits modeled effects without dropping transforms or extensions',
				'emits reflection fixed percentages within their schema bounds',
			]),
		],
	},
);

assign(
	[
		'diagram:complexType:CT_DiagramDefinition',
		'diagram:complexType:CT_LayoutNode',
		'diagram:element:layoutDef',
		'diagram:element:layoutNode',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Definition metadata and layout-node identity are typed; algorithms and constraints are preserved.',
		evidence: [
			testEvidence('src/core/utils/smartart-layout-definition.test.ts', [
				'parses CT_DiagramDefinition and recursive CT_LayoutNode with arbitrary prefixes',
				'surgically edits typed fields and preserves algorithms, unknown data, and extLst',
			]),
		],
	},
);

assign(
	[
		'diagram:complexType:CT_Categories',
		'diagram:complexType:CT_Category',
		'diagram:complexType:CT_Description',
		'diagram:complexType:CT_Name',
		'diagram:simpleType:ST_ChildOrderType',
		'diagram:element:cat',
		'diagram:element:catLst',
		'diagram:element:desc',
		'diagram:element:title',
		'diagram:attribute:uniqueId',
		'diagram:attribute:minVer',
		'diagram:attribute:defStyle',
		'diagram:attribute:name',
		'diagram:attribute:styleLbl',
		'diagram:attribute:chOrder',
		'diagram:attribute:moveWith',
		'diagram:attribute:lang',
		'diagram:attribute:val',
		'diagram:attribute:type',
		'diagram:attribute:pri',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed and validated DiagramML definition metadata.',
		evidence: [
			testEvidence('src/core/utils/smartart-layout-definition.test.ts', [
				'rejects invalid required values and unsigned integer facets',
			]),
			testEvidence('src/core/utils/smartart-definition-metadata.test.ts', [
				'validates required values, unsigned priorities, and CT_Colors enums',
			]),
		],
	},
);

export const OPENXML_CHART_DISPLAY_EFFECTS_AND_DIAGRAM_LAYOUTS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
