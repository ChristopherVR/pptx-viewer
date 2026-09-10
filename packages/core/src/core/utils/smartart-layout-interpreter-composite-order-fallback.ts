/**
 * SmartArt DiagramML interpreter - order-based composite slot fallback.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` (the repo's
 * per-file line budget): {@link arrangeByOrder} is the LAST-resort mapping
 * `arrangeComposite` falls back to when no slot carries a `dgm:presOf` at
 * all - pre-existing behaviour: one arranged point per positioned slot, in
 * document order. Pure geometry; no framework code.
 */

import type { PptxSmartArtNode } from '../types';
import type { FontFitContext } from './smartart-layout-interpreter-composite-fontfit';
import { resolveSharedFontFit } from './smartart-layout-interpreter-composite-fontfit';
import { representativeSlotsPerPoint } from './smartart-layout-interpreter-composite-order';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite-render';
import { resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { Slot, SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { findCompositeItemShape } from './smartart-layout-shape-preset';
import type { BoundingBox, RenderedNode } from './smartart-layout-types';

function slotRect(slot: SlottedDims, box: BoundingBox, absX: number, absY: number): Slot {
	return resolveSlot(slot.dims, box, absX, absY);
}

/**
 * Pre-existing behaviour: one arranged point per positioned slot, in
 * document order. `representativeSlotsPerPoint` (round 40) collapses a
 * repeated per-point template's multiple positioned roles (text + accent +
 * picture + picture-accent, `hexagon-cluster`-family composites) down to one
 * slot per point FIRST, so this still zips 1:1 against `nodes` - see that
 * function's own doc comment.
 */
export function arrangeByOrder(
	slotted: SlottedDims[],
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	absX: number,
	absY: number,
	ctx: SlotStyleContext,
	fontCtx: FontFitContext | undefined,
): RenderedNode[] {
	const perPoint = representativeSlotsPerPoint(slotted, nodes.length);
	const count = Math.min(perPoint.length, nodes.length);
	const slots = perPoint.slice(0, count).map((entry) => slotRect(entry, box, absX, absY));
	const fontFit = fontCtx
		? resolveSharedFontFit(
				fontCtx,
				perPoint[0]?.node,
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
			presetBoxNode({
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
				shape: findCompositeItemShape(perPoint[i].node),
				fallbackKind: 'rect',
			}),
		);
	}
	return rendered;
}
