import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtWhen } from '../types';
import { chooseAlgType } from './smartart-layout-interpreter-flow';

function whenNode(
	fn: string,
	operator: string,
	value: string,
	argument?: string,
): PptxSmartArtWhen {
	return { function: fn, operator, value, ...(argument ? { argument } : {}) };
}

describe('chooseAlgType', () => {
	it('stays undecidable on func="cnt" without a matching branch (pre-existing behaviour)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [whenNode('cnt', 'equ', '99')],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			rawXml: {},
		};
		// otherwise branch selects lin, not cycle.
		expect(chooseAlgType(node, 3)).toBe('lin');
	});

	// G8: func="var" is now decidable when the caller supplies presLayoutVars.
	it('func="var" decides its branch from presLayoutVars when context is supplied', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [whenNode('var', 'equ', 'rev', 'dir')],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			rawXml: {},
		};
		// Need the `when` branch's own rawXml too, not just otherwise's.
		node.choose![0].when[0].rawXml = { 'dgm:alg': { '@_type': 'cycle' } };

		const decided = chooseAlgType(node, 3, { presLayoutVars: { direction: 'rev' } });
		expect(decided).toBe('cycle');

		const otherDirection = chooseAlgType(node, 3, { presLayoutVars: { direction: 'norm' } });
		expect(otherDirection).toBe('lin');
	});

	it('func="var" without presLayoutVars context stays undecidable (no regression)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							operator: 'equ',
							value: 'rev',
							argument: 'dir',
							rawXml: { 'dgm:alg': { '@_type': 'cycle' } },
						},
					],
					otherwise: null,
				},
			],
			rawXml: {},
		};
		expect(chooseAlgType(node, 3)).toBeUndefined();
	});
});
