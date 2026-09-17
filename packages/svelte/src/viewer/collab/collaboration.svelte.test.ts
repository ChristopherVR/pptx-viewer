import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import type {
	AwarenessLike,
	CollaborationConfig,
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { EditorState } from '../editor/editor-state.svelte';
import type { CollabSession, CollabSessionFactory } from './collaboration-session';
import * as sessionModule from './collaboration-session';
import { CollaborationController } from './collaboration.svelte';

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

/**
 * `.svelte.test.ts` so the runes runtime compiles `CollaborationController`'s
 * constructor `$effect`s. A real in-memory `Y.Doc` (with a fake, network-free
 * provider handle) exercises the shared reconcile/observe path end to end, so
 * the tests assert real publish/remote-apply behaviour, not mock call counts.
 */

const CONFIG: CollaborationConfig = {
	roomId: 'test-room',
	serverUrl: '',
	transport: 'webrtc',
	userName: 'Tester',
};

function shape(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 10, height: 10, rotation: 0 } as PptxElement;
}
function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

function realFactories(): YjsFactories {
	return {
		createMap: () => new Y.Map(),
		createArray: () => new Y.Array(),
		createText: () => new Y.Text(),
	};
}

/** A minimal awareness fake satisfying the shared `AwarenessLike` structural interface. */
function fakeAwareness(clientID = 1): AwarenessLike {
	const states = new Map<number, Record<string, unknown>>();
	return {
		clientID,
		setLocalStateField: (field, value) => states.set(clientID, { [field]: value }),
		getStates: () => states,
		on: () => {},
		off: () => {},
	};
}

/** A fake session backed by a real Y.Doc; `syncedNow` controls the sync gate. */
function fakeSessionFactory(doc: Y.Doc, syncedNow = true): CollabSessionFactory {
	return async (): Promise<CollabSession> => ({
		ydoc: doc as unknown as YDocLike,
		factories: realFactories(),
		provider: {
			awareness: fakeAwareness(),
			onStatus: () => {},
			connectedNow: true,
			onSynced: () => {},
			syncedNow,
			destroy: vi.fn(),
		},
		destroy: vi.fn(),
	});
}

/** A fake session whose `onStatus`/`onSynced` callbacks can be driven manually (reconnect tests). */
function statusDrivenSessionFactory(
	doc: Y.Doc,
	syncedNow: boolean,
): {
	factory: CollabSessionFactory;
	emitStatus: (connected: boolean) => void;
	emitSynced: () => void;
} {
	let statusCb: ((connected: boolean) => void) | null = null;
	let syncedCb: (() => void) | null = null;
	return {
		factory: async (): Promise<CollabSession> => ({
			ydoc: doc as unknown as YDocLike,
			factories: realFactories(),
			provider: {
				awareness: fakeAwareness(),
				onStatus: (cb) => {
					statusCb = cb;
				},
				connectedNow: true,
				onSynced: (cb) => {
					syncedCb = cb;
				},
				syncedNow,
				destroy: vi.fn(),
			},
			destroy: vi.fn(),
		}),
		emitStatus: (connected: boolean) => statusCb?.(connected),
		emitSynced: () => syncedCb?.(),
	};
}

function makeEditor(initial: PptxSlide[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides(initial);
	return editor;
}

/**
 * Run `body` inside a live `$effect.root`, keeping the root alive until the
 * async assertions settle (disposing it early would tear down the controller's
 * publish effect before the edit under test lands).
 */
function inRoot(body: () => Promise<void>): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let dispose = (): void => {};
		dispose = $effect.root(() => {
			void (async () => {
				try {
					await body();
					resolve();
				} catch (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				} finally {
					dispose();
				}
			})();
		});
	});
}

