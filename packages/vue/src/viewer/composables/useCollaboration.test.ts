// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useCollaboration } from './useCollaboration';

// ── Mock Yjs + y-websocket + y-webrtc with the minimum surface used ──────────
const { state } = vi.hoisted(() => ({
	state: {
		slidesArray: null as {
			length: number;
			push: (items: unknown[]) => void;
			delete: (i: number, n: number) => void;
			insert: (i: number, items: unknown[]) => void;
			get: (i: number) => unknown;
			toArray: () => unknown[];
			observeDeep: (cb: () => void) => void;
			unobserveDeep: (cb: () => void) => void;
		} | null,
		slidesObserverCb: null as null | ((events?: unknown, tx?: { origin?: unknown }) => void),
		awarenessStates: new Map<number, Record<string, unknown>>(),
		awarenessChange: null as null | (() => void),
		statusCb: null as null | ((p: { status?: string }) => void),
		syncCb: null as null | ((isSynced: boolean) => void),
		webrtcCreated: 0,
		lastTransactionOrigin: undefined as unknown,
	},
}));

vi.mock(import('yjs'), () => {
	class YMap {
		private _data = new Map<string, unknown>();
		set(k: string, v: unknown) {
			this._data.set(k, v);
		}
		get(k: string) {
			return this._data.get(k);
		}
		delete(k: string) {
			this._data.delete(k);
		}
		forEach(cb: (v: unknown, k: string) => void) {
			this._data.forEach((v, k) => cb(v, k));
		}
	}
	class YArray {
		private _items: unknown[] = [];
		get length() {
			return this._items.length;
		}
		push(items: unknown[]) {
			this._items.push(...items);
		}
		delete(index: number, len = 1) {
			this._items.splice(index, len);
		}
		insert(index: number, items: unknown[]) {
			this._items.splice(index, 0, ...items);
		}
		get(i: number) {
			return this._items[i];
		}
		toArray() {
			return [...this._items];
		}
		observe(_cb: () => void) {}
		unobserve(_cb: () => void) {}
		observeDeep(cb: () => void) {
			state.slidesObserverCb = cb;
		}
		unobserveDeep(cb: () => void) {
			if (state.slidesObserverCb === cb) {
				state.slidesObserverCb = null;
			}
		}
	}
	class YText {
		private _delta: { insert: string; attributes?: Record<string, string> }[] = [];
		insert(_index: number, text: string, attrs?: Record<string, string>) {
			this._delta.push({ insert: text, ...(attrs ? { attributes: attrs } : {}) });
		}
		toDelta() {
			return this._delta;
		}
		toString() {
			return this._delta.map((d) => d.insert).join('');
		}
	}
	return {
		Doc: class {
			private _arrays = new Map<string, YArray>();
			private _maps = new Map<string, YMap>();
			getMap(name: string): YMap {
				if (!this._maps.has(name)) {
					this._maps.set(name, new YMap());
				}
				return this._maps.get(name)!;
			}
			getArray(name: string): YArray {
				if (!this._arrays.has(name)) {
					const arr = new YArray();
					if (name === 'pptx:slides') {
						state.slidesArray = arr;
					}
					this._arrays.set(name, arr);
				}
				return this._arrays.get(name)!;
			}
			transact(fn: () => void, origin?: unknown) {
				state.lastTransactionOrigin = origin;
				fn();
			}
			destroy() {}
		},
		Map: YMap,
		Array: YArray,
		Text: YText,
	};
});

const awarenessSurface = {
	clientID: 1,
	setLocalStateField: (field: string, value: unknown) => {
		const self = state.awarenessStates.get(1) ?? {};
		self[field] = value;
		state.awarenessStates.set(1, self);
	},
	getStates: () => state.awarenessStates,
	on: (_e: string, cb: () => void) => {
		state.awarenessChange = cb;
	},
	off: () => {},
};

vi.mock(import('y-websocket'), () => ({
	WebsocketProvider: class {
		awareness = awarenessSurface;
		wsconnected = false;
		synced = false;
		on(e: string, cb: (p: never) => void) {
			if (e === 'status') {
				state.statusCb = cb as (p: { status?: string }) => void;
			} else if (e === 'sync' || e === 'synced') {
				state.syncCb = cb as (isSynced: boolean) => void;
			}
		}
		disconnect() {}
		destroy() {}
	},
}));

vi.mock(import('y-webrtc'), () => ({
	WebrtcProvider: class {
		awareness = awarenessSurface;
		constructor() {
			state.webrtcCreated += 1;
		}
		on(_e: string, _cb: (p: { connected?: boolean }) => void) {}
		disconnect() {}
		destroy() {}
	},
}));

function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}
const config = { roomId: 'r', serverUrl: 'wss://x', userName: 'Ada' };

/**
 * Publish a remote peer's presence in the shared cross-framework wire format:
 * a single nested `presence` awareness field (not the old flat top-level
 * fields), so React / Vue / Angular peers all interoperate.
 */
