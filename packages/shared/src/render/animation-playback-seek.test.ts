// @vitest-environment jsdom
/**
 * animation-playback-seek.test.ts: the `p:seq/@nextAc="seek"` click path shared
 * by all five bindings' slide shows. The three low-level helpers were ported
 * (with their tests) from React's `presentation-mode/animation-helpers`; the
 * `advanceMainSequence` cases cover the branch that used to exist only there.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackContext } from './animation-playback-engine';
import type { SeekableAnimationController } from './animation-playback-seek';
import {
	advanceMainSequence,
	clearPlaybackTimers,
	createActiveAnimationGroup,
	finishAnimationGroupSteps,
	finishDomAnimationsForGroup,
	markAnimationGroupActive,
	shouldSeekAnimationGroup,
} from './animation-playback-seek';
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

/** A two-group main sequence; `advance` hands groups out in order. */
function makeController(groups: TimelineClickGroup[]): SeekableAnimationController & {
	index: number;
} {
	const controller = {
		index: 0,
		hasMoreSteps: () => controller.index < groups.length,
		shouldAutoAdvance: () => false,
		getAutoAdvanceDelay: () => 0,
		peekNext: () => groups[controller.index] ?? null,
		advance: () => {
			const group = groups[controller.index] ?? null;
			if (group) {
				controller.index += 1;
			}
			return group;
		},
		computeStatesFor: (ids: readonly string[]) =>
			new Map(
				ids.map((id): [string, ElementAnimationState] => [
					id,
					{
						visible: true,
						cssAnimation: undefined,
						build: { kind: 'diagram', mode: 'one', progress: 1 },
					},
				]),
			),
	};
	return controller;
}

describe('shouldSeekAnimationGroup', () => {
	it('seeks only an active group with explicit nextAc="seek"', () => {
		const seekGroup: TimelineClickGroup = {
			steps: [step({ elementId: 'el-1' })],
			totalDurationMs: 500,
			seqNextAction: 'seek',
		};
		expect(shouldSeekAnimationGroup(seekGroup, 600, 100)).toBeTruthy();
		expect(shouldSeekAnimationGroup(seekGroup, 600, 600)).toBeFalsy();
		expect(shouldSeekAnimationGroup({ ...seekGroup, seqNextAction: 'none' }, 600, 100)).toBeFalsy();
		expect(
			shouldSeekAnimationGroup({ ...seekGroup, seqNextAction: undefined }, 600, 100),
		).toBeFalsy();
		expect(shouldSeekAnimationGroup(null, 600, 100)).toBeFalsy();
	});
});

describe('finishAnimationGroupSteps', () => {
	it('folds exits, after-effects, held paint, and staged builds to their final state', () => {
		let result = new Map<string, ElementAnimationState>();
		const setStates: PlaybackContext['setStates'] = (updater) => {
			result = updater(
				new Map([
					['exit', { visible: true, cssAnimation: 'fade-out' }],
					['hidden-after', { visible: true, cssAnimation: 'pulse' }],
					['held-fill', { visible: true, cssAnimation: 'color-shift', animatesFill: true }],
				]),
			);
		};
		const group: TimelineClickGroup = {
			totalDurationMs: 800,
			steps: [
				step({ elementId: 'exit', presetClass: 'exit' }),
				step({ elementId: 'hidden-after', hideAfterEffect: true }),
				step({
					elementId: 'held-fill',
					presetClass: 'emph',
					cssAnimation: 'color-shift',
					holdEndState: true,
					colorTargets: ['fill'],
				}),
				step({ elementId: 'chart', build: { kind: 'chart', mode: 'bySeries' } }),
			],
		};
		const completedStates = new Map<string, ElementAnimationState>([
			[
				'chart',
				{
					visible: true,
					cssAnimation: undefined,
					build: { kind: 'chart', mode: 'bySeries', progress: 1 },
				},
			],
		]);

		finishAnimationGroupSteps(group, setStates, completedStates);

		expect(result.get('exit')?.visible).toBeFalsy();
		expect(result.get('hidden-after')?.visible).toBeFalsy();
		expect(result.get('held-fill')).toMatchObject({
			visible: true,
			cssAnimation: 'color-shift',
			animatesFill: true,
		});
		expect(result.get('chart')?.build?.progress).toBe(1);
	});
});

