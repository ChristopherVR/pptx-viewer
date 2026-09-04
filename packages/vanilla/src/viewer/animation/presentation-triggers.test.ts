import type { PptxSlide } from 'pptx-viewer-core';
import type { PresentationAnimationController } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { attachTriggerListeners } from './presentation-triggers';
import type { TriggerDeps } from './presentation-triggers';

function makeDeps(overrides: Partial<TriggerDeps> = {}): TriggerDeps {
	return {
		getController: () => null,
		play: vi.fn(),
		getSlide: () => undefined,
		...overrides,
	};
}

function makeStage(elementId: string): { stage: HTMLElement; shape: HTMLElement } {
	const stage = document.createElement('div');
	const shape = document.createElement('div');
	shape.dataset.elementId = elementId;
	stage.appendChild(shape);
	document.body.appendChild(stage);
	return { stage, shape };
}

function slideWithHighlightHover(): PptxSlide {
	return {
		id: 's1',
		elements: [
			{
				id: 'el-h',
				type: 'shape',
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				actionHover: { action: 'ppaction://noaction', highlightClick: true },
			},
		],
	} as unknown as PptxSlide;
}

describe('attachTriggerListeners @highlightClick hover flash', () => {
	it('flashes on mouseover and clears on mouseout, independent of an onHover animation trigger', () => {
		const { stage, shape } = makeStage('el-h');
		attachTriggerListeners(stage, makeDeps({ getSlide: () => slideWithHighlightHover() }));

		shape.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(shape.style.filter).toBe('brightness(1.15)');

		stage.dispatchEvent(
			new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
		);
		expect(shape.style.filter).toBe('');
	});

	it('does not flash when the slide has no highlightClick hover action', () => {
		const { stage, shape } = makeStage('el-h');
		attachTriggerListeners(stage, makeDeps({ getSlide: () => undefined }));

		shape.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(shape.style.filter).toBe('');
	});

	it('does not clear the flash on a mouseout that stays within the stage subtree', () => {
		const { stage, shape } = makeStage('el-h');
		const inner = document.createElement('span');
		shape.appendChild(inner);
		attachTriggerListeners(stage, makeDeps({ getSlide: () => slideWithHighlightHover() }));

		shape.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(shape.style.filter).toBe('brightness(1.15)');

		shape.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: inner }));
		expect(shape.style.filter).toBe('brightness(1.15)');
	});

	it('still fires the onHover animation trigger alongside the highlight flash', () => {
		const controller = {
			hasHoverSequence: () => true,
			resetHover: vi.fn(),
			advanceHover: vi.fn(() => undefined),
			hasInteractiveSequence: () => false,
		} as unknown as PresentationAnimationController;
		const { stage, shape } = makeStage('el-h');
		attachTriggerListeners(
			stage,
			makeDeps({ getController: () => controller, getSlide: () => slideWithHighlightHover() }),
		);

		shape.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(controller.resetHover).toHaveBeenCalledWith('el-h');
		expect(shape.style.filter).toBe('brightness(1.15)');
	});
});
