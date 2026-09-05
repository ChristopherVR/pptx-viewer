/**
 * `animation-playback-engine`: the framework-light clock + DOM glue that drives
 * a {@link PresentationAnimationController}-shaped clock (see
 * {@link PlaybackAnimationController}) during a running slide show. Extracted
 * from four near-identical copies (Vue `composables/animation-playback-helpers`,
 * Angular `viewer/presentation-playback-helpers`, Svelte
 * `presentation/animation-playback-helpers`, VanillaJS
 * `animation/animation-playback-helpers`) that had all been hand-ported from the
 * React binding's `presentation-mode/animation-helpers` + `build-playback`.
 *
 * The controller itself is pure (no DOM, no timers, no RAF) and lives in
 * {@link module:render/presentation-animation-controller}. This module owns:
 *  - applying a click-group's steps (visibility, CSS animation, sound, media
 *    command) onto a `Map<elementId, ElementAnimationState>`;
 *  - the requestAnimationFrame loop that ramps a staged chart / SmartArt build's
 *    `progress` 0 -> 1 (`p:bldChart` / `p:bldDgm`);
 *  - the auto-advance chain for consecutive withPrevious / afterPrevious groups.
 *  - (via the sibling `animation-media-end-gating`, kept separate for this
 *    file's line budget) wiring an `onStopAudio`-gated step to its REAL
 *    `<audio>`/`<video>` element's `ended` event.
 *
 * Only `window.setTimeout` / `requestAnimationFrame` / `cancelAnimationFrame` /
 * `performance.now` (all present in jsdom) and DOM lookups scoped through the
 * caller-supplied {@link PlaybackContext.frameRoot} are touched, so this stays
 * unit-testable outside a browser. Actual `Audio` playback is NOT touched here:
 * a binding wires its local sound helper in as {@link PlaybackContext.playSound}
 * / {@link PlaybackContext.stopSound} (an optional {@link PlaybackContext.onPlayActionSound}
 * host override takes priority over `playSound` when set, matching the
 * pre-extraction behaviour of `ctx.onPlayActionSound ?? playAnimationSound`).
 *
 * The `p:seq/@nextAc="seek"` nuance (a second advance while a group is still
 * mid-flight fast-forwards it to its authored end state instead of playing the
 * next group) lives in the sibling `animation-playback-seek`, whose
 * `advanceMainSequence` is the "next click" entry point every binding uses.
 *
 * @module render/animation-playback-engine
 */

import { wireMediaEndedSteps } from './animation-media-end-gating';
import { executeMediaCommandInDom } from './animation-media-playback';
import type { ElementAnimationState, TimelineClickGroup } from './animation-timeline-types';
import { PresentationAnimationController } from './presentation-animation-controller';
import type { PresentationStatesOptions } from './presentation-animation-controller';

/** Updater over the element-state map (React `setState`-compatible signature). */
export type StatesSetter = (
	updater: (prev: Map<string, ElementAnimationState>) => Map<string, ElementAnimationState>,
) => void;

/** Mutable handle holding the in-flight `requestAnimationFrame` id (or null). */
export interface BuildRafHandle {
	current: number | null;
}

/**
 * The subset of {@link PresentationAnimationController} this engine needs to
 * drive playback. A real controller instance satisfies this structurally, so a
 * binding passes it through unchanged; tests can pass a plain stub instead of
 * constructing a full controller from a slide.
 */
export interface PlaybackAnimationController {
	shouldAutoAdvance(): boolean;
	getAutoAdvanceDelay(): number;
	peekNext(): TimelineClickGroup | null;
	advance(nowMs?: number): TimelineClickGroup | null;
	computeStatesFor(
		elementIds: readonly string[],
		options?: PresentationStatesOptions,
	): Map<string, ElementAnimationState>;
}

