import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { applyCustomLayoutOverrides } from './smartart-layout-interpreter-custom';
import type {
	RenderedCircleNode,
	RenderedPolygonNode,
	RenderedRectNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

const BOX = { width: 400, height: 200 };

function baseRect(nodeId: string): RenderedRectNode {
	return {
		kind: 'rect',
		key: 'k',
		nodeId,
		x: 100,
		y: 50,
		width: 40,
		height: 20,
		rx: 4,
		fill: '#4472C4',
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: 'A',
		fontSize: 12,
		textX: 120,
		textY: 60,
	};
}

function baseCircle(nodeId: string): RenderedCircleNode {
	return {
		kind: 'circle',
		key: 'k',
		nodeId,
		cx: 100,
		cy: 60,
		r: 20,
		fill: '#4472C4',
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: 'A',
		fontSize: 11,
	};
}

function basePolygon(nodeId: string): RenderedPolygonNode {
	return {
		kind: 'polygon',
		key: 'k',
		nodeId,
		points: '80,50 120,50 120,70 80,70',
		fill: '#4472C4',
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: 'A',
		fontSize: 12,
		textX: 100,
		textY: 60,
	};
}

function resultOf(nodes: SmartArtLayoutResult['nodes']): SmartArtLayoutResult {
	return { nodes, connectors: [], shadowFilter: undefined, viewBox: '0 0 400 200', family: 'list' };
}

describe('applyCustomLayoutOverrides', () => {
	it('is a no-op (same node reference) when no node carries a customLayout', () => {
		const node: PptxSmartArtNode = { id: 'n1', text: 'A' };
		const result = resultOf([baseRect('n1')]);
		const out = applyCustomLayoutOverrides(result, [node], BOX);
		expect(out).toBe(result);
		expect(out.nodes[0]).toBe(result.nodes[0]);
	});

	it('scales a rect about its own centre via custScaleX/custScaleY', () => {
		const node: PptxSmartArtNode = {
			id: 'n1',
			text: 'A',
			customLayout: { scaleX: 2, scaleY: 1.5 },
		};
		const result = resultOf([baseRect('n1')]);
		const out = applyCustomLayoutOverrides(result, [node], BOX);
		const rect = out.nodes[0] as RenderedRectNode;
		expect(rect.width).toBe(80);
		expect(rect.height).toBe(30);
		// Centre stays at (120, 60): x = cx - w/2, y = cy - h/2.
		expect(rect.x).toBe(80);
		expect(rect.y).toBe(45);
		expect(rect.textX).toBe(120);
		expect(rect.textY).toBe(60);
	});

	it('nudges position by custLinFactX/custLinFactY as a fraction of the container', () => {
		const node: PptxSmartArtNode = {
			id: 'n1',
			text: 'A',
			customLayout: { linearFactorX: 0.1, linearFactorY: -0.25 },
		};
		const result = resultOf([baseRect('n1')]);
		const out = applyCustomLayoutOverrides(result, [node], BOX);
		const rect = out.nodes[0] as RenderedRectNode;
		// dx = 0.1 * 400 = 40, dy = -0.25 * 200 = -50.
		expect(rect.x).toBe(140);
		expect(rect.y).toBe(0);
	});

	it('applies custAng as additive rotation degrees', () => {
		const node: PptxSmartArtNode = { id: 'n1', text: 'A', customLayout: { angle: 15 } };
		const result = resultOf([baseRect('n1')]);
		const out = applyCustomLayoutOverrides(result, [node], BOX);
		expect((out.nodes[0] as RenderedRectNode).rotation).toBe(15);
	});

	it('scales a circle radius via custRadScaleRad', () => {
		const node: PptxSmartArtNode = {
			id: 'n1',
			text: 'A',
			customLayout: { radialScaleRadius: 2 },
		};
		const result = resultOf([baseCircle('n1')]);
		const out = applyCustomLayoutOverrides(result, [node], BOX);
		const circle = out.nodes[0] as RenderedCircleNode;
		expect(circle.r).toBe(40);
		expect(circle.cx).toBe(100);
		expect(circle.cy).toBe(60);
	});

	it('mirrors a polygon horizontally via custFlipHor without moving its centre', () => {
		const node: PptxSmartArtNode = {
			id: 'n1',
			text: 'A',
			customLayout: { flipHorizontal: true },
		};
		const result = resultOf([basePolygon('n1')]);
		const out = applyCustomLayoutOverrides(result, [node], BOX);
		const polygon = out.nodes[0] as RenderedPolygonNode;
		// Centre x is 100; a point at x=80 (20 left of centre) flips to x=120.
		expect(polygon.points).toBe('120,50 80,50 80,70 120,70');
	});

	it('applies overrides independently per node, leaving unaffected nodes untouched', () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'n1', text: 'A', customLayout: { scaleX: 2, scaleY: 2 } },
			{ id: 'n2', text: 'B' },
		];
		const result = resultOf([baseRect('n1'), { ...baseRect('n2'), x: 200, y: 50 }]);
		const out = applyCustomLayoutOverrides(result, nodes, BOX);
		expect((out.nodes[0] as RenderedRectNode).width).toBe(80);
		expect(out.nodes[1]).toBe(result.nodes[1]);
	});
});
