/**
 * chart-quick-action-toggles.ts: the mutation half of PowerPoint's floating
 * "Chart Elements" quick-action popover (the "+" icon shown outside a
 * selected chart's top-right corner). The popover's checklist items are
 * backed by fields that already exist on {@link PptxChartData}
 * (`style.hasTitle`/`hasLegend`/`hasDataLabels`, the primary value axis'
 * `majorGridlines` via `chart-gridlines-toggle.ts`, and `PptxChartAxisFormatting`'s
 * `deleted`/`titleText`), but nothing wired an "Axes" or "Axis Titles" toggle
 * to those last two fields before this module: every binding's chart
 * inspector only ever exposed axis min/max/units, never visibility.
 *
 * {@link applyChartElementToggle} is the single dispatcher every binding's
 * quick-action checklist calls: given the item key
 * {@link ChartQuickElementKey} from the shared descriptor
 * (`chart-quick-actions.ts`) and the desired checked state, it returns a new
 * `PptxChartData`. Bindings must not special-case any of these keys
 * themselves; a new checklist item is added here once, not five times.
 *
 * @module render/chart-quick-action-toggles
 */
import type { PptxChartAxisFormatting, PptxChartData, PptxChartStyle } from 'pptx-viewer-core';

import { patchChartData } from './chart-editor-options';
import { chartGridlinesPatch } from './chart-gridlines-toggle';

/** The checklist keys the "Chart Elements" quick-action popover exposes. */
export type ChartQuickElementKey =
	| 'title'
	| 'legend'
	| 'gridlines'
	| 'dataLabels'
	| 'axes'
	| 'axisTitles';

const AXIS_TYPES_WITH_TITLES: ReadonlyArray<PptxChartAxisFormatting['axisType']> = [
	'catAx',
	'valAx',
	'dateAx',
];

/** Default axis title text PowerPoint inserts when a title is turned on with none set. */
const DEFAULT_AXIS_TITLE_TEXT = 'Axis Title';

/**
 * Set/clear `deleted` on every category/value/date axis (PowerPoint's "Axes"
 * checklist item hides the whole axis, not just its gridlines/title).
 */
export function chartAxesVisibilityPatch(
	chartData: PptxChartData,
	show: boolean,
): Partial<PptxChartData> {
	const axes = (chartData.axes ?? []).map((axis) =>
		AXIS_TYPES_WITH_TITLES.includes(axis.axisType) ? { ...axis, deleted: !show } : axis,
	);
	return { axes };
}

/** Whether at least one axis is currently visible (not `deleted`). */
export function chartAxesVisibilityState(chartData: PptxChartData): boolean {
	const relevant = (chartData.axes ?? []).filter((axis) =>
		AXIS_TYPES_WITH_TITLES.includes(axis.axisType),
	);
	return relevant.length === 0 || relevant.some((axis) => !axis.deleted);
}

/**
 * Set/clear `titleText` on every category/value axis. Turning off blanks the
 * text (PowerPoint's own "None" removes the title box entirely, which this
 * codebase models as absent/empty `titleText`, see `chart-axis-render.ts`);
 * turning on with no existing text fills in the same placeholder PowerPoint
 * inserts ("Axis Title").
 */
export function chartAxisTitlesPatch(
	chartData: PptxChartData,
	show: boolean,
): Partial<PptxChartData> {
	const axes = (chartData.axes ?? []).map((axis) => {
		if (!AXIS_TYPES_WITH_TITLES.includes(axis.axisType)) {
			return axis;
		}
		if (!show) {
			return { ...axis, titleText: undefined };
		}
		return { ...axis, titleText: axis.titleText || DEFAULT_AXIS_TITLE_TEXT };
	});
	return { axes };
}

/** Whether at least one axis currently shows a non-empty title. */
export function chartAxisTitlesState(chartData: PptxChartData): boolean {
	return (chartData.axes ?? []).some(
		(axis) => AXIS_TYPES_WITH_TITLES.includes(axis.axisType) && Boolean(axis.titleText),
	);
}

/**
 * The style patch for the "Data labels" master toggle, shared by the
 * quick-action popover and every binding's inspector checkbox. Switching
 * labels ON over a PowerPoint-authored chart must also switch a content flag
 * on: such charts carry an all-zero chart-level `c:dLbls`, and a bare
 * `hasDataLabels: true` over it would render as nothing.
 */
export function chartDataLabelsTogglePatch(
	style: PptxChartStyle | undefined,
	checked: boolean,
): Partial<PptxChartStyle> {
	const labels = style?.dataLabels;
	const anyContent =
		labels?.showValue === true ||
		labels?.showCategory === true ||
		labels?.showSeriesName === true ||
		labels?.showPercent === true ||
		labels?.showBubbleSize === true;
	if (checked && labels !== undefined && !anyContent) {
		return { hasDataLabels: true, dataLabels: { ...labels, showValue: true } };
	}
	return { hasDataLabels: checked };
}

/**
 * Apply one "Chart Elements" checklist toggle. The single entry point every
 * binding's quick-action popover calls on click; see this module's header.
 */
export function applyChartElementToggle(
	chartData: PptxChartData,
	key: ChartQuickElementKey,
	checked: boolean,
): PptxChartData {
	switch (key) {
		case 'title':
			return patchChartData(chartData, { style: { ...chartData.style, hasTitle: checked } });
		case 'legend':
			return patchChartData(chartData, { style: { ...chartData.style, hasLegend: checked } });
		case 'dataLabels':
			return patchChartData(chartData, {
				style: { ...chartData.style, ...chartDataLabelsTogglePatch(chartData.style, checked) },
			});
		case 'gridlines':
			return patchChartData(chartData, chartGridlinesPatch(chartData, checked));
		case 'axes':
			return patchChartData(chartData, chartAxesVisibilityPatch(chartData, checked));
		case 'axisTitles':
			return patchChartData(chartData, chartAxisTitlesPatch(chartData, checked));
		default:
			return chartData;
	}
}
