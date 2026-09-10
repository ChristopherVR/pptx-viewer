import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode, PptxSmartArtWhen } from '../types';
import { selectFirstMatchChildren } from './smartart-layout-interpreter-composite-choose-groups';

function guard(op: 'equ' | 'gte', value: string): PptxSmartArtWhen {
	return { function: 'cnt', operator: op, value };
}

function child(
	name: string,
	groups: PptxSmartArtLayoutNode['chooseGroups'],
): PptxSmartArtLayoutNode {
	return { name, chooseGroups: groups };
}

describe('selectFirstMatchChildren', () => {
	it('returns children unchanged when none carries chooseGroups (the common case)', () => {
		const children: PptxSmartArtLayoutNode[] = [{ name: 'a' }, { name: 'b' }];
		expect(selectFirstMatchChildren(children, [])).toBe(children);
	});

	it(
		'keeps only the LOWEST-ordinal live member of a group ' +
			'(a 3-way mutually exclusive dgm:choose, cnt-decidable)',
		() => {
			const flat: PptxSmartArtNode[] = [
				{ id: '1', text: 'A' },
				{ id: '2', text: 'B' },
			];
			const children = [
				child('one', [{ id: 'g0', ordinal: 0, guard: guard('equ', '5') }]),
				child('two', [{ id: 'g0', ordinal: 1, guard: guard('equ', '2') }]),
				child('three', [{ id: 'g0', ordinal: 2 }]),
			];
			// nodeCount (flat.length) is 2, so ordinal 0 ("equ 5") is false,
			// ordinal 1 ("equ 2") is true - it wins, ordinal 2 (else) never runs.
			expect(selectFirstMatchChildren(children, flat).map((c) => c.name)).toStrictEqual(['two']);
		},
	);

	it("drops EVERYTHING nested under a losing sibling (the caller's own recursion never reaches it)", () => {
		const flat: PptxSmartArtNode[] = [{ id: '1', text: 'A' }];
		const losing: PptxSmartArtLayoutNode = {
			name: 'losing',
			chooseGroups: [{ id: 'g0', ordinal: 0, guard: guard('equ', '99') }],
			children: [{ name: 'losingChild' }],
		};
		const winning: PptxSmartArtLayoutNode = {
			name: 'winning',
			chooseGroups: [{ id: 'g0', ordinal: 1 }],
		};
		const result = selectFirstMatchChildren([losing, winning], flat);
		expect(result.map((c) => c.name)).toStrictEqual(['winning']);
	});

	it(
		"a DIFFERENT (independent) group is unaffected by another group's own " +
			"winner (cycle-matrix's shape: several independently-guarded siblings, " +
			'not one mutually exclusive family)',
		() => {
			const flat: PptxSmartArtNode[] = [{ id: '1', text: 'A' }];
			const children = [
				child('a1', [{ id: 'g0', ordinal: 0 }]),
				child('a2', [{ id: 'g0', ordinal: 1 }]),
				child('b1', [{ id: 'g1', ordinal: 0 }]),
				child('b2', [{ id: 'g1', ordinal: 1 }]),
			];
			expect(selectFirstMatchChildren(children, flat).map((c) => c.name)).toStrictEqual([
				'a1',
				'b1',
			]);
		},
	);

	it(
		'a NESTED group (two levels of chooseGroups) only resolves once the ' +
			'outer group has already picked a winner',
		() => {
			const flat: PptxSmartArtNode[] = [
				{ id: '1', text: 'A' },
				{ id: '2', text: 'B' },
			];
			const children = [
				child('outerLoser', [{ id: 'g0', ordinal: 0, guard: guard('equ', '99') }]),
				child('innerA', [
					{ id: 'g0', ordinal: 1 },
					{ id: 'g1', ordinal: 0, guard: guard('equ', '2') },
				]),
				child('innerB', [
					{ id: 'g0', ordinal: 1 },
					{ id: 'g1', ordinal: 1 },
				]),
			];
			// g0: ordinal 0 is false (nodeCount=2), ordinal 1 wins - both innerA and
			// innerB share it. Within g1: innerA's ordinal 0 ("equ 2") is TRUE, wins.
			expect(selectFirstMatchChildren(children, flat).map((c) => c.name)).toStrictEqual(['innerA']);
		},
	);

	it('a group with no decidable winner is permissive (keeps every member, matching the pre-existing "undecidable defaults to allow" convention)', () => {
		const flat: PptxSmartArtNode[] = [{ id: '1', text: 'A' }];
		const children = [
			child('one', [
				{
					id: 'g0',
					ordinal: 0,
					guard: { function: 'var', argument: 'unknown', operator: 'equ', value: 'x' },
				},
			]),
		];
		expect(selectFirstMatchChildren(children, flat).map((c) => c.name)).toStrictEqual(['one']);
	});
});
