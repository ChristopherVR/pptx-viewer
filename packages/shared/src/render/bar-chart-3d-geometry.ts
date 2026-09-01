/**
 * Per-shape THREE geometry construction for the interactive bar3D scene
 * ({@link ./bar-chart-3d-scene.ts}), keyed by the resolved
 * `c:bar3DChart/c:shape` (or per-series `c:ser/c:shape` override).
 *
 * Every geometry is a UNIT mesh (spans -0.5..0.5 on every axis, matching
 * `THREE.BoxGeometry(1, 1, 1)`'s own extent), so the caller's existing
 * `mesh.scale.set(...box.size)` keeps working unchanged regardless of shape:
 * this module only decides WHICH geometry, never the box's world-space size
 * or position.
 *
 * `coneToMax` / `pyramidToMax` render as a truncated cone/pyramid
 * (`radiusTop < radiusBottom`) using
 * {@link BarChart3DBox.coneToMaxTopRadiusFactor}, so a bar far below the
 * value-axis maximum looks like a wide near-cylindrical frustum and a bar at
 * the maximum comes to a full point, matching every box being read as a
 * slice of one imaginary cone/pyramid whose apex sits at the axis max.
 *
 * @module bar-chart-3d-geometry
 */

import type { PptxBar3DShape } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { BarChart3DHit } from './bar-chart-3d-hit-test';
import type { BarChart3DBox } from './bar-chart-3d-layout';

type ThreeModule = typeof THREE;

/** Radial segment count for a full-round shape (cylinder / cone). */
const ROUND_SEGMENTS = 32;
/** Radial segment count for a 4-sided shape (pyramid), approximating a square base. */
const PYRAMID_SEGMENTS = 4;

/**
 * Build the unit-size geometry for one bar3D box, keyed by its resolved
 * shape. `box` (or an unrecognised/absent shape) keeps the original
 * `BoxGeometry(1, 1, 1)` behaviour.
 */
export function buildBar3DGeometry(
	three: ThreeModule,
	shape: PptxBar3DShape | undefined,
	coneToMaxTopRadiusFactor: number | undefined,
): THREE.BufferGeometry {
	switch (shape) {
		case 'cylinder':
			return new three.CylinderGeometry(0.5, 0.5, 1, ROUND_SEGMENTS);
		case 'cone':
			return new three.ConeGeometry(0.5, 1, ROUND_SEGMENTS);
		case 'pyramid':
			return new three.ConeGeometry(0.5, 1, PYRAMID_SEGMENTS);
		case 'coneToMax':
			return new three.CylinderGeometry(
				0.5 * (coneToMaxTopRadiusFactor ?? 0),
				0.5,
				1,
				ROUND_SEGMENTS,
			);
		case 'pyramidToMax':
			return new three.CylinderGeometry(
				0.5 * (coneToMaxTopRadiusFactor ?? 0),
				0.5,
				1,
				PYRAMID_SEGMENTS,
			);
		case 'box':
		default:
			return new three.BoxGeometry(1, 1, 1);
	}
}

/** The three per-box mesh resources the scene tracks for disposal/raycasting. */
export interface BarChart3DMeshGroup {
	meshes: THREE.Mesh[];
	materials: THREE.Material[];
	geometries: THREE.BufferGeometry[];
}

/**
 * Build and add one mesh per box to `scene`, geometry chosen per box's
 * resolved shape (see {@link buildBar3DGeometry}). Distinct shapes need
 * distinct THREE geometry instances (cone/pyramid share a class but differ by
 * radial segment count), so geometries are built per box rather than shared,
 * and returned for the caller to dispose individually on teardown.
 */
export function buildBar3DMeshGroup(
	three: ThreeModule,
	scene: THREE.Scene,
	boxes: ReadonlyArray<BarChart3DBox>,
): BarChart3DMeshGroup {
	const meshes: THREE.Mesh[] = [];
	const materials: THREE.Material[] = [];
	const geometries: THREE.BufferGeometry[] = [];
	for (const box of boxes) {
		const geometry = buildBar3DGeometry(three, box.shape, box.coneToMaxTopRadiusFactor);
		const material = new three.MeshPhongMaterial({ color: box.color, shininess: 30 });
		const mesh = new three.Mesh(geometry, material);
		mesh.position.set(...box.center);
		mesh.scale.set(...box.size);
		mesh.userData = {
			seriesIndex: box.seriesIndex,
			categoryIndex: box.categoryIndex,
			value: box.value,
		} satisfies BarChart3DHit;
		scene.add(mesh);
		meshes.push(mesh);
		materials.push(material);
		geometries.push(geometry);
	}
	return { meshes, materials, geometries };
}
