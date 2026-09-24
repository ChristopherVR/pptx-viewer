/**
 * `hierRoot`/`hierChild` algorithms (ECMA-376 Part 1, 21.4.2.6/21.4.2.7): the
 * org-chart/hierarchy family. A real gallery layoutDef hand-unrolls this PER
 * GENERATION rather than declaring one genuinely recursive pair: an outer
 * `hierChild1` fans the data model's own top-level points, one `hierRoot1`
 * instance per point; each `hierRoot1` instance in turn nests a `composite`
 * content box AND (a DIRECT CHILD of `hierRoot1` itself, not a sibling of
 * it) a `hierChild2` continuation arranging THAT SAME point's own children
 * one generation deeper. `hierChild2`'s own `hierRoot2` items repeat the
 * same nesting for `hierChild3`, and so on to whatever depth the layoutDef
 * authored (real "Hierarchy" goes six deep). Every generation's `hierRoot`/
 * `hierChild` instance runs the SAME algorithm here regardless of its
 * literal name.
 *
 * Only the "std" (plain fanned row) case is ported: `hierBranch`
 * (`init`/`hang`/`l`/`r`, hanging a branch into a single vertical column
 * instead of fanning it), `chMax`/`chPref` (wrapping an oversized row into
 * side-by-side columns), and `orgChart` (a dedicated assistant slot beside
 * the manager) are all genuinely separate, per-item-role branches the
 * legacy family interpreter's own `smartart-hierarchy-*.ts` modules (~8800
 * lines together) implement after many rounds of COM verification; none of
 * that is attempted here. A dataset that would take one of those branches
 * still lays out - just as a plain fan, not necessarily matching PowerPoint.
 * `linDir="fromR"` (mirrored order for `dir="rev"`, an RTL diagram) is read
 * but not exercised by any fixture in the 229-fixture gallery corpus, so it
 * is not distinguished from `"fromL"` beyond the order flip below.
 *
 * ## One shared item size for the WHOLE tree, computed once at the top
 *
 * A real hierarchy layoutDef gives every generation's `composite`-alg item
 * box the exact SAME nominal `w`/`h` reference value (`composite`,
 * `composite2`, `composite3`, ... all pinned to `composite`'s own, itself
 * `1x` the OUTERMOST `hierChild`'s own box), and expects every rendered item
 * across the WHOLE diagram to render at the SAME final size, matching real
 * PowerPoint. Computing that per generation independently (each `hierChild`
 * call sizing only its OWN row from its OWN box) produces a DIFFERENT size
 * at every depth instead - correct order, wrong scale, and measurably worse
 * than the legacy interpreter's own single-pass, whole-tree
 * `fitItemBox`/`computeHierarchyAxisPitches`. This mirrors that shape
 * instead: the OUTERMOST `hierChild` call (detected by "no ancestor already
 * computed metrics for me") walks its own whole descendant tree once to
 * total leaf-weighted width units and generation depth, derives ONE item
 * width/height that fits both the box's width and height, and seeds it onto
 * every `hierChild`/`hierRoot` node in its own subtree (`sharedMetrics`)
 * before any of them are positioned; every nested call then finds its
 * metrics already seeded and reuses them verbatim.
 *
 * ## `hierChild` divides WIDTH only; `hierRoot` splits its own slot vertically
 *
 * `hierChild` gives each of its items a box spanning its OWN full available
 * HEIGHT (only width is divided among siblings): `hierRoot` then splits that
 * slot into the item's own box (the shared size above, top-aligned) and,
 * when it has a nested `hierChild` continuation, the remaining area below it
 * (full slot width, one generation gap down) for that continuation's own
 * row. `hierRoot`'s job is exactly this split, never `fillChildren` (a
 * naive `fillChildren` would give the continuation the SAME box as the
 * item, overlapping it instead of continuing the tree below it).
 */

import type { Box, EngineNode } from './engine-node';

/** `node`'s own direct `hierRoot`-alg children (its fanned items), in order. */
function collectItems(node: EngineNode): EngineNode[] {
	return node.children.filter((child) => child.alg.type === 'hierRoot');
}

/** `item`'s own nested `hierChild`-alg continuation (its children one generation deeper), if any. */
function continuationOf(item: EngineNode): EngineNode | undefined {
	return item.children.find((child) => child.alg.type === 'hierChild');
}

