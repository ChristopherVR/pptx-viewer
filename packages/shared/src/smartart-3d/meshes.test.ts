// @vitest-environment jsdom
/**
 * `buildMeshGroup` tests. Uses the REAL `three` package (a real dependency of
 * this package): `Group`/`Mesh`/geometry construction is pure CPU-side JS, no
 * WebGL context needed since nothing here calls `renderer.render`. The canvas
 * 2D context `makeTextTexture` reaches for is stubbed (jsdom has no real font
 * metrics; the point here is the mesh-group bookkeeping, not a rendered
 * glyph), matching `text-texture.test.ts`.
 */
import { Mesh } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SmartArt3DMesh, SmartArt3DModel } from '../render/smartart-3d-types';
import { buildMeshGroup } from './meshes';

function fakeCtx() {
	return {
		font: '',
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 0,
		textAlign: '',
		textBaseline: '',
		fillText: vi.fn(),
		measureText: vi.fn(() => ({ width: 40 })),
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
	};
}

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		fakeCtx() as unknown as CanvasRenderingContext2D,
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

function node(overrides: Partial<SmartArt3DMesh> = {}): SmartArt3DMesh {
	return {
		id: 'n1',
		outline: [
			{ x: -10, y: -10 },
			{ x: 10, y: -10 },
			{ x: 10, y: 10 },
			{ x: -10, y: 10 },
		],
		rounded: false,
		depth: 4,
		bevel: 0,
		fill: '#4472C4',
		stroke: '#333333',
		strokeWidth: 1,
		opacity: 1,
		position: { x: 0, y: 0, z: 0 },
		rotation: { x: 0, y: 0, z: 0 },
		text: 'Node text',
		textColor: '#ffffff',
		fontSize: 12,
		halfWidth: 10,
		halfHeight: 10,
		...overrides,
	};
}

function model(meshes: SmartArt3DMesh[]): SmartArt3DModel {
	return { meshes, connectors: [], bounds: { width: 100, height: 100 } };
}

/** Count `THREE.Mesh` instances currently attached to a group, as a proxy for label-plane presence. */
function meshCount(group: { children: unknown[] }): number {
	return group.children.filter((c) => c instanceof Mesh).length;
}

describe('buildMeshGroup', () => {
	it('builds one block mesh + one label plane mesh per text node', () => {
		const built = buildMeshGroup(model([node()]));
		// block mesh + label plane = 2 Mesh instances (edges are LineSegments, not Mesh).
		expect(meshCount(built.group)).toBe(2);
	});

	it('builds only the block mesh for a node with no text', () => {
		const built = buildMeshGroup(model([node({ text: '' })]));
		expect(meshCount(built.group)).toBe(1);
	});

	describe('setTextStyle', () => {
		it('keeps the same mesh count after applying an emphasis override (label rebuilt, not duplicated)', () => {
			const built = buildMeshGroup(model([node()]));
			built.setTextStyle({ bold: true, color: '#f00' });
			expect(meshCount(built.group)).toBe(2);
		});

		it('does not touch a textless node when applying an emphasis override', () => {
			const built = buildMeshGroup(model([node({ text: '' })]));
			built.setTextStyle({ bold: true });
			expect(meshCount(built.group)).toBe(1);
		});

		it('clearing the style (undefined) still leaves exactly one label plane mounted', () => {
			const built = buildMeshGroup(model([node()]), { bold: true });
			expect(meshCount(built.group)).toBe(2);
			built.setTextStyle(undefined);
			expect(meshCount(built.group)).toBe(2);
		});
	});

	describe('dispose', () => {
		it('removes the label plane it tracks (block extrusion mesh is left for the caller to discard with the group)', () => {
			const built = buildMeshGroup(model([node()]));
			expect(meshCount(built.group)).toBe(2);
			built.dispose();
			// The label plane is removed by `dispose` (tracked); the block mesh
			// itself is not individually removed, matching the group's own
			// teardown contract (the caller discards the whole `group`).
			expect(meshCount(built.group)).toBe(1);
		});

		it('does not throw when called twice or on a textless-only model', () => {
			const built = buildMeshGroup(model([node({ text: '' })]));
			expect(() => {
				built.dispose();
				built.dispose();
			}).not.toThrow();
		});
	});
});
