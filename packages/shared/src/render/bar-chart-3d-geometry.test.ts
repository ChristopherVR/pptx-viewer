import { describe, expect, it } from 'vitest';

import { buildBar3DGeometry, buildBar3DMeshGroup } from './bar-chart-3d-geometry';
import type { BarChart3DBox } from './bar-chart-3d-layout';

class FakeGeometry {
	constructor(public args: unknown[]) {}
}

/** Minimal fake `three` module exposing only what `buildBar3DGeometry` touches. */
function fakeThree() {
	return {
		BoxGeometry: class extends FakeGeometry {
			constructor(...args: unknown[]) {
				super(args);
			}
		},
		CylinderGeometry: class extends FakeGeometry {
			constructor(...args: unknown[]) {
				super(args);
			}
		},
		ConeGeometry: class extends FakeGeometry {
			constructor(...args: unknown[]) {
				super(args);
			}
		},
	};
}

describe('buildBar3DGeometry', () => {
	it('uses BoxGeometry(1,1,1) when shape is absent', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, undefined, undefined);
		expect(geometry).toBeInstanceOf(three.BoxGeometry);
		expect((geometry as unknown as FakeGeometry).args).toStrictEqual([1, 1, 1]);
	});

	it('uses BoxGeometry(1,1,1) for shape "box"', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, 'box', undefined);
		expect(geometry).toBeInstanceOf(three.BoxGeometry);
	});

	it('uses a full-radius CylinderGeometry for "cylinder"', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, 'cylinder', undefined);
		expect(geometry).toBeInstanceOf(three.CylinderGeometry);
		expect((geometry as unknown as FakeGeometry).args).toStrictEqual([0.5, 0.5, 1, 32]);
	});

	it('uses a 32-segment ConeGeometry for "cone" (full point every time)', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, 'cone', undefined);
		expect(geometry).toBeInstanceOf(three.ConeGeometry);
		expect((geometry as unknown as FakeGeometry).args).toStrictEqual([0.5, 1, 32]);
	});

	it('uses a 4-segment ConeGeometry for "pyramid"', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, 'pyramid', undefined);
		expect(geometry).toBeInstanceOf(three.ConeGeometry);
		expect((geometry as unknown as FakeGeometry).args).toStrictEqual([0.5, 1, 4]);
	});

	it('uses a truncated (32-segment) CylinderGeometry for "coneToMax"', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, 'coneToMax', 0.25);
		expect(geometry).toBeInstanceOf(three.CylinderGeometry);
		expect((geometry as unknown as FakeGeometry).args).toStrictEqual([0.125, 0.5, 1, 32]);
	});

	it('uses a truncated (4-segment) CylinderGeometry for "pyramidToMax"', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, 'pyramidToMax', 0.5);
		expect(geometry).toBeInstanceOf(three.CylinderGeometry);
		expect((geometry as unknown as FakeGeometry).args).toStrictEqual([0.25, 0.5, 1, 4]);
	});

	it('defaults the top radius to 0 (a full point) when coneToMaxTopRadiusFactor is absent', () => {
		const three = fakeThree();
		const geometry = buildBar3DGeometry(three as never, 'coneToMax', undefined);
		expect((geometry as unknown as FakeGeometry).args).toStrictEqual([0, 0.5, 1, 32]);
	});
});

describe('buildBar3DMeshGroup', () => {
	function makeScene() {
		const added: unknown[] = [];
		return { scene: { add: (m: unknown) => added.push(m) }, added };
	}

	function makeBox(overrides: Partial<BarChart3DBox> = {}): BarChart3DBox {
		return {
			seriesIndex: 0,
			categoryIndex: 0,
			value: 10,
			color: '#4472C4',
			center: [0, 0.5, 0],
			size: [0.4, 1, 0.4],
			...overrides,
		};
	}

	function fakeThreeForMeshes() {
		return {
			...fakeThree(),
			MeshPhongMaterial: class {
				constructor(public opts: unknown) {}
			},
			Mesh: class {
				position = { set: () => {} };
				scale = { set: () => {} };
				rotation = { z: 0 };
				userData: unknown;
				constructor(
					public geometry: unknown,
					public material: unknown,
				) {}
			},
		};
	}

	it('builds one mesh/material/geometry per box and adds each mesh to the scene', () => {
		const three = fakeThreeForMeshes();
		const { scene, added } = makeScene();
		const boxes = [makeBox({ shape: 'box' }), makeBox({ categoryIndex: 1, shape: 'cylinder' })];
		const group = buildBar3DMeshGroup(three as never, scene as never, boxes);
		expect(group.meshes).toHaveLength(2);
		expect(group.materials).toHaveLength(2);
		expect(group.geometries).toHaveLength(2);
		expect(added).toHaveLength(2);
		expect(group.geometries[0]).toBeInstanceOf(three.BoxGeometry);
		expect(group.geometries[1]).toBeInstanceOf(three.CylinderGeometry);
	});

	it('carries (seriesIndex, categoryIndex, value) onto each mesh userData', () => {
		const three = fakeThreeForMeshes();
		const { scene } = makeScene();
		const boxes = [makeBox({ seriesIndex: 2, categoryIndex: 3, value: 42 })];
		const group = buildBar3DMeshGroup(three as never, scene as never, boxes);
		expect(group.meshes[0].userData).toStrictEqual({
			seriesIndex: 2,
			categoryIndex: 3,
			value: 42,
		});
	});

	it('leaves mesh rotation at 0 when horizontal is omitted or false', () => {
		const three = fakeThreeForMeshes();
		const { scene } = makeScene();
		const group = buildBar3DMeshGroup(three as never, scene as never, [makeBox()]);
		expect(group.meshes[0].rotation.z).toBe(0);
		const groupExplicit = buildBar3DMeshGroup(three as never, scene as never, [makeBox()], false);
		expect(groupExplicit.meshes[0].rotation.z).toBe(0);
	});

	it('rotates every mesh -Math.PI / 2 about Z for a horizontal (barDir=bar) chart', () => {
		const three = fakeThreeForMeshes();
		const { scene } = makeScene();
		const boxes = [makeBox({ shape: 'box' }), makeBox({ shape: 'cylinder', categoryIndex: 1 })];
		const group = buildBar3DMeshGroup(three as never, scene as never, boxes, true);
		expect(group.meshes[0].rotation.z).toBe(-Math.PI / 2);
		expect(group.meshes[1].rotation.z).toBe(-Math.PI / 2);
	});
});
