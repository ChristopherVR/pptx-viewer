import type { OpenXmlCoverageFacets } from './openxml-coverage';

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
	},
);

assign(['chart:element:builtInUnit', 'chart:element:custUnit'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Typed and validated built-in or custom chart display units.',
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
	},
);

export const OPENXML_CHART_DISPLAY_EFFECTS_AND_DIAGRAM_LAYOUTS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
