/**
 * Tests for the real-time collaboration infrastructure.
 *
 * These exercise the REAL shared sync path the hooks delegate to
 * (`reconcileSlidesInYDoc` / `readSlidesFromYDoc` / `observeYDocSlides` on the
 * `pptx:slides` schema) against in-memory `yjs` documents wired together via
 * `applyUpdate` (no WebSocket needed), plus the collaboration config / presence
 * type contracts.
 *
 * @module collaboration.test
 */
import type { PptxSlide, PptxElement } from 'pptx-viewer-core';
import type { YDocLike, YjsFactories } from 'pptx-viewer-shared';
import {
	LOCAL_SYNC_ORIGIN,
	observeYDocSlides,
	reconcileSlidesInYDoc,
	readSlidesFromYDoc,
	sanitizeColor,
	validateRoomId,
} from 'pptx-viewer-shared';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import * as Y from 'yjs';

import type {
	CollaborationConfig,
	ConnectionStatus,
	UserPresence,
	CollaborationContextValue,
} from './types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

const asDoc = (doc: Y.Doc): YDocLike => doc as unknown as YDocLike;

// Sentinel origins a real transport (y-websocket / y-webrtc) applies remote
// updates under. The originating peer's transaction origin is NOT sent over the
// wire, so a receiver never sees LOCAL_SYNC_ORIGIN on a remote update.
const REMOTE_ORIGIN_1 = 'remote-peer-1';
const REMOTE_ORIGIN_2 = 'remote-peer-2';

/** Two docs wired so each one's updates flow to the other (WebSocket relay). */
function createSyncedPair() {
	const doc1 = new Y.Doc();
	const doc2 = new Y.Doc();
	doc1.on('update', (update: Uint8Array) => {
		Y.applyUpdate(doc2, update, REMOTE_ORIGIN_2);
	});
	doc2.on('update', (update: Uint8Array) => {
		Y.applyUpdate(doc1, update, REMOTE_ORIGIN_1);
	});
	return { doc1, doc2 };
}

function slideWith(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements } as PptxSlide;
}

