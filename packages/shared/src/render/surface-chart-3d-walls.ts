/**
 * Floor/side-wall/back-wall backdrop planes for the interactive 3D surface
 * scene ({@link ./surface-chart-3d-scene.ts}).
 *
 * `c:floor`, `c:sideWall`, and `c:backWall` are parsed onto `PptxChartData`
 * but, before this module, only the flat SVG isometric renderer painted
 * them; the WebGL scene showed a fixed grey `GridHelper` regardless of what
 * was authored. Each authored surface becomes one semi-transparent plane
 * mesh so the interactive view agrees with the SVG one. A surface with no
 * authored fill colour gets no plane, so an untouched chart's WebGL scene is
 * unchanged.
 *
 * @module surface-chart-3d-walls
 */
import type * as THREE from 'three';

import { computeGridExtent } from './surface-chart-3d-geom';

type ThreeModule = typeof THREE;

/** `c:floor`/`c:sideWall`/`c:backWall` fill colours (`#RRGGBB`), when authored. */
export interface SurfaceWallColors {
	floor?: string;
	sideWall?: string;
	backWall?: string;
}

/** Disposable handle to the wall/floor meshes mounted into the scene. */
export interface SurfaceWallMeshes {
	meshes: THREE.Mesh[];
	dispose: () => void;
}

const PANEL_OPACITY = 0.35;

/**
 * Build plane meshes for each authored surface colour. The floor lies flat
 * under the grid (z=0); the back wall stands at the grid's far depth edge;
 * the side wall stands at the grid's far width edge, matching the 2D
 * isometric renderer's back-wall/side-wall corner convention.
 */
export function buildSurfaceWallMeshes(
	three: ThreeModule,
	cols: number,
	rows: number,
	wallHeight: number,
	colors: SurfaceWallColors,
): SurfaceWallMeshes {
	const { gridWidth, gridDepth } = computeGridExtent(cols, rows);
	const meshes: THREE.Mesh[] = [];
	const disposables: Array<{ dispose: () => void }> = [];

	const addPlane = (
		width: number,
		height: number,
		color: string,
		position: readonly [number, number, number],
		rotation: readonly [number, number, number],
	): void => {
		const geometry = new three.PlaneGeometry(width, height);
		const material = new three.MeshBasicMaterial({
			color,
			transparent: true,
			opacity: PANEL_OPACITY,
			side: three.DoubleSide,
			depthWrite: false,
		});
		const mesh = new three.Mesh(geometry, material);
		mesh.position.set(...position);
		mesh.rotation.set(...rotation);
		meshes.push(mesh);
		disposables.push(geometry, material);
	};

	if (colors.floor) {
		addPlane(gridWidth, gridDepth, colors.floor, [0, -0.01, 0], [-Math.PI / 2, 0, 0]);
	}
	if (colors.backWall) {
		addPlane(
			gridWidth,
			wallHeight,
			colors.backWall,
			[0, wallHeight / 2, -gridDepth / 2],
			[0, 0, 0],
		);
	}
	if (colors.sideWall) {
		addPlane(
			gridDepth,
			wallHeight,
			colors.sideWall,
			[gridWidth / 2, wallHeight / 2, 0],
			[0, Math.PI / 2, 0],
		);
	}

	return {
		meshes,
		dispose: () => {
			for (const d of disposables) {
				d.dispose();
			}
		},
	};
}
