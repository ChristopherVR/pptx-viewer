import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

/** Recursively add every explicit font family referenced by an element. */
export function collectFontsFromElement(element: PptxElement, fonts: Set<string>): void {
	if (hasTextProperties(element)) {
		if (element.textStyle?.fontFamily) {
			fonts.add(element.textStyle.fontFamily);
		}
		for (const segment of element.textSegments ?? []) {
			if (segment.style?.fontFamily) {
				fonts.add(segment.style.fontFamily);
			}
		}
	}
	if (element.type === 'group') {
		for (const child of element.children ?? []) {
			collectFontsFromElement(child, fonts);
		}
	}
}

/** Collect the sorted unique font families referenced across a presentation. */
export function collectUsedFonts(slides: readonly PptxSlide[]): string[] {
	const fonts = new Set<string>();
	for (const slide of slides) {
		for (const element of slide.elements ?? []) {
			collectFontsFromElement(element, fonts);
		}
	}
	return [...fonts].sort();
}
