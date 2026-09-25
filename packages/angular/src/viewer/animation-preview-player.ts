/**
 * animation-preview-player.ts: the DOM half of the animation preview.
 *
 * Descriptor construction (the `@keyframes` block plus the `animation`
 * shorthand) is pure and lives in `pptx-viewer-shared`; only injecting the
 * `<style>` element and toggling the target's inline animation is a binding's
 * business.
 */
import type { PptxElementAnimation } from 'pptx-viewer-core';

import { buildAnimationRibbonPreview } from '../internal/shared';
import type { AnimationPreviewDescriptor } from '../internal/shared';

interface ActiveAnimationPreview {
	element: HTMLElement;
	styleElement: HTMLStyleElement;
	timer: ReturnType<typeof setTimeout>;
	originalAnimation: string;
	originalVisibility: string;
}

let activePreview: ActiveAnimationPreview | undefined;

/**
 * The element a preview should play on.
 *
 * The slides panel renders a thumbnail of the SAME element with the same
 * `data-element-id`, and it comes first in DOM order, so taking the first match
 * played every preview on a thumbnail the user is not looking at. For a motion
 * path that is worse than invisible: the travel is measured against the
 * thumbnail's own tiny stage, so it also plays at the wrong distance. Only the
 * interactive main canvas carries `data-pptx-viewport`, which is the neutral
 * marker every binding already agrees on.
 */
function findElement(elementId: string): HTMLElement | undefined {
	const matches = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].filter(
		(element) => element.dataset['elementId'] === elementId,
	);
	return matches.find((element) => element.closest('[data-pptx-viewport]')) ?? matches[0];
}

export function stopAngularAnimationPreview(): void {
	if (!activePreview) {
		return;
	}
	clearTimeout(activePreview.timer);
	activePreview.element.style.animation = activePreview.originalAnimation;
	activePreview.element.style.visibility = activePreview.originalVisibility;
	activePreview.styleElement.remove();
	activePreview = undefined;
}

/**
 * Pick the descriptor an animation entry should play.
 *
 * A motion path WINS over the preset buckets: it is the effect being authored
 * on the canvas at that moment, and a fade or a spin would hide the travel
 * entirely. The slide size comes from the element's offset parent (the stage)
 * because path coordinates are fractions of the SLIDE, not of the element's own
 * box, and the stage is laid out in unscaled slide pixels.
 */
export function buildAngularPreviewDescriptor(
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

export function previewAngularAnimation(animation: PptxElementAnimation): boolean {
	stopAngularAnimationPreview();
	const element = findElement(animation.elementId);
	if (!element) {
		return false;
	}
	const descriptor = buildAngularPreviewDescriptor(animation, element);
	if (!descriptor) {
		return false;
	}
	const styleElement = document.createElement('style');
	styleElement.textContent = descriptor.keyframesCss;
	document.head.appendChild(styleElement);
	const originalAnimation = element.style.animation;
	const originalVisibility = element.style.visibility;
	element.style.visibility = 'visible';
	element.style.animation = descriptor.cssAnimation;
	const timer = setTimeout(() => stopAngularAnimationPreview(), descriptor.durationMs + 100);
	activePreview = { element, styleElement, timer, originalAnimation, originalVisibility };
	return true;
}
