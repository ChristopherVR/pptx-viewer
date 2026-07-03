import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';

import { DEFAULT_STROKE_COLOR } from './constants';
import type { StyleMap } from './element-style';
import { getContainerStyle } from './element-style';

/**
 * Pure helpers for `InkRendererComponent`.
 *
 * All functions are framework-agnostic (no Angular dependency) so they can be
 * unit-tested without TestBed, following the same pattern as
 * `connector-path.ts`.
 *
 * Pressure-sensitive strokes are approximated the same way React's
 * `ink-rendering.ts` does it: the path is sampled into points and each point is
 * drawn as a filled circle whose radius follows the per-point pressure/width,
 * producing a variable-width look. Strokes without pressure variation fall back
 * to a single constant-width `<path>`.
 */

/** A 2D point extracted from an SVG path string. */
export interface PathPoint {
	x: number;
	y: number;
}

/** A circle representing a single pressure point on an ink stroke. */
export interface PressureCircle {
	cx: number;
	cy: number;
	r: number;
}

/** Resolved per-stroke data used to render a single `<path>` (or circle set). */
export interface InkStroke {
	d: string;
	color: string;
	width: number;
	opacity: number;
	/**
	 * When present, render as pressure-sensitive circles instead of a plain
	 * constant-width `<path>`. Empty/absent means a constant-width stroke.
	 */
	circles?: PressureCircle[];
}

/**
 * Parse an SVG path `d` string and extract coordinate points.
 *
 * Curves are sampled at their control points and endpoints (not interpolated),
 * which is sufficient for pressure-width rendering where each extracted point
 * gets a circle overlay.
 */
export function extractPathPoints(d: string): PathPoint[] {
	const points: PathPoint[] = [];
	const numberRegex = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/giu;
	const numbers: number[] = [];
	let match: RegExpExecArray | null;
	while ((match = numberRegex.exec(d)) !== null) {
		numbers.push(Number.parseFloat(match[0]));
	}
	for (let i = 0; i < numbers.length - 1; i += 2) {
		points.push({ x: numbers[i], y: numbers[i + 1] });
	}
	return points;
}

/**
 * Linearly interpolate a width value at normalised position `t` (0..1) along a
 * stroke, given a list of width samples.
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
 * Whether a width/pressure array has meaningful variation (i.e. is not uniform).
 */
export function hasPressureVariation(values: number[]): boolean {
	if (values.length <= 1) {
		return false;
	}
	const first = values[0];
	return values.some((v) => Math.abs(v - first) > 0.01);
}

/**
 * Convert per-point pressure values (0-1, e.g. `PointerEvent.pressure`) to
 * per-point width values. Zero pressure maps to `baseWidth * minScale`, full
 * pressure to `baseWidth * maxScale`.
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

/**
 * Generate pressure circles for a stroke's path points using per-point width
 * data. Widths shorter than the point list are interpolated linearly.
 */
export function generatePressureCircles(
	points: PathPoint[],
	widths: number[],
	baseWidth: number,
	minRadius = 0.5,
	maxRadius = baseWidth * 1.5,
): PressureCircle[] {
	if (points.length === 0) {
		return [];
	}
	return points.map((pt, i) => {
		const t = points.length === 1 ? 0.5 : i / (points.length - 1);
		const w = interpolateWidth(widths, t);
		const ratio = baseWidth > 0 ? w / baseWidth : 1;
		const r = Math.max(minRadius, Math.min(maxRadius, (baseWidth / 2) * ratio));
		return { cx: pt.x, cy: pt.y, r };
	});
}

/**
 * Compute pressure circles for stroke `i`, or `undefined` when the stroke has
 * no usable pressure variation and should render as a plain constant-width path.
 *
 * Mirrors React's `renderInk`: prefer per-point `inkPointPressures`, then fall
 * back to a varying `inkWidths` array treated as per-point widths.
 */
function pressureCirclesForStroke(
	el: InkPptxElement,
	index: number,
	d: string,
	baseWidth: number,
): PressureCircle[] | undefined {
	const pointPressures = el.inkPointPressures?.[index];
	if (pointPressures && pointPressures.length > 1 && hasPressureVariation(pointPressures)) {
		const widths = pressuresToWidths(pointPressures, baseWidth);
		return generatePressureCircles(extractPathPoints(d), widths, baseWidth);
	}
	if (el.inkWidths && el.inkWidths.length > 1 && hasPressureVariation(el.inkWidths)) {
		return generatePressureCircles(extractPathPoints(d), el.inkWidths, baseWidth);
	}
	return undefined;
}

/**
 * Narrow `element` to `InkPptxElement` and return the resolved per-stroke
 * array, or an empty array when the element is not an ink element.
 */
export function buildInkStrokes(element: PptxElement): InkStroke[] {
	if (!isInkElement(element)) {
		return [];
	}
	const el: InkPptxElement = element;
	return (el.inkPaths ?? []).map((d, i) => {
		const width = el.inkWidths?.[i] ?? 1;
		return {
			d,
			color: el.inkColors?.[i] ?? DEFAULT_STROKE_COLOR,
			width,
			opacity: el.inkOpacities?.[i] ?? 1,
			circles: pressureCirclesForStroke(el, i, d, width),
		};
	});
}

/** Minimum SVG viewport dimension (clamp to ≥ 1 to avoid degenerate viewBox). */
export function inkViewBox(element: PptxElement): string {
	const w = Math.max(element.width, 1);
	const h = Math.max(element.height, 1);
	return `0 0 ${w} ${h}`;
}

/** Wrapper `[ngStyle]`-compatible style for the ink container `<div>`. */
export function buildInkContainerStyle(element: PptxElement, zIndex: number): StyleMap {
	return getContainerStyle(element, zIndex);
}
