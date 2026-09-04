/**
 * chart-style-defaults.ts: resolves the font sizes/colours a chart renderer
 * should fall back to when the chart's own XML leaves an element unstyled,
 * consulting the parsed Office 2013+ chart-style part
 * (`PptxChartData.chartStyleDefinition`, core's model of `style#.xml`,
 * `cs:chartStyle` - the part behind PowerPoint's built-in "Chart Styles"
 * gallery) before falling back to this viewer's own fixed chart defaults
 * (`chart-font.ts`'s `DEFAULT_CHART_TEXT_PX`/`DEFAULT_CHART_DATA_LABEL_PX`,
 * and the `#334155` label colour used across the cartesian/pie/radar/
 * waterfall render modules).
 *
 * Pure decision function (CLAUDE.md Rule 2): every binding's chart SVG
 * render code shares one shared bundle, so a call site should resolve this
 * once per chart and thread the fields through instead of hardcoding its own
 * copy of the same fallback constants.
 *
 * @module chart-style-defaults
 */
import { chartFontPx, DEFAULT_CHART_DATA_LABEL_PX, DEFAULT_CHART_TEXT_PX } from './chart-font';

/** The subset of `PptxChartStylePartEntry` (core) this module reads. */
interface ChartStylePartEntryLike {
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	color?: string;
	lineColor?: string;
	fillColor?: string;
}

/** The subset of `PptxChartStyleDefinition` (core) this module reads. */
interface ChartStyleDefinitionLike {
	title?: ChartStylePartEntryLike;
	axisTitle?: ChartStylePartEntryLike;
	categoryAxis?: ChartStylePartEntryLike;
	valueAxis?: ChartStylePartEntryLike;
	legend?: ChartStylePartEntryLike;
	dataLabel?: ChartStylePartEntryLike;
	dataPoint?: ChartStylePartEntryLike;
	dataPointLine?: ChartStylePartEntryLike;
	gridlineMajor?: ChartStylePartEntryLike;
	gridlineMinor?: ChartStylePartEntryLike;
	chartArea?: ChartStylePartEntryLike;
	plotArea?: ChartStylePartEntryLike;
}

/** The subset of `PptxChartData` this module reads. */
interface ChartDataLike {
	chartStyleDefinition?: ChartStyleDefinitionLike;
}

/**
 * PowerPoint's own default data-point/axis-label colour (`#334155`), matched
 * across `chart-cartesian-bars.ts`, `chart-cartesian-plots.ts`,
 * `chart-pie-labels.ts`, and the other chart-family renderers, used here as
 * the terminal fallback when neither the chart style part nor the chart's
 * own XML names a colour.
 */
const DEFAULT_LABEL_COLOR = '#334155';

/**
 * PowerPoint's chart title default text size (12 px), matching
 * `chart-manual-layout.ts`'s `CHART_TITLE_FONT_PX`, used as the terminal
 * fallback for the title font size.
 */
const DEFAULT_TITLE_TEXT_PX = 12;

/** Resolved font sizes/colours a chart renderer should use, in slide-px. */
export interface ChartStyleDefaults {
	/** Axis tick labels, category labels, axis titles (10 pt PowerPoint default). */
	bodyTextPx: number;
	/** Value/category/percent data labels (9 pt PowerPoint default). */
	dataLabelTextPx: number;
	/** Legend entry text. */
	legendTextPx: number;
	/** The chart's own title text. */
	titleTextPx: number;
	axisTextColor: string;
	dataLabelTextColor: string;
	legendTextColor: string;
	titleTextColor: string;
	/** Major gridline stroke colour, when the style part names one. */
	gridlineColor: string | undefined;
	/** Chart-area (outer frame) fill, when the style part names one. */
	chartAreaFillColor: string | undefined;
	/** Plot-area (inner panel) fill, when the style part names one. */
	plotAreaFillColor: string | undefined;
}

function sizePx(entry: ChartStylePartEntryLike | undefined, fallbackPx: number): number {
	return entry?.fontSize !== undefined ? chartFontPx(entry.fontSize) : fallbackPx;
}

function colorOr(entry: ChartStylePartEntryLike | undefined, fallback: string): string {
	return entry?.color ?? fallback;
}

/**
 * Resolve the font sizes/colours a chart renderer should use for `chartData`,
 * preferring the parsed chart-style part and falling back to this viewer's
 * fixed chart defaults when the part is absent (the common case for charts
 * authored via automation) or leaves a given element unstyled.
 */
export function resolveChartStyleDefaults(
	chartData: ChartDataLike | undefined,
): ChartStyleDefaults {
	const def = chartData?.chartStyleDefinition;
	// A category/value axis style entry decides tick and axis-title text;
	// PowerPoint applies the same size to both in every built-in style, so
	// either one (whichever is present) stands in for "the" axis default.
	const axisEntry = def?.categoryAxis ?? def?.valueAxis ?? def?.axisTitle;

	return {
		bodyTextPx: sizePx(axisEntry, DEFAULT_CHART_TEXT_PX),
		dataLabelTextPx: sizePx(def?.dataLabel, DEFAULT_CHART_DATA_LABEL_PX),
		legendTextPx: sizePx(def?.legend, DEFAULT_CHART_TEXT_PX),
		titleTextPx: sizePx(def?.title, DEFAULT_TITLE_TEXT_PX),
		axisTextColor: colorOr(axisEntry, DEFAULT_LABEL_COLOR),
		dataLabelTextColor: colorOr(def?.dataLabel, DEFAULT_LABEL_COLOR),
		legendTextColor: colorOr(def?.legend, DEFAULT_LABEL_COLOR),
		titleTextColor: colorOr(def?.title, DEFAULT_LABEL_COLOR),
		gridlineColor: def?.gridlineMajor?.lineColor ?? def?.gridlineMinor?.lineColor,
		chartAreaFillColor: def?.chartArea?.fillColor,
		plotAreaFillColor: def?.plotArea?.fillColor,
	};
}
