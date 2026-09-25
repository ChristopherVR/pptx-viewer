/**
 * Unit coverage for the `ctrX`/`w` (or `ctrY`/`h`) "fill and centre" idiom
 * helpers, split out of `constraint-eval.test.ts` alongside
 * `constraint-fill-idiom.ts` itself.
 */

import { describe, expect, it } from 'vitest';

import { fillIdiomFraction, hasFillIdiomPeer } from './constraint-fill-idiom';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';

function node(name: string): EngineNode {
	return {
		name,
		point: { id: `p-${name}`, type: 'node', children: [] } satisfies DataPoint,
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

function literalConstraint(
	type: string,
	val: number,
	overrides: Partial<LdConstraint> = {},
): LdConstraint {
	return {
		type,
		for: 'ch',
		forName: 'level',
		ptType: 'all',
		refType: 'none',
		refFor: 'self',
		refPtType: 'all',
		op: 'none',
		val,
		hasVal: true,
		fact: 0,
		...overrides,
	};
}

describe('hasFillIdiomPeer', () => {
	it('finds a matching ctrX peer for a w declaration', () => {
		const parent = node('Name8');
		const w = literalConstraint('w', 1);
		const ctrX = literalConstraint('ctrX', 1);
		parent.constraints = [w, ctrX];

		expect(hasFillIdiomPeer(parent, w)).toBeTruthy();
		expect(hasFillIdiomPeer(parent, ctrX)).toBeTruthy();
	});

	it("is false when only w is declared (Gear's anchor idiom)", () => {
		const parent = node('composite');
		const w = literalConstraint('w', 1, { forName: 'gear1srcNode' });
		const l = literalConstraint('l', 0.32, {
			forName: 'gear1srcNode',
			refType: 'w',
			fact: 0.32,
		});
		parent.constraints = [w, l];

		expect(hasFillIdiomPeer(parent, w)).toBeFalsy();
	});

	it('is false when the peer targets a different forName', () => {
		const parent = node('Name8');
		const w = literalConstraint('w', 1, { forName: 'level' });
		const ctrX = literalConstraint('ctrX', 1, { forName: 'levelTx' });
		parent.constraints = [w, ctrX];

		expect(hasFillIdiomPeer(parent, w)).toBeFalsy();
	});

	it('is false for a non-axis type (sibSp has no peer concept)', () => {
		const parent = node('ring');
		const sibSp = literalConstraint('sibSp', 0.1);
		parent.constraints = [sibSp];

		expect(hasFillIdiomPeer(parent, sibSp)).toBeFalsy();
	});
});

describe('fillIdiomFraction', () => {
	it("scales a sub-1 val by the declaring node's own width for a horizontal type", () => {
		const parent = node('Name8');
		parent.values.set('w', 400);

		expect(fillIdiomFraction(parent, literalConstraint('w', 0.25))).toBeCloseTo(100, 6);
		expect(fillIdiomFraction(parent, literalConstraint('ctrX', 0.5))).toBeCloseTo(200, 6);
	});

	it("scales a sub-1 val by the declaring node's own height for a vertical type", () => {
		const parent = node('Name8');
		parent.values.set('h', 200);

		expect(fillIdiomFraction(parent, literalConstraint('h', 0.4))).toBeCloseTo(80, 6);
		expect(fillIdiomFraction(parent, literalConstraint('ctrY', 0.5))).toBeCloseTo(100, 6);
	});

	it('returns undefined for val >= 1 (real Basic Pyramid\'s redundant val="1")', () => {
		const parent = node('Name8');
		parent.values.set('w', 400);
		parent.values.set('h', 200);

		expect(fillIdiomFraction(parent, literalConstraint('w', 1))).toBeUndefined();
		expect(fillIdiomFraction(parent, literalConstraint('ctrY', 1))).toBeUndefined();
	});

	it("returns undefined when the declaring node's own size is not resolved yet", () => {
		const parent = node('Name8');

		expect(fillIdiomFraction(parent, literalConstraint('w', 0.5))).toBeUndefined();
	});
});
