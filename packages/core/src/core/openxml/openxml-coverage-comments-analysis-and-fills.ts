import type { OpenXmlCoverageFacets } from './openxml-coverage';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'presentation:complexType:CT_Comment',
		'presentation:complexType:CT_CommentAuthor',
		'presentation:complexType:CT_CommentAuthorList',
		'presentation:complexType:CT_CommentList',
		'presentation:element:cm',
		'presentation:element:cmAuthor',
		'presentation:element:cmAuthorLst',
		'presentation:element:cmLst',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed legacy comments and authors with package wiring and lossless raw XML preservation.',
	},
);

assign(
	[
		'chart:complexType:CT_Trendline',
		'chart:complexType:CT_TrendlineLbl',
		'chart:element:trendline',
		'chart:element:trendlineLbl',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common trendline and label fields are typed; rich shape and text content is preserved.',
	},
);

assign(
	[
		'chart:complexType:CT_TrendlineType',
		'chart:simpleType:ST_TrendlineType',
		'chart:simpleType:ST_Order',
		'chart:simpleType:ST_Period',
		'chart:element:trendlineType',
		'chart:element:order',
		'chart:element:period',
		'chart:element:dispEq',
		'chart:element:dispRSqr',
		'chart:element:name',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed and validated classic ChartML trendline option support.',
	},
);

assign(['chart:complexType:CT_ErrBars', 'chart:element:errBars'], {
	parse: 'partial',
	preserve: 'native',
	edit: 'partial',
	serialize: 'partial',
	note: 'Common error-bar options and line color are typed; uncommon shape metadata is preserved.',
});

assign(
	[
		'chart:complexType:CT_ErrDir',
		'chart:complexType:CT_ErrBarType',
		'chart:complexType:CT_ErrValType',
		'chart:element:errDir',
		'chart:element:errBarType',
		'chart:element:errValType',
		'chart:element:noEndCap',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed classic ChartML error-bar enum and end-cap support.',
	},
);

assign(
	[
		'drawing:complexType:CT_GradientFillProperties',
		'drawing:complexType:CT_GradientStop',
		'drawing:complexType:CT_GradientStopList',
		'drawing:complexType:CT_PatternFillProperties',
		'drawing:element:gradFill',
		'drawing:element:gs',
		'drawing:element:gsLst',
		'drawing:element:pattFill',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Common gradient and pattern fields are typed with lossless unknown XML preservation.',
	},
);

export const OPENXML_COMMENTS_ANALYSIS_AND_FILLS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
