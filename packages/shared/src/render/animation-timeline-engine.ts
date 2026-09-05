/**
 * `animation-timeline-engine` — `TimelineEngine`, a pure stateful controller
 * that tracks which click-group is active and computes per-element visibility +
 * active CSS animation. No DOM, no RAF; the binding drives `advance()` from its
 * own playback loop and applies the resulting CSS.
 *
 * @module render/animation-timeline-engine
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { applyStepBuildMetadata } from './animation-build';
import type { ElementBuildStateOptions } from './animation-build';
import {
	applyRestartGatedStep,
	EMPTY_CLICK_GROUP,
	shouldBlockNextAdvance,
	shouldBlockReset,
} from './animation-sequence-gating';
import type { StepRestartState } from './animation-sequence-gating';
import { buildTimeline } from './animation-timeline-builder';
import type {
	AnimationTimeline,
	TimelineClickGroup,
	TimelineStep,
	ElementAnimationState,
	ChartBuildMode,
} from './animation-timeline-types';
import { collectChartBuildInfo, resolveChartRevealDescriptor } from './chart-reveal-descriptor';

/**
 * Options for {@link TimelineEngine.getElementStates}. Re-exported alias of
 * {@link ElementBuildStateOptions} so callers can import it from the engine.
 */
export type ElementStatesOptions = ElementBuildStateOptions;

// ==========================================================================
// TimelineEngine — stateful playback controller
// ==========================================================================

/**
 * Stateful engine that tracks which click-group we are on and
 * which elements should be visible/animated/hidden.
 */
export class TimelineEngine {
	private readonly timeline: AnimationTimeline;
	private currentGroupIndex: number;
	/**
	 * Map of elementId → CSS animation string for all animations
	 * that have been triggered so far (cumulative).
	 */
	private readonly activeAnimations: Map<string, string>;
	/**
	 * Map of elementId → the most recently applied step carrying a staged-build
	 * or colour-target descriptor. Used to surface `build` / `animatesFill` /
	 * `animatesStroke` on {@link ElementAnimationState}.
	 */
	private readonly activeSteps: Map<string, TimelineStep>;
	/**
	 * Cumulative (oldest-first) history of fired chart-build steps per element,
	 * keyed by elementId. See {@link StepApplicationState.chartRevealHistory}
	 * (`animation-sequence-gating`) for why this is separate from
	 * {@link activeSteps}: a per-series/per-category build fires ONE step per
	 * stage against the SAME chart elementId, so only a full history (not just
	 * the latest) lets `getElementStates` derive the authored reveal set.
	 */
	private readonly chartRevealHistory: Map<string, TimelineStep[]>;
	/**
	 * Each chart element's static build mode + `animateBackground` flag,
	 * collected once from the timeline (authored constants, not playback
	 * state). See `chart-reveal-descriptor`'s `collectChartBuildInfo`.
	 */
	private readonly chartBuildInfo: ReadonlyMap<
		string,
		{ mode: ChartBuildMode; animateBackground: boolean }
	>;
	/**
	 * Set of element IDs whose entrance animation has played.
	 * These elements become visible.
	 */
	private readonly revealedElements: Set<string>;
	/**
	 * Set of element IDs whose exit animation has played.
	 * These elements become hidden after animation.
	 */
	private readonly exitedElements: Set<string>;
	/**
	 * Tracks the current click-group index for each interactive sequence
	 * (keyed by trigger shape ID).
	 */
	private readonly interactiveGroupIndexes: Map<string, number>;
	/**
	 * Tracks the current click-group index for each hover sequence
	 * (keyed by trigger shape ID).
	 */
	private readonly hoverGroupIndexes: Map<string, number>;
	/**
	 * Wall-clock time (from the `nowMs` passed to `advance`) that the current
	 * main-sequence click-group started, or `undefined` before the first
	 * advance. Read by {@link shouldBlockNextAdvance} to honour `@concurrent`
	 * / `@nextAc`.
	 */
	private mainGroupStartedAtMs: number | undefined;
	/** Same as {@link mainGroupStartedAtMs}, one entry per interactive sequence. */
	private readonly interactiveGroupStartedAtMs: Map<string, number>;
	/** Same as {@link mainGroupStartedAtMs}, one entry per hover sequence. */
	private readonly hoverGroupStartedAtMs: Map<string, number>;
	/**
	 * Per-step `@restart` runtime state (ECMA-376 S19.5.27), keyed by object
	 * identity: the same {@link TimelineStep} object is reused across repeated
	 * `advance`/`advanceInteractive`/`advanceHover` calls (it lives in the
	 * precomputed {@link AnimationTimeline}), so identity is a stable key
	 * without needing a synthetic id on the step itself.
	 */
	private stepRestartState: WeakMap<TimelineStep, StepRestartState>;
	/**
	 * Tracks which element currently "holds" each `p:excl` group (exclGroupId
	 * -> elementId). When a new exclusive step starts, any other element
	 * holding the SAME group has its running animation stopped: ECMA-376
	 * S19.5.24 CT_TLExclusiveTimeNode allows at most one child of an
	 * exclusive container to play at a time.
	 */
	private readonly exclusiveHolders: Map<number, string>;

