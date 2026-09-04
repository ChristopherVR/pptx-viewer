import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { PresentationActionRunner } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { isSwipeAdvanceBlocked, resolvePresentationStageClick } from './presentation-advance-gate';

function slide(advanceOnClick: boolean | undefined): PptxSlide {
	return {
		id: 's',
		rId: 's',
		slideNumber: 1,
		elements: [],
		transition: { type: 'fade', advanceOnClick },
	} as PptxSlide;
}

describe('isSwipeAdvanceBlocked', () => {
	it('blocks the swipe/tap advance when advanceOnClick is false and builds are done', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: true,
				currentSlide: slide(false),
			}),
		).toBeTruthy();
	});

	it('allows the advance when advanceOnClick is true or undefined', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: true,
				currentSlide: slide(true),
			}),
		).toBeFalsy();
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: true,
				currentSlide: slide(undefined),
			}),
		).toBeFalsy();
	});

	it('never blocks while animation builds remain (tap still steps builds)', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: false,
				currentSlide: slide(false),
			}),
		).toBeFalsy();
	});

	it('never blocks outside a running show (preview-mode swipe)', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: false,
				animationBuildsComplete: true,
				currentSlide: slide(false),
			}),
		).toBeFalsy();
	});
});

describe('resolvePresentationStageClick @highlightClick flash', () => {
	function stageSlide(highlightClick: boolean): PptxSlide {
		return {
			id: 's',
			elements: [
				{
					id: 'el-1',
					type: 'shape',
					x: 0,
					y: 0,
					width: 10,
					height: 10,
					actionClick: { action: 'ppaction://noaction', highlightClick },
				} as unknown as PptxElement,
			],
		} as unknown as PptxSlide;
	}

	function noopRunner(): PresentationActionRunner {
		return { goToSlide: vi.fn(), move: vi.fn(), endShow: vi.fn() };
	}

	function stageTarget(elementId: string): HTMLElement {
		const el = document.createElement('div');
		el.dataset.elementId = elementId;
		document.body.appendChild(el);
		return el;
	}

	it('flashes the clicked element and clears it after the duration', () => {
		vi.useFakeTimers();
		const target = stageTarget('el-1');
		resolvePresentationStageClick({
			target,
			currentSlide: stageSlide(true),
			slideCount: 1,
			runner: noopRunner(),
			presenting: true,
			animationBuildsComplete: true,
		});
		expect(target.style.filter).toBe('brightness(1.18)');
		vi.advanceTimersByTime(320);
		expect(target.style.filter).toBe('');
		vi.useRealTimers();
	});

	it('does not flash when the action carries no highlightClick', () => {
		const target = stageTarget('el-1');
		resolvePresentationStageClick({
			target,
			currentSlide: stageSlide(false),
			slideCount: 1,
			runner: noopRunner(),
			presenting: true,
			animationBuildsComplete: true,
		});
		expect(target.style.filter).toBe('');
	});
});
