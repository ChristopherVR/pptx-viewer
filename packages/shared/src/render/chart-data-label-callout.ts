/**
 * The box, callout pointer and leader line PowerPoint draws around a chart
 * data label (`c:dLbls/c:spPr`, `c15:spPr/a:prstGeom`, `c15:showLeaderLines`;
 * parsed by core's `chart-data-label-box.ts`).
 *
 * COM-verified against charts-com.pptx slide 17: series 1's labels are pale
 * yellow `wedgeRectCallout` boxes whose pointer reaches the top of their bar,
 * including the one label the author dragged away. They used to render as
 * bare text. The decorations are ordinary polygon / line primitives placed
 * BEFORE the label text in paint order, so every binding draws them with no
 * projector change.
 *
 * @module chart-data-label-callout
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { findPointLabel } from './chart-data-label-anchor';
import { dataLabelBox } from './chart-label-measure';
import type { SvgPolygon, SvgPolyline, SvgPrimitive, SvgText } from './chart-view-model-types';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A box outline, with a pointer to `target` spliced into the edge facing it. */
function calloutPoints(
	box: { x: number; y: number; w: number; h: number },
	target: { x: number; y: number } | undefined,
): string {
	const { x, y, w, h } = box;
	const corners = [
		[x, y],
		[x + w, y],
		[x + w, y + h],
		[x, y + h],
	];
	if (!target) {
		return corners.map(([px, py]) => `${r2(px)},${r2(py)}`).join(' ');
	}
	const below = target.y > y + h;
	const above = target.y < y;
	const base = Math.max(6, Math.min(w, h) * 0.5);
	const cx = Math.min(Math.max(target.x, x + base), x + w - base);
	const cy = Math.min(Math.max(target.y, y + base / 2), y + h - base / 2);
	const pts: number[][] = [];
	if (below) {
		pts.push(
			corners[0],
			corners[1],
			corners[2],
			[cx + base / 2, y + h],
			[target.x, target.y],
			[cx - base / 2, y + h],
			corners[3],
		);
	} else if (above) {
		pts.push(
			corners[0],
			[cx - base / 2, y],
			[target.x, target.y],
			[cx + base / 2, y],
			corners[1],
			corners[2],
			corners[3],
		);
	} else if (target.x > x + w) {
		pts.push(
			corners[0],
			corners[1],
			[x + w, cy - base / 4],
			[target.x, target.y],
			[x + w, cy + base / 4],
			corners[2],
			corners[3],
		);
	} else {
		pts.push(
			corners[0],
			corners[1],
			corners[2],
			corners[3],
			[x, cy + base / 4],
			[target.x, target.y],
			[x, cy - base / 4],
		);
	}
	return pts.map(([px, py]) => `${r2(px)},${r2(py)}`).join(' ');
}

/**
 * How far PowerPoint lifts an unmoved callout label off its point so the
 * pointer shows (COM: charts-com.pptx slide 17, about one and a half label
 * lines); 0 for a plain label or one the author dragged.
 */
export function calloutLabelLift(
	chartData: PptxChartData,
	series: PptxChartSeries,
	fontSize: number,
	moved: boolean,
): number {
	const opts = series.dataLabelOptions ?? chartData.style?.dataLabels;
	const callout = opts?.calloutShape?.toLowerCase().includes('callout') === true;
	return callout && !moved ? Math.round(fontSize * 1.6) : 0;
}

/**
 * Decorations for one data label: its box (a callout pointing at `target`
 * when the label box is a `wedge*Callout`), or a leader line from a moved
 * label back to its point. Empty when the label authors none of these.
 *
 * @param moved Whether the label was dragged (`c:dLbl/c:layout`); PowerPoint
 *              draws a leader line only for a moved label, callout or not.
 */
