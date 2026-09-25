/**
 * Per-node text fitting for the per-point layout engine's output stage
 * (ECMA-376 Part 1, 21.4.2.x: a `tx` node's `primFontSz` constraint is the
 * STARTING size, and a `dgm:rule type="primFontSz"` lets PowerPoint shrink
 * it, down to the rule's `val`, until the node's text fits its own text
 * box). Equalisation across nodes (`op="equ"` groups, `op="lte"` links)
 * happens one level up, in `font-groups.ts`; this module answers the
 * single-node question "what is the largest whole point this node's text
 * fits at?".
 *
 * All arithmetic is in POINTS, matching the engine's internal coordinate
 * space. The paragraph model itself (line pitch, folded descendants,
 * spacing) lives in `text-measure.ts`; this module supplies the node-level
 * inputs: the preset's text rectangle, the margins and the size bounds.
 */

import { evaluatePresetShape } from '../../geometry';
import { FONT_TYPES } from './constraint-eval';
import type { EngineNode } from './engine-node';
import { layoutFontOf, sizingVariable } from './layout-font';
import { presetAdjustments } from './shape-adjust';
import type { NodeText, TextMetrics } from './text-measure';
import { paragraphsFit } from './text-measure';

export type { NodeText, TextMetrics } from './text-measure';
export { sizingVariable } from './layout-font';

/** Starting size (points) for a text node with no `primFontSz` constraint. */
export const DEFAULT_START_PT = 65;

/** Smallest size (points) any shrink may reach. */
const ABSOLUTE_FLOOR_PT = 1;

/**
 * PowerPoint's own default text-frame inset for a side a text node declares
 * no margin constraint for: `0.56 x font size` (see
 * `smartart-layout-item-font-size.ts`'s `DEFAULT_NO_CONSTRAINT_MARGIN_FACTOR`
 * for the COM measurement). It applies per side: "Ascending Picture Accent
 * Process"'s `desTx`, "Basic Target"'s labels and "Opposing Arrows"'s arrow
 * text declare only some sides, and each undeclared side's cached inset is
 * exactly `0.56 x` the cached size.
 */
const DEFAULT_MARGIN_FACTOR = 0.56;

/** Another node's current font size, for a margin that references it (undefined: use the fitted node's own). */
export type FontSizeOf = (node: EngineNode) => number | undefined;

/** Whole-point bounds a node's size may take before any cross-node equalisation. */
export interface FontBoundsPt {
	start: number;
	floor: number;
}

function ruleFloors(node: EngineNode, type: string): number[] {
	const floors: number[] = [];
	const collect = (declaring: EngineNode, relation: 'self' | 'ch' | 'des'): void => {
		for (const rule of declaring.rules) {
			if (rule.type !== type || rule.for !== relation) {
				continue;
			}
			if (rule.forName && rule.forName !== node.name) {
				continue;
			}
			if (Number.isFinite(rule.val)) {
				floors.push(rule.val);
			}
		}
	};
	collect(node, 'self');
	if (node.parent) {
		collect(node.parent, 'ch');
	}
	for (let anc = node.parent; anc; anc = anc.parent) {
		collect(anc, 'des');
	}
	return floors;
}

/**
 * The node's starting size (its `primFontSz` constraint value, capped by any
 * literal `op="lte"` bound) and its shrink floor (the lowest `primFontSz`
 * rule reaching it). With no rule, PowerPoint does not shrink the text at
 * all, so the floor is the start itself.
 */
export function nodeFontBounds(node: EngineNode): FontBoundsPt {
	// A text-driven font search already chose the size the layout was built
	// around (and grew the boxes to fit it).
	const searched = layoutFontOf(node);
	if (searched !== undefined) {
		const fixed = Math.max(ABSOLUTE_FLOOR_PT, Math.floor(searched + 1e-9));
		return { start: fixed, floor: fixed };
	}
	const variable = sizingVariable(node);
	const declared = node.values.get(variable);
	const cap = node.maxValues.get(variable);
	let start = declared !== undefined && declared > 0 ? declared : DEFAULT_START_PT;
	if (cap !== undefined && cap > 0) {
		start = Math.min(start, cap);
	}
	start = Math.max(ABSOLUTE_FLOOR_PT, Math.floor(start + 1e-9));
	const floors = ruleFloors(node, variable);
	const floor = floors.length > 0 ? Math.max(ABSOLUTE_FLOOR_PT, Math.min(...floors)) : start;
	return { start, floor: Math.min(floor, start) };
}

/**
 * The upright text box (points) inside `node`'s shape: the preset's own
 * ECMA-376 `<a:rect>` text rectangle when it declares one, else the full
 * shape. The text rectangle is computed in the unrotated shape frame. A
 * shape stood on its side (`rot` 90/270) keeps its text upright by default
 * (`tx` param `autoTxRot="upr"`), so the rectangle is read back with its
 * axes swapped; with `autoTxRot="grav"` or `"none"` the text turns with the
 * shape and runs along the rectangle's own width ("Descending Block List"'s
 * `rot="-90"` parent labels: cached `dsp:txXfrm` 270 x 41pt, read along the
 * 270pt side).
 */
