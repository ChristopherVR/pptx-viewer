import type { PptxElementAnimation } from 'pptx-viewer-core';
import { buildPreviewAnimation } from 'pptx-viewer-shared';

/**
 * Cancellable DOM preview player for the docked AnimationPanel: the Svelte
 * port of React's `utils/animation-preview.ts` start/stop pair. The simpler
 * ribbon player (`ribbon/animations/animation-preview-player.ts`) is
 * fire-and-forget; the inspector needs an explicit stop because timeline rows
 * preview on hover and must reset on mouse-leave.
 */

interface ActivePreview {
	elementId: string;
	timeoutId: ReturnType<typeof setTimeout>;
	styleEl: HTMLStyleElement;
	originalAnimation: string;
	originalVisibility: string;
}

let activePreview: ActivePreview | null = null;

function findTarget(elementId: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(elementId)}"]`);
}

/**
 * Play the animation entry's effect on its canvas element. Cancels any
 * running preview first; cleans itself up when the effect ends.
 */
export function startAnimationPreview(anim: PptxElementAnimation): void {
	stopAnimationPreview();
	const preset = anim.entrance ?? anim.emphasis ?? anim.exit;
	if (!preset || preset === 'none') {
		return;
	}
	const descriptor = buildPreviewAnimation(preset, {
		direction: anim.direction,
		durationMs: anim.durationMs ?? 500,
		timingCurve: anim.timingCurve,
	});
	if (!descriptor) {
		return;
	}
	const target = findTarget(anim.elementId);
	if (!target) {
		return;
	}
	const styleEl = document.createElement('style');
	styleEl.textContent = descriptor.keyframesCss;
	document.head.appendChild(styleEl);

	const originalAnimation = target.style.animation;
	const originalVisibility = target.style.visibility;
	target.style.visibility = 'visible';
	target.style.animation = descriptor.cssAnimation;

	const timeoutId = setTimeout(() => {
		target.style.animation = originalAnimation;
		target.style.visibility = originalVisibility;
		styleEl.remove();
		if (activePreview?.elementId === anim.elementId) {
			activePreview = null;
		}
	}, descriptor.durationMs + 100);

	activePreview = {
		elementId: anim.elementId,
		timeoutId,
		styleEl,
		originalAnimation,
		originalVisibility,
	};
}

/** Stop the running preview (if any) and restore the element's inline style. */
export function stopAnimationPreview(): void {
	if (!activePreview) {
		return;
	}
	clearTimeout(activePreview.timeoutId);
	activePreview.styleEl.remove();
	const target = findTarget(activePreview.elementId);
	if (target) {
		target.style.animation = activePreview.originalAnimation;
		target.style.visibility = activePreview.originalVisibility;
	}
	activePreview = null;
}
