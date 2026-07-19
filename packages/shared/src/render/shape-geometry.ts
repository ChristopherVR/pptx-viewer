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
 * Build a CSS `clip-path: path('…')` value from a custom-geometry (`a:custGeom`)
 * SVG path string, rescaling its path-space coordinates (`pathWidth` x
 * `pathHeight`) into the element's pixel box.
 *
 * CSS `path()` coordinates live in the element's own border-box pixel space
 * (there is no viewBox), so freeform coordinates authored against the OOXML path
 * extent must be scaled by `elemW / pathWidth` and `elemH / pathHeight`. Every
 * binding already clips its shape container's background fill with the resolved
 * clip-path, so returning one here lets a themed freeform (e.g. the "Balloons"
 * background) render as its true outline instead of flooding its bounding box.
 *
 * Supports the absolute command set produced by the core geometry engine
 * (M/L/C/Q/Z) plus elliptical arcs (A); unknown commands are passed through
 * unscaled rather than dropped.
 */
export function buildCustomGeometryClipPath(
	pathData: string,
	pathWidth: number,
	pathHeight: number,
	elemWidth: number,
	elemHeight: number,
): string | undefined {
	if (
		!pathData ||
		!Number.isFinite(pathWidth) ||
		!Number.isFinite(pathHeight) ||
		pathWidth <= 0 ||
		pathHeight <= 0 ||
		!Number.isFinite(elemWidth) ||
		!Number.isFinite(elemHeight) ||
		elemWidth <= 0 ||
		elemHeight <= 0
	) {
		return undefined;
	}
	const sx = elemWidth / pathWidth;
	const sy = elemHeight / pathHeight;
	const round = (n: number): string => {
		const r = Math.round(n * 100) / 100;
		return Object.is(r, -0) ? '0' : String(r);
	};
	const tokens = pathData.match(/[MLCQZAHVmlcqzahv][^MLCQZAHVmlcqzahv]*/g) ?? [];
	const out: string[] = [];
	for (const token of tokens) {
		const cmd = token[0];
		const upper = cmd.toUpperCase();
		if (upper === 'Z') {
			out.push('Z');
			continue;
		}
		const nums = (token.slice(1).match(/-?[\d.]+(?:e-?\d+)?/gi) ?? []).map(Number);
		if (upper === 'A') {
			// rx ry x-axis-rotation large-arc-flag sweep-flag x y (per 7-number group)
			const parts: string[] = [];
			for (let i = 0; i + 6 < nums.length; i += 7) {
				parts.push(
					round(nums[i] * sx),
					round(nums[i + 1] * sy),
					String(nums[i + 2]),
					String(nums[i + 3]),
					String(nums[i + 4]),
					round(nums[i + 5] * sx),
					round(nums[i + 6] * sy),
				);
			}
			out.push(`A ${parts.join(' ')}`);
			continue;
		}
		// M/L/C/Q (and H/V) carry (x, y) pairs; scale x by sx and y by sy.
		const scaled = nums.map((n, i) => round(n * (i % 2 === 0 ? sx : sy)));
		out.push(`${upper} ${scaled.join(' ')}`);
	}
	if (out.length === 0) {
		return undefined;
	}
	return `path('${out.join(' ')}')`;
}

/**
 * Element-level convenience wrapper. Pulls `shapeType`, `width`, `height`, and
 * `shapeAdjustments` off a {@link PptxElement} and delegates to
 * {@link getResolvedShapeClipPathFor}.
 *
 * Custom-geometry freeforms (which carry `pathData`/`pathWidth`/`pathHeight`
 * rather than a preset `shapeType`) take priority: their outline is rescaled
 * into the element box via {@link buildCustomGeometryClipPath} so the fill clips
 * to the real shape instead of its bounding rectangle.
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
	const w = typeof width === 'number' ? width : element.width;
	const h = typeof height === 'number' ? height : element.height;
	const custom = element as {
		pathData?: string;
		pathWidth?: number;
		pathHeight?: number;
	};
	if (custom.pathData && custom.pathWidth && custom.pathHeight) {
		const customClip = buildCustomGeometryClipPath(
			custom.pathData,
			custom.pathWidth,
			custom.pathHeight,
			w,
			h,
		);
		if (customClip) {
			return customClip;
		}
	}
	const shapeType = (element as { shapeType?: string }).shapeType;
	if (!shapeType) {
		return undefined;
	}
	const adjustments = (element as { shapeAdjustments?: Record<string, number> }).shapeAdjustments;
	return getResolvedShapeClipPathFor(shapeType, w, h, adjustments);
}
