/**
 * presentation-custom-show-advance.test.ts: a running custom show must actually
 * ADVANCE on Angular.
 *
 * `e2e/custom-shows.spec.ts` passed on react, vue, vanilla and svelte and failed
 * on angular alone: the show never left slide 1, on any input. The navigator was
 * innocent (`presentation-custom-show-order.test.ts` already proves it steps the
 * show correctly); the defect was the loop the navigator sits inside.
 *
 * `PresentationOverlayComponent.startIndex` is a LIVE input, not a constructor
 * argument: an effect re-adopts it whenever it changes, and an audience display
 * mirrors the presenter through it. With no custom show running, the host fed it
 * `activeSlideIndex`, which the overlay's own `indexChange` keeps up to date, so
 * pushing it back was always a no-op. With a custom show running, the host fed
 * it the show's FIRST slide - a value that never changes - so every advance was
 * immediately re-adopted back to the start of the show.
 *
 * This test models that loop exactly: the navigator's `emitIndex` updates the
 * host's active slide, and the host then pushes `presentationStartIndex` back
 * in, which is what the overlay's effect does. Against the previous build the
 * first `next` lands on slide 1 again.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';
import { PresentationShowNavigator } from './presentation-show-navigator';
import type { ShowNavigatorDeps } from './presentation-show-navigator';
import { ViewerCustomShowsService } from './viewer-custom-shows.service';

function slide(n: number): PptxSlide {
	return {
		id: `ppt/slides/slide${n}.xml`,
		rId: `rId${n + 1}`,
		slideNumber: n,
		elements: [],
	} as PptxSlide;
}

/** Alpha / Beta / Gamma, matching the e2e fixture's three slides. */
const DECK: PptxSlide[] = [slide(1), slide(2), slide(3)];

/** "Short Show" is slides 1 and 3, so forward from slide 1 must skip slide 2. */
const SHORT_SHOW: PptxCustomShow[] = [{ id: '0', name: 'Short Show', slideRIds: ['rId2', 'rId4'] }];

/**
 * The viewer's presentation loop: the custom-shows service, a navigator, and
 * the host feedback the overlay's `startIndex` effect performs.
 */
function presentationLoop(activeShowId: string | null): {
	navigator: PresentationShowNavigator;
	shows: ViewerCustomShowsService;
	activeSlideIndex: () => number;
	present: () => void;
} {
	const loaderInjector = Injector.create({
		providers: [{ provide: LoadContentService, useClass: LoadContentService }],
	});
	const loader = runInInjectionContext(loaderInjector, () =>
		loaderInjector.get(LoadContentService),
	);
	loader.customShows.set(SHORT_SHOW);

	const injector = Injector.create({
		providers: [
			{ provide: LoadContentService, useValue: loader },
			{ provide: ViewerCustomShowsService, useClass: ViewerCustomShowsService },
		],
	});
	const shows = runInInjectionContext(injector, () => injector.get(ViewerCustomShowsService));

	// A real signal, as the viewer component binds: `presentationStartIndex` is a
	// computed over it, and a plain variable would leave it permanently cached.
	const activeSlideIndex = signal(0);
	shows.bind({ activeSlideIndex: () => activeSlideIndex(), liveSlides: () => DECK });
	shows.activeId.set(activeShowId);

	const playback = {
		advance: () => false,
		isSeededCompleted: () => false,
		setSlide: () => undefined,
	} as unknown as ShowNavigatorDeps['playback'];
	const annotations = {
		setActiveSlide: () => undefined,
	} as unknown as ShowNavigatorDeps['annotations'];

	const navigator: PresentationShowNavigator = new PresentationShowNavigator({
		slides: () => shows.presentationSlides(),
		activeCustomShow: () => shows.activeCustomShow(),
		currentSlide: () => DECK[navigator.currentIndex()],
		showWithAnimation: () => false,
		playback,
		annotations,
		emitIndex: (index) => {
			activeSlideIndex.set(index);
			// The overlay's `startIndex` effect, which re-runs on every change.
			navigator.syncFromHost(shows.presentationStartIndex());
		},
		requestClose: () => undefined,
	});

	return {
		navigator,
		shows,
		activeSlideIndex: () => activeSlideIndex(),
		// `ViewerPresentationModeService.present()`, reduced to the two steps that
		// matter here: seed the entry slide, then mount the overlay on it.
		present: () => {
			activeSlideIndex.set(shows.showEntryIndex());
			navigator.currentIndex.set(shows.presentationStartIndex());
		},
	};
}

describe('a running custom show advances on Angular', () => {
	it('steps to the next slide of the show instead of snapping back to its first', () => {
		const loop = presentationLoop('0');
		loop.present();
		expect(loop.navigator.currentIndex()).toBe(0);

		loop.navigator.navigate('next');

		// Deck index 2 is Gamma: "Short Show" skips Beta. Against the previous
		// build this was 0, because `presentationStartIndex` was pinned to the
		// show's first slide and pushed straight back over the advance.
		expect(loop.navigator.currentIndex()).toBe(2);
		expect(loop.activeSlideIndex()).toBe(2);
	});

	it('never visits a slide outside the show membership', () => {
		const loop = presentationLoop('0');
		loop.present();
		const seen = [loop.navigator.currentIndex()];
		for (let step = 0; step < 3; step += 1) {
			loop.navigator.navigate('next');
			seen.push(loop.navigator.currentIndex());
		}
		expect(seen).not.toContain(1);
		expect(seen).toContain(0);
		expect(seen).toContain(2);
	});

	it('still advances slide by slide with no show active', () => {
		const loop = presentationLoop(null);
		loop.present();
		loop.navigator.navigate('next');
		expect(loop.navigator.currentIndex()).toBe(1);
	});

	it('opens a custom show on the show first slide, not on the editor active slide', () => {
		const loop = presentationLoop('0');
		// The editor is sitting on Beta, which the show does not include.
		loop.navigator.currentIndex.set(1);
		expect(loop.shows.showEntryIndex()).toBe(0);
	});

	it('lets startIndex follow the show, so an audience display can mirror it', () => {
		const loop = presentationLoop('0');
		loop.present();
		loop.navigator.navigate('next');
		// Pinned at 0 before the fix, which is also why a mirrored display could
		// never leave the first slide of a custom show.
		expect(loop.shows.presentationStartIndex()).toBe(2);
	});
});
