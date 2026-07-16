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

assign(
	[
		'chart:complexType:CT_PrintSettings',
		'chart:complexType:CT_HeaderFooter',
		'chart:complexType:CT_PageMargins',
		'chart:complexType:CT_PageSetup',
		'chart:simpleType:ST_PageSetupOrientation',
		'chart:element:printSettings',
		'chart:element:headerFooter',
		'chart:element:pageMargins',
		'chart:element:pageSetup',
		'chart:element:legacyDrawingHF',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Classic ChartML print settings are typed, validated, schema-ordered, and losslessly editable.',
		evidence: [
			testEvidence('src/core/utils/chart-print-settings.test.ts', [
				'parses all CT_PrintSettings members independently of namespace prefix',
				'applies edits in schema order while preserving foreign content',
				'validates schema numeric ranges and enum values on serialization',
			]),
			testEvidence('src/__tests__/integration/chart-print-settings-roundtrip.test.ts', [
				'loads, edits, saves, and reloads print settings without losing extensions',
			]),
		],
	},
);

assign(
	[
		'diagram:complexType:CT_DiagramDefinitionHeader',
		'diagram:complexType:CT_DiagramDefinitionHeaderLst',
		'diagram:complexType:CT_StyleDefinitionHeader',
		'diagram:complexType:CT_StyleDefinitionHeaderLst',
		'diagram:complexType:CT_ColorTransformHeader',
		'diagram:complexType:CT_ColorTransformHeaderLst',
		'diagram:complexType:CT_CTCategories',
		'diagram:complexType:CT_CTCategory',
		'diagram:complexType:CT_CTDescription',
		'diagram:complexType:CT_CTName',
		'diagram:complexType:CT_SDCategories',
		'diagram:complexType:CT_SDCategory',
		'diagram:complexType:CT_SDDescription',
		'diagram:complexType:CT_SDName',
		'diagram:element:layoutDefHdr',
		'diagram:element:layoutDefHdrLst',
		'diagram:element:styleDefHdr',
		'diagram:element:styleDefHdrLst',
		'diagram:element:colorsDefHdr',
		'diagram:element:colorsDefHdrLst',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Diagram definition header catalogs are typed, validated, prefix-independent, and preserve foreign XML.',
		evidence: [
			testEvidence('src/core/utils/smartart-definition-header.test.ts', [
				'parses and serializes the %s family prefix-independently',
				'validates required members and XML Schema integer ranges',
				'creates a namespace-complete standalone header catalog',
			]),
		],
	},
);

assign(
	[
		'chart:complexType:CT_Protection',
		'chart:element:protection',
		'chart:element:chartObject',
		'chart:element:data',
		'chart:element:formatting',
		'chart:element:selection',
		'chart:element:userInterface',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Classic ChartML protection is typed with exact CT_Boolean defaults, ordering, and ChartEx guards.',
		evidence: [
			testEvidence('src/core/utils/chart-protection.test.ts', [
				'parses prefixed CT_Boolean values and the omitted-val true default',
				'edits and orders known children while preserving foreign markup',
				'does not parse or emit classic protection in a cx chart space',
			]),
			testEvidence('src/__tests__/integration/chart-protection-roundtrip.test.ts', [
				'loads, edits, saves, and reloads protection without losing foreign markup',
			]),
		],
	},
);

export const OPENXML_CHART_DISPLAY_EFFECTS_AND_DIAGRAM_LAYOUTS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
