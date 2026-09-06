import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { InkDrawingService } from './ink-drawing.service';
import type { DrawTool } from './ink-drawing.service';

function fakePointerEvent(overrides: {
	clientX: number;
	clientY: number;
	pressure?: number;
	tiltX?: number;
	tiltY?: number;
	pointerId?: number;
	target?: EventTarget | null;
}): PointerEvent {
	return {
		clientX: overrides.clientX,
		clientY: overrides.clientY,
		pressure: overrides.pressure,
		tiltX: overrides.tiltX,
		tiltY: overrides.tiltY,
		pointerId: overrides.pointerId ?? 1,
		target: overrides.target ?? document.createElement('div'),
		preventDefault: vi.fn(),
	} as unknown as PointerEvent;
}

function buildService(tool: DrawTool) {
	const service = new InkDrawingService();
	const stage = document.createElement('div');
	vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		width: 0,
		height: 0,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	});
	const emitInkStrokeComplete = vi.fn();
	const emitEraserHit = vi.fn();
	service.bind({
		stageElement: () => stage,
		effectiveScale: () => 1,
		elements: () => [] as readonly PptxElement[],
		drawTool: () => tool,
		drawColor: () => '#000000',
		drawWidth: () => 3,
		emitInkStrokeComplete,
		emitEraserHit,
	});
	return { service, emitInkStrokeComplete, emitEraserHit };
}

describe('inkDrawingService: authored pressure parity with React', () => {
	it('does not author inkPointPressures for a uniform-pressure (mouse) stroke', () => {
		const { service, emitInkStrokeComplete } = buildService('pen');
		service.handleStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0, pressure: 0.5 }));
		service.handlePointerMove(fakePointerEvent({ clientX: 10, clientY: 5, pressure: 0.5 }));
		service.handlePointerUp();

		expect(emitInkStrokeComplete).toHaveBeenCalledOnce();
		const ink = emitInkStrokeComplete.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkPointPressures).toBeUndefined();
	});

	it('authors a variable-width inkPointPressures channel for a varying-pressure stroke', () => {
		const { service, emitInkStrokeComplete } = buildService('pen');
		service.handleStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0, pressure: 0.1 }));
		service.handlePointerMove(fakePointerEvent({ clientX: 10, clientY: 0, pressure: 0.6 }));
		service.handlePointerMove(fakePointerEvent({ clientX: 20, clientY: 0, pressure: 0.9 }));
		service.handlePointerUp();

		const ink = emitInkStrokeComplete.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkPointPressures).toStrictEqual([[0.1, 0.6, 0.9]]);
	});
});

describe('inkDrawingService: live preview shows the same nib/circle decision as the committed stroke', () => {
	it('exposes nib marks in liveStrokeView while the pointer reports a genuine tilt lean, before pointerup', () => {
		const { service } = buildService('pen');
		service.handleStagePointerDown(
			fakePointerEvent({ clientX: 0, clientY: 0, tiltX: 0, tiltY: 0 }),
		);
		service.handlePointerMove(fakePointerEvent({ clientX: 10, clientY: 0, tiltX: 30, tiltY: -15 }));

		const view = service.liveStrokeView();
		expect(view).not.toBeNull();
		expect(view?.nibMarks).not.toBeNull();
		expect(view?.nibMarks?.length).toBeGreaterThan(0);
		expect(view?.circles).toBeNull();
	});

	it('renders a plain path in the live preview when the pointer reports no tilt', () => {
		const { service } = buildService('pen');
		service.handleStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0 }));
		service.handlePointerMove(fakePointerEvent({ clientX: 10, clientY: 0 }));

		const view = service.liveStrokeView();
		expect(view?.nibMarks).toBeNull();
		expect(view?.circles).toBeNull();
		expect(view?.d).toBe('M 0 0 L 10 0');
	});

	it('clears liveStrokeView once the stroke is committed on pointerup', () => {
		const { service } = buildService('pen');
		service.handleStagePointerDown(fakePointerEvent({ clientX: 0, clientY: 0 }));
		service.handlePointerMove(fakePointerEvent({ clientX: 10, clientY: 0 }));
		expect(service.liveStrokeView()).not.toBeNull();

		service.handlePointerUp();
		expect(service.liveStrokeView()).toBeNull();
	});
});

describe('inkDrawingService: authored pen-tilt parity with React', () => {
	it('does not author inkPointTiltX/Y for a flat (0, 0) stroke (mouse / no tilt sensor)', () => {
		const { service, emitInkStrokeComplete } = buildService('pen');
		service.handleStagePointerDown(
			fakePointerEvent({ clientX: 0, clientY: 0, tiltX: 0, tiltY: 0 }),
		);
		service.handlePointerMove(fakePointerEvent({ clientX: 10, clientY: 5, tiltX: 0, tiltY: 0 }));
		service.handlePointerUp();

		const ink = emitInkStrokeComplete.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkPointTiltX).toBeUndefined();
		expect(ink.inkPointTiltY).toBeUndefined();
	});

	it('authors inkPointTiltX/Y (raw degrees) when the stylus reports a genuine lean', () => {
		const { service, emitInkStrokeComplete } = buildService('pen');
		service.handleStagePointerDown(
			fakePointerEvent({ clientX: 0, clientY: 0, tiltX: 0, tiltY: 0 }),
		);
		service.handlePointerMove(fakePointerEvent({ clientX: 10, clientY: 0, tiltX: 30, tiltY: -15 }));
		service.handlePointerUp();

		const ink = emitInkStrokeComplete.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkPointTiltX).toStrictEqual([[0, 30]]);
		expect(ink.inkPointTiltY).toStrictEqual([[0, -15]]);
	});
});
