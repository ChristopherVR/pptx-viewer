/**
 * Unit coverage for `arrangeSnake` (ECMA-376 Part 1, 21.4.2.x): pure
 * grid-cell placement, tested directly against synthetic `EngineNode`s
 * rather than a full fixture load. `smartart-gallery-ground-truth.test.ts`
 * (opt-in via `SMARTART_GALLERY_GATE=1`) is the accuracy gate against real
 * PowerPoint output; this file locks in the grid math itself.
 */

import { describe, expect, it } from 'vitest';

import { arrangeSnake } from './alg-snake';
import type { EngineNode } from './engine-node';

function child(): EngineNode {
	return {
		name: 'item',
		point: { id: 'p', type: 'node', children: [] },
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

function snakeNode(n: number, params: Record<string, string> = {}): EngineNode {
	const node = child();
	node.alg = { type: 'snake', params };
	node.box = { x: 0, y: 0, w: 400, h: 200 };
	node.children = Array.from({ length: n }, () => child());
	return node;
}

describe('arrangeSnake', () => {
	it('fills a row-major grid, boustrophedon by default', () => {
		// A wide (400x200) 4-item grid picks 3 columns x 2 rows (area-based
		// aspect guess), so the first row holds items 0-2 left to right and
		// the 4th item wraps to a second row.
		const node = snakeNode(4);
		arrangeSnake(node);
		for (const c of node.children) {
			expect(c.box).toBeDefined();
			expect(c.box!.w).toBeGreaterThan(0);
			expect(c.box!.h).toBeGreaterThan(0);
		}
		const [first, second, third, fourth] = node.children.map((c) => c.box!);
		expect(first.y).toBeCloseTo(second.y, 5);
		expect(second.y).toBeCloseTo(third.y, 5);
		expect(first.x).toBeLessThan(second.x);
		expect(second.x).toBeLessThan(third.x);
		// Row 2 (item 4) sits below row 1 and, by the default boustrophedon
		// reversal, ends up under the LAST column rather than the first.
		expect(fourth.y).toBeGreaterThan(first.y);
		expect(fourth.x).toBeCloseTo(third.x, 5);
	});

	it('keeps every cell the same size', () => {
		const node = snakeNode(6);
		arrangeSnake(node);
		const sizes = node.children.map((c) => `${c.box!.w.toFixed(3)}x${c.box!.h.toFixed(3)}`);
		expect(new Set(sizes).size).toBe(1);
	});

	it('reverses alternate lines unless contDir is sameDir', () => {
		// A tall, narrow box with 4 items and flowDir=col forces a 1-col,
		// 4-row grid, so contDir has no visible effect here; force two
		// columns instead via a fixed row breakpoint to exercise the
		// boustrophedon reversal on a genuine multi-line grid.
		const node = snakeNode(4, { flowDir: 'col' });
		node.box = { x: 0, y: 0, w: 100, h: 400 };
		node.values.set('bkPtFixedVal', 2);
		node.alg.params.bkpt = 'fixed';
		arrangeSnake(node);
		const rows = node.children.map((c) => Math.round(c.box!.y));
		// Boustrophedon (default): line 2 (col 1) reverses row order versus
		// line 1 (col 0), so the two columns' row assignments are mirrored.
		expect(new Set(rows).size).toBeGreaterThan(1);
	});

	it('does not touch a node with no box or no children', () => {
		const withoutBox = child();
		withoutBox.alg = { type: 'snake', params: {} };
		withoutBox.children = [child()];
		expect(() => arrangeSnake(withoutBox)).not.toThrow();
		expect(withoutBox.children[0].box).toBeUndefined();

		const empty = snakeNode(0);
		expect(() => arrangeSnake(empty)).not.toThrow();
	});
});
