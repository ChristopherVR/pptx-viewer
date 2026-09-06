import type { PptxElement } from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';

import {
	buildInkGroupStrokes,
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	interpolateWidth,
	pressuresToWidths,
} from '../internal/shared';
import type { InkGroupStrokeView, PathPoint, PressureCircle } from '../internal/shared';
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
 * The pressure/tilt-stroke maths itself lives in `pptx-viewer-shared`
 * (`render/ink-group-strokes`, the same decision function
 * `ContentPartRendererComponent` uses for a loaded `p:contentPart`), so every
 * binding samples a path and sizes its circles/nib marks the same way; what
 * remains here is the Angular view-model: the container style.
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

/** Resolved per-stroke data used to render a single `<path>`, circle set, or nib-mark set. */
export type InkStroke = InkGroupStrokeView;

/**
 * Narrow `element` to `InkPptxElement` and return the resolved per-stroke
 * array, or an empty array when the element is not an ink element.
 */
export function buildInkStrokes(element: PptxElement): InkStroke[] {
	if (!isInkElement(element)) {
		return [];
	}
	return buildInkGroupStrokes(element, { color: DEFAULT_STROKE_COLOR, width: 1 });
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
