import type { OpenXmlCoverageFacets } from './openxml-coverage';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['drawing:complexType:CT_SRgbColor', 'drawing:element:srgbClr'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Typed sRGB parsing, transforms, opacity, editing, and canonical serialization.',
});

assign(['drawing:complexType:CT_SchemeColor', 'drawing:element:schemeClr'], {
	parse: 'partial',
	preserve: 'passthrough',
	edit: 'partial',
	serialize: 'partial',
	note: 'Theme resolution and transforms are supported; edits serialize as canonical sRGB.',
});

assign(
	[
		'drawing:complexType:CT_SolidColorFillProperties',
		'drawing:element:solidFill',
		'drawing:group:EG_ColorChoice',
	],
	{
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common color choices are typed while uncommon color metadata is preserved.',
	},
);

assign(
	[
		'presentation:complexType:CT_CustomShow',
		'presentation:complexType:CT_CustomShowId',
		'presentation:complexType:CT_CustomShowList',
		'presentation:element:custShow',
		'presentation:element:custShowLst',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed custom-show collections with relationship and extension preservation.',
	},
);

assign(['diagram:complexType:CT_RelIds', 'diagram:element:relIds'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Typed SmartArt relationship IDs with prefix-independent surgical round-trip support.',
});

assign(
	[
		'chart:complexType:CT_DLbl',
		'chart:complexType:CT_DLbls',
		'chart:element:dLbl',
		'chart:element:dLbls',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common data-label options are typed; rich text, layout, and shape properties are preserved.',
	},
);

assign(
	[
		'chart:complexType:CT_DLblPos',
		'chart:simpleType:ST_DLblPos',
		'chart:element:dLblPos',
		'chart:element:delete',
		'chart:element:showVal',
		'chart:element:showCatName',
		'chart:element:showSerName',
		'chart:element:showPercent',
		'chart:element:showLegendKey',
		'chart:element:showBubbleSize',
		'chart:element:separator',
		'chart:element:showLeaderLines',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed and validated classic ChartML data-label option support.',
	},
);

export const OPENXML_COLORS_SHOWS_AND_LABELS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
