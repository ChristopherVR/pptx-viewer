import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import {
	resolveHubGapRatio,
	resolveHubToNodeRatio,
} from './smartart-layout-interpreter-cycle-hub-ratio';

describe('resolveHubToNodeRatio', () => {
	it('resolves an explicit `fact` ("radial-cycle": node.w = 0.7 * centerShape.w)', () => {
		const ratio = resolveHubToNodeRatio({ name: 'node' }, [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 0.7,
			},
		]);
		expect(ratio).toStrictEqual({ hubName: 'centerShape', factor: 0.7 });
	});

	it('defaults to factor 1 when `fact` is omitted ("basic-radial": node.w = centerShape.w)', () => {
		const ratio = resolveHubToNodeRatio({ name: 'node' }, [
			{ type: 'w', forName: 'node', referenceType: 'w', referenceForName: 'centerShape' },
		]);
		expect(ratio).toStrictEqual({ hubName: 'centerShape', factor: 1 });
	});

	it('returns undefined when the ring item has no name', () => {
		expect(resolveHubToNodeRatio(undefined, [])).toBeUndefined();
		expect(resolveHubToNodeRatio({}, [])).toBeUndefined();
	});

	it('session 12: omitting `index` is BYTE-IDENTICAL to the pre-session behaviour (regression guard for the new optional graph-resolution parameter)', () => {
		const constraints: Parameters<typeof resolveHubToNodeRatio>[1] = [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 1.25,
			},
		];
		const withoutIndex = resolveHubToNodeRatio({ name: 'node' }, constraints);
		expect(withoutIndex).toStrictEqual({ hubName: 'centerShape', factor: 1.25 });
	});

	it('session 12: with a `ConstraintIndex`, graph-resolves BOTH node.w and centerShape.w independently and returns their RATIO - matches `diverging-radial--hier5.pptx`\'s own real shape (`op="equ" fact="1.25"`, centerShape.w an UNQUALIFIED (root) reference) exactly, proving the declared 1.25 is genuinely what the full constraint graph resolves to, not a shallow-read artifact - the residual this fixture still shows is NOT a resolution-depth bug', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					// centerShape.w: unqualified reference -> root's own w (=1).
					{ type: 'w', for: 'ch', forName: 'centerShape', referenceType: 'w' },
					// node.w: op="equ" fact="1.25" relative to centerShape.w - the
					// EXACT shape `diverging-radial--hier5.pptx`'s own layout1.xml
					// declares.
					{
						type: 'w',
						for: 'ch',
						forName: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'centerShape',
						operator: 'equ',
						factor: 1.25,
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const ratio = resolveHubToNodeRatio({ name: 'node' }, definition.rootNode.constraints, index);
		// The graph resolves centerShape.w=1 (root default) and node.w=1.25 -
		// ratio 1.25/1=1.25, mathematically IDENTICAL to the raw `fact` reading
		// whenever (as here) there is exactly one candidate constraint per
		// role - graph resolution can only differ from a raw-fact read when
		// MULTIPLE competing declarations exist for the same role (see the
		// next test).
		expect(ratio).toStrictEqual({ hubName: 'centerShape', factor: 1.25 });
	});

	it("session 12: graph-resolving BOTH sides is a MATHEMATICAL IDENTITY with the raw-fact reading for this pattern, never just a fixture coincidence - `node.w` is, by the `match` finder's own precondition, ALWAYS declared as exactly `factor * hub.w`, so however `hub.w` itself resolves (here: via a literal declared on a DIFFERENT, nested layoutNode `arrangerConstraints` alone could not see, not the root default), `node.w` cascades through the IDENTICAL reference and the two cancel to the SAME `factor` - proves graph resolution structurally cannot be the fix for a hub:satellite ratio bug in this function, not just empirically unobserved for the fixtures checked so far", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					{
						type: 'w',
						for: 'ch',
						forName: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'centerShape',
						factor: 3,
					},
				],
				children: [
					{
						name: 'nested',
						// A plain literal, declared on a layoutNode OTHER than the
						// arranger - only the full-tree index sees it.
						constraints: [{ type: 'w', for: 'ch', forName: 'centerShape', factor: 0.5 }],
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const ratio = resolveHubToNodeRatio({ name: 'node' }, definition.rootNode.constraints, index);
		// centerShape.w resolves to 0.5 (the nested literal, invisible to
		// `arrangerConstraints` alone) and node.w cascades to 3*0.5=1.5 through
		// the SAME reference - the ratio (1.5/0.5) is still exactly 3, the raw
		// `factor`, confirming the cancellation is structural, not
		// coincidental to any one fixture's own numbers.
		expect(ratio).toStrictEqual({ hubName: 'centerShape', factor: 3 });
	});

	it('session 17: a count-gated `dgm:rule` (bare `fact`, `val="NaN"`) REPLACES the constraint-declared factor when its guard matches the real satellite count - pins `diverging-radial--hier5.pptx`\'s own real shape (`constrLst` declares `fact=1.25`, but a `cnt<=6` rule declares `fact=1`, and n=3 falls in that branch): COM-verified the CACHED hub:item ratio is `1:1`, not `1.25:1`', () => {
		const constraints: Parameters<typeof resolveHubToNodeRatio>[1] = [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 1.25,
			},
		];
		const ruleCandidates: Parameters<typeof resolveHubToNodeRatio>[3] = [
			{
				guard: [{ function: 'cnt', operator: 'lte', value: '6' }],
				rule: { type: 'w', forName: 'node', factor: 1, value: Number.NaN, max: Number.NaN },
			},
			{
				guard: [{ function: 'cnt', operator: 'lte', value: '8' }],
				rule: { type: 'w', forName: 'node', factor: 0.9, value: Number.NaN, max: Number.NaN },
			},
		];
		const ratioAt3 = resolveHubToNodeRatio(
			{ name: 'node' },
			constraints,
			undefined,
			ruleCandidates,
			3,
		);
		expect(ratioAt3).toStrictEqual({ hubName: 'centerShape', factor: 1 });
		// n=8 crosses into the SECOND bucket (`cnt<=8`, fact=0.9) - COM-verified
		// against a purpose-built 8-satellite sample: cached hub:item =
		// `1281782:1153604 = 1.1111 = 1/0.9` exactly.
		const ratioAt8 = resolveHubToNodeRatio(
			{ name: 'node' },
			constraints,
			undefined,
			ruleCandidates,
			8,
		);
		expect(ratioAt8).toStrictEqual({ hubName: 'centerShape', factor: 0.9 });
	});

	it('session 17: without a satellite count, or without rule candidates, falls back to the constraint-declared factor unchanged (regression guard for every existing caller)', () => {
		const constraints: Parameters<typeof resolveHubToNodeRatio>[1] = [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 1.25,
			},
		];
		const ruleCandidates: Parameters<typeof resolveHubToNodeRatio>[3] = [
			{
				guard: [{ function: 'cnt', operator: 'lte', value: '6' }],
				rule: { type: 'w', forName: 'node', factor: 1, value: Number.NaN, max: Number.NaN },
			},
		];
		expect(
			resolveHubToNodeRatio({ name: 'node' }, constraints, undefined, ruleCandidates),
		).toStrictEqual({ hubName: 'centerShape', factor: 1.25 });
		expect(
			resolveHubToNodeRatio({ name: 'node' }, constraints, undefined, undefined, 3),
		).toStrictEqual({ hubName: 'centerShape', factor: 1.25 });
	});

	it('session 17: a rule with a genuine literal `value` (not `val="NaN"`) is a DIFFERENT construct (e.g. a `primFontSz` shrink floor) and is never matched as a count-gated ratio override', () => {
		const constraints: Parameters<typeof resolveHubToNodeRatio>[1] = [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 1.25,
			},
		];
		const ruleCandidates: Parameters<typeof resolveHubToNodeRatio>[3] = [
			{
				guard: [{ function: 'cnt', operator: 'lte', value: '6' }],
				rule: { type: 'w', forName: 'node', factor: 1, value: 42 },
			},
		];
		expect(
			resolveHubToNodeRatio({ name: 'node' }, constraints, undefined, ruleCandidates, 3),
		).toStrictEqual({ hubName: 'centerShape', factor: 1.25 });
	});

	it('session 17: a rule reachable ONLY through an `else` branch (empty guard) is never trusted as "always true" - pins the measured regression on `converging-radial--hier5.pptx`, whose own `w forName="node" fact="0.7"` rule lives EXCLUSIVELY in a `cnt<=5`/`else` choose\'s `else` (n=3 falls in the SIBLING `cnt<=5` if-branch, which declares no `node` rule at all - trusting the else fired the override anyway and grew the hub from a real 234px cached to a wrong 338px, 10.51% max delta to 19.51%)', () => {
		const constraints: Parameters<typeof resolveHubToNodeRatio>[1] = [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 0.95,
			},
		];
		const ruleCandidates: Parameters<typeof resolveHubToNodeRatio>[3] = [
			// The `cnt<=5` if-branch: only a `centerShape` rule, no `node` rule.
			{
				guard: [{ function: 'cnt', operator: 'lte', value: '5' }],
				rule: {
					type: 'w',
					forName: 'centerShape',
					factor: 0.27,
					value: Number.NaN,
					max: Number.NaN,
				},
			},
			// The else branch: BOTH rules, `guard` empty (else has no condition of
			// its own) - this `node` rule only ever really applies when n>5.
			{
				guard: [],
				rule: {
					type: 'w',
					forName: 'centerShape',
					factor: 0.27,
					value: Number.NaN,
					max: Number.NaN,
				},
			},
			{
				guard: [],
				rule: { type: 'w', forName: 'node', factor: 0.7, value: Number.NaN, max: Number.NaN },
			},
		];
		// n=3 falls in the `cnt<=5` branch - must NOT pick up the else's `node`
		// rule just because its guard is empty.
		expect(
			resolveHubToNodeRatio({ name: 'node' }, constraints, undefined, ruleCandidates, 3),
		).toStrictEqual({ hubName: 'centerShape', factor: 0.95 });
	});
});

