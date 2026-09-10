/**
 * SmartArt DiagramML interpreter - `self`+`des` pair rendering for the
 * `composite` arranger.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` (the repo's
 * per-file line budget).
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { SharedFontFit } from './smartart-layout-interpreter-composite-fontfit';
import type { Slot } from './smartart-layout-interpreter-composite-slots';
import type { StyleContext } from './smartart-layout-interpreter-render';
import { rectNode } from './smartart-layout-interpreter-render';
import type { RenderedNode, RenderedRectNode } from './smartart-layout-types';

/** Shared per-arranger style/palette context, threaded through every slot
 * renderer in this module's callers and in `smartart-layout-interpreter-
 * composite-children.ts`'s child-repeater expansion. */
export interface SlotStyleContext {
	ctx: StyleContext;
	palette: string[];
	style: SmartArtStyle;
	elementId: string;
}

/** One `self`-anchored slot plus, when present, its paired `des` fold. */
export function renderAnchoredPair(
	node: PptxSmartArtNode,
	index: number,
	total: number,
	selfSlot: Slot,
	desSlot: { rect: Slot; content: PptxSmartArtNode[] } | undefined,
	ctx: SlotStyleContext,
	fontFit: SharedFontFit | undefined,
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
			fontSizeOverride: fontFit?.rootSizePx,
			descendantFontSize: fontFit?.descendantSizePx,
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
				fontSizeOverride: fontFit?.rootSizePx,
				descendantFontSize: fontFit?.descendantSizePx,
			}),
			foldedNodeIds: desSlot.content.slice(1).map((entry) => entry.id),
		};
		out.push(rendered);
	}
	return out;
}
