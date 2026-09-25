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
import { presetAdjustments } from './shape-adjust';
import type { NodeText, TextMetrics } from './text-measure';
import { paragraphsFit } from './text-measure';

export type { NodeText, TextMetrics } from './text-measure';

/** Starting size (points) for a text node with no `primFontSz` constraint. */
export const DEFAULT_START_PT = 65;

/** Smallest size (points) any shrink may reach. */
const ABSOLUTE_FLOOR_PT = 1;

/**
 * PowerPoint's own default text-frame inset when a text node declares no
 * margin constraint at all: `0.56 x font size` per side (see
 * `smartart-layout-item-font-size.ts`'s `DEFAULT_NO_CONSTRAINT_MARGIN_FACTOR`
 * for the COM measurement).
 */
const DEFAULT_MARGIN_FACTOR = 0.56;

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
 * The font-size variable a node's text is sized by: `primFontSz`, unless the
 * node declares `<dgm:constr type="primFontSz" refType="secFontSz"/>` on
 * itself, in which case its text follows its own `secFontSz` and the
 * `secFontSz` rules ("Basic Pyramid"'s `acctTx` accent column: no
 * `primFontSz` rule at all, a `secFontSz` rule down to 5pt, cached at 35pt
 * instead of the 65pt start).
 */
function sizingVariable(node: EngineNode): string {
	const linked = node.deferred.some(
		(d) => d.type === 'primFontSz' && d.refType === 'secFontSz' && d.ref === node,
	);
	return linked ? 'secFontSz' : 'primFontSz';
}

/**
 * The node's starting size (its `primFontSz` constraint value, capped by any
 * literal `op="lte"` bound) and its shrink floor (the lowest `primFontSz`
 * rule reaching it). With no rule, PowerPoint does not shrink the text at
 * all, so the floor is the start itself.
 */
export function nodeFontBounds(node: EngineNode): FontBoundsPt {
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
 * shape. A shape stood on its side (`rot` 90/270) keeps its text upright, so
 * the text rectangle is computed in the unrotated shape frame and read back
 * with its axes swapped.
 */
const textBoxCache = new WeakMap<EngineNode, { w: number; h: number }>();

export function nodeTextBox(node: EngineNode): { w: number; h: number } | undefined {
	const cached = textBoxCache.get(node);
	if (cached) {
		return cached;
	}
	const computed = computeTextBox(node);
	if (computed) {
		textBoxCache.set(node, computed);
	}
	return computed;
}

function computeTextBox(node: EngineNode): { w: number; h: number } | undefined {
	const box = node.box;
	if (!box) {
		return undefined;
	}
	const rot = node.shape?.rot ?? 0;
	const quarter = Math.round(rot / 90);
	const sideways = Math.abs(quarter) % 2 === 1 && Math.abs(rot - quarter * 90) < 1e-6;
	const w = sideways ? box.h : box.w;
	const h = sideways ? box.w : box.h;
	const rect = node.shape?.type
		? evaluatePresetShape(node.shape.type, w, h, presetAdjustments(node.shape.type, node.shape.adj))
				?.textRect
		: undefined;
	const tw = rect ? Math.max(0, rect.r - rect.l) : w;
	const th = rect ? Math.max(0, rect.b - rect.t) : h;
	return sideways ? { w: th, h: tw } : { w: tw, h: th };
}

type MarginSide = 'lMarg' | 'rMarg' | 'tMarg' | 'bMarg';
const SIDES: readonly MarginSide[] = ['lMarg', 'rMarg', 'tMarg', 'bMarg'];

/**
 * Per-side margins (points) at candidate size `sizePt`: a margin referencing
 * a font size (`refType="primFontSz"`, or `"secFontSz"` on a node whose text
 * follows its `secFontSz`) scales with the font (`fact x size`), a literal one is
 * fixed, and a node declaring none gets PowerPoint's default proportional
 * inset.
 */
export function nodeMarginsPt(node: EngineNode, sizePt: number): Record<MarginSide, number> {
	const out: Record<MarginSide, number> = { lMarg: 0, rMarg: 0, tMarg: 0, bMarg: 0 };
	let declaredAny = false;
	for (const side of SIDES) {
		const deferred = node.deferred.find((d) => d.type === side && FONT_TYPES.has(d.refType));
		if (deferred) {
			out[side] = deferred.fact * sizePt;
			declaredAny = true;
			continue;
		}
		const literal = node.values.get(side);
		if (literal !== undefined) {
			out[side] = literal;
			declaredAny = true;
		}
	}
	if (!declaredAny) {
		for (const side of SIDES) {
			out[side] = DEFAULT_MARGIN_FACTOR * sizePt;
		}
	}
	return out;
}

/** Whether `text` fits `node`'s text box at whole-point size `sizePt`. */
export function textFitsAt(
	node: EngineNode,
	text: NodeText,
	sizePt: number,
	metrics: TextMetrics,
): boolean {
	const box = nodeTextBox(node);
	if (!box) {
		return true;
	}
	const m = nodeMarginsPt(node, sizePt);
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
): number {
	for (let size = bounds.start; size > bounds.floor; size--) {
		if (textFitsAt(node, text, size, metrics)) {
			return size;
		}
	}
	return bounds.floor;
}
