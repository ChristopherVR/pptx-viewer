// @vitest-environment jsdom
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	findMediaBookmarkGatedSteps,
	isBookmarkGated,
	resolveMediaBookmarkTimesMs,
	wireMediaBookmarkSteps,
} from './animation-media-bookmark-gating';
import type { PlaybackContext } from './animation-playback-engine';
import type {
	ElementAnimationState,
	TimelineClickGroup,
	TimelineStep,
} from './animation-timeline-types';

function makeStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
	return {
		elementId: 'el1',
		cssAnimation: 'pptx-fadeIn 500ms ease 0ms 1 normal both',
		keyframeName: 'pptx-fadeIn',
		trigger: 'afterPrevious',
		delayMs: 0,
		durationMs: 500,
		fillMode: 'both',
		presetClass: 'entr',
		...overrides,
	};
}

describe('resolveMediaBookmarkTimesMs', () => {
	it('maps a media element id to its bookmark name -> time(ms) lookup', () => {
		const elements: PptxElement[] = [
			{
				id: 'video-1',
				type: 'media',
				bookmarks: [
					{ id: 'bmk-1', label: 'Chapter 2', time: 5.5 },
					{ id: 'bmk-2', label: 'Chapter 3', time: 12 },
				],
			} as unknown as PptxElement,
		];
		const map = resolveMediaBookmarkTimesMs(elements);
		expect(map.get('video-1')?.get('Chapter 2')).toBe(5500);
		expect(map.get('video-1')?.get('Chapter 3')).toBe(12000);
	});

	it('skips a media element with no bookmarks', () => {
		const elements: PptxElement[] = [{ id: 'video-1', type: 'media' } as unknown as PptxElement];
		expect(resolveMediaBookmarkTimesMs(elements).size).toBe(0);
	});

	it('skips a non-media element', () => {
		const elements: PptxElement[] = [{ id: 'shape-1', type: 'shape' } as unknown as PptxElement];
		expect(resolveMediaBookmarkTimesMs(elements).size).toBe(0);
	});

	it('descends into group children (flattenSlideElements)', () => {
		const elements: PptxElement[] = [
			{
				id: 'group-1',
				type: 'group',
				children: [
					{
						id: 'video-1',
						type: 'media',
						bookmarks: [{ id: 'bmk-1', label: 'Intro', time: 1 }],
					},
				],
			} as unknown as PptxElement,
		];
		expect(resolveMediaBookmarkTimesMs(elements).get('video-1')?.get('Intro')).toBe(1000);
	});

	it('returns an empty map for undefined elements', () => {
		expect(resolveMediaBookmarkTimesMs(undefined).size).toBe(0);
	});
});

describe('isBookmarkGated', () => {
	it('is true for a step depending on a specific media bookmark', () => {
		expect(
			isBookmarkGated(
				makeStep({
					dependsOnEvent: 'onMediaBookmark',
					dependsOnShapeId: 'video-1',
					dependsOnBookmarkName: 'Chapter 2',
				}),
			),
		).toBeTruthy();
	});

	it('is false with only a shape id and no bookmark name', () => {
		expect(
			isBookmarkGated(makeStep({ dependsOnEvent: 'onMediaBookmark', dependsOnShapeId: 'video-1' })),
		).toBeFalsy();
	});

	it('is false for a different dependsOnEvent', () => {
		expect(
			isBookmarkGated(
				makeStep({
					dependsOnEvent: 'onStopAudio',
					dependsOnShapeId: 'video-1',
					dependsOnBookmarkName: 'Chapter 2',
				}),
			),
		).toBeFalsy();
	});

	it('is false with no dependency at all', () => {
		expect(isBookmarkGated(makeStep())).toBeFalsy();
	});
});

describe('findMediaBookmarkGatedSteps', () => {
	it('returns only bookmark-gated steps', () => {
		const gated = makeStep({
			elementId: 'a',
			dependsOnEvent: 'onMediaBookmark',
			dependsOnShapeId: 'video-1',
			dependsOnBookmarkName: 'Chapter 2',
		});
		const plain = makeStep({ elementId: 'b' });
		const group: TimelineClickGroup = { steps: [gated, plain], totalDurationMs: 0 };
		expect(findMediaBookmarkGatedSteps(group)).toStrictEqual([gated]);
	});

	it('returns an empty array for a null/undefined group', () => {
		expect(findMediaBookmarkGatedSteps(null)).toStrictEqual([]);
		expect(findMediaBookmarkGatedSteps(undefined)).toStrictEqual([]);
	});
});

