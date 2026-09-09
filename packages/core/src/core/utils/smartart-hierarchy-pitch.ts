/**
 * SmartArt DiagramML interpreter - hierarchy axis pitch/margin.
 *
 * `smartart-layout-interpreter-hierarchy.ts`'s `cellW`/`cellH` used to be a
 * naive `box.dimension / count` split, which distributes any leftover space
 * as an EQUAL margin on both ends ("space-around"). Real PowerPoint does two
 * GENUINELY DIFFERENT things per axis (live-COM-verified round 11/SESSION 8
 * against `hierarchy--flat3.pptx`/`--hier5.pptx`/`--hier8.pptx`'s cached
 * `dsp:sp` geometry, corrected from an EARLIER derivation that was measured
 * against a since-fixed cached-reader bug and got the fan axis wrong - see
 * `smartart-layout-interpreter-hierarchy.ts`'s own module doc comment for the
 * full correction history):
 *
 *   - The GENERATION (stacking) axis is a genuine leading-margin/
 *     trailing-flush pack (`computeAxisPitch`, unchanged by the round-11
 *     correction): a margin on the LEADING edge only (top), and the tree's
 *     TRAILING edge (bottom generation) sits flush against the far box edge
 *     with zero trailing margin - solving `margin + n*itemSize + (n-1)*gap =
 *     boxDimension`. The margin is a fraction of the ITEM's OWN height, not
 *     the box's: `hierarchy--flat3.pptx` (2 generations, `boxH=203`) measures
 *     `margin=34px` (`34/203=0.1675`); `hierarchy--hier5.pptx` (3
 *     generations, a SMALLER height-clipped `boxH=131`) measures
 *     `margin=22px` (`22/131=0.168`) - the SAME ratio despite a different
 *     depth, confirming it scales with the item, not the container or depth.
 *   - The FAN (sibling) axis is CENTRED instead (`centeredAxisPitch`, NEW in
 *     round 11/SESSION 8): a FIXED gap ratio (the layout's own declared
 *     `sibSp`), with whatever slack remains split EVENLY on both sides -
 *     `hierarchy--flat3.pptx`/`--hier5.pptx` both show their own cached
 *     content span leaving REAL slack on this axis (the generation axis is
 *     what fills the frame), centred, never flush against one edge. An
 *     EARLIER derivation of this axis (superseded, kept only as history: a
 *     `FAN_MARGIN_RATIO=0.1115` leading-margin constant) was measured against
 *     a cached-reader bug that silently rescaled content to fill the frame,
 *     making the fan axis LOOK trailing-flush like the generation axis; once
 *     the reader was fixed, the fan axis's own real slack turned out to be
 *     centred, not flush - a structurally different model, not just a
 *     different number.
 *
 * `placeStandardTree`'s existing `cx=(offset+w/2)*cellW` /
 * `cy=level*cellH+cellH/2` formulas already implement "space-around" when
 * `cellW`/`cellH` is the full pitch (item + gap): the first item centres at
 * `cellW/2`, i.e. half a pitch in - which is a margin of `gap/2`, not either
 * axis's own real margin. Both `computeAxisPitch` and `centeredAxisPitch`
 * return that same `pitch` (unchanged use as `cellW`/`cellH`) plus a `shift`
 * - the constant offset that corrects the implicit `gap/2` leading margin
 * into the real one - which `translateResult` applies to the WHOLE computed
 * layout as a final pass, the same "compute plainly, then correct with a
 * pass" shape `smartart-hierarchy-orientation.ts`'s `transposeResult` uses.
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

export interface AxisPitch {
	/** Item size + inter-item gap - use directly as `cellW`/`cellH`. */
	pitch: number;
	/** Constant offset `translateResult` applies to correct the leading margin. */
	shift: number;
}