function textEl(id: string, extra: Record<string, unknown> = {}): PptxElement {
	return { type: 'text', id, x: 0, y: 0, ...extra } as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collaboration - Yjs CRDT sync (production schema)', () => {
	describe('document synchronisation', () => {
		it('syncs a reconciled slide list from doc1 to doc2', () => {
			const { doc1, doc2 } = createSyncedPair();
			reconcileSlidesInYDoc([slideWith('s1', []), slideWith('s2', [])], asDoc(doc1), factories);

			const onDoc2 = readSlidesFromYDoc(asDoc(doc2));
			expect(onDoc2.map((s) => s.id)).toStrictEqual(['s1', 's2']);
			doc1.destroy();
			doc2.destroy();
		});

		it('syncs element property edits between docs', () => {
			const { doc1, doc2 } = createSyncedPair();
			reconcileSlidesInYDoc(
				[slideWith('s1', [textEl('el-1', { text: 'a' })])],
				asDoc(doc1),
				factories,
			);

			reconcileSlidesInYDoc(
				[slideWith('s1', [textEl('el-1', { text: 'updated', x: 300 })])],
				asDoc(doc1),
				factories,
			);

			const onDoc2 = readSlidesFromYDoc(asDoc(doc2));
			expect(onDoc2[0].elements[0].text).toBe('updated');
			expect(onDoc2[0].elements[0].x).toBe(300);
			doc1.destroy();
			doc2.destroy();
		});

		it('syncs slide deletion', () => {
			const { doc1, doc2 } = createSyncedPair();
			reconcileSlidesInYDoc([slideWith('s1', []), slideWith('s2', [])], asDoc(doc1), factories);
			reconcileSlidesInYDoc([slideWith('s2', [])], asDoc(doc1), factories);

			expect(readSlidesFromYDoc(asDoc(doc2)).map((s) => s.id)).toStrictEqual(['s2']);
			doc1.destroy();
			doc2.destroy();
		});
	});

	describe('conflict resolution (concurrent edits)', () => {
		it('converges when two peers edit different fields of the same element', () => {
			// Seed both docs with a shared element (same Yjs item), then edit
			// disjoint fields concurrently and merge.
			const doc1 = new Y.Doc();
			reconcileSlidesInYDoc(
				[slideWith('s1', [textEl('el', { x: 0, y: 0 })])],
				asDoc(doc1),
				factories,
			);

			const doc2 = new Y.Doc();
			Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

			reconcileSlidesInYDoc(
				[slideWith('s1', [textEl('el', { x: 100, y: 0 })])],
				asDoc(doc1),
				factories,
			);
			reconcileSlidesInYDoc(
				[slideWith('s1', [textEl('el', { x: 0, y: 200 })])],
				asDoc(doc2),
				factories,
			);

			Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
			Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

			const el1 = readSlidesFromYDoc(asDoc(doc1))[0].elements[0];
			const el2 = readSlidesFromYDoc(asDoc(doc2))[0].elements[0];
			expect(el1.x).toBe(el2.x);
			expect(el1.y).toBe(el2.y);
			expect(el1.x).toBe(100);
			expect(el1.y).toBe(200);
			doc1.destroy();
			doc2.destroy();
		});
	});

	describe('transaction origin', () => {
		it('tags local reconcile writes with LOCAL_SYNC_ORIGIN so echoes can be skipped', () => {
			const doc = new Y.Doc();
			const origins: unknown[] = [];
			const unobserve = observeYDocSlides(asDoc(doc), (_e, tx) => origins.push(tx?.origin));

			reconcileSlidesInYDoc([slideWith('s1', [])], asDoc(doc), factories);

			expect(origins).toContain(LOCAL_SYNC_ORIGIN);
			unobserve();
			doc.destroy();
		});

		it('delivers remote updates with a non-local origin', () => {
			const { doc1, doc2 } = createSyncedPair();
			const remoteOrigins: unknown[] = [];
			const unobserve = observeYDocSlides(asDoc(doc2), (_e, tx) => remoteOrigins.push(tx?.origin));

			reconcileSlidesInYDoc([slideWith('s1', [])], asDoc(doc1), factories);

			expect(remoteOrigins.length).toBeGreaterThan(0);
			expect(remoteOrigins).not.toContain(LOCAL_SYNC_ORIGIN);
			unobserve();
			doc1.destroy();
			doc2.destroy();
		});
	});

	describe('late joiner full-state sync', () => {
		it('lets a fresh doc read the full slide state via encodeStateAsUpdate', () => {
			const host = new Y.Doc();
			reconcileSlidesInYDoc(
				[slideWith('s1', [textEl('el-1', { text: 'Title' })]), slideWith('s2', [])],
				asDoc(host),
				factories,
			);

			const joiner = new Y.Doc();
			Y.applyUpdate(joiner, Y.encodeStateAsUpdate(host));

			const slides = readSlidesFromYDoc(asDoc(joiner));
			expect(slides.map((s) => s.id)).toStrictEqual(['s1', 's2']);
			expect(slides[0].elements[0].text).toBe('Title');
			host.destroy();
			joiner.destroy();
		});
	});

	describe('per-user undo/redo isolation', () => {
		it('undoes only local changes on the slides array', () => {
			const { doc1, doc2 } = createSyncedPair();
			const arr1 = doc1.getArray('pptx:slides');
			const um1 = new Y.UndoManager(arr1, { trackedOrigins: new Set([doc1.clientID]) });

			doc1.transact(() => {
				const m = new Y.Map();
				m.set('id', 'user1');
				arr1.push([m]);
			}, doc1.clientID);
			doc2.transact(() => {
				const m = new Y.Map();
				m.set('id', 'user2');
				doc2.getArray('pptx:slides').push([m]);
			}, doc2.clientID);

			expect(
				readSlidesFromYDoc(asDoc(doc1))
					.map((s) => s.id)
					.sort(),
			).toStrictEqual(['user1', 'user2']);

			um1.undo();
			const idsAfter = readSlidesFromYDoc(asDoc(doc1)).map((s) => s.id);
			expect(idsAfter).toContain('user2');
			expect(idsAfter).not.toContain('user1');

			um1.destroy();
			doc1.destroy();
			doc2.destroy();
		});
	});
});

