import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { resolveCornerHangPlan } from './smartart-hierarchy-corner-plan';

/**
 * `hierarchy-list--hier5.pptx`'s own real shape, with a genuine root-vs-
 * descendant size split declared (mirrors `smartart-layout-interpreter-
 * hierarchy.test.ts`'s own `cornerAlgorithmNode` helper).
 */
function cornerTree(hierAlign: string, chAlign: string): PptxSmartArtLayoutNode {
	return {
		name: 'diagram',
		algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromL' }] },
		constraints: [
			{ type: 'w', for: 'des', forName: 'rootComposite', referenceType: 'w' },
			{ type: 'h', for: 'des', forName: 'rootComposite', referenceType: 'w', factor: 0.5 },
			{
				type: 'w',
				for: 'des',
				forName: 'childText',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
				factor: 0.8,
			},
			{
				type: 'h',
				for: 'des',
				forName: 'childText',
				referenceType: 'h',
				referenceFor: 'des',
				referenceForName: 'rootComposite',
			},
		],
		children: [
			{
				name: 'root',
				algorithm: { type: 'hierRoot', parameters: [{ type: 'hierAlign', value: hierAlign }] },
				children: [
					{
						name: 'rootComposite',
						algorithm: { type: 'composite' },
						constraints: [
							{ type: 'w', for: 'ch', forName: 'rootText', referenceType: 'w' },
							{ type: 'h', for: 'ch', forName: 'rootText', referenceType: 'h' },
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
						algorithm: {
							type: 'hierChild',
							parameters: [
								{ type: 'chAlign', value: chAlign },
								{ type: 'linDir', value: 'fromT' },
							],
						},
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
	};
}

describe('resolveCornerHangPlan', () => {
	it('engages for the declared corner-anchored construct (hierAlign="tL", chAlign="l" -> right-aligned column)', () => {
		const node = cornerTree('tL', 'l');
		const index = buildConstraintIndex({ rootNode: node });
		expect(resolveCornerHangPlan(node, 1, undefined, index)).toStrictEqual({
			linDir: 'fromT',
			side: 'right',
		});
	});

	it('mirrors to a left-aligned column for chAlign="r"', () => {
		const node = cornerTree('tR', 'r');
		const index = buildConstraintIndex({ rootNode: node });
		expect(resolveCornerHangPlan(node, 1, undefined, index)).toStrictEqual({
			linDir: 'fromT',
			side: 'left',
		});
	});

	it('does not engage when hierAlign is NOT tL/tR (the centred-on-children "Horizontal Hierarchy" family, e.g. lCtrCh)', () => {
		const node = cornerTree('lCtrCh', 'l');
		const index = buildConstraintIndex({ rootNode: node });
		expect(resolveCornerHangPlan(node, 1, undefined, index)).toBeUndefined();
	});

	it('does not engage without a genuine root-vs-descendant size split (no constraints declared at all)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'diagram',
			algorithm: { type: 'hierChild' },
			children: [
				{
					name: 'root',
					algorithm: { type: 'hierRoot', parameters: [{ type: 'hierAlign', value: 'tL' }] },
					children: [
						{
							name: 'childShape',
							algorithm: { type: 'hierChild', parameters: [{ type: 'linDir', value: 'fromT' }] },
							children: [{ name: 'childText', algorithm: { type: 'tx' } }],
						},
					],
				},
			],
		};
		expect(
			resolveCornerHangPlan(node, 1, undefined, buildConstraintIndex({ rootNode: node })),
		).toBeUndefined();
	});

	it('returns undefined for an undefined algorithmNode', () => {
		expect(
			resolveCornerHangPlan(
				undefined,
				1,
				undefined,
				buildConstraintIndex({ rootNode: { name: 'x' } }),
			),
		).toBeUndefined();
	});
});
