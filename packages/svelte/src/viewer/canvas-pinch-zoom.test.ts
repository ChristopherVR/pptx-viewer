import { describe, expect, it, vi } from 'vitest';

import { canvasPinchZoom } from './canvas-pinch-zoom';

/**
 * Two-finger pinch-to-zoom on the editor canvas viewport. Svelte had no
 * pinch-zoom path at all here (only presentation mode had a touch gesture,
 * swipe); this action wires the shared, framework-agnostic recogniser
 * (`pptx-viewer-shared`'s `createTouchGestureRecognizer`, already covered by
 * its own tests) onto native DOM touch listeners, mirroring Vue's
 * `useTouchGestures` / `presentationSwipe`'s existing shape.
 */
function touch(node: HTMLElement, type: string, points: [number, number][]): Event {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const touches = points.map(([clientX, clientY]) => ({ clientX, clientY, target: node }));
	Object.defineProperty(event, 'touches', { value: touches });
	Object.defineProperty(event, 'changedTouches', { value: touches });
	return event;
}

describe('canvasPinchZoom', () => {
	it('reports a scaled-up value when two fingers spread apart', () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const onPinchZoom = vi.fn();
		const action = canvasPinchZoom(node, {
			getScale: () => 1,
			minScale: 0.2,
			maxScale: 5,
			onPinchZoom,
		});

		node.dispatchEvent(
			touch(node, 'touchstart', [
				[0, 0],
				[100, 0],
			]),
		);
		node.dispatchEvent(
			touch(node, 'touchmove', [
				[0, 0],
				[200, 0],
			]),
		); // distance doubled
		node.dispatchEvent(touch(node, 'touchend', []));

		expect(onPinchZoom).toHaveBeenCalledWith(2);
		action.destroy();
		node.remove();
	});

	it('clamps the reported scale to maxScale', () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const onPinchZoom = vi.fn();
		const action = canvasPinchZoom(node, {
			getScale: () => 1,
			minScale: 0.2,
			maxScale: 3,
			onPinchZoom,
		});

		node.dispatchEvent(
			touch(node, 'touchstart', [
				[0, 0],
				[100, 0],
			]),
		);
		node.dispatchEvent(
			touch(node, 'touchmove', [
				[0, 0],
				[1000, 0],
			]),
		); // 10x spread

		expect(onPinchZoom).toHaveBeenLastCalledWith(3);
		action.destroy();
		node.remove();
	});

	it('reads the live getScale via update(), not a stale snapshot', () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const onPinchZoomA = vi.fn();
		const onPinchZoomB = vi.fn();
		const action = canvasPinchZoom(node, {
			getScale: () => 1,
			minScale: 0.2,
			maxScale: 5,
			onPinchZoom: onPinchZoomA,
		});
		action.update({ getScale: () => 2, minScale: 0.2, maxScale: 5, onPinchZoom: onPinchZoomB });

		node.dispatchEvent(
			touch(node, 'touchstart', [
				[0, 0],
				[100, 0],
			]),
		);
		node.dispatchEvent(
			touch(node, 'touchmove', [
				[0, 0],
				[200, 0],
			]),
		); // distance doubled

		expect(onPinchZoomA).not.toHaveBeenCalled();
		expect(onPinchZoomB).toHaveBeenCalledWith(4); // baseline 2 * ratio 2
		action.destroy();
		node.remove();
	});

	it('stops reporting after destroy', () => {
		const node = document.createElement('div');
		document.body.appendChild(node);
		const onPinchZoom = vi.fn();
		const action = canvasPinchZoom(node, {
			getScale: () => 1,
			minScale: 0.2,
			maxScale: 5,
			onPinchZoom,
		});
		action.destroy();

		node.dispatchEvent(
			touch(node, 'touchstart', [
				[0, 0],
				[100, 0],
			]),
		);
		node.dispatchEvent(
			touch(node, 'touchmove', [
				[0, 0],
				[200, 0],
			]),
		);

		expect(onPinchZoom).not.toHaveBeenCalled();
		node.remove();
	});
});
