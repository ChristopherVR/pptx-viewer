import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { RenderController } from './render-controller';
import { createInitialViewerState, createStore } from './state';
import type { ViewerState } from './state';
import { createViewerControls } from './viewer-controls';

/**
 * Slide-show navigation rules: hidden slides are skipped while presenting but
 * remain fully reachable in the editor and by direct jump, and running past the
 * last slide honours File > Options > Advanced > "End with black slide".
 */

function slides(...hidden: boolean[]): PptxSlide[] {
	return hidden.map(
		(isHidden, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				elements: [],
				hidden: isHidden,
			}) as PptxSlide,
	);
}

interface Harness {
	store: ReturnType<typeof createStore<ViewerState>>;
	controls: ReturnType<typeof createViewerControls>;
	ended: () => number;
}

function harness(options: {
	deck: PptxSlide[];
	presenting?: boolean;
	startIndex?: number;
	endWithBlackSlide?: boolean;
	buildsRemaining?: boolean;
	loopContinuously?: boolean;
	/** `p:showPr/p:sldRg`: Set Up Slide Show > "Show slides" > "From"/"To". */
	showSlidesRange?: { from: number; to: number };
}): Harness {
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		slides: options.deck,
		presenting: options.presenting ?? true,
		currentSlide: options.startIndex ?? 0,
		presentationProperties: {
			...createInitialViewerState().presentationProperties,
			loopContinuously: options.loopContinuously,
			...(options.showSlidesRange
				? {
						showSlidesMode: 'range',
						showSlidesFrom: options.showSlidesRange.from,
						showSlidesTo: options.showSlidesRange.to,
					}
				: {}),
		},
	});
	let ended = 0;
	// Only the two members `createViewerControls` reaches for are implemented.
	const renderer = {
		presentationPlayback: {
			advance: () => Boolean(options.buildsRemaining),
			isSeededCompleted: () => false,
			replayCurrentSlide: () => undefined,
		},
		effectiveScale: () => 1,
		fitScale: () => 1,
		zoomPercent: () => 100,
	} as unknown as RenderController;

	const controls = createViewerControls(
		store,
		renderer,
		() => {
			ended += 1;
		},
		options.endWithBlackSlide === undefined ? undefined : () => options.endWithBlackSlide,
	);
	return { store, controls, ended: () => ended };
}

describe('viewerControls hidden slides', () => {
	it('skips a hidden slide advancing forward during a show', () => {
		const { store, controls } = harness({ deck: slides(false, true, false) });
		controls.next();
		expect(store.get().currentSlide).toBe(2);
	});

	it('skips a hidden slide going backward during a show', () => {
		const { store, controls } = harness({ deck: slides(false, true, false), startIndex: 2 });
		controls.prev();
		expect(store.get().currentSlide).toBe(0);
	});

	it('raises the end screen at the last VISIBLE slide', () => {
		const { store, controls } = harness({
			deck: slides(false, false, true, true),
			startIndex: 1,
		});
		controls.next();
		expect(store.get().currentSlide).toBe(1);
		expect(store.get().endOfShow).toBeTruthy();
	});

	it('wraps back to the first slide instead of ending, when "Loop Continuously" is on', () => {
		const { store, controls } = harness({
			deck: slides(false, false, true, true),
			startIndex: 1,
			loopContinuously: true,
		});
		controls.next();
		expect(store.get().currentSlide).toBe(0);
		expect(store.get().endOfShow).toBeFalsy();
	});

	it('lands Home / End on the first / last VISIBLE slide during a show', () => {
		const { store, controls } = harness({
			deck: slides(true, false, false, true),
			startIndex: 1,
		});
		controls.lastSlide();
		expect(store.get().currentSlide).toBe(2);
		controls.firstSlide();
		expect(store.get().currentSlide).toBe(1);
	});

	it('still reaches a hidden slide by direct jump (typed slide number)', () => {
		const { store, controls } = harness({ deck: slides(false, true, false) });
		controls.goToSlide(1);
		expect(store.get().currentSlide).toBe(1);
	});

	it('escapes forward from a hidden slide reached by number', () => {
		const { store, controls } = harness({ deck: slides(false, true, false), startIndex: 1 });
		controls.next();
		expect(store.get().currentSlide).toBe(2);
	});

	it('leaves the EDITOR free to page onto a hidden slide', () => {
		const { store, controls } = harness({ deck: slides(false, true, false), presenting: false });
		controls.next();
		expect(store.get().currentSlide).toBe(1);
		controls.next();
		expect(store.get().currentSlide).toBe(2);
		controls.prev();
		expect(store.get().currentSlide).toBe(1);
	});

	it('leaves editor Home / End on the raw deck bounds', () => {
		const { store, controls } = harness({
			deck: slides(true, false, true),
			presenting: false,
			startIndex: 1,
		});
		controls.lastSlide();
		expect(store.get().currentSlide).toBe(2);
		controls.firstSlide();
		expect(store.get().currentSlide).toBe(0);
	});

	it('presents every slide when the whole deck is hidden', () => {
		const { store, controls } = harness({ deck: slides(true, true) });
		controls.next();
		expect(store.get().currentSlide).toBe(1);
	});

	it('reveals a pending animation build before changing slide', () => {
		const { store, controls } = harness({
			deck: slides(false, true, false),
			buildsRemaining: true,
		});
		controls.next();
		expect(store.get().currentSlide).toBe(0);
	});
});

