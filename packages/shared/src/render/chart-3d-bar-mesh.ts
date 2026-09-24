/**
 * WebGL geometry for a right-angle-axes `bar3D` chart
 * (`chart-3d-oblique-layout.ts`): one box mesh per bar and the wall/floor
 * gridlines, in the oblique scene's frame (`chart-3d-view-scene.ts`).
 *
 * Scene frame: X/Y in chart px centred on the chart (Y up), Z = minus the
 * layout's world depth, so the scene camera's shear moves only what recedes.
 * A layout point `(x, y, z)` sits at scene
 * `(origin.x + x - W/2, H/2 - origin.y + y, -z)`, which the camera projects to
 * exactly the chart px `obliqueToScreen` returns.
 *
 * Box faces are flat `MeshBasicMaterial`s (PowerPoint shades box faces flat
 * in chart space, not by lighting) from `chart-3d-shading.ts`'s measured
 * multipliers. Gridlines are drawn in the scene rather than the SVG overlay
 * because bars must hide the back-wall lines behind them.
 *
 * @module chart-3d-bar-mesh
 */
import type * as THREE from 'three';

import type { ObliqueChartLayout } from './chart-3d-oblique-layout';
import { buildChart3DBoxFaceColors } from './chart-3d-shading';

type ThreeModule = typeof THREE;

/** PowerPoint's default major gridline colour (tx1 at 15% tint, `#D9D9D9`). */
const GRIDLINE_COLOR = 0xd9d9d9;

export interface Chart3DBarMeshResult {
	group: THREE.Group;
	/** One mesh per bar, same order as `layout.bars`; carries `{ seriesIndex, categoryIndex }` in `userData`. */
	meshes: THREE.Mesh[];
	dispose: () => void;
}

/** Scene position of a layout world point. */
export function obliqueToScene(
	layout: ObliqueChartLayout,
	svgWidth: number,
	svgHeight: number,
	p: readonly [number, number, number],
): [number, number, number] {
	return [layout.origin.x + p[0] - svgWidth / 2, svgHeight / 2 - layout.origin.y + p[1], -p[2]];
}

/** Build the bar boxes and gridlines of an oblique layout into a new group. */
export function buildChart3DBarMeshes(
	three: ThreeModule,
	layout: ObliqueChartLayout,
	svgWidth: number,
	svgHeight: number,
): Chart3DBarMeshResult {
	const group = new three.Group();
	const meshes: THREE.Mesh[] = [];
	const geometries: THREE.BufferGeometry[] = [];
	const materials: THREE.Material[] = [];

	const points: number[] = [];
	for (const line of layout.gridlines) {
		points.push(
			...obliqueToScene(layout, svgWidth, svgHeight, line.from),
			...obliqueToScene(layout, svgWidth, svgHeight, line.to),
		);
	}
	if (points.length > 0) {
		const lineGeometry = new three.BufferGeometry();
		lineGeometry.setAttribute('position', new three.Float32BufferAttribute(points, 3));
		const lineMaterial = new three.LineBasicMaterial({ color: GRIDLINE_COLOR });
		geometries.push(lineGeometry);
		materials.push(lineMaterial);
		group.add(new three.LineSegments(lineGeometry, lineMaterial));
	}

	for (const bar of layout.bars) {
		const geometry = new three.BoxGeometry(1, 1, 1);
		geometries.push(geometry);
		const faceMaterials = buildChart3DBoxFaceColors(bar.color).map(
			(color) => new three.MeshBasicMaterial({ color }),
		);
		materials.push(...faceMaterials);
		const mesh = new three.Mesh(geometry, faceMaterials);
		const center = obliqueToScene(layout, svgWidth, svgHeight, [
			bar.x + bar.w / 2,
			bar.y + bar.h / 2,
			bar.z + bar.d / 2,
		]);
		mesh.position.set(...center);
		mesh.scale.set(Math.max(bar.w, 0.001), Math.max(bar.h, 0.001), bar.d);
		mesh.userData = { seriesIndex: bar.seriesIndex, categoryIndex: bar.categoryIndex };
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
