/**
 * Click-to-select / drag-to-value pointer wiring for a mounted pie3D scene.
 * Extracted out of `pie-chart-3d-scene.ts` to keep that file under the repo's
 * per-file LOC budget, and as the natural seam for pie3D's own angular drag.
 *
 * Every OTHER interactive 3D chart kind (bar3D/line3D/area3D/surface3D) wires
 * onto the shared `chart-3d-pointer-interaction.ts` state machine, which
 * calibrates a drag ONCE at press time (two world points projected to screen,
 * `chart3DPointerDeltaToValueDelta`'s "pixels per unit" model) because a
 * bar/line/area/surface mark's value is a position along one fixed WORLD
 * axis. A pie3D wedge has no such axis: its value is a SHARE of the whole
 * pie, changed by the ANGLE swept around the pie's centre
 * (`chart-interaction-pie.ts`'s doc comment; `pie-chart-3d-drag.ts` mirrors
 * that exact renormalisation for 3D). An angle cannot be linearised into a
 * fixed screen-space "pixels per unit" the way a straight axis can - sweeping
 * past 90 degrees reverses which screen direction increases the value - so
 * this module re-raycasts on every pointer move instead of calibrating once:
 * against an invisible disc coplanar with the pie (not the wedges' own,
 * possibly `c:explosion`-offset, meshes), recovering the pointer's current
 * angle around the ORIGINAL (unexploded) centre regardless of camera orbit.
 *
 * @module pie-chart-3d-interaction-wiring
 */
import type * as THREE from 'three';

import { CHART_3D_DRAG_THRESHOLD_PX, chart3DHitToPartRef } from './chart-3d-interaction';
import { applyChart3DMeshHighlight } from './chart-3d-mesh-highlight';
import type { HighlightableMaterialRef } from './chart-3d-mesh-highlight';
import { isChartInteractionArmed } from './chart-canvas-drag';
import type { ChartPartRef } from './chart-view-model';
import { pieChart3DPointerAngle, resolvePieChart3DDragValue } from './pie-chart-3d-drag';
import type { PieChart3DDragGeometry } from './pie-chart-3d-drag';
import type { PieChart3DHit } from './pie-chart-3d-hit-test';

/**
 * Click-to-select / drag-to-value wiring for a mounted pie3D scene. Optional:
 * omit entirely for a purely presentational (non-editable) mount.
 */
export interface PieChart3DInteraction {
	/** Called when the user clicks a wedge mesh, or empty space (`null`, clearing selection). */
	onSelect?: (part: ChartPartRef | null) => void;
	/** Called continuously while dragging a wedge's value around the pie (live preview). */
	onValueDragPreview?: (part: ChartPartRef, value: number) => void;
	/** Called once on release with the final dragged value. */
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

/** Imperative handle returned by {@link attachPieChart3DInteraction}. */
export interface PieChart3DInteractionHandle {
	/** Apply (or clear) the selected-wedge highlight from outside a click, e.g. when selection changes via the inspector. */
	setSelectedPart: (part: ChartPartRef | null) => void;
	dispose: () => void;
}

/** One wedge's own point index, value, and leading-edge angle (the same shape `PieChart3DWedge` carries). */
export interface PieChart3DWedgeAngleRef {
	pointIndex: number;
	value: number;
	startAngle: number;
}

/** Everything {@link attachPieChart3DInteraction} needs from the mounted scene. */
export interface PieChart3DInteractionParams {
	three: typeof THREE;
	canvas: HTMLCanvasElement;
	camera: THREE.Camera;
	/** The scene's OrbitControls instance; suspended while a value drag is in progress. */
	controls: { enabled: boolean };
	wedgeMeshes: ReadonlyArray<THREE.Mesh>;
	wedgeMaterials: ReadonlyArray<HighlightableMaterialRef>;
	/**
	 * Read the CURRENT wedge angle/value layout, re-read at the start of every
	 * press so a wedge already dragged earlier in this same mount (its value
	 * updated locally by the scene's own live preview, before any commit
	 * round-trips through the caller's chart-data update and remounts the
	 * scene fresh) seeds the next drag from the right values.
	 */
	getWedges: () => ReadonlyArray<PieChart3DWedgeAngleRef>;
	interaction: PieChart3DInteraction | undefined;
}

interface PieDragState {
	part: ChartPartRef | null;
	geometry: PieChart3DDragGeometry | null;
	moved: boolean;
	startClientX: number;
	startClientY: number;
	/** Last angle a plane raycast actually resolved, reused if the final pointerup sample misses the plane. */
	lastAngle: number | null;
}

/**
 * Attach click-to-select / drag-to-value handling to a mounted pie3D scene.
 * Unlike {@link ../chart-3d-pointer-interaction.ts}'s generic
 * `attachChartPointerInteraction`, this raycasts the wedge meshes only to
 * decide WHICH wedge a press landed on; the drag itself samples an invisible
 * disc (the pie's own XZ plane through its centre) on every pointer move.
 */
export function attachPieChart3DInteraction(
	params: PieChart3DInteractionParams,
): PieChart3DInteractionHandle {
	const raycaster = new params.three.Raycaster();
	const ndc = new params.three.Vector2();
	// The pie's own plane: normal +Y, through the world origin (every wedge's
	// unexploded local origin, per `computePieChart3DSliceAngles`).
	const plane = new params.three.Plane(new params.three.Vector3(0, 1, 0), 0);
	const planeHit = new params.three.Vector3();
	let dragState: PieDragState | null = null;

	const highlightEntries = params.wedgeMeshes.map((mesh, i) => {
		const hit = mesh.userData as PieChart3DHit;
		return {
			mark: { seriesIndex: 0, pointIndex: hit.pointIndex },
			material: params.wedgeMaterials[i] as HighlightableMaterialRef,
		};
	});

	function setNdc(clientX: number, clientY: number): boolean {
		const rect = params.canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return false;
		}
		ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		return true;
	}

