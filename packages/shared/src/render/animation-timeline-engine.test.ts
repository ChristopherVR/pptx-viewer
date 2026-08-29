import { describe, it, expect } from 'vitest';

import { TimelineEngine } from './animation-timeline-engine';
import { finalizeClickGroup } from './animation-timeline-helpers';
import type {
	AnimationTimeline,
	TimelineClickGroup,
	TimelineStep,
} from './animation-timeline-types';

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

/**
 * Delegates to the real `finalizeClickGroup` (rather than reimplementing its
 * `totalDurationMs` + `seqConcurrent`/`seqNextAction`/`seqPrevAction`
 * aggregation here) so these fixtures behave exactly like `buildTimeline`'s
 * output for the `p:seq` gating tests below.
 */
function makeGroup(steps: TimelineStep[]): TimelineClickGroup {
	return finalizeClickGroup(steps);
}

function makeTimeline(overrides: Partial<AnimationTimeline> = {}): AnimationTimeline {
	return {
		clickGroups: [],
		entranceElementIds: new Set(),
		keyframesCss: '',
		interactiveSequences: new Map(),
		hoverSequences: new Map(),
		...overrides,
	};
}

describe('timelineEngine', () => {
	describe('initial state', () => {
		it('should start with currentGroup at -1', () => {
			const engine = new TimelineEngine(makeTimeline());
			expect(engine.currentGroup).toBe(-1);
		});

		it('should report totalGroups as 0 for empty timeline', () => {
			const engine = new TimelineEngine(makeTimeline());
			expect(engine.totalGroups).toBe(0);
		});

		it('should report hasMoreSteps as false for empty timeline', () => {
			const engine = new TimelineEngine(makeTimeline());
			expect(engine.hasMoreSteps()).toBeFalsy();
		});

		it('should return the timeline via getTimeline', () => {
			const timeline = makeTimeline({ keyframesCss: 'test-css' });
			const engine = new TimelineEngine(timeline);
			expect(engine.getTimeline()).toBe(timeline);
		});
	});

	describe('advance', () => {
		it('should return null when no groups exist', () => {
			const engine = new TimelineEngine(makeTimeline());
			expect(engine.advance()).toBeNull();
		});

		it('should advance to the first group and return it', () => {
			const step = makeStep();
			const group = makeGroup([step]);
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [group] }));

			const result = engine.advance();
			expect(result).toBe(group);
			expect(engine.currentGroup).toBe(0);
		});

		it('should advance through multiple groups sequentially', () => {
			const g1 = makeGroup([makeStep({ elementId: 'a' })]);
			const g2 = makeGroup([makeStep({ elementId: 'b' })]);
			const g3 = makeGroup([makeStep({ elementId: 'c' })]);
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [g1, g2, g3] }));

			expect(engine.advance()).toBe(g1);
			expect(engine.currentGroup).toBe(0);
			expect(engine.advance()).toBe(g2);
			expect(engine.currentGroup).toBe(1);
			expect(engine.advance()).toBe(g3);
			expect(engine.currentGroup).toBe(2);
			expect(engine.advance()).toBeNull();
		});

		it('should return null once all groups are consumed', () => {
			const g = makeGroup([makeStep()]);
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [g] }));
			engine.advance();
			expect(engine.advance()).toBeNull();
			expect(engine.advance()).toBeNull();
		});

		it('should track entrance animations after advance', () => {
			const step = makeStep({ elementId: 'el-1', presetClass: 'entr' });
			const engine = new TimelineEngine(
				makeTimeline({
					clickGroups: [makeGroup([step])],
					entranceElementIds: new Set(['el-1']),
				}),
			);

			expect(engine.isElementVisible('el-1')).toBeFalsy();
			engine.advance();
			expect(engine.isElementVisible('el-1')).toBeTruthy();
		});

		it('should track exit animations after advance', () => {
			const step = makeStep({ elementId: 'el-1', presetClass: 'exit' });
			const engine = new TimelineEngine(
				makeTimeline({
					clickGroups: [makeGroup([step])],
				}),
			);

			expect(engine.isElementVisible('el-1')).toBeTruthy();
			engine.advance();
			expect(engine.isElementVisible('el-1')).toBeFalsy();
		});

		it('should store cssAnimation for the element', () => {
			const step = makeStep({
				elementId: 'el-1',
				cssAnimation: 'pptx-fadeIn 500ms ease',
			});
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [makeGroup([step])] }));

			expect(engine.getElementAnimation('el-1')).toBeUndefined();
			engine.advance();
			expect(engine.getElementAnimation('el-1')).toBe('pptx-fadeIn 500ms ease');
		});
	});

	describe('hasMoreSteps', () => {
		it('should return true when groups remain', () => {
			const engine = new TimelineEngine(
				makeTimeline({ clickGroups: [makeGroup([makeStep()]), makeGroup([makeStep()])] }),
			);
			expect(engine.hasMoreSteps()).toBeTruthy();
			engine.advance();
			expect(engine.hasMoreSteps()).toBeTruthy();
			engine.advance();
			expect(engine.hasMoreSteps()).toBeFalsy();
		});
	});

	describe('isElementVisible', () => {
		it('should return true for elements without entrance animations', () => {
			const engine = new TimelineEngine(makeTimeline());
			expect(engine.isElementVisible('no-anim-element')).toBeTruthy();
		});

		it("should return false for entrance elements that haven't played", () => {
			const engine = new TimelineEngine(makeTimeline({ entranceElementIds: new Set(['el-1']) }));
			expect(engine.isElementVisible('el-1')).toBeFalsy();
		});

		it('should return true for entrance elements after their group plays', () => {
			const step = makeStep({ elementId: 'el-1', presetClass: 'entr' });
			const engine = new TimelineEngine(
				makeTimeline({
					clickGroups: [makeGroup([step])],
					entranceElementIds: new Set(['el-1']),
				}),
			);
			engine.advance();
			expect(engine.isElementVisible('el-1')).toBeTruthy();
		});

		it('should return false for exited elements even without entrance tracking', () => {
			const step = makeStep({ elementId: 'el-1', presetClass: 'exit' });
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [makeGroup([step])] }));
			engine.advance();
			expect(engine.isElementVisible('el-1')).toBeFalsy();
		});

		it('should prioritize exit over entrance', () => {
			// Element has both entrance and exit
			const entrStep = makeStep({ elementId: 'el-1', presetClass: 'entr' });
			const exitStep = makeStep({ elementId: 'el-1', presetClass: 'exit' });
			const engine = new TimelineEngine(
				makeTimeline({
					clickGroups: [makeGroup([entrStep]), makeGroup([exitStep])],
					entranceElementIds: new Set(['el-1']),
				}),
			);

			expect(engine.isElementVisible('el-1')).toBeFalsy(); // entrance not played
			engine.advance(); // entrance
			expect(engine.isElementVisible('el-1')).toBeTruthy();
			engine.advance(); // exit
			expect(engine.isElementVisible('el-1')).toBeFalsy();
		});
	});

	describe('getElementStates', () => {
		it('should return states for all requested element IDs', () => {
			const engine = new TimelineEngine(makeTimeline({ entranceElementIds: new Set(['el-1']) }));

			const states = engine.getElementStates(['el-1', 'el-2']);
			expect(states.size).toBe(2);
			expect(states.get('el-1')!.visible).toBeFalsy();
			expect(states.get('el-1')!.cssAnimation).toBeUndefined();
			expect(states.get('el-2')!.visible).toBeTruthy();
			expect(states.get('el-2')!.cssAnimation).toBeUndefined();
		});

		it('should include css animation after advance', () => {
			const step = makeStep({
				elementId: 'el-1',
				presetClass: 'entr',
				cssAnimation: 'pptx-fadeIn 500ms ease',
			});
			const engine = new TimelineEngine(
				makeTimeline({
					clickGroups: [makeGroup([step])],
					entranceElementIds: new Set(['el-1']),
				}),
			);
			engine.advance();

			const states = engine.getElementStates(['el-1']);
			expect(states.get('el-1')!.visible).toBeTruthy();
			expect(states.get('el-1')!.cssAnimation).toBe('pptx-fadeIn 500ms ease');
		});
	});

	describe('interactive sequences', () => {
		it('should detect interactive sequence triggers', () => {
			const interactiveSequences = new Map<string, TimelineClickGroup[]>();
			interactiveSequences.set('shape-1', [makeGroup([makeStep()])]);

			const engine = new TimelineEngine(makeTimeline({ interactiveSequences }));

			expect(engine.hasInteractiveSequence('shape-1')).toBeTruthy();
			expect(engine.hasInteractiveSequence('shape-2')).toBeFalsy();
		});

		it('should return interactive trigger shape IDs', () => {
			const interactiveSequences = new Map<string, TimelineClickGroup[]>();
			interactiveSequences.set('shape-1', [makeGroup([makeStep()])]);
			interactiveSequences.set('shape-2', [makeGroup([makeStep()])]);

			const engine = new TimelineEngine(makeTimeline({ interactiveSequences }));

			const ids = engine.getInteractiveTriggerShapeIds();
			expect(ids.has('shape-1')).toBeTruthy();
			expect(ids.has('shape-2')).toBeTruthy();
			expect(ids.size).toBe(2);
		});

		it('should advance interactive sequences independently', () => {
			const iStep1 = makeStep({ elementId: 'i-el-1', presetClass: 'entr' });
			const iStep2 = makeStep({ elementId: 'i-el-2', presetClass: 'entr' });
			const interactiveSequences = new Map<string, TimelineClickGroup[]>();
			interactiveSequences.set('btn', [makeGroup([iStep1]), makeGroup([iStep2])]);

			const engine = new TimelineEngine(
				makeTimeline({
					entranceElementIds: new Set(['i-el-1', 'i-el-2']),
					interactiveSequences,
				}),
			);

			expect(engine.isElementVisible('i-el-1')).toBeFalsy();
			const g1 = engine.advanceInteractive('btn');
			expect(g1).not.toBeNull();
			expect(engine.isElementVisible('i-el-1')).toBeTruthy();
			expect(engine.isElementVisible('i-el-2')).toBeFalsy();

			const g2 = engine.advanceInteractive('btn');
			expect(g2).not.toBeNull();
			expect(engine.isElementVisible('i-el-2')).toBeTruthy();

			// No more groups
			expect(engine.advanceInteractive('btn')).toBeNull();
		});

		it('should return null for non-existent interactive trigger', () => {
			const engine = new TimelineEngine(makeTimeline());
			expect(engine.advanceInteractive('no-such-shape')).toBeNull();
		});
	});

	describe('reset', () => {
		it('should restore engine to initial state', () => {
			const step = makeStep({ elementId: 'el-1', presetClass: 'entr' });
			const engine = new TimelineEngine(
				makeTimeline({
					clickGroups: [makeGroup([step])],
					entranceElementIds: new Set(['el-1']),
				}),
			);

			engine.advance();
			expect(engine.currentGroup).toBe(0);
			expect(engine.isElementVisible('el-1')).toBeTruthy();
			expect(engine.getElementAnimation('el-1')).toBeDefined();

			engine.reset();
			expect(engine.currentGroup).toBe(-1);
			expect(engine.isElementVisible('el-1')).toBeFalsy();
			expect(engine.getElementAnimation('el-1')).toBeUndefined();
			expect(engine.hasMoreSteps()).toBeTruthy();
		});

		it('should allow re-advancing after reset', () => {
			const g = makeGroup([makeStep()]);
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [g] }));

			engine.advance();
			expect(engine.hasMoreSteps()).toBeFalsy();

			engine.reset();
			expect(engine.hasMoreSteps()).toBeTruthy();
			expect(engine.advance()).toBe(g);
		});

		it('should also reset interactive sequence state', () => {
			const iStep = makeStep({ elementId: 'i-el', presetClass: 'entr' });
			const interactiveSequences = new Map<string, TimelineClickGroup[]>();
			interactiveSequences.set('btn', [makeGroup([iStep])]);

			const engine = new TimelineEngine(
				makeTimeline({
					entranceElementIds: new Set(['i-el']),
					interactiveSequences,
				}),
			);

			engine.advanceInteractive('btn');
			expect(engine.isElementVisible('i-el')).toBeTruthy();
			expect(engine.advanceInteractive('btn')).toBeNull();

			engine.reset();
			expect(engine.isElementVisible('i-el')).toBeFalsy();
			// Can advance again
			expect(engine.advanceInteractive('btn')).not.toBeNull();
		});
	});

	describe('staged-build + colour-target metadata', () => {
		it('surfaces the build descriptor with progress advancing over time', () => {
			const step = makeStep({
				elementId: 'chart-1',
				delayMs: 100,
				durationMs: 400,
				build: { kind: 'chart', mode: 'byCategory' },
			});
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [makeGroup([step])] }));
			engine.advance();

			// Before elapsed time is known, the build reads as fully revealed.
			const atRest = engine.getElementStates(['chart-1']).get('chart-1');
			expect(atRest?.build).toStrictEqual({ kind: 'chart', mode: 'byCategory', progress: 1 });

			const early = engine.getElementStates(['chart-1'], { elapsedMs: 100 }).get('chart-1');
			const mid = engine.getElementStates(['chart-1'], { elapsedMs: 300 }).get('chart-1');
			const done = engine.getElementStates(['chart-1'], { elapsedMs: 500 }).get('chart-1');
			expect(early?.build?.progress).toBe(0);
			expect(mid?.build?.progress).toBeCloseTo(0.5, 5);
			expect(done?.build?.progress).toBe(1);
			expect(mid?.build?.progress ?? 0).toBeGreaterThan(early?.build?.progress ?? -1);
		});

		it('leaves build undefined for a plain whole-element entrance', () => {
			const step = makeStep({ elementId: 'plain-1' });
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [makeGroup([step])] }));
			engine.advance();
			const state = engine.getElementStates(['plain-1']).get('plain-1');
			expect(state?.build).toBeUndefined();
			expect(state?.animatesFill).toBeUndefined();
			expect(state?.animatesStroke).toBeUndefined();
		});

		it('flags animatesFill / animatesStroke from a step colour target', () => {
			const fillStep = makeStep({
				elementId: 'fill-shape',
				presetClass: 'emph',
				colorTargets: ['fill'],
			});
			const strokeStep = makeStep({
				elementId: 'stroke-shape',
				presetClass: 'emph',
				colorTargets: ['stroke'],
			});
			const engine = new TimelineEngine(
				makeTimeline({ clickGroups: [makeGroup([fillStep, strokeStep])] }),
			);
			engine.advance();
			const states = engine.getElementStates(['fill-shape', 'stroke-shape']);
			expect(states.get('fill-shape')?.animatesFill).toBeTruthy();
			expect(states.get('fill-shape')?.animatesStroke).toBeUndefined();
			expect(states.get('stroke-shape')?.animatesStroke).toBeTruthy();
			expect(states.get('stroke-shape')?.animatesFill).toBeUndefined();
		});

		it('resets staged metadata on reset()', () => {
			const step = makeStep({
				elementId: 'chart-1',
				build: { kind: 'diagram', mode: 'byLvl' },
				colorTargets: ['fill'],
			});
			const engine = new TimelineEngine(makeTimeline({ clickGroups: [makeGroup([step])] }));
			engine.advance();
			expect(engine.getElementStates(['chart-1']).get('chart-1')?.build).toBeDefined();
			engine.reset();
			const state = engine.getElementStates(['chart-1']).get('chart-1');
			expect(state?.build).toBeUndefined();
			expect(state?.animatesFill).toBeUndefined();
		});
	});
});

