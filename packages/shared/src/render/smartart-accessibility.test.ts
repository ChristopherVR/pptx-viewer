import type { PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	buildSmartArtA11y,
	describeSmartArtDiagram,
	smartArtLayoutLabel,
	smartArtNodeAriaLabel,
} from './smartart-accessibility';

function node(id: string, text: string, children?: PptxSmartArtNode[]): PptxSmartArtNode {
	return children ? { id, text, children } : { id, text };
}

function data(
	partial: Partial<PptxSmartArtData> & { nodes: PptxSmartArtNode[] },
): PptxSmartArtData {
	return partial;
}

describe('smartArtLayoutLabel', () => {
	it('maps every layout family to a friendly label', () => {
		expect(smartArtLayoutLabel('list')).toBe('List');
		expect(smartArtLayoutLabel('process')).toBe('Process');
		expect(smartArtLayoutLabel('cycle')).toBe('Cycle');
		expect(smartArtLayoutLabel('hierarchy')).toBe('Hierarchy');
		expect(smartArtLayoutLabel('relationship')).toBe('Relationship');
		expect(smartArtLayoutLabel('matrix')).toBe('Matrix');
		expect(smartArtLayoutLabel('pyramid')).toBe('Pyramid');
		expect(smartArtLayoutLabel('funnel')).toBe('Funnel');
		expect(smartArtLayoutLabel('gear')).toBe('Gear');
		expect(smartArtLayoutLabel('target')).toBe('Target');
		expect(smartArtLayoutLabel('timeline')).toBe('Timeline');
		expect(smartArtLayoutLabel('venn')).toBe('Venn');
		expect(smartArtLayoutLabel('chevron')).toBe('Chevron');
		expect(smartArtLayoutLabel('bending')).toBe('Bending');
		expect(smartArtLayoutLabel('unknown')).toBe('Diagram');
	});

	it('falls back to Diagram for undefined', () => {
		expect(smartArtLayoutLabel(undefined)).toBe('Diagram');
	});
});

describe('smartArtNodeAriaLabel', () => {
	it('builds a 1-based "Node X of Y: text" label', () => {
		expect(smartArtNodeAriaLabel('VP Marketing', 1, 5)).toBe('Node 2 of 5: VP Marketing');
	});

	it('omits the colon when text is empty or whitespace', () => {
		expect(smartArtNodeAriaLabel('', 0, 3)).toBe('Node 1 of 3');
		expect(smartArtNodeAriaLabel('   ', 2, 3)).toBe('Node 3 of 3');
	});

	it('trims surrounding whitespace in the text', () => {
		expect(smartArtNodeAriaLabel('  CEO  ', 0, 1)).toBe('Node 1 of 1: CEO');
	});
});

describe('describeSmartArtDiagram', () => {
	it('describes an empty diagram with no nodes', () => {
		expect(describeSmartArtDiagram(data({ resolvedLayoutType: 'list', nodes: [] }))).toBe(
			'List SmartArt diagram with no nodes',
		);
	});

	it('treats whitespace-only nodes as absent', () => {
		const d = data({ resolvedLayoutType: 'process', nodes: [node('1', '  ')] });
		expect(describeSmartArtDiagram(d)).toBe('Process SmartArt diagram with no nodes');
	});

	it('uses singular "node" for a single node', () => {
		const d = data({ resolvedLayoutType: 'cycle', nodes: [node('1', 'Plan')] });
		expect(describeSmartArtDiagram(d)).toBe('Cycle SmartArt diagram with 1 node: Plan');
	});

	it('lists multiple nodes separated by semicolons', () => {
		const d = data({
			resolvedLayoutType: 'hierarchy',
			nodes: [node('1', 'CEO'), node('2', 'VP Marketing'), node('3', 'VP Engineering')],
		});
		expect(describeSmartArtDiagram(d)).toBe(
			'Hierarchy SmartArt diagram with 3 nodes: CEO; VP Marketing; VP Engineering',
		);
	});

	it('flattens nested children depth-first', () => {
		const d = data({
			resolvedLayoutType: 'hierarchy',
			nodes: [node('1', 'CEO', [node('2', 'VP A'), node('3', 'VP B')])],
		});
		expect(describeSmartArtDiagram(d)).toBe(
			'Hierarchy SmartArt diagram with 3 nodes: CEO; VP A; VP B',
		);
	});

	it('summarises overflow beyond the first 8 nodes', () => {
		const nodes: PptxSmartArtNode[] = [];
		for (let i = 1; i <= 11; i++) {
			nodes.push(node(String(i), `N${i}`));
		}
		const d = data({ resolvedLayoutType: 'list', nodes });
		expect(describeSmartArtDiagram(d)).toBe(
			'List SmartArt diagram with 11 nodes: N1; N2; N3; N4; N5; N6; N7; N8; and 3 more',
		);
	});

	it('falls back to Diagram label when layout type is missing', () => {
		const d = data({ nodes: [node('1', 'Solo')] });
		expect(describeSmartArtDiagram(d)).toBe('Diagram SmartArt diagram with 1 node: Solo');
	});
});

describe('buildSmartArtA11y', () => {
	it('produces a role="img" view-model with per-node labels in DFS order', () => {
		const d = data({
			resolvedLayoutType: 'hierarchy',
			nodes: [node('1', 'CEO', [node('2', 'VP A')])],
		});
		const a11y = buildSmartArtA11y(d);
		expect(a11y.role).toBe('img');
		expect(a11y.label).toBe('Hierarchy SmartArt diagram with 2 nodes: CEO; VP A');
		expect(a11y.nodes).toStrictEqual([
			{ id: '1', label: 'Node 1 of 2: CEO' },
			{ id: '2', label: 'Node 2 of 2: VP A' },
		]);
	});

	it('handles an empty diagram', () => {
		const a11y = buildSmartArtA11y(data({ resolvedLayoutType: 'list', nodes: [] }));
		expect(a11y.nodes).toStrictEqual([]);
		expect(a11y.label).toBe('List SmartArt diagram with no nodes');
	});
});
