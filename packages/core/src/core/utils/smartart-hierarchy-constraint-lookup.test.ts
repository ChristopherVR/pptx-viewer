import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtConstraint,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
} from '../types';
import { buildConstraintIndex, EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import {
	DEFAULT_ASPECT_RATIO,
	findByReference,
	findDirectAspectRatio,
	resolveAspectRatio,
	resolveIndexedAspectRatio,
} from './smartart-hierarchy-constraint-lookup';

function constr(overrides: Partial<PptxSmartArtConstraint>): PptxSmartArtConstraint {
	return { type: 'w', ...overrides };
}

/**
 * `titled-picture-accent-list--hier5.pptx`'s own real shape (trimmed to what
 * `resolveIndexedAspectRatio` reads): `rootComposite`'s own `w`/`h` are
 * declared as two INDEPENDENT references (`w` to the enclosing scope's own
 * `w`, `fact=4`; `h` to the enclosing scope's own `h`, no `fact` = 1), never
 * to each other - `findDirectAspectRatio` cannot read this (no cross-type
 * `h:w`/`w:h` declaration exists at all), but the general reference-chain
 * walker resolves both (`w -> 4`, `h -> 1`, both ultimately against the
 * implicit whole-diagram unit box) and their ratio (`1/4 = 0.25`) is the
 * real declared aspect.
 */
function titledPictureAccentListLikeDefinition(): PptxSmartArtLayoutDefinition {
	return {
		rootNode: {
			name: 'layout',
			algorithm: { type: 'hierChild' },
			constraints: [
				constr({ type: 'w', for: 'des', forName: 'rootComposite', referenceType: 'w', factor: 4 }),
				constr({ type: 'h', for: 'des', forName: 'rootComposite', referenceType: 'h' }),
			],
			children: [
				{
					name: 'root',
					algorithm: { type: 'hierRoot' },
					children: [
						{
							name: 'rootComposite',
							algorithm: { type: 'composite' },
							children: [
								{
									name: 'rootText',
									algorithm: { type: 'tx' },
									shape: { presetGeometry: 'roundRect' },
								},
							],
						},
						{
							name: 'childShape',
							algorithm: { type: 'hierChild' },
							children: [
								{
									name: 'childComposite',
									algorithm: { type: 'composite' },
									children: [
										{
											name: 'childText',
											algorithm: { type: 'tx' },
											shape: { presetGeometry: 'roundRect' },
										},
									],
								},
							],
						},
					],
				},
			],
		},
	};
}

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

describe('findDirectAspectRatio', () => {
	it('returns undefined (not DEFAULT_ASPECT_RATIO) when constraints declare neither h:w nor w:h', () => {
		expect(findDirectAspectRatio([], 'AnyName')).toBeUndefined();
	});

	it('still finds a direct h:w declaration, matching resolveAspectRatio', () => {
		expect(findDirectAspectRatio(TWO_TEMPLATE_CONSTRAINTS)).toBeCloseTo(1 / 0.19, 6);
	});
});

describe('resolveIndexedAspectRatio', () => {
	it("resolves the wrapping composite's own two independently-referenced w/h into a ratio - titled-picture-accent-list--hier5.pptx's own rootComposite (w=4, h=1, ratio 0.25)", () => {
		const definition = titledPictureAccentListLikeDefinition();
		const index = buildConstraintIndex(definition);
		expect(resolveIndexedAspectRatio(definition.rootNode, index)).toBeCloseTo(0.25, 6);
	});

	it('returns undefined when algorithmNode declares no composite descendant at all (e.g. the transposed "Horizontal Hierarchy" family)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'hierChild1',
			algorithm: { type: 'hierChild' },
			children: [{ name: 'text', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } }],
		};
		expect(resolveIndexedAspectRatio(node, EMPTY_CONSTRAINT_INDEX)).toBeUndefined();
	});

	it('returns undefined when the composite node is unnamed or its w/h cannot be resolved', () => {
		const definition = titledPictureAccentListLikeDefinition();
		// EMPTY_CONSTRAINT_INDEX: no declared constraints to resolve w/h from,
		// and the composite's own role has no rootRole fallback either.
		expect(resolveIndexedAspectRatio(definition.rootNode, EMPTY_CONSTRAINT_INDEX)).toBeUndefined();
	});
});
