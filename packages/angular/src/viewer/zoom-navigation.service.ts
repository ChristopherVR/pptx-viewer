import { Injectable } from '@angular/core';

import type { ZoomNavigationTarget } from '../internal/shared';

/**
 * Handler that commits navigation to a zoom's target, applying its own
 * `zmPr/@transitionDur` and `returnToParent`. Registered by the presentation
 * controller, which owns the active-slide index.
 */
export type ZoomNavigationHandler = (target: ZoomNavigationTarget) => void;

/**
 * ZoomNavigationService: presentation-mode zoom navigation context.
 *
 * Angular equivalent of the Vue provide/inject `ZoomNavigationContext`. The
 * presentation controller (`PresentationOverlayComponent`) provides this service
 * at the component level and registers a handler wired to its slide navigation,
 * so a Slide-Zoom / Section-Zoom tile can jump to its target slide when clicked.
 *
 * Outside presentation mode the service is not provided, so a zoom renderer that
 * injects it `{ optional: true }` receives `null` and stays a static tile,
 * exactly as before.
 *
 * Intentionally NOT `providedIn: 'root'`: it is supplied per overlay so only
 * descendants rendered inside a running presentation resolve it.
 */
@Injectable()
export class ZoomNavigationService {
	private handler: ZoomNavigationHandler | null = null;

	/**
	 * Register the navigation handler. The presentation controller calls this
	 * once with a closure that commits the jump (clamp + set index + emit).
	 */
	setHandler(handler: ZoomNavigationHandler): void {
		this.handler = handler;
	}

	/**
	 * Navigate the running presentation to a zoom's target. No-op when no
	 * handler has been registered.
	 */
	navigateToZoomTarget(target: ZoomNavigationTarget): void {
		this.handler?.(target);
	}
}
