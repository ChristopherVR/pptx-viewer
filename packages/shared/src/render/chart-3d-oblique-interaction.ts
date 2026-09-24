/**
 * Pointer interaction for the oblique `bar3D` scene (`chart-3d-view-scene.ts`):
 * hover tooltip, click-to-select and drag-to-value on the WebGL boxes.
 *
 * Bars come from the right-angle-axes layout (`chart-3d-oblique-layout.ts`);
 * a value drag moves along that layout's value axis with its own scale
 * (`chart-3d-oblique-drag.ts`), vertically for columns and horizontally for
 * a `c:barDir="bar"` chart. As in the 2D chart, stacked segments select but
 * never drag.
 *
 * Picking casts its own ray instead of `Raycaster.setFromCamera`: the camera
 * carries a hand-inserted shear in its projection matrix, which
 * `setFromCamera`'s orthographic branch ignores (it always casts straight
 * down the camera's -Z). Unprojecting the near and far NDC points through the
 * full inverse projection gives the correctly sheared ray.
 *
 * @module chart-3d-oblique-interaction
 */
import type { PptxChartData } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { ThreeViewContext } from '../three-view/types';
import { buildBarChart3DHoverTooltip } from './bar-chart-3d-hit-test';
import { placeObliqueBarMesh } from './chart-3d-bar-mesh';
import { CHART_3D_DRAG_THRESHOLD_PX } from './chart-3d-interaction';
import {
	isObliqueBarDraggable,
	obliqueBarAtValue,
	obliqueDragValue,
} from './chart-3d-oblique-drag';
import type { ObliqueBar, ObliqueChartLayout } from './chart-3d-oblique-layout';
import { isChartInteractionArmed } from './chart-canvas-drag';
import type { ChartPartRef } from './chart-view-model';

/** Colour of the selected box's outline (matches the 2D selected-mark accent). */
const SELECTED_OUTLINE_COLOR = 0x2563eb;

export interface ObliqueBarInteractionOptions {
	ctx: ThreeViewContext;
	camera: THREE.Camera;
	meshes: ReadonlyArray<THREE.Mesh>;
	layout: ObliqueChartLayout;
	/** Chart px size of the view-box the scene frame is centred on. */
	svgWidth: number;
	svgHeight: number;
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

interface DragState {
	index: number;
	startValue: number;
	moved: boolean;
}

interface PressState {
	part: ChartPartRef | null;
	drag: DragState | null;
	startX: number;
	startY: number;
	/** Chart px per client px, measured at press time (the slide may be zoomed). */
	chartPxPerClientPx: number;
	lastValue: number | null;
}

/** Attach hover/select/drag to an oblique bar scene's boxes. */
export function attachObliqueBarInteraction(
	options: ObliqueBarInteractionOptions,
): ObliqueBarInteraction {
	const { ctx, camera, meshes, layout, chartData } = options;
	const boxes = layout.bars;
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

	/** Resize bar `i`'s mesh to `bar` (live drag preview). */
	function applyBar(i: number, bar: ObliqueBar): void {
		const mesh = meshes[i];
		placeObliqueBarMesh(three, mesh, layout, options.svgWidth, options.svgHeight, bar);
		if (outline.visible) {
			outline.position.copy(mesh.position);
			outline.scale.copy(mesh.scale);
		}
		ctx.requestRender();
	}

	const onPointerMove = (event: PointerEvent): void => {
		if (press?.drag) {
			const dx = event.clientX - press.startX;
			const dy = event.clientY - press.startY;
			if (!press.drag.moved && Math.hypot(dx, dy) < CHART_3D_DRAG_THRESHOLD_PX) {
				return;
			}
			press.drag.moved = true;
			const k = press.chartPxPerClientPx;
			const value = obliqueDragValue(layout, press.drag.startValue, dx * k, dy * k);
			applyBar(press.drag.index, obliqueBarAtValue(layout, boxes[press.drag.index], value));
			press.lastValue = value;
			if (press.part) {
				ctx.emit({ type: 'drag', detail: { part: press.part, value, phase: 'move' } });
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
		const index = indexOf(part);
		const drag: DragState | null =
			armed && index >= 0 && isObliqueBarDraggable(layout)
				? { index, startValue: boxes[index].value, moved: false }
				: null;
		if (drag) {
			event.preventDefault();
			(target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
		}
		const rect = target.getBoundingClientRect();
		press = {
			part,
			drag,
			startX: event.clientX,
			startY: event.clientY,
			chartPxPerClientPx: rect.height > 0 ? options.svgHeight / rect.height : 1,
			lastValue: null,
		};
	};

	const onPointerUp = (event: PointerEvent): void => {
		const current = press;
		press = null;
		if (!current || !interactive) {
			return;
		}
		if (current.drag?.moved && current.lastValue !== null && current.part) {
			ctx.emit({
				type: 'drag',
				detail: { part: current.part, value: current.lastValue, phase: 'commit' },
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
