import type { PptxAction, PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { PresentationController } from './presentation-controller.svelte';

/**
 * Wave-4 B7: the six show-runner callbacks (`lastViewed`, `customShow`,
 * `openFile`, `openPresentation`, `playMedia`, `oleVerb`) wired into
 * `handleStageClick`'s `PresentationActionRunner`. `.svelte.test.ts` so the
 * controller's `$state` fields compile.
 */

function slide(id: string, extra: Partial<PptxSlide> = {}): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [], ...extra } as PptxSlide;
}

function actionElement(id: string, action: PptxAction) {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		actionClick: action,
	} as unknown as PptxSlide['elements'][number];
}

/** A DOM node carrying `data-element-id`, the way the rendered stage does. */
function clickTargetFor(elementId: string): HTMLElement {
	const node = document.createElement('div');
	node.setAttribute('data-element-id', elementId);
	document.body.appendChild(node);
	return node;
}

class Deck {
	slides = $state<PptxSlide[]>([]);
	index = $state(0);
}

describe('presentationController action runner: customShow', () => {
	it('customShow with returnAfter returns to the origin slide when the sub-show ends', () => {
		const deck = new Deck();
		const customShows: PptxCustomShow[] = [{ id: '1', name: 'Sub show', slideRIds: ['rId-s3'] }];
		deck.slides = [
			slide('s1', {
				elements: [actionElement('e1', { action: 'ppaction://customshow?id=1&return=true' })],
			}),
			slide('s2'),
			slide('s3'),
		];
		deck.index = 0;
		const navigate = vi.fn((i: number) => {
			deck.index = i;
		});
		let activeShowId: string | null = null;
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
			getCustomShows: () => customShows,
			getActiveCustomShowId: () => activeShowId,
			setActiveCustomShowId: (id) => {
				activeShowId = id;
			},
			getActiveCustomShow: () =>
				activeShowId ? (customShows.find((s) => s.id === activeShowId) ?? null) : null,
		});
		controller.start();

		// Click the action shape on slide 1: jumps into the sub-show (slide 3,
		// the sub-show's only member) and remembers slide 1 as the origin.
		controller.handleStageClick(clickTargetFor('e1'));
		expect(activeShowId).toBe('1');
		expect(deck.index).toBe(2);

		// The sub-show has one slide; advancing off its end restores the whole
		// deck and returns to the origin slide instead of raising the end screen.
		controller.advance();
		expect(activeShowId).toBeNull();
		expect(deck.index).toBe(0);
		expect(controller.endOfShowVisible).toBeFalsy();
	});

	it('lastViewed jumps back to the slide the audience was on before the current one', () => {
		const deck = new Deck();
		deck.slides = [slide('s1'), slide('s2'), slide('s3')];
		deck.index = 0;
		const navigate = vi.fn((i: number) => {
			deck.index = i;
		});
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
		});
		controller.start();
		controller.onSlideChange(0, 1);
		deck.index = 1;
		controller.onSlideChange(1, 2);
		deck.index = 2;

		deck.slides = [
			slide('s1'),
			slide('s2'),
			slide('s3', {
				elements: [
					actionElement('e1', { action: 'ppaction://hlinkshowjump?jump=lastslideviewed' }),
				],
			}),
		];
		controller.handleStageClick(clickTargetFor('e1'));
		expect(deck.index).toBe(1);
	});
});

describe('presentationController action runner: openFile / openPresentation', () => {
	it('does nothing for a javascript: target', () => {
		const deck = new Deck();
		// Built rather than written as a literal so the linter's `no-script-url`
		// rule (which exists to stop code from EXECUTING one) does not fire on a
		// string this test only ever hands to the safety check as data.
		const unsafeTarget = ['java', 'script:alert(1)'].join('');
		deck.slides = [
			slide('s1', {
				elements: [actionElement('e1', { action: 'ppaction://hlinkfile', url: unsafeTarget })],
			}),
		];
		const navigate = vi.fn();
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
		});
		controller.start();
		controller.handleStageClick(clickTargetFor('e1'));
		expect(openSpy).not.toHaveBeenCalled();
		openSpy.mockRestore();
	});
});
