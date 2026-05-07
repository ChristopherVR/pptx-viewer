/**
 * Resolved shape clip-path helper.
 *
 * Wires the new core geometry APIs into the React viewer's shape clipping
 * pipeline. Implements a priority cascade so renderers always pick the
 * highest-fidelity geometry available for a given element:
 *
 *   1. **Adjustment-aware** — if `shapeAdjustments` exist, consult
 *      {@link getAdjustmentAwareShapeClipPath} so shapes like `pie`, `arc`,
 *      `donut`, `blockArc`, and the wedge callouts respond to their
 *      adjustment values.
 *   2. **Spec-correct preset evaluator** — {@link getShapeClipPathFromPreset}
 *      uses the ECMA-376 `pathLst` evaluator to produce a `path('…')`
 *      clip-path for any shape covered by the preset table (~30 today).
 *   3. **Cloud Bezier path** — {@link getCloudPathForRendering} produces a
 *      DPI-stable cubic-Bezier `path('…')` for `cloud` / `cloudCallout`.
 *   4. **Static polygon table** — {@link getShapeClipPath} (the legacy
 *      polygon table local to the React package) is the final fallback for
 *      shapes none of the higher-fidelity APIs cover.
 *
 * Callers without dimensions should keep using {@link getShapeClipPath}
 * directly; the cascade requires width and height to evaluate paths.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	getAdjustmentAwareShapeClipPath,
	getCloudPathForRendering,
	getShapeClipPathFromPreset,
} from 'pptx-viewer-core';

import { getShapeClipPath } from './shape-types';

/**
 * Resolve the best available CSS `clip-path` value for a shape type at a
 * given pixel size. Implements the priority cascade described in the module
 * docstring.
 *
 * @param shapeType   The OOXML preset geometry name (case-insensitive).
 * @param width       Element width in pixels (must be > 0 for path output).
 * @param height      Element height in pixels (must be > 0 for path output).
 * @param adjustments Optional `shapeAdjustments` record from the element.
 * @returns A CSS `clip-path` value (`polygon(...)`, `path('…')`, or `inset(...)`),
 *          or `undefined` if no clipping is needed.
 */
export function getResolvedShapeClipPathFor(
	shapeType: string | undefined,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): string | undefined {
	if (!shapeType) {
		return undefined;
	}
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return getShapeClipPath(shapeType, adjustments, width, height);
	}

	// 1. Adjustment-aware path: only consult when adjustments are actually
	// supplied. Without adjustments this would fall through to the static
	// preset table inside core, which we already cover at step 4.
	if (adjustments && Object.keys(adjustments).length > 0) {
		const adjusted = getAdjustmentAwareShapeClipPath(shapeType, width, height, adjustments);
		if (adjusted !== undefined) {
			return adjusted;
		}
	}

	// 2. Spec-correct ECMA-376 preset evaluator (covers ~30 shapes today).
	const fromPreset = getShapeClipPathFromPreset(shapeType, width, height, adjustments);
	if (fromPreset !== undefined) {
		return fromPreset;
	}

	// 3. Cubic-Bezier cloud / cloudCallout path (DPI-stable lobes).
	const cloud = getCloudPathForRendering(shapeType, width, height);
	if (cloud !== undefined) {
		return cloud;
	}

	// 4. Final fallback: legacy static polygon / inset table local to the
	// React package.
	return getShapeClipPath(shapeType, adjustments, width, height);
}

/**
 * Element-level convenience wrapper. Pulls `shapeType`, `width`, `height`,
 * and `shapeAdjustments` off a {@link PptxElement} and delegates to
 * {@link getResolvedShapeClipPathFor}.
 *
 * @param element The PPTX element to resolve a clip-path for.
 * @param width   Optional width override (pixels). Defaults to `element.width`.
 * @param height  Optional height override (pixels). Defaults to `element.height`.
 * @returns A CSS `clip-path` value, or `undefined`.
 */
export function getResolvedShapeClipPath(
	element: PptxElement,
	width?: number,
	height?: number,
): string | undefined {
	const shapeType = (element as { shapeType?: string }).shapeType;
	if (!shapeType) {
		return undefined;
	}
	const w = typeof width === 'number' ? width : element.width;
	const h = typeof height === 'number' ? height : element.height;
	const adjustments = (element as { shapeAdjustments?: Record<string, number> }).shapeAdjustments;
	return getResolvedShapeClipPathFor(shapeType, w, h, adjustments);
}
