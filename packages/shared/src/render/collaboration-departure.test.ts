import { describe, expect, it, vi } from 'vitest';

import type {
	AwarenessStatesLike,
	DepartureChannelLike,
	DepartureNotice,
} from './collaboration-departure';
import {
	DEPARTURE_CHANNEL,
	createDepartureChannel,
	removeAwarenessStatesLocally,
} from './collaboration-departure';

/** A BroadcastChannel stand-in that fans messages out to every other channel. */
function makeBus(): { open: (name: string) => DepartureChannelLike } {
	const channels = new Set<DepartureChannelLike>();
	return {
		open: () => {
			const channel: DepartureChannelLike = {
				onmessage: null,
				postMessage: (message) => {
					for (const other of channels) {
						if (other !== channel) {
							other.onmessage?.({ data: message });
						}
					}
				},
				close: () => {
					channels.delete(channel);
				},
			};
			channels.add(channel);
			return channel;
		},
	};
}

function makeAwareness(
	clientID: number,
	peers: number[],
): AwarenessStatesLike & {
	events: string[];
} {
	const states = new Map<number, Record<string, unknown>>();
	states.set(clientID, { presence: { userName: 'me' } });
	for (const peer of peers) {
		states.set(peer, { presence: { userName: `peer-${peer}` } });
	}
	const events: string[] = [];
	return {
		clientID,
		states,
		emit: (name) => {
			events.push(name);
		},
		events,
	};
}

describe('removeAwarenessStatesLocally', () => {
	it('drops the client and notifies observers once', () => {
		const awareness = makeAwareness(1, [2, 3]);
		expect(removeAwarenessStatesLocally(awareness, [2])).toStrictEqual([2]);
		expect(awareness.states?.has(2)).toBeFalsy();
		expect(awareness.states?.has(3)).toBeTruthy();
		expect(awareness.events).toStrictEqual(['change', 'update']);
	});

	it('stays silent when nothing was removed', () => {
		const awareness = makeAwareness(1, [2]);
		expect(removeAwarenessStatesLocally(awareness, [99])).toStrictEqual([]);
		expect(awareness.events).toStrictEqual([]);
	});

	it('tolerates a missing awareness', () => {
		expect(removeAwarenessStatesLocally(null, [1])).toStrictEqual([]);
		expect(removeAwarenessStatesLocally({}, [1])).toStrictEqual([]);
	});
});

describe('createDepartureChannel', () => {
	it('drops an announced peer from every other session in the room', () => {
		const bus = makeBus();
		const host = makeAwareness(1, [2]);
		const guest = makeAwareness(2, [1]);
		createDepartureChannel('room-a', host, bus.open);
		const guestChannel = createDepartureChannel('room-a', guest, bus.open);

		guestChannel.announce();

		expect(host.states?.has(2)).toBeFalsy();
		expect(host.events).toStrictEqual(['change', 'update']);
	});

	it('ignores announcements from another room', () => {
		const bus = makeBus();
		const host = makeAwareness(1, [2]);
		createDepartureChannel('room-a', host, bus.open);
		createDepartureChannel('room-b', makeAwareness(2, []), bus.open).announce();

		expect(host.states?.has(2)).toBeTruthy();
	});

	it('never drops its own client id', () => {
		const bus = makeBus();
		const a = makeAwareness(7, []);
		const b = makeAwareness(7, []);
		createDepartureChannel('room-a', a, bus.open);
		createDepartureChannel('room-a', b, bus.open).announce();

		expect(a.states?.has(7)).toBeTruthy();
	});

	it('ignores unrelated channel traffic', () => {
		const received: DepartureNotice[] = [];
		const host = makeAwareness(1, [2]);
		const channel: DepartureChannelLike = {
			onmessage: null,
			postMessage: (m) => received.push(m),
			close: () => {},
		};
		createDepartureChannel('room-a', host, () => channel);

		channel.onmessage?.({ data: null });
		channel.onmessage?.({ data: { channel: 'other', roomId: 'room-a', clientId: 2 } });
		channel.onmessage?.({ data: { channel: DEPARTURE_CHANNEL, roomId: 'room-a' } });

		expect(host.states?.has(2)).toBeTruthy();
	});

	it('stops announcing and listening after dispose', () => {
		const posted: DepartureNotice[] = [];
		const close = vi.fn();
		const channel: DepartureChannelLike = {
			onmessage: null,
			postMessage: (m) => posted.push(m),
			close,
		};
		const departure = createDepartureChannel('room-a', makeAwareness(1, []), () => channel);

		departure.dispose();
		departure.announce();

		expect(close).toHaveBeenCalledOnce();
		expect(channel.onmessage).toBeNull();
		expect(posted).toStrictEqual([]);
	});

	it('is a no-op when the runtime has no BroadcastChannel', () => {
		const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
		delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
		try {
			const departure = createDepartureChannel('room-a', makeAwareness(1, []));
			expect(() => {
				departure.announce();
				departure.dispose();
			}).not.toThrow();
		} finally {
			(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
		}
	});
});
