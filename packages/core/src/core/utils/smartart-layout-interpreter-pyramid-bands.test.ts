import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { repositionPyramidBands } from './smartart-layout-interpreter-pyramid-bands';
import type {
	RenderedPolygonNode,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

function polygon(nodeId: string): RenderedPolygonNode {
	return {
		kind: 'polygon',
		key: `k-${nodeId}`,
		points: '0,0 0,0 0,0 0,0',
		fill: '#fff',
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: nodeId,
		fontSize: 12,
		textX: 0,
		textY: 0,
		nodeId,
	};
}

function baseResult(nodeIds: string[]): SmartArtLayoutResult {
	return {
		nodes: nodeIds.map(polygon),
		connectors: [],
		shadowFilter: undefined,
		viewBox: '0 0 200 100',
		family: 'pyramid',
	};
}

function planNodeWithRatio(val: number): PptxSmartArtLayoutNode {
	return {
		algorithm: { type: 'pyra' },
		allConstraints: [{ type: 'pyraAcctRatio', value: val }],
	};
}

// COM-verified formula (see the module doc comment): every row's "level"
// (self) band shrinks to `(1 - pyraAcctRatio)` of its own natural width,
// anchored at the box's left edge; a present "accent" (child) role fills the
// remainder out to the box's right edge. Hand-derived for a 2-row, no-gap,
// non-inverted box (200x100) with pyraAcctRatio=0.5: row 1's natural corners
// are leftTop=50 rightTop=150 leftBot=0 rightBot=200 (bottom, widest band),
// so the scaled (x0.5) self band is leftTop=25 rightTop=75 leftBot=0
// rightBot=100, and the accent fills rightTop..boxWidth (75..200 at yTop,
// 100..200 at yBot).
describe('repositionPyramidBands', () => {
	it('shrinks the self band and fills the accent to the box edge for the bottom (widest) row', () => {
		const result = baseResult(['r0', 'r1', 'acct1']);
		const flatNodes: PptxSmartArtNode[] = [
			{ id: 'r0', text: 'Row 0' },
			{ id: 'r1', text: 'Row 1' },
			{ id: 'acct1', text: 'Accent 1', parentId: 'r1' },
		];
		const out = repositionPyramidBands(
			result,
			{ width: 200, height: 100 },
			planNodeWithRatio(0.5),
			['r0', 'r1'],
			flatNodes,
			true,
			EMPTY_CONSTRAINT_INDEX,
		);
		const selfRow1 = out.nodes.find((n) => n.nodeId === 'r1');
		const accentRow1 = out.nodes.find((n) => n.nodeId === 'acct1');
		if (selfRow1?.kind !== 'polygon' || accentRow1?.kind !== 'polygon') {
			throw new Error('expected polygon bands');
		}
		expect(selfRow1.points).toBe('25,50 75,50 100,100 0,100');
		expect(accentRow1.points).toBe('75,50 200,50 200,100 100,100');
	});

	it('is a no-op when pyraAcctRatio resolves to 0', () => {
		const result = baseResult(['r0', 'r1']);
		const out = repositionPyramidBands(
			result,
			{ width: 200, height: 100 },
			planNodeWithRatio(0),
			['r0', 'r1'],
			[
				{ id: 'r0', text: 'Row 0' },
				{ id: 'r1', text: 'Row 1' },
			],
			true,
			EMPTY_CONSTRAINT_INDEX,
		);
		expect(out).toBe(result);
	});

	it('is a no-op when hasAccentSomewhere is false, even if pyraAcctRatio would resolve nonzero (choose-branch guard)', () => {
		const result = baseResult(['r0', 'r1']);
		const out = repositionPyramidBands(
			result,
			{ width: 200, height: 100 },
			planNodeWithRatio(0.32),
			['r0', 'r1'],
			[
				{ id: 'r0', text: 'Row 0' },
				{ id: 'r1', text: 'Row 1' },
			],
			false,
			EMPTY_CONSTRAINT_INDEX,
		);
		expect(out).toBe(result);
	});

	it('leaves a non-polygon or unresolvable-row shape untouched', () => {
		const rect: RenderedNode = {
			kind: 'rect',
			key: 'k-rect',
			x: 1,
			y: 2,
			width: 3,
			height: 4,
			rx: 0,
			fill: '#fff',
			stroke: 'none',
			strokeWidth: 0,
			opacity: 1,
			text: 'other',
			fontSize: 12,
			textX: 2.5,
			textY: 4,
			nodeId: 'other',
		};
		const result: SmartArtLayoutResult = {
			nodes: [rect],
			connectors: [],
			shadowFilter: undefined,
			viewBox: '0 0 200 100',
			family: 'pyramid',
		};
		const out = repositionPyramidBands(
			result,
			{ width: 200, height: 100 },
			planNodeWithRatio(0.5),
			['r0', 'r1'],
			[
				{ id: 'r0', text: 'Row 0' },
				{ id: 'r1', text: 'Row 1' },
			],
			true,
			EMPTY_CONSTRAINT_INDEX,
		);
		expect(out.nodes[0]).toBe(rect);
	});
});
