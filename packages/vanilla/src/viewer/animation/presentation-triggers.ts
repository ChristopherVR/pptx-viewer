import type { PresentationAnimationController, TimelineClickGroup } from 'pptx-viewer-shared';

/** Dependencies the interactive / hover trigger listeners need from playback. */
export interface TriggerDeps {
	/** The live controller, or null when no slide timeline is active. */
	getController: () => PresentationAnimationController | null;
	/** Apply a triggered click-group's steps + staged-build reveal. */
	play: (controller: PresentationAnimationController, group: TimelineClickGroup) => void;
}

/** Resolve the nearest element id above a pointer target, if any. */
function closestElementId(target: EventTarget | null): string | undefined {
	if (!(target instanceof Element)) {
		return undefined;
	}
	return target.closest<HTMLElement>('[data-element-id]')?.dataset.elementId;
}

/**
 * Attach `onShapeClick` (interactive) and `onHover` trigger listeners to a
 * presentation stage node. Mirrors the Vue binding's `PresentationMode`
 * frame handlers: a click on an interactive trigger shape plays its sequence
 * (stopping propagation so it does not also advance the slide); hovering a
 * hover-trigger shape replays its sequence from the start.
 *
 * The stage is rebuilt on each render, so listeners are attached fresh per
 * render and discarded with the old node; no explicit detach is needed.
 */
export function attachTriggerListeners(stage: HTMLElement, deps: TriggerDeps): void {
	stage.addEventListener('click', (event) => {
		const controller = deps.getController();
		const id = closestElementId(event.target);
		if (!id || !controller?.hasInteractiveSequence(id)) {
			return;
		}
		const group = controller.advanceInteractive(id);
		if (group) {
			event.stopPropagation();
			deps.play(controller, group);
		}
	});

	stage.addEventListener('mouseover', (event) => {
		const controller = deps.getController();
		const id = closestElementId(event.target);
		if (!id || !controller?.hasHoverSequence(id)) {
			return;
		}
		// Reset first so hovering again replays the sequence from the start.
		controller.resetHover(id);
		const group = controller.advanceHover(id);
		if (group) {
			deps.play(controller, group);
		}
	});

	stage.addEventListener('mouseout', (event) => {
		const controller = deps.getController();
		const id = closestElementId(event.target);
		if (id && controller?.hasHoverSequence(id)) {
			controller.resetHover(id);
		}
	});
}
