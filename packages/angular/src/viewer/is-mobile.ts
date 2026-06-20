/**
 * is-mobile.ts: Injectable signal-based mobile-detection service plus a
 * pure `computeIsMobile` helper for unit-testing.
 *
 * Ported from: packages/react/src/viewer/hooks/useIsMobile.ts
 *
 * The service tracks two independent media conditions:
 *   - `(pointer: coarse)`: primary pointer is a touch screen / stylus
 *   - viewport width below {@link MOBILE_BREAKPOINT}
 *
 * Both conditions are evaluated once at construction time and then kept live
 * via `MediaQueryList.addEventListener`. The service is SSR-safe: when
 * `matchMedia` is not available (server / test environment without a DOM) all
 * signals default to `false` and no listeners are registered.
 */

import { DestroyRef, inject, Injectable, signal } from '@angular/core';

import {
	computeKeyboardInset,
	computeScrollDelta,
	isKeyboardOpen as isKeyboardOpenInset,
	readViewportMetrics,
} from '../internal/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Viewport width (px) below which the UI switches to mobile layout. */
export const MOBILE_BREAKPOINT = 768;

/** Tablet breakpoint: below this width (but >= MOBILE) is tablet. */
export const TABLET_BREAKPOINT = 1024;

/**
 * Max viewport height (px) at which a *touch* device is treated as mobile
 * regardless of width. Catches landscape phones (e.g. 915×412), which are wide
 * enough to fall in the "tablet" width band but far too short for the desktop
 * ribbon + side panels, so they need the mobile chrome. Tablets in landscape are
 * taller (~760px+) so they stay on the desktop layout. Mirrors React's
 * `MOBILE_LANDSCAPE_MAX_HEIGHT` in useIsMobile.ts.
 */
export const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;

// ---------------------------------------------------------------------------
// Pure helpers (no Angular deps, safe in vitest without a DOM)
// ---------------------------------------------------------------------------

/**
 * Decide whether the current environment should use the mobile layout:
 * - a narrow viewport (`width < MOBILE_BREAKPOINT`), OR
 * - a short *touch* viewport below the tablet width: a landscape phone, which
 *   is wide enough to look like a tablet but far too short for the desktop
 *   ribbon + side panels.
 *
 * This mirrors React's `isMobileViewport(width, height, isTouch)` so the three
 * frameworks switch chrome at the same breakpoints (and the shared mobile e2e
 * specs pass identically). A tall touch tablet (e.g. 820×1180) is NOT mobile.
 *
 * @pure: no side effects, fully testable without a DOM.
 */
export function computeIsMobile(width: number, height: number, isTouch: boolean): boolean {
	if (width < MOBILE_BREAKPOINT) {
		return true;
	}
	return isTouch && height > 0 && height < MOBILE_LANDSCAPE_MAX_HEIGHT && width < TABLET_BREAKPOINT;
}

/**
 * Decide whether the current environment is "tablet" (desktop chrome, but in
 * the 768–1023px width band). A short landscape-phone touch viewport is mobile,
 * not tablet (handled by {@link computeIsMobile}).
 *
 * @pure
 */
export function computeIsTablet(width: number, height: number, isTouch: boolean): boolean {
	if (computeIsMobile(width, height, isTouch)) {
		return false;
	}
	return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
}

// ---------------------------------------------------------------------------
// IsMobileService
// ---------------------------------------------------------------------------

