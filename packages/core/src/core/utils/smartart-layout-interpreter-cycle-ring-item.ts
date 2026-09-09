/**
 * SmartArt DiagramML interpreter - cycle ring content-dependent child
 * repositioning (`radial-list--hier5.pptx`'s own `parentNode`/`childNode`
 * composite ring item).
 *
 * `smartart-layout-interpreter-item-role-stack.ts`'s `stackRoleContent`
 * cannot split a `circle`-kind ring item's own geometry the way a `rect`
 * splits by height (see that module's own doc comment) - each role
 * (`parentNode` "self", `childNode` "des") starts as an UNCHANGED copy of
 * the ring's own already-placed circle, tagged `itemRoleName`. This module
 * is the arranger-specific geometry pass that module's doc comment calls
 * for (mirroring `smartart-layout-interpreter-pyramid-bands.ts`'s
 * `repositionPyramidBands` for the pyramid family): the "self" copy is
 * already correct (the ring placed it directly); the "child" copy, present
 * only on a point that HAS a child, is repositioned beside its own "self"
 * sibling using the item template's own declared `l`/`w` fractions
 * (`smartart-layout-interpreter-cycle-item-aspect.ts`'s
 * `CompositeContentLayout`, COM-verified against `radial-list--hier5.pptx`).
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtNode } from '../types';
import type { CompositeContentLayout } from './smartart-layout-interpreter-cycle-item-aspect';
import type {
	RenderedCircleNode,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

/**
 * Reposition every `childName`-tagged ring entry beside its own `selfName`
 * sibling (the SAME point's own "self" role, found via `flatNodes`' own
 * `parentId` linkage - a `des`-axis child role resolves to the CHILD data
 * node's own id, a DIFFERENT id from the point it visually sits beside, so
 * matching by `nodeId` directly - the way `repositionPyramidBands` matches
 * an accent to its row - does not apply here; the lookup goes through the
 * child's own parent instead). A no-op when `contentLayout` does not
 * describe a child sub-shape at all (a plain ring item with no composite
 * self+child split), or when a `childName`-tagged entry's own self sibling
 * cannot be found (declines that ONE entry, leaves it as the unchanged copy
 * `stackRoleContent` produced - never drops a shape).
 */
export function repositionCycleRingContent(
	result: SmartArtLayoutResult,
	contentLayout: CompositeContentLayout | undefined,
	flatNodes: readonly PptxSmartArtNode[],
): SmartArtLayoutResult {
	if (
		!contentLayout?.childName ||
		contentLayout.childLeftFactor === undefined ||
		contentLayout.childWidthFactor === undefined ||
		contentLayout.selfWidthFactor <= 0
	) {
		return result;
	}
	const { selfName, childName, childLeftFactor, childWidthFactor, selfWidthFactor } = contentLayout;
	const parentIdById = new Map(flatNodes.map((node) => [node.id, node.parentId]));
	const selfByNodeId = new Map<string, RenderedCircleNode>();
	for (const node of result.nodes) {
		if (node.kind === 'circle' && node.itemRoleName === selfName && node.nodeId) {
			selfByNodeId.set(node.nodeId, node);
		}
	}
	const nodes = result.nodes.map((rendered): RenderedNode => {
		if (rendered.kind !== 'circle' || rendered.itemRoleName !== childName || !rendered.nodeId) {
			return rendered;
		}
		const parentId = parentIdById.get(rendered.nodeId);
		const self = parentId ? selfByNodeId.get(parentId) : undefined;
		if (!self) {
			return rendered;
		}
		const selfW = 2 * (self.rx ?? self.r);
		const selfH = 2 * (self.ry ?? self.r);
		const selfLeft = self.cx - selfW / 2;
		const childW = (childWidthFactor / selfWidthFactor) * selfW;
		const childLeft = selfLeft + childLeftFactor * selfW;
		const cx = childLeft + childW / 2;
		const cy = self.cy;
		return {
			...rendered,
			cx,
			cy,
			r: Math.min(childW, selfH) / 2,
			rx: childW / 2,
			ry: selfH / 2,
			textX: cx,
			textY: cy,
		};
	});
	return { ...result, nodes };
}
