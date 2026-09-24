/**
 * Pointer interaction shared by the 3D chart scenes (`chart-3d-view-scene.ts`):
 * hover tooltip, click-to-select and drag-to-value on WebGL marks.
 *
 * A scene describes its marks through a {@link Chart3DMarkAdapter} (which data
 * point a ray hit, its value, how a drag previews, how a selection is drawn);
 * everything about pointer handling lives here once. As in the 2D chart, the
 * scene only claims a press while the chart is armed for editing
 * (`isChartInteractionArmed`), and a drag commits one value on release.
 *
 * Picking casts its own ray from the camera's inverse projection instead of
 * `Raycaster.setFromCamera`: the oblique camera carries a hand-inserted
 * shear and the perspective camera an off-centre projection, neither of which
 * `setFromCamera` models. Unprojecting the near and far NDC points through the
 * full inverse projection is exact for both.
 *
 * @module chart-3d-mark-interaction
 */
import type { PptxChartData } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { ThreeViewContext } from '../three-view/types';
import { buildBarChart3DHoverTooltip } from './bar-chart-3d-hit-test';
import { CHART_3D_DRAG_THRESHOLD_PX } from './chart-3d-interaction';
import { isChartInteractionArmed } from './chart-canvas-drag';
import type { ChartPartRef } from './chart-view-model';

/** A data point, as the chart's series / category indices. */
export interface Chart3DPoint {
	seriesIndex: number;
	pointIndex: number;
}

/** A live value drag on one mark. */
export interface Chart3DMarkDrag {
	/** Preview the value for a pointer delta in chart px (`dx` right, `dy` down); returns it. */
	preview: (dx: number, dy: number) => number;
}

export interface Chart3DMarkAdapter {
	/** The objects rays are cast against. */
	targets: ReadonlyArray<THREE.Object3D>;
	/** The data point under a hit, or `null` for none. */
	pointAt: (hit: THREE.Intersection) => Chart3DPoint | null;
	/** A data point's authored value, or `undefined` when it has none. */
	valueOf: (point: Chart3DPoint) => number | undefined;
	/** Start a value drag on a point, or `null` when it is not draggable. */
	beginDrag: (point: Chart3DPoint) => Chart3DMarkDrag | null;
	/** Draw (or clear) the selection. */
	highlight: (point: Chart3DPoint | null) => void;
	dispose?: () => void;
}

export interface Chart3DMarkInteractionOptions {
	ctx: ThreeViewContext;
	camera: THREE.Camera;
	/** Root refreshed before picking (world matrices only update on render otherwise). */
	scene: THREE.Object3D;
	/** Chart px height of the view (client px convert to chart px through it). */
	svgHeight: number;
	chartData: PptxChartData;
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	adapter: Chart3DMarkAdapter;
}

export interface Chart3DMarkInteraction {
	setInteractive: (on: boolean) => void;
	setSelectedPart: (part: ChartPartRef | null) => void;
	dispose: () => void;
}

interface PressState {
	point: Chart3DPoint | null;
	drag: { session: Chart3DMarkDrag; moved: boolean } | null;
	startX: number;
	startY: number;
	/** Chart px per client px, measured at press time (the slide may be zoomed). */
	chartPxPerClientPx: number;
	lastValue: number | null;
}

function partOf(point: Chart3DPoint | null): ChartPartRef | null {
	return point
		? { role: 'dataPoint', seriesIndex: point.seriesIndex, pointIndex: point.pointIndex }
		: null;
}

/** Attach hover/select/drag to a 3D chart scene's marks. */
export function attachChart3DMarkInteraction(
	options: Chart3DMarkInteractionOptions,
): Chart3DMarkInteraction {
	const { ctx, camera, adapter, chartData } = options;
	const three = ctx.three;
	const target = ctx.eventTarget;
	const raycaster = new three.Raycaster();
	const far = new three.Vector3();
	let interactive = ctx.interactive;
	let press: PressState | null = null;
	let hoveredTooltip: string | undefined;

	function pointAt(clientX: number, clientY: number): Chart3DPoint | null {
		const rect = target.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return null;
		}
		options.scene.updateMatrixWorld();
		camera.updateMatrixWorld();
		const x = ((clientX - rect.left) / rect.width) * 2 - 1;
		const y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.ray.origin.set(x, y, -1).unproject(camera);
		far.set(x, y, 1).unproject(camera);
		raycaster.ray.direction.copy(far).sub(raycaster.ray.origin).normalize();
		const hit = raycaster.intersectObjects(adapter.targets as THREE.Object3D[], false)[0];
		return hit ? adapter.pointAt(hit) : null;
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
			const value = press.drag.session.preview(dx * k, dy * k);
			press.lastValue = value;
			ctx.requestRender();
			const part = partOf(press.point);
			if (part) {
				ctx.emit({ type: 'drag', detail: { part, value, phase: 'move' } });
			}
			return;
		}
		const point = pointAt(event.clientX, event.clientY);
		const value = point ? adapter.valueOf(point) : undefined;
		const tooltip =
			point && value !== undefined
				? buildBarChart3DHoverTooltip(
						{ seriesIndex: point.seriesIndex, categoryIndex: point.pointIndex, value },
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
		const point = pointAt(event.clientX, event.clientY);
		const armed = point !== null && isChartInteractionArmed(target);
		if (armed) {
			event.stopPropagation();
		}
		const session = armed && point ? adapter.beginDrag(point) : null;
		if (session) {
			event.preventDefault();
			(target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
		}
		const rect = target.getBoundingClientRect();
		press = {
			point,
			drag: session ? { session, moved: false } : null,
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
		const part = partOf(current.point);
		if (current.drag?.moved && current.lastValue !== null && part) {
			ctx.emit({ type: 'drag', detail: { part, value: current.lastValue, phase: 'commit' } });
			return;
		}
		const travel = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
		if (travel < CHART_3D_DRAG_THRESHOLD_PX) {
			ctx.emit({ type: 'select', part });
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
		setSelectedPart(part) {
			adapter.highlight(
				part?.role === 'dataPoint' && part.pointIndex !== undefined
					? { seriesIndex: part.seriesIndex, pointIndex: part.pointIndex }
					: null,
			);
			ctx.requestRender();
		},
		dispose() {
			target.removeEventListener('pointermove', onPointerMove);
			target.removeEventListener('pointerdown', onPointerDown);
			target.removeEventListener('pointerup', onPointerUp);
			target.removeEventListener('pointerleave', onPointerLeave);
			adapter.dispose?.();
		},
	};
}
