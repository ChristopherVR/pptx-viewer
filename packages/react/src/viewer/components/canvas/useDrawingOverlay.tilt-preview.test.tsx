// @vitest-environment happy-dom
/**
 * The pen-tilt LIVE preview: while the pointer is still down, `liveStrokeView`
 * must already be the same calligraphic nib-mark decision the committed
 * stroke gets from `strokeToInkElement` + `buildInkGroupStrokes`, not a plain
 * path that only gains its lean after `pointerup`. Companion to
 * `useDrawingOverlay.tilt.test.tsx`, which covers the committed stroke.
 */
import React, { act, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DrawingOverlayState } from './useDrawingOverlay';
import { useDrawingOverlay } from './useDrawingOverlay';

let container: HTMLDivElement;
let root: Root;
let latest: DrawingOverlayState | undefined;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	latest = undefined;
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function Harness() {
	const stageRef = useRef<HTMLDivElement>(null);
	const zoom = useMemo(
		() =>
			({ canvasStageRef: stageRef, editorScale: 1 }) as unknown as Parameters<
				typeof useDrawingOverlay
			>[0]['zoom'],
		[],
	);
	const overlay = useDrawingOverlay({
		activeTool: 'pen',
		activeSlide: undefined,
		zoom,
		drawingColor: '#123456',
		drawingWidth: 4,
	});
	latest = overlay;
	return (
		<div
			ref={stageRef}
			data-testid='stage'
			onPointerDown={overlay.handleDrawPointerDown}
			onPointerMove={overlay.handleDrawPointerMove}
			onPointerUp={overlay.handleDrawPointerUp}
		/>
	);
}

function dispatchPointer(
	target: Element,
	type: 'pointerdown' | 'pointermove' | 'pointerup',
	init: { clientX: number; clientY: number; tiltX?: number; tiltY?: number; pressure?: number },
): void {
	const event = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init });
	target.dispatchEvent(event);
}

describe('useDrawingOverlay - live tilt preview', () => {
	it('exposes nib marks in liveStrokeView while the stroke is still in progress', () => {
		act(() => {
			root.render(<Harness />);
		});
		const stage = container.querySelector('[data-testid="stage"]') as HTMLDivElement;
		(stage as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};

		act(() => {
			dispatchPointer(stage, 'pointerdown', { clientX: 0, clientY: 0, tiltX: 0, tiltY: 0 });
		});
		act(() => {
			dispatchPointer(stage, 'pointermove', { clientX: 10, clientY: 0, tiltX: 30, tiltY: -15 });
		});

		// Still mid-gesture: no pointerup yet.
		expect(latest?.isStrokeActive).toBeTruthy();
		expect(latest?.liveStrokeView).not.toBeNull();
		expect(latest?.liveStrokeView?.nibMarks).not.toBeNull();
		expect(latest?.liveStrokeView?.nibMarks?.length).toBeGreaterThan(0);
		expect(latest?.liveStrokeView?.circles).toBeNull();
	});

	it('renders a plain path (no nib marks) while the pointer reports no tilt', () => {
		act(() => {
			root.render(<Harness />);
		});
		const stage = container.querySelector('[data-testid="stage"]') as HTMLDivElement;
		(stage as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};

		act(() => {
			dispatchPointer(stage, 'pointerdown', { clientX: 0, clientY: 0 });
		});
		act(() => {
			dispatchPointer(stage, 'pointermove', { clientX: 10, clientY: 0 });
		});

		expect(latest?.liveStrokeView?.nibMarks).toBeNull();
		expect(latest?.liveStrokeView?.circles).toBeNull();
		expect(latest?.liveStrokeView?.d).toBe('M 0 0 L 10 0');
	});

	it('is null before any stroke starts', () => {
		act(() => {
			root.render(<Harness />);
		});
		expect(latest?.liveStrokeView).toBeNull();
	});
});
