import type { ZoomNavigationTarget } from 'pptx-viewer-shared';
import type { InjectionKey } from 'vue';
import { inject, provide } from 'vue';

/**
 * Presentation-mode zoom navigation context.
 *
 * Provided by the presentation controller (which owns the active-slide index)
 * and injected by `ZoomRenderer` so a Slide-Zoom / Section-Zoom tile can jump to
 * its target slide when clicked. Outside presentation mode the context is absent
 * (`injectZoomNavigation()` returns `undefined`), so the zoom tile stays a static
 * link, exactly as before.
 */
export interface ZoomNavigationContext {
	/**
	 * Navigate the running presentation to a zoom's target, applying its own
	 * `zmPr/@transitionDur` when authored and arming a "return to zoom"
	 * excursion when `returnToParent` is set.
	 */
	navigateToZoomTarget: (target: ZoomNavigationTarget) => void;
}

/** Typed injection key for the zoom-navigation context. */
export const ZoomNavigationKey: InjectionKey<ZoomNavigationContext> = Symbol(
	'pptx-vue-zoom-navigation',
);

/** Provide the zoom-navigation context to descendant renderers. */
export function provideZoomNavigation(context: ZoomNavigationContext): void {
	provide(ZoomNavigationKey, context);
}

/**
 * Resolve the injected zoom-navigation context, or `undefined` when no
 * presentation controller is providing one (read-only / editor rendering).
 */
export function injectZoomNavigation(): ZoomNavigationContext | undefined {
	return inject(ZoomNavigationKey, undefined);
}
