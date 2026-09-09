import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import {
	forEachBoundSlots,
	renderForEachBoundSlots,
} from './smartart-layout-interpreter-composite-foreach';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { styleContext } from './smartart-layout-interpreter-render';

const box = { width: 800, height: 400 };
const ctx = {
	ctx: styleContext('flat'),
	palette: ['#fff'],
	style: 'flat' as const,
	elementId: 'e',
};

function positioned(node: PptxSmartArtLayoutNode): SlottedDims {
	return { node, dims: { l: { px: 0 }, t: { px: 0 }, w: { px: 100 }, h: { px: 50 } } };
}

// hexagon-radial--hier5.pptx's `Child1`/`Child2`: each `presOf
// axis="desOrSelf"`, reached through its OWN compound `forEach axis="ch ch"
// st="1 N" cnt="1 1"` - "top-level point 1's Nth child", independent of any
// ordinal point stream.
describe('forEachBoundSlots', () => {
	it('selects a slot with a single-token presOf and a compound (2+ hop) forEachOrigin', () => {
		const child1: PptxSmartArtLayoutNode = {
			name: 'Child1',
			presentationOf: { axis: ['desOrSelf'], pointTypes: ['node'] },
			forEachOrigin: {
				axis: ['ch', 'ch'],
				pointTypes: ['node', 'node'],
				start: [1, 1],
				count: [1, 1],
			},
		};
		const parent: PptxSmartArtLayoutNode = {
			name: 'Parent',
			presentationOf: { axis: ['self'] },
		};
		const slotted = [positioned(child1), positioned(parent)];
		expect(forEachBoundSlots(slotted).map((s) => s.node.name)).toStrictEqual(['Child1']);
	});

	it('excludes a slot whose forEachOrigin is a single hop (an ordinary ordinal ring slot)', () => {
		const rect1: PptxSmartArtLayoutNode = {
			name: 'rect1',
			presentationOf: { axis: ['self'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], count: [1] },
		};
		expect(forEachBoundSlots([positioned(rect1)])).toStrictEqual([]);
	});
});

describe('renderForEachBoundSlots', () => {
	const one: PptxSmartArtNode = { id: 'one', text: 'Node One' };
	const two: PptxSmartArtNode = { id: 'two', text: 'Node Two' };
	const three: PptxSmartArtNode = { id: 'three', text: 'Node Three' };
	const flat: PptxSmartArtNode[] = [
		one,
		{ ...two, parentId: 'one' },
		{ ...three, parentId: 'one' },
	];
	const childrenOf = new Map([['one', [two, three]]]);

	it("resolves each slot's own anchor via its forEachOrigin, folding descendants for desOrSelf", () => {
		const child1: PptxSmartArtLayoutNode = {
			name: 'Child1',
			presentationOf: { axis: ['desOrSelf'], pointTypes: ['node'] },
			forEachOrigin: {
				axis: ['ch', 'ch'],
				pointTypes: ['node', 'node'],
				start: [1, 1],
				count: [1, 1],
			},
		};
		const child2: PptxSmartArtLayoutNode = {
			name: 'Child2',
			presentationOf: { axis: ['desOrSelf'], pointTypes: ['node'] },
			forEachOrigin: {
				axis: ['ch', 'ch'],
				pointTypes: ['node', 'node'],
				start: [1, 2],
				count: [1, 1],
			},
		};
		const rendered = renderForEachBoundSlots(
			[positioned(child1), positioned(child2)],
			flat,
			box,
			1,
			1,
			childrenOf,
			ctx,
			0,
		);
		expect(rendered.map((r) => r.nodeId)).toStrictEqual(['two', 'three']);
	});

	it('resolves nothing for a slot whose anchor has no non-empty text', () => {
		const blank: PptxSmartArtNode = { id: 'blank', text: '' };
		const child1: PptxSmartArtLayoutNode = {
			name: 'Child1',
			presentationOf: { axis: ['self'], pointTypes: ['node'] },
			forEachOrigin: {
				axis: ['ch', 'ch'],
				pointTypes: ['node', 'node'],
				start: [1, 1],
				count: [1, 1],
			},
		};
		const rendered = renderForEachBoundSlots(
			[positioned(child1)],
			[one, { ...blank, parentId: 'one' }],
			box,
			1,
			1,
			new Map([['one', [blank]]]),
			ctx,
			0,
		);
		expect(rendered).toStrictEqual([]);
	});
});
