/**
 * Text-driven font search (ECMA-376 Part 1, 21.4.2.x `dgm:ruleLst`). When a
 * node's geometry depends on its text's font size (a child `h` declared as
 * `fact x primFontSz`, a `tx` node that grows to fit its text), the size
 * cannot be fitted after the layout: it decides the layout. PowerPoint starts
 * the addressed nodes at their `primFontSz` constraint (65pt) and applies the
 * node's `<dgm:rule type="primFontSz" val="5"/>`, stepping the size down
 * until the whole subtree fits: every text fits its (possibly grown) box and
 * nothing spills out of the node.
 *
 * "Vertical Bullet List" (5 items in 400pt): at 47pt the grown parent boxes
 * and `0.46 x size` child boxes overflow the frame, at 46pt they fit, and the
 * cached drawing is laid out at exactly 46pt. "Horizontal Bullet List" stops
 * at 32pt because "Node Three" is the widest word its column can hold.
 *
 * The search is whole points, largest first, and only the outermost
 * font-driven node searches (a nested one keeps the size its ancestor chose
 * for it).
 */

import { FONT_TYPES, relatedNodes } from './constraint-eval';
import { layoutContextOf } from './engine-context';
import type { EngineLayoutContext } from './engine-context';
import type { EngineNode } from './engine-node';
import { flattenEngineTree } from './engine-node';
import type { LdRule } from './layout-def-types';
import { layoutFontOf } from './layout-font';
import { textFitsAt } from './text-fit';
import { canGrow } from './text-grow';

const LENGTHS = new Set(['w', 'h', 'l', 't', 'r', 'b', 'ctrX', 'ctrY', 'sibSp', 'sp']);
const DEFAULT_START_PT = 65;
/** How far (points) a descendant may reach past the searching node's box. */
const SPILL_TOLERANCE_PT = 0.5;

function fontRule(node: EngineNode): LdRule | undefined {
	return node.rules.find(
		(rule) => rule.type === 'primFontSz' && rule.for !== 'self' && Number.isFinite(rule.val),
	);
}

/** Whether some length in `node`'s subtree is declared relative to a font size. */
function hasFontLength(node: EngineNode): boolean {
	return flattenEngineTree(node).some((n) =>
		n.constraints.some((c) => LENGTHS.has(c.type) && FONT_TYPES.has(c.refType)),
	);
}

/** The rule and the nodes whose size a search at `node` would pick, if it should search. */
export function fontSearchPlan(
	node: EngineNode,
): { rule: LdRule; targets: EngineNode[]; context: EngineLayoutContext } | undefined {
	const context = layoutContextOf(node);
	if (!context || context.searchDepth > 0) {
		return undefined;
	}
	const rule = fontRule(node);
	if (!rule || !hasFontLength(node)) {
		return undefined;
	}
	const targets = relatedNodes(node, rule.for, rule.forName, rule.ptType);
	return targets.length > 0 ? { rule, targets, context } : undefined;
}

function startSize(targets: readonly EngineNode[]): number {
	let start = Infinity;
	for (const target of targets) {
		let size = target.values.get('primFontSz') ?? DEFAULT_START_PT;
		const cap = target.maxValues.get('primFontSz');
		if (cap !== undefined && cap > 0) {
			size = Math.min(size, cap);
		}
		start = Math.min(start, size);
	}
	return Math.max(1, Math.floor((Number.isFinite(start) ? start : DEFAULT_START_PT) + 1e-9));
}

/** Whether the laid-out subtree of `node` holds every text and stays inside `node`'s box. */
function fits(node: EngineNode, context: EngineLayoutContext): boolean {
	const box = node.box;
	if (!box) {
		return true;
	}
	for (const n of flattenEngineTree(node)) {
		const b = n.box;
		if (!b || n.alg.type === 'conn' || !(b.w > 0) || !(b.h > 0)) {
			continue;
		}
		if (
			b.x < box.x - SPILL_TOLERANCE_PT ||
			b.y < box.y - SPILL_TOLERANCE_PT ||
			b.x + b.w > box.x + box.w + SPILL_TOLERANCE_PT ||
			b.y + b.h > box.y + box.h + SPILL_TOLERANCE_PT
		) {
			return false;
		}
		const font = layoutFontOf(n);
		const text = font === undefined ? undefined : context.textOf(n);
		if (font !== undefined && text && !textFitsAt(n, text, font, context.metrics, layoutFontOf)) {
			return false;
		}
	}
	return true;
}

/**
 * Record every size text grew a node to (so a sibling placed relative to it
 * sees the grown size) and equalise growth across `op="equ"` size groups.
 */
function recordGrowth(node: EngineNode): void {
	const nodes = flattenEngineTree(node);
	for (const n of nodes) {
		const grown = n.box?.h;
		if (grown !== undefined && canGrow(n, 'h') && grown > (n.growFloor?.h ?? -Infinity)) {
			n.growFloor = { ...n.growFloor, h: grown };
		}
	}
	for (const n of nodes) {
		for (const group of n.groups) {
			if (group.type !== 'h' && group.type !== 'w') {
				continue;
			}
			const key = group.type;
			const floors = group.members.map((m) => m.growFloor?.[key] ?? -Infinity);
			const largest = Math.max(...floors);
			if (!Number.isFinite(largest)) {
				continue;
			}
			for (const member of group.members) {
				member.growFloor = { ...member.growFloor, [key]: largest };
			}
		}
	}
}

/** Forget the previous candidate's growth and bounds (the node's own bounds come from above and stay). */
function resetCandidate(node: EngineNode): void {
	for (const n of flattenEngineTree(node)) {
		n.growFloor = undefined;
		if (n !== node) {
			n.minValues.clear();
			n.maxValues.clear();
		}
	}
}

/**
 * Lay `node` out at the largest whole-point size its font rule allows that
 * fits; `layoutOnce` lays the subtree out once at the current forced size.
 */
export function layoutWithFontSearch(
	node: EngineNode,
	plan: { rule: LdRule; targets: EngineNode[]; context: EngineLayoutContext },
	layoutOnce: () => void,
): void {
	const { rule, targets, context } = plan;
	layoutOnce();
	const start = startSize(targets);
	const floor = Math.max(1, Math.min(start, Math.ceil(rule.val - 1e-9)));
	context.searchDepth++;
	try {
		for (let size = start; size >= floor; size--) {
			for (const target of targets) {
				target.forcedFontPt = size;
			}
			resetCandidate(node);
			// Once to size every box (and learn the self-declared bounds),
			// then again so boxes placed relative to a grown or capped one
			// see its final size.
			layoutOnce();
			recordGrowth(node);
			layoutOnce();
			if (size === floor || fits(node, context)) {
				return;
			}
		}
	} finally {
		context.searchDepth--;
	}
}
