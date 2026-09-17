import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { observeExternalCollaborationReadiness } from './collaboration-external-readiness';
import type {
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
} from './collaboration-external-session';
import { createCollaborationLivePatcher } from './collaboration-live-patch';
import { reconcileSlidesInYDoc, LOCAL_SYNC_ORIGIN } from './collaboration-reconcile';
import { readSlidesFromYDoc } from './collaboration-sync';
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

	it('publishes every accepted draft before readiness is revoked without writing afterward', () => {
		vi.useFakeTimers();
		const doc = new Y.Doc();
		const host = createSession({ status: 'connected', synced: true }, doc);
		reconcileSlidesInYDoc(
			[
				{
					id: 'slide',
					rId: 'r',
					slideNumber: 1,
					elements: [
						{ id: 'text', type: 'text', x: 0, y: 0, width: 200, height: 60, text: 'Before' },
					],
				},
			],
			doc,
			factories,
		);
		const patcher = createCollaborationLivePatcher();
		const dispose = observeExternalCollaborationReadiness(host.session, {
			gate: createSyncGate(() => {}),
			livePatcher: patcher,
			factories,
			onStatus: () => {},
			adoptSlides: () => {},
		});
		const writes = vi.fn();
		doc.on('update', writes);
		try {
			patcher.patchText('slide', 'text', 'Draft written before');
			patcher.patchText('slide', 'text', 'Draft written before readiness paused');
			host.publish({ status: 'connecting', synced: false });
			expect(readSlidesFromYDoc(doc)[0].elements[0]).toMatchObject({
				text: 'Draft written before readiness paused',
			});
			expect(writes).toHaveBeenCalledTimes(2);
			patcher.patchText('slide', 'text', 'Forbidden paused input');
			patcher.patchGeometry('slide', 'text', { x: 100 });
			patcher.flush();
			vi.runAllTimers();
			expect(writes).toHaveBeenCalledTimes(2);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			dispose();
			doc.destroy();
			vi.useRealTimers();
		}
	});

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
		expect(gate.isOpen()).toBeFalsy();
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
		const slide = new Y.Map();
		slide.set('id', 'room-slide');
		doc.getArray('pptx:slides').push([slide]);
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
		expect(order).toStrictEqual(['adopt:1', 'write']);
		host.publish({ status: 'connecting', synced: false });
		doc.getArray('pptx:slides').delete(0, 1);
		host.publish({ status: 'connected', synced: true });
		expect(order).toStrictEqual(['adopt:1', 'write', 'adopt:0', 'write']);
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
				sessionIntent: 'join',
				adoptSlides,
			},
		);
		host.publish({ status: 'connecting', synced: false });
		host.publish({ status: 'connected', synced: true });
		expect(adoptSlides).not.toHaveBeenCalled();
		expect(gate.isOpen()).toBeFalsy();
		expect(patcher.isActive()).toBeFalsy();
		dispose();
		patcher.dispose();
		doc.destroy();
	});

	it('requests initial publication for an already synchronized empty create room', () => {
		const doc = new Y.Doc();
		const host = createSession({ status: 'connected', synced: true }, doc);
		const gate = createSyncGate(() => {});
		const onReady = vi.fn(({ seedEmptyRoom }) => {
			expect(seedEmptyRoom).toBeTruthy();
			reconcileSlidesInYDoc(
				[{ id: 'startup', rId: 'r', slideNumber: 1, elements: [] }],
				doc,
				factories,
			);
		});
		const dispose = observeExternalCollaborationReadiness(host.session, {
			gate,
			factories,
			sessionIntent: 'create',
			onStatus: () => {},
			adoptSlides: vi.fn(),
			onReady,
		});
		expect(doc.getArray('pptx:slides')).toHaveLength(1);
		expect(onReady).toHaveBeenCalledOnce();
		expect(dispose.canWrite()).toBeTruthy();
		dispose();
		doc.destroy();
	});

	it('does not let a no-op empty local render establish room ownership', () => {
		const doc = new Y.Doc();
		const host = createSession({ status: 'connected', synced: true }, doc);
		const adoptSlides = vi.fn();
		const onReady = vi.fn();
		const dispose = observeExternalCollaborationReadiness(host.session, {
			gate: createSyncGate(() => {}),
			factories,
			onStatus: () => {},
			adoptSlides,
			onReady,
		});
		reconcileSlidesInYDoc([], doc, factories, LOCAL_SYNC_ORIGIN);
		host.publish({ status: 'connecting', synced: false });
		host.publish({ status: 'connected', synced: true });
		expect(adoptSlides).not.toHaveBeenCalled();
		expect(onReady).toHaveBeenLastCalledWith({ seedEmptyRoom: true });
		dispose();
		doc.destroy();
	});

	it.each(['remote', 'open'] as const)('opens a waiting join only after %s content', (trigger) => {
		const doc = new Y.Doc();
		const host = createSession({ status: 'connected', synced: true }, doc);
		const patcher = createCollaborationLivePatcher();
		const adoptSlides = vi.fn();
		const onReadOnlyChange = vi.fn();
		const dispose = observeExternalCollaborationReadiness(host.session, {
			gate: createSyncGate(() => {}),
			livePatcher: patcher,
			factories,
			sessionIntent: 'join',
			onStatus: () => {},
			adoptSlides,
			onReadOnlyChange,
		});
		expect(dispose.canWrite()).toBeFalsy();
		expect(patcher.isActive()).toBeFalsy();
		expect(onReadOnlyChange).toHaveBeenLastCalledWith(true);
		if (trigger === 'remote') {
			reconcileSlidesInYDoc(
				[{ id: 'remote', rId: 'r', slideNumber: 1, elements: [] }],
				doc,
				factories,
				'remote',
			);
			expect(adoptSlides).toHaveBeenCalledOnce();
		} else {
			dispose.allowLocalLoad();
			expect(adoptSlides).not.toHaveBeenCalled();
		}
		expect(dispose.canWrite()).toBeTruthy();
		expect(patcher.isActive()).toBeTruthy();
		expect(onReadOnlyChange).toHaveBeenLastCalledWith(false);
		dispose();
		patcher.dispose();
		doc.destroy();
	});
});
