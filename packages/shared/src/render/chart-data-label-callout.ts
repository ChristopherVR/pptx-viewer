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

import type { SvgLine, SvgPolygon, SvgPrimitive, SvgText } from './chart-view-model-types';

/** The rectangle a label's text occupies, estimated from its font size. */
function labelBox(label: SvgText): { x: number; y: number; w: number; h: number } {
	const pad = 3;
	const w = label.text.length * label.fontSize * 0.52 + pad * 2;
	const h = label.fontSize * 1.3 + pad;
	const x =
		label.textAnchor === 'middle'
			? label.x - w / 2
			: label.textAnchor === 'end'
				? label.x - w + pad
				: label.x - pad;
	const centred = label.dominantBaseline === 'central' || label.dominantBaseline === 'middle';
	const y = centred ? label.y - h / 2 : label.y - label.fontSize * 0.95 - pad / 2;
	return { x, y, w, h };
}

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
 *              draws a leader line only for a moved label.
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
	if (!shape && !callout && !(moved && (opts?.extLeaderLines ?? opts?.showLeaderLines))) {
		return [];
	}
	const box = labelBox(label);
	if (shape || callout) {
		const polygon: SvgPolygon = {
			kind: 'polygon',
			points: calloutPoints(box, callout ? target : undefined),
			fill: shape?.fillColor ?? 'none',
			stroke: shape?.strokeColor ?? 'none',
			strokeWidth: shape?.strokeWidth ?? 0,
		};
		if (callout) {
			return [polygon];
		}
		if (!moved || !(opts?.extLeaderLines ?? opts?.showLeaderLines)) {
			return [polygon];
		}
		return [polygon, leaderLine(box, target, opts)];
	}
	return [leaderLine(box, target, opts)];
}

function leaderLine(
	box: { x: number; y: number; w: number; h: number },
	target: { x: number; y: number },
	opts: { leaderLineStyle?: { strokeColor?: string; strokeWidth?: number } } | undefined,
): SvgLine {
	const fromX = Math.min(Math.max(target.x, box.x), box.x + box.w);
	const fromY =
		target.y > box.y + box.h ? box.y + box.h : target.y < box.y ? box.y : box.y + box.h / 2;
	return {
		kind: 'line',
		x1: r2(fromX),
		y1: r2(fromY),
		x2: r2(target.x),
		y2: r2(target.y),
		stroke: opts?.leaderLineStyle?.strokeColor ?? '#A6A6A6',
		strokeWidth: opts?.leaderLineStyle?.strokeWidth ?? 1,
	};
}
