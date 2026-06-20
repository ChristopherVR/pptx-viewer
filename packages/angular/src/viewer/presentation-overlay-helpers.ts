/**
 * presentation-overlay-helpers.ts
 *
 * Pure functions used by PresentationOverlayComponent.
 * Exported separately so they can be unit-tested without TestBed.
 */
import type { PptxSlide } from 'pptx-viewer-core';

/**
 * Clamp `index` to the valid range [0, count - 1].
 * Returns 0 when `count` is 0 to avoid -1 states.
 */
export function clampIndex(index: number, count: number): number {
	if (count <= 0) {
		return 0;
	}
	if (index < 0) {
		return 0;
	}
	if (index >= count) {
		return count - 1;
	}
	return index;
}

/**
 * Return the next visible (non-hidden) slide index after `current`.
 * Wraps around to `current` if no subsequent visible slide exists.
 */
export function nextVisibleIndex(current: number, slides: readonly PptxSlide[]): number {
	const count = slides.length;
	if (count === 0) {
		return 0;
	}
	for (let offset = 1; offset < count; offset++) {
		const candidate = (current + offset) % count;
		if (!slides[candidate].hidden) {
			return candidate;
		}
	}
	// All remaining slides are hidden; stay at current.
	return current;
}

/**
 * Return the previous visible (non-hidden) slide index before `current`.
 * Wraps around to `current` if no earlier visible slide exists.
 */
export function prevVisibleIndex(current: number, slides: readonly PptxSlide[]): number {
	const count = slides.length;
	if (count === 0) {
		return 0;
	}
	for (let offset = 1; offset < count; offset++) {
		const candidate = (((current - offset) % count) + count) % count;
		if (!slides[candidate].hidden) {
			return candidate;
		}
	}
	// All preceding slides are hidden; stay at current.
	return current;
}

/**
 * Compute the zoom level that fits a canvas of `canvasW × canvasH` pixels
 * into a viewport of `vw × vh` pixels, preserving aspect ratio.
 *
 * Returns 1 as a safe fallback when any dimension is zero or negative.
 */
export function fitZoom(canvasW: number, canvasH: number, vw: number, vh: number): number {
	if (canvasW <= 0 || canvasH <= 0 || vw <= 0 || vh <= 0) {
		return 1;
	}
	return Math.min(vw / canvasW, vh / canvasH);
}
