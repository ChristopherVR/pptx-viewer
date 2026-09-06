/**
 * `chart-3d-pointer-interaction`: the ONE shared click-to-select /
 * drag-to-value pointer state machine every interactive three.js chart scene
 * (bar3D, line3D, area3D, pie3D, surface3D) attaches to its canvas, so the
 * gesture handling is written once instead of five times.
 *
 * A scene supplies:
 *  - `meshes` to raycast against, and `resolveHit` to turn a raycast
 *    intersection into the same {@link ChartPartRef} the 2D chart-interaction
 *    model uses (`chart-interaction.ts`).
 *  - optionally `calibrateDrag`, returning two WORLD points known to sit on
 *    the hit mark's own value axis at two distinct data values (its own plain
 *    layout data, e.g. a box's centre +/- half its size - never a value read
 *    back off a mutated `THREE.Object3D`, so the maths stays exact regardless
 *    of camera orbit). This module projects both points to screen space via
 *    the scene's own camera and hands them to
 *    {@link calibrateChart3DValueAxis} (`chart-3d-interaction.ts`).
 *  - optionally `applyHighlight`, to paint the selected mark (each scene owns
 *    its own mesh/material topology: bar3D/line3D/area3D/pie3D have one mesh
 *    per mark and can set `material.emissive`; surface3D's grid is a single
 *    mesh with no per-cell material, so it instead moves a small marker mesh
 *    onto the selected vertex, see `surface-chart-3d-interaction-wiring.ts`).
 *
 * A plain click (pointer travel below {@link CHART_3D_DRAG_THRESHOLD_PX})
 * always fires `onSelect`, even over empty space (`part: null`, clearing the
 * selection) - never a drag. A press that both hits a mark AND has a
 * `calibrateDrag` result becomes a value drag once the threshold is crossed;
 * while it's in progress `setControlsEnabled?.(false)` suspends the scene's
 * OrbitControls so orbiting the camera and dragging a value never race for
 * the same pointer gesture.
 *
 * A mark press is only the scene's while the chart root is ARMED
 * (`isChartInteractionArmed`, the same `pptx-chart-interactive` class the 2D
 * marks are CSS-gated on): then it stops propagating, exactly like a 2D
 * `[data-chart-part]` press, so the stage's own pointerdown never starts
 * moving the whole chart element underneath the value drag; and once a value
 * drag is calibrated it is also cancelled (`preventDefault`), which drops the
 * compatibility mousedown the React stage's desktop move path listens to. On
 * an un-armed chart (not selected / not editable) a press bubbles like any
 * other click on the element, so the first click on a mark still selects the
 * chart.
 *
 * @module chart-3d-pointer-interaction
 */
import type * as THREE from 'three';

import {
	calibrateChart3DValueAxis,
	CHART_3D_DRAG_THRESHOLD_PX,
	chart3DPointerDeltaToValueDelta,
} from './chart-3d-interaction';
import type { ScreenPoint2D } from './chart-3d-interaction';
import { isChartInteractionArmed } from './chart-canvas-drag';
import type { ChartPartRef } from './chart-view-model';

type ThreeModule = typeof THREE;

/** Two world points, at two distinct data values, on a mark's own value axis. */
export interface Chart3DDragCalibrationInput {
	worldAtValue0: readonly [number, number, number];
	value0: number;
	worldAtValue1: readonly [number, number, number];
	value1: number;
}

/** Options wiring one scene's meshes/camera into the shared pointer state machine. */
export interface Chart3DPointerInteractionOptions {
	three: ThreeModule;
	canvas: HTMLCanvasElement;
	camera: THREE.Camera;
	/** Current CSS-pixel size of the canvas; kept in sync via {@link Chart3DPointerInteractionHandle.updateSize}. */
	width: number;
	height: number;
	/** Meshes to raycast against for click/drag (NOT necessarily the same set as the hover raycaster's, though usually is). */
	meshes: ReadonlyArray<THREE.Object3D>;
	/** Resolve a raycast intersection to a selection descriptor, or `null` when the hit isn't a selectable mark. */
	resolveHit: (intersection: THREE.Intersection) => ChartPartRef | null;
	/** Compute a value-drag calibration for a hit part, or `null`/omit when it cannot be value-dragged. */
	calibrateDrag?: (
		intersection: THREE.Intersection,
		part: ChartPartRef,
	) => Chart3DDragCalibrationInput | null;
	/** Paint (or clear, when `null`) the selected-mark highlight. Omit when the scene has no per-mark material to highlight (e.g. a single shared surface mesh). */
	applyHighlight?: (part: ChartPartRef | null) => void;
	/** Suspend/resume the scene's OrbitControls while a value drag is in progress. */
	setControlsEnabled?: (enabled: boolean) => void;
	onSelect?: (part: ChartPartRef | null) => void;
	/** Called continuously while dragging, with the live (uncommitted) value. */
	onValueDragPreview?: (part: ChartPartRef, value: number) => void;
	/** Called once on release with the final dragged value. */
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

/** Imperative handle returned by {@link attachChart3DPointerInteraction}. */
export interface Chart3DPointerInteractionHandle {
	/** Apply (or clear) the selected-mark highlight from outside a click, e.g. when selection changes via the inspector. */
	setSelectedPart: (part: ChartPartRef | null) => void;
	/** Keep the NDC->CSS-pixel projection in sync with the scene's own resize. */
	updateSize: (width: number, height: number) => void;
	/** Remove listeners. Does not touch `applyHighlight`/meshes; the caller disposes those itself. */
	dispose: () => void;
}

interface DragState {
	part: ChartPartRef | null;
	calibration: ReturnType<typeof calibrateChart3DValueAxis>;
	startValue: number;
	startClientX: number;
	startClientY: number;
	moved: boolean;
}

function projectToScreen(
	three: ThreeModule,
	camera: THREE.Camera,
	point: readonly [number, number, number],
	width: number,
	height: number,
): ScreenPoint2D {
	const v = new three.Vector3(point[0], point[1], point[2]);
	v.project(camera);
	return { x: ((v.x + 1) / 2) * width, y: ((-v.y + 1) / 2) * height };
}

/** Attach the shared click-to-select / drag-to-value pointer handlers to one scene's canvas. */
export function attachChart3DPointerInteraction(
	options: Chart3DPointerInteractionOptions,
): Chart3DPointerInteractionHandle {
	let width = options.width;
	let height = options.height;
	const raycaster = new options.three.Raycaster();
	const ndc = new options.three.Vector2();
	let dragState: DragState | null = null;

	function raycastAt(clientX: number, clientY: number): THREE.Intersection | undefined {
		const rect = options.canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return undefined;
		}
		ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(ndc, options.camera);
		return raycaster.intersectObjects(options.meshes as THREE.Object3D[], false)[0];
	}

