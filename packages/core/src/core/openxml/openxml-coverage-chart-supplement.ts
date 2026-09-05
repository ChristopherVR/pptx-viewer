import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

// ---------------------------------------------------------------------------
// Chart: date axis (real calendar math, distinct from category axis)
// ---------------------------------------------------------------------------
assign(
	[
		'chart:complexType:CT_DateAx',
		'chart:complexType:CT_TimeUnit',
		'chart:simpleType:ST_TimeUnit',
		'chart:element:dateAx',
		'chart:element:baseTimeUnit',
		'chart:element:majorTimeUnit',
		'chart:element:minorTimeUnit',
		'chart:element:majorUnit',
		'chart:element:minorUnit',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Date-axis calendar units (base/major/minor time unit, major/minor interval) are typed, editable, and round-trip through save and reload, distinct from the category-axis path.',
		evidence: [
			testEvidence(
				'src/core/utils/chart-axis-parser.test.ts',
				['parses date-axis calendar units and intervals'],
				['parse'],
			),
			testEvidence(
				'src/__tests__/integration/classic-date-axis-roundtrip.test.ts',
				['preserves numeric categories, date context, and calendar units'],
				['parse', 'preserve', 'edit', 'serialize'],
			),
		],
	},
);

// ---------------------------------------------------------------------------
// Chart: view3D (3D chart camera/perspective parameters)
// ---------------------------------------------------------------------------
assign(
	[
		'chart:complexType:CT_View3D',
		'chart:element:view3D',
		'chart:complexType:CT_RotX',
		'chart:element:rotX',
		'chart:complexType:CT_RotY',
		'chart:element:rotY',
		'chart:complexType:CT_Perspective',
		'chart:element:perspective',
		'chart:complexType:CT_DepthPercent',
		'chart:element:depthPercent',
		'chart:complexType:CT_HPercent',
		'chart:element:hPercent',
		'chart:element:rAngAx',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'All six view3D fields (rotX, rotY, hPercent, depthPercent, rAngAx, perspective) are typed and round-trip through parse, apply, and re-parse. The 3D projection rendered from these values is a documented simplification (oblique shading, not true 3D), a render-layer concern outside parse/preserve/edit/serialize.',
		evidence: [
			testEvidence('src/core/core/runtime/PptxHandlerRuntimeChartChrome.test.ts', [
				'parses every documented child field',
				'round-trips view3D through parse → apply → re-parse',
			]),
		],
	},
);

// ---------------------------------------------------------------------------
// Chart: chart-space chrome flags
// ---------------------------------------------------------------------------
assign(
	[
		'chart:element:autoTitleDeleted',
		'chart:complexType:CT_DispBlanksAs',
		'chart:element:dispBlanksAs',
		'chart:element:showDLblsOverMax',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed CT_Boolean/CT_DispBlanksAs chart-space chrome flags, round-tripped through parse, apply, and re-parse.',
		evidence: [
			testEvidence('src/core/core/runtime/PptxHandlerRuntimeChartChrome.test.ts', [
				'parses autoTitleDeleted with explicit val="1"',
				'round-trips every flag through parse → apply → re-parse',
			]),
		],
	},
);

