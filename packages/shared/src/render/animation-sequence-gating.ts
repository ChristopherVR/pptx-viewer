/**
 * `animation-sequence-gating` — pure decision functions for the `p:seq`
 * `@concurrent` / `@nextAc` / `@prevAc` attributes (ECMA-376 S19.5.60,
 * captured onto every {@link TimelineClickGroup} in the sequence they
 * govern) and the per-effect `p:cTn/@restart` attribute (ECMA-376 S19.5.27,
 * `ST_TLTimeNodeRestartType`, captured onto each {@link TimelineStep}).
 *
 * `TimelineEngine` calls these to decide whether a "next" advance / "reset"
 * request against an already-active click-group, or a re-trigger of an
 * already-active step, should proceed, be swallowed, or be blocked - instead
 * of always proceeding unconditionally, which was the previous behaviour
 * (see the Animation authoring section of `docs/guide/limitations.md`).
 *
 * @module render/animation-sequence-gating
 */

import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';

/**
 * A "nothing to play" click-group: every binding's playback loop treats a
 * truthy group returned from `advance`/`advanceInteractive`/`advanceHover` as
 * "this click was consumed by an animation on the current slide" and a falsy
 * one as "there was nothing left to animate here, fall through to slide
 * navigation" (see e.g. React's `useSlideNavigation`:
 * `if (direction === 1 && playNextAnimationGroup()) { return; }`).
 *
 * `TimelineEngine` returns THIS constant (rather than `null`) when
 * `shouldBlockNextAdvance` swallows a request: the click must still count as
 * "consumed" - the deck said not to advance yet - or the binding would
 * misread the block as "no more steps" and skip to the next slide instead of
 * waiting, which is the opposite of what `@nextAc="none"` asks for. `null` is
 * reserved for genuine exhaustion (no groups at all, or already at the last
 * one), which SHOULD fall through to slide navigation.
 */
export const EMPTY_CLICK_GROUP: TimelineClickGroup = Object.freeze({
	steps: [],
	totalDurationMs: 0,
});

/**
 * True while a group started at `startedAtMs` is still inside its own
 * duration window (`totalDurationMs`) at `nowMs`.
 */
export function isGroupActive(
	group: TimelineClickGroup | undefined,
	startedAtMs: number | undefined,
	nowMs: number,
): boolean {
	if (!group || startedAtMs === undefined) {
		return false;
	}
	return nowMs - startedAtMs < group.totalDurationMs;
}

/**
 * Whether a "next" advance request against the currently-active `group`
 * should be swallowed (no new time node starts) rather than moving forward.
 *
 * `@concurrent="1"` lets this sequence's effects play alongside the
 * surrounding timeline instead of strictly blocking it, so a concurrent
 * group never blocks. Absent `@nextAc`, and the explicit `"seek"` token, are
 * PowerPoint's "finish the current effect in place, then allow the next one"
 * default; this engine already gets that for free (a newly-applied group's
 * steps simply supersede the old ones, so there is nothing to seek), so only
 * the explicit `"none"` token - "ignore next presses until this node
 * finishes on its own" - introduces new blocking behaviour. Absent
 * `@concurrent`/`@nextAc` therefore stays fully permissive, so a deck that
 * never sets them (the common case for hand-authored or non-PowerPoint
 * content) sees no change in behaviour.
 */
export function shouldBlockNextAdvance(
	group: TimelineClickGroup | undefined,
	startedAtMs: number | undefined,
	nowMs: number,
): boolean {
	if (!group || group.seqConcurrent === true || group.seqNextAction !== 'none') {
		return false;
	}
	return isGroupActive(group, startedAtMs, nowMs);
}

/**
 * Whether a "reset / back out" request against the currently-active `group`
 * should be deferred until it finishes, rather than discarding it immediately.
 *
 * This engine has no granular "step backward through this slide's own
 * click-groups" operation (going Previous is slide-level; see
 * `PresentationAnimationController.completeAll`), so `@prevAc` is honoured at
 * the one place a triggered sequence already has an equivalent "back out"
 * action: `TimelineEngine.resetHover`, invoked when the pointer leaves a
 * hover-triggered shape. Symmetric to {@link shouldBlockNextAdvance}: only
 * the explicit `"none"` token (PowerPoint's own default, "no special
 * previous handling") defers the reset; the explicit `"skipTimeNode"` token,
 * and an absent attribute, both preserve this engine's original
 * immediate-reset behaviour.
 */
export function shouldBlockReset(
	group: TimelineClickGroup | undefined,
	startedAtMs: number | undefined,
	nowMs: number,
): boolean {
	if (!group || group.seqConcurrent === true || group.seqPrevAction !== 'none') {
		return false;
	}
	return isGroupActive(group, startedAtMs, nowMs);
}

