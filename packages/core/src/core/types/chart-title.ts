/**
 * Chart title rich-text run type, split out of `types/chart.ts` (already at
 * the repo's file-size limit) to keep that module from growing further.
 *
 * @module pptx-types/chart-title
 */

/**
 * One run of a chart title's rich text (`c:title/c:tx/c:rich/a:p/a:r`).
 *
 * The flat `PptxChartData.title` field only ever captured the FIRST run's
 * text with no per-run formatting; `titleRuns` (when present) is the
 * lossless, multi-run replacement parsed from the same `c:rich` body. Absent
 * when the title has no rich text at all (an empty/auto title, or one
 * authored as a linked-cell reference).
 */
export interface PptxChartTitleRun {
	/** This run's text (`a:t`). */
	text: string;
	/** `a:rPr/@_b`. */
	bold?: boolean;
	/** `a:rPr/@_i`. */
	italic?: boolean;
	/**
	 * Font size in POINTS (`a:rPr/@_sz`, hundredths of a point / 100), matching
	 * `PptxChartLegendTextStyle.fontSize`'s convention rather than the pixel
	 * convention `TextStyle.fontSize` uses for slide text.
	 */
	fontSize?: number;
	/** Resolved hex colour (e.g. `"#FF0000"`) from `a:rPr/a:solidFill`. */
	color?: string;
}
