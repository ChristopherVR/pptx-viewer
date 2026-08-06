/**
 * Performance contract for the vanilla presence controller (issue #145 class).
 *
 * This binding repaints imperatively off the store, so an awareness event that
 * carries no visible change is not merely a wasted diff: it is a wasted DOM
 * write. Peer heartbeats re-stamp `lastUpdated` on a fixed interval, so an idle
 * room used to repaint the cursor layer forever.
 *
 * The assertion counts STORE NOTIFICATIONS, which is what drives the repaint.
 */
import { describe, expect, it } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createPresenceController } from './collaboration-presence';

const LOCAL_ID = 1;
const PEER_ID = 2;

function makeAwareness(clientID = LOCAL_ID) {
	const states = new Map<number, Record<string, unknown>>();
	const listeners = new Set<() => void>();
	return {
		clientID,
		states,
		setLocalStateField: (field: string, value: unknown) => {
			states.set(clientID, { ...(states.get(clientID) ?? {}), [field]: value });
		},
		getStates: () => states,
		on: (_event: string, cb: () => void) => listeners.add(cb),
		off: (_event: string, cb: () => void) => listeners.delete(cb),
		emit: () => listeners.forEach((cb) => cb()),
		emitPeer(overrides: Record<string, unknown> = {}) {
			states.set(PEER_ID, {
				presence: {
					userName: 'Grace',
					userColor: '#22c55e',
					activeSlideIndex: 0,
					cursorX: 100,
					cursorY: 200,
					lastUpdated: new Date().toISOString(),
					...overrides,
				},
			});
			listeners.forEach((cb) => cb());
		},
	};
}

function makeStore(): Store<ViewerState> {
	return createStore(createInitialViewerState());
}

function setup() {
	const awareness = makeAwareness();
	const store = makeStore();
	let writes = 0;
	store.subscribe(() => {
		writes += 1;
	});
	createPresenceController(store, awareness, { userName: 'Ada', userColor: '#123456' }, () => ({
		width: 960,
		height: 540,
	}));
	return { awareness, store, writes: () => writes };
}

describe('vanilla presence repaint cost (issue #145)', () => {
	it('does not touch the store on peer heartbeats that change nothing', () => {
		const { awareness, writes } = setup();

		awareness.emitPeer();
		const afterJoin = writes();

		for (let beat = 0; beat < 10; beat += 1) {
			awareness.emitPeer({ lastUpdated: new Date(Date.now() + beat * 1000).toISOString() });
		}

		expect(writes() - afterJoin).toBe(0);
	});

	it('still writes when a peer moves', () => {
		const { awareness, writes } = setup();

		awareness.emitPeer();
		const afterJoin = writes();

		awareness.emitPeer({ cursorX: 400 });

		expect(writes()).toBeGreaterThan(afterJoin);
	});

	it('still writes when a peer leaves', () => {
		const { awareness, writes } = setup();

		awareness.emitPeer();
		const afterJoin = writes();

		awareness.states.delete(PEER_ID);
		awareness.emit();

		expect(writes()).toBeGreaterThan(afterJoin);
	});
});
