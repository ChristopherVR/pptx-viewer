import { PptxHandler } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CollaborationConfig,
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
} from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { createPptxViewer, PptxViewer } from '../PptxViewer';
import { createInitialViewerState, createStore } from '../state';
import { createCollaborationController } from './collaboration-controller';
import { createCollabProvider } from './collaboration-provider';

vi.mock(import('./collaboration-provider'), () => ({ createCollabProvider: vi.fn() }));

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

function build() {
	const store = createStore(createInitialViewerState());
	store.set({ editable: true, slides: [slide('placeholder')] });
	const collab = createCollaborationController({
		store,
		getHandler: () => null,
		setEditable: (editable) => store.set({ editable }),
	});
	return { collab, store };
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

describe('host-owned Vanilla collaboration', () => {
	it('releases a pending native composition when its chrome is forcibly detached', async () => {
		const room = host(true);
		const container = document.createElement('div');
		document.body.appendChild(container);
		const viewer = createPptxViewer(container, { editable: true });
		const concrete = viewer as PptxViewer;
		reconcileSlidesInYDoc(
			[
				{
					id: 's1',
					rId: 'r1',
					slideNumber: 1,
					elements: [
						{
							id: 'text',
							type: 'text',
							x: 10,
							y: 10,
							width: 200,
							height: 50,
							text: 'Body',
							textSegments: [{ text: 'Body', style: {} }],
						},
					],
				},
			],
			room.doc,
			factories,
		);
		try {
			await viewer.startCollaboration(config(room.session));
			container
				.querySelector('[data-pptx-viewport] [data-element-id="text"]')!
				.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
			const surface = container.querySelector<HTMLElement>('[data-inline-editor]')!;
			expect(surface).not.toBeNull();
			surface.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
			const remove = vi.spyOn(surface, 'removeEventListener');
			concrete.editor.detachChrome();
			expect(surface.isConnected).toBeFalsy();
			expect(remove).toHaveBeenCalledWith('compositionend', expect.any(Function));
			expect(readSlidesFromYDoc(room.doc)[0].elements[0]).toMatchObject({ text: 'Body' });
		} finally {
			viewer.destroy();
			room.doc.destroy();
			container.remove();
		}
	});

	it('keeps a later host edit-permission change when readiness resumes', async () => {
		const room = host(true);
		const container = document.createElement('div');
		document.body.appendChild(container);
		const viewer = createPptxViewer(container, { editable: true });
		try {
			await viewer.startCollaboration(config(room.session));
			room.update({ status: 'disconnected', synced: false });
			expect(viewer.getMode()).toBe('preview');
			viewer.setEditable(true);
			expect(viewer.getMode()).toBe('preview');
			viewer.setEditable(false);
			room.update({ status: 'connected', synced: true });
			expect(viewer.getMode()).toBe('preview');
			viewer.setEditable(true);
			expect(viewer.getMode()).toBe('edit');
		} finally {
			viewer.destroy();
			container.remove();
		}
	}, 15000);

	it('blocks editing while unsynced but permits host-authorized offline edits', async () => {
		const room = host();
		const { collab, store } = build();
		await collab.start(config(room.session));
		expect(store.get().editable).toBeFalsy();
		room.update({ status: 'connected', synced: true });
		expect(store.get().editable).toBeTruthy();
		room.update({ status: 'disconnected', synced: true });
		expect(store.get().editable).toBeTruthy();
		room.update({ status: 'connected', synced: false });
		expect(store.get().editable).toBeFalsy();
		collab.destroy();
		expect(store.get().editable).toBeTruthy();
	});

	it('leaves a borrowed session attached after cancelled beforeunload', async () => {
		const room = host(true);
		const { collab } = build();
		await collab.start(config(room.session));
		window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
		expect(collab.isActive()).toBeTruthy();
		window.dispatchEvent(new Event('pagehide'));
		expect(collab.isActive()).toBeFalsy();
		expect(room.destroy).not.toHaveBeenCalled();
		collab.destroy();
	});

	it('keeps the public viewer read-only through file loading and mode changes', async () => {
		const room = host(true);
		const container = document.createElement('div');
		document.body.appendChild(container);
		const viewer = createPptxViewer(container, { editable: true });
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		try {
			await viewer.startCollaboration(config(room.session, 'viewer'));
			await viewer.loadFile(await handler.save(data.slides));
			viewer.setEditable(true);
			viewer.setMode('edit');
			expect(viewer.getMode()).toBe('preview');
			expect(container.querySelector('.pptxv-editable')).toBeNull();
			viewer.stopCollaboration();
			expect(viewer.getMode()).toBe('edit');
		} finally {
			viewer.destroy();
			handler.dispose();
			container.remove();
		}
	}, 15000);

	it('publishes a late bootstrap into an empty creator room without discarding it', async () => {
		const room = host(true);
		const { collab, store } = build();
		store.set({ slides: [] });
		await collab.start({ ...config(room.session), sessionIntent: 'create' });
		collab.beginContentLoad('bootstrap');
		store.set({ slides: [slide('parsed-bootstrap')] });
		collab.notifyContentLoaded('bootstrap');
		expect(store.get().slides[0].id).toBe('parsed-bootstrap');
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('parsed-bootstrap');
		room.update({ status: 'connected', synced: false });
		reconcileSlidesInYDoc([], room.doc, factories, 'host');
		room.update({ status: 'connected', synced: true });
		expect(store.get().slides).toStrictEqual([]);
		collab.destroy();
	});

	it('does not persist an in-flight save after readiness closes and reopens', async () => {
		vi.useFakeTimers();
		const room = host(true);
		room.seed('remote');
		const store = createStore(createInitialViewerState());
		let finish!: (bytes: Uint8Array) => void;
		const save = vi.fn(
			() =>
				new Promise<Uint8Array>((resolve) => {
					finish = resolve;
				}),
		);
		const onWriteBack = vi.fn();
		const collab = createCollaborationController({
			store,
			getHandler: () => ({ save }) as unknown as PptxHandler,
			setEditable: vi.fn(),
		});
		await collab.start({ ...config(room.session, 'owner'), onWriteBack, writeBackDebounceMs: 0 });
		store.set({ slides: [slide('edited')] });
		await vi.advanceTimersByTimeAsync(0);
		expect(save).toHaveBeenCalledOnce();
		room.update({ status: 'connected', synced: false });
		room.update({ status: 'connected', synced: true });
		finish(new Uint8Array([1]));
		await vi.advanceTimersByTimeAsync(0);
		expect(onWriteBack).not.toHaveBeenCalled();
		collab.destroy();
	});

	it('adopts an emptied established room before reopening a paused gate', async () => {
		const room = host(true);
		room.seed('remote');
		const { collab, store } = build();
		await collab.start(config(room.session));
		room.update({ status: 'disconnected', synced: false });
		reconcileSlidesInYDoc([], room.doc, factories, 'host');
		store.set({ slides: [slide('stale-local')] });
		room.update({ status: 'connected', synced: true });
		expect(store.get().slides).toStrictEqual([]);
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		collab.destroy();
	});

	it('keeps an empty joined room unseeded until an explicit user load', async () => {
		const room = host(true);
		const { collab, store } = build();
		await collab.start({ ...config(room.session), sessionIntent: 'join' });
		collab.beginContentLoad('bootstrap');
		store.set({ slides: [slide('placeholder')] });
		collab.notifyContentLoaded('bootstrap');
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		expect(collab.livePatcher.isActive()).toBeFalsy();
		collab.beginContentLoad('user');
		store.set({ slides: [slide('opened-file')] });
		collab.notifyContentLoaded('user');
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('opened-file');
		expect(collab.livePatcher.isActive()).toBeTruthy();
		collab.destroy();
	});

	it('releases the join barrier on adoption and permits later empty and new decks', async () => {
		const room = host(true);
		const { collab, store } = build();
		await collab.start({ ...config(room.session), sessionIntent: 'join' });
		room.seed('remote');
		expect(collab.livePatcher.isActive()).toBeTruthy();
		store.set({ slides: [] });
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		store.set({ slides: [slide('new-slide')] });
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('new-slide');
		reconcileSlidesInYDoc([], room.doc, factories, 'host');
		expect(store.get().slides).toStrictEqual([]);
		collab.destroy();
	});

	it('adopts an already-synced document before enabling writes and borrows ownership', async () => {
		const room = host(true);
		room.seed('remote');
		const { collab, store } = build();
		const unsubscribe = store.subscribe((state, previous) => {
			if (state.slides !== previous.slides) {
				expect(collab.livePatcher.isActive()).toBeFalsy();
			}
		});
		await collab.start(config(room.session));
		unsubscribe();
		expect(store.get().slides[0].id).toBe('remote');
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('remote');
		expect(collab.livePatcher.isActive()).toBeTruthy();
		expect(createCollabProvider).not.toHaveBeenCalled();
		room.awareness.setLocalStateField('hostField', 'updated');
		collab.destroy();
		expect(room.destroy).not.toHaveBeenCalled();
		expect(room.awareness.destroy).not.toHaveBeenCalled();
		expect(room.awareness.getLocalState()).toStrictEqual({
			hostField: 'updated',
			presence: { userName: 'Host' },
		});
		expect(room.unsubscribe).toHaveBeenCalledOnce();
		expect([...room.events.values()].every((listeners) => listeners.size === 0)).toBeTruthy();
	});

	it('never opens a grace gate and adopts a delayed room before publishing', async () => {
		vi.useFakeTimers();
		const room = host();
		const { collab, store } = build();
		await collab.start(config(room.session));
		store.set({ slides: [slide('unsynced-local')] });
		await vi.advanceTimersByTimeAsync(120_000);
		expect(readSlidesFromYDoc(room.doc)).toStrictEqual([]);
		expect(collab.livePatcher.isActive()).toBeFalsy();
		room.seed('remote');
		room.update({ status: 'connected', synced: true });
		expect(store.get().slides[0].id).toBe('remote');
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('remote');
		store.set({ slides: [slide('edited')] });
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('edited');
		collab.destroy();
	});

	it('uses synced independently of status and detaches a replaced session', async () => {
		const first = host(true);
		const second = host(true);
		second.seed('second');
		const { collab, store } = build();
		await collab.start(config(first.session));
		first.update({ status: 'disconnected', synced: true });
		expect(collab.getStatus()).toBe('disconnected');
		store.set({ slides: [slide('offline')] });
		expect(readSlidesFromYDoc(first.doc)[0].id).toBe('offline');
		first.update({ status: 'connected', synced: false });
		expect(collab.livePatcher.isActive()).toBeFalsy();
		await collab.start(config(second.session));
		first.seed('old-room');
		first.update({ status: 'error', synced: true });
		expect(store.get().slides[0].id).toBe('second');
		expect(collab.getStatus()).toBe('connecting');
		expect(first.unsubscribe).toHaveBeenCalledOnce();
		collab.destroy();
	});

	it('keeps viewer role read-only including the live patch channel and restores editing', async () => {
		const room = host(true);
		room.seed('remote');
		const { collab, store } = build();
		await collab.start(config(room.session, 'viewer'));
		expect(store.get().editable).toBeFalsy();
		store.set({ slides: [slide('local')] });
		expect(collab.livePatcher.isActive()).toBeFalsy();
		expect(readSlidesFromYDoc(room.doc)[0].id).toBe('remote');
		collab.destroy();
		expect(store.get().editable).toBeTruthy();
	});

	it('does not attach an external session after a pending start is cancelled', async () => {
		const room = host(true);
		const { collab } = build();
		const pending = collab.start(config(room.session));
		collab.stop();
		await pending;
		expect(collab.isActive()).toBeFalsy();
		expect(room.destroy).not.toHaveBeenCalled();
		expect(room.awareness.getLocalState()?.presence).toStrictEqual({ userName: 'Host' });
		collab.destroy();
	});
});