	function raycastWedge(clientX: number, clientY: number): THREE.Intersection | undefined {
		if (!setNdc(clientX, clientY)) {
			return undefined;
		}
		raycaster.setFromCamera(ndc, params.camera);
		return raycaster.intersectObjects(params.wedgeMeshes as unknown as THREE.Object3D[], false)[0];
	}

	/** The pointer's current angle on the pie's plane, or `null` when the ray is (near) parallel to it. */
	function planeAngleAt(clientX: number, clientY: number): number | null {
		if (!setNdc(clientX, clientY)) {
			return null;
		}
		raycaster.setFromCamera(ndc, params.camera);
		const hit = raycaster.ray.intersectPlane(plane, planeHit);
		return hit ? pieChart3DPointerAngle(hit.x, hit.z) : null;
	}

	function setSelectedPart(part: ChartPartRef | null): void {
		applyChart3DMeshHighlight(highlightEntries, part);
	}

	function travelBelowThreshold(clientX: number, clientY: number, state: PieDragState): boolean {
		const dx = clientX - state.startClientX;
		const dy = clientY - state.startClientY;
		return Math.hypot(dx, dy) < CHART_3D_DRAG_THRESHOLD_PX;
	}

	const onPointerDown = (event: PointerEvent): void => {
		(params.canvas as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
			event.pointerId,
		);
		const hit = raycastWedge(event.clientX, event.clientY);
		const hitData = hit?.object.userData as PieChart3DHit | undefined;
		const part = chart3DHitToPartRef(
			hitData ? { seriesIndex: 0, pointIndex: hitData.pointIndex } : null,
		);
		// Same armed gate as `chart-3d-pointer-interaction.ts` (see its module
		// doc): a wedge press on an armed chart is the scene's own select /
		// value-drag, never the stage's element move; on an un-armed chart it
		// bubbles so the first click still selects the chart.
		const armed = part !== null && isChartInteractionArmed(params.canvas);
		if (armed) {
			event.stopPropagation();
		}
		let geometry: PieChart3DDragGeometry | null = null;
		if (part && hitData && armed) {
			const wedges = params.getWedges();
			const wedge = wedges.find((w) => w.pointIndex === hitData.pointIndex);
			if (wedge) {
				geometry = {
					values: wedges.map((w) => w.value),
					pointIndex: hitData.pointIndex,
					leadingAngle: wedge.startAngle,
				};
			}
		}
		dragState = {
			part,
			geometry,
			moved: false,
			startClientX: event.clientX,
			startClientY: event.clientY,
			lastAngle: null,
		};
		if (geometry) {
			// Cancel the press too: see `chart-3d-pointer-interaction.ts` (the
			// compatibility mousedown drives the React stage's desktop move).
			event.preventDefault();
			params.controls.enabled = false;
		}
	};

	const onPointerMove = (event: PointerEvent): void => {
		const state = dragState;
		if (!state || !state.part || !state.geometry) {
			return;
		}
		if (!state.moved && travelBelowThreshold(event.clientX, event.clientY, state)) {
			return;
		}
		state.moved = true;
		const angle = planeAngleAt(event.clientX, event.clientY);
		if (angle === null) {
			return;
		}
		state.lastAngle = angle;
		const value = resolvePieChart3DDragValue(state.geometry, angle);
		params.interaction?.onValueDragPreview?.(state.part, value);
	};

	const onPointerUp = (event: PointerEvent): void => {
		if (!dragState) {
			return;
		}
		const state = dragState;
		dragState = null;
		(
			params.canvas as unknown as { releasePointerCapture?: (id: number) => void }
		).releasePointerCapture?.(event.pointerId);
		if (state.geometry) {
			params.controls.enabled = true;
		}
		if (state.moved && state.part && state.geometry) {
			const angle = planeAngleAt(event.clientX, event.clientY) ?? state.lastAngle;
			if (angle !== null) {
				const value = resolvePieChart3DDragValue(state.geometry, angle);
				params.interaction?.onValueDragCommit?.(state.part, value);
			}
			return;
		}
		setSelectedPart(state.part);
		params.interaction?.onSelect?.(state.part);
	};

	params.canvas.addEventListener('pointerdown', onPointerDown);
	params.canvas.addEventListener('pointermove', onPointerMove);
	params.canvas.addEventListener('pointerup', onPointerUp);
	params.canvas.addEventListener('pointercancel', onPointerUp);

	return {
		setSelectedPart,
		dispose() {
			params.canvas.removeEventListener('pointerdown', onPointerDown);
			params.canvas.removeEventListener('pointermove', onPointerMove);
			params.canvas.removeEventListener('pointerup', onPointerUp);
			params.canvas.removeEventListener('pointercancel', onPointerUp);
		},
	};
}
