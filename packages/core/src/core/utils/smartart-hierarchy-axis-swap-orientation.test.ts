import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { adjustOrientationForAxisSwap } from './smartart-hierarchy-axis-swap-orientation';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation-types';

const baseOrientation: HierarchyOrientation = {
	transposed: false,
	sibSpRatio: 0.15,
	aspectRatio: 0.667,
	generationGapRatio: 0.25,
	compositeGenerationGapRatio: 0.25,
	hangHeightRatio: 0.25,
	marginXRatio: 0.0491,
	marginYRatio: 0.0707,
	cardOffsetXRatio: 0,
};

/**
 * `horizontal-labeled-hierarchy--hier5.pptx`'s own real shape (trimmed to
 * what this module reads): the generation gap is declared on an ANCESTOR
 * `mainComposite` wrapper (`sp for="des" refType="w" refFor="des"
 * refForName="level1Shape" fact="0.4"`), never on `hierChild1` itself - only
 * `resolveGenerationGapRatio`'s own whole-index ancestor search
 * (`smartart-hierarchy-generation-gap.ts`) finds it.
 */
function labeledHierarchyLikeDefinition(): PptxSmartArtLayoutDefinition {
	return {
		rootNode: {
			name: 'mainComposite',
			algorithm: { type: 'composite' },
			constraints: [
				{
					type: 'sp',
					for: 'des',
					referenceType: 'w',
					referenceFor: 'des',
					referenceForName: 'level1Shape',
					factor: 0.4,
				},
			],
			children: [
				{
					name: 'hierChild1',
					algorithm: { type: 'hierChild' },
					children: [
						{ name: 'level1Shape', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
					],
				},
			],
		},
	};
}

describe('adjustOrientationForAxisSwap', () => {
	it('inverts aspectRatio and re-resolves the generation-gap fields on stacking axis "w" (the ancestor-declared 0.4)', () => {
		const definition = labeledHierarchyLikeDefinition();
		const index = buildConstraintIndex(definition);
		const hierChild1 = definition.rootNode.children?.[0];
		const adjusted = adjustOrientationForAxisSwap(
			baseOrientation,
			hierChild1,
			index,
			'level1Shape',
		);
		expect(adjusted.aspectRatio).toBeCloseTo(1 / 0.667, 6);
		expect(adjusted.generationGapRatio).toBeCloseTo(0.4, 6);
		expect(adjusted.compositeGenerationGapRatio).toBeCloseTo(0.4, 6);
		expect(adjusted.hangHeightRatio).toBeCloseTo(0.4, 6);
	});

	it('leaves marginXRatio/marginYRatio/sibSpRatio/cardOffsetXRatio untouched (no axis-cross meaning)', () => {
		const definition = labeledHierarchyLikeDefinition();
		const index = buildConstraintIndex(definition);
		const hierChild1 = definition.rootNode.children?.[0];
		const adjusted = adjustOrientationForAxisSwap(
			baseOrientation,
			hierChild1,
			index,
			'level1Shape',
		);
		expect(adjusted.marginXRatio).toBe(baseOrientation.marginXRatio);
		expect(adjusted.marginYRatio).toBe(baseOrientation.marginYRatio);
		expect(adjusted.sibSpRatio).toBe(baseOrientation.sibSpRatio);
		expect(adjusted.cardOffsetXRatio).toBe(baseOrientation.cardOffsetXRatio);
	});

	it('returns the orientation unchanged when already transposed (the "Horizontal Hierarchy" branch owns its own ratios)', () => {
		const transposedOrientation: HierarchyOrientation = { ...baseOrientation, transposed: true };
		const definition = labeledHierarchyLikeDefinition();
		const index = buildConstraintIndex(definition);
		const hierChild1 = definition.rootNode.children?.[0];
		const adjusted = adjustOrientationForAxisSwap(
			transposedOrientation,
			hierChild1,
			index,
			'level1Shape',
		);
		expect(adjusted).toBe(transposedOrientation);
	});

	it('falls back to DEFAULT_GENERATION_GAP_RATIO when no sp constraint resolves on either axis', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'hierChild1',
				algorithm: { type: 'hierChild' },
				children: [
					{ name: 'level1Shape', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const adjusted = adjustOrientationForAxisSwap(
			baseOrientation,
			definition.rootNode,
			index,
			'level1Shape',
		);
		expect(adjusted.generationGapRatio).toBeCloseTo(0.25, 6);
	});
});
