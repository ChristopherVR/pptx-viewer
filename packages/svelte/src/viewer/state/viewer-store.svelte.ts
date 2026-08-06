/**
 * Svelte adapter for the shared selectively-subscribable viewer store.
 *
 * Exposes the selected value as a `$state`-backed getter, so a template reading
 * `selected.value` re-renders only when that selector's output changes rather
 * than whenever any part of the viewer state moves (issue #145).
 *
 * A class with a getter rather than a returned rune: `$state` cannot cross a
 * function boundary by value (the reactivity is lost on destructure), so the
 * binding has to hand back an object whose property read is the tracked access.
 */
import type { ViewerStore, ViewerStoreEquality } from 'pptx-viewer-shared';

export class ViewerStoreSelection<T> {
	#value = $state() as T;
	readonly #unsubscribe: () => void;

	constructor(subscribe: (set: (value: T) => void) => () => void, initial: T) {
		this.#value = initial;
		this.#unsubscribe = subscribe((next) => {
			this.#value = next;
		});
	}

	/** The selected value. Reading this inside an effect tracks it. */
	get value(): T {
		return this.#value;
	}

	/** Tear down the subscription. */
	destroy(): void {
		this.#unsubscribe();
	}
}

/** Subscribe to one projection of a viewer store as reactive Svelte state. */
export function viewerStoreSelection<S, T>(
	store: ViewerStore<S>,
	selector: (state: S) => T,
	isEqual?: ViewerStoreEquality<T>,
): ViewerStoreSelection<T> {
	return new ViewerStoreSelection<T>(
		(set) => store.subscribeSelector(selector, (next) => set(next), isEqual),
		selector(store.getState()),
	);
}
