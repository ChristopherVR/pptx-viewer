import { describe, it, expect } from 'vitest';

import {
	applyRestartGatedStep,
	canTriggerStep,
	isGroupActive,
	shouldBlockNextAdvance,
	shouldBlockReset,
} from './animation-sequence-gating';
import type { StepApplicationState, StepRestartState } from './animation-sequence-gating';
import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';

function makeGroup(overrides: Partial<TimelineClickGroup> = {}): TimelineClickGroup {
	return { steps: [], totalDurationMs: 1000, ...overrides };
}

function makeStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
	return {
		elementId: 'el-1',
		cssAnimation: 'pptx-fadeIn 500ms ease 0ms 1 normal both',
		keyframeName: 'pptx-fadeIn',
		trigger: 'onClick',
		delayMs: 0,
		durationMs: 500,
		fillMode: 'both',
		presetClass: 'entr',
		...overrides,
	};
}

function makeApplicationState(): StepApplicationState {
	return {
		stepRestartState: new WeakMap(),
		activeAnimations: new Map(),
		activeSteps: new Map(),
		revealedElements: new Set(),
		exitedElements: new Set(),
	};
}

describe('isGroupActive', () => {
	it('is false when no group or no start time is known', () => {
		expect(isGroupActive(undefined, 0, 500)).toBeFalsy();
		expect(isGroupActive(makeGroup(), undefined, 500)).toBeFalsy();
	});

	it('is true while now is within totalDurationMs of the start', () => {
		const group = makeGroup({ totalDurationMs: 1000 });
		expect(isGroupActive(group, 0, 999)).toBeTruthy();
		expect(isGroupActive(group, 0, 1000)).toBeFalsy();
	});
});

describe('shouldBlockNextAdvance (p:seq/@concurrent, @nextAc)', () => {
	it('never blocks when there is no active group', () => {
		expect(shouldBlockNextAdvance(undefined, undefined, 0)).toBeFalsy();
	});

	it('never blocks a concurrent sequence, even with nextAc="none"', () => {
		const group = makeGroup({ seqConcurrent: true, seqNextAction: 'none', totalDurationMs: 1000 });
		expect(shouldBlockNextAdvance(group, 0, 500)).toBeFalsy();
	});

	it('never blocks when nextAc is "seek" (PowerPoint default: finish in place)', () => {
		const group = makeGroup({ seqNextAction: 'seek', totalDurationMs: 1000 });
		expect(shouldBlockNextAdvance(group, 0, 500)).toBeFalsy();
	});

	it('never blocks when nextAc is absent, even while still active', () => {
		const group = makeGroup({ totalDurationMs: 1000 });
		expect(shouldBlockNextAdvance(group, 0, 500)).toBeFalsy();
	});

	it('blocks a non-concurrent group with nextAc="none" while still active', () => {
		const group = makeGroup({ seqNextAction: 'none', totalDurationMs: 1000 });
		expect(shouldBlockNextAdvance(group, 0, 500)).toBeTruthy();
	});

	it('stops blocking once the active window elapses', () => {
		const group = makeGroup({ seqNextAction: 'none', totalDurationMs: 1000 });
		expect(shouldBlockNextAdvance(group, 0, 1000)).toBeFalsy();
		expect(shouldBlockNextAdvance(group, 0, 5000)).toBeFalsy();
	});
});

describe('shouldBlockReset (p:seq/@concurrent, @prevAc)', () => {
	it('never blocks when there is no active group', () => {
		expect(shouldBlockReset(undefined, undefined, 0)).toBeFalsy();
	});

	it('never blocks a concurrent sequence, even with prevAc="none"', () => {
		const group = makeGroup({ seqConcurrent: true, seqPrevAction: 'none', totalDurationMs: 1000 });
		expect(shouldBlockReset(group, 0, 500)).toBeFalsy();
	});

	it('never blocks when prevAc is "skipTimeNode"', () => {
		const group = makeGroup({ seqPrevAction: 'skipTimeNode', totalDurationMs: 1000 });
		expect(shouldBlockReset(group, 0, 500)).toBeFalsy();
	});

	it('never blocks when prevAc is absent, even while still active', () => {
		const group = makeGroup({ totalDurationMs: 1000 });
		expect(shouldBlockReset(group, 0, 500)).toBeFalsy();
	});

	it('blocks a non-concurrent group with prevAc="none" while still active', () => {
		const group = makeGroup({ seqPrevAction: 'none', totalDurationMs: 1000 });
		expect(shouldBlockReset(group, 0, 500)).toBeTruthy();
	});

	it('stops blocking once the active window elapses', () => {
		const group = makeGroup({ seqPrevAction: 'none', totalDurationMs: 1000 });
		expect(shouldBlockReset(group, 0, 1000)).toBeFalsy();
	});
});

