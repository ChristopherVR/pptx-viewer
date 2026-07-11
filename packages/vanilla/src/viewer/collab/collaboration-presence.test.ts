import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createPresenceController } from './collaboration-presence';

interface FakeAwareness {
	clientID: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off: (event: string, cb: () => void) => void;
	__change: () => void;
	__states: Map<number, Record<string, unknown>>;
}

function makeAwareness(clientID = 1): FakeAwareness {
	const states = new Map<number, Record<string, unknown>>();
	let changeCb: (() => void) | null = null;
	const self: FakeAwareness = {
		clientID,
		setLocalStateField: (field, value) => {
			states.set(clientID, { ...(states.get(clientID) ?? {}), [field]: value });
		},
		getStates: () => states,
		on: (event, cb) => {
			if (event === 'change') {
				changeCb = cb;
			}
		},
		off: (event) => {
			if (event === 'change') {
				changeCb = null;
			}
		},
		__change: () => changeCb?.(),
		__states: states,
	};
	return self;
}

function makeStore(): Store<ViewerState> {
	return createStore(createInitialViewerState());
}

describe('createPresenceController', () => {
	it('publishes the local user presence immediately on creation', () => {
		const awareness = makeAwareness();
		createPresenceController(
			makeStore(),
			awareness,
			{ userName: 'Ada', userColor: '#123456' },
			() => ({
				width: 960,
				height: 540,
			}),
		);
		expect(awareness.__states.get(1)?.presence).toMatchObject({
			userName: 'Ada',
			userColor: '#123456',
		});
	});

	it('projects remote awareness state into store.remotePresences/cursors on change', () => {
		const awareness = makeAwareness(1);
		awareness.__states.set(2, {
			presence: {
				userName: 'Bob',
				userColor: '#ff0000',
				cursorX: 10,
				cursorY: 20,
				activeSlideIndex: 0,
				lastUpdated: new Date().toISOString(),
			},
		});
		const store = makeStore();
		createPresenceController(store, awareness, { userName: 'Ada', userColor: '#123456' }, () => ({
			width: 960,
			height: 540,
		}));
		awareness.__change();

		expect(store.get().remotePresences).toHaveLength(1);
		expect(store.get().remotePresences[0]).toMatchObject({ userName: 'Bob' });
		expect(store.get().cursors).toHaveLength(1);
		expect(store.get().cursors[0]).toMatchObject({ userName: 'Bob', x: 10, y: 20 });
	});

	it('clears the followed peer once they leave the presence list', () => {
		const awareness = makeAwareness(1);
		awareness.__states.set(2, {
			presence: {
				userName: 'Bob',
				userColor: '#ff0000',
				cursorX: 0,
				cursorY: 0,
				activeSlideIndex: 0,
				lastUpdated: new Date().toISOString(),
			},
		});
		const store = makeStore();
		const presence = createPresenceController(
			store,
			awareness,
			{ userName: 'Ada', userColor: '#123456' },
			() => ({
				width: 960,
				height: 540,
			}),
		);
		awareness.__change();
		presence.followUser(2);
		expect(store.get().followedClientId).toBe(2);

		awareness.__states.delete(2);
		awareness.__change();
		expect(store.get().followedClientId).toBeNull();
	});

	it('destroy clears remote presence from the store and stops the heartbeat', () => {
		vi.useFakeTimers();
		const awareness = makeAwareness();
		const store = makeStore();
		const presence = createPresenceController(
			store,
			awareness,
			{ userName: 'Ada', userColor: '#123456' },
			() => ({
				width: 960,
				height: 540,
			}),
		);
		presence.destroy();
		expect(store.get().remotePresences).toStrictEqual([]);
		expect(store.get().cursors).toStrictEqual([]);
		expect(store.get().followedClientId).toBeNull();
		vi.useRealTimers();
	});
});
