import { describe, expect, it } from 'vitest';

import type { PptxSmartArtConstraint, PptxSmartArtLayoutDefinition } from '../types';
import {
	buildConstraintIndex,
	resolveConstraint,
	resolveRatioConstraint,
} from './smartart-constraint-solver';

function constr(overrides: Partial<PptxSmartArtConstraint>): PptxSmartArtConstraint {
	return { type: 'w', ...overrides };
}

describe('smartArt relative constraint solver', () => {
	it('resolves a constraint expressed relative to another node', () => {
		// The root ("diagram") declares its "node" children's w as its own full
		// width, and their h as 0.6x that width - exactly the shape genuine
		// PowerPoint content uses (see `ppt/diagrams/layout1.xml` inside
		// `e2e/fixtures/animation-builds-color.pptx`).
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({ type: 'w', for: 'ch', forName: 'node', referenceType: 'w' }),
					constr({
						type: 'h',
						for: 'ch',
						forName: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'node',
						factor: 0.6,
					}),
				],
				children: [{ name: 'node' }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(resolveConstraint(index, 'node', 'w')).toBe(1);
		expect(resolveConstraint(index, 'node', 'h')).toBeCloseTo(0.6);
	});

	it('resolves a multi-hop chain (spacer width -> sibling gap)', () => {
		// The genuine fixture's fourth constraint: the inter-item gap ("sp") has
		// no literal value of its own - it equals the "sibTrans" spacer's width,
		// which is itself 0.1x the item ("node") width, which is itself the whole
		// box. Three hops, no literal at any of them.
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({ type: 'w', for: 'ch', forName: 'node', referenceType: 'w' }),
					constr({
						type: 'w',
						for: 'ch',
						forName: 'sibTrans',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'node',
						factor: 0.1,
					}),
					constr({
						type: 'sp',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'sibTrans',
					}),
				],
				children: [{ name: 'node' }, { name: 'sibTrans' }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(resolveConstraint(index, 'diagram', 'sp')).toBeCloseTo(0.1);
	});

	it('degrades to undefined when the referenced role does not exist', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({
						type: 'w',
						for: 'ch',
						forName: 'node',
						referenceFor: 'ch',
						referenceForName: 'does-not-exist',
						factor: 0.5,
					}),
				],
				children: [{ name: 'node' }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(resolveConstraint(index, 'node', 'w')).toBeUndefined();
	});

	it('degrades to undefined (not an infinite loop) on a reference cycle', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({
						type: 'w',
						for: 'ch',
						forName: 'a',
						referenceFor: 'ch',
						referenceForName: 'b',
						factor: 0.5,
					}),
					constr({
						type: 'w',
						for: 'ch',
						forName: 'b',
						referenceFor: 'ch',
						referenceForName: 'a',
						factor: 0.5,
					}),
				],
				children: [{ name: 'a' }, { name: 'b' }],
			},
		};
		const index = buildConstraintIndex(definition);

		const result = resolveConstraint(index, 'a', 'w');

		expect(result).toBeUndefined();
	});

	it('degrades an unresolvable reference to the entry’s own literal val, not undefined', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({
						type: 'primFontSz',
						for: 'ch',
						forName: 'node',
						referenceFor: 'ch',
						referenceForName: 'missing',
						operator: 'gte',
						value: 12,
					}),
				],
				children: [{ name: 'node' }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(resolveConstraint(index, 'node', 'primFontSz')).toBe(12);
	});

	it('applies a gte bound against a value the reference DID resolve', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({ type: 'w', for: 'ch', forName: 'small', referenceType: 'w', factor: 0.05 }),
					constr({
						type: 'w',
						for: 'ch',
						forName: 'floor',
						referenceFor: 'ch',
						referenceForName: 'small',
						operator: 'gte',
						value: 0.2,
					}),
				],
				children: [{ name: 'small' }, { name: 'floor' }],
			},
		};
		const index = buildConstraintIndex(definition);
		// small.w resolves to 0.05 (5% of the box); floor.w references it but is
		// bounded below at 0.2, so the bound wins.
		expect(resolveConstraint(index, 'small', 'w')).toBeCloseTo(0.05);
		expect(resolveConstraint(index, 'floor', 'w')).toBeCloseTo(0.2);
	});

	it('applies an lte bound against a value the reference DID resolve', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({ type: 'w', for: 'ch', forName: 'big', referenceType: 'w', factor: 0.9 }),
					constr({
						type: 'w',
						for: 'ch',
						forName: 'ceiling',
						referenceFor: 'ch',
						referenceForName: 'big',
						operator: 'lte',
						value: 0.5,
					}),
				],
				children: [{ name: 'big' }, { name: 'ceiling' }],
			},
		};
		const index = buildConstraintIndex(definition);
		// big.w resolves to 0.9 (90% of the box); ceiling.w references it but is
		// capped at 0.5, so the cap wins.
		expect(resolveConstraint(index, 'big', 'w')).toBeCloseTo(0.9);
		expect(resolveConstraint(index, 'ceiling', 'w')).toBeCloseTo(0.5);
	});

	it('an explicit equ op behaves like the default (no bound applied)', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({
						type: 'h',
						for: 'ch',
						forName: 'node',
						referenceType: 'w',
						operator: 'equ',
						factor: 0.75,
					}),
				],
				children: [{ name: 'node' }],
			},
		};
		const index = buildConstraintIndex(definition);
		// referenceType "w" with no refFor falls back to the declaring node's
		// (the root's) own w, which defaults to 1 (the whole box). "equ" carries
		// no bound of its own, so the result is exactly referenced * fact.
		expect(resolveConstraint(index, 'node', 'h')).toBeCloseTo(0.75);
	});

	it('gte/lte bounds compose across a multi-hop reference chain', () => {
		// base -> scaled (0.2x base) -> clamped (lte 0.1 against scaled)
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({ type: 'w', for: 'ch', forName: 'base', referenceType: 'w', factor: 0.8 }),
					constr({
						type: 'w',
						for: 'ch',
						forName: 'scaled',
						referenceFor: 'ch',
						referenceForName: 'base',
						factor: 0.2,
					}),
					constr({
						type: 'w',
						for: 'ch',
						forName: 'clamped',
						referenceFor: 'ch',
						referenceForName: 'scaled',
						operator: 'lte',
						value: 0.1,
					}),
				],
				children: [{ name: 'base' }, { name: 'scaled' }, { name: 'clamped' }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(resolveConstraint(index, 'base', 'w')).toBeCloseTo(0.8);
		expect(resolveConstraint(index, 'scaled', 'w')).toBeCloseTo(0.16);
		expect(resolveConstraint(index, 'clamped', 'w')).toBeCloseTo(0.1);
	});

	it('resolveRatioConstraint prefers an existing literal match over the graph', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: { name: 'diagram', children: [{ name: 'node' }] },
		};
		const index = buildConstraintIndex(definition);
		const literalConstraints: PptxSmartArtConstraint[] = [constr({ type: 'sibSp', factor: 0.3 })];

		expect(
			resolveRatioConstraint(literalConstraints, index, 'diagram', ['sibSp', 'sp'], 0.25),
		).toBe(0.3);
	});

	it('resolveRatioConstraint falls back to the graph, then to the default', () => {
		const resolvable: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				constraints: [
					constr({ type: 'w', for: 'ch', forName: 'sibTrans', referenceType: 'w' }),
					constr({
						type: 'sp',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'sibTrans',
						factor: 0.5,
					}),
				],
				children: [{ name: 'sibTrans' }],
			},
		};
		const resolvableIndex = buildConstraintIndex(resolvable);
		expect(resolveRatioConstraint(undefined, resolvableIndex, 'diagram', ['sp'], 0.25)).toBeCloseTo(
			0.5,
		);

		const empty: PptxSmartArtLayoutDefinition = { rootNode: { name: 'diagram' } };
		const emptyIndex = buildConstraintIndex(empty);
		expect(resolveRatioConstraint(undefined, emptyIndex, 'diagram', ['sp'], 0.25)).toBe(0.25);
	});
});