describe('resolveHubGapRatio', () => {
	const hubRatio = { hubName: 'centerShape', factor: 1.25 };

	it('returns undefined without a resolved hubRatio (plain ring, no regression)', () => {
		expect(
			resolveHubGapRatio('node', undefined, [
				{ type: 'sp', referenceType: 'w', referenceForName: 'node', factor: 0.3 },
			]),
		).toBeUndefined();
	});

	it('uses `sp` directly when it references the ring item itself ("basic-radial")', () => {
		const gap = resolveHubGapRatio('node', { hubName: 'centerShape', factor: 1 }, [
			{ type: 'sp', referenceType: 'w', referenceForName: 'node', factor: 0.3 },
		]);
		expect(gap).toBeCloseTo(0.3, 5);
	});

	it('converts `sp` by hubRatio.factor when it references the hub instead ("diverging-radial": sp fact=0.4 refForName=centerShape, hubRatio.factor=1.25 -> 0.4/1.25=0.32)', () => {
		const gap = resolveHubGapRatio('node', hubRatio, [
			{ type: 'sp', referenceType: 'w', referenceForName: 'centerShape', factor: 0.4 },
		]);
		expect(gap).toBeCloseTo(0.32, 5);
	});

	it('returns undefined when `sp` references neither the item nor the hub (a plain ring\'s own unrelated `sp`, e.g. referencing "composite")', () => {
		const gap = resolveHubGapRatio('node', hubRatio, [
			{ type: 'sp', referenceType: 'w', referenceForName: 'composite', factor: 0.3 },
		]);
		expect(gap).toBeUndefined();
	});

	it('returns undefined when no `sp` constraint is declared at all', () => {
		expect(resolveHubGapRatio('node', hubRatio, [])).toBeUndefined();
		expect(resolveHubGapRatio('node', hubRatio, undefined)).toBeUndefined();
	});
});