// ---------------------------------------------------------------------------
// Chart: userShapes overlay anchors (sp/cxnSp editable since W2-D; grpSp typed+editable since W5-I; pic/graphicFrame preserve-only)
// ---------------------------------------------------------------------------
assign(['chart:element:userShapes'], {
	parse: 'partial',
	preserve: 'unassessed',
	edit: 'partial',
	serialize: 'partial',
	note: "The c:userShapes anchors (cdr:relSizeAnchor/absSizeAnchor around sp/cxnSp/pic/grpSp/graphicFrame) parse into a typed PptxChartUserShape list, not raw verbatim passthrough as previously (incorrectly) claimed here. Issue C2-G10 added a placeholder for a graphicFrame anchor (previously dropped) and gradient/pattern fill resolution (previously solidFill-only, falling back to the first gradient stop or the pattern foreground colour). Since wave 2 (W2-D), sp/cxnSp overlay shapes are also independently editable: the SDK (addChartUserShape/updateChartUserShape/removeChartUserShape, core/builders/sdk/chart-user-shape-operations.ts), a chart-user-shapes-serializer.ts writer, and PptxHandlerRuntimeChartUserShapes.syncChartUserShapesToXml reconcile the typed list back into ppt/drawings/drawingN.xml, fabricating a fresh drawing part, relationship, and content-type override the first time a bare chart gets an overlay; a ChartEx (cx:chartSpace) chart keeps its overlay through both its in-place update path and a full type-change regenerate. Since wave 4 (W4-D), a pic or graphicFrame anchor keeps its verbatim source node as `rawXml` alongside its resolved typed fields, and the serializer re-emits that rawXml unchanged even when a sibling shape elsewhere in the same overlay array is added or edited. Since wave 5 (W5-I), a grpSp anchor is no longer flattened lossily: it parses into a single `group` entry carrying its own cdr:grpSpPr transform plus a typed `children` list (recursively, so a group inside a group survives), keeps its rawXml for byte-identical passthrough while untouched, and is rebuilt from the typed transform/children once an SDK path edit (getChartUserShapeAtPath/updateChartUserShapeAtPath/removeChartUserShapeAtPath/addChartUserShapeGroupChild, addressed by a ChartUserShapePath index list) clears that rawXml; renderers that need flat leaves call flattenChartUserShapes, which applies the group transform to each leaf position. Graded partial, not native: the bindings' inspector still exposes no UI for editing a grouped child (SDK only), an absSizeAnchor's position is approximated against the chart extents when flattened, and a pic anchor with no rawXml at all (authored purely through the typed model) still re-emits as a plain fill/stroke rectangle placeholder, since there is no picture relationship to synthesise from typed fields alone. Preserve stays unassessed: the grpSp passthrough test is the only byte-identical evidence, and it covers one anchor kind rather than the whole overlay part.",
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeChartChrome.test.ts',
			['returns the c:userShapes node verbatim when present'],
			['parse'],
		),
		testEvidence(
			'src/core/utils/chart-user-shapes-parser.test.ts',
			[
				'parses a grpSp anchor into a single entry with its own transform and children',
				'parses a grpSp nested inside another grpSp, recursively',
				'flattenChartUserShapes applies the group transform to leaf positions',
				'registers a placeholder carrying rawXml for a graphicFrame anchor instead of dropping it',
				'keeps a pic anchor child as rawXml alongside its resolved visuals',
				'resolves a gradient fill from its first stop when there is no solid fill',
				'resolves a pattern fill from its foreground colour',
			],
			['parse'],
		),
		testEvidence(
			'src/core/builders/sdk/chart-user-shape-operations.test.ts',
			[
				'addChartUserShape appends a shape, preserving the existing list',
				'removeChartUserShape drops the shape at the given index',
			],
			['edit'],
		),
		testEvidence(
			'src/core/utils/chart-user-shapes-serializer.test.ts',
			[
				'round-trips a relSizeAnchor text box through parse -> serialize -> parse',
				're-emits a pic overlay verbatim from rawXml, unchanged by an edit elsewhere in the array',
				're-emits a graphicFrame overlay verbatim from rawXml',
				'falls back to a placeholder rectangle for a rawXml-less pic (no source markup to fall back to)',
			],
			['serialize'],
		),
		testEvidence(
			'src/__tests__/integration/chart-user-shapes-roundtrip.test.ts',
			[
				'fabricates a new drawing part, relationship, and content-type override for a chart that never had one',
				'reaches a ChartEx (cx:chartSpace) chart via the in-place update branch',
				'keeps the overlay when a ChartEx type change routes through the full-regenerate branch',
			],
			['edit', 'serialize'],
		),
	],
});

// ---------------------------------------------------------------------------
// Chart: of-pie chart family (ofPieChart, splitType/splitPos, custSplit, serLines)
// ---------------------------------------------------------------------------
assign(
	[
		'chart:complexType:CT_OfPieChart',
		'chart:element:ofPieChart',
		'chart:complexType:CT_OfPieType',
		'chart:element:ofPieType',
		'chart:complexType:CT_SplitType',
		'chart:element:splitType',
		'chart:element:splitPos',
		'chart:complexType:CT_SecondPieSize',
		'chart:element:secondPieSize',
		'chart:complexType:CT_GapAmount',
		'chart:element:gapWidth',
		'chart:complexType:CT_CustSplit',
		'chart:element:custSplit',
		'chart:element:secondPiePt',
		'chart:element:serLines',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Pie-of-pie / bar-of-pie options (split mode, split position, second-pie size, gap width, custom split indices, series lines) are fully typed and round-trip through parse, apply, and re-parse.',
		evidence: [
			testEvidence('src/core/core/runtime/PptxHandlerRuntimeChartChrome.test.ts', [
				'parses splitType, splitPos, secondPieSize, gapWidth, and serLines',
				'parses custSplit secondary indices',
				'round-trips ofPie options through parse → apply → re-parse',
			]),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeChartDetection.test.ts',
				['should detect ofPieChart (Pie of Pie / Bar of Pie)'],
				['parse'],
			),
			testEvidence(
				'src/core/utils/chart-xml-generator.test.ts',
				['emits an ofPieChart container with an ofPieType and no axes'],
				['serialize'],
			),
		],
	},
);

