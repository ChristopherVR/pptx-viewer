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
		evidence: [
			testEvidence('src/__tests__/integration/comments-roundtrip.test.ts', [
				'preserves extensions while typed fields are edited and emits Strict namespaces',
				'deletes comment parts, authors, relationships, and overrides explicitly',
			]),
		],
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
		evidence: [
			testEvidence(
				'src/core/utils/chart-advanced-parser.test.ts',
				['parses name, explicit false booleans, and typed label properties'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-trendline-serializer.test.ts',
				['writes a typed label in schema order and preserves unmodeled label content'],
				['preserve', 'edit', 'serialize'],
			),
		],
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
		evidence: [
			testEvidence(
				'src/core/utils/chart-advanced-parser.test.ts',
				['parses polynomial trendline with order', 'parses displayRSq and displayEq flags'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-trendline-serializer.test.ts',
				['rejects values outside the schema facets'],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(['chart:complexType:CT_ErrBars', 'chart:element:errBars'], {
	parse: 'partial',
	preserve: 'native',
	edit: 'partial',
	serialize: 'partial',
	note: 'Common error-bar options and line color are typed; uncommon shape metadata is preserved.',
	evidence: [
		testEvidence(
			'src/core/utils/chart-advanced-parser.test.ts',
			['parses basic error bars with fixedVal type'],
			['parse'],
		),
		testEvidence(
			'src/core/utils/chart-errbars-serializer.test.ts',
			['edits end caps and line color while preserving extensions'],
			['preserve', 'edit', 'serialize'],
		),
	],
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
		evidence: [
			testEvidence(
				'src/core/utils/chart-advanced-parser.test.ts',
				['parses explicit end-cap false and line color'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-errbars-serializer.test.ts',
				['writes direction, bar type, value type, and value before cat/val'],
				['preserve', 'edit', 'serialize'],
			),
		],
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
		evidence: [
			testEvidence('src/core/core/builders/drawing-fill-roundtrip.test.ts', [
				'parses gradient structure independently of the authored prefix',
				'preserves gradient extensions, unknown markup, and attributes in schema order',
				'serializes an edited gradient stop instead of stale preserved color XML',
			]),
		],
	},
);

export const OPENXML_COMMENTS_ANALYSIS_AND_FILLS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