/** Per-step runtime state used to enforce `p:cTn/@restart` (ECMA-376 S19.5.27). */
export interface StepRestartState {
	/** Wall-clock time (ms) until which the step's most recent trigger is still playing. */
	activeUntilMs: number;
}

/**
 * Whether `step` may (re)trigger now, given its previous {@link StepRestartState}
 * (`undefined` when the step has never triggered before).
 *
 * - `"always"` (or absent, the OOXML default): always allowed, matching this
 *   engine's original behaviour.
 * - `"whenNotActive"`: allowed again only once the previous trigger's active
 *   window (its `delayMs + durationMs`) has elapsed.
 * - `"never"`: allowed only the very first time; every subsequent trigger for
 *   the same step is blocked outright, whether it is still active or not.
 */
export function canTriggerStep(
	restart: TimelineStep['restart'],
	state: StepRestartState | undefined,
	nowMs: number,
): boolean {
	if (!state) {
		return true;
	}
	const mode = restart ?? 'always';
	if (mode === 'never') {
		return false;
	}
	if (mode === 'whenNotActive') {
		return nowMs >= state.activeUntilMs;
	}
	return true;
}

/**
 * The subset of `TimelineEngine`'s tracking collections one step application
 * touches. Passed in (rather than owned here) so this stays a pure function
 * over caller-owned state, with the engine itself still deciding lifecycle
 * (construction, `reset()`).
 */
export interface StepApplicationState {
	stepRestartState: WeakMap<TimelineStep, StepRestartState>;
	activeAnimations: Map<string, string>;
	activeSteps: Map<string, TimelineStep>;
	revealedElements: Set<string>;
	exitedElements: Set<string>;
	/**
	 * Cumulative history (oldest first) of fired chart-build steps per element,
	 * unlike {@link activeSteps} which only ever keeps the latest. Consumed by
	 * `chart-reveal-descriptor`'s `resolveChartRevealDescriptor` to derive the
	 * AUTHORED reveal set regardless of the order stages actually fired in.
	 * Optional: a caller that never surfaces chart reveal state (tests, or a
	 * consumer that only needs `activeSteps`) may omit it.
	 */
	chartRevealHistory?: Map<string, TimelineStep[]>;
	/**
	 * Cumulative history of fired diagram-build steps per element, mirroring
	 * {@link chartRevealHistory} for `p:bldDgm` per-node builds. Consumed by
	 * `diagram-reveal-descriptor`'s `resolveDiagramRevealDescriptor`.
	 */
	diagramRevealHistory?: Map<string, TimelineStep[]>;
}

/**
 * Apply one step to `state`, honouring `@restart` via {@link canTriggerStep}.
 * A step whose previous run is still active (`whenNotActive`) or has already
 * played once (`never`) is skipped entirely: its currently-running effect and
 * visibility state are left undisturbed instead of being yanked back to the
 * start. A `p:cmd` media command step (empty `elementId`) carries no `@restart`
 * semantics of its own and is always applied.
 *
 * Returns `true` when the step was applied, `false` when `@restart` blocked
 * it. The caller uses this to decide whether the step belongs in the
 * click-group it hands back to the binding: every binding's playback loop
 * (React's `applyAnimationGroupSteps` and its Vue/Angular/Svelte/Vanilla
 * equivalents) applies CSS and schedules cleanup timers purely from the
 * returned group's `steps`, so a step this function blocks must never reach
 * that list, or the binding would re-apply (and re-schedule cleanup for) an
 * effect the deck said must not restart.
 */
export function applyRestartGatedStep(
	step: TimelineStep,
	nowMs: number,
	state: StepApplicationState,
): boolean {
	if (step.elementId) {
		const restartState = state.stepRestartState.get(step);
		if (!canTriggerStep(step.restart, restartState, nowMs)) {
			return false;
		}
		state.stepRestartState.set(step, { activeUntilMs: nowMs + step.delayMs + step.durationMs });
	}

	state.activeAnimations.set(step.elementId, step.cssAnimation);
	if (step.build || step.colorTargets) {
		state.activeSteps.set(step.elementId, step);
	}
	if (step.build?.kind === 'chart') {
		const history = state.chartRevealHistory?.get(step.elementId) ?? [];
		history.push(step);
		state.chartRevealHistory?.set(step.elementId, history);
	}
	if (step.build?.kind === 'diagram') {
		const history = state.diagramRevealHistory?.get(step.elementId) ?? [];
		history.push(step);
		state.diagramRevealHistory?.set(step.elementId, history);
	}
	if (step.presetClass === 'entr') {
		state.revealedElements.add(step.elementId);
	}
	if (step.presetClass === 'exit') {
		state.exitedElements.add(step.elementId);
	}
	return true;
}