// ---------------------------------------------------------------------------
// CollaborationConfig (unified shared shape)
// ---------------------------------------------------------------------------

describe('collaborationConfig validation', () => {
	it('validates room ID from config', () => {
		const config: CollaborationConfig = {
			roomId: 'test-room-123',
			serverUrl: 'wss://collab.example.com',
			userName: 'Alice',
		};
		expect(validateRoomId(config.roomId)).toBe('test-room-123');
	});

	it('rejects invalid room ID in config', () => {
		const config: CollaborationConfig = {
			roomId: 'invalid room@id',
			serverUrl: 'wss://collab.example.com',
			userName: 'Alice',
		};
		expect(() => validateRoomId(config.roomId)).toThrow('Invalid collaboration room ID');
	});

	it('sanitises userColor from config', () => {
		const config: CollaborationConfig = {
			roomId: 'room-1',
			serverUrl: 'wss://collab.example.com',
			userName: 'Alice',
			userColor: '#ff0000',
		};
		expect(sanitizeColor(config.userColor)).toBe('#ff0000');
	});

	it('accepts the peer-to-peer transport fields', () => {
		const config: CollaborationConfig = {
			roomId: 'p2p-room',
			serverUrl: '',
			transport: 'webrtc',
			signaling: ['wss://signal.example.com'],
			userName: 'Alice',
		};
		expect(config.transport).toBe('webrtc');
		expect(config.serverUrl).toBe('');
		expect(config.signaling).toStrictEqual(['wss://signal.example.com']);
	});

	it('accepts the elected-writer write-back fields', () => {
		const onWriteBack = vi.fn<(bytes: Uint8Array) => void>();
		const config: CollaborationConfig = {
			roomId: 'room-1',
			serverUrl: 'wss://collab.example.com',
			userName: 'Owner',
			role: 'owner',
			onWriteBack,
			writeBackDebounceMs: 2000,
		};
		config.onWriteBack?.(new Uint8Array([1, 2, 3]));
		expect(onWriteBack).toHaveBeenCalledOnce();
		expect(config.writeBackDebounceMs).toBe(2000);
	});
});

// ---------------------------------------------------------------------------
// ConnectionStatus + UserPresence + context shape (real types)
// ---------------------------------------------------------------------------

describe('connectionStatus types', () => {
	const ALL_STATUSES: ConnectionStatus[] = ['disconnected', 'connecting', 'connected', 'error'];

	it('covers all four connection states', () => {
		expect(ALL_STATUSES).toHaveLength(4);
	});

	it('can drive a status-message map', () => {
		const statusMessages: Record<ConnectionStatus, string> = {
			disconnected: 'Not connected',
			connecting: 'Connecting...',
			connected: 'Connected',
			error: 'Connection error',
		};
		ALL_STATUSES.forEach((status) => {
			expectTypeOf(statusMessages[status]).toBeString();
		});
	});
});

describe('userPresence interface', () => {
	it('has the expected required shape', () => {
		const presence: UserPresence = {
			clientId: 42,
			userName: 'TestUser',
			userColor: '#ff0000',
			activeSlideIndex: 0,
			cursorX: 100,
			cursorY: 200,
			lastUpdated: new Date().toISOString(),
		};
		expect(presence.clientId).toBe(42);
		expectTypeOf(presence.lastUpdated).toBeString();
	});
});

describe('collaborationContextValue shape', () => {
	it('connectedCount includes local user when connected', () => {
		const remoteUsers: UserPresence[] = [
			{
				clientId: 2,
				userName: 'Remote1',
				userColor: '#ff0000',
				activeSlideIndex: 0,
				cursorX: 0,
				cursorY: 0,
				lastUpdated: new Date().toISOString(),
			},
		];
		const status: ConnectionStatus = 'connected';
		const value: CollaborationContextValue = {
			status,
			remoteUsers,
			broadcastPresence: vi.fn<() => void>(),
			connectedCount: remoteUsers.length + 1,
			config: { roomId: 'r', serverUrl: 'wss://localhost', userName: 'U' },
			doc: null,
			retry: vi.fn<() => void>(),
		};
		expect(value.connectedCount).toBe(2);
	});
});
