/**
 * SmartArt DiagramML interpreter - hierarchy axis pitch/margin.
 *
 * `smartart-layout-interpreter-hierarchy.ts`'s `cellW`/`cellH` used to be a
 * naive `box.dimension / count` split, which distributes any leftover space
 * as an EQUAL margin on both ends ("space-around"). COM-verified against
 * `hierarchy--flat3.pptx` AND `hierarchy--hier5.pptx`'s cached `dsp:sp`
 * geometry, real PowerPoint does something different on both axes: a margin
 * on the LEADING edge only (top for the generation axis, left for the fan
 * axis), and the tree's TRAILING edge (bottom generation, rightmost sibling)
 * sits flush against the far box edge with zero trailing margin - solving
 * `margin + n*itemSize + (n-1)*gap = boxDimension` for the known quantities.
 * The generation-axis margin is a fraction of the ITEM's OWN height, not the
 * box's: `hierarchy--flat3.pptx` (2 generations, `boxH=203`) measures
 * `margin=34px` (`34/203=0.1675`); `hierarchy--hier5.pptx` (3 generations,
 * a SMALLER height-clipped `boxH=131`) measures `margin=22px`
 * (`22/131=0.168`) - the SAME ratio despite a different depth and a
 * different (height-bound rather than width-bound) `fitItemBox` outcome,
 * confirming it scales with the item, not the container or the tree depth.
 *
 * `placeStandardTree`'s existing `cx=(offset+w/2)*cellW` /
 * `cy=level*cellH+cellH/2` formulas already implement "space-around" when
 * `cellW`/`cellH` is the full pitch (item + gap): the first item centres at
 * `cellW/2`, i.e. half a pitch in - which is a margin of `gap/2`, not the
 * measured asymmetric `margin`. `computeAxisPitch` returns that `pitch`
 * (unchanged use as `cellW`/`cellH`) plus a `shift` - the constant offset
 * that turns the implicit `gap/2` leading margin into the real, measured
 * one - which `translateResult` applies to the WHOLE computed layout as a
 * final pass, the same "compute plainly, then correct with a pass" shape
 * `smartart-hierarchy-orientation.ts`'s `transposeResult` already uses.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type {
	RenderedConnector,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

/** COM-verified leading-margin ratio for the generation (stacking) axis, as a fraction of the item's OWN size on that axis - see the module doc comment. */
export const GENERATION_MARGIN_RATIO = 0.1675;
/**
 * Leading-margin ratio for the fan (sibling) axis, ALSO as a fraction of the
 * item's OWN size (`boxW`), not the box: `hierarchy--flat3.pptx`/`--hier5.pptx`
 * (2-wide fan, `boxW=372`) measure `margin=41.5px` (`41.5/372=0.1115`);
 * `hierarchy--hier8.pptx` (5-wide fan, a much smaller `boxW=144`) measures
 * `margin=16px` (`16/144=0.111`) - the same ratio despite a 5x-narrower item,
 * ruling out the box-relative ratio this used to be fit against (which only
 * coincidentally matched for a 2-wide fan, since every `flat3`/`hier5`
 * fixture in the corpus happens to share `boxW`).
 */
export const FAN_MARGIN_RATIO = 0.1115;

export interface AxisPitch {
	/** Item size + inter-item gap - use directly as `cellW`/`cellH`. */
	pitch: number;
	/** Constant offset `translateResult` applies to correct the leading margin. */
	shift: number;
}

/**
 * `dimension`: the axis's own box size (already orientation-swapped by the
 * caller when transposed). `margin`: the leading-edge margin, in pixels
 * (`GENERATION_MARGIN_RATIO * itemSize` for the generation axis,
 * `FAN_MARGIN_RATIO * dimension` for the fan axis - see the exported ratio
 * constants' doc comments). `itemSize`: `boxW`/`boxH` from `fitItemBox`.
 * `count`: `totalLeaves` (fan axis) or `depth` (generation axis).
 */
