import { DestroyRef, Injector } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import type {
	CollaborationConfig,
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
} from '../internal/shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from '../internal/shared';
import { createWebrtcBundle, createWebsocketBundle } from './collaboration-providers';
import { WriteBackScheduler } from './collaboration-writeback';
import { CollaborationService } from './collaboration.service';

vi.mock(import('./collaboration-providers'), () => ({
	createWebrtcBundle: vi.fn(),
	createWebsocketBundle: vi.fn(),
}));

const factories = {
	createMap: () => new Y.Map(),
	createArray: () => new Y.Array(),
	createText: () => new Y.Text(),
};
const slide = (id: string): PptxSlide => ({ id, elements: [] }) as unknown as PptxSlide;

function host(synced = false) {
	const doc = new Y.Doc();
	const destroy = vi.spyOn(doc, 'destroy');
	let state: Record<string, unknown> | null = { hostField: 'kept', presence: { userName: 'Host' } };
	let snapshot: ExternalCollaborationSnapshot = { status: 'connecting', synced };
	const listeners = new Set<() => void>();
	const events = new Map<string, Set<() => void>>();
	const unsubscribe = vi.fn();
	const awareness = {
		clientID: doc.clientID,
		destroy: vi.fn(),
		getLocalState: () => state,
		setLocalState: (next: Record<string, unknown> | null) => {
			state = next;
		},
		setLocalStateField: (key: string, value: unknown) => {
			state = { ...state, [key]: value };
		},
		getStates: () => new Map(state ? [[doc.clientID, state]] : []),
		on: (event: string, callback: () => void) => {
			if (!events.has(event)) {
				events.set(event, new Set());
			}
			events.get(event)!.add(callback);
		},
		off: (event: string, callback: () => void) => {
			events.get(event)?.delete(callback);
		},
	};
	const session: ExternalCollaborationSession = {
		doc,
		awareness,
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
				unsubscribe();
			};
		},
	};
	return {
		doc,
		session,
		awareness,
		destroy,
		unsubscribe,
		events,
		update(next: ExternalCollaborationSnapshot) {
			snapshot = next;
			listeners.forEach((listener) => listener());
		},
		seed(id: string) {
			reconcileSlidesInYDoc([slide(id)], doc, factories, 'host');
		},
	};
}

function service() {
	return Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: { onDestroy: () => () => undefined } },
			{ provide: CollaborationService, useClass: CollaborationService },
		],
	}).get(CollaborationService);
}

