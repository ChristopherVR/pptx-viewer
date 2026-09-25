/**
 * Unit coverage for `arrangePyra` (ECMA-376 Part 1, 21.4.2.x): pure band
 * placement, tested directly against synthetic `EngineNode`s rather than a
 * full fixture load, mirroring `alg-cycle.test.ts`'s approach.
 * `smartart-gallery-ground-truth.test.ts` (opt-in via
 * `SMARTART_GALLERY_GATE=1`) and `measure-smartart-engine-vs-legacy.ts` are
 * the accuracy gates against real PowerPoint output; this file locks in the
 * band math itself.
 */

import { describe, expect, it } from 'vitest';

import { applyPyraAccentSplit, arrangePyra } from './alg-pyra';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';

function selfLiteral(type: string, val: number): LdConstraint {
	return {
		type,
		for: 'self',
		ptType: 'all',
		refType: 'none',
		refFor: 'self',
		refPtType: 'all',
		op: 'none',
		val,
		hasVal: true,
		fact: 0,
	};
}

function child(point?: DataPoint): EngineNode {
	return {
		name: 'item',
		point: point ?? { id: `p${Math.random()}`, type: 'node', children: [] },
		alg: { type: 'composite', params: {} },
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

function pyraNode(n: number, params: Record<string, string> = {}): EngineNode {
	const node = child();
	node.alg = { type: 'pyra', params };
	node.box = { x: 0, y: 0, w: 300, h: 300 };
	node.children = Array.from({ length: n }, () => child());
	return node;
}

describe('arrangePyra', () => {
	it('stacks bands top to bottom filling the full height', () => {
		const node = pyraNode(3);
		arrangePyra(node);
		const boxes = node.children.map((c) => c.box!);
		expect(boxes[0].y).toBeCloseTo(0, 6);
		expect(boxes[2].y + boxes[2].h).toBeCloseTo(300, 6);
		// No gap by default (real "Basic Pyramid" declares no sibSp).
		expect(boxes[1].y).toBeCloseTo(boxes[0].y + boxes[0].h, 6);
		expect(boxes[2].y).toBeCloseTo(boxes[1].y + boxes[1].h, 6);
	});

	it('gives every band the same height', () => {
		const node = pyraNode(4);
		arrangePyra(node);
		const heights = node.children.map((c) => c.box!.h);
		expect(new Set(heights.map((h) => h.toFixed(4))).size).toBe(1);
	});

	it('widens each band edge-to-edge: the LAST band spans the full width by default (apex up)', () => {
		const node = pyraNode(3);
		arrangePyra(node);
		const last = node.children[2].box!;
		expect(last.w).toBeCloseTo(300, 6);
		expect(last.x).toBeCloseTo(0, 6);
	});

	it('narrows monotonically toward the apex (default fromB: apex at the top)', () => {
		const node = pyraNode(4);
		arrangePyra(node);
		const widths = node.children.map((c) => c.box!.w);
		for (let i = 1; i < widths.length; i++) {
			expect(widths[i]).toBeGreaterThan(widths[i - 1]);
		}
	});

	it("keeps every band centred on the node's own horizontal centre", () => {
		const node = pyraNode(3);
		arrangePyra(node);
		for (const c of node.children) {
			const box = c.box!;
			expect(box.x + box.w / 2).toBeCloseTo(150, 6);
		}
	});

	it('mirrors band widths for linDir="fromT" (real "Inverted Pyramid": apex at the bottom)', () => {
		const normal = pyraNode(3);
		arrangePyra(normal);
		const inverted = pyraNode(3, { linDir: 'fromT' });
		arrangePyra(inverted);
		const normalWidths = normal.children.map((c) => c.box!.w);
		const invertedWidths = inverted.children.map((c) => c.box!.w).reverse();
		for (let i = 0; i < 3; i++) {
			expect(invertedWidths[i]).toBeCloseTo(normalWidths[i], 6);
		}
	});

	it('adds absolute sibSp spacing between bands when declared', () => {
		const node = pyraNode(2);
		node.values.set('sibSp', 10);
		arrangePyra(node);
		const [first, second] = node.children.map((c) => c.box!);
		expect(second.y).toBeCloseTo(first.y + first.h + 10, 6);
		// The bands still fill the box exactly (heights shrink to fit the gap).
		expect(second.y + second.h).toBeCloseTo(300, 6);
	});

	it(
		"strips a named pyraLvlNode's own bare-literal self w/h (real Basic " +
			'Pyramid\'s "level" val="500"/val="1", otherwise misread as a length ' +
			"by preferredSize's self-constraint reapplication)",
		() => {
			const node = pyraNode(2);
			const level = child();
			level.name = 'level';
			level.constraints = [selfLiteral('h', 500), selfLiteral('w', 1)];
			node.children[0].name = 'Name8';
			node.children[0].children = [level];

			arrangePyra(node);

			expect(level.constraints).toStrictEqual([]);
		},
	);

	it("leaves an unrelated named node's own self w/h constraints alone", () => {
		const node = pyraNode(2);
		const other = child();
		other.name = 'levelTx';
		const constraints = [selfLiteral('h', 65)];
		other.constraints = constraints;
		node.children[0].name = 'Name8';
		node.children[0].children = [other];

		arrangePyra(node);

		expect(other.constraints).toBe(constraints);
	});

	it('honours a custom pyraLvlNode param name', () => {
		const node = pyraNode(2, { pyraLvlNode: 'customLevel' });
		const custom = child();
		custom.name = 'customLevel';
		custom.constraints = [selfLiteral('w', 1)];
		node.children[0].children = [custom];

		arrangePyra(node);

		expect(custom.constraints).toStrictEqual([]);
	});
});

describe('applyPyraAccentSplit', () => {
	/**
	 * Attaches a "level" child filling `item`'s own box (as the composite
	 * fill idiom would leave it) so the self-role shrink has something real
	 * to scale, mirroring how `Name8`'s subtree looks after
	 * `layoutSubtree` finishes laying it out.
	 */
	function withLevel(item: EngineNode): EngineNode {
		const level = child();
		level.name = 'level';
		level.box = { ...item.box! };
		item.children = [level];
		return level;
	}

	it('is a no-op when pyraAcctRatio is unset (unaccented pyramid)', () => {
		const node = pyraNode(3);
		arrangePyra(node);
		node.children.forEach(withLevel);
		const before = node.children.map((c) => ({ ...c.box! }));

		applyPyraAccentSplit(node);

		expect(node.children.map((c) => c.box)).toStrictEqual(before);
	});

	it(
		"shrinks every row's own level to (1 - pyraAcctRatio) anchored at the " +
			"diagram box's left edge, even a row with no accent of its own " +
			'(COM-verified: the ratio is diagram-wide, not per-row)',
		() => {
			const node = pyraNode(3);
			node.values.set('pyraAcctRatio', 0.5);
			arrangePyra(node);
			const levels = node.children.map(withLevel);
			const naturalBoxes = node.children.map((c) => ({ ...c.box! }));

			applyPyraAccentSplit(node);

			levels.forEach((level, i) => {
				const natural = naturalBoxes[i];
				expect(level.box!.x).toBeCloseTo(0.5 * natural.x, 6);
				expect(level.box!.w).toBeCloseTo(0.5 * natural.w, 6);
				// y/h are untouched by the x-only shrink.
				expect(level.box!.y).toBeCloseTo(natural.y, 6);
				expect(level.box!.h).toBeCloseTo(natural.h, 6);
			});
		},
	);

	it(
		"fills the accent column from the row's own scaled NARROW (top) " +
			"trapezoid corner out to the diagram box's right edge, not from " +
			"the shrunk level's own (wide-corner) right edge (COM-verified " +
			'against basic-pyramid--hier5.pptx/--hier8.pptx)',
		() => {
			const node = pyraNode(3);
			node.values.set('pyraAcctRatio', 0.5);
			arrangePyra(node);
			node.children.forEach(withLevel);
			const accentBkgd = child();
			accentBkgd.name = 'acctBkgd';
			node.children[0].children.push(accentBkgd);

			applyPyraAccentSplit(node);

			// Row 0 is the apex band (effectiveI = 0): its narrow (top) corner
			// is a degenerate point at the diagram's own horizontal centre
			// (150), scaled by 0.5 anchored at the box's left edge (x=0).
			expect(accentBkgd.box!.x).toBeCloseTo(75, 6);
			expect(accentBkgd.box!.x + accentBkgd.box!.w).toBeCloseTo(300, 6);
			// The accent sits to the right of the row's own natural left
			// edge and can overlap the shrunk level (COM-verified: real
			// PowerPoint output has this overlap too).
			const level = node.children[0].children[0];
			expect(accentBkgd.box!.x).toBeLessThan(level.box!.x + level.box!.w);
		},
	);

	it('leaves an unaccented row with no acctBkgd/acctTx untouched beyond the level shrink', () => {
		const node = pyraNode(2);
		node.values.set('pyraAcctRatio', 0.5);
		arrangePyra(node);
		node.children.forEach(withLevel);

		expect(() => applyPyraAccentSplit(node)).not.toThrow();
		for (const item of node.children) {
			expect(item.children.some((c) => c.name === 'acctBkgd' || c.name === 'acctTx')).toBeFalsy();
		}
	});

	it('honours custom pyraAcctBkgdNode/pyraAcctTxNode param names', () => {
		const node = pyraNode(2, { pyraAcctBkgdNode: 'customBkgd', pyraAcctTxNode: 'customTx' });
		node.values.set('pyraAcctRatio', 0.3);
		arrangePyra(node);
		node.children.forEach(withLevel);
		const customBkgd = child();
		customBkgd.name = 'customBkgd';
		node.children[0].children.push(customBkgd);

		applyPyraAccentSplit(node);

		expect(customBkgd.box).toBeDefined();
		expect(customBkgd.box!.x + customBkgd.box!.w).toBeCloseTo(300, 6);
	});
});