// ---------------------------------------------------------------------------
// Chart: custom (per-point) error bar values
// ---------------------------------------------------------------------------
assign(['chart:element:plus', 'chart:element:minus'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Custom per-point error-bar values (the cust valType branch of CT_ErrBars) are typed and round-trip; the common branches of CT_ErrBars already have their own coverage entry.',
	evidence: [
		testEvidence(
			'src/core/utils/chart-advanced-parser.test.ts',
			['parses custom error bar values'],
			['parse'],
		),
		testEvidence(
			'src/core/utils/chart-errbars-serializer.test.ts',
			['writes custom plus/minus numLit caches for custom error bars'],
			['preserve', 'edit', 'serialize'],
		),
	],
});

// ---------------------------------------------------------------------------
// Chart: per-point data-label custom text (c:dLbl/c:tx/c:rich)
// ---------------------------------------------------------------------------
assign(['chart:element:tx', 'chart:element:rich', 'chart:complexType:CT_Tx'], {
	parse: 'partial',
	preserve: 'native',
	edit: 'partial',
	serialize: 'partial',
	note: 'A per-point data-label override plain-text string is extracted on parse and re-emitted as a c:tx/c:rich run on edit; run-level rich formatting beyond the plain text is preserved as raw XML rather than independently modeled.',
	evidence: [
		testEvidence(
			'src/core/utils/chart-series-detail-parser.test.ts',
			['should parse individual dLbl with position and visibility'],
			['parse'],
		),
		testEvidence(
			'src/core/utils/chart-series-datalabel-serializer.test.ts',
			['writes custom label text as a c:tx rich run'],
			['edit', 'serialize'],
		),
		testEvidence(
			'src/core/utils/chart-series-datalabel-serializer.test.ts',
			['preserves unknown children and extLst while editing a label'],
			['preserve'],
		),
	],
});

// ---------------------------------------------------------------------------
// Chart: element counterparts of the already-typed up/down-bars complexTypes
// ---------------------------------------------------------------------------
assign(['chart:element:upDownBars', 'chart:element:upBars', 'chart:element:downBars'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: "Element counterparts of the already-typed CT_UpDownBars/CT_UpDownBar complexTypes. Verified native during wave 3 (W3-D1): gap width (via the ST_GapAmount union helper, rejecting the percent-literal member PowerPoint treats as fatal) and both up/down bars' fill+stroke shape properties round-trip through parse (chart-up-down-bars.ts parseChartUpDownBars) and serialize (applyChartUpDownBars), with unmodeled children preserved via spread.",
	evidence: [
		testEvidence('src/core/utils/chart-up-down-bars.test.ts', [
			'parses gap width and both shape-property branches',
			'updates formatting while preserving unsupported children',
			'emits the numeric member of ST_GapAmount, never the percent literal',
		]),
	],
});

// ---------------------------------------------------------------------------
// Chart: hi-low/drop lines preserved structurally through combo-chart splitting
// ---------------------------------------------------------------------------
assign(['chart:element:hiLowLines', 'chart:element:dropLines'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'CT_ChartLines\' colour/width/dash line style is typed (chart-advanced-parser.ts parseLineStyle) into a flat PptxChartLineStyle, and survives combo-chart consolidate/re-split as an opaque XML fragment when untouched. Since wave 3 (W3-D1), a write-back path also exists (chart-line-style-serializer.ts applyChartLineStyle), closing the previous edit: unassessed gap where the parsed style silently never reached save: undefined is a no-op, null removes the element, and an empty object inserts/keeps the bare element (PowerPoint treats mere presence as "show this helper line" independent of spPr).',
	evidence: [
		testEvidence(
			'src/core/utils/chart-combo-serializer.test.ts',
			['captures every own non-series children of every original container'],
			['parse', 'preserve'],
		),
		testEvidence(
			'src/core/utils/chart-combo-serializer.test.ts',
			['restores the line container keeps its OWN marker / dropLines / hiLowLines'],
			['serialize'],
		),
		testEvidence(
			'src/core/utils/chart-line-style-serializer.test.ts',
			[
				'inserts c:dropLines in schema order (after ser/dLbls, before hiLowLines/marker)',
				'updates an existing c:dropLines in place, preserving unmodeled children',
				'removes an existing c:hiLowLines when the style is explicitly null',
			],
			['edit', 'serialize'],
		),
	],
});

export const OPENXML_CHART_SUPPLEMENT_COVERAGE: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
