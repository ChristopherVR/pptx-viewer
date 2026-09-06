import { beforeEach, describe, expect, it, vi } from 'vitest';

import { attachChart3DPointerInteraction } from './chart-3d-pointer-interaction';
import type { ChartPartRef } from './chart-view-model';

/** A minimal `three`-shaped fake: `project` is the identity, so a world point
 * `[x, y, z]` maps to screen `((x+1)/2)*width, ((-y+1)/2)*height` exactly like
 * production `Vector3.project(camera)` would for a camera whose view-projection
 * matrix happens to be identity - deterministic and easy to hand-compute. */
function fakeThree() {
	class Vector3 {
		constructor(
			public x = 0,
			public y = 0,
			public z = 0,
		) {}
		project() {
			return this;
		}
	}
	class Vector2 {
		x = 0;
		y = 0;
	}
	class Raycaster {
		setFromCamera() {}
		intersectObjects() {
			return raycastHits;
		}
	}
	return { Vector3, Vector2, Raycaster };
}

let raycastHits: Array<{ object: { userData: unknown }; faceIndex?: number }> = [];

/**
 * `armed` models the canvas sitting inside a `.pptx-chart-interactive` chart
 * root (selected + editable), the gate a mark press must pass to become the
 * scene's own select/drag instead of bubbling to the stage. Defaults to armed
 * so the gesture tests exercise the scene; the gate tests flip it off.
 */
function fakeCanvas(armed = true) {
	const listeners: Record<string, Array<(e: PointerEvent) => void>> = {};
	const armedRoot = {};
	return {
		addEventListener(type: string, cb: (e: PointerEvent) => void) {
			(listeners[type] ??= []).push(cb);
		},
		removeEventListener(type: string, cb: (e: PointerEvent) => void) {
			listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
		},
		getBoundingClientRect() {
			return { left: 0, top: 0, width: 200, height: 100 };
		},
		closest(selector: string) {
			return armed && selector === '.pptx-chart-interactive' ? armedRoot : null;
		},
		fire(type: string, e: Partial<PointerEvent>) {
			for (const cb of listeners[type] ?? []) {
				cb({ stopPropagation: () => {}, preventDefault: () => {}, ...e } as PointerEvent);
			}
		},
		listenerCount(type: string) {
			return (listeners[type] ?? []).length;
		},
	};
}

const hitPart: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };

beforeEach(() => {
	raycastHits = [];
});

