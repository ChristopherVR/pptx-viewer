/**
 * Scope the list of available layout options to the active slide's master.
 *
 * The scoping rules now live in `pptx-viewer-shared` so all five bindings
 * apply them: this file is the React-shaped adapter that takes a slide rather
 * than a layout path. Angular derived its own list from the deck's masters and
 * Vue, Svelte and Vanilla did no scoping at all, which is exactly the drift
 * the shared module exists to prevent.
 */
import type { PptxLayoutOption, PptxSlide } from 'pptx-viewer-core';
import { scopeLayoutOptionsToSlide } from 'pptx-viewer-shared';

export function scopeLayoutOptionsToActiveSlide(
	options: PptxLayoutOption[],
	activeSlide: PptxSlide | undefined,
): PptxLayoutOption[] {
	return scopeLayoutOptionsToSlide(options, activeSlide?.layoutPath);
}