/** Depth-first search of `node`'s own subtree for a descendant using algorithm `type`. */
function findDescendantByAlg(node: EngineNode, type: string): EngineNode | undefined {
	for (const child of node.children) {
		if (child.alg.type === type) {
			return child;
		}
		const found = findDescendantByAlg(child, type);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/** The item template's own height/width aspect ratio (see the module doc comment). */
function itemAspectRatio(node: EngineNode): number {
	const composite = findDescendantByAlg(node, 'composite');
	const w = composite?.values.get('w');
	const h = composite?.values.get('h');
	return w && h && w > 0 ? h / w : 1;
}

/**
 * An item's own required width, in item-widths (`itemW == 1` unit): a leaf
 * item costs 1 unit; an item with its own fanned continuation costs the sum
 * of its children's own unit costs, plus one unit's worth of `sibSpRatio`
 * per internal gap - folding every nested gap into this single number so the
 * caller's one division by the row's own total accounts for gaps at every
 * depth, not just its own row.
 */
function itemUnits(item: EngineNode, sibSpRatio: number): number {
	const continuation = continuationOf(item);
	if (!continuation) {
		return 1;
	}
	const childItems = collectItems(continuation);
	if (childItems.length === 0) {
		return 1;
	}
	const sum = childItems.reduce((total, child) => total + itemUnits(child, sibSpRatio), 0);
	return Math.max(1, sum + sibSpRatio * (childItems.length - 1));
}

/** How many fanned generations deep `node`'s own subtree goes, `node`'s own row included. */
function generationDepth(node: EngineNode): number {
	let deepest = 0;
	for (const item of collectItems(node)) {
		const continuation = continuationOf(item);
		if (continuation) {
			deepest = Math.max(deepest, generationDepth(continuation));
		}
	}
	return 1 + deepest;
}

interface HierMetrics {
	itemW: number;
	itemH: number;
	/** Vertical gap between a generation and the row fanned below it. */
	genGap: number;
}

/**
 * `hierChild`/`hierRoot` node -> the ONE shared item size its whole subtree
 * uses (see the module doc comment). Scoped to a single engine run: every
 * run builds fresh `EngineNode`s (`toEngineTree`), so nothing here survives,
 * or needs to survive, past it.
 */
const sharedMetrics = new WeakMap<EngineNode, HierMetrics>();

/** Recursively seed `metrics` onto `node` and every `hierRoot`/`hierChild` descendant. */
function seedMetrics(node: EngineNode, metrics: HierMetrics): void {
	sharedMetrics.set(node, metrics);
	for (const item of collectItems(node)) {
		sharedMetrics.set(item, metrics);
		const continuation = continuationOf(item);
		if (continuation) {
			seedMetrics(continuation, metrics);
		}
	}
}

/** Compute (and seed) this tree's one shared item size, `node` being the OUTERMOST `hierChild`. */
function computeMetrics(node: EngineNode, box: Box): HierMetrics {
	const sibSp = Math.max(0, node.values.get('sibSp') ?? 0);
	const sibSpRatio = box.w > 0 ? sibSp / box.w : 0;
	const aspectRatio = itemAspectRatio(node);
	const items = collectItems(node);
	const units =
		items.reduce((sum, item) => sum + itemUnits(item, sibSpRatio), 0) +
		sibSpRatio * Math.max(0, items.length - 1);
	const itemWByWidth = units > 0 ? box.w / units : box.w;
	const referenceItem = items[0];
	// `sp` (the generation gap) is declared "for a descendant `hierRoot1`",
	// already resolved to an ABSOLUTE point value relative to THIS box (not a
	// fixed reference like `composite`'s own w/h) - read once and turned into
	// a dimensionless ratio of the reference item height so it rescales with
	// whatever the final `itemH` ends up being below.
	const referenceCompositeH = referenceItem
		? (findDescendantByAlg(referenceItem, 'composite')?.values.get('h') ?? 0)
		: 0;
	const sp = referenceItem?.values.get('sp') ?? 0;
	const genGapRatio = referenceCompositeH > 0 ? sp / referenceCompositeH : 0;
	const depth = generationDepth(node);
	const heightUnits = depth + genGapRatio * Math.max(0, depth - 1);
	const itemHByHeight = heightUnits > 0 ? box.h / heightUnits : box.h;
	const itemWByHeight = aspectRatio > 0 ? itemHByHeight / aspectRatio : itemWByWidth;
	const itemW = Math.min(itemWByWidth, itemWByHeight);
	const itemH = itemW * aspectRatio;
	return { itemW, itemH, genGap: genGapRatio * itemH };
}

export function arrangeHierChild(node: EngineNode): void {
	const box = node.box;
	const items = collectItems(node);
	if (!box || items.length === 0) {
		return;
	}
	const hadMetrics = sharedMetrics.has(node);
	const metrics = sharedMetrics.get(node) ?? computeMetrics(node, box);
	if (!hadMetrics) {
		seedMetrics(node, metrics);
	}
	const inverted = node.alg.params.linDir === 'fromR';
	const ordered = inverted ? [...items].reverse() : items;
	const sibSp = Math.max(0, node.values.get('sibSp') ?? 0);
	const sibSpRatio = box.w > 0 ? sibSp / box.w : 0;
	const units = ordered.map((item) => itemUnits(item, sibSpRatio));
	const rowW =
		units.reduce((sum, u) => sum + u, 0) * metrics.itemW + sibSp * Math.max(0, ordered.length - 1);
	let cursor = box.x + Math.max(0, (box.w - rowW) / 2);
	ordered.forEach((item, i) => {
		const slotW = units[i] * metrics.itemW;
		// Full available height: `arrangeHierRoot` splits it between the
		// item's own box and its continuation's row below.
		item.box = { x: cursor, y: box.y, w: slotW, h: box.h };
		cursor += slotW + sibSp;
	});
}

export function arrangeHierRoot(node: EngineNode): void {
	const box = node.box;
	if (!box) {
		return;
	}
	const metrics = sharedMetrics.get(node);
	const continuation = continuationOf(node);
	const others = node.children.filter((child) => child.alg.type !== 'hierChild');
	if (!metrics) {
		// Defensive fallback: `arrangeHierChild` always seeds a metrics entry
		// for every item it creates, so this only fires if `hierRoot` is
		// somehow reached without a `hierChild` ancestor (not exercised by any
		// fixture in the 229-fixture gallery corpus).
		for (const child of node.children) {
			child.box = { ...box };
		}
		return;
	}
	const itemW = Math.min(metrics.itemW, box.w);
	const itemH = Math.min(metrics.itemH, box.h);
	const itemBox: Box = { x: box.x + (box.w - itemW) / 2, y: box.y, w: itemW, h: itemH };
	for (const child of others) {
		child.box = { ...itemBox };
	}
	if (continuation) {
		const hasContent = collectItems(continuation).length > 0;
		continuation.box = hasContent
			? {
					x: box.x,
					y: box.y + itemH + metrics.genGap,
					w: box.w,
					h: Math.max(0, box.h - itemH - metrics.genGap),
				}
			: { x: box.x + box.w / 2, y: box.y + itemH, w: 0, h: 0 };
	}
}
