import { describe, expect, it, vi } from 'vitest';

import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';

/** Minimal fake of the `three` module surface this builder touches. */
function fakeThree() {
	const disposeCalls: string[] = [];
	class PlaneGeometry {
		constructor(
			public width: number,
			public height: number,
		) {}
		dispose = vi.fn(() => disposeCalls.push('geometry'));
	}
	class MeshBasicMaterial {
		color: unknown;
		opacity: number;
		constructor(opts: { color: unknown; opacity: number }) {
			this.color = opts.color;
			this.opacity = opts.opacity;
		}
		dispose = vi.fn(() => disposeCalls.push('material'));
	}
	class Mesh {
		position = { set: vi.fn() };
		rotation = { set: vi.fn() };
		constructor(
			public geometry: PlaneGeometry,
			public material: MeshBasicMaterial,
		) {}
	}
	const three = { PlaneGeometry, MeshBasicMaterial, Mesh, DoubleSide: 2 };
	return { three: three as unknown as typeof import('three'), disposeCalls };
}

describe('buildSurfaceWallMeshes', () => {
	it('builds no meshes when no surface has a fill colour', () => {
		const { three } = fakeThree();
		const result = buildSurfaceWallMeshes(three, 4, 3, 1.5, {});
		expect(result.meshes).toHaveLength(0);
	});

	it('builds one mesh per authored surface colour', () => {
		const { three } = fakeThree();
		const result = buildSurfaceWallMeshes(three, 4, 3, 1.5, {
			floor: '#111111',
			sideWall: '#222222',
			backWall: '#333333',
		});
		expect(result.meshes).toHaveLength(3);
	});

	it('positions and rotates the floor flat, and the walls upright', () => {
		const { three } = fakeThree();
		const result = buildSurfaceWallMeshes(three, 4, 3, 1.5, {
			floor: '#111111',
			backWall: '#333333',
		});
		const [floorMesh, backWallMesh] = result.meshes;
		expect(floorMesh.position.set).toHaveBeenCalledWith(0, -0.01, 0);
		expect(floorMesh.rotation.set).toHaveBeenCalledWith(-Math.PI / 2, 0, 0);
		expect(backWallMesh.rotation.set).toHaveBeenCalledWith(0, 0, 0);
	});

	it('disposes every created geometry and material exactly once', () => {
		const { three, disposeCalls } = fakeThree();
		const result = buildSurfaceWallMeshes(three, 4, 3, 1.5, {
			floor: '#111111',
			sideWall: '#222222',
		});
		result.dispose();
		expect(disposeCalls.filter((c) => c === 'geometry')).toHaveLength(2);
		expect(disposeCalls.filter((c) => c === 'material')).toHaveLength(2);
	});
});
