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
import type { BarBoxPictureAssets } from './bar-chart-3d-materials';
import { buildBarBoxMaterial } from './bar-chart-3d-materials';

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
	/** One material (no picture fill) or a 6-entry `BoxGeometry` face-material array (`c:pictureOptions` resolved) per box. */
	materials: Array<THREE.Material | THREE.Material[]>;
	geometries: THREE.BufferGeometry[];
	/** Frees every box's own material(s) and any texture clone it owns (never the shared texture manager's base textures; see `BarChart3DTextureManager.disposeAll`). One entry per box, same order as `meshes`. */
	materialDisposers: Array<() => void>;
}

/**
 * Build and add one mesh per box to `scene`, geometry chosen per box's
 * resolved shape (see {@link buildBar3DGeometry}). Distinct shapes need
 * distinct THREE geometry instances (cone/pyramid share a class but differ by
 * radial segment count), so geometries are built per box rather than shared,
 * and returned for the caller to dispose individually on teardown.
 *
 * `horizontal` (`c:barDir val="bar"`) rotates every mesh `-Math.PI / 2` about
 * Z: `box.center` already sits in the horizontal world frame
 * (`layoutBarChart3D`), but `box.size` stays in the UNROTATED local frame
 * (width/height/depth as if the chart were still vertical), so a
 * cylinder/cone/pyramid keeps its true round cross-section lying on its side
 * instead of the ellipse a numeric width/height swap would produce. A plain
 * box shape looks identical either way (rotating a rectangular prism 90
 * degrees is the same as swapping two of its extents).
 *
 * `picture`, when given, resolves each box's `c:pictureOptions` picture-fill
 * face targeting via {@link buildBarBoxMaterial}; omitted entirely, every box
 * keeps its original single uniform `MeshPhongMaterial(box.color)`.
 */
export function buildBar3DMeshGroup(
	three: ThreeModule,
	scene: THREE.Scene,
	boxes: ReadonlyArray<BarChart3DBox>,
	horizontal = false,
	picture?: BarBoxPictureAssets,
): BarChart3DMeshGroup {
	const meshes: THREE.Mesh[] = [];
	const materials: Array<THREE.Material | THREE.Material[]> = [];
	const materialDisposers: Array<() => void> = [];
	const geometries: THREE.BufferGeometry[] = [];
	for (const box of boxes) {
		const geometry = buildBar3DGeometry(three, box.shape, box.coneToMaxTopRadiusFactor);
		const { material, dispose } = buildBarBoxMaterial(three, box, picture);
		const mesh = new three.Mesh(geometry, material);
		mesh.position.set(...box.center);
		mesh.scale.set(...box.size);
		if (horizontal) {
			mesh.rotation.z = -Math.PI / 2;
		}
		mesh.userData = {
			seriesIndex: box.seriesIndex,
			categoryIndex: box.categoryIndex,
			value: box.value,
		} satisfies BarChart3DHit;
		scene.add(mesh);
		meshes.push(mesh);
		materials.push(material);
		materialDisposers.push(dispose);
		geometries.push(geometry);
	}
	return { meshes, materials, geometries, materialDisposers };
}