describe('p:seq @concurrent / @nextAc (advance gating)', () => {
	it('swallows a rapid re-advance while a non-concurrent group with nextAc="none" is active', () => {
		const g1 = makeGroup([makeStep({ elementId: 'a', durationMs: 1000, seqNextAction: 'none' })]);
		const g2 = makeGroup([makeStep({ elementId: 'b' })]);
		const engine = new TimelineEngine(makeTimeline({ clickGroups: [g1, g2] }));

		expect(engine.advance(0)).toBe(g1);
		// Pressing "next" again 200ms later, while g1 is still active (1000ms), is
		// swallowed: this must be a TRUTHY empty group, not `null`. A binding
		// treats `null` as "nothing left on this slide" and falls through to
		// slide navigation (see React's `useSlideNavigation`), so returning
		// `null` here would incorrectly skip to the next slide instead of
		// waiting for g1 to finish.
		const blocked = engine.advance(200);
		expect(blocked).not.toBeNull();
		expect(blocked?.steps).toHaveLength(0);
		expect(engine.currentGroup).toBe(0);
		// Once g1's active window elapses, the same press succeeds.
		expect(engine.advance(1000)).toBe(g2);
		expect(engine.currentGroup).toBe(1);
	});

	it('does not block when the group is concurrent, even with nextAc="none"', () => {
		const g1 = makeGroup([
			makeStep({ elementId: 'a', durationMs: 1000, seqConcurrent: true, seqNextAction: 'none' }),
		]);
		const g2 = makeGroup([makeStep({ elementId: 'b' })]);
		const engine = new TimelineEngine(makeTimeline({ clickGroups: [g1, g2] }));

		expect(engine.advance(0)).toBe(g1);
		expect(engine.advance(50)).toBe(g2);
	});

	it('does not block when nextAc is "seek" or absent (PowerPoint default: finish in place)', () => {
		const g1 = makeGroup([makeStep({ elementId: 'a', durationMs: 1000, seqNextAction: 'seek' })]);
		const g2 = makeGroup([makeStep({ elementId: 'b' })]);
		const g3 = makeGroup([makeStep({ elementId: 'c' })]);
		const engine = new TimelineEngine(makeTimeline({ clickGroups: [g1, g2, g3] }));

		expect(engine.advance(0)).toBe(g1);
		expect(engine.advance(50)).toBe(g2); // seqNextAction "seek": never swallowed.
		expect(engine.advance(60)).toBe(g3); // g2 has no seq attrs at all: unaffected default.
	});

	it('applies the same gating to interactive sequences', () => {
		const interactiveSequences = new Map<string, TimelineClickGroup[]>();
		interactiveSequences.set('btn', [
			makeGroup([makeStep({ elementId: 'a', durationMs: 1000, seqNextAction: 'none' })]),
			makeGroup([makeStep({ elementId: 'b' })]),
		]);
		const engine = new TimelineEngine(makeTimeline({ interactiveSequences }));

		expect(engine.advanceInteractive('btn', 0)).not.toBeNull();
		const blocked = engine.advanceInteractive('btn', 100);
		expect(blocked).not.toBeNull(); // consumed, not "exhausted"
		expect(blocked?.steps).toHaveLength(0);
		expect(engine.advanceInteractive('btn', 1000)).not.toBeNull();
	});

	it('restarts an interactive sequence only when endSync marks it replayable', () => {
		const group = makeGroup([makeStep({ elementId: 'a' })]);
		const interactiveSequences = new Map([['btn', [group]]]);
		const restartableInteractiveSequences = new Set(['btn']);
		const engine = new TimelineEngine(
			makeTimeline({ interactiveSequences, restartableInteractiveSequences }),
		);

		expect(engine.advanceInteractive('btn', 0)).toBe(group);
		expect(engine.advanceInteractive('btn', 1000)).toBe(group);
	});

	it('leaves an interactive sequence exhausted without endSync replay', () => {
		const group = makeGroup([makeStep({ elementId: 'a' })]);
		const engine = new TimelineEngine(
			makeTimeline({ interactiveSequences: new Map([['btn', [group]]]) }),
		);

		expect(engine.advanceInteractive('btn', 0)).toBe(group);
		expect(engine.advanceInteractive('btn', 1000)).toBeNull();
	});

	it('a blocked advance never falls through as "exhausted" even on the LAST group', () => {
		// Regression guard: with only one group, a naive implementation could
		// conflate "blocked, try again later" with "nextIndex out of range,
		// truly done" since both would otherwise return `null`.
		const g1 = makeGroup([makeStep({ elementId: 'a', durationMs: 1000, seqNextAction: 'none' })]);
		const engine = new TimelineEngine(makeTimeline({ clickGroups: [g1] }));

		expect(engine.advance(0)).toBe(g1);
		const blocked = engine.advance(100);
		expect(blocked).not.toBeNull();
		expect(blocked?.steps).toHaveLength(0);
		// Once g1 finishes, advancing again correctly reports genuine exhaustion.
		expect(engine.advance(1000)).toBeNull();
	});
});

