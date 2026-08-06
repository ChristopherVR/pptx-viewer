/**
 * Behaviour + performance contract for the selectively-subscribable store.
 *
 * The performance assertions count NOTIFICATIONS, because that is what becomes
 * a render in every binding. A store that is correct but wakes every subscriber
 * on every change would pass a value-only test and still reproduce the
 * whole-editor re-render this exists to fix (issue #145).
 */
import { describe, it, expect, vi } from 'vitest';

import { createViewerCommandStore, createViewerStore } from './viewer-store';

interface State {
	slideIndex: number;
	zoom: number;
	title: string;
}

const initial: State = { slideIndex: 0, zoom: 1, title: 'Deck' };

describe('createViewerStore', () => {
	it('notifies subscribers on a real change', () => {
		const store = createViewerStore(initial);
		const listener = vi.fn();
		store.subscribe(listener);

		store.setState({ ...initial, zoom: 2 });

		expect(listener).toHaveBeenCalledOnce();
		expect(store.getState().zoom).toBe(2);
	});

	it('drops a write that produces the same state identity', () => {
		const store = createViewerStore(initial);
		const listener = vi.fn();
		store.subscribe(listener);

		store.setState(initial);
		store.setState((current) => current);

		expect(listener).not.toHaveBeenCalled();
	});

	it('supports functional updates', () => {
		const store = createViewerStore(initial);
		store.setState((current) => ({ ...current, slideIndex: current.slideIndex + 1 }));
		expect(store.getState().slideIndex).toBe(1);
	});

	it('stops notifying after unsubscribe', () => {
		const store = createViewerStore(initial);
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);
		unsubscribe();

		store.setState({ ...initial, zoom: 3 });

		expect(listener).not.toHaveBeenCalled();
	});

	it('survives a listener that unsubscribes during notification', () => {
		const store = createViewerStore(initial);
		const calls: string[] = [];
		const unsubscribeA = store.subscribe(() => {
			calls.push('a');
			unsubscribeA();
		});
		store.subscribe(() => calls.push('b'));

		store.setState({ ...initial, zoom: 2 });
		store.setState({ ...initial, zoom: 3 });

		expect(calls).toStrictEqual(['a', 'b', 'b']);
	});
});

describe('selector subscriptions', () => {
	it('does NOT wake a subscriber when an unrelated slice changes', () => {
		// The whole point: a control reading `zoom` is insulated from navigation.
		const store = createViewerStore(initial);
		const onZoom = vi.fn();
		store.subscribeSelector((s) => s.zoom, onZoom);

		store.setState((s) => ({ ...s, slideIndex: 1 }));
		store.setState((s) => ({ ...s, title: 'Renamed' }));

		expect(onZoom).not.toHaveBeenCalled();
	});

	it('wakes a subscriber when its own slice changes, with both values', () => {
		const store = createViewerStore(initial);
		const onZoom = vi.fn();
		store.subscribeSelector((s) => s.zoom, onZoom);

		store.setState((s) => ({ ...s, zoom: 2 }));

		expect(onZoom).toHaveBeenCalledExactlyOnceWith(2, 1);
	});

	it('does not wake when a slice is rewritten to the same value', () => {
		const store = createViewerStore(initial);
		const onZoom = vi.fn();
		store.subscribeSelector((s) => s.zoom, onZoom);

		store.setState((s) => ({ ...s, zoom: 1 }));

		expect(onZoom).not.toHaveBeenCalled();
	});

	it('honours a custom equality for derived object selectors', () => {
		// A selector that builds an object allocates every call, so without an
		// equality it would fire on every change - the exact trap this replaces.
		const store = createViewerStore(initial);
		const onView = vi.fn();
		store.subscribeSelector(
			(s) => ({ zoom: s.zoom }),
			onView,
			(a, b) => a.zoom === b.zoom,
		);

		store.setState((s) => ({ ...s, slideIndex: 5 }));
		expect(onView).not.toHaveBeenCalled();

		store.setState((s) => ({ ...s, zoom: 4 }));
		expect(onView).toHaveBeenCalledOnce();
	});

	it('stops notifying after unsubscribe', () => {
		const store = createViewerStore(initial);
		const onZoom = vi.fn();
		const unsubscribe = store.subscribeSelector((s) => s.zoom, onZoom);
		unsubscribe();

		store.setState((s) => ({ ...s, zoom: 9 }));

		expect(onZoom).not.toHaveBeenCalled();
	});
});