// SESSION 14: `radial-cluster--hier5.pptx`'s own `singleCycle`/`text0` shape -
// the ring item's own `w` is a BARE `refType="userS"` self-reference (no hub
// mentioned in THIS constraint at all); the real hub-relative factor is
// declared SEPARATELY on the arranger, targeted by `ptType`, not `forName`.
describe('resolveHubToNodeRatio (via userS indirection)', () => {
	const bareUserSizeRef = [
		{ type: 'userS' },
		{ type: 'w', referenceType: 'userS' },
		{ type: 'h', referenceType: 'w' },
	];

	it('resolves the hub-relative factor from a SEPARATE ptType-targeted userS declaration on the arranger (radial-cluster: singleCenter, fact=0.67)', () => {
		const ratio = resolveHubToNodeRatio({ name: 'text0', constraints: bareUserSizeRef }, [
			{
				type: 'userS',
				for: 'ch',
				pointType: 'node',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'singleCenter',
				factor: 0.67,
			},
		]);
		expect(ratio).toStrictEqual({ hubName: 'singleCenter', factor: 0.67 });
	});

	it('reads allConstraints over constraints, same convention as every other constraint lookup in this module', () => {
		const ratio = resolveHubToNodeRatio(
			{ name: 'text0', allConstraints: bareUserSizeRef, constraints: [] },
			[{ type: 'userS', referenceType: 'w', referenceForName: 'hub', factor: 0.5 }],
		);
		expect(ratio).toStrictEqual({ hubName: 'hub', factor: 0.5 });
	});

	it('does not fire when the ring item declares no bare userS self-reference at all (a plain, non-userS ring item)', () => {
		expect(
			resolveHubToNodeRatio({ name: 'node', constraints: [{ type: 'w', factor: 0.5 }] }, [
				{ type: 'userS', referenceType: 'w', referenceForName: 'hub', factor: 0.67 },
			]),
		).toBeUndefined();
	});

	it("does not fire when the item's own w reference carries an EXPLICIT ref target (not a bare self-reference, so the direct-match path - or nothing - should win instead)", () => {
		expect(
			resolveHubToNodeRatio(
				{
					name: 'text0',
					constraints: [{ type: 'w', referenceType: 'userS', referenceForName: 'somethingElse' }],
				},
				[{ type: 'userS', referenceType: 'w', referenceForName: 'hub', factor: 0.67 }],
			),
		).toBeUndefined();
	});

	it('returns undefined when the arranger declares no userS at all despite a bare self-reference', () => {
		expect(
			resolveHubToNodeRatio({ name: 'text0', constraints: bareUserSizeRef }, []),
		).toBeUndefined();
	});

	it('the direct forName-matched path still wins first when BOTH shapes are present (regression guard: existing fixtures never take the userS fallback)', () => {
		const ratio = resolveHubToNodeRatio({ name: 'node', constraints: bareUserSizeRef }, [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 0.7,
			},
			{ type: 'userS', referenceType: 'w', referenceForName: 'wrongHub', factor: 0.1 },
		]);
		expect(ratio).toStrictEqual({ hubName: 'centerShape', factor: 0.7 });
	});
});
