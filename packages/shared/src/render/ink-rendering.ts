/**
 * Ink rendering utilities for pressure-sensitive strokes and replay animation.
 *
 * Pressure sensitivity is approximated by splitting an SVG path into short
 * sub-segments, each rendered as a filled circle at that point's coordinates.
 * The radius of each circle varies according to the corresponding entry in the
 * `inkWidths` array. `C`/`Q` curve segments are sampled at multiple points
 * along the actual curve (De Casteljau evaluation at several `t` steps), not
 * just at their control points and endpoint, so pressure circles track a
 * tightly curved stroke instead of trailing it.
 *
 * Replay animation uses SVG `stroke-dasharray` / `stroke-dashoffset` to
 * progressively reveal each stroke with a sequential delay.
 *
 * Framework-agnostic: only imports core types, so every binding (React, Vue,
 * Angular) consumes one copy instead of duplicating the maths.
 *
 * @module ink-rendering
 */

import type { InkPptxElement, ContentPartInkStroke } from 'pptx-viewer-core';

// ==========================================================================
// SVG path point extraction
// ==========================================================================

/**
 * A 2D point extracted from an SVG path string.
 */
export interface PathPoint {
	x: number;
	y: number;
}

/** Numeric argument count each supported path command consumes. */
const PATH_COMMAND_ARITY: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };

/** One command letter plus every numeric argument that follows it (before the next letter). */
interface RawPathToken {
	cmd: string;
	nums: number[];
}

/**
 * Split a `d` string into command letters with their following numeric args.
 * Case is folded to uppercase; relative (lowercase) commands are treated as
 * absolute, matching this module's pre-existing (documented) limitation for
 * non-absolute paths.
 */
function tokenizeSvgPath(d: string): RawPathToken[] {
	const tokens: RawPathToken[] = [];
	const partRegex = /([MLCQZmlcqz])|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/giu;
	let cmd: string | null = null;
	let nums: number[] = [];
	let match: RegExpExecArray | null;
	const flush = () => {
		if (cmd) {
			tokens.push({ cmd: cmd.toUpperCase(), nums });
		}
	};
	while ((match = partRegex.exec(d)) !== null) {
		if (match[1]) {
			flush();
			cmd = match[1];
			nums = [];
		} else if (match[2] !== undefined && cmd) {
			nums.push(parseFloat(match[2]));
		}
	}
	flush();
	return tokens;
}

function distance(a: PathPoint, b: PathPoint): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Target spacing (px) between curve samples, before min/max clamping. */
const CURVE_SAMPLE_SPACING_PX = 4;
/** Always sample at least this many interior points per curve segment. */
const CURVE_MIN_SAMPLES = 4;
/** Cap samples per curve segment so a huge curve can't blow up point count. */
const CURVE_MAX_SAMPLES = 24;

/**
 * Number of `t` steps to evaluate along a curve segment, scaled by its
 * control-polygon ("hull") length so longer or tighter curves get
 * proportionally more samples.
 */
function curveSampleCount(hullLength: number): number {
	const raw = Math.ceil(hullLength / CURVE_SAMPLE_SPACING_PX);
	return Math.max(CURVE_MIN_SAMPLES, Math.min(CURVE_MAX_SAMPLES, raw));
}

/** Evaluate a cubic Bezier at parameter `t` via De Casteljau's algorithm. */
function cubicBezierAt(
	p0: PathPoint,
	p1: PathPoint,
	p2: PathPoint,
	p3: PathPoint,
	t: number,
): PathPoint {
	const mt = 1 - t;
	const a = { x: mt * p0.x + t * p1.x, y: mt * p0.y + t * p1.y };
	const b = { x: mt * p1.x + t * p2.x, y: mt * p1.y + t * p2.y };
	const c = { x: mt * p2.x + t * p3.x, y: mt * p2.y + t * p3.y };
	const ab = { x: mt * a.x + t * b.x, y: mt * a.y + t * b.y };
	const bc = { x: mt * b.x + t * c.x, y: mt * b.y + t * c.y };
	return { x: mt * ab.x + t * bc.x, y: mt * ab.y + t * bc.y };
}

