/**
 * Wires the shared 3D click-to-select / drag-to-value pointer state machine
 * ({@link ./chart-3d-pointer-interaction.ts}) onto a mounted bar3D scene's box
 * meshes. Extracted out of `bar-chart-3d-scene.ts` to keep that file under the
 * repo's per-file LOC budget, and as the natural seam for the bar3D-specific
 * hit -> part mapping and drag calibration (`bar-chart-3d-drag.ts`).
 *
 * @module bar-chart-3d-interaction-wiring
 */
import type * as THREE from 'three';

import { calibrateBarChart3DDrag } from './bar-chart-3d-drag';
import type { BarChart3DHit } from './bar-chart-3d-hit-test';
import type { BarChart3DBox } from './bar-chart-3d-layout';
import { chart3DHitToPartRef } from './chart-3d-interaction';
import { applyChart3DMeshHighlight } from './chart-3d-mesh-highlight';
import type { HighlightableMaterialRef } from './chart-3d-mesh-highlight';
import { attachChart3DPointerInteraction } from './chart-3d-pointer-interaction';
import type {
	Chart3DPointerInteractionHandle,
	Chart3DPointerInteractionOptions,
} from './chart-3d-pointer-interaction';
import type { ChartPartRef } from './chart-view-model';

/**
 * Click-to-select / drag-to-value wiring for a mounted bar3D scene. Optional:
 * omit entirely for a purely presentational (non-editable) mount.
 */
export interface BarChart3DInteraction {
	/** Called when the user clicks a box mesh, or empty space (`null`, clearing selection). */
	onSelect?: Chart3DPointerInteractionOptions['onSelect'];
	/** Called continuously while dragging a clustered box's value (live preview). */
	onValueDragPreview?: (part: ChartPartRef, value: number) => void;
	/** Called once on release with the final dragged value. */
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

/** Everything {@link attachBarChart3DInteraction} needs from the mounted scene. */
export interface BarChart3DInteractionParams {
	three: typeof THREE;
	canvas: HTMLCanvasElement;
	camera: THREE.Camera;
	/** The scene's OrbitControls instance; suspended while a value drag is in progress. */
	controls: { enabled: boolean };
	width: number;
	height: number;
	boxMeshes: ReadonlyArray<THREE.Mesh>;
	boxMaterials: ReadonlyArray<HighlightableMaterialRef>;
	boxes: ReadonlyArray<BarChart3DBox>;
	grouping: 'clustered' | 'stacked' | 'percentStacked';
	horizontal: boolean;
	interaction: BarChart3DInteraction | undefined;
}

/** Attach click-to-select / drag-to-value handling to a mounted bar3D scene. */
export function attachBarChart3DInteraction(
	params: BarChart3DInteractionParams,
): Chart3DPointerInteractionHandle {
	const highlightEntries = params.boxMeshes.map((mesh, i) => {
		const hit = mesh.userData as BarChart3DHit;
		return {
			mark: { seriesIndex: hit.seriesIndex, pointIndex: hit.categoryIndex },
			material: params.boxMaterials[i],
		};
	});
	return attachChart3DPointerInteraction({
		three: params.three,
		canvas: params.canvas,
		camera: params.camera,
		width: params.width,
		height: params.height,
		meshes: params.boxMeshes,
		resolveHit: (intersection) => {
			const hit = intersection.object.userData as BarChart3DHit | undefined;
			return chart3DHitToPartRef(
				hit ? { seriesIndex: hit.seriesIndex, pointIndex: hit.categoryIndex } : null,
			);
		},
		calibrateDrag: (intersection) => {
			const hit = intersection.object.userData as BarChart3DHit;
			return calibrateBarChart3DDrag(params.boxes, hit, params.grouping, params.horizontal);
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
