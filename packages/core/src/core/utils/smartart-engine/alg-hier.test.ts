/**
 * Unit coverage for the `hierRoot`/`hierChild` pair (`alg-hier.ts`,
 * `hier-measure.ts`, `hier-hang.ts`) on synthetic engine trees: a
 * `composite`-alg child with `values.w`/`h` already resolved stands in for
 * a real layoutDef's item template. The accuracy gate against PowerPoint is
 * `scripts/measure-smartart-engine-vs-legacy.ts` over the gallery corpus;
 * this file locks in the measure / scale / hang arithmetic itself.
 */

import { describe, expect, it } from 'vitest';

import { arrangeHierChild, arrangeHierRoot } from './alg-hier';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';

let counter = 0;

function node(algType: string, params: Record<string, string> = {}): EngineNode {
	return {
		name: `${algType}-${counter++}`,
		point: { id: `p${counter}`, type: 'node', children: [] } satisfies DataPoint,
		alg: { type: algType, params },
		presOf: [],
		hasPresOf: false,
		presOfAnchored: false,
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

function adopt(parent: EngineNode, children: EngineNode[]): EngineNode {
	parent.children = children;
	for (const child of children) {
		child.parent = parent;
	}
	return parent;
}

/** A `hierRoot` item: a `w` x `h` composite node plus optional rows. */
function item(
	w: number,
	h: number,
	rows: EngineNode[] = [],
	sp = 0,
	params: Record<string, string> = {},
): EngineNode {
	const composite = node('composite');
	composite.values.set('w', w);
	composite.values.set('h', h);
	const root = adopt(node('hierRoot', params), [composite, ...rows]);
	root.values.set('sp', sp);
	return root;
}

function row(items: EngineNode[], sibSp = 0, params: Record<string, string> = {}): EngineNode {
	const r = adopt(node('hierChild', params), items);
	r.values.set('sibSp', sibSp);
	return r;
}

function compositeOf(root: EngineNode): EngineNode {
	return root.children[0];
}

describe('hierarchy layout: measure, scale, centre', () => {
	it('fans a row sibSp apart and scales it uniformly to fit, centred', () => {
		const a = item(100, 50);
		const b = item(100, 50);
		const top = row([a, b], 20);
		top.box = { x: 0, y: 0, w: 440, h: 400 };
		arrangeHierChild(top);
		// Natural row 220 x 50 scales x2 to 440 x 100, centred vertically.
		expect(compositeOf(a).box).toStrictEqual({ x: 0, y: 150, w: 200, h: 100 });
		expect(compositeOf(b).box).toStrictEqual({ x: 240, y: 150, w: 200, h: 100 });
	});

	it('centres a node over its children row, sp above it (tCtrCh default)', () => {
		const c1 = item(100, 50);
		const c2 = item(100, 50);
		const parent = item(100, 50, [row([c1, c2], 20)], 25);
		const top = row([parent]);
		top.box = { x: 0, y: 0, w: 220, h: 125 };
		arrangeHierChild(top);
		expect(compositeOf(parent).box).toStrictEqual({ x: 60, y: 0, w: 100, h: 50 });
		expect(compositeOf(c1).box).toStrictEqual({ x: 0, y: 75, w: 100, h: 50 });
		expect(compositeOf(c2).box).toStrictEqual({ x: 120, y: 75, w: 100, h: 50 });
	});

	it('reverses a fromR row and stacks a fromT row vertically', () => {
		const a = item(100, 50);
		const b = item(100, 50);
		const reversed = row([a, b], 0, { linDir: 'fromR' });
		reversed.box = { x: 0, y: 0, w: 200, h: 50 };
		arrangeHierChild(reversed);
		expect(compositeOf(b).box?.x).toBe(0);
		expect(compositeOf(a).box?.x).toBe(100);

		const c = item(100, 50);
		const d = item(100, 50);
		const column = row([c, d], 10, { linDir: 'fromT' });
		column.box = { x: 0, y: 0, w: 100, h: 110 };
		arrangeHierChild(column);
		expect(compositeOf(d).box?.y).toBe(60);
	});

	it('leaves nested hierarchy nodes to the outermost pass', () => {
		const child = item(100, 50);
		const inner = row([child]);
		const parent = item(100, 50, [inner], 10);
		const top = row([parent]);
		top.box = { x: 0, y: 0, w: 100, h: 110 };
		arrangeHierChild(top);
		const placed = { ...compositeOf(child).box };
		arrangeHierChild(inner);
		arrangeHierRoot(parent);
		expect(compositeOf(child).box).toStrictEqual(placed);
	});
});

describe('outline packing', () => {
	it("lets a subtree's wide children sit under its leaf siblings instead of pushing them apart", () => {
		// smartart-orgchart-nested-hang.pptx: Report B's three teams fan out
		// beneath Report A and Report C, which stay one W + sibSp apart.
		const teams = [item(100, 50), item(100, 50), item(100, 50)];
		const a = item(100, 50);
		const b = item(100, 50, [row(teams, 10)], 20);
		const c = item(100, 50);
		const top = row([a, b, c], 10);
		top.box = { x: 0, y: 0, w: 320, h: 120 };
		arrangeHierChild(top);
		expect(compositeOf(b).box!.x - compositeOf(a).box!.x).toBeCloseTo(110, 6);
		expect(compositeOf(c).box!.x - compositeOf(b).box!.x).toBeCloseTo(110, 6);
		expect(compositeOf(teams[0]).box!.x).toBeCloseTo(compositeOf(a).box!.x, 6);
	});
});

describe('hanging branches', () => {
	it("hangs a tL node's fromT column 0.25 W in from its left edge, one sp below", () => {
		const leaf = item(100, 50);
		const parent = item(100, 50, [row([leaf], 0, { linDir: 'fromT', chAlign: 'l' })], 20, {
			hierAlign: 'tL',
		});
		const top = row([parent]);
		// Drawn extent: 125 wide (the column juts 25 past the node), 120 tall.
		top.box = { x: 0, y: 0, w: 125, h: 120 };
		arrangeHierChild(top);
		expect(compositeOf(parent).box).toStrictEqual({ x: 0, y: 0, w: 100, h: 50 });
		expect(compositeOf(leaf).box).toStrictEqual({ x: 25, y: 70, w: 100, h: 50 });
	});

	it('reserves only the wider of node and column in the parent row', () => {
		const leaf = item(100, 50);
		const hanging = item(100, 50, [row([leaf], 0, { linDir: 'fromT' })], 20, { hierAlign: 'tL' });
		const sibling = item(100, 50);
		const top = row([hanging, sibling], 10);
		top.box = { x: 0, y: 0, w: 210, h: 120 };
		arrangeHierChild(top);
		// Sibling pitch W + sibSp = 110, as the cached org charts show.
		expect(compositeOf(sibling).box!.x - compositeOf(hanging).box!.x).toBeCloseTo(110, 6);
	});
});