	public constructor(timeline: AnimationTimeline) {
		this.timeline = timeline;
		this.currentGroupIndex = -1;
		this.activeAnimations = new Map();
		this.activeSteps = new Map();
		this.chartRevealHistory = new Map();
		this.chartBuildInfo = collectChartBuildInfo(timeline);
		this.revealedElements = new Set();
		this.exitedElements = new Set();
		this.interactiveGroupIndexes = new Map();
		this.hoverGroupIndexes = new Map();
		this.interactiveGroupStartedAtMs = new Map();
		this.hoverGroupStartedAtMs = new Map();
		this.stepRestartState = new WeakMap();
		this.exclusiveHolders = new Map();
	}

	/** Build a TimelineEngine from a slide's native animations. */
	public static fromAnimations(
		nativeAnimations: ReadonlyArray<PptxNativeAnimation>,
	): TimelineEngine {
		return new TimelineEngine(buildTimeline(nativeAnimations));
	}

	/** The underlying timeline data. */
	public getTimeline(): AnimationTimeline {
		return this.timeline;
	}

	/** True if there are more click-groups to play. */
	public hasMoreSteps(): boolean {
		return this.currentGroupIndex < this.timeline.clickGroups.length - 1;
	}

	/** Total number of click-groups. */
	public get totalGroups(): number {
		return this.timeline.clickGroups.length;
	}

	/** Index of the current click-group (-1 = not started). */
	public get currentGroup(): number {
		return this.currentGroupIndex;
	}

	/**
	 * Advance to the next click-group.
	 *
	 * Returns `null` only when genuinely exhausted (no groups at all, or
	 * already at the last one) - every binding falls through to slide
	 * navigation on `null`, which is correct there. When the currently-active
	 * group's `@concurrent`/`@nextAc` (ECMA-376 S19.5.60) say this advance
	 * should be swallowed instead (see {@link shouldBlockNextAdvance}), this
	 * returns {@link EMPTY_CLICK_GROUP} - a truthy, no-op group - so the click
	 * still reads as "consumed here" rather than "nothing left, leave the
	 * slide". `nowMs` defaults to `Date.now()`; a caller passes it explicitly
	 * to test the gating deterministically.
	 */
	public advance(nowMs: number = Date.now()): TimelineClickGroup | null {
		const result = this.advanceSequenceGroup(
			this.timeline.clickGroups,
			this.currentGroupIndex,
			this.mainGroupStartedAtMs,
			nowMs,
		);
		if (result === 'exhausted') {
			return null;
		}
		if (result === 'blocked') {
			return EMPTY_CLICK_GROUP;
		}

		this.currentGroupIndex = result.nextIndex;
		this.mainGroupStartedAtMs = nowMs;

		return this.applyGroupSteps(result.group, nowMs);
	}

