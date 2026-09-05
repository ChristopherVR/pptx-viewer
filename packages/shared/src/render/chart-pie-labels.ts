/**
 * chart-pie-labels.ts: pie / doughnut data-label placement, including outside
 * (`c:dLblPos` = `outEnd` / `bestFit`) labels with `c:leaderLines` connectors,
 * per-point manual drag offsets (`c:dLbl/c:layout`, C2-G15/limitations "Pie/
 * doughnut manual-layout label offset"), and a per-point font override
 * (`c:dLbl`/`c:dLbls` `txPr`, C2-G1 data-label half).
 *
 * PowerPoint pins pie data labels either INSIDE each slice (`ctr`, `inEnd`) or
 * OUTSIDE the rim (`outEnd`, `bestFit`). Outside labels are joined to their slice
 * by a leader line when `c:dLbls/c:showLeaderLines` is set (the default for
 * offset labels). The flat engine previously only produced centred inside labels;
 * this module adds the outside placement + leader-line geometry so offset pie
 * labels render with their connectors.
 *
 * @module chart-pie-labels
 */
import type { PptxChartDataLabelPosition, PptxChartManualLayout } from 'pptx-viewer-core';

import { chartFontPx, DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { ChartAnchorPoint, ChartFrameSize } from './chart-manual-layout';
import { applyLabelManualLayout, chartFrameToViewOffset } from './chart-manual-layout';
import { formatAxisValue } from './chart-view-model';
import type { PieSliceGeometry, SvgLine, SvgText } from './chart-view-model';

/** Distance (px) an outside label sits beyond the slice rim. */
const LEADER_LENGTH = 14;

/** One resolved label: its text plus any per-point styling overrides. */
export interface PieLabelContent {
	text: string;
	color?: string;
	/** Per-point font override (C2-G1 data-label half: `c:dLbl`/`c:dLbls` `txPr`), in points. */
	fontFamily?: string;
	fontSize?: number;
	bold?: boolean;
}

export interface PieLabelParams {
	slices: ReadonlyArray<PieSliceGeometry>;
	values: ReadonlyArray<number>;
	cx: number;
	cy: number;
	outerR: number;
	/** Resolved `c:dLblPos`; `outEnd` / `bestFit` place labels outside the rim. */
	position?: PptxChartDataLabelPosition;
	/** `c:showLeaderLines`. Defaults to on for outside labels. */
	showLeaderLines?: boolean;
	/** Series `c:numFmt` / cache format code applied to each label value. */
	numberFormat?: string;
	/**
	 * Resolves the TEXT (and, for a value-only label, its `[Red]`/`[Blue]`
	 * number-format colour, plus any per-point font override) of the label at
	 * `pointIndex`, so `c:showPercent` / `c:showCatName` / `c:separator` can be
	 * honoured (see `chart-data-label-text`). Returning `undefined` suppresses
	 * that one label (a `c:dLbl/c:delete`). Omit to print the formatted value,
	 * which is what this module did before the content flags were wired up.
	 */
	labelText?: (pointIndex: number, value: number) => PieLabelContent | undefined;
	/**
	 * Resolves this point's manual drag offset (`c:dLbl/c:layout/c:manualLayout`).
	 * `frame` (the chart element's own pixel box, distinct from the pie's
	 * `size x size` SVG viewBox) must be given alongside this for the offset to
	 * apply; omit both to keep the automatic placement, matching every chart
	 * this module rendered before manual layout support existed.
	 */
	layoutFor?: (pointIndex: number) => PptxChartManualLayout | null | undefined;
	frame?: ChartFrameSize;
	/** The pie's own SVG viewBox size, needed to convert `frame`-space offsets. */
	svgWidth?: number;
	svgHeight?: number;
}

export interface PieLabelResult {
	labels: SvgText[];
	leaderLines: SvgLine[];
}

/** Whether a data-label position renders outside the pie rim. */
export function isOutsidePosition(position: PptxChartDataLabelPosition | undefined): boolean {
	return position === 'outEnd' || position === 'bestFit';
}

/**
 * Resolve a label's SvgText font, starting from the given defaults (the
 * fixed inside/outside styling this module always used) and overriding with
 * a per-point txPr (C2-G1 data-label half) when the resolved label content
 * carries one. Returns every field required by `SvgText` so callers can
 * spread the result without a duplicate-key/optional-override conflict.
 */
function labelTextStyle(
	content: PieLabelContent,
	defaults: Pick<SvgText, 'fontSize'> & Partial<Pick<SvgText, 'fontWeight'>>,
): Pick<SvgText, 'fontFamily' | 'fontSize' | 'fontWeight'> {
	const fontWeight =
		content.bold !== undefined ? (content.bold ? 'bold' : 'normal') : defaults.fontWeight;
	return {
		fontSize: content.fontSize !== undefined ? chartFontPx(content.fontSize) : defaults.fontSize,
		...(fontWeight !== undefined ? { fontWeight } : {}),
		...(content.fontFamily ? { fontFamily: content.fontFamily } : {}),
	};
}

/**
 * Shift an automatic label point by its manual-layout drag, when both a
 * `layoutFor` resolver and the chart `frame` were given. The pie engine lays
 * out on a letterboxed `size x size` SVG square distinct from the element's
 * own box, so the offset is applied in frame-space and converted back.
 */
function applyManualDrag(
	point: ChartAnchorPoint,
	pointIndex: number,
	params: PieLabelParams,
): ChartAnchorPoint {
	const { layoutFor, frame, svgWidth, svgHeight } = params;
	if (!layoutFor || !frame || svgWidth === undefined || svgHeight === undefined) {
		return point;
	}
	const layout = layoutFor(pointIndex);
	const viewOffset = chartFrameToViewOffset(frame, { svgWidth, svgHeight });
	const framePoint = { x: point.x + viewOffset.x, y: point.y + viewOffset.y };
	const shifted = applyLabelManualLayout(layout, frame, framePoint);
	return { x: shifted.x - viewOffset.x, y: shifted.y - viewOffset.y };
}

/**
 * Build pie/doughnut data labels. Inside positions reuse each slice's centroid
 * (white bold, centred). Outside positions place the label beyond the rim with a
 * leader line from the rim point to the label anchor.
 */
export function buildPieDataLabels(params: PieLabelParams): PieLabelResult {
	const { slices, values, cx, cy, outerR, position, showLeaderLines, numberFormat, labelText } =
		params;
	const outside = isOutsidePosition(position);
	const labels: SvgText[] = [];
	const leaderLines: SvgLine[] = [];

	slices.forEach((slice, i) => {
		const val = values[i];
		if (val === undefined) {
			return;
		}
		const resolved = labelText ? labelText(i, val) : { text: formatAxisValue(val, numberFormat) };
		if (resolved === undefined) {
			return;
		}
		const { text, color } = resolved;
		if (!outside) {
			const { x, y } = applyManualDrag({ x: slice.labelX, y: slice.labelY }, i, params);
			labels.push({
				kind: 'text',
				x,
				y,
				text,
				fill: color ?? '#ffffff',
				textAnchor: 'middle',
				dominantBaseline: 'central',
				...labelTextStyle(resolved, { fontSize: DEFAULT_CHART_DATA_LABEL_PX, fontWeight: 'bold' }),
			});
			return;
		}

		const cos = Math.cos(slice.midAngle);
		const sin = Math.sin(slice.midAngle);
		const rimX = cx + outerR * cos;
		const rimY = cy + outerR * sin;
		const autoLabelX = cx + (outerR + LEADER_LENGTH) * cos;
		const autoLabelY = cy + (outerR + LEADER_LENGTH) * sin;
		const { x: labelX, y: labelY } = applyManualDrag({ x: autoLabelX, y: autoLabelY }, i, params);
		const anchor: 'start' | 'end' = cos >= 0 ? 'start' : 'end';

		labels.push({
			kind: 'text',
			x: labelX + (cos >= 0 ? 2 : -2),
			y: labelY,
			text,
			fill: color ?? '#334155',
			textAnchor: anchor,
			dominantBaseline: 'central',
			...labelTextStyle(resolved, { fontSize: DEFAULT_CHART_DATA_LABEL_PX }),
		});

		// Leader lines default ON for offset labels (only suppressed when the source
		// explicitly clears c:showLeaderLines). Points at the MOVED label position
		// so a dragged label keeps its connector pointing at it.
		if (showLeaderLines !== false) {
			leaderLines.push({
				kind: 'line',
				x1: rimX,
				y1: rimY,
				x2: labelX,
				y2: labelY,
				stroke: '#94a3b8',
				strokeWidth: 0.75,
			});
		}
	});

	return { labels, leaderLines };
}