describe('canTriggerStep (p:cTn/@restart)', () => {
	it('always allows a step that has never triggered before', () => {
		expect(canTriggerStep('never', undefined, 0)).toBeTruthy();
		expect(canTriggerStep('whenNotActive', undefined, 0)).toBeTruthy();
		expect(canTriggerStep(undefined, undefined, 0)).toBeTruthy();
	});

	it('"always" (or absent) permits retriggering even while still active', () => {
		const state: StepRestartState = { activeUntilMs: 1000 };
		expect(canTriggerStep('always', state, 500)).toBeTruthy();
		expect(canTriggerStep(undefined, state, 500)).toBeTruthy();
	});

	it('"whenNotActive" blocks while active and allows once the window elapses', () => {
		const state: StepRestartState = { activeUntilMs: 1000 };
		expect(canTriggerStep('whenNotActive', state, 500)).toBeFalsy();
		expect(canTriggerStep('whenNotActive', state, 1000)).toBeTruthy();
		expect(canTriggerStep('whenNotActive', state, 5000)).toBeTruthy();
	});

	it('"never" blocks every subsequent trigger, active or not', () => {
		const state: StepRestartState = { activeUntilMs: 1000 };
		expect(canTriggerStep('never', state, 500)).toBeFalsy();
		expect(canTriggerStep('never', state, 5000)).toBeFalsy();
	});
});

describe('applyRestartGatedStep', () => {
	it('applies a first trigger unconditionally and records its active window', () => {
		const step = makeStep({ restart: 'whenNotActive', delayMs: 100, durationMs: 400 });
		const state = makeApplicationState();

		expect(applyRestartGatedStep(step, 0, state)).toBeTruthy();

		expect(state.activeAnimations.get('el-1')).toBe(step.cssAnimation);
		expect(state.revealedElements.has('el-1')).toBeTruthy();
		expect(state.stepRestartState.get(step)?.activeUntilMs).toBe(500);
	});

	it('blocks a "whenNotActive" retrigger while the previous run is still active, without extending the window', () => {
		const step = makeStep({ restart: 'whenNotActive', delayMs: 0, durationMs: 500 });
		const state = makeApplicationState();

		expect(applyRestartGatedStep(step, 0, state)).toBeTruthy(); // window: [0, 500)
		expect(applyRestartGatedStep(step, 200, state)).toBeFalsy(); // still active: blocked

		// A blocked attempt must not reset the clock forward to 200 + 500 = 700.
		expect(state.stepRestartState.get(step)?.activeUntilMs).toBe(500);
	});

	it('allows a "whenNotActive" retrigger once the previous run has finished', () => {
		const step = makeStep({ restart: 'whenNotActive', delayMs: 0, durationMs: 500 });
		const state = makeApplicationState();

		expect(applyRestartGatedStep(step, 0, state)).toBeTruthy();
		expect(applyRestartGatedStep(step, 500, state)).toBeTruthy(); // no longer active: allowed

		// The window is now re-armed from the second trigger's start time.
		expect(state.stepRestartState.get(step)?.activeUntilMs).toBe(1000);
	});

	it('blocks every retrigger of a "never" step after the first', () => {
		const step = makeStep({ restart: 'never', elementId: 'never-el', presetClass: 'exit' });
		const state = makeApplicationState();

		expect(applyRestartGatedStep(step, 0, state)).toBeTruthy();
		expect(state.exitedElements.has('never-el')).toBeTruthy();

		state.exitedElements.delete('never-el'); // Simulate the element having been revealed again.
		expect(applyRestartGatedStep(step, 10_000, state)).toBeFalsy();
		expect(state.exitedElements.has('never-el')).toBeFalsy(); // not re-applied: stays as simulated.
	});

	it('always applies a command step (empty elementId) regardless of @restart', () => {
		const step = makeStep({ elementId: '', restart: 'never', cssAnimation: '' });
		const state = makeApplicationState();

		expect(applyRestartGatedStep(step, 0, state)).toBeTruthy();
		expect(applyRestartGatedStep(step, 1, state)).toBeTruthy();

		expect(state.activeAnimations.has('')).toBeTruthy();
	});
});
