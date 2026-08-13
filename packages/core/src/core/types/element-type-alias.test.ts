/**
 * `PptxElementType` must stay identical to `PptxElement['type']`.
 *
 * It did not. The alias was a hand-written list of 14 string literals in
 * `types/common.ts` while the union had grown to 16 members: `contentPart` and
 * `model3d` were added to {@link PptxElement} and nobody updated the list. A
 * consumer keying a renderer registry or a `Record` off the alias therefore had
 * no way to name those two types, and the compiler agreed with it, because both
 * halves were internally consistent.
 *
 * The alias is now derived, which makes the drift impossible rather than
 * merely fixed. These assertions exist so a future "let me spell the union out
 * for nicer editor hovers" refactor is caught immediately.
 *
 * @module types/element-type-alias.test
 */

import { describe, it, expect } from 'vitest';

import type { PptxElement, PptxElementType } from './elements';

/** Compile-time set equality: both directions, so neither side may grow alone. */
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const ALIAS_MATCHES_UNION: Equals<PptxElementType, PptxElement['type']> = true;

/**
 * Every discriminant, listed by hand ON PURPOSE.
 *
 * This is the one place a literal list is worth keeping: `satisfies` proves the
 * list is a subset of the alias, and the exhaustive `switch` below proves the
 * alias is a subset of the list. Adding a member to {@link PptxElement} without
 * touching this file fails to compile, which is the signal that some registry
 * or `Record` elsewhere probably needs the new member too.
 */
const ALL_ELEMENT_TYPES = [
	'text',
	'shape',
	'connector',
	'image',
	'picture',
	'table',
	'chart',
	'smartArt',
	'ole',
	'media',
	'group',
	'ink',
	'contentPart',
	'zoom',
	'model3d',
	'unknown',
] as const satisfies readonly PptxElementType[];

/** Fails to compile if a discriminant exists that `ALL_ELEMENT_TYPES` omits. */
function assertExhaustive(type: PptxElementType): (typeof ALL_ELEMENT_TYPES)[number] {
	switch (type) {
		case 'text':
		case 'shape':
		case 'connector':
		case 'image':
		case 'picture':
		case 'table':
		case 'chart':
		case 'smartArt':
		case 'ole':
		case 'media':
		case 'group':
		case 'ink':
		case 'contentPart':
		case 'zoom':
		case 'model3d':
		case 'unknown':
			return type;
	}
}

describe('pptxElementType', () => {
	it('is exactly the discriminant union of PptxElement', () => {
		expect(ALIAS_MATCHES_UNION).toBeTruthy();
	});

	it('covers all 16 element types, including contentPart and model3d', () => {
		// The two the hand-written alias had dropped.
		expect(ALL_ELEMENT_TYPES).toContain('contentPart');
		expect(ALL_ELEMENT_TYPES).toContain('model3d');
		expect(new Set(ALL_ELEMENT_TYPES).size).toBe(ALL_ELEMENT_TYPES.length);
		expect(ALL_ELEMENT_TYPES).toHaveLength(16);
	});

	it('round-trips every discriminant through an exhaustive switch', () => {
		for (const type of ALL_ELEMENT_TYPES) {
			expect(assertExhaustive(type)).toBe(type);
		}
	});
});
