import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import {
	arrangeNestedCycleSlot,
	renderChildRepeaterOrNestedCycle,
	resolveNestedCycleAnchor,
} from './smartart-layout-interpreter-composite-nested-cycle';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite-render';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { styleContext } from './smartart-layout-interpreter-render';

/**
 * `radial-cluster--hier5.pptx`'s exact shape: "One" -> [Two, Three, Four],
 * Four -> [Five]. `cycle_3`'s own child `childCenter3` (`presOf axis="self"`,
 * reached through a `ch`-axis `forEachOrigin` naming position 3) resolves to
 * "Four" - the composite's 3rd child, itself the parent of "Five".
 */
function radialClusterNodes(): {
	one: PptxSmartArtNode;
	childrenOf: Map<string, PptxSmartArtNode[]>;
} {
	const one: PptxSmartArtNode = { id: 'one', text: 'Node One' };
	const two: PptxSmartArtNode = { id: 'two', text: 'Node Two', parentId: 'one' };
	const three: PptxSmartArtNode = { id: 'three', text: 'Node Three', parentId: 'one' };
	const four: PptxSmartArtNode = { id: 'four', text: 'Node Four', parentId: 'one' };
	const five: PptxSmartArtNode = { id: 'five', text: 'Node Five', parentId: 'four' };
	const childrenOf = new Map<string, PptxSmartArtNode[]>([
		['one', [two, three, four]],
		['four', [five]],
	]);
	return { one, childrenOf };
}

function cycleWrapper(algorithm?: PptxSmartArtLayoutNode['algorithm']): PptxSmartArtLayoutNode {
	return {
		name: 'cycle_3',
		algorithm,
		children: [
			{
				name: 'childCenter3',
				presentationOf: { axis: ['self'] },
				forEachOrigin: { axis: ['ch'], start: [3], count: [1] },
			},
		],
	};
}

describe('resolveNestedCycleAnchor', () => {
	it("resolves the anchor's 3rd child when it has children of its own (the genuine nested-ring shape)", () => {
		const { one, childrenOf } = radialClusterNodes();
		const resolved = resolveNestedCycleAnchor(cycleWrapper(), one, childrenOf);
		expect(resolved?.id).toBe('four');
	});

	it('declines when the resolved item has NO children of its own (nothing to ring-arrange)', () => {
		const { one, childrenOf } = radialClusterNodes();
		// "Two" (position 1) has no children in this data model.
		const wrapper = cycleWrapper();
		wrapper.children![0].forEachOrigin = { axis: ['ch'], start: [1], count: [1] };
		expect(resolveNestedCycleAnchor(wrapper, one, childrenOf)).toBeUndefined();
	});

	it('declines when the wrapper resolves to more than one item (a flat per-child repeat, not a nested ring)', () => {
		const { one, childrenOf } = radialClusterNodes();
		const wrapper = cycleWrapper();
		wrapper.children!.push({
			name: 'childCenter1',
			presentationOf: { axis: ['self'] },
			forEachOrigin: { axis: ['ch'], start: [1], count: [1] },
		});
		expect(resolveNestedCycleAnchor(wrapper, one, childrenOf)).toBeUndefined();
	});
});

const ctx: SlotStyleContext = {
	ctx: styleContext('flat'),
	palette: ['#fff', '#000'],
	style: 'flat',
	elementId: 'e',
};

function wrapperSlot(algorithm?: PptxSmartArtLayoutNode['algorithm']): SlottedDims {
	return { node: cycleWrapper(algorithm), dims: {} };
}

describe('arrangeNestedCycleSlot / renderChildRepeaterOrNestedCycle', () => {
	it("recurses into arrangeCycle for a wrapper whose own algorithm is DIRECTLY 'cycle', producing one box per nested point", () => {
		const { one, childrenOf } = radialClusterNodes();
		const nodes = arrangeNestedCycleSlot(
			wrapperSlot({ type: 'cycle' }),
			one,
			{ width: 400, height: 300 },
			1,
			1,
			childrenOf,
			5,
			[one],
			undefined,
			{ entries: new Map(), rootRole: '' },
			['#fff', '#000'],
			'flat',
			'e',
			undefined,
		);
		expect(nodes).toBeDefined();
		expect(nodes?.length).toBe(2);
	});

	it('declines (undefined) for a wrapper whose own algorithm is NOT cycle', () => {
		const { one, childrenOf } = radialClusterNodes();
		const nodes = arrangeNestedCycleSlot(
			wrapperSlot({ type: 'lin' }),
			one,
			{ width: 400, height: 300 },
			1,
			1,
			childrenOf,
			5,
			[one],
			undefined,
			{ entries: new Map(), rootRole: '' },
			['#fff', '#000'],
			'flat',
			'e',
			undefined,
		);
		expect(nodes).toBeUndefined();
	});

	it('renderChildRepeaterOrNestedCycle falls back to the flat per-child repeat when not a nested cycle', () => {
		const { one, childrenOf } = radialClusterNodes();
		const nodes = renderChildRepeaterOrNestedCycle(
			wrapperSlot(undefined),
			one,
			0,
			{ width: 400, height: 300 },
			1,
			1,
			childrenOf,
			[one],
			undefined,
			{ entries: new Map(), rootRole: '' },
			ctx,
			undefined,
		);
		// The plain per-child repeat renders one box for "Four" (the single
		// resolved item) - NOT the nested-ring's 2-box (Four + Five) shape.
		expect(nodes).toHaveLength(1);
	});
});
