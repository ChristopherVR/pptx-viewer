/**
 * Hand-authored OOXML chart-part builders for the e2e chart gallery fixture.
 *
 * The core SDK can create an in-memory chart element but its save pipeline only
 * *updates* an existing chart XML part (it keys off `chartData.chartPartPath`);
 * it has no path to author a brand-new chart part, so `handler.save()` drops
 * from-scratch charts (`SAVE_ELEMENT_SKIPPED`). To get real charts the viewers
 * can parse, this module emits the chart parts directly:
 *
 *   - Classic `c:` charts (bar / line / area / pie / doughnut / radar /
 *     scatter / bubble) as `c:chartSpace`, with cached `c:cat` / `c:val`
 *     (or `c:xVal` / `c:yVal` / `c:bubbleSize`) numeric/string caches that the
 *     core chart parser reads back into `PptxChartData`.
 *   - Office-2016 `cx:` extended charts (funnel / sunburst / histogram /
 *     boxWhisker) as `cx:chartSpace`, with `cx:series/@layoutId` (the token the
 *     core `detectChartType` switches on) and `cx:data` dimensions.
 *
 * Generated XML is deterministic: fixed values, fixed categories, explicit
 * per-series `srgbClr` fills, so the parsed model and rendered SVG geometry are
 * identical run-to-run and framework-to-framework.
 *
 * @module e2e/fixtures/chart-xml
 */

/** One named series with numeric values + an explicit hex colour (no '#'). */
export interface ChartXmlSeries {
	name: string;
	values: number[];
	/** 6-hex-digit colour without the leading '#'. */
	colorHex: string;
}

export interface ChartXmlInput {
	title: string;
	categories: string[];
	series: ChartXmlSeries[];
}

const C_NS =
	'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const CX_NS =
	'xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" ' +
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function strCache(values: string[]): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join('');
	return `<c:strRef><c:f>Sheet1!$A$2:$A$${values.length + 1}</c:f><c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache></c:strRef>`;
}

function numCache(values: number[], formatCode = 'General'): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return `<c:numRef><c:f>Sheet1!$B$2:$B$${values.length + 1}</c:f><c:numCache><c:formatCode>${formatCode}</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

function txCache(name: string): string {
	return `<c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`;
}

function seriesFill(colorHex: string): string {
	return `<c:spPr><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill></c:spPr>`;
}

function escapeXml(s: string): string {
	return s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function chartTitle(title: string): string {
	return `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
}

const CAT_AX_ID = 111111111;
const VAL_AX_ID = 222222222;

function catValAxes(): string {
	return (
		`<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AX_ID}"/></c:catAx>` +
		`<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="${CAT_AX_ID}"/></c:valAx>`
	);
}

function legendBottom(): string {
	return `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/>`;
}

function catValSeries(input: ChartXmlInput): string {
	return input.series
		.map(
			(s, i) =>
				`<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${txCache(s.name)}${seriesFill(s.colorHex)}` +
				`<c:cat>${strCache(input.categories)}</c:cat>` +
				`<c:val>${numCache(s.values)}</c:val></c:ser>`,
		)
		.join('');
}

/** Bar / column chart (grouping: clustered | stacked | percentStacked). */
export function buildBarChartXml(
	input: ChartXmlInput,
	grouping: 'clustered' | 'stacked' | 'percentStacked',
): string {
	const overlap = grouping === 'clustered' ? -27 : 100;
	const body =
		`<c:barChart><c:barDir val="col"/><c:grouping val="${grouping}"/>` +
		`${catValSeries(input)}<c:gapWidth val="150"/><c:overlap val="${overlap}"/>` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:barChart>`;
	return wrapClassic(input, body + catValAxes());
}

/** Line chart with an optional linear trendline on the first series. */
export function buildLineChartXml(input: ChartXmlInput, trendline = false): string {
	const sers = input.series
		.map((s, i) => {
			const tl =
				trendline && i === 0
					? `<c:trendline><c:spPr><a:ln><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln></c:spPr><c:trendlineType val="linear"/></c:trendline>`
					: '';
			return (
				`<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${txCache(s.name)}` +
				`<c:spPr><a:ln><a:solidFill><a:srgbClr val="${s.colorHex}"/></a:solidFill></a:ln></c:spPr>${tl}` +
				`<c:cat>${strCache(input.categories)}</c:cat>` +
				`<c:val>${numCache(s.values)}</c:val></c:ser>`
			);
		})
		.join('');
	const body =
		`<c:lineChart><c:grouping val="standard"/>${sers}` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:lineChart>`;
	return wrapClassic(input, body + catValAxes());
}

/** Area chart. */
export function buildAreaChartXml(input: ChartXmlInput): string {
	const body =
		`<c:areaChart><c:grouping val="standard"/>${catValSeries(input)}` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:areaChart>`;
	return wrapClassic(input, body + catValAxes());
}

/** Pie or doughnut chart (single series; one slice per category). */
export function buildPieChartXml(input: ChartXmlInput, doughnut = false): string {
	const s = input.series[0];
	const dPts = input.categories
		.map(
			(_, i) =>
				`<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${PALETTE[i % PALETTE.length]}"/></a:solidFill></c:spPr></c:dPt>`,
		)
		.join('');
	const ser =
		`<c:ser><c:idx val="0"/><c:order val="0"/>${txCache(s.name)}${dPts}` +
		`<c:cat>${strCache(input.categories)}</c:cat>` +
		`<c:val>${numCache(s.values)}</c:val></c:ser>`;
	const body = doughnut
		? `<c:doughnutChart><c:varyColors val="1"/>${ser}<c:holeSize val="50"/></c:doughnutChart>`
		: `<c:pieChart><c:varyColors val="1"/>${ser}</c:pieChart>`;
	return wrapClassic(input, body);
}

