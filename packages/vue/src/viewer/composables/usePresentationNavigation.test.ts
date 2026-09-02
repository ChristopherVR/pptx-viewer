// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { UseAnimationPlaybackResult } from './useAnimationPlayback';
import { usePresentationNavigation } from './usePresentationNavigation';
import { usePresentationShowOrder } from './usePresentationShowOrder';

function slide(id: string, overrides: Partial<PptxSlide> = {}): PptxSlide {
	return { id, elements: [], ...overrides } as PptxSlide;
}

/** A playback stub whose builds are always already exhausted, so `next()` always falls through to slide navigation. */
function fakePlayback(): UseAnimationPlaybackResult {
	return {
		presentationElementStates: ref(new Map()),
		presentationKeyframesCss: ref(''),
		interactiveTriggerShapeIds: ref(new Set()),
		hoverTriggerShapeIds: ref(new Set()),
		isComplete: ref(true),
		seededCompleted: ref(false),
		markNextEntryCompleted: vi.fn(),
		advance: () => false,
		reset: vi.fn(),
		handleInteractiveShapeClick: () => false,
		handleHoverStart: () => false,
		handleHoverEnd: vi.fn(),
		clearTimers: vi.fn(),
	};
}

function setup(opts: {
	slides: PptxSlide[];
	loopContinuously?: boolean;
	endWithBlackSlide?: boolean;
	startIndex?: number;
	onShowEnd?: () => boolean;
}) {
	const playback = fakePlayback();
	const showOrder = usePresentationShowOrder({ slides: () => opts.slides });
	const requestClose = vi.fn();
	const onSlideChange = vi.fn();
	const nav = usePresentationNavigation({
		slides: () => opts.slides,
		startIndex: () => opts.startIndex ?? 0,
		playback: () => playback,
		showOrder,
		endWithBlackSlide: () => opts.endWithBlackSlide ?? true,
		loopContinuously: () => Boolean(opts.loopContinuously),
		requestClose,
		onSlideChange,
		onShowEnd: opts.onShowEnd,
	});
	return { nav, requestClose, onSlideChange };
}

describe('usePresentationNavigation - onShowEnd (returning custom-show sub-show)', () => {
	it('outranks loop continuously, the black end screen, and requestClose', () => {
		const onShowEnd = vi.fn().mockReturnValue(true);
		const { nav, requestClose } = setup({
			slides: [slide('a'), slide('b')],
			startIndex: 1,
			loopContinuously: true,
			onShowEnd,
		});
		nav.next();
		expect(onShowEnd).toHaveBeenCalledOnce();
		// onShowEnd already navigated (e.g. back to the origin slide of a
		// `&return=true` custom show); next() must not also loop, black-screen,
		// or close on top of that.
		expect(nav.showEndScreen.value).toBeFalsy();
		expect(requestClose).not.toHaveBeenCalled();
	});

	it('falls through to the normal end-of-show handling when it returns false', () => {
		const onShowEnd = vi.fn().mockReturnValue(false);
		const { nav } = setup({
			slides: [slide('a'), slide('b')],
			startIndex: 1,
			endWithBlackSlide: true,
			onShowEnd,
		});
		nav.next();
		expect(onShowEnd).toHaveBeenCalledOnce();
		expect(nav.showEndScreen.value).toBeTruthy();
	});
});

describe('usePresentationNavigation - loop continuously', () => {
	it('wraps to the first show slide past the last one when loopContinuously is true', () => {
		const { nav, requestClose } = setup({
			slides: [slide('a'), slide('b'), slide('c')],
			startIndex: 2,
			loopContinuously: true,
		});
		expect(nav.currentIndex.value).toBe(2);
		nav.next();
		expect(nav.currentIndex.value).toBe(0);
		expect(nav.showEndScreen.value).toBeFalsy();
		expect(requestClose).not.toHaveBeenCalled();
	});

	it('skips hidden slides when wrapping (loop honours the show order)', () => {
		const { nav } = setup({
			slides: [slide('a'), slide('b', { hidden: true }), slide('c')],
			startIndex: 2,
			loopContinuously: true,
		});
		nav.next();
		expect(nav.currentIndex.value).toBe(0); // 'a': 'b' is hidden and skipped
	});

	it('raises the black end screen past the last slide when loopContinuously is false', () => {
		const { nav, requestClose } = setup({
			slides: [slide('a'), slide('b')],
			startIndex: 1,
			loopContinuously: false,
			endWithBlackSlide: true,
		});
		nav.next();
		expect(nav.currentIndex.value).toBe(1); // stayed put
		expect(nav.showEndScreen.value).toBeTruthy();
		expect(requestClose).not.toHaveBeenCalled();
	});

	it('takes loop over the black end screen when both would otherwise apply', () => {
		const { nav } = setup({
			slides: [slide('a'), slide('b')],
			startIndex: 1,
			loopContinuously: true,
			endWithBlackSlide: true,
		});
		nav.next();
		expect(nav.currentIndex.value).toBe(0);
		expect(nav.showEndScreen.value).toBeFalsy();
	});

	it('is a no-op loop of one when the show has a single slide', () => {
		const { nav, onSlideChange } = setup({
			slides: [slide('a')],
			startIndex: 0,
			loopContinuously: true,
		});
		nav.next();
		expect(nav.currentIndex.value).toBe(0);
		// `goTo` short-circuits when the target equals the current index, so no
		// redundant slide-change notification fires for a single-slide loop.
		expect(onSlideChange).not.toHaveBeenCalled();
	});

	it('exits the show past the last slide when neither loop nor the black screen is enabled', () => {
		const { nav, requestClose } = setup({
			slides: [slide('a'), slide('b')],
			startIndex: 1,
			loopContinuously: false,
			endWithBlackSlide: false,
		});
		nav.next();
		expect(requestClose).toHaveBeenCalledOnce();
		expect(nav.showEndScreen.value).toBeFalsy();
	});
});

describe('usePresentationNavigation transition direction', () => {
	it('plays the entering slide transition on a forward step', async () => {
		const { nav } = setup({
			slides: [slide('s1'), slide('s2', { transition: { type: 'morph', durationMs: 500 } })],
		});
		nav.goTo(1);
		await vi.waitFor(() => expect(nav.transitionState.value?.transition.type).toBe('morph'));
		expect(nav.transitionState.value?.outgoing?.id).toBe('s1');
		expect(nav.transitionState.value?.incoming?.id).toBe('s2');
	});

	it('replays the leaving slide transition on a backward step', async () => {
		const { nav } = setup({
			slides: [slide('s1'), slide('s2', { transition: { type: 'morph', durationMs: 500 } })],
		});
		nav.goTo(1);
		await vi.waitFor(() => expect(nav.transitionState.value?.transition.type).toBe('morph'));
		nav.goTo(0);
		await vi.waitFor(() => expect(nav.transitionState.value?.outgoing?.id).toBe('s2'));
		expect(nav.transitionState.value?.incoming?.id).toBe('s1');
	});
});