const textBoxCache = new WeakMap<
	EngineNode,
	{ w: number; h: number; box: { w: number; h: number } }
>();

export function nodeTextBox(node: EngineNode): { w: number; h: number } | undefined {
	const box = node.box;
	if (!box) {
		return undefined;
	}
	const cached = textBoxCache.get(node);
	if (cached && cached.w === box.w && cached.h === box.h) {
		return cached.box;
	}
	const computed = textBoxAt(node, box.w, box.h);
	textBoxCache.set(node, { w: box.w, h: box.h, box: computed });
	return computed;
}

/** {@link nodeTextBox} for a `w` x `h` footprint (a size the node is being grown to). */
export function textBoxAt(node: EngineNode, boxW: number, boxH: number): { w: number; h: number } {
	const rot = node.shape?.rot ?? 0;
	const quarter = Math.round(rot / 90);
	const sideways = Math.abs(quarter) % 2 === 1 && Math.abs(rot - quarter * 90) < 1e-6;
	const w = sideways ? boxH : boxW;
	const h = sideways ? boxW : boxH;
	const rect = node.shape?.type
		? evaluatePresetShape(node.shape.type, w, h, presetAdjustments(node.shape.type, node.shape.adj))
				?.textRect
		: undefined;
	const tw = rect ? Math.max(0, rect.r - rect.l) : w;
	const th = rect ? Math.max(0, rect.b - rect.t) : h;
	const upright = (node.alg.params.autoTxRot ?? 'upr') === 'upr';
	return sideways && upright ? { w: th, h: tw } : { w: tw, h: th };
}

type MarginSide = 'lMarg' | 'rMarg' | 'tMarg' | 'bMarg';
const SIDES: readonly MarginSide[] = ['lMarg', 'rMarg', 'tMarg', 'bMarg'];

/**
 * Per-side margins (points) at candidate size `sizePt`: a margin referencing
 * a font size (`refType="primFontSz"`, or `"secFontSz"` on a node whose text
 * follows its `secFontSz`) scales with that font (`fact x size`, where a
 * reference to ANOTHER node reads that node's size via `refSize`: "Circle
 * Arrow Process"'s 18pt child boxes inset `0.05 x` their 23pt parent's
 * size, 1.15pt, not 0.9pt), a literal one is
 * fixed, and a node declaring none gets PowerPoint's default proportional
 * inset.
 */
export function nodeMarginsPt(
	node: EngineNode,
	sizePt: number,
	refSize?: FontSizeOf,
): Record<MarginSide, number> {
	const out: Record<MarginSide, number> = { lMarg: 0, rMarg: 0, tMarg: 0, bMarg: 0 };
	for (const side of SIDES) {
		const deferred = node.deferred.find((d) => d.type === side && FONT_TYPES.has(d.refType));
		if (deferred) {
			const base = deferred.ref === node ? sizePt : (refSize?.(deferred.ref) ?? sizePt);
			// A `secFontSz` margin on a node sized by `primFontSz` reads its
			// secondary size, `round(0.78 x primFontSz)`.
			const secondary =
				deferred.refType === 'secFontSz' && sizingVariable(deferred.ref) === 'primFontSz';
			out[side] = deferred.fact * (secondary ? Math.max(1, Math.round(base * 0.78)) : base);
			continue;
		}
		out[side] = node.values.get(side) ?? DEFAULT_MARGIN_FACTOR * sizePt;
	}
	return out;
}

/** Whether `text` fits `node`'s text box at whole-point size `sizePt`. */
export function textFitsAt(
	node: EngineNode,
	text: NodeText,
	sizePt: number,
	metrics: TextMetrics,
	refSize?: FontSizeOf,
): boolean {
	const box = nodeTextBox(node);
	if (!box) {
		return true;
	}
	const m = nodeMarginsPt(node, sizePt, refSize);
	const availW = box.w - m.lMarg - m.rMarg;
	const availH = box.h - m.tMarg - m.bMarg;
	if (availW <= 0 || availH <= 0) {
		return false;
	}
	return paragraphsFit(text, sizePt, availW, availH, metrics);
}

/** Largest whole point in `[bounds.floor, bounds.start]` at which `text` fits (the floor when nothing does). */
export function fitNodeFontPt(
	node: EngineNode,
	text: NodeText,
	bounds: FontBoundsPt,
	metrics: TextMetrics,
	refSize?: FontSizeOf,
): number {
	for (let size = bounds.start; size > bounds.floor; size--) {
		if (textFitsAt(node, text, size, metrics, refSize)) {
			return size;
		}
	}
	return bounds.floor;
}
