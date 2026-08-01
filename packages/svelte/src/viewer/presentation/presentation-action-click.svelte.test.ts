// @vitest-environment jsdom
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { PresentationController } from './presentation-controller.svelte';

/**
 * A click on a shape carrying an Action Setting must FOLLOW the action and stop
 * there; only a click on inert slide content advances the show. The reporter's
 * deck navigates entirely through such shapes (a wheel of eight
 * `ppaction://hlinksldjump` slices), and this binding used to step to the next
 * slide on every one of them.
 */

function actionShape(id: string, actionClick?: PptxElement['actionClick']): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100, actionClick } as PptxElement;
}

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements } as PptxSlide;
}

class Deck {
	slides = $state<PptxSlide[]>([]);
	index = $state(0);
}

function harness(elements: PptxElement[], transition?: PptxSlide['transition']) {
	const deck = new Deck();
	deck.slides = [
		{ ...slide('s1', elements), transition } as PptxSlide,
		slide('s2'),
		slide('s3'),
		slide('s4'),
	];
	const navigate = vi.fn((index: number) => {
		deck.index = index;
	});
	const controller = new PresentationController({
		getSlides: () => deck.slides,
		getCurrentIndex: () => deck.index,
		navigate,
	});
	controller.start();
	return { controller, navigate, deck };
}

function render(html: string): HTMLElement {
	document.body.innerHTML = html;
	return document.body.firstElementChild as HTMLElement;
}

describe('presentationController.handleStageClick', () => {
	it('follows a slice’s slide jump instead of advancing the show', () => {
		const { controller, navigate } = harness([
			actionShape('slice', { action: 'ppaction://hlinksldjump', targetSlideIndex: 3 }),
		]);
		const node = render('<div data-element-id="slice"><span>Tactical Edge</span></div>');
		controller.handleStageClick(node.firstElementChild);
		expect(navigate).toHaveBeenCalledExactlyOnceWith(3);
	});

	it('still advances on a click on inert slide content', () => {
		const { controller, navigate } = harness([actionShape('art')]);
		controller.handleStageClick(render('<div data-element-id="art"></div>'));
		expect(navigate).toHaveBeenCalledExactlyOnceWith(1);
	});

	it('does not advance on a click when the slide sets advClick="0"', () => {
		const { controller, navigate } = harness([actionShape('art')], {
			type: 'cut',
			advanceOnClick: false,
			advanceAfterMs: 10,
		});
		controller.handleStageClick(render('<div data-element-id="art"></div>'));
		expect(navigate).not.toHaveBeenCalled();
	});

	it('leaves an "Action: None" shape to the show’s own click-to-advance', () => {
		const { controller, navigate } = harness([
			actionShape('dead', { action: 'ppaction://noaction', highlightClick: true }),
		]);
		controller.handleStageClick(render('<div data-element-id="dead"></div>'));
		expect(navigate).toHaveBeenCalledExactlyOnceWith(1);
	});
});