describe('collaborationController', () => {
	it('publishes the local slides into the doc once the sync gate opens', async () => {
		const doc = new Y.Doc();
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			// getConfig returns the started config so the auto start/stop effect
			// treats the manual `start` below as already-current (no restart/stop).
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => editor.applyRemoteSlides(s),
				getConfig: () => CONFIG,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(CONFIG);

			// Gate opened during start (syncedNow), seeding the doc.
			expect(readSlidesFromYDoc(doc as unknown as YDocLike).map((s) => s.id)).toStrictEqual(['s1']);

			// A subsequent edit republishes granularly.
			editor.setSlides([slide('s1', [shape('e1'), shape('e2')])]);
			flushSync();
			const after = readSlidesFromYDoc(doc as unknown as YDocLike);
			expect(after[0].elements.map((e) => e.id)).toStrictEqual(['e1', 'e2']);
			collab.stop();
		});
	});

	it('re-arms the sync gate on reconnect instead of leaving it permanently open', async () => {
		const doc = new Y.Doc();
		const { factory, emitStatus, emitSynced } = statusDrivenSessionFactory(doc, true);
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => editor.applyRemoteSlides(s),
				getConfig: () => CONFIG,
				createSession: factory,
			});
			await collab.start(CONFIG);
			expect(readSlidesFromYDoc(doc as unknown as YDocLike).map((s) => s.id)).toStrictEqual(['s1']);

			// Drop and reconnect: without a re-arm, the gate stays open and a local
			// edit issued right after reconnecting could clobber the room before a
			// fresh sync confirmation arrives.
			emitStatus(false);
			emitStatus(true);

			editor.setSlides([slide('s1', [shape('e1'), shape('e2')])]);
			flushSync();
			expect(
				readSlidesFromYDoc(doc as unknown as YDocLike)[0].elements.map((e) => e.id),
			).toStrictEqual(['e1']);

			// A fresh sync confirmation re-opens the gate and flushes the pending edit.
			emitSynced();
			expect(
				readSlidesFromYDoc(doc as unknown as YDocLike)[0].elements.map((e) => e.id),
			).toStrictEqual(['e1', 'e2']);
			collab.stop();
		});
	});

	it('applies a remote peer edit through applyRemoteSlides (granular reconcile)', async () => {
		const doc = new Y.Doc();
		const applySpy = vi.fn();
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => {
					applySpy(s);
					editor.applyRemoteSlides(s);
				},
				getConfig: () => CONFIG,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(CONFIG);

			// Simulate a remote peer's write (a non-local transaction origin).
			reconcileSlidesInYDoc(
				[slide('s1', [shape('e1'), shape('remote')])],
				doc as unknown as YDocLike,
				realFactories(),
				'remote-peer',
			);
			expect(applySpy).toHaveBeenCalledOnce();
			const applied = applySpy.mock.calls[0][0] as PptxSlide[];
			expect(applied[0].elements.map((e) => e.id)).toStrictEqual(['e1', 'remote']);
			collab.stop();
		});
	});

	it('re-adopts the doc slides when a late local load lands mid-session', async () => {
		const doc = new Y.Doc();
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => editor.applyRemoteSlides(s),
				getConfig: () => CONFIG,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(CONFIG);

			// A remote peer replaces the room content (applied via the observer).
			reconcileSlidesInYDoc(
				[slide('room', [shape('r1')])],
				doc as unknown as YDocLike,
				realFactories(),
				'remote-peer',
			);
			expect(editor.slides.map((s) => s.id)).toStrictEqual(['room']);

			// The async bootstrap load lands late, clobbering viewer state; the
			// load pipeline then calls adoptDocAfterLoad synchronously, before
			// any local-to-doc publish of the placeholder deck can flush.
			editor.setSlides([slide('placeholder', [shape('p1')])]);
			collab.adoptDocAfterLoad('bootstrap');
			flushSync();

			// The room's slides win locally and the placeholder never reaches the doc.
			expect(editor.slides.map((s) => s.id)).toStrictEqual(['room']);
			expect(readSlidesFromYDoc(doc as unknown as YDocLike).map((s) => s.id)).toStrictEqual([
				'room',
			]);
			collab.stop();
		});
	});

	it('keeps the loaded deck when the room is empty (this client seeds it)', async () => {
		const doc = new Y.Doc();
		await inRoot(async () => {
			const editor = makeEditor([]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => editor.applyRemoteSlides(s),
				getConfig: () => CONFIG,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(CONFIG);

			// Load completes into an empty room: adoption is a no-op and the
			// normal gated publish path seeds the doc with the loaded deck.
			editor.setSlides([slide('loaded', [shape('l1')])]);
			collab.adoptDocAfterLoad('bootstrap');
			flushSync();

			expect(editor.slides.map((s) => s.id)).toStrictEqual(['loaded']);
			expect(readSlidesFromYDoc(doc as unknown as YDocLike).map((s) => s.id)).toStrictEqual([
				'loaded',
			]);
			collab.stop();
		});
	});

	it('enforces the viewer role: read-only and never publishes local edits', async () => {
		const doc = new Y.Doc();
		const viewerConfig: CollaborationConfig = { ...CONFIG, role: 'viewer' };
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => editor.applyRemoteSlides(s),
				getConfig: () => viewerConfig,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(viewerConfig);

			expect(collab.readOnly).toBeTruthy();
			expect(collab.livePatcher.isActive()).toBeFalsy();
			editor.setSlides([slide('s1', [shape('e1'), shape('e2')])]);
			flushSync();
			// A viewer must not write to the shared doc.
			expect(readSlidesFromYDoc(doc as unknown as YDocLike)).toHaveLength(0);
			collab.stop();
			expect(collab.readOnly).toBeFalsy();
		});
	});

	it('goes to error status on an invalid room id', async () => {
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: () => {},
				getConfig: () => undefined,
				createSession: fakeSessionFactory(new Y.Doc(), true),
			});
			await collab.start({ ...CONFIG, roomId: 'bad room!' });
			expect(collab.status).toBe('error');
			expect(collab.active).toBeFalsy();
		});
	});
});

