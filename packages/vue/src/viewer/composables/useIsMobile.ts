import { onScopeDispose, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * Max viewport height (px) at which a *touch* device is treated as mobile
 * regardless of width: catches landscape phones (e.g. 915×412), which are wide
 * enough to look like a tablet but far too short for the desktop chrome.
 * Mirrors the React `MOBILE_LANDSCAPE_MAX_HEIGHT`.
 */
export const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;

/** Above this width even a short touch device is treated as a tablet/desktop. */
const TABLET_BREAKPOINT = 1024;

/** Device orientation as reported by the screen / viewport aspect ratio. */
export type DeviceOrientation = 'portrait' | 'landscape';

/**
 * `useIsMobile`: reactive viewport predicate for switching between the desktop
 * chrome and the compact mobile bottom bar, plus the touch / orientation /
 * virtual-keyboard signals the mobile chrome needs.
 *
 * Mobile when the viewport is narrow (<= `breakpoint`) OR a short touch viewport
 * below the tablet width (a landscape phone). Tracks a `window.matchMedia`
 * query combining both, attaching a `change` listener immediately and removing
 * it on `onScopeDispose` (component unmount / effect-scope teardown).
 *
 * Additive signals (mirroring the React `useIsMobile` return shape):
 *   - `isTouchDevice`: whether the device reports touch capability.
 *   - `orientation`: `'portrait'` or `'landscape'`, updated on resize /
 *     `screen.orientation` change.
 *   - `isVirtualKeyboardOpen`: true when the visual viewport height shrinks by
 *     more than 30% on a touch device (the on-screen keyboard is likely up).
 *
 * SSR / test safety: `window` and `matchMedia` are feature-detected. When
 * neither is available the predicate stays `false` and no listener is wired,
 * so the composable is safe to call during server render or in a bare unit
 * test that has not stubbed `matchMedia`. The additive signals fall back to
 * sensible defaults (`isTouchDevice=false`, `orientation='landscape'`,
 * `isVirtualKeyboardOpen=false`).
 *
 * @param breakpoint - Max viewport width (px) considered "mobile". Defaults to
 *   768 to match the React `md:` Tailwind breakpoint used by the mobile chrome.
 * @returns reactive read-only refs; existing `{ isMobile }` consumers keep
 *   working unchanged.
 */
export interface UseIsMobileResult {
	/** `true` while the viewport is at or below `breakpoint` px wide. */
	isMobile: Readonly<Ref<boolean>>;
	/** `true` on devices that report touch capability. */
	isTouchDevice: Readonly<Ref<boolean>>;
	/** Current device orientation (portrait or landscape). */
	orientation: Readonly<Ref<DeviceOrientation>>;
	/** `true` when the on-screen keyboard is likely visible. */
	isVirtualKeyboardOpen: Readonly<Ref<boolean>>;
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

export function useIsMobile(breakpoint = 768): UseIsMobileResult {
	const isMobile = ref(false);
	const isTouchDevice = ref(detectTouchDevice());
	const orientation = ref<DeviceOrientation>(detectOrientation());
	const isVirtualKeyboardOpen = ref(false);

	const result: UseIsMobileResult = {
		isMobile: readonly(isMobile),
		isTouchDevice: readonly(isTouchDevice),
		orientation: readonly(orientation),
		isVirtualKeyboardOpen: readonly(isVirtualKeyboardOpen),
	};

	const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

	if (!hasMatchMedia) {
		return result;
	}

	const query = window.matchMedia(
		`(max-width: ${breakpoint}px), ` +
			`(max-height: ${MOBILE_LANDSCAPE_MAX_HEIGHT - 1}px) and (pointer: coarse) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
	);

	const update = (event: MediaQueryList | MediaQueryListEvent): void => {
		isMobile.value = event.matches;
	};
	update(query);

	const listener = (event: MediaQueryListEvent): void => {
		update(event);
	};
	query.addEventListener('change', listener);

	// ── Orientation tracking ──────────────────────────────────────────────
	const onOrientationChange = (): void => {
		orientation.value = detectOrientation();
	};
	window.addEventListener('resize', onOrientationChange);
	const screenOrientation = typeof screen !== 'undefined' ? screen.orientation : undefined;
	screenOrientation?.addEventListener('change', onOrientationChange);

	// ── Virtual-keyboard tracking ─────────────────────────────────────────
	// When the visual viewport height shrinks by > 30% on a touch device it is
	// very likely the on-screen keyboard appeared.
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
		query.removeEventListener('change', listener);
		window.removeEventListener('resize', onOrientationChange);
		screenOrientation?.removeEventListener('change', onOrientationChange);
		if (vv) {
			vv.removeEventListener('resize', onViewportResize);
		} else {
			window.removeEventListener('resize', onViewportResize);
		}
	});

	return result;
}
