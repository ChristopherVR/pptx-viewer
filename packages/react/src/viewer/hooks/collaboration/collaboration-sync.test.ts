import { afterEach, beforeEach, describe, expect, it } from 'vitest';
/**
 * Tests for two-client collaboration sync over a *simulated transport*.
 *
 * Unlike collaboration.test.ts (which wires Y.Docs together with a naive
 * `on('update')` relay), these tests model a y-websocket-style relay: a hub
 * that fans Yjs document updates and awareness updates out to every *other*
 * connected client, and supports clients joining and leaving mid-session.
 * This exercises the CRDT sync and presence/awareness behaviour the
 * collaboration hooks depend on, without a real WebSocket server.
 *
 * Coverage:
 *  - Document sync between two simulated clients (edits propagate)
 *  - A late joiner receiving the full current state on connect
 *  - Awareness presence: remote users join, update, and leave
 *  - Active-slide tracking and user-count derivation
 *  - Disconnect stops a client from receiving further updates
 *
 * @module collaboration/collaboration-sync.test
 */
import {
	Awareness,
	encodeAwarenessUpdate,
	applyAwarenessUpdate,
	removeAwarenessStates,
} from 'y-protocols/awareness';
import * as Y from 'yjs';

import { sanitizePresence } from './sanitize';
import type { UserPresence } from './types';

// ---------------------------------------------------------------------------
// Simulated y-websocket relay
// ---------------------------------------------------------------------------

interface RelayClient {
	id: string;
	doc: Y.Doc;
	awareness: Awareness;
}

/**
 * A minimal in-memory relay that mimics the demo's collab-server: it relays
 * each client's Yjs document updates and awareness updates to every *other*
 * connected client, and sends the current state to a client when it joins.
 */
