/**
 * SmartArt DiagramML interpreter - `pyraAcctRatio` pyramid band-splitting
 * geometry.
 *
 * Split out of `smartart-layout-interpreter-pyramid.ts` (the file-size
 * budget) - see that module's own doc comment for the full COM-verified
 * derivation this implements: `basic-pyramid`/`inverted-pyramid` declare
 * `pyraAcctRatio`, shrinking every row's own "level" (self-role) band to
 * `(1 - pyraAcctRatio)` of its natural width (anchored at the diagram box's
 * own left edge), with the "accent" (child) role, when present, filling the
 * remainder of that row's natural slot out to the box's own right edge.
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX, roleOf } from './smartart-constraint-solver';
import { algorithmParam } from './smartart-layout-interpreter-model';
import { DEFAULT_GAP_RATIO, DEFAULT_INSET } from './smartart-layout-interpreter-pyramid';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/**
 * `dgm:constr type="pyraAcctRatio"` - always `dgm:choose`-wrapped (gated on
 * `func="maxDepth" op="gte" val="2"`, see the module doc comment), so it
 * lands in `allConstraints`, not the plain `constraints` `arrangePyramid`
 * itself reads for `sibSp`/`sp`. `0` (no shrink at all) when absent, matching
 * `basic-pyramid--flat3.pptx`'s own all-leaf dataset (the `else` branch
 * declares `<dgm:constr type="pyraAcctRatio"/>` with no `val` at all).
 */
function resolvePyraAcctRatio(planNode: PptxSmartArtLayoutNode, index: ConstraintIndex): number {
	const constraints = planNode.allConstraints ?? planNode.constraints;
	return resolveRatioConstraint(constraints, index, roleOf(planNode), ['pyraAcctRatio'], 0);
}

/** One row's natural (pre-`pyraAcctRatio`) trapezoid corners, box-LOCAL coordinates. */
interface PyramidRowGeometry {
	yTop: number;
	yBot: number;
	leftTop: number;
	rightTop: number;
	leftBot: number;
	rightBot: number;
}

/**
 * Recompute row `i`'s own natural corners exactly as `arrangePyramid` itself
 * does (same `bandH`/`gap`/`fTop`/`fBot`/`inverted` formulas) - kept in
 * lock-step so `repositionPyramidBands` never drifts from the geometry
 * `arrangePyramid` actually rendered.
 */
function pyramidRowGeometry(
	i: number,
	n: number,
	box: BoundingBox,
	gapRatio: number,
	inverted: boolean,
): PyramidRowGeometry {
	const bandW = box.width - DEFAULT_INSET * 2;
	const bandCx = DEFAULT_INSET + bandW / 2;
	const usableH = box.height - DEFAULT_INSET * 2;
	const bandH = n > 0 ? usableH / (n + Math.max(0, n - 1) * gapRatio) : usableH;
	const gap = gapRatio * bandH;
	const slotTop = DEFAULT_INSET + i * (bandH + gap);
	const slotBot = slotTop + bandH;
	const effectiveI = inverted ? n - 1 - i : i;
	const fTop = effectiveI / n;
	const fBot = (effectiveI + 1) / n;
	const halfTop = (bandW * fTop) / 2;
	const halfBot = (bandW * fBot) / 2;
	return {
		yTop: slotTop,
		yBot: slotBot,
		leftTop: bandCx - halfTop,
		rightTop: bandCx + halfTop,
		leftBot: bandCx - halfBot,
		rightBot: bandCx + halfBot,
	};
}

