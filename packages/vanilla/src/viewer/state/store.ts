/**
 * A tiny framework-free reactive store: `get` / `set(patch)` / `subscribe`.
 *
 * This is deliberately minimal (a few dozen lines, no external deps). It only
 * carries the vanilla binding's *view state*; all domain logic (parsing,
 * styles, geometry, text building) stays in `pptx-viewer-core` and
 * `pptx-viewer-shared`.
 */

/** Listener invoked after every state change with the next and previous state. */
export type StoreListener<T> = (state: T, previous: T) => void;

export interface Store<T extends object> {
	/** Current state snapshot (do not mutate). */
	get(): T;
	/** Shallow-merge a partial patch into the state and notify subscribers. */
	set(patch: Partial<T>): void;
	/** Subscribe to state changes; returns an unsubscribe function. */
	subscribe(listener: StoreListener<T>): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
	let state = initial;
	const listeners = new Set<StoreListener<T>>();

	return {
		get: () => state,
		set: (patch) => {
			// Skip notification when the patch changes nothing (identity compare
			// per key keeps this O(patch) and predictable).
			let changed = false;
			for (const key of Object.keys(patch) as Array<keyof T>) {
				if (patch[key] !== state[key]) {
					changed = true;
					break;
				}
			}
			if (!changed) {
				return;
			}
			const previous = state;
			state = { ...state, ...patch };
			for (const listener of Array.from(listeners)) {
				listener(state, previous);
			}
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
