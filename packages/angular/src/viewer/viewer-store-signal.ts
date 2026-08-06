/**
 * Angular adapter for the shared selectively-subscribable viewer store.
 *
 * Returns a `Signal` fed by a selector subscription. Angular already stops
 * change detection at signal boundaries, so pairing that with a selective
 * subscription means an unrelated part of the viewer state moving costs a
 * template nothing at all (issue #145).
 *
 * Cleanup uses the injection context's `DestroyRef` when one is available, so
 * a component or service calling this in its field initialisers needs no
 * explicit teardown. Outside an injection context the returned `destroy`
 * handle must be called by whoever owns the subscription.
 */
import { DestroyRef, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import type { ViewerStore, ViewerStoreEquality } from '../internal/shared';

export interface ViewerStoreSignal<T> {
	/** The selected value, as a signal. */
	value: Signal<T>;
	/** Tear down the subscription (automatic inside an injection context). */
	destroy: () => void;
}

/** Subscribe to one projection of a viewer store as a `Signal`. */
export function viewerStoreSignal<S, T>(
	store: ViewerStore<S>,
	selector: (state: S) => T,
	isEqual?: ViewerStoreEquality<T>,
): ViewerStoreSignal<T> {
	const value = signal(selector(store.getState()));
	const unsubscribe = store.subscribeSelector(selector, (next) => value.set(next), isEqual);
	try {
		inject(DestroyRef).onDestroy(unsubscribe);
	} catch {
		// Called outside an injection context: the caller owns `destroy`.
	}
	return { value: value.asReadonly(), destroy: unsubscribe };
}
