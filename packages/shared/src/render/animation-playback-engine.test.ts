// @vitest-environment jsdom
/**
 * animation-playback-engine.test.ts: unit tests for the native-timing
 * (controller-model) playback step helpers shared by all five bindings' slide
 * shows. Ported (and extended with `driveBuildReveal` / `scheduleAutoAdvanceChain`
 * / `playGroup` coverage) from the most complete per-binding copy, Angular's
 * `presentation-playback-helpers.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
	BuildRafHandle,
	PlaybackAnimationController,
	PlaybackContext,
} from './animation-playback-engine';
import {
	applyAnimationGroupSteps,
	cancelBuildReveal,
	driveBuildReveal,
	playGroup,
	scheduleAutoAdvanceChain,
} from './animation-playback-engine';
import type {
	ElementAnimationState,
	TimelineClickGroup,
	TimelineStep,
} from './animation-timeline-types';

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

describe('applyAnimationGroupSteps', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('makes an entrance step visible and applies its css animation', () => {
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(group([step({ elementId: 'a' })]), ctx);
		expect(latest().get('a')?.visible).toBeTruthy();
		expect(latest().get('a')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 both');
	});

	it('folds p:animClr colour targets into animatesFill / animatesStroke, then clears them', () => {
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(
			group([step({ elementId: 'a', presetClass: 'emph', colorTargets: ['fill', 'stroke'] })]),
			ctx,
		);
		expect(latest().get('a')?.animatesFill).toBeTruthy();
		expect(latest().get('a')?.animatesStroke).toBeTruthy();

		vi.advanceTimersByTime(1000);
		expect(latest().get('a')?.cssAnimation).toBeUndefined();
		expect(latest().get('a')?.animatesFill).toBeUndefined();
		expect(latest().get('a')?.animatesStroke).toBeUndefined();
	});

	it('hides an exit step once its animation completes', () => {
		const { ctx, latest } = makeContext();
		ctx.setStates((prev) => new Map(prev).set('a', { visible: true, cssAnimation: undefined }));
		applyAnimationGroupSteps(group([step({ elementId: 'a', presetClass: 'exit' })]), ctx);
		expect(latest().get('a')?.visible).toBeTruthy();
		vi.advanceTimersByTime(1000);
		expect(latest().get('a')?.visible).toBeFalsy();
	});

	it('keeps the CSS animation attached after cleanup when holdEndState is set (fill="hold")', () => {
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(
			group([step({ elementId: 'a', presetClass: 'emph', holdEndState: true })]),
			ctx,
		);
		vi.advanceTimersByTime(1000);
		expect(latest().get('a')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 both');
	});

	it('hides an element once its effect ends when hideAfterEffect is set (afterAnimation: "hideAfterAnimation")', () => {
		const { ctx, latest } = makeContext();
		ctx.setStates((prev) => new Map(prev).set('a', { visible: true, cssAnimation: undefined }));
		applyAnimationGroupSteps(
			group([step({ elementId: 'a', presetClass: 'entr', hideAfterEffect: true })]),
			ctx,
		);
		vi.advanceTimersByTime(1000);
		expect(latest().get('a')?.visible).toBeFalsy();
	});

	it('plays a step sound via the host onPlayActionSound override when set', () => {
		const { ctx } = makeContext();
		const onPlayActionSound = vi.fn<(soundPath: string) => void>();
		ctx.onPlayActionSound = onPlayActionSound;
		applyAnimationGroupSteps(group([step({ elementId: 'a', soundPath: 'media/click.wav' })]), ctx);
		expect(onPlayActionSound).toHaveBeenCalledWith('media/click.wav');
		expect(ctx.playSound).not.toHaveBeenCalled();
	});

	it('falls back to ctx.playSound when no host override is set', () => {
		const { ctx } = makeContext();
		applyAnimationGroupSteps(group([step({ elementId: 'a', soundPath: 'media/click.wav' })]), ctx);
		expect(ctx.playSound).toHaveBeenCalledWith('media/click.wav');
	});

	it('calls ctx.stopSound for a stopSound step', () => {
		const { ctx } = makeContext();
		applyAnimationGroupSteps(group([step({ elementId: 'a', stopSound: true })]), ctx);
		expect(ctx.stopSound).toHaveBeenCalledWith();
	});
});

describe('cancelBuildReveal', () => {
	it('clears the raf handle', () => {
		const handle: BuildRafHandle = { current: 42 };
		cancelBuildReveal(handle);
		expect(handle.current).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// driveBuildReveal / playGroup / scheduleAutoAdvanceChain: exercised with a
// stub controller (PlaybackAnimationController is a narrow structural
// interface, so a plain object stands in for a real
// PresentationAnimationController without constructing a slide/timeline).
// ---------------------------------------------------------------------------

function stubController(
	overrides: Partial<PlaybackAnimationController>,
): PlaybackAnimationController {
	return {
		shouldAutoAdvance: () => false,
		getAutoAdvanceDelay: () => 0,
		peekNext: () => null,
		advance: () => null,
		computeStatesFor: () => new Map(),
		...overrides,
	};
}

describe('driveBuildReveal', () => {
	it('is a no-op when the group carries no build step', () => {
		const { ctx } = makeContext();
		const computeStatesFor = vi.fn(() => new Map<string, ElementAnimationState>());
		const controller = stubController({ computeStatesFor });
		driveBuildReveal(controller, group([step({ elementId: 'a' })]), ctx);
		expect(computeStatesFor).not.toHaveBeenCalled();
		expect(ctx.buildHandle.current).toBeNull();
	});

	it('ramps a staged build to progress 1 and clears the raf handle', async () => {
		vi.useFakeTimers();
		let progress = 0;
		const computeStatesFor = vi.fn((): Map<string, ElementAnimationState> => {
			progress = Math.min(1, progress + 0.5);
			return new Map([
				[
					'chart',
					{
						visible: true,
						cssAnimation: undefined,
						build: { kind: 'chart', mode: 'bySeries', progress },
					},
				],
			]);
		});
		const controller = stubController({ computeStatesFor });
		const { ctx, latest } = makeContext();
		const built = group([step({ elementId: 'chart', build: { kind: 'chart', mode: 'bySeries' } })]);

		driveBuildReveal(controller, built, ctx);
		// Synchronous seed tick runs immediately.
		expect(latest().get('chart')?.build?.progress).toBe(0.5);

		// Drain the RAF loop (jsdom polyfills requestAnimationFrame via a timer).
		for (let i = 0; i < 5 && ctx.buildHandle.current !== null; i += 1) {
			await vi.advanceTimersByTimeAsync(20);
		}
		expect(latest().get('chart')?.build?.progress).toBe(1);
		expect(ctx.buildHandle.current).toBeNull();
		vi.useRealTimers();
	});
});

describe('playGroup', () => {
	it('applies the group steps and starts a build reveal when present', () => {
		const computeStatesFor = vi.fn(
			(): Map<string, ElementAnimationState> =>
				new Map([
					[
						'chart',
						{
							visible: true,
							cssAnimation: undefined,
							build: { kind: 'chart', mode: 'bySeries', progress: 1 },
						},
					],
				]),
		);
		const controller = stubController({ computeStatesFor });
		const { ctx, latest } = makeContext();
		const built = group([step({ elementId: 'chart', build: { kind: 'chart', mode: 'bySeries' } })]);

		playGroup(controller, built, ctx);
		expect(latest().get('chart')?.visible).toBeTruthy();
		expect(computeStatesFor).toHaveBeenCalledWith(['chart'], expect.any(Object));
	});
});

describe('scheduleAutoAdvanceChain', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('does nothing when the controller says not to auto-advance', () => {
		const controller = stubController({ shouldAutoAdvance: () => false });
		const { ctx } = makeContext();
		scheduleAutoAdvanceChain(controller, ctx);
		expect(ctx.timers).toHaveLength(0);
	});

	it('does nothing when there is no next group to peek', () => {
		const controller = stubController({ shouldAutoAdvance: () => true, peekNext: () => null });
		const { ctx } = makeContext();
		scheduleAutoAdvanceChain(controller, ctx);
		expect(ctx.timers).toHaveLength(0);
	});

	it('advances and plays the next group after the auto-advance delay', () => {
		const nextGroup = group([step({ elementId: 'b' })]);
		let advanced = false;
		const controller = stubController({
			shouldAutoAdvance: () => !advanced,
			getAutoAdvanceDelay: () => 100,
			peekNext: () => nextGroup,
			advance: () => {
				advanced = true;
				return nextGroup;
			},
		});
		const { ctx, latest } = makeContext();

		scheduleAutoAdvanceChain(controller, ctx);
		expect(ctx.timers).toHaveLength(1);
		expect(latest().get('b')).toBeUndefined();

		vi.advanceTimersByTime(100);
		expect(latest().get('b')?.visible).toBeTruthy();
	});
});
