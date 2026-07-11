import type { AwarenessLike } from 'pptx-viewer-shared';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { CollaborationPresence } from './collaboration-presence.svelte';

interface FakeAwareness extends AwarenessLike {
	__change: () => void;
	__states: Map<number, Record<string, unknown>>;
}

function makeAwareness(clientID = 1): FakeAwareness {
	const states = new Map<number, Record<string, unknown>>();
	let changeCb: (() => void) | null = null;
	return {
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
}

describe('collaborationPresence', () => {
	it('publishes the local user presence immediately on start', () => {
		const awareness = makeAwareness();
		const presence = new CollaborationPresence(() => ({ width: 960, height: 540 }));
		presence.start(awareness, { userName: 'Ada', userColor: '#123456' });
		expect(awareness.__states.get(1)?.presence).toMatchObject({
			userName: 'Ada',
			userColor: '#123456',
		});
	});

	it('projects remote awareness state into reactive cursors/remotePresences on change', () => {
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
		let seen: { remotePresences: unknown[]; cursors: unknown[] } | null = null;
		const cleanup = $effect.root(() => {
			const presence = new CollaborationPresence(() => ({ width: 960, height: 540 }));
			presence.start(awareness, { userName: 'Ada', userColor: '#123456' });
			awareness.__change();
			flushSync();
			seen = { remotePresences: presence.remotePresences, cursors: presence.cursors };
		});
		cleanup();

		expect(seen?.remotePresences).toHaveLength(1);
		expect(seen?.cursors).toHaveLength(1);
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
		let followedAfterLeave: number | null = -1;
		const cleanup = $effect.root(() => {
			const presence = new CollaborationPresence(() => ({ width: 960, height: 540 }));
			presence.start(awareness, { userName: 'Ada', userColor: '#123456' });
			awareness.__change();
			presence.followUser(2);
			expect(presence.followedClientId).toBe(2);

			awareness.__states.delete(2);
			awareness.__change();
			followedAfterLeave = presence.followedClientId;
		});
		cleanup();
		expect(followedAfterLeave).toBeNull();
	});

	it('stop clears reactive presence state and stops the heartbeat', () => {
		vi.useFakeTimers();
		const awareness = makeAwareness();
		let afterStop: {
			cursors: unknown[];
			remotePresences: unknown[];
			followedClientId: unknown;
		} | null = null;
		const cleanup = $effect.root(() => {
			const presence = new CollaborationPresence(() => ({ width: 960, height: 540 }));
			presence.start(awareness, { userName: 'Ada', userColor: '#123456' });
			presence.stop();
			afterStop = {
				cursors: presence.cursors,
				remotePresences: presence.remotePresences,
				followedClientId: presence.followedClientId,
			};
		});
		cleanup();
		expect(afterStop?.cursors).toStrictEqual([]);
		expect(afterStop?.remotePresences).toStrictEqual([]);
		expect(afterStop?.followedClientId).toBeNull();
		vi.useRealTimers();
	});
});
