/**
 * chart-3d-depth.ts: pseudo-3D depth treatment for the flat chart engine.
 *
 * The shared chart engine projects `bar3D` / `pie3D` / `line3D` / `area3D` with
 * their 2D geometry (folded onto `bar` / `pie` / `line` / `area`). This module
 * layers a lightweight oblique-projection depth pass on top of that flat output,
 * driven by the chart's `c:view3D` parameters (`rotX`, `rotY`, `depthPercent`),
 * so a 3D chart reads as 3D instead of collapsing to a flat plot.
 *
 * The pass is deliberately additive: it inserts shaded "extrusion" primitives
 * BEHIND the existing flat marks (top + side faces for bars, a downward thickness
 * band for pie slices, an offset ribbon for line/area). It never mutates the
 * front-face geometry, so interactivity (`part` refs, value-drag) is unchanged.
 *
 * @module chart-3d-depth
 */
import type { PptxChartView3D } from 'pptx-viewer-core';

import { shade, tint } from './chart-palette';
import type {
	ChartViewModel,
	SvgPath,
	SvgPolygon,
	SvgPolyline,
	SvgPrimitive,
	SvgRect,
} from './chart-view-model';

/** Oblique depth offset vector (px) derived from the chart's view3D. */
export interface DepthVector {
	dx: number;
	dy: number;
	magnitude: number;
}

const DEFAULT_ROT_X = 15;
const DEFAULT_ROT_Y = 20;
const MIN_DEPTH_PX = 5;
const MAX_DEPTH_PX = 22;

/**
 * Resolve the oblique depth vector from `c:view3D`. `rotY` drives the horizontal
 * skew, `rotX` the vertical skew, `depthPercent` the magnitude. Absent values
 * fall back to PowerPoint-like defaults so an untagged 3D chart still gets depth.
 */
export function computeDepthVector(view3D: PptxChartView3D | undefined): DepthVector {
	const rotX = view3D?.rotX ?? DEFAULT_ROT_X;
	const rotY = view3D?.rotY ?? DEFAULT_ROT_Y;
	const depthScale = Math.min(Math.max((view3D?.depthPercent ?? 100) / 100, 0.4), 2);
	const magnitude = Math.min(Math.max(13 * depthScale, MIN_DEPTH_PX), MAX_DEPTH_PX);
	const rx = (rotX * Math.PI) / 180;
	const ry = (rotY * Math.PI) / 180;
	return {
		dx: Math.sin(ry) * magnitude,
		dy: -Math.sin(rx) * magnitude,
		magnitude,
	};
}

/** Top + right-side extrusion faces for one bar rectangle. */
function barExtrusion(rect: SvgRect, depth: DepthVector): SvgPolygon[] {
	const { x, y, w, h, fill } = rect;
	const { dx, dy } = depth;
	const topFace: SvgPolygon = {
		kind: 'polygon',
		points: `${x},${y} ${x + w},${y} ${x + w + dx},${y + dy} ${x + dx},${y + dy}`,
		fill: tint(fill, 0.22),
		stroke: 'none',
		strokeWidth: 0,
	};
	const sideFace: SvgPolygon = {
		kind: 'polygon',
		points: `${x + w},${y} ${x + w},${y + h} ${x + w + dx},${y + h + dy} ${x + w + dx},${y + dy}`,
		fill: shade(fill, 0.25),
		stroke: 'none',
		strokeWidth: 0,
	};
	return [topFace, sideFace];
}

/** Translate a generated pie-slice path (`M`/`L`/`A`/`Z` grammar) by (dx, dy). */
export function translateSlicePath(d: string, dx: number, dy: number): string {
	const tokens = d.match(/[MLAZ][^MLAZ]*/gu);
	if (!tokens) {
		return d;
	}
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
					out.push(nums[i] + dx, nums[i + 1] + dy);
				}
				return `${cmd}${pairs(out)}`;
			}
			if (cmd === 'A') {
				// rx ry xrot large sweep x y -> translate only the endpoint (last pair).
				const head = nums.slice(0, 5);
				const ex = nums[5] + dx;
				const ey = nums[6] + dy;
				return `A${head.join(',')},${ex},${ey}`;
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

/** Shaded downward thickness copies of each pie slice (drawn behind the flat pie). */
function pieExtrusion(paths: SvgPath[], depth: DepthVector): SvgPath[] {
	const offsetY = Math.max(depth.magnitude, 6);
	return paths.map((p) => ({
		kind: 'path',
		d: translateSlicePath(p.d, 0, offsetY),
		fill: shade(p.fill, 0.32),
		stroke: shade(p.fill, 0.4),
		strokeWidth: 0.5,
	}));
}

/** Shaded offset copies of line/area marks (drawn behind for a depth ribbon). */
function ribbonExtrusion(prims: SvgPrimitive[], depth: DepthVector): SvgPrimitive[] {
	const out: SvgPrimitive[] = [];
	for (const prim of prims) {
		if (prim.kind === 'polyline') {
			const pl = prim as SvgPolyline;
			out.push({
				...pl,
				points: shiftPoints(pl.points, depth.dx, depth.dy),
				stroke: shade(pl.stroke, 0.3),
				fill: 'none',
				part: undefined,
			});
		} else if (prim.kind === 'polygon') {
			const pg = prim as SvgPolygon;
			out.push({
				...pg,
				points: shiftPoints(pg.points, depth.dx, depth.dy),
				fill: shade(pg.fill === 'none' ? '#888888' : pg.fill, 0.3),
				part: undefined,
			});
		}
	}
	return out;
}

function shiftPoints(points: string, dx: number, dy: number): string {
	return points
		.trim()
		.split(/\s+/u)
		.map((pair) => {
			const [px, py] = pair.split(',').map(Number);
			return `${px + dx},${py + dy}`;
		})
		.join(' ');
}

/**
 * Apply a pseudo-3D depth pass to a flat view-model for a 3D chart type. Returns
 * a new view-model whose `primitives` are prefixed with shaded extrusion faces;
 * non-3D types (or unsupported kinds) return the input unchanged.
 */
export function applyChart3DDepth(
	vm: ChartViewModel,
	chartType: string,
	view3D: PptxChartView3D | undefined,
): ChartViewModel {
	const depth = computeDepthVector(view3D);
	let extrusion: SvgPrimitive[] = [];

	if (chartType === 'bar3D') {
		const bars = vm.primitives.filter(
			(p): p is SvgRect => p.kind === 'rect' && p.part?.role === 'dataPoint',
		);
		extrusion = bars.flatMap((r) => barExtrusion(r, depth));
	} else if (chartType === 'pie3D') {
		const slices = vm.primitives.filter((p): p is SvgPath => p.kind === 'path');
		extrusion = pieExtrusion(slices, depth);
	} else if (chartType === 'line3D' || chartType === 'area3D') {
		extrusion = ribbonExtrusion(vm.primitives, depth);
	} else {
		return vm;
	}

	if (extrusion.length === 0) {
		return vm;
	}
	return { ...vm, primitives: [...extrusion, ...vm.primitives] };
}
