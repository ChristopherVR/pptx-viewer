/**
 * Depth/parent helpers for the DiagramML interpreter's `axis="ch"` handling.
 *
 * `PptxSmartArtData.nodes` has TWO possible shapes depending on where it came
 * from: the real PowerPoint loader (`PptxHandlerRuntimeSmartArt.ts`) always
 * emits a FLAT array with a `parentId` back-reference (never populates
 * `.children`); some hand-built fixtures and SDK call sites instead build a
 * genuinely nested tree (`.children` populated, no `parentId` needed). Both
 * representations describe the same tree; these helpers read whichever one is
 * present so callers do not need to know which shape they were handed (see
 * `buildTree` in `smartart-helpers.ts`, which already makes the same choice
 * for hierarchy arrangement).
 */

import type { PptxSmartArtConnection, PptxSmartArtNode } from '../types';
import { buildChildOrder } from './smartart-layout-interpreter-connector-order';

/**
 * The DIRECT top-level nodes: depth 0, i.e. the `axis="ch"` set relative to
 * the diagram's document root. For a flat (`parentId`) representation this is
 * every node with no parent or a parent outside the given set; for a nested
 * (`.children`) representation the given array already IS just the roots.
 *
 * This is the set a built-in layoutDef's driving `dgm:forEach axis="ch"
 * ptType="node"` iterates (one rendered box per top-level node): see
 * `smartart-layout-interpreter-flow.ts`'s `selectArrangedNodes`. A node added
 * one level deeper (the SmartArt text pane's Tab/"Add Bullet") is NOT in this
 * set; PowerPoint folds it into its nearest top-level ancestor's box instead
 * of giving it a sibling box (`smartart-interpreter-drawing-bridge.ts`'s
 * `collectFoldedDescendants`/`projectFoldedNodeText`).
 */
export function topLevelSmartArtNodes(nodes: PptxSmartArtNode[]): PptxSmartArtNode[] {
	const hasNestedChildren = nodes.some((n) => n.children !== undefined && n.children.length > 0);
	if (hasNestedChildren) {
		return nodes;
	}
	const ids = new Set(nodes.map((n) => n.id));
	return nodes.filter((n) => !n.parentId || !ids.has(n.parentId));
}

/**
 * All of `node`'s descendants (any depth), document order, trimmed to drop
 * LEADING/TRAILING empty-text ones but keeping an INTERIOR empty-text node
 * (between two text-bearing descendants) as a blank-paragraph placeholder.
 * Shared by `smartart-layout-interpreter-item-roles.ts` (a `des`-axis
 * per-item role, e.g. a list layout's `childText`) and
 * `smartart-layout-interpreter-composite.ts` (a `des`-axis composite slot,
 * e.g. `gear`'s `gear1ch`) - both fold the SAME thing (a `dgm:presOf
 * axis="des"` role's content), just for a differently-shaped arranger.
 *
 * `text-card-short-line--hier8.pptx`'s "Branch A" shape (COM-verified): a
 * doc-order-empty, non-text GROUP-WRAPPER point sits BETWEEN two real
 * descendants (`Branch A Child`, then `Branch A Grandchild with long text`)
 * that fold into the SAME "des" role box. The cached drawing renders that
 * box's text as `"Branch A Child\n\nBranch A Grandchild..."` (a BLANK line
 * between them, from the skipped wrapper's own empty paragraph) - dropping
 * every empty-text descendant unconditionally (the prior behaviour)
 * collapsed it to `"Branch A Child\nBranch A Grandchild..."` instead
 * (measured: `meet-the-team--hier8`/`small-dots-horizontal--hier8`/
 * `text-card-short-line--hier8.pptx` all share this exact shape). Trimming
 * only the LEADING/TRAILING empty run (never an interior one) keeps every
 * pre-existing caller's own "any real content at all" check
 * (`.length > 0`) exactly as before: an interior blank can only ever exist
 * BETWEEN two already-real entries, so it never turns a genuinely-empty
 * result non-empty.
 */
export function smartArtDescendantsWithText(
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const walk = (current: PptxSmartArtNode): void => {
		for (const child of childrenOf.get(current.id) ?? []) {
			out.push(child);
			walk(child);
		}
	};
	walk(node);
	let start = 0;
	while (start < out.length && out[start].text.trim().length === 0) {
		start++;
	}
	let end = out.length - 1;
	while (end >= start && out[end].text.trim().length === 0) {
		end--;
	}
	return out.slice(start, end + 1);
}

/**
 * Map from a node's id to its direct children, reading `.children` when
 * populated (nested representation) or grouping by `parentId` across `nodes`
 * (flat, `parentId`-only representation, the real PowerPoint loader's shape).
 *
 * `connections`, when supplied, reorders each group's own children by their
 * `dgm:cxn` `srcOrd` (`buildChildOrder`, the SAME source of truth already
 * used for hierarchy sibling order and hub satellites) instead of raw
 * `nodes` array (`dgm:ptLst` declaration) order - the two are NOT guaranteed
 * to agree (`gear--hier5.pptx`'s "Node Two" declares its children "Node
 * Three" then "Node Five" in `dgm:ptLst`, but their real `srcOrd` is
 * Five=0, Three=1; a composite `des`-axis slot folding both into one box via
 * `smartArtDescendantsWithText` then joins them in the WRONG order without
 * this - COM-verified against `gear--hier5.pptx`'s own cached drawing,
 * `"Node Five\nNode Three"`). Sorts EACH already-grouped list directly
 * (every entry in one list shares the SAME parent by construction) rather
 * than reusing `applyChildOrder`'s whole-array comparator: that comparator
 * returns 0 for a pair from DIFFERENT parents, which is correct for
 * STABILITY but breaks transitively when two same-parent siblings are
 * separated in the source array by an unrelated node the comparator treats
 * as "equal" to both (`Array.prototype.sort` is not guaranteed to compare
 * every pair directly, so the two same-parent siblings' own relative
 * `srcOrd` order is never actually applied in that shape) - measured
 * directly against `gear--hier5.pptx` (`applyChildOrder` alone left
 * "Node Three"/"Node Five" unchanged, separated by "Node Four", a
 * different-parent node). Grouping first sidesteps this entirely: sorting
 * within an already-homogeneous-parent list never needs a "0 = unrelated"
 * escape hatch. Omitted (the default) keeps the pre-existing `dgm:ptLst`-
 * order behaviour for every caller that does not have connection data, and
 * the nested (`.children`) representation is never reordered here (it
 * already reflects whatever order its own producer chose).
 */
export function smartArtChildrenOf(
	nodes: PptxSmartArtNode[],
	connections?: PptxSmartArtConnection[],
): Map<string, PptxSmartArtNode[]> {
	const map = new Map<string, PptxSmartArtNode[]>();
	for (const n of nodes) {
		if (n.children && n.children.length > 0) {
			map.set(n.id, n.children);
		} else if (n.parentId) {
			const list = map.get(n.parentId);
			if (list) {
				list.push(n);
			} else {
				map.set(n.parentId, [n]);
			}
		}
	}
	const childOrder = connections ? buildChildOrder(connections) : undefined;
	if (childOrder) {
		for (const [parentId, list] of map) {
			if (list.length > 1 && list.some((child) => childOrder.has(child.id))) {
				map.set(
					parentId,
					list
						.map((node, originalIndex) => ({ node, originalIndex }))
						.sort(
							(a, b) =>
								(childOrder.get(a.node.id) ?? a.originalIndex) -
								(childOrder.get(b.node.id) ?? b.originalIndex),
						)
						.map((entry) => entry.node),
				);
			}
		}
	}
	return map;
}
