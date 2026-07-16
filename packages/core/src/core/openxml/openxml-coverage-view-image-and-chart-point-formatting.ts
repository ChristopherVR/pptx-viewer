import type { OpenXmlCoverageFacets } from './openxml-coverage';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'presentation:complexType:CT_CommonViewProperties',
		'presentation:complexType:CT_CommonSlideViewProperties',
		'presentation:complexType:CT_Guide',
		'presentation:complexType:CT_GuideList',
		'presentation:element:cViewPr',
		'presentation:element:cSldViewPr',
		'presentation:element:gridSpacing',
		'presentation:element:guide',
		'presentation:element:guideLst',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Common view geometry, guide lists, and grid spacing are typed, validated, and prefix-independent.',
	},
);

assign(
	[
		'drawing:complexType:CT_ColorChangeEffect',
		'drawing:complexType:CT_ColorReplaceEffect',
		'drawing:complexType:CT_DuotoneEffect',
		'drawing:element:clrChange',
		'drawing:element:clrFrom',
		'drawing:element:clrTo',
		'drawing:element:clrRepl',
		'drawing:element:duotone',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Image color choices and transforms round-trip losslessly; edited colors serialize through canonical sRGB choices.',
	},
);

assign(
	[
		'drawing:complexType:CT_GrayscaleEffect',
		'drawing:complexType:CT_BiLevelEffect',
		'drawing:element:grayscl',
		'drawing:element:biLevel',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Grayscale and validated bi-level image effects are typed with foreign XML preservation.',
	},
);

assign(
	[
		'chart:complexType:CT_Marker',
		'chart:complexType:CT_DPt',
		'chart:element:marker',
		'chart:element:dPt',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Marker and data-point fields are typed while shape, picture, and extension payloads remain losslessly preserved.',
	},
);

assign(
	[
		'chart:complexType:CT_MarkerSize',
		'chart:complexType:CT_MarkerStyle',
		'chart:simpleType:ST_MarkerSize',
		'chart:simpleType:ST_MarkerStyle',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Chart marker styles and sizes are typed and schema-range validated.',
	},
);

export const OPENXML_VIEW_IMAGE_AND_CHART_POINT_FORMATTING_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
