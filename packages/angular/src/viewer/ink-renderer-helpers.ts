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
 */

/** Resolved per-stroke data used to render a single `<path>`. */
export interface InkStroke {
	d: string;
	color: string;
	width: number;
	opacity: number;
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
	return (el.inkPaths ?? []).map((d, i) => ({
		d,
		color: el.inkColors?.[i] ?? DEFAULT_STROKE_COLOR,
		width: el.inkWidths?.[i] ?? 1,
		opacity: el.inkOpacities?.[i] ?? 1,
	}));
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
