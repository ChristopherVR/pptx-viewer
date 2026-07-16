/** Tick-mark placement from ChartML `ST_TickMark`. */
export type PptxChartTickMark = 'cross' | 'in' | 'none' | 'out';

/** Typed axis tick and category/date label controls. */
export interface PptxChartAxisLabelFormatting {
	/** Primary and secondary tick-mark placement. */
	majorTickMark?: PptxChartTickMark;
	minorTickMark?: PptxChartTickMark;
	/** Tick-label position from ChartML `ST_TickLblPos`. */
	tickLblPos?: 'high' | 'low' | 'nextTo' | 'none';
	/** Automatic category/date axis behavior (`c:auto`). */
	auto?: boolean;
	/** Category-axis label alignment (`c:lblAlgn`). */
	labelAlignment?: 'ctr' | 'l' | 'r';
	/** Category/date label distance, from 0 through 1000 percent. */
	labelOffset?: number;
	/** Number of category/date labels between rendered labels. */
	tickLabelSkip?: number;
	/** Number of category/date tick positions between major tick marks. */
	tickMarkSkip?: number;
	/** Suppress multi-level category labels (`c:noMultiLvlLbl`). */
	noMultiLevelLabels?: boolean;
}
