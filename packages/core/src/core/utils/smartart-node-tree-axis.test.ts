import { describe, expect, it } from 'vitest';

import type { PptxSmartArtConnection, PptxSmartArtNode } from '../types';
import {
	smartArtChildrenOf,
	smartArtDescendantsWithText,
	topLevelSmartArtNodes,
} from './smartart-node-tree-axis';

describe('topLevelSmartArtNodes', () => {
	it('flat (parentId) representation: filters to nodes with no parent, or a parent outside the set', () => {
		// The real PowerPoint loader's shape (PptxHandlerRuntimeSmartArt.ts):
		// flat array, `parentId` pointing either at another node in the array or
		// at the (excluded) doc/structural point.
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'One', parentId: 'doc' },
			{ id: '2', text: 'Two', parentId: '1' },
			{ id: '3', text: 'Three', parentId: 'doc' },
		];
		expect(topLevelSmartArtNodes(nodes).map((n) => n.id)).toStrictEqual(['1', '3']);
	});

	it('nested (.children) representation: the given array already IS the roots', () => {
		const child: PptxSmartArtNode = { id: '2', text: 'Two' };
		const root: PptxSmartArtNode = { id: '1', text: 'One', children: [child] };
		expect(topLevelSmartArtNodes([root])).toStrictEqual([root]);
	});

	it('no parentId at all: every node is top-level', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'One' },
			{ id: '2', text: 'Two' },
		];
		expect(topLevelSmartArtNodes(nodes)).toStrictEqual(nodes);
	});
});

describe('smartArtChildrenOf', () => {
	it('flat (parentId) representation: groups children by their parent id', () => {
		const one: PptxSmartArtNode = { id: '1', text: 'One', parentId: 'doc' };
		const two: PptxSmartArtNode = { id: '2', text: 'Two', parentId: '1' };
		const three: PptxSmartArtNode = { id: '3', text: 'Three', parentId: '1' };
		const map = smartArtChildrenOf([one, two, three]);
		expect(map.get('1')?.map((n) => n.id)).toStrictEqual(['2', '3']);
		expect(map.get('2')).toBeUndefined();
	});

	it('nested (.children) representation: reads .children directly', () => {
		const child: PptxSmartArtNode = { id: '2', text: 'Two' };
		const root: PptxSmartArtNode = { id: '1', text: 'One', children: [child] };
		const map = smartArtChildrenOf([root]);
		expect(map.get('1')).toStrictEqual([child]);
	});

	it(
		'reorders a group by dgm:cxn srcOrd when connections are supplied ' +
			"(gear--hier5.pptx's exact shape: dgm:ptLst declares Three then " +
			'Five, but Five is srcOrd 0 and Three is srcOrd 1)',
		() => {
			const three: PptxSmartArtNode = { id: 'three', text: 'Three', parentId: 'two' };
			const five: PptxSmartArtNode = { id: 'five', text: 'Five', parentId: 'two' };
			const connections: PptxSmartArtConnection[] = [
				{ sourceId: 'two', destId: 'three', srcOrd: 1 },
				{ sourceId: 'two', destId: 'five', srcOrd: 0 },
			];
			const map = smartArtChildrenOf([three, five], connections);
			expect(map.get('two')?.map((n) => n.id)).toStrictEqual(['five', 'three']);
		},
	);

	it(
		'reorders correctly even when two same-parent siblings are separated ' +
			'in the source array by an UNRELATED (different-parent) node - the ' +
			"shape a whole-array comparator (Array.prototype.sort's own " +
			'transitivity gap) gets wrong, measured directly against gear--' +
			'hier5.pptx before this fix',
		() => {
			const three: PptxSmartArtNode = { id: 'three', text: 'Three', parentId: 'two' };
			const four: PptxSmartArtNode = { id: 'four', text: 'Four', parentId: 'one' };
			const five: PptxSmartArtNode = { id: 'five', text: 'Five', parentId: 'two' };
			const connections: PptxSmartArtConnection[] = [
				{ sourceId: 'two', destId: 'three', srcOrd: 1 },
				{ sourceId: 'one', destId: 'four', srcOrd: 0 },
				{ sourceId: 'two', destId: 'five', srcOrd: 0 },
			];
			const map = smartArtChildrenOf([three, four, five], connections);
			expect(map.get('two')?.map((n) => n.id)).toStrictEqual(['five', 'three']);
			expect(map.get('one')?.map((n) => n.id)).toStrictEqual(['four']);
		},
	);

	it('omitted connections: keeps the pre-existing dgm:ptLst declaration order', () => {
		const three: PptxSmartArtNode = { id: 'three', text: 'Three', parentId: 'two' };
		const five: PptxSmartArtNode = { id: 'five', text: 'Five', parentId: 'two' };
		const map = smartArtChildrenOf([three, five]);
		expect(map.get('two')?.map((n) => n.id)).toStrictEqual(['three', 'five']);
	});

	it('a group with no matching connection entries is left in its original order', () => {
		const three: PptxSmartArtNode = { id: 'three', text: 'Three', parentId: 'two' };
		const five: PptxSmartArtNode = { id: 'five', text: 'Five', parentId: 'two' };
		const connections: PptxSmartArtConnection[] = [
			{ sourceId: 'other', destId: 'unrelated', srcOrd: 0 },
		];
		const map = smartArtChildrenOf([three, five], connections);
		expect(map.get('two')?.map((n) => n.id)).toStrictEqual(['three', 'five']);
	});
});

describe('smartArtDescendantsWithText', () => {
	it('drops every empty-text descendant when none is present', () => {
		const child: PptxSmartArtNode = { id: '2', text: 'Two' };
		const root: PptxSmartArtNode = { id: '1', text: 'One', children: [child] };
		expect(
			smartArtDescendantsWithText(root, smartArtChildrenOf([root])).map((n) => n.id),
		).toStrictEqual(['2']);
	});

	it('drops a LEADING and TRAILING empty-text descendant', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'root', text: '' },
			{ id: 'lead', text: '', parentId: 'root' },
			{ id: 'real', text: 'Real', parentId: 'root' },
			{ id: 'trail', text: '', parentId: 'root' },
		];
		const root = nodes[0];
		const childrenOf = smartArtChildrenOf(nodes);
		expect(smartArtDescendantsWithText(root, childrenOf).map((n) => n.id)).toStrictEqual(['real']);
	});

	it(
		'keeps an INTERIOR empty-text descendant as a blank-paragraph placeholder ' +
			"(text-card-short-line--hier8.pptx's 'Branch A' shape: Child, an empty " +
			'group-wrapper point, then Grandchild - cached renders a blank line ' +
			'between them)',
		() => {
			const nodes: PptxSmartArtNode[] = [
				{ id: 'root', text: '' },
				{ id: 'lead', text: '', parentId: 'root' },
				{ id: 'child', text: 'Branch A Child', parentId: 'root' },
				{ id: 'wrapper', text: '', parentId: 'root' },
				{ id: 'grandchild', text: 'Branch A Grandchild with long text', parentId: 'root' },
			];
			const root = nodes[0];
			const childrenOf = smartArtChildrenOf(nodes);
			expect(smartArtDescendantsWithText(root, childrenOf).map((n) => n.id)).toStrictEqual([
				'child',
				'wrapper',
				'grandchild',
			]);
		},
	);

	it('empty array when every descendant is empty-text', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'root', text: '' },
			{ id: 'a', text: '', parentId: 'root' },
			{ id: 'b', text: '', parentId: 'root' },
		];
		expect(smartArtDescendantsWithText(nodes[0], smartArtChildrenOf(nodes))).toStrictEqual([]);
	});
});
