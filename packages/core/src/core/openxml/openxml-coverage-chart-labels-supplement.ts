/**
 * Chart coverage overflow from `openxml-coverage-chart-supplement.ts` (which
 * is at the 300-line file-size limit): chart-space flags, title style, and
 * legend-entry typeface resolution added or corrected in the 2026-09 ECMA-376
 * parity wave.
 */
import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['chart:element:date1904'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: "c:chartSpace/c:date1904 (CT_Boolean, default false) is now read directly and takes precedence over an embedded workbook's own workbookPr/@date1904 when both exist, matching the spec (the chartSpace element is the chart's own declaration). Before issue C1-G3 only the embedded workbook's flag was consulted, misdating any chart with no usable embedded workbook. No editor writes this flag independently, so preserve/edit/serialize are left unassessed rather than assumed.",
	evidence: [
		testEvidence(
			'src/core/utils/chart-space-flags.test.ts',
			[
				'parses c:date1904 and c:roundedCorners when present with explicit values',
				'treats a present element with no @val as true (CT_Boolean default)',
				'omits both flags when the chart declares neither element',
			],
			['parse'],
		),
	],
});

assign(['chart:element:roundedCorners'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'c:chartSpace/c:roundedCorners (CT_Boolean, default false; PowerPoint\'s Format Chart Area "Rounded corners" checkbox) is now parsed onto PptxChartData; previously unread anywhere (issue C1-G6). The shared chart renderer now also paints it (a rounded background rect in all five bindings), but this manifest tracks parse/preserve/edit/serialize only, not render, so only parse is scored here. No editor writes this flag independently, so preserve/edit/serialize are left unassessed rather than assumed.',
	evidence: [
		testEvidence(
			'src/core/utils/chart-space-flags.test.ts',
			[
				'parses c:date1904 and c:roundedCorners when present with explicit values',
				'treats a present element with no @val as true (CT_Boolean default)',
			],
			['parse'],
		),
	],
});

assign(['chart:complexType:CT_PictureOptions', 'chart:element:pictureOptions'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: "c:dPt/c:pictureOptions parses into a typed PptxChartDataPointPicture (the apply* placement flags, pictureFormat, pictureStackUnit), and since wave 2 (W2-C/W2-C2, issue C2-G9's follow-through) that model is complete on every facet: parse also resolves the sibling c:spPr/a:blipFill/a:blip's r:embed/r:link into an actual image URL (core/core/runtime/chart-datapoint-picture-resolver.ts), and an independent typed write path (core/utils/chart-datapoint-picture.ts buildDptPictureOptions) rebuilds, removes, or leaves c:pictureOptions exactly as it was (picture: undefined preserves the existing subtree verbatim, the same 'typed edit wins once touched' convention this codebase uses elsewhere for dPt fills). The picture-fill effect itself is also now painted (ChartViewModel.defs + applyDataPointPictureFills in packages/shared, all five bindings), though render has no facet of its own in this manifest.",
	evidence: [
		testEvidence(
			'src/core/utils/chart-datapoint-serializer.test.ts',
			[
				'returns undefined when there is no c:pictureOptions',
				'parses apply* flags, pictureFormat, and pictureStackUnit',
				'ignores an invalid pictureFormat value',
				'rebuilds c:pictureOptions from the typed model once dp.picture is set',
				'removes c:pictureOptions when dp.picture is an empty object',
				'leaves c:pictureOptions absent for a freshly-created point with no picture',
			],
			['parse', 'edit', 'serialize'],
		),
		testEvidence(
			'src/core/utils/chart-datapoint-serializer.test.ts',
			['writes marker and bubble3D in CT_DPt schema order while preserving extensions'],
			['preserve'],
		),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeChartParsing.test.ts',
			['parses the flags and resolves the sibling blipFill to a data: URL'],
			['parse'],
		),
	],
});

assign(['chart:element:gapDepth'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: "c:gapDepth (bar3D/area3D/line3D/surface3D depth along the series axis) is parsed onto the typed chart model (PptxHandlerRuntimeChartParsing.ts) and, since wave 2 (W2-C), independently editable and re-serialized (chart-subtype-serializer.ts applyGapDepthToXml, wired from PptxHandlerRuntimeSaveDataSerialization.ts): inserted after c:gapWidth and before c:shape/c:axId, replaced in place, or removed when cleared. No dedicated round-trip test was found for an untouched chart's c:gapDepth surviving byte-for-byte, so preserve stays unassessed rather than assumed.",
	evidence: [
		testEvidence(
			'src/core/utils/chart-subtype-serializer.test.ts',
			[
				'inserts c:gapDepth after c:gapWidth and before c:shape/c:axId on a bar3DChart',
				'replaces an existing c:gapDepth value in place',
				'removes c:gapDepth when given undefined',
			],
			['edit', 'serialize'],
		),
		testEvidence(
			'src/__tests__/integration/chart-subtype-roundtrip.test.ts',
			['parses c:gapDepth, edits it, and round-trips it through the typed field'],
			['parse', 'edit', 'serialize'],
		),
	],
});

assign(['chart:element:clrMapOvr'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Chart-space clrMapOvr is flattened into a plain string map for colour resolution on parse. Since wave 3 (W3-D1), a write-back path exists (chart-color-map-override.ts applyChartColorMapOverride), wired into PptxHandlerRuntimeSaveDataSerialization.ts and exposed as the MCP tool set_chart_color_map_override: the map can be applied, replaced, or removed (undefined is a no-op, null/empty removes the element), inserted before c:chart per CT_ChartSpace schema order.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeChartChrome.test.ts',
			['flattens all 12 attribute slots into a string map'],
			['parse'],
		),
		testEvidence(
			'src/core/utils/chart-color-map-override.test.ts',
			[
				'inserts c:clrMapOvr before c:chart with the mapped attributes',
				'replaces an existing c:clrMapOvr in place',
				'removes an existing c:clrMapOvr when the value is null',
			],
			['preserve', 'edit', 'serialize'],
		),
	],
});

assign(['chart:complexType:CT_Title'], {
	parse: 'partial',
	preserve: 'unassessed',
	edit: 'partial',
	serialize: 'partial',
	note: "c:title's manual layout and shape properties were already typed; since this wave, its text style (c:tx/c:rich a:defRPr font family/size/bold/colour, falling back to a bare c:txPr default run when the title has no rich body) is also parsed into PptxChartData style.title* fields and written back into either the rich body's defRPr plus every run rPr, or the txPr defRPr, preserving the title's child order and an existing spPr's position. Graded partial because not every CT_TextCharacterProperties field is carried (e.g. italic, underline) and the title's full rich-text run structure (multiple differently-styled runs) is not independently editable, only its dominant style.",
	evidence: [
		testEvidence(
			'src/core/utils/chart-title-style-parser.test.ts',
			[
				'reads c:title/c:tx/c:rich a:defRPr font, size, bold, colour and c:spPr',
				'falls back to c:title/c:txPr for an automatic title without a rich body',
				'returns no fields for an unstyled title',
			],
			['parse'],
		),
		testEvidence(
			'src/core/utils/chart-title-style-serializer.test.ts',
			[
				'writes font family/size/bold/colour into a rich title body (defRPr and every run rPr)',
				'writes font family/size/bold/colour into the title txPr defRPr when there is no rich body',
				'writes a solid fill / border into the title spPr',
				'reassigning an existing txPr preserves its position among the title children',
			],
			['edit', 'serialize'],
		),
	],
});

export const OPENXML_CHART_LABELS_SUPPLEMENT_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
