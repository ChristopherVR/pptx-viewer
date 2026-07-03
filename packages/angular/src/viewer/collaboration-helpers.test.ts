/**
 * collaboration-helpers.test.ts: Unit tests for the pure collaboration
 * helpers and (with mocked yjs/y-websocket) the `CollaborationService` wiring.
 *
 * vitest + happy-dom, no TestBed. The service is built inside a minimal
 * injection context via `runInInjectionContext` (it calls `inject(DestroyRef)`
 * in its constructor) with a capturing `DestroyRef` stub. yjs + y-websocket are
 * replaced with the minimum surface the service uses: no real network or
 * websocket is opened.
 *
 * Mirrors the Vue `useCollaboration.test.ts` + `CollaborationCursors.test.ts`
 * and the React `sanitize.test.ts` / `usePresenceTracking.test.ts` coverage.
 */

import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { CONNECTION_TIMEOUT_MS } from '../internal/shared';
import {
	CURSOR_PALETTE,
	DEFAULT_CURSOR_COLOR,
	assignUserColor,
	clampCursorPosition,
	derivePresenceList,
	formatCursorLabel,
	isValidRoomId,
	mapAwarenessCursors,
	presenceToCursors,
	sanitizeAvatarUrl,
	sanitizeColor,
	sanitizePresence,
	sanitizeSlideIndex,
	sanitizeUserName,
	validateRoomId,
} from './collaboration-helpers';
import type { RemotePresence } from './collaboration-helpers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-01-01T00:00:00.000Z');

