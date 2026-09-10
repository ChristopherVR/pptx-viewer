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

	it('session 21: converts a "parent-relative" child height (circle-picture-hierarchy--hier5.pptx own shape: `h refType="h"`, relative to the WRAPPING composite, not self-referential) via `childAspect = heightFactor * wrapperAspect / widthFactor` - 0.8*0.5/0.6=0.6667, matching that fixture\'s own cached 144/216 exactly', () => {
		const circlePictureLike: PptxSmartArtLayoutNode = {
			name: 'hierChild1',
			children: [
				{
					name: 'composite',
					algorithm: { type: 'composite' },
					constraints: [
						{ type: 'w', for: 'ch', forName: 'text', referenceType: 'w', factor: 0.6 },
						{ type: 'h', for: 'ch', forName: 'text', referenceType: 'h', factor: 0.8 },
						{ type: 'l', for: 'ch', forName: 'text', referenceType: 'w', factor: 0.4 },
					],
					children: [{ name: 'text', presentationOf: { axis: ['self'] } }],
				},
			],
		};
		const geometry = resolveCompositeChildGeometry(circlePictureLike, 0.5);
		expect(geometry?.aspectRatio).toBeCloseTo(0.6667, 4);
		expect(geometry?.widthFactor).toBe(0.6);
		expect(geometry?.offsetXRatio).toBe(0.4);
	});

	it('session 23: an OMITTED `fact` on the width constraint is NOT matched by default (`allowOmittedWidthFactor` unset) - half-circle-organization-chart--hier5.pptx\'s own shape (`w for="ch" forName="rootText1" refType="w"`, no `fact` at all) stays STRICT for `std`-mode callers, which never pass `allowOmittedWidthFactor` (see `resolveHierarchyOrientation`\'s own `mode === "tailed"` gate)', () => {
		const halfCircleLike: PptxSmartArtLayoutNode = {
			name: 'hierChild1',
			children: [
				{
					name: 'composite',
					algorithm: { type: 'composite' },
					constraints: [
						{ type: 'w', for: 'ch', forName: 'rootText1', referenceType: 'w' },
						{ type: 'h', for: 'ch', forName: 'rootText1', referenceType: 'h', factor: 0.64 },
					],
					children: [{ name: 'rootText1', presentationOf: { axis: ['self'] } }],
				},
			],
		};
		expect(resolveCompositeChildGeometry(halfCircleLike, 0.5)).toBeUndefined();
	});

	it("session 28: `allowOmittedWidthFactor=true` (passed for `tailed`-mode callers) resolves the OMITTED-fact width as 1 (ECMA \"omitted fact = 1\"), landing half-circle-organization-chart--hier5.pptx's own exact item SIZE (0.64*0.5/1=0.32, matching that fixture's own cached 89/278=0.3201 essentially exactly - COM-verified) once paired with the companion cascading-position fix (`smartart-layout-interpreter-hierarchy.ts`'s own `cascadeAllGenerations`)", () => {
		const halfCircleLike: PptxSmartArtLayoutNode = {
			name: 'hierChild1',
			children: [
				{
					name: 'composite',
					algorithm: { type: 'composite' },
					constraints: [
						{ type: 'w', for: 'ch', forName: 'rootText1', referenceType: 'w' },
						{ type: 'h', for: 'ch', forName: 'rootText1', referenceType: 'h', factor: 0.64 },
					],
					children: [{ name: 'rootText1', presentationOf: { axis: ['self'] } }],
				},
			],
		};
		const geometry = resolveCompositeChildGeometry(halfCircleLike, 0.5, true);
		expect(geometry?.aspectRatio).toBeCloseTo(0.32, 6);
		expect(geometry?.widthFactor).toBe(1);
		expect(geometry?.heightFactor).toBe(0.64);
	});

	it('session 28: a SECOND role\'s `primFontSz` declared relative to the text child (`name-and-title-organization-chart--hier5.pptx`\'s own `rootComposite1`: `primFontSz for="des" forName="titleText1" refType="primFontSz" refFor="des" refForName="rootText1"`, absent for half-circle-organization-chart--hier5.pptx\'s own composite, measured) signals a COMPOUND, multi-role text box the single-`fact` parent-relative formula does not model - bails to `undefined` even with `allowOmittedWidthFactor=true`, rather than resolve a wrong aspect (COM-verified regression when not guarded: 0.45 vs that fixture\'s own cached 125/241=0.5187)', () => {
		const nameAndTitleLike: PptxSmartArtLayoutNode = {
			name: 'hierChild1',
			children: [
				{
					name: 'composite',
					algorithm: { type: 'composite' },
					constraints: [
						{ type: 'w', for: 'ch', forName: 'rootText1', referenceType: 'w' },
						{ type: 'h', for: 'ch', forName: 'rootText1', referenceType: 'h', factor: 0.9 },
						{
							type: 'primFontSz',
							for: 'des',
							forName: 'titleText1',
							referenceType: 'primFontSz',
							referenceFor: 'des',
							referenceForName: 'rootText1',
						},
					],
					children: [{ name: 'rootText1', presentationOf: { axis: ['self'] } }],
				},
			],
		};
		expect(resolveCompositeChildGeometry(nameAndTitleLike, 0.5, true)).toBeUndefined();
	});

	it('session 21: the "parent-relative" shape needs a `wrapperAspect` - without one, returns undefined rather than guessing', () => {
		const circlePictureLike: PptxSmartArtLayoutNode = {
			name: 'hierChild1',
			children: [
				{
					name: 'composite',
					algorithm: { type: 'composite' },
					constraints: [
						{ type: 'w', for: 'ch', forName: 'text', referenceType: 'w', factor: 0.6 },
						{ type: 'h', for: 'ch', forName: 'text', referenceType: 'h', factor: 0.8 },
					],
					children: [{ name: 'text', presentationOf: { axis: ['self'] } }],
				},
			],
		};
		expect(resolveCompositeChildGeometry(circlePictureLike)).toBeUndefined();
	});
});
