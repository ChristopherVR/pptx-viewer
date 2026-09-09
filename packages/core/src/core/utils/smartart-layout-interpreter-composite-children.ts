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
import { positionRange } from './smartart-layout-interpreter-axis-range';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { resolveSlot } from './smartart-layout-interpreter-composite-slots';
import { rectNode } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, RenderedRectNode } from './smartart-layout-types';
import { smartArtDescendantsWithText } from './smartart-node-tree-axis';

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
 */
function collectChildRepeaterItems(
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

/**
 * Render a bare-`presOf` wrapper slot as a repeated per-child list against
 * `anchor`'s own children (see {@link collectChildRepeaterItems}), splitting
 * the wrapper's own resolved rect into equal columns in child order. Returns
 * `[]` when the wrapper resolves no items (nothing to render).
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
): RenderedNode[] {
	const anchorChildren = childrenOf.get(anchor.id) ?? [];
	const items = collectChildRepeaterItems(wrapperSlot.node, anchorChildren);
	if (items.length === 0) {
		return [];
	}
	const rect = resolveSlot(wrapperSlot.dims, box, absX, absY);
	const columnWidth = rect.width / items.length;
	return items.map((item, i) => {
		const folded = item.fold ? smartArtDescendantsWithText(item.child, childrenOf) : [];
		const rendered: RenderedRectNode = {
			...rectNode({
				key: `${ctx.elementId}-comp-child-${item.child.id}-${anchorIndex}-${i}`,
				x: rect.x + columnWidth * i,
				y: rect.y,
				width: columnWidth,
				height: rect.height,
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
