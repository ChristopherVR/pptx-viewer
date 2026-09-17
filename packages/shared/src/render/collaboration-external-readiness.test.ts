import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { observeExternalCollaborationReadiness } from './collaboration-external-readiness';
import type {
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
} from './collaboration-external-session';
import { createCollaborationLivePatcher } from './collaboration-live-patch';
import { createSyncGate } from './collaboration-sync-gate';

function createSession(snapshot: ExternalCollaborationSnapshot, doc: Y.Doc) {
	const listeners = new Set<() => void>();
	const unsubscribe = vi.fn();
	const session: ExternalCollaborationSession = {
		doc,
		awareness: {
			clientID: 1,
			getLocalState: () => null,
			setLocalState: vi.fn(),
			setLocalStateField: vi.fn(),
			getStates: () => new Map(),
			on: vi.fn(),
			off: vi.fn(),
		},
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
		publish: (next: ExternalCollaborationSnapshot) => {
			snapshot = next;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

describe('observeExternalCollaborationReadiness', () => {
	const factories = {
		createMap: () => new Y.Map(),
		createArray: () => new Y.Array(),
		createText: () => new Y.Text(),
	};

	it('adopts existing room slides before the gate callback can write bootstrap slides', () => {
		const doc = new Y.Doc();
		const slide = new Y.Map();
		slide.set('id', 'room-slide');
		doc.getArray('pptx:slides').push([slide]);
		const host = createSession({ status: 'connected', synced: true }, doc);
		const order: string[] = [];
		const patcher = createCollaborationLivePatcher();
		const gate = createSyncGate(() => order.push('write'));
		const dispose = observeExternalCollaborationReadiness(
			{ ...host.session, doc },
			{
				gate,
				livePatcher: patcher,
				factories,
				onStatus: () => {},
				adoptSlides: (slides) => order.push(slides[0].id!),
			},
		);
		expect(order).toStrictEqual(['room-slide', 'write']);
		expect(patcher.isActive()).toBeTruthy();
		dispose();
		patcher.dispose();
		doc.destroy();
	});

	it('suspends both write paths on lost sync, resumes after adoption, and permits synced offline edits', () => {
		const doc = new Y.Doc();
		const host = createSession({ status: 'connecting', synced: false }, doc);
		const patcher = createCollaborationLivePatcher();
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen);
		const adoptSlides = vi.fn();
		const dispose = observeExternalCollaborationReadiness(
			{ ...host.session, doc },
			{
				gate,
				livePatcher: patcher,
				factories,
				adoptSlides,
				onStatus: () => {},
			},
		);
		expect(gate.isOpen()).toBeFalsy();
		expect(patcher.isActive()).toBeFalsy();
		host.publish({ status: 'connected', synced: true });
		expect(gate.isOpen()).toBeTruthy();
		expect(patcher.isActive()).toBeTruthy();
		host.publish({ status: 'disconnected', synced: true });
		expect(gate.isOpen()).toBeTruthy();
		expect(patcher.isActive()).toBeTruthy();
		expect(onOpen).toHaveBeenCalledOnce();
		host.publish({ status: 'disconnected', synced: false });
		expect(gate.isOpen()).toBeFalsy();
		expect(patcher.isActive()).toBeFalsy();
		const slide = new Y.Map();
		slide.set('id', 'remote');
		doc.getArray('pptx:slides').push([slide]);
		host.publish({ status: 'connected', synced: true });
		expect(adoptSlides).toHaveBeenCalledOnce();
		expect(onOpen).toHaveBeenCalledTimes(2);
		dispose();
		host.publish({ status: 'connected', synced: false });
		expect(gate.isOpen()).toBeTruthy();
		expect(host.unsubscribe).toHaveBeenCalledOnce();
		patcher.dispose();
		doc.destroy();
	});

	it('never enables interim mutations for a viewer role', () => {
		const doc = new Y.Doc();
		const host = createSession({ status: 'connected', synced: true }, doc);
		const patcher = createCollaborationLivePatcher();
		const gate = createSyncGate(() => {});
		const dispose = observeExternalCollaborationReadiness(
			{ ...host.session, doc },
			{
				gate,
				livePatcher: patcher,
				factories,
				role: 'viewer',
				onStatus: () => {},
				adoptSlides: () => {},
			},
		);
		expect(gate.isOpen()).toBeTruthy();
		expect(patcher.isActive()).toBeFalsy();
		dispose();
		doc.destroy();
	});

	it('adopts an emptied room on re-sync before the gate can flush stale slides', () => {
		const doc = new Y.Doc();
		const host = createSession({ status: 'connected', synced: true }, doc);
		const patcher = createCollaborationLivePatcher();
		const order: string[] = [];
		const gate = createSyncGate(() => order.push('write'));
		const dispose = observeExternalCollaborationReadiness(
			{ ...host.session, doc },
			{
				gate,
				livePatcher: patcher,
				factories,
				onStatus: () => {},
				adoptSlides: (slides) => order.push(`adopt:${slides.length}`),
			},
		);
		expect(order).toStrictEqual(['write']);
		host.publish({ status: 'connecting', synced: false });
		host.publish({ status: 'connected', synced: true });
		expect(order).toStrictEqual(['write', 'adopt:0', 'write']);
		dispose();
		patcher.dispose();
		doc.destroy();
	});

	it('keeps an initial empty join waiting across readiness transitions', () => {
		const doc = new Y.Doc();
		const host = createSession({ status: 'connected', synced: true }, doc);
		const patcher = createCollaborationLivePatcher();
		const gate = createSyncGate(() => {});
		const adoptSlides = vi.fn();
		const dispose = observeExternalCollaborationReadiness(
			{ ...host.session, doc },
			{
				gate,
				livePatcher: patcher,
				factories,
				onStatus: () => {},
				canAdoptEmptySlides: () => false,
				adoptSlides,
			},
		);
		host.publish({ status: 'connecting', synced: false });
		host.publish({ status: 'connected', synced: true });
		expect(adoptSlides).not.toHaveBeenCalled();
		dispose();
		patcher.dispose();
		doc.destroy();
	});
});