describe('p:seq @prevAc (resetHover gating)', () => {
	it('defers resetHover while the active group has prevAc="none"', () => {
		const hoverSequences = new Map<string, TimelineClickGroup[]>();
		hoverSequences.set('shape', [
			makeGroup([makeStep({ elementId: 'a', durationMs: 1000, seqPrevAction: 'none' })]),
		]);
		const engine = new TimelineEngine(makeTimeline({ hoverSequences }));

		expect(engine.advanceHover('shape', 0)).not.toBeNull();
		// Mouse leaves at 200ms, while the effect is still active: deferred.
		engine.resetHover('shape', 200);
		expect(engine.advanceHover('shape', 250)).toBeNull(); // still index 0, no more groups from there

		// Once the effect finishes, the reset is allowed and hover can replay.
		engine.resetHover('shape', 1000);
		expect(engine.advanceHover('shape', 1001)).not.toBeNull();
	});

	it('resets immediately when prevAc is "skipTimeNode" or absent (original behaviour)', () => {
		const hoverSequences = new Map<string, TimelineClickGroup[]>();
		hoverSequences.set('shape', [makeGroup([makeStep({ elementId: 'a', durationMs: 1000 })])]);
		const engine = new TimelineEngine(makeTimeline({ hoverSequences }));

		expect(engine.advanceHover('shape', 0)).not.toBeNull();
		engine.resetHover('shape', 50); // well within the 1000ms window
		expect(engine.advanceHover('shape', 51)).not.toBeNull(); // replays immediately
	});
});

