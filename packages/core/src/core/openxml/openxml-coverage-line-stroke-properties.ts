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
		'drawing:complexType:CT_LineProperties',
		'drawing:element:ln',
		'drawing:simpleType:ST_LineWidth',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'The `a:ln` outline (width, fill choice, dash, join, cap, compound, alignment, and both line ends) is fully typed on the shared `ShapeStyle`. An `a:extLst` child, or any property still resolved from `a:lnRef`, is left untouched by the writer and so survives a dirty save unmodified.',
		evidence: [
			testEvidence(
				'src/core/core/builders/shape-style-line-helpers.test.ts',
				[
					'extracts line width from @_w (12700 EMU = 1pt ≈ 1.33px)',
					'extracts larger line width (38100 => 4px)',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveShapeStyleWriter.test.ts',
				['should set stroke width in EMU and solid fill'],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/core/runtime/authored-shape-style.test.ts',
				[
					'does not invent an a:ln for an outline that comes from a:lnRef',
					'keeps an authored a:ln free of the theme width, colour, cap and join',
					'writes width and colour once the outline is edited',
				],
				['preserve', 'edit', 'serialize'],
			),
			testEvidence(
				'src/core/core/runtime/save-line-fill.test.ts',
				[
					'keeps the fill ahead of an authored a:prstDash',
					'keeps the fill ahead of the join and the line ends',
				],
				['preserve', 'serialize'],
			),
		],
	},
);

assign(['drawing:group:EG_LineFillProperties'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'All four choice members of an outline fill (noFill, solidFill, gradFill, pattFill) are typed via `strokeFillMode`, with the gradient/pattern node preserved verbatim for re-emission (issue #87). Exactly one fill child is ever written, in schema order ahead of the dash/join/ends group.',
	evidence: [
		testEvidence(
			'src/core/core/builders/shape-style-line-helpers.test.ts',
			[
				'applies solid fill stroke color',
				'applies gradient fill stroke color via context callback',
				'applies pattern fill stroke color from foreground',
				'models a gradient outline and preserves the whole a:gradFill node',
				'models a pattern outline and preserves the whole a:pattFill node',
				'models a noFill outline (no hidden line) as strokeFillMode "none"',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/save-line-fill.test.ts',
			[
				'emits a single a:gradFill for a gradient outline, never a solid dual-fill',
				'emits a single a:pattFill for a pattern outline',
				'emits a single a:solidFill for a solid outline and clears any prior gradient',
				'emits a:noFill for a transparent / zero-width outline and clears fills',
			],
			['preserve', 'edit', 'serialize'],
		),
	],
});

assign(
	[
		'drawing:group:EG_LineDashProperties',
		'drawing:complexType:CT_PresetLineDashProperties',
		'drawing:element:prstDash',
		'drawing:simpleType:ST_PresetLineDashVal',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'All eleven `ST_PresetLineDashVal` values are typed on `strokeDash`; the sibling `custDash` choice (`CT_DashStopList`) has its own coverage entry. Editing back to a preset drops any prior custom dash-stop list.',
		evidence: [
			testEvidence(
				'src/core/core/builders/shape-style-line-helpers.test.ts',
				[
					"applies preset dash type 'dash'",
					"applies preset dash type 'dot'",
					"applies preset dash type 'lgDash'",
					"applies preset dash type 'sysDash'",
					"applies preset dash type 'dashDot'",
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveShapeStyleWriter.test.ts',
				["should remove dash styles when dash is 'solid'", 'should set preset dash'],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/utils/drawing-line-dash.test.ts',
				['inserts custom dash before line joins and extensions'],
				['preserve', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:group:EG_LineJoinProperties',
		'drawing:complexType:CT_LineJoinRound',
		'drawing:complexType:CT_LineJoinBevel',
		'drawing:complexType:CT_LineJoinMiterProperties',
		'drawing:element:round',
		'drawing:element:bevel',
		'drawing:element:miter',
		'drawing:simpleType:ST_CompoundLine',
		'drawing:simpleType:ST_LineCap',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'The join choice (round/bevel/miter, with the miter limit) and the `cap`/`cmpd` attributes are typed on `lineJoin`, `miterLimit`, `lineCap`, and `compoundLine`, covering all `ST_CompoundLine` and `ST_LineCap` enumerators. The miter limit is only emitted when it differs from the 800000 default, and a cap/join the shape authored on top of an `a:lnRef` theme baseline is kept while the reference-derived value is not written back.',
		evidence: [
			testEvidence(
				'src/core/core/builders/shape-style-line-helpers.test.ts',
				[
					'applies round line join',
					'applies bevel line join',
					'applies miter line join',
					'parses miter @_lim into miterLimit (E-H6)',
					"applies cap type 'rnd'",
					"applies cap type 'sq'",
					"applies cap type 'flat'",
					"applies compound line type 'dbl'",
					"applies compound line type 'thickThin'",
					"applies compound line type 'tri'",
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveShapeStyleWriter.test.ts',
				[
					'should set round join',
					'should set bevel join',
					'omits @lim on a miter join at the 800000 default',
					'emits @lim on a miter join with a non-default limit',
					'should set line cap',
					'should set compound line type',
				],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/core/runtime/authored-shape-style.test.ts',
				['keeps an outline property the shape authored on top of the reference'],
				['preserve'],
			),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_LineEndProperties',
		'drawing:element:headEnd',
		'drawing:element:tailEnd',
		'drawing:simpleType:ST_LineEndType',
		'drawing:simpleType:ST_LineEndWidth',
		'drawing:simpleType:ST_LineEndLength',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Both connector line ends (`headEnd`/`tailEnd`) are typed on `connectorStart/EndArrow(Width|Length)`, covering all six `ST_LineEndType` arrowhead shapes and all three `ST_LineEndWidth`/`ST_LineEndLength` sizes independently per end. Setting an end to "none" removes the element rather than writing an empty one.',
		evidence: [
			testEvidence(
				'src/core/core/builders/shape-style-line-helpers.test.ts',
				[
					"applies head end arrow type 'triangle' with size 'lg'",
					"applies tail end arrow type 'stealth' with size 'sm'",
					'applies both head and tail arrows',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveShapeStyleWriter.test.ts',
				[
					'should set tail end arrow with width and length',
					"should remove tailEnd when endArrow is 'none'",
					'should set head end arrow',
				],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/core/runtime/authored-shape-style.test.ts',
				['keeps an authored a:ln free of the theme width, colour, cap and join'],
				['preserve'],
			),
		],
	},
);

export const OPENXML_LINE_STROKE_PROPERTIES_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
