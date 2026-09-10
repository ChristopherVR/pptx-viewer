import { describe, expect, it } from 'vitest';

import type { PptxSmartArtConstraint, PptxSmartArtLayoutDefinition } from '../types';
import { buildConstraintIndex, EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { fitHangingBox } from './smartart-hierarchy-hanging-box';

function constr(overrides: Partial<PptxSmartArtConstraint>): PptxSmartArtConstraint {
	return { type: 'w', ...overrides };
}

/**
 * `hierarchy-list--hier5.pptx`'s own real shape (same construct as
 * `smartart-hierarchy-generation-templates.test.ts`'s own fixture - kept
 * duplicated rather than shared so each test file stays self-contained per
 * this module's own doc comment derivation).
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

describe('fitHangingBox', () => {
	it("reproduces hierarchy-list--hier5.pptx's own cached row sizes (867x533 box, 4 rows: matches its post-fold shape count)", () => {
		const definition = hierarchyListLikeDefinition();
		const index = buildConstraintIndex(definition);
		const fit = fitHangingBox(definition.rootNode, index, 867, 533, 4, 5, undefined);
		// Cached: childText (descendant) 179x112, rootText/rootComposite (root)
		// 224x112 - `toBeCloseTo(..., -1)` allows a tolerance of 5px either way
		// (the row-fit denominator is exact against the DECLARED ratios; the
		// cached PIXEL numbers are themselves rounded from PowerPoint's own
		// EMU geometry, so sub-pixel drift is expected, not a bug).
		expect(fit.boxW).toBeCloseTo(179, -1);
		expect(fit.boxH).toBeCloseTo(112, -1);
		expect(fit.rootBoxW).toBeCloseTo(224, -1);
		expect(fit.rootBoxH).toBeCloseTo(112, -1);
		// The declared `sibSp` row gap (0.25x childText's own height).
		expect(fit.vGap).toBeCloseTo(fit.boxH * 0.25, 5);
	});

	it('degrades to a taller box (more rows, same box height) - the row-fit denominator scales with rows', () => {
		const definition = hierarchyListLikeDefinition();
		const index = buildConstraintIndex(definition);
		const fourRows = fitHangingBox(definition.rootNode, index, 867, 533, 4, 5, undefined);
		const eightRows = fitHangingBox(definition.rootNode, index, 867, 533, 8, 5, undefined);
		expect(eightRows.boxH).toBeLessThan(fourRows.boxH);
	});

	it('falls back to the legacy ad-hoc ratios when no algorithmNode is given', () => {
		const fit = fitHangingBox(undefined, EMPTY_CONSTRAINT_INDEX, 1000, 500, 3, 0, undefined);
		expect(fit.boxW).toBeCloseTo(Math.min(1000 * 0.42, 160), 5);
		expect(fit.boxH).toBeCloseTo(Math.min(500 * 0.16, 30), 5);
		expect(fit.rootBoxW).toBeUndefined();
		expect(fit.rootBoxH).toBeUndefined();
	});

	it('falls back to the legacy ad-hoc ratios when the layout declares no resolvable item-template size', () => {
		const bareNode = {
			name: 'hierChild1',
			algorithm: { type: 'hierChild' as const },
			children: [
				{
					name: 'hierRoot1',
					algorithm: { type: 'hierRoot' as const },
					children: [
						{ name: 'text', algorithm: { type: 'tx' as const }, shape: { presetGeometry: 'rect' } },
					],
				},
			],
		};
		const fit = fitHangingBox(bareNode, EMPTY_CONSTRAINT_INDEX, 1000, 500, 3, 0, undefined);
		expect(fit.boxW).toBeCloseTo(Math.min(1000 * 0.42, 160), 5);
		expect(fit.boxH).toBeCloseTo(Math.min(500 * 0.16, 30), 5);
	});

	it('falls back to the legacy ad-hoc ratios for rows < 1', () => {
		const definition = hierarchyListLikeDefinition();
		const index = buildConstraintIndex(definition);
		const fit = fitHangingBox(definition.rootNode, index, 867, 533, 0, 5, undefined);
		expect(fit.boxW).toBeCloseTo(Math.min(867 * 0.42, 160), 5);
	});
});
