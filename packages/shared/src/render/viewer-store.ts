/**
 * viewer-store.ts: the framework-neutral, selectively-subscribable store the
 * viewer's shared state is built on.
 *
 * WHY: the viewer's state currently lives at the root of each binding, and the
 * root hands whole objects down to every child. One state change therefore
 * re-renders the entire editor, however small the change was - the topology
 * complaint in issue #145. A component cannot opt out, because there is nothing
 * finer than "the state" to subscribe to.
 *
 * This store is the missing seam. A consumer subscribes to a SELECTOR, and is
 * woken only when that selector's output actually changes. A ribbon control
 * that reads one option is then insulated from an unrelated option changing,
 * without every intermediate component having to be memoised correctly.
 *
 * It deliberately does NOT depend on a state library. The repo already had this
 * idiom in miniature (`createViewerOptionsStore` plus React's
 * `useSyncExternalStore`); this generalises it rather than introducing a
 * dependency that each of the five bindings would then have to adapt to. Every
 * binding can consume a `subscribe` + `getState` pair natively: React through
 * `useSyncExternalStore`, Vue through a `shallowRef`, Angular through a signal,
 * Svelte through `$state`, and Vanilla by calling it directly.
 *
 * Two guarantees the bindings rely on:
 *  - A `setState` that produces the SAME state identity notifies nobody, so the
 *    no-op-write guards in `state-equality.ts` compose with this.
 *  - `batch` coalesces any number of writes into a single notification, so a
 *    semantic operation ("apply this theme") is one render, not one per field.
 */

/** Compare two selector outputs. Defaults to `Object.is`. */
export type ViewerStoreEquality<T> = (a: T, b: T) => boolean;

export interface ViewerStore<S> {
	/** The current state. Treat as immutable. */
	getState(): S;
	/**
	 * Replace the state, or derive it from the current one. A result identical
	 * (by `Object.is`) to the current state is dropped without notifying.
	 */
	setState(next: S | ((current: S) => S)): void;
	/** Subscribe to every change. Returns an unsubscribe function. */
	subscribe(listener: () => void): () => void;
	/**
	 * Subscribe to one projection of the state. `listener` runs only when
	 * `selector`'s output changes under `isEqual`, so an unrelated part of the
	 * state moving costs this subscriber nothing.
	 */
	subscribeSelector<T>(
		selector: (state: S) => T,
		listener: (value: T, previous: T) => void,
		isEqual?: ViewerStoreEquality<T>,
	): () => void;
	/**
	 * Run `write`, coalescing every `setState` it performs into ONE notification
	 * at the end. Nested batches flush only when the outermost completes. If the
	 * batch nets to no change, nothing is notified at all.
	 */
	batch(write: () => void): void;
}

interface SelectorEntry<S> {
	select: (state: S) => unknown;
	notify: (value: unknown, previous: unknown) => void;
	equal: ViewerStoreEquality<unknown>;
	last: unknown;
}

function defaultEqual(a: unknown, b: unknown): boolean {
	return Object.is(a, b);
}

export function createViewerStore<S>(initial: S): ViewerStore<S> {
	let state = initial;
	const listeners = new Set<() => void>();
	const selectors = new Set<SelectorEntry<S>>();
	let batchDepth = 0;
	/** The state as of the last flush, so a batch that nets to nothing is silent. */
	let notifiedState = initial;

	function flush(): void {
		if (batchDepth > 0 || notifiedState === state) {
			return;
		}
		notifiedState = state;
		// Iterate copies: a listener may subscribe or unsubscribe while running.
		for (const entry of [...selectors]) {
			// Skip entries unsubscribed earlier in this same flush.
			if (!selectors.has(entry)) {
				continue;
			}
			const next = entry.select(state);
			const previous = entry.last;
			if (entry.equal(previous, next)) {
				continue;
			}
			entry.last = next;
			entry.notify(next, previous);
		}
		for (const listener of [...listeners]) {
			if (listeners.has(listener)) {
				listener();
			}
		}
	}

	return {
		getState: () => state,

		setState(next) {
			const resolved = typeof next === 'function' ? (next as (current: S) => S)(state) : next;
			if (Object.is(resolved, state)) {
				return;
			}
			state = resolved;
			flush();
		},

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		subscribeSelector(selector, listener, isEqual) {
			const entry: SelectorEntry<S> = {
				select: selector as (state: S) => unknown,
				notify: listener as (value: unknown, previous: unknown) => void,
				equal: (isEqual as ViewerStoreEquality<unknown> | undefined) ?? defaultEqual,
				last: selector(state),
			};
			selectors.add(entry);
			return () => {
				selectors.delete(entry);
			};
		},

		batch(write) {
			batchDepth += 1;
			try {
				write();
			} finally {
				batchDepth -= 1;
				flush();
			}
		},
	};
}

// ---------------------------------------------------------------------------
// Semantic commands
// ---------------------------------------------------------------------------

export interface ViewerCommandStore<S, C> extends ViewerStore<S> {
	/**
	 * Apply one or more semantic commands. Several commands dispatched together
	 * are reduced in order and land as a SINGLE notification, so an operation
	 * that touches three fields is one render rather than three.
	 */
	dispatch(...commands: C[]): void;
}

/**
 * A {@link ViewerStore} driven by semantic commands rather than raw state
 * replacement, so call sites read as intent ("insert slide", "set blackout")
 * and the transition rules live in one reducer instead of being spread across
 * five bindings' event handlers.
 */
export function createViewerCommandStore<S, C>(
	initial: S,
	reduce: (state: S, command: C) => S,
): ViewerCommandStore<S, C> {
	const store = createViewerStore(initial);
	return {
		...store,
		dispatch(...commands) {
			if (commands.length === 0) {
				return;
			}
			store.batch(() => {
				for (const command of commands) {
					store.setState((current) => reduce(current, command));
				}
			});
		},
	};
}
