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
import type {
	PptxChartDataLabelPosition,
	PptxChartManualLayout,
	PptxChartShapeProps,
} from 'pptx-viewer-core';

import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { splitLabelLines } from './chart-label-lines';
import { dataLabelBoxSize } from './chart-label-measure';
import type { ChartAnchorPoint, ChartFrameSize } from './chart-manual-layout';
import { placeBestFitLabel } from './chart-pie-best-fit';
import { nudgeOutsideLabels } from './chart-pie-label-collision';
import { applyManualDrag, labelTextStyle, leaderLine } from './chart-pie-label-helpers';
import { formatAxisValue } from './chart-view-model';
import type { PieSliceGeometry, SvgLine, SvgPrimitive, SvgText } from './chart-view-model';

/** A `bestFit` label placed outside the rim, held back until collisions are resolved. */
interface PendingOutside {
	i: number;
	slice: PieSliceGeometry;
	label: SvgText;
	auto: ChartAnchorPoint;
	w: number;
	h: number;
}

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
	/** Resolved `c:dLblPos`; `outEnd` places labels outside the rim, `bestFit` inside or out. */
	position?: PptxChartDataLabelPosition;
	/** A point's own `c:dLblPos` (point > series > chart cascade), overriding `position`. */
	positionFor?: (pointIndex: number) => PptxChartDataLabelPosition | undefined;
	/** A doughnut has no `bestFit` of its own: its labels keep the ring placement. */
	doughnut?: boolean;
	/** `c:showLeaderLines`. Defaults to on for outside labels. */
	showLeaderLines?: boolean;
	/**
	 * Leader-line stroke styling (`PptxChartDataLabelOptions.leaderLineStyle`,
	 * resolved from the base `c:leaderLines/c:spPr` or its chart15-extension
	 * mirror, `c:extLst/c:ext/c15:leaderLines/c:spPr`). Only the stroke colour
	 * is honoured here; omit to keep this module's own default leader-line
	 * colour (`#94a3b8`), which is what every chart rendered before this
	 * extension was modelled.
	 */
	leaderLineStyle?: PptxChartShapeProps;
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
	/**
	 * The label box / callout decorations for one label (see
	 * `chart-data-label-callout`), given the point its pointer aims at: the
	 * rim at the slice's mid-angle, or `targetRadius` out along it.
	 */
	decorate?: (pointIndex: number, label: SvgText, target: ChartAnchorPoint) => SvgPrimitive[];
	/** Where along the mid-angle a callout points; defaults to `outerR` (the rim). */
	targetRadius?: number;
}

export interface PieLabelResult {
	labels: SvgText[];
	leaderLines: SvgLine[];
	/** Label boxes / callouts from `decorate`, painted under the labels. */
	boxes: SvgPrimitive[];
}

/** Whether a data-label position renders outside the pie rim (a doughnut's `bestFit` too). */
export function isOutsidePosition(position: PptxChartDataLabelPosition | undefined): boolean {
	return position === 'outEnd' || position === 'bestFit';
}

/**
 * Build pie/doughnut data labels. Inside positions reuse each slice's centroid
 * (white bold, centred). Outside positions place the label beyond the rim with a
 * leader line from the rim point to the label anchor. `bestFit` goes inside the
 * slice near the rim when the label fits, else just outside (`chart-pie-best-fit`).
 */