function makeContext(overrides: Partial<PlaybackContext> = {}): {
	ctx: PlaybackContext;
	latest: () => Map<string, ElementAnimationState>;
} {
	let latest = new Map<string, ElementAnimationState>();
	const ctx: PlaybackContext = {
		setStates: (updater) => {
			latest = updater(latest);
		},
		timers: [],
		buildHandle: { current: null },
		playSound: vi.fn(),
		stopSound: vi.fn(),
		...overrides,
	};
	return { ctx, latest: () => latest };
}

describe('wireMediaBookmarkSteps', () => {
	let video: HTMLVideoElement;

	beforeEach(() => {
		vi.useFakeTimers();
		video = document.createElement('video');
		video.dataset['elementId'] = 'video-1';
		document.body.appendChild(video);
	});

	afterEach(() => {
		vi.useRealTimers();
		video.remove();
	});

	it('fires the gated step once playback crosses the bookmark time', () => {
		const gated = makeStep({
			elementId: 'a',
			dependsOnEvent: 'onMediaBookmark',
			dependsOnShapeId: 'video-1',
			dependsOnBookmarkName: 'Chapter 2',
		});
		const group: TimelineClickGroup = { steps: [gated], totalDurationMs: 0 };
		const { ctx, latest } = makeContext({
			mediaBookmarkTimesMs: new Map([['video-1', new Map([['Chapter 2', 5000]])]]),
			frameRoot: () => document.body,
		});

		wireMediaBookmarkSteps(group, ctx);

		// Before the bookmark: no effect yet.
		Object.defineProperty(video, 'currentTime', { value: 4, configurable: true });
		video.dispatchEvent(new Event('timeupdate'));
		expect(latest().get('a')).toBeUndefined();

		// Crossing the bookmark: the gated step applies.
		Object.defineProperty(video, 'currentTime', { value: 5.2, configurable: true });
		video.dispatchEvent(new Event('timeupdate'));
		expect(latest().get('a')?.visible).toBeTruthy();
		expect(latest().get('a')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 normal both');
	});

	it('fires only once even if timeupdate keeps firing past the bookmark', () => {
		const gated = makeStep({
			elementId: 'a',
			dependsOnEvent: 'onMediaBookmark',
			dependsOnShapeId: 'video-1',
			dependsOnBookmarkName: 'Chapter 2',
		});
		const group: TimelineClickGroup = { steps: [gated], totalDurationMs: 0 };
		const { ctx } = makeContext({
			mediaBookmarkTimesMs: new Map([['video-1', new Map([['Chapter 2', 5000]])]]),
			frameRoot: () => document.body,
		});
		const setStatesSpy = vi.spyOn(ctx, 'setStates');

		wireMediaBookmarkSteps(group, ctx);

		Object.defineProperty(video, 'currentTime', { value: 6, configurable: true });
		video.dispatchEvent(new Event('timeupdate'));
		video.dispatchEvent(new Event('timeupdate'));
		video.dispatchEvent(new Event('timeupdate'));

		expect(setStatesSpy).toHaveBeenCalledOnce();
	});

	it('does nothing when mediaBookmarkTimesMs has no entry for the bookmark', () => {
		const gated = makeStep({
			elementId: 'a',
			dependsOnEvent: 'onMediaBookmark',
			dependsOnShapeId: 'video-1',
			dependsOnBookmarkName: 'Unknown Bookmark',
		});
		const group: TimelineClickGroup = { steps: [gated], totalDurationMs: 0 };
		const { ctx, latest } = makeContext({
			mediaBookmarkTimesMs: new Map([['video-1', new Map([['Chapter 2', 5000]])]]),
			frameRoot: () => document.body,
		});

		wireMediaBookmarkSteps(group, ctx);
		Object.defineProperty(video, 'currentTime', { value: 100, configurable: true });
		video.dispatchEvent(new Event('timeupdate'));
		expect(latest().get('a')).toBeUndefined();
	});

	it('does nothing for a non-bookmark-gated step', () => {
		const plain = makeStep({ elementId: 'a' });
		const group: TimelineClickGroup = { steps: [plain], totalDurationMs: 0 };
		const { ctx } = makeContext({ frameRoot: () => document.body });
		expect(() => wireMediaBookmarkSteps(group, ctx)).not.toThrow();
	});
});
