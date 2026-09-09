/**
 * SmartArt DiagramML interpreter - composite (`composite`) arranger.
 *
 * The `composite` algorithm does not flow points; it positions each of its child
 * `layoutNode`s at an explicit offset given by that child's `dgm:constr`
 * (`l`/`t`/`w`/`h`/`ctrX`/`ctrY`, usually a `fact` of the parent w/h, EITHER
 * self-declared on the slot's own `constrLst` OR - the more common shape in
 * real built-ins (`gear`, `balance`, `stacked-venn`) - declared BY the
 * composite itself via `for="ch" forName="<slot>"`, resolved in
 * `smartart-layout-interpreter-composite-slots.ts`). It is how many
 * built-ins place a fixed set of slots - a title beside a body, a shape over
 * its picture, an accent plus a caption, gear teeth around a hub.
 *
 * Data-point mapping is `dgm:presOf`-aware (see the module doc comment on
 * `PptxSmartArtLayoutNode.presentationOf`): a `self`-axis slot (`gear1`,
 * `gear2`, ..., or `balance`'s two pans) anchors ONE arranged point, in
 * document order; a `des`-axis slot (`gear1ch`) pairs with the SAME ordinal
 * `self` slot's own descendants (folded, as
 * `smartart-layout-interpreter-item-roles.ts` does for a per-item role) -
 * NOT the next arranged point. A slot with neither (a connector cap, an
 * invisible src/dst anchor) is purely decorative: this interpreter is only
 * scored on text-bearing shapes, so it consumes no data point and renders
 * nothing. A composite with no `presOf` on ANY slot (a bare custom layout)
 * falls back to the pre-existing blind "one point per positioned slot, in
 * document order" mapping.
 *
 * Scope / honesty: like the rest of the partial interpreter (see
 * `smartart-layout-interpreter-model.ts`), this does NOT run the recursive
 * forEach/choose + constraint-reference solver, and does not resolve
 * geometry for the decorative slots it skips. Pure geometry; no framework
 * code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX, roleOf } from './smartart-constraint-solver';
import { renderChildRepeaterSlot } from './smartart-layout-interpreter-composite-children';
import { arrangeByChooseAwareSlots } from './smartart-layout-interpreter-composite-choose';
import {
	forEachBoundSlots,
	renderForEachBoundSlots,
} from './smartart-layout-interpreter-composite-foreach';
import { findRingDesSibling, ringFoldRect } from './smartart-layout-interpreter-composite-ring';
import { axisAbsMax, readSlots, resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { Slot, SlottedDims } from './smartart-layout-interpreter-composite-slots';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type {
	BoundingBox,
	RenderedNode,
	RenderedRectNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';
import { smartArtDescendantsWithText } from './smartart-node-tree-axis';

/** `slotted` entries whose layoutNode's own `presOf` primary axis is `axis`. */
function slotsWithAxis(slotted: SlottedDims[], axis: string): SlottedDims[] {
	return slotted.filter((slot) => slot.node.presentationOf?.axis?.[0] === axis);
}

/** Shared per-arranger style/palette context, threaded through every slot
 * renderer in this module and in `smartart-layout-interpreter-composite-
 * children.ts`'s child-repeater expansion. */
export interface SlotStyleContext {
	ctx: ReturnType<typeof styleContext>;
	palette: string[];
	style: SmartArtStyle;
	elementId: string;
}

function slotRect(slot: SlottedDims, box: BoundingBox, absX: number, absY: number): Slot {
	return resolveSlot(slot.dims, box, absX, absY);
}

/** One `self`-anchored slot plus, when present, its paired `des` fold. */
function renderAnchoredPair(
	node: PptxSmartArtNode,
	index: number,
	total: number,
	selfSlot: Slot,
	desSlot: { rect: Slot; content: PptxSmartArtNode[] } | undefined,
	ctx: SlotStyleContext,
): RenderedNode[] {
	const out: RenderedNode[] = [
		rectNode({
			key: `${ctx.elementId}-comp-${node.id}-${index}`,
			x: selfSlot.x,
			y: selfSlot.y,
			width: selfSlot.width,
			height: selfSlot.height,
			node,
			index,
			total,
			palette: ctx.palette,
			style: ctx.style,
			ctx: ctx.ctx,
		}),
	];
	if (desSlot && desSlot.content.length > 0) {
		const first = desSlot.content[0];
		const rendered: RenderedRectNode = {
			...rectNode({
				key: `${ctx.elementId}-comp-des-${first.id}-${index}`,
				x: desSlot.rect.x,
				y: desSlot.rect.y,
				width: desSlot.rect.width,
				height: desSlot.rect.height,
				node: first,
				index,
				total,
				palette: ctx.palette,
				style: ctx.style,
				ctx: ctx.ctx,
			}),
			foldedNodeIds: desSlot.content.slice(1).map((entry) => entry.id),
		};
		out.push(rendered);
	}
	return out;
}

/**
 * `dgm:presOf`-aware mapping: `self` slots anchor arranged points in order,
 * a `des` slot pairs with the SAME ordinal `self` slot's own descendants
 * (either a separately-positioned `des` slot, or - when none is positioned -
 * an UNPOSITIONED same-ring `des` sibling template folded into the self
 * rect's own box, see {@link findRingDesSibling}), and any BARE-`presOf`
 * sibling wrapper slot that resolves child-repeater items against the SAME
 * ordinal anchor (`Table List`'s `pillars`, see {@link renderChildRepeaterSlot})
 * contributes one box per resolved child. Returns `undefined` when no slot
 * carries a `self`/`des` `presOf` at all, so the caller falls back to the
 * blind order-based mapping. A slot reached through its OWN COMPOUND
 * `forEachOrigin` (`hexagon-radial`'s `Child1..6`, each independently bound
 * to "top-level point 1's Nth child" - see
 * `smartart-layout-interpreter-composite-foreach.ts`) is resolved separately,
 * once, appended after the ordinal-matched points.
 */
