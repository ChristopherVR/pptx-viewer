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
		note: 'Common data-label options are typed; rich text, layout, and shape properties are preserved.',
		evidence: [
			testEvidence(
				'src/core/utils/chart-data-label-parser.test.ts',
				[
					'parses common CT_DLbl fields and XML boolean lexical forms',
					'parses common CT_DLbls options',
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

export const OPENXML_COLORS_SHOWS_AND_LABELS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
