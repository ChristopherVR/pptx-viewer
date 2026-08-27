import { describe, expect, it, vi } from 'vitest';

import type { DrawTool } from '../state';
import { clientPointToStagePoint, createDrawGestures } from './editor-draw-gestures';

/** A minimal fake `PointerEvent`: only the fields the gesture controller reads. */
function fakePointerEvent(overrides: {
	clientX: number;
	clientY: number;
	pointerId?: number;
	button?: number;
	pressure?: number;
	target?: EventTarget | null;
}): PointerEvent {
	return {
		clientX: overrides.clientX,
		clientY: overrides.clientY,
		pointerId: overrides.pointerId ?? 1,
		button: overrides.button ?? 0,
		pressure: overrides.pressure,
		target: overrides.target ?? null,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as PointerEvent;
}

describe('clientPointToStagePoint', () => {
	it('subtracts the stage origin and divides by scale', () => {
		expect(clientPointToStagePoint(110, 220, { left: 10, top: 20 }, 2)).toStrictEqual({
			x: 50,
			y: 100,
		});
	});

	it('falls back to a scale of 1 when scale is 0 (unmeasured stage)', () => {
		expect(clientPointToStagePoint(10, 20, { left: 0, top: 0 }, 0)).toStrictEqual({ x: 10, y: 20 });
	});
});

function buildGestures(
	tool: DrawTool,
	overrides: Partial<Parameters<typeof createDrawGestures>[0]> = {},
) {
	const onCommitStroke = vi.fn();
	const onEraseAt = vi.fn();
	const gestures = createDrawGestures({
		getScale: () => 1,
		getStageOrigin: () => ({ left: 0, top: 0 }),
		getStageRoot: () => null,
		getTool: () => tool,
		getColor: () => '#ff0000',
		getWidth: () => 5,
		onCommitStroke,
		onEraseAt,
		...overrides,
	});
	return { gestures, onCommitStroke, onEraseAt };
}

describe('createDrawGestures', () => {
	it('is a no-op when the select tool is active', () => {
		const { gestures, onCommitStroke } = buildGestures('select');
		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0 }));
		expect(gestures.isActive()).toBeFalsy();
		expect(onCommitStroke).not.toHaveBeenCalled();
	});

	it('ignores non-primary pointer buttons', () => {
		const { gestures, onCommitStroke } = buildGestures('pen');
		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0, button: 2 }));
		expect(gestures.isActive()).toBeFalsy();
		expect(onCommitStroke).not.toHaveBeenCalled();
	});

	it('accumulates points across pointermove and commits the stroke on pointerup', () => {
		const { gestures, onCommitStroke } = buildGestures('pen');

		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0 }));
		expect(gestures.isActive()).toBeTruthy();

		// The controller listens via addEventListener('pointermove', ...), so drive
		// it with a dispatched Event carrying the pointer fields it reads.
		window.dispatchEvent(
			Object.assign(new Event('pointermove'), { clientX: 10, clientY: 5, pointerId: 1 }),
		);
		window.dispatchEvent(
			Object.assign(new Event('pointerup'), { clientX: 20, clientY: 15, pointerId: 1 }),
		);

		expect(gestures.isActive()).toBeFalsy();
		expect(onCommitStroke).toHaveBeenCalledOnce();
		const stroke = onCommitStroke.mock.calls[0][0];
		expect(stroke.tool).toBe('pen');
		expect(stroke.color).toBe('#ff0000');
		expect(stroke.width).toBe(5);
		expect(stroke.points).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 5 },
			{ x: 20, y: 15 },
		]);
	});

	it('carries each pointer event pressure reading through to the committed stroke points', () => {
		const { gestures, onCommitStroke } = buildGestures('pen');

		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0, pressure: 0.1 }));
		window.dispatchEvent(
			Object.assign(new Event('pointermove'), {
				clientX: 10,
				clientY: 5,
				pointerId: 1,
				pressure: 0.9,
			}),
		);
		window.dispatchEvent(
			Object.assign(new Event('pointerup'), {
				clientX: 20,
				clientY: 15,
				pointerId: 1,
				pressure: 0.4,
			}),
		);

		const stroke = onCommitStroke.mock.calls[0][0];
		expect(stroke.points.map((p: { pressure?: number }) => p.pressure)).toStrictEqual([
			0.1, 0.9, 0.4,
		]);
	});

	it('marks a highlighter stroke with the highlighter tool', () => {
		const { gestures, onCommitStroke } = buildGestures('highlighter');
		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0 }));
		window.dispatchEvent(
			Object.assign(new Event('pointerup'), { clientX: 1, clientY: 1, pointerId: 1 }),
		);
		expect(onCommitStroke.mock.calls[0][0].tool).toBe('highlighter');
	});

	it('ignores pointermove/pointerup events from a different pointerId', () => {
		const { gestures, onCommitStroke } = buildGestures('pen');
		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0, pointerId: 1 }));
		window.dispatchEvent(
			Object.assign(new Event('pointerup'), { clientX: 99, clientY: 99, pointerId: 2 }),
		);
		expect(gestures.isActive()).toBeTruthy();
		expect(onCommitStroke).not.toHaveBeenCalled();
	});

	it('eraser: hit-tests the target and erases the resolved element id without starting a stroke', () => {
		const stageRoot = document.createElement('div');
		stageRoot.className = 'pptxv-stage';
		const inkEl = document.createElement('div');
		inkEl.dataset.elementId = 'ink-1';
		stageRoot.appendChild(inkEl);

		const { gestures, onEraseAt, onCommitStroke } = buildGestures('eraser', {
			getStageRoot: () => stageRoot,
		});

		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0, target: inkEl }));

		expect(onEraseAt).toHaveBeenCalledExactlyOnceWith('ink-1');
		expect(onCommitStroke).not.toHaveBeenCalled();
		expect(gestures.isActive()).toBeFalsy();
	});

	it('eraser: does nothing when the pointerdown target is not over an element', () => {
		const stageRoot = document.createElement('div');
		stageRoot.className = 'pptxv-stage';
		const { gestures, onEraseAt } = buildGestures('eraser', { getStageRoot: () => stageRoot });

		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0, target: stageRoot }));

		expect(onEraseAt).not.toHaveBeenCalled();
	});

	it('dispose() aborts an in-progress stroke without committing', () => {
		const { gestures, onCommitStroke } = buildGestures('pen');
		gestures.onStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0 }));
		expect(gestures.isActive()).toBeTruthy();

		gestures.dispose();
		expect(gestures.isActive()).toBeFalsy();

		window.dispatchEvent(
			Object.assign(new Event('pointerup'), { clientX: 1, clientY: 1, pointerId: 1 }),
		);
		expect(onCommitStroke).not.toHaveBeenCalled();
	});
});