function arrangeByPresentationOf(
	slotted: SlottedDims[],
	allChildren: PptxSmartArtLayoutNode[],
	nodes: PptxSmartArtNode[],
	flat: PptxSmartArtNode[],
	box: BoundingBox,
	absX: number,
	absY: number,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	ctx: SlotStyleContext,
): RenderedNode[] | undefined {
	const selfSlots = slotsWithAxis(slotted, 'self');
	if (selfSlots.length === 0) {
		return undefined;
	}
	const desSlots = slotsWithAxis(slotted, 'des');
	const childRepeaterSlots = slotted.filter((slot) => !slot.node.presentationOf);
	const count = Math.min(selfSlots.length, nodes.length);
	const rendered: RenderedNode[] = [];
	for (let i = 0; i < count; i++) {
		const node = nodes[i];
		const selfRect = slotRect(selfSlots[i], box, absX, absY);
		const desSlotted = desSlots[i];
		let desSlot = desSlotted
			? {
					rect: slotRect(desSlotted, box, absX, absY),
					content: smartArtDescendantsWithText(node, childrenOf),
				}
			: undefined;
		if (!desSlot && findRingDesSibling(allChildren, selfSlots[i].node)) {
			const content = smartArtDescendantsWithText(node, childrenOf);
			if (content.length > 0) {
				desSlot = { rect: ringFoldRect(selfRect), content };
			}
		}
		rendered.push(...renderAnchoredPair(node, i, count, selfRect, desSlot, ctx));
		for (const wrapperSlot of childRepeaterSlots) {
			rendered.push(
				...renderChildRepeaterSlot(wrapperSlot, node, i, box, absX, absY, childrenOf, ctx),
			);
		}
	}
	rendered.push(
		...renderForEachBoundSlots(
			forEachBoundSlots(slotted),
			flat,
			box,
			absX,
			absY,
			childrenOf,
			ctx,
			count,
		),
	);
	return rendered;
}

/** Pre-existing behaviour: one arranged point per positioned slot, in document order. */
function arrangeByOrder(
	slotted: SlottedDims[],
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	absX: number,
	absY: number,
	ctx: SlotStyleContext,
): RenderedNode[] {
	const count = Math.min(slotted.length, nodes.length);
	const rendered: RenderedNode[] = [];
	for (let i = 0; i < count; i++) {
		const slot = slotRect(slotted[i], box, absX, absY);
		rendered.push(
			rectNode({
				key: `${ctx.elementId}-comp-${nodes[i].id}-${i}`,
				x: slot.x,
				y: slot.y,
				width: slot.width,
				height: slot.height,
				node: nodes[i],
				index: i,
				total: count,
				palette: ctx.palette,
				style: ctx.style,
				ctx: ctx.ctx,
			}),
		);
	}
	return rendered;
}

/**
 * Execute the `composite` algorithm: map data points into the fixed child slots.
 *
 * Returns `undefined` when the composite has no child that positions itself, so
 * the caller can fall back to its legacy family approximation.
 *
 * @param nodes The arranged top-level points (see the module doc comment for
 *   how `self`/`des` slots consume them).
 * @param childrenOf Full data-model parent/child map (`smartArtChildrenOf`),
 *   for folding a `des`-axis slot's content. Omit (defaults to empty) when
 *   the caller has no tree to offer - `des` slots then simply render empty.
 * @param flat The diagram's full flat (depth-first) node list, for a
 *   `dgm:choose`-guarded composite with no `self`-axis slot anywhere (see
 *   {@link arrangeByChooseAwareSlots}). Omit (defaults to `nodes`) when the
 *   caller has no fuller list to offer - a composite that never needs
 *   root-relative resolution is unaffected either way.
 */
export function arrangeComposite(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
	childrenOf: Map<string, PptxSmartArtNode[]> = new Map(),
	flat: PptxSmartArtNode[] = nodes,
): SmartArtLayoutResult | undefined {
	const children = plan.node.children;
	if (!children || children.length === 0 || nodes.length === 0) {
		return undefined;
	}
	const declaringRole = roleOf(plan.node);
	const slotted = readSlots(children, box, index, declaringRole);
	if (slotted.length === 0) {
		return undefined;
	}

	// Normalise any absolute (EMU-ish) values so the widest slot fits the box.
	const absMaxX = axisAbsMax(slotted, 'l', 'ctrX', 'w');
	const absMaxY = axisAbsMax(slotted, 't', 'ctrY', 'h');
	const absX = absMaxX > 0 ? box.width / absMaxX : 1;
	const absY = absMaxY > 0 ? box.height / absMaxY : 1;

	const ctx: SlotStyleContext = { ctx: styleContext(style), palette, style, elementId };
	const renderedNodes =
		arrangeByPresentationOf(slotted, children, nodes, flat, box, absX, absY, childrenOf, ctx) ??
		arrangeByChooseAwareSlots(plan.node, flat, box, index, ctx) ??
		arrangeByOrder(slotted, nodes, box, absX, absY, ctx);

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.ctx.shadow,
		viewBox: `0 0 ${box.width} ${box.height}`,
		family: 'list',
	};
}