export function buildPieDataLabels(params: PieLabelParams): PieLabelResult {
	const {
		slices,
		values,
		cx,
		cy,
		outerR,
		position,
		showLeaderLines,
		numberFormat,
		labelText,
		leaderLineStyle,
		decorate,
	} = params;
	const labels: SvgText[] = [];
	const leaderLines: SvgLine[] = [];
	const boxes: SvgPrimitive[] = [];
	const push = (i: number, label: SvgText, midAngle: number) => {
		// The box/callout is sized from the whole label; the painted text is
		// one primitive per line so no binding needs multi-line support.
		labels.push(...splitLabelLines(label));
		const r = params.targetRadius ?? outerR;
		if (decorate) {
			const target = { x: cx + r * Math.cos(midAngle), y: cy + r * Math.sin(midAngle) };
			boxes.push(...decorate(i, label, target));
		}
	};

	const pendingOutside: PendingOutside[] = [];
	const placeBestFit = (
		i: number,
		slice: PieSliceGeometry,
		label: SvgText,
		auto: ChartAnchorPoint,
		nudged: ChartAnchorPoint = auto,
	) => {
		const moved = applyManualDrag(nudged, i, params);
		push(i, { ...label, x: moved.x, y: moved.y }, slice.midAngle);
		// PowerPoint draws a leader line only to a label that left its spot.
		if (showLeaderLines !== false && (moved.x !== auto.x || moved.y !== auto.y)) {
			leaderLines.push(leaderLine(slice, cx, cy, outerR, moved, leaderLineStyle));
		}
	};

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
		const pointPosition = params.positionFor?.(i) ?? position;
		if (pointPosition === 'bestFit' && !params.doughnut) {
			const label: SvgText = {
				kind: 'text',
				x: 0,
				y: 0,
				text,
				fill: color ?? '#334155',
				textAnchor: 'middle',
				dominantBaseline: 'central',
				...labelTextStyle(resolved, { fontSize: DEFAULT_CHART_DATA_LABEL_PX }),
			};
			const { w, h } = dataLabelBoxSize(label);
			const auto = placeBestFitLabel({ ...slice, outerR }, w, h);
			if (!auto.inside) {
				// Outside labels may collide: placed after the loop, once nudged apart.
				pendingOutside.push({ i, slice, label, auto, w, h });
				return;
			}
			placeBestFit(i, slice, label, auto);
			return;
		}
		if (!isOutsidePosition(pointPosition)) {
			const { x, y } = applyManualDrag({ x: slice.labelX, y: slice.labelY }, i, params);
			push(
				i,
				{
					kind: 'text',
					x,
					y,
					text,
					fill: color ?? '#ffffff',
					textAnchor: 'middle',
					dominantBaseline: 'central',
					...labelTextStyle(resolved, {
						fontSize: DEFAULT_CHART_DATA_LABEL_PX,
						fontWeight: 'bold',
					}),
				},
				slice.midAngle,
			);
			return;
		}

		const cos = Math.cos(slice.midAngle);
		const sin = Math.sin(slice.midAngle);
		const autoLabelX = cx + (outerR + LEADER_LENGTH) * cos;
		const autoLabelY = cy + (outerR + LEADER_LENGTH) * sin;
		const { x: labelX, y: labelY } = applyManualDrag({ x: autoLabelX, y: autoLabelY }, i, params);
		const anchor: 'start' | 'end' = cos >= 0 ? 'start' : 'end';

		push(
			i,
			{
				kind: 'text',
				x: labelX + (cos >= 0 ? 2 : -2),
				y: labelY,
				text,
				fill: color ?? '#334155',
				textAnchor: anchor,
				dominantBaseline: 'central',
				...labelTextStyle(resolved, { fontSize: DEFAULT_CHART_DATA_LABEL_PX }),
			},
			slice.midAngle,
		);

		// Leader lines default ON for offset labels (only suppressed when the source
		// explicitly clears c:showLeaderLines). Points at the MOVED label position
		// so a dragged label keeps its connector pointing at it.
		if (showLeaderLines !== false) {
			leaderLines.push(
				leaderLine(slice, cx, cy, outerR, { x: labelX, y: labelY }, leaderLineStyle),
			);
		}
	});

	// Outside bestFit labels: nudge colliding ones apart (a moved label gets a
	// leader line from placeBestFit), see chart-pie-label-collision.
	const nudges = nudgeOutsideLabels(
		pendingOutside.map((p) => ({ id: p.i, x: p.auto.x, y: p.auto.y, w: p.w, h: p.h })),
		{ cx, cy, r: outerR },
		0,
		params.svgHeight ?? Number.POSITIVE_INFINITY,
	);
	for (const p of pendingOutside) {
		const nudge = nudges.find((n) => n.id === p.i);
		placeBestFit(p.i, p.slice, p.label, p.auto, {
			x: p.auto.x + (nudge?.dx ?? 0),
			y: p.auto.y + (nudge?.dy ?? 0),
		});
	}

	return { labels, leaderLines, boxes };
}
