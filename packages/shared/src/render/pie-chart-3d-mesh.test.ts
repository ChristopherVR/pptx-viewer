/**
 * Unit tests for pie-chart-3d-mesh.ts: wedge mesh construction and the
 * live-drag geometry rebuild, against a minimal fake `three`.
 */
import { describe, expect, it, vi } from 'vitest';

import type { PieChart3DWedge } from './pie-chart-3d-data';
import type { PieChart3DSliceAngle } from './pie-chart-3d-geom';
import { applyPieChart3DWedgeAngles, buildPieChart3DWedgeMeshes } from './pie-chart-3d-mesh';

function fakeThree() {
	const disposeCalls: string[] = [];
	class BufferGeometry {
		id = Math.random();
		dispose = vi.fn(() => disposeCalls.push('geometry'));
	}
	class CylinderGeometry extends BufferGeometry {
		constructor(
			public radiusTop: number,
			public radiusBottom: number,
			public height: number,
			public radialSegments: number,
			public heightSegments: number,
			public openEnded: boolean,
			public thetaStart: number,
			public thetaLength: number,
		) {
			super();
		}
	}
	class Material {
		dispose = vi.fn();
	}
	class MeshPhongMaterial extends Material {
		constructor(public params: { color: string; shininess: number }) {
			super();
		}
	}
	class Mesh {
		geometry: unknown;
		material: unknown;
		userData: unknown = {};
		position = { x: 0, y: 0, z: 0, set: vi.fn() };
		constructor(geometry: unknown, material: unknown) {
			this.geometry = geometry;
			this.material = material;
		}
	}
	class Scene {
		children: unknown[] = [];
		add(o: unknown) {
			this.children.push(o);
		}
	}
	return {
		disposeCalls,
		three: {
			CylinderGeometry,
			MeshPhongMaterial,
			Mesh,
			Scene,
		} as unknown as typeof import('three'),
	};
}

const WEDGES: PieChart3DWedge[] = [
	{
		pointIndex: 0,
		value: 30,
		color: '#4472C4',
		startAngle: -Math.PI / 2,
		thetaLength: 1.5,
		explodeOffset: [0, 0],
	},
	{
		pointIndex: 1,
		value: 70,
		color: '#ED7D31',
		startAngle: 1.5 - Math.PI / 2,
		thetaLength: 4.78,
		explodeOffset: [0.1, 0.2],
	},
];

describe('buildPieChart3DWedgeMeshes', () => {
	it('builds one mesh/geometry/material per wedge and adds each mesh to the scene', () => {
		const { three } = fakeThree();
		const scene = new three.Scene();
		const group = buildPieChart3DWedgeMeshes(three, scene as never, WEDGES, 1, 0.3);

		expect(group.meshes).toHaveLength(2);
		expect(group.geometries).toHaveLength(2);
		expect(group.materials).toHaveLength(2);
		expect((scene as InstanceType<typeof three.Scene>).children).toHaveLength(2);
	});

	it('tags every mesh userData with its own point index and value', () => {
		const { three } = fakeThree();
		const scene = new three.Scene();
		const group = buildPieChart3DWedgeMeshes(three, scene as never, WEDGES, 1, 0.3);

		expect(group.meshes[0]?.userData).toStrictEqual({ pointIndex: 0, value: 30 });
		expect(group.meshes[1]?.userData).toStrictEqual({ pointIndex: 1, value: 70 });
	});

	it('positions each mesh at its own explosion offset', () => {
		const { three } = fakeThree();
		const scene = new three.Scene();
		const group = buildPieChart3DWedgeMeshes(three, scene as never, WEDGES, 1, 0.3);

		expect(group.meshes[1]?.position.set).toHaveBeenCalledWith(0.1, 0, 0.2);
	});
});

describe('applyPieChart3DWedgeAngles', () => {
	it('disposes the old geometry and swaps in a freshly built one per angle', () => {
		const { three } = fakeThree();
		const scene = new three.Scene();
		const group = buildPieChart3DWedgeMeshes(three, scene as never, WEDGES, 1, 0.3);
		const oldGeometry0 = group.geometries[0];
		const oldGeometry1 = group.geometries[1];

		const angles: PieChart3DSliceAngle[] = [
			{
				pointIndex: 0,
				value: 10,
				startAngle: -Math.PI / 2,
				thetaLength: 0.5,
				explodeOffset: [0, 0],
			},
			{
				pointIndex: 1,
				value: 90,
				startAngle: -Math.PI / 2 + 0.5,
				thetaLength: 5.78,
				explodeOffset: [0, 0],
			},
		];
		applyPieChart3DWedgeAngles(three, group.meshes, group.geometries, 1, 0.3, angles);

		expect(oldGeometry0?.dispose).toHaveBeenCalledOnce();
		expect(oldGeometry1?.dispose).toHaveBeenCalledOnce();
		expect(group.geometries[0]).not.toBe(oldGeometry0);
		expect(group.geometries[1]).not.toBe(oldGeometry1);
		expect(group.meshes[0]?.geometry).toBe(group.geometries[0]);
		expect(group.meshes[1]?.geometry).toBe(group.geometries[1]);
	});

	it('updates userData to the new (recomputed) value', () => {
		const { three } = fakeThree();
		const scene = new three.Scene();
		const group = buildPieChart3DWedgeMeshes(three, scene as never, WEDGES, 1, 0.3);

		applyPieChart3DWedgeAngles(three, group.meshes, group.geometries, 1, 0.3, [
			{ pointIndex: 0, value: 55, startAngle: 0, thetaLength: 2, explodeOffset: [0, 0] },
		]);

		expect(group.meshes[0]?.userData).toStrictEqual({ pointIndex: 0, value: 55 });
	});

	it('skips an angle whose point index has no matching mesh, without throwing', () => {
		const { three } = fakeThree();
		const scene = new three.Scene();
		const group = buildPieChart3DWedgeMeshes(three, scene as never, WEDGES, 1, 0.3);

		expect(() =>
			applyPieChart3DWedgeAngles(three, group.meshes, group.geometries, 1, 0.3, [
				{ pointIndex: 5, value: 1, startAngle: 0, thetaLength: 1, explodeOffset: [0, 0] },
			]),
		).not.toThrow();
	});
});
