import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { resolveHubToNodeRatioViaUserSize } from './smartart-layout-interpreter-cycle-hub-ratio-usersize';

const bareUserSizeRingItem: PptxSmartArtLayoutNode = {
	name: 'text3',
	constraints: [{ type: 'w', referenceType: 'userS' }],
};

describe('resolveHubToNodeRatioViaUserSize', () => {
	it('resolves from the LOCAL arrangerConstraints when present (pre-existing behaviour, unaffected by the new params)', () => {
		const ratio = resolveHubToNodeRatioViaUserSize(bareUserSizeRingItem, [
			{ type: 'userS', referenceType: 'w', referenceForName: 'hub', factor: 0.5 },
		]);
		expect(ratio).toStrictEqual({ hubName: 'hub', factor: 0.5 });
	});

	it('returns undefined without index/declaringRoleChain when no local userS declaration exists (no regression: omitting the new params keeps the old behaviour)', () => {
		expect(resolveHubToNodeRatioViaUserSize(bareUserSizeRingItem, [])).toBeUndefined();
	});

	it("finds the ancestor's userS declaration through the index when the immediate arranger declares none locally (radial-cluster's cycle_3 -> Name0)", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					{
						type: 'userS',
						for: 'des',
						pointType: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'textCenter',
						factor: 0.67,
					},
				],
				children: [
					{ name: 'textCenter' },
					{ name: 'cycle_3', constraints: [{ type: 'sp', factor: 0.3 }] },
				],
			},
		};
		const index = buildConstraintIndex(definition);
		// `cycle_3`'s own local constrLst (`arrangerConstraints`, the `sp`
		// entry) carries no `userS` at all - only the index-wide ancestor
		// search should find it.
		const ratio = resolveHubToNodeRatioViaUserSize(
			bareUserSizeRingItem,
			[{ type: 'sp', factor: 0.3 }],
			index,
			['cycle_3', 'Name0'],
		);
		expect(ratio).toStrictEqual({ hubName: 'textCenter', factor: 0.67 });
	});

	it("disambiguates by declaring role: an unrelated sibling branch's own userS (singleCycle) never wins over the true ancestor's", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					{
						type: 'userS',
						for: 'des',
						pointType: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'textCenter',
						factor: 0.67,
					},
				],
				children: [
					{
						name: 'singleCycle',
						constraints: [
							{
								type: 'userS',
								for: 'ch',
								pointType: 'node',
								referenceType: 'w',
								referenceFor: 'ch',
								referenceForName: 'singleCenter',
								factor: 0.5,
							},
						],
					},
					{ name: 'cycle_3' },
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const ratio = resolveHubToNodeRatioViaUserSize(bareUserSizeRingItem, [], index, [
			'cycle_3',
			'Name0',
		]);
		expect(ratio).toStrictEqual({ hubName: 'textCenter', factor: 0.67 });
	});

	it('returns undefined when the index has no userS declared by any role in the chain', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: { name: 'Name0', children: [{ name: 'cycle_3' }] },
		};
		const index = buildConstraintIndex(definition);
		expect(
			resolveHubToNodeRatioViaUserSize(bareUserSizeRingItem, [], index, ['cycle_3', 'Name0']),
		).toBeUndefined();
	});

	it('still declines entirely when the ring item has no bare userS self-reference, regardless of index/chain', () => {
		const plainItem: PptxSmartArtLayoutNode = { name: 'node' };
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [{ type: 'userS', referenceForName: 'hub', factor: 0.67 }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(resolveHubToNodeRatioViaUserSize(plainItem, [], index, ['Name0'])).toBeUndefined();
	});
});
