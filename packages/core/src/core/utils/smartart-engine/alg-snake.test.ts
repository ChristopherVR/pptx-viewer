/**
 * Unit coverage for `arrangeSnake` (ECMA-376 Part 1, 21.4.2.x) on synthetic
 * `EngineNode`s: cells keep their constraint sizes, the grid picks the line
 * length that scales largest into the node, and spacers set the gap. The
 * accuracy gate against real PowerPoint output is the gallery corpus
 * (`scripts/gen-smartart-gallery-baseline.ts`); this file locks in the grid
 * math itself.
 */

import { describe, expect, it } from 'vitest';

import { arrangeSnake } from './alg-snake';
import type { EngineNode } from './engine-node';

function child(type: 'node' | 'sibTrans' = 'node'): EngineNode {
	return {
		name: type === 'node' ? 'item' : 'sibTrans',
		point: { id: 'p', type, children: [] },
		alg: { type: 'sp', params: {} },
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

/** `n` cells of `w` x `h`, a `gap`-wide spacer between each pair. */
function snakeNode(
	n: number,
	w: number,
	h: number,
	gap: number,
	params: Record<string, string> = {},
): EngineNode {
	const node = child();
	node.alg = { type: 'snake', params };
	node.box = { x: 0, y: 0, w: 650, h: 400 };
	const children: EngineNode[] = [];
	for (let i = 0; i < n; i++) {
		const cell = child();
		cell.values.set('w', w);
		cell.values.set('h', h);
		children.push(cell);
		if (i < n - 1) {
			const spacer = child('sibTrans');
			spacer.values.set('w', gap);
			children.push(spacer);
		}
	}
	node.children = children;
	node.values.set('sp', gap);
	return node;
}

const cells = (node: EngineNode) => node.children.filter((c) => c.point.type === 'node');

describe('arrangeSnake', () => {
	it('picks the line length that scales largest ("Basic Block List")', () => {
		// Three 650 x 390 cells 65 apart fit a 650 x 400 frame largest as two
		// columns: the cached 307.5 x 184.5 cells.
		const node = snakeNode(3, 650, 390, 65, { off: 'ctr' });
		arrangeSnake(node);
		const [a, b, c] = cells(node).map((cell) => cell.box!);
		expect(a.w).toBeCloseTo(307.7, 0);
		expect(a.h).toBeCloseTo(184.6, 0);
		expect(a.y).toBeCloseTo(b.y, 6);
		expect(c.y).toBeGreaterThan(a.y);
		// off="ctr" centres the short last line under the full one.
		expect(c.x + c.w / 2).toBeCloseTo((a.x + b.x + b.w) / 2, 6);
	});

	it('keeps a fitting row at its constraint size, centred ("Text Card Short Line")', () => {
		const node = snakeNode(4, 143.07, 266.7, 10.87);
		arrangeSnake(node);
		const boxes = cells(node).map((cell) => cell.box!);
		expect(boxes[0].w).toBeCloseTo(143.07, 6);
		expect(boxes[0].x).toBeCloseTo((650 - (4 * 143.07 + 3 * 10.87)) / 2, 6);
		expect(boxes[1].x - boxes[0].x).toBeCloseTo(143.07 + 10.87, 6);
	});

	it('runs a reversed line back from the far end ("Basic Bending Process")', () => {
		const node = snakeNode(3, 250, 150, 100, { contDir: 'revDir' });
		arrangeSnake(node);
		const [a, b, c] = cells(node).map((cell) => cell.box!);
		expect(c.y).toBeGreaterThan(a.y);
		expect(c.x).toBeCloseTo(b.x, 6);
	});

	it('honours a fixed line length', () => {
		const node = snakeNode(4, 100, 100, 10, { bkpt: 'fixed', bkPtFixedVal: '2' });
		arrangeSnake(node);
		const rows = new Set(cells(node).map((cell) => Math.round(cell.box!.y)));
		expect(rows.size).toBe(2);
	});

	it('does not touch a node with no box or no children', () => {
		const withoutBox = child();
		withoutBox.alg = { type: 'snake', params: {} };
		withoutBox.children = [child()];
		expect(() => arrangeSnake(withoutBox)).not.toThrow();
		expect(withoutBox.children[0].box).toBeUndefined();
	});
});
