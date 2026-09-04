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
// Chart: userShapes / chart-space clrMapOvr (raw-preservation only, no typed edit path)
// ---------------------------------------------------------------------------
assign(['chart:element:userShapes'], {
	parse: 'partial',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'The c:userShapes anchors (cdr:relSizeAnchor/absSizeAnchor around sp/cxnSp/pic/grpSp/graphicFrame) parse into a typed PptxChartUserShape list, not raw verbatim passthrough as previously (incorrectly) claimed here. Issue C2-G10 added grpSp flattening (one entry per grouped sp/cxnSp/pic child, previously the whole group anchor was silently dropped), a placeholder for a graphicFrame anchor (also previously dropped), and gradient/pattern fill resolution (previously solidFill-only, falling back to the first gradient stop or the pattern foreground colour). No typed edit/serialize path exists, so those facets stay unassessed rather than inferred.',
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
	],
});

assign(['chart:element:clrMapOvr'], {
	parse: 'partial',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Chart-space clrMapOvr is flattened into a plain string map for colour resolution on parse; no typed edit/serialize path was found, so those facets are left unassessed rather than inferred.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeChartChrome.test.ts',
			['flattens all 12 attribute slots into a string map'],
			['parse'],
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