	/**
	 * Shared "advance one click-group forward within a track" logic used by
	 * {@link advance}, {@link advanceInteractive} and {@link advanceHover}: each
	 * owns its own group list, current index, and start-time, but the gating
	 * and index arithmetic are identical.
	 *
	 * `'blocked'` and `'exhausted'` are kept distinct (rather than both
	 * collapsing to `null`) because the caller must react differently: a
	 * blocked advance was consumed (return {@link EMPTY_CLICK_GROUP}, index
	 * unchanged so a later call can genuinely advance), while an exhausted one
	 * genuinely has nothing left (return `null`).
	 */
	private advanceSequenceGroup(
		groups: readonly TimelineClickGroup[] | undefined,
		currentIndex: number,
		startedAtMs: number | undefined,
		nowMs: number,
	): { group: TimelineClickGroup; nextIndex: number } | 'blocked' | 'exhausted' {
		if (!groups || groups.length === 0) {
			return 'exhausted';
		}
		const activeGroup = currentIndex >= 0 ? groups[currentIndex] : undefined;
		if (shouldBlockNextAdvance(activeGroup, startedAtMs, nowMs)) {
			return 'blocked';
		}
		const nextIndex = currentIndex + 1;
		if (nextIndex >= groups.length) {
			return 'exhausted';
		}
		return { group: groups[nextIndex], nextIndex };
	}

	/**
	 * Peek at the next click-group without advancing.
	 * Returns the next group or `null` if no more groups remain.
	 */
	public peekNext(): TimelineClickGroup | null {
		const nextIdx = this.currentGroupIndex + 1;
		if (nextIdx >= this.timeline.clickGroups.length) {
			return null;
		}
		return this.timeline.clickGroups[nextIdx];
	}

	/**
	 * Check if the next click-group should auto-advance (play automatically
	 * without requiring a click).
	 */
	public shouldAutoAdvance(): boolean {
		const next = this.peekNext();
		return next?.autoAdvance === true;
	}

	/**
	 * Get the auto-advance delay for the next group (ms).
	 * Returns 0 if the next group is not auto-advance or doesn't exist.
	 */
	public getAutoAdvanceDelay(): number {
		const next = this.peekNext();
		if (!next?.autoAdvance) {
			return 0;
		}
		return next.autoAdvanceDelayMs ?? 0;
	}

	/**
	 * Returns whether an element should be visible given the current
	 * timeline state.
	 *
	 * - Elements without entrance animations: always visible.
	 * - Elements with entrance animations: hidden until their entrance
	 *   click-group has been reached.
	 * - Elements with exit animations that have played: hidden.
	 */
	public isElementVisible(elementId: string): boolean {
		// Exit completed → hidden
		if (this.exitedElements.has(elementId)) {
			return false;
		}

		// Has entrance animation but hasn't played yet → hidden
		if (this.timeline.entranceElementIds.has(elementId) && !this.revealedElements.has(elementId)) {
			return false;
		}

		return true;
	}

	/**
	 * Returns the CSS animation string for an element if one is currently
	 * active, or `undefined`.
	 */
	public getElementAnimation(elementId: string): string | undefined {
		return this.activeAnimations.get(elementId);
	}

	/**
	 * Build a snapshot of the current animation state for all elements.
	 * Returns a map: elementId → { visible, cssAnimation }.
	 */
	public getElementStates(
		elementIds: ReadonlyArray<string>,
		options?: ElementStatesOptions,
	): Map<string, ElementAnimationState> {
		const states = new Map<string, ElementAnimationState>();
		for (const id of elementIds) {
			const state: ElementAnimationState = {
				visible: this.isElementVisible(id),
				cssAnimation: this.activeAnimations.get(id),
			};
			applyStepBuildMetadata(state, this.activeSteps.get(id), options);
			const chartInfo = this.chartBuildInfo.get(id);
			if (chartInfo) {
				const descriptor = resolveChartRevealDescriptor(
					this.chartRevealHistory.get(id) ?? [],
					chartInfo.animateBackground,
				);
				if (descriptor) {
					state.chartReveal = { mode: chartInfo.mode, descriptor };
				}
			}
			states.set(id, state);
		}
		return states;
	}

	/**
	 * Check whether a shape ID is a trigger for an interactive sequence.
	 */
	public hasInteractiveSequence(shapeId: string): boolean {
		return this.timeline.interactiveSequences.has(shapeId);
	}

	/**
	 * Get all shape IDs that are interactive sequence triggers.
	 */
	public getInteractiveTriggerShapeIds(): ReadonlySet<string> {
		return new Set(this.timeline.interactiveSequences.keys());
	}

