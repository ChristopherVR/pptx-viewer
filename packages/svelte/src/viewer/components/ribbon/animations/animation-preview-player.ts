import type { PptxElementAnimation } from 'pptx-viewer-core';
import { buildPreviewAnimation } from 'pptx-viewer-shared';

export function previewElementAnimation(animation: PptxElementAnimation): boolean {
	const preset = animation.entrance ?? animation.emphasis ?? animation.exit;
	if (!preset) {
		return false;
	}
	const descriptor = buildPreviewAnimation(preset, {
		direction: animation.direction,
		durationMs: animation.durationMs,
		timingCurve: animation.timingCurve,
	});
	const target = document.querySelector<HTMLElement>(
		`[data-element-id="${CSS.escape(animation.elementId)}"]`,
	);
	if (!descriptor || !target) {
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