describe('viewerControls end of show', () => {
	it('raises the black end screen by default', () => {
		const { store, controls, ended } = harness({ deck: slides(false) });
		controls.next();
		expect(store.get().endOfShow).toBeTruthy();
		expect(ended()).toBe(0);
	});

	it('exits the show outright when the option is off', () => {
		const { store, controls, ended } = harness({ deck: slides(false), endWithBlackSlide: false });
		controls.next();
		expect(store.get().endOfShow).toBeFalsy();
		expect(ended()).toBe(1);
	});

	it('exits on a second forward press from the end screen', () => {
		const { store, controls, ended } = harness({ deck: slides(false) });
		controls.next();
		controls.next();
		expect(store.get().endOfShow).toBeFalsy();
		expect(ended()).toBe(1);
	});

	it('dismisses the end screen on a backward press without exiting', () => {
		const { store, controls, ended } = harness({ deck: slides(false) });
		controls.next();
		controls.prev();
		expect(store.get().endOfShow).toBeFalsy();
		expect(ended()).toBe(0);
	});
});

describe('viewerControls authored slide range (p:showPr/p:sldRg)', () => {
	it('confines forward navigation to the authored range', () => {
		const { store, controls } = harness({
			deck: slides(false, false, false, false),
			startIndex: 1,
			// 1-based: slides 2..3 (0-based indexes 1..2).
			showSlidesRange: { from: 2, to: 3 },
		});
		controls.next();
		expect(store.get().currentSlide).toBe(2);
		controls.next();
		expect(store.get().endOfShow).toBeTruthy();
	});

	it('"Present From Beginning" lands on the range start, not deck index 0', () => {
		const { controls } = harness({
			deck: slides(false, false, false, false),
			showSlidesRange: { from: 2, to: 3 },
		});
		expect(controls.firstShowSlideIndex()).toBe(1);
	});

	it('firstShowSlideIndex skips a hidden slide 1 with no range authored', () => {
		const { controls } = harness({ deck: slides(true, false, false) });
		expect(controls.firstShowSlideIndex()).toBe(1);
	});

	it('a hidden slide inside the range is still skipped', () => {
		const { store, controls } = harness({
			deck: slides(false, true, false, false),
			startIndex: 0,
			// 1-based: slides 1..3, but slide 2 (index 1) is hidden.
			showSlidesRange: { from: 1, to: 3 },
		});
		controls.next();
		expect(store.get().currentSlide).toBe(2);
	});
});

describe('viewerControls presentationEntryIndex (entering a show "from current slide")', () => {
	it('stays on the active slide when the show includes it', () => {
		const { controls } = harness({
			deck: slides(false, false, false, false),
			presenting: false,
			startIndex: 2,
			showSlidesRange: { from: 2, to: 3 },
		});
		expect(controls.presentationEntryIndex()).toBe(2);
	});

	it('lands on the nearest show slide when the active slide is outside the range', () => {
		const { controls } = harness({
			deck: slides(false, false, false, false),
			presenting: false,
			startIndex: 0,
			// 1-based: slides 2..3.
			showSlidesRange: { from: 2, to: 3 },
		});
		expect(controls.presentationEntryIndex()).toBe(1);
	});

	it('falls back to the show start when the active slide is past the range', () => {
		const { controls } = harness({
			deck: slides(false, false, false, false),
			presenting: false,
			startIndex: 3,
			// 1-based: slides 1..2.
			showSlidesRange: { from: 1, to: 2 },
		});
		expect(controls.presentationEntryIndex()).toBe(0);
	});
});
