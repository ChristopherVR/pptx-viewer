import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { resolveCycleRingParams } from './smartart-layout-interpreter-cycle-constraints';

/**
 * `radial-cycle--flat3.pptx`'s real hub+ring composite shape: a top
 * "Name0" node (NOT literally named "cycle") whose direct children are
 * `centerShape` (the hub), `node` (the ring item), and assorted decorative
 * siblings (`dummy`, `sibTrans`, ...), with the composite's OWN constrLst
 * (not a nested named layoutNode's) declaring `sibSp`/`w` scoped
 * `for="ch"`.
 */
function radialCycleArranger(nodeFact?: number): PptxSmartArtLayoutNode {
	const nodeWConstraint: PptxSmartArtLayoutNode['constraints'][number] = {
		type: 'w',
		for: 'ch',
		forName: 'node',
		referenceType: 'w',
		referenceFor: 'ch',
		referenceForName: 'centerShape',
		...(nodeFact === undefined ? {} : { factor: nodeFact }),
	};
	return {
		name: 'Name0',
		algorithm: { type: 'cycle' },
		constraints: [
			nodeWConstraint,
			{
				type: 'sibSp',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'node',
				factor: 0.3,
			},
		],
		children: [
			{ name: 'centerShape', constraints: [{ type: 'h', referenceType: 'w' }] },
			{ name: 'node', constraints: [{ type: 'h', referenceType: 'w', factor: 0.7 }] },
			{ name: 'dummy' },
			{ name: 'sibTrans' },
		],
	};
}

