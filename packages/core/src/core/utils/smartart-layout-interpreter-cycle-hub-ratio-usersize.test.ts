import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import {
	resolveHubToNodeRatioViaUserSize,
	resolveViaUserSizeNodeWidthPx,
} from './smartart-layout-interpreter-cycle-hub-ratio-usersize';

const bareUserSizeRingItem: PptxSmartArtLayoutNode = {
	name: 'text3',
	constraints: [{ type: 'w', referenceType: 'userS' }],
};

describe('resolveHubToNodeRatioViaUserSize', () => {
	it('resolves from the LOCAL arrangerConstraints when present (pre-existing behaviour, unaffected by the new params)', () => {
		const ratio = resolveHubToNodeRatioViaUserSize(bareUserSizeRingItem, [
			{ type: 'userS', referenceType: 'w', referenceForName: 'hub', factor: 0.5 },
		]);
		expect(ratio).toStrictEqual({ hubName: 'hub', factor: 0.5, viaUserSize: true });
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
		expect(ratio).toStrictEqual({ hubName: 'textCenter', factor: 0.67, viaUserSize: true });
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
		expect(ratio).toStrictEqual({ hubName: 'textCenter', factor: 0.67, viaUserSize: true });
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

// ROUND 46: a nested single-satellite ring (`arrangeCycle`'s own `n===1`
// case) has no independent box-fit to derive its node width from at all -
// `resolveViaUserSizeNodeWidthPx` gives it the SAME absolute pixel size
// `resolveUserSizeItemBoxPx` already computes for a flat repeater slot.
describe('resolveViaUserSizeNodeWidthPx', () => {
	it("resolves via the ar-fit sizeBox when the hub role IS userS-referenced (radial-cluster's textCenter: 0.67 * 0.21 * 533 = 75.04px)", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					{ type: 'w', for: 'ch', forName: 'textCenter', referenceType: 'w', factor: 0.21 },
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
				children: [{ name: 'textCenter' }, { name: 'cycle_3' }],
			},
		};
		const index = buildConstraintIndex(definition);
		const width = resolveViaUserSizeNodeWidthPx(
			{ hubName: 'textCenter', factor: 0.67, viaUserSize: true },
			index,
			{ width: 867, height: 533 },
			{ width: 533, height: 533 },
		);
		expect(width).toBeCloseTo(75.04, 1);
	});

	it('resolves via the raw box when the hub role is NOT userS-referenced (no ar-fit scoping to apply)', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [{ type: 'w', for: 'ch', forName: 'hub', referenceType: 'w', factor: 0.4 }],
				children: [{ name: 'hub' }],
			},
		};
		const index = buildConstraintIndex(definition);
		const width = resolveViaUserSizeNodeWidthPx(
			{ hubName: 'hub', factor: 0.5, viaUserSize: true },
			index,
			{ width: 200, height: 100 },
			{ width: 100, height: 100 },
		);
		expect(width).toBeCloseTo(40, 6);
	});

	it("returns undefined when the hub's own w does not resolve", () => {
		const definition: PptxSmartArtLayoutDefinition = { rootNode: { name: 'Name0' } };
		const index = buildConstraintIndex(definition);
		const width = resolveViaUserSizeNodeWidthPx(
			{ hubName: 'missingHub', factor: 0.5, viaUserSize: true },
			index,
			{ width: 200, height: 100 },
			{ width: 100, height: 100 },
		);
		expect(width).toBeUndefined();
	});
});
