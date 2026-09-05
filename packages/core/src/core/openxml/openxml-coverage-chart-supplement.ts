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
// Chart: userShapes overlay anchors (sp/cxnSp editable since W2-D; pic/grpSp/graphicFrame preserve-only)
// ---------------------------------------------------------------------------
assign(['chart:element:userShapes'], {
	parse: 'partial',
	preserve: 'unassessed',
	edit: 'partial',
	serialize: 'partial',
	note: "The c:userShapes anchors (cdr:relSizeAnchor/absSizeAnchor around sp/cxnSp/pic/grpSp/graphicFrame) parse into a typed PptxChartUserShape list, not raw verbatim passthrough as previously (incorrectly) claimed here. Issue C2-G10 added grpSp flattening (one entry per grouped sp/cxnSp/pic child, previously the whole group anchor was silently dropped), a placeholder for a graphicFrame anchor (also previously dropped), and gradient/pattern fill resolution (previously solidFill-only, falling back to the first gradient stop or the pattern foreground colour). Since wave 2 (W2-D), sp/cxnSp overlay shapes are also independently editable: the SDK (addChartUserShape/updateChartUserShape/removeChartUserShape, core/builders/sdk/chart-user-shape-operations.ts), a chart-user-shapes-serializer.ts writer, and PptxHandlerRuntimeChartUserShapes.syncChartUserShapesToXml reconcile the typed list back into ppt/drawings/drawingN.xml, fabricating a fresh drawing part, relationship, and content-type override the first time a bare chart gets an overlay; a ChartEx (cx:chartSpace) chart keeps its overlay through both its in-place update path and a full type-change regenerate. Graded partial, not native: a pic/grpSp/graphicFrame entry has no reconstructable picture reference or nested graphic content in the flattened render model, so it is re-emitted as a plain fill/stroke rectangle placeholder rather than round-tripped, and only when the overlay array is actually edited (an untouched overlay of any kind is left exactly as authored, per syncChartUserShapesToXml's dirty-check no-op, though no dedicated byte-identical round-trip test was found evidencing that specific claim, so preserve stays unassessed rather than assumed).",
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeChartChrome.test.ts',
			['returns the c:userShapes node verbatim when present'],
			['parse'],
		),
		testEvidence(
			'src/core/utils/chart-user-shapes-parser.test.ts',
			[
				'flattens a grpSp anchor into one entry per grouped sp/cxnSp/pic child',
				'registers a bare placeholder for a graphicFrame anchor instead of dropping it',
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
				'serializes a pic overlay as a fill-only placeholder rectangle (no text, no picture ref)',
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
	parse: 'partial',
	preserve: 'passthrough',
	edit: 'partial',
	serialize: 'partial',
	note: 'Element counterparts of the already-typed CT_UpDownBars/CT_UpDownBar complexTypes; gap width and common shape properties are typed, extensions are passthrough.',
	evidence: [
		testEvidence('src/core/utils/chart-up-down-bars.test.ts', [
			'parses gap width and both shape-property branches',
			'updates formatting while preserving unsupported children',
		]),
	],
});

// ---------------------------------------------------------------------------
// Chart: hi-low/drop lines preserved structurally through combo-chart splitting
// ---------------------------------------------------------------------------
assign(['chart:element:hiLowLines', 'chart:element:dropLines'], {
	parse: 'passthrough',
	preserve: 'passthrough',
	edit: 'unassessed',
	serialize: 'passthrough',
	note: 'Treated as opaque per-container XML fragments that survive combo-chart consolidate/re-split; no independently typed field model was found, so edit is left unassessed rather than inferred.',
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
	],
});

export const OPENXML_CHART_SUPPLEMENT_COVERAGE: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
