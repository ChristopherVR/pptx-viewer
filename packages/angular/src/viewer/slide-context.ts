/**
 * Slide-scoped DI context: lets leaf renderers (chart, SmartArt) resolve which
 * slide their canvas is displaying without threading an input through every
 * layer. `SlideCanvasComponent` provides itself under this token.
 *
 * Needed for template (master/layout) elements: they are partitioned OUT of
 * `slides[].elements` into the per-slide template store, so an element-id
 * search over the deck cannot find them; the owning slide is simply the slide
 * the hosting canvas is rendering.
 */
import { InjectionToken } from '@angular/core';

export interface SlideContext {
	/** Id of the slide this canvas renders, or null when none is loaded. */
	slideId(): string | null;
}

export const SLIDE_CONTEXT = new InjectionToken<SlideContext>('pptx-slide-context');
