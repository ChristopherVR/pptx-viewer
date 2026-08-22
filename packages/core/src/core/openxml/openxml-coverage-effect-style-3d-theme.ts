import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['drawing:simpleType:ST_TileFlipMode', 'drawing:simpleType:ST_RectAlignment'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Tile flip mode (none/x/y/xy) and rectangle alignment enumerations are validated and parsed to typed values.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeShapeImageFill.test.ts',
			[
				"should parse tile flip 'x'",
				"should parse tile flip 'y'",
				"should parse tile flip 'xy'",
				"should parse tile flip 'none'",
				'should ignore invalid flip values',
				'should parse tile alignment',
			],
			['parse'],
		),
	],
});

assign(
	[
		'drawing:element:effectRef',
		'drawing:element:effectStyleLst',
		'drawing:element:fillStyleLst',
		'drawing:element:bgFillStyleLst',
		'drawing:element:lnStyleLst',
		'drawing:complexType:CT_StyleMatrix',
		'drawing:complexType:CT_StyleMatrixReference',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Style-matrix idx resolution (fillRef/lnRef/effectRef against fillStyleLst/bgFillStyleLst/lnStyleLst/effectStyleLst, including the 1000-offset background range and phClr override) is typed, tested at every boundary, and round-trips through p:style edits.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeThemeRefResolution.test.ts',
				[
					'should apply shadow from effect style 1 (idx=1)',
					'should apply all line properties from style 1 (idx=1)',
					'should apply solid fill from idx=1',
					'should apply none fill from bgFillStyle idx=1001',
					'should apply solid bgFill from idx=1002',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeThemeEffectPhClr.test.ts',
				['resolves phClr in a referenced effect style from the effectRef colour'],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeThemeFormatScheme.test.ts',
				[
					'should parse outer shadow from effectLst',
					'should parse multiple effect styles from array',
				],
				['preserve'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeStyleRefRoundTrip.test.ts',
				[
					'round-trips lnRef idx and schemeClr+lumMod override',
					'round-trips fillRef with srgbClr override and ordering',
					'handles bgFillStyleLst index 1001-1003',
				],
				['edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:attribute:blend',
		'drawing:element:blend',
		'drawing:element:relOff',
		'drawing:complexType:CT_BlendEffect',
		'drawing:complexType:CT_RelativeOffsetEffect',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Effect-DAG blend (with blend-mode attribute) and relative-offset nodes parse into the typed tree, recurse through nested containers, and round-trip through save/reload.',
		evidence: [
			testEvidence(
				'src/core/core/builders/effect-dag-containers.test.ts',
				[
					'parses a:blend with @blend=mult and a child a:cont',
					'clamps unknown blend modes to the schema default of "over"',
					'parses a:relOff with @tx and @ty',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/builders/effect-dag-containers.test.ts',
				['round-trips blend@mode=mult with a wrapped cont', 'round-trips relOff'],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:element:sp3d',
		'drawing:element:bevelT',
		'drawing:element:bevelB',
		'drawing:element:extrusionClr',
		'drawing:element:contourClr',
		'drawing:attribute:prstMaterial',
		'drawing:complexType:CT_Shape3D',
		'drawing:complexType:CT_Bevel',
		'drawing:simpleType:ST_PresetMaterialType',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Shape-level 3D extrusion, bevel top/bottom, contour, and preset material are typed and round-trip through save (the extrusion-axis position attribute @z is a separate, unimplemented construct, tracked as a gap).',
		evidence: [
			testEvidence(
				'src/core/core/builders/shape-style-3d-helpers.test.ts',
				[
					'extracts extrusion height',
					'extracts extrusion color',
					'extracts bevel top properties',
					'extracts bevel bottom properties',
					'extracts preset material',
					'extracts contour width and color',
					'extracts a complete 3D shape with all properties',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveEffectsWriter.test.ts',
				[
					'should write sp3d with extrusion height and material',
					'writes a valid #-free srgbClr val for extrusion/contour colour',
					'should delete sp3d when shape3d has no data',
				],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(['drawing:attribute:upright'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Text-body upright is a typed boolean parsed and written on bodyPr.',
	evidence: [
		testEvidence('src/core/utils/body-properties-parser.test.ts', [
			'parses @_upright = "1" as true',
			'parses @_upright = "0" as false',
			'writes upright = "1" for true',
		]),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSaveTextWriter.test.ts',
			['should write upright'],
			['edit', 'serialize'],
		),
	],
});

assign(
	[
		'drawing:element:clrScheme',
		'drawing:element:clrMap',
		'drawing:element:masterClrMapping',
		'drawing:element:overrideClrMapping',
		'drawing:complexType:CT_ColorScheme',
		'drawing:complexType:CT_ColorMapping',
		'drawing:complexType:CT_ColorMappingOverride',
		'presentation:element:clrMapOvr',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'The 12-slot colour scheme, the base clrMap, and slide-level clrMapOvr (all 12 ST_ColorSchemeIndex alias keys, correct override precedence) are typed and survive a no-edit round trip; edits emit a schema-ordered overrideClrMapping or fall back to masterClrMapping when trivial.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeThemeLoading.test.ts',
				['should return theme with colorScheme when color map has entries'],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeThemeOverrides.test.ts',
				[
					'keeps every ST_ColorSchemeIndex token in spec casing',
					'keeps folHlink camel-cased whatever the source wrote',
				],
				['parse', 'preserve'],
			),
			testEvidence(
				'src/core/utils/theme-override-utils.test.ts',
				[
					'returns masterClrMapping for null override',
					'returns overrideClrMapping with all 12 alias keys when overrides are provided',
				],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/__tests__/integration/master-text-style-clrmapovr.test.ts',
				[
					'resolves the tx1 alias through the master map by default',
					're-routes the same alias through the slide override',
				],
				['parse'],
			),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_ShapeProperties',
		'drawing:complexType:CT_ShapeStyle',
		'drawing:element:spPr',
		'drawing:element:style',
		'drawing:element:lnRef',
		'drawing:element:fillRef',
		'drawing:element:fontRef',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Shape properties and the style-matrix line/fill/font references resolve idx-based lookups into the theme format scheme, including phClr override. The style-matrix effect reference (effectRef) and the shared reference complex type have their own coverage entry above, alongside effectStyleLst/fillStyleLst/bgFillStyleLst/lnStyleLst.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeThemeRefResolution.test.ts',
				[
					'should apply shadow from effect style 1 (idx=1)',
					'should apply all line properties from style 1 (idx=1)',
					'should fall back when fill idx exceeds fillStyles length',
				],
				['parse', 'edit'],
			),
			testEvidence(
				'src/__tests__/integration/solution-explorer-parse-fidelity.test.ts',
				[
					'resolves text colour from the shape style fontRef, not the presentation default',
					'keeps the fontRef style reference on a shape with an explicit no-fill outline',
				],
				['parse', 'preserve'],
			),
			testEvidence(
				'src/__tests__/integration/pptx-handler.test.ts',
				['should preserve element positions through load -> save -> load'],
				['serialize'],
			),
		],
	},
);

export const OPENXML_EFFECT_STYLE_3D_THEME_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