export function buildDataLabelDecorations(
	chartData: PptxChartData,
	series: PptxChartSeries,
	label: SvgText,
	target: { x: number; y: number },
	moved: boolean,
): SvgPrimitive[] {
	const opts = series.dataLabelOptions ?? chartData.style?.dataLabels;
	const shape = opts?.labelShape;
	const callout = opts?.calloutShape?.toLowerCase().includes('callout') === true;
	const leader = moved && (opts?.extLeaderLines ?? opts?.showLeaderLines) === true;
	if (!shape && !callout && !leader) {
		return [];
	}
	const box = dataLabelBox(label);
	const out: SvgPrimitive[] = leader ? [leaderLine(box, target, opts)] : [];
	if (shape || callout) {
		// The pointer only shows when the point lies outside the box: a label
		// PowerPoint centres on its point (area, doughnut) draws a plain box.
		const pointer = callout && !contains(box, target) ? target : undefined;
		out.push({
			kind: 'polygon',
			points: calloutPoints(box, pointer),
			fill: shape?.fillColor ?? 'none',
			stroke: shape?.strokeColor ?? 'none',
			// An `a:ln` with no `@w` is PowerPoint's hairline default, not "no line".
			strokeWidth: shape?.strokeWidth ?? (shape?.strokeColor ? 1 : 0),
		} satisfies SvgPolygon);
	}
	return out;
}

/**
 * {@link buildDataLabelDecorations} for the label of point `pointIndex`,
 * reading whether the author dragged it (`c:dLbl/c:layout`) itself. The
 * `target` is what PowerPoint points the callout and leader line at: the
 * marker (line, scatter, radar), the bubble or band centre (bubble, area), the
 * rim (pie) or the middle of the ring (doughnut).
 */
export function buildPointLabelDecorations(
	chartData: PptxChartData,
	series: PptxChartSeries,
	pointIndex: number,
	label: SvgText,
	target: { x: number; y: number },
): SvgPrimitive[] {
	const moved = Boolean(findPointLabel(series, pointIndex)?.layout);
	return buildDataLabelDecorations(chartData, series, label, target, moved);
}

function contains(
	box: { x: number; y: number; w: number; h: number },
	p: { x: number; y: number },
) {
	return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
}

/** PowerPoint's elbow stub: the leader leaves the box edge facing the point. */
const LEADER_STUB = 5;

function leaderLine(
	box: { x: number; y: number; w: number; h: number },
	target: { x: number; y: number },
	opts: { leaderLineStyle?: { strokeColor?: string; strokeWidth?: number } } | undefined,
): SvgPolyline {
	// COM: a leader leaves the middle of the box side that faces the point with
	// a short horizontal stub, then runs straight to the point.
	let from: [number, number];
	let elbow: [number, number];
	if (target.x < box.x || target.x > box.x + box.w) {
		const x = target.x < box.x ? box.x : box.x + box.w;
		const dir = target.x < box.x ? -1 : 1;
		from = [x, box.y + box.h / 2];
		elbow = [x + dir * LEADER_STUB, box.y + box.h / 2];
	} else {
		const y = target.y > box.y + box.h ? box.y + box.h : box.y;
		const dir = target.y > box.y + box.h ? 1 : -1;
		from = [box.x + box.w / 2, y];
		elbow = [box.x + box.w / 2, y + dir * LEADER_STUB];
	}
	return {
		kind: 'polyline',
		points: [from, elbow, [target.x, target.y]].map(([x, y]) => `${r2(x)},${r2(y)}`).join(' '),
		fill: 'none',
		stroke: opts?.leaderLineStyle?.strokeColor ?? '#A6A6A6',
		strokeWidth: opts?.leaderLineStyle?.strokeWidth ?? 1,
	};
}

/**
 * Push a point's label and, into `boxes`, its decorations (see
 * {@link buildPointLabelDecorations}). A builder appends `boxes` after its own
 * marks, so the box sits over the series and under the label text.
 */
export function pushPointLabel(
	dataLabels: SvgText[],
	boxes: SvgPrimitive[],
	chartData: PptxChartData,
	series: PptxChartSeries,
	pointIndex: number,
	target: { x: number; y: number },
	label: SvgText,
): void {
	dataLabels.push(label);
	boxes.push(...buildPointLabelDecorations(chartData, series, pointIndex, label, target));
}
