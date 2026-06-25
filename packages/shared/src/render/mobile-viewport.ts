/**
 * mobile-viewport.ts: framework-agnostic viewport / touch / orientation
 * detection shared by the React, Vue, and Angular bindings.
 *
 * These are the pure predicates and feature-detection helpers behind each
 * binding's `useIsMobile` / `IsMobileService`. The reactive wiring (React
 * state, Vue refs, Angular signals) stays in the binding; the breakpoint maths
 * and DOM capability probes live here so all three frameworks switch chrome at
 * exactly the same thresholds.
 *
 * SSR / test safe: every probe feature-detects `window` / `navigator` /
 * `screen` and returns a sensible default when absent.
 */

/** Mobile breakpoint: below this width is considered mobile. */
export const MOBILE_BREAKPOINT = 768;

/** Tablet breakpoint: below this width (but >= MOBILE) is tablet. */
export const TABLET_BREAKPOINT = 1024;

/**
 * Max viewport height (px) at which a *touch* device is treated as mobile
 * regardless of width. Catches landscape phones (e.g. 915x412), which are wide
 * enough to fall in the "tablet" width band but far too short for the desktop
 * ribbon + side panels, so they need the mobile chrome. Tablets in landscape
 * are taller (~760px+) so they stay on the desktop layout.
 */
export const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;

/** Device orientation as reported by the screen / viewport aspect ratio. */
export type DeviceOrientation = 'portrait' | 'landscape';

/**
 * Whether a viewport should use the mobile layout: a narrow viewport, OR a
 * short touch viewport below the tablet width (a landscape phone, which is wide
 * enough to look like a tablet but far too short for the desktop ribbon).
 *
 * @pure: no side effects, fully testable without a DOM.
 */
export function isMobileViewport(width: number, height: number, isTouch: boolean): boolean {
	if (width < MOBILE_BREAKPOINT) {
		return true;
	}
	return isTouch && height > 0 && height < MOBILE_LANDSCAPE_MAX_HEIGHT && width < TABLET_BREAKPOINT;
}

/**
 * Whether a width is in the "tablet" band (desktop chrome, 768..1023px wide).
 * Width-only: callers that need the "short landscape phone is mobile, not
 * tablet" carve-out should gate this with `!isMobileViewport(...)` first.
 *
 * @pure
 */
export function isTabletViewport(width: number): boolean {
	return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
}

/** Whether the current runtime reports touch capability. */
export function detectTouchDevice(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	if ('ontouchstart' in window) {
		return true;
	}
	if (typeof navigator === 'undefined') {
		return false;
	}
	if (navigator.maxTouchPoints > 0) {
		return true;
	}
	// Legacy IE/Edge: `msMaxTouchPoints` is not in lib.dom's `Navigator`.
	const legacy = (navigator as Navigator & { msMaxTouchPoints?: number }).msMaxTouchPoints;
	return typeof legacy === 'number' && legacy > 0;
}

/** Current device orientation from `screen.orientation` or the viewport aspect. */
export function detectOrientation(): DeviceOrientation {
	if (typeof window === 'undefined') {
		return 'landscape';
	}
	if (typeof screen !== 'undefined' && screen.orientation) {
		return screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape';
	}
	return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}
