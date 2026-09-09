import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex, EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import {
	deriveCompositeSelfChildLayout,
	resolveGraphAspectRatio,
} from './smartart-layout-interpreter-cycle-item-aspect';

/** `radial-list--hier5.pptx`'s own ring item ("node"): parentNode (ellipse, w=0.4*node.w, self-square) + childNode (rect, l=1.1*parentNode.w, w=0.6*node.w, side by side). */
function radialListNodeItem(): PptxSmartArtLayoutNode {
	return {
		name: 'node',
		algorithm: { type: 'composite' },
		constraints: [
			{ type: 't', for: 'ch', forName: 'parentNode' },
			{ type: 'l', for: 'ch', forName: 'parentNode' },
			{ type: 'w', for: 'ch', forName: 'parentNode', referenceType: 'w', factor: 0.4 },
			{
				type: 'h',
				for: 'ch',
				forName: 'parentNode',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'parentNode',
				operator: 'equ',
			},
			{
				type: 'l',
				for: 'ch',
				forName: 'childNode',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'parentNode',
				operator: 'equ',
				factor: 1.1,
			},
			{
				type: 'w',
				for: 'ch',
				forName: 'childNode',
				referenceType: 'w',
				factor: 0.6,
			},
			{
				type: 'h',
				for: 'ch',
				forName: 'childNode',
				referenceType: 'h',
				referenceFor: 'ch',
				referenceForName: 'parentNode',
			},
		],
	};
}

describe('deriveCompositeSelfChildLayout', () => {
	it('derives the full self+child descriptor ("radial-list": parentNode.w=0.4*node.w self-square, childNode.l=1.1*parentNode.w, childNode.w=0.6*node.w)', () => {
		expect(deriveCompositeSelfChildLayout(radialListNodeItem())).toStrictEqual({
			selfName: 'parentNode',
			selfWidthFactor: 0.4,
			childName: 'childNode',
			childLeftFactor: 1.1,
			childWidthFactor: 0.6,
		});
	});

	it('declines for a non-composite item (no regression for a plain single-shape ring item)', () => {
		const plainItem: PptxSmartArtLayoutNode = {
			name: 'node',
			algorithm: { type: 'tx' },
			constraints: [{ type: 'h', referenceType: 'w', factor: 0.5 }],
		};
		expect(deriveCompositeSelfChildLayout(plainItem)).toBeUndefined();
	});

	it('declines when no child declares a self-square h=w pairing', () => {
		const noSquareChild: PptxSmartArtLayoutNode = {
			name: 'node',
			algorithm: { type: 'composite' },
			constraints: [
				{ type: 'w', for: 'ch', forName: 'a', referenceType: 'w', factor: 0.5 },
				{ type: 'h', for: 'ch', forName: 'a', referenceType: 'w', factor: 0.3 },
			],
		};
		expect(deriveCompositeSelfChildLayout(noSquareChild)).toBeUndefined();
	});

	it('declines a width constraint that references another node instead of the composite itself (a genuine hub-ratio constraint, not a self-contained aspect)', () => {
		const hubRatioShape: PptxSmartArtLayoutNode = {
			name: 'node',
			algorithm: { type: 'composite' },
			constraints: [
				{
					type: 'w',
					for: 'ch',
					forName: 'a',
					referenceType: 'w',
					referenceFor: 'ch',
					referenceForName: 'centerShape',
					factor: 1.5,
				},
				{
					type: 'h',
					for: 'ch',
					forName: 'a',
					referenceType: 'w',
					referenceFor: 'ch',
					referenceForName: 'a',
					operator: 'equ',
				},
			],
		};
		expect(deriveCompositeSelfChildLayout(hubRatioShape)).toBeUndefined();
	});

	it('returns a descriptor with an undefined childName/childLeftFactor/childWidthFactor when the self-square shape has no sibling child at all (a lone self-square composite child)', () => {
		const selfOnly: PptxSmartArtLayoutNode = {
			name: 'node',
			algorithm: { type: 'composite' },
			constraints: [
				{ type: 'w', for: 'ch', forName: 'a', referenceType: 'w', factor: 0.4 },
				{
					type: 'h',
					for: 'ch',
					forName: 'a',
					referenceType: 'w',
					referenceFor: 'ch',
					referenceForName: 'a',
					operator: 'equ',
				},
			],
		};
		expect(deriveCompositeSelfChildLayout(selfOnly)).toStrictEqual({
			selfName: 'a',
			selfWidthFactor: 0.4,
			childName: undefined,
			childLeftFactor: undefined,
			childWidthFactor: undefined,
		});
	});

	it('returns undefined for undefined input', () => {
		expect(deriveCompositeSelfChildLayout(undefined)).toBeUndefined();
	});
});

/**
 * `diverging-radial--hier5.pptx`'s own layout shape (see the module doc
 * comment on `resolveGraphAspectRatio`): the composite root ("Name0")
 * declares `centerShape.w = 1 * Name0.w` (self, no ref, i.e. the hub's own
 * width is the diagram's implicit root unit) and `node.w = 1.25 *
 * centerShape.w`; the ring item ("node") itself declares only a
 * self-referential `h = 1 * w` (a circle). The GENUINE h:w ratio is 1 (both
 * resolve to 1.25 root-normalized units); reading the graph-resolved `h`
 * alone (the old bug) would wrongly give 1.25.
 */
function divergingRadialDefinition(): PptxSmartArtLayoutDefinition {
	const node: PptxSmartArtLayoutNode = {
		name: 'node',
		constraints: [{ type: 'h', referenceType: 'w' }],
	};
	const centerShape: PptxSmartArtLayoutNode = { name: 'centerShape' };
	const root: PptxSmartArtLayoutNode = {
		name: 'Name0',
		children: [centerShape, node],
		constraints: [
			{ type: 'w', for: 'ch', forName: 'centerShape', referenceType: 'w' },
			{
				type: 'w',
				for: 'ch',
				forName: 'node',
				referenceType: 'w',
				referenceFor: 'ch',
				referenceForName: 'centerShape',
				operator: 'equ',
				factor: 1.25,
			},
		],
	};
	return { rootNode: root };
}

describe('resolveGraphAspectRatio', () => {
	it('divides the graph-resolved h by the graph-resolved w, not just h alone (diverging-radial regression: 1.25/1.25 = 1, not 1.25)', () => {
		const definition = divergingRadialDefinition();
		const index = buildConstraintIndex(definition);
		const node = definition.rootNode.children?.[1];
		expect(resolveGraphAspectRatio(node, index)).toBeCloseTo(1, 5);
	});

	it('declines when the item is undefined', () => {
		expect(resolveGraphAspectRatio(undefined, EMPTY_CONSTRAINT_INDEX)).toBeUndefined();
	});

	it("declines when the item's own w is not itself graph-resolved (no regression for basic-radial/radial-cycle, whose sibSp/sp reference the item directly)", () => {
		const item: PptxSmartArtLayoutNode = {
			name: 'node',
			constraints: [{ type: 'h', referenceType: 'w' }],
		};
		const root: PptxSmartArtLayoutNode = { name: 'Name0', children: [item] };
		const index = buildConstraintIndex({ rootNode: root });
		expect(resolveGraphAspectRatio(item, index)).toBeUndefined();
	});
});
