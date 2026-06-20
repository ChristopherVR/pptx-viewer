// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

import { useCollaboration } from './useCollaboration';

// ── Mock Yjs + y-websocket with the minimum surface the composable uses ──────
const { state } = vi.hoisted(() => ({
	state: {
		slidesArray: null as {
			length: number;
			push: (items: unknown[]) => void;
			delete: (i: number, n: number) => void;
			get: (i: number) => unknown;
			toArray: () => unknown[];
			observeDeep: (cb: () => void) => void;
			unobserveDeep: (cb: () => void) => void;
		} | null,
		slidesObserverCb: null as null | (() => void),
		awarenessStates: new Map<number, Record<string, unknown>>(),
		awarenessChange: null as null | (() => void),
		statusCb: null as null | ((p: { status?: string }) => void),
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
			transact(fn: () => void) {
				fn();
			}
			destroy() {}
		},
		Map: YMap,
		Array: YArray,
		Text: YText,
	};
});

vi.mock(import('y-websocket'), () => ({
	WebsocketProvider: class {
		awareness = {
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
		on(_e: string, cb: (p: { status?: string }) => void) {
			state.statusCb = cb;
		}
		disconnect() {}
		destroy() {}
	},
}));

function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}
const config = { roomId: 'r', serverUrl: 'wss://x', userName: 'Ada' };

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

		// A remote peer appears with a cursor.
		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#ff0000' },
			cursor: { x: 10, y: 20 },
		});
		state.awarenessChange?.();
		expect(collab.cursors.value).toHaveLength(1);
		expect(collab.cursors.value[0]).toMatchObject({ userName: 'Bob', x: 10, y: 20 });

		scope.stop();
	});

	it('publishes selection + active slide and surfaces remote presence', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		// Local publishers write into the self awareness state.
		collab.setSelection(['el-1', 'el-2']);
		collab.setActiveSlide(3);
		expect(state.awarenessStates.get(1)).toMatchObject({
			selection: ['el-1', 'el-2'],
			activeSlide: 3,
		});

		// A remote peer publishes selection + active slide (no cursor yet).
		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#00ff00' },
			selection: ['el-9'],
			activeSlide: 2,
		});
		state.awarenessChange?.();

		expect(collab.remotePresences.value).toHaveLength(1);
		expect(collab.remotePresences.value[0]).toMatchObject({
			clientId: 2,
			userName: 'Bob',
			selectionIds: ['el-9'],
			activeSlide: 2,
			cursor: undefined,
		});
		// Peers without a cursor are absent from the cursor projection.
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

		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#00ff00' },
			activeSlide: 4,
		});
		state.awarenessChange?.();

		// Not following yet -> null.
		expect(collab.followedSlideIndex.value).toBeNull();

		collab.followUser(2);
		expect(collab.followedClientId.value).toBe(2);
		expect(collab.followedSlideIndex.value).toBe(4);

		// The followed peer navigates; followedSlideIndex tracks it.
		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#00ff00' },
			activeSlide: 7,
		});
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

	it('broadcasts local slide changes via pptx:slides Y.Array', async () => {
		state.slidesArray = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		// Trigger local slide change.
		slides.value = [slide('1'), slide('2')];
		await Promise.resolve();
		// writeSlidesToYDoc should have pushed slide maps into the Y.Array.
		expect(state.slidesArray?.length).toBeGreaterThan(0);

		collab.stop();
		expect(collab.active.value).toBeFalsy();
		scope.stop();
	});

	it('applies remote slides when pptx:slides Y.Array changes', async () => {
		state.slidesArray = null;
		state.slidesObserverCb = null;
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		// Simulate a remote peer writing a slide into the Y.Array.
		// We push a Y.Map-like object for slide '9' with minimal fields.
		const remoteSlideMap = {
			get: (k: string) => {
				if (k === 'id') {
					return '9';
				}
				if (k === 'elements') {
					return {
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
				}
				return undefined;
			},
			set: () => {},
			forEach: (_cb: (v: unknown, k: string) => void) => {
				_cb('9', 'id');
				_cb(
					{
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
					},
					'elements',
				);
			},
		};
		state.slidesArray?.push([remoteSlideMap]);
		state.slidesObserverCb?.();

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

		state.awarenessStates.set(2, { user: { name: 'Bob', color: '#ff0000' } });
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
		state.awarenessStates.set(2, {
			user: { name: 'Host', color: '#00ff00', role: 'owner' },
			activeSlide: 5,
		});
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

		state.awarenessStates.set(2, {
			user: { name: 'Mallory', color: 'not-a-color' },
			cursor: { x: 99999, y: -99999 },
		});
		state.awarenessChange?.();

		const cursor = collab.cursors.value[0];
		expect(cursor.x).toBe(120); // clamped to width + 20px margin
		expect(cursor.y).toBe(-20); // clamped to 0 - 20px margin
		expect(cursor.color).toBe('#4c8bf5'); // invalid colour -> safe fallback
		scope.stop();
	});
});
