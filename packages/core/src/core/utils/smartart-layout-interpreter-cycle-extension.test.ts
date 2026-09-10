import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import type { CycleBoxInputs } from './smartart-layout-interpreter-cycle-boxes';
import {
	applyCycleRingExtensions,
	buildCycleRingExtensions,
	hasMaxDepthGuard,
} from './smartart-layout-interpreter-cycle-extension';
import { styleContext } from './smartart-layout-interpreter-render';
import type { RenderedNode, RenderedRectNode } from './smartart-layout-types';

/** Every node in these tests resolves `kind: 'rect'` (forced via `boxInputs.shape`). */
function asRect(entry: RenderedNode): RenderedRectNode {
	if (entry.kind !== 'rect') {
		throw new Error(`expected a rect node, got ${entry.kind}`);
	}
	return entry;
}

const boxInputs: CycleBoxInputs = {
	palette: ['#fff'],
	style: 'flat',
	ctx: styleContext('flat'),
	// A `roundRect` preset resolves to `rect` kind (`x`/`y`/`width`/`height`
	// fields), matching every real cycle-family gallery item - `undefined`
	// would fall back to `arrangeCycle`'s own `'circle'` default and force
	// every assertion below onto `cx`/`cy`/`r` instead.
	shape: { presetGeometry: 'roundRect' },
	elementId: 'e',
};

function node(id: string, text = id): PptxSmartArtNode {
	return { id, text };
}

describe('buildCycleRingExtensions', () => {
	it('is a no-op when the parent node has no children', () => {
		const result = buildCycleRingExtensions(
			{ x: 100, y: 100 },
			node('parent'),
			{
				...boxInputs,
				ringCentre: { x: 0, y: 0 },
				itemWidth: 20,
				itemHeight: 20,
				gapPx: 5,
				fanSpanDeg: 60,
				childrenOf: new Map(),
			},
			'0',
		);
		expect(result.nodes).toHaveLength(0);
		expect(result.connectors).toHaveLength(0);
	});

	it('places a lone child on the ray from the ring centre through the parent, one item-width-plus-gap further out - radial-cluster--hier5.pptx\'s own "Node Four" -> "Node Five" shape (COM-verified continuation direction, see the module doc comment)', () => {
		// Ring centre at origin, parent directly "north" of it (matching this
		// module's own `angleRad = atan2` convention: (0, -100) is straight up).
		const parentCentre = { x: 0, y: -100 };
		const child = node('five', 'Node Five');
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['four', [child]]]);
		const result = buildCycleRingExtensions(
			parentCentre,
			node('four', 'Node Four'),
			{
				...boxInputs,
				ringCentre: { x: 0, y: 0 },
				itemWidth: 40,
				itemHeight: 40,
				gapPx: 10,
				fanSpanDeg: 60,
				childrenOf,
			},
			'2',
		);
		expect(result.nodes).toHaveLength(1);
		// Continues straight up: same x as the parent, further negative y.
		const only = asRect(result.nodes[0]);
		expect(only.nodeId).toBe('five');
		const cx = only.x + only.width / 2;
		const cy = only.y + only.height / 2;
		expect(cx).toBeCloseTo(0, 5);
		// radius = itemWidth/2 + gapPx + halfExtent = 20 + 10 + 20 = 50.
		expect(cy).toBeCloseTo(-150, 5);
		expect(result.connectors).toHaveLength(1);
	});

	it('recurses for a grandchild (depth > 1), continuing further along the same outward direction', () => {
		const grandchild = node('gc', 'Grandchild');
		const child = node('c', 'Child');
		const childrenOf = new Map<string, PptxSmartArtNode[]>([
			['parent', [child]],
			['c', [grandchild]],
		]);
		const result = buildCycleRingExtensions(
			{ x: 0, y: -100 },
			node('parent'),
			{
				...boxInputs,
				ringCentre: { x: 0, y: 0 },
				itemWidth: 40,
				itemHeight: 40,
				gapPx: 10,
				fanSpanDeg: 60,
				childrenOf,
			},
			'0',
		);
		expect(result.nodes.map((n) => n.nodeId)).toStrictEqual(['c', 'gc']);
		expect(result.connectors).toHaveLength(2);
	});

	it('fans a multi-child sibling group symmetrically around the outward direction (unverified extrapolation, see module doc comment)', () => {
		const a = node('a');
		const b = node('b');
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['parent', [a, b]]]);
		const result = buildCycleRingExtensions(
			{ x: 0, y: -100 },
			node('parent'),
			{
				...boxInputs,
				ringCentre: { x: 0, y: 0 },
				itemWidth: 40,
				itemHeight: 40,
				gapPx: 10,
				fanSpanDeg: 90,
				childrenOf,
			},
			'0',
		);
		expect(result.nodes).toHaveLength(2);
		const centres = result.nodes.map((n) => {
			const rect = asRect(n);
			return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
		});
		// Symmetric about x=0 (the outward direction), same y.
		expect(centres[0].x).toBeCloseTo(-centres[1].x, 5);
		expect(centres[0].y).toBeCloseTo(centres[1].y, 5);
	});
});

describe('applyCycleRingExtensions', () => {
	it("combines every ring point's own (possibly empty) extension into one result", () => {
		const ring = {
			centers: [
				{ x: 0, y: -100 },
				{ x: 100, y: 0 },
			],
			nodeWidth: 40,
			nodeHeight: 40,
			hubCenter: { x: 0, y: 0 },
			hubHalfWidth: 10,
			hubHalfHeight: 10,
		};
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['a', [node('a-child')]]]);
		const result = applyCycleRingExtensions([node('a'), node('b')], ring, {
			...boxInputs,
			ringCentre: ring.hubCenter,
			minGapRatio: 0.5,
			absoluteGapPx: undefined,
			ringStepDeg: 90,
			childrenOf,
		});
		expect(result.nodes.map((n) => n.nodeId)).toStrictEqual(['a-child']);
		expect(result.connectors).toHaveLength(1);
	});
});

describe('hasMaxDepthGuard', () => {
	it('false when the node has no chooseGuard at all (radial-cycle/basic-radial/diverging-radial/converging-radial/radial-venn, all COM-verified chooseGuard: undefined)', () => {
		expect(hasMaxDepthGuard({ algorithm: { type: 'cycle' } })).toBeFalsy();
	});

	it('false when chooseGuard is present but names a different function', () => {
		expect(
			hasMaxDepthGuard({
				algorithm: { type: 'cycle' },
				chooseGuard: [{ function: 'cnt', operator: 'equ', value: '1' }],
			}),
		).toBeFalsy();
	});

	it('true when chooseGuard includes a func="maxDepth" condition (radial-cluster\'s own singleCycle, reached through exactly one func="maxDepth" op="lte" val="1" - COM-verified via a direct discoverArrangement dump)', () => {
		expect(
			hasMaxDepthGuard({
				algorithm: { type: 'cycle' },
				chooseGuard: [{ function: 'maxDepth', operator: 'lte', value: '1' }],
			}),
		).toBeTruthy();
	});

	it('true when maxDepth is one of several chained guard conditions, in any position', () => {
		expect(
			hasMaxDepthGuard({
				algorithm: { type: 'cycle' },
				chooseGuard: [
					{ function: 'cnt', operator: 'equ', value: '1' },
					{ function: 'maxDepth', operator: 'gt', value: '1' },
				],
			}),
		).toBeTruthy();
	});
});
