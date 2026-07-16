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
		evidence: [
			testEvidence('src/core/core/runtime/pptx-view-props-geometry.test.ts', [
				'parses Strict markup by local name with common-view nesting',
				'applies typed edits over raw custom-prefix XML and preserves extensions',
				'rejects invalid generated dimensions and ratios',
			]),
		],
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
		evidence: [
			testEvidence('src/core/core/runtime/image-color-effects.test.ts', [
				'parses all five primitives independently of namespace prefix',
				'round-trips untouched color choices, transforms, extensions, and prefixes',
				'merges edits while retaining unknown XML and schema-last extLst',
			]),
		],
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
		evidence: [
			testEvidence('src/core/core/runtime/image-color-effects.test.ts', [
				'parses all five primitives independently of namespace prefix',
				'merges edits while retaining unknown XML and schema-last extLst',
				'inserts newly authored effects before extLst and removes cleared effects',
			]),
		],
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
		evidence: [
			testEvidence('src/__tests__/integration/chart-marker-datapoint-roundtrip.test.ts', [
				'generates, parses, edits, and dirty-saves marker and bubble properties',
			]),
		],
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
		evidence: [
			testEvidence('src/core/utils/chart-marker-serializer.test.ts', [
				'updates an existing marker in place',
				'rejects marker sizes outside the ST_MarkerSize range',
			]),
			testEvidence('src/core/utils/chart-datapoint-serializer.test.ts', [
				'writes marker and bubble3D in CT_DPt schema order while preserving extensions',
			]),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_AlphaBiLevelEffect',
		'drawing:complexType:CT_AlphaCeilingEffect',
		'drawing:complexType:CT_AlphaFloorEffect',
		'drawing:complexType:CT_AlphaModulateFixedEffect',
		'drawing:complexType:CT_AlphaOutsetEffect',
		'drawing:complexType:CT_AlphaReplaceEffect',
		'drawing:element:alphaBiLevel',
		'drawing:element:alphaCeiling',
		'drawing:element:alphaFloor',
		'drawing:element:alphaModFix',
		'drawing:element:alphaOutset',
		'drawing:element:alphaRepl',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Fixed and leaf alpha effects are typed with Strict and Transitional lexical support and schema validation.',
		evidence: [
			testEvidence('src/core/core/runtime/image-alpha-effects.test.ts', [
				'parses strict percentages and the default alphaModFix amount',
				'edits known values while retaining unknown attributes',
				'does not serialize out-of-range fixed percentages',
			]),
			testEvidence('src/core/core/builders/effect-dag-primitives.test.ts', [
				'parses and edits a signed coordinate while preserving foreign attributes',
				'does not expose a coordinate outside the ST_Coordinate bounds',
			]),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_AlphaInverseEffect',
		'drawing:complexType:CT_AlphaModulateEffect',
		'drawing:element:alphaInv',
		'drawing:element:alphaMod',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Alpha inverse colors and modulation containers are editable while nested effect payloads remain preserved XML.',
		evidence: [
			testEvidence('src/core/core/runtime/image-alpha-effects.test.ts', [
				'parses arbitrary prefixes and preserves every alpha payload',
				'edits known values while retaining unknown attributes',
				'does not create alphaMod without its required cont child',
			]),
		],
	},
);

export const OPENXML_VIEW_IMAGE_AND_CHART_POINT_FORMATTING_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