/** Evaluate a quadratic Bezier at parameter `t` via De Casteljau's algorithm. */
function quadBezierAt(p0: PathPoint, p1: PathPoint, p2: PathPoint, t: number): PathPoint {
	const mt = 1 - t;
	const a = { x: mt * p0.x + t * p1.x, y: mt * p0.y + t * p1.y };
	const b = { x: mt * p1.x + t * p2.x, y: mt * p1.y + t * p2.y };
	return { x: mt * a.x + t * b.x, y: mt * a.y + t * b.y };
}

/** Append the interior + endpoint samples for a cubic curve segment starting at `current`. */
function sampleCubicSegment(
	points: PathPoint[],
	current: PathPoint | undefined,
	p1: PathPoint,
	p2: PathPoint,
	end: PathPoint,
): PathPoint {
	if (!current) {
		// No known start point (malformed path): fall back to the raw
		// control points rather than dropping data.
		points.push(p1, p2, end);
		return end;
	}
	const hull = distance(current, p1) + distance(p1, p2) + distance(p2, end);
	const samples = curveSampleCount(hull);
	for (let i = 1; i <= samples; i++) {
		points.push(cubicBezierAt(current, p1, p2, end, i / samples));
	}
	return end;
}

/** Append the interior + endpoint samples for a quadratic curve segment starting at `current`. */
function sampleQuadSegment(
	points: PathPoint[],
	current: PathPoint | undefined,
	cp: PathPoint,
	end: PathPoint,
): PathPoint {
	if (!current) {
		points.push(cp, end);
		return end;
	}
	const hull = distance(current, cp) + distance(cp, end);
	const samples = curveSampleCount(hull);
	for (let i = 1; i <= samples; i++) {
		points.push(quadBezierAt(current, cp, end, i / samples));
	}
	return end;
}

/**
 * Parse an SVG path `d` string and extract points that lie ON the path.
 *
 * Supports M/m, L/l, C/c, Q/q, Z/z commands. Straight `M`/`L` segments
 * contribute their single endpoint, same as before. Curved `C`/`Q` segments
 * are evaluated at several parametric `t` steps via De Casteljau's algorithm
 * (not just their control points and endpoint), with the sample count scaled
 * to the segment's control-polygon length, so a heavily curved stroke gets a
 * run of points that actually sit on the curve instead of cutting the corner
 * through its (off-curve) control points.
 */
export function extractPathPoints(d: string): PathPoint[] {
	const points: PathPoint[] = [];
	let current: PathPoint | undefined;

	for (const { cmd, nums } of tokenizeSvgPath(d)) {
		const arity = PATH_COMMAND_ARITY[cmd];
		if (cmd === 'Z' || arity === undefined) {
			continue;
		}
		for (let offset = 0; offset + arity <= nums.length; offset += arity) {
			const chunk = nums.slice(offset, offset + arity);
			// Coordinate pairs after the first under an `M` command are
			// implicit linetos per the SVG spec.
			const effective = cmd === 'M' && offset > 0 ? 'L' : cmd;
			if (effective === 'M' || effective === 'L') {
				const pt = { x: chunk[0], y: chunk[1] };
				points.push(pt);
				current = pt;
			} else if (effective === 'C') {
				current = sampleCubicSegment(
					points,
					current,
					{ x: chunk[0], y: chunk[1] },
					{ x: chunk[2], y: chunk[3] },
					{ x: chunk[4], y: chunk[5] },
				);
			} else if (effective === 'Q') {
				current = sampleQuadSegment(
					points,
					current,
					{ x: chunk[0], y: chunk[1] },
					{
						x: chunk[2],
						y: chunk[3],
					},
				);
			}
		}
	}

	return points;
}

// ==========================================================================
// Pressure-sensitive circle generation
// ==========================================================================

/**
 * Configuration for pressure-sensitive rendering.
 */
export interface PressureConfig {
	/** Minimum radius for the thinnest point. Default 0.5. */
	minRadius?: number;
	/** Maximum radius for the widest point. Default is the stroke width. */
	maxRadius?: number;
	/** Base stroke width used as a scaling reference. */
	baseWidth: number;
}

/**
 * A circle representing a single pressure point on an ink stroke.
 */
export interface PressureCircle {
	cx: number;
	cy: number;
	r: number;
}

/**
 * Interpolate a width value for a point along the stroke path.
 *
 * Given an array of width samples, linearly interpolate the width
 * at `t` where `t` is the normalised position along the path (0 to 1).
 */
