/**
 * SmartArt DiagramML interpreter - `conn` algorithm path geometry.
 *
 * Split out of `smartart-layout-interpreter-aux.ts` to keep that file under
 * the repo's per-file line budget. Builds the SVG path for one connector,
 * honouring the algorithm params real `conn` layoutNodes carry:
 *
 *   - `begSty`/`endSty` (`dgm:param`, `arr`/`noArr`): whether an arrowhead is
 *     drawn at the connector's start/end. Default `noArr`/`arr` matches the
 *     pre-existing single-arrowhead-at-target behaviour.
 *   - `connRout` (`stra`/`bend`/`curve`): straight line (default, pre-existing
 *     behaviour), a single-bend orthogonal elbow, or a smooth curve.
 *   - `bendPt`: which corner-routing shape the bend takes when `connRout=bend`.
 *     Only the fixed midpoint elbow is modelled (see `elbowPath`) - the enum's
 *     finer variants are not distinguished, a documented simplification.
 *   - `dim` (`1D`/`2D`): `1D` (default) connects the two rects' facing edges
 *     along the flow axis, matching the pre-existing behaviour; `2D` connects
 *     their centres directly, letting the path run off-axis.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { RenderedRectNode } from './smartart-layout-types';

/** Half-width of the drawn arrowhead wings, in px. */
const ARROW_WING = 4;
/** Length of the arrowhead along the connector, in px. */
const ARROW_HEAD = 7;

export type ConnArrowStyle = 'arr' | 'noArr';
export type ConnRouting = 'stra' | 'bend' | 'curve';
export type ConnDimension = '1D' | '2D';

/** SVG path fragment for an arrowhead at `(tipX,tipY)`, arriving along unit vector `(ux,uy)`. */
function arrowHeadPath(tipX: number, tipY: number, ux: number, uy: number): string {
	const bx = tipX - ux * ARROW_HEAD;
	const by = tipY - uy * ARROW_HEAD;
	const px = -uy;
	const py = ux;
	const w1x = bx + px * ARROW_WING;
	const w1y = by + py * ARROW_WING;
	const w2x = bx - px * ARROW_WING;
	const w2y = by - py * ARROW_WING;
	return ` M${w1x},${w1y} L${tipX},${tipY} L${w2x},${w2y}`;
}

/** Arrowhead fragments for both ends, given the connector's overall travel direction. */
function endHeads(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	begSty: ConnArrowStyle,
	endSty: ConnArrowStyle,
): string {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const len = Math.hypot(dx, dy);
	if (len < 1e-6) {
		return '';
	}
	const ux = dx / len;
	const uy = dy / len;
	let heads = '';
	if (endSty === 'arr') {
		heads += arrowHeadPath(x1, y1, ux, uy);
	}
	if (begSty === 'arr') {
		heads += arrowHeadPath(x0, y0, -ux, -uy);
	}
	return heads;
}

/** Straight connector, matching the pre-existing single-segment path. */
function straightPath(x0: number, y0: number, x1: number, y1: number): string {
	return `M${x0},${y0} L${x1},${y1}`;
}

/**
 * Single-bend orthogonal elbow: bends at the midpoint of whichever axis has the
 * larger span, so a mostly-horizontal pair bends vertically (and vice versa).
 */
function elbowPath(x0: number, y0: number, x1: number, y1: number): string {
	if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) {
		const midX = (x0 + x1) / 2;
		return `M${x0},${y0} L${midX},${y0} L${midX},${y1} L${x1},${y1}`;
	}
	const midY = (y0 + y1) / 2;
	return `M${x0},${y0} L${x0},${midY} L${x1},${midY} L${x1},${y1}`;
}

/** Smooth quadratic-curve connector, bowed away from the box centre. */
function curvePath(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	centre: { x: number; y: number },
): string {
	const midX = (x0 + x1) / 2;
	const midY = (y0 + y1) / 2;
	const pull = 1 + 30 / Math.max(1, Math.hypot(midX - centre.x, midY - centre.y));
	const controlX = centre.x + (midX - centre.x) * pull;
	const controlY = centre.y + (midY - centre.y) * pull;
	return `M${x0},${y0} Q${controlX},${controlY} ${x1},${y1}`;
}

/** Full SVG path (line/elbow/curve + arrowheads) for one `conn` connector. */
export function connectorPath(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	centre: { x: number; y: number },
	routing: ConnRouting,
	begSty: ConnArrowStyle,
	endSty: ConnArrowStyle,
): string {
	const body =
		routing === 'bend'
			? elbowPath(x0, y0, x1, y1)
			: routing === 'curve'
				? curvePath(x0, y0, x1, y1, centre)
				: straightPath(x0, y0, x1, y1);
	return body + endHeads(x0, y0, x1, y1, begSty, endSty);
}

/**
 * Connection endpoints between two rects. `1D` (default) links the facing
 * edges along the flow axis (pre-existing behaviour); `2D` links the rects'
 * centres directly, letting the connector run off the flow axis.
 */
export function connectorEndpoints(
	from: RenderedRectNode,
	to: RenderedRectNode,
	horizontal: boolean,
	dim: ConnDimension,
): { x0: number; y0: number; x1: number; y1: number } {
	const fromCx = from.x + from.width / 2;
	const fromCy = from.y + from.height / 2;
	const toCx = to.x + to.width / 2;
	const toCy = to.y + to.height / 2;
	if (dim === '2D') {
		return { x0: fromCx, y0: fromCy, x1: toCx, y1: toCy };
	}
	if (horizontal) {
		// Link the trailing edge of `from` to the leading edge of `to`, following
		// the geometric order so it works for both forward and reversed flow.
		const leftFirst = fromCx <= toCx;
		return leftFirst
			? { x0: from.x + from.width, y0: fromCy, x1: to.x, y1: toCy }
			: { x0: from.x, y0: fromCy, x1: to.x + to.width, y1: toCy };
	}
	const topFirst = fromCy <= toCy;
	return topFirst
		? { x0: fromCx, y0: from.y + from.height, x1: toCx, y1: to.y }
		: { x0: fromCx, y0: from.y, x1: toCx, y1: to.y + to.height };
}
