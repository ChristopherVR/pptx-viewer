/**
 * SmartArt DiagramML interpreter - composite child-repeater slot expansion.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` to keep that file
 * under the repo's per-file line budget: this half handles a bare-`presOf`
 * composite slot (`Table List`'s `pillars`) whose own item TEMPLATE(s)
 * address the anchor point's own CHILDREN rather than a `self`/`des` fold of
 * the anchor itself, e.g. `pillar1`'s compound `presOf axis="ch desOrSelf"
 * st="1 1" cnt="1 0"` (child #1, folding its own descendants) paired with a
 * forEach-nested `pillarX` (`axis="desOrSelf"`, reached through a
 * `dgm:forEach axis="ch" st="2"`: every remaining child, one box per
 * position). Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { positionRange } from './smartart-layout-interpreter-axis-range';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite';
import { isUserSizeHubRole } from './smartart-layout-interpreter-composite-aspect';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { resolveSlot } from './smartart-layout-interpreter-composite-slots';
import { findConstraint } from './smartart-layout-interpreter-constraints';
import { resolveHubToNodeRatioViaUserSize } from './smartart-layout-interpreter-cycle-hub-ratio-usersize';
import { rectNode } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, RenderedRectNode } from './smartart-layout-types';
import { smartArtDescendantsWithText } from './smartart-node-tree-axis';

/** A uniform absolute pixel size every item from one repeater template takes. */
export interface RepeaterItemSize {
	width: number;
	height: number;
}

/** `h` declared as the EXACT `refType="w"` self-reference with no `factor`/
 * cross-role `refForName` - a square item, side length = the resolved `w`. */
function isSquareHeightConstraint(constraints: PptxSmartArtLayoutNode['constraints']): boolean {
	const h = findConstraint(constraints, 'h');
	return (
		h?.referenceType === 'w' &&
		h.factor === undefined &&
		h.value === undefined &&
		h.referenceForName === undefined
	);
}

/**
 * Round 45: when `wrapper`'s own item template declares a bare `userS` `w`
 * size reference (`radial-cluster--hier5.pptx`'s `childCenter1`/`text1`,
 * `childCenter3`/`text3`, `childCenter2`/`text2` - identical shape across
 * `cycle_1`/`cycle_2`/`cycle_3`, the SAME construct `resolveHubToNodeRatioViaUserSize`
 * already resolves for a NESTED ring's hub/satellite ratio, see
 * `smartart-layout-interpreter-cycle-hub-ratio-usersize.ts`), resolve the
 * UNIFORM absolute pixel size every rendered item from that template takes,
 * instead of `renderChildRepeaterSlot`'s pre-existing stretch-to-column
 * sizing. This is what lets a childless satellite - never routed through
 * `arrangeNestedCycleSlot`'s nested-cycle dispatch, since that requires the
 * resolved item to have children of its own - still honour the SAME
 * diagram-wide `userS` fact a nested satellite already does.
 *
 * Deliberately conservative: only applies when the template's own `h`
 * constraint is the exact "square" shape observed in every fixture examined
 * ({@link isSquareHeightConstraint}); any other shape leaves the caller's
 * existing stretch-to-column sizing unchanged (`undefined`).
 */
export function resolveUserSizeItemBoxPx(
	wrapper: PptxSmartArtLayoutNode,
	index: ConstraintIndex,
	box: BoundingBox,
	sizeBox: BoundingBox,
	declaringRoleChain: readonly string[],
): RepeaterItemSize | undefined {
	for (const template of wrapper.children ?? []) {
		if (!isSquareHeightConstraint(template.constraints)) {
			continue;
		}
		const ratio = resolveHubToNodeRatioViaUserSize(
			template,
			wrapper.constraints,
			index,
			declaringRoleChain,
		);
		if (!ratio) {
			continue;
		}
		const hubRatio = resolveConstraint(index, ratio.hubName, 'w');
		if (hubRatio === undefined) {
			continue;
		}
		const hubExtent = isUserSizeHubRole(ratio.hubName, index) ? sizeBox.width : box.width;
		const side = ratio.factor * hubRatio * hubExtent;
		if (side > 0) {
			return { width: side, height: side };
		}
	}
	return undefined;
}

/**
 * A bare-`presOf` composite slot's item TEMPLATE (`Table List`'s `pillar1`/
 * `pillarX`) addresses the anchor point's own CHILDREN, not the top-level
 * point stream: either directly, via a compound `presOf` carrying a `ch`
 * token of its own (`pillar1`'s `axis="ch desOrSelf" st="1 1" cnt="1 0"` -
 * child #1, folding its own descendants), or - when its `presOf` is a bare
 * `des`/`desOrSelf`/`self` fold with no positional token of its own
 * (`pillarX`'s `axis="desOrSelf"`) - via the enclosing `dgm:forEach`'s OWN
 * `ch`-axis iterator that produced it (`forEachOrigin`, `st="2"`: every
 * remaining child from #2 onward, one box per position). Returns `undefined`
 * when neither carries a `ch`-axis position to resolve (a purely decorative
 * child, or a real top-level `self`/`des` slot already handled elsewhere).
 */
