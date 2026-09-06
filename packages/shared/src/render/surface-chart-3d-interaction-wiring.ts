/**
 * Wires the shared 3D click-to-select / drag-to-value pointer state machine
 * ({@link ./chart-3d-pointer-interaction.ts}) onto a mounted surface3D scene's
 * single shared mesh. Extracted out of `surface-chart-3d-scene.ts` to keep
 * that file under the repo's per-file LOC budget, and as the natural seam for
 * surface3D's own facet -> cell mapping, highlight marker, and drag
 * calibration.
 *
 * Unlike bar3D/line3D/area3D/pie3D (`chart-3d-mesh-highlight.ts`: one mesh per
 * mark, tint its own material), a surface3D grid is ONE mesh with per-vertex
 * colour, so there is no per-cell material to isolate. Selection is instead
 * shown by a small marker mesh positioned at the selected vertex (see
 * {@link createSurfaceHighlightMarker}), the same visual language line3D uses
 * for its own per-vertex markers.
 *
 * @module surface-chart-3d-interaction-wiring
 */
import type * as THREE from 'three';

import {
	chart3DHitToPartRef,
	CHART_3D_SELECTED_EMISSIVE,
	CHART_3D_SELECTED_EMISSIVE_INTENSITY,
} from './chart-3d-interaction';
import { attachChart3DPointerInteraction } from './chart-3d-pointer-interaction';
import type {
	Chart3DPointerInteractionHandle,
	Chart3DPointerInteractionOptions,
} from './chart-3d-pointer-interaction';
import type { ChartPartRef } from './chart-view-model';
import { calibrateSurfaceChart3DDrag } from './surface-chart-3d-drag';
import { surfaceVertexWorldPosition } from './surface-chart-3d-geom';
import { surfaceFaceIndexToCell } from './surface-chart-3d-hit-test';
import type { SurfaceCellHit } from './surface-chart-3d-hit-test';

/**
 * Click-to-select / drag-to-value wiring for a mounted surface3D scene.
 * Optional: omit entirely for a purely presentational (non-editable) mount.
 */
export interface SurfaceChart3DInteraction {
	/** Called when the user clicks a facet, or empty space (`null`, clearing selection). */
	onSelect?: Chart3DPointerInteractionOptions['onSelect'];
	/** Called continuously while dragging the selected vertex's value (live preview). */
	onValueDragPreview?: (part: ChartPartRef, value: number) => void;
	/** Called once on release with the final dragged value. */
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

const MARKER_RADIUS = 0.07;
/** Lifts the marker just clear of the mesh surface so it never z-fights it. */
const MARKER_Y_OFFSET = 0.03;

/** A small sphere marking the currently-selected grid vertex; hidden when nothing is selected. */
export interface SurfaceHighlightMarker {
	mesh: THREE.Mesh;
	/** Move (and show) the marker onto `cell`, or hide it when `cell` is `null`. */
	setSelected: (cell: SurfaceCellHit | null) => void;
	dispose: () => void;
}

/**
 * Build the selection marker mesh for a surface3D scene. The caller adds
 * `.mesh` to its scene and disposes the returned handle alongside its other
 * geometries/materials.
 */
export function createSurfaceHighlightMarker(
	three: typeof THREE,
	cols: number,
	rows: number,
	heightMap: Float32Array,
): SurfaceHighlightMarker {
	const geometry = new three.SphereGeometry(MARKER_RADIUS, 12, 8);
	const material = new three.MeshPhongMaterial({
		color: CHART_3D_SELECTED_EMISSIVE,
		emissive: CHART_3D_SELECTED_EMISSIVE,
		emissiveIntensity: CHART_3D_SELECTED_EMISSIVE_INTENSITY,
		shininess: 30,
	});
	const mesh = new three.Mesh(geometry, material);
	mesh.visible = false;
	return {
		mesh,
		setSelected(cell) {
			if (!cell) {
				mesh.visible = false;
				return;
			}
			const [x, y, z] = surfaceVertexWorldPosition(cols, rows, cell.row, cell.col, heightMap);
			mesh.position.set(x, y + MARKER_Y_OFFSET, z);
			mesh.visible = true;
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

/** Everything {@link attachSurfaceChart3DInteraction} needs from the mounted scene. */
export interface SurfaceChart3DInteractionParams {
	three: typeof THREE;
	canvas: HTMLCanvasElement;
	camera: THREE.Camera;
	/** The scene's OrbitControls instance; suspended while a value drag is in progress. */
	controls: { enabled: boolean };
	width: number;
	height: number;
	/** The single shared surface mesh, raycast against for both click and drag. */
	surfaceMesh: THREE.Object3D;
	cols: number;
	rows: number;
	heightMap: Float32Array;
	/** Raw (un-normalised) values, row-major, length rows*cols. No calibrated drag without these. */
	values: Float32Array | undefined;
	highlightMarker: SurfaceHighlightMarker;
	interaction: SurfaceChart3DInteraction | undefined;
}

function cellFromIntersection(
	intersection: THREE.Intersection,
	cols: number,
	rows: number,
): SurfaceCellHit | null {
	return intersection.faceIndex === undefined || intersection.faceIndex === null
		? null
		: surfaceFaceIndexToCell(intersection.faceIndex, cols, rows);
}

/** Attach click-to-select / drag-to-value handling to a mounted surface3D scene. */
export function attachSurfaceChart3DInteraction(
	params: SurfaceChart3DInteractionParams,
): Chart3DPointerInteractionHandle {
	return attachChart3DPointerInteraction({
		three: params.three,
		canvas: params.canvas,
		camera: params.camera,
		width: params.width,
		height: params.height,
		meshes: [params.surfaceMesh],
		resolveHit: (intersection) => {
			const cell = cellFromIntersection(intersection, params.cols, params.rows);
			return chart3DHitToPartRef(cell ? { seriesIndex: cell.row, pointIndex: cell.col } : null);
		},
		calibrateDrag: (intersection) => {
			const cell = cellFromIntersection(intersection, params.cols, params.rows);
			if (!cell || !params.values) {
				return null;
			}
			const idx = cell.row * params.cols + cell.col;
			const value = params.values[idx];
			if (value === undefined) {
				return null;
			}
			const position = surfaceVertexWorldPosition(
				params.cols,
				params.rows,
				cell.row,
				cell.col,
				params.heightMap,
			);
			return calibrateSurfaceChart3DDrag(position, value, params.values);
		},
		applyHighlight: (part) => {
			const cell =
				part && part.role === 'dataPoint' && part.pointIndex !== undefined
					? { row: part.seriesIndex, col: part.pointIndex }
					: null;
			params.highlightMarker.setSelected(cell);
		},
		setControlsEnabled: (enabled) => {
			params.controls.enabled = enabled;
		},
		onSelect: params.interaction?.onSelect,
		onValueDragPreview: params.interaction?.onValueDragPreview,
		onValueDragCommit: params.interaction?.onValueDragCommit,
	});
}
