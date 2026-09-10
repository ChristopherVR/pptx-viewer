/**
 * SmartArt DiagramML interpreter - nested cycle (hub-and-satellite ring)
 * dispatch for a composite child-repeater slot.
 *
 * `radial-cluster--hier5.pptx`'s `cycle_3` is a bare-`presOf` child-repeater
 * slot (see `smartart-layout-interpreter-composite-children.ts`) whose own
 * `dgm:alg` (direct or choose-wrapped) is ITSELF a `cycle` - a genuine
 * 2-level nested hub-and-satellite ring, not a flat per-child repeat: its
 * own child `childCenter3` (`presOf axis="self"`) resolves to exactly ONE
 * anchor's child, which in turn has children of ITS OWN. Rather than
 * reimplementing ring/hub geometry, this recurses into the EXISTING
 * `arrangeCycle` arranger (`smartart-layout-interpreter-cycle.ts`): its
 * pre-existing `ctrShpMap="fNode"` hub-peeling already places one anchor at
 * the ring centre and its children around it - exactly the same mechanism a
 * genuine top-level hub-and-satellite diagram (`basic-radial`/
 * `diverging-radial`) already uses, just invoked one level deeper. Pure
 * geometry; no framework code.
 */

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { translateResult } from './smartart-hierarchy-pitch';
import { chooseAlgorithm, chooseAlgType } from './smartart-layout-interpreter-choose-algorithm';
import {
	collectChildRepeaterItems,
	renderChildRepeaterSlot,
} from './smartart-layout-interpreter-composite-children';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite-render';
import { resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { arrangeCycle } from './smartart-layout-interpreter-cycle';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { BoundingBox, RenderedNode } from './smartart-layout-types';

/**
 * `wrapper`'s own nested-cycle anchor: when it is a bare-`presOf`
 * child-repeater slot (see {@link collectChildRepeaterItems}) that resolves
 * to EXACTLY ONE item, AND that item's own data-model point has further
 * children of its own (`childrenOf`), that item is a genuine nested
 * hub-and-satellite anchor - `radial-cluster--hier5.pptx`'s `cycle_3`
 * resolving to "Four" (`anchor`'s 3rd child, "Node One"), itself the parent
 * of "Five". `undefined` for every other shape: no items resolved, 2+ items
 * (a flat per-child repeat, not a nested ring), or a childless single item
 * (nothing to ring-arrange around it).
 */
export function resolveNestedCycleAnchor(
	wrapper: PptxSmartArtLayoutNode,
	anchor: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): PptxSmartArtNode | undefined {
	const anchorChildren = childrenOf.get(anchor.id) ?? [];
	const items = collectChildRepeaterItems(wrapper, anchorChildren);
	if (items.length !== 1) {
		return undefined;
	}
	const resolved = items[0].child;
	return (childrenOf.get(resolved.id)?.length ?? 0) > 0 ? resolved : undefined;
}

/**
 * Render `wrapperSlot` as a nested cycle, or `undefined` when it is not one
 * (the caller falls back to `renderChildRepeaterSlot`'s flat per-child
 * repeat). `anchor` is the OUTER composite's own currently-arranged point
 * (`arrangeByPresentationOf`'s own loop variable) - both the point
 * `resolveNestedCycleAnchor` resolves `wrapper`'s own item against, AND the
 * `WhenContext.anchor` a `func="cnt"` condition in `wrapper`'s own
 * `dgm:choose` needs (`cycle_3`'s own `stAng`/`spanAng` choose counts
 * `anchor`'s OWN children, not the resolved nested anchor's).
 */
export function arrangeNestedCycleSlot(
	wrapperSlot: SlottedDims,
	anchor: PptxSmartArtNode,
	box: BoundingBox,
	absX: number,
	absY: number,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	nodeCount: number,
	flat: PptxSmartArtNode[],
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	index: ConstraintIndex,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	fontName: string | undefined,
): RenderedNode[] | undefined {
	const wrapper = wrapperSlot.node;
	const nestedAnchor = resolveNestedCycleAnchor(wrapper, anchor, childrenOf);
	if (!nestedAnchor) {
		return undefined;
	}
	const whenContext = { presLayoutVars, nodes: flat, anchor: [anchor] };
	const algType = wrapper.algorithm?.type ?? chooseAlgType(wrapper, nodeCount, whenContext);
	if (algType !== 'cycle') {
		return undefined;
	}
	const resolvedAlg = wrapper.algorithm ?? chooseAlgorithm(wrapper, nodeCount, whenContext);
	const arrangerNode = resolvedAlg ? { ...wrapper, algorithm: resolvedAlg } : wrapper;
	const points = [nestedAnchor, ...(childrenOf.get(nestedAnchor.id) ?? [])];
	const rect = resolveSlot(wrapperSlot.dims, box, absX, absY);
	const nestedBox: BoundingBox = { width: rect.width, height: rect.height };
	const plan: ArrangementPlan = { kind: 'cycle', node: arrangerNode };
	const result = arrangeCycle(
		plan,
		points,
		nestedBox,
		palette,
		style,
		elementId,
		index,
		false,
		childrenOf,
		fontName,
	);
	return translateResult(result, rect.x, rect.y).nodes;
}

/**
 * `arrangeNestedCycleSlot`, falling back to the plain flat per-child repeat
 * (`renderChildRepeaterSlot`) when `wrapperSlot` is not a nested cycle -
 * the one call `arrangeByPresentationOf`'s own childRepeaterSlots loop makes
 * per wrapper slot (`smartart-layout-interpreter-composite.ts`, split out
 * here for the file-size budget).
 */
export function renderChildRepeaterOrNestedCycle(
	wrapperSlot: SlottedDims,
	anchor: PptxSmartArtNode,
	anchorIndex: number,
	box: BoundingBox,
	absX: number,
	absY: number,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	flat: PptxSmartArtNode[],
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	index: ConstraintIndex,
	ctx: SlotStyleContext,
	fontName: string | undefined,
): RenderedNode[] {
	const nested = arrangeNestedCycleSlot(
		wrapperSlot,
		anchor,
		box,
		absX,
		absY,
		childrenOf,
		flat.length,
		flat,
		presLayoutVars,
		index,
		ctx.palette,
		ctx.style,
		ctx.elementId,
		fontName,
	);
	return (
		nested ??
		renderChildRepeaterSlot(wrapperSlot, anchor, anchorIndex, box, absX, absY, childrenOf, ctx)
	);
}
