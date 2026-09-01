// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GestureDeps, GestureTransform, PointerLike } from './editor-gestures';
import { createGestureController } from './editor-gestures';
import type { InteractionBox } from './element-interaction';
import type { SnapLine } from './snap-guides';

function pointer(overrides: Partial<PointerLike> = {}): PointerLike {
	return { clientX: 0, clientY: 0, pointerId: 1, shiftKey: false, ...overrides };
}

function box(overrides: Partial<InteractionBox> = {}): InteractionBox {
	return { x: 0, y: 0, width: 100, height: 50, rotation: 0, ...overrides };
}

interface Recorded {
	starts: Array<{ id: string; kind: string }>;
	previews: Array<{ transform: GestureTransform; lines: readonly SnapLine[] }>;
	ends: Array<{ transform: GestureTransform | null; moved: boolean; id: string }>;
}

function makeDeps(
	elementBox: InteractionBox,
	overrides: Partial<GestureDeps> = {},
): {
	deps: GestureDeps;
	recorded: Recorded;
} {
	const recorded: Recorded = { starts: [], previews: [], ends: [] };
	const deps: GestureDeps = {
		getScale: () => 1,
		getElementBox: () => elementBox,
		getSiblings: () => [],
		getStageOrigin: () => ({ left: 0, top: 0 }),
		onStart: (id, kind) => recorded.starts.push({ id, kind }),
		onPreview: (transform, lines) => recorded.previews.push({ transform, lines }),
		onEnd: (transform, moved, id) => recorded.ends.push({ transform, moved, id }),
		...overrides,
	};
	return { deps, recorded };
}

function dispatchWindowPointer(
	type: 'pointermove' | 'pointerup' | 'pointercancel',
	p: PointerLike,
): void {
	const event = new PointerEvent(type, {
		clientX: p.clientX,
		clientY: p.clientY,
		shiftKey: p.shiftKey,
	});
	// jsdom's PointerEvent constructor does not accept pointerId directly on
	// every version; define it so the controller's pointerId match succeeds.
	Object.defineProperty(event, 'pointerId', { value: p.pointerId, configurable: true });
	window.dispatchEvent(event);
}

describe('createGestureController: move', () => {
	it('does nothing before the dead zone is exceeded', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 5 }));
		dispatchWindowPointer('pointermove', pointer({ pointerId: 5, clientX: 1, clientY: 1 }));
		expect(recorded.starts).toHaveLength(0);
		expect(recorded.previews).toHaveLength(0);
	});

	it('starts and previews a move once past the dead zone', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 5 }));
		dispatchWindowPointer('pointermove', pointer({ pointerId: 5, clientX: 10, clientY: 4 }));
		expect(recorded.starts).toStrictEqual([{ id: 'el1', kind: 'move' }]);
		expect(recorded.previews).toHaveLength(1);
		expect(recorded.previews[0].transform).toStrictEqual({
			id: 'el1',
			x: 10,
			y: 4,
			width: 100,
			height: 50,
			rotation: 0,
		});
	});

	it('ignores pointer events from a different pointerId', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 5 }));
		dispatchWindowPointer('pointermove', pointer({ pointerId: 99, clientX: 20, clientY: 20 }));
		expect(recorded.previews).toHaveLength(0);
	});

	it('snaps to grid when getSnapToGrid returns true', () => {
		const { deps, recorded } = makeDeps(box(), {
			getSnapToGrid: () => true,
			getGridSize: () => 10,
			getSnapToShape: () => false,
		});
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 1 }));
		dispatchWindowPointer('pointermove', pointer({ pointerId: 1, clientX: 4, clientY: 3 }));
		expect(recorded.previews[0].transform.x).toBe(0);
		expect(recorded.previews[0].transform.y).toBe(0);
	});

	it('reports moved=false and a null transform for a plain tap (no dead-zone exit)', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 1 }));
		dispatchWindowPointer('pointerup', pointer({ pointerId: 1 }));
		expect(recorded.ends).toStrictEqual([{ transform: null, moved: false, id: 'el1' }]);
	});

	it('reports the final transform on pointerup after moving', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 1 }));
		dispatchWindowPointer('pointermove', pointer({ pointerId: 1, clientX: 10, clientY: 0 }));
		dispatchWindowPointer('pointerup', pointer({ pointerId: 1, clientX: 10, clientY: 0 }));
		expect(recorded.ends).toHaveLength(1);
		expect(recorded.ends[0].moved).toBeTruthy();
		expect(recorded.ends[0].transform?.x).toBe(10);
		expect(controller.isActive()).toBeFalsy();
	});

	it('does not start a second gesture while one is active', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 1 }));
		controller.begin('move', 'el2', pointer({ pointerId: 2 }));
		dispatchWindowPointer('pointermove', pointer({ pointerId: 2, clientX: 10, clientY: 10 }));
		expect(recorded.starts).toHaveLength(0);
	});
});