describe('resolveCycleRingParams: composite hub+ring item resolution', () => {
	it('resolves the ring item as the node sibSp\'s own referenceForName points to, not children[0] ("centerShape")', () => {
		const params = resolveCycleRingParams(radialCycleArranger(0.7), EMPTY_CONSTRAINT_INDEX);
		// If the ring item were misresolved as `centerShape` (children[0]),
		// `heightOverWidth` would read centerShape's own `h refType=w` (no
		// factor -> default 1), not `node`'s declared 0.7.
		expect(params.heightOverWidth).toBeCloseTo(0.7, 5);
	});

	it('declines the composite item-resolution path for a plain ring whose sibSp does not reference one of its own children (basic-cycle shape, no regression)', () => {
		const plainCycle: PptxSmartArtLayoutNode = {
			name: 'cycle',
			algorithm: { type: 'cycle' },
			constraints: [
				{
					type: 'sibSp',
					referenceType: 'w',
					referenceFor: 'des',
					referenceForName: 'composite',
					factor: 0.5,
				},
			],
			children: [{ name: 'dummy' }, { name: 'node', constraints: [] }, { name: 'sibTrans' }],
		};
		const params = resolveCycleRingParams(plainCycle, EMPTY_CONSTRAINT_INDEX);
		// Falls back to `itemNode()` (children[0] = "dummy", no `h` constraint of
		// its own), so heightOverWidth falls all the way back to its own
		// default of 1 - the SAME behaviour as before this composite-item
		// resolution existed.
		expect(params.heightOverWidth).toBeCloseTo(1, 5);
	});

	it('resolves hubRatio from an explicit `fact` ("radial-cycle": node.w = 0.7 * centerShape.w)', () => {
		const params = resolveCycleRingParams(radialCycleArranger(0.7), EMPTY_CONSTRAINT_INDEX);
		expect(params.hubRatio).toStrictEqual({ hubName: 'centerShape', factor: 0.7 });
	});

	it('resolves hubRatio with an IMPLICIT factor of 1 when `fact` is omitted ("basic-radial": node.w = centerShape.w, COM-verified identical hub/satellite size)', () => {
		const params = resolveCycleRingParams(radialCycleArranger(undefined), EMPTY_CONSTRAINT_INDEX);
		expect(params.hubRatio).toStrictEqual({ hubName: 'centerShape', factor: 1 });
	});

	it('leaves hubRatio undefined for a plain ring with no hub composite (basic-cycle shape, no regression)', () => {
		const plainCycle: PptxSmartArtLayoutNode = {
			name: 'cycle',
			algorithm: { type: 'cycle' },
			constraints: [
				{
					type: 'sibSp',
					referenceType: 'w',
					referenceFor: 'des',
					referenceForName: 'composite',
					factor: 0.5,
				},
			],
			children: [{ name: 'node', constraints: [] }, { name: 'sibTrans' }],
		};
		const params = resolveCycleRingParams(plainCycle, EMPTY_CONSTRAINT_INDEX);
		expect(params.hubRatio).toBeUndefined();
	});

	it('resolves hubGapRatio from an `sp` referencing the ring ITEM directly ("basic-radial": sp fact=0.3 refForName="node")', () => {
		const arranger = radialCycleArranger(undefined);
		arranger.constraints?.push({
			type: 'sp',
			referenceType: 'w',
			referenceFor: 'ch',
			referenceForName: 'node',
			factor: 0.3,
		});
		const params = resolveCycleRingParams(arranger, EMPTY_CONSTRAINT_INDEX);
		expect(params.hubGapRatio).toBeCloseTo(0.3, 5);
	});

	it('resolves hubGapRatio from an `sp` referencing the HUB, converted to ring-item units by hubRatio.factor ("diverging-radial": sp fact=0.4 refForName="centerShape", node.w=1.25*centerShape.w -> 0.4/1.25=0.32)', () => {
		const arranger = radialCycleArranger(1.25);
		arranger.constraints?.push({
			type: 'sp',
			referenceType: 'w',
			referenceFor: 'ch',
			referenceForName: 'centerShape',
			factor: 0.4,
		});
		const params = resolveCycleRingParams(arranger, EMPTY_CONSTRAINT_INDEX);
		expect(params.hubGapRatio).toBeCloseTo(0.32, 5);
	});

	it('leaves hubGapRatio undefined when `sp` references neither the ring item nor the hub (no false positive)', () => {
		const arranger = radialCycleArranger(0.7);
		arranger.constraints?.push({
			type: 'sp',
			referenceType: 'w',
			referenceFor: 'des',
			referenceForName: 'composite',
			factor: 0.3,
		});
		const params = resolveCycleRingParams(arranger, EMPTY_CONSTRAINT_INDEX);
		expect(params.hubGapRatio).toBeUndefined();
	});

	it('resolveRingItemNode prefers a genuinely repeating child (forEachOrigin set) over a name match on a SINGULAR hub node ("radial-list": sibSp/sp both reference "centerShape" by name, but only "node" repeats per point)', () => {
		const arranger: PptxSmartArtLayoutNode = {
			name: 'cycle',
			algorithm: { type: 'cycle' },
			constraints: [
				{
					type: 'sibSp',
					referenceType: 'w',
					referenceFor: 'ch',
					referenceForName: 'centerShape',
					factor: 0.08,
				},
			],
			children: [
				// `centerShape`: name-matches `sibSp`'s own reference, but is a
				// SINGULAR node (no `forEachOrigin` - reached only via a
				// `dgm:choose` gate, never repeats per point).
				{ name: 'centerShape', constraints: [{ type: 'h', referenceType: 'w' }] },
				// `node`: the REAL repeating ring item, reached through an
				// enclosing `dgm:forEach` - carries `forEachOrigin`, unlike
				// `centerShape`.
				{
					name: 'node',
					constraints: [{ type: 'h', referenceType: 'w', factor: 0.6 }],
					forEachOrigin: { axis: ['self'], pointTypes: ['node'] },
				},
			],
		};
		const params = resolveCycleRingParams(arranger, EMPTY_CONSTRAINT_INDEX);
		// If `centerShape` (the name match) were wrongly trusted, this would
		// read ITS OWN `h refType=w` (no factor -> default 1), not `node`'s
		// declared 0.6.
		expect(params.heightOverWidth).toBeCloseTo(0.6, 5);
	});
});
