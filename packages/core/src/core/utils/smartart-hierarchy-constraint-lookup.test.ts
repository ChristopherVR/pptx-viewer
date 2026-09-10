import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import {
	DEFAULT_ASPECT_RATIO,
	findByReference,
	resolveAspectRatio,
} from './smartart-hierarchy-constraint-lookup';

/**
 * `horizontal-multi-level-hierarchy--hier5.pptx`'s own real top-level
 * constrLst: `LevelOneTextNode` (the root's own item) is declared FIRST, so a
 * name-blind search picks its `w:h=0.19` (tall/narrow) over the item most
 * generations actually render, `LevelTwoTextNode`'s own `w:h=3.28` (wide/short).
 */
const TWO_TEMPLATE_CONSTRAINTS: PptxSmartArtLayoutNode['constraints'] = [
	{ type: 'h', for: 'des', forName: 'LevelOneTextNode', referenceType: 'h' },
	{
		type: 'w',
		for: 'des',
		forName: 'LevelOneTextNode',
		referenceType: 'h',
		referenceFor: 'des',
		referenceForName: 'LevelOneTextNode',
		factor: 0.19,
	},
	{
		type: 'h',
		for: 'des',
		forName: 'LevelTwoTextNode',
		referenceType: 'w',
		referenceFor: 'des',
		referenceForName: 'LevelOneTextNode',
	},
	{
		type: 'w',
		for: 'des',
		forName: 'LevelTwoTextNode',
		referenceType: 'h',
		referenceFor: 'des',
		referenceForName: 'LevelTwoTextNode',
		factor: 3.28,
	},
];

describe('findByReference', () => {
	it('returns the first document-order match when no preferredName is given (unchanged pre-SESSION-29 behaviour)', () => {
		expect(findByReference(TWO_TEMPLATE_CONSTRAINTS, 'w', 'h')).toBeCloseTo(0.19, 6);
	});

	it("returns the NAMED match's own factor when preferredName is given and a match exists", () => {
		expect(findByReference(TWO_TEMPLATE_CONSTRAINTS, 'w', 'h', 'LevelTwoTextNode')).toBeCloseTo(
			3.28,
			6,
		);
	});

	it('falls back to the plain first match when preferredName matches nothing', () => {
		expect(findByReference(TWO_TEMPLATE_CONSTRAINTS, 'w', 'h', 'NoSuchName')).toBeCloseTo(0.19, 6);
	});
});

describe('resolveAspectRatio', () => {
	it('picks the first-declared item (LevelOneTextNode, 1/0.19) with no preferredName', () => {
		expect(resolveAspectRatio(TWO_TEMPLATE_CONSTRAINTS)).toBeCloseTo(1 / 0.19, 6);
	});

	it("picks LevelTwoTextNode's own h:w (1/3.28) when preferredName resolves to it - horizontal-multi-level-hierarchy--hier5.pptx's own fix (SESSION 29)", () => {
		expect(resolveAspectRatio(TWO_TEMPLATE_CONSTRAINTS, 'LevelTwoTextNode')).toBeCloseTo(
			1 / 3.28,
			6,
		);
	});

	it('keeps the DEFAULT_ASPECT_RATIO fallback when constraints declare neither h:w nor w:h at all', () => {
		expect(resolveAspectRatio([], 'AnyName')).toBe(DEFAULT_ASPECT_RATIO);
	});
});
