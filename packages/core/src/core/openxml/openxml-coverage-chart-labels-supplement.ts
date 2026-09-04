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
	parse: 'partial',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'c:dPt/c:pictureOptions now parses into a typed PptxChartDataPointPicture (the apply* placement flags, pictureFormat, and pictureStackUnit), instead of being invisible to the typed model. Rendering the picture-fill effect itself and an independent re-serialization path from the typed field are not yet implemented (issue C2-G9 remains a parse-only fix), so parse is graded partial and preserve/edit/serialize stay unassessed.',
	evidence: [
		testEvidence(
			'src/core/utils/chart-datapoint-serializer.test.ts',
			[
				'returns undefined when there is no c:pictureOptions',
				'parses apply* flags, pictureFormat, and pictureStackUnit',
				'ignores an invalid pictureFormat value',
			],
			['parse'],
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
