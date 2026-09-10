import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import {
	isDesRootedFontRole,
	isPrimFontSzRoleSplitItem,
	siblingRolesDeclaringType,
} from './smartart-constraint-sibling-roles';
import { buildConstraintIndex } from './smartart-constraint-solver';

describe('siblingRolesDeclaringType', () => {
	it("finds every role name an arranger declares an 'h' constraint for, including a non-text sibling (spacer)", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'linear',
				algorithm: { type: 'lin' },
				children: [{ name: 'parentText' }, { name: 'childText' }, { name: 'spacer' }],
				constraints: [
					{
						type: 'h',
						for: 'ch',
						forName: 'parentText',
						referenceType: 'primFontSz',
						referenceFor: 'ch',
						referenceForName: 'parentText',
						factor: 0.52,
					},
					{
						type: 'h',
						for: 'ch',
						forName: 'childText',
						referenceType: 'primFontSz',
						referenceFor: 'ch',
						referenceForName: 'parentText',
						factor: 0.46,
					},
					{
						type: 'h',
						for: 'ch',
						forName: 'spacer',
						referenceType: 'primFontSz',
						referenceFor: 'ch',
						referenceForName: 'parentText',
						factor: 0.08,
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const roles = siblingRolesDeclaringType(index, 'linear', 'h');
		expect(new Set(roles)).toStrictEqual(new Set(['parentText', 'childText', 'spacer']));
	});

	it('returns an empty list when the declaring role declares no constraint of that type', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: { name: 'diagram', algorithm: { type: 'lin' } },
		};
		const index = buildConstraintIndex(definition);
		expect(siblingRolesDeclaringType(index, 'diagram', 'h')).toStrictEqual([]);
	});

	it("does not pick up a DIFFERENT role's own declaration of the same type", () => {
		const outer: PptxSmartArtLayoutNode = {
			name: 'outer',
			constraints: [{ type: 'h', for: 'ch', forName: 'a', factor: 0.5 }],
		};
		const inner: PptxSmartArtLayoutNode = {
			name: 'a',
			children: [{ name: 'b', constraints: [{ type: 'h', for: 'ch', forName: 'c', factor: 0.9 }] }],
		};
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: { name: 'root', algorithm: { type: 'lin' }, children: [outer, inner] },
		};
		const index = buildConstraintIndex(definition);
		expect(siblingRolesDeclaringType(index, 'outer', 'h')).toStrictEqual(['a']);
	});
});

/** "Vertical Bullet List"'s own real shape: `parentText`/`childText`/`spacer`, every `h` primFontSz-relative to `parentText`, `parentText`'s own `primFontSz` a LITERAL ceiling. */
const verticalBulletListLike = (): PptxSmartArtLayoutDefinition => ({
	rootNode: {
		name: 'linear',
		algorithm: { type: 'lin' },
		children: [{ name: 'parentText' }, { name: 'childText' }, { name: 'spacer' }],
		constraints: [
			{
				type: 'h',
				for: 'ch',
				forName: 'parentText',
				referenceType: 'primFontSz',
				referenceFor: 'ch',
				referenceForName: 'parentText',
				factor: 0.52,
			},
			{
				type: 'h',
				for: 'ch',
				forName: 'childText',
				referenceType: 'primFontSz',
				referenceFor: 'ch',
				referenceForName: 'parentText',
				factor: 0.46,
			},
			{
				type: 'h',
				for: 'ch',
				forName: 'spacer',
				referenceType: 'primFontSz',
				referenceFor: 'ch',
				referenceForName: 'parentText',
				factor: 0.08,
			},
			{ type: 'primFontSz', for: 'ch', forName: 'parentText', value: 65 },
		],
	},
});

/**
 * Round 25: "Vertical Box List"'s own real shape - `parentLin` (a nested
 * `lin` wrapper, `h val="INF"` literal, content-sized), `parentText`
 * (nested inside `parentLin`, `for="des"`, self-referential primFontSz
 * weight), `childText`/`negativeSpace`/`spaceBetweenRectangles` (flat
 * `for="ch"` siblings of `parentLin`, ALL primFontSz-relative to
 * `parentText` via `refFor="des"`, `negativeSpace`'s own factor NEGATIVE).
 * Both the content-sized wrapper and the negative factor previously broke
 * the "every declared role is primFontSz-anchored" check.
 */
const verticalBoxListLike = (): PptxSmartArtLayoutDefinition => ({
	rootNode: {
		name: 'linear',
		algorithm: { type: 'lin' },
		children: [
			{ name: 'parentLin', children: [{ name: 'parentText' }] },
			{ name: 'negativeSpace' },
			{ name: 'childText' },
			{ name: 'spaceBetweenRectangles' },
		],
		constraints: [
			{ type: 'h', for: 'ch', forName: 'parentLin', value: Number.POSITIVE_INFINITY },
			{
				type: 'h',
				for: 'des',
				forName: 'parentText',
				referenceType: 'primFontSz',
				referenceFor: 'des',
				referenceForName: 'parentText',
				factor: 0.82,
			},
			{
				type: 'h',
				for: 'ch',
				forName: 'negativeSpace',
				referenceType: 'primFontSz',
				referenceFor: 'des',
				referenceForName: 'parentText',
				factor: -0.41,
			},
			{
				type: 'h',
				for: 'ch',
				forName: 'childText',
				referenceType: 'primFontSz',
				referenceFor: 'des',
				referenceForName: 'parentText',
				factor: 0.7,
			},
			{ type: 'primFontSz', for: 'des', forName: 'parentText', value: 65 },
			{
				type: 'h',
				for: 'ch',
				forName: 'spaceBetweenRectangles',
				referenceType: 'primFontSz',
				referenceFor: 'des',
				referenceForName: 'parentText',
				factor: 0.15,
			},
		],
	},
});