function presence(overrides: Partial<RemotePresence> & { clientId: number }): RemotePresence {
	return {
		userName: 'Ada',
		userColor: '#123456',
		activeSlideIndex: 0,
		cursorX: 10,
		cursorY: 20,
		lastUpdated: new Date(NOW).toISOString(),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Room id validation
// ---------------------------------------------------------------------------

describe('room id validation', () => {
	it('accepts alphanumeric, hyphen, underscore ids 1-128 chars', () => {
		expect(isValidRoomId('room-1_A')).toBeTruthy();
		expect(isValidRoomId('a'.repeat(128))).toBeTruthy();
	});

	it('rejects empty, too-long, or unsafe ids', () => {
		expect(isValidRoomId('')).toBeFalsy();
		expect(isValidRoomId('a'.repeat(129))).toBeFalsy();
		expect(isValidRoomId('bad room')).toBeFalsy();
		expect(isValidRoomId('<script>')).toBeFalsy();
	});

	it('validateRoomId returns the id or throws', () => {
		expect(validateRoomId('ok-1')).toBe('ok-1');
		expect(() => validateRoomId('no good')).toThrow(/Invalid collaboration room ID/u);
	});
});

// ---------------------------------------------------------------------------
// Sanitisers
// ---------------------------------------------------------------------------

describe('sanitisers', () => {
	it('strips HTML, trims, and clamps user names', () => {
		expect(sanitizeUserName('  Ada  ')).toBe('Ada');
		expect(sanitizeUserName('<b>Bob</b>')).toBe('Bob');
		expect(sanitizeUserName('x'.repeat(200))).toHaveLength(64);
		expect(sanitizeUserName(42)).toBe('Anonymous');
		expect(sanitizeUserName('   ')).toBe('Anonymous');
	});

	it('validates hex colours with a fallback', () => {
		expect(sanitizeColor('#abcdef')).toBe('#abcdef');
		expect(sanitizeColor('red')).toBe(DEFAULT_CURSOR_COLOR);
		expect(sanitizeColor('#fff')).toBe(DEFAULT_CURSOR_COLOR);
		expect(sanitizeColor(null, '#000000')).toBe('#000000');
	});

	it('allows only http(s)/data avatar urls', () => {
		expect(sanitizeAvatarUrl('https://x/a.png')).toBe('https://x/a.png');
		expect(sanitizeAvatarUrl('http://x/a.png')).toBe('http://x/a.png');
		expect(sanitizeAvatarUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is rejected.
		expect(sanitizeAvatarUrl('javascript:alert(1)')).toBeUndefined();
		expect(sanitizeAvatarUrl('not a url')).toBeUndefined();
		expect(sanitizeAvatarUrl(123)).toBeUndefined();
	});

	it('coerces slide index to a non-negative integer', () => {
		expect(sanitizeSlideIndex(3.7)).toBe(3);
		expect(sanitizeSlideIndex(-4)).toBe(0);
		expect(sanitizeSlideIndex(Number.NaN)).toBe(0);
		expect(sanitizeSlideIndex('5')).toBe(0);
	});

	it('clamps cursor coordinates within a margin of the bounds', () => {
		expect(clampCursorPosition(50, 0, 100)).toBe(50);
		expect(clampCursorPosition(-100, 0, 100)).toBe(-20);
		expect(clampCursorPosition(500, 0, 100)).toBe(120);
		expect(clampCursorPosition('x', 0, 100)).toBe(0);
		expect(clampCursorPosition(Number.POSITIVE_INFINITY, 0, 100)).toBe(0);
	});
});

describe('sanitizePresence', () => {
	it('returns null without a numeric client id', () => {
		expect(sanitizePresence({}, 100, 100)).toBeNull();
		expect(sanitizePresence({ clientId: 'x' }, 100, 100)).toBeNull();
	});

	it('produces a fully sanitised record', () => {
		const out = sanitizePresence(
			{
				clientId: 7,
				userName: '<i>Eve</i>',
				userColor: 'nope',
				userAvatar: 'https://x/a.png',
				activeSlideIndex: 2.9,
				cursorX: 9999,
				cursorY: -50,
				selectedElementId: 'el-1',
				role: 'owner',
				lastUpdated: '2026-01-01T00:00:00.000Z',
			},
			100,
			100,
		);
		expect(out).toStrictEqual({
			clientId: 7,
			userName: 'Eve',
			userColor: DEFAULT_CURSOR_COLOR,
			userAvatar: 'https://x/a.png',
			activeSlideIndex: 2,
			cursorX: 120,
			cursorY: -20,
			selectedElementId: 'el-1',
			role: 'owner',
			lastUpdated: '2026-01-01T00:00:00.000Z',
		});
	});

	it('drops an invalid role', () => {
		const out = sanitizePresence({ clientId: 1, role: 'admin' }, 10, 10);
		expect(out?.role).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Colour assignment + label formatting
// ---------------------------------------------------------------------------

describe('colour assignment', () => {
	it('is deterministic per seed and within the palette', () => {
		const a = assignUserColor(42);
		expect(a).toBe(assignUserColor(42));
		expect(CURSOR_PALETTE).toContain(a);
		expect(CURSOR_PALETTE).toContain(assignUserColor('alice'));
	});

	it('falls back to the default colour with an empty palette', () => {
		expect(assignUserColor(1, [])).toBe(DEFAULT_CURSOR_COLOR);
	});
});

describe('formatCursorLabel', () => {
	it('returns short names unchanged', () => {
		expect(formatCursorLabel('Ada')).toBe('Ada');
	});

	it('truncates long names to maxChars total with an ellipsis', () => {
		const out = formatCursorLabel('A really really long collaborator name');
		expect(out.endsWith('…')).toBeTruthy();
		expect([...out]).toHaveLength(20);
	});
});

// ---------------------------------------------------------------------------
// Presence derivation + cursor mapping
// ---------------------------------------------------------------------------

describe('derivePresenceList', () => {
	function states(): Map<number, Record<string, unknown>> {
		return new Map<number, Record<string, unknown>>([
			[1, { presence: { userName: 'Self', lastUpdated: new Date(NOW).toISOString() } }],
			[
				2,
				{
					presence: {
						userName: 'Bob',
						userColor: '#ff0000',
						cursorX: 10,
						cursorY: 20,
						lastUpdated: new Date(NOW).toISOString(),
					},
				},
			],
		]);
	}

	it('excludes the local client and includes remote peers', () => {
		const list = derivePresenceList(states(), 1, 800, 600, NOW);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ clientId: 2, userName: 'Bob', cursorX: 10, cursorY: 20 });
	});

	it('drops stale entries', () => {
		const list = derivePresenceList(states(), 1, 800, 600, NOW + 60_000);
		expect(list).toHaveLength(0);
	});

	it('ignores entries without a presence object', () => {
		const map = new Map<number, Record<string, unknown>>([[2, { user: { name: 'x' } }]]);
		expect(derivePresenceList(map, 1, 800, 600, NOW)).toHaveLength(0);
	});
});

describe('presenceToCursors', () => {
	it('maps presence into the cursor view-model', () => {
		const cursors = presenceToCursors([
			presence({ clientId: 2, userName: 'Bob', userColor: '#ff0000', cursorX: 5, cursorY: 6 }),
		]);
		expect(cursors).toStrictEqual([
			{ clientId: 2, userName: 'Bob', color: '#ff0000', x: 5, y: 6, selectionIds: undefined },
		]);
	});

	it('carries the selected element id into selectionIds', () => {
		const cursors = presenceToCursors([presence({ clientId: 3, selectedElementId: 'el-9' })]);
		expect(cursors[0]?.selectionIds).toStrictEqual(['el-9']);
	});

	it('filters to a single slide when requested', () => {
		const list = [
			presence({ clientId: 2, activeSlideIndex: 0 }),
			presence({ clientId: 3, activeSlideIndex: 1 }),
		];
		expect(presenceToCursors(list, 1)).toHaveLength(1);
		expect(presenceToCursors(list, 1)[0]?.clientId).toBe(3);
		expect(presenceToCursors(list)).toHaveLength(2);
	});
});

describe('mapAwarenessCursors (foundational path)', () => {
	it('maps bare {user, cursor} awareness state, skipping self and cursorless peers', () => {
		const map = new Map<number, Record<string, unknown>>([
			[1, { user: { name: 'Self' }, cursor: { x: 1, y: 1 } }],
			[2, { user: { name: 'Bob', color: '#00ff00' }, cursor: { x: 10, y: 20 } }],
			[3, { user: { name: 'NoCursor' } }],
		]);
		const cursors = mapAwarenessCursors(map, 1);
		expect(cursors).toHaveLength(1);
		expect(cursors[0]).toMatchObject({
			clientId: 2,
			userName: 'Bob',
			color: '#00ff00',
			x: 10,
			y: 20,
		});
	});

	it('defaults name/colour when absent', () => {
		const map = new Map<number, Record<string, unknown>>([[2, { cursor: { x: 0, y: 0 } }]]);
		const cursors = mapAwarenessCursors(map, 1);
		expect(cursors[0]).toMatchObject({ userName: 'Guest', color: DEFAULT_CURSOR_COLOR });
	});
});

// ---------------------------------------------------------------------------
// CollaborationService (yjs + y-websocket mocked)
// ---------------------------------------------------------------------------

const { hoisted } = vi.hoisted(() => ({
	hoisted: {
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
		syncCb: null as null | ((p: unknown) => void),
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
			hoisted.slidesObserverCb = cb;
		}
		unobserveDeep(cb: () => void) {
			if (hoisted.slidesObserverCb === cb) {
				hoisted.slidesObserverCb = null;
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
						hoisted.slidesArray = arr;
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

function makeMockAwareness(): {
	clientID: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (e: string, cb: () => void) => void;
	off: () => void;
} {
	return {
		clientID: 1,
		setLocalStateField: (field: string, value: unknown) => {
			const self = hoisted.awarenessStates.get(1) ?? {};
			self[field] = value;
			hoisted.awarenessStates.set(1, self);
		},
		getStates: () => hoisted.awarenessStates,
		on: (e: string, cb: () => void) => {
			if (e === 'change') {
				hoisted.awarenessChange = cb;
			}
		},
		off: () => {},
	};
}

vi.mock(import('y-websocket'), () => ({
	WebsocketProvider: class {
		awareness = makeMockAwareness();
		on(e: string, cb: (p: never) => void) {
			if (e === 'status') {
				hoisted.statusCb = cb as (p: { status?: string }) => void;
			} else if (e === 'sync' || e === 'synced') {
				hoisted.syncCb = cb as (p: unknown) => void;
			}
		}
		disconnect() {}
		destroy() {}
	},
}));

vi.mock(import('y-webrtc'), () => ({
	WebrtcProvider: class {
		awareness = makeMockAwareness();
		on() {}
		disconnect() {}
		destroy() {}
	},
}));

// Imported after the mocks are registered (vitest hoists `vi.mock` regardless).
// eslint-disable-next-line import/first -- intentional: keep the import below the mock registrations for readability.
import { CollaborationService } from './collaboration.service';

function makeService(): { svc: CollaborationService; destroy: () => void } {
	let teardown: (() => void) | undefined;
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: (cb: () => void) => {
			teardown = cb;
			return () => {};
		},
	};
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }],
	});
	const svc = runInInjectionContext(injector, () => new CollaborationService());
	return { svc, destroy: () => (teardown ? teardown() : svc.disconnect()) };
}

function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}

const config = { roomId: 'room-1', serverUrl: 'wss://x', userName: 'Ada' };

describe('collaborationService', () => {
	function reset(): void {
		hoisted.slidesArray = null;
		hoisted.slidesObserverCb = null;
		hoisted.awarenessStates.clear();
		hoisted.awarenessChange = null;
		hoisted.statusCb = null;
		hoisted.syncCb = null;
	}

	it('connects, reflects status, and maps remote presence to cursors', async () => {
		reset();
		const { svc, destroy } = makeService();

		await svc.connect(config, { canvasWidth: 800, canvasHeight: 600 });
		expect(svc.active()).toBeTruthy();

		hoisted.statusCb?.({ status: 'connected' });
		expect(svc.connected()).toBeTruthy();

		// Angular service uses the `presence` key in awareness state.
		hoisted.awarenessStates.set(2, {
			presence: {
				userName: 'Bob',
				userColor: '#ff0000',
				cursorX: 10,
				cursorY: 20,
				lastUpdated: new Date().toISOString(),
			},
		});
		hoisted.awarenessChange?.();

		expect(svc.presence()).toHaveLength(1);
		// cursors() derives from presence; only peers with cursorX/Y appear.
		const cursors = svc.cursors();
		expect(cursors).toHaveLength(1);
		expect(cursors[0]).toMatchObject({ userName: 'Bob', x: 10, y: 20, color: '#ff0000' });
		expect(svc.connectedCount()).toBe(2);

		destroy();
	});

	it('rejects an invalid room id without connecting', async () => {
		reset();
		const { svc, destroy } = makeService();
		await svc.connect({ ...config, roomId: 'bad room' });
		expect(svc.active()).toBeFalsy();
		destroy();
	});

	it('broadcasts local slides via pptx:slides Y.Array once the sync gate opens', async () => {
		reset();
		const onRemoteSlides = vi.fn();
		const { svc, destroy } = makeService();
		await svc.connect(config, { onRemoteSlides });

		// Before the provider confirms its initial sync, broadcasts are deferred
		// (the pending deck is captured, not written).
		svc.broadcastSlides([slide('1'), slide('2')]);
		expect(hoisted.slidesArray?.length ?? 0).toBe(0);

		// The provider's sync confirmation opens the gate and flushes the
		// pending deck into the Y.Array.
		hoisted.syncCb?.(true);
		expect(hoisted.slidesArray?.length).toBeGreaterThan(0);

		destroy();
	});

	it('applies remote slides when pptx:slides Y.Array observer fires', async () => {
		reset();
		const onRemoteSlides = vi.fn();
		const { svc, destroy } = makeService();
		await svc.connect(config, { onRemoteSlides });

		// Simulate a remote peer pushing a slide into the Y.Array.
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
		hoisted.slidesArray?.push([remoteSlideMap]);
		hoisted.slidesObserverCb?.();
		expect(onRemoteSlides).toHaveBeenCalledWith([expect.objectContaining({ id: '9' })]);

		destroy();
	});

	it('publishes cursor + selection updates to local awareness', async () => {
		reset();
		const { svc, destroy } = makeService();
		await svc.connect(config);

		svc.setCursor(33, 44, 1);
		const self = hoisted.awarenessStates.get(1);
		// Angular service sets `cursor` and `presence` fields on awareness.
		expect(self?.cursor).toStrictEqual({ x: 33, y: 44 });
		expect(self?.presence).toMatchObject({ cursorX: 33, cursorY: 44, activeSlideIndex: 1 });

		svc.setSelection('el-7', 2);
		expect(hoisted.awarenessStates.get(1)?.presence).toMatchObject({
			selectedElementId: 'el-7',
			activeSlideIndex: 2,
		});

		destroy();
	});

	it('tears down on disconnect / destroy and resets state', async () => {
		reset();
		const { svc, destroy } = makeService();
		await svc.connect(config);
		expect(svc.active()).toBeTruthy();

		destroy();
		expect(svc.active()).toBeFalsy();
		expect(svc.connected()).toBeFalsy();
		expect(svc.presence()).toHaveLength(0);
	});

	it('connects via the webrtc transport with no server gating', async () => {
		reset();
		const { svc, destroy } = makeService();
		// Blank server + webrtc: no mixed-content check, no timeout; connected now.
		await svc.connect({ ...config, serverUrl: '', transport: 'webrtc' });
		expect(svc.active()).toBeTruthy();
		expect(svc.status()).toBe('connected');
		expect(svc.connected()).toBeTruthy();
		destroy();
	});

	it('times out to error when the websocket never connects', async () => {
		reset();
		vi.useFakeTimers();
		try {
			const { svc, destroy } = makeService();
			await svc.connect(config);
			expect(svc.status()).toBe('connecting');
			vi.advanceTimersByTime(CONNECTION_TIMEOUT_MS + 1);
			expect(svc.status()).toBe('error');
			expect(svc.active()).toBeFalsy();
			destroy();
		} finally {
			vi.useRealTimers();
		}
	});

	it('retry() reconnects with the last config', async () => {
		reset();
		const { svc, destroy } = makeService();
		await svc.connect(config);
		svc.disconnect();
		expect(svc.active()).toBeFalsy();

		await svc.retry();
		expect(svc.active()).toBeTruthy();
		destroy();
	});
});
