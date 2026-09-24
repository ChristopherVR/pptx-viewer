import type { PptxChartData } from 'pptx-viewer-core';
/**
 * Pointer interaction for the oblique `bar3D` scene (`chart-3d-view-scene.ts`):
 * hover tooltip, click-to-select and drag-to-value on the WebGL boxes.
 *
 * The oblique scene draws each box's FRONT face exactly where the flat 2D
 * chart draws the bar (1 world unit = 1 authored chart px), so a value drag
 * reuses the 2D engine's own drag maths unchanged: `beginChartValueDrag` /
 * `advanceChartValueDrag` from `chart-canvas-drag.ts`, driven by the view
 * model the spec was built from. That keeps a 3D bar's drag identical to the
 * 2D bar's (same rounding, same axis range, same "stacked marks are not
 * value-draggable" rule).
 *
 * Picking casts its own ray instead of `Raycaster.setFromCamera`: the camera
 * carries a hand-inserted shear in its projection matrix, which
 * `setFromCamera`'s orthographic branch ignores (it always casts straight
 * down the camera's -Z). Unprojecting the near and far NDC points through the
 * full inverse projection gives the correctly sheared ray.
 *
 * @module chart-3d-oblique-interaction
 */
import type * as THREE from 'three';

import type { ThreeViewContext } from '../three-view/types';
import { buildBarChart3DHoverTooltip } from './bar-chart-3d-hit-test';
import { CHART_3D_DRAG_THRESHOLD_PX } from './chart-3d-interaction';
import type { Chart3DBarBox } from './chart-3d-spec';
import {
	advanceChartValueDrag,
	beginChartValueDrag,
	isChartInteractionArmed,
} from './chart-canvas-drag';
import type { ChartValueDragState } from './chart-canvas-drag';
import { dragAnchorViewY } from './chart-interaction';
import type { ChartPartRef } from './chart-view-model';
import type { ChartViewModel } from './chart-view-model-types';

/** Colour of the selected box's outline (matches the 2D selected-mark accent). */
const SELECTED_OUTLINE_COLOR = 0x2563eb;

export interface ObliqueBarInteractionOptions {
	ctx: ThreeViewContext;
	camera: THREE.Camera;
	meshes: ReadonlyArray<THREE.Mesh>;
	boxes: ReadonlyArray<Chart3DBarBox>;
	vm: ChartViewModel;
	chartData: PptxChartData;
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	/** Scene the selection outline is added to. */
	scene: THREE.Object3D;
}

export interface ObliqueBarInteraction {
	setInteractive: (on: boolean) => void;
	setSelectedPart: (part: ChartPartRef | null) => void;
	dispose: () => void;
}

interface PressState {
	part: ChartPartRef | null;
	drag: ChartValueDragState | null;
	startX: number;
	startY: number;
	lastValue: number | null;
}

/** Front-face rect of a box after a live drag to `value` (the bar's baseline edge stays put). */
function draggedRect(
	box: Chart3DBarBox,
	state: ChartValueDragState,
	startValue: number,
	value: number,
): { y: number; h: number } {
	const startY = dragAnchorViewY(startValue, state.drag, state.part.seriesIndex);
	const base =
		Math.abs(startY - box.y) <= Math.abs(startY - (box.y + box.h)) ? box.y + box.h : box.y;
	const valueY = dragAnchorViewY(value, state.drag, state.part.seriesIndex);
	return { y: Math.min(base, valueY), h: Math.abs(base - valueY) };
}