export function interpolateWidth(widths: number[], t: number): number {
	if (widths.length === 0) {
		return 1;
	}
	if (widths.length === 1) {
		return widths[0];
	}

	const clampedT = Math.max(0, Math.min(1, t));
	const index = clampedT * (widths.length - 1);
	const lower = Math.floor(index);
	const upper = Math.min(lower + 1, widths.length - 1);
	const frac = index - lower;

	return widths[lower] * (1 - frac) + widths[upper] * frac;
}

/**
 * Generate pressure circles for a set of path points with per-point
 * width data.
 *
 * Each extracted point gets a circle whose radius reflects the
 * interpolated width at that position. When `widths` contains fewer
 * entries than `points`, values are interpolated linearly.
 */
export function generatePressureCircles(
	points: PathPoint[],
	widths: number[],
	config: PressureConfig,
): PressureCircle[] {
	if (points.length === 0) {
		return [];
	}

	const minR = config.minRadius ?? 0.5;
	const maxR = config.maxRadius ?? config.baseWidth;

	return points.map((pt, i) => {
		const t = points.length === 1 ? 0.5 : i / (points.length - 1);
		const w = interpolateWidth(widths, t);
		// Scale radius based on the ratio of the interpolated width to
		// the base width, clamped between minR and maxR.
		const ratio = config.baseWidth > 0 ? w / config.baseWidth : 1;
		const r = Math.max(minR, Math.min(maxR, (config.baseWidth / 2) * ratio));
		return { cx: pt.x, cy: pt.y, r };
	});
}

/**
 * Determine whether an ink element has meaningful pressure data that
 * differs from uniform width (i.e., the widths array has variation).
 */
export function hasPressureVariation(widths: number[]): boolean {
	if (widths.length <= 1) {
		return false;
	}
	const first = widths[0];
	return widths.some((w) => Math.abs(w - first) > 0.01);
}

/**
 * Convert per-point pressure values (0-1 range from PointerEvent.pressure)
 * to per-point width values suitable for {@link generatePressureCircles}.
 *
 * Each pressure value is scaled so that a pressure of 0 maps to
 * `baseWidth * minScale` and a pressure of 1 maps to
 * `baseWidth * maxScale`.
 *
 * @param pressures - Per-point pressure values in [0, 1].
 * @param baseWidth - The nominal stroke width.
 * @param minScale  - Width multiplier at zero pressure (default 0.3).
 * @param maxScale  - Width multiplier at full pressure (default 1.8).
 */
export function pressuresToWidths(
	pressures: number[],
	baseWidth: number,
	minScale = 0.3,
	maxScale = 1.8,
): number[] {
	return pressures.map((p) => {
		const clamped = Math.max(0, Math.min(1, p));
		return baseWidth * (minScale + clamped * (maxScale - minScale));
	});
}

// ==========================================================================
// Ink replay animation
// ==========================================================================

/**
 * Configuration for ink replay animation.
 */
export interface InkReplayConfig {
	/** Duration of each stroke's reveal in milliseconds. Default 600. */
	strokeDurationMs?: number;
	/** Delay between consecutive strokes in milliseconds. Default 200. */
	strokeDelayMs?: number;
	/** Easing function. Default "ease-in-out". */
	easing?: string;
}

/**
 * CSS properties for a single ink stroke's replay animation.
 */
export interface InkStrokeAnimationStyle {
	/** Estimated path length for stroke-dasharray. */
	pathLength: number;
	/** Animation delay for this stroke. */
	animationDelay: string;
	/** Animation duration for this stroke. */
	animationDuration: string;
	/** The CSS animation shorthand value. */
	animation: string;
	/** Initial stroke-dasharray value. */
	strokeDasharray: string;
	/** Initial stroke-dashoffset value. */
	strokeDashoffset: string;
}

/**
 * Estimate the length of an SVG path from its point list.
 *
 * This uses the simple Euclidean distance between consecutive points
 * as an approximation. For precise measurement, `SVGPathElement.getTotalLength()`
 * should be used, but this works well for animation setup.
 */
export function estimatePathLength(points: PathPoint[]): number {
	if (points.length < 2) {
		return 0;
	}
	let length = 0;
	for (let i = 1; i < points.length; i++) {
		const dx = points[i].x - points[i - 1].x;
		const dy = points[i].y - points[i - 1].y;
		length += Math.sqrt(dx * dx + dy * dy);
	}
	return length;
}

/**
 * Name for the CSS @keyframes rule used by ink replay.
 */
