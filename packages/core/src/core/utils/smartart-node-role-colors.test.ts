import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import type { SmartArtLayoutResult, RenderedRectNode } from './smartart-layout-types';
import { applySmartArtRoleColors } from './smartart-node-role-colors';

function rect(nodeId: string, fill: string): RenderedRectNode {
	return {
		kind: 'rect',
		key: nodeId,
		nodeId,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		rx: 0,
		fill,
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: nodeId,
		fontSize: 12,
		textX: 5,
		textY: 5,
	};
}

function baseResult(nodes: RenderedRectNode[]): SmartArtLayoutResult {
	return {
		nodes,
		connectors: [],
		shadowFilter: undefined,
		viewBox: '0 0 100 100',
		family: 'hierarchy',
	};
}

describe('applySmartArtRoleColors', () => {
	it('returns the result unchanged when colorRoles is absent', () => {
		const result = baseResult([rect('mgr', '#111111')]);
		expect(applySmartArtRoleColors(result, [], undefined)).toBe(result);
	});

	it('gives an assistant its own role colour instead of the generic cycled one', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'mgr', text: 'Manager', styleRole: 'node1' },
			{ id: 'asst', text: 'Assistant', nodeType: 'asst', styleRole: 'asst0' },
		];
		const result = baseResult([rect('mgr', '#cccccc'), rect('asst', '#cccccc')]);

		const overlaid = applySmartArtRoleColors(result, nodes, {
			node1: { fill: ['#0000ff'], line: [] },
			asst0: { fill: ['#ff00ff'], line: [] },
		});

		expect(overlaid.nodes[0]!.fill).toBe('#0000ff');
		expect(overlaid.nodes[1]!.fill).toBe('#ff00ff');
	});

	it('cycles multiple nodes sharing the same role through that role list', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'a1', text: 'A1', nodeType: 'asst', styleRole: 'asst0' },
			{ id: 'a2', text: 'A2', nodeType: 'asst', styleRole: 'asst0' },
			{ id: 'a3', text: 'A3', nodeType: 'asst', styleRole: 'asst0' },
		];
		const result = baseResult([rect('a1', '#000'), rect('a2', '#000'), rect('a3', '#000')]);

		const overlaid = applySmartArtRoleColors(result, nodes, {
			asst0: { fill: ['#111', '#222'], line: [] },
		});

		expect(overlaid.nodes.map((n) => n.fill)).toStrictEqual(['#111', '#222', '#111']);
	});

	it('does not clobber an explicit per-node fillColor override', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'mgr', text: 'Manager', styleRole: 'node1', style: { fillColor: '#custom' } },
		];
		const result = baseResult([rect('mgr', '#custom')]);

		const overlaid = applySmartArtRoleColors(result, nodes, {
			node1: { fill: ['#0000ff'], line: [] },
		});

		expect(overlaid.nodes[0]!.fill).toBe('#custom');
	});

	it('leaves a node with no recognised role or no matching role list untouched', () => {
		const nodes: PptxSmartArtNode[] = [{ id: 'mgr', text: 'Manager' }];
		const result = baseResult([rect('mgr', '#cccccc')]);

		expect(
			applySmartArtRoleColors(result, nodes, { asst0: { fill: ['#ff00ff'], line: [] } }).nodes[0]!
				.fill,
		).toBe('#cccccc');
	});
});