describe('finishDomAnimationsForGroup', () => {
	it('finishes only finite animations on matching element, text, and background surfaces', () => {
		const finiteAnimation = {
			effect: { getTiming: () => ({ iterations: 1 }) },
			playState: 'running',
			finish: vi.fn(),
		} as unknown as Animation;
		const infiniteAnimation = {
			effect: { getTiming: () => ({ iterations: Infinity }) },
			playState: 'running',
			finish: vi.fn(),
		} as unknown as Animation;
		const unrelatedAnimation = {
			effect: { getTiming: () => ({ iterations: 1 }) },
			playState: 'running',
			finish: vi.fn(),
		} as unknown as Animation;
		const host = { dataset: { elementId: 'shape-2' } } as unknown as HTMLElement;
		const candidates = [
			{
				dataset: { elementId: 'shape-1' },
				closest: () => null,
				getAnimations: () => [finiteAnimation, infiniteAnimation],
			},
			{
				dataset: { animId: 'shape-1::paragraph-0' },
				closest: () => null,
				getAnimations: () => [finiteAnimation],
			},
			{
				dataset: { pptxAnimationLayer: 'background' },
				closest: () => host,
				getAnimations: () => [finiteAnimation],
			},
			{
				dataset: { elementId: 'unrelated' },
				closest: () => null,
				getAnimations: () => [unrelatedAnimation],
			},
		] as unknown as NodeListOf<HTMLElement>;
		const root = { querySelectorAll: vi.fn(() => candidates) } as unknown as ParentNode;
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [
				step({ elementId: 'shape-1' }),
				step({ elementId: 'shape-1::paragraph-0' }),
				step({ elementId: 'shape-2::pptx-bg' }),
			],
		};

		expect(finishDomAnimationsForGroup(group, root)).toBe(1);
		expect(finiteAnimation.finish).toHaveBeenCalledOnce();
		expect(infiniteAnimation.finish).not.toHaveBeenCalled();
		expect(unrelatedAnimation.finish).not.toHaveBeenCalled();
	});

	it('returns 0 for a command-only group without touching the DOM', () => {
		const root = { querySelectorAll: vi.fn() } as unknown as ParentNode;
		const group: TimelineClickGroup = {
			totalDurationMs: 0,
			steps: [step({ elementId: '', command: { kind: 'playFrom', targetElementId: 'v' } })],
		};
		expect(finishDomAnimationsForGroup(group, root)).toBe(0);
		expect(root.querySelectorAll).not.toHaveBeenCalled();
	});
});