/** Everything the step / build / auto-advance helpers need from the host. */
export interface PlaybackContext {
	setStates: StatesSetter;
	/** Timer ids collected here so the host can clear them on slide change. */
	timers: number[];
	buildHandle: BuildRafHandle;
	/** Host-provided action-sound player; takes priority over `playSound`. */
	onPlayActionSound?: (soundPath: string) => void;
	/** The binding's local action-sound player, used when no host override is set. */
	playSound: (soundPath: string) => void;
	/** Stops any in-progress action/animation sound. */
	stopSound: () => void;
	/** Root element to scope media-command target lookups to (the slide stage). */
	frameRoot?: () => HTMLElement | null;
	/**
	 * Maps a `p:audio`/`p:video` animation's OWN timing-tree node id to the
	 * element id it plays (`animation-media-end-gating`'s
	 * `resolveMediaTimeNodeElementIds`), so an `onStopAudio`-gated step can
	 * find the real DOM element for its `ended` event. Absent: falls back to
	 * the `delayMs` estimate alone (matches every binding before this existed).
	 */
	mediaTimeNodeElementIds?: ReadonlyMap<number, string>;
}

// ---------------------------------------------------------------------------
// Click-group step application
// ---------------------------------------------------------------------------

/** The staged-build fields of a state, carried across the step writes below. */
type BuildStateFields = Pick<ElementAnimationState, 'build' | 'chartReveal' | 'diagramReveal'>;

/**
 * The staged-build reveal a state already holds. A `p:bldChart` / `p:bldDgm`
 * build fires one step PER STAGE against the same element id, so every write
 * that replaces the element's state object (a step starting, a step's cleanup
 * timer) has to carry these through: dropping them hands the renderer a state
 * with no build at all, which it reads as "reveal everything" - the whole
 * diagram popped in the moment the first stage's fade finished.
 */
function carryBuildState(state: ElementAnimationState | undefined): BuildStateFields {
	if (!state) {
		return {};
	}
	const carried: BuildStateFields = {};
	if (state.build) {
		carried.build = state.build;
	}
	if (state.chartReveal) {
		carried.chartReveal = state.chartReveal;
	}
	if (state.diagramReveal) {
		carried.diagramReveal = state.diagramReveal;
	}
	return carried;
}

/**
 * Apply a click-group's steps onto the element-state map: fire sound / media
 * commands, set each step's initial visibility + CSS animation, then schedule
 * cleanup timers to clear the animation (and hide exits) once each step ends.
 *
 * An `onStopAudio`-gated step also gets a real `ended` listener wired via
 * `wireMediaEndedSteps` (`animation-media-end-gating`), which corrects the
 * fallback estimate below once the actual media element finishes; the
 * fallback still fires unconditionally, so no-real-media contexts
 * (export/headless) are unaffected.
 */
export function applyAnimationGroupSteps(group: TimelineClickGroup, ctx: PlaybackContext): void {
	wireMediaEndedSteps(group, ctx);

	// Sound + media-playback side effects.
	for (const step of group.steps) {
		if (step.command) {
			const command = step.command;
			const timer = window.setTimeout(
				() => {
					executeMediaCommandInDom(command, ctx.frameRoot);
				},
				Math.max(0, step.delayMs),
			);
			ctx.timers.push(timer);
			continue;
		}
		if (step.stopSound) {
			ctx.stopSound();
		} else if (step.soundPath) {
			(ctx.onPlayActionSound ?? ctx.playSound)(step.soundPath);
		}
	}

	// Initial CSS-animation / visibility state. A `p:animClr` step also surfaces
	// its fill / stroke colour targets so the vector / connector renderers
	// relinquish their static paint (`inherit`) and the wrapper's colour keyframes
	// cascade in for the duration of the step.
	ctx.setStates((previous) => {
		const next = new Map(previous);
		for (const step of group.steps) {
			if (step.command) {
				continue;
			}
			const current = next.get(step.elementId);
			const shouldBeVisible = step.presetClass === 'exit' ? (current?.visible ?? true) : true;
			next.set(step.elementId, {
				...carryBuildState(current),
				visible: shouldBeVisible,
				cssAnimation: step.cssAnimation,
				animatesFill: step.colorTargets?.includes('fill') ? true : undefined,
				animatesStroke: step.colorTargets?.includes('stroke') ? true : undefined,
			});
		}
		return next;
	});

	// Cleanup after each step completes: clear the animation, hide finished exits,
	// and drop the colour-target flags so the static paint is restored.
	for (const step of group.steps) {
		if (step.command) {
			continue;
		}
		const timer = window.setTimeout(
			() => {
				ctx.setStates((previous) => {
					const next = new Map(previous);
					const current = next.get(step.elementId);
					// `afterAnimation: "hideAfterAnimation"` hides the element once its
					// (entrance/emphasis) effect ends, overriding normal visibility.
					const visibleAfter =
						step.presetClass === 'exit' || step.hideAfterEffect
							? false
							: (current?.visible ?? true);
					// `p:cTn/@fill="hold"`/`"freeze"`: keep the CSS animation attached so
					// its final frame persists instead of reverting on cleanup.
					next.set(step.elementId, {
						...carryBuildState(current),
						visible: visibleAfter,
						cssAnimation: step.holdEndState ? step.cssAnimation : undefined,
					});
					return next;
				});
			},
			Math.max(0, step.delayMs + step.durationMs + 8),
		);
		ctx.timers.push(timer);
	}
}