describe('p:cTn @restart (re-trigger gating)', () => {
	// A binding's playback loop (React's `applyAnimationGroupSteps` and its
	// Vue/Angular/Svelte/Vanilla equivalents) applies CSS and schedules cleanup
	// purely from the RETURNED group's `steps`, so the decisive proof that a
	// re-trigger was blocked is that the blocked step is absent from that list
	// (not merely that the internal bookkeeping Maps hold an unchanged value,
	// which would look identical whether the step reapplied or not).

	it('"whenNotActive" strips the step from the returned group while its effect is still playing', () => {
		const hoverSequences = new Map<string, TimelineClickGroup[]>();
		hoverSequences.set('shape', [
			makeGroup([makeStep({ elementId: 'a', durationMs: 500, restart: 'whenNotActive' })]),
		]);
		const engine = new TimelineEngine(makeTimeline({ hoverSequences }));

		const first = engine.advanceHover('shape', 0);
		expect(first?.steps).toHaveLength(1);

		// Hover out and back in quickly, well inside the 500ms window.
		engine.resetHover('shape', 50);
		const blocked = engine.advanceHover('shape', 100);
		expect(blocked?.steps).toHaveLength(0); // blocked: nothing for a binding to (re)apply

		// Once the effect's window elapses, a fresh hover restarts it for real.
		engine.resetHover('shape', 500);
		const restarted = engine.advanceHover('shape', 500);
		expect(restarted?.steps).toHaveLength(1);
	});

	it('"never" strips the step from every subsequent trigger, active or not', () => {
		const hoverSequences = new Map<string, TimelineClickGroup[]>();
		hoverSequences.set('shape', [makeGroup([makeStep({ elementId: 'a', restart: 'never' })])]);
		const engine = new TimelineEngine(makeTimeline({ hoverSequences }));

		expect(engine.advanceHover('shape', 0)?.steps).toHaveLength(1);

		engine.resetHover('shape', 10_000); // long after the effect finished
		expect(engine.advanceHover('shape', 10_000)?.steps).toHaveLength(0);
	});

	it('"always" (or absent) keeps the step in every returned group, unchanged', () => {
		const hoverSequences = new Map<string, TimelineClickGroup[]>();
		hoverSequences.set('shape', [makeGroup([makeStep({ elementId: 'a', durationMs: 1000 })])]);
		const engine = new TimelineEngine(makeTimeline({ hoverSequences }));

		expect(engine.advanceHover('shape', 0)?.steps).toHaveLength(1);
		engine.resetHover('shape', 50); // well inside the 1000ms window
		expect(engine.advanceHover('shape', 60)?.steps).toHaveLength(1); // still restarts
	});

	it('leaves the returned group reference untouched when nothing is blocked', () => {
		const g1 = makeGroup([makeStep({ elementId: 'a' })]);
		const engine = new TimelineEngine(makeTimeline({ clickGroups: [g1] }));
		expect(engine.advance(0)).toBe(g1);
	});

	it('reset() clears restart state so the slide replays cleanly', () => {
		const step = makeStep({ elementId: 'a', durationMs: 1000, restart: 'never' });
		const engine = new TimelineEngine(makeTimeline({ clickGroups: [makeGroup([step])] }));

		expect(engine.advance(0)?.steps).toHaveLength(1);

		engine.reset();
		expect(engine.advance(0)?.steps).toHaveLength(1);
	});
});

