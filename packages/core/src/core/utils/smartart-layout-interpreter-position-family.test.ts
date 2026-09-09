import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtWhen } from '../types';
import {
	detectPositionFamily,
	hasPositionGuard,
} from './smartart-layout-interpreter-position-family';

function posGuard(value: string): PptxSmartArtWhen {
	return { function: 'pos', operator: 'equ', value };
}

function cntGuard(value: string): PptxSmartArtWhen {
	return { function: 'cnt', operator: 'gte', value };
}

describe('hasPositionGuard', () => {
	it('false for a node with no chooseGuard', () => {
		expect(hasPositionGuard({ name: 'leaf' })).toBeFalsy();
	});

	it('false for a chooseGuard chain with no pos condition', () => {
		expect(hasPositionGuard({ name: 'leaf', chooseGuard: [cntGuard('1')] })).toBeFalsy();
	});

	it("true for sub-step-process--hier5.pptx's chLin1 shape: [pos==1, cnt>=1]", () => {
		expect(
			hasPositionGuard({ name: 'chLin1', chooseGuard: [posGuard('1'), cntGuard('1')] }),
		).toBeTruthy();
	});
});

describe('detectPositionFamily', () => {
	it('undefined when the parent has no children', () => {
		expect(detectPositionFamily({ name: 'parent' }, 'lin')).toBeUndefined();
	});

	it('undefined when only ONE child is pos-guarded (needs 2+ to be a family)', () => {
		const parent: PptxSmartArtLayoutNode = {
			name: 'parent',
			children: [
				{ name: 'chLin1', algorithm: { type: 'lin' }, chooseGuard: [posGuard('1'), cntGuard('1')] },
				{ name: 'other', algorithm: { type: 'lin' } },
			],
		};
		expect(detectPositionFamily(parent, 'lin')).toBeUndefined();
	});

	it(
		"sub-step-process--hier5.pptx's real shape: chLin1..chLin7, sorted ascending by pos " +
			'(fed out of document order to prove the sort, not just pass-through)',
		() => {
			const make = (n: number): PptxSmartArtLayoutNode => ({
				name: `chLin${n}`,
				algorithm: { type: 'lin' },
				chooseGuard: [posGuard(String(n)), cntGuard('1')],
			});
			const parent: PptxSmartArtLayoutNode = {
				name: 'Name0',
				children: [make(3), make(1), make(2)],
			};
			const family = detectPositionFamily(parent, 'lin');
			expect(family?.map((n) => n.name)).toStrictEqual(['chLin1', 'chLin2', 'chLin3']);
		},
	);

	it('undefined when the algorithm.type does not match', () => {
		const parent: PptxSmartArtLayoutNode = {
			name: 'parent',
			children: [
				{ name: 'a', algorithm: { type: 'cycle' }, chooseGuard: [posGuard('1'), cntGuard('1')] },
				{ name: 'b', algorithm: { type: 'cycle' }, chooseGuard: [posGuard('2'), cntGuard('1')] },
			],
		};
		expect(detectPositionFamily(parent, 'lin')).toBeUndefined();
	});

	it('undefined when the non-pos guard shape differs between candidates (not a genuine family)', () => {
		const parent: PptxSmartArtLayoutNode = {
			name: 'parent',
			children: [
				{ name: 'a', algorithm: { type: 'lin' }, chooseGuard: [posGuard('1'), cntGuard('1')] },
				{ name: 'b', algorithm: { type: 'lin' }, chooseGuard: [posGuard('2'), cntGuard('2')] },
			],
		};
		expect(detectPositionFamily(parent, 'lin')).toBeUndefined();
	});

	it('undefined when two candidates share the same pos value (ambiguous, not a real family)', () => {
		const parent: PptxSmartArtLayoutNode = {
			name: 'parent',
			children: [
				{ name: 'a', algorithm: { type: 'lin' }, chooseGuard: [posGuard('1'), cntGuard('1')] },
				{ name: 'b', algorithm: { type: 'lin' }, chooseGuard: [posGuard('1'), cntGuard('1')] },
			],
		};
		expect(detectPositionFamily(parent, 'lin')).toBeUndefined();
	});
});
