import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition } from '../types';
import { resolveByAncestorChain } from './smartart-constraint-declared-by';
import { buildConstraintIndex } from './smartart-constraint-solver';

describe('resolveByAncestorChain', () => {
	it("finds a type-typed constraint declared by the nearest ancestor in the chain (radial-cluster's own Name0 userS, cycle_3 is the arranger)", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					{
						type: 'userS',
						for: 'des',
						pointType: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'textCenter',
						factor: 0.67,
					},
				],
				children: [
					{ name: 'textCenter' },
					{
						name: 'cycle_3',
						// cycle_3's own constrLst carries no `userS` at all.
						constraints: [{ type: 'sp', factor: 0.3 }],
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const found = resolveByAncestorChain(index, 'userS', ['cycle_3', 'Name0']);
		expect(found?.declaringRole).toBe('Name0');
		expect(found?.constraint.referenceForName).toBe('textCenter');
		expect(found?.constraint.factor).toBe(0.67);
	});

	it('disambiguates by declaring role: an UNRELATED branch declaring the same type is skipped when it is not in the chain', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					{
						type: 'userS',
						for: 'des',
						pointType: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'textCenter',
						factor: 0.67,
					},
				],
				children: [
					{
						name: 'singleCycle',
						constraints: [
							{
								type: 'userS',
								for: 'ch',
								pointType: 'node',
								referenceType: 'w',
								referenceFor: 'ch',
								referenceForName: 'singleCenter',
								factor: 0.67,
							},
						],
					},
					{ name: 'cycle_3' },
				],
			},
		};
		const index = buildConstraintIndex(definition);
		// `cycle_3`'s real ancestor chain never includes `singleCycle` (a
		// sibling branch, not an ancestor) - only `Name0`'s own declaration
		// should ever be found for this chain.
		const found = resolveByAncestorChain(index, 'userS', ['cycle_3', 'Name0']);
		expect(found?.declaringRole).toBe('Name0');
		expect(found?.constraint.referenceForName).toBe('textCenter');
	});

	it('returns undefined when no candidate is declared by any role in the chain', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				children: [
					{
						name: 'singleCycle',
						constraints: [
							{ type: 'userS', referenceType: 'w', referenceForName: 'singleCenter', factor: 0.67 },
						],
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(resolveByAncestorChain(index, 'userS', ['cycle_3', 'Name0'])).toBeUndefined();
	});

	it('honours an optionalMatch filter, skipping a same-type candidate that fails it', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					// No `referenceForName` at all - fails a filter requiring one.
					{ type: 'userS', factor: 0.5 },
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const found = resolveByAncestorChain(index, 'userS', ['Name0'], (c) =>
			Boolean(c.referenceForName),
		);
		expect(found).toBeUndefined();
	});

	it('prefers the nearest ancestor over a farther one that also declares the type', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [{ type: 'userS', referenceForName: 'farHub', factor: 0.9 }],
				children: [
					{
						name: 'mid',
						constraints: [{ type: 'userS', referenceForName: 'nearHub', factor: 0.5 }],
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const found = resolveByAncestorChain(index, 'userS', ['mid', 'Name0']);
		expect(found?.declaringRole).toBe('mid');
		expect(found?.constraint.referenceForName).toBe('nearHub');
	});
});
