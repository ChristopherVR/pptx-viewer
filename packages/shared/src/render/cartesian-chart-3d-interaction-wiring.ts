/**
 * Wires the shared 3D click-to-select / drag-to-value pointer state machine
 * ({@link ./chart-3d-pointer-interaction.ts}) onto a mounted line3D/area3D
 * scene's per-vertex marker meshes. Both scenes share this ONE module (their
 * marker mesh, hit-test shape, and per-vertex layout data are identical - see
 * `line-chart-3d-scene.ts`, `area-chart-3d-scene.ts`,
 * `cartesian-chart-3d-hit-test.ts`), the same way `bar-chart-3d-drag.ts` /
 * `bar-chart-3d-interaction-wiring.ts` serve bar3D alone.
 *
 * @module cartesian-chart-3d-interaction-wiring
 */
import type * as THREE from 'three';

import { calibrateCartesianChart3DDrag } from './cartesian-chart-3d-drag';
import type { CartesianChart3DHit } from './cartesian-chart-3d-hit-test';
import type { CartesianLine3DSeriesPath } from './cartesian-line-chart-3d-layout';
import { chart3DHitToPartRef } from './chart-3d-interaction';
import { applyChart3DMeshHighlight } from './chart-3d-mesh-highlight';
import type { HighlightableMaterial } from './chart-3d-mesh-highlight';
import { attachChart3DPointerInteraction } from './chart-3d-pointer-interaction';
import type {
	Chart3DPointerInteractionHandle,
	Chart3DPointerInteractionOptions,
} from './chart-3d-pointer-interaction';
import type { ChartPartRef } from './chart-view-model';

/**
 * Click-to-select / drag-to-value wiring for a mounted line3D/area3D scene.
 * Optional: omit entirely for a purely presentational (non-editable) mount.
 */
export interface CartesianChart3DInteraction {
	/** Called when the user clicks a marker mesh, or empty space (`null`, clearing selection). */
	onSelect?: Chart3DPointerInteractionOptions['onSelect'];
	/** Called continuously while dragging a marker's value (live preview). */
	onValueDragPreview?: (part: ChartPartRef, value: number) => void;
	/** Called once on release with the final dragged value. */
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

/** Everything {@link attachCartesianChart3DInteraction} needs from the mounted scene. */
export interface CartesianChart3DInteractionParams {
	three: typeof THREE;
	canvas: HTMLCanvasElement;
	camera: THREE.Camera;
	/** The scene's OrbitControls instance; suspended while a value drag is in progress. */
	controls: { enabled: boolean };
	width: number;
	height: number;
	markerMeshes: ReadonlyArray<THREE.Mesh>;
	markerMaterials: ReadonlyArray<HighlightableMaterial>;
	/** The scene's own plain per-series vertex data (never mesh state read back off THREE). */
	series: ReadonlyArray<CartesianLine3DSeriesPath>;
	interaction: CartesianChart3DInteraction | undefined;
}

/** Attach click-to-select / drag-to-value handling to a mounted line3D/area3D scene. */
export function attachCartesianChart3DInteraction(
	params: CartesianChart3DInteractionParams,
): Chart3DPointerInteractionHandle {
	const highlightEntries = params.markerMeshes.map((mesh, i) => {
		const hit = mesh.userData as CartesianChart3DHit;
		return {
			mark: { seriesIndex: hit.seriesIndex, pointIndex: hit.categoryIndex },
			material: params.markerMaterials[i],
		};
	});
	return attachChart3DPointerInteraction({
		three: params.three,
		canvas: params.canvas,
		camera: params.camera,
		width: params.width,
		height: params.height,
		meshes: params.markerMeshes,
		resolveHit: (intersection) => {
			const hit = intersection.object.userData as CartesianChart3DHit | undefined;
			return chart3DHitToPartRef(
				hit ? { seriesIndex: hit.seriesIndex, pointIndex: hit.categoryIndex } : null,
			);
		},
		calibrateDrag: (intersection) => {
			const hit = intersection.object.userData as CartesianChart3DHit;
			const vertex = params.series[hit.seriesIndex]?.vertices.find(
				(v) => v.categoryIndex === hit.categoryIndex,
			);
			return vertex ? calibrateCartesianChart3DDrag(vertex.position, hit.value) : null;
		},
		applyHighlight: (part) => applyChart3DMeshHighlight(highlightEntries, part),
		setControlsEnabled: (enabled) => {
			params.controls.enabled = enabled;
		},
		onSelect: params.interaction?.onSelect,
		onValueDragPreview: params.interaction?.onValueDragPreview,
		onValueDragCommit: params.interaction?.onValueDragCommit,
	});
}
