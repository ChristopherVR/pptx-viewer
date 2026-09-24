import type { PptxSlide } from 'pptx-viewer-core';
import type { ZoomNavigationTarget } from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

export const ZoomNavigationContextKey = Symbol('pptx-svelte-zoom-navigation');

export interface ZoomNavigationSource {
	/**
	 * Navigate the running presentation to a zoom's target, applying its own
	 * `zmPr/@transitionDur` when authored and arming a "return to zoom"
	 * excursion when `returnToParent` is set.
	 */
	navigateToZoomTarget: (target: ZoomNavigationTarget) => void;
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
