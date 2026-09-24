/**
 * Build the real WebGL box meshes for a `bar3D` chart's `Chart3DBarGeometry`
 * (see `chart-3d-spec.ts`). Split out of `chart-3d-view-scene.ts` to keep
 * that file within the repo's ~300-LOC limit.
 *
 * Every box is positioned so its FRONT face (world Z=0) sits exactly where
 * the flat 2D fallback's front-face rectangle would be drawn, in "1 world
 * unit = 1 authored chart px" coordinates matching `chart-3d-chrome-overlay.ts`'s
 * overlay `<svg>` viewBox. The box then extrudes backward (negative Z) by its
 * own depth, so the oblique camera's shear (`chart-3d-view-scene.ts`) shifts
 * only the BACK face, reproducing the same silhouette the flat 2D depth pass
 * draws as a hand-built parallelogram (`chart-3d-depth.ts#barExtrusion`).
 *
 * Only `PptxBar3DShape === 'box'` reaches this module today
 * (`chart-3d-spec.ts#isSupportedBoxShape` gates everything else out at the
 * spec level), so every box gets flat, per-face-group `MeshBasicMaterial`s
 * (no lights involved: PowerPoint's box faces are flat-shaded in chart
 * space, not lit) built from `chart-3d-shading.ts`'s measured multipliers.
 *
 * @module chart-3d-bar-mesh
 */
import type * as THREE from 'three';

import { buildChart3DBoxFaceColors } from './chart-3d-shading';
import type { Chart3DBarBox } from './chart-3d-spec';

type ThreeModule = typeof THREE;

export interface Chart3DBarMeshResult {
	group: THREE.Group;
	/** One mesh per box, same order as `boxes`; carries `{ seriesIndex, categoryIndex }` in `userData`. */
	meshes: THREE.Mesh[];
	dispose: () => void;
}

/**
 * Build one `THREE.Mesh` per box and add them to a new `THREE.Group`. World
 * coordinates: X/Y centred on the chart's own `svgWidth`/`svgHeight` (X
 * right, Y UP - the SVG Y-down front rect is flipped here), Z=0 at the
 * front face, extending negative (away from the camera) by the box's own
 * depth.
 */
export function buildChart3DBarMeshes(
	three: ThreeModule,
	boxes: ReadonlyArray<Chart3DBarBox>,
	svgWidth: number,
	svgHeight: number,
): Chart3DBarMeshResult {
	const group = new three.Group();
	const meshes: THREE.Mesh[] = [];
	const geometries: THREE.BufferGeometry[] = [];
	const materials: THREE.Material[] = [];
	const halfW = svgWidth / 2;
	const halfH = svgHeight / 2;

	for (const box of boxes) {
		const geometry = new three.BoxGeometry(1, 1, 1);
		geometries.push(geometry);
		const faceMaterials = buildChart3DBoxFaceColors(box.color).map(
			(color) => new three.MeshBasicMaterial({ color }),
		);
		materials.push(...faceMaterials);

		const mesh = new three.Mesh(geometry, faceMaterials);
		const zDepth = box.depthMagnitude;
		mesh.position.set(box.x + box.w / 2 - halfW, halfH - (box.y + box.h / 2), -zDepth / 2);
		mesh.scale.set(box.w, box.h, zDepth);
		mesh.userData = { seriesIndex: box.seriesIndex, categoryIndex: box.categoryIndex };
		group.add(mesh);
		meshes.push(mesh);
	}

	return {
		group,
		meshes,
		dispose: () => {
			for (const geometry of geometries) {
				geometry.dispose();
			}
			for (const material of materials) {
				material.dispose();
			}
		},
	};
}