function externalHost(
	initial: PptxSlide[] = [],
	snapshot: ExternalCollaborationSnapshot = { status: 'connected', synced: true },
) {
	const doc = new Y.Doc();
	let local: Record<string, unknown> | null = { user: 'host', comments: { thread: 'one' } };
	const listeners = new Set<() => void>();
	const session: ExternalCollaborationSession = {
		doc,
		awareness: {
			clientID: doc.clientID,
			getLocalState: () => local,
			setLocalState: (state) => {
				local = state;
			},
			setLocalStateField: (field, value) => {
				if (local) {
					local = { ...local, [field]: value };
				}
			},
			getStates: () => new Map(local ? [[doc.clientID, local]] : []),
			on: () => {},
			off: () => {},
		},
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
	if (initial.length) {
		reconcileSlidesInYDoc(initial, doc, realFactories());
	}
	return {
		doc,
		session,
		listeners,
		read: () => readSlidesFromYDoc(doc),
		publish: (next: ExternalCollaborationSnapshot) => {
			snapshot = next;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

describe('collaborationController external sessions', () => {
	it('persists remote-only changes on the elected owner without a local edit', async () => {
		vi.useFakeTimers();
		const bytes = new Uint8Array([7]);
		vi.spyOn(PptxHandler.prototype, 'load').mockResolvedValue({} as never);
		const save = vi.spyOn(PptxHandler.prototype, 'save').mockResolvedValue(bytes);
		const onWriteBack = vi.fn();
		const host = externalHost([slide('room', [shape('one')])]);
		await inRoot(async () => {
			const editor = makeEditor([slide('bootstrap', [])]);
			const config: CollaborationConfig = {
				...CONFIG,
				externalSession: host.session,
				role: 'owner',
				onWriteBack,
				writeBackDebounceMs: 0,
			};
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => config,
				getSourceBytes: () => bytes,
			});
			await collab.start(config);
			flushSync();
			await vi.advanceTimersByTimeAsync(0);
			onWriteBack.mockClear();
			save.mockClear();
			reconcileSlidesInYDoc(
				[slide('room', [{ ...shape('one'), x: 42 }])],
				host.doc,
				realFactories(),
				'peer',
			);
			flushSync();
			await vi.advanceTimersByTimeAsync(0);
			expect(editor.slides[0].elements[0].x).toBe(42);
			expect(save).toHaveBeenCalledOnce();
			expect(save.mock.calls[0][0][0].elements[0].x).toBe(42);
			expect(onWriteBack).toHaveBeenCalledWith(bytes);
			collab.stop();
		});
		host.doc.destroy();
	});

	it('keeps editing disabled and ignores partial room content until synced', async () => {
		const host = externalHost([slide('partial', [])], { status: 'connected', synced: false });
		await inRoot(async () => {
			const editor = makeEditor([slide('bootstrap', [])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => undefined,
			});
			await collab.start({ ...CONFIG, externalSession: host.session });
			expect(collab.readOnly).toBeTruthy();
			expect(editor.slides[0].id).toBe('bootstrap');
			reconcileSlidesInYDoc([slide('room', [])], host.doc, realFactories(), 'peer');
			expect(editor.slides[0].id).toBe('bootstrap');
			host.publish({ status: 'connected', synced: true });
			expect(collab.readOnly).toBeFalsy();
			expect(editor.slides[0].id).toBe('room');
			host.publish({ status: 'connecting', synced: false });
			expect(collab.readOnly).toBeTruthy();
			collab.stop();
			expect(collab.readOnly).toBeFalsy();
		});
		host.doc.destroy();
	});

	it('keeps a host session attached when beforeunload is cancelled', async () => {
		const host = externalHost([slide('room', [])]);
		await inRoot(async () => {
			const editor = makeEditor([slide('bootstrap', [])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => undefined,
			});
			await collab.start({ ...CONFIG, externalSession: host.session });
			flushSync();
			window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
			expect(collab.active).toBeTruthy();
			expect(host.listeners.size).toBe(1);
			reconcileSlidesInYDoc([slide('next', [])], host.doc, realFactories(), 'peer');
			expect(editor.slides[0].id).toBe('next');
			window.dispatchEvent(new Event('pagehide'));
			expect(collab.active).toBeFalsy();
			expect(host.listeners.size).toBe(0);
		});
		host.doc.destroy();
	});

	it('adopts the room, publishes changes and detaches without destroying host resources', async () => {
		const host = externalHost([slide('room', [shape('room-shape')])]);
		const destroy = vi.spyOn(host.doc, 'destroy');
		await inRoot(async () => {
			const config = { ...CONFIG, externalSession: host.session };
			const editor = makeEditor([slide('bootstrap', [shape('bootstrap-shape')])]);
			const factory = vi.fn(fakeSessionFactory(new Y.Doc()));
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => config,
				createSession: factory,
			});
			await collab.start(config);
			flushSync();
			expect(factory).not.toHaveBeenCalled();
			expect(host.read().map((item) => item.id)).toStrictEqual(['room']);
			expect(editor.slides[0].id).toBe('room');
			editor.setSlides([slide('room', [{ ...shape('room-shape'), x: 45 }])]);
			flushSync();
			expect(host.read()[0].elements[0].x).toBe(45);
			collab.stop();
			expect(host.listeners.size).toBe(0);
			expect(destroy).not.toHaveBeenCalled();
			expect(host.session.awareness.getLocalState()).toStrictEqual({
				user: 'host',
				comments: { thread: 'one' },
			});
		});
		host.doc.destroy();
	});

	it('waits indefinitely for host sync and permits synced offline edits', async () => {
		vi.useFakeTimers();
		const host = externalHost([], { status: 'connected', synced: false });
		try {
			await inRoot(async () => {
				const config = { ...CONFIG, externalSession: host.session };
				const editor = makeEditor([slide('new', [shape('one')])]);
				const collab = new CollaborationController({
					getSlides: () => editor.slides,
					applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
					getConfig: () => config,
				});
				await collab.start(config);
				vi.advanceTimersByTime(60_000);
				flushSync();
				expect(host.read()).toStrictEqual([]);
				expect(collab.livePatcher.isActive()).toBeFalsy();
				host.publish({ status: 'connected', synced: true });
				flushSync();
				expect(host.read()[0].id).toBe('new');
				host.publish({ status: 'disconnected', synced: true });
				editor.setSlides([slide('new', [{ ...shape('one'), x: 45 }])]);
				flushSync();
				expect(host.read()[0].elements[0].x).toBe(45);
				host.publish({ status: 'connecting', synced: false });
				editor.setSlides([slide('new', [{ ...shape('one'), x: 90 }])]);
				flushSync();
				expect(host.read()[0].elements[0].x).toBe(45);
				expect(collab.livePatcher.isActive()).toBeFalsy();
				host.publish({ status: 'connected', synced: true });
				expect(editor.slides[0].elements[0].x).toBe(45);
			});
		} finally {
			vi.useRealTimers();
			host.doc.destroy();
		}
	});

	it('keeps viewer sessions read-only for slide and live mutations', async () => {
		const host = externalHost([slide('room', [shape('one')])]);
		await inRoot(async () => {
			const config: CollaborationConfig = {
				...CONFIG,
				role: 'viewer',
				externalSession: host.session,
			};
			const editor = makeEditor([slide('bootstrap', [])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => config,
			});
			const starting = collab.start(config);
			expect(collab.readOnly).toBeTruthy();
			await starting;
			editor.setSlides([slide('room', [{ ...shape('one'), x: 50 }])]);
			collab.livePatcher.patchGeometry('room', 'one', { x: 150 });
			flushSync();
			expect(host.read()[0].elements[0].x).toBe(0);
			expect(collab.livePatcher.isActive()).toBeFalsy();
		});
		host.doc.destroy();
	});

	it('adopts deletion of the last slide before reopening writes after re-sync', async () => {
		const host = externalHost([slide('room', [])]);
		await inRoot(async () => {
			const config = { ...CONFIG, externalSession: host.session };
			const editor = makeEditor([slide('bootstrap', [])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => config,
			});
			await collab.start(config);
			host.publish({ status: 'connecting', synced: false });
			reconcileSlidesInYDoc([], host.doc, realFactories(), 'peer');
			flushSync();
			host.publish({ status: 'connected', synced: true });
			flushSync();
			expect(editor.slides).toStrictEqual([]);
			expect(host.read()).toStrictEqual([]);
			collab.stop();
		});
		host.doc.destroy();
	});

	it('does not seed a joined empty room, but user loads and later empty-document edits work', async () => {
		const host = externalHost();
		await inRoot(async () => {
			const config: CollaborationConfig = {
				...CONFIG,
				sessionIntent: 'join',
				externalSession: host.session,
			};
			const editor = makeEditor([slide('bootstrap', [])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => config,
			});
			await collab.start(config);
			flushSync();
			expect(host.read()).toStrictEqual([]);
			editor.setSlides([slide('opened', [])]);
			collab.adoptDocAfterLoad('user');
			flushSync();
			expect(host.read()[0].id).toBe('opened');
			reconcileSlidesInYDoc([], host.doc, realFactories(), 'peer');
			flushSync();
			expect(editor.slides).toStrictEqual([]);
			editor.setSlides([slide('later', [])]);
			flushSync();
			expect(host.read()[0].id).toBe('later');
		});
		host.doc.destroy();
	});

	it('does not let a superseded async attachment replace the current room', async () => {
		const first = externalHost([slide('first', [])]);
		const second = externalHost([slide('second', [])]);
		await inRoot(async () => {
			const editor = makeEditor([slide('bootstrap', [])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
				getConfig: () => undefined,
			});
			const a = collab.start({ ...CONFIG, externalSession: first.session });
			const b = collab.start({ ...CONFIG, externalSession: second.session });
			await Promise.all([a, b]);
			flushSync();
			expect(editor.slides[0].id).toBe('second');
			expect(first.listeners.size).toBe(0);
			expect(second.listeners.size).toBe(1);
			first.publish({ status: 'error', synced: false });
			expect(collab.status).toBe('connected');
		});
		first.doc.destroy();
		second.doc.destroy();
	});

	it('cancels an automatic attachment when its config is cleared before initialization', async () => {
		const host = externalHost();
		const session = await sessionModule.createExternalSession(host.session);
		let finish!: () => void;
		const createSession = vi.spyOn(sessionModule, 'createExternalSession').mockReturnValue(
			new Promise((resolve) => {
				finish = () => resolve(session);
			}),
		);
		try {
			await inRoot(async () => {
				let config = $state<CollaborationConfig | undefined>({
					...CONFIG,
					externalSession: host.session,
				});
				const editor = makeEditor([slide('bootstrap', [])]);
				const collab = new CollaborationController({
					getSlides: () => editor.slides,
					applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
					getConfig: () => config,
				});
				flushSync();
				expect(createSession).toHaveBeenCalledOnce();
				config = undefined;
				flushSync();
				finish();
				await Promise.resolve();
				await Promise.resolve();
				flushSync();
				expect(collab.active).toBeFalsy();
				expect(host.listeners.size).toBe(0);
			});
		} finally {
			createSession.mockRestore();
			host.doc.destroy();
		}
	});
});