function remotePresence(clientId: number, over: Record<string, unknown>): void {
	state.awarenessStates.set(clientId, {
		presence: {
			userName: 'Peer',
			userColor: '#00ff00',
			activeSlideIndex: 0,
			cursorX: 0,
			cursorY: 0,
			lastUpdated: new Date().toISOString(),
			...over,
		},
	});
}

describe('useCollaboration', () => {
	it('connects, reflects status, and maps remote cursors', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;

		await collab.start(config);
		expect(collab.active.value).toBeTruthy();

		state.statusCb?.({ status: 'connected' });
		expect(collab.connected.value).toBeTruthy();

		// A remote peer appears with a cursor on the same slide (index 0).
		remotePresence(2, { userName: 'Bob', userColor: '#ff0000', cursorX: 10, cursorY: 20 });
		state.awarenessChange?.();
		expect(collab.cursors.value).toHaveLength(1);
		expect(collab.cursors.value[0]).toMatchObject({ userName: 'Bob', x: 10, y: 20 });

		scope.stop();
	});

	it('publishes a single nested presence field in the shared wire format', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		// Local publishers accumulate into the nested `presence` field. Selection
		// and active-slide land within one throttle window; wait it out.
		collab.setSelection(['el-1', 'el-2']);
		collab.setActiveSlide(3);
		await new Promise((r) => {
			setTimeout(r, 70);
		});

		const self = state.awarenessStates.get(1);
		expect(self).toBeDefined();
		// No flat top-level fields (those are invisible to React/Angular peers).
		expect(self).not.toHaveProperty('selection');
		expect(self).not.toHaveProperty('activeSlide');
		expect(self).not.toHaveProperty('cursor');
		expect(self?.presence).toMatchObject({
			userName: 'Ada',
			selectedElementId: 'el-1',
			activeSlideIndex: 3,
		});

		scope.stop();
	});

	it('surfaces remote presence + selection from the nested schema', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		// A remote peer publishes selection + active slide (no cursor movement).
		remotePresence(2, { userName: 'Bob', selectedElementId: 'el-9', activeSlideIndex: 2 });
		state.awarenessChange?.();

		expect(collab.remotePresences.value).toHaveLength(1);
		expect(collab.remotePresences.value[0]).toMatchObject({
			clientId: 2,
			userName: 'Bob',
			selectionIds: ['el-9'],
			activeSlide: 2,
		});
		// The peer is on slide 2 while we view slide 0, so its cursor is hidden.
		expect(collab.cursors.value).toHaveLength(0);

		scope.stop();
	});

	it('drives follow-mode from a followed peer active slide', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		remotePresence(2, { userName: 'Bob', activeSlideIndex: 4 });
		state.awarenessChange?.();

		// Not following yet -> null.
		expect(collab.followedSlideIndex.value).toBeNull();

		collab.followUser(2);
		expect(collab.followedClientId.value).toBe(2);
		expect(collab.followedSlideIndex.value).toBe(4);

		// The followed peer navigates; followedSlideIndex tracks it.
		remotePresence(2, { userName: 'Bob', activeSlideIndex: 7 });
		state.awarenessChange?.();
		expect(collab.followedSlideIndex.value).toBe(7);

		// The followed peer disconnects -> follow target is dropped.
		state.awarenessStates.delete(2);
		state.awarenessChange?.();
		expect(collab.followedClientId.value).toBeNull();
		expect(collab.followedSlideIndex.value).toBeNull();

		// Explicitly stop following.
		collab.followUser(null);
		expect(collab.followedClientId.value).toBeNull();

		scope.stop();
	});

	it('reconciles local slide changes into pptx:slides tagged with the local origin', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		state.lastTransactionOrigin = undefined;
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		// Local edits are deferred until the provider confirms its initial sync
		// (first-write gate), so nothing lands in the Y.Array yet.
		slides.value = [slide('1'), slide('2')];
		await Promise.resolve();
		await Promise.resolve();
		expect(state.slidesArray?.length ?? 0).toBe(0);

		// The provider sync confirmation opens the gate and flushes the deck.
		state.syncCb?.(true);
		// reconcileSlidesInYDoc should have seeded the Y.Array in a transaction
		// tagged with the local-sync origin so peers can skip the echo.
		expect(state.slidesArray?.length).toBeGreaterThan(0);
		expect(state.lastTransactionOrigin).toBe('pptx-viewer:local-sync');

		collab.stop();
		expect(collab.active.value).toBeFalsy();
		scope.stop();
	});

	it('ignores slide observer events from its own local-sync transaction', async () => {
		state.slidesArray = null;
		state.slidesObserverCb = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		state.slidesArray?.push([remoteSlideMap('9')]);
		// An event carrying our own origin is skipped (primary echo guard).
		state.slidesObserverCb?.(undefined, { origin: 'pptx-viewer:local-sync' });
		expect(onRemoteSlides).not.toHaveBeenCalled();

		// A genuine remote event (no local origin) is applied.
		state.slidesObserverCb?.(undefined, { origin: 'remote-peer' });
		expect(onRemoteSlides).toHaveBeenCalledWith([expect.objectContaining({ id: '9' })]);

		scope.stop();
	});

	it('rejects a malformed room id without connecting', async () => {
		const slides = ref<PptxSlide[]>([slide('1')]);
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides: vi.fn() }))!;

		await collab.start({ roomId: 'bad room id', serverUrl: 'wss://x', userName: 'Ada' });
		expect(collab.status.value).toBe('error');
		expect(collab.active.value).toBeFalsy();
		scope.stop();
	});

	it('reflects connection status and counts participants', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides: vi.fn() }))!;

		await collab.start(config);
		expect(collab.status.value).toBe('connecting');
		expect(collab.connectedCount.value).toBe(1); // self only

		state.statusCb?.({ status: 'connected' });
		expect(collab.status.value).toBe('connected');

		remotePresence(2, { userName: 'Bob' });
		state.awarenessChange?.();
		expect(collab.connectedCount.value).toBe(2); // self + Bob
		scope.stop();
	});

	it('exposes the broadcaster active slide to viewers', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides: vi.fn() }))!;
		await collab.start({ ...config, role: 'viewer' });

		expect(collab.broadcasterSlideIndex.value).toBeNull();

		// A peer with the owner (broadcaster) role publishes their active slide.
		remotePresence(2, { userName: 'Host', role: 'owner', activeSlideIndex: 5 });
		state.awarenessChange?.();
		expect(collab.broadcasterSlideIndex.value).toBe(5);
		scope.stop();
	});

	it('clamps and sanitises incoming cursor + colour', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const scope = effectScope();
		const collab = scope.run(() =>
			useCollaboration({ slides, onRemoteSlides: vi.fn(), canvasWidth: 100, canvasHeight: 100 }),
		)!;
		await collab.start(config);

		remotePresence(2, {
			userName: 'Mallory',
			userColor: 'not-a-color',
			cursorX: 99999,
			cursorY: -99999,
		});
		state.awarenessChange?.();

		const cursor = collab.cursors.value[0];
		expect(cursor.x).toBe(120); // clamped to width + 20px margin
		expect(cursor.y).toBe(-20); // clamped to 0 - 20px margin
		expect(cursor.color).toBe('#4c8bf5'); // invalid colour -> safe fallback
		scope.stop();
	});

	it('re-adopts the doc slides when a local load finishes mid-session', async () => {
		state.slidesArray = null;
		state.slidesObserverCb = null;
		state.awarenessStates.clear();
		state.lastTransactionOrigin = undefined;
		const slides = ref<PptxSlide[]>([]);
		const loadVersion = ref(0);
		// Mirror the wiring: remote slides replace local state.
		const onRemoteSlides = vi.fn((remote: PptxSlide[]) => {
			slides.value = remote;
		});
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides, loadVersion }))!;
		await collab.start(config);
		state.statusCb?.({ status: 'connected' });
		state.syncCb?.(true); // open the first-write gate

		// The room's real slides arrive over the doc sync before the local
		// bootstrap deck finishes parsing.
		state.slidesArray?.push([remoteSlideMap('9')]);
		state.slidesObserverCb?.(undefined, { origin: 'remote-peer' });
		expect(slides.value[0]?.id).toBe('9');

		// The late bootstrap load clobbers local state and bumps the load
		// version; the adoption watcher must re-apply the doc's slides before
		// the slides watch could reconcile the bootstrap deck into the doc.
		state.lastTransactionOrigin = undefined;
		slides.value = [slide('bootstrap')];
		loadVersion.value += 1;
		await nextTick();

		expect(slides.value[0]?.id).toBe('9');
		// The bootstrap deck never reached the doc (no local-sync transaction).
		expect(state.lastTransactionOrigin).toBeUndefined();
		expect(state.slidesArray?.length).toBe(1);

		collab.stop();
		scope.stop();
	});

	it('uses the serverless webrtc transport when requested', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		state.webrtcCreated = 0;
		const slides = ref<PptxSlide[]>([slide('1')]);
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides: vi.fn() }))!;

		// A blank server URL selects webrtc; the provider reports connected at once.
		await collab.start({ roomId: 'p2p-room', serverUrl: '', userName: 'Ada' });
		expect(state.webrtcCreated).toBe(1);
		expect(collab.status.value).toBe('connected');
		expect(collab.active.value).toBeTruthy();

		collab.stop();
		scope.stop();
	});
});

/** A minimal Y.Map-like slide entry the observer can read back. */
function remoteSlideMap(id: string): {
	get: (k: string) => unknown;
	set: () => void;
	delete: () => void;
	forEach: (cb: (v: unknown, k: string) => void) => void;
} {
	const emptyElements = {
		length: 0,
		get: () => undefined,
		push: () => {},
		delete: () => {},
		insert: () => {},
		toArray: () => [],
		observe: () => {},
		unobserve: () => {},
		observeDeep: () => {},
		unobserveDeep: () => {},
	};
	return {
		get: (k: string) => (k === 'id' ? id : k === 'elements' ? emptyElements : undefined),
		set: () => {},
		delete: () => {},
		forEach: (cb) => {
			cb(id, 'id');
			cb(emptyElements, 'elements');
		},
	};
}
