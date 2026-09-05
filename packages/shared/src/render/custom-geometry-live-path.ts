/**
 * `custom-geometry-live-path`: resolve an `a:custGeom` freeform's outline
 * against its CURRENT `shapeAdjustments`, instead of the numbers frozen at
 * parse time (limitations.md: "`a:custGeom` adjustment-handle drag: Commits
 * on release, not live").
 *
 * Wave 1 made an `a:ahXY`/`a:ahPolar` handle draggable
 * (`shape-adjustment-custom-geometry.ts`) and made the drag write back into
 * the referenced `a:gdLst` guide ON SAVE (core's
 * `applyCustomGeometryGuideOverrides`), mirroring how a PRESET's `adj`
 * already round-trips. Neither step touched the shape's PAINTED body: every
 * binding reads `element.pathData` (a static SVG string,
 * `getResolvedShapeClipPath` in `./shape-geometry`) which is computed once at
 * parse time from the `a:avLst` DEFAULTS and never re-evaluated, so the body
 * only reshapes once the drag commits, the file is saved, and it is
 * reloaded. A preset shape has no such lag: `getAdjustmentAwareClipPath`/
 * `getShapeClipPathFromPreset` recompute the clip-path from
 * `shapeAdjustments` on every call, so a preset's body tracks the drag frame
 * by frame.
 *
 * This module is the single source of truth the fix picks: RENDER always
 * derives the outline from `customGeometryRawData` + current
 * `shapeAdjustments` when both are present, falling back to the static
 * `pathData`/`pathWidth`/`pathHeight` only when there is no raw data to
 * re-evaluate (an older parse, or an SDK-built shape). Nothing needs to
 * "bake back" a committed drag into `customGeometryPaths`: the live and
 * post-commit paint are the exact same call, so there is no separate
 * "commit" step to keep in sync, and a stale `customGeometryPaths` can never
 * disagree with what is on screen while raw data is available.
 *
 * @module render/custom-geometry-live-path
 */
import type { CustomGeometryRawData, PptxElement } from 'pptx-viewer-core';
import { evaluateCustomGeometryPathData } from 'pptx-viewer-core';

/** The custom-geometry slots this module reads off an element. */
interface CustomGeometryLiveFields {
	pathData?: string;
	pathWidth?: number;
	pathHeight?: number;
	customGeometryRawData?: CustomGeometryRawData;
	shapeAdjustments?: Record<string, number>;
}

/** A resolved outline: an SVG path string plus its coordinate-space extent. */
export interface LiveCustomGeometryPath {
	pathData: string;
	pathWidth: number;
	pathHeight: number;
}

/**
 * Resolve `element`'s custom-geometry outline, re-evaluating it against
 * `element.shapeAdjustments` when `customGeometryRawData` is available so an
 * in-progress adjustment-handle drag reshapes the body live.
 *
 * Returns `undefined` for an element with no custom geometry at all
 * (`pathData`/`pathWidth`/`pathHeight` absent), so callers can tell "no
 * custom geometry" apart from "custom geometry, nothing to override".
 */
export function resolveLiveCustomGeometryPath(
	element: PptxElement,
): LiveCustomGeometryPath | undefined {
	const el = element as PptxElement & CustomGeometryLiveFields;
	if (!el.pathData || !el.pathWidth || !el.pathHeight) {
		return undefined;
	}
	const overrides = el.shapeAdjustments;
	if (overrides && Object.keys(overrides).length > 0 && el.customGeometryRawData) {
		const live = evaluateCustomGeometryPathData(
			el.customGeometryRawData,
			el.pathWidth,
			el.pathHeight,
			overrides,
		);
		if (live) {
			return live;
		}
	}
	return { pathData: el.pathData, pathWidth: el.pathWidth, pathHeight: el.pathHeight };
}