function childAxisSpec(
	template: PptxSmartArtLayoutNode,
	childCount: number,
): { positions: number[]; fold: boolean } | undefined {
	const axis = template.presentationOf?.axis;
	if (!axis || axis.length === 0) {
		return undefined;
	}
	const fold = axis.includes('des') || axis.includes('desOrSelf');
	const ownIndex = axis.indexOf('ch');
	if (ownIndex >= 0) {
		const start = template.presentationOf?.start?.[ownIndex] ?? 1;
		const count = template.presentationOf?.count?.[ownIndex];
		return { positions: positionRange(start, count, 1, childCount), fold };
	}
	const origin = template.forEachOrigin;
	const originIndex = origin?.axis?.indexOf('ch') ?? -1;
	if (origin && originIndex >= 0) {
		const start = origin.start?.[originIndex] ?? 1;
		const count = origin.count?.[originIndex];
		const step = origin.step?.[originIndex] ?? 1;
		return { positions: positionRange(start, count, step, childCount), fold };
	}
	return undefined;
}

/** One resolved child-repeater box: which anchor-child it renders, and
 * whether that child's own descendants fold into its text. */
interface ChildRepeaterItem {
	child: PptxSmartArtNode;
	position: number;
	fold: boolean;
}

/**
 * Every box a bare-`presOf` wrapper slot (`Table List`'s `pillars`) produces
 * for `anchor`'s own children, across ALL of the wrapper's item templates
 * (`pillar1` AND `pillarX`), sorted into child order. Empty when the wrapper
 * has no such template (a purely decorative slot, e.g. `base`).
 *
 * Exported (ROUND 42) for `smartart-layout-interpreter-composite-nested-
 * cycle.ts`'s `resolveNestedCycleAnchor`, which reuses this exact resolution
 * to detect a genuine 2-level nested hub-and-satellite ring
 * (`radial-cluster--hier5.pptx`'s `cycle_3`) rather than a flat per-child
 * repeat.
 */
export function collectChildRepeaterItems(
	wrapper: PptxSmartArtLayoutNode,
	anchorChildren: PptxSmartArtNode[],
): ChildRepeaterItem[] {
	const items: ChildRepeaterItem[] = [];
	for (const template of wrapper.children ?? []) {
		const spec = childAxisSpec(template, anchorChildren.length);
		if (!spec) {
			continue;
		}
		for (const position of spec.positions) {
			const child = anchorChildren[position - 1];
			if (child) {
				items.push({ child, position, fold: spec.fold });
			}
		}
	}
	items.sort((a, b) => a.position - b.position);
	return items;
}

/** Ancestor context {@link resolveUserSizeItemBoxPx} needs, threaded down from
 * `arrangeComposite` (round 45) - omit (the pre-existing default) for a
 * caller with no `ConstraintIndex`/ancestor chain to offer, e.g. a unit test
 * exercising the plain stretch-to-column path. */
export interface RepeaterSizingContext {
	index: ConstraintIndex;
	sizeBox: BoundingBox;
	declaringRoleChain: readonly string[];
}

/**
 * Render a bare-`presOf` wrapper slot as a repeated per-child list against
 * `anchor`'s own children (see {@link collectChildRepeaterItems}), splitting
 * the wrapper's own resolved rect into equal columns in child order. Each
 * item stretches to fill its own column UNLESS {@link resolveUserSizeItemBoxPx}
 * resolves a `userS`-declared uniform size for the wrapper's own item
 * template (round 45) - then the item takes that fixed size instead, centred
 * within its column (clamped to the column/rect extent so it never overlaps
 * a sibling). Returns `[]` when the wrapper resolves no items (nothing to
 * render).
 */
export function renderChildRepeaterSlot(
	wrapperSlot: SlottedDims,
	anchor: PptxSmartArtNode,
	anchorIndex: number,
	box: BoundingBox,
	absX: number,
	absY: number,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	ctx: SlotStyleContext,
	sizingCtx?: RepeaterSizingContext,
): RenderedNode[] {
	const anchorChildren = childrenOf.get(anchor.id) ?? [];
	const items = collectChildRepeaterItems(wrapperSlot.node, anchorChildren);
	if (items.length === 0) {
		return [];
	}
	const rect = resolveSlot(wrapperSlot.dims, box, absX, absY);
	const columnWidth = rect.width / items.length;
	const userSize = sizingCtx
		? resolveUserSizeItemBoxPx(
				wrapperSlot.node,
				sizingCtx.index,
				box,
				sizingCtx.sizeBox,
				sizingCtx.declaringRoleChain,
			)
		: undefined;
	return items.map((item, i) => {
		const folded = item.fold ? smartArtDescendantsWithText(item.child, childrenOf) : [];
		const columnX = rect.x + columnWidth * i;
		const width = userSize ? Math.min(userSize.width, columnWidth) : columnWidth;
		const height = userSize ? Math.min(userSize.height, rect.height) : rect.height;
		const x = userSize ? columnX + (columnWidth - width) / 2 : columnX;
		const y = userSize ? rect.y + (rect.height - height) / 2 : rect.y;
		const rendered: RenderedRectNode = {
			...rectNode({
				key: `${ctx.elementId}-comp-child-${item.child.id}-${anchorIndex}-${i}`,
				x,
				y,
				width,
				height,
				node: item.child,
				index: i,
				total: items.length,
				palette: ctx.palette,
				style: ctx.style,
				ctx: ctx.ctx,
			}),
			foldedNodeIds: folded.map((entry) => entry.id),
		};
		return rendered;
	});
}
