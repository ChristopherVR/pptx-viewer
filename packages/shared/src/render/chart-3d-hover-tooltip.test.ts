import { describe, expect, it, vi } from 'vitest';

import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';

function fakeThree() {
	class Vector2 {
		x = 0;
		y = 0;
	}
	class Raycaster {
		setFromCamera() {}
		intersectObjects() {
			return hits;
		}
	}
	return { Vector2, Raycaster };
}

let hits: unknown[] = [];

function fakeCanvas() {
	const listeners: Record<string, Array<(e: PointerEvent) => void>> = {};
	return {
		title: '',
		addEventListener(type: string, cb: (e: PointerEvent) => void) {
			(listeners[type] ??= []).push(cb);
		},
		removeEventListener(type: string, cb: (e: PointerEvent) => void) {
			listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
		},
		getBoundingClientRect() {
			return { left: 0, top: 0, width: 200, height: 100 };
		},
		fire(type: string, e: Partial<PointerEvent>) {
			for (const cb of listeners[type] ?? []) {
				cb(e as PointerEvent);
			}
		},
		listenerCount(type: string) {
			return (listeners[type] ?? []).length;
		},
	};
}

describe('attachChart3DHoverTooltip', () => {
	it('sets the canvas title from the raycast hit', () => {
		hits = [{ object: { userData: { value: 42 } } }];
		const canvas = fakeCanvas();
		attachChart3DHoverTooltip({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			meshes: [],
			buildTooltip: (hit) =>
				hit ? `value: ${(hit.object.userData as { value: number }).value}` : undefined,
		});
		canvas.fire('pointermove', { clientX: 100, clientY: 50 });
		expect(canvas.title).toBe('value: 42');
	});

	it('clears the title on a miss and on pointerleave', () => {
		hits = [{ object: { userData: { value: 1 } } }];
		const canvas = fakeCanvas();
		attachChart3DHoverTooltip({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			meshes: [],
			buildTooltip: (hit) => (hit ? 'hit' : undefined),
		});
		canvas.fire('pointermove', { clientX: 100, clientY: 50 });
		expect(canvas.title).toBe('hit');

		hits = [];
		canvas.fire('pointermove', { clientX: 100, clientY: 50 });
		expect(canvas.title).toBe('');

		hits = [{ object: { userData: { value: 1 } } }];
		canvas.fire('pointermove', { clientX: 100, clientY: 50 });
		expect(canvas.title).toBe('hit');
		canvas.fire('pointerleave', {});
		expect(canvas.title).toBe('');
	});

	it('dispose removes both listeners', () => {
		const canvas = fakeCanvas();
		const handle = attachChart3DHoverTooltip({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			meshes: [],
			buildTooltip: () => undefined,
		});
		handle.dispose();
		expect(canvas.listenerCount('pointermove')).toBe(0);
		expect(canvas.listenerCount('pointerleave')).toBe(0);
	});

	it('does nothing when the canvas has zero size', () => {
		const canvas = {
			title: '',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
		};
		attachChart3DHoverTooltip({
			three: fakeThree() as never,
			canvas: canvas as unknown as HTMLCanvasElement,
			camera: {} as never,
			meshes: [],
			buildTooltip: () => 'x',
		});
		const moveCb = canvas.addEventListener.mock.calls.find(([t]) => t === 'pointermove')?.[1] as (
			e: PointerEvent,
		) => void;
		expect(() => moveCb({ clientX: 0, clientY: 0 } as PointerEvent)).not.toThrow();
		expect(canvas.title).toBe('');
	});
});
