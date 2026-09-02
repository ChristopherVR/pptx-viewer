// oxlint-disable react-hooks/rules-of-hooks -- Vue composable, not a React hook
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { SelectedBox } from '../components/selection-overlay-geometry';
import { useSelectionGesture } from './selection-gesture';
import type { SelectionGestureContext } from './selection-gesture';
import { getShapeAdjustmentHandleDescriptors } from './shape-adjustment';

function pointer(type: string, init: PointerEventInit): PointerEvent {
	const Ctor =
		typeof PointerEvent === 'function' ? PointerEvent : (MouseEvent as typeof PointerEvent);
	return new Ctor(type, { bubbles: true, pointerId: 1, ...init }) as PointerEvent;
}

function box(overrides: Partial<SelectedBox> = {}): SelectedBox {
	return { id: 'a', x: 10, y: 10, width: 100, height: 100, rotation: 0, ...overrides };
}

function setup(boxes: Record<string, SelectedBox>, elements: Record<string, PptxElement> = {}) {
	const spies = {
		onTransformStart: vi.fn(),
		onTransform: vi.fn(),
		onTransformEnd: vi.fn(),
		onAdjustStart: vi.fn(),
		onAdjust: vi.fn(),
		onAdjustEnd: vi.fn(),
		onRequestEdit: vi.fn(),
	};
	const rootEl = ref<HTMLElement | null>({
		getBoundingClientRect: () =>
			({
				left: 0,
				top: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect,
	} as unknown as HTMLElement);
	const context: SelectionGestureContext = {
		zoom: () => 1,
		boxForId: (id) => boxes[id],
		elementForId: (id) => elements[id],
		rootEl,
		...spies,
	};
	const gesture = useSelectionGesture(context);
	return { gesture, ...spies };
}

describe('useSelectionGesture: move', () => {
	// The gesture now runs through the shared `createGestureController`, whose
	// `onStart` fires only once the dead zone is exceeded, unlike the pre-repoint
	// Vue code, which pushed a transform-start (and so a history entry, upstream
	// in `useElementDrag`) synchronously at pointerdown regardless of whether the
	// press ever moved. A bare tap must not start a transform.
	it('does not start a transform on a bare tap; requests inline edit instead', () => {
		const { gesture, onTransformStart, onTransformEnd, onRequestEdit } = setup({ a: box() });

		gesture.beginGesture('move', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

		expect(onTransformStart).not.toHaveBeenCalled();
		expect(onTransformEnd).not.toHaveBeenCalled();
		expect(onRequestEdit).toHaveBeenCalledWith({ id: 'a' });
	});

	it('starts once the dead zone clears, previews live, and commits on release', () => {
		const { gesture, onTransformStart, onTransform, onTransformEnd, onRequestEdit } = setup({
			a: box(),
		});

		gesture.beginGesture('move', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 20 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 20 }));

		expect(onTransformStart).toHaveBeenCalledWith({ id: 'a' });
		expect(onTransform).toHaveBeenCalledWith({
			id: 'a',
			x: 40,
			y: 30,
			width: 100,
			height: 100,
			rotation: 0,
		});
		expect(onTransformEnd).toHaveBeenCalledWith({
			id: 'a',
			x: 40,
			y: 30,
			width: 100,
			height: 100,
			rotation: 0,
		});
		expect(onRequestEdit).not.toHaveBeenCalled();
	});
});

describe('useSelectionGesture: resize', () => {
	it('resizes freely (no aspect lock) without shift', () => {
		const { gesture, onTransformEnd } = setup({ a: box() });

		gesture.beginGesture('resize', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }), 'se');
		window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 20 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 20 }));

		expect(onTransformEnd).toHaveBeenCalledWith({
			id: 'a',
			x: 10,
			y: 10,
			width: 130,
			height: 120,
			rotation: 0,
		});
	});

	// New behaviour picked up from the shared engine's `editor-geometry`
	// (`lockResizeAspect`): a corner handle dragged with Shift held keeps the
	// start aspect ratio, matching Svelte/Vanilla (already on this engine). The
	// pre-repoint Vue code had no such branch at all.
	it('locks the aspect ratio on a corner handle when shift is held', () => {
		const { gesture, onTransformEnd } = setup({ a: box() });

		gesture.beginGesture('resize', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }), 'se');
		window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 20, shiftKey: true }));
		window.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 20, shiftKey: true }));

		// Width grew the most (30 vs 20), so height is pulled up to match: 100 *
		// 1.3 = 130, not the unlocked 120.
		expect(onTransformEnd).toHaveBeenCalledWith({
			id: 'a',
			x: 10,
			y: 10,
			width: 130,
			height: 130,
			rotation: 0,
		});
	});

	it('does not aspect-lock an edge handle even with shift held', () => {
		const { gesture, onTransformEnd } = setup({ a: box() });

		gesture.beginGesture('resize', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }), 'e');
		window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 20, shiftKey: true }));
		window.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 20, shiftKey: true }));

		expect(onTransformEnd).toHaveBeenCalledWith({
			id: 'a',
			x: 10,
			y: 10,
			width: 130,
			height: 100,
			rotation: 0,
		});
	});

	it('commits a harmless no-op at the start box for a tap on a handle (no drag)', () => {
		const { gesture, onTransformStart, onTransformEnd, onRequestEdit } = setup({ a: box() });

		gesture.beginGesture('resize', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }), 'se');
		window.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

		expect(onTransformStart).not.toHaveBeenCalled();
		expect(onTransformEnd).toHaveBeenCalledWith({
			id: 'a',
			x: 10,
			y: 10,
			width: 100,
			height: 100,
			rotation: 0,
		});
		expect(onRequestEdit).not.toHaveBeenCalled();
	});
});

