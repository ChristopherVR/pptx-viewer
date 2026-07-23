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
		fontSize: 8,
		fill: '#ffffff',
		textAnchor: 'middle',
		fontWeight: 'bold',
		dominantBaseline: 'central',
	};
}

/** Secondary pie plot: expands the aggregated "Other" slice into its points. */
export function buildSecondaryPie(
	geom: OfPieGeom,
	secondaryValues: number[],
	fills: string[],
	showLabels: boolean,
): { primitives: SvgPath[]; labels: SvgText[] } {
	const angles = sliceAngles(secondaryValues);
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
	const barW = geom.secondaryR * 1.1;
	const barH = geom.secondaryR * 2;
	const barX = geom.secondaryCx - barW / 2;
	const barTop = geom.secondaryCy - barH / 2;
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

/** Two connector lines (c:serLines) from the "Other" slice to the secondary plot. */
export function buildSerLines(geom: OfPieGeom, otherAngle: SliceAngle): SvgLine[] {
	const rimStart = {
		x: geom.primaryCx + geom.primaryR * Math.cos(otherAngle.start),
		y: geom.primaryCy + geom.primaryR * Math.sin(otherAngle.start),
	};
	const rimEnd = {
		x: geom.primaryCx + geom.primaryR * Math.cos(otherAngle.end),
		y: geom.primaryCy + geom.primaryR * Math.sin(otherAngle.end),
	};
	const targetX = geom.secondaryCx - geom.secondaryR * 1.05;
	const line = (from: { x: number; y: number }, ty: number): SvgLine => ({
		kind: 'line',
		x1: from.x,
		y1: from.y,
		x2: targetX,
		y2: ty,
		stroke: '#94a3b8',
		strokeWidth: 1,
		dashArray: '3 2',
	});
	return [
		line(rimStart, geom.secondaryCy - geom.secondaryR),
		line(rimEnd, geom.secondaryCy + geom.secondaryR),
	];
}