/** Attach hover/select/drag to an oblique bar scene's boxes. */
export function attachObliqueBarInteraction(
	options: ObliqueBarInteractionOptions,
): ObliqueBarInteraction {
	const { ctx, camera, meshes, boxes, vm, chartData } = options;
	const three = ctx.three;
	const target = ctx.eventTarget;
	const raycaster = new three.Raycaster();
	const far = new three.Vector3();
	let interactive = ctx.interactive;
	let press: PressState | null = null;
	let hoveredTooltip: string | undefined;

	const outline = new three.LineSegments(
		new three.EdgesGeometry(new three.BoxGeometry(1, 1, 1)),
		new three.LineBasicMaterial({ color: SELECTED_OUTLINE_COLOR }),
	);
	outline.visible = false;
	options.scene.add(outline);

	function hitAt(clientX: number, clientY: number): THREE.Intersection | undefined {
		const rect = target.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return undefined;
		}
		// World matrices are otherwise only refreshed by a render; a pointer
		// event can arrive before the first frame.
		options.scene.updateMatrixWorld();
		camera.updateMatrixWorld();
		const x = ((clientX - rect.left) / rect.width) * 2 - 1;
		const y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.ray.origin.set(x, y, -1).unproject(camera);
		far.set(x, y, 1).unproject(camera);
		raycaster.ray.direction.copy(far).sub(raycaster.ray.origin).normalize();
		return raycaster.intersectObjects(meshes as THREE.Mesh[], false)[0];
	}

	function partOf(hit: THREE.Intersection | undefined): ChartPartRef | null {
		const data = hit?.object.userData as
			| { seriesIndex?: number; categoryIndex?: number }
			| undefined;
		if (data?.seriesIndex === undefined || data.categoryIndex === undefined) {
			return null;
		}
		return { role: 'dataPoint', seriesIndex: data.seriesIndex, pointIndex: data.categoryIndex };
	}

	function indexOf(part: ChartPartRef | null): number {
		if (!part || part.role !== 'dataPoint') {
			return -1;
		}
		return boxes.findIndex(
			(b) => b.seriesIndex === part.seriesIndex && b.categoryIndex === part.pointIndex,
		);
	}

	function setSelectedPart(part: ChartPartRef | null): void {
		const i = indexOf(part);
		outline.visible = i >= 0;
		if (i >= 0) {
			outline.position.copy(meshes[i].position);
			outline.scale.copy(meshes[i].scale);
		}
		ctx.requestRender();
	}

	/** Resize box `i`'s mesh to a new front-face rect (live drag preview). */
	function applyRect(i: number, rect: { y: number; h: number }): void {
		const mesh = meshes[i];
		const h = Math.max(rect.h, 0.001);
		mesh.position.y = vm.svgHeight / 2 - (rect.y + rect.h / 2);
		mesh.scale.y = h;
		if (outline.visible) {
			outline.position.copy(mesh.position);
			outline.scale.copy(mesh.scale);
		}
		ctx.requestRender();
	}

	const onPointerMove = (event: PointerEvent): void => {
		if (press?.drag) {
			const step = advanceChartValueDrag(
				press.drag,
				event.clientY,
				target.getBoundingClientRect().height,
			);
			if (step) {
				const i = indexOf(press.drag.part);
				const start = boxes[i]?.value ?? 0;
				if (i >= 0) {
					applyRect(i, draggedRect(boxes[i], press.drag, start, step.value));
				}
				press.lastValue = step.value;
				ctx.emit({
					type: 'drag',
					detail: { part: press.drag.part, value: step.value, phase: 'move' },
				});
			}
			return;
		}
		const hit = hitAt(event.clientX, event.clientY);
		const data = hit?.object.userData as { seriesIndex: number; categoryIndex: number } | undefined;
		const box = data ? boxes[indexOf(partOf(hit))] : undefined;
		const tooltip = box
			? buildBarChart3DHoverTooltip(
					{ seriesIndex: box.seriesIndex, categoryIndex: box.categoryIndex, value: box.value },
					{
						categoryLabels: options.categoryLabels,
						seriesNames: options.seriesNames,
						numberFormats: chartData.series.map((s) => s.numberFormat),
					},
				)
			: undefined;
		if (tooltip !== hoveredTooltip) {
			hoveredTooltip = tooltip;
			target.title = tooltip ?? '';
		}
	};

	const onPointerDown = (event: PointerEvent): void => {
		if (!interactive) {
			return;
		}
		const part = partOf(hitAt(event.clientX, event.clientY));
		const armed = part !== null && isChartInteractionArmed(target);
		if (armed) {
			event.stopPropagation();
		}
		const drag =
			armed && part
				? beginChartValueDrag({ part, viewModel: vm, chartData, clientY: event.clientY })
				: null;
		if (drag) {
			event.preventDefault();
			(target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
		}
		press = { part, drag, startX: event.clientX, startY: event.clientY, lastValue: null };
	};

	const onPointerUp = (event: PointerEvent): void => {
		const current = press;
		press = null;
		if (!current || !interactive) {
			return;
		}
		if (current.drag?.moved && current.lastValue !== null) {
			ctx.emit({
				type: 'drag',
				detail: { part: current.drag.part, value: current.lastValue, phase: 'commit' },
			});
			return;
		}
		const travel = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
		if (travel < CHART_3D_DRAG_THRESHOLD_PX) {
			ctx.emit({ type: 'select', part: current.part });
		}
	};

	const onPointerLeave = (): void => {
		if (hoveredTooltip !== undefined) {
			hoveredTooltip = undefined;
			target.title = '';
		}
	};

	target.addEventListener('pointermove', onPointerMove);
	target.addEventListener('pointerdown', onPointerDown);
	target.addEventListener('pointerup', onPointerUp);
	target.addEventListener('pointerleave', onPointerLeave);

	return {
		setInteractive(on) {
			interactive = on;
			if (!on) {
				press = null;
			}
		},
		setSelectedPart,
		dispose() {
			target.removeEventListener('pointermove', onPointerMove);
			target.removeEventListener('pointerdown', onPointerDown);
			target.removeEventListener('pointerup', onPointerUp);
			target.removeEventListener('pointerleave', onPointerLeave);
			outline.geometry.dispose();
			(outline.material as THREE.Material).dispose();
			outline.removeFromParent();
		},
	};
}
