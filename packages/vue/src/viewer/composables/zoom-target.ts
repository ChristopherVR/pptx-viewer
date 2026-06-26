import type { PptxSlide } from 'pptx-viewer-core';
import type { InjectionKey } from 'vue';
import { inject, provide } from 'vue';

/**
 * The subset of a target slide a Zoom tile needs to draw a higher-fidelity
 * fallback thumbnail (mirrors React's `ZoomSlideThumbnail`): the slide's own
 * background colour, its display number, and the friendly section name.
 */
export interface ZoomTargetInfo {
	/** Target slide background colour (CSS), used as the fallback tile fill. */
	backgroundColor?: string;
	/** The slide's own display number (not the array index + 1). */
	slideNumber?: number;
	/** Friendly section name, when the slide belongs to a named section. */
	sectionName?: string;
}

/**
 * Zoom-target lookup context.
 *
 * Provided by the viewer root (which owns the parsed `slides`) and injected by
 * `ZoomRenderer` so a Slide-Zoom / Section-Zoom tile can resolve the target
 * slide's real background colour, slide number and section name for its fallback
 * thumbnail. When no provider is present (`injectZoomTargetLookup()` returns
 * `undefined`) the tile falls back to the target index and section GUID.
 */
export type ZoomTargetLookup = (targetSlideIndex: number) => ZoomTargetInfo | undefined;

/** Typed injection key for the zoom-target lookup context. */
export const ZoomTargetKey: InjectionKey<ZoomTargetLookup> = Symbol('pptx-vue-zoom-target');

/** Map a target slide to the minimal descriptor a Zoom tile renders. */
export function toZoomTargetInfo(slide: PptxSlide | undefined): ZoomTargetInfo | undefined {
	if (!slide) {
		return undefined;
	}
	return {
		backgroundColor: slide.backgroundColor,
		slideNumber: slide.slideNumber,
		sectionName: slide.sectionName,
	};
}

/** Provide a zoom-target lookup over the presentation's slides to descendants. */
export function provideZoomTargetLookup(lookup: ZoomTargetLookup): void {
	provide(ZoomTargetKey, lookup);
}

/**
 * Resolve the injected zoom-target lookup, or `undefined` when no provider is
 * present (e.g. an isolated ZoomRenderer mount in a test).
 */
export function injectZoomTargetLookup(): ZoomTargetLookup | undefined {
	return inject(ZoomTargetKey, undefined);
}
