/**
 * Builds and live-updates the wedge meshes for an interactive pie3D scene.
 * Extracted out of `pie-chart-3d-scene.ts` to keep that file under the repo's
 * per-file LOC budget, and as the natural seam shared by the INITIAL mount
 * (one `THREE.CylinderGeometry` mesh per wedge) and a live value drag (which
 * disposes and rebuilds a wedge's geometry from a freshly recomputed angle,
 * see `pie-chart-3d-scene.ts`'s `recomputeLiveAngles`).
 *
 * @module pie-chart-3d-mesh
 */
import type * as THREE from 'three';

import type { PieChart3DWedge } from './pie-chart-3d-data';
import type { PieChart3DSliceAngle } from './pie-chart-3d-geom';
import type { PieChart3DHit } from './pie-chart-3d-hit-test';

/** Minimum radial segments per wedge so a thin slice is still visibly curved. */
const MIN_RADIAL_SEGMENTS = 3;
/** Radial segments for a full-circle wedge (360deg); scaled down for narrower slices. */
const FULL_CIRCLE_SEGMENTS = 64;

function wedgeSegments(thetaLength: number): number {
	return Math.max(
		MIN_RADIAL_SEGMENTS,
		Math.round((thetaLength / (Math.PI * 2)) * FULL_CIRCLE_SEGMENTS),
	);
}

/** The three mesh/geometry/material arrays a mounted pie3D scene owns, index-aligned by `pointIndex`. */
export interface PieChart3DWedgeMeshGroup {
	meshes: THREE.Mesh[];
	geometries: THREE.BufferGeometry[];
	materials: THREE.Material[];
}

/**
 * Build one `THREE.CylinderGeometry` wedge mesh per data point: radiusTop =
 * radiusBottom = `outerRadius`, height = `thickness`, capped (`openEnded`
 * `false`) so a partial `thetaLength` gets real flat top/bottom + curved rim +
 * flat radial "cut" faces for free. Adds every mesh to `scene`.
 */
export function buildPieChart3DWedgeMeshes(
	three: typeof THREE,
	scene: THREE.Scene,
	wedges: ReadonlyArray<PieChart3DWedge>,
	outerRadius: number,
	thickness: number,
): PieChart3DWedgeMeshGroup {
	const meshes: THREE.Mesh[] = [];
	const geometries: THREE.BufferGeometry[] = [];
	const materials: THREE.Material[] = [];
	for (const wedge of wedges) {
		const geometry = new three.CylinderGeometry(
			outerRadius,
			outerRadius,
			thickness,
			wedgeSegments(wedge.thetaLength),
			1,
			false,
			wedge.startAngle,
			wedge.thetaLength,
		);
		const material = new three.MeshPhongMaterial({ color: wedge.color, shininess: 30 });
		const mesh = new three.Mesh(geometry, material);
		mesh.position.set(wedge.explodeOffset[0], 0, wedge.explodeOffset[1]);
		mesh.userData = { pointIndex: wedge.pointIndex, value: wedge.value } satisfies PieChart3DHit;
		scene.add(mesh);
		meshes.push(mesh);
		geometries.push(geometry);
		materials.push(material);
	}
	return { meshes, geometries, materials };
}

/**
 * Rebuild every wedge mesh's geometry + position + `userData` from a freshly
 * recomputed angle set (a live value drag: `pie-chart-3d-scene.ts`'s
 * `recomputeLiveAngles`), mutating `geometries` in place (disposing each old
 * one) so `mountPieChart3D`'s own `dispose()` still tears down exactly the
 * geometries actually on screen, whichever wedge was last dragged.
 */
export function applyPieChart3DWedgeAngles(
	three: typeof THREE,
	meshes: ReadonlyArray<THREE.Mesh>,
	geometries: THREE.BufferGeometry[],
	outerRadius: number,
	thickness: number,
	angles: readonly PieChart3DSliceAngle[],
): void {
	for (const angle of angles) {
		const mesh = meshes[angle.pointIndex];
		const oldGeometry = geometries[angle.pointIndex];
		if (!mesh || !oldGeometry) {
			continue;
		}
		const geometry = new three.CylinderGeometry(
			outerRadius,
			outerRadius,
			thickness,
			wedgeSegments(angle.thetaLength),
			1,
			false,
			angle.startAngle,
			angle.thetaLength,
		);
		mesh.geometry = geometry;
		oldGeometry.dispose();
		geometries[angle.pointIndex] = geometry;
		mesh.position.set(angle.explodeOffset[0], 0, angle.explodeOffset[1]);
		mesh.userData = { pointIndex: angle.pointIndex, value: angle.value } satisfies PieChart3DHit;
	}
}
