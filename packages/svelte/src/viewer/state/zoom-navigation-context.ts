import type { PptxSlide } from 'pptx-viewer-core';
import { getContext, setContext } from 'svelte';

export const ZoomNavigationContextKey = Symbol('pptx-svelte-zoom-navigation');

export interface ZoomNavigationSource {
	navigateToZoomTarget: (index: number) => void;
	getSlides: () => readonly PptxSlide[];
}

export interface ZoomTargetInfo {
	backgroundColor: string | undefined;
	slideNumber: number;
	sectionName: string | undefined;
}

export function provideZoomNavigation(source: ZoomNavigationSource): void {
	setContext(ZoomNavigationContextKey, source);
}

export function useZoomNavigation(): ZoomNavigationSource | undefined {
	return getContext<ZoomNavigationSource | undefined>(ZoomNavigationContextKey);
}

export function resolveZoomTargetInfo(
	source: ZoomNavigationSource | undefined,
	index: number,
): ZoomTargetInfo | undefined {
	const slide = source?.getSlides()[index];
	if (!slide) {
		return undefined;
	}
	return {
		backgroundColor: slide.backgroundColor,
		slideNumber: slide.slideNumber ?? index + 1,
		sectionName: slide.sectionName ?? slide.sectionId,
	};
}