describe('completeAll', () => {
	it('reveals every entrance and applies every exit with nothing animating', () => {
		const engine = new TimelineEngine(
			makeTimeline({
				clickGroups: [
					makeGroup([makeStep({ elementId: 'a', presetClass: 'entr' })]),
					makeGroup([makeStep({ elementId: 'b', presetClass: 'entr' })]),
					makeGroup([makeStep({ elementId: 'a', presetClass: 'exit' })]),
				],
				entranceElementIds: new Set(['a', 'b']),
			}),
		);

		engine.completeAll();

		// `b` entered and stayed; `a` entered then exited.
		expect(engine.isElementVisible('b')).toBeTruthy();
		expect(engine.isElementVisible('a')).toBeFalsy();
		// Nothing is left animating: a slide entered backward is static.
		expect(engine.getElementAnimation('a')).toBeUndefined();
		expect(engine.getElementAnimation('b')).toBeUndefined();
		// The timeline is spent, so a forward press leaves the slide.
		expect(engine.hasMoreSteps()).toBeFalsy();
	});

	it('is undone by reset, so the slide can replay', () => {
		const engine = new TimelineEngine(
			makeTimeline({
				clickGroups: [makeGroup([makeStep({ elementId: 'a', presetClass: 'entr' })])],
				entranceElementIds: new Set(['a']),
			}),
		);

		engine.completeAll();
		expect(engine.isElementVisible('a')).toBeTruthy();

		engine.reset();
		expect(engine.isElementVisible('a')).toBeFalsy();
		expect(engine.hasMoreSteps()).toBeTruthy();
	});
});

