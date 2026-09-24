/**
 * Thin wrapper around `pptx-viewer-shared`'s `animation-ribbon-preview`
 * module (itself lifted from this file and vanilla's identical copy): the
 * descriptor construction and DOM injection now live in ONE place shared by
 * all five bindings' ribbons. This wrapper only keeps the boolean
 * "did anything play" return value `AnimationsTab.svelte` and
 * `motion-path-preview.test.ts` already depend on.
 */
import type { PptxElementAnimation } from 'pptx-viewer-core';
import { buildAnimationRibbonPreview, playAnimationRibbonPreview } from 'pptx-viewer-shared';

export function previewElementAnimation(animation: PptxElementAnimation): boolean {
	const target = document.querySelector<HTMLElement>(
		`[data-element-id="${CSS.escape(animation.elementId)}"]`,
	);
	if (!target || !buildAnimationRibbonPreview(animation, target)) {
		return false;
	}
	playAnimationRibbonPreview(document, animation);
	return true;
}
