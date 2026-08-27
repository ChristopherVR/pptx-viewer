import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { InkDrawingService } from './ink-drawing.service';
import type { DrawTool } from './ink-drawing.service';

function fakePointerEvent(overrides: {
	clientX: number;
	clientY: number;
	pressure?: number;
	pointerId?: number;
	target?: EventTarget | null;
}): PointerEvent {
	return {
		clientX: overrides.clientX,
		clientY: overrides.clientY,
		pressure: overrides.pressure,
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