describe('attachChart3DPointerInteraction', () => {
	it('fires onSelect on a plain click (no movement), even with no drag calibration', () => {
		raycastHits = [{ object: { userData: {} } }];
		const canvas = fakeCanvas();
		const onSelect = vi.fn();
		const three = fakeThree();
		attachChart3DPointerInteraction({
			three: three as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
			onSelect,
		});

		canvas.fire('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		canvas.fire('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		expect(onSelect).toHaveBeenCalledExactlyOnceWith(hitPart);
	});

	it('fires onSelect(null) when clicking empty space', () => {
		raycastHits = [];
		const canvas = fakeCanvas();
		const onSelect = vi.fn();
		attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
			onSelect,
		});

		canvas.fire('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		canvas.fire('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
	});

	it('drags: preview fires past the threshold, commit fires on release, onSelect is NOT fired', () => {
		raycastHits = [{ object: { userData: {} } }];
		const canvas = fakeCanvas();
		const onSelect = vi.fn();
		const onValueDragPreview = vi.fn();
		const onValueDragCommit = vi.fn();
		const setControlsEnabled = vi.fn();
		attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
			// value 0 at world y=0 -> screen y = height/2 = 50; value 10 at world
			// y=1 -> screen y = ((-1+1)/2)*100 = 0. So 50px screen = 10 units, up.
			calibrateDrag: () => ({
				worldAtValue0: [0, 0, 0],
				value0: 0,
				worldAtValue1: [0, 1, 0],
				value1: 10,
			}),
			onSelect,
			onValueDragPreview,
			onValueDragCommit,
			setControlsEnabled,
		});

		const preventDefault = vi.fn();
		canvas.fire('pointerdown', { clientX: 50, clientY: 50, pointerId: 1, preventDefault });
		expect(setControlsEnabled).toHaveBeenCalledWith(false);
		// Cancelled so the compatibility mousedown never reaches the stage.
		expect(preventDefault).toHaveBeenCalledOnce();
		// Move up by 25px (past the 3px threshold) -> +5 units from the value=10 start.
		canvas.fire('pointermove', { clientX: 50, clientY: 25, pointerId: 1 });
		expect(onValueDragPreview).toHaveBeenCalledWith(hitPart, 15);
		canvas.fire('pointerup', { clientX: 50, clientY: 25, pointerId: 1 });
		expect(onValueDragCommit).toHaveBeenCalledExactlyOnceWith(hitPart, 15);
		expect(onSelect).not.toHaveBeenCalled();
		expect(setControlsEnabled).toHaveBeenLastCalledWith(true);
	});

	it('does not start a drag below the movement threshold', () => {
		raycastHits = [{ object: { userData: {} } }];
		const canvas = fakeCanvas();
		const onValueDragPreview = vi.fn();
		attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
			calibrateDrag: () => ({
				worldAtValue0: [0, 0, 0],
				value0: 0,
				worldAtValue1: [0, 1, 0],
				value1: 10,
			}),
			onValueDragPreview,
		});

		canvas.fire('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		canvas.fire('pointermove', { clientX: 51, clientY: 50, pointerId: 1 });
		expect(onValueDragPreview).not.toHaveBeenCalled();
	});

	it('an armed mark press stops propagating so the stage never starts an element move', () => {
		raycastHits = [{ object: { userData: {} } }];
		const canvas = fakeCanvas(true);
		attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
		});

		const stopPropagation = vi.fn();
		const preventDefault = vi.fn();
		canvas.fire('pointerdown', {
			clientX: 50,
			clientY: 50,
			pointerId: 1,
			stopPropagation,
			preventDefault,
		});
		expect(stopPropagation).toHaveBeenCalledOnce();
		// Select-only (no drag calibration): the press is not cancelled, so the
		// compatibility mousedown still lets the stage treat it as a plain click.
		expect(preventDefault).not.toHaveBeenCalled();
	});

	it('an armed press on empty space still bubbles (it is a plain click on the element)', () => {
		raycastHits = [];
		const canvas = fakeCanvas(true);
		attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
		});

		const stopPropagation = vi.fn();
		canvas.fire('pointerdown', { clientX: 50, clientY: 50, pointerId: 1, stopPropagation });
		expect(stopPropagation).not.toHaveBeenCalled();
	});

	it('an un-armed chart lets a mark press bubble and never value-drags it', () => {
		// Not selected / not editable: the first click must reach the stage so
		// it selects the chart element, and moving the pointer must not edit a
		// value the user cannot yet see is editable.
		raycastHits = [{ object: { userData: {} } }];
		const canvas = fakeCanvas(false);
		const onValueDragPreview = vi.fn();
		const setControlsEnabled = vi.fn();
		attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
			calibrateDrag: () => ({
				worldAtValue0: [0, 0, 0],
				value0: 0,
				worldAtValue1: [0, 1, 0],
				value1: 10,
			}),
			onValueDragPreview,
			setControlsEnabled,
		});

		const stopPropagation = vi.fn();
		const preventDefault = vi.fn();
		canvas.fire('pointerdown', {
			clientX: 50,
			clientY: 50,
			pointerId: 1,
			stopPropagation,
			preventDefault,
		});
		canvas.fire('pointermove', { clientX: 50, clientY: 25, pointerId: 1 });
		expect(stopPropagation).not.toHaveBeenCalled();
		expect(preventDefault).not.toHaveBeenCalled();
		expect(setControlsEnabled).not.toHaveBeenCalled();
		expect(onValueDragPreview).not.toHaveBeenCalled();
	});

	it('setSelectedPart applies the highlight without a click', () => {
		const applyHighlight = vi.fn();
		const handle = attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: fakeCanvas() as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => hitPart,
			applyHighlight,
		});
		handle.setSelectedPart(hitPart);
		expect(applyHighlight).toHaveBeenCalledExactlyOnceWith(hitPart);
	});

	it('dispose removes all listeners', () => {
		const canvas = fakeCanvas();
		const handle = attachChart3DPointerInteraction({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			width: 200,
			height: 100,
			meshes: [],
			resolveHit: () => null,
		});
		handle.dispose();
		expect(canvas.listenerCount('pointerdown')).toBe(0);
		expect(canvas.listenerCount('pointermove')).toBe(0);
		expect(canvas.listenerCount('pointerup')).toBe(0);
		expect(canvas.listenerCount('pointercancel')).toBe(0);
	});
});
