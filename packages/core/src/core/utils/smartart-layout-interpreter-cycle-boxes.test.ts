import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import type { CycleBoxInputs } from './smartart-layout-interpreter-cycle-boxes';
import { buildCycleHubBox, buildCycleRingBoxes } from './smartart-layout-interpreter-cycle-boxes';
import type { CycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
import { styleContext } from './smartart-layout-interpreter-render';
import type { RenderedNode, RenderedRectNode } from './smartart-layout-types';

const boxInputs: CycleBoxInputs = {
	palette: ['#fff', '#000'],
	style: 'flat',
	ctx: styleContext('flat'),
	shape: { presetGeometry: 'roundRect' },
	elementId: 'e',
};

function asRect(entry: RenderedNode): RenderedRectNode {
	if (entry.kind !== 'rect') {
		throw new Error(`expected a rect node, got ${entry.kind}`);
	}
	return entry;
}

const ring: CycleRingLayout = {
	centers: [
		{ x: 100, y: 100 },
		{ x: 300, y: 100 },
	],
	nodeWidth: 40,
	nodeHeight: 40,
	hubCenter: { x: 200, y: 100 },
	hubHalfWidth: 30,
	hubHalfHeight: 30,
};

describe('buildCycleRingBoxes', () => {
	it('places one box per ring node, centred on its own solved centre', () => {
		const nodes = [
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B' },
		] satisfies PptxSmartArtNode[];
		const result = buildCycleRingBoxes(nodes, ring, boxInputs);
		expect(result).toHaveLength(2);
		const first = asRect(result[0]);
		expect(first.nodeId).toBe('a');
		expect(first.width).toBe(40);
		expect(first.height).toBe(40);
		expect(first.x).toBeCloseTo(80, 5);
		expect(first.y).toBeCloseTo(80, 5);
	});
});

describe('buildCycleHubBox', () => {
	it("sizes the hub from the ring's own hubHalfWidth/hubHalfHeight, centred on hubCenter", () => {
		const hubNode: PptxSmartArtNode = { id: 'hub', text: 'Hub' };
		const result = asRect(buildCycleHubBox(hubNode, ring, 3, boxInputs));
		expect(result.nodeId).toBe('hub');
		expect(result.width).toBeCloseTo(60, 5);
		expect(result.height).toBeCloseTo(60, 5);
		expect(result.x).toBeCloseTo(170, 5);
		expect(result.y).toBeCloseTo(70, 5);
	});
});
