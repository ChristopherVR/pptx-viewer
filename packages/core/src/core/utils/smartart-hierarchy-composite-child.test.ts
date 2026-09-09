import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveCompositeChildGeometry } from './smartart-hierarchy-composite-child';

/**
 * `hierarchy--flat3.pptx`'s own real `layout1.xml` shape (trimmed to the
 * fields this module reads): `hierChild1` -> `hierRoot1` -> `composite` ->
 * [`background` (`sp` alg, no text), `text` (`tx` alg, `presOf axis=self`)].
 */
function hierarchyLikeNode(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild' },
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [
					{
						name: 'composite',
						algorithm: { type: 'composite' },
						constraints: [
							{ type: 'w', for: 'ch', forName: 'background', referenceType: 'w', factor: 0.9 },
							{
								type: 'h',
								for: 'ch',
								forName: 'background',
								referenceType: 'w',
								referenceFor: 'ch',
								referenceForName: 'background',
								factor: 0.635,
							},
							{ type: 'w', for: 'ch', forName: 'text', referenceType: 'w', factor: 0.9 },
							{
								type: 'h',
								for: 'ch',
								forName: 'text',
								referenceType: 'w',
								referenceFor: 'ch',
								referenceForName: 'text',
								factor: 0.635,
							},
							{ type: 't', for: 'ch', forName: 'text', referenceType: 'w', factor: 0.095 },
							{ type: 'l', for: 'ch', forName: 'text', referenceType: 'w', factor: 0.1 },
						],
						children: [
							{ name: 'background', algorithm: { type: 'sp' } },
							{ name: 'text', algorithm: { type: 'tx' }, presentationOf: { axis: ['self'] } },
						],
					},
				],
			},
		],
	};
}

describe('resolveCompositeChildGeometry', () => {
	it("reads the TEXT-bearing child's own self-referential h:w (0.635), not the wrapping composite's own (0.667) - hierarchy--flat3/hier5/hier8.pptx COM-verified: all three measure EXACTLY 0.635", () => {
		const geometry = resolveCompositeChildGeometry(hierarchyLikeNode());
		expect(geometry).toBeDefined();
		expect(geometry?.aspectRatio).toBeCloseTo(0.635, 6);
		expect(geometry?.widthFactor).toBeCloseTo(0.9, 6);
		expect(geometry?.offsetXRatio).toBeCloseTo(0.1, 6);
	});

	it('finds the composite node at ANY depth (depth-first search), not just a direct child', () => {
		const wrapped: PptxSmartArtLayoutNode = {
			name: 'outer',
			children: [{ name: 'middle', children: [hierarchyLikeNode()] }],
		};
		const geometry = resolveCompositeChildGeometry(wrapped);
		expect(geometry?.aspectRatio).toBeCloseTo(0.635, 6);
	});

	it('returns undefined for a layout with no `composite`-alg descendant (e.g. "Horizontal Hierarchy", which declares the aspect directly at the top level instead)', () => {
		const horizontalHierarchyLike: PptxSmartArtLayoutNode = {
			name: 'diagram',
			algorithm: { type: 'hierChild' },
			constraints: [{ type: 'w', referenceType: 'h', factor: 2 }],
			children: [
				{
					name: 'root1',
					algorithm: { type: 'hierRoot' },
					children: [{ name: 'LevelOneTextNode', algorithm: { type: 'tx' } }],
				},
			],
		};
		expect(resolveCompositeChildGeometry(horizontalHierarchyLike)).toBeUndefined();
	});

	it('returns undefined when the composite node has no self-referential h constraint for the text-bearing child (missing data, not a guess)', () => {
		const incomplete: PptxSmartArtLayoutNode = {
			name: 'hierChild1',
			children: [
				{
					name: 'composite',
					algorithm: { type: 'composite' },
					constraints: [{ type: 'w', for: 'ch', forName: 'text', referenceType: 'w', factor: 0.9 }],
					children: [{ name: 'text', presentationOf: { axis: ['self'] } }],
				},
			],
		};
		expect(resolveCompositeChildGeometry(incomplete)).toBeUndefined();
	});

	it('returns undefined for undefined input', () => {
		expect(resolveCompositeChildGeometry(undefined)).toBeUndefined();
	});
});
