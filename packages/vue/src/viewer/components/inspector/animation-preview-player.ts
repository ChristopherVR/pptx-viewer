import type { PptxElementAnimation } from 'pptx-viewer-core';
import { buildPreviewAnimation } from 'pptx-viewer-shared';

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

export function previewVueAnimation(animation: PptxElementAnimation): boolean {
	stopVueAnimationPreview();
	const preset = animation.entrance ?? animation.emphasis ?? animation.exit;
	if (!preset || preset === 'none') {
		return false;
	}
	const descriptor = buildPreviewAnimation(preset, {
		direction: animation.direction,
		durationMs: animation.durationMs ?? 500,
		timingCurve: animation.timingCurve,
	});
	const element = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find(
		(candidate) => candidate.dataset['elementId'] === animation.elementId,
	);
	if (!descriptor || !element) {
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