describe('batching', () => {
	it('coalesces many writes into one notification', () => {
		const store = createViewerStore(initial);
		const listener = vi.fn();
		const onZoom = vi.fn();
		store.subscribe(listener);
		store.subscribeSelector((s) => s.zoom, onZoom);

		store.batch(() => {
			store.setState((s) => ({ ...s, zoom: 2 }));
			store.setState((s) => ({ ...s, zoom: 3 }));
			store.setState((s) => ({ ...s, slideIndex: 4 }));
		});

		expect(listener).toHaveBeenCalledOnce();
		expect(onZoom).toHaveBeenCalledExactlyOnceWith(3, 1);
		expect(store.getState()).toStrictEqual({ slideIndex: 4, zoom: 3, title: 'Deck' });
	});

	it('says nothing when a batch nets back to the original state', () => {
		const store = createViewerStore(initial);
		const listener = vi.fn();
		store.subscribe(listener);

		store.batch(() => {
			store.setState((s) => ({ ...s, zoom: 2 }));
			store.setState(initial);
		});

		expect(listener).not.toHaveBeenCalled();
	});

	it('flushes only once for nested batches', () => {
		const store = createViewerStore(initial);
		const listener = vi.fn();
		store.subscribe(listener);

		store.batch(() => {
			store.setState((s) => ({ ...s, zoom: 2 }));
			store.batch(() => {
				store.setState((s) => ({ ...s, slideIndex: 1 }));
			});
			expect(listener).not.toHaveBeenCalled();
		});

		expect(listener).toHaveBeenCalledOnce();
	});

	it('still flushes when the batch body throws', () => {
		const store = createViewerStore(initial);
		const listener = vi.fn();
		store.subscribe(listener);

		expect(() =>
			store.batch(() => {
				store.setState((s) => ({ ...s, zoom: 2 }));
				throw new Error('boom');
			}),
		).toThrow('boom');

		expect(listener).toHaveBeenCalledOnce();
		expect(store.getState().zoom).toBe(2);
	});
});

describe('createViewerCommandStore', () => {
	type Command =
		| { type: 'zoom'; value: number }
		| { type: 'next' }
		| { type: 'rename'; to: string };

	function reduce(state: State, command: Command): State {
		switch (command.type) {
			case 'zoom':
				return { ...state, zoom: command.value };
			case 'next':
				return { ...state, slideIndex: state.slideIndex + 1 };
			case 'rename':
				return { ...state, title: command.to };
			default:
				return state;
		}
	}

	it('applies a command', () => {
		const store = createViewerCommandStore(initial, reduce);
		store.dispatch({ type: 'next' });
		expect(store.getState().slideIndex).toBe(1);
	});

	it('lands several commands as a single notification', () => {
		const store = createViewerCommandStore(initial, reduce);
		const listener = vi.fn();
		store.subscribe(listener);

		store.dispatch({ type: 'next' }, { type: 'zoom', value: 2 }, { type: 'rename', to: 'New' });

		expect(listener).toHaveBeenCalledOnce();
		expect(store.getState()).toStrictEqual({ slideIndex: 1, zoom: 2, title: 'New' });
	});

	it('keeps selector subscriptions selective across a multi-command dispatch', () => {
		const store = createViewerCommandStore(initial, reduce);
		const onZoom = vi.fn();
		store.subscribeSelector((s) => s.zoom, onZoom);

		store.dispatch({ type: 'next' }, { type: 'rename', to: 'New' });

		expect(onZoom).not.toHaveBeenCalled();
	});

	it('does nothing when dispatched with no commands', () => {
		const store = createViewerCommandStore(initial, reduce);
		const listener = vi.fn();
		store.subscribe(listener);

		store.dispatch();

		expect(listener).not.toHaveBeenCalled();
	});
});