class SimulatedRelay {
	private clients = new Map<string, RelayClient>();
	private docUpdateHandlers = new Map<string, (update: Uint8Array, origin: unknown) => void>();
	private awarenessHandlers = new Map<
		string,
		(changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => void
	>();

	/** Connect a client; it immediately syncs the current room state. */
	connect(id: string, doc: Y.Doc, awareness: Awareness): void {
		// Sync existing room state into the joining doc (sync step, simplified).
		for (const existing of this.clients.values()) {
			Y.applyUpdate(doc, Y.encodeStateAsUpdate(existing.doc));
			// And push current awareness of existing peers into the joiner.
			const states = Array.from(existing.awareness.getStates().keys());
			if (states.length > 0) {
				applyAwarenessUpdate(awareness, encodeAwarenessUpdate(existing.awareness, states), 'relay');
			}
			break; // one authoritative peer is enough for full state
		}

		const docHandler = (update: Uint8Array, origin: unknown) => {
			if (origin === 'relay') {
				return; // don't echo relayed updates back out
			}
			for (const [otherId, other] of this.clients) {
				if (otherId !== id) {
					Y.applyUpdate(other.doc, update, 'relay');
				}
			}
		};
		const awarenessHandler = (
			changes: { added: number[]; updated: number[]; removed: number[] },
			origin: unknown,
		) => {
			if (origin === 'relay') {
				return;
			}
			const changed = [...changes.added, ...changes.updated, ...changes.removed];
			const update = encodeAwarenessUpdate(awareness, changed);
			for (const [otherId, other] of this.clients) {
				if (otherId !== id) {
					applyAwarenessUpdate(other.awareness, update, 'relay');
				}
			}
		};

		doc.on('update', docHandler);
		awareness.on('update', awarenessHandler);
		this.docUpdateHandlers.set(id, docHandler);
		this.awarenessHandlers.set(id, awarenessHandler);
		this.clients.set(id, { id, doc, awareness });
	}

	/** Disconnect a client; remaining peers drop its awareness state. */
	disconnect(id: string): void {
		const client = this.clients.get(id);
		if (!client) {
			return;
		}
		const docHandler = this.docUpdateHandlers.get(id);
		const awarenessHandler = this.awarenessHandlers.get(id);
		if (docHandler) {
			client.doc.off('update', docHandler);
		}
		if (awarenessHandler) {
			client.awareness.off('update', awarenessHandler);
		}
		this.docUpdateHandlers.delete(id);
		this.awarenessHandlers.delete(id);
		this.clients.delete(id);

		// Tell remaining peers this client's awareness is gone — mirrors the
		// collab-server, which calls removeAwarenessStates on disconnect.
		const removedClientId = client.awareness.clientID;
		for (const other of this.clients.values()) {
			removeAwarenessStates(other.awareness, [removedClientId], 'relay');
		}
	}
}

/** Collect sanitised remote users from an awareness instance (hook logic). */
function collectRemoteUsers(
	awareness: Awareness,
	localClientId: number,
	canvasWidth = 960,
	canvasHeight = 540,
): UserPresence[] {
	const users: UserPresence[] = [];
	awareness.getStates().forEach((state, cid) => {
		if (cid === localClientId) {
			return;
		}
		const raw = (state as Record<string, unknown>).presence;
		if (!raw || typeof raw !== 'object') {
			return;
		}
		const sanitized = sanitizePresence(
			{ ...(raw as Record<string, unknown>), clientId: cid },
			canvasWidth,
			canvasHeight,
		);
		if (sanitized) {
			users.push(sanitized);
		}
	});
	return users;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collaboration sync — two clients over a simulated relay', () => {
	let relay: SimulatedRelay;
	let docA: Y.Doc;
	let docB: Y.Doc;
	let awA: Awareness;
	let awB: Awareness;

	beforeEach(() => {
		relay = new SimulatedRelay();
		docA = new Y.Doc();
		docB = new Y.Doc();
		awA = new Awareness(docA);
		awB = new Awareness(docB);
	});

	afterEach(() => {
		awA.destroy();
		awB.destroy();
		docA.destroy();
		docB.destroy();
	});

	describe('document sync', () => {
		it('propagates an element edit from client A to client B', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			const elementsA = docA.getMap('elements');
			const el = new Y.Map();
			el.set('id', 'el-1');
			el.set('text', 'Hello from A');
			elementsA.set('el-1', el);

			const synced = docB.getMap('elements').get('el-1') as Y.Map<unknown>;
			expect(synced).toBeDefined();
			expect(synced.get('text')).toBe('Hello from A');
		});

		it('propagates edits in both directions', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			docA.getArray<string>('slidesOrder').push(['s1']);
			docB.getArray<string>('slidesOrder').push(['s2']);

			expect(docA.getArray<string>('slidesOrder').toArray()).toStrictEqual(['s1', 's2']);
			expect(docB.getArray<string>('slidesOrder').toArray()).toStrictEqual(['s1', 's2']);
		});

		it('gives a late joiner the full current document state', () => {
			relay.connect('A', docA, awA);

			// A builds up state before B joins.
			const elementsA = docA.getMap('elements');
			const el = new Y.Map();
			el.set('id', 'before-join');
			el.set('text', 'pre-existing');
			elementsA.set('before-join', el);
			docA.getArray<string>('slidesOrder').push(['s1', 's2']);

			// B joins late.
			relay.connect('B', docB, awB);

			expect(docB.getArray<string>('slidesOrder').toArray()).toStrictEqual(['s1', 's2']);
			const synced = docB.getMap('elements').get('before-join') as Y.Map<unknown>;
			expect(synced.get('text')).toBe('pre-existing');
		});

		it('stops delivering updates to a client after it disconnects', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			docA.getMap('elements').set('first', new Y.Map());
			expect(docB.getMap('elements').has('first')).toBeTruthy();

			relay.disconnect('B');

			docA.getMap('elements').set('after-leave', new Y.Map());
			// B no longer receives updates.
			expect(docB.getMap('elements').has('after-leave')).toBeFalsy();
			// A still has both.
			expect(docA.getMap('elements').has('after-leave')).toBeTruthy();
		});
	});

	describe('presence / awareness', () => {
		it('reflects a remote user joining with presence', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			awB.setLocalStateField('presence', {
				userName: 'Bob',
				userColor: '#00ff00',
				activeSlideIndex: 2,
				cursorX: 100,
				cursorY: 200,
				lastUpdated: new Date().toISOString(),
			});

			const remoteFromA = collectRemoteUsers(awA, awA.clientID);
			expect(remoteFromA).toHaveLength(1);
			expect(remoteFromA[0]?.userName).toBe('Bob');
			expect(remoteFromA[0]?.activeSlideIndex).toBe(2);
		});

		it('tracks the active slide of a remote user as it changes', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			awB.setLocalStateField('presence', {
				userName: 'Bob',
				userColor: '#00ff00',
				activeSlideIndex: 0,
				cursorX: 0,
				cursorY: 0,
				lastUpdated: new Date().toISOString(),
			});
			expect(collectRemoteUsers(awA, awA.clientID)[0]?.activeSlideIndex).toBe(0);

			awB.setLocalStateField('presence', {
				userName: 'Bob',
				userColor: '#00ff00',
				activeSlideIndex: 4,
				cursorX: 0,
				cursorY: 0,
				lastUpdated: new Date().toISOString(),
			});
			expect(collectRemoteUsers(awA, awA.clientID)[0]?.activeSlideIndex).toBe(4);
		});

		it('derives the total connected user count (remote + local)', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			awA.setLocalStateField('presence', {
				userName: 'Alice',
				lastUpdated: new Date().toISOString(),
			});
			awB.setLocalStateField('presence', {
				userName: 'Bob',
				lastUpdated: new Date().toISOString(),
			});

			const remote = collectRemoteUsers(awA, awA.clientID);
			const connectedCount = remote.length + 1; // + local (connected)
			expect(connectedCount).toBe(2);
		});

		it('removes a remote user from presence when they disconnect', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			awB.setLocalStateField('presence', {
				userName: 'Bob',
				lastUpdated: new Date().toISOString(),
			});
			expect(collectRemoteUsers(awA, awA.clientID)).toHaveLength(1);

			relay.disconnect('B');

			expect(collectRemoteUsers(awA, awA.clientID)).toHaveLength(0);
		});

		it('sanitises malicious remote presence (XSS-safe)', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			awB.setLocalStateField('presence', {
				userName: "<script>alert('x')</script>Eve",
				userColor: 'not-a-color',
				cursorX: 999_999,
				lastUpdated: new Date().toISOString(),
			});

			const remote = collectRemoteUsers(awA, awA.clientID);
			expect(remote).toHaveLength(1);
			expect(remote[0]?.userName).toBe("alert('x')Eve");
			expect(remote[0]?.userColor).toBe('#6366f1'); // fallback
			expect(remote[0]?.cursorX).toBe(980); // clamped to canvasWidth + margin
		});
	});

	describe('concurrent edits converge', () => {
		it('two clients editing different elements both converge', () => {
			relay.connect('A', docA, awA);
			relay.connect('B', docB, awB);

			const a = new Y.Map();
			a.set('id', 'from-a');
			docA.getMap('elements').set('from-a', a);

			const b = new Y.Map();
			b.set('id', 'from-b');
			docB.getMap('elements').set('from-b', b);

			for (const doc of [docA, docB]) {
				expect(doc.getMap('elements').has('from-a')).toBeTruthy();
				expect(doc.getMap('elements').has('from-b')).toBeTruthy();
			}
		});
	});
});