export function computeAxisPitch(
	dimension: number,
	margin: number,
	itemSize: number,
	count: number,
): AxisPitch {
	const n = Math.max(1, count);
	const gap = n > 1 ? Math.max(0, (dimension - margin - n * itemSize) / (n - 1)) : 0;
	const pitch = itemSize + gap;
	const rawShift = margin - gap / 2;
	// The tree's own trailing edge (last item's right/bottom edge, after the
	// leading `margin` and inter-item `gap`s) must never sit past the box's
	// own far edge - COM-verified: it sits flush against it, never past it
	// (see the module doc comment). `rightEdge(shift) = shift + n*itemSize +
	// gap*(n-0.5)` (derived from `placeStandardTree`'s own `cx=(offset+0.5)*
	// pitch` placement); solving `rightEdge<=dimension` for `shift` gives the
	// bound below. For `n>1` with an unfloored `gap`, `rawShift` already
	// satisfies this EXACTLY by `gap`'s own defining equation - the clamp is
	// then a byte-identical no-op (verified against every currently-passing
	// multi-column `hierarchy`/`organization-chart` fixture). It only
	// actually engages for the `count===1` degenerate case (`gap` is
	// hard-coded `0`, so there is no gap term left to reconcile `fitItemBox`'s
	// own independently-calibrated SYMMETRIC margin with this function's own
	// LEADING-only margin - see `FAN_MARGIN_RATIO`'s doc comment for the two
	// ratios' independent COM derivations) and the latent `n>1`-but-already-
	// overflowing case (`gap` floored to `0` because the un-gapped items alone
	// already exceed `dimension`), neither of which any built-in gallery
	// fixture exercises today.
	const maxShift = dimension - n * itemSize - gap * (n - 0.5);
	return { pitch, shift: Math.min(rawShift, maxShift) };
}

/** Translate one rendered node by a constant `(dx, dy)`. */
function translateNode(node: RenderedNode, dx: number, dy: number): RenderedNode {
	switch (node.kind) {
		case 'rect':
			return {
				...node,
				x: node.x + dx,
				y: node.y + dy,
				textX: node.textX + dx,
				textY: node.textY + dy,
			};
		case 'circle':
			return {
				...node,
				cx: node.cx + dx,
				cy: node.cy + dy,
				textX: node.textX !== undefined ? node.textX + dx : undefined,
				textY: node.textY !== undefined ? node.textY + dy : undefined,
			};
		case 'polygon':
			return {
				...node,
				points: translatePointsString(node.points, dx, dy),
				textX: node.textX + dx,
				textY: node.textY + dy,
			};
	}
}

function translatePointsString(points: string, dx: number, dy: number): string {
	return points
		.trim()
		.split(/\s+/u)
		.filter((pair) => pair.length > 0)
		.map((pair) => {
			const [x, y] = pair.split(',').map(Number);
			return `${x + dx},${y + dy}`;
		})
		.join(' ');
}

/** Translate every coordinate pair of an SVG path `d` string built only from `M`/`L` commands (every hierarchy connector) by a constant `(dx, dy)`. */
function translatePathData(d: string, dx: number, dy: number): string {
	return d.replace(
		/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/gu,
		(_match, x: string, y: string) => `${Number(x) + dx},${Number(y) + dy}`,
	);
}

/**
 * Shift a whole `SmartArtLayoutResult` by a constant `(dx, dy)` - see the
 * module doc comment for why `computeAxisPitch`'s `shift` needs this instead
 * of threading an offset through `placeStandardTree`/`placeAt` directly.
 */
export function translateResult(
	result: SmartArtLayoutResult,
	dx: number,
	dy: number,
): SmartArtLayoutResult {
	if (dx === 0 && dy === 0) {
		return result;
	}
	const nodes = result.nodes.map((node) => translateNode(node, dx, dy));
	const connectors: RenderedConnector[] = result.connectors.map((connector) => ({
		...connector,
		d: translatePathData(connector.d, dx, dy),
	}));
	return { ...result, nodes, connectors };
}
