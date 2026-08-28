import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { ElementAnimationState, TimelineClickGroup } from '../../utils/animation-timeline';
import {
	registerMediaElement,
	clearMediaElementRegistry,
} from '../../utils/media-element-registry';
import {
	applyAnimationGroupSteps,
	finishAnimationGroupSteps,
	finishDomAnimationsForGroup,
	shouldSeekAnimationGroup,
} from './animation-helpers';

vi.mock<typeof import('../../utils/animation-sound')>(
	import('../../utils/animation-sound'),
	() => ({
		stopAnimationSound: vi.fn<() => void>(),
	}),
);

function createMockStep(overrides: Partial<TimelineClickGroup['steps'][0]> = {}) {
	return {
		elementId: 'el-1',
		presetClass: 'entr' as const,
		cssAnimation: 'fadeIn 0.5s ease',
		keyframeName: 'fadeIn',
		trigger: 'onClick' as const,
		fillMode: 'both' as const,
		delayMs: 0,
		durationMs: 500,
		stopSound: false,
		soundPath: undefined as string | undefined,
		...overrides,
	};
}

describe('applyAnimationGroupSteps', () => {
	let setPresentationElementStates: ReturnType<typeof vi.fn>;
	let presentationTimersRef: { current: number[] };

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', {
			setTimeout: globalThis.setTimeout,
			clearTimeout: globalThis.clearTimeout,
		});
		setPresentationElementStates = vi.fn((updater) => {
			// Execute the updater to test its logic
			if (typeof updater === 'function') {
				updater(new Map());
			}
		});
		presentationTimersRef = { current: [] };
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('should call setPresentationElementStates with CSS animation', () => {
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [createMockStep()],
		};
		applyAnimationGroupSteps(group, undefined, setPresentationElementStates, presentationTimersRef);
		// Called once for initial CSS animation state
		expect(setPresentationElementStates).toHaveBeenCalledOnce();
	});

	it('folds a step colorTargets into animatesFill/animatesStroke during its active window', () => {
		let captured: Map<string, { animatesFill?: boolean; animatesStroke?: boolean }> | undefined;
		setPresentationElementStates.mockImplementation((updater) => {
			if (typeof updater === 'function') {
				captured = updater(new Map());
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [createMockStep({ elementId: 'el-c', colorTargets: ['fill', 'stroke'] })],
		};
		applyAnimationGroupSteps(group, undefined, setPresentationElementStates, presentationTimersRef);
		expect(captured?.get('el-c')?.animatesFill).toBeTruthy();
		expect(captured?.get('el-c')?.animatesStroke).toBeTruthy();
	});

	it('leaves animatesFill/animatesStroke unset for a step with no colorTargets', () => {
		let captured: Map<string, { animatesFill?: boolean; animatesStroke?: boolean }> | undefined;
		setPresentationElementStates.mockImplementation((updater) => {
			if (typeof updater === 'function') {
				captured = updater(new Map());
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [createMockStep({ elementId: 'el-p' })],
		};
		applyAnimationGroupSteps(group, undefined, setPresentationElementStates, presentationTimersRef);
		expect(captured?.get('el-p')?.animatesFill).toBeUndefined();
		expect(captured?.get('el-p')?.animatesStroke).toBeUndefined();
	});

	it('should schedule cleanup timers for each step', () => {
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [
				createMockStep({ elementId: 'el-1', durationMs: 300 }),
				createMockStep({ elementId: 'el-2', durationMs: 500 }),
			],
		};
		applyAnimationGroupSteps(group, undefined, setPresentationElementStates, presentationTimersRef);
		expect(presentationTimersRef.current).toHaveLength(2);
	});

	it('should play sound when step has soundPath', () => {
		const onPlayActionSound = vi.fn<() => void>();
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [createMockStep({ soundPath: 'click.wav' })],
		};
		applyAnimationGroupSteps(
			group,
			onPlayActionSound,
			setPresentationElementStates,
			presentationTimersRef,
		);
		expect(onPlayActionSound).toHaveBeenCalledWith('click.wav');
	});

	it('should not call onPlayActionSound when it is undefined', () => {
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [createMockStep({ soundPath: 'click.wav' })],
		};
		// Should not throw
		expect(() =>
			applyAnimationGroupSteps(
				group,
				undefined,
				setPresentationElementStates,
				presentationTimersRef,
			),
		).not.toThrow();
	});

	it('should set visible=true for entrance animations', () => {
		let capturedState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
		const stateSetter = vi.fn((updater: unknown) => {
			if (typeof updater === 'function') {
				capturedState = (
					updater as (
						prev: Map<string, { visible: boolean; cssAnimation?: string }>,
					) => Map<string, { visible: boolean; cssAnimation?: string }>
				)(new Map());
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [createMockStep({ presetClass: 'entr' })],
		};
		applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);
		expect(capturedState).toBeDefined();
		const state = capturedState!.get('el-1');
		expect(state?.visible).toBeTruthy();
		expect(state?.cssAnimation).toBe('fadeIn 0.5s ease');
	});

	it('should keep current visibility for exit animations initially', () => {
		let capturedState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
		const stateSetter = vi.fn((updater: unknown) => {
			if (typeof updater === 'function') {
				const prev = new Map<string, { visible: boolean; cssAnimation?: string }>();
				prev.set('el-1', { visible: true, cssAnimation: undefined });
				capturedState = (
					updater as (
						prev: Map<string, { visible: boolean; cssAnimation?: string }>,
					) => Map<string, { visible: boolean; cssAnimation?: string }>
				)(prev);
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [
				createMockStep({
					presetClass: 'exit',
					cssAnimation: 'fadeOut 0.5s ease',
				}),
			],
		};
		applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);
		const state = capturedState!.get('el-1');
		// Exit keeps current visible state during animation
		expect(state?.visible).toBeTruthy();
		expect(state?.cssAnimation).toBe('fadeOut 0.5s ease');
	});

	it('should clear CSS animation and set visible=false for exit after timer fires', () => {
		let capturedCleanupState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
		const stateSetter = vi.fn((updater: unknown) => {
			if (typeof updater === 'function') {
				const prev = new Map<string, { visible: boolean; cssAnimation?: string }>();
				prev.set('el-1', { visible: true, cssAnimation: 'fadeOut 0.5s ease' });
				capturedCleanupState = (
					updater as (
						prev: Map<string, { visible: boolean; cssAnimation?: string }>,
					) => Map<string, { visible: boolean; cssAnimation?: string }>
				)(prev);
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [
				createMockStep({
					presetClass: 'exit',
					durationMs: 500,
					delayMs: 0,
					cssAnimation: 'fadeOut 0.5s ease',
				}),
			],
		};
		applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);

		// Advance past durationMs + delayMs + 8
		vi.advanceTimersByTime(510);

		// The cleanup timer should have fired
		expect(stateSetter).toHaveBeenCalledTimes(2); // once for initial, once for cleanup
		const state = capturedCleanupState!.get('el-1');
		expect(state?.visible).toBeFalsy();
		expect(state?.cssAnimation).toBeUndefined();
	});

	it('keeps the CSS animation attached after cleanup when holdEndState is set (fill="hold")', () => {
		let capturedCleanupState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
		const stateSetter = vi.fn((updater: unknown) => {
			if (typeof updater === 'function') {
				const prev = new Map<string, { visible: boolean; cssAnimation?: string }>();
				prev.set('el-1', { visible: true, cssAnimation: 'pulse 0.5s ease' });
				capturedCleanupState = (
					updater as (
						prev: Map<string, { visible: boolean; cssAnimation?: string }>,
					) => Map<string, { visible: boolean; cssAnimation?: string }>
				)(prev);
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [
				createMockStep({
					presetClass: 'emph',
					cssAnimation: 'pulse 0.5s ease',
					holdEndState: true,
				}),
			],
		};
		applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);
		vi.advanceTimersByTime(510);
		const state = capturedCleanupState!.get('el-1');
		// Unlike the default (which clears the animation on cleanup), a held
		// step keeps its CSS animation attached so the final frame persists.
		expect(state?.cssAnimation).toBe('pulse 0.5s ease');
	});

	it('hides an element once its effect ends when hideAfterEffect is set (afterAnimation: "hideAfterAnimation")', () => {
		let capturedCleanupState: Map<string, { visible: boolean; cssAnimation?: string }> | undefined;
		const stateSetter = vi.fn((updater: unknown) => {
			if (typeof updater === 'function') {
				const prev = new Map<string, { visible: boolean; cssAnimation?: string }>();
				prev.set('el-1', { visible: true, cssAnimation: undefined });
				capturedCleanupState = (
					updater as (
						prev: Map<string, { visible: boolean; cssAnimation?: string }>,
					) => Map<string, { visible: boolean; cssAnimation?: string }>
				)(prev);
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [
				createMockStep({
					presetClass: 'entr',
					hideAfterEffect: true,
				}),
			],
		};
		applyAnimationGroupSteps(group, undefined, stateSetter, presentationTimersRef);
		vi.advanceTimersByTime(510);
		const state = capturedCleanupState!.get('el-1');
		expect(state?.visible).toBeFalsy();
	});

	it('should handle stopSound flag', () => {
		// We can't easily mock stopAnimationSound, but we can verify it doesn't throw
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [createMockStep({ stopSound: true })],
		};
		expect(() =>
			applyAnimationGroupSteps(
				group,
				undefined,
				setPresentationElementStates,
				presentationTimersRef,
			),
		).not.toThrow();
	});

	it('drives a registered media element for a p:cmd command step', () => {
		clearMediaElementRegistry();
		const play = vi.fn(() => Promise.resolve());
		const media = { play, pause: vi.fn(), paused: true, currentTime: 0 };
		registerMediaElement('video1', media as unknown as HTMLMediaElement);

		const group: TimelineClickGroup = {
			totalDurationMs: 0,
			steps: [
				createMockStep({
					elementId: '',
					cssAnimation: '',
					keyframeName: '',
					presetClass: 'emph',
					durationMs: 0,
					delayMs: 0,
					command: { type: 'call', command: 'playFrom(1.5)', targetId: 'video1' },
				}),
			],
		};
		applyAnimationGroupSteps(group, undefined, setPresentationElementStates, presentationTimersRef);

		// Command is scheduled (not run synchronously) and no cleanup timer is added.
		expect(presentationTimersRef.current).toHaveLength(1);
		expect(play).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(media.currentTime).toBe(1.5);
		expect(play).toHaveBeenCalledOnce();
		clearMediaElementRegistry();
	});

	it('should handle multiple steps in a single group', () => {
		const group: TimelineClickGroup = {
			totalDurationMs: 600,
			steps: [
				createMockStep({ elementId: 'el-1', durationMs: 200 }),
				createMockStep({ elementId: 'el-2', durationMs: 400 }),
				createMockStep({ elementId: 'el-3', durationMs: 600 }),
			],
		};
		applyAnimationGroupSteps(group, undefined, setPresentationElementStates, presentationTimersRef);
		expect(presentationTimersRef.current).toHaveLength(3);
	});
});

describe('rapid next seek', () => {
	it('seeks only an active group with explicit nextAc="seek"', () => {
		const seekGroup: TimelineClickGroup = {
			steps: [createMockStep()],
			totalDurationMs: 500,
			seqNextAction: 'seek',
		};
		expect(shouldSeekAnimationGroup(seekGroup, 600, 100)).toBeTruthy();
		expect(shouldSeekAnimationGroup(seekGroup, 600, 600)).toBeFalsy();
		expect(shouldSeekAnimationGroup({ ...seekGroup, seqNextAction: 'none' }, 600, 100)).toBeFalsy();
		expect(
			shouldSeekAnimationGroup({ ...seekGroup, seqNextAction: undefined }, 600, 100),
		).toBeFalsy();
	});

	it('folds exits, after-effects, held paint, and staged builds to their final state', () => {
		let result = new Map<string, ElementAnimationState>();
		const setStates = vi.fn((updater) => {
			if (typeof updater === 'function') {
				result = updater(
					new Map([
						['exit', { visible: true, cssAnimation: 'fade-out' }],
						['hidden-after', { visible: true, cssAnimation: 'pulse' }],
						[
							'held-fill',
							{
								visible: true,
								cssAnimation: 'color-shift',
								animatesFill: true,
							},
						],
					]),
				);
			}
		});
		const group: TimelineClickGroup = {
			totalDurationMs: 800,
			steps: [
				createMockStep({ elementId: 'exit', presetClass: 'exit' }),
				createMockStep({ elementId: 'hidden-after', hideAfterEffect: true }),
				createMockStep({
					elementId: 'held-fill',
					presetClass: 'emph',
					cssAnimation: 'color-shift',
					holdEndState: true,
					colorTargets: ['fill'],
				}),
				createMockStep({
					elementId: 'chart',
					build: { kind: 'chart', mode: 'bySeries' },
				}),
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
		const root = {
			querySelectorAll: vi.fn(() => candidates),
		} as unknown as ParentNode;
		const group: TimelineClickGroup = {
			totalDurationMs: 500,
			steps: [
				createMockStep({ elementId: 'shape-1' }),
				createMockStep({ elementId: 'shape-1::paragraph-0' }),
				createMockStep({ elementId: 'shape-2::pptx-bg' }),
			],
		};

		expect(finishDomAnimationsForGroup(group, root)).toBe(1);
		expect(finiteAnimation.finish).toHaveBeenCalledOnce();
		expect(infiniteAnimation.finish).not.toHaveBeenCalled();
		expect(unrelatedAnimation.finish).not.toHaveBeenCalled();
	});
});
