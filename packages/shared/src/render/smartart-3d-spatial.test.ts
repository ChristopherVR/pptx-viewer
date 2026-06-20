import { describe, it, expect } from 'vitest';

import { buildSmartArt3DModel } from './smartart-3d-model';
import { applySpatialLayout } from './smartart-3d-spatial';
import type { SmartArt3DModel } from './smartart-3d-types';
import type { RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

function circleNode(key: string, cx: number, cy: number): RenderedNode {
	return {
		kind: 'circle',
		key,
		cx,
		cy,
		r: 20,
		fill: '#4f81bd',
		stroke: '#385d8a',
		strokeWidth: 1,
		opacity: 1,
		text: key,
		fontSize: 12,
	};
}

function rectNode(key: string, x: number, y: number): RenderedNode {
	return {
		kind: 'rect',
		key,
		x,
		y,
		width: 60,
		height: 30,
		rx: 4,
		fill: '#4f81bd',
		stroke: '#385d8a',
		strokeWidth: 1,
		opacity: 1,
		text: key,
		fontSize: 12,
		textX: x + 30,
		textY: y + 15,
	};
}

function layout(
	nodes: RenderedNode[],
	family: SmartArtLayoutResult['family'],
): SmartArtLayoutResult {
	return { nodes, connectors: [], shadowFilter: undefined, viewBox: '0 0 200 200', family };
}

describe('applySpatialLayout - cycle carousel', () => {
	it('lifts ring nodes onto a horizontal XZ ring and faces them outward', () => {
		// Four nodes around the centre (100,100): top, right, bottom, left.
		const nodes = [
			circleNode('top', 100, 40),
			circleNode('right', 160, 100),
			circleNode('bottom', 100, 160),
			circleNode('left', 40, 100),
		];
		const model = buildSmartArt3DModel(layout(nodes, 'cycle'), { spatial: true });

		// All meshes lie on the y = 0 plane (a horizontal ring).
		for (const m of model.meshes) {
			expect(Math.abs(m.position.y)).toBeLessThan(1e-9);
		}
		// Each sits at radius 60 from the ring axis.
		for (const m of model.meshes) {
			expect(Math.hypot(m.position.x, m.position.z)).toBeCloseTo(60, 5);
		}
		// The top node maps to the +z front (angle 0).
		const top = model.meshes.find((m) => m.id === 'top')!;
		expect(top.position.z).toBeCloseTo(60, 5);
		expect(top.position.x).toBeCloseTo(0, 5);
		expect(top.rotation.y).toBeCloseTo(0, 5);
		// The right node maps a quarter turn around Y.
		const right = model.meshes.find((m) => m.id === 'right')!;
		expect(right.position.x).toBeCloseTo(60, 5);
		expect(right.rotation.y).toBeCloseTo(Math.PI / 2, 5);
	});

	it('treats radial the same as cycle', () => {
		const model = buildSmartArt3DModel(layout([circleNode('a', 100, 40)], 'radial'), {
			spatial: true,
		});
		expect(model.meshes[0].position.z).toBeCloseTo(60, 5);
	});
});

describe('applySpatialLayout - hierarchy recede', () => {
	it('pushes lower (deeper) levels back in -Z', () => {
		// Root high in world-y (top), child lower.
		const nodes = [rectNode('root', 70, 10), rectNode('child', 70, 150)];
		const model = buildSmartArt3DModel(layout(nodes, 'hierarchy'), { spatial: true });
		const root = model.meshes.find((m) => m.id === 'root')!;
		const child = model.meshes.find((m) => m.id === 'child')!;
		// Root (top, highest world-y) stays at z = 0; child recedes to negative z.
		expect(root.position.z).toBeCloseTo(0, 5);
		expect(child.position.z).toBeLessThan(0);
		// X/Y are preserved.
		expect(child.position.x).toBeCloseTo(root.position.x, 5);
	});
});

describe('applySpatialLayout - graceful passthrough', () => {
	it('leaves list/process families flat (rotation 0, z 0)', () => {
		const model = buildSmartArt3DModel(layout([rectNode('a', 10, 10)], 'list'), { spatial: true });
		expect(model.meshes[0].position.z).toBe(0);
		expect(model.meshes[0].rotation).toStrictEqual({ x: 0, y: 0, z: 0 });
	});

	it('is a no-op when called directly on a non-spatial family', () => {
		const flat = buildSmartArt3DModel(layout([rectNode('a', 10, 10)], 'matrix'));
		const same: SmartArt3DModel = applySpatialLayout(flat);
		expect(same).toBe(flat);
	});
});
