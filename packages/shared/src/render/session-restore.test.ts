import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveAutosaveSnapshot } from './autosave-store';
import {
	forgetSessionDeck,
	getSessionTabId,
	loadSessionDeck,
	rememberSessionDeck,
	restoreSessionDeck,
} from './session-restore';

/**
 * The store's contract is "a refresh reopens what THIS tab had, and nothing
 * else". The suite therefore models a reload as "keep sessionStorage, throw the
 * page away" and a new tab as "clear sessionStorage", which is exactly what the
 * browser does, and asserts the two cases diverge.
 */

type GlobalWithStorage = typeof globalThis & {
	indexedDB?: IDBFactory;
	IDBKeyRange?: typeof IDBKeyRange;
	sessionStorage?: Storage;
};

const g = globalThis as GlobalWithStorage;

function makeSessionStorageStub(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k: string) => map.get(k) ?? null,
		key: (i: number) => [...map.keys()][i] ?? null,
		removeItem: (k: string) => {
			map.delete(k);
		},
		setItem: (k: string, v: string) => {
			map.set(k, String(v));
		},
	};
}

const deck = (byte: number): Uint8Array => new Uint8Array([80, 75, byte, byte]);

/**
 * Run `write` with the wall clock pinned to `ms`. Two writes in the same
 * millisecond are indistinguishable to the "is the snapshot newer?" comparison,
 * which is real but untestable at machine speed; pinning makes the ordering the
 * assertion depends on explicit. `Date.now` is stubbed rather than the timers,
 * which IndexedDB's async plumbing needs left alone.
 */
async function at(ms: number, write: () => Promise<unknown>): Promise<void> {
	const now = vi.spyOn(Date, 'now').mockReturnValue(ms);
	try {
		await write();
	} finally {
		now.mockRestore();
	}
}

describe('session-restore', () => {
	beforeEach(() => {
		g.indexedDB = new IDBFactory();
		g.IDBKeyRange = IDBKeyRange;
		g.sessionStorage = makeSessionStorageStub();
	});

	afterEach(() => {
		delete g.indexedDB;
		delete g.IDBKeyRange;
		delete g.sessionStorage;
	});

	it('has no deck to restore before anything is remembered', async () => {
		await expect(loadSessionDeck()).resolves.toBeNull();
		await expect(restoreSessionDeck()).resolves.toBeNull();
	});

	it('does not mint a tab id on a read, so a fresh tab claims nothing', async () => {
		expect(getSessionTabId()).toBeNull();
		await loadSessionDeck();
		expect(getSessionTabId()).toBeNull();
	});

	it('gives the remembered deck back to the same tab (a refresh)', async () => {
		await expect(rememberSessionDeck('slides.pptx', deck(1))).resolves.toBeTruthy();

		const restored = await restoreSessionDeck();
		expect(restored?.fileName).toBe('slides.pptx');
		expect(Array.from(restored?.data ?? [])).toStrictEqual([80, 75, 1, 1]);
	});

	it('keeps the deck out of a different tab', async () => {
		await rememberSessionDeck('slides.pptx', deck(1));
		// A new tab shares IndexedDB but starts with an empty sessionStorage.
		g.sessionStorage = makeSessionStorageStub();

		await expect(restoreSessionDeck()).resolves.toBeNull();
	});

	it('replaces the remembered deck when another file is opened', async () => {
		await rememberSessionDeck('first.pptx', deck(1));
		await rememberSessionDeck('second.pptx', deck(2));

		const restored = await restoreSessionDeck();
		expect(restored?.fileName).toBe('second.pptx');
		expect(Array.from(restored?.data ?? [])).toStrictEqual([80, 75, 2, 2]);
	});

	it('forgets the deck on request', async () => {
		await rememberSessionDeck('slides.pptx', deck(1));
		await forgetSessionDeck();

		await expect(loadSessionDeck()).resolves.toBeNull();
	});

	it('ignores an empty deck', async () => {
		await expect(rememberSessionDeck('empty.pptx', new Uint8Array())).resolves.toBeFalsy();
		await expect(loadSessionDeck()).resolves.toBeNull();
	});

	it('copies the bytes so a later mutation of the caller buffer cannot leak in', async () => {
		const bytes = deck(1);
		await rememberSessionDeck('slides.pptx', bytes);
		bytes[2] = 99;

		const restored = await loadSessionDeck();
		expect(Array.from(restored?.data ?? [])).toStrictEqual([80, 75, 1, 1]);
	});

	it('prefers a newer autosave snapshot, so a mid-edit refresh keeps the edits', async () => {
		const opened = Date.now();
		await at(opened, () => rememberSessionDeck('slides.pptx', deck(1)));
		// The viewer autosaves the edited deck after it was opened.
		await at(opened + 1_000, () => saveAutosaveSnapshot('slides.pptx', deck(7)));

		const restored = await restoreSessionDeck();
		expect(Array.from(restored?.data ?? [])).toStrictEqual([80, 75, 7, 7]);
		expect(restored?.fileName).toBe('slides.pptx');
	});

	it('ignores an autosave snapshot for a different file', async () => {
		const opened = Date.now();
		await at(opened, () => rememberSessionDeck('slides.pptx', deck(1)));
		await at(opened + 1_000, () => saveAutosaveSnapshot('other.pptx', deck(7)));

		const restored = await restoreSessionDeck();
		expect(Array.from(restored?.data ?? [])).toStrictEqual([80, 75, 1, 1]);
	});

	it('degrades to no restore when storage is unavailable', async () => {
		delete g.indexedDB;
		await expect(rememberSessionDeck('slides.pptx', deck(1))).resolves.toBeFalsy();
		await expect(restoreSessionDeck()).resolves.toBeNull();
	});
});
