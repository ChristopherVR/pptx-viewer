/**
 * chart-ofpie-secondary.ts: secondary-plot + connector builders for the
 * pie-of-pie / bar-of-pie chart (`c:ofPieChart`).
 *
 * Split out of `chart-ofpie.ts` to keep each module within the repo's ~300-LOC
 * limit. Builds the expanded secondary plot (a smaller pie or a vertical stacked
 * bar) and the `c:serLines` connectors joining the primary "Other" slice to it.
 *
 * @module chart-ofpie-secondary
 */
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { OfPieGeom, SliceAngle } from './chart-ofpie-split';
import { sliceAngles } from './chart-ofpie-split';
import type { SvgLine, SvgPath, SvgRect, SvgText } from './chart-view-model';
import { computePieSlicePath, formatAxisValue } from './chart-view-model';

/** A bold centred value label for a slice / bar segment. */
export function sliceLabel(x: number, y: number, value: number): SvgText {
	return {
		kind: 'text',
		x,
		y,
		text: formatAxisValue(value),
		fontSize: DEFAULT_CHART_DATA_LABEL_PX,
		fill: '#ffffff',
		textAnchor: 'middle',
		fontWeight: 'bold',
		dominantBaseline: 'central',
	};
}

/**
 * Secondary pie plot: expands the aggregated "Other" slice into its points.
 * `startAngle` is where its first slice begins (PowerPoint starts it where the
 * primary "Other" slice ends; see `buildOfPieViewModel`).
 */
export function buildSecondaryPie(
	geom: OfPieGeom,
	secondaryValues: number[],
	fills: string[],
	showLabels: boolean,
	startAngle?: number,
): { primitives: SvgPath[]; labels: SvgText[] } {
	const angles = sliceAngles(secondaryValues, startAngle);
	const primitives: SvgPath[] = [];
	const labels: SvgText[] = [];
	angles.forEach((a, i) => {
		const geoSlice = computePieSlicePath(
			geom.secondaryCx,
			geom.secondaryCy,
			geom.secondaryR,
			0,
			a.start,
			a.end,
		);
		primitives.push({
			kind: 'path',
			d: geoSlice.d,
			fill: fills[i],
			stroke: '#ffffff',
			strokeWidth: 1.5,
		});
		if (showLabels) {
			labels.push(sliceLabel(geoSlice.labelX, geoSlice.labelY, secondaryValues[i]));
		}
	});
	return { primitives, labels };
}

/** Secondary bar plot (bar-of-pie): a vertical stack of the secondary points. */
export function buildSecondaryBar(
	geom: OfPieGeom,
	secondaryValues: number[],
	fills: string[],
	showLabels: boolean,
): { primitives: SvgRect[]; labels: SvgText[] } {
	const total = secondaryValues.reduce((s, v) => s + Math.abs(v), 0) || 1;
	const { x: barX, y: barTop, w: barW, h: barH } = secondaryBarBox(geom);
	const primitives: SvgRect[] = [];
	const labels: SvgText[] = [];
	let cursorY = barTop;
	secondaryValues.forEach((v, i) => {
		const h = Math.max((Math.abs(v) / total) * barH, 1);
		primitives.push({ kind: 'rect', x: barX, y: cursorY, w: barW, h, fill: fills[i] });
		if (showLabels) {
			labels.push(sliceLabel(geom.secondaryCx, cursorY + h / 2, v));
		}
		cursorY += h;
	});
	return { primitives, labels };
}

/**
 * Two connector lines (c:serLines) from the rim ends of the "Other" slice to
 * the secondary plot: its top and bottom points for a pie, its left corners
 * for a bar. PowerPoint draws them solid, thin and grey (the built-in
 * `tx1` 35% line; COM-verified charts-com.pptx slides 5 and 6).
 */
export function buildSerLines(geom: OfPieGeom, otherAngle: SliceAngle, toBar: boolean): SvgLine[] {
	const rim = (angle: number) => ({
		x: geom.primaryCx + geom.primaryR * Math.cos(angle),
		y: geom.primaryCy + geom.primaryR * Math.sin(angle),
	});
	const upper = rim(otherAngle.start);
	const lower = rim(otherAngle.end);
	const bar = secondaryBarBox(geom);
	const targetX = toBar ? bar.x : geom.secondaryCx;
	const topY = toBar ? bar.y : geom.secondaryCy - geom.secondaryR;
	const bottomY = toBar ? bar.y + bar.h : geom.secondaryCy + geom.secondaryR;
	const line = (from: { x: number; y: number }, ty: number): SvgLine => ({
		kind: 'line',
		x1: from.x,
		y1: from.y,
		x2: targetX,
		y2: ty,
		stroke: '#A6A6A6',
		strokeWidth: 1,
	});
	return [line(upper, topY), line(lower, bottomY)];
}

/** The secondary bar's box (bar-of-pie), shared by the bar and its serLines. */
export function secondaryBarBox(geom: OfPieGeom): { x: number; y: number; w: number; h: number } {
	const w = geom.secondaryR * 1.1;
	const h = geom.secondaryR * 2;
	return { x: geom.secondaryCx - w / 2, y: geom.secondaryCy - h / 2, w, h };
}
