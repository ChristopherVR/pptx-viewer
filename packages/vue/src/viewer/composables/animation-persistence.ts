import type { PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';

export function mergeElementAnimations(
	slide: PptxSlide,
	elementId: string,
	animations: readonly PptxElementAnimation[],
): PptxSlide {
	const others = (slide.animations ?? []).filter((animation) => animation.elementId !== elementId);
	return { ...slide, animations: [...others, ...animations] };
}

export function replaceSlideAnimations(
	slides: readonly PptxSlide[],
	index: number,
	animations: readonly PptxElementAnimation[],
): PptxSlide[] {
	const slide = slides[index];
	if (!slide) {
		return [...slides];
	}
	const next = slides.slice();
	next[index] = { ...slide, animations: [...animations] };
	return next;
}
