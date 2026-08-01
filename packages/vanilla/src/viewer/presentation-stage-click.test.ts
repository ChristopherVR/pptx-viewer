// @vitest-environment jsdom
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { PresentationActionRunner } from 'pptx-viewer-shared';
import type { Mock } from 'vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvePresentationStageClick } from './presentation-advance-gate';
import { renderSlideStage } from './render/slide-stage';

/**
 * A click on a shape carrying an Action Setting must FOLLOW the action and stop
 * there; only a click on inert slide content advances the show. The reporter's
 * deck (`e2e/fixtures/solution-explorer.pptx`) navigates entirely through such
 * shapes - a wheel of eight `ppaction://hlinksldjump` slices - and this binding
 * used to step to the NEXT slide on every one of them.
 */

function actionShape(id: string, actionClick?: PptxElement['actionClick']): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100, actionClick } as PptxElement;
}

function slideWith(elements: PptxElement[], transition?: PptxSlide['transition']): PptxSlide {
	return { id: 's1', rId: 'rId1', slideNumber: 1, elements, transition } as PptxSlide;
}

interface SpyRunner extends PresentationActionRunner {
	goToSlide: Mock<(slideIndex: number) => void>;
	move: Mock<(direction: 1 | -1) => void>;
	endShow: Mock<() => void>;
}

function runner(): SpyRunner {
	return {
		goToSlide: vi.fn<(slideIndex: number) => void>(),
		move: vi.fn<(direction: 1 | -1) => void>(),
		endShow: vi.fn<() => void>(),
	};
}

function click(
	target: EventTarget | null,
	slide: PptxSlide,
	actions = runner(),
): { advance: boolean; actions: ReturnType<typeof runner> } {
	const advance = resolvePresentationStageClick({
		target,
		presenting: true,
		animationBuildsComplete: true,
		currentSlide: slide,
		slideCount: 14,
		runner: actions,
	});
	return { advance, actions };
}

function render(elementId: string): HTMLElement {
	const node = document.createElement('div');
	node.setAttribute('data-element-id', elementId);
	document.body.replaceChildren(node);
	return node;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('resolvePresentationStageClick', () => {
	it('follows a slice’s slide jump instead of advancing the show', () => {
		const slide = slideWith([
			actionShape('slice', { action: 'ppaction://hlinksldjump', targetSlideIndex: 8 }),
		]);
		const { advance, actions } = click(render('slice'), slide);
		expect(actions.goToSlide).toHaveBeenCalledExactlyOnceWith(8);
		expect(advance).toBeFalsy();
	});

	it('still advances on a click on inert slide content', () => {
		const slide = slideWith([actionShape('art')]);
		const { advance, actions } = click(render('art'), slide);
		expect(actions.goToSlide).not.toHaveBeenCalled();
		expect(advance).toBeTruthy();
	});

	it('does not advance on a click when the slide sets advClick="0"', () => {
		const slide = slideWith([actionShape('art')], {
			type: 'cut',
			advanceOnClick: false,
			advanceAfterMs: 10,
		});
		expect(click(render('art'), slide).advance).toBeFalsy();
	});

	it('leaves an "Action: None" shape to the show’s own click-to-advance', () => {
		const slide = slideWith([actionShape('dead', { action: 'ppaction://noaction' })]);
		const { advance, actions } = click(render('dead'), slide);
		expect(actions.goToSlide).not.toHaveBeenCalled();
		expect(advance).toBeTruthy();
	});
});

describe('renderSlideStage presentation hit-testing', () => {
	it('marks the show stage and its action shapes so scenery stops taking clicks', () => {
		const slide = slideWith([actionShape('slice', { targetSlideIndex: 8 }), actionShape('art')]);
		const stage = renderSlideStage({
			document,
			slide,
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map(),
			registry: {
				resolve: () => (element: PptxElement) => {
					const node = document.createElement('div');
					node.setAttribute('data-element-id', element.id);
					return node;
				},
			} as never,
			t: ((key: string) => key) as never,
			interactive: true,
			presenting: true,
		});
		expect(stage.getAttribute('data-pptx-presenting')).toBe('true');
		expect(
			stage.querySelector('[data-element-id="slice"]')?.hasAttribute('data-pptx-action'),
		).toBeTruthy();
		expect(
			stage.querySelector('[data-element-id="art"]')?.hasAttribute('data-pptx-action'),
		).toBeFalsy();
	});
});
