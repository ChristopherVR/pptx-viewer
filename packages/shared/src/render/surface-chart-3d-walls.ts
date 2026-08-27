/**
 * Floor/side-wall/back-wall backdrop planes for an interactive 3D chart scene.
 *
 * `c:floor`, `c:sideWall`, and `c:backWall` are parsed onto `PptxChartData`
 * but, before this module, only the flat SVG isometric renderer painted
 * them; a WebGL scene showed a fixed grey `GridHelper` regardless of what
 * was authored. Each authored surface becomes one semi-transparent plane
 * mesh so the interactive view agrees with the SVG one. A surface with no
 * authored fill colour gets no plane, so an untouched chart's WebGL scene is
 * unchanged.
 *
 * Shared by every interactive chart scene that has a category/series grid to
 * wall in: the surface chart ({@link ./surface-chart-3d-scene.ts}) and the
 * cartesian bar3D scene ({@link ./bar-chart-3d-scene.ts}), and (pending
 * follow-up) line3D/area3D. Each caller passes its OWN grid extent (a
 * cartesian chart's depth axis is scaled by `c:view3D/@depthPercent`, unlike
 * the surface chart's 1:1 row spacing), so this module never recomputes an
 * extent that could disagree with the caller's own mesh layout.
 *
 * @module surface-chart-3d-walls
 */
import type * as THREE from 'three';

import { computeGridExtent } from './surface-chart-3d-geom';
import type { GridExtent } from './surface-chart-3d-geom';

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
 *
 * `extent` defaults to the surface chart's own `computeGridExtent(cols, rows)`
 * (1:1 grid-step spacing) when omitted, so existing callers are unaffected.
 * A cartesian scene whose depth axis is NOT 1:1 with its row count (bar3D's
 * `c:view3D/@depthPercent` scaling) passes its own precomputed extent instead
 * of letting this module recompute a mismatched one.
 */
export function buildSurfaceWallMeshes(
	three: ThreeModule,
	cols: number,
	rows: number,
	wallHeight: number,
	colors: SurfaceWallColors,
	extent?: GridExtent,
): SurfaceWallMeshes {
	const { gridWidth, gridDepth } = extent ?? computeGridExtent(cols, rows);
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