describe('createGestureController: resize', () => {
	it('resizes from the se handle and reports the new size', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('resize', 'el1', pointer({ pointerId: 1 }), 'se');
		dispatchWindowPointer('pointermove', pointer({ pointerId: 1, clientX: 20, clientY: 10 }));
		expect(recorded.previews[0].transform).toStrictEqual({
			id: 'el1',
			x: 0,
			y: 0,
			width: 120,
			height: 60,
			rotation: 0,
		});
	});

	it('locks aspect ratio on a corner handle when shift is held', () => {
		const { deps, recorded } = makeDeps(box({ width: 100, height: 50 }));
		const controller = createGestureController(deps);
		controller.begin('resize', 'el1', pointer({ pointerId: 1 }), 'se');
		dispatchWindowPointer(
			'pointermove',
			pointer({ pointerId: 1, clientX: 200, clientY: 0, shiftKey: true }),
		);
		const t = recorded.previews[0].transform;
		expect(t.width / t.height).toBeCloseTo(2);
	});
});

describe('createGestureController: rotate', () => {
	it('computes the rotation angle from the pointer position relative to the box center', () => {
		const { deps, recorded } = makeDeps(box({ x: 0, y: 0, width: 100, height: 100 }));
		const controller = createGestureController(deps);
		controller.begin('rotate', 'el1', pointer({ pointerId: 1, clientX: 50, clientY: 50 }));
		// Pointer directly to the right of center (50,50) -> 90deg.
		dispatchWindowPointer('pointermove', pointer({ pointerId: 1, clientX: 200, clientY: 50 }));
		expect(recorded.previews[0].transform.rotation).toBeCloseTo(90);
	});

	it('snaps the rotation to 15deg steps when shift is held', () => {
		const { deps, recorded } = makeDeps(box({ x: 0, y: 0, width: 100, height: 100 }));
		const controller = createGestureController(deps);
		controller.begin('rotate', 'el1', pointer({ pointerId: 1, clientX: 50, clientY: 50 }));
		dispatchWindowPointer(
			'pointermove',
			pointer({ pointerId: 1, clientX: 200, clientY: 55, shiftKey: true }),
		);
		expect(recorded.previews[0].transform.rotation).toBe(90);
	});
});

describe('createGestureController: dispose', () => {
	beforeEach(() => {
		vi.spyOn(window, 'removeEventListener');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('detaches listeners and clears the active gesture without emitting onEnd', () => {
		const { deps, recorded } = makeDeps(box());
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 1 }));
		controller.dispose();
		expect(controller.isActive()).toBeFalsy();
		expect(recorded.ends).toHaveLength(0);
		expect(window.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
	});

	it('begin no-ops when getElementBox returns undefined', () => {
		const { deps, recorded } = makeDeps(box(), { getElementBox: () => undefined });
		const controller = createGestureController(deps);
		controller.begin('move', 'el1', pointer({ pointerId: 1 }));
		expect(controller.isActive()).toBeFalsy();
		dispatchWindowPointer('pointermove', pointer({ pointerId: 1, clientX: 10, clientY: 10 }));
		expect(recorded.previews).toHaveLength(0);
	});
});
