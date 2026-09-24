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

import type { ObliqueBar, ObliqueChartLayout } from './chart-3d-oblique-layout';
import {
	buildObliqueShapeGeometry,
	isShapedObliqueBar,
	obliqueShapeKey,
	shadeObliqueShapeGeometry,
} from './chart-3d-oblique-shape-mesh';
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

/**
 * Place (and for a `c:shape` bar, reshape and reshade) a bar's mesh at a
 * bar's current world box. Used at build time and for the drag preview.
 */
export function placeObliqueBarMesh(
	three: ThreeModule,
	mesh: THREE.Mesh,
	layout: ObliqueChartLayout,
	svgWidth: number,
	svgHeight: number,
	bar: ObliqueBar,
): void {
	mesh.position.set(
		...obliqueToScene(layout, svgWidth, svgHeight, [
			bar.x + bar.w / 2,
			bar.y + bar.h / 2,
			bar.z + bar.d / 2,
		]),
	);
	mesh.scale.set(Math.max(bar.w, 0.001), Math.max(bar.h, 0.001), bar.d);
	if (!isShapedObliqueBar(bar)) {
		return;
	}
	const key = obliqueShapeKey(bar, layout.horizontal);
	const data = mesh.userData as { shapeKey?: string };
	if (data.shapeKey !== key) {
		const previous = mesh.geometry;
		mesh.geometry = buildObliqueShapeGeometry(three, bar, layout.horizontal);
		previous.dispose();
		data.shapeKey = key;
	}
	shadeObliqueShapeGeometry(three, mesh.geometry, bar, mesh.scale, Math.atan(layout.shear.x));
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
	const lineGeometries: THREE.BufferGeometry[] = [];
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
		lineGeometries.push(lineGeometry);
		materials.push(lineMaterial);
		group.add(new three.LineSegments(lineGeometry, lineMaterial));
	}

	for (const bar of layout.bars) {
		let mesh: THREE.Mesh;
		if (isShapedObliqueBar(bar)) {
			const material = new three.MeshBasicMaterial({ vertexColors: true });
			materials.push(material);
			mesh = new three.Mesh(new three.BufferGeometry(), material);
		} else {
			const faceMaterials = buildChart3DBoxFaceColors(bar.color).map(
				(color) => new three.MeshBasicMaterial({ color }),
			);
			materials.push(...faceMaterials);
			mesh = new three.Mesh(new three.BoxGeometry(1, 1, 1), faceMaterials);
		}
		mesh.userData = { seriesIndex: bar.seriesIndex, categoryIndex: bar.categoryIndex };
		placeObliqueBarMesh(three, mesh, layout, svgWidth, svgHeight, bar);
		group.add(mesh);
		meshes.push(mesh);
	}

	return {
		group,
		meshes,
		dispose: () => {
			// A drag preview may have swapped a shaped bar's geometry, so free
			// whatever each mesh holds now.
			for (const geometry of [...lineGeometries, ...meshes.map((m) => m.geometry)]) {
				geometry.dispose();
			}
			for (const material of materials) {
				material.dispose();
			}
		},
	};
}
