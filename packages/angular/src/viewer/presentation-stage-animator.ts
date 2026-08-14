/**
 * presentation-stage-animator.ts: applies the slide show's native-animation
 * state to the rendered DOM, and tracks the hover-trigger shape under the
 * pointer.
 *
 * This is the one part of the slide-show overlay that reaches into the DOM
 * imperatively rather than binding through the template. It is kept out of
 * {@link PresentationOverlayComponent} because it is a self-contained concern
 * (a stage root plus a playback service in, style mutations out) with no
 * dependency on the component's inputs, outputs or navigation state, and
 * because it needs no Angular injection context: it is a plain class the
 * component owns.
 *
 * Every element renderer stamps `data-element-id`, so the whole mechanism is a
 * single `querySelectorAll` and needs no per-element renderer plumbing.
 */
import type { ElementAnimationState } from '../internal/shared';
import type { AnimationPlaybackService } from './animation-playback.service';

/** True when at least one staged node belongs to the tracked element states. */
function stageHoldsTrackedElement(
	nodes: ArrayLike<HTMLElement>,
	states: ReadonlyMap<string, ElementAnimationState>,
): boolean {
	for (let i = 0; i < nodes.length; i++) {
		const id = nodes[i].dataset['elementId'];
		if (id && states.has(id)) {
			return true;
		}
	}
	return false;
}

/** Resolve the nearest element id above a pointer target, if any. */
export function closestElementId(target: EventTarget | null): string | undefined {
	if (!(target instanceof Element)) {
		return undefined;
	}
	return target.closest<HTMLElement>('[data-element-id]')?.dataset['elementId'];
}

export class PresentationStageAnimator {
	/** The hover-trigger shape the pointer is currently over (fires a sequence once). */
	private currentHoverTriggerId: string | undefined;

	/**
	 * @param stageRoot Resolves the live slide-stage element (null before the
	 *   first render, and again once the overlay is torn down).
	 * @param playback The show's element-animation playback service.
	 */
	constructor(
		private readonly stageRoot: () => HTMLElement | null | undefined,
		private readonly playback: AnimationPlaybackService,
	) {}

	/**
	 * Imperatively apply each tracked element's native-animation state to its DOM
	 * wrapper: visibility (entrance hide-until-revealed / exit), the CSS-animation
	 * shorthand (entrance / emphasis / exit / colour keyframes), and a pointer
	 * cursor on interactive / hover trigger shapes. Mirrors the Vue
	 * `applyAnimationStyles`. Structural reveals (chart / SmartArt build, fill /
	 * stroke inherit) are applied declaratively by the renderers themselves.
	 *
	 * @param options.onlyWhenStaged - Skip entirely unless the stage already holds
	 *   a node for at least one tracked element id. Used by the SYNCHRONOUS apply
	 *   the playback service fires the instant a click-group's states change
	 *   (see {@link AnimationPlaybackService.setStyleApplier}): on a slide change
	 *   the states describe the INCOMING slide while the stage still holds the
	 *   outgoing one, and clearing the outgoing nodes' `visibility` mid-transition
	 *   would reveal shapes whose entrance never played. In that case the
	 *   `afterNextRender` pass in the overlay is the correct (and only) applier.
	 */
	applyAnimationStyles(options?: { onlyWhenStaged?: boolean }): void {
		const root = this.stageRoot();
		if (!root) {
			return;
		}
		const states = this.playback.presentationElementStates();
		const interactive = this.playback.interactiveTriggerShapeIds();
		const hover = this.playback.hoverTriggerShapeIds();
		const nodes = root.querySelectorAll<HTMLElement>('[data-element-id]');
		if (options?.onlyWhenStaged && !stageHoldsTrackedElement(nodes, states)) {
			return;
		}
		nodes.forEach((el) => {
			const id = el.dataset['elementId'];
			if (!id) {
				return;
			}
			const state = states.get(id);
			el.style.animation = state?.cssAnimation ?? '';
			el.style.visibility = state?.visible === false ? 'hidden' : '';
			el.style.cursor = interactive.has(id) || hover.has(id) ? 'pointer' : '';
		});
	}

	/**
	 * Pointer moved over the stage: (re)play a hover-trigger shape's sequence once
	 * on entering it (not on every descendant transition that `mouseover` bubbles
	 * up), resetting the previous trigger on leaving it.
	 */
	handleHover(event: MouseEvent): void {
		const id = closestElementId(event.target);
		const triggerId = id && this.playback.hoverTriggerShapeIds().has(id) ? id : undefined;
		if (triggerId === this.currentHoverTriggerId) {
			return;
		}
		if (this.currentHoverTriggerId) {
			this.playback.handleHoverEnd(this.currentHoverTriggerId);
		}
		this.currentHoverTriggerId = triggerId;
		if (triggerId) {
			this.playback.handleHoverStart(triggerId);
		}
	}

	/** Pointer left the stage subtree entirely: reset any active hover trigger. */
	handleHoverEnd(event: MouseEvent): void {
		const related = event.relatedTarget;
		if (related instanceof Node && this.stageRoot()?.contains(related)) {
			return;
		}
		if (this.currentHoverTriggerId) {
			this.playback.handleHoverEnd(this.currentHoverTriggerId);
			this.currentHoverTriggerId = undefined;
		}
	}
}
