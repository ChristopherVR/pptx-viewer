import type { PptxElementAnimation } from 'pptx-viewer-core';
import type { AnimationPreviewDescriptor } from 'pptx-viewer-shared';
import { buildMotionPathPreview, buildPreviewAnimation } from 'pptx-viewer-shared';

/** Slide size assumed when the stage cannot be measured (detached preview). */
const FALLBACK_SLIDE_WIDTH = 1280;
const FALLBACK_SLIDE_HEIGHT = 720;

/**
 * Build the descriptor for one animation entry.
 *
 * A motion path WINS over the preset buckets: it is the effect being authored
 * on the canvas at that moment, and a fade would hide the travel entirely. The
 * slide size comes from the element's offset parent (the stage), because path
 * coordinates are fractions of the SLIDE, not of the element box.
 */
function describe(
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
	if (!preset) {
		return undefined;
	}
	return buildPreviewAnimation(preset, {
		direction: animation.direction,
		durationMs: animation.durationMs,
		timingCurve: animation.timingCurve,
	});
}

export function previewElementAnimation(animation: PptxElementAnimation): boolean {
	const target = document.querySelector<HTMLElement>(
		`[data-element-id="${CSS.escape(animation.elementId)}"]`,
	);
	if (!target) {
		return false;
	}
	const descriptor = describe(animation, target);
	if (!descriptor) {
		return false;
	}
	const style = document.createElement('style');
	style.textContent = descriptor.keyframesCss;
	document.head.appendChild(style);
	target.style.animation = 'none';
	void target.offsetWidth;
	target.style.animation = descriptor.cssAnimation;
	target.addEventListener(
		'animationend',
		() => {
			target.style.animation = '';
			style.remove();
		},
		{ once: true },
	);
	return true;
}
