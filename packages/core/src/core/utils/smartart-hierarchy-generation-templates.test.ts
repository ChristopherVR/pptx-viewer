import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtConstraint,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
} from '../types';
import { buildConstraintIndex, EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { resolveHierarchyGenerationTemplates } from './smartart-hierarchy-generation-templates';

function constr(overrides: Partial<PptxSmartArtConstraint>): PptxSmartArtConstraint {
	return { type: 'w', ...overrides };
}

/**
 * `hierarchy-list--hier5.pptx`'s own real shape (trimmed to what this module
 * reads): `diagram` (the `hierChild`-typed arranger) declares `rootComposite`
 * as its OWN full `w`, half that as `h`, and `childText` as `0.8x`/`1x` that
 * SAME composite's `w`/`h` - a chain neither end of which is a direct
 * self-reference, so `resolveHierarchyItemNode`'s narrower
 * `resolveAspectRatio` search cannot read it (see this module's own doc
 * comment). `rootComposite` in turn gives its own `w`/`h` straight through to
 * `rootText` (its own `ch`-scoped constrLst) - the genuine two-shape wrapper
 * shape. `childShape` (nested `hierChild`, the recursion boundary) wraps
 * `childText` directly, matching the real `childShape -> forEach -> childText`
 * nesting once forEach is flattened.
 */
function hierarchyListLikeDefinition(): PptxSmartArtLayoutDefinition {
	return {
		rootNode: {
			name: 'diagram',
			algorithm: { type: 'hierChild' },
			constraints: [
				constr({ type: 'w', for: 'des', forName: 'rootComposite', referenceType: 'w' }),
				constr({
					type: 'h',
					for: 'des',
					forName: 'rootComposite',
					referenceType: 'w',
					factor: 0.5,
				}),
				constr({
					type: 'w',
					for: 'des',
					forName: 'childText',
					referenceType: 'w',
					referenceFor: 'des',
					referenceForName: 'rootComposite',
					factor: 0.8,
				}),
				constr({
					type: 'h',
					for: 'des',
					forName: 'childText',
					referenceType: 'h',
					referenceFor: 'des',
					referenceForName: 'rootComposite',
				}),
				constr({
					type: 'sibSp',
					for: 'des',
					forName: 'childShape',
					referenceType: 'h',
					referenceFor: 'des',
					referenceForName: 'childText',
					factor: 0.25,
				}),
			],
			children: [
				{
					name: 'root',
					algorithm: { type: 'hierRoot' },
					children: [
						{
							name: 'rootComposite',
							algorithm: { type: 'composite' },
							constraints: [
								constr({ type: 'w', for: 'ch', forName: 'rootText', referenceType: 'w' }),
								constr({ type: 'h', for: 'ch', forName: 'rootText', referenceType: 'h' }),
							],
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
	};
}

/** A plain "Hierarchy"-family shape: ONE `tx`+shape descendant, no split. */
function singleTemplateNode(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild' },
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [{ name: 'text', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } }],
			},
		],
	};
}

/**
 * `name-and-title-organization-chart--hier5.pptx`'s own shape: a SECOND
 * `tx`+shape descendant (`titleText1`) sharing `rootText1`'s OWN composite -
 * neither ever crosses a nested `hierChild`, so both land in "root scope"
 * and no split should fire.
 */
function compoundTextRoleNode(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild' },
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [
					{
						name: 'rootComposite1',
						algorithm: { type: 'composite' },
						children: [
							{ name: 'rootText1', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
							{ name: 'titleText1', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
						],
					},
				],
			},
		],
	};
}

describe('resolveHierarchyGenerationTemplates', () => {
	it('splits root (rootText) from descendant (childText) with the declared size factors - hierarchy-list--hier5.pptx', () => {
		const definition = hierarchyListLikeDefinition();
		const index = buildConstraintIndex(definition);
		const templates = resolveHierarchyGenerationTemplates(definition.rootNode, index);
		expect(templates?.descendant.name).toBe('childText');
		expect(templates?.root?.name).toBe('rootText');
		// Cached ground truth: childText 179x112, rootText/rootComposite 224x112 -
		// widthFactor 224/179 ~= 1.25, heightFactor 112/112 = 1.
		expect(templates?.root?.widthFactor).toBeCloseTo(1.25, 2);
		expect(templates?.root?.heightFactor).toBeCloseTo(1, 2);
	});

	it('returns no root entry for a single-template layout (ordinary "Hierarchy" family)', () => {
		const templates = resolveHierarchyGenerationTemplates(
			singleTemplateNode(),
			EMPTY_CONSTRAINT_INDEX,
		);
		expect(templates?.descendant.name).toBe('text');
		expect(templates?.root).toBeUndefined();
	});

	it('returns no root entry when a second candidate shares the root composite (name-and-title-organization-chart, no hierChild crossing)', () => {
		const templates = resolveHierarchyGenerationTemplates(
			compoundTextRoleNode(),
			EMPTY_CONSTRAINT_INDEX,
		);
		expect(templates?.descendant.name).toBe('rootText1');
		expect(templates?.root).toBeUndefined();
	});

	it('returns undefined for a layoutDef with no tx+shape descendant at all', () => {
		expect(
			resolveHierarchyGenerationTemplates(
				{ name: 'hierChild1', algorithm: { type: 'hierChild' } },
				EMPTY_CONSTRAINT_INDEX,
			),
		).toBeUndefined();
	});
});
