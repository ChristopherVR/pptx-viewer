import { describe, it, expect, vi } from 'vitest';

import type { ElementAnimationState, TimelineClickGroup } from '../../utils/animation-timeline';
import {
	finishAnimationGroupSteps,
	finishDomAnimationsForGroup,
	shouldSeekAnimationGroup,
} from './animation-helpers';

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

// The click-group step application (formerly `applyAnimationGroupSteps` in this
// file) now lives in the shared `animation-playback-engine`
// (packages/shared/src/render/animation-playback-engine.ts) and is covered by
// that module's own tests. This file keeps only the "seek" nuance, which is
// React-specific: a second advance while a `p:seq/@nextAc="seek"` group is
// still mid-flight fast-forwards it to its authored end state.
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