describe('p:excl exclusivity (exclGroupId)', () => {
	it('stops the previous holder of the same exclGroupId when a new one starts', () => {
		const engine = new TimelineEngine(
			makeTimeline({
				clickGroups: [
					makeGroup([makeStep({ elementId: 'a', presetClass: 'emph', exclGroupId: 1 })]),
					makeGroup([makeStep({ elementId: 'b', presetClass: 'emph', exclGroupId: 1 })]),
				],
			}),
		);

		engine.advance();
		expect(engine.getElementAnimation('a')).toBeDefined();

		engine.advance();
		// `b` starting in the SAME exclusive group stops `a`'s running effect.
		expect(engine.getElementAnimation('a')).toBeUndefined();
		expect(engine.getElementAnimation('b')).toBeDefined();
	});

	it('does not stop an element in a DIFFERENT exclGroupId', () => {
		const engine = new TimelineEngine(
			makeTimeline({
				clickGroups: [
					makeGroup([makeStep({ elementId: 'a', presetClass: 'emph', exclGroupId: 1 })]),
					makeGroup([makeStep({ elementId: 'b', presetClass: 'emph', exclGroupId: 2 })]),
				],
			}),
		);

		engine.advance();
		engine.advance();
		expect(engine.getElementAnimation('a')).toBeDefined();
		expect(engine.getElementAnimation('b')).toBeDefined();
	});

	it('does not affect an entrance-revealed element: stopping the effect leaves it visible', () => {
		const engine = new TimelineEngine(
			makeTimeline({
				clickGroups: [
					makeGroup([makeStep({ elementId: 'a', presetClass: 'entr', exclGroupId: 1 })]),
					makeGroup([makeStep({ elementId: 'b', presetClass: 'emph', exclGroupId: 1 })]),
				],
				entranceElementIds: new Set(['a']),
			}),
		);

		engine.advance();
		engine.advance();
		expect(engine.getElementAnimation('a')).toBeUndefined();
		expect(engine.isElementVisible('a')).toBeTruthy();
	});

	it('leaves non-exclusive steps (no exclGroupId) unaffected by each other', () => {
		const engine = new TimelineEngine(
			makeTimeline({
				clickGroups: [
					makeGroup([makeStep({ elementId: 'a', presetClass: 'emph' })]),
					makeGroup([makeStep({ elementId: 'b', presetClass: 'emph' })]),
				],
			}),
		);

		engine.advance();
		engine.advance();
		expect(engine.getElementAnimation('a')).toBeDefined();
		expect(engine.getElementAnimation('b')).toBeDefined();
	});
});
