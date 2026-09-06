// @vitest-environment happy-dom
/**
 * `useDrawingOverlay` is the Draw-tab pointer-capture hook (pointerdown /
 * pointermove / pointerup -> a completed `InkPptxElement`). This covers the
 * pen-tilt capture path: a synthetic `PointerEvent` carrying `tiltX`/`tiltY`
 * must reach the finished stroke as `inkPointTiltX`/`inkPointTiltY`, the same
 * way `pressure` already reaches it as `inkPointPressures`.
 */
import type { InkPptxElement } from 'pptx-viewer-core';
import React, { act, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDrawingOverlay } from './useDrawingOverlay';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function Harness({ onAddInkElement }: { onAddInkElement: (ink: InkPptxElement) => void }) {
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
		drawingWidth: 3,
		onAddInkElement,
	});
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
	init: { clientX: number; clientY: number; tiltX?: number; tiltY?: number },
): void {
	const event = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init });
	target.dispatchEvent(event);
}

describe('useDrawingOverlay - pen tilt capture', () => {
	it('attaches inkPointTiltX/Y to the finished stroke when the pointer reports a genuine lean', () => {
		const onAddInkElement = vi.fn();
		act(() => {
			root.render(<Harness onAddInkElement={onAddInkElement} />);
		});
		const stage = container.querySelector('[data-testid="stage"]') as HTMLDivElement;
		(stage as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
		(stage as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture =
			() => {};

		// Each dispatch gets its own `act()` so React flushes and re-renders
		// between events: `handleDrawPointerMove`/`Up` read `isStrokeActive`
		// from a closure over the hook's last render, which only reflects
		// pointerdown's `setIsStrokeActive(true)` once that render has
		// committed. Firing all three natively in one synchronous batch would
		// have every handler see the stale pre-stroke closure.
		act(() => {
			dispatchPointer(stage, 'pointerdown', { clientX: 0, clientY: 0, tiltX: 0, tiltY: 0 });
		});
		act(() => {
			dispatchPointer(stage, 'pointermove', { clientX: 10, clientY: 0, tiltX: 30, tiltY: -15 });
		});
		act(() => {
			dispatchPointer(stage, 'pointerup', { clientX: 20, clientY: 0, tiltX: 0, tiltY: 0 });
		});

		// `pointerup` finalises the stroke from the points already accumulated
		// by pointerdown + pointermove; it does not itself append a point.
		expect(onAddInkElement).toHaveBeenCalledOnce();
		const ink = onAddInkElement.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkPointTiltX).toStrictEqual([[0, 30]]);
		expect(ink.inkPointTiltY).toStrictEqual([[0, -15]]);
	});

	it('omits inkPointTiltX/Y when the pointer never reports tilt (a mouse)', () => {
		const onAddInkElement = vi.fn();
		act(() => {
			root.render(<Harness onAddInkElement={onAddInkElement} />);
		});
		const stage = container.querySelector('[data-testid="stage"]') as HTMLDivElement;
		(stage as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
		(stage as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture =
			() => {};

		act(() => {
			dispatchPointer(stage, 'pointerdown', { clientX: 0, clientY: 0 });
		});
		act(() => {
			dispatchPointer(stage, 'pointermove', { clientX: 10, clientY: 0 });
		});
		act(() => {
			dispatchPointer(stage, 'pointerup', { clientX: 20, clientY: 0 });
		});

		expect(onAddInkElement).toHaveBeenCalledOnce();
		const ink = onAddInkElement.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkPointTiltX).toBeUndefined();
		expect(ink.inkPointTiltY).toBeUndefined();
	});
});
