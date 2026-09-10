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
 *   - The GENERATION (stacking) axis is CENTRED (`computeAxisPitch`, SESSION
 *     16 correction), with a small constant top bias: slack (`dimension -
 *     n*itemSize - (n-1)*gap`) splits evenly between the leading and trailing
 *     edge, and `margin` (a fraction of the ITEM's OWN height, NOT the box's -
 *     see `GENERATION_MARGIN_RATIO`'s own doc comment) shifts HALF of itself
 *     from the trailing edge to the leading edge on top of that centring, not
 *     an absolute leading-only margin against a trailing-flush pack (the
 *     PRE-SESSION-16 model - see `computeAxisPitch`'s own doc comment for why
 *     that was only ever a coincidental match for a 2-3 generation tree that
 *     happens to nearly fill `dimension`, and the 4-sample COM measurement
 *     that overturned it for anything taller).
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
 *
 * `fixedGapRatio` (optional, every existing caller that omits it is
 * byte-identical - see this function's own regression tests): when given,
 * the gap is `itemSize * fixedGapRatio` directly instead of SOLVED to fill
 * `dimension` exactly. The solved gap is only a correct model for a tree
 * that genuinely spans every generation with a real fan at each one - for
 * `hierarchy--hier8.pptx` (a `sibSp`/`sp`-declaring composite-wrapped
 * layout whose deepest generation is a lone descendant past the main fan,
 * not itself fanned), the solved gap (forcing the row stack to fill the
 * whole box) measures 49.86px against the fixture's own real, independently
 * measured (raw `dsp:sp` offsets) 41.98px - `hierarchy--flat3.pptx`/
 * `--hier5.pptx` (2/3 generations, no such lone tail) show the SOLVED gap
 * coincidentally equals `itemSize * 0.4580` almost exactly, which is why
 * this bug was invisible until a 4-generation, unevenly-fanned sample
 * existed to distinguish the two models - see
 * `resolveGenerationGapRatio`'s own doc comment in `smartart-hierarchy-
 * orientation.ts` for the declarative derivation of this ratio. Passing it
 * does NOT by itself fix `hierarchy--hier8.pptx`'s own leading margin
 * (`GENERATION_MARGIN_RATIO` remains unvalidated past 3 generations - see
 * `smartart-track-r-successor.md`'s own SESSION 10) - it only corrects the
 * GAP between rows to the genuine, multi-sample-confirmed constant, turning
 * a deviation that GREW with generation depth into a constant one.
 */
export function computeAxisPitch(
	dimension: number,
	margin: number,
	itemSize: number,
	count: number,
	fixedGapRatio?: number,
): AxisPitch {
	const n = Math.max(1, count);
	const gap =
		n <= 1
			? 0
			: fixedGapRatio !== undefined
				? itemSize * Math.max(0, fixedGapRatio)
				: Math.max(0, (dimension - margin - n * itemSize) / (n - 1));
	const pitch = itemSize + gap;
	// SESSION 16: the generation axis is CENTRED (slack split evenly, like the
	// fan axis's own `centeredAxisPitch`), not a leading-margin/trailing-flush
	// pack - that was only ever a coincidental match for a tree whose fanned
	// generations happen to nearly fill `dimension` already (every sample this
	// module's OWN doc comment cites - `hierarchy--flat3`/`--hier5` - is 2-3
	// generations tall against a box tuned to roughly fit that many rows).
	// COM-verified via 4 purpose-built trees (0/1/2/3 "leading singleton
	// generations before the first 5-wide fan", same fan width, `Demote()`
	// depth 2..5): measured top/bottom margin around a fixed-`n*itemSize+
	// (n-1)*gap`-tall content block is symmetric to within rounding at EVERY
	// depth (e.g. `n=4`: top 28px vs bottom 12px predicted-vs-measured; the
	// ~16px difference between them is CONSTANT across all 4 depths and
	// matches `margin` - i.e. `GENERATION_MARGIN_RATIO*itemSize` - almost
	// exactly, confirming `margin` is a SHIFT split between the two edges
	// (`+margin/2` top, `-margin/2` bottom), not an absolute leading gap).
	// Solving `finalTop(row 0) = gap/2 + shift = (dimension-span)/2 +
	// margin/2` for `shift` (`span = n*itemSize+(n-1)*gap = n*pitch-gap`)
	// gives the formula below. It is an EXACT generalisation of the old
	// `margin-gap/2` leading-margin formula: whenever `gap` is SOLVED (not
	// `fixedGapRatio`) to fill `dimension` exactly - the only regime the old
	// formula was ever validated against - `span===dimension-margin` by that
	// solve's own defining equation, which reduces this SAME formula to
	// `margin-gap/2` byte-for-byte (verified algebraically and against every
	// previously-passing fixture's own numbers below). It only differs - and
	// only then matches the cached geometry - when `fixedGapRatio` is used and
	// the fanned content is genuinely shorter than `dimension` (`hierarchy--
	// hier8.pptx` and the org-chart family's own fanned-row placement).
	const centeredShift = (dimension - n * pitch + margin) / 2;
	// Degenerate overflow (the item, or the un-gapped items alone, already
	// exceed `dimension`) still needs the OLD "never past the far edge" floor:
	// centring an oversized block would let it hang off BOTH edges, worse than
	// the old formula's own flush-trailing-edge fallback for this case (kept
	// as an explicit regression: `count===1`/floored-gap `count>1`, neither
	// exercised by any built-in gallery fixture, both covered by this
	// module's own colocated tests). Same `maxShift` derivation as before
	// (`rightEdge(shift)=shift+n*itemSize+gap*(n-0.5)<=dimension`); it is a
	// no-op whenever `centeredShift` already satisfies it, which is every
	// currently-measured non-degenerate case above.
	const maxShift = dimension - n * itemSize - gap * (n - 0.5);
	return { pitch, shift: Math.min(centeredShift, maxShift) };
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
