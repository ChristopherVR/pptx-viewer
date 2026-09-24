/**
 * Unit coverage for `arrangeHierChild`/`arrangeHierRoot` (ECMA-376 Part 1,
 * 21.4.2.6/21.4.2.7): pure "std" fan placement, tested directly against
 * synthetic `EngineNode`s mirroring `alg-cycle.test.ts`'s/`alg-pyra.test.ts`'s
 * approach - a real layoutDef's own `hierRoot`/`composite` box constraints
 * are resolved by the generic constraint pipeline before either algorithm
 * runs, so a synthetic `composite`-alg child with `values.w`/`h` already set
 * stands in for that. `measure-smartart-engine-vs-legacy.ts` is the accuracy
 * gate against real PowerPoint output; this file locks in the fan/split math
 * itself.
 */

import { describe, expect, it } from 'vitest';

import { arrangeHierChild, arrangeHierRoot } from './alg-hier';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';

function child(point?: DataPoint, algType = 'sp'): EngineNode {
	return {
		name: 'item',
		point: point ?? { id: `p${Math.random()}`, type: 'node', children: [] },
		alg: { type: algType, params: {} },
		presOf: [],
		hasPresOf: false,
		constraints: [],
		rules: [],
		vars: {},
		children: [],
		order: 0,
		values: new Map(),
		minValues: new Map(),
		maxValues: new Map(),
		deferred: [],
		groups: [],
		rotation: 0,
	};
}

/** A `composite`-alg content box with its own reference `w`/`h` already resolved. */
function compositeChild(w: number, h: number): EngineNode {
	const composite = child(undefined, 'composite');
	composite.values.set('w', w);
	composite.values.set('h', h);
	return composite;
}

/** One `hierRoot` item: a `composite` content box, plus an optional nested continuation. */
function hierRootItem(
	compositeW: number,
	compositeH: number,
	sp = 0,
	point?: DataPoint,
): EngineNode {
	const root = child(point, 'hierRoot');
	const composite = compositeChild(compositeW, compositeH);
	root.children = [composite];
	root.values.set('sp', sp);
	return root;
}

/** A `hierChild` fanning `items`, given `sibSp` (absolute) horizontal spacing. */
function hierChildNode(
	items: EngineNode[],
	box = { x: 0, y: 0, w: 800, h: 400 },
	sibSp = 0,
): EngineNode {
	const node = child(undefined, 'hierChild');
	node.box = { ...box };
	node.children = items;
	node.values.set('sibSp', sibSp);
	return node;
}

describe('arrangeHierChild (leaf row, no continuations)', () => {
	it('divides the box width evenly among top-level items, sizing each from the reference composite aspect ratio', () => {
		const items = [hierRootItem(100, 50), hierRootItem(100, 50)];
		const node = hierChildNode(items, { x: 0, y: 0, w: 800, h: 400 });

		arrangeHierChild(node);

		// aspect ratio 0.5; width-only budget gives itemW = 800/2 = 400,
		// height-only budget (depth 1, no gen gap) gives itemW = 400/0.5 = 800;
		// the smaller (width) wins.
		expect(items[0].box).toStrictEqual({ x: 0, y: 0, w: 400, h: 400 });
		expect(items[1].box).toStrictEqual({ x: 400, y: 0, w: 400, h: 400 });
	});

	it('gives every item the SAME size regardless of position (uniform fan)', () => {
		const items = [hierRootItem(100, 50), hierRootItem(100, 50), hierRootItem(100, 50)];
		const node = hierChildNode(items, { x: 0, y: 0, w: 900, h: 400 });

		arrangeHierChild(node);

		const widths = items.map((i) => i.box!.w);
		expect(new Set(widths.map((w) => w.toFixed(6))).size).toBe(1);
	});

	it('folds sibSp into the width budget as a fractional item-width unit, then applies it as absolute spacing', () => {
		const items = [hierRootItem(100, 50), hierRootItem(100, 50)];
		const node = hierChildNode(items, { x: 0, y: 0, w: 1000, h: 1000 }, 40);

		arrangeHierChild(node);

		// sibSpRatio = 40/1000 = 0.04; width-only budget units = 2 + 0.04 = 2.04,
		// itemW = 1000/2.04 = 490.196...
		expect(items[0].box!.w).toBeCloseTo(1000 / 2.04, 6);
		expect(items[1].box!.w).toBeCloseTo(1000 / 2.04, 6);
		expect(items[1].box!.x).toBeCloseTo(items[0].box!.x + items[0].box!.w + 40, 6);
	});

	it('reverses fan order for linDir="fromR"', () => {
		const pointA: DataPoint = { id: 'a', type: 'node', children: [] };
		const pointB: DataPoint = { id: 'b', type: 'node', children: [] };
		const itemA = hierRootItem(100, 50, 0, pointA);
		const itemB = hierRootItem(100, 50, 0, pointB);
		const node = hierChildNode([itemA, itemB], { x: 0, y: 0, w: 800, h: 400 });
		node.alg.params.linDir = 'fromR';

		arrangeHierChild(node);

		expect(itemB.box!.x).toBeLessThan(itemA.box!.x);
	});

	it('is a no-op when the node has no box or no items', () => {
		const boxless = hierChildNode([hierRootItem(100, 50)]);
		boxless.box = undefined;
		expect(() => arrangeHierChild(boxless)).not.toThrow();

		const empty = hierChildNode([]);
		arrangeHierChild(empty);
		// Nothing to assign; no throw is the assertion.
	});
});

