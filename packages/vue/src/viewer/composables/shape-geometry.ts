/**
 * Shape geometry helpers — Vue port of the React package's
 * `viewer/utils/resolved-shape-clip-path.ts` cascade.
 *
 * All the heavy lifting (the ECMA-376 preset evaluator, the adjustment-aware
 * table, the cubic-Bezier cloud paths, and the static preset clip-path table)
 * already lives in `pptx-viewer-core` and is framework-agnostic, so — unlike
 * the React package, which keeps a local polygon fallback — the Vue binding
 * imports those entry points directly. No `pptx-viewer-shared` extraction is
 * required here.
 *
 * The resolution priority mirrors React exactly:
 *
 *   1. **Adjustment-aware** — when `shapeAdjustments` exist, consult
 *      {@link getAdjustmentAwareShapeClipPath} so `pie`, `arc`, `donut`,
 *      `blockArc`, and wedge callouts respond to their adjustment values.
 *   2. **Spec-correct preset evaluator** — {@link getShapeClipPathFromPreset}
 *      produces a `path('…')` clip-path for any shape in the preset table.
 *   3. **Cloud Bezier path** — {@link getCloudPathForRendering} for
 *      `cloud` / `cloudCallout`.
 *   4. **Static preset table** — {@link getShapeClipPath} as the final
 *      fallback (core's comprehensive `PRESET_SHAPE_CLIP_PATHS`).
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	getAdjustmentAwareShapeClipPath,
	getCloudPathForRendering,
	getShapeClipPath,
	getShapeClipPathFromPreset,
} from 'pptx-viewer-core';

/**
 * Resolve the best available CSS `clip-path` value for a shape type at a given
 * pixel size. Implements the priority cascade described in the module
 * docstring. Returns `undefined` when the shape needs no clipping.
 *
 * @param shapeType   The OOXML preset geometry name (case-insensitive).
 * @param width       Element width in pixels (must be > 0 for path output).
 * @param height      Element height in pixels (must be > 0 for path output).
 * @param adjustments Optional `shapeAdjustments` record from the element.
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
	// Without finite, positive dimensions the path/evaluator entry points can't
	// produce meaningful geometry; fall straight back to the static table.
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return getShapeClipPath(shapeType);
	}

	// 1. Adjustment-aware path — only when adjustments are actually supplied.
	if (adjustments && Object.keys(adjustments).length > 0) {
		const adjusted = getAdjustmentAwareShapeClipPath(shapeType, width, height, adjustments);
		if (adjusted !== undefined) {
			return adjusted;
		}
	}

	// 2. Spec-correct ECMA-376 preset evaluator.
	const fromPreset = getShapeClipPathFromPreset(shapeType, width, height, adjustments);
	if (fromPreset !== undefined) {
		return fromPreset;
	}

	// 3. Cubic-Bezier cloud / cloudCallout path (DPI-stable lobes).
	const cloud = getCloudPathForRendering(shapeType, width, height);
	if (cloud !== undefined) {
		return cloud;
	}

	// 4. Final fallback: core's static preset clip-path table.
	return getShapeClipPath(shapeType);
}

/**
 * Element-level convenience wrapper. Pulls `shapeType`, `width`, `height`, and
 * `shapeAdjustments` off a {@link PptxElement} and delegates to
 * {@link getResolvedShapeClipPathFor}.
 *
 * @param element The PPTX element to resolve a clip-path for.
 * @param width   Optional width override (pixels). Defaults to `element.width`.
 * @param height  Optional height override (pixels). Defaults to `element.height`.
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
