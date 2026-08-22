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
		'drawing:element:sysClr',
		'drawing:element:prstClr',
		'drawing:element:scrgbClr',
		'drawing:element:hslClr',
	],
	{
		parse: 'partial',
		preserve: 'passthrough',
		edit: 'unassessed',
		serialize: 'unassessed',
		note: 'System, preset, scRGB (with linear-to-sRGB gamma companding), and HSL colours parse and extract verbatim; no dedicated edit/serialize test exists for these color choices specifically.',
		evidence: [
			testEvidence(
				'src/core/core/builders/PptxColorTransformCodec.test.ts',
				[
					'parses a:sysClr using lastClr attribute',
					'parses a:prstClr for preset colour names',
					'parses a:scrgbClr (percentage-based RGB)',
					'compands linear scRGB mid-grey to sRGB (0x80 -> 0xBC)',
				],
				['parse'],
			),
			testEvidence(
				'src/core/color/color-utils.test.ts',
				['parses a:hslClr', 'parses a:hslClr for green'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/color-xml-preservation.test.ts',
				['extracts a:sysClr / a:prstClr / a:scrgbClr / a:hslClr'],
				['preserve'],
			),
		],
	},
);

assign(
	[
		'drawing:element:alpha',
		'drawing:element:alphaOff',
		'drawing:element:blue',
		'drawing:element:blueOff',
		'drawing:element:blueMod',
		'drawing:element:comp',
		'drawing:element:gamma',
		'drawing:element:invGamma',
		'drawing:element:gray',
		'drawing:element:green',
		'drawing:element:greenOff',
		'drawing:element:greenMod',
		'drawing:element:hue',
		'drawing:element:hueOff',
		'drawing:element:hueMod',
		'drawing:element:inv',
		'drawing:element:lum',
		'drawing:element:lumOff',
		'drawing:element:lumMod',
		'drawing:element:red',
		'drawing:element:redOff',
		'drawing:element:redMod',
		'drawing:element:sat',
		'drawing:element:satOff',
		'drawing:element:satMod',
		'drawing:element:shade',
		'drawing:element:tint',
		'drawing:complexType:CT_ComplementTransform',
		'drawing:complexType:CT_GammaTransform',
		'drawing:complexType:CT_InverseGammaTransform',
		'drawing:complexType:CT_InverseTransform',
	],
	{
		parse: 'native',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'partial',
		note: 'All 26 colour-transform children are applied with correct maths, including scRGB gamma companding; an untouched colour choice re-emits its transforms verbatim, but editing a colour drops any nested transform and falls back to canonical sRGB.',
		evidence: [
			testEvidence(
				'src/core/color/color-transforms.test.ts',
				[
					'applies complement (a:comp)',
					'applies inverse (a:inv)',
					'applies greyscale (a:gray)',
					'applies shade (a:shade)',
					'applies tint (a:tint)',
					'applies absolute hue (a:hue)',
					'applies saturation modulation (a:satMod)',
					'applies luminance modulation (a:lumMod)',
					'applies luminance offset (a:lumOff)',
					'applies absolute red channel (a:red)',
					'applies red modulation (a:redMod)',
					'applies red offset (a:redOff)',
					'applies green and blue channel transforms',
					'a:gamma is a no-op on pure black',
					'a:invGamma is a no-op on pure black and white',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/builders/PptxColorTransformCodec.test.ts',
				['applies shade (a:shade)', 'applies tint (a:tint)', 'applies lumMod', 'applies lumOff'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/color-xml-preservation.test.ts',
				['extracts a:schemeClr with transforms'],
				['preserve'],
			),
			testEvidence(
				'src/core/utils/color-xml-preservation.test.ts',
				['round-trips: parse a:schemeClr → save → re-parse yields same XML'],
				['serialize'],
			),
			testEvidence(
				'src/core/utils/color-xml-preservation.test.ts',
				['round-trips: user edit drops the schemeClr, emits srgb'],
				['edit'],
			),
		],
	},
);

assign(['drawing:complexType:CT_NoFillProperties', 'drawing:element:noFill'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'No-fill is typed on parse, distinguishes empty-string from missing, and is emitted in the correct fill-choice slot and position on save.',
	evidence: [
		testEvidence(
			'src/core/core/builders/PptxShapeStyleExtractor.test.ts',
			[
				'sets fillMode=none and transparent color for a:noFill',
				'detects a noFill that parsed as an empty string over a fillRef',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSaveRunProperties.test.ts',
			[
				'emits a:noFill for a run whose fill was suppressed',
				'emits a:noFill in the fill slot, between a:ln and the typefaces',
			],
			['edit', 'serialize'],
		),
		testEvidence(
			'src/core/core/runtime/save-group-fill.test.ts',
			['keeps grpFill on every inheriting leaf, at every nesting depth'],
			['preserve'],
		),
	],
});

assign(['drawing:complexType:CT_GroupFillProperties', 'drawing:element:grpFill'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Group-fill inheritance is resolved in the loaded model at every nesting depth and re-emitted verbatim on save instead of being baked into the resolved colour.',
	evidence: [
		testEvidence(
			'src/core/core/builders/PptxShapeStyleExtractor.test.ts',
			['sets fillMode=group for a:grpFill'],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/group-fill-inheritance.test.ts',
			['resolves a grpFill leaf at every depth, including under a grpFill group'],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/save-group-fill.test.ts',
			['keeps grpFill on every inheriting leaf, at every nesting depth'],
			['preserve', 'serialize'],
		),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSaveShapeStyleWriter.test.ts',
			['never leaves a grpFill beside a noFill'],
			['edit'],
		),
	],
});

assign(
	[
		'drawing:attribute:flip',
		'drawing:attribute:rotWithShape',
		'drawing:attribute:scaled',
		'drawing:element:tileRect',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Gradient flip, rotWithShape, lin@scaled, and tileRect are typed booleans/fractions with a round-trip through buildGradientFillXml.',
		evidence: [
			testEvidence('src/core/core/builders/PptxGradientStyleCodec.attrs.test.ts', [
				'extracts gradFill@flip',
				'extracts gradFill@rotWithShape as a typed boolean',
				'extracts a:lin@scaled as a typed boolean',
				'round-trips flip / rotWithShape / scaled through buildGradientFillXml',
				'omits @flip when value is "none" (default)',
				'defaults @scaled to "1" when not specified (back-compat)',
				'extracts a:tileRect LTRB into 0..1 fractions (may be negative)',
				'round-trips fillGradientTileRect through buildGradientFillXml',
			]),
			testEvidence(
				'src/__tests__/integration/issue-132-gradient-fill.test.ts',
				['keeps the tileRect of the corner radial gradient PowerPoint authored'],
				['parse'],
			),
		],
	},
);

assign(
	[
		'drawing:attribute:path',
		'drawing:element:path',
		'drawing:complexType:CT_PathShadeProperties',
		'drawing:simpleType:ST_PathShadeType',
	],
	{
		parse: 'native',
		preserve: 'passthrough',
		edit: 'partial',
		serialize: 'native',
		note: 'This id covers two constructs that share the element name a:path: the gradient path-shade child (radial/rectangular/shape, @path attribute and ST_PathShadeType), which parses and serializes the radial case natively with less-common edit permutations covered only indirectly; and the custGeom path-command sequence (CT_Path2D move/line/arc/Bezier commands), which round-trips natively including document order. The combined grade reflects the weaker (gradient) case rather than overclaiming for both.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/table-style-fill-parse.test.ts',
				['parses a radial (path) gradient fill'],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveRunProperties.test.ts',
				['should build gradient fill with radial type'],
				['serialize'],
			),
			testEvidence(
				'src/core/geometry/custom-geometry-command-order.test.ts',
				['preserves interleaved commands through parse, model, serialize, and reload'],
				['preserve', 'edit'],
			),
		],
	},
);

assign(['drawing:element:fillToRect'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'The focal-point rectangle of a radial/path gradient parses into 0..1 fractions on real authored fixtures; no dedicated edit/serialize test was found for it.',
	evidence: [
		testEvidence(
			'src/core/core/builders/drawing-fill-roundtrip.test.ts',
			['parses gradient structure independently of the authored prefix'],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/issue-132-gradient-fill.test.ts',
			['keeps the tileRect of the corner radial gradient PowerPoint authored'],
			['parse'],
		),
	],
});

assign(['drawing:element:lin', 'drawing:complexType:CT_LinearShadeProperties'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Linear gradient shade angle and scaled flag parse into structured stops rather than a single flattened solid colour.',
	evidence: [
		testEvidence(
			'src/__tests__/integration/issue-132-gradient-fill.test.ts',
			['parses a linear gradFill into structured stops, not a single solid'],
			['parse'],
		),
	],
});

export const OPENXML_COLOR_GRADIENT_FILL_COVERAGE: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
