/**
 * viewer-presentation-mode.service.test.ts: which slide a show opens on
 * (issue: wave-4 B1, "the show opens on a slide the show includes").
 *
 * Every way of entering the show funnels through
 * `ViewerPresentationModeService.present()` / `.presentFromBeginning()`, which
 * in turn read `ViewerCustomShowsService.showEntryIndex()` /
 * `.showFirstIndex()` (covered in depth by `custom-shows-deck.test.ts`). This
 * file pins the SERVICE-LEVEL wiring: `present()` opens on the active slide
 * when the show includes it (or the closest show slide onward), and
 * `presentFromBeginning()` always opens the show's own first slide, using the
 * authored `p:showPr/p:sldRg` range the host hands it through `bind()`.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { AuthoredSlideRange } from '../internal/shared';
import { LoadContentService } from './load-content.service';
import { PresenterWindowService } from './presenter-window.service';
import { ViewerCustomShowsService } from './viewer-custom-shows.service';
import { ViewerPresentationModeService } from './viewer-presentation-mode.service';

function slide(n: number): PptxSlide {
	return {
		id: `ppt/slides/slide${n}.xml`,
		rId: `rId${n + 1}`,
		slideNumber: n,
		elements: [],
	} as PptxSlide;
}

const DECK: PptxSlide[] = [slide(1), slide(2), slide(3), slide(4)];

/** A minimal host: tracks the active slide index the service sets. */
function harness(
	initialActiveIndex: number,
	authoredRange: AuthoredSlideRange | null,
): {
	presentationMode: ViewerPresentationModeService;
	activeSlideIndex: () => number;
} {
	const injector = Injector.create({
		providers: [
			{ provide: LoadContentService, useClass: LoadContentService },
			{ provide: PresenterWindowService, useClass: PresenterWindowService },
			{ provide: ViewerCustomShowsService, useClass: ViewerCustomShowsService },
			{ provide: ViewerPresentationModeService, useClass: ViewerPresentationModeService },
		],
	});
	const loader = runInInjectionContext(injector, () => injector.get(LoadContentService));
	const customShows = runInInjectionContext(injector, () => injector.get(ViewerCustomShowsService));
	const presentationMode = runInInjectionContext(injector, () =>
		injector.get(ViewerPresentationModeService),
	);

	let activeIndex = initialActiveIndex;
	customShows.bind({ activeSlideIndex: () => activeIndex, liveSlides: () => DECK });
	presentationMode.bind({
		slideCount: () => loader.slides().length || DECK.length,
		activeSlideIndex: () => activeIndex,
		setActiveSlideIndex: (index) => {
			activeIndex = index;
		},
		clearEditing: () => undefined,
		clearSelection: () => undefined,
		sourceContent: () => null,
		canEdit: () => true,
		authoredRange: () => authoredRange,
		promptKeepAnnotations: () => undefined,
		applyRehearsalTimings: () => undefined,
	});
	loader.slides.set(DECK);

	return { presentationMode, activeSlideIndex: () => activeIndex };
}

describe('viewerPresentationModeService entry index (no custom show)', () => {
	it('present() keeps the active slide when the authored range includes it', () => {
		const { presentationMode, activeSlideIndex } = harness(2, { fromIndex: 1, toIndex: 3 });
		presentationMode.present();
		expect(activeSlideIndex()).toBe(2);
	});

	it('present() jumps to the range start when the active slide is outside the authored range', () => {
		const { presentationMode, activeSlideIndex } = harness(0, { fromIndex: 1, toIndex: 2 });
		presentationMode.present();
		expect(activeSlideIndex()).toBe(1);
	});

	it("presentFromBeginning() always opens the range's own first slide", () => {
		const { presentationMode, activeSlideIndex } = harness(3, { fromIndex: 1, toIndex: 2 });
		presentationMode.presentFromBeginning();
		expect(activeSlideIndex()).toBe(1);
	});

	it('presentFromBeginning() opens deck index 0 with no authored range', () => {
		const { presentationMode, activeSlideIndex } = harness(2, null);
		presentationMode.presentFromBeginning();
		expect(activeSlideIndex()).toBe(0);
	});

	it('present() flips presenting on', () => {
		const { presentationMode } = harness(0, null);
		expect(presentationMode.presenting()).toBeFalsy();
		presentationMode.present();
		expect(presentationMode.presenting()).toBeTruthy();
	});
});