/**
 * Apply the `pyraAcctRatio` band split (see the module doc comment for the
 * full COM-verified derivation) as a post-pass over an already-arranged and
 * already-item-role-expanded pyramid result. `topLevelIds` is `arrangePyramid`'s
 * own `nodes` argument, in the SAME row order (index = row `i`) - every
 * "level"/self-role entry's `nodeId` is one of these; every "accent"/
 * descendant-role entry's `nodeId` is a CHILD of one of these (resolved via
 * `flatNodes`' own `parentId`).
 *
 * `hasAccentSomewhere` (the REAL `func="maxDepth" op="gte" val="2"` condition,
 * computed by the caller directly from the data tree - "does any top-level
 * point have a child at all") gates this independently of `pyraAcctRatio`'s
 * own resolved VALUE: `pyraAcctRatio`'s `dgm:constr` is `dgm:choose`-wrapped,
 * and the constraint index flattens BOTH branches (the `val="0.32"` `dgm:if`
 * AND the value-less `dgm:else`) without evaluating the condition (see
 * `smartart-constraint-solver.ts`'s own doc comment on this limitation) - a
 * literal scan finds the `0.32` branch's value regardless of which branch
 * actually applies, wrongly shrinking `basic-pyramid--flat3.pptx`'s own
 * all-leaf dataset (COM-verified regression: 0.12% -> 31.95% before this
 * check was added). A no-op (`result` returned unchanged) when EITHER
 * `pyraAcctRatio` resolves to `0` or `hasAccentSomewhere` is `false`.
 */
export function repositionPyramidBands(
	result: SmartArtLayoutResult,
	box: BoundingBox,
	planNode: PptxSmartArtLayoutNode,
	topLevelIds: readonly string[],
	flatNodes: readonly PptxSmartArtNode[],
	hasAccentSomewhere: boolean,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
): SmartArtLayoutResult {
	const pyraAcctRatio = resolvePyraAcctRatio(planNode, index);
	if (pyraAcctRatio <= 0 || !hasAccentSomewhere) {
		return result;
	}
	const scale = 1 - pyraAcctRatio;
	const n = topLevelIds.length;
	const rowIndexById = new Map(topLevelIds.map((id, i) => [id, i]));
	const parentIdById = new Map(flatNodes.map((node) => [node.id, node.parentId]));
	const gapRatio = resolveRatioConstraint(
		planNode.constraints,
		index,
		roleOf(planNode),
		['sibSp', 'sp'],
		DEFAULT_GAP_RATIO,
	);
	// See `arrangePyramid`'s own `inverted` doc comment - must match exactly,
	// or this pass repositions a row using the WRONG (mirrored) natural
	// corners.
	const inverted = algorithmParam(planNode, 'linDir') === 'fromT';
	const nodes = result.nodes.map((rendered): RenderedNode => {
		if (rendered.kind !== 'polygon' || !rendered.nodeId) {
			return rendered;
		}
		let rowIndex = rowIndexById.get(rendered.nodeId);
		const isAccent = rowIndex === undefined;
		if (isAccent) {
			const parentId = parentIdById.get(rendered.nodeId);
			rowIndex = parentId ? rowIndexById.get(parentId) : undefined;
		}
		if (rowIndex === undefined) {
			// Not resolvable to a row (an unexpected shape this pass doesn't
			// recognise) - leave it exactly as `arrangePyramid` rendered it.
			return rendered;
		}
		const row = pyramidRowGeometry(rowIndex, n, box, gapRatio, inverted);
		const scaledLeftTop = scale * row.leftTop;
		const scaledRightTop = scale * row.rightTop;
		const scaledLeftBot = scale * row.leftBot;
		const scaledRightBot = scale * row.rightBot;
		const points = isAccent
			? [
					`${scaledRightTop},${row.yTop}`,
					`${box.width - DEFAULT_INSET},${row.yTop}`,
					`${box.width - DEFAULT_INSET},${row.yBot}`,
					`${scaledRightBot},${row.yBot}`,
				].join(' ')
			: [
					`${scaledLeftTop},${row.yTop}`,
					`${scaledRightTop},${row.yTop}`,
					`${scaledRightBot},${row.yBot}`,
					`${scaledLeftBot},${row.yBot}`,
				].join(' ');
		return { ...rendered, points };
	});
	return { ...result, nodes };
}