/**
 * `IsMobileService`: provides reactive signals for the current viewport /
 * pointer kind so components can switch between mobile and desktop chrome
 * without subscribing to resize events themselves.
 *
 * Inject at the component level (or provide at root); the service cleans up
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

	/**
	 * CSS pixels the on-screen keyboard currently covers at the bottom of the
	 * layout viewport (0 when no keyboard is open). The orchestrator lifts the
	 * fixed mobile bottom bar by this amount so it stays above the keyboard.
	 */
	readonly keyboardInset = signal<number>(0);

	/** True while {@link keyboardInset} is large enough to count as "open". */
	readonly isKeyboardOpen = signal<boolean>(false);

	constructor() {
		const destroyRef = inject(DestroyRef);

		// Guard: matchMedia / window may not be available in SSR / test envs.
		if (typeof matchMedia !== 'function' || typeof window === 'undefined') {
			return;
		}

		this._wireKeyboardInset(destroyRef);

		// ── Coarse-pointer media query (drives the touch flag) ───────────────────
		const coarseMql = matchMedia('(pointer: coarse)');
		this.isCoarsePointer.set(coarseMql.matches);

		const onCoarseChange = (evt: MediaQueryListEvent) => {
			this.isCoarsePointer.set(evt.matches);
			this._recompute();
		};
		coarseMql.addEventListener('change', onCoarseChange);

		// ── Viewport size tracking ───────────────────────────────────────────────
		// Width-only media queries cannot express the "short landscape phone"
		// rule (which depends on height + touch), so track the live viewport size
		// on resize and recompute the derived flags from width/height/touch.
		const onResize = () => this._recompute();
		window.addEventListener('resize', onResize);
		if (typeof screen !== 'undefined' && screen.orientation) {
			screen.orientation.addEventListener('change', onResize);
		}

		this._recompute();

		// ── Cleanup on destroy ───────────────────────────────────────────────────
		destroyRef.onDestroy(() => {
			coarseMql.removeEventListener('change', onCoarseChange);
			window.removeEventListener('resize', onResize);
			if (typeof screen !== 'undefined' && screen.orientation) {
				screen.orientation.removeEventListener('change', onResize);
			}
		});
	}

	/** Recompute all derived flags from the live viewport size + pointer kind. */
	private _recompute(): void {
		const width = window.innerWidth;
		const height = window.innerHeight;
		const touch = this.isCoarsePointer();
		this.isNarrowViewport.set(width < MOBILE_BREAKPOINT);
		this.isMobile.set(computeIsMobile(width, height, touch));
		this.isTablet.set(computeIsTablet(width, height, touch));
	}

	/**
	 * Track the on-screen-keyboard inset via the `VisualViewport` API and keep the
	 * focused editable visible: when the keyboard shrinks the visual viewport,
	 * update {@link keyboardInset} / {@link isKeyboardOpen} and scroll the active
	 * input / textarea / contenteditable into the area above the keyboard. No-op
	 * when `visualViewport` is unavailable (desktop / SSR), so desktop is unchanged.
	 */
	private _wireKeyboardInset(destroyRef: DestroyRef): void {
		const vv = window.visualViewport;
		if (!vv) {
			return;
		}

		const update = (): void => {
			const metrics = readViewportMetrics(window);
			const inset = metrics ? computeKeyboardInset(metrics) : 0;
			this.keyboardInset.set(inset);
			this.isKeyboardOpen.set(isKeyboardOpenInset(inset));
			if (inset > 0) {
				window.requestAnimationFrame(() => this._scrollFocusedIntoView(inset));
			}
		};

		const onFocusIn = (): void => {
			window.requestAnimationFrame(() => {
				const metrics = readViewportMetrics(window);
				const inset = metrics ? computeKeyboardInset(metrics) : 0;
				if (inset > 0) {
					this._scrollFocusedIntoView(inset);
				}
			});
		};

		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		document.addEventListener('focusin', onFocusIn);

		destroyRef.onDestroy(() => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
			document.removeEventListener('focusin', onFocusIn);
		});
	}

	/** Scroll the focused editable into the area above the keyboard, if needed. */
	private _scrollFocusedIntoView(keyboardInset: number): void {
		if (keyboardInset <= 0 || typeof document === 'undefined') {
			return;
		}
		const active = document.activeElement;
		if (!(active instanceof HTMLElement)) {
			return;
		}
		const tag = active.tagName;
		if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !active.isContentEditable) {
			return;
		}
		const rect = active.getBoundingClientRect();
		const delta = computeScrollDelta(
			{ top: rect.top, bottom: rect.bottom },
			window.innerHeight,
			keyboardInset,
		);
		if (delta !== 0) {
			window.scrollBy({ top: delta, behavior: 'smooth' });
		}
	}
}
