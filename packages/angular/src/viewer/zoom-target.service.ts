import { Injectable, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

/**
 * Minimal descriptor of a zoom's target slide, threaded to the renderer so the
 * fallback thumbnail (shown when a zoom has no embedded preview image) can use
 * the real target slide's background, number, and friendly section name instead
 * of grey/index/section-GUID placeholders. Mirrors the React
 * `ZoomSlideThumbnail` reference, which reads exactly these three fields.
 */
export interface ZoomTargetInfo {
	/** The target slide's background colour, used as the tile background. */
	readonly backgroundColor?: string;
	/** The target slide's own 1-based number (not the array index + 1). */
	readonly slideNumber?: number;
	/** The target slide's friendly section name (not the section GUID). */
	readonly sectionName?: string;
}

/**
 * ZoomTargetService: viewer-scoped lookup from a zoom element's target slide
 * index to a {@link ZoomTargetInfo} descriptor.
 *
 * Provided by `PowerPointViewerComponent` from its loaded slides, then injected
 * `{ optional: true }` by `ZoomRendererComponent`. Trees that do not provide it
 * (e.g. isolated component tests) resolve `null`, so the renderer falls back to
 * the old grey/index/GUID thumbnail. This mirrors the optional-DI pattern of
 * {@link ZoomNavigationService}.
 *
 * Intentionally NOT `providedIn: 'root'`: it is supplied per viewer so the
 * lookup always reflects that viewer's deck.
 */
@Injectable()
export class ZoomTargetService {
	/** The deck the lookup resolves against; seeded by the viewer. */
	private readonly slides = signal<readonly PptxSlide[]>([]);

	/** Replace the deck used to resolve zoom targets. */
	setSlides(slides: readonly PptxSlide[]): void {
		this.slides.set(slides);
	}

	/**
	 * Resolve the descriptor for a zoom's target slide, or `undefined` when the
	 * index is out of range (so the renderer keeps its index-based fallback).
	 */
	lookup(targetSlideIndex: number): ZoomTargetInfo | undefined {
		const slide = this.slides()[targetSlideIndex];
		if (!slide) {
			return undefined;
		}
		return {
			backgroundColor: slide.backgroundColor,
			slideNumber: slide.slideNumber,
			sectionName: slide.sectionName,
		};
	}
}
