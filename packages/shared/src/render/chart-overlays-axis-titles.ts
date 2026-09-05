/**
 * chart-overlays-axis-titles.ts: `computeAxisTitlePrimitives`, building
 * `SvgText[]` for the X and Y axis titles. Split out of chart-overlays.ts to
 * keep that module under the repo's file-size guideline.
 *
 * Ported / adapted from:
 *   packages/react/src/viewer/utils/chart-chrome.tsx (axis titles)
 *
 * @module chart-overlays-axis-titles
 */

import type { PptxChartData } from 'pptx-viewer-core';

import { DEFAULT_CHART_TEXT_PX, chartFontPx } from './chart-font';
import type { PlotLayout, SvgText } from './chart-view-model';

/** Fill colour for axis title text. */
const AXIS_TITLE_COLOR = '#475569';

/**
 * Build `SvgText[]` for the X and Y axis titles.
 *
 * Axis titles are read from `chartData.axes`:
 *   - the primary category axis (`catAx`, `axPos === 'b'`) drives the X title
 *   - the primary value axis (`valAx`, `axPos === 'l'` or first `valAx`) drives the Y title
 *
 * **Rotation note**: `SvgText` has no `transform` or `rotate` field.  The Y
 * axis title is therefore placed to the left of the plot without rotation and
 * noted inline.  If the orchestrator adds a `transform?: string` field to
 * `SvgText` (or a new `SvgTransform` wrapper primitive), the Y title can be
 * rendered rotated -90 degrees by passing
 * `transform: \`rotate(-90, ${x}, ${y})\`` (the template expression is
 * straightforward once the field exists).
 *
 * @param chartData  Full parsed chart data.
 * @param layout     Plot-area bounding box.
 */
export function computeAxisTitlePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
): SvgText[] {
	const out: SvgText[] = [];
	const axes = chartData.axes;
	if (!axes || axes.length === 0) {
		return out;
	}

	// Axis-title font: core folds a parsed/edited title size into `axis.fontSize`
	// (points); convert at the pt -> px boundary, defaulting to PowerPoint's
	// 10 pt chart text. See chart-font.ts.
	const titleFontPx = (axis: { fontSize?: number }): number =>
		axis.fontSize !== undefined ? chartFontPx(axis.fontSize) : DEFAULT_CHART_TEXT_PX;

	// X axis title (category axis at bottom).
	const catAxis = axes.find((a) => a.axisType === 'catAx' && a.axPos !== 'r' && a.titleText);
	if (catAxis?.titleText) {
		const xTitle: SvgText = {
			kind: 'text',
			x: layout.plotLeft + layout.plotWidth / 2,
			y: layout.plotBottom + 22,
			text: catAxis.titleText,
			fontSize: titleFontPx(catAxis),
			fill: AXIS_TITLE_COLOR,
			textAnchor: 'middle',
			fontWeight: 'bold',
		};
		out.push(xTitle);
	}

	// Y axis title (value axis at left), rotated -90 degrees about its own
	// anchor and centred vertically on the plot area.
	const valAxis =
		axes.find((a) => a.axisType === 'valAx' && a.axPos !== 'r' && a.titleText) ??
		axes.find((a) => a.axisType === 'valAx' && a.titleText);
	if (valAxis?.titleText) {
		const yx = 12;
		const yy = layout.plotTop + layout.plotHeight / 2;
		const yTitle: SvgText = {
			kind: 'text',
			x: yx,
			y: yy,
			text: valAxis.titleText,
			fontSize: titleFontPx(valAxis),
			fill: AXIS_TITLE_COLOR,
			textAnchor: 'middle',
			fontWeight: 'bold',
			transform: `rotate(-90, ${yx}, ${yy})`,
		};
		out.push(yTitle);
	}

	return out;
}
