/**
 * animation-playback-helpers.test.ts: unit tests for the native-timing
 * (controller-model) playback step helpers used by the Svelte slide show.
 * Mirrors the coverage of the Vue / Angular / React equivalents; only the
 * pure step-application logic is exercised here (the clock lives in the
 * runes-based presentation state that owns the timers).
 */

import type { ElementAnimationState, TimelineClickGroup, TimelineStep } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackContext } from './animation-playback-helpers';
import { applyAnimationGroupSteps } from './animation-playback-helpers';

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
		expect(latest.get('a')?.visible).toBeTruthy();
		vi.advanceTimersByTime(1000);
		expect(latest.get('a')?.visible).toBeFalsy();
	});

	it('keeps the CSS animation attached after cleanup when holdEndState is set (fill="hold")', () => {
		let latest = new Map<string, ElementAnimationState>();
		const ctx: PlaybackContext = {
			setStates: (updater) => {
				latest = updater(latest);
			},
			timers: [],
			buildHandle: { current: null },
		};
		applyAnimationGroupSteps(
			group([step({ elementId: 'a', presetClass: 'emph', holdEndState: true })]),
			ctx,
		);
		vi.advanceTimersByTime(1000);
		// Unlike the default (which clears the animation on cleanup), a held
		// step keeps its CSS animation attached so the final frame persists.
		expect(latest.get('a')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 both');
	});

	it('hides an element once its effect ends when hideAfterEffect is set (afterAnimation: "hideAfterAnimation")', () => {
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
		applyAnimationGroupSteps(
			group([step({ elementId: 'a', presetClass: 'entr', hideAfterEffect: true })]),
			ctx,
		);
		vi.advanceTimersByTime(1000);
		expect(latest.get('a')?.visible).toBeFalsy();
	});

	it('plays a step sound via onPlayActionSound when soundPath is set', () => {
		let latest = new Map<string, ElementAnimationState>();
		const onPlayActionSound = vi.fn<(soundPath: string) => void>();
		const ctx: PlaybackContext = {
			setStates: (updater) => {
				latest = updater(latest);
			},
			timers: [],
			buildHandle: { current: null },
			onPlayActionSound,
		};
		applyAnimationGroupSteps(group([step({ elementId: 'a', soundPath: 'media/click.wav' })]), ctx);
		expect(onPlayActionSound).toHaveBeenCalledWith('media/click.wav');
	});
});