/**
 * A leading-margin/trailing-flush pack - see the module doc comment. Used
 * for the GENERATION axis always (`margin = GENERATION_MARGIN_RATIO *
 * itemSize`, `itemSize = boxH`, `count = depth`), and for `tailed`-mode
 * (org-chart family)'s own FAN axis with `margin=0` (not yet re-verified
 * against live COM this round - see `smartart-layout-interpreter-
 * hierarchy.ts`'s own call site comment). `dimension`: the axis's own box
 * size (already orientation-swapped by the caller when transposed).
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
	// own independently-calibrated margin with this function's own
	// LEADING-only margin) and the latent `n>1`-but-already-overflowing case
	// (`gap` floored to `0` because the un-gapped items alone already exceed
	// `dimension`), neither of which any built-in gallery
	// fixture exercises today.
	const maxShift = dimension - n * itemSize - gap * (n - 0.5);
	return { pitch, shift: Math.min(rawShift, maxShift) };
}

/**
 * The FAN axis's own real positioning (round 11/SESSION 8 correction):
 * unlike the generation axis (`computeAxisPitch`, a genuine leading-margin/
 * trailing-flush pack), the fan axis is CENTRED - a FIXED gap ratio (the
 * layout's own declared `sibSp`, not a margin solved to fill the box), with
 * whatever slack remains after packing at that ratio split EVENLY on both
 * sides. COM-verified against `hierarchy--hier5.pptx`/`--flat3.pptx`: their
 * own cached content span (`n*boxW + (n-1)*sibSp`) leaves REAL slack on the
 * fan axis (the generation axis is what fills the frame - see
 * `smartart-layout-interpreter-hierarchy.ts`'s module doc comment), and that
 * slack sits as an EQUAL margin on both ends, never flush against one edge
 * the way `computeAxisPitch`'s own "solve gap to fill exactly" model forces
 * it to be when handed a `margin=0` (which is what every non-tailed caller
 * was passing for the fan axis pre-correction - the bug this function
 * fixes: forcing an artificially STRETCHED gap to fill the box, instead of
 * using the item's own real, much smaller `sibSp` gap and centring the
 * genuine leftover slack).
 */
export function centeredAxisPitch(
	dimension: number,
	itemSize: number,
	gapRatio: number,
	count: number,
): AxisPitch {
	const n = Math.max(1, count);
	// No sibling to gap against for a single item (same convention
	// `computeAxisPitch`'s own `n===1` case uses) - a phantom gap here would
	// throw off `placeStandardTree`'s own `cx=(offset+0.5)*pitch` centring by
	// `gap/2`.
	const gap = n > 1 ? itemSize * Math.max(0, gapRatio) : 0;
	const pitch = itemSize + gap;
	const span = n * itemSize + Math.max(0, n - 1) * gap;
	const shift = (dimension - span) / 2;
	return { pitch, shift };
}

/**
 * The FAN axis's own pitch when the layout declares a `composite` wrapper
 * (round 11/SESSION 9: `smartart-hierarchy-composite-child.ts`) - the CELLS
 * being centred are the WRAPPING `composite`'s own (`compositeW =
 * boxW/compositeWidthFactor`, LARGER than the rendered `boxW`), not the
 * rendered item. `placeStandardTree`'s own `cx=(offset+0.5)*pitch+shift`
 * formula renders each item (width `boxW`) CENTRED on `cx`, which is only
 * correct when the rendered item sits centred within its own composite cell
 * too - it does not (it is offset by the layout's own "3D card"
 * `cardOffsetXRatio*compositeW`), so the plain `centeredAxisPitch` shift
 * needs a further correction (`+cardOffsetX+boxW/2-pitch/2`) to land the
 * RENDERED item's own centre exactly where the real, offset item sits -
 * solved by equating `cx(i) = compositeCellLeftEdge(i)+cardOffsetX+boxW/2`
 * for every `i` and matching coefficients. `compositeWidthFactor`
 * `undefined` (no wrapper declared, e.g. "Horizontal Hierarchy") falls back
 * to centring the rendered item directly (`compositeW=boxW`,
 * `cardOffsetXRatio` ignored) - the SAME correction term still applies then
 * (it accounts for `cx`'s own pitch-based, not itemSize-based, centring),
 * and empirically improves that family too (not just the composite-wrapper
 * one - see `smartart-track-r-successor.md`'s own SESSION 9).
 */
export function compositeFanPitch(
	dimension: number,
	boxW: number,
	compositeWidthFactor: number | undefined,
	cardOffsetXRatio: number,
	sibSpRatio: number,
	count: number,
): AxisPitch {
	const compositeW = compositeWidthFactor ? boxW / compositeWidthFactor : boxW;
	const cardOffsetX = cardOffsetXRatio * compositeW;
	const centred = centeredAxisPitch(dimension, compositeW, sibSpRatio, count);
	const correction = cardOffsetX + boxW / 2 - centred.pitch / 2;
	return { pitch: centred.pitch, shift: centred.shift + correction };
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
