/**
 * Unit coverage for `applyConstraint`'s literal-value handling (ECMA-376
 * Part 1, 21.4.2.x `dgm:constr`), in particular the `ctrX`/`w` (or `ctrY`/
 * `h`) "fill and centre" idiom documented in `constraint-eval.ts`'s module
 * doc comment (COM-verified against real "Basic Pyramid" output, and scoped
 * narrowly enough not to touch Gear's own anchor-point idiom - see that
 * comment for the full derivation).
 */

import { describe, expect, it } from 'vitest';

import { applyConstraint } from './constraint-eval';
import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';

const POINTS_PER_MM = 72 / 25.4;

function node(name: string): EngineNode {
	return {
		name,
		point: { id: `p-${name}`, type: 'node', children: [] } satisfies DataPoint,
		alg: { type: 'composite', params: {} },
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

function literalConstraint(
	type: string,
	val: number,
	overrides: Partial<LdConstraint> = {},
): LdConstraint {
	return {
		type,
		for: 'ch',
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

describe('applyConstraint: the ctrX/w (or ctrY/h) "fill and centre" idiom', () => {
	it('treats a paired val="1" (real Basic Pyramid\'s "level") as unconstrained, not a 1mm box', () => {
		const parent = node('Name8');
		const level = node('level');
		parent.children = [level];
		parent.values.set('w', 400);
		parent.values.set('h', 200);
		// Both declared, as real layout1.xml does, before either is applied.
		const w = literalConstraint('w', 1, { forName: 'level' });
		const ctrX = literalConstraint('ctrX', 1, { forName: 'level' });
		parent.constraints = [w, ctrX];

		applyConstraint(parent, w);
		applyConstraint(parent, ctrX);

		expect(level.values.has('w')).toBeFalsy();
		expect(level.values.has('ctrX')).toBeFalsy();
	});

	it("reads a paired sub-1 literal as a fraction of the declaring node's own size", () => {
		const parent = node('Name8');
		const child = node('acctBkgd');
		parent.children = [child];
		parent.values.set('w', 400);
		parent.values.set('h', 200);
		const h = literalConstraint('h', 0.4, { forName: 'acctBkgd' });
		const ctrY = literalConstraint('ctrY', 0.5, { forName: 'acctBkgd' });
		parent.constraints = [h, ctrY];

		applyConstraint(parent, h);
		applyConstraint(parent, ctrY);

		expect(child.values.get('h')).toBeCloseTo(0.4 * 200, 6);
		expect(child.values.get('ctrY')).toBeCloseTo(0.5 * 200, 6);
	});

	it("does not fire without a ctrX/ctrY peer: Gear's anchor-point idiom keeps its mm reading", () => {
		const parent = node('composite');
		const anchor = node('gear1srcNode');
		parent.children = [anchor];
		parent.values.set('w', 300);
		parent.values.set('h', 300);
		// Gear's real declaration: w/h="1" beside an `l` position, no ctrX/ctrY.
		const w = literalConstraint('w', 1, { forName: 'gear1srcNode' });
		const h = literalConstraint('h', 1, { forName: 'gear1srcNode' });
		const l = literalConstraint('l', 0.32, { forName: 'gear1srcNode', refType: 'w', fact: 0.32 });
		parent.constraints = [w, h, l];

		applyConstraint(parent, w);
		applyConstraint(parent, h);

		expect(anchor.values.get('w')).toBeCloseTo(POINTS_PER_MM, 6);
		expect(anchor.values.get('h')).toBeCloseTo(POINTS_PER_MM, 6);
	});

	it("does not fire for a lone sub-1 literal with no peer (numbered-linear-arrow's hairline)", () => {
		const parent = node('lineParent');
		const lineNode = node('lineNode');
		parent.children = [lineNode];
		parent.values.set('w', 400);
		parent.values.set('h', 200);
		const h = literalConstraint('h', 0.002, { forName: 'lineNode' });
		parent.constraints = [h];

		applyConstraint(parent, h);

		// Ordinary millimetre reading, NOT 0.002 * the parent's own height.
		expect(lineNode.values.get('h')).toBeCloseTo(0.002 * POINTS_PER_MM, 6);
	});

	it('still converts a bare literal on a true length type (sibSp) from millimetres to points', () => {
		const parent = node('ring');
		const child = node('item');
		parent.children = [child];
		parent.values.set('w', 400);
		parent.values.set('h', 200);

		applyConstraint(parent, literalConstraint('sibSp', 5, { forName: 'item' }));

		expect(child.values.get('sibSp')).toBeCloseTo(5 * POINTS_PER_MM, 6);
	});
});