export const INK_REPLAY_KEYFRAME_NAME = 'pptx-ink-replay';

/**
 * CSS @keyframes definition for ink stroke replay.
 *
 * Uses `stroke-dashoffset` to progressively reveal the stroke
 * from its start to its end.
 */
export const INK_REPLAY_KEYFRAMES = `@keyframes ${INK_REPLAY_KEYFRAME_NAME} {
  from { stroke-dashoffset: var(--ink-path-length); }
  to { stroke-dashoffset: 0; }
}`;

/**
 * Generate animation style properties for a single ink stroke
 * in a replay sequence.
 *
 * @param strokeIndex - Zero-based index of the stroke in the sequence.
 * @param pathLength - Estimated or measured length of the stroke path.
 * @param config - Replay animation configuration.
 */
export function getInkStrokeReplayStyle(
	strokeIndex: number,
	pathLength: number,
	config: InkReplayConfig = {},
): InkStrokeAnimationStyle {
	const duration = config.strokeDurationMs ?? 600;
	const delay = config.strokeDelayMs ?? 200;
	const easing = config.easing ?? 'ease-in-out';

	const totalDelay = strokeIndex * (duration + delay);
	const len = Math.max(pathLength, 1);

	return {
		pathLength: len,
		animationDelay: `${totalDelay}ms`,
		animationDuration: `${duration}ms`,
		animation: `${INK_REPLAY_KEYFRAME_NAME} ${duration}ms ${easing} ${totalDelay}ms forwards`,
		strokeDasharray: `${len}`,
		strokeDashoffset: `${len}`,
	};
}

/**
 * Compute replay animation styles for all strokes in an ink element.
 *
 * Returns an array with one entry per `inkPaths` item. Each entry
 * contains the CSS properties to apply to the corresponding `<path>`.
 */
export function getInkReplayStyles(
	el: InkPptxElement,
	config: InkReplayConfig = {},
): InkStrokeAnimationStyle[] {
	return el.inkPaths.map((d, i) => {
		const points = extractPathPoints(d);
		const pathLen = estimatePathLength(points);
		return getInkStrokeReplayStyle(i, pathLen, config);
	});
}

/**
 * Compute replay animation styles for content part ink strokes.
 */
export function getContentPartReplayStyles(
	strokes: ContentPartInkStroke[],
	config: InkReplayConfig = {},
): InkStrokeAnimationStyle[] {
	return strokes.map((stroke, i) => {
		const points = extractPathPoints(stroke.path);
		const pathLen = estimatePathLength(points);
		return getInkStrokeReplayStyle(i, pathLen, config);
	});
}

// ==========================================================================
// Total replay duration
// ==========================================================================

/**
 * Calculate the total duration of an ink replay animation in milliseconds.
 *
 * @param strokeCount - Number of strokes in the element.
 * @param config - Replay animation configuration.
 */
export function getTotalReplayDuration(strokeCount: number, config: InkReplayConfig = {}): number {
	if (strokeCount <= 0) {
		return 0;
	}
	const duration = config.strokeDurationMs ?? 600;
	const delay = config.strokeDelayMs ?? 200;
	// Last stroke starts at (strokeCount-1)*(duration+delay) and runs for duration ms.
	return (strokeCount - 1) * (duration + delay) + duration;
}

// ==========================================================================
// Opacity helpers
// ==========================================================================

/**
 * Resolve the effective opacity for an ink stroke path.
 *
 * Falls back to 1 if no opacity array is present or the index is out of range.
 * Clamps values to the [0, 1] range.
 */
export function resolveInkOpacity(opacities: number[] | undefined, index: number): number {
	if (!opacities || index >= opacities.length) {
		return 1;
	}
	return Math.max(0, Math.min(1, opacities[index]));
}

/**
 * Resolve the effective stroke color for an ink path.
 */
export function resolveInkColor(
	colors: string[] | undefined,
	index: number,
	fallback = '#000',
): string {
	if (!colors || index >= colors.length) {
		return fallback;
	}
	return colors[index] || fallback;
}

/**
 * Resolve the effective stroke width for an ink path.
 */
export function resolveInkWidth(widths: number[] | undefined, index: number, fallback = 3): number {
	if (!widths || index >= widths.length) {
		return fallback;
	}
	return widths[index] > 0 ? widths[index] : fallback;
}