describe('useSelectionGesture: rotate', () => {
	it('snaps to the nearest 15deg step only when shift is held', () => {
		const { gesture, onTransformEnd } = setup({ a: box({ x: 0, y: 0, width: 100, height: 100 }) });

		// Center is (50, 50); pointer at (110, -30) is ~36.87deg clockwise from
		// straight up, which is within the 7.5deg snap tolerance of 30deg.
		gesture.beginGesture('rotate', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 110, clientY: -30 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 110, clientY: -30 }));

		const unsnapped = onTransformEnd.mock.calls[0]?.[0] as { rotation: number };
		expect(unsnapped.rotation).toBeCloseTo(36.87, 1);
	});

	it('snaps with shift held', () => {
		const { gesture, onTransformEnd } = setup({ a: box({ x: 0, y: 0, width: 100, height: 100 }) });

		gesture.beginGesture('rotate', 'a', pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 110, clientY: -30, shiftKey: true }));
		window.dispatchEvent(pointer('pointerup', { clientX: 110, clientY: -30, shiftKey: true }));

		expect(onTransformEnd).toHaveBeenCalledWith({
			id: 'a',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			rotation: 30,
		});
	});
});

describe('useSelectionGesture: shape adjustment', () => {
	function roundRect(): PptxElement {
		return {
			type: 'shape',
			id: 'a',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			shapeType: 'roundRect',
			shapeAdjustments: { adj: 25000 },
		} as unknown as PptxElement;
	}

	it('drags the adjustment value and commits the final map on release', () => {
		const element = roundRect();
		const { gesture, onAdjustStart, onAdjust, onAdjustEnd } = setup(
			{ a: box({ width: 200, height: 100 }) },
			{ a: element },
		);
		const [descriptor] = getShapeAdjustmentHandleDescriptors(element);
		expect(descriptor).toBeDefined();

		gesture.beginAdjust('a', descriptor, pointer('pointerdown', { clientX: 0, clientY: 0 }));
		expect(onAdjustStart).toHaveBeenCalledWith({ id: 'a' });

		window.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 0 }));
		expect(onAdjust.mock.calls.length).toBeGreaterThan(0);
		const preview = onAdjust.mock.calls.at(-1)?.[0] as {
			id: string;
			adjustments: Record<string, number>;
		};
		expect(preview.id).toBe('a');
		expect(preview.adjustments.adj).toBeGreaterThan(25000);

		window.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 0 }));
		expect(onAdjustEnd).toHaveBeenCalledWith({ id: 'a', adjustments: preview.adjustments });
	});

	it('still commits (with the unchanged start value) on a tap that never moved', () => {
		const element = roundRect();
		const { gesture, onAdjustEnd } = setup({ a: box({ width: 200, height: 100 }) }, { a: element });
		const [descriptor] = getShapeAdjustmentHandleDescriptors(element);
		expect(descriptor).toBeDefined();

		gesture.beginAdjust('a', descriptor, pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

		expect(onAdjustEnd).toHaveBeenCalledWith({ id: 'a', adjustments: { adj: descriptor.value } });
	});
});
