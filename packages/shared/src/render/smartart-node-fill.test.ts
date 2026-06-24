import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { computeSmartArtLayout } from './smartart-layout';
import { nodeFill, nodeStroke } from './smartart-layout-helpers';

const PALETTE = ['#111111', '#222222', '#333333'];

describe('nodeFill / nodeStroke', () => {
	it('returns the cycled palette colour when no override is set', () => {
		const node: PptxSmartArtNode = { id: '1', text: 'A' };
		expect(nodeFill(node, 0, PALETTE)).toBe('#111111');
		expect(nodeFill(node, 4, PALETTE)).toBe('#222222');
	});

	it('honours an explicit per-node fill override', () => {
		const node: PptxSmartArtNode = { id: '1', text: 'A', style: { fillColor: '#FF0000' } };
		expect(nodeFill(node, 0, PALETTE)).toBe('#FF0000');
	});

	it('ignores an empty-string override', () => {
		const node: PptxSmartArtNode = { id: '1', text: 'A', style: { fillColor: '' } };
		expect(nodeFill(node, 0, PALETTE)).toBe('#111111');
	});

	it('honours an explicit per-node line override, else the default', () => {
		const plain: PptxSmartArtNode = { id: '1', text: 'A' };
		expect(nodeStroke(plain, 'rgba(0,0,0,0.3)')).toBe('rgba(0,0,0,0.3)');
		const styled: PptxSmartArtNode = { id: '2', text: 'B', style: { lineColor: '#00FF00' } };
		expect(nodeStroke(styled, 'rgba(0,0,0,0.3)')).toBe('#00FF00');
	});
});

describe('computeSmartArtLayout honours per-node fill', () => {
	const box = { width: 400, height: 300 };

	it('list family: explicit fill wins over palette', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'One', style: { fillColor: '#ABCDEF' } },
			{ id: '2', text: 'Two' },
		];
		const result = computeSmartArtLayout(nodes, box, PALETTE, 'flat', 'el', 'list');
		expect(result.family).toBe('list');
		expect(result.nodes[0].fill).toBe('#ABCDEF');
		expect(result.nodes[1].fill).toBe('#222222');
	});

	it('hierarchy family: explicit fill + line win over palette', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'Root', style: { fillColor: '#123456', lineColor: '#654321' } },
			{ id: '2', text: 'Child', parentId: '1' },
		];
		const result = computeSmartArtLayout(nodes, box, PALETTE, 'moderate', 'el', 'hierarchy');
		expect(result.family).toBe('hierarchy');
		const root = result.nodes.find((n) => n.text === 'Root');
		expect(root?.fill).toBe('#123456');
		expect(root?.stroke).toBe('#654321');
	});

	it('cycle family: explicit fill wins', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'A', style: { fillColor: '#0F0F0F' } },
			{ id: '2', text: 'B' },
			{ id: '3', text: 'C' },
		];
		const result = computeSmartArtLayout(
			nodes,
			box,
			PALETTE,
			'flat',
			'el',
			undefined,
			'basicCycle',
		);
		expect(result.family).toBe('cycle');
		expect(result.nodes[0].fill).toBe('#0F0F0F');
	});
});
