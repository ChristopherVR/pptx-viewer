import type { PptxSlide } from 'pptx-viewer-core';
import type { PresentationAnimationController, TimelineClickGroup } from 'pptx-viewer-shared';
import {
	applyHighlightClickStyle,
	findHighlightClickTarget,
	HIGHLIGHT_CLEAR_STYLE,
} from 'pptx-viewer-shared';

/** Dependencies the interactive / hover trigger listeners need from playback. */
export interface TriggerDeps {
	/** The live controller, or null when no slide timeline is active. */
	getController: () => PresentationAnimationController | null;
	/** Apply a triggered click-group's steps + staged-build reveal. */
	play: (controller: PresentationAnimationController, group: TimelineClickGroup) => void;
	/** The slide currently on stage, for `a:hlinkHover/@highlightClick` lookup. */
	getSlide: () => PptxSlide | undefined;
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
	// `a:hlinkHover/@highlightClick`: tracked separately from the `onHover`
	// animation trigger below, since a shape can carry one flag without the
	// other. Scoped to this attach call (the stage is rebuilt fresh per
	// render), matching the rest of this function's lifetime assumption.
	let highlightedHoverElement: HTMLElement | null = null;

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
		const found = findHighlightClickTarget(event.target, deps.getSlide());
		const nextElement = found?.descriptor.hover ? found.element : null;
		if (nextElement !== highlightedHoverElement) {
			if (highlightedHoverElement) {
				applyHighlightClickStyle(highlightedHoverElement, HIGHLIGHT_CLEAR_STYLE);
			}
			highlightedHoverElement = nextElement;
			if (nextElement && found?.descriptor.hover) {
				applyHighlightClickStyle(nextElement, found.descriptor.hover.enterStyle);
			}
		}

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
		// Only when the pointer leaves the stage subtree, not moving within it.
		const related = event.relatedTarget;
		if (!(related instanceof Node) || !stage.contains(related)) {
			if (highlightedHoverElement) {
				applyHighlightClickStyle(highlightedHoverElement, HIGHLIGHT_CLEAR_STYLE);
				highlightedHoverElement = null;
			}
		}

		const controller = deps.getController();
		const id = closestElementId(event.target);
		if (id && controller?.hasHoverSequence(id)) {
			controller.resetHover(id);
		}
	});
}