describe('advanceMainSequence', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	const first: TimelineClickGroup = {
		steps: [step({ elementId: 'a', build: { kind: 'diagram', mode: 'one' } })],
		totalDurationMs: 500,
		seqNextAction: 'seek',
	};
	const second: TimelineClickGroup = { steps: [step({ elementId: 'b' })], totalDurationMs: 500 };

	it('returns false when there is no controller or the sequence is exhausted', () => {
		const { ctx } = makeContext();
		expect(advanceMainSequence(null, ctx, createActiveAnimationGroup(), 0)).toBeFalsy();
		expect(
			advanceMainSequence(makeController([]), ctx, createActiveAnimationGroup(), 0),
		).toBeFalsy();
	});

	it('plays the next group and remembers it as the seek target', () => {
		const { ctx, latest } = makeContext();
		const controller = makeController([first, second]);
		const active = createActiveAnimationGroup();

		expect(advanceMainSequence(controller, ctx, active, 1_000)).toBeTruthy();
		expect(controller.index).toBe(1);
		expect(latest().get('a')?.visible).toBeTruthy();
		expect(active.group).toBe(first);
		expect(active.endAtMs).toBe(1_500);
	});

	it("a click inside a seek group's window fast-forwards it instead of advancing", () => {
		const { ctx, latest } = makeContext();
		const controller = makeController([first, second]);
		const active = createActiveAnimationGroup();
		advanceMainSequence(controller, ctx, active, 1_000);
		const pendingTimers = ctx.timers.length;
		expect(pendingTimers).toBeGreaterThan(0);

		expect(advanceMainSequence(controller, ctx, active, 1_200)).toBeTruthy();

		// The sequence position did not move: the NEXT click starts group two.
		expect(controller.index).toBe(1);
		expect(latest().has('b')).toBeFalsy();
		// The staged build is folded to progress 1 and the cleanup timers dropped.
		expect(latest().get('a')?.build?.progress).toBe(1);
		expect(latest().get('a')?.cssAnimation).toBeUndefined();
		expect(ctx.timers).toHaveLength(0);
		expect(active.group).toBeNull();

		expect(advanceMainSequence(controller, ctx, active, 1_300)).toBeTruthy();
		expect(controller.index).toBe(2);
		expect(latest().get('b')?.visible).toBeTruthy();
	});

	it('a click after the seek window advances normally', () => {
		const { ctx, latest } = makeContext();
		const controller = makeController([first, second]);
		const active = createActiveAnimationGroup();
		advanceMainSequence(controller, ctx, active, 1_000);

		expect(advanceMainSequence(controller, ctx, active, 1_500)).toBeTruthy();
		expect(controller.index).toBe(2);
		expect(latest().get('b')?.visible).toBeTruthy();
		expect(active.group).toBe(second);
	});

	it('a group without nextAc="seek" never seeks, even mid-flight', () => {
		const { ctx } = makeContext();
		const plain: TimelineClickGroup = { ...first, seqNextAction: undefined };
		const controller = makeController([plain, second]);
		const active = createActiveAnimationGroup();
		advanceMainSequence(controller, ctx, active, 1_000);

		expect(advanceMainSequence(controller, ctx, active, 1_100)).toBeTruthy();
		expect(controller.index).toBe(2);
	});

	it('scopes the DOM finish to the frame root', () => {
		const { ctx } = makeContext();
		const root = document.createElement('div');
		const el = document.createElement('div');
		el.dataset.elementId = 'a';
		root.append(el);
		const finish = vi.fn();
		el.getAnimations = () => [
			{
				effect: { getTiming: () => ({ iterations: 1 }) },
				playState: 'running',
				finish,
			} as unknown as Animation,
		];
		ctx.frameRoot = () => root;
		const controller = makeController([first, second]);
		const active = createActiveAnimationGroup();
		advanceMainSequence(controller, ctx, active, 1_000);

		advanceMainSequence(controller, ctx, active, 1_100);
		expect(finish).toHaveBeenCalledOnce();
	});
});

describe('clearPlaybackTimers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('clears timers in place, cancels the build RAF, and drops the seek target', () => {
		const { ctx } = makeContext();
		const timers = ctx.timers;
		const callback = vi.fn();
		timers.push(window.setTimeout(callback, 10));
		ctx.buildHandle.current = requestAnimationFrame(() => undefined);
		const active = createActiveAnimationGroup();
		markAnimationGroupActive(active, { steps: [], totalDurationMs: 100 }, 0);

		clearPlaybackTimers(ctx, active);

		expect(ctx.timers).toBe(timers);
		expect(timers).toHaveLength(0);
		expect(ctx.buildHandle.current).toBeNull();
		expect(active.group).toBeNull();
		vi.advanceTimersByTime(50);
		expect(callback).not.toHaveBeenCalled();
	});
});
