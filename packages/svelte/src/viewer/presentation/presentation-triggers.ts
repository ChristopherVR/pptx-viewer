import type { PresentationController } from './presentation-controller.svelte';

/** The subset of the controller the trigger listeners drive. */
export type TriggerController = Pick<
	PresentationController,
	| 'interactiveTriggerShapeIds'
	| 'hoverTriggerShapeIds'
	| 'handleInteractiveShapeClick'
	| 'handleHoverStart'
	| 'handleHoverEnd'
	| 'applyHoverHighlight'
	| 'clearHoverHighlight'
>;

/** The nearest `[data-element-id]` ancestor of an event target, if any. */
function closestElementId(target: EventTarget | null): string | undefined {
	if (!(target instanceof Element)) {
		return undefined;
	}
	return target.closest<HTMLElement>('[data-element-id]')?.dataset.elementId;
}

/**
 * Route interactive (`onShapeClick`) and hover (`onHover`) trigger events on the
 * live presentation stage to their animation sequences: a click on an
 * interactive trigger shape (or hovering an `onHover` trigger) plays its
 * sequence instead of only advancing the slide. Returns a cleanup function that
 * removes the listeners.
 *
 * The tap-to-advance click lives on an ancestor (`.pptx-svelte-stage-holder`),
 * so a handled interactive click calls `stopPropagation()` to suppress the
 * advance; non-trigger clicks bubble through and advance as before. The
 * controller getters/handlers are read at event time, so the current per-slide
 * trigger sets are always used.
 */
export function attachPresentationTriggerListeners(
	root: HTMLElement,
	controller: TriggerController,
): () => void {
	// The hover-trigger shape the pointer is currently over, tracked so a hover
	// sequence fires once on entering a shape (not on every descendant transition
	// `mouseover` bubbles up) and resets on leaving it.
	let currentHoverTriggerId: string | undefined;

	const onClick = (event: MouseEvent): void => {
		const id = closestElementId(event.target);
		if (id && controller.interactiveTriggerShapeIds.has(id)) {
			if (controller.handleInteractiveShapeClick(id)) {
				event.stopPropagation();
			}
		}
	};

	const onOver = (event: MouseEvent): void => {
		const id = closestElementId(event.target);
		const triggerId = id && controller.hoverTriggerShapeIds.has(id) ? id : undefined;
		// `a:hlinkHover/@highlightClick`: independent of the onHover animation
		// trigger above (a shape can carry one flag without the other).
		controller.applyHoverHighlight(event.target);
		if (triggerId === currentHoverTriggerId) {
			return;
		}
		if (currentHoverTriggerId) {
			controller.handleHoverEnd(currentHoverTriggerId);
		}
		currentHoverTriggerId = triggerId;
		if (triggerId) {
			controller.handleHoverStart(triggerId);
		}
	};

	const onOut = (event: MouseEvent): void => {
		// Only when the pointer leaves the stage subtree, not moving within it.
		const related = event.relatedTarget;
		if (related instanceof Node && root.contains(related)) {
			return;
		}
		controller.clearHoverHighlight();
		if (currentHoverTriggerId) {
			controller.handleHoverEnd(currentHoverTriggerId);
			currentHoverTriggerId = undefined;
		}
	};

	root.addEventListener('click', onClick);
	root.addEventListener('mouseover', onOver);
	root.addEventListener('mouseout', onOut);
	return () => {
		root.removeEventListener('click', onClick);
		root.removeEventListener('mouseover', onOver);
		root.removeEventListener('mouseout', onOut);
	};
}
