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

import type { PptxSmartArtNode } from '../types';

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
 * Map from a node's id to its direct children, reading `.children` when
 * populated (nested representation) or grouping by `parentId` across `nodes`
 * (flat representation, the real PowerPoint loader's shape).
 */
/**
 * All of `node`'s descendants (any depth) with non-empty text, document
 * order. Shared by `smartart-layout-interpreter-item-roles.ts` (a `des`-axis
 * per-item role, e.g. a list layout's `childText`) and
 * `smartart-layout-interpreter-composite.ts` (a `des`-axis composite slot,
 * e.g. `gear`'s `gear1ch`) - both fold the SAME thing (a `dgm:presOf
 * axis="des"` role's content), just for a differently-shaped arranger.
 */
export function smartArtDescendantsWithText(
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const walk = (current: PptxSmartArtNode): void => {
		for (const child of childrenOf.get(current.id) ?? []) {
			if (child.text.trim().length > 0) {
				out.push(child);
			}
			walk(child);
		}
	};
	walk(node);
	return out;
}

export function smartArtChildrenOf(nodes: PptxSmartArtNode[]): Map<string, PptxSmartArtNode[]> {
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
	return map;
}
