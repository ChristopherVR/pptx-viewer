import type { PptxElementAnimation } from 'pptx-viewer-core';
import { buildAnimationRibbonPreview } from 'pptx-viewer-shared';
import type { AnimationPreviewDescriptor } from 'pptx-viewer-shared';

interface ActivePreview {
	element: HTMLElement;
	style: HTMLStyleElement;
	timer: ReturnType<typeof setTimeout>;
	originalAnimation: string;
	originalVisibility: string;
}

let active: ActivePreview | undefined;

export function stopVueAnimationPreview(): void {
	if (!active) {
		return;
	}
	clearTimeout(active.timer);
	active.element.style.animation = active.originalAnimation;
	active.element.style.visibility = active.originalVisibility;
	active.style.remove();
	active = undefined;
}

/** The rendered node for an animation's element, on whichever stage owns it. */
function findAnimatedElement(elementId: string): HTMLElement | undefined {
	return [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find(
		(candidate) => candidate.dataset['elementId'] === elementId,
	);
}

/**
 * Build the descriptor for one animation entry.
 *
 * A motion path WINS over a preset: it is the effect being authored on the
 * canvas at that moment, and a fade would hide the travel entirely. Its slide
 * size comes from the element's offset parent (the stage), because path
 * coordinates are fractions of the SLIDE, not of the element box, and the stage
 * is laid out in unscaled slide pixels.
 */
function describePreview(
	animation: PptxElementAnimation,
	element: HTMLElement,
): AnimationPreviewDescriptor | undefined {
	// Shared decision (motion path first, else PowerPoint's own tree for the
	// preset measured against the stage, else the preset keyframe).
	return buildAnimationRibbonPreview(
		{ ...animation, durationMs: animation.durationMs ?? 500 },
		element,
	);
}

export function previewVueAnimation(animation: PptxElementAnimation): boolean {
	stopVueAnimationPreview();
	const element = findAnimatedElement(animation.elementId);
	if (!element) {
		return false;
	}
	const descriptor = describePreview(animation, element);
	if (!descriptor) {
		return false;
	}
	const style = document.createElement('style');
	style.textContent = descriptor.keyframesCss;
	document.head.appendChild(style);
	const originalAnimation = element.style.animation;
	const originalVisibility = element.style.visibility;
	element.style.animation = descriptor.cssAnimation;
	element.style.visibility = 'visible';
	const timer = setTimeout(stopVueAnimationPreview, descriptor.durationMs + 100);
	active = { element, style, timer, originalAnimation, originalVisibility };
	return true;
}
