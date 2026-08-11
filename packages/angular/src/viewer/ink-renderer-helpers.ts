import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';

import {
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	interpolateWidth,
	pressuresToWidths,
} from '../internal/shared';
import type { PathPoint, PressureCircle, PressureConfig } from '../internal/shared';
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
 * The pressure-stroke maths itself lives in `pptx-viewer-shared`
 * (`render/ink-rendering`), so every binding samples a path and sizes its
 * circles the same way; what remains here is the Angular view-model: resolving
 * per-stroke colour / width / opacity and the container style.
 */

// Re-exported for the existing Angular import sites (and its tests).
export type { PathPoint, PressureCircle };
export {
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	interpolateWidth,
	pressuresToWidths,
};

/**
 * Pressure-circle sizing for an ink stroke of `baseWidth`.
 *
 * Every binding uses the same envelope (0.5px minimum, 1.5x the stroke width at
 * full pressure); spelling it once here keeps Angular from drifting off it.
 */
function pressureConfig(baseWidth: number): PressureConfig {
	return { baseWidth, minRadius: 0.5, maxRadius: baseWidth * 1.5 };
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
		return generatePressureCircles(extractPathPoints(d), widths, pressureConfig(baseWidth));
	}
	if (el.inkWidths && el.inkWidths.length > 1 && hasPressureVariation(el.inkWidths)) {
		return generatePressureCircles(extractPathPoints(d), el.inkWidths, pressureConfig(baseWidth));
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
