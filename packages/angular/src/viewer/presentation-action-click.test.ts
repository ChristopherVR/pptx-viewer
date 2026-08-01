// @vitest-environment jsdom
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AnimationPlaybackService } from './animation-playback.service';
import type { PresentationAnnotationsService } from './presentation-annotations.service';
import { PresentationInputController } from './presentation-input-controller';
import { PresentationShowNavigator } from './presentation-show-navigator';

/**
 * A click on a shape carrying an Action Setting must FOLLOW the action and stop
 * there; only a click on inert slide content advances the show. The reporter's
 * deck navigates entirely through such shapes (a wheel of eight
 * `ppaction://hlinksldjump` slices), and this binding used to step to the next
 * slide on every one of them. Driven without TestBed: both classes are plain
 * signal holders over injected collaborators.
 */

function actionShape(id: string, actionClick?: PptxElement['actionClick']): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100, actionClick } as PptxElement;
}

function deckOf(elements: PptxElement[], transition?: PptxSlide['transition']): PptxSlide[] {
	return [0, 1, 2, 3].map(
		(index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				elements: index === 0 ? elements : [],
				...(index === 0 && transition ? { transition } : {}),
			}) as PptxSlide,
	);
}

function harness(elements: PptxElement[], transition?: PptxSlide['transition']) {
	const deck = deckOf(elements, transition);
	const playback = {
		advance: () => false,
		isSeededCompleted: () => false,
		setSlide: () => undefined,
		isComplete: () => true,
		interactiveTriggerShapeIds: () => new Set<string>(),
		handleInteractiveShapeClick: () => false,
	} as unknown as AnimationPlaybackService;
	const annotations = {
		setActiveSlide: () => undefined,
		tool: () => 'none' as const,
	} as unknown as PresentationAnnotationsService;
	const requestClose = vi.fn();
	const navigator = new PresentationShowNavigator({
		slides: () => deck,
		currentSlide: () => deck[navigator.currentIndex()],
		showWithAnimation: () => true,
		playback,
		annotations,
		emitIndex: () => undefined,
		requestClose,
	});
	const controller = new PresentationInputController({
		slides: () => deck,
		currentSlide: () => deck[navigator.currentIndex()],
		root: () => null,
		navigator,
		playback,
		annotations,
		presenterWindow: {
			snapshot: () => ({ blackout: 'none' }),
			updateSnapshot: () => undefined,
		} as never,
		toggleInkMarkup: () => undefined,
		requestClose,
	});
	return { controller, navigator, requestClose };
}

function render(html: string): HTMLElement {
	document.body.innerHTML = html;
	return document.body.firstElementChild as HTMLElement;
}

function clickOn(node: Element | null): MouseEvent {
	return { button: 0, target: node } as unknown as MouseEvent;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('presentation action clicks', () => {
	it('follows a slice’s slide jump instead of advancing the show', () => {
		const { controller, navigator } = harness([
			actionShape('slice', { action: 'ppaction://hlinksldjump', targetSlideIndex: 3 }),
		]);
		const node = render('<div data-element-id="slice"><span>Tactical Edge</span></div>');
		controller.handleBodyClick(clickOn(node.firstElementChild));
		expect(navigator.currentIndex()).toBe(3);
	});

	it('plays the target slide’s transition on an action jump', () => {
		const { controller, navigator } = harness([actionShape('slice', { targetSlideIndex: 2 })]);
		controller.handleBodyClick(clickOn(render('<div data-element-id="slice"></div>')));
		// A jump ENTERS the slide, so PowerPoint plays its transition; a null here
		// is what made the reporter's morph never run on an on-slide link.
		expect(navigator.currentIndex()).toBe(2);
	});

	it('still advances on a click on inert slide content', () => {
		const { controller, navigator } = harness([actionShape('art')]);
		controller.handleBodyClick(clickOn(render('<div data-element-id="art"></div>')));
		expect(navigator.currentIndex()).toBe(1);
	});

	it('does not advance on a click when the slide sets advClick="0"', () => {
		const { controller, navigator } = harness([actionShape('art')], {
			type: 'cut',
			advanceOnClick: false,
			advanceAfterMs: 10,
		});
		controller.handleBodyClick(clickOn(render('<div data-element-id="art"></div>')));
		expect(navigator.currentIndex()).toBe(0);
	});

	it('leaves an "Action: None" shape to the show’s own click-to-advance', () => {
		const { controller, navigator } = harness([
			actionShape('dead', { action: 'ppaction://noaction', highlightClick: true }),
		]);
		controller.handleBodyClick(clickOn(render('<div data-element-id="dead"></div>')));
		expect(navigator.currentIndex()).toBe(1);
	});
});