	/**
	 * Check whether a shape ID is a trigger for a hover sequence.
	 */
	public hasHoverSequence(shapeId: string): boolean {
		return this.timeline.hoverSequences.has(shapeId);
	}

	/**
	 * Get all shape IDs that are hover sequence triggers.
	 */
	public getHoverTriggerShapeIds(): ReadonlySet<string> {
		return new Set(this.timeline.hoverSequences.keys());
	}

	/**
	 * Advance the interactive sequence for a given trigger shape.
	 *
	 * Returns `null` only when genuinely exhausted; a request swallowed by
	 * `@concurrent`/`@nextAc` instead returns {@link EMPTY_CLICK_GROUP} (see
	 * {@link advance}'s doc for why the distinction matters to a caller).
	 */
	public advanceInteractive(
		triggerShapeId: string,
		nowMs: number = Date.now(),
	): TimelineClickGroup | null {
		const groups = this.timeline.interactiveSequences.get(triggerShapeId);
		const currentIdx = this.interactiveGroupIndexes.get(triggerShapeId) ?? -1;
		let result = this.advanceSequenceGroup(
			groups,
			currentIdx,
			this.interactiveGroupStartedAtMs.get(triggerShapeId),
			nowMs,
		);
		if (result === 'exhausted') {
			if (!this.timeline.restartableInteractiveSequences?.has(triggerShapeId)) {
				return null;
			}
			result = this.advanceSequenceGroup(groups, -1, undefined, nowMs);
			if (result === 'exhausted') {
				return null;
			}
		}
		if (result === 'blocked') {
			return EMPTY_CLICK_GROUP;
		}

		this.interactiveGroupIndexes.set(triggerShapeId, result.nextIndex);
		this.interactiveGroupStartedAtMs.set(triggerShapeId, nowMs);

		return this.applyGroupSteps(result.group, nowMs);
	}

	/**
	 * Advance the hover sequence for a given trigger shape.
	 *
	 * Returns `null` only when genuinely exhausted; a request swallowed by
	 * `@concurrent`/`@nextAc` instead returns {@link EMPTY_CLICK_GROUP} (see
	 * {@link advance}'s doc for why the distinction matters to a caller).
	 */
	public advanceHover(
		triggerShapeId: string,
		nowMs: number = Date.now(),
	): TimelineClickGroup | null {
		const groups = this.timeline.hoverSequences.get(triggerShapeId);
		const currentIdx = this.hoverGroupIndexes.get(triggerShapeId) ?? -1;
		const result = this.advanceSequenceGroup(
			groups,
			currentIdx,
			this.hoverGroupStartedAtMs.get(triggerShapeId),
			nowMs,
		);
		if (result === 'exhausted') {
			return null;
		}
		if (result === 'blocked') {
			return EMPTY_CLICK_GROUP;
		}

		this.hoverGroupIndexes.set(triggerShapeId, result.nextIndex);
		this.hoverGroupStartedAtMs.set(triggerShapeId, nowMs);

		return this.applyGroupSteps(result.group, nowMs);
	}

	/**
	 * Reset the hover sequence for a given trigger shape so it can replay on
	 * the next hover, UNLESS the sequence's most recently played group is still
	 * active and its `@prevAc` (ECMA-376 S19.5.60) says not to back out of it
	 * yet - see {@link shouldBlockReset}. `nowMs` defaults to `Date.now()`.
	 */
	public resetHover(triggerShapeId: string, nowMs: number = Date.now()): void {
		const groups = this.timeline.hoverSequences.get(triggerShapeId);
		const currentIdx = this.hoverGroupIndexes.get(triggerShapeId) ?? -1;
		const activeGroup = groups && currentIdx >= 0 ? groups[currentIdx] : undefined;
		if (shouldBlockReset(activeGroup, this.hoverGroupStartedAtMs.get(triggerShapeId), nowMs)) {
			return;
		}
		this.hoverGroupIndexes.delete(triggerShapeId);
		this.hoverGroupStartedAtMs.delete(triggerShapeId);
	}

