import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite';
import {
	renderChildRepeaterSlot,
	resolveUserSizeItemBoxPx,
} from './smartart-layout-interpreter-composite-children';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { styleContext } from './smartart-layout-interpreter-render';

/**
 * `radial-cluster--hier5.pptx`'s exact `cycle_1`/`childCenter1` shape:
 * a bare-`presOf` wrapper whose sole item template declares a bare `userS`
 * `w` self-reference (no local factor, no hub named) and `h refType="w"`
 * (a square item) - the actual hub ratio (`0.67`) lives at the diagram
 * root's own `for="des"` declaration, never repeated on the wrapper itself.
 */
function radialClusterLikeDefinition(): PptxSmartArtLayoutDefinition {
	return {
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
				{ name: 'textCenter', constraints: [{ type: 'w', factor: 0.21 }] },
				{
					name: 'cycle_1',
					constraints: [{ type: 'sp', factor: 0.1 }],
					children: [
						{
							name: 'childCenter1',
							presentationOf: { axis: ['self'] },
							forEachOrigin: { axis: ['ch'], start: [1], count: [1] },
							constraints: [
								{ type: 'w', referenceType: 'userS' },
								{ type: 'h', referenceType: 'w' },
							],
						},
					],
				},
			],
		},
	};
}

function findChild(node: PptxSmartArtLayoutNode, name: string): PptxSmartArtLayoutNode {
	const found = node.children?.find((c) => c.name === name);
	if (!found) {
		throw new Error(`missing ${name}`);
	}
	return found;
}

describe('resolveUserSizeItemBoxPx', () => {
	it("resolves a uniform square size from the diagram-root's own userS ancestor declaration (radial-cluster's cycle_1/childCenter1, Node Two)", () => {
		const definition = radialClusterLikeDefinition();
		const index = buildConstraintIndex(definition);
		const cycle1 = findChild(definition.rootNode, 'cycle_1');
		const size = resolveUserSizeItemBoxPx(
			cycle1,
			index,
			{ width: 867, height: 533 },
			{ width: 533, height: 533 },
			['cycle_1', 'Name0'],
		);
		expect(size?.width).toBeCloseTo(74.99, 1);
		expect(size?.height).toBeCloseTo(74.99, 1);
	});

	it('returns undefined when no item template declares a bare userS w reference (Table List style repeater, no regression)', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				children: [
					{
						name: 'pillars',
						children: [
							{
								name: 'pillar1',
								presentationOf: { axis: ['ch', 'desOrSelf'], start: [1, 1], count: [1, 0] },
							},
						],
					},
				],
			},
		};
		const index = buildConstraintIndex(definition);
		const pillars = findChild(definition.rootNode, 'pillars');
		const size = resolveUserSizeItemBoxPx(
			pillars,
			index,
			{ width: 400, height: 300 },
			{ width: 400, height: 300 },
			['pillars', 'Name0'],
		);
		expect(size).toBeUndefined();
	});

	it("returns undefined when the template's own h is NOT the exact square (refType='w', no factor/refForName) shape", () => {
		const definition = radialClusterLikeDefinition();
		const cycle1 = findChild(definition.rootNode, 'cycle_1');
		// A non-square h (a real cross-role factor) - deliberately outside the
		// conservative scope this function commits to.
		cycle1.children![0].constraints = [
			{ type: 'w', referenceType: 'userS' },
			{ type: 'h', referenceType: 'w', factor: 0.5 },
		];
		const index = buildConstraintIndex(definition);
		const size = resolveUserSizeItemBoxPx(
			cycle1,
			index,
			{ width: 867, height: 533 },
			{ width: 533, height: 533 },
			['cycle_1', 'Name0'],
		);
		expect(size).toBeUndefined();
	});
});

const ctx: SlotStyleContext = {
	ctx: styleContext('flat'),
	palette: ['#fff', '#000'],
	style: 'flat',
	elementId: 'e',
};

describe('renderChildRepeaterSlot with a userS sizing context', () => {
	function anchorAndChildren(): {
		anchor: PptxSmartArtNode;
		childrenOf: Map<string, PptxSmartArtNode[]>;
	} {
		const anchor: PptxSmartArtNode = { id: 'one', text: 'Node One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Node Two', parentId: 'one' };
		return { anchor, childrenOf: new Map([['one', [two]]]) };
	}

	it('sizes the single item at the resolved userS square, centred in the wrapper rect, instead of stretching to fill it', () => {
		const definition = radialClusterLikeDefinition();
		const index = buildConstraintIndex(definition);
		const cycle1 = findChild(definition.rootNode, 'cycle_1');
		const { anchor, childrenOf } = anchorAndChildren();
		const wrapperSlot: SlottedDims = { node: cycle1, dims: {} };
		const box = { width: 867, height: 533 };
		const nodes = renderChildRepeaterSlot(wrapperSlot, anchor, 0, box, 1, 1, childrenOf, ctx, {
			index,
			sizeBox: { width: 533, height: 533 },
			declaringRoleChain: ['cycle_1', 'Name0'],
		});
		expect(nodes).toHaveLength(1);
		const [node] = nodes;
		expect(node.width).toBeCloseTo(74.99, 1);
		expect(node.height).toBeCloseTo(74.99, 1);
		// Centred within the (unclamped, full-box) wrapper rect: x = (867-75)/2.
		expect(node.x).toBeCloseTo((867 - node.width) / 2, 1);
		expect(node.y).toBeCloseTo((533 - node.height) / 2, 1);
	});

	it('keeps the pre-existing stretch-to-column sizing when no sizingCtx is given (no regression for every pre-45 caller)', () => {
		const definition = radialClusterLikeDefinition();
		const cycle1 = findChild(definition.rootNode, 'cycle_1');
		const { anchor, childrenOf } = anchorAndChildren();
		const wrapperSlot: SlottedDims = { node: cycle1, dims: {} };
		const box = { width: 867, height: 533 };
		const nodes = renderChildRepeaterSlot(wrapperSlot, anchor, 0, box, 1, 1, childrenOf, ctx);
		expect(nodes).toHaveLength(1);
		expect(nodes[0].width).toBe(867);
		expect(nodes[0].height).toBe(533);
	});
});
