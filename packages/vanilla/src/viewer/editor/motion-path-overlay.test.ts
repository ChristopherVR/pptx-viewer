import type { PptxElement } from 'pptx-viewer-core';
import { motionPathPresetById } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { MotionPathOverlayState } from './motion-path-overlay';
import { createMotionPathOverlay } from './motion-path-overlay';

const t = createTranslator();

/** A 200x100 shape centred at (300, 250) on a 1280x720 stage. */
const ELEMENT = {
	id: 'el1',
	type: 'shape',
	x: 200,
	y: 200,
	width: 200,
	height: 100,
} as PptxElement;
const LINE_RIGHT = motionPathPresetById('lineRight')?.path ?? '';

function state(overrides: Partial<MotionPathOverlayState> = {}): MotionPathOverlayState {
	return {
		element: ELEMENT,
		path: LINE_RIGHT,
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		canEdit: true,
		...overrides,
	};
}

function pointer(type: string, clientX: number, clientY: number): PointerEvent {
	return new PointerEvent(type, {
		clientX,
		clientY,
		pointerId: 1,
		bubbles: true,
		cancelable: true,
	});
}

describe('createMotionPathOverlay', () => {
	it('draws the path in unscaled slide pixels from the element centre', () => {
		const overlay = createMotionPathOverlay(document, t, vi.fn());
		overlay.update(state());
		expect(overlay.root.getAttribute('data-pptx-motion-path-overlay')).toBe('true');
		expect(overlay.root.getAttribute('role')).toBe('img');
		expect(overlay.root.getAttribute('aria-label')).toBe(t('pptx.animation.motionPath.overlay'));
		expect(overlay.root.getAttribute('width')).toBe('1280');

		// Origin is the element centre (300, 250); `lineRight` travels a quarter
		// of the slide width, so the end lands 320px to its right.
		const start = overlay.root.querySelector('circle');
		expect(start?.getAttribute('cx')).toBe('300');
		expect(start?.getAttribute('cy')).toBe('250');
		const handle = overlay.root.querySelector('[data-pptx-motion-path-handle="end"]');
		expect(handle?.getAttribute('cx')).toBe('620');
		expect(handle?.getAttribute('cy')).toBe('250');
		expect(overlay.root.querySelector('path')?.getAttribute('d')).toContain('M 300 250');
		expect(handle?.getAttribute('aria-label')).toBe(t('pptx.animation.motionPath.endHandle'));
	});

	it('mounts inside the scaled stage and detaches when nothing is selected', () => {
		const stage = document.createElement('div');
		document.body.appendChild(stage);
		const overlay = createMotionPathOverlay(document, t, vi.fn());
		overlay.update(state());
		overlay.mount(stage);
		expect(overlay.root.parentElement).toBe(stage);

		overlay.update(state({ path: undefined }));
		expect(overlay.root.parentElement).toBeNull();
		overlay.mount(stage);
		expect(overlay.root.parentElement).toBeNull();
		stage.remove();
	});

	it('converts a drag by the editor zoom into slide fractions and commits once', () => {
		const onChangePath = vi.fn();
		const overlay = createMotionPathOverlay(document, t, onChangePath);
		overlay.update(state({ scale: 2 }));
		const handle = overlay.root.querySelector('[data-pptx-motion-path-handle="end"]');

		handle?.dispatchEvent(pointer('pointerdown', 0, 0));
		// 256 client px at 2x zoom is 128 slide px = 0.1 of the slide width, on
		// top of the preset's own 0.25; 144 client px is 0.1 of the height.
		window.dispatchEvent(pointer('pointermove', 256, 144));
		expect(onChangePath).not.toHaveBeenCalled();
		expect(
			overlay.root.querySelector('[data-pptx-motion-path-handle="end"]')?.getAttribute('cx'),
		).toBe('748');

		window.dispatchEvent(pointer('pointerup', 256, 144));
		expect(onChangePath).toHaveBeenCalledExactlyOnceWith('M 0 0 L 0.35 0.1');
	});

	it('ignores a drag on a closed path and while the canvas is read-only', () => {
		const onChangePath = vi.fn();
		const overlay = createMotionPathOverlay(document, t, onChangePath);
		// `square` is closed (`Z`), so it has no free end to retarget.
		overlay.update(state({ path: motionPathPresetById('square')?.path }));
		const handle = overlay.root.querySelector('[data-pptx-motion-path-handle="end"]');
		handle?.dispatchEvent(pointer('pointerdown', 0, 0));
		window.dispatchEvent(pointer('pointermove', 40, 40));
		window.dispatchEvent(pointer('pointerup', 40, 40));
		expect(onChangePath).not.toHaveBeenCalled();

		overlay.update(state({ canEdit: false }));
		handle?.dispatchEvent(pointer('pointerdown', 0, 0));
		window.dispatchEvent(pointer('pointermove', 40, 40));
		window.dispatchEvent(pointer('pointerup', 40, 40));
		expect(onChangePath).not.toHaveBeenCalled();
	});

	it('keeps the in-flight draft when the store notifies mid-drag', () => {
		const overlay = createMotionPathOverlay(document, t, vi.fn());
		overlay.update(state());
		const handle = overlay.root.querySelector('[data-pptx-motion-path-handle="end"]');
		handle?.dispatchEvent(pointer('pointerdown', 0, 0));
		window.dispatchEvent(pointer('pointermove', 128, 0));
		const dragged = handle?.getAttribute('cx');

		// An unrelated re-sync must not snap the handle back under the pointer.
		overlay.update(state());
		expect(handle?.getAttribute('cx')).toBe(dragged);
		window.dispatchEvent(pointer('pointerup', 128, 0));
	});
});