	function setSelectedPart(part: ChartPartRef | null): void {
		options.applyHighlight?.(part);
	}

	function currentDelta(clientX: number, clientY: number, state: DragState): ScreenPoint2D {
		return { x: clientX - state.startClientX, y: clientY - state.startClientY };
	}

	const onPointerDown = (event: PointerEvent): void => {
		// Pointer capture keeps delivering move/up to THIS canvas even once the
		// pointer travels outside its bounds mid-drag; optional-chained since
		// test doubles for `canvas` do not implement it.
		(options.canvas as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
			event.pointerId,
		);
		const hit = raycastAt(event.clientX, event.clientY);
		const part = hit ? options.resolveHit(hit) : null;
		const armed = part !== null && isChartInteractionArmed(options.canvas);
		if (armed) {
			// The scene owns this press (select / value-drag): keep it from the
			// stage's element-move handler. See the module doc.
			event.stopPropagation();
		}
		let calibration: ReturnType<typeof calibrateChart3DValueAxis> = null;
		let startValue = 0;
		if (hit && part && armed && options.calibrateDrag) {
			const input = options.calibrateDrag(hit, part);
			if (input) {
				const s0 = projectToScreen(
					options.three,
					options.camera,
					input.worldAtValue0,
					width,
					height,
				);
				const s1 = projectToScreen(
					options.three,
					options.camera,
					input.worldAtValue1,
					width,
					height,
				);
				calibration = calibrateChart3DValueAxis(s0, input.value0, s1, input.value1);
				startValue = input.value1;
			}
		}
		dragState = {
			part,
			calibration,
			startValue,
			startClientX: event.clientX,
			startClientY: event.clientY,
			moved: false,
		};
		if (calibration) {
			// Cancelling the pointerdown also suppresses its compatibility
			// mousedown, which is what the React stage's DESKTOP element-move
			// path listens to (stopPropagation alone leaves that one alive).
			// Same as every 2D mark press once its drag has started.
			event.preventDefault();
			options.setControlsEnabled?.(false);
		}
	};

	const onPointerMove = (event: PointerEvent): void => {
		if (!dragState || !dragState.part || !dragState.calibration) {
			return;
		}
		const delta = currentDelta(event.clientX, event.clientY, dragState);
		if (!dragState.moved && Math.hypot(delta.x, delta.y) < CHART_3D_DRAG_THRESHOLD_PX) {
			return;
		}
		dragState.moved = true;
		const value =
			dragState.startValue + chart3DPointerDeltaToValueDelta(dragState.calibration, delta);
		options.onValueDragPreview?.(dragState.part, value);
	};

	const onPointerUp = (event: PointerEvent): void => {
		if (!dragState) {
			return;
		}
		const state = dragState;
		dragState = null;
		(
			options.canvas as unknown as { releasePointerCapture?: (id: number) => void }
		).releasePointerCapture?.(event.pointerId);
		if (state.calibration) {
			options.setControlsEnabled?.(true);
		}
		if (state.moved && state.part && state.calibration) {
			const delta = currentDelta(event.clientX, event.clientY, state);
			const value = state.startValue + chart3DPointerDeltaToValueDelta(state.calibration, delta);
			options.onValueDragCommit?.(state.part, value);
			return;
		}
		setSelectedPart(state.part);
		options.onSelect?.(state.part);
	};

	options.canvas.addEventListener('pointerdown', onPointerDown);
	options.canvas.addEventListener('pointermove', onPointerMove);
	options.canvas.addEventListener('pointerup', onPointerUp);
	options.canvas.addEventListener('pointercancel', onPointerUp);

	return {
		setSelectedPart,
		updateSize(w: number, h: number) {
			width = w;
			height = h;
		},
		dispose() {
			options.canvas.removeEventListener('pointerdown', onPointerDown);
			options.canvas.removeEventListener('pointermove', onPointerMove);
			options.canvas.removeEventListener('pointerup', onPointerUp);
			options.canvas.removeEventListener('pointercancel', onPointerUp);
		},
	};
}
