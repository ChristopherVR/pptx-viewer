/**
 * Performance contract for the Svelte presence controller (issue #145 class).
 *
 * Assigning a `$state` field invalidates whether or not the value differs, so a
 * fresh-but-equivalent array re-renders the cursor overlay. Peer heartbeats
 * re-stamp `lastUpdated` on a fixed interval, which meant an idle room
 * re-rendered forever.
 *
 * The assertion is on REFERENCE IDENTITY: that is precisely what runes compare.
 */
import { describe, expect, it } from 'vitest';

import { CollaborationPresence } from './collaboration-presence.svelte';

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

function setup() {
	const awareness = makeAwareness();
	const presence = new CollaborationPresence(() => ({ width: 960, height: 540 }));
	presence.start(awareness, { userName: 'Ada', userColor: '#123456' });
	return { awareness, presence };
}

describe('svelte presence render cost (issue #145)', () => {
	it('keeps the same array identity across peer heartbeats', () => {
		const { awareness, presence } = setup();

		awareness.emitPeer();
		const afterJoin = presence.remotePresences;
		const cursorsAfterJoin = presence.cursors;
		expect(afterJoin).toHaveLength(1);

		for (let beat = 0; beat < 10; beat += 1) {
			awareness.emitPeer({ lastUpdated: new Date(Date.now() + beat * 1000).toISOString() });
		}

		expect(presence.remotePresences).toBe(afterJoin);
		expect(presence.cursors).toBe(cursorsAfterJoin);
		presence.stop();
	});

	it('adopts a new array when a peer moves', () => {
		const { awareness, presence } = setup();

		awareness.emitPeer();
		const afterJoin = presence.remotePresences;

		awareness.emitPeer({ cursorX: 400 });

		expect(presence.remotePresences).not.toBe(afterJoin);
		expect(presence.remotePresences[0]?.cursorX).toBe(400);
		presence.stop();
	});

	it('adopts a new array when a peer leaves', () => {
		const { awareness, presence } = setup();

		awareness.emitPeer();
		const afterJoin = presence.remotePresences;

		awareness.states.delete(PEER_ID);
		awareness.emit();

		expect(presence.remotePresences).not.toBe(afterJoin);
		expect(presence.remotePresences).toHaveLength(0);
		presence.stop();
	});
});
