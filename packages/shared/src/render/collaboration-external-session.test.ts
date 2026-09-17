import { afterEach, describe, expect, it, vi } from 'vitest';
import { Doc } from 'yjs';

import {
	borrowExternalCollaborationAwareness,
	observeExternalCollaborationSession,
} from './collaboration-external-session';
import type {
	ExternalCollaborationAwareness,
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
} from './collaboration-external-session';

function createAwareness(initial: Record<string, unknown> | null = {}) {
	let state = initial;
	const awareness: ExternalCollaborationAwareness = {
		clientID: 1,
		getLocalState: () => state,
		setLocalState: vi.fn((next) => {
			state = next;
		}),
		setLocalStateField: vi.fn((field, value) => {
			if (state !== null) {
				state = { ...state, [field]: value };
			}
		}),
		getStates: () => new Map(state === null ? [] : [[1, state]]),
		on: vi.fn(),
		off: vi.fn(),
	};
	return awareness;
}

const documents: Doc[] = [];
afterEach(() => {
	for (const doc of documents.splice(0)) {
		doc.destroy();
	}
});

function createSession(snapshot: ExternalCollaborationSnapshot) {
	const listeners = new Set<() => void>();
	const unsubscribe = vi.fn();
	const doc = new Doc();
	documents.push(doc);
	const session: ExternalCollaborationSession = {
		doc,
		awareness: createAwareness(),
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				unsubscribe();
				listeners.delete(listener);
			};
		},
	};
	return {
		session,
		unsubscribe,
		listeners,
		publish: (next: ExternalCollaborationSnapshot) => {
			snapshot = next;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

describe('observeExternalCollaborationSession', () => {
	afterEach(() => vi.useRealTimers());

	it('subscribes before the initial read and adopts a sync completed during attachment', () => {
		const host = createSession({ status: 'connecting', synced: false });
		const subscribe = host.session.subscribe;
		host.session.subscribe = (listener) => {
			const unsubscribe = subscribe(listener);
			host.publish({ status: 'connected', synced: true });
			return unsubscribe;
		};
		const onSnapshot = vi.fn();
		const dispose = observeExternalCollaborationSession(host.session, onSnapshot);
		expect(onSnapshot).toHaveBeenCalledExactlyOnceWith({ status: 'connected', synced: true });
		dispose();
	});

	it('delivers only changed values even if a host mutates one snapshot object', () => {
		const snapshot: ExternalCollaborationSnapshot = { status: 'connecting', synced: false };
		const host = createSession(snapshot);
		const onSnapshot = vi.fn();
		const dispose = observeExternalCollaborationSession(host.session, onSnapshot);
		host.publish({ status: 'connecting', synced: false });
		expect(onSnapshot).toHaveBeenCalledOnce();
		snapshot.status = 'connected';
		snapshot.synced = true;
		host.publish(snapshot);
		expect(onSnapshot).toHaveBeenLastCalledWith({ status: 'connected', synced: true });
		expect(onSnapshot.mock.calls[0][0]).toStrictEqual({ status: 'connecting', synced: false });
		snapshot.status = 'disconnected';
		host.publish(snapshot);
		expect(onSnapshot).toHaveBeenLastCalledWith({ status: 'disconnected', synced: true });
		expect(onSnapshot).toHaveBeenCalledTimes(3);
		dispose();
	});

	it('never guesses readiness from a timer or the connection status', () => {
		vi.useFakeTimers();
		const host = createSession({ status: 'connected', synced: false });
		const transact = vi.spyOn(host.session.doc, 'transact');
		const onSnapshot = vi.fn();
		const dispose = observeExternalCollaborationSession(host.session, onSnapshot);
		vi.advanceTimersByTime(60_000);
		expect(onSnapshot).toHaveBeenCalledExactlyOnceWith({ status: 'connected', synced: false });
		host.publish({ status: 'disconnected', synced: true });
		expect(onSnapshot).toHaveBeenLastCalledWith({ status: 'disconnected', synced: true });
		host.publish({ status: 'error', synced: false });
		expect(onSnapshot).toHaveBeenLastCalledWith({ status: 'error', synced: false });
		expect(transact).not.toHaveBeenCalled();
		dispose();
	});

	it('unsubscribes exactly once and ignores already-queued callbacks after disposal', () => {
		const host = createSession({ status: 'connected', synced: true });
		const onSnapshot = vi.fn();
		const dispose = observeExternalCollaborationSession(host.session, onSnapshot);
		const queued = [...host.listeners][0];
		dispose();
		dispose();
		host.publish({ status: 'disconnected', synced: false });
		queued();
		expect(host.unsubscribe).toHaveBeenCalledOnce();
		expect(onSnapshot).toHaveBeenCalledOnce();
		expect(host.session.awareness.setLocalState).not.toHaveBeenCalled();
	});

	it('detaches when the initial snapshot consumer throws', () => {
		const host = createSession({ status: 'connected', synced: true });
		expect(() =>
			observeExternalCollaborationSession(host.session, () => {
				throw new Error('attachment failed');
			}),
		).toThrow('attachment failed');
		expect(host.unsubscribe).toHaveBeenCalledOnce();
		expect(host.listeners.size).toBe(0);
	});
});

describe('borrowExternalCollaborationAwareness', () => {
	it('forwards presence listeners without exposing host lifecycle methods', () => {
		const host = createAwareness({ user: { name: 'Ada' } });
		const { awareness, dispose } = borrowExternalCollaborationAwareness(host);
		const listener = vi.fn();
		awareness.on('change', listener);
		awareness.off('change', listener);
		expect(host.on).toHaveBeenCalledWith('change', listener);
		expect(host.off).toHaveBeenCalledWith('change', listener);
		expect(awareness.clientID).toBe(1);
		expect(awareness.getStates().get(1)).toStrictEqual({ user: { name: 'Ada' } });
		expect(awareness).not.toHaveProperty('setLocalState');
		expect(awareness).not.toHaveProperty('destroy');
		dispose();
		expect(host.setLocalState).not.toHaveBeenCalled();
	});

	it('removes only its presence while preserving host fields changed during the session', () => {
		const host = createAwareness({ user: 'Ada' });
		const { awareness, dispose } = borrowExternalCollaborationAwareness(host);
		awareness.setLocalStateField('presence', { selectedElementId: 'shape-1' });
		host.setLocalStateField('user', 'Grace');
		host.setLocalStateField('comments', { thread: 'thread-2' });
		dispose();
		expect(host.getLocalState()).toStrictEqual({ user: 'Grace', comments: { thread: 'thread-2' } });
		expect(host.setLocalState).not.toHaveBeenCalledWith(null);
		dispose();
		expect(host.setLocalState).toHaveBeenCalledOnce();
	});

	it.each([undefined, null, { cursor: 'host' }])(
		'restores a pre-existing presence field: %j',
		(presence) => {
			const host = createAwareness({ presence, user: 'Ada' });
			const { awareness, dispose } = borrowExternalCollaborationAwareness(host);
			awareness.setLocalStateField('presence', { selectedElementId: 'shape-1' });
			awareness.setLocalStateField('presence', { selectedElementId: 'shape-2' });
			dispose();
			expect(host.getLocalState()).toStrictEqual({ presence, user: 'Ada' });
		},
	);

	it('does not overwrite presence the host replaced after the last viewer write', () => {
		const host = createAwareness();
		const { awareness, dispose } = borrowExternalCollaborationAwareness(host);
		awareness.setLocalStateField('presence', { selectedElementId: 'shape-1' });
		host.setLocalStateField('presence', { cursor: 'host' });
		dispose();
		expect(host.getLocalState()).toStrictEqual({ presence: { cursor: 'host' } });
		expect(host.setLocalState).not.toHaveBeenCalled();
	});

	it('restores the most recent host presence if the viewer published again afterwards', () => {
		const host = createAwareness({ presence: { cursor: 'original' } });
		const { awareness, dispose } = borrowExternalCollaborationAwareness(host);
		awareness.setLocalStateField('presence', { selectedElementId: 'shape-1' });
		host.setLocalStateField('presence', { cursor: 'updated' });
		awareness.setLocalStateField('presence', { selectedElementId: 'shape-2' });
		dispose();
		expect(host.getLocalState()).toStrictEqual({ presence: { cursor: 'updated' } });
	});

	it('does not resurrect a departed host or allow stale publisher writes after disposal', () => {
		const host = createAwareness();
		const { awareness, dispose } = borrowExternalCollaborationAwareness(host);
		awareness.setLocalStateField('presence', { selectedElementId: 'shape-1' });
		host.setLocalState(null);
		awareness.setLocalStateField('presence', { selectedElementId: 'shape-2' });
		dispose();
		expect(host.getLocalState()).toBeNull();
		expect(host.setLocalState).toHaveBeenCalledOnce();
		host.setLocalState({ user: 'returned' });
		awareness.setLocalStateField('presence', { selectedElementId: 'stale' });
		expect(host.getLocalState()).toStrictEqual({ user: 'returned' });
	});
});
