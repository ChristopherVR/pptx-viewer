/**
 * is-mobile.ts — Injectable signal-based mobile-detection service plus a
 * pure `computeIsMobile` helper for unit-testing.
 *
 * Ported from: packages/react/src/viewer/hooks/useIsMobile.ts
 *
 * The service tracks two independent media conditions:
 *   - `(pointer: coarse)` — primary pointer is a touch screen / stylus
 *   - viewport width below {@link MOBILE_BREAKPOINT}
 *
 * Both conditions are evaluated once at construction time and then kept live
 * via `MediaQueryList.addEventListener`. The service is SSR-safe: when
 * `matchMedia` is not available (server / test environment without a DOM) all
 * signals default to `false` and no listeners are registered.
 */

import { DestroyRef, inject, Injectable, signal } from '@angular/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Viewport width (px) below which the UI switches to mobile layout. */
export const MOBILE_BREAKPOINT = 768;

/** Tablet breakpoint — below this width (but >= MOBILE) is tablet. */
export const TABLET_BREAKPOINT = 1024;

// ---------------------------------------------------------------------------
// Pure helpers (no Angular deps — safe in vitest without a DOM)
// ---------------------------------------------------------------------------

/**
 * Decide whether the current environment is "mobile" based on two signals:
 * - `width` is the viewport / container width in pixels
 * - `coarsePointer` is true when `(pointer: coarse)` matches
 *
 * Either condition alone is sufficient (narrow viewport OR touch device).
 *
 * @pure — no side effects, fully testable without a DOM.
 */
export function computeIsMobile(width: number, coarsePointer: boolean): boolean {
	return width < MOBILE_BREAKPOINT || coarsePointer;
}

/**
 * Decide whether the current environment is "tablet" based on width only.
 * A coarse-pointer device at tablet width is still treated as mobile
 * (handled by `computeIsMobile`).
 *
 * @pure
 */
export function computeIsTablet(width: number, coarsePointer: boolean): boolean {
	if (coarsePointer) {
		return false;
	}
	return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
}

// ---------------------------------------------------------------------------
// IsMobileService
// ---------------------------------------------------------------------------

/**
 * `IsMobileService` — provides reactive signals for the current viewport /
 * pointer kind so components can switch between mobile and desktop chrome
 * without subscribing to resize events themselves.
 *
 * Inject at the component level (or provide at root) — the service cleans up
 * its `MediaQueryList` listeners automatically via `DestroyRef`.
 *
 * ```ts
 * providers: [IsMobileService]
 * // or globally:
 * // provideIsMobile()  (see factory below)
 * ```
 *
 * ```ts
 * protected readonly mobile = inject(IsMobileService);
 * // in template:  @if (mobile.isMobile()) { … }
 * ```
 */
@Injectable()
export class IsMobileService {
	/** True when the primary pointer is coarse (touch / stylus). */
	readonly isCoarsePointer = signal<boolean>(false);

	/** True when the viewport width is below {@link MOBILE_BREAKPOINT}. */
	readonly isNarrowViewport = signal<boolean>(false);

	/**
	 * True when either the pointer is coarse OR the viewport is narrow.
	 * Use this as the single gate for showing mobile chrome.
	 */
	readonly isMobile = signal<boolean>(false);

	/** True when the viewport is in the tablet range (desktop pointer only). */
	readonly isTablet = signal<boolean>(false);

	constructor() {
		const destroyRef = inject(DestroyRef);

		// Guard: matchMedia may not be available in SSR / test environments.
		if (typeof matchMedia !== 'function') {
			return;
		}

		// ── Coarse-pointer media query ───────────────────────────────────────────
		const coarseMql = matchMedia('(pointer: coarse)');
		this.isCoarsePointer.set(coarseMql.matches);
		this._update(coarseMql.matches, this.isNarrowViewport());

		const onCoarseChange = (evt: MediaQueryListEvent) => {
			this.isCoarsePointer.set(evt.matches);
			this._update(evt.matches, this.isNarrowViewport());
		};
		coarseMql.addEventListener('change', onCoarseChange);

		// ── Narrow-viewport media query ──────────────────────────────────────────
		const narrowMql = matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		this.isNarrowViewport.set(narrowMql.matches);
		this._update(this.isCoarsePointer(), narrowMql.matches);

		const onNarrowChange = (evt: MediaQueryListEvent) => {
			this.isNarrowViewport.set(evt.matches);
			this._update(this.isCoarsePointer(), evt.matches);
		};
		narrowMql.addEventListener('change', onNarrowChange);

		// ── Tablet media query ───────────────────────────────────────────────────
		const tabletMql = matchMedia(
			`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
		);

		const updateTablet = () => {
			this.isTablet.set(computeIsTablet(window.innerWidth, this.isCoarsePointer()));
		};
		updateTablet();
		tabletMql.addEventListener('change', updateTablet);

		// ── Cleanup on destroy ───────────────────────────────────────────────────
		destroyRef.onDestroy(() => {
			coarseMql.removeEventListener('change', onCoarseChange);
			narrowMql.removeEventListener('change', onNarrowChange);
			tabletMql.removeEventListener('change', updateTablet);
		});
	}

	/** Recompute derived `isMobile` signal from the two raw conditions. */
	private _update(coarse: boolean, narrow: boolean): void {
		// Either condition alone makes it mobile: narrow viewport OR coarse pointer.
		this.isMobile.set(narrow || coarse);
	}
}
