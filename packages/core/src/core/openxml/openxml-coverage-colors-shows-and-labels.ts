import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

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
	evidence: [
		testEvidence('src/core/color/color-parser-spec.test.ts', [
			'applies transform children on sRGB color',
		]),
		testEvidence('src/core/utils/color-xml-preservation.test.ts', [
			'round-trips: user edit drops the schemeClr, emits srgb',
		]),
	],
});

assign(['drawing:complexType:CT_SchemeColor', 'drawing:element:schemeClr'], {
	parse: 'partial',
	preserve: 'passthrough',
	edit: 'partial',
	serialize: 'partial',
	note: 'Theme resolution and transforms are supported; edits serialize as canonical sRGB.',
	evidence: [
		testEvidence('src/core/color/color-parser-spec.test.ts', [
			'applies transforms on scheme color',
		]),
		testEvidence('src/core/utils/color-xml-preservation.test.ts', [
			'round-trips: parse a:schemeClr → save → re-parse yields same XML',
		]),
	],
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
		evidence: [
			testEvidence('src/core/core/builders/drawing-fill-roundtrip.test.ts', [
				'preserves gradient extensions, unknown markup, and attributes in schema order',
				'replaces modeled pattern children but retains extension markup',
			]),
		],
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
		evidence: [
			testEvidence('src/__tests__/integration/presentation-collections-roundtrip.test.ts', [
				'creates, loads, edits, and clears custom shows and sections',
			]),
		],
	},
);

assign(['diagram:complexType:CT_RelIds', 'diagram:element:relIds'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Typed SmartArt relationship IDs with prefix-independent surgical round-trip support.',
	evidence: [
		testEvidence('src/core/utils/diagram-relationship-ids.test.ts', [
			'parses Strict markup with arbitrary namespace prefixes',
			'updates typed ids while preserving unknown and extension markup',
		]),
	],
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
		note: "Common data-label options are typed; the label's own rich-text body (c:tx/c:rich), layout, and shape properties are preserved. Since wave 2 (W2-C/W2-C2, issue C2-G1's data-label half), c:dLbls/c:txPr (group-level) and c:dLbl/c:txPr (per-point) DEFAULT run font is also typed, not just preserved: font family/size/bold/colour parse into options.txPr, with a theme-font placeholder (+mn-lt/+mj-lt) resolved through resolveTypeface the same way axis/title/legend text already is; a chart with no colorParser passed still round-trips byte-identical (txPr stays undefined rather than partially populated).",
		evidence: [
			testEvidence(
				'src/core/utils/chart-data-label-parser.test.ts',
				[
					'parses common CT_DLbl fields and XML boolean lexical forms',
					'parses common CT_DLbls options',
					'parses c:dLbls/c:txPr into the group-level options.txPr',
					'resolves a theme-font placeholder via resolveTypeface',
					"parses a per-point c:dLbl/c:txPr into that label's own txPr",
				],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-data-labels-serializer.test.ts',
				['preserves dLbl overrides, unknown children, leader lines, and extLst'],
				['preserve', 'edit', 'serialize'],
			),
		],
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
		evidence: [
			testEvidence(
				'src/core/utils/chart-data-label-parser.test.ts',
				['rejects invalid unsigned indexes and label-position enum values'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-data-labels-serializer.test.ts',
				[
					'writes bubble, separator, and leader-line options',
					'validates dLblPos before serialization',
				],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(['presentation:attribute:showScrollbar'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: 'p:browse/@showScrollbar (CT_ShowInfoBrowse, default true) now round-trips: previously any unrelated show-property edit unconditionally replaced p:browse with an empty node, silently dropping an authored value (issue P1-G1). Rebuild now preserves the existing attribute when the caller does not set showScrollbar and only writes "0" when explicitly false, omitting the attribute (schema default true applies) otherwise.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/pptx-presentation-props-helpers.test.ts',
			[
				'should parse showScrollbar as false from p:browse/@_showScrollbar="0"',
				'should parse showScrollbar as true when explicitly authored "1"',
				'should leave showScrollbar undefined when p:browse authors no attribute',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/pptx-show-properties.test.ts',
			[
				'carries the typed showScrollbar onto a freshly-constructed p:browse',
				'emits "1" for an explicit true',
				'preserves the existing showScrollbar="0" when an UNRELATED show field is edited',
				'omits the attribute (schema default true applies) when neither the caller nor the source authored it',
			],
			['edit', 'serialize'],
		),
	],
});

assign(['presentation:element:penClr'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: "p:penClr (EG_ColorChoice) now resolves through the shared theme-aware colour parser instead of only reading a bare a:srgbClr, so a scheme colour (e.g. accent2) picked as the presenter's pen colour parses correctly instead of silently being dropped (issue P1-G2). An edit that leaves the pen colour unchanged from parse re-emits the original colour XML verbatim (preserving a scheme reference); an actual colour change rebuilds a fresh a:srgbClr.",
	evidence: [
		testEvidence(
			'src/core/core/runtime/pptx-presentation-props-helpers.test.ts',
			[
				'should parse pen colour from p:penClr > a:srgbClr',
				'should not set penColor when p:penClr is absent',
				'should resolve a scheme/preset pen colour via the injected parseColor resolver',
				'should still resolve a plain srgbClr pen colour when a resolver is injected',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/pptx-show-properties.test.ts',
			[
				'returns true when penColor is set',
				're-emits the original scheme colour XML verbatim when penColor is unchanged from parse',
				'rebuilds a fresh a:srgbClr when the pen colour was actually edited',
				'rebuilds a fresh a:srgbClr when there is no preserved original (API-authored colour)',
			],
			['edit', 'serialize'],
		),
	],
});

assign(['presentation:attribute:updateAutomatic'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: 'p:oleObj/p:link/@updateAutomatic (CT_OleObjectLink, spec default false) is now parsed onto OlePptxElement.oleUpdateAutomatic and written from that typed field, instead of the writer unconditionally hardcoding "1" whenever a p:link node was freshly constructed regardless of what the source authored (issue P1-G3).',
	evidence: [
		testEvidence(
			'src/__tests__/integration/ole-save-roundtrip.test.ts',
			['parses and round-trips `p:link/@followColorScheme` from rawXml'],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/ole-save-roundtrip.test.ts',
			[
				'sDK-created linked OLE element defaults to updateAutomatic="0" (the schema default)',
				'sDK-created linked OLE element honours an explicit oleUpdateAutomatic:true',
				'preserves updateAutomatic="0" (manual) from rawXml through an unrelated-field edit',
			],
			['edit', 'serialize'],
		),
	],
});

export const OPENXML_COLORS_SHOWS_AND_LABELS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
