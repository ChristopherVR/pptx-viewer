/**
 * usePresentationAnimationStyles: pushes each element's native-animation state
 * onto its rendered DOM node, and routes the two pointer triggers
 * (`onShapeClick`, hover) that can start a sequence.
 *
 * This writes to the DOM imperatively on purpose. The states are keyed by
 * `data-element-id` across an arbitrarily deep renderer tree (groups, tables,
 * SmartArt), so threading a per-element style down every renderer would touch
 * every element component to serve one presentation-only feature. STRUCTURAL
 * reveals (chart / SmartArt build steps, fill / stroke inherit) are still
 * applied declaratively by the renderers themselves; only visibility, the CSS
 * animation shorthand and the trigger cursor are set here.
 */
import type { Ref } from 'vue';
import { nextTick, watch } from 'vue';

import type { UseAnimationPlaybackResult } from './useAnimationPlayback';

export interface UsePresentationAnimationStylesOptions {
	/** The scaled stage root; every `[data-element-id]` under it is updated. */
	frameRef: Ref<HTMLElement | null>;
	playback: UseAnimationPlaybackResult;
	/** Re-applies styles whenever the active slide changes, not only the states. */
	activeSlide: () => unknown;
}

export interface UsePresentationAnimationStylesResult {
	/** Click on an interactive (`onShapeClick`) trigger shape: play its sequence. */
	onFrameClick: (event: MouseEvent) => void;
	/** Pointer moved over the frame: (re)play the hover sequence on shape entry. */
	onFrameHover: (event: MouseEvent) => void;
	/** Pointer left the frame entirely: reset any active hover trigger. */
	onFrameHoverEnd: (event: MouseEvent) => void;
}

/** Resolve the nearest element id above a pointer target, if any. */
function closestElementId(target: EventTarget | null): string | undefined {
	if (!(target instanceof Element)) {
		return undefined;
	}
	return target.closest<HTMLElement>('[data-element-id]')?.dataset.elementId;
}

export function usePresentationAnimationStyles(
	options: UsePresentationAnimationStylesOptions,
): UsePresentationAnimationStylesResult {
	const { frameRef, playback } = options;

	function applyAnimationStyles(): void {
		const root = frameRef.value;
		if (!root) {
			return;
		}
		const states = playback.presentationElementStates.value;
		const interactive = playback.interactiveTriggerShapeIds.value;
		const hover = playback.hoverTriggerShapeIds.value;
		root.querySelectorAll<HTMLElement>('[data-element-id]').forEach((el) => {
			const id = el.dataset.elementId;
			if (!id) {
				return;
			}
			const state = states.get(id);
			el.style.animation = state?.cssAnimation ?? '';
			el.style.visibility = state?.visible === false ? 'hidden' : '';
			el.style.cursor = interactive.has(id) || hover.has(id) ? 'pointer' : '';
		});
	}

	function onFrameClick(event: MouseEvent): void {
		const id = closestElementId(event.target);
		if (id && playback.interactiveTriggerShapeIds.value.has(id)) {
			if (playback.handleInteractiveShapeClick(id)) {
				// Handled: don't let the click bubble to the tap-to-advance overlay.
				event.stopPropagation();
			}
		}
	}

	/**
	 * The hover-trigger shape the pointer is currently over, tracked so a hover
	 * sequence fires once on entering a shape (not on every descendant transition
	 * that `mouseover` bubbles up) and is reset on leaving it.
	 */
	let currentHoverTriggerId: string | undefined;

	function onFrameHover(event: MouseEvent): void {
		const id = closestElementId(event.target);
		const triggerId = id && playback.hoverTriggerShapeIds.value.has(id) ? id : undefined;
		if (triggerId === currentHoverTriggerId) {
			return;
		}
		if (currentHoverTriggerId) {
			playback.handleHoverEnd(currentHoverTriggerId);
		}
		currentHoverTriggerId = triggerId;
		if (triggerId) {
			playback.handleHoverStart(triggerId);
		}
	}

	function onFrameHoverEnd(event: MouseEvent): void {
		// Only when leaving the frame subtree (not moving between its descendants).
		const related = event.relatedTarget;
		if (related instanceof Node && frameRef.value?.contains(related)) {
			return;
		}
		if (currentHoverTriggerId) {
			playback.handleHoverEnd(currentHoverTriggerId);
			currentHoverTriggerId = undefined;
		}
	}

	// `nextTick` because the states change in the same tick as the slide swap
	// that re-renders the nodes being styled; without it the write lands on the
	// OUTGOING slide's DOM.
	watch(
		[
			playback.presentationElementStates,
			playback.interactiveTriggerShapeIds,
			playback.hoverTriggerShapeIds,
			options.activeSlide,
		],
		() => {
			void nextTick(applyAnimationStyles);
		},
		{ immediate: true },
	);

	return { onFrameClick, onFrameHover, onFrameHoverEnd };
}
