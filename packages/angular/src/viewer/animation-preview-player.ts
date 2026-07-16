import type { PptxElementAnimation } from 'pptx-viewer-core';

import { buildPreviewAnimation } from '../internal/shared';

interface ActiveAnimationPreview {
	element: HTMLElement;
	styleElement: HTMLStyleElement;
	timer: ReturnType<typeof setTimeout>;
	originalAnimation: string;
	originalVisibility: string;
}

let activePreview: ActiveAnimationPreview | undefined;

function findElement(elementId: string): HTMLElement | undefined {
	return [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find(
		(element) => element.dataset['elementId'] === elementId,
	);
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

export function previewAngularAnimation(animation: PptxElementAnimation): boolean {
	stopAngularAnimationPreview();
	const preset = animation.entrance ?? animation.emphasis ?? animation.exit;
	if (!preset || preset === 'none') {
		return false;
	}
	const descriptor = buildPreviewAnimation(preset, {
		direction: animation.direction,
		durationMs: animation.durationMs ?? 500,
		timingCurve: animation.timingCurve,
	});
	const element = descriptor ? findElement(animation.elementId) : undefined;
	if (!descriptor || !element) {
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