	/**
	 * Jump to the END of the timeline: every click-group counted as played, every
	 * entrance revealed and every exit applied, with no CSS animation attached so
	 * nothing replays.
	 *
	 * This is what PowerPoint shows when you step BACKWARD onto a slide: it
	 * appears with its builds already complete, and a further back press walks
	 * them off again. Re-running the timeline from zero instead made a deck whose
	 * opening build auto-starts restart its animation every time the presenter
	 * stepped back onto it.
	 */
	public completeAll(): void {
		this.reset();
		for (const group of this.timeline.clickGroups) {
			for (const step of group.steps) {
				if (step.build || step.colorTargets) {
					this.activeSteps.set(step.elementId, step);
				}
				if (step.build?.kind === 'chart') {
					const history = this.chartRevealHistory.get(step.elementId) ?? [];
					history.push(step);
					this.chartRevealHistory.set(step.elementId, history);
				}
				if (step.presetClass === 'entr') {
					this.revealedElements.add(step.elementId);
				}
				if (step.presetClass === 'exit') {
					this.exitedElements.add(step.elementId);
				}
			}
		}
		this.currentGroupIndex = this.timeline.clickGroups.length - 1;
	}

	/**
	 * Reset the engine to its initial state (no animations played).
	 */
	public reset(): void {
		this.currentGroupIndex = -1;
		this.activeAnimations.clear();
		this.activeSteps.clear();
		this.chartRevealHistory.clear();
		this.revealedElements.clear();
		this.exitedElements.clear();
		this.interactiveGroupIndexes.clear();
		this.hoverGroupIndexes.clear();
		this.mainGroupStartedAtMs = undefined;
		this.interactiveGroupStartedAtMs.clear();
		this.hoverGroupStartedAtMs.clear();
		// WeakMap has no `.clear()`; a slide reset means nothing has played, so
		// every step's `@restart` state (active-window / played-once) starts over.
		this.stepRestartState = new WeakMap();
		this.exclusiveHolders.clear();
	}

	/**
	 * Apply a group's steps to the internal tracking state, honouring each
	 * step's `@restart` (see {@link applyRestartGatedStep}), and return the
	 * EFFECTIVE group: one whose `steps` omits any step a `@restart` block skipped.
	 *
	 * Every binding's playback loop (React's `applyAnimationGroupSteps` and its
	 * Vue/Angular/Svelte/Vanilla equivalents) applies CSS and schedules cleanup
	 * timers purely from the group `advance`/`advanceInteractive`/`advanceHover`
	 * hand back, so a blocked step must never reach that list - otherwise a
	 * binding would re-apply (and re-schedule cleanup for) an effect the deck
	 * said must not restart, even though this engine's own bookkeeping already
	 * refused it. When nothing was blocked (by far the common case, since most
	 * decks never set `@restart`), the original `group` reference is returned
	 * unchanged.
	 */
	private applyGroupSteps(group: TimelineClickGroup, nowMs: number): TimelineClickGroup {
		let appliedSteps: TimelineStep[] | undefined;
		for (let i = 0; i < group.steps.length; i++) {
			const step = group.steps[i];
			const applied = applyRestartGatedStep(step, nowMs, {
				stepRestartState: this.stepRestartState,
				activeAnimations: this.activeAnimations,
				activeSteps: this.activeSteps,
				revealedElements: this.revealedElements,
				exitedElements: this.exitedElements,
				chartRevealHistory: this.chartRevealHistory,
			});
			if (!applied) {
				appliedSteps ??= group.steps.slice(0, i);
				continue;
			}
			if (step.exclGroupId !== undefined) {
				const holder = this.exclusiveHolders.get(step.exclGroupId);
				// Starting this effect stops any OTHER element's currently-running
				// effect from the same `p:excl` container (CT_TLExclusiveTimeNode
				// allows only one active child at a time). The held element's
				// visibility/build bookkeeping is untouched: an emphasis stopping
				// mid-loop just leaves the element in its resting appearance, it
				// does not re-hide an entrance or undo a completed exit.
				if (holder !== undefined && holder !== step.elementId) {
					this.activeAnimations.delete(holder);
				}
				this.exclusiveHolders.set(step.exclGroupId, step.elementId);
			}
			appliedSteps?.push(step);
		}
		return appliedSteps ? { ...group, steps: appliedSteps } : group;
	}
}
