import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { smartArtChildrenOf, topLevelSmartArtNodes } from './smartart-node-tree-axis';

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
});
