import type { InkPoint } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InkDrawTool } from './editor-ink-controller.svelte';
import { createInkGestureController } from './editor-ink-gesture';
import type { InkGestureController, InkGestureDeps } from './editor-ink-gesture';

/**
 * `createInkGestureController` pointer lifecycle: pen/highlighter accumulate
 * points from `pointerdown` through window-level `pointermove`/`pointerup`
 * into a committed stroke; eraser hit-tests on `pointerdown` alone and never
 * starts a stroke. Mirrors `editor-gestures.ts`'s pure-module contract.
 */

function pointerEvent(
	type: string,
	over: { clientX: number; clientY: number; pointerId?: number; pressure?: number },
): PointerEvent {
	return new PointerEvent(type, {
		clientX: over.clientX,
		clientY: over.clientY,
		pointerId: over.pointerId ?? 1,
		pressure: over.pressure,
	});
}

function makeDeps(
	tool: InkDrawTool,
	over: Partial<InkGestureDeps> = {},
): {
	deps: InkGestureDeps;
	calls: {
		start: number;
		preview: InkPoint[][];
		end: InkPoint[][];
		erase: InkPoint[];
	};
} {
	const calls = {
		start: 0,
		preview: [] as InkPoint[][],
		end: [] as InkPoint[][],
		erase: [] as InkPoint[],
	};
	const deps: InkGestureDeps = {
		getScale: () => 1,
		getStageOrigin: () => ({ left: 0, top: 0 }),
		getTool: () => tool,
		onStrokeStart: () => {
			calls.start += 1;
		},
		onStrokePreview: (points) => {
			calls.preview.push([...points]);
		},
		onStrokeEnd: (points) => {
			calls.end.push([...points]);
		},
		onErase: (point) => {
			calls.erase.push(point);
		},
		...over,
	};
	return { deps, calls };
}

let controller: InkGestureController | undefined;

afterEach(() => {
	controller?.dispose();
	controller = undefined;
	vi.restoreAllMocks();
});

describe('createInkGestureController', () => {
	it('does nothing on pointerdown while the select tool is active', () => {
		const { deps, calls } = makeDeps('select');
		controller = createInkGestureController(deps);
		controller.handlePointerDown(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
		expect(calls.start).toBe(0);
		expect(controller.isActive()).toBeFalsy();
	});

	it('eraser hit-tests on pointerdown alone and never starts a stroke', () => {
		const { deps, calls } = makeDeps('eraser');
		controller = createInkGestureController(deps);
		controller.handlePointerDown(pointerEvent('pointerdown', { clientX: 5, clientY: 7 }));
		expect(calls.erase).toStrictEqual([{ x: 5, y: 7, pressure: 0 }]);
		expect(calls.start).toBe(0);
		expect(controller.isActive()).toBeFalsy();
	});

	it('pen accumulates points across window pointermove and commits on pointerup', () => {
		const { deps, calls } = makeDeps('pen');
		controller = createInkGestureController(deps);

		// `PointerEventInit.pressure` defaults to 0 (per the DOM spec) when a
		// test constructs a `PointerEvent` without setting it, so every
		// captured point below carries that value.
		controller.handlePointerDown(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
		expect(calls.start).toBe(1);
		expect(controller.isActive()).toBeTruthy();
		expect(calls.preview.at(-1)).toStrictEqual([{ x: 0, y: 0, pressure: 0 }]);

		window.dispatchEvent(pointerEvent('pointermove', { clientX: 10, clientY: 0 }));
		window.dispatchEvent(pointerEvent('pointermove', { clientX: 10, clientY: 10 }));
		expect(calls.preview.at(-1)).toStrictEqual([
			{ x: 0, y: 0, pressure: 0 },
			{ x: 10, y: 0, pressure: 0 },
			{ x: 10, y: 10, pressure: 0 },
		]);

		window.dispatchEvent(pointerEvent('pointerup', { clientX: 10, clientY: 10 }));
		expect(calls.end).toStrictEqual([
			[
				{ x: 0, y: 0, pressure: 0 },
				{ x: 10, y: 0, pressure: 0 },
				{ x: 10, y: 10, pressure: 0 },
			],
		]);
		expect(controller.isActive()).toBeFalsy();
	});

	it('carries each pointer event pressure reading through to the accumulated points', () => {
		// `onPointerUp` finalises whatever points pointerdown/pointermove
		// already accumulated (it does not sample the release event itself),
		// so the pressure trail comes from those two handlers.
		const { deps, calls } = makeDeps('pen');
		controller = createInkGestureController(deps);

		controller.handlePointerDown(
			pointerEvent('pointerdown', { clientX: 0, clientY: 0, pressure: 0.1 }),
		);
		window.dispatchEvent(pointerEvent('pointermove', { clientX: 10, clientY: 0, pressure: 0.9 }));
		window.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 0, pressure: 0.4 }));
		window.dispatchEvent(pointerEvent('pointerup', { clientX: 20, clientY: 0 }));

		expect(calls.end.at(-1)?.map((p) => p.pressure)).toStrictEqual([0.1, 0.9, 0.4]);
	});

	it('maps client coordinates through the stage origin and scale', () => {
		const { deps, calls } = makeDeps('highlighter', {
			getScale: () => 2,
			getStageOrigin: () => ({ left: 100, top: 50 }),
		});
		controller = createInkGestureController(deps);
		controller.handlePointerDown(pointerEvent('pointerdown', { clientX: 120, clientY: 70 }));
		expect(calls.preview.at(-1)).toStrictEqual([{ x: 10, y: 10, pressure: 0 }]);
	});

	it('ignores pointermove/pointerup events for a different pointer id', () => {
		const { deps, calls } = makeDeps('pen');
		controller = createInkGestureController(deps);
		controller.handlePointerDown(
			pointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }),
		);
		window.dispatchEvent(pointerEvent('pointermove', { clientX: 5, clientY: 5, pointerId: 2 }));
		expect(calls.preview).toHaveLength(1);
		window.dispatchEvent(pointerEvent('pointerup', { clientX: 5, clientY: 5, pointerId: 2 }));
		expect(calls.end).toHaveLength(0);
		expect(controller.isActive()).toBeTruthy();
	});

	it('dispose tears down window listeners without emitting an end callback', () => {
		const { deps, calls } = makeDeps('pen');
		controller = createInkGestureController(deps);
		controller.handlePointerDown(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
		controller.dispose();
		expect(controller.isActive()).toBeFalsy();
		window.dispatchEvent(pointerEvent('pointermove', { clientX: 5, clientY: 5 }));
		window.dispatchEvent(pointerEvent('pointerup', { clientX: 5, clientY: 5 }));
		expect(calls.end).toHaveLength(0);
	});
});
