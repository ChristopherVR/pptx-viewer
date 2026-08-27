/**
 * chart-pie3d-tilt.ts: elliptical tilt foreshortening for `pie3D`.
 *
 * `chart-3d-depth.ts` gives every 3D chart type an additive oblique-projection
 * depth pass, but a `pie3D` chart's flat face itself stayed a perfect circle:
 * PowerPoint's own `pie3D` renders the disc as an ellipse once `c:view3D`'s
 * `rotX` tilts it away from square-on, because a circle viewed off-axis
 * foreshortens vertically. This module supplies that missing squash within
 * the same illusion-based approach (no camera/projection rewrite): it scales
 * the pie's already-built flat geometry vertically about its centre, so the
 * slices, their leader lines, and their data labels all move together.
 *
 * @module chart-pie3d-tilt
 */
import type { PptxChartView3D } from 'pptx-viewer-core';

import type { ChartViewModel, SvgLine } from './chart-view-model';

const DEFAULT_ROT_X = 15;
/** Never squash a tilted pie3D past this fraction of its true radius. */
const MIN_PIE_TILT_SCALE = 0.15;

/**
 * The vertical squash a tilted `pie3D` face should get. Viewed from `rotX`
 * degrees off square-on, a circle of radius r projects to an ellipse whose
 * vertical radius is `r * cos(rotX)`. Clamped so an extreme rotX never
 * collapses the pie to an illegible sliver.
 */
export function computePieTiltScale(view3D: PptxChartView3D | undefined): number {
	const rotX = view3D?.rotX ?? DEFAULT_ROT_X;
	const scale = Math.cos((rotX * Math.PI) / 180);
	return Math.min(1, Math.max(Math.abs(scale), MIN_PIE_TILT_SCALE));
}

/**
 * Squash a generated pie-slice path (`M`/`L`/`A`/`Z` grammar) vertically about
 * `cy` by `scaleY`, turning its circular arcs into elliptical ones. `rx` is
 * left untouched (the tilt is purely a foreshortening of the vertical axis);
 * `ry` and every y-coordinate scale by `scaleY` around the pie's centre.
 */
export function squashSlicePathVertical(d: string, cy: number, scaleY: number): string {
	const tokens = d.match(/[MLAZ][^MLAZ]*/gu);
	if (!tokens) {
		return d;
	}
	const squashY = (y: number): number => cy + (y - cy) * scaleY;
	return tokens
		.map((token) => {
			const cmd = token[0];
			const nums = token
				.slice(1)
				.trim()
				.split(/[ ,]+/u)
				.filter((s) => s.length > 0)
				.map(Number);
			if (cmd === 'M' || cmd === 'L') {
				const out: number[] = [];
				for (let i = 0; i < nums.length; i += 2) {
					out.push(nums[i], squashY(nums[i + 1]));
				}
				return `${cmd}${pairs(out)}`;
			}
			if (cmd === 'A') {
				// rx ry xrot large sweep x y -> squash ry + the endpoint's y only.
				const [rx, ry, xrot, largeArc, sweep, ex, ey] = nums;
				return `A${rx},${ry * scaleY},${xrot},${largeArc},${sweep},${ex},${squashY(ey)}`;
			}
			return 'Z';
		})
		.join('');
}

function pairs(nums: number[]): string {
	const out: string[] = [];
	for (let i = 0; i < nums.length; i += 2) {
		out.push(`${nums[i]},${nums[i + 1]}`);
	}
	return out.join(' ');
}

/**
 * Squash a pie3D flat view-model's slices, leader lines and data labels by
 * `scaleY` about `cy` (from {@link computePieTiltScale}), so the whole disc
 * (and everything anchored to its rim) tilts together.
 */
export function applyPieTiltForeshortening(
	vm: ChartViewModel,
	cy: number,
	scaleY: number,
): ChartViewModel {
	const primitives = vm.primitives.map((p) => {
		if (p.kind === 'path') {
			return { ...p, d: squashSlicePathVertical(p.d, cy, scaleY) };
		}
		if (p.kind === 'line') {
			const line = p as SvgLine;
			return { ...line, y1: cy + (line.y1 - cy) * scaleY, y2: cy + (line.y2 - cy) * scaleY };
		}
		return p;
	});
	const dataLabels = vm.dataLabels.map((label) => ({
		...label,
		y: cy + (label.y - cy) * scaleY,
	}));
	return { ...vm, primitives, dataLabels };
}
