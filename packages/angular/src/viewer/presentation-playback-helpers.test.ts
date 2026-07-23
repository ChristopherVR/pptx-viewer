/**
 * presentation-playback-helpers.test.ts: unit tests for the native-timing
 * (controller-model) playback step helpers used by the Angular slide show. No
 * TestBed; only the pure step-application + build-cancel logic is exercised
 * (the clock lives in {@link AnimationPlaybackService}). Mirrors the coverage of
 * the Vue `animation-playback-helpers` and React `animation-helpers`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ElementAnimationState, TimelineClickGroup, TimelineStep } from '../internal/shared';
import type { BuildRafHandle, PlaybackContext } from './presentation-playback-helpers';
import { applyAnimationGroupSteps, cancelBuildReveal } from './presentation-playback-helpers';

function step(overrides: Partial<TimelineStep> & Pick<TimelineStep, 'elementId'>): TimelineStep {
	return {
		cssAnimation: 'pptx-fadeIn 500ms ease 0ms 1 both',
		keyframeName: 'pptx-fadeIn',
		trigger: 'onClick',
		delayMs: 0,
		durationMs: 500,
		fillMode: 'both',
		presetClass: 'entr',
		...overrides,
	};
}

function group(steps: TimelineStep[]): TimelineClickGroup {
	return { steps, totalDurationMs: 500 };
}

describe('applyAnimationGroupSteps', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('makes an entrance step visible and applies its css animation', () => {
		let latest = new Map<string, ElementAnimationState>();
		const ctx: PlaybackContext = {
			setStates: (updater) => {
				latest = updater(latest);
			},
			timers: [],
			buildHandle: { current: null },
		};
		applyAnimationGroupSteps(group([step({ elementId: 'a' })]), ctx);
		expect(latest.get('a')?.visible).toBeTruthy();
		expect(latest.get('a')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 both');
	});

	it('folds p:animClr colour targets into animatesFill / animatesStroke, then clears them', () => {
		let latest = new Map<string, ElementAnimationState>();
		const ctx: PlaybackContext = {
			setStates: (updater) => {
				latest = updater(latest);
			},
			timers: [],
			buildHandle: { current: null },
		};
		applyAnimationGroupSteps(
			group([step({ elementId: 'a', presetClass: 'emph', colorTargets: ['fill', 'stroke'] })]),
			ctx,
		);
		// During the active step window both targets surface.
		expect(latest.get('a')?.animatesFill).toBeTruthy();
		expect(latest.get('a')?.animatesStroke).toBeTruthy();

		// After the step ends the animation (and colour targets) are cleared.
		vi.advanceTimersByTime(1000);
		expect(latest.get('a')?.cssAnimation).toBeUndefined();
		expect(latest.get('a')?.animatesFill).toBeUndefined();
		expect(latest.get('a')?.animatesStroke).toBeUndefined();
	});

	it('hides an exit step once its animation completes', () => {
		let latest = new Map<string, ElementAnimationState>([
			['a', { visible: true, cssAnimation: undefined }],
		]);
		const ctx: PlaybackContext = {
			setStates: (updater) => {
				latest = updater(latest);
			},
			timers: [],
			buildHandle: { current: null },
		};
		applyAnimationGroupSteps(group([step({ elementId: 'a', presetClass: 'exit' })]), ctx);
		// Still visible during the exit animation.
		expect(latest.get('a')?.visible).toBeTruthy();
		vi.advanceTimersByTime(1000);
		expect(latest.get('a')?.visible).toBeFalsy();
	});
});

describe('cancelBuildReveal', () => {
	it('clears the raf handle', () => {
		const handle: BuildRafHandle = { current: 42 };
		cancelBuildReveal(handle);
		expect(handle.current).toBeNull();
	});
});
