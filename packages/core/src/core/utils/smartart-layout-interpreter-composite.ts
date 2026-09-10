/**
 * SmartArt DiagramML interpreter - composite (`composite`) arranger.
 *
 * The `composite` algorithm does not flow points; it positions each child
 * `layoutNode` at an explicit offset given by its `dgm:constr`
 * (`l`/`t`/`w`/`h`/`ctrX`/`ctrY`, usually a `fact` of the parent w/h, either
 * self-declared or - the more common real-built-in shape (`gear`, `balance`,
 * `stacked-venn`) - declared BY the composite via `for="ch" forName="<slot>"`,
 * resolved in `smartart-layout-interpreter-composite-slots.ts`). This is how
 * many built-ins place a fixed set of slots - a title beside a body, a shape
 * over its picture, an accent plus a caption, gear teeth around a hub.
 *
 * Data-point mapping is `dgm:presOf`-aware (see `PptxSmartArtLayoutNode.
 * presentationOf`'s doc comment): a `self`-axis slot (`gear1`, `gear2`, ...,
 * or `balance`'s two pans) anchors ONE arranged point, in document order; a
 * `des`-axis slot (`gear1ch`) pairs with the SAME ordinal `self` slot's own
 * descendants (folded, as `smartart-layout-interpreter-item-roles.ts` does
 * for a per-item role), NOT the next point. A slot with neither is purely
 * decorative and renders nothing. No `presOf` on ANY slot falls back to the
 * pre-existing blind "one point per positioned slot, in document order".
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
import type { FontFitContext } from './smartart-layout-interpreter-composite-fontfit';
import {
	resolveFontFitFromPairs,
	resolveSharedFontFit,
} from './smartart-layout-interpreter-composite-fontfit';
import {
	forEachBoundSlots,
	renderForEachBoundSlots,
} from './smartart-layout-interpreter-composite-foreach';
import { collectSelfDesPairs } from './smartart-layout-interpreter-composite-pairs';
import { renderAnchoredPair } from './smartart-layout-interpreter-composite-render';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite-render';
import { axisAbsMax, readSlots, resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { Slot, SlottedDims } from './smartart-layout-interpreter-composite-slots';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

export type { SlotStyleContext } from './smartart-layout-interpreter-composite-render';

/** `slotted` entries whose layoutNode's own `presOf` primary axis is `axis`. */
function slotsWithAxis(slotted: SlottedDims[], axis: string): SlottedDims[] {
	return slotted.filter((slot) => slot.node.presentationOf?.axis?.[0] === axis);
}

function slotRect(slot: SlottedDims, box: BoundingBox, absX: number, absY: number): Slot {
	return resolveSlot(slot.dims, box, absX, absY);
}

/**
 * `dgm:presOf`-aware mapping: `self` slots anchor arranged points in order,
 * a `des` slot pairs with the SAME ordinal `self` slot's own descendants
 * (positioned, or an UNPOSITIONED same-ring `des` sibling folded into the
 * self rect - see `smartart-layout-interpreter-composite-pairs.ts`'s
 * `collectSelfDesPairs`), and any BARE-`presOf` sibling wrapper slot
 * resolves child-repeater items against the SAME ordinal anchor (`Table
 * List`'s `pillars`, {@link renderChildRepeaterSlot}). `undefined` when no
 * slot carries a `self`/`des` `presOf` at all (caller falls back to
 * order-based mapping). A slot reached through its OWN COMPOUND
 * `forEachOrigin` (`hexagon-radial`'s `Child1..6`, each bound to "point 1's
 * Nth child" - `smartart-layout-interpreter-composite-foreach.ts`) is
 * resolved separately, appended after the ordinal-matched points.
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
	fontCtx: FontFitContext | undefined,
): RenderedNode[] | undefined {
	const selfSlots = slotsWithAxis(slotted, 'self');
	if (selfSlots.length === 0) {
		return undefined;
	}
	const desSlots = slotsWithAxis(slotted, 'des');
	const childRepeaterSlots = slotted.filter((slot) => !slot.node.presentationOf);
	const count = Math.min(selfSlots.length, nodes.length);
	// Two passes (round 18): resolve every self/des pair up front so the
	// SHARED font-fit (`resolveSharedFontFit`) can see every item's box and
	// descendant text before any rendering happens - was previously a single
	// pass with no font-fit at all (every item fell through `rectNode`'s
	// crude, un-derived `fitFontSize` fallback).
	const pairs = collectSelfDesPairs(
		selfSlots,
		desSlots,
		allChildren,
		nodes,
		box,
		absX,
		absY,
		childrenOf,
		count,
	);
	const fontFit = resolveFontFitFromPairs(fontCtx, selfSlots[0]?.node, pairs);
	const rendered: RenderedNode[] = [];
	for (let i = 0; i < count; i++) {
		const { node, selfRect, desSlot } = pairs[i];
		rendered.push(...renderAnchoredPair(node, i, count, selfRect, desSlot, ctx, fontFit));
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
	fontCtx: FontFitContext | undefined,
): RenderedNode[] {
	const count = Math.min(slotted.length, nodes.length);
	const slots = slotted.slice(0, count).map((entry) => slotRect(entry, box, absX, absY));
	const fontFit = fontCtx
		? resolveSharedFontFit(
				fontCtx,
				slotted[0]?.node,
				slots.map((slot, i) => ({
					rootText: nodes[i].text,
					descendantTexts: [],
					width: slot.width,
					height: slot.height,
				})),
			)
		: undefined;
	const rendered: RenderedNode[] = [];
	for (let i = 0; i < count; i++) {
		const slot = slots[i];
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
				fontSizeOverride: fontFit?.rootSizePx,
				descendantFontSize: fontFit?.descendantSizePx,
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
	fontName?: string,
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
	const fontCtx: FontFitContext = { plan, index, fontName };
	const renderedNodes =
		arrangeByPresentationOf(
			slotted,
			children,
			nodes,
			flat,
			box,
			absX,
			absY,
			childrenOf,
			ctx,
			fontCtx,
		) ??
		arrangeByChooseAwareSlots(plan.node, flat, box, index, ctx) ??
		arrangeByOrder(slotted, nodes, box, absX, absY, ctx, fontCtx);

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.ctx.shadow,
		viewBox: `0 0 ${box.width} ${box.height}`,
		family: 'list',
	};
}
