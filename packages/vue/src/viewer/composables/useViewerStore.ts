/**
 * Vue adapter for the shared selectively-subscribable viewer store.
 *
 * Returns a `shallowRef` fed by a selector subscription, so a template reading
 * it re-renders only when that selector's output changes rather than whenever
 * any part of the viewer state moves (issue #145). `shallowRef` rather than
 * `ref`: the store owns immutable snapshots, and deep reactivity would both
 * cost a proxy walk per update and invite accidental mutation of shared state.
 *
 * The subscription is torn down with the owning scope, so a component using
 * this needs no explicit cleanup.
 */
import type { ViewerStore, ViewerStoreEquality } from 'pptx-viewer-shared';
import { onScopeDispose, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';

/** Subscribe to one projection of a viewer store as a `shallowRef`. */
export function useViewerStore<S, T>(
	store: ViewerStore<S>,
	selector: (state: S) => T,
	isEqual?: ViewerStoreEquality<T>,
): ShallowRef<T> {
	const value = shallowRef(selector(store.getState())) as ShallowRef<T>;
	const unsubscribe = store.subscribeSelector(
		selector,
		(next) => {
			value.value = next;
		},
		isEqual,
	);
	onScopeDispose(unsubscribe);
	return value;
}