describe('isPrimFontSzRoleSplitItem', () => {
	it('is true for "Vertical Bullet List"\'s own shape (round 22/23 COM-verified)', () => {
		const index = buildConstraintIndex(verticalBulletListLike());
		expect(isPrimFontSzRoleSplitItem(index, 'linear', 'parentText')).toBeTruthy();
	});

	it('is false for a candidate role the declared weights are NOT anchored on', () => {
		const index = buildConstraintIndex(verticalBulletListLike());
		expect(isPrimFontSzRoleSplitItem(index, 'linear', 'childText')).toBeFalsy();
	});

	it("is false when the driving role's own primFontSz is ITSELF only a reference, not a literal ceiling (round 23: vertical-circle-list--hier5.pptx's nested `lin` regression, txLvl2's primFontSz is 0.78 * txLvl1, never declared literally)", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'lin',
				algorithm: { type: 'lin' },
				children: [{ name: 'txLvl2' }, { name: 'txLvl3' }],
				constraints: [
					{
						type: 'h',
						for: 'ch',
						forName: 'txLvl2',
						referenceType: 'primFontSz',
						referenceFor: 'ch',
						referenceForName: 'txLvl2',
						factor: 0.39,
					},
					{
						type: 'h',
						for: 'ch',
						forName: 'txLvl3',
						referenceType: 'primFontSz',
						referenceFor: 'ch',
						referenceForName: 'txLvl2',
						factor: 0.39,
					},
					// txLvl2's own primFontSz is declared ONLY as a reference (never a literal val).
					{
						type: 'primFontSz',
						referenceType: 'primFontSz',
						referenceFor: 'des',
						referenceForName: 'txLvl1',
						factor: 0.78,
						for: 'des',
						forName: 'txLvl2',
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(isPrimFontSzRoleSplitItem(index, 'lin', 'txLvl2')).toBeFalsy();
	});

	it('is false when the arranger declares no h constraint for any child role at all', () => {
		const index = buildConstraintIndex({
			rootNode: { name: 'diagram', algorithm: { type: 'lin' } },
		});
		expect(isPrimFontSzRoleSplitItem(index, 'diagram', 'node')).toBeFalsy();
	});

	it("is false when a declared role's h is a plain fraction-of-h split, not primFontSz-relative", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'linear',
				algorithm: { type: 'lin' },
				children: [{ name: 'node' }],
				constraints: [
					{ type: 'h', for: 'ch', forName: 'node', referenceType: 'h', factor: 0.5 },
					{ type: 'primFontSz', for: 'ch', forName: 'node', value: 65 },
				],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(isPrimFontSzRoleSplitItem(index, 'linear', 'node')).toBeFalsy();
	});

	it('is true for "Vertical Box List"\'s own shape - a content-sized `for="des"` wrapper role and a negative-factor spacer must not disqualify the match', () => {
		const index = buildConstraintIndex(verticalBoxListLike());
		expect(isPrimFontSzRoleSplitItem(index, 'linear', 'parentText')).toBeTruthy();
	});

	it('is false for "Vertical Box List" when the content-sized wrapper is replaced by an UNRELATED, non-primFontSz, non-INF declaration (the wrapper exemption must not over-match)', () => {
		const definition = verticalBoxListLike();
		definition.rootNode.constraints = definition.rootNode.constraints?.map((constraint) =>
			constraint.forName === 'parentLin'
				? { type: 'h', for: 'ch', forName: 'parentLin', referenceType: 'w', factor: 0.5 }
				: constraint,
		);
		const index = buildConstraintIndex(definition);
		expect(isPrimFontSzRoleSplitItem(index, 'linear', 'parentText')).toBeFalsy();
	});
});

describe('isDesRootedFontRole', () => {
	it('is false for "Vertical Bullet List"\'s own shape - the driving role is a flat `for="ch"` sibling', () => {
		const index = buildConstraintIndex(verticalBulletListLike());
		expect(isDesRootedFontRole(index, 'linear', 'parentText')).toBeFalsy();
	});

	it('is true for "Vertical Box List"\'s own shape - the driving role is declared `for="des"`, nested inside a wrapper', () => {
		const index = buildConstraintIndex(verticalBoxListLike());
		expect(isDesRootedFontRole(index, 'linear', 'parentText')).toBeTruthy();
	});

	it('is false when the arranger declares no h constraint for the role at all', () => {
		const index = buildConstraintIndex({
			rootNode: { name: 'diagram', algorithm: { type: 'lin' } },
		});
		expect(isDesRootedFontRole(index, 'diagram', 'node')).toBeFalsy();
	});
});
