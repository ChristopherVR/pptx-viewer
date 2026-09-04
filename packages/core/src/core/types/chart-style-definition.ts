/**
 * Typed subset of an Office 2013+ chart-style part (`ppt/charts/style#.xml`,
 * root element `cs:chartStyle`, relationship type
 * `.../2012/relationships/chartStyle`).
 *
 * PowerPoint's Design-tab "Chart Styles" gallery (1-48) writes `c:style/@val`
 * on the chart part itself (already modeled as `PptxChartStyle.styleId`) and,
 * for most styles, this SEPARATE part spelling out the per-element
 * `cs:lnRef`/`cs:fillRef`/`cs:effectRef`/`cs:fontRef`/`cs:defRPr` defaults a
 * chart element falls back to when its own XML leaves it unstyled. Without
 * parsing this part, styles beyond the one PowerPoint happens to have baked
 * inline are visually inert.
 *
 * @module pptx-types/chart-style-definition
 */

/**
 * One styled chart-element entry (`cs:title`, `cs:axisTitle`,
 * `cs:categoryAxis`, ...). Colours are resolved to hex at parse time (scheme
 * colour references via `cs:fontRef`/`cs:lnRef`/`cs:fillRef` are already
 * flattened against the theme, matching how classic chart colours resolve
 * elsewhere in this codebase). Fields are present only when the source XML
 * carried a value for them.
 */
export interface PptxChartStylePartEntry {
	/** Text size in points, from `cs:defRPr/@sz` (hundredths of a point). */
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	/** Resolved text colour: `cs:defRPr/a:solidFill`, or `cs:fontRef`'s scheme colour. */
	color?: string;
	/** Resolved line colour from `cs:lnRef`'s scheme colour reference. */
	lineColor?: string;
	/** Line width in points, when directly authored (rare; most styles reference a theme line style by index only). */
	lineWidth?: number;
	/** Resolved fill colour from `cs:fillRef`'s scheme colour reference. */
	fillColor?: string;
}

/**
 * Parsed per-element style defaults from a chart-style part. Only the
 * elements this viewer actually renders distinct defaults for are modeled;
 * elements PowerPoint's style gallery also styles (data table, trendlines,
 * up/down bars, ...) are out of scope until a renderer needs them.
 */
export interface PptxChartStyleDefinition {
	title?: PptxChartStylePartEntry;
	axisTitle?: PptxChartStylePartEntry;
	categoryAxis?: PptxChartStylePartEntry;
	valueAxis?: PptxChartStylePartEntry;
	legend?: PptxChartStylePartEntry;
	dataLabel?: PptxChartStylePartEntry;
	dataPoint?: PptxChartStylePartEntry;
	dataPointLine?: PptxChartStylePartEntry;
	gridlineMajor?: PptxChartStylePartEntry;
	gridlineMinor?: PptxChartStylePartEntry;
	chartArea?: PptxChartStylePartEntry;
	plotArea?: PptxChartStylePartEntry;
}
