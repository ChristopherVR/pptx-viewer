import { onScopeDispose, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * `useIsMobile` — reactive viewport-width predicate for switching between the
 * desktop chrome and the compact mobile bottom bar.
 *
 * Tracks `window.matchMedia(\`(max-width: ${breakpoint}px)\`)`, attaching a
 * `change` listener immediately and removing it on `onScopeDispose` (component
 * unmount / effect-scope teardown).
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

	const query = window.matchMedia(`(max-width: ${breakpoint}px)`);

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
