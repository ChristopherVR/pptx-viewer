/**
 * SmartArt DiagramML interpreter - compound-`forEachOrigin`-bound composite
 * slot resolution.
 *
 * `hexagon-radial--hier5.pptx`'s `Child1`..`Child6`: each is a `self`-family
 * (`presOf axis="desOrSelf"`) slot, individually positioned via the
 * composite's own `for="ch" forName="ChildN"` constraints, but reached
 * through its OWN COMPOUND `dgm:forEach axis="ch ch" ptType="node node"
 * st="1 N" cnt="1 1"` - "top-level point 1's Nth child", independent of any
 * other slot's own binding (unlike `arrangeByPresentationOf`'s ordinal
 * `selfSlots[i] <-> nodes[i]` matching, which assumes a SHARED sequential
 * point stream). Resolved the exact same way a `dgm:choose` guard's compound
 * `@axis` is (`smartart-layout-interpreter-axis-count.ts`'s
 * `resolveAxisNodes`), applied to the slot's OWN `forEachOrigin` instead of a
 * `dgm:if`'s condition. Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { resolveAxisNodes } from './smartart-layout-interpreter-axis-count';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite';
import { resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { rectNode } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, RenderedRectNode } from './smartart-layout-types';
import { smartArtDescendantsWithText } from './smartart-node-tree-axis';

/**
 * `slotted` entries whose own `presOf` is a SINGLE token (`self`/`des`/
 * `desOrSelf`) but reached through a COMPOUND `forEachOrigin` (2+ hops,
 * first hop `ch`) - the shape {@link resolveForEachBoundContent} resolves.
 * Excludes anything `arrangeByPresentationOf`'s ordinal `self`/`des` matching
 * already handles (a compound forEachOrigin never appears on a plain,
 * document-order-matched slot in any fixture measured).
 */
export function forEachBoundSlots(slotted: SlottedDims[]): SlottedDims[] {
	return slotted.filter((slot) => {
		const axis = slot.node.presentationOf?.axis;
		const origin = slot.node.forEachOrigin?.axis;
		return axis?.length === 1 && (origin?.length ?? 0) > 1 && origin?.[0] === 'ch';
	});
}

/**
 * Resolve one `forEachBoundSlots` entry's own content: navigate its
 * `forEachOrigin`'s compound `@axis` (via `resolveAxisNodes`, against the
 * diagram's full flat node list) to find the anchor point(s) it is bound to,
 * then fold in that anchor's own descendants when the slot's `presOf` is
 * `des`/`desOrSelf` (`self` alone keeps just the anchor itself).
 */
function resolveForEachBoundContent(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	childrenOf: Map<string, PptxSmartArtNode[]>,
): PptxSmartArtNode[] {
	const origin = node.forEachOrigin;
	const presOfAxis = node.presentationOf?.axis?.[0];
	if (!origin?.axis || !presOfAxis) {
		return [];
	}
	const anchors =
		resolveAxisNodes(flat, origin.axis, origin.pointTypes, origin.start, origin.count) ?? [];
	const content: PptxSmartArtNode[] = [];
	for (const anchor of anchors) {
		if (presOfAxis === 'des') {
			content.push(...smartArtDescendantsWithText(anchor, childrenOf));
			continue;
		}
		if (anchor.text.trim().length > 0) {
			content.push(anchor);
		}
		if (presOfAxis === 'desOrSelf') {
			content.push(...smartArtDescendantsWithText(anchor, childrenOf));
		}
	}
	return content;
}

/**
 * Render every `forEachBoundSlots` entry as its own box (see this module's
 * doc comment) - one box per slot, each independently anchored, `index`
 * continuing from the caller's own ordinal-matched count so keys stay unique.
 */
export function renderForEachBoundSlots(
	slots: SlottedDims[],
	flat: PptxSmartArtNode[],
	box: BoundingBox,
	absX: number,
	absY: number,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	ctx: SlotStyleContext,
	startIndex: number,
): RenderedNode[] {
	const rendered: RenderedNode[] = [];
	slots.forEach((slot, offset) => {
		const content = resolveForEachBoundContent(slot.node, flat, childrenOf);
		if (content.length === 0) {
			return;
		}
		const rect = resolveSlot(slot.dims, box, absX, absY);
		const first = content[0];
		const index = startIndex + offset;
		const entry: RenderedRectNode = {
			...rectNode({
				key: `${ctx.elementId}-comp-feach-${first.id}-${index}`,
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				node: first,
				index,
				total: startIndex + slots.length,
				palette: ctx.palette,
				style: ctx.style,
				ctx: ctx.ctx,
			}),
			foldedNodeIds: content.slice(1).map((entry_) => entry_.id),
		};
		rendered.push(entry);
	});
	return rendered;
}