// ---------------------------------------------------------------------------
// Staged chart / SmartArt build reveal (RAF-driven)
// ---------------------------------------------------------------------------

/** Cancel any in-flight build RAF and clear the handle. */
export function cancelBuildReveal(handle: BuildRafHandle): void {
	if (handle.current !== null && typeof cancelAnimationFrame === 'function') {
		cancelAnimationFrame(handle.current);
	}
	handle.current = null;
}

/**
 * Ramp a click-group's staged-build `progress` from 0 -> 1 via
 * requestAnimationFrame, merging each build element's `build` descriptor onto the
 * element states each frame. No-op when the group carries no build step, so
 * ordinary click-advance is unchanged.
 */
export function driveBuildReveal(
	controller: PlaybackAnimationController,
	group: TimelineClickGroup,
	ctx: PlaybackContext,
): void {
	cancelBuildReveal(ctx.buildHandle);
	const buildIds = PresentationAnimationController.collectBuildStepIds(group);
	if (buildIds.length === 0 || typeof requestAnimationFrame !== 'function') {
		return;
	}

	const start = performance.now();
	const tick = (): void => {
		const elapsedMs = performance.now() - start;
		const states = controller.computeStatesFor(buildIds, { elapsedMs });

		ctx.setStates((previous) => {
			const next = new Map(previous);
			for (const id of buildIds) {
				const computed = states.get(id);
				if (!computed?.build) {
					continue;
				}
				const existing = next.get(id) ?? { visible: true, cssAnimation: undefined };
				// The authored-index reveal set (`p:graphicEl`) rides alongside the
				// count-based `build`; both come from the same snapshot, and the
				// renderer prefers the descriptor when present.
				next.set(id, { ...existing, ...carryBuildState(computed) });
			}
			return next;
		});

		let pending = false;
		for (const id of buildIds) {
			const build = states.get(id)?.build;
			if (build && build.progress < 1) {
				pending = true;
				break;
			}
		}
		ctx.buildHandle.current = pending ? requestAnimationFrame(tick) : null;
	};

	// Seed synchronously (progress ~0) so the graphic never flashes fully built.
	tick();
}

// ---------------------------------------------------------------------------
// Play a group + auto-advance chaining
// ---------------------------------------------------------------------------

/** Apply a group's steps and start its staged-build reveal (if any). */
export function playGroup(
	controller: PlaybackAnimationController,
	group: TimelineClickGroup,
	ctx: PlaybackContext,
): void {
	applyAnimationGroupSteps(group, ctx);
	driveBuildReveal(controller, group, ctx);
}

/**
 * After a click-group plays, schedule the next group when it should auto-advance
 * (withPrevious / afterPrevious), chaining through consecutive auto-advance
 * groups.
 */
export function scheduleAutoAdvanceChain(
	controller: PlaybackAnimationController,
	ctx: PlaybackContext,
): void {
	if (!controller.shouldAutoAdvance()) {
		return;
	}
	const previousGroup = controller.peekNext();
	if (!previousGroup) {
		return;
	}
	const totalDelay = controller.getAutoAdvanceDelay() + (previousGroup.autoAdvanceDelayMs ?? 0);
	const timer = window.setTimeout(
		() => {
			const group = controller.advance();
			if (!group) {
				return;
			}
			playGroup(controller, group, ctx);
			scheduleAutoAdvanceChain(controller, ctx);
		},
		Math.max(0, totalDelay),
	);
	ctx.timers.push(timer);
}
