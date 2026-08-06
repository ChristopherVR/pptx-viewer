/**
 * React adapter for the shared selectively-subscribable viewer store.
 *
 * `useSyncExternalStore` is the correct primitive here (it is tearing-safe
 * under concurrent rendering), but it requires `getSnapshot` to return a
 * CACHED value: returning a freshly-derived object every call makes React
 * conclude the store changed on every render and loop forever. So the selector
 * result is memoised per component against the state identity it came from, and
 * the previous value is kept when the new one compares equal.
 *
 * That caching is also what makes the subscription selective: a component using
 * this re-renders only when its own selector output changes, not when some
 * unrelated part of the viewer state moves (issue #145).
 */
import type { ViewerStore, ViewerStoreEquality } from 'pptx-viewer-shared';
import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Subscribe to one projection of a viewer store.
 *
 * `selector` must be stable across renders (wrap it in `useCallback`, or define
 * it at module scope). An inline arrow re-derives on every render, which is
 * harmless for correctness but throws away the memo.
 */
export function useViewerStore<S, T>(
	store: ViewerStore<S>,
	selector: (state: S) => T,
	isEqual: ViewerStoreEquality<T> = Object.is,
): T {
	const cache = useRef<{ state: S; value: T } | null>(null);

	const getSnapshot = useCallback((): T => {
		const state = store.getState();
		const last = cache.current;
		if (last && Object.is(last.state, state)) {
			return last.value;
		}
		const next = selector(state);
		// Hold on to the PREVIOUS value when the new one is equivalent, so a
		// selector that allocates (`(s) => ({ a: s.a })`) does not read as a
		// change purely because it built a new object.
		const value = last && isEqual(last.value, next) ? last.value : next;
		cache.current = { state, value };
		return value;
	}, [store, selector, isEqual]);

	const subscribe = useCallback(
		(onStoreChange: () => void) => store.subscribe(onStoreChange),
		[store],
	);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
