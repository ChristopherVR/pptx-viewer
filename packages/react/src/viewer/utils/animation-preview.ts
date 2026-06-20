/**
 * Animation Preview: DOM player + pure descriptor re-exports.
 *
 * The pure preview-descriptor construction (`timingCurveToCss`,
 * `buildPreviewAnimation`, `parseOoxmlBezierCurve`, `AnimationPreviewDescriptor`)
 * now lives in `pptx-viewer-shared` (`render/animation-preview`). Only the
 * DOM-based player (which injects a `<style>` element and toggles the target
 * element's inline animation) stays in the React binding.
 */
import type {
	PptxAnimationPreset,
	PptxAnimationDirection,
	PptxAnimationTimingCurve,
} from 'pptx-viewer-core';
import { buildPreviewAnimation } from 'pptx-viewer-shared';

export type { AnimationPreviewDescriptor } from 'pptx-viewer-shared';
export { timingCurveToCss, buildPreviewAnimation, parseOoxmlBezierCurve } from 'pptx-viewer-shared';

// ==========================================================================
// DOM-based preview player (binding-only)
// ==========================================================================

/** Tracks an active preview so it can be cancelled. */
interface ActivePreview {
	elementId: string;
	timeoutId: ReturnType<typeof setTimeout>;
	styleEl: HTMLStyleElement;
	originalAnimation: string;
	originalVisibility: string;
}

let activePreview: ActivePreview | null = null;

/**
 * Start a preview animation on a specific element in the canvas.
 *
 * If a preview is already playing, it is cancelled first.
 * The preview automatically cleans up after the animation completes.
 */
export function startPreviewAnimation(
	elementId: string,
	preset: PptxAnimationPreset,
	options?: {
		direction?: PptxAnimationDirection;
		durationMs?: number;
		timingCurve?: PptxAnimationTimingCurve;
		cubicBezier?: string;
	},
): void {
	// Cancel any existing preview
	stopPreviewAnimation();

	const descriptor = buildPreviewAnimation(preset, options);
	if (!descriptor) {
		return;
	}

	// Find the DOM element
	const domEl = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement | null;
	if (!domEl) {
		return;
	}

	// Inject keyframes
	const styleEl = document.createElement('style');
	styleEl.textContent = descriptor.keyframesCss;
	document.head.appendChild(styleEl);

	// Store original state
	const originalAnimation = domEl.style.animation;
	const originalVisibility = domEl.style.visibility;

	// Apply preview animation
	domEl.style.visibility = 'visible';
	domEl.style.animation = descriptor.cssAnimation;

	// Schedule cleanup
	const timeoutId = setTimeout(() => {
		domEl.style.animation = originalAnimation;
		domEl.style.visibility = originalVisibility;
		styleEl.remove();
		if (activePreview?.elementId === elementId) {
			activePreview = null;
		}
	}, descriptor.durationMs + 100);

	activePreview = {
		elementId,
		timeoutId,
		styleEl,
		originalAnimation,
		originalVisibility,
	};
}

/**
 * Stop any currently playing preview animation and restore original state.
 */
export function stopPreviewAnimation(): void {
	if (!activePreview) {
		return;
	}

	clearTimeout(activePreview.timeoutId);
	activePreview.styleEl.remove();

	const domEl = document.querySelector(
		`[data-element-id="${activePreview.elementId}"]`,
	) as HTMLElement | null;
	if (domEl) {
		domEl.style.animation = activePreview.originalAnimation;
		domEl.style.visibility = activePreview.originalVisibility;
	}

	activePreview = null;
}
