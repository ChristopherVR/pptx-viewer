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

	it('cleans up independent components and still hides a completed exit', () => {
		vi.useFakeTimers();
		const { ctx, latest } = makeContext();
		const motion = step({
			elementId: 'a',
			presetClass: 'path',
			keyframeName: 'pptx-tl-motion-1',
			cssAnimation: 'pptx-tl-motion-1 2000ms linear 0ms 1 both',
			durationMs: 2000,
			holdEndState: true,
		});
		const exit = step({
			elementId: 'a',
			presetClass: 'exit',
			keyframeName: 'pptx-fadeOut',
			cssAnimation: 'pptx-fadeOut 500ms ease 2000ms 1 forwards',
			delayMs: 2000,
		});
		applyAnimationGroupSteps(group([motion, exit]), ctx);
		vi.advanceTimersByTime(2008);
		expect(latest().get('a')?.cssAnimation).toContain(exit.cssAnimation);
		vi.advanceTimersByTime(500);
		expect(latest().get('a')?.visible).toBeFalsy();
		expect(latest().get('a')?.cssAnimation).toBe(motion.cssAnimation);
	});

	it('does not create an element state for sound-only steps', () => {
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(
			group([step({ elementId: '', cssAnimation: '', soundPath: 'cue.wav' })]),
			ctx,
		);
		expect(latest().size).toBe(0);
		expect(ctx.playSound).toHaveBeenCalledWith('cue.wav');
	});

	it('keeps a replay with identical CSS when the previous run cleans up', () => {
		const { ctx, latest } = makeContext();
		const effect = group([step({ elementId: 'a' })]);
		applyAnimationGroupSteps(effect, ctx);
		vi.advanceTimersByTime(200);
		applyAnimationGroupSteps(effect, ctx);
		vi.advanceTimersByTime(308);
		expect(latest().get('a')?.cssAnimation).toBe(effect.steps[0].cssAnimation);
		vi.advanceTimersByTime(200);
		expect(latest().get('a')?.cssAnimation).toBeUndefined();
	});

	it('cleans up with a state setter that evaluates updaters twice', () => {
		let states = new Map<string, ElementAnimationState>();
		const { ctx } = makeContext();
		ctx.setStates = (updater) => {
			updater(states);
			states = updater(states);
		};
		applyAnimationGroupSteps(group([step({ elementId: 'a' })]), ctx);
		vi.advanceTimersByTime(508);
		expect(states.get('a')?.cssAnimation).toBeUndefined();
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

	it('keeps a newer step delayed animation when an earlier step cleanup fires', () => {
		// A chained-motion journey attaches ONE long animation in the delay
		// phase; the entrance that fired before it must not wipe it when its
		// own (much earlier) cleanup timer runs.
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(
			group([
				step({
					elementId: 'a',
					presetClass: 'entr',
					keyframeName: 'pptx-appear',
					cssAnimation: 'pptx-appear 0ms linear 0ms 1 both',
					delayMs: 0,
					durationMs: 0,
				}),
				step({
					elementId: 'a',
					presetClass: 'path',
					keyframeName: 'pptx-tl-transform-1',
					cssAnimation: 'pptx-tl-transform-1 6000ms linear 2000ms 1 both',
					delayMs: 2000,
					durationMs: 6000,
					holdEndState: true,
				}),
			]),
			ctx,
		);
		const chain = 'pptx-tl-transform-1 6000ms linear 2000ms 1 both';
		// past the entrance cleanup (0 + 0 + 8ms): the chain must survive.
		vi.advanceTimersByTime(100);
		expect(latest().get('a')?.cssAnimation).toBe(chain);
		// past the chain's own cleanup (2000 + 6000 + 8): hold keeps it attached.
		vi.advanceTimersByTime(9000);
		expect(latest().get('a')?.cssAnimation).toBe(chain);
	});

	it('delays a delayed step sound by its delayMs and keeps delay-0 immediate', () => {
		const { ctx } = makeContext();
		applyAnimationGroupSteps(
			group([
				step({ elementId: 'a', soundPath: 'media/late.wav', delayMs: 8000 }),
				step({ elementId: 'b', soundPath: 'media/now.wav' }),
			]),
			ctx,
		);
		expect(ctx.playSound).toHaveBeenCalledWith('media/now.wav');
		expect(ctx.playSound).not.toHaveBeenCalledWith('media/late.wav');
		vi.advanceTimersByTime(8000);
		expect(ctx.playSound).toHaveBeenCalledWith('media/late.wav');
	});

	it('calls ctx.stopSound for a stopSound step', () => {
		const { ctx } = makeContext();
		applyAnimationGroupSteps(group([step({ elementId: 'a', stopSound: true })]), ctx);
		expect(ctx.stopSound).toHaveBeenCalledWith();
	});

	// G13: an `onStopAudio`-gated step should start from the REAL media
	// element's `ended` event, not only the estimated `delayMs` baked into its
	// cssAnimation at build time.
	describe('onStopAudio real-media-ended gating', () => {
		it('re-applies the gated step with delay=0 when the real media element fires ended', () => {
			const root = document.createElement('div');
			const audio = document.createElement('audio');
			audio.dataset['elementId'] = 'audio1';
			root.appendChild(audio);

			const { ctx, latest } = makeContext();
			ctx.frameRoot = () => root;
			ctx.mediaTimeNodeElementIds = new Map([[9, 'audio1']]);

			applyAnimationGroupSteps(
				group([
					step({
						elementId: 'el1',
						cssAnimation: 'pptx-fadeIn 500ms ease 4000ms 1 normal both',
						dependsOnEvent: 'onStopAudio',
						dependsOnTimeNodeId: 9,
					}),
				]),
				ctx,
			);
			// The estimate-based fallback already applied the step with its
			// (stale) 4000ms delay baked in - unaffected by the real listener.
			expect(latest().get('el1')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 4000ms 1 normal both');

			audio.dispatchEvent(new Event('ended'));
			// The real event corrects it to start NOW (delay zeroed).
			expect(latest().get('el1')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 normal both');
		});

		it('does nothing when no mediaTimeNodeElementIds map is provided (fallback-only, matches pre-existing behaviour)', () => {
			const { ctx, latest } = makeContext();
			applyAnimationGroupSteps(
				group([
					step({
						elementId: 'el1',
						dependsOnEvent: 'onStopAudio',
						dependsOnTimeNodeId: 9,
					}),
				]),
				ctx,
			);
			expect(latest().get('el1')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 both');
		});

		// A `p:cond evt="onStopAudio"` naming its dependency by SHAPE
		// (`p:tgtEl/p:spTgt`, no `@_tn`) resolves the media element DIRECTLY by
		// its shape/element id, with no `mediaTimeNodeElementIds` map involved.
		it("re-applies a dependsOnShapeId-gated step when that shape's media fires ended", () => {
			const root = document.createElement('div');
			const audio = document.createElement('audio');
			audio.dataset['elementId'] = 'audio-shape-3';
			root.appendChild(audio);

			const { ctx, latest } = makeContext();
			ctx.frameRoot = () => root;
			// Deliberately no mediaTimeNodeElementIds: the shape-id form needs none.

			applyAnimationGroupSteps(
				group([
					step({
						elementId: 'el1',
						cssAnimation: 'pptx-fadeIn 500ms ease 4000ms 1 normal both',
						dependsOnEvent: 'onStopAudio',
						dependsOnShapeId: 'audio-shape-3',
					}),
				]),
				ctx,
			);
			expect(latest().get('el1')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 4000ms 1 normal both');

			audio.dispatchEvent(new Event('ended'));
			expect(latest().get('el1')?.cssAnimation).toBe('pptx-fadeIn 500ms ease 0ms 1 normal both');
		});
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

	// A `p:bldDgm` / `p:bldChart` build fires one step PER STAGE against the same
	// element id. The step's initial write and its cleanup timer used to replace
	// the state object outright, dropping `build` and the authored-index reveal
	// descriptors; the renderer read the resulting state as "no build: reveal
	// everything", so the whole diagram popped in once the first stage's fade
	// ended (caught by e2e `smartart-build-reveal.spec.ts` on all five bindings).
	it('keeps the staged-build reveal fields through a step start and its cleanup', () => {
		vi.useFakeTimers();
		const diagramReveal: NonNullable<ElementAnimationState['diagramReveal']> = {
			mode: 'byOne',
			descriptor: { background: true, nodeIds: new Set(['gamma']) },
		};
		const computeStatesFor = vi.fn(
			(): Map<string, ElementAnimationState> =>
				new Map([
					[
						'dgm',
						{
							visible: true,
							cssAnimation: undefined,
							build: { kind: 'diagram', mode: 'byOne', progress: 1 },
							diagramReveal,
						},
					],
				]),
		);
		const controller = stubController({ computeStatesFor });
		const { ctx, latest } = makeContext();
		// The pre-click snapshot already carries an (empty) descriptor.
		ctx.setStates((prev) =>
			new Map(prev).set('dgm', {
				visible: false,
				cssAnimation: undefined,
				diagramReveal: {
					mode: 'byOne',
					descriptor: { background: false, nodeIds: new Set() },
				},
			}),
		);
		const built = group([step({ elementId: 'dgm', build: { kind: 'diagram', mode: 'byOne' } })]);

		playGroup(controller, built, ctx);
		expect(latest().get('dgm')?.diagramReveal).toBe(diagramReveal);
		expect(latest().get('dgm')?.build?.progress).toBe(1);

		// Past the step's cleanup timer (delay + duration + 8ms).
		vi.advanceTimersByTime(1000);
		expect(latest().get('dgm')?.cssAnimation).toBeUndefined();
		expect(latest().get('dgm')?.diagramReveal).toBe(diagramReveal);
		expect(latest().get('dgm')?.build?.progress).toBe(1);
		vi.useRealTimers();
	});

	// One click group routinely holds SEVERAL steps for the same element, each
	// with its own delay (a crane claw that "slides right 0-2s, then disappears
	// 2-2.5s" is one authored sequence). The per-element state holds ONE CSS
	// animation list, so those steps must accumulate into a comma join - the
	// historical overwrite handed the element only the LAST step and the claw
	// never slid at all.
	it('joins same-element steps with disjoint properties into one animation list', () => {
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(
			group([
				step({
					elementId: 'claw',
					keyframeName: 'pptx-tl-transform-7',
					cssAnimation: 'pptx-tl-transform-7 2000ms linear 0ms 1 both',
					presetClass: 'path',
				}),
				step({
					elementId: 'claw',
					keyframeName: 'pptx-disappear',
					cssAnimation: 'pptx-disappear 500ms ease 2000ms 1 forwards',
					presetClass: 'exit',
					delayMs: 2000,
				}),
			]),
			ctx,
		);
		expect(latest().get('claw')?.cssAnimation).toBe(
			'pptx-tl-transform-7 2000ms linear 0ms 1 both, pptx-disappear 500ms ease 2000ms 1 forwards',
		);
	});

	it('keeps last-write-wins for same-element steps that animate the same property', () => {
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(
			group([
				step({
					elementId: 'a',
					keyframeName: 'pptx-tl-transform-1',
					cssAnimation: 'pptx-tl-transform-1 1000ms linear 0ms 1 both',
					presetClass: 'path',
				}),
				step({
					elementId: 'a',
					keyframeName: 'pptx-tl-transform-2',
					cssAnimation: 'pptx-tl-transform-2 1000ms linear 1000ms 1 both',
					presetClass: 'path',
					delayMs: 1000,
				}),
			]),
			ctx,
		);
		// Two transform animations on one element resolve in list order, and the
		// later one's `fill: both` from-frame would pin the transform through the
		// earlier one's active window - so the earlier one is dropped instead.
		expect(latest().get('a')?.cssAnimation).toBe('pptx-tl-transform-2 1000ms linear 1000ms 1 both');
	});

	it('lets a later exit take over opacity without dropping the motion', () => {
		// The crane-claw choreography: appear 0-0.5s, slide right 0-2s, fade out
		// 2-2.5s - three steps on one element in one group. The exit's `opacity`
		// supersedes the entrance's fade (component takeover) but must not touch
		// the motion's `transform`: the historical overwrite kept only the exit
		// and the claw never slid.
		const { ctx, latest } = makeContext();
		applyAnimationGroupSteps(
			group([
				step({ elementId: 'claw' }),
				step({
					elementId: 'claw',
					keyframeName: 'pptx-tl-motion-45',
					cssAnimation: 'pptx-tl-motion-45 2000ms linear 0ms 1 both',
					presetClass: 'path',
				}),
				step({
					elementId: 'claw',
					keyframeName: 'pptx-disappear',
					cssAnimation: 'pptx-disappear 500ms ease 2000ms 1 forwards',
					presetClass: 'exit',
					delayMs: 2000,
				}),
			]),
			ctx,
		);
		expect(latest().get('claw')?.cssAnimation).toBe(
			'pptx-tl-motion-45 2000ms linear 0ms 1 both, pptx-disappear 500ms ease 2000ms 1 forwards',
		);
	});

	it('replaces a stale animation from a previous group or run instead of joining it', () => {
		const { ctx, latest } = makeContext();
		// The previous run of this interactive sequence ended with the element
		// faded out (a held exit). Replaying must hand the element its NEW
		// animation alone - joining would glue the new motion to the old exit's
		// held `opacity: 0` and slide the element around invisible.
		ctx.setStates((prev) =>
			new Map(prev).set('claw', {
				visible: false,
				cssAnimation: 'pptx-disappear 500ms ease 0ms 1 forwards',
			}),
		);
		applyAnimationGroupSteps(
			group([
				step({
					elementId: 'claw',
					keyframeName: 'pptx-tl-transform-7',
					cssAnimation: 'pptx-tl-transform-7 2000ms linear 0ms 1 both',
					presetClass: 'path',
				}),
			]),
			ctx,
		);
		expect(latest().get('claw')?.cssAnimation).toBe('pptx-tl-transform-7 2000ms linear 0ms 1 both');
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