describe('arrangeHierChild (nested continuations)', () => {
	it("gives every generation's ITEM box the SAME size (shared metrics), even though each hierRoot's own SLOT differs", () => {
		const grandchild1 = hierRootItem(100, 50);
		const grandchild2 = hierRootItem(100, 50);
		const child1 = hierRootItem(100, 50, 20);
		child1.children.push(hierChildNode([grandchild1, grandchild2], { x: 0, y: 0, w: 0, h: 0 }));
		const root = hierChildNode([child1], { x: 0, y: 0, w: 800, h: 600 });

		arrangeHierChild(root);
		arrangeHierRoot(child1);
		const continuation = child1.children.find((c) => c.alg.type === 'hierChild')!;
		arrangeHierChild(continuation);
		arrangeHierRoot(grandchild1);
		arrangeHierRoot(grandchild2);

		// `hierRoot`'s own box is the whole SLOT (child1's is wide enough for
		// its own two-grandchild fan, so it is naturally larger than a leaf's);
		// the actual rendered ITEM box - `composite`, the child `hierRoot`
		// gives its own visual content - must be the SAME size at every
		// generation, the whole point of the shared-metrics mechanism (see the
		// module doc comment).
		const compositeOf = (item: EngineNode): EngineNode =>
			item.children.find((c) => c.alg.type === 'composite')!;
		const child1Composite = compositeOf(child1);
		const grand1Composite = compositeOf(grandchild1);
		const grand2Composite = compositeOf(grandchild2);
		expect(child1Composite.box!.w).toBeCloseTo(grand1Composite.box!.w, 6);
		expect(child1Composite.box!.h).toBeCloseTo(grand1Composite.box!.h, 6);
		expect(grand1Composite.box!.w).toBeCloseTo(grand2Composite.box!.w, 6);
		// And child1's own SLOT (its raw `.box`) really is wider than a leaf
		// grandchild's - confirming the two concepts (slot vs. item box)
		// actually differ in this fixture, not that both just happened to
		// match by coincidence.
		expect(child1.box!.w).toBeGreaterThan(grandchild1.box!.w);
	});

	it('leaf-weights a branch with multiple children wider than a childless sibling', () => {
		const busyGrandA = hierRootItem(100, 50);
		const busyGrandB = hierRootItem(100, 50);
		const busyChild = hierRootItem(100, 50, 10);
		busyChild.children.push(hierChildNode([busyGrandA, busyGrandB], { x: 0, y: 0, w: 0, h: 0 }));
		const quietChild = hierRootItem(100, 50);
		const root = hierChildNode([busyChild, quietChild], { x: 0, y: 0, w: 1200, h: 800 });

		arrangeHierChild(root);

		// The two-grandchild branch needs 2 item-widths (plus its own internal
		// gap); the childless sibling needs 1. So it gets roughly twice the
		// horizontal share.
		expect(busyChild.box!.w).toBeGreaterThan(quietChild.box!.w * 1.5);
	});
});

describe('arrangeHierRoot', () => {
	it('splits its own slot into the item box (top, shared size, centred) and the continuation row below it (full slot width)', () => {
		const grandA = hierRootItem(100, 50);
		const grandB = hierRootItem(100, 50);
		const item = hierRootItem(100, 50, 30);
		const continuation = hierChildNode([grandA, grandB], { x: 0, y: 0, w: 0, h: 0 });
		item.children.push(continuation);
		const root = hierChildNode([item], { x: 0, y: 0, w: 800, h: 900 });

		arrangeHierChild(root);
		arrangeHierRoot(item);

		// `item` is root's only slot, so its own `.box` is the WHOLE box;
		// `arrangeHierRoot` must have carved a SMALLER, horizontally centred
		// box out of it for the actual visual content (`composite`), not
		// handed the whole slot straight through. Width budget: units=2 (one
		// item whose own continuation needs 2 leaf-widths) -> itemW=800/2=400;
		// aspect 0.5 -> itemH=200; genGapRatio = sp(30)/compositeH(50) = 0.6 ->
		// genGap = 0.6*200 = 120.
		const composite = item.children.find((c) => c.alg.type === 'composite')!;
		expect(item.box).toStrictEqual({ x: 0, y: 0, w: 800, h: 900 });
		expect(composite.box).toStrictEqual({ x: 200, y: 0, w: 400, h: 200 });
		// The continuation sits below the composite plus the generation gap,
		// spanning the FULL slot width (not just the composite's, narrower,
		// width).
		expect(continuation.box).toStrictEqual({ x: 0, y: 320, w: 800, h: 580 });
	});

	it('gives a childless leaf continuation a zero-area box rather than overlapping the item', () => {
		const item = hierRootItem(100, 50);
		const emptyContinuation = hierChildNode([], { x: 0, y: 0, w: 0, h: 0 });
		item.children.push(emptyContinuation);
		const root = hierChildNode([item], { x: 0, y: 0, w: 800, h: 400 });

		arrangeHierChild(root);
		arrangeHierRoot(item);

		expect(emptyContinuation.box!.w).toBe(0);
		expect(emptyContinuation.box!.h).toBe(0);
	});
});
