/**
 * Rotation/flip write helpers for one row of the chart overlay-shape tree
 * (`c:userShapes`), split out of `chart-user-shape-tree.ts` to keep that
 * module under this repo's file-size limit.
 *
 * Both a row's rotation and its flip flags live at `transform.rotation` /
 * `transform.flipH` / `transform.flipV` on a `grpSp` row (they rotate/flip the
 * whole group as a rigid body, see `chart-user-shapes-parser.ts`'s
 * `flattenChartUserShapes` doc for how that composes onto every contained
 * leaf), rather than as a flat field on the row's own node, so each needs its
 * own small merge instead of `withChartUserShapeRowUpdated`'s generic
 * `{...node, ...patch}` spread.
 *
 * @module render/chart-user-shape-row-transform
 */
import type { PptxChartUserShape } from 'pptx-viewer-core';

import { withNodeAtPath } from './chart-user-shape-tree';

/**
 * Patch one row's OWN rotation (degrees). `undefined` (or `0`) clears it.
 */
export function withChartUserShapeRowRotationUpdated(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
	rotation: number | undefined,
): PptxChartUserShape[] {
	return withNodeAtPath(userShapes ?? [], path, (node) => {
		if (node.kind === 'grpSp') {
			if (!node.transform) {
				return node;
			}
			const transform = { ...node.transform };
			if (rotation) {
				transform.rotation = rotation;
			} else {
				delete transform.rotation;
			}
			return { ...node, transform };
		}
		const next = { ...node };
		if (rotation) {
			next.rotation = rotation;
		} else {
			delete next.rotation;
		}
		return next;
	});
}

/**
 * Patch one row's OWN flip flags. Only the keys present in `flip` are
 * changed; the other axis is left as-is, so a caller toggling one checkbox
 * never has to know the other's current value. `false` clears the flag
 * (mirroring how the parser only ever sets `true`, never `false`, on these
 * fields).
 */
export function withChartUserShapeRowFlipUpdated(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	path: readonly number[],
	flip: { flipH?: boolean; flipV?: boolean },
): PptxChartUserShape[] {
	return withNodeAtPath(userShapes ?? [], path, (node) => {
		const applyFlip = <T extends { flipH?: boolean; flipV?: boolean }>(target: T): T => {
			const next = { ...target };
			if (flip.flipH !== undefined) {
				if (flip.flipH) {
					next.flipH = true;
				} else {
					delete next.flipH;
				}
			}
			if (flip.flipV !== undefined) {
				if (flip.flipV) {
					next.flipV = true;
				} else {
					delete next.flipV;
				}
			}
			return next;
		};
		if (node.kind === 'grpSp') {
			if (!node.transform) {
				return node;
			}
			return { ...node, transform: applyFlip(node.transform) };
		}
		return applyFlip(node);
	});
}
