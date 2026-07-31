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
import type { AnimationPlaybackService } from './animation-playback.service';

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
	 */
	applyAnimationStyles(): void {
		const root = this.stageRoot();
		if (!root) {
			return;
		}
		const states = this.playback.presentationElementStates();
		const interactive = this.playback.interactiveTriggerShapeIds();
		const hover = this.playback.hoverTriggerShapeIds();
		const nodes = root.querySelectorAll<HTMLElement>('[data-element-id]');
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
