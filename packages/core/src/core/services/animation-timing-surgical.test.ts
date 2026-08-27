import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxElementAnimation } from '../types';
import { surgicallyUpdateTimingTree } from './animation-timing-surgical';

/**
 * Build a minimal timing tree with one effect targeting a specific shape.
 * Structure: p:tnLst > p:par[tmRoot] > p:seq[mainSeq] > p:par[clickGrp]
 *   > p:par[wrapper] > p:par[effect with presetClass]
 */
function buildMinimalTimingTree(
	shapeId: string,
	presetClass: string,
	presetId: number,
	duration: number,
): XmlObject {
	return {
		'p:tnLst': {
			'p:par': {
				'p:cTn': {
					'@_id': '1',
					'@_dur': 'indefinite',
					'@_restart': 'never',
					'@_nodeType': 'tmRoot',
					'p:childTnLst': {
						'p:seq': {
							'p:cTn': {
								'@_id': '2',
								'@_dur': 'indefinite',
								'@_nodeType': 'mainSeq',
								'p:childTnLst': {
									'p:par': {
										'p:cTn': {
											'@_id': '3',
											'@_fill': 'hold',
											'p:stCondLst': {
												'p:cond': { '@_delay': 'indefinite' },
											},
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '4',
														'@_fill': 'hold',
														'p:childTnLst': {
															'p:par': {
																'p:cTn': {
																	'@_id': '5',
																	'@_presetID': String(presetId),
																	'@_presetClass': presetClass,
																	'@_presetSubtype': '0',
																	'@_dur': String(duration),
																	'@_nodeType': 'clickEffect',
																	'p:stCondLst': {
																		'p:cond': { '@_delay': '0' },
																	},
																	'p:childTnLst': {
																		'p:set': {
																			'p:cBhvr': {
																				'p:cTn': {
																					'@_id': '6',
																					'@_dur': '1',
																					'@_fill': 'hold',
																				},
																				'p:tgtEl': {
																					'p:spTgt': {
																						'@_spid': shapeId,
																					},
																				},
																			},
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	};
}

/** The `p:cTn` of the tree's main sequence. */
function getMainSeqCTn(tree: XmlObject): XmlObject {
	const tnLst = tree['p:tnLst'] as XmlObject;
	const rootPar = tnLst['p:par'] as XmlObject;
	const rootCTn = rootPar['p:cTn'] as XmlObject;
	const rootChildren = rootCTn['p:childTnLst'] as XmlObject;
	const seq = rootChildren['p:seq'] as XmlObject;
	return seq['p:cTn'] as XmlObject;
}

/** Every effect `p:cTn` (the ones with `@_presetClass`) in document order. */
function collectEffectCTns(tree: XmlObject): XmlObject[] {
	const out: XmlObject[] = [];
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		if (typeof value !== 'object' || value === null) {
			return;
		}
		const node = value as XmlObject;
		const cTn = node['p:cTn'];
		if (cTn && typeof cTn === 'object' && !Array.isArray(cTn)) {
			const effect = cTn as XmlObject;
			if (effect['@_presetClass'] !== undefined) {
				out.push(effect);
			}
		}
		for (const key of Object.keys(node)) {
			visit(node[key]);
		}
	};
	visit(tree['p:tnLst']);
	return out;
}

/** Navigate to the innermost effect p:cTn (the one with @_presetClass). */
function getEffectCTn(tree: XmlObject): XmlObject {
	return collectEffectCTns(tree)[0]!;
}

/** Every `@_presetID` anywhere in an arbitrary subtree, for containment checks. */
function presetIdsIn(subtree: unknown): string[] {
	const out: string[] = [];
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		if (typeof value !== 'object' || value === null) {
			return;
		}
		const node = value as XmlObject;
		if (typeof node['@_presetID'] === 'string') {
			out.push(node['@_presetID']);
		}
		for (const key of Object.keys(node)) {
			visit(node[key]);
		}
	};
	visit(subtree);
	return out;
}

/** The top-level `p:par` click group (a direct child of the main sequence's `p:childTnLst`) containing the effect with the given `@_presetID`. */
function findTopLevelGroup(tree: XmlObject, presetId: string): XmlObject {
	const mainSeqCTn = getMainSeqCTn(tree);
	const childTnLst = mainSeqCTn['p:childTnLst'] as XmlObject;
	const groups = Array.isArray(childTnLst['p:par'])
		? (childTnLst['p:par'] as XmlObject[])
		: [childTnLst['p:par'] as XmlObject];
	const found = groups.find((group) => presetIdsIn(group).includes(presetId));
	if (!found) {
		throw new Error(`no top-level group contains an effect with presetID ${presetId}`);
	}
	return found;
}

/** Read back the `spid:presetClass` registry this module writes into `p:extLst`. */
function ownedKeys(tree: XmlObject): string[] {
	const extLst = tree['p:extLst'] as XmlObject | undefined;
	const exts = extLst?.['p:ext'];
	const list = Array.isArray(exts) ? exts : exts ? [exts] : [];
	for (const ext of list as XmlObject[]) {
		const registry = ext['pptx:editorTiming'] as XmlObject | undefined;
		if (registry) {
			return String(registry['@_owned'] ?? '')
				.split(/\s+/)
				.filter((entry) => entry.length > 0);
		}
	}
	return [];
}

describe('surgicallyUpdateTimingTree', () => {
	it('should update duration of matching effect node', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'fadeIn',
				durationMs: 1000,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		expect(effectCTn['@_dur']).toBe('1000');
	});

	it('should preserve endCondLst when updating other attributes', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		// Inject an endCondLst into the effect node
		const effectCTn = getEffectCTn(tree);
		effectCTn['p:endCondLst'] = {
			'p:cond': { '@_evt': 'onClick', '@_delay': '0' },
		};

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'fadeIn',
				durationMs: 800,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const updatedCTn = getEffectCTn(result);
		expect(updatedCTn['@_dur']).toBe('800');
		// endCondLst should be preserved
		expect(updatedCTn['p:endCondLst']).toBeDefined();
		const endCond = updatedCTn['p:endCondLst'] as XmlObject;
		expect((endCond['p:cond'] as XmlObject)?.['@_evt']).toBe('onClick');
	});

	it('should not modify nodes for elements not in animations list', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const originalDur = getEffectCTn(tree)['@_dur'];

		// Only modify shape2 (not in the tree)
		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape2',
				entrance: 'zoomIn',
				durationMs: 700,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		expect(effectCTn['@_dur']).toBe(originalDur);
		expect(effectCTn['@_presetID']).toBe('10');
	});

	it('should update presetID when entrance preset changes', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'zoomIn',
				durationMs: 500,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		expect(effectCTn['@_presetID']).toBe('23'); // zoomIn presetId
		expect(effectCTn['@_presetClass']).toBe('entr');
	});

	it('should update delay in start condition list', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'fadeIn',
				durationMs: 500,
				delayMs: 250,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		const stCondLst = effectCTn['p:stCondLst'] as XmlObject;
		const cond = stCondLst['p:cond'] as XmlObject;
		expect(cond['@_delay']).toBe('250');
	});

	it('should return tree unchanged when animations array is empty', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const treeCopy = JSON.parse(JSON.stringify(tree)) as XmlObject;

		const result = surgicallyUpdateTimingTree(tree, []);
		expect(result).toStrictEqual(treeCopy);
	});

	// -----------------------------------------------------------------------
	// Adding, deleting and sequencing effects (the panel's actual operations)
	// -----------------------------------------------------------------------

	it('inserts a real effect node for an animation the tree has no node for', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const result = surgicallyUpdateTimingTree(tree, [
			{ elementId: 'shape9', entrance: 'zoomIn', durationMs: 900, trigger: 'onClick' },
		]);

		const effects = collectEffectCTns(result);
		expect(effects).toHaveLength(2);
		const added = effects.find((cTn) => cTn['@_presetID'] === '23');
		expect(added).toBeDefined();
		expect(added?.['@_presetClass']).toBe('entr');
		expect(added?.['@_dur']).toBe('900');
		expect(added?.['@_nodeType']).toBe('clickEffect');
		// It has to target the shape, or PowerPoint animates nothing.
		expect(JSON.stringify(added)).toContain('"@_spid":"shape9"');
		// It has to be reachable from the main sequence, not floating.
		const mainSeqChildren = getMainSeqCTn(result)['p:childTnLst'] as XmlObject;
		expect(mainSeqChildren['p:par'] as XmlObject[]).toHaveLength(2);
	});

	it('records the effects it authored so a later save can delete them', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const result = surgicallyUpdateTimingTree(tree, [
			{ elementId: 'shape9', entrance: 'zoomIn' },
			{ elementId: 'shape9', exit: 'fadeOut' },
		]);

		expect(ownedKeys(result)).toStrictEqual(['shape9:entr', 'shape9:exit']);
	});

	it('deletes an effect it previously authored once the list drops it', () => {
		const added = surgicallyUpdateTimingTree(buildMinimalTimingTree('shape1', 'entr', 10, 500), [
			{ elementId: 'shape9', entrance: 'zoomIn', durationMs: 900 },
		]);
		expect(collectEffectCTns(added)).toHaveLength(2);

		const removed = surgicallyUpdateTimingTree(added, []);

		const effects = collectEffectCTns(removed);
		expect(effects).toHaveLength(1);
		// The deck's own effect survives; only ours went.
		expect(effects[0]?.['@_presetID']).toBe('10');
		expect(JSON.stringify(removed)).not.toContain('shape9');
		expect(ownedKeys(removed)).toStrictEqual([]);
	});

	it('never deletes an effect it did not author', () => {
		// A PowerPoint deck loads with an EMPTY editor list beside a populated
		// timing tree; pruning on "not in the list" would wipe the deck.
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const before = JSON.parse(JSON.stringify(tree)) as XmlObject;

		const result = surgicallyUpdateTimingTree(tree, [{ elementId: 'shape9', entrance: 'zoomIn' }]);
		const after = surgicallyUpdateTimingTree(result, []);

		expect(after['p:tnLst']).toStrictEqual(before['p:tnLst']);
	});

	it('sequences the click groups it owns by the panel order', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const added = surgicallyUpdateTimingTree(tree, [
			{ elementId: 'shapeA', entrance: 'zoomIn', order: 0 },
			{ elementId: 'shapeB', entrance: 'flyIn', order: 1 },
		]);
		expect(collectEffectCTns(added).map((cTn) => cTn['@_presetID'])).toStrictEqual([
			'10',
			'23',
			'2',
		]);

		const reordered = surgicallyUpdateTimingTree(added, [
			{ elementId: 'shapeA', entrance: 'zoomIn', order: 1 },
			{ elementId: 'shapeB', entrance: 'flyIn', order: 0 },
		]);

		// The deck's own group (presetID 10) keeps its slot; ours swap.
		expect(collectEffectCTns(reordered).map((cTn) => cTn['@_presetID'])).toStrictEqual([
			'10',
			'2',
			'23',
		]);
	});

	it('moves an editor-authored effect ahead of a deck-native effect', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const nativeGroupBefore = structuredClone(findTopLevelGroup(tree, '10'));

		// The deck's own effect (presetID 10) occupies the only existing group,
		// anchor order 0. A freshly authored effect is appended after it.
		const withNew = surgicallyUpdateTimingTree(tree, [
			{ elementId: 'shapeA', entrance: 'zoomIn', order: 1 },
		]);
		expect(collectEffectCTns(withNew).map((cTn) => cTn['@_presetID'])).toStrictEqual(['10', '23']);

		// Drag it ahead of the deck's own effect: an order below the native
		// group's anchor order (0) places it first in the full sequence, not
		// just among the effects this editor added.
		const reordered = surgicallyUpdateTimingTree(withNew, [
			{ elementId: 'shapeA', entrance: 'zoomIn', order: -1 },
		]);

		expect(collectEffectCTns(reordered).map((cTn) => cTn['@_presetID'])).toStrictEqual([
			'23',
			'10',
		]);
		// The deck's own group is repositioned, not rewritten: same content.
		expect(findTopLevelGroup(reordered, '10')).toStrictEqual(nativeGroupBefore);
	});

	it('moves an editor-authored effect behind a deck-native effect it used to precede', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const nativeGroupBefore = structuredClone(findTopLevelGroup(tree, '10'));

		// Insert a new effect ahead of the deck's own (order -1 < native's 0).
		const withNew = surgicallyUpdateTimingTree(tree, [
			{ elementId: 'shapeA', entrance: 'zoomIn', order: -1 },
		]);
		expect(collectEffectCTns(withNew).map((cTn) => cTn['@_presetID'])).toStrictEqual(['23', '10']);

		// Now drag it back behind the deck's own effect.
		const reordered = surgicallyUpdateTimingTree(withNew, [
			{ elementId: 'shapeA', entrance: 'zoomIn', order: 5 },
		]);

		expect(collectEffectCTns(reordered).map((cTn) => cTn['@_presetID'])).toStrictEqual([
			'10',
			'23',
		]);
		expect(findTopLevelGroup(reordered, '10')).toStrictEqual(nativeGroupBefore);
	});

	it('retimes rather than duplicates an effect that already targets the shape', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const result = surgicallyUpdateTimingTree(tree, [
			{ elementId: 'shape1', entrance: 'zoomIn', durationMs: 1200 },
		]);

		const effects = collectEffectCTns(result);
		expect(effects).toHaveLength(1);
		expect(effects[0]?.['@_presetID']).toBe('23');
		expect(effects[0]?.['@_dur']).toBe('1200');
	});

	it('builds a main sequence when the tree has only a timing root', () => {
		const tree: XmlObject = {
			'p:tnLst': {
				'p:par': {
					'p:cTn': {
						'@_id': '1',
						'@_dur': 'indefinite',
						'@_restart': 'never',
						'@_nodeType': 'tmRoot',
					},
				},
			},
		};

		const result = surgicallyUpdateTimingTree(tree, [
			{ elementId: 'shape9', entrance: 'fadeIn', durationMs: 400 },
		]);

		expect(getMainSeqCTn(result)['@_nodeType']).toBe('mainSeq');
		expect(collectEffectCTns(result)).toHaveLength(1);
	});
});
