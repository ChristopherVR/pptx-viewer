// @vitest-environment jsdom
/**
 * `applyMediaEndedStep` uses `window.setTimeout`, matching
 * `animation-playback-engine.test.ts`'s environment for the same reason.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	applyMediaEndedStep,
	findMediaEndGatedSteps,
	isMediaEndGated,
	zeroDelayCssAnimation,
} from './animation-media-end-gating';
import type { PlaybackContext } from './animation-playback-engine';
import type {
	ElementAnimationState,
	TimelineClickGroup,
	TimelineStep,
} from './animation-timeline-types';

function makeStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
	return {
		elementId: 'el1',
		cssAnimation: 'pptx-fadeIn 500ms ease 3500ms 1 normal both',
		keyframeName: 'pptx-fadeIn',
		trigger: 'afterPrevious',
		delayMs: 3500,
		durationMs: 500,
		fillMode: 'both',
		presetClass: 'entr',
		...overrides,
	};
}

describe('isMediaEndGated', () => {
	it('is true for a step depending on a specific onStopAudio time node', () => {
		expect(
			isMediaEndGated(makeStep({ dependsOnEvent: 'onStopAudio', dependsOnTimeNodeId: 1 })),
		).toBeTruthy();
	});

	it('is false for a plain afterPrevious/onEnd dependency', () => {
		expect(
			isMediaEndGated(makeStep({ dependsOnEvent: 'onEnd', dependsOnTimeNodeId: 1 })),
		).toBeFalsy();
	});

	it('is false with no dependency at all', () => {
		expect(isMediaEndGated(makeStep())).toBeFalsy();
	});

	it('is false for onStopAudio with no specific target node', () => {
		expect(isMediaEndGated(makeStep({ dependsOnEvent: 'onStopAudio' }))).toBeFalsy();
	});
});

describe('findMediaEndGatedSteps', () => {
	it('returns only steps gated on the given media node id', () => {
		const gated = makeStep({
			elementId: 'el1',
			dependsOnEvent: 'onStopAudio',
			dependsOnTimeNodeId: 7,
		});
		const otherNode = makeStep({
			elementId: 'el2',
			dependsOnEvent: 'onStopAudio',
			dependsOnTimeNodeId: 8,
		});
		const plain = makeStep({ elementId: 'el3' });
		const group: TimelineClickGroup = { steps: [gated, otherNode, plain], totalDurationMs: 0 };
		expect(findMediaEndGatedSteps(group, 7)).toStrictEqual([gated]);
	});

	it('returns an empty array for a null/undefined group', () => {
		expect(findMediaEndGatedSteps(null, 1)).toStrictEqual([]);
		expect(findMediaEndGatedSteps(undefined, 1)).toStrictEqual([]);
	});
});

describe('zeroDelayCssAnimation', () => {
	it('rewrites the delay token (index 3) to 0ms', () => {
		expect(zeroDelayCssAnimation('pptx-fadeIn 500ms ease 3500ms 1 normal both')).toBe(
			'pptx-fadeIn 500ms ease 0ms 1 normal both',
		);
	});

	it('rewrites BOTH segments of a parallel-composed (comma-joined) animation', () => {
		const composed =
			'pptx-tl-color-1 400ms ease 2000ms 1 normal both, pptx-tl-motion-1 400ms ease 2000ms 1 normal both';
		expect(zeroDelayCssAnimation(composed)).toBe(
			'pptx-tl-color-1 400ms ease 0ms 1 normal both, pptx-tl-motion-1 400ms ease 0ms 1 normal both',
		);
	});

	it('leaves a malformed / unexpected-shape string unchanged', () => {
		expect(zeroDelayCssAnimation('not-a-valid-shorthand')).toBe('not-a-valid-shorthand');
	});

	it('leaves an empty string unchanged (command steps carry no animation)', () => {
		expect(zeroDelayCssAnimation('')).toBe('');
	});
});

function makeContext(): { ctx: PlaybackContext; latest: () => Map<string, ElementAnimationState> } {
	let latest = new Map<string, ElementAnimationState>();
	const ctx: PlaybackContext = {
		setStates: (updater) => {
			latest = updater(latest);
		},
		timers: [],
		buildHandle: { current: null },
		playSound: vi.fn(),
		stopSound: vi.fn(),
	};
	return { ctx, latest: () => latest };
}

describe('applyMediaEndedStep', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('applies the step immediately with its delay zeroed, not the estimated delay', () => {
		const { ctx, latest } = makeContext();
		const gated = makeStep({
			elementId: 'a',
			cssAnimation: 'pptx-fadeIn 500ms ease 3500ms 1 normal both',
			dependsOnEvent: 'onStopAudio',
			dependsOnTimeNodeId: 1,
		});
		applyMediaEndedStep(gated, ctx);
		expect(latest().get('a')?.visible).toBeTruthy();
		expect(latest().get('a')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 normal both');
	});

	it('schedules cleanup from durationMs (real start = now), not delayMs + durationMs', () => {
		const { ctx, latest } = makeContext();
		const gated = makeStep({ elementId: 'a', durationMs: 200, holdEndState: false });
		applyMediaEndedStep(gated, ctx);

		vi.advanceTimersByTime(199);
		expect(latest().get('a')?.cssAnimation).toBeDefined();

		vi.advanceTimersByTime(20);
		expect(latest().get('a')?.cssAnimation).toBeUndefined();
	});

	it('keeps an exit step hidden after cleanup', () => {
		const { ctx, latest } = makeContext();
		const gated = makeStep({ elementId: 'a', presetClass: 'exit', durationMs: 100 });
		applyMediaEndedStep(gated, ctx);
		vi.advanceTimersByTime(200);
		expect(latest().get('a')?.visible).toBeFalsy();
	});
});