/** Radar chart. */
export function buildRadarChartXml(input: ChartXmlInput): string {
	const body =
		`<c:radarChart><c:radarStyle val="marker"/>${catValSeries(input)}` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:radarChart>`;
	return wrapClassic(input, body + catValAxes());
}

/** Scatter chart (x = 1..n category index, y = series values). */
export function buildScatterChartXml(input: ChartXmlInput): string {
	const xVals = input.categories.map((_, i) => i + 1);
	const sers = input.series
		.map(
			(s, i) =>
				`<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${txCache(s.name)}` +
				`<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>` +
				`<c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr><a:solidFill><a:srgbClr val="${s.colorHex}"/></a:solidFill></c:spPr></c:marker>` +
				`<c:xVal>${numCache(xVals)}</c:xVal>` +
				`<c:yVal>${numCache(s.values)}</c:yVal></c:ser>`,
		)
		.join('');
	const body =
		`<c:scatterChart><c:scatterStyle val="marker"/>${sers}` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:scatterChart>`;
	return wrapClassic(input, body + valValAxes());
}

/** Bubble chart (x = index, y = value, size = secondary magnitude). */
export function buildBubbleChartXml(input: ChartXmlInput): string {
	const xVals = input.categories.map((_, i) => i + 1);
	const sers = input.series
		.map(
			(s, i) =>
				`<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${txCache(s.name)}${seriesFill(s.colorHex)}` +
				`<c:xVal>${numCache(xVals)}</c:xVal>` +
				`<c:yVal>${numCache(s.values)}</c:yVal>` +
				`<c:bubbleSize>${numCache(s.values.map((v) => Math.max(1, Math.round(v / 8))))}</c:bubbleSize></c:ser>`,
		)
		.join('');
	const body = `<c:bubbleChart>${sers}<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:bubbleChart>`;
	return wrapClassic(input, body + valValAxes());
}

function valValAxes(): string {
	return (
		`<c:valAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AX_ID}"/></c:valAx>` +
		`<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="${CAT_AX_ID}"/></c:valAx>`
	);
}

/** Deterministic per-slice palette used by pie/doughnut dPt fills. */
const PALETTE = ['4472C4', 'ED7D31', '70AD47', 'FFC000'] as const;

function wrapClassic(input: ChartXmlInput, plotInner: string): string {
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace ${C_NS}><c:chart>${chartTitle(input.title)}` +
		`<c:plotArea><c:layout/>${plotInner}</c:plotArea>${legendBottom()}</c:chart></c:chartSpace>`
	);
}

// ──────────────────────────────────────────────────────────────────────────
// ChartEx (cx:) extended charts: funnel / sunburst / histogram / boxWhisker
// ──────────────────────────────────────────────────────────────────────────

function cxStrDim(values: string[]): string {
	const pts = values.map((v, i) => `<cx:pt idx="${i}">${escapeXml(v)}</cx:pt>`).join('');
	return `<cx:strDim type="cat"><cx:f>Sheet1!$A$2:$A$${values.length + 1}</cx:f><cx:lvl ptCount="${values.length}">${pts}</cx:lvl></cx:strDim>`;
}

function cxNumDim(values: number[], type = 'val'): string {
	const pts = values.map((v, i) => `<cx:pt idx="${i}">${v}</cx:pt>`).join('');
	return `<cx:numDim type="${type}"><cx:f>Sheet1!$B$2:$B$${values.length + 1}</cx:f><cx:lvl ptCount="${values.length}">${pts}</cx:lvl></cx:numDim>`;
}

/**
 * Build a cx: extended-chart part. `layoutId` is the token the core
 * `detectChartType` matches (`funnel`, `sunburst`, `boxWhisker`, `clustered`
 * Column for histogram is matched via `histogram`). Each series carries its own
 * `cat` + `val` dimensions so multi-series box-whisker data parses correctly.
 */
export function buildCxChartXml(input: ChartXmlInput, layoutId: string): string {
	const series = input.series
		.map(
			(s, i) =>
				`<cx:series layoutId="${layoutId}" uniqueId="{0000000${i}-0000-0000-0000-000000000000}">` +
				`<cx:tx><cx:txData><cx:f>Sheet1!$B$1</cx:f><cx:v>${escapeXml(s.name)}</cx:v></cx:txData></cx:tx>` +
				`<cx:spPr><a:solidFill><a:srgbClr val="${s.colorHex}"/></a:solidFill></cx:spPr>` +
				`<cx:dataId val="${i}"/></cx:series>`,
		)
		.join('');

	const data = input.series
		.map(
			(s, i) => `<cx:data id="${i}">${cxStrDim(input.categories)}${cxNumDim(s.values)}</cx:data>`,
		)
		.join('');

	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<cx:chartSpace ${CX_NS}><cx:chartData>${data}</cx:chartData>` +
		`<cx:chart><cx:title><cx:tx><cx:rich><a:p><a:r><a:t>${escapeXml(input.title)}</a:t></a:r></a:p></cx:rich></cx:tx></cx:title>` +
		`<cx:plotArea><cx:plotAreaRegion>${series}</cx:plotAreaRegion></cx:plotArea>` +
		`<cx:legend pos="b"/></cx:chart></cx:chartSpace>`
	);
}
