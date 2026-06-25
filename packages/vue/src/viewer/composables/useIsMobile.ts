import { onScopeDispose, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/** Mobile breakpoint: below this width is considered mobile. Mirrors React. */
export const MOBILE_BREAKPOINT = 768;

/** Tablet breakpoint: below this width (but >= MOBILE) is tablet. Mirrors React. */
export const TABLET_BREAKPOINT = 1024;

/**
 * Max viewport height (px) at which a *touch* device is treated as mobile
 * regardless of width: catches landscape phones (e.g. 915×412), which are wide
 * enough to look like a tablet but far too short for the desktop chrome.
 * Mirrors the React `MOBILE_LANDSCAPE_MAX_HEIGHT`.
 */
export const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;

/** Device orientation as reported by the screen / viewport aspect ratio. */
export type DeviceOrientation = 'portrait' | 'landscape';

/**
 * Whether a width/height/touch combination should use the mobile layout: a
 * narrow viewport, OR a short touch viewport below the tablet width (a
 * landscape phone). Mirrors the React `isMobileViewport`.
 */
export function isMobileViewport(width: number, height: number, isTouch: boolean): boolean {
	if (width < MOBILE_BREAKPOINT) {
		return true;
	}
	return isTouch && height > 0 && height < MOBILE_LANDSCAPE_MAX_HEIGHT && width < TABLET_BREAKPOINT;
}

/**
 * Source of the container element observed for container-based breakpoints:
 * either a Vue `Ref` (e.g. a `templateRef`) or a plain getter. Resolved lazily
 * each time the observer (re)reads it so late-mounted refs are picked up.
 */
export type ContainerSource =
	| Ref<HTMLElement | null | undefined>
	| (() => HTMLElement | null | undefined);

/**
 * `useIsMobile`: reactive viewport predicate for switching between the desktop
 * chrome and the compact mobile bottom bar, plus the touch / orientation /
 * virtual-keyboard signals the mobile chrome needs.
 *
 * Breakpoints are driven by the observed *container* width when a `container`
 * source is supplied (via `ResizeObserver`), so an embedded viewer in a narrow
 * sidebar is classified by its own box rather than the full viewport. When no
 * container is given (or `ResizeObserver` is unavailable) it falls back to the
 * `window.matchMedia` viewport path. Either way:
 *   - mobile when narrow (< 768px) OR a short touch viewport below the tablet
 *     width (a landscape phone),
 *   - tablet when 768..1023px and not mobile,
 *   - desktop when >= 1024px and not mobile.
 *
 * Additive signals (mirroring the React `useIsMobile` return shape):
 *   - `isTouchDevice`: whether the device reports touch capability.
 *   - `orientation`: `'portrait'` or `'landscape'`, updated on resize /
 *     `screen.orientation` change.
 *   - `isVirtualKeyboardOpen`: true when the visual viewport height shrinks by
 *     more than 30% on a touch device (the on-screen keyboard is likely up).
 *   - `isTablet` / `isDesktop`: derived breakpoint flags.
 *   - `containerWidth`: the measured container (or viewport) width in px.
 *
 * SSR / test safety: `window`, `matchMedia` and `ResizeObserver` are
 * feature-detected. When none is available the predicate stays `false` and no
 * listener is wired, so the composable is safe during server render or in a
 * bare unit test. All observers/listeners are torn down on `onScopeDispose`.
 *
 * @param breakpoint - Max viewport width (px) considered "mobile" for the
 *   matchMedia fallback path. Defaults to 768 to match the React `md:`
 *   Tailwind breakpoint used by the mobile chrome.
 * @param container - Optional container element source. When provided and
 *   `ResizeObserver` exists, breakpoints + `containerWidth` are driven from the
 *   container's box instead of the viewport.
 * @returns reactive read-only refs; existing `{ isMobile }` (and the touch /
 *   orientation / virtual-keyboard) consumers keep working unchanged.
 */
export interface UseIsMobileResult {
	/** `true` while the container/viewport is at or below `breakpoint` px wide. */
	isMobile: Readonly<Ref<boolean>>;
	/** `true` while the container/viewport is 768..1023px wide. */
	isTablet: Readonly<Ref<boolean>>;
	/** `true` while the container/viewport is >= 1024px wide. */
	isDesktop: Readonly<Ref<boolean>>;
	/** `true` on devices that report touch capability. */
	isTouchDevice: Readonly<Ref<boolean>>;
	/** Current device orientation (portrait or landscape). */
	orientation: Readonly<Ref<DeviceOrientation>>;
	/** `true` when the on-screen keyboard is likely visible. */
	isVirtualKeyboardOpen: Readonly<Ref<boolean>>;
	/** The measured container (or viewport) width in pixels. */
	containerWidth: Readonly<Ref<number>>;
}

function detectTouchDevice(): boolean {
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

function detectOrientation(): DeviceOrientation {
	if (typeof window === 'undefined') {
		return 'landscape';
	}
	if (typeof screen !== 'undefined' && screen.orientation) {
		return screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape';
	}
	return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

function resolveContainer(source: ContainerSource | undefined): HTMLElement | null {
	if (!source) {
		return null;
	}
	const el = typeof source === 'function' ? source() : source.value;
	return el ?? null;
}

export function useIsMobile(breakpoint = 768, container?: ContainerSource): UseIsMobileResult {
	const isMobile = ref(false);
	const isTablet = ref(false);
	const isDesktop = ref(false);
	const isTouchDevice = ref(detectTouchDevice());
	const orientation = ref<DeviceOrientation>(detectOrientation());
	const isVirtualKeyboardOpen = ref(false);
	const containerWidth = ref(typeof window !== 'undefined' ? window.innerWidth : TABLET_BREAKPOINT);

	const result: UseIsMobileResult = {
		isMobile: readonly(isMobile),
		isTablet: readonly(isTablet),
		isDesktop: readonly(isDesktop),
		isTouchDevice: readonly(isTouchDevice),
		orientation: readonly(orientation),
		isVirtualKeyboardOpen: readonly(isVirtualKeyboardOpen),
		containerWidth: readonly(containerWidth),
	};

	const applyDimensions = (width: number, height: number): void => {
		containerWidth.value = width;
		const mobile = isMobileViewport(width, height, isTouchDevice.value);
		isMobile.value = mobile;
		isTablet.value = !mobile && width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
		isDesktop.value = !mobile && width >= TABLET_BREAKPOINT;
	};

	// Shared orientation + virtual-keyboard wiring (only used once a viewport /
	// container path has decided to attach listeners).
	const wireOrientationAndKeyboard = (): void => {
		const onOrientationChange = (): void => {
			orientation.value = detectOrientation();
		};
		window.addEventListener('resize', onOrientationChange);
		const screenOrientation = typeof screen !== 'undefined' ? screen.orientation : undefined;
		screenOrientation?.addEventListener('change', onOrientationChange);

		// When the visual viewport height shrinks by > 30% on a touch device it
		// is very likely the on-screen keyboard appeared.
		const initialViewportHeight = window.innerHeight || 800;
		const vv = window.visualViewport ?? undefined;
		const onViewportResize = (): void => {
			if (!isTouchDevice.value) {
				return;
			}
			const currentHeight = vv?.height ?? window.innerHeight;
			isVirtualKeyboardOpen.value = currentHeight / initialViewportHeight < 0.7;
		};
		if (vv) {
			vv.addEventListener('resize', onViewportResize);
		} else {
			window.addEventListener('resize', onViewportResize);
		}

		onScopeDispose(() => {
			window.removeEventListener('resize', onOrientationChange);
			screenOrientation?.removeEventListener('change', onOrientationChange);
			if (vv) {
				vv.removeEventListener('resize', onViewportResize);
			} else {
				window.removeEventListener('resize', onViewportResize);
			}
		});
	};

	const hasWindow = typeof window !== 'undefined';
	const hasResizeObserver = hasWindow && typeof ResizeObserver !== 'undefined';
	const containerEl = resolveContainer(container);

	// ── Container-driven path (ResizeObserver on the host box) ───────────────
	if (hasResizeObserver && containerEl) {
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				applyDimensions(entry.contentRect.width, entry.contentRect.height);
			}
		});
		observer.observe(containerEl);
		applyDimensions(containerEl.clientWidth, containerEl.clientHeight);

		wireOrientationAndKeyboard();

		onScopeDispose(() => {
			observer.disconnect();
		});
		return result;
	}

	// ── Viewport fallback path (matchMedia + window size) ────────────────────
	const hasMatchMedia = hasWindow && typeof window.matchMedia === 'function';

	if (!hasMatchMedia) {
		// SSR / unstubbed test: keep the eager-detected defaults and wire nothing.
		return result;
	}

	const syncViewportBreakpoints = (): void => {
		applyDimensions(window.innerWidth, window.innerHeight);
	};

	const query = window.matchMedia(
		`(max-width: ${breakpoint}px), ` +
			`(max-height: ${MOBILE_LANDSCAPE_MAX_HEIGHT - 1}px) and (pointer: coarse) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
	);

	const update = (event: MediaQueryList | MediaQueryListEvent): void => {
		isMobile.value = event.matches;
		const width = window.innerWidth;
		containerWidth.value = width;
		isTablet.value = !event.matches && width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
		isDesktop.value = !event.matches && width >= TABLET_BREAKPOINT;
	};
	update(query);

	const listener = (event: MediaQueryListEvent): void => {
		update(event);
	};
	query.addEventListener('change', listener);
	window.addEventListener('resize', syncViewportBreakpoints);

	wireOrientationAndKeyboard();

	onScopeDispose(() => {
		query.removeEventListener('change', listener);
		window.removeEventListener('resize', syncViewportBreakpoints);
	});
	return result;
}
