/**
 * SmartArt DiagramML interpreter - "standard" hierarchy branch row placers.
 *
 * Split out of `smartart-hierarchy-standard.ts` (the file-size budget): the
 * assistant-row and flat (unwrapped) sibling-row placers, both leaf helpers
 * with no recursive fan/hang decision of their own - `placeAt` (that module)
 * calls back into `placeAt` itself for each child placed here via the
 * `placeChild` callback, avoiding an import cycle.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { TreeNode } from './smartart-helpers';
import { effectiveWidth } from './smartart-hierarchy-orgchart-tree';
import { elbowConnector, pushNode, stubConnector } from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';
import type { StandardOptions } from './smartart-hierarchy-standard-options';

const ASSISTANT_GAP = 4;

/** Render a manager's assistant row directly beneath it (`orgChart` mode). */
export function placeAssistantRow(
	hc: HierContext,
	parentId: string,
	cx: number,
	cy: number,
	assistants: TreeNode[],
): void {
	if (assistants.length === 0) {
		return;
	}
	const assistW = hc.boxW * 0.55;
	const assistH = hc.boxH * 0.7;
	const totalW = assistants.length * assistW + (assistants.length - 1) * ASSISTANT_GAP;
	const rowY = cy + hc.boxH / 2 + ASSISTANT_GAP;
	let x = cx - totalW / 2;
	for (const assistant of assistants) {
		pushNode(hc, assistant.node, x, rowY, assistW, assistH);
		stubConnector(hc, parentId, cx, cy + hc.boxH / 2, x + assistW / 2, rowY);
		x += assistW + ASSISTANT_GAP;
	}
}

/** One child placement, as `placeAt` itself implements (passed in to avoid an import cycle). */
export type PlaceChild = (
	hc: HierContext,
	t: TreeNode,
	cx: number,
	cy: number,
	xOffset: number,
	spanW: number,
	level: number,
	cellW: number,
	cellH: number,
	options: StandardOptions,
	siblingCxs?: number[],
) => void;

/** Place one generation's ordinary children in a single row (no wrapping). */
export function placeFlatChildren(
	hc: HierContext,
	parentId: string,
	normal: TreeNode[],
	cx: number,
	cy: number,
	xOffset: number,
	level: number,
	cellW: number,
	cellH: number,
	options: StandardOptions,
	placeChild: PlaceChild,
): void {
	// Precomputed up front (not just incrementally in the loop below) so every
	// child in this row can be handed the FULL sibling column list: see
	// `planFan`'s doc comment on why a "chPref-reached" grandchild needs its
	// own generation's complete x-center array, not just its own position.
	const siblingCxs: number[] = [];
	{
		let offset = xOffset;
		for (const child of normal) {
			const childW = effectiveWidth(child, options.orgChart);
			siblingCxs.push((offset + childW / 2) * cellW);
			offset += childW;
		}
	}
	let childOffset = xOffset;
	for (const child of normal) {
		const childW = effectiveWidth(child, options.orgChart);
		const childCx = (childOffset + childW / 2) * cellW;
		const childCy = (level + 1) * cellH + cellH / 2;
		elbowConnector(
			hc,
			parentId,
			cx,
			cy + hc.boxH / 2,
			childCx,
			childCy - hc.boxH / 2,
			child.node.id,
		);
		placeChild(
			hc,
			child,
			childCx,
			childCy,
			childOffset,
			childW,
			level + 1,
			cellW,
			cellH,
			options,
			siblingCxs,
		);
		childOffset += childW;
	}
}
