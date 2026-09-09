/**
 * SmartArt DiagramML interpreter - org-chart tree shaping helpers.
 *
 * Split out of `smartart-hierarchy-shared.ts` (the file-size budget):
 * assistant-node detection/partitioning, effective (assistant-excluding) tree
 * width, `chMax`/`chPref` row sizing, and the org-chart group-wrapper
 * flattening pass. Pure geometry; no framework code, no DOM.
 */

import type { PptxSmartArtNode } from '../types';
import type { TreeNode } from './smartart-helpers';

/** A `dgm:pt/@type="asst"` (assistant) data-model node. */
export function isAssistant(node: PptxSmartArtNode): boolean {
	return node.nodeType === 'asst';
}

/** Split a tree node's children into assistants and ordinary subordinates. */
export function partitionChildren(
	t: TreeNode,
	orgChart: boolean,
): { assistants: TreeNode[]; normal: TreeNode[] } {
	if (!orgChart) {
		return { assistants: [], normal: t.children };
	}
	const assistants: TreeNode[] = [];
	const normal: TreeNode[] = [];
	for (const child of t.children) {
		(isAssistant(child.node) ? assistants : normal).push(child);
	}
	return { assistants, normal };
}

/**
 * Tree width counting only ordinary (non-assistant) descendants: assistants
 * are rendered as a side annotation near their parent, not a fan-out sibling,
 * so they must not claim a normal sibling's share of the available width.
 * Falls back to plain leaf-counting (matching `treeWidth`) when `orgChart` is
 * off, so non-org-chart hierarchies are unaffected.
 */
export function effectiveWidth(t: TreeNode, orgChart: boolean): number {
	const { normal } = partitionChildren(t, orgChart);
	if (normal.length === 0) {
		return 1;
	}
	let sum = 0;
	for (const child of normal) {
		sum += effectiveWidth(child, orgChart);
	}
	return sum;
}

/** A resolved per-parent row size for `chMax`/`chPref` wrapping (`Infinity` = unbounded). */
export function rowSize(childMax: number | undefined, childPreferred: number | undefined): number {
	if (typeof childPreferred === 'number' && childPreferred > 0) {
		return childPreferred;
	}
	if (typeof childMax === 'number' && childMax > 0) {
		return childMax;
	}
	return Number.POSITIVE_INFINITY;
}

/** True for a `dgm:pt` that is an invisible org-chart grouping wrapper. */
function isOrgChartGroupWrapper(node: PptxSmartArtNode): boolean {
	return !node.nodeType && node.text.trim().length === 0;
}

/**
 * Genuine PowerPoint org charts (`presLayoutVars.orgChart`) do NOT attach
 * ordinary reports directly to their manager: even a manager with only 3
 * direct reports (well within the default `chPref=3` threshold, no overflow)
 * gets up to `chPref` synthetic, untyped, EMPTY content points as an
 * intermediate "hierChild group" layer, with the real reports nested one
 * level under whichever group slot got populated. Measured against
 * `smartart-orgchart-hierbranch.pptx` in the corpus: every one of its four
 * slides parses to 11 content points for a tree the author only typed 7 nodes
 * into, the extra 4 being one empty assistant slot and three empty group
 * points (only one of which has any children).
 *
 * Left alone, the hierarchy arranger renders those group wrappers as ordinary
 * blank fanned-out boxes and their real children one generation too deep
 * (landing on the hanging tail instead of the fan-out row PowerPoint itself
 * shows). This flattens them out before the tree is built: an empty, untyped
 * node's children are spliced into its own parent's child list in its place,
 * and the wrapper itself is dropped (an empty, childless slot simply
 * disappears, matching PowerPoint's own unpopulated group columns). Assistant
 * points keep their role even when empty - only a plain untyped node with no
 * text is a group wrapper - so a genuinely blank ordinary node is never lost:
 * that shape does not occur in a real org chart's data model. A no-op when
 * `orgChart` is not set, or when no such wrapper is present.
 */
export function flattenOrgChartGroupWrappers(
	nodes: PptxSmartArtNode[],
	orgChart: boolean,
): PptxSmartArtNode[] {
	if (!orgChart || !nodes.some(isOrgChartGroupWrapper)) {
		return nodes;
	}
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const parentIdOf = (node: PptxSmartArtNode): string | undefined => {
		let current = node;
		// Walk past chained wrappers (a wrapper parented under another wrapper).
		while (current.parentId) {
			const parent = byId.get(current.parentId);
			if (!parent || !isOrgChartGroupWrapper(parent)) {
				return current.parentId;
			}
			current = parent;
		}
		return current.parentId;
	};
	return nodes
		.filter((node) => !isOrgChartGroupWrapper(node))
		.map((node) => ({ ...node, parentId: parentIdOf(node) }));
}
