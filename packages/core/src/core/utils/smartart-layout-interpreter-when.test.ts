import { describe, expect, it } from 'vitest';

import type { PptxSmartArtWhen } from '../types';
import { evaluateWhen } from './smartart-layout-interpreter-when';
import type { WhenContext } from './smartart-layout-interpreter-when';

function when(fn: string, operator: string, value: string, argument?: string): PptxSmartArtWhen {
	return { function: fn, operator, value, ...(argument ? { argument } : {}) };
}

// G8: `dgm:if/@func` beyond the pre-existing `cnt` support.
describe('evaluateWhen', () => {
	it('cnt: unaffected by the new context param (regression check)', () => {
		expect(evaluateWhen(when('cnt', 'equ', '3'), 3, {})).toBeTruthy();
		expect(evaluateWhen(when('cnt', 'gt', '3'), 5, {})).toBeTruthy();
	});

	it('pos: decides against context.position with every operator', () => {
		const ctx: WhenContext = { position: 3 };
		expect(evaluateWhen(when('pos', 'equ', '3'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('pos', 'neq', '3'), 0, ctx)).toBeFalsy();
		expect(evaluateWhen(when('pos', 'gt', '2'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('pos', 'lt', '2'), 0, ctx)).toBeFalsy();
		expect(evaluateWhen(when('pos', 'gte', '3'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('pos', 'lte', '3'), 0, ctx)).toBeTruthy();
	});

	it('pos: undecidable without context.position', () => {
		expect(evaluateWhen(when('pos', 'equ', '1'), 0, {})).toBeUndefined();
	});

	it('revPos: measures from the end using total and position', () => {
		// 5 siblings, position 4 -> revPos = 5-4+1 = 2 (second from last).
		const ctx: WhenContext = { position: 4, total: 5 };
		expect(evaluateWhen(when('revPos', 'equ', '2'), 0, ctx)).toBeTruthy();
		// The very last item (position === total) has revPos === 1.
		expect(evaluateWhen(when('revPos', 'equ', '1'), 0, { position: 5, total: 5 })).toBeTruthy();
	});

	it('revPos: undecidable without both position and total', () => {
		expect(evaluateWhen(when('revPos', 'equ', '1'), 0, { position: 1 })).toBeUndefined();
		expect(evaluateWhen(when('revPos', 'equ', '1'), 0, { total: 5 })).toBeUndefined();
	});

	it('posEven/posOdd: decide against context.position parity', () => {
		expect(evaluateWhen(when('posEven', 'equ', '1'), 0, { position: 2 })).toBeTruthy();
		expect(evaluateWhen(when('posEven', 'equ', '1'), 0, { position: 3 })).toBeFalsy();
		expect(evaluateWhen(when('posOdd', 'equ', '1'), 0, { position: 3 })).toBeTruthy();
		expect(evaluateWhen(when('posOdd', 'equ', '1'), 0, { position: 2 })).toBeFalsy();
	});

	it('posEven/posOdd: undecidable without context.position', () => {
		expect(evaluateWhen(when('posEven', 'equ', '1'), 0, {})).toBeUndefined();
	});

	it('depth/maxDepth: decide against their own context fields', () => {
		expect(evaluateWhen(when('depth', 'gt', '1'), 0, { depth: 2 })).toBeTruthy();
		expect(evaluateWhen(when('depth', 'gt', '1'), 0, {})).toBeUndefined();
		expect(evaluateWhen(when('maxDepth', 'equ', '3'), 0, { maxDepth: 3 })).toBeTruthy();
		expect(evaluateWhen(when('maxDepth', 'equ', '3'), 0, {})).toBeUndefined();
	});

	it('var: compares a string presLayoutVars field by equality', () => {
		const ctx: WhenContext = { presLayoutVars: { direction: 'rev' } };
		expect(evaluateWhen(when('var', 'equ', 'rev', 'dir'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('var', 'neq', 'norm', 'dir'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('var', 'equ', 'norm', 'dir'), 0, ctx)).toBeFalsy();
	});

	it('var: compares a boolean presLayoutVars field by equality', () => {
		const ctx: WhenContext = { presLayoutVars: { orgChart: true } };
		expect(evaluateWhen(when('var', 'equ', 'true', 'orgChart'), 0, ctx)).toBeTruthy();
	});

	it('var: compares a numeric presLayoutVars field with ordering operators', () => {
		const ctx: WhenContext = { presLayoutVars: { childMax: 4 } };
		expect(evaluateWhen(when('var', 'gt', '3', 'chMax'), 0, ctx)).toBeTruthy();
		expect(evaluateWhen(when('var', 'lte', '4', 'chMax'), 0, ctx)).toBeTruthy();
	});

	it('var: undecidable without presLayoutVars, an unknown @arg, or a gt/lt op on a string field', () => {
		expect(evaluateWhen(when('var', 'equ', 'rev', 'dir'), 0, {})).toBeUndefined();
		expect(
			evaluateWhen(when('var', 'equ', 'x', 'notAVariable'), 0, {
				presLayoutVars: { direction: 'rev' },
			}),
		).toBeUndefined();
		expect(
			evaluateWhen(when('var', 'gt', 'norm', 'dir'), 0, { presLayoutVars: { direction: 'rev' } }),
		).toBeUndefined();
	});

	it('unknown func returns undefined (keeps the caller on its blind fallback)', () => {
		expect(evaluateWhen(when('bogus', 'equ', '1'), 3, {})).toBeUndefined();
	});
});
