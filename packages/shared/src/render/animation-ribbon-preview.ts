/**
 * The Ribbon Animations tab's "Preview" command: a real in-place preview of
 * the selected element's authored effect, played directly on the live canvas
 * node.
 *
 * Only Svelte and Vanilla ever wired this up for real: React and Vue's
 * Preview button just highlighted itself for a second and did nothing, and
 * Angular's started the FULL slide show, leaving the editor entirely. Vanilla
 * already shared one copy of this DOM player between its own ribbon and
 * inspector-panel Preview buttons ("Shared by the ribbon's Preview command
 * and the inspector panel's Preview button so the two surfaces can never
 * drift apart" - the same reasoning now applies across bindings, not just
 * within one). This module is that one implementation, lifted out so all five
 * ribbons can call it instead of five (or fewer) independent re-implementations.
 *
 * The scope is deliberately the same as the two bindings that already worked:
 * a one-shot preview of the SELECTED element's own effect (the button is
 * disabled otherwise), not a full click-stepped playback of the slide's whole
 * animation sequence - that is what presentation mode's
 * `PresentationAnimationController` already does, and reusing this simpler
 * player is what kept the fix bounded enough to land in all five bindings at
 * once instead of none.
 *
 * @module render/animation-ribbon-preview
 */
import type { PptxElementAnimation } from 'pptx-viewer-core';

import type { AnimationPreviewDescriptor } from './animation-preview';
import { buildPreviewAnimation } from './animation-preview';
import { findCanvasElementNode } from './canvas-element-node';
import { buildMotionPathPreview } from './motion-path-authoring';

/** Slide size assumed when the stage cannot be measured (detached documents). */
const FALLBACK_SLIDE_WIDTH = 1280;
const FALLBACK_SLIDE_HEIGHT = 720;

/**
 * Build the preview descriptor for one animation entry.
 *
 * The motion path wins over the preset buckets: a path is the effect being
 * authored on the canvas at that moment, and playing a fade instead would
 * hide the travel entirely (which is the only thing the author is looking
 * at).
 *
 * @param target - The rendered node, used only to measure the slide stage:
 * path coordinates are fractions of the SLIDE, not of the element box.
 */
export function buildAnimationRibbonPreview(
	animation: PptxElementAnimation,
	target: HTMLElement,
): AnimationPreviewDescriptor | undefined {
	if (animation.motionPath) {
		const stage = target.offsetParent as HTMLElement | null;
		return buildMotionPathPreview({
			path: animation.motionPath,
			slideWidth: stage?.offsetWidth || FALLBACK_SLIDE_WIDTH,
			slideHeight: stage?.offsetHeight || FALLBACK_SLIDE_HEIGHT,
			durationMs: animation.durationMs,
			delayMs: animation.delayMs,
			timingCurve: animation.timingCurve,
		});
	}
	const preset = animation.entrance ?? animation.emphasis ?? animation.exit;
	if (!preset || preset === 'none') {
		return undefined;
	}
	return buildPreviewAnimation(preset, {
		direction: animation.direction,
		durationMs: animation.durationMs,
		timingCurve: animation.timingCurve,
	});
}

/**
 * Play a one-shot canvas preview of `animation`'s effect by injecting the
 * shared keyframes and applying the CSS animation shorthand to the element's
 * own rendered node (found by `data-element-id`). A no-op when the element is
 * not mounted (e.g. it is on a different slide) or the animation has no
 * effect to show.
 */
export function playAnimationRibbonPreview(
	doc: Document,
	animation: PptxElementAnimation | undefined,
): void {
	if (!animation) {
		return;
	}
	// The canvas copy, not a slides-pane thumbnail's (see canvas-element-node).
	const target = findCanvasElementNode(doc, animation.elementId);
	if (!target) {
		return;
	}
	const descriptor = buildAnimationRibbonPreview(animation, target);
	if (!descriptor) {
		return;
	}
	const styleId = `pptx-anim-ribbon-preview-${descriptor.keyframeName}`;
	// A motion-path descriptor reuses one keyframe name across paths, so the
	// stale block must be replaced rather than skipped as already present.
	doc.getElementById(styleId)?.remove();
	const style = doc.createElement('style');
	style.id = styleId;
	style.textContent = descriptor.keyframesCss;
	(doc.head ?? doc.documentElement).appendChild(style);

	target.style.animation = 'none';
	// Force a reflow so re-applying the same animation restarts it.
	void target.offsetWidth;
	target.style.animation = descriptor.cssAnimation;
	const clear = (): void => {
		target.style.animation = '';
	};
	target.addEventListener('animationend', clear, { once: true });
	setTimeout(clear, descriptor.durationMs + 250);
}
