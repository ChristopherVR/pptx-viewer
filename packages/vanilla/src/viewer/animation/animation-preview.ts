import type { PptxElementAnimation } from 'pptx-viewer-core';
import type { AnimationPreviewDescriptor } from 'pptx-viewer-shared';
import { buildMotionPathPreview, buildPreviewAnimation } from 'pptx-viewer-shared';

/** Slide size assumed when the stage cannot be measured (detached documents). */
const FALLBACK_SLIDE_WIDTH = 1280;
const FALLBACK_SLIDE_HEIGHT = 720;

/**
 * Build the preview descriptor for one animation entry.
 *
 * WHY the motion path wins over the preset buckets: a path is the effect being
 * authored on the canvas at that moment, and playing a fade instead would hide
 * the travel entirely (which is the only thing the author is looking at). Both
 * branches come from `pptx-viewer-shared`, so the ribbon, the inspector panel
 * and the other bindings all play the identical keyframes.
 *
 * @param target - The rendered node, used only to measure the slide stage: path
 * coordinates are fractions of the SLIDE, not of the element box.
 */
export function buildAnimationPreview(
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
 * Play a one-shot canvas preview of the element's active effect by injecting
 * the shared keyframes and applying the shorthand to the stage node for the
 * element (React's `useAnimationPreview` DOM player).
 *
 * Shared by the ribbon's Preview command and the inspector panel's Preview
 * button so the two surfaces can never drift apart.
 */
export function playAnimationPreview(
	doc: Document,
	animation: PptxElementAnimation | undefined,
): void {
	if (!animation) {
		return;
	}
	const target = doc.querySelector<HTMLElement>(
		`[data-element-id="${CSS.escape(animation.elementId)}"]`,
	);
	if (!target) {
		return;
	}
	const descriptor = buildAnimationPreview(animation, target);
	if (!descriptor) {
		return;
	}
	const styleId = `pptxv-anim-preview-${descriptor.keyframeName}`;
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
