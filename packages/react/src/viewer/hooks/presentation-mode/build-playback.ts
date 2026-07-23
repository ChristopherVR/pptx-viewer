/**
 * `build-playback`: the requestAnimationFrame driver for staged chart / SmartArt
 * builds (`p:bldChart` / `p:bldDgm`).
 *
 * Discrete click-advance handles the whole-element entrance; a staged build
 * additionally needs its `build.progress` to ramp 0 -> 1 across the step. This
 * module owns that clock: while a click-group with an active build step is
 * showing, it recomputes the controller's element states with a growing
 * `elapsedMs` and merges only the `build` field onto the element states, so the
 * base visibility / CSS set by `applyAnimationGroupSteps` is untouched. It stops
 * the loop once every build reaches progress 1.
 *
 * The pure staged-build probe (`collectBuildStepIds`) and the state computation
 * both live in the framework-agnostic `PresentationAnimationController`
 * (`pptx-viewer-shared`); this module only owns the RAF clock + the React state
 * merge.
 */

import type { PresentationAnimationController } from 'pptx-viewer-shared';

import type { ElementAnimationState } from '../../utils/animation-timeline';

/** State updater (compatible with a React `useState` setter). */
type StateUpdater = (
	updater: (prev: Map<string, ElementAnimationState>) => Map<string, ElementAnimationState>,
) => void;

/** Mutable handle holding the in-flight `requestAnimationFrame` id (or null). */
export interface BuildRafHandle {
	current: number | null;
}

/** Cancel any in-flight build RAF and clear the handle. */
export function cancelBuildReveal(handle: BuildRafHandle): void {
	if (handle.current !== null) {
		cancelAnimationFrame(handle.current);
		handle.current = null;
	}
}

/**
 * Drive the staged-build reveal for `buildIds` via requestAnimationFrame.
 *
 * Cancels any prior loop, then on each frame recomputes the controller's element
 * states at the elapsed time since this call and merges each build element's
 * `build` descriptor onto the tracked states. The loop stops (clearing the
 * handle) once no build element is still below progress 1.
 */
export function driveBuildReveal(
	controller: PresentationAnimationController,
	buildIds: readonly string[],
	setStates: StateUpdater,
	handle: BuildRafHandle,
): void {
	cancelBuildReveal(handle);
	if (buildIds.length === 0 || typeof requestAnimationFrame !== 'function') {
		return;
	}

	const start = performance.now();

	const tick = (): void => {
		const elapsedMs = performance.now() - start;
		const states = controller.computeStatesFor(buildIds, { elapsedMs });

		setStates((prev) => {
			const next = new Map(prev);
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

		handle.current = pending ? requestAnimationFrame(tick) : null;
	};

	// Seed the reveal synchronously (progress at elapsed ~0) so the chart /
	// diagram never flashes fully-built for a frame before the first RAF tick,
	// then let `tick` schedule the subsequent frames.
	tick();
}
