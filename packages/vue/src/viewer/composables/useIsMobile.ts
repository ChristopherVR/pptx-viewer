import { onScopeDispose, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * Max viewport height (px) at which a *touch* device is treated as mobile
 * regardless of width — catches landscape phones (e.g. 915×412), which are wide
 * enough to look like a tablet but far too short for the desktop chrome.
 * Mirrors the React `MOBILE_LANDSCAPE_MAX_HEIGHT`.
 */
export const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;

/** Above this width even a short touch device is treated as a tablet/desktop. */
const TABLET_BREAKPOINT = 1024;

/**
 * `useIsMobile` — reactive viewport predicate for switching between the desktop
 * chrome and the compact mobile bottom bar.
 *
 * Mobile when the viewport is narrow (≤ `breakpoint`) OR a short touch viewport
 * below the tablet width (a landscape phone). Tracks a `window.matchMedia`
 * query combining both, attaching a `change` listener immediately and removing
 * it on `onScopeDispose` (component unmount / effect-scope teardown).
 *
 * SSR / test safety: `window` and `matchMedia` are feature-detected. When
 * neither is available the predicate stays `false` and no listener is wired,
 * so the composable is safe to call during server render or in a bare unit
 * test that has not stubbed `matchMedia`.
 *
 * @param breakpoint - Max viewport width (px) considered "mobile". Defaults to
 *   768 to match the React `md:` Tailwind breakpoint used by the mobile chrome.
 * @returns `{ isMobile }` — a read-only `Ref<boolean>` that updates as the
 *   media query matches or stops matching.
 */
export interface UseIsMobileResult {
	/** `true` while the viewport is at or below `breakpoint` px wide. */
	isMobile: Readonly<Ref<boolean>>;
}

export function useIsMobile(breakpoint = 768): UseIsMobileResult {
	const isMobile = ref(false);

	const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

	if (!hasMatchMedia) {
		return { isMobile: readonly(isMobile) };
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

	onScopeDispose(() => {
		query.removeEventListener('change', listener);
	});

	return { isMobile: readonly(isMobile) };
}
