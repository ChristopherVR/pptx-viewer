/**
 * `animation-playback-helpers`: the framework-light clock + DOM glue that drives
 * a {@link PresentationAnimationController} during a vanilla slide show. Ported
 * from the Vue binding's `composables/animation-playback-helpers` (itself a port
 * of React's `presentation-mode/animation-helpers` + `build-playback`).
 *
 * The controller is pure (no DOM, no timers, no RAF). This module owns:
 *  - applying a click-group's steps (visibility, CSS animation, sound, media
 *    command) onto a `Map<elementId, ElementAnimationState>`;
 *  - the requestAnimationFrame loop that ramps a staged chart / SmartArt build's
 *    `progress` 0 -> 1 (`p:bldChart` / `p:bldDgm`);
 *  - the auto-advance chain for consecutive withPrevious / afterPrevious groups.
 *
 * @module animation/animation-playback-helpers
 */

import { executeMediaCommandInDom, PresentationAnimationController } from 'pptx-viewer-shared';
import type { ElementAnimationState, TimelineClickGroup } from 'pptx-viewer-shared';

import { playAnimationSound, stopAnimationSound } from './animation-sound';

/** Updater over the element-state map (React `setState`-compatible). */
export type StatesSetter = (
	updater: (prev: Map<string, ElementAnimationState>) => Map<string, ElementAnimationState>,
) => void;

/** Mutable handle holding the in-flight `requestAnimationFrame` id (or null). */
export interface BuildRafHandle {
	current: number | null;
}

/** Everything the step / build / auto-advance helpers need from the playback. */
export interface PlaybackContext {
	setStates: StatesSetter;
	/** Timer ids collected here so the playback can clear them on slide change. */
	timers: number[];
	buildHandle: BuildRafHandle;
	/** Host-provided action-sound player; falls back to the local audio element. */
	onPlayActionSound?: (soundPath: string) => void;
	/** Root element to scope media-command target lookups to (the slide stage). */
	frameRoot?: () => HTMLElement | null;
}

// ---------------------------------------------------------------------------
// Click-group step application
// ---------------------------------------------------------------------------

/**
 * Apply a click-group's steps onto the element-state map: fire sound / media
 * commands, set each step's initial visibility + CSS animation, then schedule
 * cleanup timers to clear the animation (and hide exits) once each step ends.
 * Mirrors the React / Vue `applyAnimationGroupSteps`.
 */
export function applyAnimationGroupSteps(group: TimelineClickGroup, ctx: PlaybackContext): void {
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
			stopAnimationSound();
		} else if (step.soundPath) {
			(ctx.onPlayActionSound ?? playAnimationSound)(step.soundPath);
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
			const current = next.get(step.elementId) ?? { visible: true, cssAnimation: undefined };
			const shouldBeVisible = step.presetClass === 'exit' ? current.visible : true;
			next.set(step.elementId, {
				visible: shouldBeVisible,
				cssAnimation: step.cssAnimation,
				animatesFill: step.colorTargets?.includes('fill') ? true : undefined,
				animatesStroke: step.colorTargets?.includes('stroke') ? true : undefined,
			});
		}
		return next;
	});

	// Cleanup after each step completes: clear the animation, hide finished exits.
	for (const step of group.steps) {
		if (step.command) {
			continue;
		}
		const timer = window.setTimeout(
			() => {
				ctx.setStates((previous) => {
					const next = new Map(previous);
					const current = next.get(step.elementId) ?? { visible: true, cssAnimation: undefined };
					// `afterAnimation: "hideAfterAnimation"` hides the element once its
					// (entrance/emphasis) effect ends, overriding normal visibility.
					const visibleAfter =
						step.presetClass === 'exit' || step.hideAfterEffect ? false : current.visible;
					// `p:cTn/@fill="hold"`/`"freeze"`: keep the CSS animation attached so
					// its final frame persists instead of reverting on cleanup.
					next.set(step.elementId, {
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
 * ordinary click-advance is unchanged. Mirrors the React / Vue `driveBuildReveal`.
 */
export function driveBuildReveal(
	controller: PresentationAnimationController,
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
				const build = states.get(id)?.build;
				if (!build) {
					continue;
				}
				const existing = next.get(id) ?? { visible: true, cssAnimation: undefined };
				next.set(id, { ...existing, build });
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
	controller: PresentationAnimationController,
	group: TimelineClickGroup,
	ctx: PlaybackContext,
): void {
	applyAnimationGroupSteps(group, ctx);
	driveBuildReveal(controller, group, ctx);
}

/**
 * After a click-group plays, schedule the next group when it should auto-advance
 * (withPrevious / afterPrevious), chaining through consecutive auto-advance
 * groups. Mirrors the React / Vue `scheduleAutoAdvanceChain`.
 */
export function scheduleAutoAdvanceChain(
	controller: PresentationAnimationController,
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
