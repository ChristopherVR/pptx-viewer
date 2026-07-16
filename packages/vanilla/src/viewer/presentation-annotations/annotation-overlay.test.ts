import type { PresentationInkStroke } from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mountAnnotationOverlay } from './annotation-overlay';

function pointer(type: string, x: number, y: number, pointerId = 1): PointerEvent {
	return new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId });
}

describe('mountAnnotationOverlay', () => {
	beforeEach(() => document.body.replaceChildren());

	it('captures a normalized pen stroke and publishes it on pointer up', () => {
		const stageWrap = document.createElement('div');
		const onChange = vi.fn<(strokes: PresentationInkStroke[]) => void>();
		mountAnnotationOverlay({
			stageWrap,
			slideIndex: 2,
			tool: 'pen',
			color: '#123456',
			strokes: [],
			onChange,
		});
		const svg = stageWrap.querySelector<SVGSVGElement>('svg')!;
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
			x: 10,
			y: 20,
			left: 10,
			top: 20,
			right: 210,
			bottom: 120,
			width: 200,
			height: 100,
			toJSON: () => ({}),
		});
		svg.dispatchEvent(pointer('pointerdown', 30, 40));
		svg.dispatchEvent(pointer('pointermove', 110, 80));
		svg.dispatchEvent(pointer('pointerup', 110, 80));

		expect(onChange).toHaveBeenCalledOnce();
		expect(onChange.mock.calls[0][0][0]).toMatchObject({
			slideIndex: 2,
			tool: 'pen',
			color: '#123456',
			points: [
				{ x: 0.1, y: 0.2 },
				{ x: 0.5, y: 0.6 },
			],
		});
	});

	it('erases intersecting strokes with the shared normalized hit test', () => {
		const stageWrap = document.createElement('div');
		const onChange = vi.fn<(strokes: PresentationInkStroke[]) => void>();
		mountAnnotationOverlay({
			stageWrap,
			slideIndex: 0,
			tool: 'eraser',
			color: '#ef4444',
			strokes: [
				{
					id: 'one',
					slideIndex: 0,
					tool: 'pen',
					color: '#000',
					width: 2.5,
					points: [{ x: 0.5, y: 0.5 }],
				},
			],
			onChange,
		});
		const svg = stageWrap.querySelector<SVGSVGElement>('svg')!;
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
			x: 0,
			y: 0,
			left: 0,
			top: 0,
			right: 100,
			bottom: 100,
			width: 100,
			height: 100,
			toJSON: () => ({}),
		});
		svg.dispatchEvent(pointer('pointerdown', 50, 50));
		expect(onChange).toHaveBeenCalledWith([]);
	});
});