function config(
	session: ExternalCollaborationSession,
	role: CollaborationConfig['role'] = 'collaborator',
): CollaborationConfig {
	return {
		roomId: 'external-room',
		serverUrl: 'ws://unused.invalid',
		userName: 'Viewer',
		role,
		externalSession: session,
	};
}

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('host-owned Angular collaboration', () => {
	it('cancels pending and in-flight persistence when host readiness closes', async () => {
		const room = host(true);
		const collab = service();
		await collab.connect(config(room.session, 'owner'));
		const cancel = vi.spyOn(WriteBackScheduler.prototype, 'cancel');
		room.update({ status: 'connected', synced: false });
		expect(cancel).toHaveBeenCalledWith();
		expect(collab.livePatcher.isActive()).toBeFalsy();
		cancel.mockRestore();
		collab.disconnect();
	});

	it('adopts an emptied established room before reopening a paused gate', async () => {
		const room = host(true);
		room.seed('remote');
		const collab = service();
		const apply = vi.fn();
		await collab.connect(config(room.session), { onRemoteSlides: apply });
		room.update({ status: 'disconnected', synced: false });
		reconcileSlidesInYDoc([], room.doc, factories, 'host');
		collab.broadcastSlides([slide('stale-local')]);
		room.update({ status: 'connected', synced: true });
		expect(apply).toHaveBeenLastCalledWith([]);
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		collab.disconnect();
	});

	it('keeps an empty joined room unseeded until an explicit user load', async () => {
		const room = host(true);
		const collab = service();
		await collab.connect({ ...config(room.session), sessionIntent: 'join' });
		collab.broadcastSlides([slide('placeholder')]);
		collab.adoptDocSlidesAfterLoad('bootstrap');
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		expect(collab.livePatcher.isActive()).toBeFalsy();
		collab.adoptDocSlidesAfterLoad('user');
		collab.broadcastSlides([slide('opened-file')]);
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('opened-file');
		expect(collab.livePatcher.isActive()).toBeTruthy();
		collab.disconnect();
	});

	it('releases the join barrier on adoption and permits later empty and new decks', async () => {
		const room = host(true);
		const collab = service();
		const apply = vi.fn();
		await collab.connect(
			{ ...config(room.session), sessionIntent: 'join' },
			{ onRemoteSlides: apply },
		);
		room.seed('remote');
		expect(collab.livePatcher.isActive()).toBeTruthy();
		collab.broadcastSlides([]);
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		collab.broadcastSlides([slide('new-slide')]);
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('new-slide');
		reconcileSlidesInYDoc([], room.doc, factories, 'host');
		expect(apply).toHaveBeenLastCalledWith([]);
		collab.disconnect();
	});

	it('adopts an already-synced document before enabling writes and borrows ownership', async () => {
		const room = host(true);
		room.seed('remote');
		const collab = service();
		const apply = vi.fn(() => {
			expect(collab.livePatcher.isActive()).toBeFalsy();
			collab.broadcastSlides([slide('placeholder')]);
		});
		await collab.connect(config(room.session), { onRemoteSlides: apply });
		expect(apply).toHaveBeenCalledOnce();
		expect(readSlidesFromYDoc(room.doc).map((item) => item.id)).toStrictEqual(['remote']);
		expect(collab.livePatcher.isActive()).toBeTruthy();
		expect(createWebrtcBundle).not.toHaveBeenCalled();
		expect(createWebsocketBundle).not.toHaveBeenCalled();
		room.awareness.setLocalStateField('hostField', 'updated');
		collab.disconnect();
		expect(room.destroy).not.toHaveBeenCalled();
		expect(room.awareness.destroy).not.toHaveBeenCalled();
		expect(room.awareness.getLocalState()).toStrictEqual({
			hostField: 'updated',
			presence: { userName: 'Host' },
		});
		expect(room.unsubscribe).toHaveBeenCalledOnce();
		expect([...room.events.values()].every((listeners) => listeners.size === 0)).toBeTruthy();
	});

	it('never opens a grace gate and drops stale pending slides before delayed adoption', async () => {
		vi.useFakeTimers();
		const room = host();
		const collab = service();
		const apply = vi.fn();
		await collab.connect(config(room.session), { onRemoteSlides: apply });
		collab.broadcastSlides([slide('placeholder')]);
		await vi.advanceTimersByTimeAsync(120_000);
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		expect(collab.livePatcher.isActive()).toBeFalsy();
		room.seed('remote');
		room.update({ status: 'connected', synced: true });
		expect(readSlidesFromYDoc(room.doc).map((item) => item.id)).toStrictEqual(['remote']);
		expect(apply).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ id: 'remote' })]),
		);
		collab.broadcastSlides([slide('edited')]);
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('edited');
		collab.disconnect();
	});

	it('uses synced independently of status and detaches a replaced session', async () => {
		const first = host(true);
		const second = host(true);
		second.seed('second');
		const collab = service();
		const apply = vi.fn();
		await collab.connect(config(first.session), { onRemoteSlides: apply });
		first.update({ status: 'disconnected', synced: true });
		expect(collab.status()).toBe('disconnected');
		collab.broadcastSlides([slide('offline')]);
		expect(readSlidesFromYDoc(first.doc)[0].id).toBe('offline');
		first.update({ status: 'connected', synced: false });
		expect(collab.livePatcher.isActive()).toBeFalsy();
		await collab.connect(config(second.session), { onRemoteSlides: apply });
		apply.mockClear();
		first.seed('old-room');
		first.update({ status: 'error', synced: true });
		expect(apply).not.toHaveBeenCalled();
		expect(collab.status()).toBe('connecting');
		expect(first.unsubscribe).toHaveBeenCalledOnce();
		collab.disconnect();
	});

	it('keeps viewer role read-only including the live patch channel', async () => {
		const room = host(true);
		room.seed('remote');
		const collab = service();
		await collab.connect(config(room.session, 'viewer'));
		collab.broadcastSlides([slide('local')]);
		expect(collab.activeRole()).toBe('viewer');
		expect(collab.livePatcher.isActive()).toBeFalsy();
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('remote');
		collab.disconnect();
	});

	it('does not attach an external session after a pending connect is cancelled', async () => {
		const room = host(true);
		const collab = service();
		const pending = collab.connect(config(room.session));
		collab.disconnect();
		await pending;
		expect(collab.active()).toBeFalsy();
		expect(room.destroy).not.toHaveBeenCalled();
		expect(room.awareness.getLocalState()?.presence).toStrictEqual({ userName: 'Host' });
	});
});
