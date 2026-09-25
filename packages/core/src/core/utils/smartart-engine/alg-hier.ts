/**
 * `hierRoot`/`hierChild` algorithms (ECMA-376 Part 1, 21.4.2.6/21.4.2.7):
 * the org-chart/hierarchy family.
 *
 * A gallery layoutDef hand-unrolls the recursion per generation: an outer
 * `hierChild1` fans the top-level points, one `hierRoot1` per point; each
 * `hierRoot` holds its own node (a `composite`) and, as direct children,
 * `hierChild` rows continuing the tree one generation deeper (org charts add
 * a second row for assistants). Every generation runs the same algorithm
 * whatever its literal name.
 *
 * PowerPoint lays the whole tree out ONCE, bottom-up, in the definition's
 * own unscaled space (`hier-measure.ts`), then scales it uniformly to fit
 * the frame and centres what is drawn: the outermost hierarchy node places
 * every hierarchy node below it in one pass, and the nested `hierRoot`/
 * `hierChild` calls the layout driver makes afterwards keep those boxes.
 * Measured on the gallery's cached "Hierarchy" and "Organization Chart"
 * drawings (three generations exactly filling the 400pt frame height, the
 * top node centred over its children's row, the drawing centred on its own
 * extent including a hanging column's overhang).
 */

import type { Box, EngineNode } from './engine-node';
import { measureHierChild, measureHierRoot } from './hier-measure';
import type { HierShape } from './hier-shape';
import { boundsOf } from './hier-shape';

const HIER_ALGS = new Set(['hierRoot', 'hierChild']);

/** True when an ancestor is itself a hierarchy node (so it already placed `node`'s subtree). */
function hasHierAncestor(node: EngineNode): boolean {
	for (let anc = node.parent; anc; anc = anc.parent) {
		if (HIER_ALGS.has(anc.alg.type)) {
			return true;
		}
	}
	return false;
}

/** Give every hierarchy container below `node` the bounds of what it contains. */
function fitContainers(node: EngineNode): Box | undefined {
	const boxes: Box[] = [];
	for (const child of node.children) {
		const inner = HIER_ALGS.has(child.alg.type) ? fitContainers(child) : child.box;
		if (inner && inner.w > 0 && inner.h > 0) {
			boxes.push(inner);
		}
	}
	if (boxes.length === 0) {
		return undefined;
	}
	const bounds = boundsOf(boxes);
	if (HIER_ALGS.has(node.alg.type) && hasHierAncestor(node)) {
		node.box = bounds;
	}
	return bounds;
}

/** Scale `shape` uniformly into `node`'s box, centred on what it draws, and assign every box. */
function placeScaled(node: EngineNode, shape: HierShape): void {
	const box = node.box;
	const bounds = boundsOf(shape.rects);
	if (!box || !(bounds.w > 0) || !(bounds.h > 0)) {
		return;
	}
	const scale = Math.min(box.w / bounds.w, box.h / bounds.h);
	const ox = box.x + (box.w - bounds.w * scale) / 2 - bounds.x * scale;
	const oy = box.y + (box.h - bounds.h * scale) / 2 - bounds.y * scale;
	for (const r of shape.rects) {
		r.node.box = { x: ox + r.x * scale, y: oy + r.y * scale, w: r.w * scale, h: r.h * scale };
	}
	fitContainers(node);
}

/**
 * Whether `node` is an org-chart assistant's hierarchy item. Assistants sit
 * beside their manager's connector, above the reports, with their own
 * spacing (`smartart-orgchart-hierbranch.pptx`: the assistant starts `0.1 W`
 * right of the manager's centre, one `sp` below it, and the reports drop a
 * further `h + 2 sp`), which this port does not model yet, so a diagram with
 * one is left to the legacy interpreter (see `engine-to-result.ts`).
 */
export function isAssistantItem(node: EngineNode): boolean {
	return node.alg.type === 'hierRoot' && node.point.type === 'asst';
}

export function arrangeHierChild(node: EngineNode): void {
	if (!hasHierAncestor(node)) {
		placeScaled(node, measureHierChild(node));
	}
}

export function arrangeHierRoot(node: EngineNode): void {
	if (!hasHierAncestor(node)) {
		placeScaled(node, measureHierRoot(node));
	}
}
