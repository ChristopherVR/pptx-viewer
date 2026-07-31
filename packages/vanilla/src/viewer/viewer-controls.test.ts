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
}): Harness {
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		slides: options.deck,
		presenting: options.presenting ?? true,
		currentSlide: options.startIndex ?? 0,
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
